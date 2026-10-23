-- Música y sonidos manuales (pedido del 22/10): música funcional para trivias o pausas, redoblante en un
-- sorteo, etc. Tipo de ítem nuevo "sonido" en el catálogo (link de YouTube, nombre, desde qué segundo,
-- cuánto dura y si se repite). Cada noche elige hasta 3 en Conducir; el conductor los prende y apaga.
-- Suenan en el proyector. Abrir una canción o escena (Hitster, Cine) apaga el sonido.
-- El youtube_id solo lo recibe el proyector (proyector_sonido), nunca los celulares.

alter table public.catalog_items drop constraint catalog_items_type_check;
alter table public.catalog_items add constraint catalog_items_type_check check (type in (
  'pregunta_opciones', 'pregunta_numerica', 'pista_audio', 'clip_video', 'trio_verdad_mentira',
  'imagen_adivinar', 'pregunta_mayoria', 'sonido'
));

alter table public.live_state
  add column sonido_id uuid references public.catalog_items (id) on delete set null,
  add column sonido_desde timestamptz;

create or replace function private.error_item(p_type text, c jsonb, s jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare
  n int;
  anio_actual int := extract(year from now())::int;
begin
  if p_type is null or p_type not in ('pregunta_opciones', 'trio_verdad_mentira', 'pregunta_numerica', 'pista_audio', 'clip_video', 'imagen_adivinar', 'pregunta_mayoria', 'sonido') then
    return format('Tipo desconocido: «%s». Usá pregunta_opciones, trio_verdad_mentira, pregunta_numerica, pista_audio, clip_video, imagen_adivinar, pregunta_mayoria o sonido.', coalesce(p_type, ''));
  end if;
  if coalesce(jsonb_typeof(c), '') <> 'object' then
    return 'Falta el contenido.';
  end if;
  if coalesce(jsonb_typeof(s), '') <> 'object' then
    return 'Falta la solución.';
  end if;

  if p_type = 'pregunta_opciones' then
    if not private.texto_lleno(c -> 'texto') then return 'Falta el texto de la pregunta.'; end if;
    if not private.lista_de_textos(c -> 'opciones') then return 'Faltan las opciones (una lista de textos).'; end if;
    n := jsonb_array_length(c -> 'opciones');
    if n < 2 or n > 6 then return 'Tiene que haber entre 2 y 6 opciones.'; end if;
    if exists (select 1 from jsonb_array_elements_text(c -> 'opciones') o where btrim(o) = '') then return 'Hay una opción vacía.'; end if;
    if not private.es_entero(s -> 'correcta', 0, n - 1) then
      return format('«correcta» tiene que ser la posición de la opción correcta: un número de 0 a %s.', n - 1);
    end if;

  elsif p_type = 'trio_verdad_mentira' then
    if not private.lista_de_textos(c -> 'afirmaciones') or jsonb_array_length(c -> 'afirmaciones') <> 3 then
      return 'Tiene que haber exactamente 3 afirmaciones.';
    end if;
    if exists (select 1 from jsonb_array_elements_text(c -> 'afirmaciones') o where btrim(o) = '') then return 'Hay una afirmación vacía.'; end if;
    if not private.es_entero(s -> 'mentira', 0, 2) then return '«mentira» tiene que ser 0, 1 o 2 (la posición de la mentira).'; end if;

  elsif p_type = 'pregunta_numerica' then
    if not private.texto_lleno(c -> 'texto') then return 'Falta el texto de la pregunta.'; end if;
    if coalesce(c ->> 'formato', 'numero') not in ('numero', 'anio') then return '«formato» tiene que ser numero o anio.'; end if;
    if coalesce(jsonb_typeof(s -> 'valor'), '') <> 'number' then return 'Falta el valor correcto (un número).'; end if;
    if c ->> 'formato' = 'anio' and not private.es_entero(s -> 'valor', -9999, 9999) then return 'Si la respuesta es un año, el valor tiene que ser un año entero.'; end if;

  elsif p_type = 'imagen_adivinar' then
    if coalesce(c ->> 'estilo', '') not in ('emojis', 'logo', 'que_ves') then return '«estilo» tiene que ser emojis, logo o que_ves.'; end if;
    if c ->> 'estilo' = 'emojis' then
      if not private.texto_lleno(c -> 'emojis') then return 'Faltan los emojis.'; end if;
      if char_length(c ->> 'emojis') > 60 then return 'Los emojis pueden ocupar hasta 60 caracteres.'; end if;
    else
      if not private.texto_lleno(c -> 'imagen') then return 'Falta la imagen.'; end if;
      if char_length(c ->> 'imagen') > 500 then return 'El enlace de la imagen es demasiado largo.'; end if;
    end if;
    if c ? 'consigna' and char_length(coalesce(c ->> 'consigna', '')) > 120 then return 'La consigna puede tener hasta 120 caracteres.'; end if;
    if not private.texto_lleno(s -> 'respuesta') then return 'Falta la respuesta.'; end if;
    if s ? 'variantes_respuesta' and not private.lista_de_textos(s -> 'variantes_respuesta') then return '«variantes_respuesta» tiene que ser una lista de textos.'; end if;

  elsif p_type = 'sonido' then
    if not private.texto_lleno(c -> 'titulo') then return 'Falta el nombre (por ejemplo, «Redoblante»).'; end if;
    if char_length(c ->> 'titulo') > 80 then return 'El nombre puede tener hasta 80 caracteres.'; end if;
    if coalesce(c ->> 'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$' then
      return 'El youtube_id tiene que tener 11 caracteres (letras, números, - o _).';
    end if;
    if c ? 'inicio' and not private.es_entero(c -> 'inicio', 0, 36000) then return '«inicio» tiene que ser los segundos donde empieza (entero, 0 o más).'; end if;
    if c ? 'duracion' and c -> 'duracion' <> 'null'::jsonb and not private.es_entero(c -> 'duracion', 1, 3600) then
      return '«duracion» tiene que ser de 1 a 3600 segundos (o vacía: hasta el final).';
    end if;
    if c ? 'repetir' and jsonb_typeof(c -> 'repetir') <> 'boolean' then return '«repetir» tiene que ser true o false.'; end if;

  elsif p_type = 'pregunta_mayoria' then
    if not private.texto_lleno(c -> 'texto') then return 'Falta el texto de la pregunta.'; end if;

  else -- pista_audio / clip_video
    if coalesce(c ->> 'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$' then
      return 'El youtube_id tiene que tener 11 caracteres (letras, números, - o _).';
    end if;
    if c ? 'inicio' and not private.es_entero(c -> 'inicio', 0, 36000) then return '«inicio» tiene que ser los segundos donde empieza el fragmento (entero, 0 o más).'; end if;
    if c ? 'duracion' and not private.es_entero(c -> 'duracion', 5, 120) then return '«duracion» tiene que ser de 5 a 120 segundos.'; end if;
    if coalesce(c ->> 'categoria', 'musica') not in ('musica', 'pelicula', 'serie', 'dibujo') then return '«categoria» tiene que ser musica, pelicula, serie o dibujo.'; end if;
    if not private.es_entero(s -> 'anio', 1900, anio_actual) then return format('El año tiene que estar entre 1900 y %s.', anio_actual); end if;
    if not private.texto_lleno(s -> 'titulo') then return 'Falta el título.'; end if;
    if p_type = 'pista_audio' and not private.texto_lleno(s -> 'artista') then return 'Falta el artista.'; end if;
    if p_type = 'clip_video' and not private.texto_lleno(s -> 'artista') then return 'Falta el director (va en «artista»).'; end if;
    if s ? 'variantes_titulo' and not private.lista_de_textos(s -> 'variantes_titulo') then return '«variantes_titulo» tiene que ser una lista de textos.'; end if;
    if s ? 'variantes_artista' and not private.lista_de_textos(s -> 'variantes_artista') then return '«variantes_artista» tiene que ser una lista de textos.'; end if;
  end if;
  return null;
end $$;

-- Los 3 sonidos de la noche (en orden), guardados en events.settings.sonidos.
create function public.admin_set_sonidos(p_event_id uuid, p_ids uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if coalesce(array_length(p_ids, 1), 0) > 3 then
    raise exception 'Se pueden elegir hasta 3 sonidos por noche.';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_ids, '{}')) x (id)
    where x.id is not null and not exists (select 1 from public.catalog_items ci where ci.id = x.id and ci.type = 'sonido')
  ) then
    raise exception 'Eso no es un sonido del catálogo.' using errcode = 'P0002';
  end if;
  update public.events
  set settings = settings || jsonb_build_object('sonidos', to_jsonb(coalesce(p_ids, '{}')))
  where id = p_event_id;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
end $$;

-- Prender un sonido (p_item_id) o apagar el que suena (null).
create function public.admin_sonido(p_event_id uuid, p_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_item_id is not null and not exists (select 1 from public.catalog_items where id = p_item_id and type = 'sonido') then
    raise exception 'Eso no es un sonido del catálogo.' using errcode = 'P0002';
  end if;
  update public.live_state
  set sonido_id = p_item_id, sonido_desde = case when p_item_id is null then null else now() end
  where event_id = p_event_id;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
end $$;

-- Solo para el proyector: qué video poner para el sonido que está sonando.
create function public.proyector_sonido(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  c jsonb;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id;
  if ls.sonido_id is null then
    return null;
  end if;
  select content into c from public.catalog_items where id = ls.sonido_id and type = 'sonido';
  if c is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', ls.sonido_id,
    'desde', ls.sonido_desde,
    'youtube_id', c ->> 'youtube_id',
    'inicio', greatest(0, coalesce((c ->> 'inicio')::int, 0)),
    'duracion', case when jsonb_typeof(c -> 'duracion') = 'number' then (c ->> 'duracion')::int end,
    'repetir', coalesce((c ->> 'repetir')::boolean, false)
  );
end $$;

grant execute on function public.admin_set_sonidos(uuid, uuid[]) to authenticated;
grant execute on function public.admin_sonido(uuid, uuid) to authenticated;
grant execute on function public.proyector_sonido(text) to anon, authenticated;

-- abrir_item (igual que antes) + abrir una canción o escena apaga el sonido.
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
      opened_at = now(), media_started_at = null, show_ranking = false, timer_seconds = v_timer, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

-- admin_reset_event (igual que antes) + apaga el sonido.
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
      timer_seconds = null, extra_seconds = 0, revealed = null, show_qr = false, show_ranking = false, sonido_id = null
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

-- get_live (igual que antes) + qué sonido suena (sin el youtube_id).
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
