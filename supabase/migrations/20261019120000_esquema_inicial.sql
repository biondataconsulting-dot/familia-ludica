-- Paso 2: esquema inicial de Familia Lúdica.
-- Seguridad: RLS en todas las tablas; anon y authenticated no tienen permisos directos sobre tablas.
-- El público lee solo por vistas públicas y funciones security definer; los admins leen por RLS (is_admin()).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Nada nuevo queda abierto por defecto: cada tabla, vista o función se habilita explícitamente.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Funciones internas, fuera del esquema expuesto por la API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ============================================================
-- Preparación
-- ============================================================

create table public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  kind text not null default 'otro' check (kind in ('tematica', 'ocasion', 'publico', 'otro')),
  created_at timestamptz not null default now()
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'pregunta_opciones', 'pregunta_numerica', 'pista_audio', 'clip_video', 'trio_verdad_mentira'
  )),
  content jsonb not null default '{}',
  status text not null default 'aprobado' check (status in ('borrador', 'sugerido', 'aprobado')),
  difficulty text,
  decade int,
  source text,
  used_in_events uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.item_tags (
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

-- Sin ningún acceso público. La solución pasa a live_state.revealed recién en admin_reveal.
create table public.catalog_solutions (
  item_id uuid primary key references public.catalog_items (id) on delete cascade,
  solution jsonb not null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  date date,
  venue text,
  code text not null unique check (code ~ '^[A-Z0-9]{3,12}$'),
  status text not null default 'borrador' check (status in ('borrador', 'listo', 'en_vivo', 'terminado')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.event_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position int not null,
  dynamic text not null check (dynamic in ('trivia', 'dos_verdades', 'aproximaciones', 'hipster')),
  title text not null check (char_length(title) between 1 and 80),
  multiplier numeric not null default 1 check (multiplier > 0 and multiplier <= 10),
  is_practice boolean not null default false,
  config jsonb not null default '{}', -- { "timer_seconds": 30 } = tiempo sugerido por ítem
  created_at timestamptz not null default now()
);
create index event_blocks_event_idx on public.event_blocks (event_id, position);

create table public.block_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.event_blocks (id) on delete cascade,
  position int not null,
  catalog_item_id uuid not null references public.catalog_items (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index block_items_block_idx on public.block_items (block_id, position);

-- ============================================================
-- Ejecución
-- ============================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 24),
  token uuid not null unique default gen_random_uuid(),
  pin text not null check (pin ~ '^[0-9]{4}$'),
  last_seen timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Nombre único por evento, sin distinguir mayúsculas.
create unique index teams_event_name_key on public.teams (event_id, lower(btrim(name)));

create table public.live_state (
  event_id uuid primary key references public.events (id) on delete cascade,
  phase text not null default 'cover' check (phase in (
    'cover', 'block_intro', 'item_open', 'item_closed', 'item_revealed', 'block_ranking', 'final'
  )),
  block_id uuid references public.event_blocks (id) on delete set null,
  block_item_id uuid references public.block_items (id) on delete set null,
  opened_at timestamptz,
  timer_seconds int check (timer_seconds between 5 and 3600),
  extra_seconds int not null default 0 check (extra_seconds between 0 and 3600),
  revealed jsonb,
  updated_at timestamptz not null default now()
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  block_item_id uuid not null references public.block_items (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  answer jsonb not null,
  submitted_at timestamptz not null default now(),
  validation jsonb not null default '{}', -- por campo: auto_ok | auto_no | dudosa | aceptada | rechazada
  created_at timestamptz not null default now(),
  unique (block_item_id, team_id)
);
create index answers_event_idx on public.answers (event_id);

create table public.score_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  block_id uuid references public.event_blocks (id) on delete set null,
  block_item_id uuid references public.block_items (id) on delete set null,
  points int not null,
  reason text not null check (char_length(reason) between 1 and 200),
  origin text not null check (origin in ('auto', 'manual')),
  voided boolean not null default false,
  created_at timestamptz not null default now()
);
create index score_entries_event_idx on public.score_entries (event_id, team_id);
-- Idempotencia de admin_reveal: un único puntaje automático por mesa e ítem.
create unique index score_entries_auto_key on public.score_entries (block_item_id, team_id) where origin = 'auto';

-- Cada evento nace con su live_state en portada.
create function private.crear_live_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.live_state (event_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger events_crear_live_state
  after insert on public.events
  for each row execute function private.crear_live_state();

-- ============================================================
-- Roles y RLS
-- ============================================================

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- RLS en todas las tablas. Única política: los admins leen todo. Las escrituras van por RPC admin_*.
do $$
declare
  t text;
begin
  foreach t in array array[
    'admins', 'tags', 'catalog_items', 'item_tags', 'catalog_solutions', 'events', 'event_blocks',
    'block_items', 'teams', 'live_state', 'answers', 'score_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_admin()))',
      'admin_lee_' || t, t
    );
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated; -- filtrado por RLS: solo admins ven filas

-- ============================================================
-- Vistas públicas (corren con permisos del dueño: exponen solo estas columnas)
-- ============================================================

-- Mesas sin token ni PIN.
create view public.public_teams as
select
  t.id,
  t.event_id,
  t.name,
  coalesce(t.last_seen > now() - interval '30 seconds', false) as connected
from public.teams t
where t.active;

-- Ranking de la noche: sin anulados ni bloques de práctica.
-- items_maximos = ítems donde la mesa obtuvo el puntaje más alto de ese ítem (y mayor que 0).
create view public.ranking as
with puntos as (
  select s.event_id, s.team_id, s.block_item_id, s.points
  from public.score_entries s
  left join public.event_blocks b on b.id = s.block_id
  where not s.voided and not coalesce(b.is_practice, false)
),
maximos as (
  select block_item_id, max(points) as max_points
  from puntos
  where block_item_id is not null
  group by block_item_id
),
totales as (
  select
    p.team_id,
    sum(p.points)::int as total,
    (count(*) filter (where p.points > 0 and p.points = m.max_points))::int as items_maximos
  from puntos p
  left join maximos m on m.block_item_id = p.block_item_id
  group by p.team_id
)
select
  t.event_id,
  t.id as team_id,
  t.name,
  coalesce(x.total, 0) as total,
  coalesce(x.items_maximos, 0) as items_maximos,
  row_number() over (
    partition by t.event_id
    order by coalesce(x.total, 0) desc, coalesce(x.items_maximos, 0) desc, lower(t.name)
  ) as position
from public.teams t
left join totales x on x.team_id = t.id
where t.active;

create view public.ranking_by_block as
select s.event_id, s.block_id, s.team_id, t.name, sum(s.points)::int as total
from public.score_entries s
join public.teams t on t.id = s.team_id
where not s.voided and s.block_id is not null
group by s.event_id, s.block_id, s.team_id, t.name;

-- Contenido público del ítem actual de cada evento: sin solución (vive en otra tabla) y sin youtube_id.
create view public.public_item as
select
  ls.event_id,
  bi.id as block_item_id,
  bi.block_id,
  bi.position,
  (select count(*) from public.block_items o where o.block_id = bi.block_id and o.position <= bi.position)::int as number,
  ci.type,
  ci.content - 'youtube_id' as content
from public.live_state ls
join public.block_items bi on bi.id = ls.block_item_id
join public.catalog_items ci on ci.id = bi.catalog_item_id;

-- Solo quién respondió, nunca qué.
create view public.answered_teams as
select a.event_id, a.block_item_id, a.team_id
from public.answers a;

grant select on public.public_teams, public.ranking, public.ranking_by_block, public.public_item, public.answered_teams
  to anon, authenticated;

-- ============================================================
-- Funciones públicas
-- ============================================================

create function private.event_by_code(p_code text) returns public.events
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
begin
  if p_code is null or char_length(p_code) > 20 then
    raise exception 'El código de la noche no es válido. Revisá el enlace o escaneá de nuevo el QR.'
      using errcode = 'P0002';
  end if;
  select * into e from public.events where code = upper(btrim(p_code));
  if not found then
    raise exception 'No encontramos ninguna noche con el código %. Revisá el enlace o escaneá de nuevo el QR.',
      upper(btrim(p_code)) using errcode = 'P0002';
  end if;
  return e;
end $$;

create function private.event_json(e public.events) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'name', e.name, 'date', e.date, 'venue', e.venue,
    'code', e.code, 'status', e.status, 'settings', e.settings
  );
$$;

create function public.get_event_public(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.event_json(private.event_by_code(p_code));
end $$;

-- Estado completo para proyector y celulares. server_now permite corregir el reloj del dispositivo.
create function public.get_live(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.events;
  ls public.live_state;
  b public.event_blocks;
  v_block jsonb;
  v_item jsonb;
  n_answers int := 0;
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
    select count(*) into n_answers from public.answers where block_item_id = ls.block_item_id;
  end if;

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
    'answers_count', n_answers,
    'teams_count', (select count(*) from public.teams t where t.event_id = e.id and t.active)
  );
end $$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_event_public(text) to anon, authenticated;
grant execute on function public.get_live(text) to anon, authenticated;
