-- Mejoras después de la primera noche real (24/10):
-- · Corregir después de revelar: aceptar / rechazar respuestas y juntar / separar grupos de Oveja Oveja
--   también con la pregunta revelada (mientras sea la actual). Los puntos de esa pregunta se recalculan
--   solos (score_entries automáticos y el revelado que ven las pantallas).
-- · Botón "Mostrar podio" en cualquier momento (live_state.show_podio), sin terminar la noche.
-- · Ranking con la penalización de cada mesa (suma de puntos manuales negativos, sin los anulados).

alter table public.live_state add column show_podio boolean not null default false;

create or replace function private.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Prender o apagar el QR / el ranking / el podio, o recalcular los puntos del revelado, no mueve updated_at.
  if (new.phase, new.block_id, new.block_item_id, new.opened_at, new.timer_seconds, new.extra_seconds,
      new.revealed - 'points', new.media_started_at)
     is not distinct from
     (old.phase, old.block_id, old.block_item_id, old.opened_at, old.timer_seconds, old.extra_seconds,
      old.revealed - 'points', old.media_started_at) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ============================================================
-- Recalcular los puntos de la pregunta revelada (después de una corrección del conductor)
-- ============================================================

-- Igual que admin_reveal: puntos × multiplicador. Solo si la pregunta está revelada y es la actual
-- (antes de revelar no hay nada registrado: los provisorios se calculan al pedirlos). Una mesa que ya no
-- suma pierde su movimiento automático; lo que el conductor anuló sigue anulado.
create function private.repuntuar_revelado(p_block_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_puntos jsonb;
begin
  select l.* into ls from public.live_state l
  join public.block_items bi on bi.id = p_block_item_id
  join public.event_blocks eb on eb.id = bi.block_id
  where l.event_id = eb.event_id;
  if ls.phase is distinct from 'item_revealed' or ls.block_item_id is distinct from p_block_item_id then
    return;
  end if;
  select * into b from public.event_blocks where id = ls.block_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', s.team_id, 'name', t.name,
      'points', round(s.points * b.multiplier)::int, 'detail', s.detail
    ) order by s.points desc, lower(t.name)), '[]'::jsonb)
  into v_puntos
  from private.score_item(p_block_item_id) s
  join public.teams t on t.id = s.team_id;

  if not b.is_practice then
    delete from public.score_entries se
    where se.block_item_id = p_block_item_id and se.origin = 'auto'
      and not exists (select 1 from jsonb_to_recordset(v_puntos) as x (team_id uuid) where x.team_id = se.team_id);
    insert into public.score_entries (event_id, team_id, block_id, block_item_id, points, reason, origin)
    select ls.event_id, x.team_id, b.id, p_block_item_id, x.points, b.title, 'auto'
    from jsonb_to_recordset(v_puntos) as x (team_id uuid, points int)
    on conflict (block_item_id, team_id) where origin = 'auto' do update set points = excluded.points;
  end if;

  update public.live_state set revealed = revealed || jsonb_build_object('points', v_puntos) where event_id = ls.event_id;
end $$;

