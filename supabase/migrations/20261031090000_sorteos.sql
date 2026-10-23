-- Módulo de sorteos (pedido del 23/10). Opcional por noche: se activa al agregar el bloque "Sorteo" (uno
-- solo por noche). Participantes cargados a mano o pegados desde Excel (nombre + lote, entrada o últimos 3
-- del documento), premios en orden (3 a 5). En el bloque, el conductor sortea de a un premio: la base elige
-- al azar entre los que no ganaron ni están ausentes y lo registra; la pantalla solo muestra la ruleta
-- cayendo en ese resultado. "No está": el ganador sale de la ruleta por el resto de la noche y el mismo
-- premio se vuelve a sortear. Nadie gana dos veces.

alter table public.event_blocks drop constraint event_blocks_dynamic_check;
alter table public.event_blocks add constraint event_blocks_dynamic_check
  check (dynamic in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial', 'sorteo'));

create table public.raffle_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  dato text check (char_length(dato) <= 40),
  ausente boolean not null default false,
  created_at timestamptz not null default now()
);
create index raffle_participants_event on public.raffle_participants (event_id);

create table public.raffle_prizes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position int not null,
  nombre text not null check (char_length(nombre) between 1 and 80),
  imagen text check (char_length(imagen) <= 500),
  created_at timestamptz not null default now()
);

-- Cada tirada de la ruleta: quién salió para qué premio y si estaba ("ganador") o no ("ausente").
create table public.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  prize_id uuid not null references public.raffle_prizes (id) on delete cascade,
  participant_id uuid not null references public.raffle_participants (id) on delete cascade,
  estado text not null default 'ganador' check (estado in ('ganador', 'ausente')),
  created_at timestamptz not null default clock_timestamp()
);

alter table public.raffle_participants enable row level security;
alter table public.raffle_prizes enable row level security;
alter table public.raffle_draws enable row level security;
create policy admin_lee_raffle_participants on public.raffle_participants for select to authenticated using ((select public.is_admin()));
create policy admin_lee_raffle_prizes on public.raffle_prizes for select to authenticated using ((select public.is_admin()));
create policy admin_lee_raffle_draws on public.raffle_draws for select to authenticated using ((select public.is_admin()));
grant select on public.raffle_participants, public.raffle_prizes, public.raffle_draws to authenticated;

create trigger raffle_participants_avisar after insert or update or delete on public.raffle_participants
  for each row execute function private.avisar_cambio();
create trigger raffle_prizes_avisar after insert or update or delete on public.raffle_prizes
  for each row execute function private.avisar_cambio();
create trigger raffle_draws_avisar after insert or update or delete on public.raffle_draws
  for each row execute function private.avisar_cambio();

-- Duración de la ruleta en pantalla: hasta que no termina, no se puede volver a sortear.
create function private.sorteo_giro_segundos() returns int language sql immutable as $$ select 9 $$;

-- ============================================================
-- Participantes y premios (Armar; también en vivo)
-- ============================================================

