-- Bingo musical: el Express pasa a 4 canciones por fila (cartón 3 × 5 con 12). El Full sigue con 5 por fila.
-- Los cartones Express ya generados quedan como están (3 por fila); hay que generarlos de nuevo para el formato nuevo.

create or replace function private.bingo_por_fila(p_tipo text) returns int
language sql immutable set search_path = '' as $$
  select case p_tipo when 'express' then 4 else 5 end;
$$;
