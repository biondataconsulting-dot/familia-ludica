# Familia Lúdica: plataforma de noches de juegos (MVP)

> Pegá este archivo completo como primer mensaje en Claude Code, dentro del repo vacío `familia-ludica`.
> Para Claude Code: este documento es la especificación completa. No tenés acceso a otros documentos.

---

## 0. Cómo vamos a trabajar

- Construí **un paso por vez** (sección 9). Al terminar cada paso:
  1. corré lo que corresponda (build, lint, tests, script de verificación);
  2. hacé un commit con mensaje en español (`paso 3: login del conductor con Google`);
  3. **frená** y decime exactamente cómo verificarlo yo (qué abrir, qué tocar, qué debería ver).
  No empieces el paso siguiente hasta que te diga "OK, seguí".
- **Lo primero del paso 1** es crear `CLAUDE.md` en la raíz con un resumen de esta especificación (stack, reglas, modelo de datos, convenciones), y copiar este archivo a `docs/SPEC.md`. Mantené ambos actualizados si algo cambia.
- Toda la interfaz va en **español rioplatense** ("Escaneá", "Elegí", "Enviá"), con tono cercano y claro, nunca infantil.
- Plazo: el MVP se usa en un evento real el **viernes 23 de octubre de 2026** con ~15 mesas. Priorizá **robustez y simplicidad** por sobre generalidad. Nada de features fuera de esta especificación sin preguntarme.
- Si una decisión no está cubierta acá y bloquea, preguntame. Si no bloquea, tomá la opción más simple y anotala en `docs/DECISIONES.md`.
- Nunca pongas la clave `service_role` de Supabase en el frontend ni en el repo.

## 1. Qué es

Familia Lúdica organiza noches de juegos en salones y restaurantes. Durante la noche:

- **Proyector** (notebook conectada): la pantalla protagonista. Muestra QR de ingreso, consignas, imágenes, audio/video, temporizador, tablero de quién respondió, revelaciones y ranking.
- **Celular de cada mesa** (uno por mesa, vía QR): solo controles para responder. El estímulo está en el proyector.
- **Panel del conductor** (`/admin`, en otra pestaña de la notebook o en un celular): controla la noche y ve las soluciones.

Uso privado. Un solo evento a la vez. Hasta 30 mesas (normal: 10 a 20). Internet hogareña del lugar.

Una **noche (evento)** tiene **bloques** en orden; cada bloque es una **dinámica** con varios **ítems** tomados de un **catálogo** de contenido etiquetado.

## 2. Stack (no cambiar)

- Frontend: **React 18 + TypeScript + Vite**, **React Router**, **Tailwind CSS**.
- Backend: **Supabase** (Postgres + RLS + funciones RPC + Realtime + Auth + Storage). **No hay servidor propio.**
- Cliente: `@supabase/supabase-js` v2.
- QR: paquete `qrcode` (generado en el navegador).
- YouTube: IFrame Player API (cargada desde `https://www.youtube.com/iframe_api`).
- Migraciones: Supabase CLI, en `supabase/migrations/*.sql`. Seeds en `supabase/seed.sql`.
- Deploy: Vercel desde GitHub (`main` = producción). SPA: agregá `vercel.json` con rewrite de todas las rutas a `/index.html`.
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (en `.env.local`, ignorado por git; dejá `.env.example`).
- Tests: Vitest para funciones puras (normalización de texto, fórmulas). Para SQL, scripts de verificación en `scripts/` que usen la clave anon y confirmen lo que se puede y no se puede hacer.

## 3. Identidad visual (manual de marca)

Tokens en `tailwind.config` y en CSS variables:

| Token | Hex | Uso |
|---|---|---|
| naranja juego | `#EC681B` | botones principales, acentos, puntajes |
| azul confianza | `#1166AB` | fondo del proyector, barras |
| celeste conexión | `#3FC0F0` | detalles, progreso, "nuevo" |
| azul profundo | `#173F63` | texto, tarjetas oscuras |
| blanco cálido | `#FFF8F2` | fondos de celular, tarjetas claras |
| amarillo | `#F4D35E` | solo como fondo del primer puesto (<5%). **Nunca texto amarillo sobre azul** (preferencia del cliente) |

- Tipografías (Google Fonts): **Fredoka** 500/600/700 para títulos; **Nunito Sans** 400/600/700/800 para texto.
- Logo: `public/brand/logo.png` (lo copio yo). **Siempre sobre panel blanco o blanco cálido**, nunca directo sobre azul ni foto. No recrear el logo con tipografía.
- Formas redondeadas inspiradas en cartas y fichas; patrón sutil de puntos en el fondo del proyector.
- Proyector: diseñado para 16:9 a 1920×1080 y que escale (usar unidades de contenedor `cqw` o `vw`). Texto legible desde el fondo del salón: consigna ≥ 4% del ancho.
- Celular: botones grandes (≥ 48 px de alto), un solo foco por pantalla, nombre de la mesa + PIN siempre visibles arriba.
- Respetar `prefers-reduced-motion`.

## 4. Roles y seguridad

