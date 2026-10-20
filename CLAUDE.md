# Familia Lúdica — plataforma de noches de juegos (MVP)

Especificación completa: [docs/SPEC.md](docs/SPEC.md). Servicios externos (Supabase, Google, Vercel): [docs/CONFIGURACION.md](docs/CONFIGURACION.md). Decisiones no cubiertas por la spec: [docs/DECISIONES.md](docs/DECISIONES.md).
Si algo cambia, actualizar **este archivo y docs/SPEC.md**.

## Contexto

- Evento real: **viernes 23/10/2026**, ~15 mesas (máx. 30). Un solo evento a la vez. Internet hogareña.
- Prioridad: **robustez y simplicidad** por sobre generalidad. Nada fuera de la spec sin preguntar.
- Tres pantallas: **proyector** `/pantalla/:codigo` (protagonista), **celular de mesa** `/jugar/:codigo` (solo controles), **conductor** `/admin/*`.

## Forma de trabajo

- Un paso de la sección 9 de la spec por vez. Al terminar: build + lint + tests/scripts → commit en español (`paso N: ...`) → frenar y explicar cómo verificar. No seguir sin "OK, seguí".
- Decisión que bloquea → preguntar. Que no bloquea → la más simple, anotada en `docs/DECISIONES.md`.
- **Nunca** la clave `service_role` de Supabase en el frontend ni en el repo.

## Stack (no cambiar)

- React 18 + TypeScript estricto + Vite, React Router, Tailwind CSS 3 (`tailwind.config.ts`).
- Supabase (Postgres + RLS + RPC + Realtime + Auth Google + Storage). **Sin servidor propio.** `@supabase/supabase-js` v2.
- `qrcode` en el navegador. YouTube IFrame Player API.
- Migraciones: `supabase/migrations/*.sql`; seeds: `supabase/seed.sql`.
- Deploy: Vercel desde GitHub (`main` = producción). `vercel.json` reescribe todo a `/index.html`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` en `.env.local` (ignorado); plantilla en `.env.example`.
- Tests: Vitest para funciones puras. SQL: scripts en `scripts/` con la clave anon.

## Comandos

- `npm run dev` · `npm run build` (tsc + vite, sin warnings de TS) · `npm run lint` · `npm test`
- `npm run db:push` → aplica migraciones + seed al proyecto Supabase vinculado (`gmpcnupjzqqfjkbywzet`). Requiere `supabase login` y `supabase link` hechos por el usuario (pide contraseña de la base).
- `npm run verificar:rls` → script con la clave anon que confirma lo que se puede y no se puede hacer.
- No hay Docker: las migraciones nuevas se prueban antes en PGlite (Postgres embebido) con roles `anon`/`authenticated` y `auth.jwt()` simulados.

## Reglas para migraciones nuevas

- Por defecto nada queda abierto: la migración inicial revoca los privilegios por defecto de tablas y funciones. Cada vista pública o RPC necesita su `grant select` / `grant execute ... to anon, authenticated` explícito.
- Tabla nueva → `enable row level security` + política `admin_lee_<tabla>` (select para `is_admin()`).
- Funciones internas en el esquema `private` (no expuesto). RPC con `security definer set search_path = ''` y nombres calificados (`public.x`).
- Errores con `raise exception` en español (qué pasó y qué hacer); la app los muestra tal cual.

## Marca

| Token Tailwind | Var CSS | Hex | Uso |
|---|---|---|---|
| `naranja` | `--fl-naranja` | `#EC681B` | botones principales, acentos, puntajes |
| `azul` | `--fl-azul` | `#1166AB` | fondo del proyector, barras |
| `celeste` | `--fl-celeste` | `#3FC0F0` | detalles, progreso, "nuevo" |
| `profundo` | `--fl-profundo` | `#173F63` | texto, tarjetas oscuras |
| `crema` | `--fl-crema` | `#FFF8F2` | fondos de celular, tarjetas claras |
| `amarillo` | `--fl-amarillo` | `#F4D35E` | solo 1er puesto y títulos destacados (<5%) |

