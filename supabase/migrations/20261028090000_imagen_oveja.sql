-- Dos dinámicas nuevas:
-- · imagen ("Adiviná la imagen"): ítem imagen_adivinar con estilo emojis | logo | que_ves. Cada mesa
--   escribe una respuesta; se valida como el título de Hitster (variantes, dudosas para el conductor).
--   Acertar: 1.000.
-- · oveja ("Oveja Oveja", versión local de Herd Mentality / Mente Vacuna): ítem pregunta_mayoria.
--   Cada mesa escribe lo que cree que va a responder la mayoría. Las respuestas se agrupan (iguales o muy
--   parecidas; el conductor junta o separa grupos con las respuestas cerradas). Suman 1.000 las mesas del
--   grupo más numeroso, salvo empate arriba o que todas coincidan (nadie suma). "Oveja negra": la única
--   mesa distinta cuando todas las demás coinciden (solo para reírse, no resta).

alter table public.catalog_items drop constraint catalog_items_type_check;
alter table public.catalog_items add constraint catalog_items_type_check check (type in (
  'pregunta_opciones', 'pregunta_numerica', 'pista_audio', 'clip_video', 'trio_verdad_mentira',
  'imagen_adivinar', 'pregunta_mayoria'
));

alter table public.event_blocks drop constraint event_blocks_dynamic_check;
alter table public.event_blocks add constraint event_blocks_dynamic_check
  check (dynamic in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja'));

create or replace function private.tipo_va_en(p_dynamic text, p_type text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_dynamic
    when 'trivia' then p_type = 'pregunta_opciones'
    when 'dos_verdades' then p_type = 'trio_verdad_mentira'
    when 'aproximaciones' then p_type = 'pregunta_numerica'
    when 'hipster' then p_type = 'pista_audio'
    when 'cine' then p_type = 'clip_video'
    when 'imagen' then p_type = 'imagen_adivinar'
    when 'oveja' then p_type = 'pregunta_mayoria'
    else false
  end;
$$;

create or replace function private.error_item(p_type text, c jsonb, s jsonb) returns text
language plpgsql stable set search_path = '' as $$
declare
  n int;
  anio_actual int := extract(year from now())::int;
begin
  if p_type is null or p_type not in ('pregunta_opciones', 'trio_verdad_mentira', 'pregunta_numerica', 'pista_audio', 'clip_video', 'imagen_adivinar', 'pregunta_mayoria') then
    return format('Tipo desconocido: «%s». Usá pregunta_opciones, trio_verdad_mentira, pregunta_numerica, pista_audio, clip_video, imagen_adivinar o pregunta_mayoria.', coalesce(p_type, ''));
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
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones, hipster, cine, imagen u oveja.';
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
  if ls.block_item_id is distinct from a.block_item_id or ls.phase <> 'item_closed' then
    raise exception 'Las dudosas se deciden con las respuestas cerradas y antes de revelar.';
  end if;
  if coalesce(a.validation ->> p_field, '') = '' then
    raise exception 'Ese campo no tiene respuesta para validar.';
  end if;
  update public.answers set validation = validation || jsonb_build_object(p_field, p_value) where id = p_answer_id;
end $$;

-- ============================================================
-- Adiviná la imagen
-- ============================================================

create function private.check_imagen(p_content jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_answer ->> 'respuesta', ''));
begin
  if v = '' then
    raise exception 'Escribí tu respuesta antes de enviar.';
  end if;
  if char_length(v) > 100 then
    raise exception 'La respuesta puede tener hasta 100 caracteres.';
  end if;
  return jsonb_build_object('respuesta', v);
end $$;

-- Al cerrar: auto_ok / dudosa / auto_no (lo que el conductor ya decidió no se pisa).
create function private.validate_imagen(p_block_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.answers a
  set validation = jsonb_build_object('respuesta',
    case
      when a.validation ->> 'respuesta' in ('aceptada', 'rechazada') then a.validation ->> 'respuesta'
      else private.estado_similitud(private.similitud_max(a.answer ->> 'respuesta', private.opciones_solucion(s.solution, 'respuesta')))
    end)
  from public.block_items bi
  join public.catalog_solutions s on s.item_id = bi.catalog_item_id
  where a.block_item_id = p_block_item_id and bi.id = a.block_item_id;
end $$;

-- Acertar: 1.000 (una dudosa sin decidir cuenta como no).
create function private.score_imagen(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select
    a.team_id,
    case when a.validation ->> 'respuesta' in ('auto_ok', 'aceptada') then 1000 else 0 end,
    jsonb_strip_nulls(jsonb_build_object('texto', a.answer ->> 'respuesta', 'respuesta', a.validation ->> 'respuesta'))
  from public.answers a
  join public.teams t on t.id = a.team_id and t.active
  where a.block_item_id = p_block_item_id;
$$;

-- ============================================================
-- Oveja Oveja
-- ============================================================

-- Clave para agrupar: el texto normalizado y sin la "s" final de cada palabra de 4 letras o más
-- (milanesas = milanesa, papas fritas = papa frita).
create function private.clave_oveja(p text) returns text
language sql stable set search_path = '' as $$
  select regexp_replace(private.normalizar_texto(p), '([a-z0-9]{3,})s(\s|$)', '\1\2', 'g');
$$;

create function private.check_oveja(p_content jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_answer ->> 'texto', ''));
begin
  if private.normalizar_texto(v) = '' then
    raise exception 'Escribí tu respuesta antes de enviar.';
  end if;
  if char_length(v) > 60 then
    raise exception 'La respuesta puede tener hasta 60 caracteres.';
  end if;
  return jsonb_build_object('texto', v);
end $$;

-- Al cerrar: a cada respuesta sin grupo le busca uno (mismo texto normalizado o muy parecido, ≥ 0,75);
-- si no hay, arma uno nuevo. Las respuestas que ya tenían grupo (el conductor juntó o separó) no se tocan.
create function private.validate_oveja(p_block_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  r record;
  v_clave text;
  v_grupo text;
begin
  for r in
    select a.id, a.answer ->> 'texto' as texto from public.answers a
    where a.block_item_id = p_block_item_id and coalesce(a.validation ->> 'grupo', '') = ''
    order by a.created_at, a.id
  loop
    v_clave := private.clave_oveja(r.texto);
    v_grupo := null;
    select g.grupo into v_grupo
    from (
      select distinct a.validation ->> 'grupo' as grupo from public.answers a
      where a.block_item_id = p_block_item_id and coalesce(a.validation ->> 'grupo', '') <> ''
    ) g
    where g.grupo = v_clave or extensions.similarity(g.grupo, v_clave) >= 0.75
    order by (g.grupo = v_clave) desc, extensions.similarity(g.grupo, v_clave) desc
    limit 1;
    update public.answers set validation = coalesce(validation, '{}'::jsonb) || jsonb_build_object('grupo', coalesce(v_grupo, v_clave))
    where id = r.id;
  end loop;
end $$;

-- Grupo más numeroso (sin empate arriba y sin unanimidad): 1.000. El detalle lleva el grupo, su tamaño,
-- su etiqueta (la forma más escrita) y si la mesa es la oveja negra.
create function private.score_oveja(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  with r as (
    select a.team_id, a.answer ->> 'texto' as texto,
           coalesce(nullif(a.validation ->> 'grupo', ''), private.clave_oveja(a.answer ->> 'texto')) as g
    from public.answers a
    join public.teams t on t.id = a.team_id and t.active
    where a.block_item_id = p_block_item_id
  ),
  c as (select g, count(*)::int as n from r group by g),
  et as (
    select distinct on (g) g, texto as etiqueta
    from (select g, texto, count(*) as veces from r group by g, texto) x
    order by g, veces desc, lower(texto)
  ),
  k as (
    select (select count(*) from c)::int as grupos,
           (select max(n) from c) as mx,
           (select count(*) from c where n = (select max(n) from c))::int as en_mx,
           (select count(*) from r)::int as total
  )
  select
    r.team_id,
    case when k.grupos > 1 and k.en_mx = 1 and c.n = k.mx then 1000 else 0 end,
    jsonb_build_object(
      'texto', r.texto, 'grupo', r.g, 'etiqueta', et.etiqueta, 'tam', c.n,
      'mayoria', k.grupos > 1 and k.en_mx = 1 and c.n = k.mx,
      'oveja_negra', k.grupos = 2 and c.n = 1 and k.total >= 3,
      'unanimidad', k.grupos = 1 and k.total > 1
    )
  from r join c on c.g = r.g join et on et.g = r.g cross join k;
$$;

-- Conductor (con las respuestas cerradas, antes de revelar): juntar un grupo con otro o separar una respuesta.
create function private.oveja_editable(p_block_item_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  ls public.live_state;
begin
  perform private.require_admin();
  select l.* into ls from public.live_state l
  join public.block_items bi on bi.id = p_block_item_id
  join public.event_blocks b on b.id = bi.block_id
  where l.event_id = b.event_id;
  if ls.block_item_id is distinct from p_block_item_id or ls.phase <> 'item_closed' then
    raise exception 'Los grupos se arman con las respuestas cerradas y antes de revelar.';
  end if;
end $$;

create function public.admin_oveja_juntar(p_block_item_id uuid, p_desde text, p_hacia text) returns void
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
end $$;

-- Separar: la respuesta queda sola, en un grupo propio.
create function public.admin_oveja_separar(p_answer_id uuid) returns void
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
end $$;

grant execute on function public.admin_oveja_juntar(uuid, text, text) to authenticated;
grant execute on function public.admin_oveja_separar(uuid) to authenticated;
