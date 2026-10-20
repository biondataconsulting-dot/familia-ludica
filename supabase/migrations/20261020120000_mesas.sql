-- Paso 4: mesas (registro, reingreso con PIN, presencia) y avisos en vivo.

-- ============================================================
-- Intentos fallidos de reingreso (límite: 5 por mesa por minuto)
-- ============================================================

create table public.rejoin_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index rejoin_attempts_team_idx on public.rejoin_attempts (team_id, created_at);
alter table public.rejoin_attempts enable row level security;
create policy admin_lee_rejoin_attempts on public.rejoin_attempts
  for select to authenticated using ((select public.is_admin()));
revoke all on public.rejoin_attempts from anon, authenticated;
grant select on public.rejoin_attempts to authenticated;

-- ============================================================
-- Helpers internos
-- ============================================================

-- La mesa se identifica siempre por su token secreto, nunca por team_id enviado por el cliente.
create function private.team_by_token(p_token text) returns public.teams
language plpgsql stable security definer set search_path = '' as $$
declare
  v_token uuid;
  t public.teams;
begin
  begin
    v_token := p_token::uuid;
  exception when others then
    v_token := null;
  end;
  select * into t from public.teams where token = v_token and active;
  if not found then
    raise exception 'Tu mesa ya no está registrada en esta noche. Registrala de nuevo o tocá «Ya estamos jugando».'
      using errcode = 'P0002';
  end if;
  return t;
end $$;

create function private.team_json(t public.teams) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('team_id', t.id, 'token', t.token, 'pin', t.pin, 'name', t.name);
$$;

-- ============================================================
-- RPC de mesa
-- ============================================================

