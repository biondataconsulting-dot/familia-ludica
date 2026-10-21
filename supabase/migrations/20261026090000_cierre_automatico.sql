-- Cierre automático: al llegar el reloj a 0, el proyector y el panel piden cerrar. La base cierra
-- solo si el tiempo de verdad se cumplió (nadie puede cerrar antes): mismo cierre que el conductor
-- (valida textos de Hitster/Cine y pasa a item_closed). Si una canción o escena todavía no arrancó,
-- el reloj está esperando (media_waiting) y no se cierra.

create function public.cerrar_si_vencio(p_code text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  v_media boolean;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id for update;
  if ls.phase is distinct from 'item_open' or ls.timer_seconds is null or ls.opened_at is null then
    return false;
  end if;
  if now() < ls.opened_at + make_interval(secs => ls.timer_seconds + ls.extra_seconds) then
    return false;
  end if;
  -- Canción o escena abierta que el proyector todavía no reprodujo: el reloj espera hasta 30 s.
  select ci.type in ('pista_audio', 'clip_video') into v_media
  from public.block_items bi join public.catalog_items ci on ci.id = bi.catalog_item_id
  where bi.id = ls.block_item_id;
  if coalesce(v_media, false) and ls.media_started_at is null and now() < ls.opened_at + interval '30 seconds' then
    return false;
  end if;
  perform private.validar_item(ls.block_item_id);
  update public.live_state set phase = 'item_closed' where event_id = e.id;
  return true;
end $$;

grant execute on function public.cerrar_si_vencio(text) to anon, authenticated;
