# Guía para generar el catálogo de Familia Lúdica con IA

Esta guía sirve para pedirle a una IA (Claude o ChatGPT) que arme preguntas y juegos para el catálogo de
Familia Lúdica, en un archivo que la app importa directo. Tiene dos partes: **cómo usarla** (para vos) y
**las instrucciones para la IA** (todo lo que viene después del prompt).

---

## Cómo usarla (para vos)

1. Abrí **Claude** (con la búsqueda web activada) o **ChatGPT**, en una conversación nueva.
2. **Adjuntá este archivo** (lo bajás desde la app: Importar → «Bajar guía para IA»).
3. Copiá el **prompt** de abajo, completá lo que está entre corchetes y envialo.
4. La IA te devuelve un archivo **JSON**. Guardalo (por ejemplo `catalogo-trivia.json`).
5. En la app: **Importar** → elegí el archivo. La vista previa muestra cada fila con ✔ o con su error en naranja.
   - Si hay errores, la app no deja importar. Tocá **«Copiar errores para la IA»**, pegáselos a la IA y
     pedile que corrija esas filas. Volvé a elegir el archivo corregido.
   - Sin errores: dejá **Sugeridos (para revisar antes)** y tocá Importar.
6. En **Catálogo**, filtrá por estado **Sugerido**: abrí cada ítem, mirá la vista previa del proyector y
   pasalo a **Aprobado** si va (o borralo si no).
7. Armá la noche con los ítems aprobados.

**Consejos**

- Pedí de a **tandas de 20 a 40 ítems** por tipo de juego: salen mejor que un pedido gigante.
- Las canciones y escenas necesitan links de YouTube **reales**: la IA tiene que buscarlos (con búsqueda web).
  Antes de la noche, el **Ensayo** de la app verifica que cada video se pueda reproducir.
- Canciones y escenas arrancan en 0:00. Si alguna delata el nombre al principio, abrí el ítem en el catálogo y
  poné **«Empieza en (s)»** (el botón de prueba te deja escucharlo); en el proyector entra con volumen suave.
- Revisá siempre los datos (años, cifras, fechas): las IA a veces se equivocan.
- Logos y «¿Qué ves?» llevan imagen: por ahora la IA te da la lista y las imágenes las subís vos desde el
  formulario de cada ítem en el catálogo (ver «Imágenes» más abajo).

### Prompt para copiar

```text
Te adjunto la «Guía para generar el catálogo de Familia Lúdica». Leela entera y seguí al pie de la letra
la parte «Instrucciones para la IA» (contexto, reglas de contenido, formato y tipos de juego).

Pedido:
- Juego / tipo: [por ejemplo: Trivia (pregunta_opciones)]
- Cantidad: [por ejemplo: 30]
- Temas: [por ejemplo: cine, deportes, Argentina, comida]
- Dificultad: [por ejemplo: mitad fácil, mitad media]
- Etiquetas para todos: [por ejemplo: halloween-2026]
- Otras indicaciones: [opcional]

Entregá:
1. El catálogo en un único bloque de código JSON (una lista), listo para importar, sin comentarios.
2. Debajo del JSON, fuera del bloque: las fuentes de los datos que verificaste y la lista de lo que quedó
   pendiente o dudoso (por ejemplo, canciones sin un link de YouTube confirmado).
```

---

## Instrucciones para la IA

### Contexto

Familia Lúdica organiza **noches de juegos en vivo** para familias y grupos de amigos en Argentina.
Unas 15 mesas (de 4 a 8 personas, de todas las edades: chicos desde 10 años, adultos y abuelos) juegan a la
vez. Un **proyector** muestra cada pregunta en grande; cada mesa responde desde **un celular**. Un
presentador conduce la noche y comenta las respuestas.

El catálogo es el banco de preguntas y juegos que el conductor usa para armar cada noche. Vos generás
ítems para ese catálogo.

### Público y tono

