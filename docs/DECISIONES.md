# Decisiones

Decisiones no cubiertas por la especificación que no bloqueaban. Se tomó la opción más simple.

## Paso 1

- **Ubicación del repo**: no existía `familia-ludica`; se creó en `C:\Users\colin\familia-ludica` con rama `main`.
- **Tailwind 3** (no 4): la spec pide `tailwind.config`, que es el esquema de configuración de la v3.
- **Colores con canales RGB en variables CSS** (`--fl-naranja: 236 104 27`) para que Tailwind admita opacidad (`bg-naranja/20`).
- **Escenario del proyector**: un contenedor 16:9 centrado que ocupa el máximo posible de la ventana (`min(100vw, 100vh·16/9)`), con `container-type: inline-size`; todo el contenido se mide en `cqw`, así 1 cqw = 1% del ancho del escenario. Bandas laterales/superiores en azul profundo.
- **Logo**: se tomó del manual de identidad (única versión disponible, 236×258 PNG transparente). Se guardó el original como `logo-original.png` y una versión recortada al contenido como `logo.png`; el área de seguridad la da el padding del panel de `<Logo />`. Si el archivo falta, queda el panel blanco vacío.
- **Tarjeta inclinada de la portada vs. "no rotar el logo"**: la spec pide la tarjeta inclinada y el manual prohíbe rotar el logo. La tarjeta se inclina y el logo adentro se contra-rota para quedar derecho.
- **Logo de esquina en el proyector**: mide `max(140px, 7.5cqw)`. En la portada se oculta porque la tarjeta del QR ya lleva el logo (el manual pide no repetirlo en una misma pieza); en el resto de las fases se muestra.
- **Barra del panel del conductor**: lleva "Familia Lúdica" en texto, no el logo, porque el manual no permite el logo completo por debajo de 140 px.
- **Resolución del logo**: ver más abajo.

- **Raíz `/`**: redirige a `/admin` (pedido del usuario), para que la dirección pelada no muestre "Esta página no existe".

## Infraestructura

- **Región de Supabase: East US (Ohio), se mantiene.** São Paulo bajaría ~120 ms por consulta, pero la región no se puede cambiar (habría que recrear el proyecto) y lo medido alcanza: aviso de mesa nueva en ~200 ms, muy por debajo de los 2 s pedidos.

## Paso 2

- **Clave anon**: el proyecto usa el formato nuevo de Supabase (`sb_publishable_…`), equivalente a la clave anon. Va en `VITE_SUPABASE_ANON_KEY`.
- **Vistas públicas con permisos del dueño**: `public_teams`, `ranking`, `ranking_by_block`, `public_item` y `answered_teams` corren con los permisos de `postgres` (no `security_invoker`), así anon las lee sin tener acceso a las tablas. Exponen solo las columnas permitidas. El asesor de seguridad de Supabase las va a marcar como "security definer view": es intencional.
- **Admins**: leen todas las tablas por RLS (`is_admin()`); no escriben directo, solo por RPC `admin_*` (pasos siguientes). `is_admin()` compara el email en minúsculas.
- **`items_maximos`** (desempate del ranking): cantidad de ítems donde la mesa obtuvo el puntaje más alto que dio ese ítem, siempre que sea mayor a 0.
- **`ranking.position`**: columna extra con el puesto ya ordenado (total, ítems máximos, nombre).
- **`answered_teams`** incluye `event_id` además de lo pedido, para poder filtrar por evento.
- **Tiempo sugerido del bloque**: en `event_blocks.config.timer_seconds`.
- **Edición del evento**: `events.name` = "Noche de Juegos en Naudir" y `settings.edicion` = "3ra Edición", para mostrar la edición como sello aparte en la portada.
- **Idempotencia de puntajes**: índice único parcial en `score_entries (block_item_id, team_id) where origin = 'auto'`.
- **live_state automático**: un trigger crea la fila en fase `cover` al crear cada evento.
- **`revealed`** solo se expone en `get_live` cuando la fase es `item_revealed`.
- **Seed en remoto**: se carga con `supabase db push --include-seed`; es idempotente (ids fijos y `on conflict do nothing`).

## Paso 3

- **Quién es admin lo decide la base**: el frontend llama `is_admin()` (la misma función que usa RLS); no hay lista de emails en el código.
- **Elegir cuenta siempre**: el login pide `prompt=select_account`, para que sea fácil cambiar de cuenta (y probar la pantalla "Sin acceso").
- **Vuelta del login**: Google vuelve a la misma ruta de `/admin/...` desde la que se entró.
- **Error de Google en la URL** (cancelar, cuenta rechazada): se muestra en la tarjeta de ingreso y se limpia la URL.

## Paso 4

