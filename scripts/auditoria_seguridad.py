#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auditoría de seguridad de NEWAR (sin red, sin claves, sin librerías externas).

Qué revisa
  1. Secretos: tokens, claves privadas y contraseñas escritas en cualquier archivo del repo.
  2. Política de contenido (CSP) y demás protecciones en el <meta> de index.html.
  3. Textos de fuentes externas insertados en la página sin pasar por esc().
  4. Datos metidos en manejadores en línea (onclick="...") sin pasar por jq(), y enlaces sin safe().
  5. Datos con código escondido (data/**/*.json con <script>, javascript:, onerror=, etc.).
  6. Workflows de GitHub: acciones fijadas por commit, permisos, timeouts, inyección por ${{ }} en run.
  7. Scripts de Python con llamadas peligrosas (eval, exec, os.system, shell=True, verify=False).

Uso (desde la raíz del repo):
    python scripts/auditoria_seguridad.py
    python scripts/auditoria_seguridad.py --raiz /ruta/a/otra/copia      # para probar una copia

Sale con código 1 si hay algún ERROR (así el workflow se pone en rojo). Los AVISO no hacen fallar.
Para saltear una línea de index.html que sabés que es segura, escribí «audit:ok» en un comentario de esa línea.
"""
import argparse
import json
import os
import re
import sys

ERRORES, AVISOS = [], []


def error(donde, msg):
    ERRORES.append(f"{donde}: {msg}")


def aviso(donde, msg):
    AVISOS.append(f"{donde}: {msg}")


def leer(ruta):
    try:
        with open(ruta, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return None


def linea_de(texto, pos):
    return texto.count("\n", 0, pos) + 1


def enmascarar(s):
    s = str(s)
    return s[:4] + "…" + s[-2:] if len(s) > 8 else "…"


# ----------------------------------------------------------------------------------------------
# 1. Secretos
# ----------------------------------------------------------------------------------------------
PATRONES_SECRETOS = [
    ("token de GitHub", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("token de bot de Telegram", re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")),
    ("token de ntfy", re.compile(r"\btk_[a-z0-9]{29}\b")),
    ("clave de AWS", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("clave de Google", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("clave de Anthropic u OpenAI", re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{30,}\b")),
    ("token de Slack", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("clave privada", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("credencial en una URL", re.compile(r"https?://[^/\s:@]+:[^/\s:@]{4,}@[\w.-]+")),
    ("contraseña o clave asignada", re.compile(
        r"""(?i)\b(?:password|passwd|contrase[nñ]a|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*['"]([A-Za-z0-9_\-+/=.]{16,})['"]""")),
]
ARCHIVOS_PROHIBIDOS = re.compile(r"(^|/)(\.env(\..*)?|.*\.pem|.*\.p12|.*\.pfx|id_rsa|id_ed25519|.*\.key|credentials\.json|secrets\.json)$")
EXT_BINARIAS = {".woff", ".woff2", ".ttf", ".otf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz"}
IGNORAR_DIRS = {".git", "node_modules", "__pycache__"}


def recorrer(raiz):
    for base, dirs, files in os.walk(raiz):
        dirs[:] = [d for d in dirs if d not in IGNORAR_DIRS]
        for nombre in files:
            ruta = os.path.join(base, nombre)
            yield ruta, os.path.relpath(ruta, raiz).replace(os.sep, "/")


def revisar_secretos(raiz):
    for ruta, rel in recorrer(raiz):
        if ARCHIVOS_PROHIBIDOS.search(rel):
            error(rel, "archivo que normalmente guarda claves; no debe estar en el repo")
            continue
        if os.path.splitext(rel)[1].lower() in EXT_BINARIAS:
            continue
        texto = leer(ruta)
        if not texto:
            continue
        for nombre, rx in PATRONES_SECRETOS:
            for m in rx.finditer(texto):
                valor = m.group(1) if m.groups() else m.group(0)
                linea = texto[max(0, texto.rfind("\n", 0, m.start()) + 1):texto.find("\n", m.end()) if "\n" in texto[m.end():] else len(texto)]
                if re.search(r"secrets\.|\$\{\{|os\.environ|getenv|process\.env|<[^>]*(token|clave|tu_)[^>]*>", linea, re.I):
                    continue  # referencia a un secreto, no el secreto en sí
                error(f"{rel}:{linea_de(texto, m.start())}", f"parece un secreto ({nombre}): {enmascarar(valor)}")
    gi = leer(os.path.join(raiz, ".gitignore"))
    if gi is None:
        aviso(".gitignore", "no existe; conviene uno que excluya .env, *.pem y *.key")
    elif not re.search(r"\.env", gi):
        aviso(".gitignore", "no excluye .env")


