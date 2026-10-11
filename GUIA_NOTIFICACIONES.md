Guía: recibir el resumen diario en tu celular
Todos los días a las 08:40 (hora de Argentina) NEWAR te manda el resumen de ayer: las historias de
política y de seguridad (Provincia de Salta y resto del país), con los medios que dice cada una.
Llega solo a vos. Podés usar ntfy (lo más simple, no pide cuenta), Telegram, o los dos.
> Ninguna clave se escribe en archivos del proyecto. Todo se carga en **Secrets** de GitHub.
---
Opción A — ntfy (recomendada, ~5 minutos)
Paso 1. Instalá la app en el celular
Buscá ntfy en Play Store (Android) o App Store (iPhone) e instalala. Es gratis.
Paso 2. Inventá tu «tema» secreto
El tema es como el nombre de tu canal privado. Cualquiera que lo sepa puede leerlo, así que tiene que ser
largo y imposible de adivinar. Ejemplo (NO uses este, inventá el tuyo):
`newar-k7Qp2xLm9vTz4RbA8wYc`
Reglas: entre 16 y 64 caracteres, solo letras, números, guion `-` y guion bajo `_`. Mezclá mayúsculas, minúsculas
y números sin sentido. No uses tu nombre ni «salta».
Paso 3. Suscribite en la app
En ntfy tocá + → escribí tu tema exactamente igual → Subscribe.
Paso 4. Cargá el tema en GitHub
Entrá a tu repo en GitHub: `github.com/nexxusconsultora-lab/salta-monitor`.
Settings (arriba a la derecha del repo) → en el menú de la izquierda Secrets and variables → Actions.
Botón verde New repository secret.
Name: `NTFY_TOPIC` (en mayúsculas, exacto). Secret: pegá tu tema. → Add secret.
Paso 5. Probalo ya, sin esperar a mañana
En el repo, pestaña Actions.
A la izquierda elegí Notificar el resumen diario al celular.
Botón Run workflow (a la derecha) → tildá «Enviar aunque ese día ya se haya avisado» → Run workflow verde.
Esperá ~1 minuto. Si todo salió bien, el círculo queda verde ✓ y te llega la notificación al celular.
Si queda rojo ✗, hacé clic en la corrida y abrí el paso Enviar la notificación: el mensaje dice qué falló
(ver «Problemas frecuentes» más abajo).
---
Opción B — Telegram (opcional)
En Telegram buscá @BotFather → escribí `/newbot` → seguí los pasos (nombre y usuario del bot).
Al final te da un token (algo como `123456789:AAH...`). Guardalo, es una clave.
Abrí el bot que creaste y mandale cualquier mensaje (por ejemplo «hola»).
Para saber tu chat id: en el navegador abrí `https://api.telegram.org/bot` + tu token + `/getUpdates`
y buscá `"chat":{"id":` seguido de un número. Ese número es tu chat id.
En GitHub cargá dos secrets (igual que en el Paso 4 de ntfy):
`TELEGRAM_BOT_TOKEN` = el token
`TELEGRAM_CHAT_ID` = el número
Probalo con Run workflow como en el Paso 5.
Si ya tenías cargados esos dos secrets para las alertas de fuentes oficiales, se reutilizan: no hace falta cargarlos de nuevo.
---
Cómo funciona por dentro (por si te interesa)
Corre todos los días 11:40 UTC = 08:40 en Argentina. GitHub a veces demora unos minutos: es normal.
Antes de avisar arma el resumen de ayer y de hoy (`scripts/resumen_diario.py`).
No repite: anota en `data/resumenes/notificado.json` qué día ya se avisó por cada canal.
Reintenta 3 veces si hay un error de red. Si no logra enviar, el workflow se pone rojo y GitHub te manda un mail: así
nunca falla en silencio.
Es una estimación por titulares, sin IA: la separación «Provincia de Salta» / «resto del país» se hace por
los lugares nombrados en el título, y puede equivocarse.
Problemas frecuentes
Lo que dice el error	Qué hacer
`no hay ningún canal configurado`	No cargaste los secrets, o los nombres no son exactos (`NTFY_TOPIC`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
`NTFY_TOPIC tiene que tener entre 16 y 64 caracteres`	Tu tema es corto o tiene símbolos raros. Inventá uno más largo.
`Telegram necesita los dos`	Falta `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_ID`.
`404`	El chat id es incorrecto o nunca le escribiste al bot.
`401` / `403`	El token está mal copiado, o tu servidor ntfy pide login (`NTFY_TOKEN`).
`no existe el resumen de AAAA-MM-DD`	Ese día todavía no se armó el resumen. Esperá a que corra el monitor y probá de nuevo.
Verde ✓ pero no llegó nada	Revisá que el tema de la app sea idéntico al del secret (mayúsculas incluidas).
«Ya se avisó el resumen de…»	Es normal: no repite. Para forzarlo usá Run workflow con la casilla tildada.
Opcionales para ntfy
`NTFY_SERVER`: solo si tenés tu propio servidor ntfy (tiene que empezar con `https://`).
`NTFY_TOKEN`: solo si ese servidor pide usuario y contraseña (token de acceso).
Si creés que alguien más conoce tu tema
Inventá uno nuevo, actualizá el secret `NTFY_TOPIC` (en GitHub: editá el secret) y volvé a suscribirte en la app con el tema nuevo.
