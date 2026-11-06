-- · Bloque especial: escala de la imagen en el proyector (50 % a 250 %; 100 % = como antes, no se guarda).
-- · Sorteo: sin límite de premios por noche.

create or replace function public.admin_save_block(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  v_dynamic text := p ->> 'dynamic';
  v_title text := btrim(coalesce(p ->> 'title', ''));
  v_mult numeric := coalesce((nullif(p ->> 'multiplier', ''))::numeric, 1);
  v_timer int := (nullif(p ->> 'timer_seconds', ''))::int;
  v_practice boolean := coalesce((p ->> 'is_practice')::boolean, false);
  v_extra jsonb;
begin
  perform private.require_admin();
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial', 'sorteo', 'bingo') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones, hipster, cine, imagen, oveja, especial, sorteo o bingo.';
  end if;
  if v_dynamic = 'bingo' then
    if coalesce(p ->> 'bingo_tipo', '') not in ('express', 'full') then
      raise exception 'Elegí el tipo de bingo: Express o Full.';
    end if;
    if not exists (select 1 from public.bingo_sets where id = nullif(p ->> 'bingo_set', '')::uuid) then
      raise exception 'Elegí el set de canciones del bingo.';
    end if;
  end if;
  if v_dynamic = 'sorteo' and exists (
    select 1 from public.event_blocks
    where event_id = coalesce(v_event, (select event_id from public.event_blocks where id = v_id))
      and dynamic = 'sorteo' and id is distinct from v_id
  ) then
    raise exception 'Esta noche ya tiene un bloque de sorteo (uno por noche).';
  end if;
  if char_length(coalesce(p ->> 'subtitulo', '')) > 160 then
    raise exception 'El subtítulo puede tener hasta 160 caracteres.';
  end if;
  if char_length(coalesce(p ->> 'imagen', '')) > 500 then
    raise exception 'El enlace de la imagen es demasiado largo.';
  end if;
  if (nullif(p ->> 'imagen_escala', ''))::int not between 50 and 250 then
    raise exception 'La escala de la imagen tiene que estar entre 50 %% y 250 %%.';
  end if;
  if char_length(coalesce(p ->> 'emoji', '')) > 16 then
    raise exception 'La decoración es un emoji (o dos), no un texto.';
  end if;
  -- Datos extra del bloque: subtítulo e imagen (bloque especial) y emoji decorativo (cualquier bloque).
  v_extra := jsonb_build_object(
    'subtitulo', nullif(btrim(coalesce(p ->> 'subtitulo', '')), ''),
    'imagen', nullif(btrim(coalesce(p ->> 'imagen', '')), ''),
    'imagen_escala', case when nullif(btrim(coalesce(p ->> 'imagen', '')), '') is not null
                          and (nullif(p ->> 'imagen_escala', ''))::int <> 100 then (p ->> 'imagen_escala')::int end,
    'emoji', nullif(btrim(coalesce(p ->> 'emoji', '')), ''),
    'bingo_set', case when v_dynamic = 'bingo' then p ->> 'bingo_set' end,
    'bingo_tipo', case when v_dynamic = 'bingo' then p ->> 'bingo_tipo' end
  );
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'El título del bloque tiene que tener entre 1 y 80 caracteres.';
  end if;
  if v_mult <= 0 or v_mult > 10 then
    raise exception 'El multiplicador tiene que ser mayor que 0 y hasta 10.';
  end if;
  if v_timer is not null and (v_timer < 5 or v_timer > 3600) then
    raise exception 'El tiempo sugerido tiene que estar entre 5 segundos y 1 hora (o vacío, sin tiempo).';
  end if;

  if v_id is null then
    if not exists (select 1 from public.events where id = v_event) then
      raise exception 'No encontramos esa noche.' using errcode = 'P0002';
    end if;
    insert into public.event_blocks (event_id, position, dynamic, title, multiplier, is_practice, config)
    values (v_event, coalesce((select max(position) from public.event_blocks where event_id = v_event), 0) + 1,
            v_dynamic, v_title, v_mult, v_practice,
            jsonb_strip_nulls(v_extra || case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end))
    returning id into v_id;
  else
    perform private.bloque_libre(v_id);
    if exists (
      select 1 from public.block_items bi join public.catalog_items ci on ci.id = bi.catalog_item_id
      where bi.block_id = v_id and not private.tipo_va_en(v_dynamic, ci.type)
    ) then
      raise exception 'El bloque tiene ítems que no son de esa dinámica. Sacalos primero.';
    end if;
    update public.event_blocks
    set dynamic = v_dynamic, title = v_title, multiplier = v_mult, is_practice = v_practice,
        config = jsonb_strip_nulls(
          (config - 'timer_seconds' - 'subtitulo' - 'imagen' - 'imagen_escala' - 'emoji' - 'bingo_set' - 'bingo_tipo') || v_extra
          || case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end
        )
    where id = v_id;
    if not found then
      raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

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
      'imagen_escala', b.config -> 'imagen_escala',
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

create or replace function public.admin_sorteo_premio(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  v_nombre text := btrim(coalesce(p ->> 'nombre', ''));
  v_imagen text := nullif(btrim(coalesce(p ->> 'imagen', '')), '');
begin
  perform private.require_admin();
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
    raise exception 'El nombre del premio tiene que tener entre 1 y 80 caracteres.';
  end if;
  if char_length(coalesce(v_imagen, '')) > 500 then
    raise exception 'El enlace de la imagen es demasiado largo.';
  end if;
  if v_id is null then
    if not exists (select 1 from public.events where id = v_event) then
      raise exception 'No encontramos esa noche.' using errcode = 'P0002';
    end if;
    insert into public.raffle_prizes (event_id, position, nombre, imagen)
    values (v_event, coalesce((select max(position) from public.raffle_prizes where event_id = v_event), 0) + 1, v_nombre, v_imagen)
    returning id into v_id;
  else
    update public.raffle_prizes set nombre = v_nombre, imagen = v_imagen where id = v_id;
    if not found then
      raise exception 'No encontramos ese premio.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;
