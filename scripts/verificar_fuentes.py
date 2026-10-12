#!/usr/bin/env python3
"""Verifica medios CANDIDATOS (data/fuentes_candidatas.json) antes de sumarlos al monitor.

Para cada dominio pregunta a Google News por las notas de los últimos 7 días (site:dominio) y guarda
cuántas hay, la fecha de la última y 3 títulos de muestra en data/fuentes_candidatas_status.json.
No agrega nada al monitor: eso lo decidís vos mirando el resultado. Solo usa lo que trae Python.

  python scripts/verificar_fuentes.py            # consulta Google News (necesita internet)
  python scripts/verificar_fuentes.py --prueba   # usa datos simulados (para probar sin internet)
"""
import json
import os
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRADA = os.path.join(BASE, "data", "fuentes_candidatas.json")
SALIDA = os.path.join(BASE, "data", "fuentes_candidatas_status.json")
ACTIVA_MIN = 5          # notas en 7 días para llamarla «activa»
PAUSA = 1.5             # segundos entre pedidos, para no abusar de Google News


def url_de(dominio):
    return "https://news.google.com/rss/search?q=" + quote(f"site:{dominio} when:7d") + "&hl=es-419&gl=AR&ceid=AR:es-419"


def descargar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; NEWAR-verificador/1.0)"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def leer_items(xml_bytes):
    raiz = ET.fromstring(xml_bytes)
    out = []
    for it in raiz.iter("item"):
        titulo = (it.findtext("title") or "").strip()
        fecha = None
        try:
            fecha = parsedate_to_datetime(it.findtext("pubDate") or "")
            if fecha.tzinfo is None:
                fecha = fecha.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pass
        out.append({"titulo": titulo, "fecha": fecha})
    return out


def evaluar(items, ahora):
    desde = ahora - timedelta(days=7)
    recientes = [i for i in items if i["fecha"] and i["fecha"] >= desde]
    fechas = [i["fecha"] for i in items if i["fecha"]]
    if len(recientes) >= ACTIVA_MIN:
        estado = "activa"
    elif recientes:
        estado = "poca_actividad"
    else:
        estado = "sin_notas"
    return {"estado": estado, "notas_7_dias": len(recientes),
            "ultima_nota": max(fechas).astimezone(timezone.utc).isoformat() if fechas else None,
            "muestra": [i["titulo"] for i in recientes[:3]]}


def main():
    prueba = "--prueba" in sys.argv
    with open(ENTRADA, encoding="utf-8") as fh:
        cand = json.load(fh).get("candidatas", [])
    ahora = datetime.now(timezone.utc)
    res = []
    for c in cand:
        dom = c.get("dominio", "").strip()
        if not dom:
            continue
        reg = {"dominio": dom, "ambito": c.get("ambito"), "area": c.get("area")}
        try:
            if prueba:
                n = (sum(map(ord, dom)) % 9)
                xml = "<rss><channel>" + "".join(
                    f"<item><title>Nota {i} de {dom}</title><pubDate>{(ahora - timedelta(days=i)).strftime('%a, %d %b %Y %H:%M:%S GMT')}</pubDate></item>"
                    for i in range(n)) + "</channel></rss>"
                items = leer_items(xml.encode())
            else:
                items = leer_items(descargar(url_de(dom)))
                time.sleep(PAUSA)
            reg.update(evaluar(items, ahora))
        except Exception as exc:  # noqa: BLE001
            reg.update({"estado": "error", "mensaje": str(exc)[:160]})
        print(f"{reg['dominio']:28} {reg['estado']:15} {reg.get('notas_7_dias', '-')}")
        res.append(reg)
    orden = {"activa": 0, "poca_actividad": 1, "sin_notas": 2, "error": 3}
    res.sort(key=lambda r: (orden.get(r["estado"], 9), -(r.get("notas_7_dias") or 0)))
    if prueba:
        print("(modo prueba: no se guarda nada)")
        return
    salida = {"generado": ahora.isoformat(), "criterio": f"activa = {ACTIVA_MIN} o más notas en 7 días en Google News", "fuentes": res}
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"Listo: {len(res)} dominios verificados.")


if __name__ == "__main__":
    main()
