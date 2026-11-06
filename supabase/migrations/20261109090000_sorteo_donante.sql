-- Sorteo: «Lo donó». Si sale quien donó el premio, ese premio se vuelve a sortear y la persona sigue en la
-- ruleta para los demás premios (solo queda afuera del que donó). La tirada queda con estado 'donante'.

alter table public.raffle_draws drop constraint raffle_draws_estado_check;
alter table public.raffle_draws add constraint raffle_draws_estado_check check (estado in ('ganador', 'ausente', 'donante'));

-- «Lo donó»: solo el último que salió (como «No está»), pero sin sacarlo de la ruleta.
create function public.admin_sorteo_donante(p_draw_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  d public.raffle_draws;
begin
  perform private.require_admin();
  select * into d from public.raffle_draws where id = p_draw_id for update;
  if not found then
    raise exception 'No encontramos ese sorteo.' using errcode = 'P0002';
  end if;
  if d.estado <> 'ganador' then
    return;
  end if;
  if exists (select 1 from public.raffle_draws x where x.event_id = d.event_id and x.created_at > d.created_at) then
    raise exception 'Solo se puede marcar al último que salió.';
  end if;
  update public.raffle_draws set estado = 'donante' where id = d.id;
end $$;

create or replace function public.admin_sorteo_sortear(p_event_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_premio public.raffle_prizes;
  v_ultimo timestamptz;
  v_part uuid;
  v_id uuid;
begin
  perform private.require_admin();
  select * into ls from public.live_state where event_id = p_event_id for update;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  select * into b from public.event_blocks where id = ls.block_id;
  if ls.phase <> 'block_intro' or coalesce(b.dynamic, '') <> 'sorteo' then
    raise exception 'Para sortear, presentá el bloque del sorteo.';
  end if;
  select max(created_at) into v_ultimo from public.raffle_draws where event_id = p_event_id;
  if v_ultimo is not null and clock_timestamp() < v_ultimo + make_interval(secs => private.sorteo_giro_segundos()) then
    raise exception 'Esperá a que termine de girar la ruleta.';
  end if;
  select * into v_premio from public.raffle_prizes pr
  where pr.event_id = p_event_id
    and not exists (select 1 from public.raffle_draws d where d.prize_id = pr.id and d.estado = 'ganador')
  order by pr.position
  limit 1;
  if not found then
    raise exception 'Ya se sortearon todos los premios.';
  end if;
  select p.id into v_part from public.raffle_participants p
  where p.event_id = p_event_id and not p.ausente
    and not exists (select 1 from public.raffle_draws d where d.participant_id = p.id and d.estado = 'ganador')
    and not exists (select 1 from public.raffle_draws d where d.participant_id = p.id and d.prize_id = v_premio.id and d.estado = 'donante')
  order by random()
  limit 1;
  if v_part is null then
    raise exception 'No quedan participantes para sortear.';
  end if;
  insert into public.raffle_draws (event_id, prize_id, participant_id) values (p_event_id, v_premio.id, v_part)
  returning id into v_id;
  return jsonb_build_object('draw_id', v_id, 'premio', v_premio.nombre);
end $$;

create or replace function public.get_sorteo(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  v_ultimo jsonb;
  v_ultimo_part uuid;
  v_proximo uuid;
begin
  e := private.event_by_code(p_code);
  -- Premio que se sortea ahora (el primero sin ganador): su donante no está en la ruleta.
  select pr.id into v_proximo from public.raffle_prizes pr
  where pr.event_id = e.id and not exists (select 1 from public.raffle_draws d where d.prize_id = pr.id and d.estado = 'ganador')
  order by pr.position limit 1;
  select jsonb_build_object(
      'id', d.id, 'premio_id', d.prize_id, 'nombre', p.nombre, 'dato', p.dato, 'estado', d.estado,
      'at', d.created_at, 'participante_id', p.id
    ), p.id
  into v_ultimo, v_ultimo_part
  from public.raffle_draws d join public.raffle_participants p on p.id = d.participant_id
  where d.event_id = e.id
  order by d.created_at desc
  limit 1;
  return jsonb_build_object(
    'server_now', clock_timestamp(),
    'giro_segundos', private.sorteo_giro_segundos(),
    'premios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'nombre', pr.nombre, 'imagen', pr.imagen,
        'ganador', (
          select jsonb_build_object('nombre', p.nombre, 'dato', p.dato)
          from public.raffle_draws d join public.raffle_participants p on p.id = d.participant_id
          where d.prize_id = pr.id and d.estado = 'ganador'
        )
      ) order by pr.position)
      from public.raffle_prizes pr where pr.event_id = e.id
    ), '[]'::jsonb),
    -- La ruleta: los que todavía pueden salir (sin el donante del premio que se sortea), más el último que salió (para que la ruleta caiga en él).
    'rueda', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'dato', p.dato) order by p.created_at, p.id)
      from public.raffle_participants p
      where p.event_id = e.id
        and (p.id = v_ultimo_part or (
          not p.ausente and not exists (select 1 from public.raffle_draws d where d.participant_id = p.id and d.estado = 'ganador')
          and not exists (select 1 from public.raffle_draws d where d.participant_id = p.id and d.prize_id = v_proximo and d.estado = 'donante')
        ))
    ), '[]'::jsonb),
    'participantes', (select count(*) from public.raffle_participants where event_id = e.id),
    'ultimo', v_ultimo
  );
end $$;

grant execute on function public.admin_sorteo_donante(uuid) to authenticated;