| Rol | Entrada | Lee | Escribe |
|---|---|---|---|
| Admin | `/admin` → "Entrar con Google" (Supabase Auth, proveedor Google). Solo emails presentes en la tabla `admins`: `jorgeitamar@gmail.com`, `nataliaparatore@gmail.com`, `bion.dataconsulting@gmail.com`. Otra cuenta ve "Sin acceso" y un botón "Salir". | Todo | Todo, vía RPC `admin_*` |
| Proyector | `/pantalla/:codigo` sin login | Estado público | Nada |
| Mesa | `/jugar/:codigo` sin login. Al registrarse recibe `token` (uuid secreto, guardado en `localStorage`) y `pin` (4 dígitos) | Estado público + su propia respuesta | Solo vía RPC con su token |

Reglas obligatorias:

- RLS activado en **todas** las tablas. `anon` no tiene SELECT directo sobre tablas sensibles: accede solo por **vistas públicas** o **funciones `security definer`** que filtran.
- Función `is_admin()` = `exists(select 1 from admins where email = auth.jwt()->>'email')`. Toda RPC `admin_*` empieza verificándola y lanza error si no.
- `catalog_solutions` **sin ningún acceso público**. La solución se copia a `live_state.revealed` recién en `admin_reveal`.
- El contenido público del ítem nunca contiene la solución. En ítems de YouTube, el `youtube_id` solo se expone a la pantalla del proyector a través de una función que lo devuelve **solo en fase `open`/`closed`/`revealed` del ítem actual**; los celulares no lo reciben.
- Las respuestas de otras mesas nunca son visibles para una mesa ni para el proyector (el proyector solo sabe **quién** respondió).
- Las RPC de mesa identifican la mesa por `token`, nunca por `team_id` enviado por el cliente.
- Validar todo input en las RPC (longitudes, rangos, fase correcta).

## 5. Modelo de datos

Nombres en inglés en la base, textos visibles en español. Todas las tablas con `id uuid default gen_random_uuid()` y `created_at timestamptz default now()` salvo que se indique.

**Preparación**

- `admins(email text primary key)`: seed con los dos emails.
- `tags(id, name text unique, kind text check in ('tematica','ocasion','publico','otro'))`
- `catalog_items(id, type text, content jsonb, status text check in ('borrador','sugerido','aprobado') default 'aprobado', difficulty text, decade int null, source text null, used_in_events uuid[] default '{}')`
  - `type` ∈ `pregunta_opciones`, `pregunta_numerica`, `pista_audio`, `clip_video`, `trio_verdad_mentira`. (Más tipos en el futuro: `imagen_adivinar`, `emojis`, `imagen_memoria`, `consigna_abierta`.)
- `item_tags(item_id, tag_id, primary key(item_id, tag_id))`
- `catalog_solutions(item_id primary key references catalog_items on delete cascade, solution jsonb)`
- `events(id, name text, date date, venue text, code text unique, status text check in ('borrador','listo','en_vivo','terminado'), settings jsonb default '{}')`
- `event_blocks(id, event_id, position int, dynamic text, title text, multiplier numeric default 1, is_practice bool default false, config jsonb default '{}')`
- `block_items(id, block_id, position int, catalog_item_id)`

**Ejecución**

- `teams(id, event_id, name text, token uuid unique default gen_random_uuid(), pin text, last_seen timestamptz, active bool default true)`; nombre único por evento (case-insensitive), 2 a 24 caracteres.
- `live_state(event_id primary key, phase text, block_id uuid null, block_item_id uuid null, opened_at timestamptz null, timer_seconds int null, extra_seconds int default 0, revealed jsonb null, updated_at timestamptz)`
  - `phase` ∈ `cover`, `block_intro`, `item_open`, `item_closed`, `item_revealed`, `block_ranking`, `final`.
- `answers(id, event_id, block_item_id, team_id, answer jsonb, submitted_at, validation jsonb default '{}', unique(block_item_id, team_id))`
  - `validation` guarda por campo: `auto_ok` | `auto_no` | `dudosa` | `aceptada` | `rechazada`.
- `score_entries(id, event_id, team_id, block_id null, block_item_id null, points int, reason text, origin text check in ('auto','manual'), voided bool default false)`

**Vistas**

- `public_teams` (id, event_id, name, connected = last_seen > now() - 30 s). Nunca expone token ni pin.
- `ranking` (event_id, team_id, name, total, items_maximos = cantidad de ítems donde obtuvo el máximo) excluyendo `voided` y bloques `is_practice`. Orden: total desc, items_maximos desc, nombre.
- `ranking_by_block` (event_id, block_id, team_id, name, total).
- `public_item` (contenido público del ítem actual: `content` sin solución y sin `youtube_id`).
- `answered_teams` (block_item_id, team_id): solo quién respondió.

### Formato de `content` y `solution` por tipo

```jsonc
// pregunta_opciones (Trivia)
content:  { "texto": "...", "opciones": ["A","B","C","D"], "imagen": "ruta/opcional.jpg" }
solution: { "correcta": 0, "explicacion": "texto opcional" }

// trio_verdad_mentira (Dos verdades y una mentira)
content:  { "afirmaciones": ["...","...","..."] }
solution: { "mentira": 2, "explicacion": "..." }

// pregunta_numerica (Aproximaciones)
content:  { "texto": "...", "unidad": "km", "imagen": null, "formato": "numero" }   // formato: numero | anio
solution: { "valor": 1234.5, "explicacion": "..." }

// pista_audio (Hitster) / clip_video (Cine y series; artista = director, obligatorio)
content:  { "youtube_id": "XXXXXXXXXXX", "inicio": 42, "duracion": 20, "categoria": "musica" } // musica | pelicula | serie | dibujo
solution: { "anio": 1986, "titulo": "...", "artista": "...",
            "variantes_titulo": ["..."], "variantes_artista": ["..."] }
```

