-- El cronómetro de una canción o escena corre desde que empieza a reproducirse en el proyector, no
-- desde que el conductor la abre (el video tarda en cargar). El proyector avisa una sola vez por
-- apertura y la base corre opened_at a ese momento: proyector y panel siguen con el mismo reloj.

alter table public.live_state add column media_started_at timestamptz;

create or replace function private.abrir_item(p_event_id uuid, p_block_item_id uuid, p_timer_seconds int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_block_id uuid;
  v_config jsonb;
  v_timer int;
begin
  select bi.block_id, b.config into v_block_id, v_config
  from public.block_items bi join public.event_blocks b on b.id = bi.block_id
  where bi.id = p_block_item_id and b.event_id = p_event_id;
  if not found then
    raise exception 'Ese ítem no es de esta noche.' using errcode = 'P0002';
  end if;
  v_timer := coalesce(p_timer_seconds, (v_config ->> 'timer_seconds')::int);
  if v_timer is not null and (v_timer < 5 or v_timer > 3600) then
    raise exception 'El tiempo tiene que estar entre 5 segundos y 1 hora.';
  end if;
  update public.live_state
  set phase = 'item_open', block_id = v_block_id, block_item_id = p_block_item_id,
      opened_at = now(), media_started_at = null, timer_seconds = v_timer, extra_seconds = 0, revealed = null
  where event_id = p_event_id;
end $$;

-- Lo llama el proyector (sin sesión) cuando el video arranca. Solo hace algo con ese ítem abierto,
-- si es canción o escena, la primera vez y dentro de los 30 s de abierto (no se puede estirar el reloj).
create function public.proyector_media_arranco(p_code text, p_block_item_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
begin
  e := private.event_by_code(p_code);
  update public.live_state ls
  set opened_at = now(), media_started_at = now()
  where ls.event_id = e.id
    and ls.phase = 'item_open'
    and ls.block_item_id = p_block_item_id
    and ls.media_started_at is null
    and ls.opened_at > now() - interval '30 seconds'
    and exists (
      select 1 from public.block_items bi join public.catalog_items ci on ci.id = bi.catalog_item_id
      where bi.id = p_block_item_id and ci.type in ('pista_audio', 'clip_video')
    );
end $$;

grant execute on function public.proyector_media_arranco(text, uuid) to anon, authenticated;