- **Tiempo real sin exponer tablas**: anon no puede leer tablas, así que no puede escuchar `postgres_changes`. En su lugar, triggers en `teams`, `live_state`, `answers` y `score_entries` mandan un broadcast público **sin datos** (`realtime.send`, evento `cambio`, canal `evento:<CODIGO>`). Al recibirlo, cada pantalla relee `get_live` (agrupando avisos de 150 ms). Respaldo: relectura cada 5 s, al volver a primer plano y al recuperar la red. Medido: ~200 ms desde el registro hasta el aviso.
- **El heartbeat no avisa**: el trigger de `teams` se dispara solo por altas, bajas y cambios de `name`/`active`, no por `last_seen`. El estado "conectado" se actualiza con la relectura de 5 s.
- **`useLive` adelantado del paso 5**: hacía falta para que las mesas aparezcan en vivo. El paso 5 le suma el temporizador y el desfase de reloj.
- **`get_live` incluye `teams`** (id, nombre, conectado; nunca token ni PIN): una sola llamada alimenta la portada y la lista de reingreso.
- **Reingreso con límite**: tabla `rejoin_attempts`. PIN incorrecto y "demasiados intentos" se devuelven como `{error}` en vez de excepción, porque una excepción desharía el registro del intento fallido.
- **Nombre de mesa**: se normalizan los espacios; máximo 30 mesas activas por noche; no se puede registrar en una noche `terminado`.
- **PIN** generado con `random()` (4 dígitos); el límite de 5 intentos por minuto hace inviable adivinarlo.
- **Mesa en el celular**: se guarda en `localStorage` (`fl:mesa:<CODIGO>`) con token, PIN y nombre, así entra directo aunque no haya red; `whoami` la valida en segundo plano y si la base ya no la reconoce (noche reiniciada) la olvida.
- **Wake Lock y "Reconectando…"** ya están en el celular (spec §8.2).
- **"Comenzar la noche"** del proyector queda para el paso 11, como dice la spec.

## Paso 5

- **Despacho de dinámicas en SQL**: `private.score_item()` llama a `private.score_<dinámica>(block_item_id)` si existe (y `private.validar_item()` a `private.validate_<dinámica>`). El motor no conoce ninguna dinámica; los pasos 6, 7 y 9 solo agregan esas funciones (en el esquema `private`, no expuesto).
- **Permisos de ejecución**: Postgres da EXECUTE a PUBLIC en toda función y ese default es global (el revoke por esquema del paso 2 no alcanzaba: anon podía *llamar* `admin_next`, aunque `is_admin()` lo frenaba). La migración del motor lo cierra para siempre y da permisos explícitos: anon solo las RPC públicas; `admin_*` solo `authenticated` (+ `is_admin()` adentro).
- **Serialización**: cada RPC de fase bloquea la fila del evento y de `live_state` (`for update`): dos clics simultáneos (o dos conductores) se ejecutan en orden y el segundo ve la fase nueva.
- **"Siguiente" (`admin_next`) cubre todo el recorrido**: portada → primer bloque → primer ítem → … → ranking del bloque → bloque siguiente → final. Así la acción principal (barra espaciadora) casi siempre es "Siguiente", salvo Cerrar y Revelar.
- **Llegar al final no termina la noche**: `final` por "Siguiente" deja el evento en vivo; solo "Terminar la noche" (`admin_finish`, con confirmación) lo pasa a `terminado`, que ya no se puede operar sin reiniciar.
- **Revelar de nuevo un ítem reabierto** (abrirlo otra vez desde la navegación) actualiza los puntos en lugar de duplicarlos (`on conflict ... do update`). Revelar dos veces seguidas no hace nada.
- **Temporizador**: el desfase del reloj se estima con el punto medio del pedido a `get_live` (`server_now`). Con el ítem cerrado el reloj queda congelado en el momento del cierre (`updated_at`).
- **`get_live` suma `answered`** (ids de las mesas que respondieron el ítem actual) para el tablero de participación.
- **Revelado y ranking**: el revelado genérico (resaltado de la opción correcta / valor) ya funciona; el top 5 "Así va la noche", el ranking de bloque y el podio llegan en el paso 8.
- **Panel del conductor**: en la navegación de bloques, "Presentar" lleva a la intro de cualquier bloque y "Abrir" abre cualquier ítem con el tiempo del bloque. Volver a la portada y Terminar la noche están en una fila secundaria.

## Paso 6

- **Sin texto amarillo sobre azul** (pedido del cliente): títulos en blanco; el acento cálido va como fondo naranja (sello de práctica, multiplicador, línea bajo el título de la portada). No se usó texto naranja sobre azul porque el contraste es 1,6:1. El amarillo queda solo como fondo del primer puesto (paso 8).
- **Forma de la respuesta validada en la base**: `submit_answer` llama a `private.check_<dinámica>(content, answer)`, que la normaliza o lanza un error en español. Trivia y Dos verdades: `{"opcion": i}` con `i` entero dentro del rango. El frontend valida lo mismo antes de enviar (`validate.ts`), solo para avisar antes.
- **Cierre sin carreras**: `submit_answer` toma `live_state` con `for share` y el cierre con `for update`: el cierre espera a los envíos en curso y después de cerrar ya nadie entra.
- **Mesas sin respuesta**: no generan fila en `score_entries` (cuentan 0 en el ranking).
- **Puntos provisorios**: `admin_preview(event_id)` corre el mismo `score_item` × multiplicador sin registrar nada; el panel los muestra mientras el ítem está abierto o cerrado.
- **"Enviar respuesta" explícito**: tocar una opción la selecciona; se envía con el botón (como pide la spec). "Cambiar mi respuesta" vuelve al formulario con la opción anterior marcada; "Dejar la que mandé" cancela.
- **Respuesta propia tras recargar**: el celular la pide con `whoami` al cambiar de ítem; si todavía no la leyó pero `answered` dice que respondió, muestra igual "¡Respuesta enviada!".
- **Revelado**: columna derecha "Sumaron" debajo del logo de la esquina (el logo no puede bajar de 140 px y pisaba la tarjeta a 1280 px). En el paso 8 esa columna suma el top 5.
- **Seed**: se agregó un bloque de ejemplo "Dos verdades y una mentira" (2 ítems) a NAUDIR3 para probar y para la noche simulada del paso 8. Se aplica con `npm run db:seed` (idempotente). El evento real se arma en el paso 10.

