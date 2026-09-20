# Radar Político Salta

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
- **Volumen:** esto es un monitor de medios (decenas o cientos de notas por
  día), no "big data" en el sentido técnico de petabytes o procesamiento
  distribuido. Para el objetivo real — seguir menciones y su tono — no hace
  falta esa escala, y perseguirla sin presupuesto sería gastar esfuerzo en
  algo que no cambia el resultado que ves en el panel.

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
