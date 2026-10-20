-- Paso 5: motor en vivo. Transiciones de fase (RPC admin_*), puntajes vía score_<dinámica> y estado público.

-- ============================================================
-- Base del motor
-- ============================================================

create function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el conductor puede hacer esto. Entrá con una cuenta autorizada.' using errcode = '42501';
  end if;
end $$;

-- Toda modificación de live_state actualiza updated_at.
create function private.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger live_state_updated_at before update on public.live_state
  for each row execute function private.tocar_updated_at();

-- Verifica admin, bloquea el estado del evento (dos clics simultáneos se ejecutan en orden) y lo pone en vivo.
create function private.live_para_operar(p_event_id uuid) returns public.live_state
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if e.status = 'terminado' then
    raise exception 'Esta noche ya terminó. Para volver a usarla, reiniciala desde el ensayo.';
  end if;
  if e.status in ('borrador', 'listo') then
    update public.events set status = 'en_vivo' where id = e.id;
  end if;
  insert into public.live_state (event_id) values (e.id) on conflict do nothing;
  select * into ls from public.live_state where event_id = e.id for update;
  return ls;
end $$;

-- Puntaje de un ítem: delega en private.score_<dinámica>(block_item_id) si existe (pasos 6, 7 y 9).
-- Devuelve puntos base (hasta 1.000), sin multiplicador.
create function private.score_item(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dynamic text;
begin
  select b.dynamic into v_dynamic
  from public.block_items bi join public.event_blocks b on b.id = bi.block_id
  where bi.id = p_block_item_id;
  if v_dynamic is null or to_regprocedure(format('private.score_%s(uuid)', v_dynamic)) is null then
    return;
  end if;
  return query execute format('select s.team_id, s.points::int, s.detail from private.%I($1) s', 'score_' || v_dynamic)
    using p_block_item_id;
end $$;

-- Validación automática al cerrar: private.validate_<dinámica>(block_item_id) si existe (Hipster, paso 9).
create function private.validar_item(p_block_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dynamic text;
begin
  select b.dynamic into v_dynamic
  from public.block_items bi join public.event_blocks b on b.id = bi.block_id
  where bi.id = p_block_item_id;
  if v_dynamic is not null and to_regprocedure(format('private.validate_%s(uuid)', v_dynamic)) is not null then
    execute format('select private.%I($1)', 'validate_' || v_dynamic) using p_block_item_id;
  end if;
end $$;

-- ============================================================
-- Movimientos internos (sin validar fase: lo hacen las RPC)
-- ============================================================

create function private.ir_a_bloque(p_event_id uuid, p_block_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.event_blocks where id = p_block_id and event_id = p_event_id) then
    raise exception 'Ese bloque no es de esta noche.' using errcode = 'P0002';
  end if;
  update public.live_state
  set phase = 'block_intro', block_id = p_block_id, block_item_id = null,
      opened_at = null, timer_seconds = null, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

create function private.abrir_item(p_event_id uuid, p_block_item_id uuid, p_timer_seconds int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_block_id uuid;
  v_config jsonb;
  v_timer int;
begin
  select bi.block_id, b.config into v_block_id, v_config
  from public.block_items bi join public.event_blocks b on b.id = bi.block_id
  where bi.id = p_block_item_id and b.event_id = p_event_id;
  if not found then
    raise exception 'Ese ítem no es de esta noche.' using errcode = 'P0002';
  end if;
  v_timer := coalesce(p_timer_seconds, (v_config ->> 'timer_seconds')::int);
  if v_timer is not null and (v_timer < 5 or v_timer > 3600) then
    raise exception 'El tiempo tiene que estar entre 5 segundos y 1 hora.';
  end if;
  update public.live_state
  set phase = 'item_open', block_id = v_block_id, block_item_id = p_block_item_id,
      opened_at = now(), timer_seconds = v_timer, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

create function private.bloque_siguiente(p_event_id uuid, p_block_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select b.id
  from public.event_blocks b
  where b.event_id = p_event_id
    and (p_block_id is null or (b.position, b.id) > (select o.position, o.id from public.event_blocks o where o.id = p_block_id))
  order by b.position, b.id
  limit 1;
$$;

create function private.item_siguiente(p_block_id uuid, p_block_item_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select i.id
  from public.block_items i
  where i.block_id = p_block_id
    and (p_block_item_id is null or (i.position, i.id) > (select o.position, o.id from public.block_items o where o.id = p_block_item_id))
  order by i.position, i.id
  limit 1;
$$;

-- ============================================================
-- RPC del conductor
-- ============================================================

create function public.admin_start_event(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase in ('item_open', 'item_closed') then
    raise exception 'Hay un ítem en juego: revelalo antes de volver a la portada.';
  end if;
  update public.live_state
  set phase = 'cover', block_id = null, block_item_id = null,
      opened_at = null, timer_seconds = null, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

create function public.admin_start_block(p_event_id uuid, p_block_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase in ('item_open', 'item_closed') then
    raise exception 'Hay un ítem en juego: revelalo antes de pasar a otro bloque.';
  end if;
  perform private.ir_a_bloque(p_event_id, p_block_id);
end $$;

create function public.admin_open_item(p_event_id uuid, p_block_item_id uuid, p_timer_seconds int default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase = 'item_open' and ls.block_item_id = p_block_item_id then
    raise exception 'Este ítem ya está abierto.';
  end if;
  if ls.phase = 'item_closed' and ls.block_item_id = p_block_item_id then
    raise exception 'Las respuestas de este ítem están cerradas: usá «Reabrir».';
  end if;
  if ls.phase in ('item_open', 'item_closed') then
    raise exception 'Hay otro ítem en juego: revelalo antes de abrir uno nuevo.';
  end if;
  perform private.abrir_item(p_event_id, p_block_item_id, p_timer_seconds);
end $$;

create function public.admin_add_time(p_event_id uuid, p_seconds int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase <> 'item_open' then
    raise exception 'Solo se puede sumar tiempo con el ítem abierto.';
  end if;
  if ls.timer_seconds is null then
    raise exception 'Este ítem no tiene temporizador.';
  end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 300 then
    raise exception 'Se pueden sumar entre 1 y 300 segundos.';
  end if;
  update public.live_state set extra_seconds = least(extra_seconds + p_seconds, 3600) where event_id = p_event_id;
end $$;

create function public.admin_close_item(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase <> 'item_open' then
    raise exception 'Solo se pueden cerrar las respuestas de un ítem abierto.';
  end if;
  perform private.validar_item(ls.block_item_id);
  update public.live_state set phase = 'item_closed' where event_id = p_event_id;
end $$;

create function public.admin_reopen_item(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase <> 'item_closed' then
    raise exception 'Solo se puede reabrir un ítem con las respuestas cerradas.';
  end if;
  update public.live_state set phase = 'item_open' where event_id = p_event_id;
end $$;

-- Puntajes finales (× multiplicador), registro en score_entries (salvo práctica) y solución a revealed.
-- Idempotente: si ya está revelado no hace nada; volver a revelar un ítem reabierto actualiza los puntos.
create function public.admin_reveal(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_item_id uuid;
  v_solution jsonb;
  v_puntos jsonb;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase = 'item_revealed' then
    return;
  end if;
  if ls.phase <> 'item_closed' then
    raise exception 'Primero cerrá las respuestas.';
  end if;

  select * into b from public.event_blocks where id = ls.block_id;
  select bi.catalog_item_id into v_item_id from public.block_items bi where bi.id = ls.block_item_id;
  select cs.solution into v_solution from public.catalog_solutions cs where cs.item_id = v_item_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', s.team_id, 'name', t.name,
      'points', round(s.points * b.multiplier)::int, 'detail', s.detail
    ) order by s.points desc, lower(t.name)), '[]'::jsonb)
  into v_puntos
  from private.score_item(ls.block_item_id) s
  join public.teams t on t.id = s.team_id;

  if not b.is_practice then
    insert into public.score_entries (event_id, team_id, block_id, block_item_id, points, reason, origin)
    select p_event_id, x.team_id, b.id, ls.block_item_id, x.points, b.title, 'auto'
    from jsonb_to_recordset(v_puntos) as x (team_id uuid, points int)
    on conflict (block_item_id, team_id) where origin = 'auto' do update set points = excluded.points;
  end if;

  update public.catalog_items
  set used_in_events = array_append(used_in_events, p_event_id)
  where id = v_item_id and not (p_event_id = any (used_in_events));

  update public.live_state
  set phase = 'item_revealed',
      revealed = jsonb_build_object(
        'block_item_id', ls.block_item_id,
        'solution', coalesce(v_solution, '{}'::jsonb),
        'points', v_puntos,
        'practice', b.is_practice
      )
  where event_id = p_event_id;
end $$;

-- Acción "Siguiente": avanza al paso natural de la noche según la fase.
create function public.admin_next(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_siguiente uuid;
begin
  ls := private.live_para_operar(p_event_id);
  select * into b from public.event_blocks where id = ls.block_id;

  case ls.phase
    when 'cover' then
      v_siguiente := private.bloque_siguiente(p_event_id, null);
      if v_siguiente is null then
        raise exception 'Esta noche no tiene bloques todavía.';
      end if;
      perform private.ir_a_bloque(p_event_id, v_siguiente);

    when 'block_intro' then
      v_siguiente := private.item_siguiente(ls.block_id, null);
      if v_siguiente is null then
        raise exception 'Este bloque no tiene ítems todavía.';
      end if;
      perform private.abrir_item(p_event_id, v_siguiente, null);

    when 'item_revealed' then
      v_siguiente := private.item_siguiente(ls.block_id, ls.block_item_id);
      if v_siguiente is not null then
        perform private.abrir_item(p_event_id, v_siguiente, null);
      elsif b.is_practice then
        v_siguiente := private.bloque_siguiente(p_event_id, ls.block_id);
        if v_siguiente is null then
          update public.live_state set phase = 'final', revealed = null where event_id = p_event_id;
        else
          perform private.ir_a_bloque(p_event_id, v_siguiente);
        end if;
      else
        update public.live_state set phase = 'block_ranking', revealed = null where event_id = p_event_id;
      end if;

    when 'block_ranking' then
      v_siguiente := private.bloque_siguiente(p_event_id, ls.block_id);
      if v_siguiente is null then
        update public.live_state set phase = 'final' where event_id = p_event_id;
      else
        perform private.ir_a_bloque(p_event_id, v_siguiente);
      end if;

    when 'item_open' then
      raise exception 'Primero cerrá las respuestas.';
    when 'item_closed' then
      raise exception 'Primero revelá la solución.';
    else
      raise exception 'La noche ya está en el final. Para cerrarla, tocá «Terminar la noche».';
  end case;
end $$;

create function public.admin_show_block_ranking(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase in ('item_open', 'item_closed') then
    raise exception 'Hay un ítem en juego: revelalo antes de mostrar el ranking.';
  end if;
  if ls.block_id is null then
    raise exception 'Todavía no empezó ningún bloque.';
  end if;
  if (select is_practice from public.event_blocks where id = ls.block_id) then
    raise exception 'La ronda de práctica no tiene ranking.';
  end if;
  update public.live_state set phase = 'block_ranking', revealed = null where event_id = p_event_id;
end $$;

create function public.admin_finish(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase in ('item_open', 'item_closed') then
    raise exception 'Hay un ítem en juego: revelalo antes de terminar la noche.';
  end if;
  update public.live_state set phase = 'final', revealed = null where event_id = p_event_id;
  update public.events set status = 'terminado' where id = p_event_id;
end $$;

-- Mesas con PIN y conexión (solo conductor).
create function public.admin_list_teams(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'pin', t.pin, 'active', t.active, 'last_seen', t.last_seen,
        'connected', coalesce(t.last_seen > now() - interval '30 seconds', false)
      ) order by t.created_at), '[]'::jsonb)
    from public.teams t
    where t.event_id = p_event_id
  );
end $$;

-- ============================================================
-- get_live: suma quién respondió el ítem actual (solo ids, nunca qué)
-- ============================================================

create or replace function public.get_live(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  b public.event_blocks;
  v_block jsonb;
  v_item jsonb;
  v_answered jsonb := '[]'::jsonb;
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
    select coalesce(jsonb_agg(a.team_id), '[]'::jsonb) into v_answered
    from public.answers a
    where a.block_item_id = ls.block_item_id;
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
    'answers_count', jsonb_array_length(v_answered),
    'answered', v_answered,
    'teams_count', jsonb_array_length(v_teams),
    'teams', v_teams
  );
end $$;

-- ============================================================
-- Permisos de ejecución
-- ============================================================

-- Postgres da EXECUTE a PUBLIC en toda función nueva, y ese default es global: el revoke por esquema de la
-- migración inicial no lo quitaba. Se cierra acá (también para las funciones futuras) y se abre explícito.
alter default privileges for role postgres revoke execute on functions from public;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Públicas: proyector y celulares.
grant execute on function public.get_event_public(text) to anon, authenticated;
grant execute on function public.get_live(text) to anon, authenticated;
grant execute on function public.join_team(text, text) to anon, authenticated;
grant execute on function public.rejoin_team(text, uuid, text) to anon, authenticated;
grant execute on function public.whoami(text) to anon, authenticated;
grant execute on function public.heartbeat(text) to anon, authenticated;

-- Sesión con Google (RLS y pantalla "Sin acceso").
grant execute on function public.is_admin() to authenticated;

-- Solo el conductor (authenticated + is_admin adentro). anon no puede ni llamarlas.
grant execute on function public.admin_start_event(uuid) to authenticated;
grant execute on function public.admin_start_block(uuid, uuid) to authenticated;
grant execute on function public.admin_open_item(uuid, uuid, int) to authenticated;
grant execute on function public.admin_add_time(uuid, int) to authenticated;
grant execute on function public.admin_close_item(uuid) to authenticated;
grant execute on function public.admin_reopen_item(uuid) to authenticated;
grant execute on function public.admin_reveal(uuid) to authenticated;
grant execute on function public.admin_next(uuid) to authenticated;
grant execute on function public.admin_show_block_ranking(uuid) to authenticated;
grant execute on function public.admin_finish(uuid) to authenticated;
grant execute on function public.admin_list_teams(uuid) to authenticated;