- **Familiar**: tiene que poder leerse en voz alta en una mesa con chicos y abuelos.
- **Español rioplatense** («escriban», «elijan», «¿Qué ves?»), cercano y con humor, **nunca infantil**.
- Preguntas **cortas y claras**: se leen desde el fondo del salón. Ideal: hasta 120 caracteres.
- Que sean **divertidas y comentables**, no exámenes. Mejor un dato curioso que uno de memoria pura.
- Mezclá referencias que conozcan distintas generaciones (no todo de los últimos 5 años, ni todo de los 80).

### Reglas de contenido

**Nunca:**

- Violencia explícita, armas, crímenes, drogas, alcohol como tema central, contenido sexual o insinuaciones.
- Política partidaria, religión, grietas, temas que dividan o incomoden.
- Burlas sobre aspecto físico, origen, género, discapacidades, edades o grupos de personas.
- Tragedias, enfermedades, muertes o catástrofes como tema de juego.
- Marcas, películas o canciones que no sean aptas para todo público.
- Datos inventados: si no estás seguro de un dato, no lo uses.

**Con cuidado:**

- Fútbol: está bien, pero equilibrado (no burlas a hinchadas).
- Películas y series: solo aptas para todo público (o que una familia vea junta).
- Fechas y cifras: verificalas con una fuente y anotala debajo del JSON.

### Formato de entrega

- Un **único bloque de código JSON**: una lista `[ … ]` de ítems. JSON válido: comillas dobles, sin comas
  finales, sin comentarios, sin texto adentro del bloque que no sea el JSON.
- Cada ítem tiene **siempre** estos cinco campos:

| Campo | Qué va |
|---|---|
| `tipo` | Uno de los tipos de esta guía (ver abajo), escrito exacto. |
| `etiquetas` | Lista de 1 a 4 etiquetas en minúscula: tema y, si te lo piden, la de la noche. Ej.: `["cine", "disney"]`. |
| `dificultad` | `"facil"`, `"media"` o `"dificil"` (sin tildes). |
| `contenido` | Lo que se muestra en el proyector (depende del tipo). |
| `solucion` | La respuesta correcta (depende del tipo). Nunca va en `contenido`. |

- Los índices empiezan en **0**: la primera opción es 0, la segunda 1, etc.
- La app **rechaza el archivo entero** si una fila está mal. Revisá la checklist del final antes de entregar.

### Tipos de juego

Cada tipo va en un bloque de la noche con su juego. Usá **solo** los campos que se indican.

---

#### Trivia — tipo: `pregunta_opciones`

Pregunta con opciones; las mesas eligen una. Suma la mesa que acierta.

- `contenido.texto`: la pregunta (hasta 120 caracteres).
- `contenido.opciones`: de 2 a 6 opciones (ideal: **4**), cortas (hasta 40 caracteres), sin repetir.
- `solucion.correcta`: el número de la opción correcta (0 = la primera).
- `solucion.explicacion` (opcional): un dato curioso corto que se muestra al revelar (hasta 120 caracteres).

Buenas prácticas: los distractores tienen que ser **creíbles** (nada de opciones obviamente absurdas);
variá la posición de la correcta; evitá «todas las anteriores» o «ninguna».

```json
[
  {
    "tipo": "pregunta_opciones",
    "etiquetas": ["juegos"],
    "dificultad": "facil",
    "contenido": { "texto": "¿Cuántas fichas tiene un dominó clásico?", "opciones": ["24", "28", "32", "36"] },
    "solucion": { "correcta": 1, "explicacion": "Del doble cero al doble seis: 28 fichas." }
  }
]
```

---

#### Dos verdades y una mentira — tipo: `trio_verdad_mentira`

Tres afirmaciones sobre un tema: dos son verdad y una es mentira. Las mesas eligen la mentira.

- `contenido.afirmaciones`: exactamente **3** afirmaciones (hasta 120 caracteres cada una).
- `solucion.mentira`: el número de la afirmación falsa (0, 1 o 2).
- `solucion.explicacion` (opcional): por qué es mentira.

