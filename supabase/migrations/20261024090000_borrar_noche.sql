-- Borrar una noche mal cargada o de prueba, con todo lo suyo: bloques, mesas, respuestas y puntos
-- (por cascade). Los ítems del catálogo quedan (solo se les quita la marca de "usado en esta noche").
-- Pide el código de la noche como confirmación (también lo pide la pantalla).

create function public.admin_delete_event(p_event_id uuid, p_code text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if upper(btrim(coalesce(p_code, ''))) <> e.code then
    raise exception 'El código no coincide. Escribí % para confirmar.', e.code;
  end if;

  update public.catalog_items
  set used_in_events = array_remove(used_in_events, p_event_id)
  where p_event_id = any (used_in_events);

  delete from public.events where id = p_event_id;
end $$;

grant execute on function public.admin_delete_event(uuid, text) to authenticated;