Nota: `youtube_id` vive en `content` pero las vistas públicas lo quitan; solo `proyector_media(code)` lo devuelve (ver §4).

Cambio pedido por el cliente: **las canciones suenan siempre desde 0:00** (para que no suenen cortadas) durante `duracion` segundos. `inicio` se sigue aceptando al importar por compatibilidad, pero no se usa para reproducir (`proyector_media` devuelve `inicio = 0`).

## 6. Funciones (RPC)

**Públicas (mesa / proyector)**, todas `security definer`, validan código de evento:

- `get_event_public(code)` → nombre, fecha, venue, settings, estado.
- `get_live(code)` → `live_state` + bloque actual (dinámica, título, is_practice, posición, total de ítems) + ítem actual (`public_item`) + `revealed` + cantidad de respuestas.
- `proyector_media(code)` → `{youtube_id, inicio, duracion}` del ítem actual solo si es audio/video y la fase es `item_open`, `item_closed` o `item_revealed`.
- `join_team(code, name)` → `{team_id, token, pin, name}`. Error claro si el nombre ya existe ("Ese nombre ya está en uso. Si son ustedes, tocá «Ya estamos jugando»").
- `rejoin_team(code, team_id, pin)` → `{token, ...}`; máximo 5 intentos fallidos por mesa por minuto.
- `whoami(token)` → mesa + su respuesta al ítem actual.
- `heartbeat(token)` → actualiza `last_seen` (llamar cada 10 s).
- `submit_answer(token, block_item_id, answer)` → valida fase `item_open`, que el ítem sea el actual y la forma según la dinámica; hace upsert (se puede cambiar mientras esté abierto).

**Admin** (todas verifican `is_admin()` y la fase válida; ante fase inválida, error explicativo):

- `admin_start_event(event_id)` → status `en_vivo`, fase `cover`.
- `admin_start_block(event_id, block_id)` → `block_intro`.
- `admin_open_item(event_id, block_item_id, timer_seconds)` → `item_open`, `opened_at = now()`.
- `admin_add_time(event_id, seconds)` → suma a `extra_seconds`.
- `admin_close_item(event_id)` → `item_closed`; ejecuta la validación automática y calcula puntajes **provisorios** (no inserta en `score_entries` todavía).
- `admin_set_validation(answer_id, field, value)` → `aceptada` | `rechazada` para dudosas.
- `admin_reopen_item(event_id)` → vuelve a `item_open` (solo desde `item_closed`).
- `admin_reveal(event_id)` → recalcula con las validaciones finales, inserta `score_entries` (origen `auto`, × multiplicador del bloque; si `is_practice`, no inserta nada y guarda los puntos "hipotéticos" solo en `revealed`), copia la solución a `revealed` y pasa a `item_revealed`. Idempotente: si se llama dos veces no duplica puntos.
- `admin_next(event_id)` → desde `item_revealed`: si quedan ítems en el bloque, abre el siguiente (equivale a `admin_open_item` con el tiempo sugerido del bloque); si no quedan, pasa a `block_ranking`, o a `block_intro` del bloque siguiente si el bloque actual es de práctica. Desde `block_ranking`: `block_intro` del bloque siguiente, o `final` si no hay más.
- `admin_show_block_ranking(event_id)`, `admin_finish(event_id)` → `final` y status `terminado`.
- `admin_manual_points(event_id, team_id, points, reason)` → `score_entries` origen `manual`.
- `admin_void_entry(entry_id)` / `admin_unvoid_entry(entry_id)`.
- `admin_reset_event(event_id)` → borra answers, score_entries, teams y vuelve `live_state` a `cover` (para ensayos). Pide confirmación en la UI escribiendo el código del evento.
- `admin_list_teams(event_id)` → incluye PIN y conexión.

Toda RPC que cambie `live_state` actualiza `updated_at`.

## 7. Dinámicas (contrato)

En el frontend, `src/dynamics/<clave>/` con: `meta.ts` (clave, nombre visible, instrucción corta para proyector y celular, tipos aceptados), `ProjectorOpen.tsx`, `ProjectorReveal.tsx`, `PhoneInput.tsx`, `validate.ts`. En SQL, `score_<clave>(block_item_id)` que devuelve `(team_id, points, detail jsonb)`. El motor no conoce detalles de cada dinámica.

Puntaje base: **hasta 1.000 puntos por ítem**, multiplicado por `event_blocks.multiplier`. Empates: todas las mesas empatadas reciben lo mismo. Mesas sin respuesta: 0.