# ----------------------------------------------------------------------------------------------
# 2. CSP y protecciones del index.html
# ----------------------------------------------------------------------------------------------
def revisar_csp(html):
    m = re.search(r'<meta[^>]+http-equiv=["\']Content-Security-Policy["\'][^>]+content="([^"]*)"', html, re.I)
    if not m:
        error("index.html", "falta la política de contenido (<meta http-equiv=\"Content-Security-Policy\">)")
        return
    csp = m.group(1)
    dirs = {}
    for parte in csp.split(";"):
        p = parte.strip().split()
        if p:
            dirs[p[0].lower()] = p[1:]
    exigidas = {"default-src": ["'none'"], "object-src": ["'none'"], "base-uri": ["'none'"],
                "form-action": ["'none'"], "frame-src": ["'none'"]}
    for d, vals in exigidas.items():
        if d not in dirs:
            error("index.html", f"la CSP no define {d}")
        elif dirs[d] != vals:
            error("index.html", f"la CSP debería tener {d} {' '.join(vals)} y tiene {' '.join(dirs[d])}")
    if "'unsafe-eval'" in csp:
        error("index.html", "la CSP permite 'unsafe-eval'")
    for d in ("script-src", "style-src", "connect-src", "img-src", "font-src", "default-src"):
        for v in dirs.get(d, []):
            if v == "*" or v.startswith("http:") or v == "https:" or v == "data:" and d in ("script-src", "connect-src"):
                error("index.html", f"la CSP permite {v} en {d}")
            elif v.startswith("https://") and d == "script-src":
                error("index.html", f"la CSP permite cargar scripts de {v}")
    for v in dirs.get("connect-src", []):
        if v.startswith("https://") and "nexxusconsultora-lab.github.io" not in v:
            error("index.html", f"connect-src permite conectarse a {v}, que no es el propio sitio")
    if "'unsafe-inline'" in dirs.get("script-src", []):
        aviso("index.html", "script-src usa 'unsafe-inline' (limitación conocida: la página es un solo archivo con scripts en línea)")
    if not re.search(r"""<meta[^>]+name=["']referrer["'][^>]+content=["']no-referrer["']""", html, re.I):
        error("index.html", "falta <meta name=\"referrer\" content=\"no-referrer\">")
    if not re.search(r"window\.top|top\s*!==?\s*(window\.)?self|self\s*!==?\s*(window\.)?top", html):
        aviso("index.html", "no se encontró la protección anti-frame (comparar window.top con window.self)")


# ----------------------------------------------------------------------------------------------
# 3 y 4. Textos sin esc(), manejadores sin jq(), enlaces sin safe()
# ----------------------------------------------------------------------------------------------
CAMPOS_EXTERNOS = (r"(?:title|titulo|source|medio|nombre|quote|texto|cargo|bloque|tema|name|fuente|summary|"
                   r"descripcion|apuntes|raw|depto|distrito|cuerpo|snippet)")


def interpolaciones(texto):
    """Devuelve (posición, contenido) de cada ${...} (con llaves balanceadas)."""
    res, i = [], 0
    while True:
        i = texto.find("${", i)
        if i < 0:
            return res
        prof, j = 1, i + 2
        while j < len(texto) and prof:
            c = texto[j]
            if c == "{":
                prof += 1
            elif c == "}":
                prof -= 1
            j += 1
        res.append((i, texto[i + 2:j - 1]))
        i = j


def linea_completa(texto, pos):
    a = texto.rfind("\n", 0, pos) + 1
    b = texto.find("\n", pos)
    return texto[a:b if b >= 0 else len(texto)]