Buenas prácticas: la mentira tiene que **sonar verdadera** y las verdades, sorprendentes. Mismo tema y
estilo en las tres. Variá la posición de la mentira.

```json
[
  {
    "tipo": "trio_verdad_mentira",
    "etiquetas": ["animales"],
    "dificultad": "media",
    "contenido": {
      "afirmaciones": [
        "Los pulpos tienen tres corazones.",
        "Las vacas tienen cuatro estómagos.",
        "Los avestruces esconden la cabeza bajo tierra cuando tienen miedo."
      ]
    },
    "solucion": { "mentira": 2, "explicacion": "Es un mito: se agachan, pero no entierran la cabeza." }
  }
]
```

---

#### Aproximaciones — tipo: `pregunta_numerica`

Pregunta cuya respuesta es un número o un año. Suma más la mesa que más se acerca.

- `contenido.texto`: la pregunta.
- `contenido.formato`: `"numero"` o `"anio"` (si la respuesta es un año).
- `contenido.unidad` (opcional): «metros», «km», «personas»… (vacío si es un año).
- `solucion.valor`: el número correcto (un año, sin decimales).
- `solucion.explicacion` (opcional).

Buenas prácticas: datos **verificables** y estables (no cosas que cambian todos los meses); que nadie lo
sepa exacto pero todos puedan estimarlo. Anotá la fuente debajo del JSON.

```json
[
  {
    "tipo": "pregunta_numerica",
    "etiquetas": ["geografia", "argentina"],
    "dificultad": "media",
    "contenido": { "texto": "¿A cuántos metros sobre el nivel del mar está la cumbre del Aconcagua?", "formato": "numero", "unidad": "metros" },
    "solucion": { "valor": 6961, "explicacion": "Es la montaña más alta de América." }
  }
]
```

---

#### Hitster musical — tipo: `pista_audio`

Suena una canción (de YouTube, desde el principio); las mesas adivinan el **año**, y suman extra si aciertan
el **título** y el **artista**.

- `contenido.youtube_id`: el ID del video de YouTube (**11 caracteres**, lo que va después de `watch?v=`).
- `contenido.inicio`: el segundo donde empieza a sonar. **Siempre `0`** (desde el principio): no sabés en qué
  segundo está cada parte del video. Si el comienzo delata el título (lo cantan o aparece escrito), avisalo en
  los pendientes: el conductor ajusta el inicio escuchando.
- `contenido.duracion`: cuántos segundos suena (de 5 a 120; recomendado **20**).
- `contenido.categoria`: `"musica"`.
- `solucion.anio`: año de **lanzamiento original** de la canción (no el de una reedición o remasterización).
- `solucion.titulo` y `solucion.artista`: obligatorios.
- `solucion.variantes_titulo` y `solucion.variantes_artista`: otras formas que también se aceptan (lista,
  puede ir vacía). Ej.: `["Soda"]` para Soda Stereo.

**Videos de YouTube — muy importante:**

- **Nunca inventes un ID ni lo escribas de memoria.** Buscalo (búsqueda web) y usá solo IDs que viste en un
  resultado real. Si no encontrás uno confirmado, **no incluyas ese ítem** en el JSON: anotalo como pendiente
  debajo, con título, artista y año.
- Preferí la versión **oficial de audio o el video oficial**, que permita reproducirse insertado en otra página.
  Evitá en vivos, versiones, remixes o videos con introducciones largas: suena desde 0:00.

```json
[
  {
    "tipo": "pista_audio",
    "etiquetas": ["rock nacional", "80s"],
    "dificultad": "media",
    "contenido": { "youtube_id": "AAAAAAAAAAA", "inicio": 0, "duracion": 20, "categoria": "musica" },
    "solucion": { "anio": 1986, "titulo": "Persiana americana", "artista": "Soda Stereo", "variantes_titulo": [], "variantes_artista": ["Soda"] }
  }
]
```

