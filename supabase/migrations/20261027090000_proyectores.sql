-- Aviso de proyectores duplicados: cada proyector con «Comenzar la noche» tocado (o sea, con sonido)
-- late cada 10 s con un id propio de esa página. El panel cuenta los que latieron en los últimos 25 s:
-- si son dos o más, se va a escuchar doble. Sin aviso en tiempo real (no hace falta: el panel consulta).

create table public.proyectores (
  event_id uuid not null references public.events (id) on delete cascade,
  id uuid not null,
  last_seen timestamptz not null default now(),
  primary key (event_id, id)
);
alter table public.proyectores enable row level security;
create policy admin_lee_proyectores on public.proyectores for select to authenticated using ((select public.is_admin()));
grant select on public.proyectores to authenticated;

create function public.proyector_latido(p_code text, p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
begin
  e := private.event_by_code(p_code);
  if p_id is null then
    return;
  end if;
  -- Limpieza: los que dejaron de latir hace más de 2 minutos ya no cuentan.
  delete from public.proyectores where event_id = e.id and last_seen < now() - interval '2 minutes';
  -- Tope por si alguien llama de más: con 20 activos no se agregan nuevos.
  if not exists (select 1 from public.proyectores where event_id = e.id and id = p_id)
     and (select count(*) from public.proyectores where event_id = e.id) >= 20 then
    return;
  end if;
  insert into public.proyectores (event_id, id) values (e.id, p_id)
  on conflict (event_id, id) do update set last_seen = now();
end $$;

-- Proyectores con sonido que latieron en los últimos 25 s.
create function public.admin_proyectores(p_event_id uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select count(*) from public.proyectores where event_id = p_event_id and last_seen > now() - interval '25 seconds');
end $$;

grant execute on function public.proyector_latido(text, uuid) to anon, authenticated;
grant execute on function public.admin_proyectores(uuid) to authenticated;
