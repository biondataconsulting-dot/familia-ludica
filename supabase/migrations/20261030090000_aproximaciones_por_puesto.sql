-- Aproximaciones por puesto (pedido del cliente después de la prueba del 21/10): con la fórmula anterior la
-- más lejana sumaba 0 aunque estuviera cerca (con pocas mesas, injusto). Ahora, como un podio, según la
-- distancia al valor correcto: 1° 1.000 · 2° 700 · 3° 500 · 4° 300 · 5° y siguientes 100. Las empatadas
-- comparten puesto (rank: 1°, 2°, 2°, 4°). Misma fórmula que src/dynamics/aproximaciones/puntaje.ts.

create or replace function private.score_aproximaciones(p_block_item_id uuid)
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
  p as (select r.*, rank() over (order by r.d)::int as puesto from r)
  select
    p.team_id,
    case p.puesto when 1 then 1000 when 2 then 700 when 3 then 500 when 4 then 300 else 100 end,
    jsonb_build_object('valor', p.valor, 'diferencia', p.d, 'puesto', p.puesto, 'mas_cerca', p.puesto = 1)
  from p;
$$;
