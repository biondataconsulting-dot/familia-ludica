-- Bingo musical: la misma duración para todas las canciones de un set, de una vez (desde /admin/bingo/:setId).

create function public.admin_bingo_duracion_todas(p_set_id uuid, p_duracion int) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_n int;
begin
  perform private.require_admin();
  if not exists (select 1 from public.bingo_sets where id = p_set_id) then
    raise exception 'No encontramos ese set.' using errcode = 'P0002';
  end if;
  if p_duracion is null or p_duracion < 5 or p_duracion > 120 then
    raise exception 'La duración tiene que estar entre 5 y 120 segundos.';
  end if;
  update public.bingo_songs set duracion = p_duracion where set_id = p_set_id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.admin_bingo_duracion_todas(uuid, int) to authenticated;
