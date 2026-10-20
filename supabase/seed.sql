-- Datos iniciales: admins y la noche de ejemplo NAUDIR3.
-- Idempotente: se puede correr más de una vez sin duplicar (ids fijos + on conflict).

insert into public.admins (email) values
  ('jorgeitamar@gmail.com'),
  ('nataliaparatore@gmail.com')
on conflict do nothing;

insert into public.tags (id, name, kind) values
  ('00000000-0000-4000-a000-000000000001', 'variada', 'tematica')
on conflict do nothing;

-- Catálogo de ejemplo (pregunta_opciones). Las soluciones van en catalog_solutions, nunca en content.
insert into public.catalog_items (id, type, content, difficulty) values
  ('00000000-0000-4000-b000-000000000001', 'pregunta_opciones',
   '{"texto": "¿Cuántas fichas tiene un dominó clásico?", "opciones": ["28", "32", "24", "36"]}', 'facil'),
  ('00000000-0000-4000-b000-000000000002', 'pregunta_opciones',
   '{"texto": "¿Cuántas caras tiene un dado común?", "opciones": ["4", "6", "8", "12"]}', 'facil'),
  ('00000000-0000-4000-b000-000000000003', 'pregunta_opciones',
   '{"texto": "¿En qué año se jugó el primer Mundial de fútbol?", "opciones": ["1924", "1930", "1934", "1950"]}', 'media'),
  ('00000000-0000-4000-b000-000000000004', 'pregunta_opciones',
   '{"texto": "¿Cuál es el río más largo de Sudamérica?", "opciones": ["Paraná", "Orinoco", "Amazonas", "Uruguay"]}', 'facil'),
  ('00000000-0000-4000-b000-000000000005', 'pregunta_opciones',
   '{"texto": "¿Cuántas casillas tiene un tablero de ajedrez?", "opciones": ["49", "64", "81", "100"]}', 'facil')
on conflict do nothing;

insert into public.catalog_solutions (item_id, solution) values
  ('00000000-0000-4000-b000-000000000001', '{"correcta": 0, "explicacion": "Doble seis: 28 fichas."}'),
  ('00000000-0000-4000-b000-000000000002', '{"correcta": 1, "explicacion": "Un cubo tiene 6 caras."}'),
  ('00000000-0000-4000-b000-000000000003', '{"correcta": 1, "explicacion": "Uruguay 1930, y lo ganó el local."}'),
  ('00000000-0000-4000-b000-000000000004', '{"correcta": 2, "explicacion": "El Amazonas, con unos 7.000 km."}'),
  ('00000000-0000-4000-b000-000000000005', '{"correcta": 1, "explicacion": "8 × 8 = 64 casillas."}')
on conflict do nothing;

insert into public.item_tags (item_id, tag_id)
select id, '00000000-0000-4000-a000-000000000001' from public.catalog_items
where id::text like '00000000-0000-4000-b000-%'
on conflict do nothing;

-- La noche (el trigger crea su live_state en portada).
insert into public.events (id, name, date, venue, code, status, settings) values
  ('00000000-0000-4000-c000-000000000001', 'Noche de Juegos en Naudir', '2026-10-23', 'Naudir', 'NAUDIR3', 'listo',
   '{"edicion": "3ra Edición"}')
on conflict do nothing;

insert into public.event_blocks (id, event_id, position, dynamic, title, multiplier, is_practice, config) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', 1, 'trivia',
   'Ronda de práctica', 1, true, '{"timer_seconds": 20}'),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000001', 2, 'trivia',
   'Trivia', 1, false, '{"timer_seconds": 30}')
on conflict do nothing;

insert into public.block_items (id, block_id, position, catalog_item_id) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001', 1, '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-d000-000000000001', 2, '00000000-0000-4000-b000-000000000002'),
  ('00000000-0000-4000-e000-000000000003', '00000000-0000-4000-d000-000000000002', 1, '00000000-0000-4000-b000-000000000003'),
  ('00000000-0000-4000-e000-000000000004', '00000000-0000-4000-d000-000000000002', 2, '00000000-0000-4000-b000-000000000004'),
  ('00000000-0000-4000-e000-000000000005', '00000000-0000-4000-d000-000000000002', 3, '00000000-0000-4000-b000-000000000005')
on conflict do nothing;