-- Agrega participantes en lote: p_lista = [{nombre, dato?}]. Devuelve cuántos agregó y los repetidos que salteó.
create function public.admin_sorteo_agregar(p_event_id uuid, p_lista jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  x jsonb;
  v_nombre text;
  v_dato text;
  v_agregados int := 0;
  v_repetidos jsonb := '[]'::jsonb;
begin
  perform private.require_admin();
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  if coalesce(jsonb_typeof(p_lista), '') <> 'array' or jsonb_array_length(p_lista) = 0 then
    raise exception 'No hay participantes para agregar.';
  end if;
  if jsonb_array_length(p_lista) > 2000 then
    raise exception 'Son demasiados de una vez (hasta 2.000).';
  end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    v_nombre := btrim(coalesce(x ->> 'nombre', ''));
    v_dato := nullif(btrim(coalesce(x ->> 'dato', '')), '');
    if v_nombre = '' then
      continue;
    end if;
    if char_length(v_nombre) > 80 or char_length(coalesce(v_dato, '')) > 40 then
      raise exception 'El nombre puede tener hasta 80 caracteres y el dato hasta 40 («%»).', left(v_nombre, 30);
    end if;
    if exists (
      select 1 from public.raffle_participants p
      where p.event_id = p_event_id and lower(p.nombre) = lower(v_nombre) and coalesce(lower(p.dato), '') = coalesce(lower(v_dato), '')
    ) then
      v_repetidos := v_repetidos || to_jsonb(v_nombre || coalesce(' · ' || v_dato, ''));
      continue;
    end if;
    insert into public.raffle_participants (event_id, nombre, dato) values (p_event_id, v_nombre, v_dato);
    v_agregados := v_agregados + 1;
  end loop;
  return jsonb_build_object('agregados', v_agregados, 'repetidos', v_repetidos);
end $$;

create function public.admin_sorteo_quitar(p_participant_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.raffle_draws where participant_id = p_participant_id and estado = 'ganador') then
    raise exception 'Ya ganó un premio: no se puede sacar de la lista.';
  end if;
  delete from public.raffle_participants where id = p_participant_id;
end $$;

-- Vacía la lista (solo si todavía no se sorteó nada).
create function public.admin_sorteo_vaciar(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.raffle_draws where event_id = p_event_id) then
    raise exception 'Ya se sorteó: no se puede vaciar la lista. Para empezar de cero, reiniciá la noche.';
  end if;
  delete from public.raffle_participants where event_id = p_event_id;
end $$;

-- Alta o edición de un premio: p = {id?, event_id, nombre, imagen?}.
create function public.admin_sorteo_premio(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_event uuid := nullif(p ->> 'event_id', '')::uuid;
  v_nombre text := btrim(coalesce(p ->> 'nombre', ''));
  v_imagen text := nullif(btrim(coalesce(p ->> 'imagen', '')), '');
begin
  perform private.require_admin();
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 80 then
    raise exception 'El nombre del premio tiene que tener entre 1 y 80 caracteres.';
  end if;
  if char_length(coalesce(v_imagen, '')) > 500 then
    raise exception 'El enlace de la imagen es demasiado largo.';
  end if;
  if v_id is null then
    if not exists (select 1 from public.events where id = v_event) then
      raise exception 'No encontramos esa noche.' using errcode = 'P0002';
    end if;
    if (select count(*) from public.raffle_prizes where event_id = v_event) >= 10 then
      raise exception 'Hasta 10 premios por noche.';
    end if;
    insert into public.raffle_prizes (event_id, position, nombre, imagen)
    values (v_event, coalesce((select max(position) from public.raffle_prizes where event_id = v_event), 0) + 1, v_nombre, v_imagen)
    returning id into v_id;
  else
    update public.raffle_prizes set nombre = v_nombre, imagen = v_imagen where id = v_id;
    if not found then
      raise exception 'No encontramos ese premio.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

create function public.admin_sorteo_premio_borrar(p_prize_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if exists (select 1 from public.raffle_draws where prize_id = p_prize_id) then
    raise exception 'Ese premio ya se sorteó: no se puede borrar.';
  end if;
  delete from public.raffle_prizes where id = p_prize_id;
end $$;

-- Mueve un premio un lugar (-1 arriba, 1 abajo) en el orden del sorteo.
create function public.admin_sorteo_premio_mover(p_prize_id uuid, p_delta int) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  x public.raffle_prizes;
  y public.raffle_prizes;
begin
  perform private.require_admin();
  select * into x from public.raffle_prizes where id = p_prize_id;
  if not found then
    raise exception 'No encontramos ese premio.' using errcode = 'P0002';
  end if;
  select * into y from public.raffle_prizes
  where event_id = x.event_id and case when p_delta < 0 then position < x.position else position > x.position end
  order by case when p_delta < 0 then -position else position end
  limit 1;
  if found then
    update public.raffle_prizes set position = y.position where id = x.id;
    update public.raffle_prizes set position = x.position where id = y.id;
  end if;
end $$;

-- ============================================================
-- En vivo
-- ============================================================

-- Sortea el próximo premio sin ganador: la base elige al azar entre los que no ganaron ni están ausentes.
create function public.admin_sorteo_sortear(p_event_id uuid) returns jsonb
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
  order by random()
  limit 1;
  if v_part is null then
    raise exception 'No quedan participantes para sortear.';
  end if;
  insert into public.raffle_draws (event_id, prize_id, participant_id) values (p_event_id, v_premio.id, v_part)
  returning id into v_id;
  return jsonb_build_object('draw_id', v_id, 'premio', v_premio.nombre);
end $$;

-- "No está": el último ganador sale de la ruleta por el resto de la noche y su premio vuelve a sortearse.
create function public.admin_sorteo_ausente(p_draw_id uuid) returns void
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
    raise exception 'Solo se puede marcar como ausente al último que salió.';
  end if;
  update public.raffle_draws set estado = 'ausente' where id = d.id;
  update public.raffle_participants set ausente = true where id = d.participant_id;
end $$;

-- ============================================================
-- Pantallas (proyector y celulares): el estado del sorteo. Los nombres los ve todo el salón igual.
-- ============================================================

create function public.get_sorteo(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  v_ultimo jsonb;
  v_ultimo_part uuid;
begin
  e := private.event_by_code(p_code);
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
    -- La ruleta: los que todavía pueden salir, más el último que salió (para que la ruleta caiga en él).
    'rueda', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'dato', p.dato) order by p.created_at, p.id)
      from public.raffle_participants p
      where p.event_id = e.id
        and (p.id = v_ultimo_part or (
          not p.ausente and not exists (select 1 from public.raffle_draws d where d.participant_id = p.id and d.estado = 'ganador')
        ))
    ), '[]'::jsonb),
    'participantes', (select count(*) from public.raffle_participants where event_id = e.id),
    'ultimo', v_ultimo
  );
