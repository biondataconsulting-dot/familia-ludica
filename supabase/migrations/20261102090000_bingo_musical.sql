-- Bingo musical (dinámica `bingo`): un set fijo de hasta 90 canciones numeradas (cada una con su inicio de
-- estribillo y su duración) y cartones impresos que se reutilizan. Dos tipos:
-- · express: canciones 1–40, cartón 3 × 5 con 9 (3 por fila; columnas de 8 números). ~11–15 min.
-- · full: canciones 1–90, cartón 3 × 9 con 15 (5 por fila; columnas por decena: 1–9, 10–19 … 80–90). ~27–30 min.
-- La bolilla la saca la base al azar (sin repetir). El título de la canción no llega a las pantallas
-- hasta que termina el fragmento (la gente canta primero). El conductor verifica un cartón por su número.
-- Es un bloque sin ítems (como el sorteo): se juega en la presentación del bloque; «Siguiente» sigue.

alter table public.event_blocks drop constraint event_blocks_dynamic_check;
alter table public.event_blocks add constraint event_blocks_dynamic_check
  check (dynamic in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial', 'sorteo', 'bingo'));

create table public.bingo_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.bingo_songs (
  set_id uuid not null references public.bingo_sets (id) on delete cascade,
  number int not null check (number between 1 and 90),
  catalog_item_id uuid not null references public.catalog_items (id),
  inicio int not null default 0 check (inicio between 0 and 3600),
  duracion int not null default 15 check (duracion between 5 and 120),
  -- Título más corto para el cartón (opcional; si no, el del catálogo).
  titulo_carton text check (char_length(titulo_carton) between 1 and 40),
  primary key (set_id, number)
);

create table public.bingo_cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.bingo_sets (id) on delete cascade,
  tipo text not null check (tipo in ('express', 'full')),
  numero int not null check (numero between 1 and 999),
  -- Tres filas, cada una con sus números de menor a mayor: [[3, 24, 41, 63, 85], [...], [...]].
  filas jsonb not null,
  created_at timestamptz not null default now(),
  unique (set_id, tipo, numero)
);

create table public.bingo_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  block_id uuid not null references public.event_blocks (id) on delete cascade,
  number int not null,
  position int not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (block_id, number),
  unique (block_id, position)
);

alter table public.bingo_sets enable row level security;
alter table public.bingo_songs enable row level security;
alter table public.bingo_cards enable row level security;
alter table public.bingo_draws enable row level security;
create policy admin_lee_bingo_sets on public.bingo_sets for select using (public.is_admin());
create policy admin_lee_bingo_songs on public.bingo_songs for select using (public.is_admin());
create policy admin_lee_bingo_cards on public.bingo_cards for select using (public.is_admin());
create policy admin_lee_bingo_draws on public.bingo_draws for select using (public.is_admin());
grant select on public.bingo_sets, public.bingo_songs, public.bingo_cards, public.bingo_draws to authenticated;

create trigger bingo_draws_avisar after insert or update or delete on public.bingo_draws
  for each row execute function private.avisar_cambio();

-- ============================================================
-- Formato de cada tipo
-- ============================================================

-- Canciones en juego (las del 1 a este número).
create function private.bingo_pool(p_tipo text) returns int
language sql immutable set search_path = '' as $$
  select case p_tipo when 'express' then 40 when 'full' then 90 end;
$$;

-- Columna (desde 0) de un número en el cartón.
create function private.bingo_columna(p_tipo text, n int) returns int
language sql immutable set search_path = '' as $$
  select case p_tipo when 'express' then (n - 1) / 8 else least(n / 10, 8) end;
$$;

create function private.bingo_columnas(p_tipo text) returns int
language sql immutable set search_path = '' as $$
  select case p_tipo when 'express' then 5 else 9 end;
$$;

create function private.bingo_por_fila(p_tipo text) returns int
language sql immutable set search_path = '' as $$
  select case p_tipo when 'express' then 3 else 5 end;
$$;

-- Título de un número del set (el del cartón si tiene uno corto; si no, el del catálogo).
create function private.bingo_titulo(p_set uuid, n int, p_corto boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'titulo', case when p_corto then coalesce(bs.titulo_carton, cs.solution ->> 'titulo') else cs.solution ->> 'titulo' end,
    'artista', cs.solution ->> 'artista'
  )
  from public.bingo_songs bs
  left join public.catalog_solutions cs on cs.item_id = bs.catalog_item_id
  where bs.set_id = p_set and bs.number = n;