## Paso 7

- **Fórmula en un solo lugar que cuenta**: `private.score_aproximaciones` (SQL). La copia en `src/dynamics/aproximaciones/puntaje.ts` existe solo para documentar y testear; los casos (`casos.ts`) los usan tanto Vitest como la prueba de SQL, así no pueden divergir.
- **Redondeo**: `round()` de Postgres (mitad hacia arriba para positivos) = `Math.round` de JS para estos valores (siempre ≥ 0).
- **Respuesta**: `{"valor": número}`. Se aceptan decimales y negativos (por si hay preguntas de temperatura); tope ±10¹². En preguntas `formato: anio`, entero entre −9999 y 9999.
- **Teclado propio** en el celular (no el del sistema): coma decimal, botón ± y punto de miles al mostrar. En años: selector con −10/−1/+1/+10 (arranca en 1990) y teclado; con 4 dígitos, el siguiente número empieza un año nuevo. El selector de año queda en `src/dynamics/comun/` para Hitster.
- **Resultado en el celular**: "¡La más cerca!" para la distancia mínima y "¡Bien cerca!" para el resto que suma; "¡Correcta!" queda para las dinámicas con respuesta correcta.
- **Revelado**: el valor en grande y "La más cerca: …" con lo que respondió (sale del `detail.mas_cerca` del puntaje). Las dinámicas reciben ahora los puntos por mesa (`puntos`) en `ProjectorReveal`.
- **Seed**: bloque de ejemplo "Aproximaciones" con 2 ítems (Aconcagua en metros; Obelisco, año).

## Paso 8

- **Flechas del top 5**: `admin_reveal` guarda en `revealed.ranking_antes` el puesto de cada mesa antes de sumar; el proyector lo compara con el ranking actual (▲ subió, ▼ bajó, – igual). Una mesa sin puesto previo no muestra flecha.
- **`get_live` incluye `ranking`** (todas las mesas, ya ordenado) y `block_total` (lo que sumó cada una en el bloque actual, para "+X en el bloque").
- **Primer puesto**: fondo amarillo con texto azul profundo, en proyector, celular y panel (nunca texto amarillo).
- **Ranking de bloque**: una columna hasta 10 mesas; dos columnas de 11 a 30 (letra más chica desde 21).
- **Podio**: 2° / 1° / 3° con alturas distintas y entrada escalonada (sin animación si el dispositivo pide menos movimiento); el resto en 3 columnas debajo.
- **Puntos manuales**: entero ≠ 0 entre −10.000 y 10.000, motivo de 2 a 200 caracteres, mesa de la misma noche. Se pueden cargar y anular en cualquier momento, también con la noche terminada (para corregir antes de cerrar el historial). No tienen bloque: cuentan en el ranking total, no en el de un bloque.
- **Anular / Restaurar** sirve para cualquier movimiento (automático o manual); el anulado queda tachado en el historial y sale del ranking.
- **Protector de errores** (`Recuperable`): si una pantalla falla al dibujarse, muestra "Reconectando…" y se vuelve a montar sola a los 3 s en vez de quedar en blanco. Además `useLive` completa con listas vacías los campos que falten (por si el frontend nuevo llega antes que la migración, o al revés). Motivo: en la prueba el proyector quedó en blanco al recibir código nuevo antes que la base.
- **Volver a revelar un ítem** recalcula los puntos de todas las mesas que respondieron, también las de una pasada anterior (es lo correcto: el ítem se juega con todas sus respuestas).

## Paso 9

