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
- **Resolución del logo**: el contenido real mide ~150 px; en el proyector a 1920 px se muestra a ~210 px (algo ampliado). Conviene conseguir una versión vectorial o de alta resolución para reemplazar `logo.png`.
- **Lint**: ESLint 9 (flat config) con `typescript-eslint`, `react-hooks` y `react-refresh`.
