-- Módulo opcional por noche: misiones secretas y desafíos (juegos fuera de pantalla).
-- Se activa por noche (events.settings: misiones / desafios). Con los dos apagados nada cambia.
-- Misiones: para todas las mesas; se abren y se cierran todas juntas; cada mesa suma una vez.
-- Desafíos: se lanzan de a uno; solo la primera mesa suma.
-- Los puntos van como puntos manuales (score_entries, origin 'manual'): el ranking los suma solo y
-- no aparecen en el ranking por bloque. Sin multiplicador.

create table public.event_extras (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('mision', 'desafio')),
  position int not null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 300),
  points int not null check (points between 1 and 10000),
  status text not null default 'oculto' check (status in ('oculto', 'abierto', 'cerrado')),
  created_at timestamptz not null default now()
);
create index event_extras_event on public.event_extras (event_id, kind, position);

-- Quién cumplió cada misión / quién ganó cada desafío, con el movimiento de puntos que generó.
create table public.extra_completions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  extra_id uuid not null references public.event_extras (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  score_entry_id uuid references public.score_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (extra_id, team_id)
);

alter table public.event_extras enable row level security;
alter table public.extra_completions enable row level security;
create policy admin_lee_event_extras on public.event_extras for select to authenticated using ((select public.is_admin()));
create policy admin_lee_extra_completions on public.extra_completions for select to authenticated using ((select public.is_admin()));
grant select on public.event_extras, public.extra_completions to authenticated;

create trigger event_extras_avisar after insert or update or delete on public.event_extras
  for each row execute function private.avisar_cambio();
create trigger extra_completions_avisar after insert or update or delete on public.extra_completions
  for each row execute function private.avisar_cambio();

-- ============================================================
-- Preparación (Armar)
-- ============================================================

create function public.admin_set_extras(p_event_id uuid, p_misiones boolean, p_desafios boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.events
  set settings = settings || jsonb_build_object('misiones', coalesce(p_misiones, false), 'desafios', coalesce(p_desafios, false))
  where id = p_event_id;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
end $$;

-- Alta o edición. p: {id?, event_id, kind, title, description?, points}. Devuelve el id.
create function public.admin_save_extra(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_title text := btrim(coalesce(p ->> 'title', ''));
  v_desc text := nullif(btrim(coalesce(p ->> 'description', '')), '');
  v_points int;
  v_kind text := p ->> 'kind';
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  x public.event_extras;
begin
  perform private.require_admin();
  begin
    v_points := (p ->> 'points')::int;
  exception when others then
    v_points := null;
  end;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'El nombre tiene que tener entre 1 y 120 caracteres.';
  end if;
  if char_length(coalesce(v_desc, '')) > 300 then
    raise exception 'La descripción puede tener hasta 300 caracteres.';
  end if;
  if v_points is null or v_points < 1 or v_points > 10000 then
    raise exception 'Los puntos tienen que estar entre 1 y 10.000.';
  end if;

  if v_id is null then
    if v_kind is null or v_kind not in ('mision', 'desafio') then
      raise exception 'Elegí si es una misión secreta o un desafío.';
    end if;
    if not exists (select 1 from public.events where id = v_event) then
      raise exception 'No encontramos esa noche.' using errcode = 'P0002';
    end if;
    insert into public.event_extras (event_id, kind, position, title, description, points, status)
    values (
      v_event, v_kind,
      coalesce((select max(position) from public.event_extras where event_id = v_event and kind = v_kind), 0) + 1,
      v_title, v_desc, v_points,
      -- Una misión nueva con las misiones ya abiertas queda abierta (se abren y cierran todas juntas).
      case when v_kind = 'mision' and exists (
        select 1 from public.event_extras where event_id = v_event and kind = 'mision' and status = 'abierto'
      ) then 'abierto' else 'oculto' end
    )
    returning id into v_id;
  else
    select * into x from public.event_extras where id = v_id for update;
    if not found then
      raise exception 'No encontramos esa misión o desafío.' using errcode = 'P0002';
    end if;
    if x.points <> v_points and exists (select 1 from public.extra_completions where extra_id = v_id) then
      raise exception 'Ya hay mesas que sumaron estos puntos. Para cambiarlos, sacáselos primero.';
    end if;
    update public.event_extras set title = v_title, description = v_desc, points = v_points where id = v_id;
  end if;
  return v_id;
end $$;

create function public.admin_delete_extra(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.extra_completions where extra_id = p_id) then
    raise exception 'Ya hay mesas que sumaron estos puntos. Para borrarlo, sacáselos primero.';
  end if;
  delete from public.event_extras where id = p_id;
  if not found then
    raise exception 'No encontramos esa misión o desafío.' using errcode = 'P0002';
  end if;
end $$;

-- Todo lo del módulo de una noche, para Armar y para conducir.
create function public.admin_get_extras(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'misiones', coalesce((e.settings ->> 'misiones')::boolean, false),
    'desafios', coalesce((e.settings ->> 'desafios')::boolean, false),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'position', x.position, 'title', x.title, 'description', x.description,
        'points', x.points, 'status', x.status,
        'completions', coalesce((
          select jsonb_agg(jsonb_build_object('team_id', c.team_id, 'score_entry_id', c.score_entry_id) order by c.created_at)
          from public.extra_completions c where c.extra_id = x.id
        ), '[]'::jsonb)
      ) order by x.kind, x.position)
      from public.event_extras x where x.event_id = p_event_id
    ), '[]'::jsonb)
  );
