-- Módulo "Cine y series" (dinámica `cine`): clips de video (clip_video) que se VEN en el proyector.
-- Puntaje igual que Hipster: año hasta 600, título +200, director +200 (el campo `artista` del clip es el director).
-- Hipster musical queda solo para canciones (pista_audio).

alter table public.event_blocks drop constraint event_blocks_dynamic_check;
alter table public.event_blocks add constraint event_blocks_dynamic_check
  check (dynamic in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine'));

create or replace function private.tipo_va_en(p_dynamic text, p_type text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_dynamic
    when 'trivia' then p_type = 'pregunta_opciones'
    when 'dos_verdades' then p_type = 'trio_verdad_mentira'
    when 'aproximaciones' then p_type = 'pregunta_numerica'
    when 'hipster' then p_type = 'pista_audio'
    when 'cine' then p_type = 'clip_video'
    else false
  end;
$$;

-- Misma forma, validación de texto y puntaje que Hipster.
create function private.check_cine(p_content jsonb, p_answer jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select private.check_hipster(p_content, p_answer);
$$;

create function private.validate_cine(p_block_item_id uuid) returns void
language sql volatile security definer set search_path = '' as $$
  select private.validate_hipster(p_block_item_id);
$$;

create function private.score_cine(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select * from private.score_hipster(p_block_item_id);
$$;

-- El director pasa a ser obligatorio en los clips (si no, nadie podría sumar esos 200).
create or replace function private.error_item(p_type text, c jsonb, s jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare
  n int;
  anio_actual int := extract(year from now())::int;
begin
  if p_type is null or p_type not in ('pregunta_opciones', 'trio_verdad_mentira', 'pregunta_numerica', 'pista_audio', 'clip_video') then
    return format('Tipo desconocido: «%s». Usá pregunta_opciones, trio_verdad_mentira, pregunta_numerica, pista_audio o clip_video.', coalesce(p_type, ''));
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
begin
  perform private.require_admin();
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones, hipster o cine.';
  end if;
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
            case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end)
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
        config = case when v_timer is null then config - 'timer_seconds' else config || jsonb_build_object('timer_seconds', v_timer) end
    where id = v_id;
    if not found then
      raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;
