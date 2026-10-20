-- Paso 6: respuestas de las mesas y dinámicas de opciones (Trivia; Dos verdades y una mentira).

-- ============================================================
-- Forma de la respuesta: private.check_<dinámica>(content, answer) la valida y la normaliza.
-- ============================================================

create function private.check_respuesta(p_dynamic text, p_content jsonb, p_answer jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' or length(p_answer::text) > 2000 then
    raise exception 'La respuesta no tiene un formato válido. Recargá la página y probá de nuevo.';
  end if;
  if to_regprocedure(format('private.check_%s(jsonb,jsonb)', p_dynamic)) is null then
    raise exception 'Esta dinámica todavía no acepta respuestas.';
  end if;
  execute format('select private.%I($1, $2)', 'check_' || p_dynamic) into v using p_content, p_answer;
  return v;
end $$;

-- Una opción entre p_cantidad: {"opcion": i}, con 0 <= i < p_cantidad.
create function private.check_opcion(p_answer jsonb, p_cantidad int) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_texto text := p_answer ->> 'opcion';
begin
  if coalesce(jsonb_typeof(p_answer -> 'opcion'), '') <> 'number' or v_texto !~ '^[0-9]{1,2}$' then
    raise exception 'Elegí una opción antes de enviar.';
  end if;
  if v_texto::int >= coalesce(p_cantidad, 0) then
    raise exception 'Esa opción no existe. Elegí una de las que aparecen.';
  end if;
  return jsonb_build_object('opcion', v_texto::int);
end $$;

create function private.check_trivia(p_content jsonb, p_answer jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select private.check_opcion(p_answer, jsonb_array_length(coalesce(p_content -> 'opciones', '[]')));
$$;

create function private.check_dos_verdades(p_content jsonb, p_answer jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select private.check_opcion(p_answer, jsonb_array_length(coalesce(p_content -> 'afirmaciones', '[]')));
$$;

-- ============================================================
-- Puntajes (base, sin multiplicador): 1.000 si acierta, 0 si no. Solo mesas activas que respondieron.
-- ============================================================

create function private.score_opcion(p_block_item_id uuid, p_clave text)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select
    a.team_id,
    case when (a.answer ->> 'opcion')::int = (s.solution ->> p_clave)::int then 1000 else 0 end,
    jsonb_build_object(
      'opcion', (a.answer ->> 'opcion')::int,
      'correcta', (a.answer ->> 'opcion')::int = (s.solution ->> p_clave)::int
    )
  from public.answers a
  join public.block_items bi on bi.id = a.block_item_id
  join public.catalog_solutions s on s.item_id = bi.catalog_item_id
  join public.teams t on t.id = a.team_id and t.active
  where a.block_item_id = p_block_item_id;
$$;

create function private.score_trivia(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select * from private.score_opcion(p_block_item_id, 'correcta');
$$;

create function private.score_dos_verdades(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  select * from private.score_opcion(p_block_item_id, 'mentira');
$$;

-- ============================================================
-- RPC de mesa: enviar (o cambiar) la respuesta mientras el ítem esté abierto.
-- ============================================================

create function public.submit_answer(p_token text, p_block_item_id uuid, p_answer jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  t public.teams;
  ls public.live_state;
  v_dynamic text;
  v_content jsonb;
  v_answer jsonb;
begin
  t := private.team_by_token(p_token);

  -- "for share": muchas mesas envían a la vez, pero el cierre del conductor espera a que terminen
  -- (y después de cerrar ya nadie puede enviar).
  select * into ls from public.live_state where event_id = t.event_id for share;
  if ls.block_item_id is distinct from p_block_item_id then
    raise exception 'Esa pregunta ya no está en juego. Miren el proyector.';
  end if;
  if ls.phase <> 'item_open' then
    raise exception 'Las respuestas ya están cerradas.';
  end if;

  select b.dynamic, ci.content into v_dynamic, v_content
  from public.block_items bi
  join public.event_blocks b on b.id = bi.block_id
  join public.catalog_items ci on ci.id = bi.catalog_item_id
  where bi.id = p_block_item_id;

  v_answer := private.check_respuesta(v_dynamic, v_content, p_answer);

  insert into public.answers (event_id, block_item_id, team_id, answer)
  values (t.event_id, p_block_item_id, t.id, v_answer)
  on conflict (block_item_id, team_id)
  do update set answer = excluded.answer, submitted_at = now(), validation = '{}';

  update public.teams set last_seen = now() where id = t.id;
  return jsonb_build_object('answer', v_answer);
end $$;

-- ============================================================
-- Conductor: puntos provisorios del ítem actual (× multiplicador), sin registrar nada.
-- ============================================================

create function public.admin_preview(p_event_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  v_mult numeric;
begin
  perform private.require_admin();
  select * into ls from public.live_state where event_id = p_event_id;
  if ls.block_item_id is null then
    return '[]'::jsonb;
  end if;
  select multiplier into v_mult from public.event_blocks where id = ls.block_id;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'team_id', s.team_id, 'points', round(s.points * v_mult)::int, 'detail', s.detail
      )), '[]'::jsonb)
    from private.score_item(ls.block_item_id) s
  );
end $$;

grant execute on function public.submit_answer(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.admin_preview(uuid) to authenticated;
