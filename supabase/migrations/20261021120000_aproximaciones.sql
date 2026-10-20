-- Paso 7: Aproximaciones (pregunta_numerica). Respuesta: {"valor": número}.

create function private.check_aproximaciones(p_content jsonb, p_answer jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v numeric;
begin
  if coalesce(jsonb_typeof(p_answer -> 'valor'), '') <> 'number' then
    raise exception 'Escribí un número antes de enviar.';
  end if;
  v := (p_answer ->> 'valor')::numeric;
  if abs(v) > 1e12 then
    raise exception 'Ese número es demasiado grande. Revisalo y probá de nuevo.';
  end if;
  if p_content ->> 'formato' = 'anio' and (v <> trunc(v) or v < -9999 or v > 9999) then
    raise exception 'Escribí un año válido (por ejemplo, 1986).';
  end if;
  return jsonb_build_object('valor', v);
end $$;

-- d = |respuesta − valor|. Distancia mínima: 1.000. Resto: round(800 × (1 − (d − dmin)/(dmax − dmin))).
-- La más lejana: 0. Si todas están a la misma distancia: 1.000 para todas. (Copia testeada en
-- src/dynamics/aproximaciones/puntaje.ts con los mismos casos.)
create function private.score_aproximaciones(p_block_item_id uuid)
returns table (team_id uuid, points int, detail jsonb)
language sql stable security definer set search_path = '' as $$
  with r as (
    select
      a.team_id,
      (a.answer ->> 'valor')::numeric as valor,
      abs((a.answer ->> 'valor')::numeric - (s.solution ->> 'valor')::numeric) as d
    from public.answers a
    join public.block_items bi on bi.id = a.block_item_id
    join public.catalog_solutions s on s.item_id = bi.catalog_item_id
    join public.teams t on t.id = a.team_id and t.active
    where a.block_item_id = p_block_item_id
  ),
  lim as (
    select min(d) as dmin, max(d) as dmax from r
  )
  select
    r.team_id,
    case
      when lim.dmax = lim.dmin or r.d = lim.dmin then 1000
      else round(800 * (1 - (r.d - lim.dmin) / (lim.dmax - lim.dmin)))::int
    end,
    jsonb_build_object('valor', r.valor, 'diferencia', r.d, 'mas_cerca', r.d = lim.dmin)
  from r cross join lim;
$$;