| Clave | Nombre visible | Tipo de objeto | Celular | Puntaje |
|---|---|---|---|---|
| `trivia` | Trivia | pregunta_opciones | Botones grandes con las opciones (A, B, C, D con colores distintos) | 1.000 si correcta, 0 si no |
| `dos_verdades` | Dos verdades y una mentira | trio_verdad_mentira | 3 botones con las afirmaciones resumidas ("1", "2", "3") | 1.000 si elige la mentira |
| `aproximaciones` | Aproximaciones | pregunta_numerica | Teclado numérico grande; si `formato = anio`, selector de año | d = abs(resp − valor). dmin = 1.000. Resto: `round(800 × (1 − (d − dmin)/(dmax − dmin)))`. La más lejana 0. Si dmax = dmin, todas 1.000 |
| `hipster` | Hitster musical | pista_audio | Año con − / + y teclado, título y artista opcionales | Año: `max(0, 600 − 75 × abs(diferencia))`. Título aceptado: +200. Artista aceptado: +200 |
| `imagen` | Adiviná la imagen (película con emojis, logo, ¿Qué ves?) | imagen_adivinar | Una respuesta escrita | Acierto (validado como el título de Hitster, con dudosas): 1.000 |
| `oveja` | Oveja Oveja (versión local de Herd Mentality) | pregunta_mayoria | Una respuesta escrita: lo que va a responder la mayoría | Grupo más numeroso: 1.000 cada mesa; si las más elegidas empatan o todas coinciden: nadie. Oveja negra (la única distinta): solo se muestra |
| `cine` | Cine y series | clip_video | Año con − / + y teclado, título y director opcionales | Igual que Hitster (el director va en `artista`, obligatorio en el ítem). La escena **se ve** en el proyector mientras se responde |

**Validación de texto (Hitster)**, en SQL con `pg_trgm` + `unaccent`, y una copia de la función de normalización en TS con tests:

1. normalizar: minúsculas, sin tildes, sin signos, espacios simples, quitar artículos iniciales (el, la, los, las, the, a, an).
2. comparar contra la solución y cada variante; tomar la mejor similitud.
3. similitud ≥ 0,75 → `auto_ok`; entre 0,45 y 0,75 → `dudosa`; < 0,45 → `auto_no`. Campo vacío → no suma, sin estado.
4. Las dudosas aparecen en el panel con **Aceptar / Rechazar**. Al revelar, una dudosa sin decidir cuenta como rechazada (avisar en el panel antes: "Quedan N dudosas").

**Ronda de práctica**: cualquier bloque con `is_practice = true`. Proyector y celular muestran el sello "Ronda de práctica · no suma puntos". Al revelar se muestran los puntos que habrían sumado, pero no se registran ni hay ranking de bloque.

## 8. Pantallas

### 8.1 Proyector `/pantalla/:codigo`

Primera vez: botón grande "Comenzar la noche" (habilita audio del navegador y pide pantalla completa; ambos opcionales si fallan). Luego, según `phase`:

- `cover`: título de la noche (Fredoka grande, blanco sobre azul con una línea naranja debajo), "3ra Edición" como sello, fecha; tarjeta blanca inclinada con logo, QR a `/jugar/:codigo`, el código en grande y "Escaneá con un celular por mesa"; fila inferior con las mesas registradas apareciendo en vivo ("9 mesas listas").
- `block_intro`: nombre de la dinámica, cómo se juega en 1 o 2 líneas, cantidad de ítems, sello de práctica si corresponde.
- `item_open`: barra superior con dinámica y "canción 3 de 8"; tarjeta central con la consigna (para Hitster, ecualizador animado y "¿De qué año es esta canción?"; el iframe de YouTube suena **detrás** de la tarjeta, oculto; en Cine y series el video se ve dentro de la tarjeta, agrandado y recortado para que no aparezcan el título ni el logo de YouTube, y se pausa al cerrar); temporizador circular (al llegar a 0 muestra "¡Tiempo!" y **las respuestas se cierran solas** (`cerrar_si_vencio`, la base confirma la hora); en canciones y escenas arranca cuando empiezan a sonar en el proyector, como mucho 30 s después de abrir); **tablero de participación** con todas las mesas: con tilde verde las que respondieron, punteadas las que faltan, apagadas con borde rojo las desconectadas; contador "11 de 15".
- `item_closed`: igual que abierto con "Respuestas cerradas" y el tablero congelado; el audio se detiene.
- `item_revealed`: tarjeta clara con la solución (para Hitster: año enorme en naranja, título, artista; Cine: año, título y "Dirección: …"; para Trivia: la opción correcta resaltada; Aproximaciones: el valor + la mesa más cercana), chips de las mesas que sumaron con "+800", y a la derecha **"Así va la noche"**: top 5 con flechas de cambio de posición (primer puesto con fondo amarillo y texto azul profundo). En práctica: "Así hubieran sumado".
- `block_ranking`: ranking completo de la noche al cerrar la dinámica, en dos columnas si hay más de 10 mesas.
- `final`: podio 1-2-3 grande + resto de la tabla; mensaje de cierre y @familia.ludica.

Siempre: logo pequeño sobre panel blanco en una esquina; patrón de puntos sutil.

### 8.2 Celular `/jugar/:codigo`

