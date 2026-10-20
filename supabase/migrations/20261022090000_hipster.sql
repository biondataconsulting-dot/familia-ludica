-- Paso 9: Hipster (pista_audio / clip_video). Respuesta: {"anio": int, "titulo"?: text, "artista"?: text}.

-- ============================================================
-- Video para el proyector: youtube_id solo con el ítem actual de audio/video abierto, cerrado o revelado.
-- ============================================================

create function public.proyector_media(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  v_type text;
  v_content jsonb;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id;
  if ls.block_item_id is null or ls.phase not in ('item_open', 'item_closed', 'item_revealed') then
    return null;
  end if;
  select ci.type, ci.content into v_type, v_content
  from public.block_items bi join public.catalog_items ci on ci.id = bi.catalog_item_id
  where bi.id = ls.block_item_id;
  if v_type not in ('pista_audio', 'clip_video') then
    return null;
  end if;
  return jsonb_build_object(
    'block_item_id', ls.block_item_id,
    'youtube_id', v_content ->> 'youtube_id',
    'inicio', coalesce((v_content ->> 'inicio')::int, 0),
    'duracion', coalesce((v_content ->> 'duracion')::int, 20)
  );
end $$;

-- ============================================================
-- Texto: normalización y similitud (copia testeada en src/dynamics/hipster/texto.ts)
-- ============================================================

-- minúsculas, sin tildes, sin signos, espacios simples, sin artículo inicial (el, la, los, las, the, a, an).
create function private.normalizar_texto(p text) returns text
language sql stable set search_path = '' as $$
  select regexp_replace(
    btrim(regexp_replace(regexp_replace(lower(extensions.unaccent(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')),
    '^(el|la|los|las|the|a|an) ', ''
  );
$$;

-- Mejor similitud (pg_trgm) entre una respuesta y la solución o sus variantes, ya normalizadas.
create function private.similitud_max(p_texto text, p_opciones text[]) returns real
language sql stable set search_path = '' as $$
  select coalesce(max(
    case
      when private.normalizar_texto(p_texto) = private.normalizar_texto(o) then 1
      else extensions.similarity(private.normalizar_texto(p_texto), private.normalizar_texto(o))
    end
  ), 0)::real
  from unnest(p_opciones) o
  where private.normalizar_texto(o) <> '';
$$;

-- ≥ 0,75 auto_ok · 0,45 a 0,75 dudosa · < 0,45 auto_no.
create function private.estado_similitud(p real) returns text
language sql immutable set search_path = '' as $$
  select case when p >= 0.75 then 'auto_ok' when p >= 0.45 then 'dudosa' else 'auto_no' end;
$$;

create function private.opciones_solucion(p_solution jsonb, p_campo text) returns text[]
language sql immutable set search_path = '' as $$
  select array[p_solution ->> p_campo] || coalesce(
    array(select jsonb_array_elements_text(coalesce(p_solution -> ('variantes_' || p_campo), '[]'))),
    '{}'
  );
$$;

-- ============================================================
-- Forma de la respuesta
-- ============================================================

create function private.check_hipster(p_content jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_anio numeric;
  v_titulo text := btrim(coalesce(p_answer ->> 'titulo', ''));
  v_artista text := btrim(coalesce(p_answer ->> 'artista', ''));
begin
  if coalesce(jsonb_typeof(p_answer -> 'anio'), '') <> 'number' then
    raise exception 'Elegí el año antes de enviar.';
  end if;
  v_anio := (p_answer ->> 'anio')::numeric;
  if v_anio <> trunc(v_anio) or v_anio < 1800 or v_anio > 2100 then
    raise exception 'Ese año no es válido. Elegí uno entre 1800 y 2100.';
  end if;
  if char_length(v_titulo) > 100 or char_length(v_artista) > 100 then
    raise exception 'El título y el artista pueden tener hasta 100 caracteres.';
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'anio', v_anio::int,
    'titulo', nullif(v_titulo, ''),
    'artista', nullif(v_artista, '')
  ));
end $$;

-- ============================================================
-- Validación automática al cerrar: por campo, auto_ok / dudosa / auto_no.
-- Lo que el conductor ya decidió (aceptada / rechazada) no se pisa. Campo vacío: sin estado.
-- ============================================================

create function private.validate_hipster(p_block_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.answers a
  set validation = v.nueva
  from (
    select
      a2.id,
      jsonb_strip_nulls(jsonb_build_object(
        'titulo',
        case
          when a2.validation ->> 'titulo' in ('aceptada', 'rechazada') then a2.validation ->> 'titulo'
          when coalesce(a2.answer ->> 'titulo', '') = '' then null
          else private.estado_similitud(private.similitud_max(a2.answer ->> 'titulo', private.opciones_solucion(s.solution, 'titulo')))
        end,
        'artista',
        case
          when a2.validation ->> 'artista' in ('aceptada', 'rechazada') then a2.validation ->> 'artista'
          when coalesce(a2.answer ->> 'artista', '') = '' then null
          else private.estado_similitud(private.similitud_max(a2.answer ->> 'artista', private.opciones_solucion(s.solution, 'artista')))
        end
      )) as nueva
    from public.answers a2
    join public.block_items bi on bi.id = a2.block_item_id
    join public.catalog_solutions s on s.item_id = bi.catalog_item_id
    where a2.block_item_id = p_block_item_id
  ) v
  where a.id = v.id;
end $$;

-- ============================================================
-- Puntaje: año max(0, 600 − 75 × |diferencia|) + título aceptado 200 + artista aceptado 200.
-- Una dudosa sin decidir cuenta como rechazada.
-- ============================================================

create function private.score_hipster(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select
    a.team_id,
    greatest(0, 600 - 75 * abs((a.answer ->> 'anio')::int - (s.solution ->> 'anio')::int))
      + case when a.validation ->> 'titulo' in ('auto_ok', 'aceptada') then 200 else 0 end
      + case when a.validation ->> 'artista' in ('auto_ok', 'aceptada') then 200 else 0 end,
    jsonb_strip_nulls(jsonb_build_object(
      'anio', (a.answer ->> 'anio')::int,
      'diferencia', abs((a.answer ->> 'anio')::int - (s.solution ->> 'anio')::int),
      'titulo', a.validation ->> 'titulo',
      'artista', a.validation ->> 'artista'
    ))
  from public.answers a
  join public.block_items bi on bi.id = a.block_item_id
  join public.catalog_solutions s on s.item_id = bi.catalog_item_id
  join public.teams t on t.id = a.team_id and t.active
  where a.block_item_id = p_block_item_id;
$$;

-- ============================================================
-- Conductor: aceptar o rechazar un campo (las dudosas, o corregir una automática) antes de revelar.
-- ============================================================

create function public.admin_set_validation(p_answer_id uuid, p_field text, p_value text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.answers;
  ls public.live_state;
begin
  perform private.require_admin();
  if p_field not in ('titulo', 'artista') then
    raise exception 'Solo se pueden validar el título y el artista.';
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

grant execute on function public.proyector_media(text) to anon, authenticated;
grant execute on function public.admin_set_validation(uuid, text, text) to authenticated;
