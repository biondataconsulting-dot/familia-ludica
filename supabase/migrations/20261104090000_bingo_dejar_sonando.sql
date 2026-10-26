-- Bingo musical: el conductor puede dejar sonar la canción más allá de su duración («Dejar sonando», si la
-- gente está cantando a full) y cortarla cuando decide («Cortar»). El número y el título se revelan igual a la
-- duración establecida (o antes, con «Revelar ya» o al cortar).

alter table public.bingo_draws add column extendida boolean not null default false;
alter table public.bingo_draws add column cortada_at timestamptz;

-- La última bolilla del bingo en juego (para extenderla o cortarla).
create function private.bingo_ultima(p_event_id uuid) returns public.bingo_draws
language plpgsql stable security definer set search_path = '' as $$
declare
  b public.event_blocks;
  d public.bingo_draws;
begin
  b := private.bingo_en_juego(p_event_id);
  select * into d from public.bingo_draws where block_id = b.id order by position desc limit 1;
  if not found then
    raise exception 'Todavía no salió ninguna bolilla.';
  end if;
  return d;
end $$;

-- «Dejar sonando»: la canción sigue después de su duración, hasta que el conductor la corta.
create function public.admin_bingo_extender(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  d public.bingo_draws;
begin
  d := private.bingo_ultima(p_event_id);
  if d.cortada_at is not null then
    raise exception 'Esa canción ya se cortó.';
  end if;
  update public.bingo_draws set extendida = true where id = d.id;
end $$;

-- «Cortar»: la canción se corta ya (y, si todavía no se había revelado, se revela).
create function public.admin_bingo_cortar(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  d public.bingo_draws;
begin
  d := private.bingo_ultima(p_event_id);
  update public.bingo_draws
  set cortada_at = coalesce(cortada_at, clock_timestamp()), revelada_at = coalesce(revelada_at, clock_timestamp())
  where id = d.id;
end $$;

grant execute on function public.admin_bingo_extender(uuid) to authenticated;
grant execute on function public.admin_bingo_cortar(uuid) to authenticated;

-- Para proyector y celulares: además, si la canción se dejó sonando o se cortó.
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
        jsonb_build_object('position', d.position, 'at', d.created_at, 'duracion', bs.duracion, 'revelada', r.revelada,
          'extendida', d.extendida, 'cortada', d.cortada_at is not null)
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

-- Solo el proyector: además, si se dejó sonando o se cortó.
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
      'youtube_id', ci.content ->> 'youtube_id', 'inicio', bs.inicio, 'duracion', bs.duracion,
      'extendida', d.extendida, 'cortada', d.cortada_at is not null)
    from public.bingo_draws d
    join public.bingo_songs bs on bs.set_id = (b.config ->> 'bingo_set')::uuid and bs.number = d.number
    join public.catalog_items ci on ci.id = bs.catalog_item_id
    where d.block_id = b.id order by d.position desc limit 1
  );
end $$;