- **Podio sin fondo amarillo** (pedido del cliente): los tres escalones en blanco; el ganador, más ancho, con ★ naranja y el nombre más grande. El amarillo sigue solo como fondo del 1er puesto en las tablas.
- **`proyector_media(code)`** es la única fuente del `youtube_id` (solo con el ítem actual de audio/video abierto, cerrado o revelado). Como toda RPC pública, técnicamente la podría llamar cualquiera con la clave anon; los celulares no la usan y `get_live` nunca trae el id.
- **Player oculto**: un único player de YouTube (320×180, el mínimo que permite YouTube) detrás de la tarjeta central; la capa de contenido va en `z-10` encima. Suena solo al abrir el ítem, se corta al cumplir `duracion` (control cada 250 ms), se pausa al cerrar y vuelve a sonar con "Repetir". En el revelado no suena solo (el conductor puede repetir).
- **"Repetir"** viaja como broadcast directo `repetir` por el mismo canal `evento:<CODIGO>` (panel → proyector), sin pasar por la base. Tecla R en el panel.
- **Audio bloqueado por el navegador**: si a los 2,5 s no suena, el proyector muestra "Tocá acá para activar el sonido". El botón "Comenzar la noche" del paso 11 lo va a evitar desde el arranque.
- **Validación de texto**: se corre al cerrar respuestas (`validate_hipster`) y no pisa lo que el conductor ya aceptó o rechazó. Un cambio de respuesta (mientras está abierto) borra la validación de esa mesa. Las dudosas se deciden solo con el ítem cerrado; al revelar, una dudosa sin decidir cuenta como rechazada y el panel lo advierte con confirmación.
- **Normalización**: `unaccent` + minúsculas + solo `[a-z0-9]` + espacios simples + artículo inicial (el, la, los, las, the, a, an). Si normalizado coincide exacto, similitud 1. La copia en TS replica `pg_trgm` (trigramas por palabra con dos espacios adelante y uno atrás) y se comprueba contra SQL con los mismos casos.
- **Respuesta**: `{anio, titulo?, artista?}`; año entero 1800–2100; título y artista hasta 100 caracteres (vacíos no se guardan).
- **Seed**: bloque "Hitster musical" con 3 canciones conocidas (Rick Astley, Queen, PSY) para probar; las de la noche real se cargan con el importador (paso 10).

## Paso 10

- **Escrituras del conductor solo por RPC** (spec §4): `admin_save_item`, `admin_delete_item`, `admin_import_items`, `admin_save_event`, `admin_duplicate_event`, `admin_save_block`, `admin_delete_block`, `admin_move_block`, `admin_set_block_items`. Las lecturas siguen por RLS.
- **Una sola validación de ítems, en dos copias con los mismos mensajes**: `private.error_item` (manda) y `src/content/validarItem.ts` (para la vista previa del importador y el formulario). Los casos (`casos-items.ts`) se prueban contra las dos.
- **Reglas de ítems** (además de las de la spec): 2 a 6 opciones; exactamente 3 afirmaciones; `duracion` de 5 a 120 s; categoría musica/pelicula/serie/dibujo; artista obligatorio en `pista_audio` y opcional en `clip_video`; el año entre 1900 y el actual solo aplica a canciones/clips (en Aproximaciones una respuesta-año puede ser cualquier año entero).
- **Importación todo o nada**: si alguna fila tiene errores no se importa ninguna y se dice cuáles (fila desde 1). Máximo 500 por vez. Los importados quedan con `source = 'importado'`. Si se elige un bloque, se agregan al final y se valida que el tipo vaya en esa dinámica.
- **CSV**: se detecta si el separador es coma o punto y coma (Excel en español); comillas dobles con `""` adentro y saltos de línea dentro de campos.
- **Links de YouTube**: el formulario acepta el link entero (watch, youtu.be, shorts, embed) y guarda solo el id.
- **Duplicar una noche** copia bloques e ítems (mismos ítems del catálogo), el lugar y el sello; no copia mesas, respuestas ni puntos. Queda en borrador.
- **Código sugerido** a partir del nombre (`sugerirCodigo`): saca palabras de relleno, tildes y espacios, y suma el número de edición ("… Naudir — 3ra Edición" → NAUDIR3). Editable. Una noche en vivo no puede cambiar su código (rompería el QR).
- **Protecciones del armado**: no se edita un bloque con un ítem en juego; no se borra un bloque ya jugado ni se saca de un bloque un ítem ya jugado o en pantalla; no se cambia el tipo de un ítem que está en un bloque; no se borra del catálogo un ítem que está en un bloque.
- **Etiquetas** en minúsculas y sin repetir; se crean al usarlas.
- **Sin borrar noches desde el panel** (no lo pide la spec y evita accidentes); el reinicio llega en el paso 11.
- **Historial** (spec §8.4) no está en ningún paso del plan: queda para el paso 11 o 12.
- **Código largo en la portada**: la letra del código se achica según el largo para que hasta 12 caracteres entren en la tarjeta.

## Paso 11

- **"Comenzar la noche"** aparece en cada carga del proyector (el permiso de sonido del navegador se pierde al recargar). El toque arranca la noche en el acto y, sin esperar respuesta, pide pantalla completa y "despierta" el audio con un sonido mudo; si el navegador niega algo, sigue igual (queda el botón "Tocá para activar el sonido" como respaldo). También mantiene la notebook despierta (Wake Lock). La capa es opaca para no mostrar dos logos.
- **Reinicio** (`admin_reset_event(event_id, code)`): además de la confirmación en pantalla, la base exige el código de la noche. Borra puntos, respuestas y mesas (con sus intentos de PIN), vuelve a portada, deja la noche en "lista" y la quita de `used_in_events` del catálogo. Los bloques e ítems quedan. Los celulares de antes vuelven al registro (su token ya no existe).
- **Ensayo de videos**: un player de prueba (silenciado y visible en el panel) intenta reproducir cada video desde su `inicio`; ✔ si suena, ✘ si YouTube devuelve error (2, 5, 100, 101, 150), ⚠ si no responde en 15 s o si el fragmento pasa el final del video. De a uno, para no saturar.
- **Historial** (spec §8.4, no estaba en ningún paso): lista de noches terminadas y detalle con podio, ranking por bloque y, tocando una mesa, de dónde salió cada punto.

## Ajustes después del paso 11

