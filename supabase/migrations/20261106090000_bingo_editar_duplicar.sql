-- Bingo musical: sets editables después de imprimir, duplicar y borrar con aviso claro.
-- · La canción de un número impreso ya se puede cambiar: los números del cartón no cambian, solo el título y el
--   artista que lleva impresos. El número queda marcado (`carton_cambiado_at`) y la app ofrece reimprimir solo
--   los cartones que lo tienen; «Ya los reimprimí» guarda la hora en `bingo_sets.impresos` por tipo.
--   Un tipo está al día si sus cartones (created_at) o su última reimpresión son posteriores al último cambio.
-- · Cambiar el título o el artista de la canción en el catálogo también marca los números que la usan.
-- · No se cambian canciones de un set mientras se está jugando su bingo en una noche.

alter table public.bingo_songs add column carton_cambiado_at timestamptz;
alter table public.bingo_sets add column impresos jsonb not null default '{}';

-- ¿Se está jugando ahora un bingo con este set? (noche en la presentación de un bloque de bingo con este set)
create function private.bingo_set_en_juego(p_set uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_noche text;
begin
  select e.name into v_noche
  from public.live_state ls
  join public.event_blocks b on b.id = ls.block_id
  join public.events e on e.id = ls.event_id
  where ls.phase = 'block_intro' and b.dynamic = 'bingo' and b.config ->> 'bingo_set' = p_set::text
    and e.status = 'en_vivo'
  limit 1;
  if v_noche is not null then
    raise exception 'Este set se está jugando ahora en «%». Cambiá las canciones cuando termine el bingo.', v_noche;
  end if;
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
  v_cambia_carton := v_antes.number is not null
    and (v_antes.catalog_item_id <> v_item or v_antes.titulo_carton is distinct from v_corto);
  if v_cambia_carton then
    perform private.bingo_set_en_juego(v_set);
  end if;
  insert into public.bingo_songs as bs (set_id, number, catalog_item_id, inicio, duracion, titulo_carton)
  values (v_set, v_n, v_item, v_inicio, v_dur, v_corto)
  on conflict (set_id, number) do update
  set catalog_item_id = excluded.catalog_item_id, inicio = excluded.inicio, duracion = excluded.duracion,
      titulo_carton = excluded.titulo_carton,
      carton_cambiado_at = case when v_cambia_carton and private.bingo_numero_impreso(v_set, v_n)
                                then clock_timestamp() else bs.carton_cambiado_at end;
end $$;

create or replace function public.admin_bingo_cancion_quitar(p_set_id uuid, p_number int) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if private.bingo_numero_impreso(p_set_id, p_number) then
    raise exception 'El número % está en cartones generados: no puede quedar vacío. Si querés otra canción, elegila en ese número.', p_number;
  end if;
  delete from public.bingo_songs where set_id = p_set_id and number = p_number;
end $$;

-- «Ya los reimprimí»: los cartones de ese tipo quedan al día con las canciones actuales.
create function public.admin_bingo_reimpresos(p_set_id uuid, p_tipo text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if private.bingo_pool(p_tipo) is null then
    raise exception 'El tipo de bingo tiene que ser express o full.';
  end if;
  update public.bingo_sets set impresos = impresos || jsonb_build_object(p_tipo, clock_timestamp()) where id = p_set_id;
  if not found then
    raise exception 'No encontramos ese set.' using errcode = 'P0002';
  end if;
end $$;

-- Copia del set con sus canciones (sin cartones: el set nuevo se imprime aparte).
create function public.admin_bingo_set_duplicar(p_set_id uuid, p_name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_origen public.bingo_sets;
  v_name text;
  v_id uuid;
begin
  perform private.require_admin();
  select * into v_origen from public.bingo_sets where id = p_set_id;
  if not found then
    raise exception 'No encontramos ese set.' using errcode = 'P0002';
  end if;
  v_name := coalesce(nullif(btrim(coalesce(p_name, '')), ''), left(v_origen.name, 72) || ' (copia)');
  if char_length(v_name) > 80 then
    raise exception 'El nombre del set tiene que tener entre 1 y 80 caracteres.';
  end if;
  insert into public.bingo_sets (name) values (v_name) returning id into v_id;
  insert into public.bingo_songs (set_id, number, catalog_item_id, inicio, duracion, titulo_carton)
  select v_id, number, catalog_item_id, inicio, duracion, titulo_carton from public.bingo_songs where set_id = p_set_id;
  return v_id;
end $$;

-- Borrar: igual que antes, pero dice qué noches lo usan.
create or replace function public.admin_bingo_set_borrar(p_set_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_noches text;
begin
  perform private.require_admin();
  select string_agg(distinct '«' || e.name || '»', ', ') into v_noches
  from public.event_blocks b join public.events e on e.id = b.event_id
  where b.dynamic = 'bingo' and b.config ->> 'bingo_set' = p_set_id::text;
  if v_noches is not null then
    raise exception 'Este set está en el bingo de %. Cambiale el set a ese bloque (o borralo) y probá de nuevo.', v_noches;
  end if;
  delete from public.bingo_sets where id = p_set_id;
  if not found then
    raise exception 'No encontramos ese set.' using errcode = 'P0002';
  end if;
end $$;

-- Si cambia el título o el artista en el catálogo, los cartones que lo nombran quedan para reimprimir.
create function private.bingo_marcar_por_catalogo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.solution ->> 'titulo' is distinct from old.solution ->> 'titulo'
     or new.solution ->> 'artista' is distinct from old.solution ->> 'artista' then
    update public.bingo_songs bs set carton_cambiado_at = clock_timestamp()
    where bs.catalog_item_id = new.item_id and private.bingo_numero_impreso(bs.set_id, bs.number)
      and (bs.titulo_carton is null or new.solution ->> 'artista' is distinct from old.solution ->> 'artista');
  end if;
  return new;
end $$;

create trigger catalog_solutions_bingo after update on public.catalog_solutions
  for each row execute function private.bingo_marcar_por_catalogo();

grant execute on function public.admin_bingo_reimpresos(uuid, text) to authenticated;
grant execute on function public.admin_bingo_set_duplicar(uuid, text) to authenticated;