(El `youtube_id` de este ejemplo es de relleno: en tu entrega tiene que ser un ID real que encontraste.)

---

#### Cine y series — tipo: `clip_video`

Se ve y se escucha una escena; las mesas adivinan el **año**, y suman extra si aciertan el **título** y quién
la **dirigió**.

- `contenido.youtube_id`, `contenido.inicio` (siempre `0`) y `contenido.duracion`: como en Hitster (duración
  recomendada: 20 a 30 segundos).
- `contenido.categoria`: `"pelicula"`, `"serie"` o `"dibujo"`.
- `solucion.anio`: año de estreno.
- `solucion.titulo`: obligatorio.
- `solucion.artista`: **el director o la directora** (obligatorio; en series, quien la creó).
- `solucion.variantes_titulo`, `solucion.variantes_artista`: como en Hitster (títulos en español y en inglés).

Las mismas reglas de YouTube que en Hitster. Además: que la escena **no muestre el título** de la película en
los primeros segundos (un tráiler suele mostrarlo: preferí escenas). Solo películas y series aptas para todo
público.

```json
[
  {
    "tipo": "clip_video",
    "etiquetas": ["cine", "80s"],
    "dificultad": "facil",
    "contenido": { "youtube_id": "BBBBBBBBBBB", "inicio": 0, "duracion": 25, "categoria": "pelicula" },
    "solucion": { "anio": 1985, "titulo": "Volver al futuro", "artista": "Robert Zemeckis", "variantes_titulo": ["Back to the Future"], "variantes_artista": ["Zemeckis"] }
  }
]
```

---

#### Adiviná la imagen — tipo: `imagen_adivinar`

Se muestra algo en el proyector y cada mesa **escribe** la respuesta. Acertar suma. La respuesta se acepta sin
tildes ni mayúsculas y con las variantes que cargues. Tres estilos (`contenido.estilo`):

- `"emojis"` — **Película (o serie, o canción) con emojis.** `contenido.emojis`: de 2 a 6 emojis, sin letras
  ni números. Tienen que permitir deducir el título (personajes, objetos o la trama en orden).
- `"logo"` — **¿De qué marca es este logo?** `contenido.imagen`: la imagen (ver «Imágenes»).
- `"que_ves"` — **¿Qué ves?** (acertijo de imagen: dibujos que juntos forman una palabra o frase, como
  sol + dado = soldado). `contenido.imagen`: la imagen.

Campos comunes:

- `contenido.consigna` (opcional): la pregunta que se lee, si querés cambiarla (por defecto: «¿Qué película
  es?», «¿De qué marca es este logo?», «¿Qué ves?»). Hasta 120 caracteres.
- `solucion.respuesta`: la respuesta (obligatoria).
- `solucion.variantes_respuesta`: otras formas aceptadas: con y sin artículo, título en inglés, abreviaturas.
  Ej.: `["Rey León", "Lion King"]`.

```json
[
  {
    "tipo": "imagen_adivinar",
    "etiquetas": ["disney", "peliculas"],
    "dificultad": "facil",
    "contenido": { "estilo": "emojis", "emojis": "🦁👑" },
    "solucion": { "respuesta": "El rey león", "variantes_respuesta": ["Rey León", "Lion King"] }
  }
]
```

**Imágenes (logos y ¿Qué ves?):** por ahora **no las incluyas en el JSON**. Debajo del JSON, entregá una lista
aparte con, para cada una: estilo, qué tiene que mostrar la imagen, respuesta y variantes. El conductor
consigue o dibuja la imagen y la carga a mano. Para logos: elegí marcas muy conocidas en Argentina y aptas para
todo público; la imagen tiene que mostrar **el logo sin el nombre de la marca**. No dibujes ni recrees logos.

---

#### Oveja Oveja — tipo: `pregunta_mayoria`

Se hace una pregunta abierta y cada mesa escribe **lo que cree que va a responder la mayoría**. Suman las
mesas que coinciden con la respuesta más repetida; si las más elegidas empatan o todas responden lo mismo, nadie
suma. No hay respuesta correcta.