create or replace function public.admin_set_validation(p_answer_id uuid, p_field text, p_value text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.answers;
  ls public.live_state;
begin
  perform private.require_admin();
  if p_field not in ('titulo', 'artista', 'respuesta') then
    raise exception 'Solo se pueden validar el título, el artista o la respuesta.';
  end if;
  if p_value not in ('aceptada', 'rechazada') then
    raise exception 'La decisión tiene que ser aceptar o rechazar.';
  end if;
  select * into a from public.answers where id = p_answer_id for update;
  if not found then
    raise exception 'No encontramos esa respuesta.' using errcode = 'P0002';
  end if;
  select * into ls from public.live_state where event_id = a.event_id;
  if ls.block_item_id is distinct from a.block_item_id or ls.phase not in ('item_closed', 'item_revealed') then
    raise exception 'Las respuestas se corrigen con la pregunta cerrada o revelada (mientras sea la pregunta actual).';
  end if;
  if coalesce(a.validation ->> p_field, '') = '' then
    raise exception 'Ese campo no tiene respuesta para validar.';
  end if;
  update public.answers set validation = validation || jsonb_build_object(p_field, p_value) where id = p_answer_id;
  perform private.repuntuar_revelado(a.block_item_id);
end $$;

create or replace function private.oveja_editable(p_block_item_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  perform private.require_admin();
  select l.* into ls from public.live_state l
  join public.block_items bi on bi.id = p_block_item_id
  join public.event_blocks b on b.id = bi.block_id
  where l.event_id = b.event_id;
  if ls.block_item_id is distinct from p_block_item_id or ls.phase not in ('item_closed', 'item_revealed') then
    raise exception 'Los grupos se arman con la pregunta cerrada o revelada (mientras sea la pregunta actual).';
  end if;
end $$;

create or replace function public.admin_oveja_juntar(p_block_item_id uuid, p_desde text, p_hacia text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.oveja_editable(p_block_item_id);
  if coalesce(p_desde, '') = '' or coalesce(p_hacia, '') = '' or p_desde = p_hacia then
    raise exception 'Elegí dos grupos distintos para juntar.';
  end if;
  if not exists (select 1 from public.answers where block_item_id = p_block_item_id and validation ->> 'grupo' = p_hacia) then
    raise exception 'No encontramos ese grupo.' using errcode = 'P0002';
  end if;
  update public.answers set validation = validation || jsonb_build_object('grupo', p_hacia)
  where block_item_id = p_block_item_id and validation ->> 'grupo' = p_desde;
  perform private.repuntuar_revelado(p_block_item_id);
end $$;

create or replace function public.admin_oveja_separar(p_answer_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.answers;
begin
  select * into a from public.answers where id = p_answer_id;
  if not found then
    raise exception 'No encontramos esa respuesta.' using errcode = 'P0002';
  end if;
  perform private.oveja_editable(a.block_item_id);
  update public.answers
  set validation = coalesce(validation, '{}'::jsonb) || jsonb_build_object('grupo', private.clave_oveja(a.answer ->> 'texto') || ' #' || left(a.id::text, 8))
  where id = p_answer_id;
  perform private.repuntuar_revelado(a.block_item_id);
end $$;

-- ============================================================
-- Podio en cualquier momento
-- ============================================================

create or replace function private.abrir_item(p_event_id uuid, p_block_item_id uuid, p_timer_seconds int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_block_id uuid;
  v_media boolean;
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
  select ci.type in ('pista_audio', 'clip_video') into v_media
  from public.block_items bi join public.catalog_items ci on ci.id = bi.catalog_item_id where bi.id = p_block_item_id;
  update public.live_state
  set sonido_id = case when coalesce(v_media, false) then null else sonido_id end,
      phase = 'item_open', block_id = v_block_id, block_item_id = p_block_item_id,
      opened_at = now(), media_started_at = null, show_ranking = false, show_podio = false, timer_seconds = v_timer, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

drop function public.admin_pantalla(uuid, boolean, boolean);

-- QR, "Cómo va la noche" y podio (null = no lo cambia). Ranking y podio no van juntos: prender uno apaga el otro.
create function public.admin_pantalla(
  p_event_id uuid, p_qr boolean default null, p_ranking boolean default null, p_podio boolean default null
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  perform private.require_admin();
  select * into ls from public.live_state where event_id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if (p_ranking or p_podio) and ls.phase = 'item_open' then
    raise exception 'Con una pregunta abierta no se muestra el ranking ni el podio (taparía las respuestas). Esperá a que se cierre.';
  end if;
  update public.live_state
  set show_qr = coalesce(p_qr, show_qr),
      show_ranking = case when p_podio then false else coalesce(p_ranking, show_ranking) end,
      show_podio = case when p_ranking then false else coalesce(p_podio, show_podio) end
  where event_id = p_event_id;
end $$;

grant execute on function public.admin_pantalla(uuid, boolean, boolean, boolean) to authenticated;

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
      'timer_seconds', b.config -> 'timer_seconds',
      'subtitulo', b.config ->> 'subtitulo',
      'imagen', b.config ->> 'imagen',
      'emoji', b.config ->> 'emoji'
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
      'block_total', coalesce(bb.total, 0),
      'penalizacion', coalesce((
        select -sum(s.points) from public.score_entries s
        where s.team_id = r.team_id and s.origin = 'manual' and not s.voided and s.points < 0
      ), 0)
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
    -- Música o sonido sonando (sin el youtube_id: ese lo pide solo el proyector).
    'sonido', case when ls.sonido_id is not null then jsonb_build_object('id', ls.sonido_id, 'desde', ls.sonido_desde) end,
    -- Último punto manual (o desafío) de los últimos 20 s, para el cartel de los celulares.
    'aviso', (
      select jsonb_build_object('id', s.id, 'team', t.name, 'points', s.points, 'reason', s.reason, 'at', s.created_at)
      from public.score_entries s join public.teams t on t.id = s.team_id
      where s.event_id = e.id and s.origin = 'manual' and not s.voided
        and s.created_at > now() - interval '20 seconds'
        and not exists (
          select 1 from public.extra_completions c join public.event_extras x on x.id = c.extra_id
          where c.score_entry_id = s.id and x.kind = 'mision'
        )
      order by s.created_at desc limit 1
    ),
    'show_ranking', coalesce(ls.show_ranking, false),
    'show_podio', coalesce(ls.show_podio, false),
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
      timer_seconds = null, extra_seconds = 0, revealed = null, show_qr = false, show_ranking = false, show_podio = false, sonido_id = null
  where event_id = p_event_id;

  delete from public.raffle_draws where event_id = p_event_id;
  delete from public.raffle_participants where event_id = p_event_id;
  delete from public.score_entries where event_id = p_event_id;
  delete from public.answers where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id; -- con sus intentos de PIN y misiones cumplidas (cascade)
  update public.event_extras set status = 'oculto' where event_id = p_event_id;

  update public.events set status = 'listo' where id = p_event_id;
  update public.catalog_items
  set used_in_events = array_remove(used_in_events, p_event_id)
  where p_event_id = any (used_in_events);
end $$;
