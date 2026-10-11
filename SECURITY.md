Seguridad de NEWAR
NEWAR es un monitor político-institucional de Salta que usa solo datos públicos y legales. No hay
vigilancia encubierta ni nada parecido a spyware. Este documento resume cómo se protege el proyecto y qué
tenés que activar vos en GitHub (eso no se puede hacer desde el código).
Qué hace el código para protegerse
Sin claves en el repo. Todo dato de entrega (tema de ntfy, token de Telegram) vive en Secrets de GitHub.
El `.gitignore` bloquea archivos típicos de claves y la auditoría automática busca secretos en cada cambio.
Política de contenido (CSP) en el `<meta>` de `index.html`: `default-src 'none'`, sin frames, sin objetos,
sin `<base>`, sin formularios; solo se conecta al propio sitio. Limitación conocida: usa `'unsafe-inline'`
porque la página es un único archivo con scripts y estilos en línea.
Referrer `no-referrer` en toda la página, protección anti-frame y enlaces externos con `rel="noopener"`.
Texto externo siempre escapado. Todo texto que viene de medios o fuentes pasa por `esc()`, todo enlace por
`safe()`, y todo dato dentro de un manejador en línea (`onclick="..."`) por `jq()` (o va en `data-*`).
Regla clave: `esc()` solo NO alcanza dentro de `onclick="f('…')"`, porque el navegador revierte las
entidades antes de ejecutar.
Workflows blindados. Acciones fijadas por commit (no por etiqueta), permisos mínimos, `timeout-minutes`
en cada trabajo, nada de `${{ }}` con datos externos dentro de `run:`.
Dependabot semanal para las acciones de GitHub.
Auditoría automática (`scripts/auditoria_seguridad.py`, workflow `seguridad.yml`): corre en cada cambio y
cada lunes. Revisa secretos, CSP, textos sin `esc()`, manejadores sin `jq()`, datos con código escondido,
workflows y llamadas peligrosas de Python.
No se copian textos de notas: solo título, medio, hora y enlace. Se respeta `robots.txt` y no se raspan
redes sociales.
Lo que tenés que activar vos en GitHub (una sola vez)
Verificación en dos pasos (2FA) en tu cuenta: Settings → Password and authentication.
Secret scanning y Push protection: Settings del repo → Code security → Secret scanning (activá las dos).
Dependabot alerts: en la misma pantalla.
Protección de la rama `main`: Settings → Branches → Add rule para `main`, con:
bloquear force pushes y bloquear el borrado de la rama;
no marques «Require a pull request», porque el bot hace `push` directo a `main` para guardar los datos.
Permisos de Actions: Settings → Actions → General → Workflow permissions: dejá «Read and write permissions»
(el bot necesita escribir en `data/`) y destildá «Allow GitHub Actions to create and approve pull requests».
Secrets: cargalos en Settings → Secrets and variables → Actions → New repository secret (nunca en un archivo).
Si se filtra una clave
Revocala en el servicio de origen (en Telegram: `/revoke` con @BotFather; en ntfy: cambiá el tema).
Cargá la nueva en Secrets.
Borrar el archivo del repo no alcanza: el historial de Git conserva la clave. Por eso se revoca primero.
Cómo reportar un problema de seguridad
Abrí una Security advisory privada en la pestaña Security del repo (no publiques el problema en un issue).
