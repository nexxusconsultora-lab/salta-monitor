#!/usr/bin/env python3
"""Arma `newar-offline.html`: NEWAR en UN solo archivo, con los datos y las
tipografías incrustados, para abrirlo con doble clic (sin servidor ni internet).

Uso (desde la raíz del repositorio):
    python scripts/empaquetar_offline.py

Por qué existe: abierto directamente como archivo, el navegador bloquea que
index.html lea data/*.json. Esta versión lleva los datos adentro, así que
funciona en cualquier celular o computadora, también si te la mandan por
WhatsApp o mail. Es una FOTO: muestra los datos del momento en que se generó
(el pie indica la fecha). Para datos al día, usar el sitio publicado.

No toca index.html ni data/. Solo lee y escribe un archivo nuevo.
"""
import base64
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "newar-offline.html"
# Mismos nombres que usa index.html en SRC (archivo sin .json)
DATOS = ["politicians", "aggregates", "mentions", "dossiers", "topics_data",
         "events", "news_general", "oficiales", "oficiales_status"]


def main() -> int:
    html = (RAIZ / "index.html").read_text(encoding="utf-8")

    # 1) Datos incrustados. Se escapan "<" (evita cerrar el <script> por error)
    #    y los separadores de línea U+2028/2029.
    embed = {}
    for n in DATOS:
        ruta = RAIZ / "data" / f"{n}.json"
        if not ruta.exists():
            print(f"AVISO: falta data/{n}.json; la app usará su valor vacío.", file=sys.stderr)
            continue
        embed[n] = json.loads(ruta.read_text(encoding="utf-8"))
    blob = json.dumps(embed, ensure_ascii=False, separators=(",", ":"))
    blob = blob.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    marca = "<script>\nconst $=s=>document.querySelector(s);"
    if html.count(marca) != 1:
        print("ERROR: no encontré el <script> principal de index.html; ¿cambió su inicio?", file=sys.stderr)
        return 1
    html = html.replace(marca, f"<script>window.NEWAR_EMBED={blob};</script>\n" + marca)

    # 2) Tipografías como data: URI (bajo file:// el navegador no siempre carga fuentes externas)
    html = re.sub(r'<link rel="preload" href="fonts/[^>]+>\n', "", html)

    def a_datauri(m):
        f = RAIZ / m.group(1)
        b64 = base64.b64encode(f.read_bytes()).decode("ascii")
        return f"url(data:font/woff2;base64,{b64})"

    html = re.sub(r"url\((fonts/[A-Za-z0-9._-]+\.woff2)\)", a_datauri, html)

    # 3) Aviso visible de que es una foto
    fecha = (embed.get("aggregates") or {}).get("generated_at", "fecha desconocida")
    aviso = (f'<footer style="margin:0 auto;max-width:1100px;padding:.6rem 1.25rem">Versión sin conexión: '
             f'muestra los datos tal como estaban al {fecha[:16].replace("T", " ")} (UTC). '
             f'Para ver lo más reciente, usar el sitio publicado.</footer>\n')
    html = html.replace("</body>", aviso + "</body>")

    SALIDA.write_text(html, encoding="utf-8")
    print(f"Listo: {SALIDA.name} ({SALIDA.stat().st_size/1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