- **Demora del audio de Hitster**: el player se crea desde la presentación del bloque (invisible ahí, sin video) y la API de YouTube se baja al abrir el proyector. Al abrir una canción solo falta cargar el video. Medido desde que el proyector ve la canción abierta hasta que suena: 3,0 s antes (en frío), 0,97 s la primera canción y 0,7 s las siguientes. "Repetir" con el mismo video salta al inicio del fragmento (sin recargar). El `youtube_id` sigue llegando solo con la canción en juego.
- **Aviso de sonido bloqueado**: espera 4 s y no aparece si el video todavía está cargando (antes, con una carga lenta, podía aparecer sin motivo).
- **Canciones desde 0:00** (pedido del cliente): proyector, ensayo, panel y prueba del catálogo reproducen desde el principio durante `duracion`. El formulario ya no pide "empieza en" (guarda 0); el importador sigue aceptando `inicio` pero se ignora al reproducir.
- **Puntos manuales**: puntos y motivo en renglones separados (en la columna angosta el motivo quedaba aplastado).
- **Mesas en el panel**: "PIN:" antes del número.
- **Desarrollo en Windows**: Vite vigila los archivos por sondeo (`server.watch.usePolling`), porque el vigilante normal se perdía cambios. No afecta el build ni Vercel.

## Cine y series (pedido del cliente)

- Dinámica nueva `cine` ("Cine y series") para `clip_video`; `hipster` queda solo para `pista_audio`. Mismo formulario y mismo puntaje que Hitster (`score_cine` envuelve a `score_hipster`): año + título (+200) + director (+200, va en `artista`, obligatorio en las escenas).
- La escena **se ve y se escucha** desde que se abre: el player se ubica encima de un marco 16:9 de la tarjeta, agrandado 35% dentro de un recorte (sin clics) para esconder la barra de título y el logo de YouTube. Se pausa al cerrar respuestas y desaparece al revelar.
- **Telón sobre la escena**: YouTube muestra título, "Más videos" y su logo al cargar, al arrancar y en pausa (el recorte no alcanza). Antes de arrancar y en pausa/fin, cortina azul completa con 🎬 ("Preparando la escena…" / "Fin de la escena"). Al arrancar, imagen y sonido juntos con dos franjas azules (20% arriba y abajo) que tapan título y logo; a los 4 s se abren como un telón (2,5 s no alcanzaban: todavía se veía el título) (una sube y otra baja, 1 s). Se eligió sobre franjas fijas (cortaban escenas) y sobre la cortina completa (el sonido arrancaba antes que la imagen). Con `prefers-reduced-motion`, las franjas desaparecen sin animación.
- Igual que las canciones, las escenas arrancan en 0:00 y duran `duracion`: conviene usar videos que ya sean solo la escena (sin intro con el nombre de la película).
- **Corrección del conductor**: además de Aceptar / Rechazar en las dudosas, en la tabla de respuestas (con respuestas cerradas) se puede dar vuelta lo que el sistema decidió solo (p. ej. "Volver al futuro 2" se acepta sola contra "Volver al futuro" por similitud). Vale para Hitster y Cine.
- **Cronómetro de canciones y escenas**: corre desde que empiezan a reproducirse en el proyector, no desde que el conductor las abre (cargar el video tarda). El proyector avisa con `proyector_media_arranco` y la base corre `opened_at` a ese momento: una sola vez por apertura y solo dentro de los 30 s de abierto (nadie puede estirar el reloj). Mientras tanto `get_live.media_waiting` deja el reloj quieto en el total, en el proyector y en el panel. Si el proyector nunca avisa (cerrado, sonido bloqueado), a los 30 s corre desde la apertura. Vale para Hitster y Cine.

## Borrar noches (pedido del cliente)

- Al pie de `/admin/noche/:id`: "Borrar esta noche…" pide escribir el código (como el reinicio) y borra la noche con bloques, mesas, respuestas y puntos (`admin_delete_event`). El catálogo no se toca. Se puede borrar en cualquier estado; si está en vivo o ya se jugó, la pantalla lo advierte.

## Paso 12: prueba de carga y pulido

- **Simulador** (`npm run simular -- CODIGO [mesas] [pensar_max_s]`): cada mesa simulada usa su propia conexión y hace lo mismo que un celular (aviso en tiempo real + relectura cada 5 s + latido cada 10 s) y responde al azar después de 2 a N s. Termina solo en el podio y muestra mediana, p95 y máximo de cada llamada.
- **Resultado** (copia de NAUDIR3, 15 mesas, 12 ítems de las 4 dinámicas + Hitster, conductor automático): 180 de 180 respuestas, 0 errores. Mediana ~190 ms en `get_live` y `submit_answer`, p95 230–330 ms. Hubo un pico aislado (7,6 s en una lectura, 12,9 s en un latido): la relectura cada 5 s lo cubre y no se notó en las respuestas.
- **Pulido**: podio con empates (el número sale del ranking: dos mesas empatadas arriba son las dos 1° con estrella); catálogo vacío con indicación; contraste de textos secundarios (celular al 75%, ≥ 4,5:1; proyector al 75% y mesas desconectadas al 55%); en Hitster, una canción de categoría película vuelve a pedir "Artista" (solo las escenas piden director). Movimiento reducido ya cubierto por la regla global de `index.css`; `lang="es-AR"` y textos alternativos en orden.