create function public.join_team(p_code text, p_name text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  t public.teams;
begin
  e := private.event_by_code(p_code);
  if e.status = 'terminado' then
    raise exception 'Esta noche ya terminó. ¡Gracias por jugar!';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 24 then
    raise exception 'El nombre de la mesa tiene que tener entre 2 y 24 caracteres.';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception 'El nombre tiene caracteres que no se pueden usar. Probá con otro.';
  end if;
  if (select count(*) from public.teams where event_id = e.id and active) >= 30 then
    raise exception 'Ya hay 30 mesas registradas, que es el máximo. Pedile ayuda al conductor.';
  end if;

  begin
    insert into public.teams (event_id, name, pin, last_seen)
    values (e.id, v_name, lpad(floor(random() * 10000)::int::text, 4, '0'), now())
    returning * into t;
  exception when unique_violation then
    raise exception 'Ese nombre ya está en uso. Si son ustedes, tocá «Ya estamos jugando».';
  end;

  return private.team_json(t);
end $$;

-- Reingreso desde otro dispositivo. PIN incorrecto o demasiados intentos devuelven {error}
-- en lugar de lanzar excepción, para que el intento fallido quede registrado (una excepción lo desharía).
create function public.rejoin_team(p_code text, p_team_id uuid, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
  t public.teams;
  fallos int;
begin
  e := private.event_by_code(p_code);
  select * into t from public.teams where id = p_team_id and event_id = e.id and active;
  if not found then
    raise exception 'No encontramos esa mesa en esta noche. Elegila de nuevo de la lista.' using errcode = 'P0002';
  end if;

  select count(*) into fallos
  from public.rejoin_attempts
  where team_id = t.id and created_at > now() - interval '1 minute';
  if fallos >= 5 then
    return jsonb_build_object('error', 'Demasiados intentos con PIN incorrecto. Esperá un minuto y probá de nuevo.');
  end if;

  if p_pin is distinct from t.pin then
    insert into public.rejoin_attempts (team_id) values (t.id);
    if fallos + 1 >= 5 then
      return jsonb_build_object('error', 'PIN incorrecto. Llegaste al límite de intentos: esperá un minuto y probá de nuevo.');
    end if;
    return jsonb_build_object('error', format(
      'PIN incorrecto. Lo ven arriba en el otro celular de la mesa, o se lo pueden pedir al conductor. Quedan %s intentos.',
      5 - fallos - 1
    ));
  end if;

  update public.teams set last_seen = now() where id = t.id;
  return private.team_json(t);
end $$;

-- La mesa y su respuesta al ítem actual (solo la propia).
create function public.whoami(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.teams;
  ls public.live_state;
  v_answer jsonb;
begin
  t := private.team_by_token(p_token);
  select * into ls from public.live_state where event_id = t.event_id;
  if ls.block_item_id is not null then
    select a.answer into v_answer
    from public.answers a
    where a.block_item_id = ls.block_item_id and a.team_id = t.id;
  end if;
  return private.team_json(t) || jsonb_build_object(
    'event_code', (select code from public.events where id = t.event_id),
    'block_item_id', ls.block_item_id,
    'answer', v_answer
  );
end $$;

create function public.heartbeat(p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  t public.teams;
begin
  t := private.team_by_token(p_token);
  update public.teams set last_seen = now() where id = t.id;
end $$;

-- ============================================================
-- get_live: suma la lista pública de mesas (nombre y conexión, sin token ni PIN)
-- ============================================================

create or replace function public.get_live(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  b public.event_blocks;
  v_block jsonb;
  v_item jsonb;
  n_answers int := 0;
  v_teams jsonb;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id;

  if ls.block_id is not null then
    select * into b from public.event_blocks where id = ls.block_id;
    v_block := jsonb_build_object(
      'id', b.id, 'dynamic', b.dynamic, 'title', b.title, 'is_practice', b.is_practice,
      'multiplier', b.multiplier, 'position', b.position,
      'number', (select count(*) from public.event_blocks o where o.event_id = e.id and o.position <= b.position),
      'total_blocks', (select count(*) from public.event_blocks o where o.event_id = e.id),
      'total_items', (select count(*) from public.block_items i where i.block_id = b.id),
      'timer_seconds', b.config -> 'timer_seconds'
    );
  end if;

  if ls.block_item_id is not null then
    select jsonb_build_object(
      'block_item_id', p.block_item_id, 'position', p.position, 'number', p.number,
      'type', p.type, 'content', p.content
    ) into v_item
    from public.public_item p
    where p.event_id = e.id;
    select count(*) into n_answers from public.answers where block_item_id = ls.block_item_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'connected', coalesce(t.last_seen > now() - interval '30 seconds', false)
    ) order by t.created_at), '[]'::jsonb)
  into v_teams
  from public.teams t
  where t.event_id = e.id and t.active;

  return jsonb_build_object(
    'server_now', now(),
    'event', private.event_json(e),
    'phase', coalesce(ls.phase, 'cover'),
    'opened_at', ls.opened_at,
    'timer_seconds', ls.timer_seconds,
    'extra_seconds', coalesce(ls.extra_seconds, 0),
    'updated_at', ls.updated_at,
    'revealed', case when ls.phase = 'item_revealed' then ls.revealed end,
    'block', v_block,
    'item', v_item,
    'answers_count', n_answers,
    'teams_count', jsonb_array_length(v_teams),
    'teams', v_teams
  );
end $$;

-- ============================================================
-- Avisos en vivo: un broadcast público "cambio" por evento (canal evento:<CODIGO>).
-- No lleva datos: las pantallas, al recibirlo, vuelven a pedir get_live.
-- ============================================================

create function private.avisar_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_code text;
begin
  if tg_op = 'DELETE' then
    v_event := old.event_id;
  else
    v_event := new.event_id;
  end if;
  select code into v_code from public.events where id = v_event;
  if v_code is not null then
    begin
      perform realtime.send(jsonb_build_object('tabla', tg_table_name), 'cambio', 'evento:' || v_code, false);
    exception when others then
      -- Un aviso perdido no debe romper la operación: las pantallas igual releen cada 5 s.
      raise warning 'No se pudo enviar el aviso en vivo: %', sqlerrm;
    end;
  end if;
  return null;
end $$;

-- teams: altas, bajas y cambios de nombre/estado (no el heartbeat, que solo toca last_seen).
create trigger teams_avisar_alta_baja after insert or delete on public.teams
  for each row execute function private.avisar_cambio();
create trigger teams_avisar_cambio after update of name, active on public.teams
  for each row execute function private.avisar_cambio();
create trigger live_state_avisar after insert or update on public.live_state
  for each row execute function private.avisar_cambio();
create trigger answers_avisar after insert or update or delete on public.answers
  for each row execute function private.avisar_cambio();
create trigger score_entries_avisar after insert or update or delete on public.score_entries
  for each row execute function private.avisar_cambio();

grant execute on function public.join_team(text, text) to anon, authenticated;
grant execute on function public.rejoin_team(text, uuid, text) to anon, authenticated;
grant execute on function public.whoami(text) to anon, authenticated;
grant execute on function public.heartbeat(text) to anon, authenticated;
