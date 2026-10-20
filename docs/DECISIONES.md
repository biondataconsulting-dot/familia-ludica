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

## Pendientes de marca

- **Resolución del logo**: el contenido real mide ~150 px; en el proyector a 1920 px se muestra a ~210 px (algo ampliado). Conviene conseguir una versión vectorial o de alta resolución para reemplazar `logo.png`.
- **Lint**: ESLint 9 (flat config) con `typescript-eslint`, `react-hooks` y `react-refresh`.