## Misiones secretas y desafíos (módulo opcional, pedido del cliente)

- **Aislado y apagado por defecto**: casillas por noche en Armar. Tablas y funciones nuevas; de lo existente solo se extendieron duplicar (copia la lista, oculta) y reiniciar (vuelve todo a oculto). `get_live` no se tocó: las pantallas leen el módulo con `get_extras`, solo si la noche lo tiene prendido, en el mismo ritmo de relectura de `useLive` (sin canal propio).
- **Puntos como puntos manuales**: el ranking y el podio los suman sin cambios; no figuran en el ranking por bloque; destildar/reabrir anulan el movimiento (queda en el historial como anulado).
- **Misiones**: se abren y cierran todas juntas (pedido); una misión agregada con las misiones abiertas aparece abierta. Se puede tildar con las misiones cerradas (el presentador avisa tarde), no con las ocultas. No se cambian los puntos ni se borra una misión/desafío si alguna mesa ya los sumó.
- **Desafíos**: de a uno por vez; gana una sola mesa; "Reabrir" corrige una mesa equivocada. La franja del proyector no se muestra en el podio.
- **Red de seguridad**: etiqueta `probado-simulacion` en git = la versión anterior al módulo (para volver si hiciera falta). Simulación de control (módulo apagado, 15 mesas): igual que antes, 180/180 sin errores.

## Ajustes después de la prueba con celulares (21/10)

- **Cierre automático**: al llegar el reloj a 0, proyector y panel piden `cerrar_si_vencio(code)` (cada 2 s hasta que cierra). La base cierra solo si el tiempo se cumplió con su propia hora (nadie puede adelantarlo), con el mismo cierre del conductor (`validar_item` + `item_closed`), y respeta `+15 s` y la espera de canciones/escenas. Sin reloj no cierra. "Reabrir" sigue disponible. Reemplaza la regla original de la spec ("llegar a 0 no cierra").
- **Video trabado**: si a los 8 s de abrir no arrancó, el proyector lo recarga desde cero (y otra vez a los 16 s). "Repetir" recarga desde cero cuando el video está trabado (si no, vuelve al inicio). El panel avisa "El video todavía no arrancó en el proyector" con `media_waiting` pasados 8 s.
- **Contador**: "Respondieron · 11 de 15 mesas".
- **Hitster** (no Hipster): nombre visible y títulos de bloques en todas las noches; la clave interna sigue siendo `hipster`.
- Simulación rápida (relojes de 5 s, el mínimo de la base; conductor que no cierra a mano): 12 de 12 preguntas cerradas solas, 180/180 respuestas, 0 errores.
- **Botones de pantalla** (`admin_pantalla`, en `live_state.show_qr` / `show_ranking`): "Mostrar QR" pone el QR (con el código y "¿Se cerró el celu?") en la esquina del logo, sin cortar el juego; en la portada no hace falta. "Cómo va la noche" muestra el ranking completo en el proyector y, en cada celular, su puesto y el top 5. No con una pregunta abierta (la base lo rechaza y abrir una pregunta lo apaga); tampoco en el podio. Prender/apagar no mueve `updated_at` (con la pregunta cerrada es el momento del cierre y congela el reloj): `tocar_updated_at` solo lo mueve si cambia la fase o el reloj.
- **Aproximaciones**: el revelado muestra las 5 mesas más cercanas (empates con el mismo puesto) y, si hay más, "Las demás… mejor ni hablar 😂". Tamaños ajustados para que entre con la franja de un desafío.
- **Avisos de puntos** (`get_live.aviso`): el último punto manual o de desafío de los últimos 20 s; cada celular lo muestra 10 s ("+300 para Los Pumas · Mejor disfraz" / "🏆 Los Pumas ganó el desafío…"). Las misiones no se avisan (son secretas) y lo anulado tampoco. Solo celulares.
- **Bloques en vivo**: Armar siempre permitió agregar bloques con la noche en vivo; lo que faltaba es que Conducir los viera: ahora relee la estructura al volver a la pestaña y cada 15 s. **Reanudar la noche** (`admin_resume_event`): una noche terminada vuelve a en vivo y el proyector pasa del podio al ranking; mesas y puntos quedan.

## Aviso de sonido bloqueado (corregido)

- Antes aparecía "Tocá acá para activar el sonido" si a los 4 s el video no estaba sonando por cualquier motivo (una carga lenta) y no se iba más. Ahora solo aparece si el navegador de verdad bloqueó el sonido: el video suena silenciado, o nadie tocó la pantalla del proyector desde que se cargó (`navigator.userActivation`). Se va solo cuando suena con volumen y al pasar a otro ítem. Las cargas lentas las resuelven los reintentos. Una pausa nunca cuenta (la pone la app al cerrar, revelar o cortar), y el chequeo de 4 s se descarta si mientras tanto cambió la fase, el ítem o hubo otro «Repetir» (`sonidoBloqueado`, con tests).

## Aviso de proyectores duplicados

