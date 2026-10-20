-- Paso 8: ranking en vivo (con posiciones previas para las flechas), puntos manuales y anulaciones.

-- ============================================================
-- Revelar: además guarda en revealed las posiciones del ranking ANTES de sumar (para las flechas ▲▼).
-- ============================================================

create or replace function public.admin_reveal(p_event_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  ls public.live_state;
  b public.event_blocks;
  v_item_id uuid;
  v_solution jsonb;
  v_puntos jsonb;
  v_antes jsonb;
begin
  ls := private.live_para_operar(p_event_id);
  if ls.phase = 'item_revealed' then
    return;
  end if;
  if ls.phase <> 'item_closed' then
    raise exception 'Primero cerrá las respuestas.';
  end if;

  select * into b from public.event_blocks where id = ls.block_id;
  select bi.catalog_item_id into v_item_id from public.block_items bi where bi.id = ls.block_item_id;
  select cs.solution into v_solution from public.catalog_solutions cs where cs.item_id = v_item_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', s.team_id, 'name', t.name,
      'points', round(s.points * b.multiplier)::int, 'detail', s.detail
    ) order by s.points desc, lower(t.name)), '[]'::jsonb)
  into v_puntos
  from private.score_item(ls.block_item_id) s
  join public.teams t on t.id = s.team_id;

  select coalesce(jsonb_object_agg(r.team_id, r.position), '{}'::jsonb)
  into v_antes
  from public.ranking r
  where r.event_id = p_event_id;

  if not b.is_practice then
    insert into public.score_entries (event_id, team_id, block_id, block_item_id, points, reason, origin)
    select p_event_id, x.team_id, b.id, ls.block_item_id, x.points, b.title, 'auto'
    from jsonb_to_recordset(v_puntos) as x (team_id uuid, points int)
    on conflict (block_item_id, team_id) where origin = 'auto' do update set points = excluded.points;
  end if;

  update public.catalog_items
  set used_in_events = array_append(used_in_events, p_event_id)
  where id = v_item_id and not (p_event_id = any (used_in_events));

  update public.live_state
  set phase = 'item_revealed',
      revealed = jsonb_build_object(
        'block_item_id', ls.block_item_id,
        'solution', coalesce(v_solution, '{}'::jsonb),
        'points', v_puntos,
        'practice', b.is_practice,
        'ranking_antes', v_antes
      )
  where event_id = p_event_id;
end $$;

-- ============================================================
-- Puntos manuales y anulaciones (cualquier momento de la noche, también después de terminarla).
-- ============================================================

create function public.admin_manual_points(p_event_id uuid, p_team_id uuid, p_points int, p_reason text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.teams where id = p_team_id and event_id = p_event_id) then
    raise exception 'Esa mesa no es de esta noche.' using errcode = 'P0002';
  end if;
  if p_points is null or p_points = 0 or abs(p_points) > 10000 then
    raise exception 'Los puntos tienen que ser distintos de 0 y estar entre −10.000 y 10.000.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 2 or char_length(p_reason) > 200 then
    raise exception 'Escribí un motivo (entre 2 y 200 caracteres).';
  end if;
  insert into public.score_entries (event_id, team_id, points, reason, origin)
  values (p_event_id, p_team_id, p_points, btrim(p_reason), 'manual');
end $$;

create function private.marcar_anulado(p_entry_id uuid, p_voided boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.score_entries set voided = p_voided where id = p_entry_id;
  if not found then
    raise exception 'No encontramos ese movimiento de puntos.' using errcode = 'P0002';
  end if;
end $$;

create function public.admin_void_entry(p_entry_id uuid) returns void
language sql volatile security definer set search_path = '' as $$
  select private.marcar_anulado(p_entry_id, true);
$$;

create function public.admin_unvoid_entry(p_entry_id uuid) returns void
language sql volatile security definer set search_path = '' as $$
  select private.marcar_anulado(p_entry_id, false);
$$;

-- ============================================================
-- get_live: suma el ranking de la noche (y los puntos de cada mesa en el bloque actual).
-- ============================================================

create or replace function public.get_live(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  b public.event_blocks;
  v_block jsonb;
  v_item jsonb;
  v_answered jsonb := '[]'::jsonb;
  v_teams jsonb;
  v_ranking jsonb;
begin
  e := private.event_by_code(p_code);
  select * into ls from public.live_state where event_id = e.id;

  if ls.block_id is not null then
    select * into b from public.event_blocks where id = ls.block_id;
    v_block := jsonb_build_object(
      'id', b.id, 'dynamic', b.dynamic, 'title', b.title, 'is_practice', b.is_practice,
      'multiplier', b.multiplier, 'position', b.position,
      'number', (select count(*) from public.event_blocks o where o.event_id = e.id and o.position <= b.position),
      'total_blocks', (select count(*) from public.event_blocks o where o.event_id = e.id),
      'total_items', (select count(*) from public.block_items i where i.block_id = b.id),
      'timer_seconds', b.config -> 'timer_seconds'
    );
  end if;

  if ls.block_item_id is not null then
    select jsonb_build_object(
      'block_item_id', p.block_item_id, 'position', p.position, 'number', p.number,
      'type', p.type, 'content', p.content
    ) into v_item
    from public.public_item p
    where p.event_id = e.id;
    select coalesce(jsonb_agg(a.team_id), '[]'::jsonb) into v_answered
    from public.answers a
    where a.block_item_id = ls.block_item_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'connected', coalesce(t.last_seen > now() - interval '30 seconds', false)
    ) order by t.created_at), '[]'::jsonb)
  into v_teams
  from public.teams t
  where t.event_id = e.id and t.active;

  select coalesce(jsonb_agg(jsonb_build_object(
      'team_id', r.team_id, 'name', r.name, 'total', r.total, 'position', r.position,
      'block_total', coalesce(bb.total, 0)
    ) order by r.position), '[]'::jsonb)
  into v_ranking
  from public.ranking r
  left join public.ranking_by_block bb on bb.team_id = r.team_id and bb.block_id = ls.block_id
  where r.event_id = e.id;

  return jsonb_build_object(
    'server_now', now(),
    'event', private.event_json(e),
    'phase', coalesce(ls.phase, 'cover'),
    'opened_at', ls.opened_at,
    'timer_seconds', ls.timer_seconds,
    'extra_seconds', coalesce(ls.extra_seconds, 0),
    'updated_at', ls.updated_at,
    'revealed', case when ls.phase = 'item_revealed' then ls.revealed end,
    'block', v_block,
    'item', v_item,
    'answers_count', jsonb_array_length(v_answered),
    'answered', v_answered,
    'teams_count', jsonb_array_length(v_teams),
    'teams', v_teams,
    'ranking', v_ranking
  );
end $$;

grant execute on function public.admin_manual_points(uuid, uuid, int, text) to authenticated;
grant execute on function public.admin_void_entry(uuid) to authenticated;
grant execute on function public.admin_unvoid_entry(uuid) to authenticated;
