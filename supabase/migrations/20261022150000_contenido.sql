-- Paso 10: contenido. Catálogo (alta, edición, baja, etiquetas), importación, noches (alta, edición,
-- duplicado) y armado de bloques e ítems. Todo vía RPC admin_* que validan en la base.

-- ============================================================
-- Validación de ítems (copia en src/content/validarItem.ts, mismas reglas)
-- ============================================================

create function private.es_entero(v jsonb, minimo numeric, maximo numeric) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(v) = 'number'
      and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric)
      and (v #>> '{}')::numeric between minimo and maximo,
    false
  );
$$;

create function private.texto_lleno(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(v) = 'string' and btrim(v #>> '{}') <> '', false);
$$;

create function private.lista_de_textos(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(v) = 'array', false)
    and not exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string');
$$;

-- null si el ítem está bien; si no, qué está mal (en español, para mostrar tal cual).
create function private.error_item(p_type text, c jsonb, s jsonb) returns text
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
    if s ? 'variantes_titulo' and not private.lista_de_textos(s -> 'variantes_titulo') then return '«variantes_titulo» tiene que ser una lista de textos.'; end if;
    if s ? 'variantes_artista' and not private.lista_de_textos(s -> 'variantes_artista') then return '«variantes_artista» tiene que ser una lista de textos.'; end if;
  end if;
  return null;
end $$;

-- Qué tipos de ítem acepta cada dinámica.
create function private.tipo_va_en(p_dynamic text, p_type text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_dynamic
    when 'trivia' then p_type = 'pregunta_opciones'
    when 'dos_verdades' then p_type = 'trio_verdad_mentira'
    when 'aproximaciones' then p_type = 'pregunta_numerica'
    when 'hipster' then p_type in ('pista_audio', 'clip_video')
    else false
  end;
$$;

-- Reemplaza las etiquetas de un ítem por la lista de nombres dada (crea las que no existan).
create function private.poner_etiquetas(p_item_id uuid, p_nombres jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_nombre text;
begin
  delete from public.item_tags where item_id = p_item_id;
  if coalesce(jsonb_typeof(p_nombres), '') <> 'array' then
    return;
  end if;
  for v_nombre in
    select distinct lower(btrim(x)) from jsonb_array_elements_text(p_nombres) x
    where btrim(x) <> '' and char_length(btrim(x)) <= 60
  loop
    insert into public.tags (name) values (v_nombre) on conflict (name) do nothing;
    insert into public.item_tags (item_id, tag_id)
    select p_item_id, id from public.tags where name = v_nombre
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- Catálogo
-- ============================================================

-- Alta o edición de un ítem con su solución y etiquetas. p: {id?, type, content, solution, status?,
-- difficulty?, decade?, source?, tags?: [nombres]}. Devuelve el id.
create function public.admin_save_item(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_type text := p ->> 'type';
  v_status text := coalesce(nullif(p ->> 'status', ''), 'aprobado');
  v_error text;
  v_anterior text;
begin
  perform private.require_admin();
  v_error := private.error_item(v_type, p -> 'content', p -> 'solution');
  if v_error is not null then
    raise exception '%', v_error;
  end if;
  if v_status not in ('borrador', 'sugerido', 'aprobado') then
    raise exception 'El estado tiene que ser borrador, sugerido o aprobado.';
  end if;

  if v_id is null then
    insert into public.catalog_items (type, content, status, difficulty, decade, source)
    values (v_type, p -> 'content', v_status, nullif(p ->> 'difficulty', ''), (nullif(p ->> 'decade', ''))::int, nullif(p ->> 'source', ''))
    returning id into v_id;
  else
    select type into v_anterior from public.catalog_items where id = v_id for update;
    if not found then
      raise exception 'No encontramos ese ítem.' using errcode = 'P0002';
    end if;
    if v_anterior <> v_type and exists (select 1 from public.block_items where catalog_item_id = v_id) then
      raise exception 'No se puede cambiar el tipo de un ítem que ya está en un bloque.';
    end if;
    update public.catalog_items
    set type = v_type, content = p -> 'content', status = v_status,
        difficulty = nullif(p ->> 'difficulty', ''), decade = (nullif(p ->> 'decade', ''))::int, source = nullif(p ->> 'source', '')
    where id = v_id;
  end if;

  insert into public.catalog_solutions (item_id, solution) values (v_id, p -> 'solution')
  on conflict (item_id) do update set solution = excluded.solution;
  perform private.poner_etiquetas(v_id, p -> 'tags');
  return v_id;
end $$;

create function public.admin_delete_item(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.block_items where catalog_item_id = p_id) then
    raise exception 'Este ítem está en un bloque de alguna noche. Sacalo del bloque primero.';
  end if;
  delete from public.catalog_items where id = p_id;
  if not found then
    raise exception 'No encontramos ese ítem.' using errcode = 'P0002';
  end if;
end $$;

-- Importación (todo o nada). p_items: [{tipo, etiquetas?, dificultad?, contenido, solucion}].
-- Si alguna fila tiene errores no importa nada y devuelve {errores: [{fila, error}]} (fila desde 1).
-- Si todo está bien devuelve {importados, ids} y, si se indicó, los agrega al final del bloque.
create function public.admin_import_items(p_items jsonb, p_status text default 'aprobado', p_block_id uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dynamic text;
  v_errores jsonb := '[]'::jsonb;
  v_ids uuid[] := '{}';
  v_fila record;
  v_error text;
  v_id uuid;
  v_pos int;
begin
  perform private.require_admin();
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay ítems para importar.';
  end if;
  if jsonb_array_length(p_items) > 500 then
    raise exception 'Son demasiados ítems de una vez (máximo 500). Dividí el archivo.';
  end if;
  if p_status not in ('aprobado', 'sugerido') then
    raise exception 'El estado de los importados tiene que ser aprobado o sugerido.';
  end if;
  if p_block_id is not null then
    select dynamic into v_dynamic from public.event_blocks where id = p_block_id;
    if not found then
      raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
    end if;
  end if;

  for v_fila in select x.valor, x.n from jsonb_array_elements(p_items) with ordinality as x (valor, n) loop
    v_error := private.error_item(v_fila.valor ->> 'tipo', v_fila.valor -> 'contenido', v_fila.valor -> 'solucion');
    if v_error is null and v_dynamic is not null and not private.tipo_va_en(v_dynamic, v_fila.valor ->> 'tipo') then
      v_error := format('Un ítem «%s» no va en un bloque de %s.', v_fila.valor ->> 'tipo', v_dynamic);
    end if;
    if v_error is not null then
      v_errores := v_errores || jsonb_build_object('fila', v_fila.n, 'error', v_error);
    end if;
  end loop;
  if jsonb_array_length(v_errores) > 0 then
    return jsonb_build_object('errores', v_errores);
  end if;

  for v_fila in select x.valor from jsonb_array_elements(p_items) as x (valor) loop
    insert into public.catalog_items (type, content, status, difficulty, source)
    values (v_fila.valor ->> 'tipo', v_fila.valor -> 'contenido', p_status, nullif(v_fila.valor ->> 'dificultad', ''), 'importado')
    returning id into v_id;
    insert into public.catalog_solutions (item_id, solution) values (v_id, v_fila.valor -> 'solucion');
    perform private.poner_etiquetas(v_id, v_fila.valor -> 'etiquetas');
    v_ids := v_ids || v_id;
  end loop;

  if p_block_id is not null then
    select coalesce(max(position), 0) into v_pos from public.block_items where block_id = p_block_id;
    insert into public.block_items (block_id, position, catalog_item_id)
    select p_block_id, v_pos + x.n, x.id from unnest(v_ids) with ordinality as x (id, n);
  end if;

  return jsonb_build_object('importados', array_length(v_ids, 1), 'ids', to_jsonb(v_ids));
end $$;

-- ============================================================
-- Noches
-- ============================================================

-- Alta o edición. p: {id?, name, date?, venue?, code, edicion?, status? (borrador|listo)}. Devuelve el id.
create function public.admin_save_event(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_code text := upper(btrim(coalesce(p ->> 'code', '')));
  v_venue text := nullif(btrim(coalesce(p ->> 'venue', '')), '');
  v_edicion text := nullif(btrim(coalesce(p ->> 'edicion', '')), '');
  v_status text := nullif(p ->> 'status', '');
  e public.events;
begin
  perform private.require_admin();
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'El nombre de la noche tiene que tener entre 1 y 120 caracteres.';
  end if;
  if v_code !~ '^[A-Z0-9]{3,12}$' then
    raise exception 'El código tiene que tener de 3 a 12 letras o números, sin espacios ni tildes.';
  end if;
  if char_length(coalesce(v_venue, '')) > 120 or char_length(coalesce(v_edicion, '')) > 40 then
    raise exception 'El lugar puede tener hasta 120 caracteres y el sello hasta 40.';
  end if;
  if v_status is not null and v_status not in ('borrador', 'listo') then
    raise exception 'Desde acá la noche solo puede quedar en borrador o lista.';
  end if;

  begin
    if v_id is null then
      insert into public.events (name, date, venue, code, status, settings)
      values (v_name, (nullif(p ->> 'date', ''))::date, v_venue, v_code, coalesce(v_status, 'borrador'),
              case when v_edicion is null then '{}'::jsonb else jsonb_build_object('edicion', v_edicion) end)
      returning id into v_id;
    else
      select * into e from public.events where id = v_id for update;
      if not found then
        raise exception 'No encontramos esa noche.' using errcode = 'P0002';
      end if;
      if e.status = 'en_vivo' and e.code <> v_code then
        raise exception 'No se puede cambiar el código de una noche en vivo (el QR dejaría de andar).';
      end if;
      update public.events
      set name = v_name, date = (nullif(p ->> 'date', ''))::date, venue = v_venue, code = v_code,
          status = case when e.status in ('en_vivo', 'terminado') then e.status else coalesce(v_status, e.status) end,
          settings = case when v_edicion is null then e.settings - 'edicion' else e.settings || jsonb_build_object('edicion', v_edicion) end
      where id = v_id;
    end if;
  exception when unique_violation then
    raise exception 'Ese código ya lo usa otra noche. Elegí otro.';
  end;
  return v_id;
end $$;

-- Copia una noche (bloques e ítems; sin mesas, respuestas ni puntos) con otro nombre, código y fecha.
create function public.admin_duplicate_event(p_event_id uuid, p_name text, p_code text, p_date date default null)
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
  return v_id;
end $$;

-- ============================================================
-- Bloques
-- ============================================================

-- No se toca un bloque con un ítem suyo en juego (abierto o cerrado sin revelar).
create function private.bloque_libre(p_block_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.live_state ls
    where ls.block_id = p_block_id and ls.phase in ('item_open', 'item_closed')
  ) then
    raise exception 'Este bloque está en juego ahora. Esperá a revelar el ítem para cambiarlo.';
  end if;
end $$;

-- p: {id?, event_id, dynamic, title, multiplier?, is_practice?, timer_seconds?}. Devuelve el id.
create function public.admin_save_block(p jsonb) returns uuid
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
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones o hipster.';
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

create function public.admin_delete_block(p_block_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_event uuid;
begin
  perform private.require_admin();
  perform private.bloque_libre(p_block_id);
  if exists (select 1 from public.answers a join public.block_items bi on bi.id = a.block_item_id where bi.block_id = p_block_id) then
    raise exception 'Este bloque ya se jugó (tiene respuestas). Para borrarlo, reiniciá la noche primero.';
  end if;
  delete from public.event_blocks where id = p_block_id returning event_id into v_event;
  if v_event is null then
    raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
  end if;
  -- Renumera 1..n.
  update public.event_blocks b set position = x.n
  from (select id, row_number() over (order by position, id) as n from public.event_blocks where event_id = v_event) x
  where b.id = x.id;
end $$;

-- Sube (-1) o baja (+1) un bloque un lugar.
create function public.admin_move_block(p_block_id uuid, p_delta int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.event_blocks;
  otro public.event_blocks;
begin
  perform private.require_admin();
  select * into b from public.event_blocks where id = p_block_id;
  if not found then
    raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
  end if;
  if p_delta < 0 then
    select * into otro from public.event_blocks where event_id = b.event_id and (position, id) < (b.position, b.id) order by position desc, id desc limit 1;
  else
    select * into otro from public.event_blocks where event_id = b.event_id and (position, id) > (b.position, b.id) order by position, id limit 1;
  end if;
  if otro.id is null then
    return;
  end if;
  update public.event_blocks set position = otro.position where id = b.id;
  update public.event_blocks set position = b.position where id = otro.id;
  if b.position = otro.position then
    update public.event_blocks set position = position + sign(p_delta)::int where id = b.id;
  end if;
end $$;

-- Deja los ítems del bloque exactamente en este orden (agrega, reordena y saca).
-- No saca ítems que ya se jugaron (tienen respuestas) ni el que está en pantalla.
create function public.admin_set_block_items(p_block_id uuid, p_item_ids uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_dynamic text;
  v_id uuid;
  v_n int;
begin
  perform private.require_admin();
  select dynamic into v_dynamic from public.event_blocks where id = p_block_id;
  if not found then
    raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
  end if;
  perform private.bloque_libre(p_block_id);
  p_item_ids := coalesce(p_item_ids, '{}');
  if cardinality(p_item_ids) <> (select count(distinct x) from unnest(p_item_ids) x) then
    raise exception 'Hay un ítem repetido en el bloque.';
  end if;
  if exists (select 1 from unnest(p_item_ids) x left join public.catalog_items ci on ci.id = x where ci.id is null) then
    raise exception 'Algún ítem ya no existe en el catálogo. Recargá la página.';
  end if;
  if exists (select 1 from public.catalog_items ci where ci.id = any (p_item_ids) and not private.tipo_va_en(v_dynamic, ci.type)) then
    raise exception 'Hay ítems que no son de esta dinámica.';
  end if;
  if exists (
    select 1 from public.block_items bi
    where bi.block_id = p_block_id and not (bi.catalog_item_id = any (p_item_ids))
      and (exists (select 1 from public.answers a where a.block_item_id = bi.id)
           or exists (select 1 from public.live_state ls where ls.block_item_id = bi.id))
  ) then
    raise exception 'No se puede sacar un ítem que ya se jugó o que está en pantalla.';
  end if;

  delete from public.block_items where block_id = p_block_id and not (catalog_item_id = any (p_item_ids));
  for v_id, v_n in select x.id, x.n from unnest(p_item_ids) with ordinality as x (id, n) loop
    update public.block_items set position = v_n where block_id = p_block_id and catalog_item_id = v_id;
    if not found then
      insert into public.block_items (block_id, position, catalog_item_id) values (p_block_id, v_n, v_id);
    end if;
  end loop;
end $$;

grant execute on function public.admin_save_item(jsonb) to authenticated;
grant execute on function public.admin_delete_item(uuid) to authenticated;
grant execute on function public.admin_import_items(jsonb, text, uuid) to authenticated;
grant execute on function public.admin_save_event(jsonb) to authenticated;
grant execute on function public.admin_duplicate_event(uuid, text, text, date) to authenticated;
grant execute on function public.admin_save_block(jsonb) to authenticated;
grant execute on function public.admin_delete_block(uuid) to authenticated;
grant execute on function public.admin_move_block(uuid, int) to authenticated;
grant execute on function public.admin_set_block_items(uuid, uuid[]) to authenticated;
