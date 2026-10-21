-- Botones de pantalla del conductor: mostrar el QR (sobre el logo, sin cortar el juego) y
-- "Cómo va la noche" (ranking en proyector y celulares, no con una pregunta abierta).
-- Van en live_state (el cambio avisa a las pantallas), sin mover updated_at: con una pregunta cerrada,
-- updated_at es el momento del cierre y congela el reloj.

alter table public.live_state
  add column show_qr boolean not null default false,
  add column show_ranking boolean not null default false;

create or replace function private.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Prender o apagar el QR / el ranking no es un cambio de fase: no mueve updated_at.
  if (new.phase, new.block_id, new.block_item_id, new.opened_at, new.timer_seconds, new.extra_seconds,
      new.revealed, new.media_started_at)
     is not distinct from
     (old.phase, old.block_id, old.block_item_id, old.opened_at, old.timer_seconds, old.extra_seconds,
      old.revealed, old.media_started_at) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

create function public.admin_pantalla(p_event_id uuid, p_qr boolean default null, p_ranking boolean default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  perform private.require_admin();
  select * into ls from public.live_state where event_id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if p_ranking and ls.phase = 'item_open' then
    raise exception 'Con una pregunta abierta no se muestra el ranking (taparía las respuestas). Esperá a que se cierre.';
  end if;
  update public.live_state
  set show_qr = coalesce(p_qr, show_qr), show_ranking = coalesce(p_ranking, show_ranking)
  where event_id = p_event_id;
end $$;

grant execute on function public.admin_pantalla(uuid, boolean, boolean) to authenticated;

-- abrir_item (igual que antes) + al abrir una pregunta se saca el ranking.
create or replace function private.abrir_item(p_event_id uuid, p_block_item_id uuid, p_timer_seconds int) returns void
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
      opened_at = now(), media_started_at = null, show_ranking = false, timer_seconds = v_timer, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

-- get_live (igual que antes) + show_qr / show_ranking.
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
  v_ranking jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', r.team_id, 'name', r.name, 'total', r.total, 'position', r.position,
      'block_total', coalesce(bb.total, 0)
    ) order by r.position), '[]'::jsonb)
  into v_ranking
  from public.ranking r
  left join public.ranking_by_block bb on bb.team_id = r.team_id and bb.block_id = ls.block_id
  where r.event_id = e.id;

  return jsonb_build_object(
    'server_now', now(),
    'event', private.event_json(e),
    'phase', coalesce(ls.phase, 'cover'),
    'opened_at', ls.opened_at,
    -- Canción o escena abierta que el proyector todavía no reprodujo: el reloj espera (hasta 30 s).
    'media_waiting', ls.phase = 'item_open' and ls.media_started_at is null
      and coalesce(v_item ->> 'type', '') in ('pista_audio', 'clip_video'),
    'show_qr', coalesce(ls.show_qr, false),
    'show_ranking', coalesce(ls.show_ranking, false),
    'timer_seconds', ls.timer_seconds,
    'extra_seconds', coalesce(ls.extra_seconds, 0),
    'updated_at', ls.updated_at,
    'revealed', case when ls.phase = 'item_revealed' then ls.revealed end,
    'block', v_block,
    'item', v_item,
    'answers_count', jsonb_array_length(v_answered),
    'answered', v_answered,
    'teams_count', jsonb_array_length(v_teams),
    'teams', v_teams,
    'ranking', v_ranking
  );
end $$;

-- admin_reset_event (igual que antes) + apaga QR y ranking.
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
      timer_seconds = null, extra_seconds = 0, revealed = null, show_qr = false, show_ranking = false
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
