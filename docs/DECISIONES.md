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
- **Teclado propio** en el celular (no el del sistema): coma decimal, botón ± y punto de miles al mostrar. En años: selector con −10/−1/+1/+10 (arranca en 1990) y teclado; con 4 dígitos, el siguiente número empieza un año nuevo. El selector de año queda en `src/dynamics/comun/` para Hipster.
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
- **Seed**: bloque "Hipster musical" con 3 canciones conocidas (Rick Astley, Queen, PSY) para probar; las de la noche real se cargan con el importador (paso 10).

## Pendientes de marca

- **Resolución del logo**: el contenido real mide ~150 px; en el proyector a 1920 px se muestra a ~210 px (algo ampliado). Conviene conseguir una versión vectorial o de alta resolución para reemplazar `logo.png`.
- **Lint**: ESLint 9 (flat config) con `typescript-eslint`, `react-hooks` y `react-refresh`.