- Causa real del "se escucha doble" (21/10): un segundo proyector de la misma noche abierto en otra pestaña. Cada proyector con «Comenzar la noche» tocado late cada 10 s (`proyector_latido`, id propio de la página, tabla `proyectores`, tope 20 por noche, limpia los de más de 2 min). Conducir consulta cada 10 s `admin_proyectores`: con uno muestra "✔ Proyector con sonido conectado", con ninguno lo avisa en gris y con dos o más avisa que se va a escuchar doble.

## Adiviná la imagen y Oveja Oveja (22/10, para el viernes)

- **Adiviná la imagen** (dinámica `imagen`, ítem `imagen_adivinar`): un solo juego con tres estilos (película con emojis, logo, ¿Qué ves?). El zoom queda para más adelante (pedido). Respuesta escrita, validada como el título de Hitster (sin tildes ni mayúsculas, variantes, dudosas para el conductor). Acertar: 1.000. Consigna por estilo o propia.
- **Imágenes**: bucket público `imagenes` de Supabase Storage; suben solo admins, desde el formulario del catálogo (o se pega un enlace). Nombre de archivo al azar (no delata la respuesta). Hasta 5 MB. Se muestran siempre al mismo alto (26cqw abierto, 15cqw al revelar). Para logos, usar imágenes **sin el nombre de la marca**.
- **Oveja Oveja** (dinámica `oveja`, ítem `pregunta_mayoria`, versión local de Herd Mentality / Mente Vacuna): una respuesta por mesa; suman 1.000 las mesas del grupo más numeroso. Empate arriba o todas iguales (regla propia): nadie suma. Oveja negra: la única distinta cuando todas las demás coinciden; solo se muestra (dibujo + nombre de la mesa), no resta.
- **Grupos**: al cerrar, la base agrupa por texto normalizado sin la "s" final de cada palabra (milanesas = milanesa) o por similitud ≥ 0,75 con un grupo existente. Con las respuestas cerradas, el conductor junta grupos ("auto" con "coche") o separa una respuesta, desde la tabla de respuestas. Lo que decidió el conductor no se pisa si se vuelve a cerrar.
- **Ejemplos** (catálogo, etiqueta "ejemplo", y bloques en la noche EXTRAS): 🦁👑 El rey león; logo de Familia Lúdica; ¿Qué ves? sol + dado = Soldado (`public/ejemplos/sol-dado.svg`); "¿Cuál es la mejor comida para un domingo?".
- Pruebas: 25 chequeos en PGlite (validación, puntajes, empate, unanimidad, oveja negra, juntar/separar); simulación de 15 mesas con relojes de 5 s: 60/60 respuestas, 0 errores.

## Catálogo con IA (etapa 1)

- **Guía** `docs/GUIA_CATALOGO.md` (para Claude o ChatGPT): cómo usarla, prompt para copiar, contexto familiar, reglas de contenido, formato y un apartado por tipo con ejemplo JSON. Se baja desde Importar («Bajar guía para IA»); es el mismo archivo del proyecto (import `?raw`), así que no se desfasa. `guia.test.ts` falla si la app tiene un tipo que la guía no explica o si un ejemplo no se importa.
- **Revisión en la app**: Importar queda en «Sugeridos» por defecto; se revisa en Catálogo filtrando por estado, con la vista previa, y se aprueba. «Copiar errores para la IA» arma el texto con las filas con error para pegárselo a la IA.
- **Videos**: las IA inventan IDs de YouTube; la guía exige buscarlos y, si no hay uno confirmado, dejar el ítem como pendiente. Comprobado: el buscador web general no devuelve links de YouTube, pero buscar en YouTube + la consulta pública `youtube.com/oembed` sí (200 = existe y se puede insertar, 401 = no se puede insertar, 404 = no existe). `oembed` permite consultas desde el navegador (CORS): base para la verificación al importar (etapa 2).
- **Imágenes**: por ahora fuera del JSON (logos y ¿Qué ves? van en una lista aparte y se cargan a mano). Etapa 2: subida en lote junto con el JSON.
- **Prueba de punta a punta**: catálogo de 15 ítems (7 tipos, con una canción y una escena de YouTube verificadas) armado siguiendo la guía: pasa la vista previa sin errores y se importó como sugerido (etiqueta `prueba-guia`).
- **Etapa 2 (después del viernes)**: «Aprobar seleccionados», verificación de videos al importar (oembed), imágenes en lote con el JSON, aviso de repetidos.

## Segundo de inicio opcional (vuelve)

- Canciones y escenas arrancan en 0:00 por defecto, pero cada ítem puede tener «Empieza en (s)» (para saltear un comienzo que delata el nombre). `proyector_media` devuelve el `inicio` del ítem (antes lo forzaba a 0). Cuando no arranca en 0, el proyector entra con volumen suave: de 0 a 100 en 1,5 s desde que empieza a sonar (también con «Repetir»). Ensayo, prueba del catálogo y panel ("Suena de 1:05 a 1:25") usan el inicio real. La guía pide a la IA dejar siempre `inicio: 0`. Todos los ítems cargados estaban en 0 (y el seed se pasó a 0).

## Mejoras después de la prueba en vivo (22/10)