- Si hay token válido en `localStorage` → entra directo.
- Registro: logo, nombre de la noche y fecha, campo "¿Cómo se llama tu mesa?", botón "Entrar a jugar", enlace "Ya estamos jugando".
- Reingreso: lista de mesas → elegir → teclado de 4 dígitos para el PIN.
- Barra superior permanente: nombre de la mesa, dinámica actual y **PIN**.
- Según fase: `cover` ("¡Listos! Miren el proyector"), `block_intro` (nombre y reglas), `item_open` (formulario de la dinámica + "Enviar respuesta"), enviado ("¡Respuesta enviada!" + lo que mandaron + "Respondieron 11 de 15" + "Cambiar mi respuesta"), `item_closed` ("Respuestas cerradas"), `item_revealed` (correcta / incorrecta y puntos de **su** mesa), `block_ranking` (tabla completa con su mesa resaltada), `final` (su posición y agradecimiento).
- Si pierde conexión: banda "Reconectando…" sin perder lo escrito. Mantener la pantalla encendida con Wake Lock si está disponible.

### 8.3 Conductor en vivo `/admin/vivo/:eventId`

Pensado para notebook (tres columnas); en celular puede apilarse.

- Barra superior: evento, bloque e ítem, chips de fase con la actual resaltada.
- Izquierda: ítem actual con **la solución visible** (marcada "Solo lo ves vos"); para Hitster: inicio y duración + botón "▶ Repetir"; botones **Abrir / Cerrar / +15 s / Reabrir / Revelar / Siguiente** habilitados según la fase; navegación de bloques.
- Centro: tabla de respuestas (mesa, respuesta, estado, puntos provisorios) con **Aceptar / Rechazar** en las dudosas; mesas sin respuesta al final.
- Derecha: puntos manuales (mesa, puntos ±, motivo), historial de movimientos con "Anular", ranking, mesas con PIN y conexión.
- Atajos de teclado: espacio = acción principal de la fase; R = repetir audio.
- **Después de la primera noche (24/10):**
  - Barra superior compacta (nombre, bloque, fases chicas, QR, «Cómo va la noche», **Podio**, **Misiones y desafíos**, música) y controles más chicos: la columna de **Respuestas** es la más ancha.
  - Con las respuestas cerradas, si hay dudosas (o es Oveja Oveja), la tarjeta de respuestas se resalta en naranja y «Revelar» dice cuántas dudosas quedan.
  - **Corregir después de revelar** (mientras sea la pregunta actual): aceptar o rechazar respuestas y juntar o separar grupos de Oveja; la base recalcula los puntos de esa pregunta (`private.repuntuar_revelado`) y las pantallas se actualizan. «Aceptar igual» en cualquier respuesta marcada como incorrecta.
  - **Podio en cualquier momento** (`live_state.show_podio`): el podio sin terminar la noche («¡El podio de la noche!»); excluye al ranking y se saca al abrir una pregunta. «Terminar la noche» queda como cierre: historial, sin mesas ni respuestas nuevas, celulares con el final.
  - **Misiones y desafíos** en una ventana sobre el panel (botón arriba; se cierra con ✕, Esc o tocando afuera).
  - **Penalizaciones**: el ranking (`get_live`) trae `penalizacion` (puntos manuales negativos vigentes); se marca en rojo en «Así va la noche», el panel y el celular de la mesa; el aviso del celular de un descuento va en rojo («⚠ Penalización»).
  - «Así va la noche»: una columna hasta 8 mesas, dos hasta 14, tres hasta 30 (sin quedar debajo del logo ni de la franja del desafío).

### 8.4 Preparación `/admin`

- Inicio: lista de eventos (crear, abrir, duplicar) + accesos a Catálogo, Importar, Ensayo e Historial.
- Evento: nombre, fecha, lugar, código (sugerido a partir del nombre), estado; **bloques** (agregar, dinámica, título, multiplicador, práctica, tiempo sugerido, ordenar) y **ítems** de cada bloque (elegir desde el catálogo filtrando por tipo y etiqueta, ordenar, quitar). Botón "Abrir en vivo" + enlaces copiables a proyector y celular.
- Catálogo: tabla con filtros (tipo, etiqueta, estado, texto), formulario por tipo, vista previa de proyector, prueba del fragmento de YouTube.
- Importar: subir JSON o CSV → vista previa con errores por fila → importar (estado `aprobado` o `sugerido`, a elección) y opcionalmente **agregar los ítems importados a un bloque** de un evento.
- Ensayo `/admin/ensayo/:eventId`: chequea que cada video del evento se pueda insertar (crear players ocultos y escuchar `onError` 100/101/150), muestra la lista en verde/rojo; botón "Reiniciar noche".
- Historial: eventos terminados con podio, ranking por bloque y detalle de puntos por mesa.

### 8.4.1 Botones del conductor (agregados después de la prueba con celulares)

- "Mostrar QR" (esquina del logo, el juego sigue) y "📊 Mostrar cómo va la noche" (ranking en proyector; puesto + top 5 en celulares; no con una pregunta abierta ni en el podio). `admin_pantalla(event, qr, ranking)`.
- Puntos manuales y desafíos ganados: cartel de 10 s en todos los celulares (`get_live.aviso`); misiones no.
- Noche terminada: "Reanudar la noche" (`admin_resume_event`) para seguir con más bloques.
- Estado del proyector en Conducir: conectado / ninguno / **dos o más (se escucha doble)**, con el latido de cada proyector con sonido (`proyector_latido`, `admin_proyectores`).

### 8.4.2 Agregados del 22/10

