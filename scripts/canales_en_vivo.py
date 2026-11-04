#!/usr/bin/env python3
"""
canales_en_vivo.py — completa los códigos de YouTube de data/canales_envivo.json

Para cada canal que todavía no tiene código ("ch": null), abre su página en YouTube
(según el campo "yt", por ejemplo "c/A24com"), lee el código del canal (empieza con UC)
y lo guarda. ANTES de guardarlo comprueba que el nombre del canal en YouTube contenga
alguna de las palabras de "esperado": si no coincide, NO lo activa (así nunca se muestra
por error la transmisión de otro canal).

Los canales que ya tienen código no se tocan.

Uso:  python scripts/canales_en_vivo.py
Prueba contra un servidor local:  python scripts/canales_en_vivo.py --base http://127.0.0.1:8000 --archivo /ruta/prueba.json
"""
import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ARCHIVO = Path(__file__).resolve().parent.parent / "data" / "canales_envivo.json"
BASE = "https://www.youtube.com"
UC = r"UC[\w-]{22}"
CABECERAS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "es-AR,es;q=0.9",
    # Evita la pantalla de «aceptar cookies» que YouTube muestra en algunos países.
    "Cookie": "CONSENT=YES+1; SOCS=CAI",
}


def normalizar(t: str) -> str:
    t = unicodedata.normalize("NFD", str(t or ""))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t.lower()).strip()


def descargar(url: str, intentos: int = 3, espera: int = 3) -> str:
    ultimo = None
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=CABECERAS)
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read(3_000_000).decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code < 500:
                raise
            ultimo = e
        except Exception as e:
            ultimo = e
        if i < intentos - 1:
            time.sleep(espera)
    raise ultimo


def leer_pagina(html: str):
    """Devuelve (codigo_o_None, titulo_o_vacio). Solo se confía en señales que identifican
    al canal de la página (no en cualquier código que aparezca, que podría ser de otro canal)."""
    codigo = None
    for patron in (
        rf'<link[^>]+rel="canonical"[^>]+href="https?://(?:www\.)?youtube\.com/channel/({UC})"',
        rf'<link[^>]+href="https?://(?:www\.)?youtube\.com/channel/({UC})"[^>]+rel="canonical"',
        rf'<meta[^>]+itemprop="(?:identifier|channelId)"[^>]+content="({UC})"',
    ):
        m = re.search(patron, html)
        if m:
            codigo = m.group(1)
            break
    t = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]*)"', html) \
        or re.search(r'<meta[^>]+content="([^"]*)"[^>]+property="og:title"', html)
    titulo = (t.group(1) if t else "").strip()
    if not titulo:
        t = re.search(r"<title>([^<]*)</title>", html)
        titulo = re.sub(r"\s*-\s*YouTube\s*$", "", t.group(1)).strip() if t else ""
    return codigo, titulo


def resolver(canal: dict, base: str):
    """Devuelve (estado, codigo_o_None, titulo, detalle)."""
    yt = str(canal.get("yt") or "").strip().strip("/")
    if not re.fullmatch(r"(?:c|user|channel)/[\w.-]{1,80}|@[\w.-]{1,80}", yt):
        return "sin_direccion", None, "", "el campo 'yt' falta o tiene un formato raro"
    try:
        html = descargar(f"{base}/{yt}")
    except urllib.error.HTTPError as e:
        return "error", None, "", f"YouTube respondió HTTP {e.code}"
    except Exception as e:
        return "error", None, "", f"no se pudo abrir la página ({type(e).__name__}: {e})"
    codigo, titulo = leer_pagina(html)
    if not codigo:
        return "sin_codigo", None, titulo, "la página no trae el código del canal (¿pantalla de cookies o bloqueo?)"
    palabras = [normalizar(p) for p in (canal.get("esperado") or []) if str(p).strip()]
    if not palabras:
        return "sin_control", None, titulo, "el canal no tiene palabras de control en 'esperado'; no se activa solo"
    t = normalizar(titulo)
    if not any(p in t for p in palabras):
        return "no_coincide", None, titulo, f"el nombre en YouTube («{titulo}») no contiene ninguna de {palabras}"
    return "ok", codigo, titulo, ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=BASE)
    ap.add_argument("--archivo", default=str(ARCHIVO))
    ap.add_argument("--pausa", type=float, default=2.0)
    a = ap.parse_args()
    ruta = Path(a.archivo)
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    canales = datos.get("canales", [])
    ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    cambios = 0
    pendientes = [c for c in canales if isinstance(c, dict) and not c.get("ch")]
    print(f"{len(canales)} canales en el catálogo; {len(pendientes)} sin código.")
    for i, c in enumerate(pendientes):
        estado, codigo, titulo, detalle = resolver(c, a.base.rstrip("/"))
        c["ultimo_intento"] = ahora
        c["estado"] = estado
        if estado == "ok":
            c["ch"] = codigo
            c["titulo_youtube"] = titulo
            c["fuente"] = "leído de YouTube y verificado por nombre"
            c.pop("detalle", None)
            cambios += 1
            print(f"  OK   {c.get('nombre')}: {codigo} ({titulo})")
        else:
            c["detalle"] = detalle
            print(f"  --   {c.get('nombre')}: {estado} — {detalle}")
        if i < len(pendientes) - 1:
            time.sleep(a.pausa)
    if pendientes:
        datos["generado"] = ahora[:10]
        ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Listo: {cambios} canal(es) activado(s) en esta corrida.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
