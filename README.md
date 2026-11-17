# NEWAR (Radar Político Salta integrado)

Monitor gratuito de menciones de políticos —desde concejales hasta el
gobernador— en medios digitales de la capital y los departamentos de Salta
(El Tribuno, Salta12, InformateSalta, El Intransigente, Nuevo Diario de Salta,
Radio Salta, más una búsqueda amplia por departamento vía Google News). Corre
solo cada 5 minutos, detecta temas en tendencia y qué políticos aparecen
mencionados juntos, arma una ficha pública por cada político, y trae además
un resumen aparte de noticias nacionales y provinciales generales para leer
rápido qué pasó en las últimas horas.

**Importante — alcance real:** esto cubre medios de prensa digital. No incluye
Instagram, Facebook, TikTok ni Twitter/X (esas plataformas no tienen forma
gratuita y legal de rastrear automáticamente), ni detección de bots en redes
sociales, ni contradicciones verificadas entre declaraciones (eso necesita
lectura semántica, no conteo de palabras — ver la sección "Sobre
declaraciones y contradicciones" más abajo). El análisis de tono y de temas
en tendencia son heurísticas simples (palabras clave y frecuencia), no un
modelo de IA entrenado.

## Qué páginas tiene

- **centro.html** — el centro de control: un resumen con enlaces a todo lo
  demás, cuántas menciones/temas/noticias hay guardadas, y los políticos y
  temas con más cobertura. Es el mejor punto de entrada.
- **index.html** — panel principal: menciones de tus políticos configurados,
  filtros, gráfico de volumen, balance de tono, temas en tendencia y
  co-menciones.
- **politico.html?id=algun-id** — ficha pública de un político: historial,
  tono en el tiempo, temas propios, declaraciones citadas y artículos.
  Se llega ahí haciendo clic en el nombre de cualquier político del panel.
- **temas.html** y **tema.html?id=algun-id** — igual que lo anterior pero
  para temas puntuales (no personas): un presupuesto, una obra, una causa
  judicial. Se configuran en `data/topics.json`, con la misma lógica que
  `politicians.json`. Cada tema muestra además qué políticos aparecen
  mencionados en sus noticias.
- **briefing.html** — resumen de noticias nacionales y provinciales
  generales (no solo de tus políticos), con botones para ver "últimas 6 /
  12 / 24 horas" o todo lo guardado, agrupado por día y con la fuente de
  cada nota a la vista.
- **destacados.html** — todo lo que marcaste con el ícono ☆ en cualquier
  sección. Ver la nota de abajo sobre esto.
- **eventos.html** — el "cerebro" del proyecto: agrupa noticias de distintas
  fuentes que probablemente hablan del mismo hecho (72hs de ventana, por
  palabras compartidas en el título) y muestra qué políticos y temas están
  conectados a cada uno. Ver la nota de abajo sobre sus límites.
- **oficiales.html** — publicaciones de fuentes **oficiales**: boletines
  oficiales (Nación y Municipalidad de Salta), la Corte Suprema, el Poder
  Judicial de Salta, la Legislatura provincial (Senadores y Diputados), el
  Concejo Deliberante de Salta capital, y contrataciones/licitaciones del
  Ministerio de Economía y de la Municipalidad. Decretos, resoluciones,
  acordadas, noticias y licitaciones, cada una con el enlace al documento
  original, filtros, y las que nombran a alguien de tu lista. Abajo muestra
  el estado de cada fuente (si funcionó, si está bloqueada o si falló). Ver
  la sección "Fuentes oficiales" más abajo.

## Nómina de políticos: qué es real y qué falta

`data/politicians.json` tiene 85 registros:

- **1 gobernador** (Gustavo Sáenz) — actual, sin dudas.
- **23 senadores provinciales** — actuales, confirmados en el Diario de
  Sesiones del Senado de Salta (senadosalta.gob.ar) del 21 de mayo de 2026.
  Alta confianza.
- **60 diputados provinciales** — acá viene la parte importante: **esta
  lista está desactualizada y lo digo explícitamente en cada registro**.
  La saqué de Wikipedia, que muestra los mandatos de la composición
  2019-2023 / 2021-2025 de la Cámara. Como la Cámara renueva la mitad de
  sus bancas cada 2 años, y hoy (2026) esos mandatos ya vencieron o están
  por vencer, es muy probable que varias de estas personas ya no ocupen esa
  banca. Cada registro tiene un campo `role` que dice literalmente
  "VERIFICAR vigencia actual" y campos `term_start`/`term_end` con las
  fechas que encontré. Igual los cargué, en vez de omitirlos, porque:
  - Son nombres reales de personas que fueron o son diputados de Salta, no
    inventados.
  - Seguir sus menciones en prensa sigue siendo útil aunque hayan dejado la
    banca (siguen siendo figuras políticas).
  - Vos podés borrar de `politicians.json` a quien confirmes que ya no está
    en función, o actualizarle el `role` cuando lo verifiques.
- **1 registro placeholder** para Concejo Deliberante (`concejal-pendiente`):
  no encontré una fuente confiable para esa nómina en esta sesión de
  búsqueda. Reemplazalo vos con datos del sitio oficial del municipio de
  Salta capital.

**Actualización: encontré la nómina real de concejales.** Al revisar
`cdsalta.gob.ar` (el sitio del Concejo Deliberante) para agregarlo como
fuente oficial, esa misma página tiene la lista de los 21 concejales
actuales de la Ciudad de Salta, con nombre y apellido
(`cdsalta.gob.ar/index.php/concejales/`). La dejé lista para copiar en
`data/concejales_cdsalta_2026.json` (21 bloques, mismo formato que
`politicians.json`), pero **no la mezclé yo directamente en
`politicians.json`** porque ese archivo no venía en lo que me compartiste
esta vez y reescribirlo a ciegas corre el riesgo de borrarte registros que
ya tenés ajustados a mano. Para terminarlo: abrí
`data/politicians.json`, pegá los 21 bloques de
`data/concejales_cdsalta_2026.json` adentro del arreglo, borrá el
registro `concejal-pendiente`, y guardá. Ese archivo nuevo no lo lee
ningún recolector automáticamente — es solo para copiar y pegar. No
incluye el bloque político de cada concejal porque el sitio no lo muestra
con claridad suficiente como para confirmarlo persona por persona.

**Por qué no "arreglé" esto yo mismo buscando más**: en algún punto, seguir
buscando sin una fuente oficial con nombres y fechas 2026 deja de ser
investigación y pasa a ser adivinar. Preferí entregarte 83 nombres reales
con su nivel de confianza marcado, en vez de 85 nombres con confianza
pareja pero falsa.

Todos estos registros, aunque estén marcados para verificar, ya quedan
monitoreados automáticamente (menciones, tono, citas, temas) porque están
en `politicians.json` — no hace falta esperar a verificarlos para que
empiecen a traer datos.

## Qué vas a necesitar

- Una cuenta gratuita de GitHub (github.com)
- 15-20 minutos la primera vez

## Paso 1 — Crear el repositorio

1. Entrá a github.com, iniciá sesión (o creá la cuenta).
2. Arriba a la derecha, botón **+** → **New repository**.
3. Nombre: `radar-politico-salta` (o el que quieras).
4. Marcalo como **Public** (los repos públicos tienen minutos de GitHub Actions
   ilimitados gratis; uno privado tiene un límite mensual).
5. Creá el repositorio vacío (sin README, sin .gitignore).

## Paso 2 — Subir estos archivos

La forma más simple sin usar la terminal:

1. En la página del repositorio recién creado, hacé clic en **uploading an
   existing file** (o "Add file" → "Upload files").
2. Arrastrá **toda la carpeta** que te compartí (`salta-monitor`), manteniendo
   la estructura: `.github/workflows/monitor.yml`, `scripts/monitor.py`,
   `data/politicians.json`, `data/mentions.json`, `data/aggregates.json`,
   `index.html`, `README.md`.
   - Si el navegador no te deja arrastrar carpetas completas, subí primero
     `index.html` y `README.md`, y para las subcarpetas usá "Add file" →
     "Create new file" escribiendo la ruta completa (por ejemplo
     `scripts/monitor.py`) y pegando el contenido.
3. Confirmá el commit ("Commit changes").

## Paso 3 — Darle permiso de escritura al workflow

El script necesita poder guardar los datos nuevos en el propio repositorio.

1. En el repositorio: **Settings** → **Actions** → **General**.
2. Bajá hasta "Workflow permissions".
3. Elegí **Read and write permissions**.
4. Guardá los cambios.

## Paso 4 — Activar GitHub Pages (el panel web)

1. **Settings** → **Pages**.
2. En "Build and deployment", "Source": **Deploy from a branch**.
3. Branch: **main**, carpeta **/ (root)**.
4. Guardá. GitHub te va a dar una URL del tipo
   `https://tu-usuario.github.io/radar-politico-salta/` (puede tardar 1-2
   minutos en estar activa la primera vez). Te recomiendo entrar directo a
   `.../centro.html` y guardarla como favorito: es el punto de entrada a
   todo el proyecto.

## Paso 5 — Configurar a quién (y qué) seguir

### Políticos

1. Abrí `data/politicians.json` en GitHub (o editalo antes de subirlo).
2. Por cada persona agregá un bloque así:

```json
{
  "id": "un-identificador-unico",
  "name": "Nombre completo",
  "role": "Cargo o descripción",
  "aliases": ["Nombre completo", "Apodo", "Otra forma de nombrarlo"]
}
```

### Temas (opcional)

Igual que los políticos, pero en `data/topics.json` y con `keywords` en vez
de `aliases`:

```json
{
  "id": "un-identificador-unico",
  "name": "Nombre del tema",
  "scope": "provincial",
  "keywords": ["frase o palabra clave 1", "otra frase clave"]
}
```

Usá `"scope": "nacional"` si el tema es de alcance nacional (por ejemplo,
una ley del Congreso) para que busque en los medios nacionales en vez de
los provinciales.

`aliases` / `keywords` son todas las formas en que los diarios podrían
nombrar a esa persona o tema. Cuantas más pongas, mejor cobertura vas a
tener.

## Paso 6 — Primera corrida manual

No hace falta esperar los 15 minutos:

1. Pestaña **Actions** del repositorio.
2. Seleccioná el workflow **Monitor de medios - Salta**.
3. Botón **Run workflow** → **Run workflow**.
4. Esperá 1-2 minutos y refrescá: deberías ver una corrida en verde.
5. Entrá a tu URL de GitHub Pages: ya debería mostrar menciones (si las hay
   para las personas que configuraste).

De ahí en más, el workflow se ejecuta solo cada 15 minutos.

## Cómo ajustar la frecuencia

En `.github/workflows/monitor.yml`, la línea:

```yaml
- cron: "*/15 * * * *"
```

Podés cambiarla a `*/5 * * * *` para intentar cada 5 minutos. GitHub no
garantiza exactitud en los horarios programados (puede demorar corridas en
momentos de mucha carga en su infraestructura), así que tomalo como un "cada
tantos minutos, aproximadamente".

## Fuentes oficiales (boletines, justicia, legislatura, municipio)

Además de los medios de prensa, el proyecto lee páginas **oficiales**:
boletines oficiales, la Justicia, la Legislatura provincial, el Concejo
Deliberante de Salta capital y las contrataciones/licitaciones del
Ministerio de Economía y de la Municipalidad. Esto lo hace un segundo
recolector, `scripts/oficiales.py`, con su propio
workflow (`.github/workflows/oficiales.yml`) que corre **3 veces por día**
(7:15, 11:15 y 17:15 hs de Argentina), porque los boletines salen una vez
por día y no tiene sentido mirarlos cada 5 minutos. No hay que instalar
nada extra ni crear cuentas: usa solo lo que trae Python.

**Qué fuentes lee hoy** (todas configuradas en `data/fuentes_oficiales.json`):

| Fuente | Qué trae | Qué esperar |
|---|---|---|
| Boletín Oficial de la Nación, 1ª sección | Leyes, decretos, resoluciones, disposiciones del día. Lee el texto de cada decreto/resolución para detectar nombres. | Debería funcionar |
| Corte Suprema de Justicia de la Nación | Novedades de la portada (fallos, acuerdos, comunicados) | Debería funcionar — **dominio corregido**, ver abajo |
| Poder Judicial de Salta | Noticias de prensa | Debería funcionar |
| Boletín Oficial de la Provincia de Salta | Instrumentos publicados (decretos, resoluciones, acordadas de la Corte de Justicia de Salta) | **Probablemente bloqueada** (ver abajo) |
| Ministerio de Economía y Servicios Públicos de Salta | Noticias y comunicados oficiales de la Provincia | Debería funcionar |
| Municipalidad de Salta capital — Contrataciones | Llamados a licitación y a contratación | Debería funcionar |
| Municipalidad de Salta capital — Boletín Oficial | Ediciones del Boletín Oficial Municipal | Debería funcionar |
| Cámara de Senadores de Salta | Informe de sesión, Boletín de Asuntos Entrados, Orden del día, Versiones Taquigráficas | Debería funcionar (solo portada) |
| Cámara de Diputados de Salta | Noticias de la Cámara | Debería funcionar (solo portada) |
| Concejo Deliberante de Salta capital | Actividad legislativa (comisiones, dictámenes, sesiones) | Debería funcionar |

**Importante: la primera corrida real es la prueba de verdad.** El código
se probó contra copias de la estructura de estas páginas, pero no contra los
sitios en vivo. Después de la primera corrida, abrí `oficiales.html` y mirá
"Estado de las fuentes": ahí dice, fuente por fuente, si funcionó, cuántas
publicaciones reconoció y cuántos documentos pudo leer. Si alguna dice
"error" o "sin resultados", copiá ese mensaje y pedí que la ajusten: es lo
esperable con sitios que cambian su diseño sin avisar.

**Sobre el Boletín Oficial de Salta.** Al momento de armar esto, el sitio
`boletinoficialsalta.gob.ar` no permite el acceso automático (lo indica en
su archivo `robots.txt`). El recolector **respeta ese pedido**: si sigue
bloqueado, no accede y lo informa como "bloqueada" en `oficiales.html`. No
se intenta esquivar. Si querés esa fuente sí o sí, la vía correcta es
pedirle al organismo un acceso autorizado (por ejemplo una API o un
convenio de datos abiertos) o consultarlo a mano. Si algún día lo
habilitan, empieza a funcionar sola sin tocar nada.

**Sobre "Corte Suprema de Salta".** La máxima instancia judicial de Salta
se llama **Corte de Justicia de Salta** (su sitio es
`justiciasalta.gov.ar`). La página de "Acordadas" de ese sitio no publica el
listado: lo deriva a un sistema interno. Por eso, las acordadas de la Corte
de Justicia de Salta hoy solo se podrían obtener por el Boletín Oficial de
Salta (ver punto anterior). Su portada (`justiciasalta.gov.ar/es/`) no se
agregó aparte porque muestra las mismas noticias que ya lee la fuente
"Poder Judicial de Salta", solo que menos.

**Corrección: el dominio de la Corte Suprema de la Nación estaba mal.** La
fuente que ya tenías cargada apuntaba a `csjn.gob.ar`, un dominio que no es
el sitio oficial. El sitio real es **`csjn.gov.ar`** (con "v", no con "b").
La corregí y ahora lee la sección "Novedades" de esa portada. Sus páginas de
"Acordadas" y "Resoluciones" tienen un buscador por fecha que carga los
resultados recién después de tocar "Buscar" (con JavaScript), así que no se
pueden leer con este recolector tal como está armado; quedan afuera por
ahora.

**Sobre el Portal de Compras y Contrataciones de Salta
(`compras.salta.gob.ar`).** Lo abrí y confirmé que es real: agrupa las
licitaciones de todos los organismos provinciales (ministerios, hospitales,
etc.). No lo agregué porque cada publicación de esa lista **no tiene un
enlace propio** — es una tabla de texto con un botón para ver el pliego
adjunto, sin una dirección individual por publicación que se pueda guardar
como "el enlace al documento original". Este recolector solo sabe leer
listas armadas con enlaces (`<a href="…">`); una fuente así necesitaría un
lector hecho a medida para esa página en particular. Si te sirve igual,
avisame y lo armamos aparte.

**Sobre "Licitaciones" del Ministerio de Educación de la Nación
(`argentina.gob.ar/educacion/licitaciones`).** También la revisé: la tabla
de licitaciones de esa página se carga con JavaScript (queda vacía si se lee
el HTML tal cual llega), y además es de alcance nacional, no de Salta
capital ni de la provincia. La dejé afuera por las dos razones.

### Cómo sumar otra página oficial

1. Abrí `data/fuentes_oficiales.json` en GitHub y clic en el lápiz.
2. Copiá un bloque `{ ... }` completo, pegalo al final (con una coma
   entre bloques) y cambiá `id`, `name`, `url` y `link_pattern`.
3. `link_pattern` es un fragmento del enlace que tienen en común las
   publicaciones de esa página (por ejemplo `/prensa-detalle/`). Abrí la
   página, pasá el mouse sobre dos o tres publicaciones y mirá qué parte de
   la dirección se repite.
4. Guardá (Commit changes). El workflow corre solo al cambiar este archivo.
5. Mirá `oficiales.html`, sección "Estado de las fuentes": si dice
   "sin resultados", el patrón no coincide o el sitio carga su contenido con
   JavaScript (este recolector no ejecuta JavaScript).

Solo agregá páginas que hayas abierto vos y confirmado que son oficiales.

### Cómo se detecta un nombre (y por qué hay que confirmarlo)

- Se busca el **nombre completo** (2 o más palabras) de cada persona de
  `politicians.json`, y también el formato de decretos "Apellido, Nombre".
  Un apellido suelto ("Sáenz") **no** se busca en documentos oficiales,
  porque daría falsos positivos (Sáenz Peña, otras personas con ese
  apellido).
- Aun así es una **coincidencia de texto, no una verificación de
  identidad**: puede haber homónimos. Por eso el panel muestra el fragmento
  donde apareció el nombre y el enlace al documento oficial. Confirmalo
  siempre ahí antes de afirmar algo.
- Los nombres se buscan en el título y resumen de cada publicación y, para
  el Boletín Oficial de la Nación, también dentro del texto de cada decreto,
  resolución y disposición (hasta 80 documentos nuevos por corrida).
- No se leen PDF escaneados ni imágenes (no hay OCR). Si un documento solo
  está como imagen, no se lee su contenido.

### Qué NO incluye esta versión, y por qué

- **Instagram.** La API oficial de Meta está pensada para administrar tu
  propia cuenta profesional, no para leer publicaciones y comentarios de
  cualquier político. Las herramientas que raspan Instagram sin permiso
  (como `instaloader`) violan sus términos de uso y pueden terminar en el
  bloqueo de tu cuenta. Igual que antes, esto queda afuera.
- **Base de datos vectorial (Supabase/pgvector) y consultas con IA
  ("RAG").** Hoy no hacen falta: todo se guarda en archivos dentro del
  repositorio y se muestra con filtros. Sumar una base de datos y una API
  de IA agrega costos, cuentas, claves secretas y mucho más para mantener.
  Tiene sentido recién cuando quieras hacer *preguntas en lenguaje natural*
  sobre los documentos ("¿qué decretos firmó X en 2026?") y ya tengas
  cargado un volumen grande de documentos. Una IA con documentos recuperados
  reduce los errores, pero no los elimina: una respuesta generada siempre
  debe confirmarse contra el documento oficial.
- **PDF con OCR** de boletines provinciales, por lo mismo: hoy la fuente
  provincial principal está bloqueada, y sin fuente no hay nada que leer.

## Mantenimiento

- Si el repositorio no tiene ningún commit en 60 días, GitHub pausa
  automáticamente los workflows programados. Alcanza con entrar a Actions y
  reactivarlo, o editar `politicians.json` de vez en cuando.
- Si agregás medios nuevos, sumalos a la lista `SOURCE_SITES` en
  `scripts/monitor.py`.

## Buscador libre (opcional)

El panel tiene un cuadro para buscar cualquier palabra en vivo, no solo entre
los políticos configurados. Técnicamente, esto no lo puede hacer el navegador
solo: Google News bloquea que una página web le pida datos directamente
(protección llamada CORS). Por eso hace falta un intermediario gratuito:

1. Entrá a `cloudflare-worker/search-proxy.js` en este proyecto.
2. Seguí las instrucciones que están comentadas arriba del archivo (crear
   cuenta gratis en Cloudflare Workers, pegar el código, publicar).
3. Copiá la URL que te da Cloudflare (algo como
   `https://radar-search.tu-cuenta.workers.dev`).
4. En `index.html`, buscá la línea `const SEARCH_PROXY_URL = "";` y pegá
   ahí tu URL, entre las comillas.
5. Subí el cambio a GitHub.

Sin este paso, el buscador libre simplemente queda desactivado (no rompe
nada del resto del panel).

## Sobre señales judiciales — leé esto antes de confiar en esa sección

La ficha de cada político puede mostrar una sección roja de "menciones con
vocabulario judicial en prensa". Es importante entender exactamente qué es:

- Es una marca automática que se activa cuando el **título** de una nota
  contiene palabras como "denuncia", "imputado", "causa judicial", "fiscalía",
  etc.
- **No verifica si la persona tiene realmente una causa judicial.** No
  distingue si la nota acusa a esa persona, si menciona a un tercero, si es
  una desmentida, o si la persona es querellante en vez de imputada.
- Existe para que no se te pase una noticia relevante entre cientos, no para
  reemplazar la lectura de la nota original — que siempre está linkeada.

Nunca uses esta sección para afirmar algo sobre una persona sin haber leído
la nota completa. Yo (Claude) tampoco puedo verificar el estado judicial real
de nadie, así que el sistema está diseñado a propósito para no hacer esa
afirmación por vos.

## Sobre los "eventos" (el cerebro) — también con límites reales

`eventos.html` agrupa automáticamente noticias que comparten varias palabras
significativas en el título dentro de una ventana de 72 horas. Es una forma
simple y honesta de detectar "esto lo están cubriendo varios medios a la
vez", pero:

- Es agrupamiento por texto, no comprensión del significado. Dos notas sobre
  temas distintos que casualmente usan las mismas palabras pueden agruparse
  por error.
- No entiende causa y efecto, ni cronología narrativa, ni relevancia — solo
  coincidencia de vocabulario y cercanía en el tiempo.
- Cuantas más fuentes tengas cargadas, mejor va a funcionar esto (con pocas
  fuentes, es raro que dos noticias del mismo hecho coincidan).

Si en algún momento querés que la agrupación sea más precisa (entendiendo
significado, no solo palabras), ahí sí hace falta un modelo de lenguaje
comparando los textos — mismo trade-off que las contradicciones: mejor
calidad, pero deja de ser gratis.

## Sobre "destacar" cosas (☆)

En varias secciones vas a ver un ícono ☆ junto a menciones, citas y
artículos. Al tocarlo, ese elemento queda guardado en **destacados.html**.

Importante — cómo funciona de verdad: esto se guarda en el `localStorage`
del navegador donde lo tocaste, **no** en el repositorio ni en ningún
servidor. Eso significa:

- Si destacás algo desde tu computadora, no lo vas a ver si abrís el panel
  desde el celular (ni al revés).
- Si borrás datos de navegación o usás modo incógnito, se pierde.
- Nadie más que vos ve tus destacados — no hay forma de "compartir" esta
  lista con otra persona tal como está armado ahora.

Si en algún momento necesitás que los destacados se guarden de forma
compartida y persistente (por ejemplo, para que un equipo marque cosas en
conjunto), eso ya requiere un backend con usuarios y permisos — deja de ser
un sitio 100% estático y gratis en el sentido en que lo armamos. Avisame si
llegás a necesitar eso y lo evaluamos.

## Sobre declaraciones y contradicciones

La ficha de cada político (`politico.html`) muestra frases citadas entre
comillas que aparecen en los títulos de las notas (extracción de texto, no
verificación periodística — siempre hay un link a la nota original).

Lo que **no** hace, y por qué: detectar que un político se contradijo (dijo A
en marzo y lo opuesto en agosto) requiere comparar el *significado* de dos
frases, no solo sus palabras. Un conteo de palabras clave da falsos
positivos todo el tiempo (por ejemplo, "no vamos a subir impuestos" y "vamos
a subir impuestos" comparten casi todas las palabras y dicen lo contrario).
Eso lo puede hacer razonablemente bien un modelo de lenguaje leyendo pares de
declaraciones, no una heurística gratuita.

Si en algún momento querés sumar esto: la forma más simple es, en
`scripts/monitor.py`, agregar una función que tome las citas ya extraídas de
un mismo político y le pida a la API de Claude (con tu propia clave, pagando
por uso) que evalúe si dos frases son consistentes o contradictorias. El
volumen de este proyecto (unas pocas citas nuevas por día y por político) lo
hace muy barato de correr, pero deja de ser "gratis" en sentido estricto.
Avisame si querés que lo arme cuando llegues a ese punto.

## Por qué GitHub y no Cloudflare para el motor del proyecto

Cloudflare Workers permite cron cada 1 minuto (mejor que los 5 minutos de
GitHub), pero en su plan gratuito cada ejecución tiene solo 10 milisegundos
de CPU y un tope de 1.000 escrituras de datos por día — con cron de 1 minuto
ya necesitarías 1.440 escrituras. No alcanza para recolectar y guardar datos
de este tamaño. GitHub Actions no tiene ese límite de escrituras (son commits
a tu propio repositorio) y da varias horas de cómputo por corrida, así que es
la base más sólida para esto. Cloudflare sí es una buena herramienta puntual
para el buscador libre (una sola consulta liviana, sin guardar nada), que es
como lo usamos acá.

## Sobre "big data" y actualización por minuto

Con las herramientas 100% gratuitas que usa este proyecto, dos límites son
reales y no se pueden esquivar:

- **Frecuencia:** GitHub Actions no ofrece programaciones de menos de 5
  minutos. "Cada 1 minuto" no es una opción, ni pagando ese servicio.
  (Hay una excepción, solo para las noches de elecciones: el workflow
  `elecciones.yml` no usa esa programación sino una única tarea larga que
  consulta la fuente cada ~60 segundos. Igual queda una demora de varios
  minutos por la publicación de GitHub Pages. Ver la sección "Elecciones".)
- **Volumen:** esto es un monitor de medios (decenas o cientos de notas por
  día), no "big data" en el sentido técnico de petabytes o procesamiento
  distribuido. Para el objetivo real — seguir menciones y su tono — no hace
  falta esa escala, y perseguirla sin presupuesto sería gastar esfuerzo en
  algo que no cambia el resultado que ves en el panel.

## Elecciones: candidatos y resultados en vivo

La pestaña **Elecciones** está siempre visible y tiene tres subsecciones que se
completan solas según el calendario:

- **Próximas:** una tarjeta por elección con cuenta regresiva y fechas clave.
- **Candidatos:** se habilita 60 días antes de la elección. Cada candidato
  lleva su fuente; si no la tiene, se muestra como "no confirmado".
- **Resultados:** el día de la elección y hasta 7 días después. Nunca muestra
  nada antes de las 21:00 de Argentina (o de la hora que pongas en
  `no_publicar_antes`).
- **Noticias:** titulares y publicaciones de boletines oficiales sobre
  elecciones, con filtro Salta / Argentina. Se arma sola y se renueva cada
  ~10 minutos.

Arriba de **Próximas** aparecen, mientras estén vigentes, los avisos con fecha
de vencimiento (por ejemplo, la consulta extraordinaria del padrón provisorio,
abierta hasta el 30 de noviembre de 2026). Se cargan en la lista `hitos` de
`data/elecciones.json` y desaparecen solos al pasar la fecha.

Para ver cómo queda sin esperar una elección, agregá `#/elecciones/demo` al
final de la dirección del sitio (son datos inventados).

### Qué archivo es cada cosa

- `elecciones.js` — la pantalla.
- `data/elecciones.json` — **el único que editás a mano**: calendario,
  candidatos y de dónde salen los resultados. Tiene un ejemplo de candidato
  dentro del mismo archivo.
- `data/elecciones_resultados.json` y `data/elecciones_resultados_historial.json`
  — los escribe el recolector solo. No los toques.
- `data/elecciones_demo.json` — la elección de ejemplo.
- `data/elecciones_simulacro.json` — la elección inventada del simulacro (y sus
  resultados, en `data/elecciones_resultados_simulacro*.json`, que se generan
  solos).
- `scripts/elecciones_noticias.py` y `.github/workflows/elecciones_noticias.yml`
  — separan, de lo que ya recolecta el proyecto (`news_general.json` y
  `oficiales.json`), lo que trata de elecciones, y lo guardan en
  `data/elecciones_noticias.json` (no lo toques).
- `scripts/elecciones.py` y `.github/workflows/elecciones.yml` — el recolector
  y el workflow que lo corre.
- `scripts/avisar_falla.py` — manda un aviso corto a tu celular (usa los mismos
  secretos del resumen diario: `NTFY_TOPIC` o `TELEGRAM_BOT_TOKEN` y
  `TELEGRAM_CHAT_ID`; si no hay ninguno configurado, lo anota en el registro y
  sigue).
- `test_elecciones_recolector.py`, `test_elecciones_noticias.py` y
  `test_avisar_falla.py`, `test_elecciones_simulacro.py` y `test_modulos_clave.py`
  (en `tests/` o en `scripts/`) — las pruebas
  automáticas. La corrida "Pruebas" las ejecuta.

### Qué hacer antes de cada elección

1. Cuando se publique la convocatoria oficial, escribí la `fecha` en
   `data/elecciones.json` (formato `AAAA-MM-DD`). Mientras sea `null`, la
   elección figura como "fecha sin confirmar". **El sistema te avisa:** si en
   un boletín oficial aparece algo como "Convócase al cuerpo electoral…", sale
   un recuadro destacado en Próximas y en Noticias, con el enlace y la fecha de
   votación que figura en el texto. Es una pista: confirmala en el boletín
   antes de cargarla. (En 2023 el decreto de Salta se publicó el 21 de octubre
   de 2022, unos siete meses antes de la votación.)
2. Cuando la Justicia Electoral oficialice las listas, cargá los candidatos en
   la lista `candidatos` de esa elección, **siempre con `fuente_url`**.
3. Para elecciones nacionales, los resultados salen de la API oficial de la
   Dirección Nacional Electoral. Leé sus condiciones de uso
   (`resultados.mininterior.gob.ar/tos.html`, citadas en su documentación).
   Si la API pide token, se solicita a `soportedine@mininterior.gob.ar` y se
   guarda en GitHub como secreto: Settings > Secrets and variables > Actions >
   New repository secret, con el nombre `DINE_TOKEN`.
4. En **Actions > Resultados electorales > Run workflow**, corré `probar_dine`:
   consulta la API con la elección de 2023 y guarda en
   `data/elecciones_diagnostico_dine.json` cómo responde (códigos de distrito y
   categoría, si pide token). Con eso se completa la lista `categorias`; hoy
   solo está confirmado el código 1 (Presidente).
5. Ensayá todo el recorrido: **Run workflow** con la opción `simulacro`.
   Durante unos 15 minutos genera una elección INVENTADA cuyo conteo avanza
   solo, y lo hace pasar por el mismo camino que una real (validación,
   subida a GitHub, GitHub Pages, pantalla y avisos al celular). Miralo en
   `#/elecciones/simulacro` (agregá eso al final de la dirección del sitio):
   la línea «Dato oficial de las… (hace…)» te muestra la demora real de punta
   a punta en tu sitio. No toca ninguna elección real y se puede repetir las
   veces que quieras. Con la opción `probar_aviso` probás solo el mensaje al
   celular. Si no hay una elección
   activa, termina en segundos con un mensaje claro.
6. La noche de la elección no hay que hacer nada: el workflow arranca solo a
   las 20:30 de Argentina y te avisa al celular cuando llega el primer dato,
   si falla 5 veces seguidas la lectura de la fuente, si pasan 20 minutos sin
   datos nuevos, o si la corrida se cae (siempre que tengas configurado
   ntfy o Telegram para el resumen diario). Igual, mirá **Actions** por las
   dudas.

### Cómo viaja un dato

Fuente oficial → recolector (cada ~60 segundos) → se sube al repositorio →
GitHub Pages lo publica (1 a 3 minutos) → la pantalla lo busca cada 30
segundos. La demora total típica es de 2 a 3 minutos. La pantalla muestra la
hora del dato oficial y hace cuánto se consultó, y se pone en rojo si pasan
más de 15 minutos sin novedades.

### Qué cuida el sistema

- Antes de guardar, el recolector valida los datos (mesas, votos, fechas, que
  el conteo no retroceda). Si algo no cierra, conserva lo anterior y lo cuenta
  en el registro de la corrida.
- Compara lo que informa la API con lo que se deduce de sus propios números y
  muestra un aviso si no coinciden.
- Detecta solo sobre qué total calcula la Dirección Nacional Electoral sus
  porcentajes (positivos, válidos o emitidos) y lo aclara en pantalla.
- Las noticias se filtran automáticamente con reglas cuidadas (se descartan
  deportes, espectáculos, presupuestos y elecciones de otros países). Puede
  haber alguna omisión y, raramente, un titular de más. Un titular se marca
  "Salta" solo si nombra a Salta o a su gobernador, o si es de un medio
  salteño y habla de autoridades locales; ante la duda queda en "Argentina".
- Respeta el `robots.txt` de cada sitio. Si no puede confirmarlo, no accede.
- El conteo provisorio se rotula siempre como provisorio y sin valor legal.
  La estadística que muestra (ritmo, votos pendientes, evolución de la
  diferencia) es descriptiva: **no es una proyección**.
- En 2025 la Cámara Nacional Electoral ordenó difundir el recuento por
  distrito y no como un total nacional único.

### Qué todavía NO está hecho

- **Lista de candidatos de 2027:** hoy está vacía a propósito. Nadie está
  oficializado todavía; los nombres que circulan en la prensa son
  precandidaturas. Cargar nombres sin oficialización exige criterio parejo
  entre todas las fuerzas y fuente para cada uno.

- **Elecciones provinciales de Salta:** no pasan por la API nacional. En 2025
  fueron el 11 de mayo, con Boleta Única Electrónica, y el conteo provisorio lo
  difundió el Gobierno provincial; el definitivo, el Tribunal Electoral
  (`electoralsalta.gov.ar`). Falta el lector de esa fuente: primero hay que ver
  cómo publica los datos.
- **La API de la Dirección Nacional Electoral no se probó con datos reales**,
  porque el entorno donde se desarrolló no tiene acceso a ese sitio. Por eso
  el paso 4 de arriba es obligatorio.
- **Menos de 1 minuto de demora:** con GitHub no se puede. Haría falta un
  intermediario en Cloudflare (y permitir esa conexión en la política de
  seguridad de `index.html`).

## Briefing de noticias

Resumen de lo que publicaron los medios, calculado solo con los datos que ya
recolecta el proyecto (`data/news_general.json`). Vive dentro de `index.html`.

- **Ventanas:** 24 horas, 48 horas o 7 días, contadas hasta la nota más
  reciente recolectada. Se puede filtrar por ámbito (Salta, Nación, cruce),
  tema, persona o texto.
- **Resumen ejecutivo y números:** notas, historias, medios y porcentaje de
  Salta. Cada número se puede tocar para ir al detalle.
- **Todas las historias:** recorrido completo (se ven de a 30 y se piden más),
  ordenado por cobertura, por fecha o por importancia, con filtro por medio.
  Se puede **descargar en CSV**.
- **Trazabilidad:** cada historia muestra todas las notas que la forman, con su
  medio, su hora y su enlace al original, y el título de cada una para verificar
  que se agruparon bien.
- **Cómo se calculó esto:** al final de la pantalla se explica la ventana, cuántas
  notas hay y cuántas se descartaron, cómo se agrupan, cómo se puntúa y qué se
  oculta por defecto.
- **Qué se oculta por defecto:** deportes y espectáculos (casilla «Incluir
  deportes y espectáculos») y pronósticos del tiempo. Siguen contados y se ven en
  «Todas las historias». La clasificación usa una palabra inequívoca, un club de
  nombre ambiguo con contexto deportivo, o un medio deportivo; puede fallar en
  casos raros.
- **Argentina vista desde afuera:** solo diarios extranjeros que nombran a
  Argentina en el titular, sin deportes, ordenados por relevancia.
- **Límites:** no mide lecturas ni verifica si lo publicado es cierto.

## Si desaparece una pantalla o una función

**Qué pasó el 14/11/2026.** Una subida con "Add files via upload" reemplazó
cuatro archivos por otras versiones, mucho más chicas y distintas (hechas sin
conocer lo que ya existía): `briefing.js`, `envivo.js`, `modern.js` y
`elecciones.js`. Resultado: desaparecieron las pestañas **Briefing** y
**Mundo**, y se perdieron funciones de En vivo, de los mapas y de Elecciones.
`index.html` no tuvo nada que ver.

**Qué archivo hace qué** (para saber dónde mirar):

- `index.html` — contiene el **Briefing** completo (su pantalla y su pestaña) y
  carga `mundo.js`. El archivo `briefing.js` ya no se usa y se puede borrar.
- `mundo.js` — la pestaña **Mundo** (prensa internacional). Lo carga `index.html`
  directamente.
- `envivo.js` — la pestaña **En vivo** (pared de TV).
- `modern.js` — la capa visual de los mapas.
- `elecciones.js` — la pestaña **Elecciones**.

**Cómo te enterás.** La corrida "Pruebas" (en la pestaña Actions) incluye una
alarma, `test_modulos_clave.py`: si un módulo pierde sus funciones clave, o si
`index.html` pide un archivo que no existe, o un archivo de datos importante
(políticos, canales en vivo, noticias, oficiales, elecciones) queda vacío o con
el formato roto, se pone en rojo y dice cuál archivo y qué perdió. Si cambiás un módulo a propósito, actualizá la lista `MARCAS`
de ese archivo.

**Cómo volver atrás (sin saber de Git).** Todo lo anterior queda guardado:

1. En GitHub abrí el archivo, por ejemplo `briefing.js`.
2. Tocá **History** (arriba a la derecha).
3. Elegí el cambio ANTERIOR a la subida equivocada (fijate en la fecha y la
   hora) y entrá a él.
4. En el archivo, tocá los tres puntos **…** y **View file**.
5. Tocá **Raw** (o el ícono de descarga) para bajar esa versión.
6. Subila de nuevo con **Add file > Upload files**, en la misma carpeta.

**Regla de oro.** Antes de subir un archivo que ya existe, compará los tamaños:
si el nuevo pesa mucho menos (por ejemplo, la mitad), casi seguro es otra
versión y va a borrar funciones. Cuando pidas cambios a un asistente, pasale
siempre el archivo actual completo del repositorio para que parta de él.

## Sobre Instagram y otras redes sociales

Sigue sin haber una forma gratuita y legal de rastrear automáticamente
publicaciones o comentarios de Instagram, Facebook o TikTok: son plataformas
cerradas que bloquean activamente el scraping y cuyos términos de servicio
lo prohíben. Lo único que se puede hacer sin infringir nada es **incrustar
manualmente** posteos públicos puntuales (con el widget oficial de embed de
Instagram, pegando la URL de cada posteo que vos elijas) — no es un rastreo
automático ni una búsqueda, es mostrar publicaciones específicas que ya
conocés.

## Seguridad

Este sitio es de **solo lectura**: no tiene login, no guarda datos de
quienes lo visitan, y no tiene una base de datos expuesta que alguien pueda
"hackear" en el sentido tradicional. Aun así, estas son las prácticas reales
que conviene mantener:

- **Nunca pongas claves ni tokens en `index.html` ni en ningún archivo del
  repositorio.** Todo lo que esté en el navegador es público, lo vea quien
  lo vea. Si en el futuro sumás una API que pida clave, esa clave va como
  "Secret" de GitHub Actions (Settings → Secrets and variables → Actions),
  nunca en el código del frontend.
- **Activá la autenticación en dos pasos (2FA)** en tu cuenta de GitHub y en
  tu cuenta de Cloudflare, si usás el buscador libre. Es la protección más
  efectiva contra que alguien tome control de tu cuenta y modifique el
  repositorio o el Worker.
- **Protegé la rama `main`** (Settings → Branches → Add rule) si en algún
  momento vas a compartir el repositorio con otras personas, para que nadie
  pueda subir cambios directamente sin revisión.
- El Worker de búsqueda libre valida el largo del parámetro recibido y solo
  responde a tu dominio de GitHub Pages (`ALLOWED_ORIGIN`), para que no
  cualquier otra página pueda usarlo gratis a costa tuyo.
- GitHub Pages sirve todo por HTTPS automáticamente; no hay nada que
  configurar ahí.

## Próximos pasos posibles (no incluidos acá)

- Reemplazar el análisis de tono por palabras clave por una llamada a un
  modelo de lenguaje (más preciso, pero deja de ser 100% gratis salvo que
  tengas créditos disponibles).
- Sumar una fuente de "clima de opinión pública" basada en encuestas
  publicadas por los propios medios, en lugar de redes sociales.


## Integración NEWAR + Radar

Todo el Radar vive ahora dentro de NEWAR: `index.html` es la única página (Inicio, Personas, Menciones, Temas, Eventos, Resumen, Oficiales, Destacados). Las páginas `centro/politico/temas/tema/briefing/destacados/eventos/oficiales.html` y `shared.js` se eliminaron; los recolectores, workflows y `data/` no cambian. Las personas/cargos/evidencia de NEWAR se derivan de `data/politicians.json` en el navegador; las filas con nombre repetido quedan «en revisión». Las estrellas guardadas usan la misma clave de antes.