def revisar_plantillas(html):
    inter = interpolaciones(html)
    # 3. Campos de fuentes externas pegados tal cual
    for pos, expr in inter:
        e = expr.strip()
        if re.fullmatch(r"[\w$]+(?:\.[\w$]+|\[[^\]]+\])*", e) and re.search(r"(?:^|\.)" + CAMPOS_EXTERNOS + r"$", e):
            if "audit:ok" in linea_completa(html, pos):
                continue
            error(f"index.html:{linea_de(html, pos)}", f"«${{{e}}}» se inserta sin esc(): un texto externo podría meter HTML")
    # 4a. Manejadores en línea (onclick="...", onchange="..."): todo dato debe ir por jq()
    for m in re.finditer(r"""\bon[a-z]+\s*=\s*"([^"]*)\"""", html):
        valor = m.group(1)
        if "${" not in valor:
            if re.search(r"javascript:", valor, re.I):
                error(f"index.html:{linea_de(html, m.start())}", "manejador con javascript:")
            continue
        if "audit:ok" in linea_completa(html, m.start()):
            continue
        for _, expr in interpolaciones(valor):
            e = expr.strip()
            if e.startswith("jq(") or re.fullmatch(r"[ijkn]", e) or re.fullmatch(r"!+[\w.]+", e):
                continue  # jq() o un índice numérico o un booleano
            error(f"index.html:{linea_de(html, m.start())}",
                  f"dato «${{{e[:50]}}}» en un manejador en línea sin jq(): esc() no alcanza ahí dentro")
    # 4b. href/src con datos: tienen que pasar por safe() (o ser un hash interno, o estar validados antes)
    for m in re.finditer(r"""\b(?:href|src|action|formaction)\s*=\s*["']\$\{""", html):
        ini = m.end() - 2
        for pos, expr in inter:
            if pos == ini:
                e = expr.strip()
                previo = html[max(0, pos - 120):pos]
                if ("safe(" in e or re.search(r"['\"`]#", e) or "en(" in e or re.fullmatch(r"(?:esc\()?SITIO\)?", e) or e == "href"
                        or re.search(r"\.test\(", previo) or "audit:ok" in linea_completa(html, pos)):
                    break
                error(f"index.html:{linea_de(html, pos)}", f"enlace con «${{{e[:50]}}}» sin safe(): podría ser javascript:")
                break
    # 4c. href="javascript:..." escrito a mano
    for m in re.finditer(r"""(?:href|src)\s*=\s*["']\s*javascript:""", html, re.I):
        error(f"index.html:{linea_de(html, m.start())}", "enlace con javascript:")
    # 4d. enlaces que abren pestaña nueva sin noopener
    for m in re.finditer(r"<a\b[^>]*target=\"_blank\"[^>]*>", html):
        if "noopener" not in m.group(0):
            aviso(f"index.html:{linea_de(html, m.start())}", "enlace target=\"_blank\" sin rel=\"noopener\"")


# ----------------------------------------------------------------------------------------------
# 5. Datos con código
# ----------------------------------------------------------------------------------------------
CODIGO_EN_DATOS = re.compile(
    r"<\s*/?\s*(?:script|iframe|object|embed|link|meta|base|form|style)\b|javascript\s*:|vbscript\s*:|data\s*:\s*text/html|"
    r"\bon(?:error|load|click|mouseover|focus|toggle|animationstart|pointer\w*)\s*=|<[^>]+\son\w+\s*=|expression\s*\(",
    re.I)
CLAVES_DE_ENLACE = {"link", "url", "enlace", "source_url", "href", "licencia_fuente", "fuente_url", "web"}


def recorrer_json(nodo, ruta=""):
    if isinstance(nodo, dict):
        for k, v in nodo.items():
            if k in ("__proto__", "constructor", "prototype"):
                yield ruta + "/" + k, k, "clave peligrosa"
            yield from recorrer_json(v, f"{ruta}/{k}")
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            yield from recorrer_json(v, f"{ruta}[{i}]")
    elif isinstance(nodo, str):
        yield ruta, nodo, None


def revisar_datos(raiz):
    base = os.path.join(raiz, "data")
    for ruta, rel in recorrer(base):
        if not ruta.endswith(".json"):
            continue
        rel = "data/" + os.path.relpath(ruta, base).replace(os.sep, "/")
        texto = leer(ruta)
        if not texto:
            continue
        try:
            doc = json.loads(texto)
        except ValueError as exc:
            error(rel, f"no es un JSON válido ({exc})")
            continue
        n = 0
        for donde, valor, problema in recorrer_json(doc):
            if problema:
                error(rel, f"{problema} en {donde}")
                continue
            ultima = re.split(r"[/\[]", donde.rstrip("]"))[-1] if donde else ""
            if ultima in CLAVES_DE_ENLACE and valor and not re.match(r"^(https?://|#/|/)", valor.strip(), re.I):
                if re.match(r"^\s*[a-z][a-z0-9+.-]*:", valor, re.I):
                    error(rel, f"enlace con esquema no permitido en {donde}: {valor[:40]!r}")
                    n += 1
            if CODIGO_EN_DATOS.search(valor):
                n += 1
                if n <= 5:
                    error(rel, f"código dentro de un dato en {donde}: {valor[:60]!r}")
            if n > 5:
                break
        if n > 5:
            error(rel, f"y {n - 5} casos más")


