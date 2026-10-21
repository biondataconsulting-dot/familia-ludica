-- Segundo de inicio opcional para canciones y escenas (pedido del cliente): por defecto 0:00, pero un
-- ítem puede arrancar más adelante (para saltear un comienzo que delata el nombre). El proyector entra con
-- el volumen suave cuando no arranca en 0. Los ítems cargados hasta hoy tienen todos inicio 0.

create or replace function public.proyector_media(p_code text) returns jsonb
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
    'inicio', greatest(0, coalesce((v_content ->> 'inicio')::int, 0)),
    'duracion', coalesce((v_content ->> 'duracion')::int, 20)
  );
end $$;