end $$;

grant execute on function public.admin_sorteo_agregar(uuid, jsonb) to authenticated;
grant execute on function public.admin_sorteo_quitar(uuid) to authenticated;
grant execute on function public.admin_sorteo_vaciar(uuid) to authenticated;
grant execute on function public.admin_sorteo_premio(jsonb) to authenticated;
grant execute on function public.admin_sorteo_premio_borrar(uuid) to authenticated;
grant execute on function public.admin_sorteo_premio_mover(uuid, int) to authenticated;
grant execute on function public.admin_sorteo_sortear(uuid) to authenticated;
grant execute on function public.admin_sorteo_ausente(uuid) to authenticated;
grant execute on function public.get_sorteo(text) to anon, authenticated;

-- admin_save_block (igual que antes) + bloque "sorteo" (uno solo por noche).
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
  if v_dynamic is null or v_dynamic not in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster', 'cine', 'imagen', 'oveja', 'especial', 'sorteo') then
    raise exception 'Elegí una dinámica: trivia, dos_verdades, aproximaciones, hipster, cine, imagen, oveja, especial o sorteo.';
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
    'emoji', nullif(btrim(coalesce(p ->> 'emoji', '')), '')
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
          (config - 'timer_seconds' - 'subtitulo' - 'imagen' - 'emoji') || v_extra
          || case when v_timer is null then '{}'::jsonb else jsonb_build_object('timer_seconds', v_timer) end
        )
    where id = v_id;
    if not found then
      raise exception 'No encontramos ese bloque.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

-- admin_next (igual que antes) + el bloque de sorteo, como el especial, pasa al bloque que sigue.
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
      if b.dynamic in ('especial', 'sorteo') then
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

-- admin_reset_event (igual que antes) + borra participantes y sorteos (los premios quedan).
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
      timer_seconds = null, extra_seconds = 0, revealed = null, show_qr = false, show_ranking = false, sonido_id = null
  where event_id = p_event_id;

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

-- admin_duplicate_event (igual que antes) + copia los premios (no los participantes).
create or replace function public.admin_duplicate_event(p_event_id uuid, p_name text, p_code text, p_date date default null)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  e public.events;
  v_id uuid;
  b record;
  v_bloque uuid;
begin
  perform private.require_admin();
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'No encontramos esa noche.' using errcode = 'P0002';
  end if;
  v_id := public.admin_save_event(jsonb_build_object(
    'name', p_name, 'code', p_code, 'date', p_date, 'venue', e.venue, 'edicion', e.settings ->> 'edicion', 'status', 'borrador'
  ));
  update public.events set settings = e.settings where id = v_id;
  for b in select * from public.event_blocks where event_id = p_event_id order by position loop
    insert into public.event_blocks (event_id, position, dynamic, title, multiplier, is_practice, config)
    values (v_id, b.position, b.dynamic, b.title, b.multiplier, b.is_practice, b.config)
    returning id into v_bloque;
    insert into public.block_items (block_id, position, catalog_item_id)
    select v_bloque, position, catalog_item_id from public.block_items where block_id = b.id;
  end loop;
  -- Misiones y desafíos: la lista, sin abrir ni lanzar.
  insert into public.event_extras (event_id, kind, position, title, description, points)
  select v_id, kind, position, title, description, points from public.event_extras where event_id = p_event_id;
  -- Premios del sorteo: la lista, sin participantes ni sorteos.
  insert into public.raffle_prizes (event_id, position, nombre, imagen)
  select v_id, position, nombre, imagen from public.raffle_prizes where event_id = p_event_id;
  return v_id;
end $$;