$$;

-- ============================================================
-- Sets (preparación)
-- ============================================================

create function public.admin_bingo_set(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p ->> 'name', ''));
begin
  perform private.require_admin();
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'El nombre del set tiene que tener entre 1 y 80 caracteres.';
  end if;
  if v_id is null then
    insert into public.bingo_sets (name) values (v_name) returning id into v_id;
  else
    update public.bingo_sets set name = v_name where id = v_id;
    if not found then
      raise exception 'No encontramos ese set.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

create function public.admin_bingo_set_borrar(p_set_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.event_blocks where dynamic = 'bingo' and config ->> 'bingo_set' = p_set_id::text) then
    raise exception 'Hay bloques de bingo que usan este set. Cambialos o borralos primero.';
  end if;
  delete from public.bingo_sets where id = p_set_id;
end $$;

-- ¿Hay cartones generados que incluyan este número? (entonces la canción de ese número queda fija)
create function private.bingo_numero_impreso(p_set uuid, n int) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bingo_cards c where c.set_id = p_set and n <= private.bingo_pool(c.tipo));
$$;

-- p: {set_id, number, catalog_item_id, inicio?, duracion?, titulo_carton?}
create function public.admin_bingo_cancion(p jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_set uuid := nullif(p ->> 'set_id', '')::uuid;
  v_n int := (nullif(p ->> 'number', ''))::int;
  v_item uuid := nullif(p ->> 'catalog_item_id', '')::uuid;
  v_inicio int := coalesce((nullif(p ->> 'inicio', ''))::int, 0);
  v_dur int := coalesce((nullif(p ->> 'duracion', ''))::int, 15);
  v_corto text := nullif(btrim(coalesce(p ->> 'titulo_carton', '')), '');
  v_antes uuid;
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
  select catalog_item_id into v_antes from public.bingo_songs where set_id = v_set and number = v_n;
  if v_antes is not null and v_antes <> v_item and private.bingo_numero_impreso(v_set, v_n) then
    raise exception 'El número % ya está en cartones generados: no se puede cambiar la canción (sí el video, el inicio o la duración). Para cambiarla, borrá los cartones y volvé a imprimirlos.', v_n;
  end if;
  insert into public.bingo_songs (set_id, number, catalog_item_id, inicio, duracion, titulo_carton)
  values (v_set, v_n, v_item, v_inicio, v_dur, v_corto)
  on conflict (set_id, number) do update
  set catalog_item_id = excluded.catalog_item_id, inicio = excluded.inicio, duracion = excluded.duracion,
      titulo_carton = excluded.titulo_carton;
end $$;

create function public.admin_bingo_cancion_quitar(p_set_id uuid, p_number int) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if private.bingo_numero_impreso(p_set_id, p_number) then
    raise exception 'El número % ya está en cartones generados: no se puede sacar.', p_number;
  end if;
  delete from public.bingo_songs where set_id = p_set_id and number = p_number;
end $$;

-- Reemplaza los cartones de un tipo. p_cartones: [[[...], [...], [...]], ...] (los arma la app; acá se
-- valida todo: formato del tipo, columnas, números en juego, sin repetir dentro del cartón ni cartones iguales).
create function public.admin_bingo_cartones(p_set_id uuid, p_tipo text, p_cartones jsonb) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_pool int := private.bingo_pool(p_tipo);
  v_cols int := private.bingo_columnas(p_tipo);
  v_k int := private.bingo_por_fila(p_tipo);
  c jsonb;
  f jsonb;
  v_i int := 0;
  v_nums int[];
  v_fila int[];
  v_vistos text[] := '{}';
  v_clave text;
  v_col int;
  v_por_col int[];
begin
  perform private.require_admin();
  if v_pool is null then
    raise exception 'El tipo de bingo tiene que ser express o full.';
  end if;
  if not exists (select 1 from public.bingo_sets where id = p_set_id) then
    raise exception 'No encontramos ese set.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.bingo_songs where set_id = p_set_id and number <= v_pool) < v_pool then
    raise exception 'Faltan canciones: para el bingo % hacen falta las % primeras (números 1 a %).',
      case p_tipo when 'express' then 'Express' else 'Full' end, v_pool, v_pool;
  end if;
  if coalesce(jsonb_typeof(p_cartones), '') <> 'array' or jsonb_array_length(p_cartones) < 1 or jsonb_array_length(p_cartones) > 300 then
    raise exception 'Se pueden generar entre 1 y 300 cartones.';
  end if;
  delete from public.bingo_cards where set_id = p_set_id and tipo = p_tipo;
  for c in select * from jsonb_array_elements(p_cartones) loop
    v_i := v_i + 1;
    if jsonb_typeof(c) <> 'array' or jsonb_array_length(c) <> 3 then
      raise exception 'El cartón % no tiene 3 filas.', v_i;
    end if;
    v_nums := '{}';
    v_por_col := array_fill(0, array[v_cols]);
    for f in select * from jsonb_array_elements(c) loop
      v_fila := array(select (x)::int from jsonb_array_elements_text(f) x);
      if array_length(v_fila, 1) is distinct from v_k then
        raise exception 'El cartón % tiene una fila sin % números.', v_i, v_k;
      end if;
      if (select count(distinct private.bingo_columna(p_tipo, n)) from unnest(v_fila) n) <> v_k then
        raise exception 'El cartón % tiene dos números de la misma columna en una fila.', v_i;
      end if;
      foreach v_col in array v_fila loop
        if v_col < 1 or v_col > v_pool then
          raise exception 'El cartón % tiene un número fuera de juego (%).', v_i, v_col;
        end if;
        v_por_col[private.bingo_columna(p_tipo, v_col) + 1] := v_por_col[private.bingo_columna(p_tipo, v_col) + 1] + 1;
      end loop;
      v_nums := v_nums || v_fila;
    end loop;
    if (select count(distinct n) from unnest(v_nums) n) <> 3 * v_k then
      raise exception 'El cartón % repite un número.', v_i;
    end if;
    if exists (select 1 from unnest(v_por_col) k where k < 1 or k > 3) then
      raise exception 'El cartón % tiene una columna vacía o con más de 3 números.', v_i;
    end if;
    v_clave := (select string_agg(n::text, ',' order by n) from unnest(v_nums) n);
    if v_clave = any (v_vistos) then
      raise exception 'Los cartones % y otro son iguales.', v_i;
    end if;
    v_vistos := v_vistos || v_clave;
    insert into public.bingo_cards (set_id, tipo, numero, filas)
    values (p_set_id, p_tipo, v_i, (
      select jsonb_agg((select jsonb_agg((x)::int order by (x)::int) from jsonb_array_elements_text(fila) x) order by ord)
      from jsonb_array_elements(c) with ordinality as t (fila, ord)
    ));
  end loop;
  return v_i;
end $$;

create function public.admin_bingo_cartones_borrar(p_set_id uuid, p_tipo text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  delete from public.bingo_cards where set_id = p_set_id and tipo = p_tipo;
end $$;

-- Un ítem del catálogo usado en un set de bingo no se borra (los cartones impresos lo nombran).
create or replace function public.admin_delete_item(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.block_items where catalog_item_id = p_id) then
    raise exception 'Este ítem está en un bloque de alguna noche. Sacalo del bloque primero.';
  end if;
  if exists (select 1 from public.bingo_songs where catalog_item_id = p_id) then
    raise exception 'Esta canción está en un set de bingo. Sacala del set primero.';
  end if;
  delete from public.catalog_items where id = p_id;
  if not found then
    raise exception 'No encontramos ese ítem.' using errcode = 'P0002';
  end if;
end $$;

-- ============================================================
-- En vivo
-- ============================================================

-- Bloque de bingo en presentación (donde se juega). Devuelve el bloque o error claro.
create function private.bingo_en_juego(p_event_id uuid) returns public.event_blocks
language plpgsql stable security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
begin
  ls := private.live_para_operar(p_event_id);
  select * into b from public.event_blocks where id = ls.block_id;
  if b.dynamic is distinct from 'bingo' or ls.phase <> 'block_intro' then
    raise exception 'Para jugar, presentá el bloque del bingo.';
  end if;
  return b;
end $$;

-- Saca una bolilla al azar entre las que no salieron. No mientras suena la anterior.
create function public.admin_bingo_sacar(p_event_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.event_blocks;
  v_set uuid;
  v_tipo text;
  v_ult record;
  v_n int;
  v_pos int;
begin
  b := private.bingo_en_juego(p_event_id);
  v_set := (b.config ->> 'bingo_set')::uuid;
  v_tipo := b.config ->> 'bingo_tipo';
  select d.created_at, bs.duracion into v_ult
  from public.bingo_draws d join public.bingo_songs bs on bs.set_id = v_set and bs.number = d.number
  where d.block_id = b.id order by d.position desc limit 1;
  if found and clock_timestamp() < v_ult.created_at + make_interval(secs => v_ult.duracion) then
    raise exception 'Esperá a que termine la canción.';
  end if;
  select bs.number into v_n
  from public.bingo_songs bs
  where bs.set_id = v_set and bs.number <= private.bingo_pool(v_tipo)
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

-- Para proyector y celulares: lo que salió en el bingo actual. El título y el artista de una bolilla
-- recién se muestran cuando terminó su fragmento (antes, solo el número).
create function public.get_bingo(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  b public.event_blocks;
  v_set uuid;
  v_tipo text;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id;
  select * into b from public.event_blocks where id = ls.block_id;
  -- Se juega en la presentación del bloque (al terminar la noche el bloque sigue siendo el último).
  if b.dynamic is distinct from 'bingo' or ls.phase <> 'block_intro' then
    return null;
  end if;
  v_set := (b.config ->> 'bingo_set')::uuid;
  v_tipo := b.config ->> 'bingo_tipo';
  return jsonb_build_object(
    'server_now', clock_timestamp(),
    'tipo', v_tipo,
    'pool', private.bingo_pool(v_tipo),
    'bolillas', coalesce((
      select jsonb_agg(
        jsonb_build_object('number', d.number, 'position', d.position, 'at', d.created_at, 'duracion', bs.duracion)
        || case when clock_timestamp() >= d.created_at + make_interval(secs => bs.duracion)
             then private.bingo_titulo(v_set, d.number, false) else '{}'::jsonb end
        order by d.position)
      from public.bingo_draws d join public.bingo_songs bs on bs.set_id = v_set and bs.number = d.number
      where d.block_id = b.id
    ), '[]'::jsonb)
  );
end $$;

-- Solo el proyector: el video de la última bolilla (como proyector_media en Hitster).
create function public.proyector_bingo(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  b public.event_blocks;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id;
  select * into b from public.event_blocks where id = ls.block_id;
  if b.dynamic is distinct from 'bingo' or ls.phase <> 'block_intro' then
    return null;
  end if;
  return (
    select jsonb_build_object('id', d.id, 'number', d.number, 'at', d.created_at,
      'youtube_id', ci.content ->> 'youtube_id', 'inicio', bs.inicio, 'duracion', bs.duracion)
    from public.bingo_draws d
    join public.bingo_songs bs on bs.set_id = (b.config ->> 'bingo_set')::uuid and bs.number = d.number
    join public.catalog_items ci on ci.id = bs.catalog_item_id
    where d.block_id = b.id order by d.position desc limit 1
  );
end $$;

-- Conductor: un cartón (por su número) contra lo que salió en el bingo actual.
create function public.admin_bingo_verificar(p_event_id uuid, p_numero int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_set uuid;
  v_tipo text;
  c public.bingo_cards;
  v_salieron int[];
  v_filas jsonb;
  v_lineas int;
begin
  ls := private.live_para_operar(p_event_id);
  select * into b from public.event_blocks where id = ls.block_id;
  if b.dynamic is distinct from 'bingo' then
    raise exception 'No hay un bingo en juego.';
  end if;
  v_set := (b.config ->> 'bingo_set')::uuid;
  v_tipo := b.config ->> 'bingo_tipo';
  select * into c from public.bingo_cards where set_id = v_set and tipo = v_tipo and numero = p_numero;
  if not found then
    raise exception 'No hay un cartón % de este bingo (%).', p_numero, case v_tipo when 'express' then 'Express' else 'Full' end
      using errcode = 'P0002';
  end if;
  v_salieron := array(select number from public.bingo_draws where block_id = b.id);
  select jsonb_agg((
      select jsonb_agg(jsonb_build_object('number', n, 'salio', n = any (v_salieron)) || private.bingo_titulo(v_set, n, true) order by n)
      from (select (x)::int as n from jsonb_array_elements_text(fila) x) z
    ) order by ord)
  into v_filas
  from jsonb_array_elements(c.filas) with ordinality as t (fila, ord);
  select count(*) into v_lineas
  from jsonb_array_elements(c.filas) fila
  where not exists (select 1 from jsonb_array_elements_text(fila) x where not ((x)::int = any (v_salieron)));
  return jsonb_build_object(
    'numero', c.numero, 'tipo', c.tipo, 'filas', v_filas, 'lineas', v_lineas,
    'bingo', v_lineas = 3, 'bolillas', coalesce(array_length(v_salieron, 1), 0)
  );
end $$;

grant execute on function public.admin_bingo_set(jsonb) to authenticated;
grant execute on function public.admin_bingo_set_borrar(uuid) to authenticated;
grant execute on function public.admin_bingo_cancion(jsonb) to authenticated;
grant execute on function public.admin_bingo_cancion_quitar(uuid, int) to authenticated;
grant execute on function public.admin_bingo_cartones(uuid, text, jsonb) to authenticated;
grant execute on function public.admin_bingo_cartones_borrar(uuid, text) to authenticated;
grant execute on function public.admin_bingo_sacar(uuid) to authenticated;
grant execute on function public.admin_bingo_verificar(uuid, int) to authenticated;
grant execute on function public.get_bingo(text) to anon, authenticated;
grant execute on function public.proyector_bingo(text) to anon, authenticated;

-- admin_save_block (igual que antes) + bloque "bingo" con su set y su tipo.
create or replace function public.admin_save_block(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  v_dynamic text := p ->> 'dynamic';
  v_title text := btrim(coalesce(p ->> 'title', ''));
  v_mult numeric := coalesce((nullif(p ->> 'multiplier', ''))::numeric, 1);
  v_timer int := (nullif(p ->> 'timer_seconds', ''))::int;
  v_practice boolean := coalesce((p ->> 'is_practice')::boolean, false);
  v_extra jsonb;
begin
  perform private.require_admin();
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial', 'sorteo', 'bingo') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones, hipster, cine, imagen, oveja, especial, sorteo o bingo.';
  end if;
  if v_dynamic = 'bingo' then
    if coalesce(p ->> 'bingo_tipo', '') not in ('express', 'full') then
      raise exception 'Elegí el tipo de bingo: Express o Full.';
    end if;
    if not exists (select 1 from public.bingo_sets where id = nullif(p ->> 'bingo_set', '')::uuid) then
      raise exception 'Elegí el set de canciones del bingo.';
    end if;
  end if;
  if v_dynamic = 'sorteo' and exists (
    select 1 from public.event_blocks
    where event_id = coalesce(v_event, (select event_id from public.event_blocks where id = v_id))
      and dynamic = 'sorteo' and id is distinct from v_id
  ) then
    raise exception 'Esta noche ya tiene un bloque de sorteo (uno por noche).';
  end if;
  if char_length(coalesce(p ->> 'subtitulo', '')) > 160 then
    raise exception 'El subtítulo puede tener hasta 160 caracteres.';
  end if;
  if char_length(coalesce(p ->> 'imagen', '')) > 500 then
    raise exception 'El enlace de la imagen es demasiado largo.';
  end if;
  if char_length(coalesce(p ->> 'emoji', '')) > 16 then
    raise exception 'La decoración es un emoji (o dos), no un texto.';
  end if;
  -- Datos extra del bloque: subtítulo e imagen (bloque especial) y emoji decorativo (cualquier bloque).
  v_extra := jsonb_build_object(
    'subtitulo', nullif(btrim(coalesce(p ->> 'subtitulo', '')), ''),
    'imagen', nullif(btrim(coalesce(p ->> 'imagen', '')), ''),
    'emoji', nullif(btrim(coalesce(p ->> 'emoji', '')), ''),
    'bingo_set', case when v_dynamic = 'bingo' then p ->> 'bingo_set' end,
    'bingo_tipo', case when v_dynamic = 'bingo' then p ->> 'bingo_tipo' end
  );
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception 'El título del bloque tiene que tener entre 1 y 80 caracteres.';
  end if;
  if v_mult <= 0 or v_mult > 10 then
    raise exception 'El multiplicador tiene que ser mayor que 0 y hasta 10.';
  end if;
  if v_timer is not null and (v_timer < 5 or v_timer > 3600) then
    raise exception 'El tiempo sugerido tiene que estar entre 5 segundos y 1 hora (o vacío, sin tiempo).';
  end if;

  if v_id is null then
    if not exists (select 1 from public.events where id = v_event) then
      raise exception 'No encontramos esa noche.' using errcode = 'P0002';
    end if;
    insert into public.event_blocks (event_id, position, dynamic, title, multiplier, is_practice, config)
    values (v_event, coalesce((select max(position) from public.event_blocks where event_id = v_event), 0) + 1,
            v_dynamic, v_title, v_mult, v_practice,
            jsonb_strip_nulls(v_extra || case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end))
    returning id into v_id;
  else
    perform private.bloque_libre(v_id);
    if exists (
      select 1 from public.block_items bi join public.catalog_items ci on ci.id = bi.catalog_item_id
      where bi.block_id = v_id and not private.tipo_va_en(v_dynamic, ci.type)
    ) then
      raise exception 'El bloque tiene ítems que no son de esa dinámica. Sacalos primero.';
    end if;
    update public.event_blocks
    set dynamic = v_dynamic, title = v_title, multiplier = v_mult, is_practice = v_practice,
        config = jsonb_strip_nulls(
          (config - 'timer_seconds' - 'subtitulo' - 'imagen' - 'emoji' - 'bingo_set' - 'bingo_tipo') || v_extra
          || case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end
        )
    where id = v_id;
    if not found then
      raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

-- admin_next (igual que antes) + el bingo, como el especial y el sorteo, pasa al bloque que sigue.
create or replace function public.admin_next(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_siguiente uuid;
begin
  ls := private.live_para_operar(p_event_id);
  select * into b from public.event_blocks where id = ls.block_id;

  case ls.phase
    when 'cover' then
      v_siguiente := private.bloque_siguiente(p_event_id, null);
      if v_siguiente is null then
        raise exception 'Esta noche no tiene bloques todavía.';
      end if;
      perform private.ir_a_bloque(p_event_id, v_siguiente);

    when 'block_intro' then
      -- Bloque especial (pausa, sorteo…): no tiene ítems; "Siguiente" pasa al bloque que sigue.
      if b.dynamic in ('especial', 'sorteo', 'bingo') then
        v_siguiente := private.bloque_siguiente(p_event_id, ls.block_id);
        if v_siguiente is null then
          update public.live_state set phase = 'final', revealed = null where event_id = p_event_id;
        else
          perform private.ir_a_bloque(p_event_id, v_siguiente);
        end if;
        return;
      end if;
      v_siguiente := private.item_siguiente(ls.block_id, null);
      if v_siguiente is null then
        raise exception 'Este bloque no tiene ítems todavía.';
      end if;
      perform private.abrir_item(p_event_id, v_siguiente, null);

    when 'item_revealed' then
      v_siguiente := private.item_siguiente(ls.block_id, ls.block_item_id);
      if v_siguiente is not null then
        perform private.abrir_item(p_event_id, v_siguiente, null);
      elsif b.is_practice then
        v_siguiente := private.bloque_siguiente(p_event_id, ls.block_id);
        if v_siguiente is null then
          update public.live_state set phase = 'final', revealed = null where event_id = p_event_id;
        else
          perform private.ir_a_bloque(p_event_id, v_siguiente);
        end if;
      else
        update public.live_state set phase = 'block_ranking', revealed = null where event_id = p_event_id;
      end if;

    when 'block_ranking' then
      v_siguiente := private.bloque_siguiente(p_event_id, ls.block_id);
      if v_siguiente is null then
        update public.live_state set phase = 'final' where event_id = p_event_id;
      else
        perform private.ir_a_bloque(p_event_id, v_siguiente);
      end if;

    when 'item_open' then
      raise exception 'Primero cerrá las respuestas.';
    when 'item_closed' then
      raise exception 'Primero revelá la solución.';
    else
      raise exception 'La noche ya está en el final. Para cerrarla, tocá «Terminar la noche».';
  end case;
end $$;

-- admin_reset_event (igual que antes) + borra las bolillas.
create or replace function public.admin_reset_event(p_event_id uuid, p_code text) returns void
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

  -- live_state primero: deja de apuntar a ítems y fases en juego.
  update public.live_state
  set phase = 'cover', block_id = null, block_item_id = null, opened_at = null,
      timer_seconds = null, extra_seconds = 0, revealed = null, show_qr = false, show_ranking = false, show_podio = false, sonido_id = null
  where event_id = p_event_id;

  delete from public.bingo_draws where event_id = p_event_id;
  delete from public.raffle_draws where event_id = p_event_id;
  delete from public.raffle_participants where event_id = p_event_id;
  delete from public.score_entries where event_id = p_event_id;
  delete from public.answers where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id; -- con sus intentos de PIN y misiones cumplidas (cascade)
  update public.event_extras set status = 'oculto' where event_id = p_event_id;

  update public.events set status = 'listo' where id = p_event_id;
  update public.catalog_items
  set used_in_events = array_remove(used_in_events, p_event_id)
  where p_event_id = any (used_in_events);
end $$;
