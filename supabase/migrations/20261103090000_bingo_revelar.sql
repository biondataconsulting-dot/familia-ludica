-- Bingo musical: el número de la bolilla tampoco se ve mientras suena (está impreso en el cartón: verlo
-- resolvería el juego sin reconocer la canción). Número, título y artista se revelan juntos al terminar el
-- fragmento o antes, si el conductor toca «Revelar ya».

alter table public.bingo_draws add column revelada_at timestamptz;

-- Conductor: revela ya la última bolilla (número, título y artista), sin esperar a que termine el fragmento.
create function public.admin_bingo_revelar(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.event_blocks;
begin
  b := private.bingo_en_juego(p_event_id);
  update public.bingo_draws set revelada_at = clock_timestamp()
  where block_id = b.id and revelada_at is null
    and position = (select max(position) from public.bingo_draws where block_id = b.id);
end $$;

grant execute on function public.admin_bingo_revelar(uuid) to authenticated;

-- Sacar: con la anterior revelada, ya se puede sacar otra aunque siga sonando.
create or replace function public.admin_bingo_sacar(p_event_id uuid) returns jsonb
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
  select d.created_at, d.revelada_at, bs.duracion into v_ult
  from public.bingo_draws d join public.bingo_songs bs on bs.set_id = v_set and bs.number = d.number
  where d.block_id = b.id order by d.position desc limit 1;
  if found and v_ult.revelada_at is null and clock_timestamp() < v_ult.created_at + make_interval(secs => v_ult.duracion) then
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

-- Para proyector y celulares: hasta que se revela (fin del fragmento o «Revelar ya»), la bolilla va sin número.
create or replace function public.get_bingo(p_code text) returns jsonb
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
        jsonb_build_object('position', d.position, 'at', d.created_at, 'duracion', bs.duracion, 'revelada', r.revelada)
        || case when r.revelada
             then jsonb_build_object('number', d.number) || private.bingo_titulo(v_set, d.number, false)
             else jsonb_build_object('number', null) end
        order by d.position)
      from public.bingo_draws d join public.bingo_songs bs on bs.set_id = v_set and bs.number = d.number
      cross join lateral (
        select d.revelada_at is not null or clock_timestamp() >= d.created_at + make_interval(secs => bs.duracion) as revelada
      ) r
      where d.block_id = b.id
    ), '[]'::jsonb)
  );
end $$;

-- Solo el proyector: el video de la última bolilla (sin el número: la función es pública).
create or replace function public.proyector_bingo(p_code text) returns jsonb
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
    select jsonb_build_object('id', d.id, 'at', d.created_at,
      'youtube_id', ci.content ->> 'youtube_id', 'inicio', bs.inicio, 'duracion', bs.duracion)
    from public.bingo_draws d
    join public.bingo_songs bs on bs.set_id = (b.config ->> 'bingo_set')::uuid and bs.number = d.number
    join public.catalog_items ci on ci.id = bs.catalog_item_id
    where d.block_id = b.id order by d.position desc limit 1
  );
end $$;
