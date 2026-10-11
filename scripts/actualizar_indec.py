#!/usr/bin/env python3
"""Actualiza data/indec_salta.json con indicadores de Salta publicados por el INDEC.

Fuente: API de series de tiempo de datos.gob.ar (https://apis.datos.gob.ar/series/api/), que
redistribuye las series oficiales del INDEC (EPH continua). No usa claves.

Reglas:
- No se inventa nada: cada indicador trae su serie, su fecha del último dato publicado y su fuente.
- Si la API falla o una serie no responde, se conserva el valor anterior de ese indicador
  (con su fecha) y el script termina sin error para no cortar el workflow.
- Solo se toman datos hasta la fecha 'time_index_end' que declara la propia serie.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "indec_salta.json")
API = "https://apis.datos.gob.ar/series/api/series/"
TIMEOUT = 40

# id de la serie -> (clave interna, título para mostrar, unidad, cuántos períodos guardar)
SERIES = [
    ("64.2_POBLACION_NUA_0_0_34_96", "pobreza_personas", "Personas bajo la línea de pobreza", "%", 8),
    ("63.2_HOGARES_PONUA_0_0_33_52", "pobreza_hogares", "Hogares bajo la línea de pobreza", "%", 8),
    ("45.2_ECTDTS_0_T_39", "desempleo", "Tasa de desocupación", "%", 8),
    ("44.2_ECTETS_0_T_36", "empleo", "Tasa de empleo", "%", 8),
]
LINK = "https://datos.gob.ar/series/api/series/?ids={id}"


def pedir(sid):
    q = urllib.parse.urlencode({"ids": sid, "format": "json", "metadata": "full", "last": 40})
    req = urllib.request.Request(API + "?" + q, headers={"User-Agent": "newar-salta-monitor/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.load(r)


def periodo(fecha, frecuencia):
    """'2026-04-01' + trimestral -> '2.º trimestre 2026'; semestral -> '1.er semestre 2026'."""
    y, m = int(fecha[:4]), int(fecha[5:7])
    if "P3M" in frecuencia:
        return f"{(m - 1) // 3 + 1}.º trimestre {y}"
    if "P6M" in frecuencia:
        return f"{'1.er' if m <= 6 else '2.º'} semestre {y}"
    if "P1Y" in frecuencia:
        return str(y)
    return fecha


def buscar(obj, clave):
    """Busca una clave en cualquier parte de la metadata (la API anida distinto según la versión)."""
    if isinstance(obj, dict):
        if obj.get(clave):
            return obj[clave]
        for v in obj.values():
            r = buscar(v, clave)
            if r:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = buscar(v, clave)
            if r:
                return r
    return None


def extraer(sid, clave, titulo, unidad, n):
    d = pedir(sid)
    meta = d.get("meta") or []
    # Fecha del último dato REAL que declara la propia serie. Si no la declara, no se usa la serie:
    # sin ese tope podrían colarse períodos que todavía no se publicaron.
    tope = buscar(meta[1:], "time_index_end")
    frec = buscar(meta, "frequency") or ""
    if not tope:
        raise ValueError("la serie no declara su último dato (time_index_end)")
    tope = str(tope)[:10]
    filas = [(f, v) for f, v in d["data"] if v is not None and f <= tope]
    if not filas:
        raise ValueError("sin datos")
    filas = filas[-n:]
    return {
        "clave": clave,
        "titulo": titulo,
        "unidad": unidad,
        "serie_id": sid,
        "frecuencia": frec,
        "fuente": "INDEC · EPH continua, vía datos.gob.ar",
        "enlace": LINK.format(id=sid),
        "ultimo": {"fecha": filas[-1][0], "periodo": periodo(filas[-1][0], frec), "valor": round(filas[-1][1] * 100, 1)},
        "serie": [{"fecha": f, "periodo": periodo(f, frec), "valor": round(v * 100, 1)} for f, v in filas],
    }


def main():
    previo = {}
    if os.path.exists(SALIDA):
        try:
            with open(SALIDA, encoding="utf-8") as f:
                previo = {x["clave"]: x for x in json.load(f).get("indicadores", [])}
        except Exception:
            previo = {}
    out, fallos = [], []
    for sid, clave, titulo, unidad, n in SERIES:
        try:
            out.append(extraer(sid, clave, titulo, unidad, n))
            print("OK", clave, out[-1]["ultimo"])
        except Exception as e:  # red caída, formato distinto, etc.
            fallos.append(clave)
            print(f"AVISO: no se pudo actualizar {clave}: {e}", file=sys.stderr)
            if clave in previo:
                out.append(previo[clave])
    if not out:
        print("No hay indicadores para guardar; se deja el archivo como estaba.", file=sys.stderr)
        return
    nuevo = {
        "actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "nota": "Indicadores provinciales del INDEC. 'ultimo' es el último período publicado; no es de hoy.",
        "indicadores": out,
        "no_actualizados": fallos,
    }
    # Si nada cambió salvo la hora, no se reescribe (evita commits vacíos todos los días)
    if previo and {x["clave"]: x for x in out} == previo and not fallos:
        print("Sin cambios en los indicadores.")
        return
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(nuevo, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