- Fuentes: **Fredoka** 500/600/700 (`font-titulo`), **Nunito Sans** 400/600/700/800 (`font-texto`, default).
- Reglas completas de marca para la app: [docs/MARCA.md](docs/MARCA.md) (extraídas del manual de identidad).
- Logo `public/brand/logo.png` (oficial, 151×155, transparente): **siempre sobre panel blanco/crema**, nunca sobre azul o foto. Usar `<Logo className="w-…" />`: **≥ 140 px de ancho**, sin rotar (si la tarjeta va inclinada, compensar el giro), sin sombras ni efectos, no recrearlo con tipografía. Más chico que eso → el nombre "Familia Lúdica" en texto.
- Idea rectora: "Conectamos personas a través del juego." · Instagram @familia.ludica.
- Proyector: escenario 16:9 pensado a 1920×1080, escala con `cqw` (el escenario es un container). Consigna ≥ 4cqw. Patrón de puntos sutil (`.fondo-puntos`).
- Celular: botones ≥ 48 px, un foco por pantalla, mesa + PIN siempre visibles arriba.
- Respetar `prefers-reduced-motion`.
- UI en **español rioplatense** ("Escaneá", "Elegí"), cercano, nunca infantil. Errores en español: qué pasó y qué hacer.

## Seguridad (obligatorio)

- RLS en **todas** las tablas. `anon` sin SELECT directo a tablas sensibles: solo vistas públicas o funciones `security definer`.
- `is_admin()` = email del JWT en tabla `admins` (jorgeitamar@gmail.com, nataliaparatore@gmail.com). Toda RPC `admin_*` la verifica primero.
- `catalog_solutions` sin ningún acceso público; la solución pasa a `live_state.revealed` recién en `admin_reveal`.
- `youtube_id` solo vía `proyector_media(code)` y solo en fases `item_open`/`item_closed`/`item_revealed` del ítem actual. Los celulares nunca lo reciben.
- Respuestas de otras mesas nunca visibles (el proyector solo sabe **quién** respondió).
- RPC de mesa identifican por `token`, nunca por `team_id` del cliente. Validar todo input (longitudes, rangos, fase).
- Nada de lógica de puntaje en el frontend (solo presentación).

## Modelo de datos (resumen; detalle en SPEC §5)

- Preparación: `admins`, `tags`, `catalog_items` (type, content jsonb, status, difficulty…), `item_tags`, `catalog_solutions`, `events` (code único, status), `event_blocks` (dynamic, multiplier, is_practice, config), `block_items`.
- Ejecución: `teams` (token uuid secreto, pin 4 dígitos, last_seen), `live_state` (phase ∈ cover, block_intro, item_open, item_closed, item_revealed, block_ranking, final), `answers` (unique block_item+team, validation jsonb), `score_entries` (origin auto/manual, voided).
- Vistas: `public_teams`, `ranking`, `ranking_by_block`, `public_item`, `answered_teams`.
- Tipos de ítem: `pregunta_opciones`, `pregunta_numerica`, `pista_audio`, `clip_video`, `trio_verdad_mentira`.
- Dinámicas: `trivia`, `dos_verdades`, `aproximaciones`, `hipster`. Hasta 1.000 pts/ítem × multiplicador.

## Convenciones de código

- Nombres en inglés en la base; textos visibles en español.
- Dinámicas en `src/dynamics/<clave>/` (`meta.ts`, `ProjectorOpen.tsx`, `ProjectorReveal.tsx`, `PhoneInput.tsx`, `validate.ts`) + `score_<clave>()` en SQL. El motor no conoce detalles de cada dinámica.
- Componentes chicos. Layouts en `src/layouts/`, páginas en `src/pages/`, piezas compartidas en `src/components/`.
- Toda pantalla se recupera sola de: recarga, pérdida de Realtime, pestaña en segundo plano, reloj desfasado.
