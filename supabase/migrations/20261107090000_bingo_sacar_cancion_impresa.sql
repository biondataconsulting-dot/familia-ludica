-- Bingo musical: también se puede sacar la canción de un número que está en cartones impresos (con aviso en la app).
-- · El set queda incompleto para ese tipo: no se sacan bolillas hasta que el número vuelva a tener canción.
-- · La canción que se ponga después en ese número lo marca para reimprimir (el cartón tiene impresa la anterior).
-- · Mientras se juega el bingo del set, no se saca (igual que no se cambia).

create or replace function public.admin_bingo_cancion_quitar(p_set_id uuid, p_number int) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform private.bingo_set_en_juego(p_set_id);
  delete from public.bingo_songs where set_id = p_set_id and number = p_number;
end $$;

-- p: {set_id, number, catalog_item_id, inicio?, duracion?, titulo_carton?}
create or replace function public.admin_bingo_cancion(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_set uuid := nullif(p ->> 'set_id', '')::uuid;
  v_n int := (nullif(p ->> 'number', ''))::int;
  v_item uuid := nullif(p ->> 'catalog_item_id', '')::uuid;
  v_inicio int := coalesce((nullif(p ->> 'inicio', ''))::int, 0);
  v_dur int := coalesce((nullif(p ->> 'duracion', ''))::int, 15);
  v_corto text := nullif(btrim(coalesce(p ->> 'titulo_carton', '')), '');
  v_antes public.bingo_songs;
  v_cambia_carton boolean;
begin
  perform private.require_admin();
  if not exists (select 1 from public.bingo_sets where id = v_set) then
    raise exception 'No encontramos ese set.' using errcode = 'P0002';
  end if;
  if v_n is null or v_n < 1 or v_n > 90 then
    raise exception 'El número tiene que estar entre 1 y 90.';
  end if;
  if not exists (select 1 from public.catalog_items where id = v_item and type = 'pista_audio') then
    raise exception 'Elegí una canción del catálogo (tipo Hitster musical).';
  end if;
  if v_inicio < 0 or v_inicio > 3600 then
    raise exception 'El inicio tiene que estar entre 0 y 3600 segundos.';
  end if;
  if v_dur < 5 or v_dur > 120 then
    raise exception 'La duración tiene que estar entre 5 y 120 segundos.';
  end if;
  if char_length(coalesce(v_corto, '')) > 40 then
    raise exception 'El título para el cartón puede tener hasta 40 caracteres.';
  end if;
  select * into v_antes from public.bingo_songs where set_id = v_set and number = v_n;
  -- Número nuevo o canción/título distintos: cambia lo que el cartón tendría que tener impreso.
  v_cambia_carton := v_antes.number is null or v_antes.catalog_item_id <> v_item or v_antes.titulo_carton is distinct from v_corto;
  if v_cambia_carton then
    perform private.bingo_set_en_juego(v_set);
  end if;
  insert into public.bingo_songs as bs (set_id, number, catalog_item_id, inicio, duracion, titulo_carton, carton_cambiado_at)
  values (v_set, v_n, v_item, v_inicio, v_dur, v_corto,
          case when private.bingo_numero_impreso(v_set, v_n) then clock_timestamp() end)
  on conflict (set_id, number) do update
  set catalog_item_id = excluded.catalog_item_id, inicio = excluded.inicio, duracion = excluded.duracion,
      titulo_carton = excluded.titulo_carton,
      carton_cambiado_at = case when v_cambia_carton and private.bingo_numero_impreso(v_set, v_n)
                                then clock_timestamp() else bs.carton_cambiado_at end;
end $$;

-- Sacar bolilla (igual que antes) + el set tiene que tener todas las canciones del tipo.
create or replace function public.admin_bingo_sacar(p_event_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.event_blocks;
  v_set uuid;
  v_tipo text;
  v_pool int;
  v_faltan text;
  v_ult record;
  v_n int;
  v_pos int;
begin
  b := private.bingo_en_juego(p_event_id);
  v_set := (b.config ->> 'bingo_set')::uuid;
  v_tipo := b.config ->> 'bingo_tipo';
  v_pool := private.bingo_pool(v_tipo);
  select string_agg(n::text, ', ' order by n) into v_faltan
  from generate_series(1, v_pool) n
  where not exists (select 1 from public.bingo_songs where set_id = v_set and number = n);
  if v_faltan is not null then
    raise exception 'Al set le faltan canciones en los números %. Completalas en Bingo antes de sacar bolillas.', v_faltan;
  end if;
  select d.created_at, d.revelada_at, bs.duracion into v_ult
  from public.bingo_draws d join public.bingo_songs bs on bs.set_id = v_set and bs.number = d.number
  where d.block_id = b.id order by d.position desc limit 1;
  if found and v_ult.revelada_at is null and clock_timestamp() < v_ult.created_at + make_interval(secs => v_ult.duracion) then
    raise exception 'Esperá a que termine la canción.';
  end if;
  select bs.number into v_n
  from public.bingo_songs bs
  where bs.set_id = v_set and bs.number <= v_pool
    and not exists (select 1 from public.bingo_draws d where d.block_id = b.id and d.number = bs.number)
  order by random() limit 1;
  if v_n is null then
    raise exception 'Ya salieron todas las canciones.';
  end if;
  v_pos := coalesce((select max(position) from public.bingo_draws where block_id = b.id), 0) + 1;
  insert into public.bingo_draws (event_id, block_id, number, position) values (p_event_id, b.id, v_n, v_pos);
  -- La música de fondo se apaga (como al abrir una canción del juego).
  update public.live_state set sonido_id = null, sonido_desde = null where event_id = p_event_id;
  return jsonb_build_object('number', v_n, 'position', v_pos);
end $$;
