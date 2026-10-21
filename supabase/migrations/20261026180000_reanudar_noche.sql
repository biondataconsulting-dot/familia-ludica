-- Reanudar una noche terminada (para jugar más bloques después del podio): vuelve a "en vivo" y el
-- proyector pasa del podio al ranking, desde donde el conductor presenta el bloque que siga.
-- Mesas, respuestas y puntos quedan como estaban.

create function public.admin_resume_event(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if e.status <> 'terminado' then
    raise exception 'Solo se puede reanudar una noche terminada.';
  end if;
  update public.events set status = 'en_vivo' where id = p_event_id;
  update public.live_state set phase = 'block_ranking', revealed = null, show_ranking = false
  where event_id = p_event_id and phase = 'final';
end $$;

grant execute on function public.admin_resume_event(uuid) to authenticated;
