-- Bloque especial y decoración por bloque (pedidos del 22/10):
-- · Bloque "especial" (pausa, sorteo, encuesta…): título, subtítulo e imagen a pantalla completa, sin ítems.
--   En su presentación, "Siguiente" pasa al bloque que sigue (o al final).
-- · Cualquier bloque puede tener un emoji decorativo (por ejemplo 🎃) que se ve en la presentación y en la
--   tarjeta de sus preguntas.
-- Todo va en event_blocks.config (subtitulo, imagen, emoji) y llega a las pantallas por get_live.

alter table public.event_blocks drop constraint event_blocks_dynamic_check;
alter table public.event_blocks add constraint event_blocks_dynamic_check
  check (dynamic in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial'));

-- admin_save_block (igual que antes) + especial y datos extra del bloque.
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
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones, hipster, cine, imagen, oveja o especial.';
  end if;
  if char_length(coalesce(p ->> 'subtitulo', '')) > 160 then
    raise exception 'El subtítulo puede tener hasta 160 caracteres.';
  end if;
  if char_length(coalesce(p ->> 'imagen', '')) > 500 then
    raise exception 'El enlace de la imagen es demasiado largo.';
  end if;
  if char_length(coalesce(p ->> 'emoji', '')) > 16 then
    raise exception 'La decoración es un emoji (o dos), no un texto.';
  end if;
  -- Datos extra del bloque: subtítulo e imagen (bloque especial) y emoji decorativo (cualquier bloque).
  v_extra := jsonb_build_object(
    'subtitulo', nullif(btrim(coalesce(p ->> 'subtitulo', '')), ''),
    'imagen', nullif(btrim(coalesce(p ->> 'imagen', '')), ''),
    'emoji', nullif(btrim(coalesce(p ->> 'emoji', '')), '')
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
          (config - 'timer_seconds' - 'subtitulo' - 'imagen' - 'emoji') || v_extra
          || case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end
        )
    where id = v_id;
    if not found then
      raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

-- admin_next (igual que antes) + bloque especial.
create or replace function public.admin_next(p_event_id uuid) returns void
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
      -- Bloque especial (pausa, sorteo…): no tiene ítems; "Siguiente" pasa al bloque que sigue.
      if b.dynamic = 'especial' then
        v_siguiente := private.bloque_siguiente(p_event_id, ls.block_id);
        if v_siguiente is null then
          update public.live_state set phase = 'final', revealed = null where event_id = p_event_id;
        else
          perform private.ir_a_bloque(p_event_id, v_siguiente);
        end if;
        return;
      end if;
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

-- get_live (igual que antes) + subtítulo, imagen y emoji del bloque.
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