- Bloque especial (`especial`): título, subtítulo, imagen; sin ítems; "Siguiente" pasa al bloque que sigue.
- Emoji decorativo por bloque (`config.emoji`).
- Música y sonidos: ítems `sonido` en el catálogo; 3 botones en Conducir; suenan en el proyector; abrir una canción o escena los apaga.
- Aproximaciones por puesto: 1° 1.000, 2° 700, 3° 500, 4° 300, 5°+ 100 (empatadas comparten puesto).
- Celular al final: botón a Instagram.

### 8.5 Módulo opcional: misiones secretas y desafíos

Juegos fuera de la pantalla, **opcionales por noche** (casillas en Armar → `events.settings.misiones` / `.desafios`). Con las dos apagadas la noche funciona igual que sin el módulo (ni consultas ni piezas nuevas).

- **Misiones secretas**: para todas las mesas. Se cargan por noche (nombre, puntos, descripción opcional), empiezan ocultas, el conductor las **abre y cierra todas juntas**. Cada mesa que la cumple suma los puntos una vez (casilla mesa × misión en conducir; destildar los saca). Con las misiones cerradas el conductor igual puede tildar (aviso tardío).
- **Desafíos**: inmediatos, de a uno. El conductor lo **lanza**, elige **la primera mesa** que lo cumplió (suma) o lo cierra sin ganadora; "Reabrir" deshace (saca los puntos).
- Puntos: como puntos manuales (`score_entries`, motivo "Misión: …" / "Desafío: …"), sin multiplicador; cuentan en el total y el podio, no en el ranking por bloque.
- Celular: el desafío en curso arriba (naranja) y la lista de misiones abiertas con ✔ en las cumplidas por esa mesa. Proyector: franja naranja abajo con el desafío en curso (no en el podio); la capa de contenido se achica para no quedar tapada. Sin aviso de "quién lo cumplió" (más adelante).
- Base: `event_extras` (kind mision|desafio, status oculto|abierto|cerrado), `extra_completions`; RPC `get_extras(code, token?)` (solo lo abierto; `cumplida` solo con el token de la mesa) y `admin_*` (set_extras, save/delete/get_extras, misiones_estado, mision_marcar, desafio_lanzar/cerrar/reabrir). Duplicar copia la lista (oculta); reiniciar la vuelve a ocultar.
- Frontend aislado en `src/extras/` (`useExtras` relee con cada relectura de `useLive`, sin canal propio).

### 8.6 Sorteo (bloque `sorteo`, uno por noche)

Se activa agregando el bloque **Sorteo** a la noche (no tiene ítems ni puntos). Con eso aparece en Armar la tarjeta «Sorteo».

- **Participantes**: nombre + dato (lote, número de entrada o DNI), cargados antes o durante la noche: a mano, pegando celdas de Excel (columna A nombre, B dato) o subiendo un CSV. Los repetidos (mismo nombre y dato, sin importar mayúsculas) se saltean y se avisan. Hasta 2.000 por carga.
- **Premios**: hasta 10, se sortean de a uno en el orden de la lista (con imagen opcional). Nadie gana dos veces.
- **El azar lo pone la base** (`admin_sorteo_sortear`: `order by random()` entre los que no ganaron ni están ausentes); nadie puede influir. El proyector solo anima la ruleta hasta caer en el que eligió la base.
- **Ruleta** (proyector, presentación del bloque): hasta 30 participantes cargados, **rueda de la fortuna** de circo (una porción por persona, el nombre a lo largo del radio, flecha arriba que rebota en los clavitos, al menos 3 vueltas por tirada); con más de 30, tambor de madera vertical con los nombres (se decide por el total cargado, no cambia en medio del sorteo). En los dos casos, que gira despacio mientras espera; al sortear gira 9 s (`private.sorteo_giro_segundos()`), frena cada vez más lento y cae en el ganador (sincronizado con la hora del servidor, misma tirada en cualquier pantalla). Sonido: un "clac" de madera por cada nombre que pasa (Web Audio, sin archivos; solo con «Comenzar la noche» tocado). Después: el ganador grande con papelitos. Con movimiento reducido no gira: muestra el resultado al terminar el tiempo.
- **No está**: el conductor lo marca (solo el último que salió); sale de la ruleta y el mismo premio se vuelve a sortear. Mientras gira no se puede volver a sortear.
- Con todos los premios sorteados, 15 s después del último el proyector muestra la lista de ganadores.
- **Celulares**: "Se sortea: premio", "Girando la ruleta…", "¡Ganó! nombre · dato", y la lista final (sin la ruleta).
- **Conducir**: botón grande «Sortear «premio»» (la barra espaciadora no lo toca, para no saltear el sorteo), cuenta regresiva mientras gira, el nombre recién cuando la ruleta frena, «No está», ganadores y «+ Sumar participantes». «Siguiente» pasa al bloque que sigue.
- Base: `raffle_participants`, `raffle_prizes`, `raffle_draws` (estado ganador|ausente); `get_sorteo(code)` público (premios con ganador, la ruleta, el último); `admin_sorteo_*`. Reiniciar borra participantes y sorteos (los premios quedan); duplicar copia los premios.
- Frontend aislado en `src/sorteo/` (`useSorteo` relee con cada relectura de `useLive`, solo durante el bloque del sorteo).

### 8.7 Bingo musical (bloque `bingo`)

