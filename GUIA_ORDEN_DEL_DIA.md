Guía: alerta temprana del orden del día en Telegram
NEWAR vigila las 4 cámaras (Diputados y Senado de la Nación, Diputados y Senado de Salta). Cuando una publica un
orden del día, plan de labor o convocatoria a sesión nueva, te llega un mensaje de Telegram con el título y el
enlace. Si es un PDF, también lee adentro: te marca los temas vigilados que aparecen (litio, minería,
presupuesto…), los políticos de tu lista que nombra y la fecha de sesión que mencione el texto.
> Ninguna clave en archivos. Usa los mismos Secrets de Telegram que ya tenés (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
---
Qué archivos van y dónde
`scripts/orden_del_dia.py` → carpeta `scripts/` (archivo nuevo)
`data/fuentes_orden_del_dia.json` → carpeta `data/` (archivo nuevo; este lo editás vos a mano)
`.github/workflows/orden_del_dia.yml` → carpeta `.github/workflows/` (archivo nuevo)
`GUIA_ORDEN_DEL_DIA.md` → raíz del repo
No se modifica ningún archivo existente (ni index.html, ni workflows, ni politicians.json).
Paso a paso para ponerlo en marcha
Paso 1. Subí los 4 archivos al repo (GitHub → Add file → Upload files, respetando las carpetas).
Paso 2. Verificá que ya estén los Secrets `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (Settings → Secrets and variables → Actions). Si ya recibís alertas de fuentes oficiales, ya están.
Paso 3. PRUEBA DE DIAGNÓSTICO (importante). Actions → «Orden del día - alerta temprana» → Run workflow → tildá «Solo mostrar qué encuentra…» → Run. Abrí la corrida y el paso «Buscar órdenes del día…».
Para cada cámara vas a ver cuántos enlaces tiene la página y cuáles pasaron el filtro (con ✓). Si no pasó ninguno, lista ejemplos de enlaces descartados para que veas cómo se llaman las secciones.
Paso 4. Ajustá las páginas. Las direcciones de `data/fuentes_orden_del_dia.json` son un punto de partida (las portadas) y NO están verificadas: desde donde se armó esto no se pudieron abrir esos sitios. Para cada cámara abrí en el navegador la sección donde publican el orden del día / plan de labor / sesiones, copiá la dirección exacta y pegala en `url`. Repetí el diagnóstico hasta que aparezcan ✓ con documentos reales. Podés poner varias páginas por cámara.
Paso 5. Corrida normal (Run workflow sin tildar nada). La primera vez de cada cámara guarda lo que ya estaba publicado como línea base y NO avisa (si no, te llegarían decenas de mensajes viejos). Desde ahí avisa solo lo nuevo. Si querés que avise también lo existente: Run workflow con «Avisar también lo que ya estaba publicado».
Cuándo corre
Cada hora, de 08:25 a 20:25 (hora de Argentina), de lunes a viernes. GitHub puede demorar unos minutos. Para cambiar el horario editá la línea `cron` del workflow (hora UTC = Argentina + 3).
Qué te llega
Un mensaje por cámara (hasta 6 novedades por mensaje), con los documentos que tocan tus temas o nombran a gente de tu lista arriba. Siempre dice que es coincidencia de texto y que revises el documento original.
Cómo editar los temas y filtros (`data/fuentes_orden_del_dia.json`)
`temas_vigilados`: palabras que se buscan dentro de los PDF (sin tildes ni mayúsculas, palabra completa). Agregá las tuyas.
`palabras_enlace`: palabras que tiene que tener el título o la dirección del enlace para considerarlo un orden del día.
`excluir_enlace`: lo que se descarta (por ejemplo, los «Diario de sesión», que son de sesiones ya hechas).
`link_pattern` (por página): si lo completás con una expresión regular, reemplaza al filtro de palabras para esa página. Útil cuando los PDF tienen un nombre fijo, como `/wp-content/uploads/\d{4}/\d{2}/.*ORDEN.*\.pdf$`.
Avisos del propio sistema
Si una página falla 6 corridas seguidas, te avisa una sola vez por Telegram. Si una página lleva 3 días sin encontrar nunca un orden del día, también te avisa una vez («revisá esta página»): casi seguro la dirección no es la sección correcta. El estado de cada página queda en `data/orden_del_dia_status.json`.
Limitaciones (para no llevarse sorpresas)
No ejecuta JavaScript: una página que arma su listado con JavaScript queda como `sin_enlaces` y no se puede leer así.
Respeta robots.txt: si un sitio lo prohíbe, queda `bloqueada`.
Un PDF escaneado (solo imagen) se avisa igual con título y enlace, pero sin temas ni personas (no hace OCR).
Detecta que se publicó un documento, no «lo que se va a tratar» si el sitio no lo publica en un archivo o página legible.
Las menciones de personas y temas son coincidencias de texto, no verificación de identidad.
Si Telegram falla, el documento queda sin marcar como avisado y se reintenta en la próxima corrida (el workflow se pone en rojo).
Si Telegram no está configurado, guarda todo y avisa los documentos de los últimos 3 días cuando lo configures.
Problemas frecuentes
`sin_enlaces` → la página arma el listado con JavaScript o cambió. Buscá otra sección o una versión simple del sitio.
`bloqueada` → el robots.txt del sitio no permite el acceso automático. No se fuerza.
`ok` pero 0 coincidencias → la URL no es la sección correcta o los títulos no usan esas palabras; mirá el diagnóstico y ajustá `palabras_enlace` o `link_pattern`.
Verde ✓ pero no llegó nada → era línea base, o no hubo documentos nuevos. Probá con «Avisar también lo que ya estaba publicado».