# ----------------------------------------------------------------------------------------------
# 6. Workflows
# ----------------------------------------------------------------------------------------------
def revisar_workflows(raiz):
    carpeta = os.path.join(raiz, ".github", "workflows")
    if not os.path.isdir(carpeta):
        aviso(".github/workflows", "no hay carpeta de workflows")
        return
    for nombre in sorted(os.listdir(carpeta)):
        if not nombre.endswith((".yml", ".yaml")):
            continue
        rel = f".github/workflows/{nombre}"
        texto = leer(os.path.join(carpeta, nombre)) or ""
        lineas = texto.split("\n")
        # acciones fijadas por commit
        for i, l in enumerate(lineas, 1):
            m = re.match(r"\s*-?\s*uses:\s*(\S+)", l)
            if m and not m.group(1).startswith("./"):
                if not re.search(r"@[0-9a-f]{40}\b", m.group(1)):
                    error(f"{rel}:{i}", f"la acción {m.group(1)} no está fijada por commit (@ + 40 caracteres hexadecimales)")
        if re.search(r"^\s*pull_request_target\s*:", texto, re.M):
            error(rel, "usa pull_request_target (permite que código ajeno corra con permisos del repo)")
        if not re.search(r"^permissions\s*:", texto, re.M):
            error(rel, "no declara permissions: a nivel del workflow (hereda permisos amplios)")
        if re.search(r"permissions\s*:\s*write-all|:\s*write-all", texto):
            error(rel, "pide permisos write-all")
        # cada job necesita timeout
        jobs = re.search(r"^jobs\s*:\s*\n(.*)", texto, re.S | re.M)
        if jobs:
            nombres = re.findall(r"^  ([A-Za-z0-9_-]+)\s*:\s*$", jobs.group(1), re.M)
            if len(re.findall(r"timeout-minutes\s*:", jobs.group(1))) < len(nombres):
                error(rel, "algún job no tiene timeout-minutes")
        # inyección por ${{ }} dentro de run:
        en_run, sangria = False, 0
        for i, l in enumerate(lineas, 1):
            m = re.match(r"(\s*)(?:-\s*)?run:\s*(.*)$", l)
            if m:
                en_run, sangria = True, len(m.group(1))
                cuerpo = m.group(2)
            elif en_run and l.strip() and (len(l) - len(l.lstrip())) <= sangria:
                en_run = False
                cuerpo = ""
            else:
                cuerpo = l if en_run else ""
            if en_run and re.search(r"\$\{\{[^}]*(github\.event|github\.head_ref|inputs\.|secrets\.|steps\.[^}]*outputs)", cuerpo):
                error(f"{rel}:{i}", "usa ${{ }} con datos externos dentro de run:; pasalo por env: y leelo como variable de shell")
            if en_run and re.search(r"(curl|wget)[^|\n]*\|\s*(sudo\s+)?(ba)?sh", cuerpo):
                error(f"{rel}:{i}", "descarga y ejecuta un script (curl | sh)")
    if not os.path.exists(os.path.join(raiz, ".github", "dependabot.yml")):
        aviso(".github/dependabot.yml", "no existe; Dependabot avisa cuando una acción de GitHub tiene una versión nueva")


# ----------------------------------------------------------------------------------------------
# 7. Python peligroso
# ----------------------------------------------------------------------------------------------
LLAMADAS_PELIGROSAS = [
    (re.compile(r"(?<![\w.])eval\("), "eval()"), (re.compile(r"(?<![\w.])exec\("), "exec()"),
    (re.compile(r"os\.system\("), "os.system()"), (re.compile(r"shell\s*=\s*True"), "shell=True"),
    (re.compile(r"verify\s*=\s*False"), "verify=False (desactiva la validación HTTPS)"),
    (re.compile(r"pickle\.loads?\("), "pickle"),
]


def revisar_python(raiz):
    carpeta = os.path.join(raiz, "scripts")
    if not os.path.isdir(carpeta):
        return
    for nombre in sorted(os.listdir(carpeta)):
        if not nombre.endswith(".py") or nombre == "auditoria_seguridad.py":
            continue
        texto = leer(os.path.join(carpeta, nombre)) or ""
        for linea_n, l in enumerate(texto.split("\n"), 1):
            if l.lstrip().startswith("#"):
                continue
            for rx, que in LLAMADAS_PELIGROSAS:
                if rx.search(l):
                    error(f"scripts/{nombre}:{linea_n}", f"usa {que}")


# ----------------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Auditoría de seguridad de NEWAR")
    ap.add_argument("--raiz", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    raiz = os.path.abspath(ap.parse_args().raiz)

    html = leer(os.path.join(raiz, "index.html"))
    if html is None:
        error("index.html", "no se encontró")
    else:
        revisar_csp(html)
        revisar_plantillas(html)
    revisar_secretos(raiz)
    revisar_datos(raiz)
    revisar_workflows(raiz)
    revisar_python(raiz)

    print("== Auditoría de seguridad de NEWAR ==")
    for a in AVISOS:
        print("AVISO  ", a)
    for e in ERRORES:
        print("ERROR  ", e)
    print(f"\n{len(ERRORES)} error(es), {len(AVISOS)} aviso(s).")
    if ERRORES:
        print("La auditoría FALLÓ: corregí los ERROR antes de seguir.")
        return 1
    print("La auditoría PASÓ.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