Un **set** fijo de hasta 90 canciones numeradas (`/admin/bingo`): cada número apunta a una canción del catálogo (tipo `pista_audio`) con **su propio inicio de estribillo y su duración** (no los de Hitster: acá el estribillo sí delata el título, y es lo buscado) y, opcional, un título corto para el cartón. «Duración para todas» pone la misma duración a todo el set de una vez (el inicio de cada una no cambia).

- **Dos tipos**, cada uno con su juego de cartones impresos y plastificados (se reutilizan):
  - **Express** (cartones **A**): canciones 1 a 40; cartón 3 × 5 con 9 (3 por fila; columnas de 8 números); A5 apaisado; ~11–15 min.
  - **Full** (cartones **C**): canciones 1 a 90; cartón 3 × 9 con 15 (5 por fila; columnas por decena, 1–9 … 80–90); A4 apaisado; ~27–30 min.
  - (La letra B queda para un tipo intermedio, si hace falta.)
- **Cartones**: los genera la app (`src/bingo/formato.ts`): todos distintos y sin filas repetidas entre cartones; la base los vuelve a validar. Se imprimen desde `/admin/bingo/:set/imprimir/:tipo` (uno por hoja, Ctrl+P). Con cartones generados, la canción de cada número **se puede cambiar** (con aviso): los números del cartón no cambian, solo el título y el artista impresos. El número queda marcado (`bingo_songs.carton_cambiado_at`; también si cambia el título o el artista en el catálogo) y el set muestra, por tipo, cuántos cartones hay que reimprimir, con «Imprimir solo esos» (`?solo=cambiados`) y «Ya los reimprimí» (`bingo_sets.impresos`). Un número impreso no puede quedar vacío. No se cambia la canción mientras su bingo se está jugando.
- **Duplicar set** (lista o detalle): copia las canciones (inicio, duración y título corto) a un set nuevo «… (copia)», sin cartones; sirve también con un set ya jugado, para otra edición. **Borrar set**: no si un bloque de bingo lo usa (el error nombra las noches).
- **En vivo** (se juega en la presentación del bloque, como el sorteo): «Sacar bolilla» → la base elige al azar entre las que no salieron (no deja sacar otra mientras suena sin revelar) y apaga la música de fondo. El proyector pasa el estribillo (player propio; si se recarga a mitad, sigue desde donde va) y muestra una bolilla **«?», sin número ni título** (el número está impreso en el cartón); al terminar el fragmento, o antes si el conductor toca **«Revelar ya»**, la base recién manda número, título y artista. Tablero con los números revelados (marcados) y las últimas con nombre. «Repetir» la vuelve a pasar. «Dejar sonando» le saca el corte (si la gente está cantando a full) hasta que el conductor toca «Cortar» (también corta antes de tiempo, y si no estaba revelada, la revela); el número y el título se revelan igual a la duración establecida. Celulares: la lista de las que salieron.
- **Verificar cartón** (Conducir): por número (A-007 / C-012) → qué canciones ya salieron, líneas y bingo. Opcional: «Dar puntos» a una mesa (punto manual, motivo «Bingo: línea (A-007)»). Empates: los resuelve el conductor.
- Base: `bingo_sets`, `bingo_songs`, `bingo_cards`, `bingo_draws`; `admin_bingo_*`, `get_bingo(code)` (público, título solo con el fragmento terminado), `proyector_bingo(code)` (video, solo proyector). Una canción usada en un set no se borra del catálogo. Reiniciar borra las bolillas (los cartones quedan).

## 9. Pasos (en este orden, frenando después de cada uno)