- **Respaldo previo**: etiqueta git `respaldo-22-10` y copia JSON de todas las tablas en `C:/Users/colin/familia-ludica-respaldos/22-10/` (sin Docker no hay `db dump`).
- **Oveja Oveja**: "si las más elegidas empatan, nadie suma" (antes "empate arriba", no se entendía).
- **Celular**: botón "Seguinos en Instagram" (@familia.ludica) al terminar la noche.
- **Dos verdades**: el tamaño de letra depende de la afirmación más larga (tres escalones) y el revelado es más compacto; ya no se desborda la tarjeta.
- **Aproximaciones por puesto** (decisión del cliente): 1° 1.000 · 2° 700 · 3° 500 · 4° 300 · 5°+ 100; empatadas comparten puesto (rank). Antes la más lejana sumaba 0 aunque estuviera cerca. Fórmula en SQL y copia en `puntaje.ts` con casos compartidos.
- **Bloque especial** (dinámica `especial`): título, subtítulo e imagen a pantalla completa, sin ítems; en su presentación "Siguiente" pasa al bloque que sigue (o al final). Para pausas, sorteos, encuestas.
- **Emoji decorativo por bloque** (`config.emoji`): en la presentación del bloque, en el celular y como sticker en la esquina de la tarjeta de cada pregunta y del revelado (medido: no tapa título, ronda, reloj ni logo).
- **Música y sonidos**: tipo de ítem `sonido` (YouTube, nombre, inicio, duración opcional, repetir). Cada noche elige hasta 3 (`settings.sonidos`) y el conductor los prende y apaga desde Conducir (`live_state.sonido_id`); suenan en el proyector con un player propio, entrada y salida suaves. Abrir una canción o escena los apaga (y el proyector no los reproduce con una canción o escena abierta). El youtube_id solo lo pide el proyector (`proyector_sonido`).
- **Tarjeta de puntajes** para imprimir: `docs/tarjeta-puntajes.html`.
- `verificar:rls` acepta el código de una noche (`npm run verificar:rls -- JUEGO`); con la fase revelada, la solución puede aparecer (es lo que se muestra), el youtube_id nunca.

## Aviso de versión nueva y ajustes de sonidos (23/10)

- **Versión nueva**: cada build genera `/version.json` y lleva su versión en el código (`__VERSION__`, vite.config.ts). Proyector, panel y celulares consultan cada minuto (y al volver a la pestaña): si no coincide, avisan ("recargá esta pantalla"; en panel y celular, botón para recargar; el celular no pierde la mesa). Motivo: un proyector abierto desde antes de publicar los botones de música no tenía el reproductor y no sonaba. Funciona a partir de las pantallas cargadas con esta versión.
- **Sonidos**: un lugar con un sonido que se borró del catálogo queda vacío (antes mostraba "— elegir —" con el ▶ activo). Si YouTube no deja reproducir un sonido, el proyector lo dice abajo a la derecha. Probado en el navegador integrado: el reproductor pide, recibe y suena (estado 1).

## Sorteo (23/10)

- **Un bloque por noche** (`sorteo`): agregar el bloque activa el módulo; sin él, nada cambia. Detalle en SPEC §8.6.
- **Rueda o tambor según cuántos son** (pedido del cliente, 23/10): hasta 30 participantes, rueda de la fortuna (con pocos nombres el tambor parecía repetirlos); con más, tambor. Se decide por el total cargado, así no cambia en medio del sorteo.
- **Rueda con cantidad impar**: la última porción va en naranja oscuro (antes celeste: parecía una porción especial).
- **Powered by BION** en la portada del proyector: solo texto («Powered by BION Data Consulting»), chico y tenue abajo a la derecha. Se probó con el logo circular y quedaba sucio sobre el azul: se sacó.
- **Tambor (más de 30)**: los nombres pasan de arriba abajo en un cilindro (se achican hacia los bordes), con lengüetas naranjas en el centro. Una rueda de porciones no se lee con muchos nombres; el tambor sí, con 20 o con 500.
- **Giro orgánico pero decidido por la base**: la base elige y guarda el ganador; la animación recorre al menos 40 renglones (con pocos nombres, a veces una vuelta más según el id del sorteo), frena con una curva de potencia 2,6, se pasa un tercio de renglón y vuelve (como el tope de una ruleta de circo).
- **Sonido de ruleta de madera** generado en el navegador (ruido filtrado + tono corto que cae), uno por renglón (máx. ~25 por segundo) y uno grave al frenar. Sin redoblante.
- **Panel sin spoiler**: el conductor ve el nombre recién cuando la ruleta frena.
- **Ausente**: se marca solo el último que salió; queda como "no estaba" en la lista y no vuelve a la ruleta en esa noche (reiniciar la noche lo limpia todo).
- Prueba: 26 casos en PGlite (bloque único, repetidos, orden de premios, giro de 9 s, ausente y re-sorteo, nadie gana dos veces, 60 tiradas reparten entre los tres, permisos de anon, reiniciar y duplicar) + vista en navegador (proyector y celular) con la noche temporal SORTEO.

## Pendientes de marca

- **Resolución del logo**: el contenido real mide ~150 px; en el proyector a 1920 px se muestra a ~210 px (algo ampliado). Conviene conseguir una versión vectorial o de alta resolución para reemplazar `logo.png`.
- **Lint**: ESLint 9 (flat config) con `typescript-eslint`, `react-hooks` y `react-refresh`.