- `contenido.texto`: la pregunta (hasta 100 caracteres).
- `solucion`: siempre vacía: `{}`.

Buenas prácticas: preguntas con **una respuesta "obvia" que muchos van a pensar, pero no todos**: así hay
mayoría y también sorpresas. La respuesta tiene que caber en **una o dos palabras**. Evitá preguntas de sí/no,
de números, de opinión polémica o con una única respuesta correcta.

Buenos ejemplos: «¿Cuál es la mejor comida para un domingo?», «Nombrá una fruta roja», «¿Qué se lleva
siempre a la playa?», «Un superhéroe», «Un deporte que se juega con pelota».

```json
[
  {
    "tipo": "pregunta_mayoria",
    "etiquetas": ["oveja", "comida"],
    "dificultad": "facil",
    "contenido": { "texto": "¿Cuál es la mejor comida para un domingo?" },
    "solucion": {}
  }
]
```

---

#### Música o sonido — tipo: `sonido`

No es un juego: es **música funcional o un efecto** que el conductor prende y apaga a mano durante la noche
(música de fondo en una trivia o una pausa, un redoblante en un sorteo, aplausos). Suena en el proyector.

- `contenido.titulo`: un nombre corto para reconocerlo en el panel (hasta 80 caracteres). Ej.: «Música de pausa»,
  «Redoblante», «Aplausos».
- `contenido.youtube_id`: el ID del video de YouTube (mismas reglas que en Hitster: **buscado, nunca inventado**).
- `contenido.inicio`: el segundo donde empieza (`0` si no sabés).
- `contenido.duracion` (opcional): cuántos segundos suena (de 1 a 3600). Para efectos cortos (un redoblante de 8
  segundos). Si no lo ponés, suena hasta el final.
- `contenido.repetir` (opcional): `true` para que vuelva a empezar al terminar (música de fondo).
- `solucion`: siempre vacía: `{}`.

Buenas prácticas: música **sin letra** o instrumental para el fondo (no compite con el presentador); videos largos
(«1 hora de…») para la música de fondo; efectos cortos y claros. Todo apto para todo público.

```json
[
  {
    "tipo": "sonido",
    "etiquetas": ["musica-fondo"],
    "dificultad": "facil",
    "contenido": { "titulo": "Música de pausa", "youtube_id": "CCCCCCCCCCC", "inicio": 0, "repetir": true },
    "solucion": {}
  }
]
```

---

### Checklist antes de entregar

- [ ] Es **un solo bloque JSON** con una lista, y es JSON válido (comillas dobles, sin comas finales).
- [ ] Cada ítem tiene `tipo`, `etiquetas`, `dificultad`, `contenido` y `solucion`.
- [ ] `tipo` está escrito exacto; `dificultad` es `facil`, `media` o `dificil`.
- [ ] Trivia: 2 a 6 opciones sin vacías; `correcta` es un número de 0 a (opciones − 1).
- [ ] Dos verdades: exactamente 3 afirmaciones; `mentira` es 0, 1 o 2.
- [ ] Aproximaciones: `valor` es un número; si `formato` es `anio`, un año entero.
- [ ] Hitster y Cine: `youtube_id` real de 11 caracteres (buscado, no inventado); `inicio` en 0; año entre 1900
      y el actual; título y artista/director completos.
- [ ] Imagen: estilo `emojis` con los emojis completos (logos y ¿Qué ves? van en la lista aparte).
- [ ] Oveja Oveja: `solucion` vacía `{}`.
- [ ] Todo es apto para una mesa familiar (ver «Reglas de contenido»).
- [ ] Debajo del JSON: fuentes y pendientes.

### Si te pasan un error de la app

La app indica la fila (empezando en 1, en el orden de la lista) y qué está mal, por ejemplo: «Fila 7: Tiene que
haber entre 2 y 6 opciones.». Corregí **solo esas filas** y devolvé el JSON completo de nuevo.