1. **Esqueleto**: Vite + React + TS + Tailwind con tokens de marca y fuentes; router con `/pantalla/:codigo`, `/jugar/:codigo`, `/admin/*`; layout de proyector 16:9 y de celular; `vercel.json`; `CLAUDE.md` y `docs/SPEC.md`. *Verificación*: build ok, las 3 rutas se ven con logo y paleta en local y en Vercel.
2. **Base de datos**: migración con todas las tablas, extensiones (`pg_trgm`, `unaccent`), RLS, vistas, `is_admin()`, seed de `admins` y de un evento de ejemplo "Noche de Juegos en Naudir — 3ra Edición" (código `NAUDIR3`, fecha 2026-10-23, lugar Naudir) con una ronda de práctica de 2 ítems y un bloque de Trivia con 3 ítems de ejemplo. Script `scripts/verificar-rls.ts` que con la clave anon demuestra: no lee `catalog_solutions`, no lee `teams.token`, no escribe `live_state`, sí llama `get_live`. *Verificación*: el script pasa.
3. **Login del conductor**: "Entrar con Google" con Supabase Auth; guard de rutas `/admin/*`; pantalla "Sin acceso" para emails fuera de `admins`; botón Salir. *Verificación*: entran jorgeitamar@gmail.com, nataliaparatore@gmail.com y bion.dataconsulting@gmail.com; otra cuenta ve "Sin acceso".
4. **Mesas y portada**: `join_team`, `rejoin_team`, `whoami`, `heartbeat`; pantallas de registro, reingreso con PIN y barra con PIN; portada del proyector con QR y mesas en vivo. *Verificación*: 3 celulares se registran y aparecen en < 2 s; recargar mantiene la mesa; reingreso con PIN desde otro dispositivo funciona; PIN incorrecto da error claro.
5. **Motor en vivo**: `live_state`, RPC de fases, hook `useLive(code)` que lee completo al montar, se suscribe a Realtime (`live_state`, `teams`, `answers`, `score_entries`) y relee cada 5 s y al volver a primer plano; temporizador calculado desde `opened_at` + `timer_seconds` + `extra_seconds` (usar hora del servidor: `get_live` devuelve `now()`, corregir el desfase del reloj del dispositivo); panel del conductor con botones por fase. *Verificación*: con un ítem de prueba, cada botón cambia las 3 pantallas en < 2 s; cortar el Wi-Fi de un celular y volver lo resincroniza.
6. **Trivia + Dos verdades y una mentira**: motor de opciones, `submit_answer`, tablero de participación, `score_trivia`, `score_dos_verdades`, vistas de revelado. *Verificación*: ronda de 3 preguntas con 3 celulares; tildes, puntos (1.000/0) y revelado correctos; cambiar la respuesta antes del cierre funciona; después no.
7. **Aproximaciones**: entrada numérica y de año, `score_aproximaciones` con la fórmula, tests de casos: empate en la mínima, todas iguales, una sola respuesta, respuesta exacta. *Verificación*: los tests pasan y una ronda real coincide con lo calculado a mano.
8. **Ranking, práctica y puntos manuales**: vistas `ranking`/`ranking_by_block`, top 5 con movimientos en el revelado, ranking de bloque en proyector y celulares, podio final, puntos manuales, anular/restaurar, `is_practice`. *Verificación*: noche simulada completa (práctica + Trivia + Dos verdades + Aproximaciones) de punta a punta. **Este es el MVP jugable.**
9. **Hitster**: player de YouTube oculto detrás de la tarjeta (cargar con `start`, cortar al cumplir `duracion` con `seekTo`/`pauseVideo`, botón Repetir, volumen alto), formulario año + título + artista, normalización y similitud (SQL + TS con tests), cola de dudosas en el panel, `score_hipster`. *Verificación*: 3 canciones suenan sin que se vea ningún dato del video; "Soda Estereo" contra "Soda Stereo" queda aceptada o dudosa; aceptar una dudosa suma 200.
10. **Contenido**: catálogo (listado, filtros, formulario por tipo, etiquetas), importador JSON/CSV con vista previa y asignación a bloque, armado de evento (bloques e ítems). Crear y **duplicar** noches con otro nombre, fecha, lugar y código (ej.: "Noche de Halloween", `HALLOWEEN`), incluido el **sello de la portada** (`settings.edicion`, ej.: "Edición especial"); cada noche tiene sus propias mesas, puntos y ranking, y las terminadas quedan en el historial. *Verificación*: importo el JSON del viernes y armo el evento completo sin tocar la base a mano.
11. **Ensayo y arranque**: página de ensayo de videos, "Comenzar la noche", `admin_reset_event` con confirmación. *Verificación*: un video con inserción bloqueada aparece en rojo; el reinicio deja todo en cero.
12. **Prueba de carga y pulido**: `scripts/simular-mesas.ts` (`npm run simular -- CODIGO`) que registra 15 mesas y responde cada ítem abierto con valores aleatorios; revisar estados vacíos, errores, textos, accesibilidad y `prefers-reduced-motion`. *Verificación*: 15 mesas simuladas + 2 reales durante una ronda completa sin errores ni demoras visibles.

## 10. Formato de importación

JSON: arreglo de objetos. CSV: una fila por objeto, columnas `tipo, etiquetas (separadas por |), dificultad, contenido_json, solucion_json` (versión simple para el MVP).

```json
[
  {
    "tipo": "pregunta_opciones",
    "etiquetas": ["variada"],
    "dificultad": "facil",
    "contenido": { "texto": "¿Cuántas piezas tiene un dominó clásico?", "opciones": ["28", "32", "24", "36"] },
    "solucion": { "correcta": 0, "explicacion": "Doble seis: 28 fichas." }
  },
  {
    "tipo": "pista_audio",
    "etiquetas": ["80s", "rock nacional"],
    "contenido": { "youtube_id": "XXXXXXXXXXX", "inicio": 42, "duracion": 20, "categoria": "musica" },
    "solucion": { "anio": 1986, "titulo": "Persiana americana", "artista": "Soda Stereo",
                  "variantes_titulo": [], "variantes_artista": ["Soda"] }
  }
]
```

Validar cada fila (tipo conocido, campos obligatorios, `youtube_id` de 11 caracteres, años entre 1900 y el actual) y mostrar errores en español antes de importar.

## 11. Criterios generales de calidad

- Cada pantalla debe recuperarse sola de: recarga, pérdida de Realtime, pestaña en segundo plano, reloj del dispositivo desfasado.
- Ninguna acción del conductor debe poder duplicar puntos (idempotencia en `admin_reveal`).
- Errores visibles y en español, diciendo qué pasó y qué hacer.
- Sin dependencias pesadas innecesarias; el bundle del celular debe cargar rápido en 4G.
- Código en TypeScript estricto; componentes chicos; nada de lógica de puntaje en el frontend (solo presentación).
- Al final de cada paso, `npm run build` sin errores ni warnings de TS.

Empezá por el **paso 1**.