end $$;

-- ============================================================
-- En vivo
-- ============================================================

-- La fila bloqueada, con el módulo de su tipo activo en la noche.
create function private.extra_operable(p_id uuid) returns public.event_extras
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.event_extras;
  v_activo boolean;
begin
  perform private.require_admin();
  select * into x from public.event_extras where id = p_id for update;
  if not found then
    raise exception 'No encontramos esa misión o desafío.' using errcode = 'P0002';
  end if;
  select coalesce((settings ->> case when x.kind = 'mision' then 'misiones' else 'desafios' end)::boolean, false)
  into v_activo from public.events where id = x.event_id;
  if not v_activo then
    raise exception 'Esta noche no tiene activad% %. Activalos en Armar.',
      case when x.kind = 'mision' then 'as' else 'os' end,
      case when x.kind = 'mision' then 'las misiones secretas' else 'los desafíos' end;
  end if;
  return x;
end $$;

-- Suma los puntos y registra quién lo cumplió.
create function private.acreditar(x public.event_extras, p_team_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_entry uuid;
begin
  if not exists (select 1 from public.teams where id = p_team_id and event_id = x.event_id) then
    raise exception 'Esa mesa no es de esta noche.' using errcode = 'P0002';
  end if;
  insert into public.score_entries (event_id, team_id, points, reason, origin)
  values (x.event_id, p_team_id, x.points,
          left(case when x.kind = 'mision' then 'Misión: ' else 'Desafío: ' end || x.title, 200), 'manual')
  returning id into v_entry;
  insert into public.extra_completions (event_id, extra_id, team_id, score_entry_id)
  values (x.event_id, x.id, p_team_id, v_entry);
end $$;

-- Saca los puntos (anula el movimiento) y borra el registro.
create function private.desacreditar(p_extra_id uuid, p_team_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.extra_completions;
begin
  delete from public.extra_completions where extra_id = p_extra_id and team_id = p_team_id returning * into c;
  if c.score_entry_id is not null then
    update public.score_entries set voided = true where id = c.score_entry_id;
  end if;
end $$;

-- Abre o cierra todas las misiones de la noche juntas.
create function public.admin_misiones_estado(p_event_id uuid, p_abiertas boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if not coalesce((select (settings ->> 'misiones')::boolean from public.events where id = p_event_id), false) then
    raise exception 'Esta noche no tiene activadas las misiones secretas. Activalas en Armar.';
  end if;
  if not exists (select 1 from public.event_extras where event_id = p_event_id and kind = 'mision') then
    raise exception 'Todavía no hay misiones. Cargalas en Armar.';
  end if;
  update public.event_extras
  set status = case when p_abiertas then 'abierto' else 'cerrado' end
  where event_id = p_event_id and kind = 'mision';
end $$;

-- Tilda o destilda una misión para una mesa. Se puede con las misiones abiertas o ya cerradas
-- (el presentador puede avisar tarde), no con las ocultas.
create function public.admin_mision_marcar(p_extra_id uuid, p_team_id uuid, p_cumplida boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.event_extras;
begin
  x := private.extra_operable(p_extra_id);
  if x.kind <> 'mision' then
    raise exception 'Eso es un desafío, no una misión.';
  end if;
  if x.status = 'oculto' then
    raise exception 'Las misiones todavía no se abrieron.';
  end if;
  if p_cumplida then
    if not exists (select 1 from public.extra_completions where extra_id = x.id and team_id = p_team_id) then
      perform private.acreditar(x, p_team_id);
    end if;
  else
    perform private.desacreditar(x.id, p_team_id);
  end if;
end $$;

-- Lanza un desafío (de a uno por vez).
create function public.admin_desafio_lanzar(p_extra_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.event_extras;
  v_otro text;
begin
  x := private.extra_operable(p_extra_id);
  if x.kind <> 'desafio' then
    raise exception 'Eso es una misión, no un desafío.';
  end if;
  if x.status <> 'oculto' then
    raise exception 'Ese desafío ya se lanzó.';
  end if;
  select title into v_otro from public.event_extras
  where event_id = x.event_id and kind = 'desafio' and status = 'abierto' and id <> x.id;
  if found then
    raise exception 'Ya hay un desafío en curso: «%». Elegí la mesa ganadora o cerralo primero.', v_otro;
  end if;
  update public.event_extras set status = 'abierto' where id = x.id;
end $$;

-- Cierra el desafío lanzado: con la mesa que llegó primero (suma) o sin ganadora (p_team_id null).
create function public.admin_desafio_cerrar(p_extra_id uuid, p_team_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.event_extras;
begin
  x := private.extra_operable(p_extra_id);
  if x.kind <> 'desafio' then
    raise exception 'Eso es una misión, no un desafío.';
  end if;
  if x.status <> 'abierto' then
    raise exception 'Ese desafío no está en curso.';
  end if;
  if p_team_id is not null then
    perform private.acreditar(x, p_team_id);
  end if;
  update public.event_extras set status = 'cerrado' where id = x.id;
end $$;

-- Deshace el cierre (mesa equivocada o cerrado de más): saca los puntos y lo vuelve a poner en curso.
create function public.admin_desafio_reabrir(p_extra_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.event_extras;
  v_otro text;
  c record;
begin
  x := private.extra_operable(p_extra_id);
  if x.kind <> 'desafio' or x.status <> 'cerrado' then
    raise exception 'Solo se puede reabrir un desafío cerrado.';
  end if;
  select title into v_otro from public.event_extras
  where event_id = x.event_id and kind = 'desafio' and status = 'abierto' and id <> x.id;
  if found then
    raise exception 'Ya hay un desafío en curso: «%». Elegí la mesa ganadora o cerralo primero.', v_otro;
  end if;
  for c in select team_id from public.extra_completions where extra_id = x.id loop
    perform private.desacreditar(x.id, c.team_id);
  end loop;
  update public.event_extras set status = 'abierto' where id = x.id;
end $$;

-- ============================================================
-- Pantallas: lo que ven el proyector y los celulares (solo lo abierto). Con el token de una mesa,
-- además qué misiones cumplió esa mesa (nunca las de las otras).
-- ============================================================

create function public.get_extras(p_code text, p_token text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  v_team uuid;
  v_misiones boolean;
  v_desafios boolean;
begin
  e := private.event_by_code(p_code);
  v_misiones := coalesce((e.settings ->> 'misiones')::boolean, false);
  v_desafios := coalesce((e.settings ->> 'desafios')::boolean, false);
  if p_token is not null then
    begin
      select id into v_team from public.teams where token = p_token::uuid and event_id = e.id and active;
    exception when others then
      v_team := null;
    end;
  end if;
  return jsonb_build_object(
    'misiones', case when v_misiones then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'title', x.title, 'description', x.description, 'points', x.points,
        'cumplida', v_team is not null and exists (select 1 from public.extra_completions c where c.extra_id = x.id and c.team_id = v_team)
      ) order by x.position)
      from public.event_extras x where x.event_id = e.id and x.kind = 'mision' and x.status = 'abierto'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'desafio', case when v_desafios then (
      select jsonb_build_object('id', x.id, 'title', x.title, 'description', x.description, 'points', x.points)
      from public.event_extras x where x.event_id = e.id and x.kind = 'desafio' and x.status = 'abierto'
      order by x.position limit 1
    ) end
  );
end $$;

-- ============================================================
-- Duplicar y reiniciar noches: igual que antes + el módulo.
-- ============================================================

create or replace function public.admin_duplicate_event(p_event_id uuid, p_name text, p_code text, p_date date default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
  v_id uuid;
  b record;
  v_bloque uuid;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  v_id := public.admin_save_event(jsonb_build_object(
    'name', p_name, 'code', p_code, 'date', p_date, 'venue', e.venue, 'edicion', e.settings ->> 'edicion', 'status', 'borrador'
  ));
  update public.events set settings = e.settings where id = v_id;
  for b in select * from public.event_blocks where event_id = p_event_id order by position loop
    insert into public.event_blocks (event_id, position, dynamic, title, multiplier, is_practice, config)
    values (v_id, b.position, b.dynamic, b.title, b.multiplier, b.is_practice, b.config)
    returning id into v_bloque;
    insert into public.block_items (block_id, position, catalog_item_id)
    select v_bloque, position, catalog_item_id from public.block_items where block_id = b.id;
  end loop;
  -- Misiones y desafíos: la lista, sin abrir ni lanzar.
  insert into public.event_extras (event_id, kind, position, title, description, points)
  select v_id, kind, position, title, description, points from public.event_extras where event_id = p_event_id;
  return v_id;
end $$;

create or replace function public.admin_reset_event(p_event_id uuid, p_code text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if upper(btrim(coalesce(p_code, ''))) <> e.code then
    raise exception 'El código no coincide. Escribí % para confirmar.', e.code;
  end if;

  -- live_state primero: deja de apuntar a ítems y fases en juego.
  update public.live_state
  set phase = 'cover', block_id = null, block_item_id = null, opened_at = null,
      timer_seconds = null, extra_seconds = 0, revealed = null
  where event_id = p_event_id;

  delete from public.score_entries where event_id = p_event_id;
  delete from public.answers where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id; -- con sus intentos de PIN y misiones cumplidas (cascade)
  update public.event_extras set status = 'oculto' where event_id = p_event_id;

  update public.events set status = 'listo' where id = p_event_id;
  update public.catalog_items
  set used_in_events = array_remove(used_in_events, p_event_id)
  where p_event_id = any (used_in_events);
end $$;

grant execute on function public.admin_set_extras(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_save_extra(jsonb) to authenticated;
grant execute on function public.admin_delete_extra(uuid) to authenticated;
grant execute on function public.admin_get_extras(uuid) to authenticated;
grant execute on function public.admin_misiones_estado(uuid, boolean) to authenticated;
grant execute on function public.admin_mision_marcar(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_desafio_lanzar(uuid) to authenticated;
grant execute on function public.admin_desafio_cerrar(uuid, uuid) to authenticated;
grant execute on function public.admin_desafio_reabrir(uuid) to authenticated;
grant execute on function public.get_extras(text, text) to anon, authenticated;
