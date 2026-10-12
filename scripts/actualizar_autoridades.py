#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/actualizar_autoridades.py

Mantiene SOLA la cúpula del Senado de Salta en data/autoridades.json, leyendo la
página oficial "Autoridades de Cámara" de senadosalta.gob.ar.

Qué hace:
  1. Descarga la página y lee la tabla "CARGO: Nombre".
  2. Reemplaza en data/autoridades.json SOLO las filas del Senado cuya fuente es
     esa misma página. Las filas de Diputados, Concejo, Corte o cargadas a mano
     con otra fuente no se tocan.
  3. Salta la fila "PRESIDENTE": en Salta lo es el vicegobernador y ya sale de
     data/politicians.json. Si el nombre no coincide con el vicegobernador de la
     nómina, deja un aviso en data/autoridades_status.json.
  4. Si el nombre coincide con un senador vigente de politicians.json, le pone su
     "id" para que el recuadro lleve a su ficha.

Salvaguardas (para no arruinar la cúpula si el sitio cambia de diseño):
  - Si no se pudo descargar o se leen menos de 5 filas, o no aparece ningún
    vicepresidente, NO se toca autoridades.json y el motivo queda escrito en
    data/autoridades_status.json.
  - Nunca inventa nada: solo copia lo que dice la página.
  - Si no hay cambios, no reescribe el archivo.

Usa solo la biblioteca estándar de Python (no hace falta pip install).
"""

import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser

URL = "https://senadosalta.gob.ar/institucional/autoridades-de-camara/"
CAMARA = "Senado"
USER_AGENT = "Mozilla/5.0 (compatible; RadarPoliticoSalta/1.0; lectura de autoridades publicas)"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F_AUT = os.path.join(RAIZ, "data", "autoridades.json")
F_POL = os.path.join(RAIZ, "data", "politicians.json")
F_EST = os.path.join(RAIZ, "data", "autoridades_status.json")
MIN_FILAS = 5


def hoy_ar():
    return (datetime.now(timezone.utc) - timedelta(hours=3)).strftime("%Y-%m-%d")


def fold(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", s.replace("'", "").replace("´", "").replace("’", ""))).strip()


def tokens(s):
    return frozenset(fold(s).split())


class Filas(HTMLParser):
    """Lee cada <tr> como lista de celdas de texto."""

    def __init__(self):
        super().__init__()
        self.filas, self._fila, self._celda, self._en = [], None, None, False

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._fila = []
        elif tag in ("td", "th") and self._fila is not None:
            self._celda, self._en = [], True

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._fila is not None and self._celda is not None:
            self._fila.append(re.sub(r"\s+", " ", "".join(self._celda).replace("\xa0", " ")).strip())
            self._celda, self._en = None, False
        elif tag == "tr" and self._fila is not None:
            if any(self._fila):
                self.filas.append(self._fila)
            self._fila = None

    def handle_data(self, d):
        if self._en and self._celda is not None:
            self._celda.append(d)


def leer_json(ruta, defecto):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return defecto


def escribir_json(ruta, obj):
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def estado(ok, mensaje, avisos=None):
    escribir_json(F_EST, {"ok": ok, "fecha": hoy_ar(), "fuente": URL, "mensaje": mensaje, "avisos": avisos or []})
    print(("OK: " if ok else "SIN CAMBIOS: ") + mensaje)


def descargar():
    req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT, "Accept-Language": "es-AR,es;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def limpiar_cargo(c):
    c = re.sub(r"\s+", " ", c.replace(":", " ")).strip().lower()
    c = (c.replace("vice presidente", "vicepresidente")
          .replace("primero", "1°").replace("segundo", "2°").replace("tercero", "3°"))
    c = re.sub(r"vicepresidente\s+(1°|2°|3°)", r"vicepresidente \1", c)
    c = " ".join(w if w in ("de", "del", "la", "y") else w.capitalize() for w in c.split())
    return c.replace("Camara", "Cámara")


def nombre_legible(crudo):
    """'LOPEZ MIRAU, Luis Guillermo' -> 'Luis Guillermo Lopez Mirau' (sin título Dr./Sr./Sen.)."""
    n = re.sub(r"^(dr\.|dra\.|sr\.|sra\.|sen\.|lic\.|cdor\.|cra\.)\s*", "", crudo.strip(), flags=re.I)
    if "," in n:
        ape, nom = [x.strip() for x in n.split(",", 1)]
        n = nom + " " + ape
    n = n.replace("´", "'").replace("’", "'")
    return " ".join(p if p != p.upper() or len(p) < 3 else p.capitalize() for p in n.split())


def parsear(html):
    p = Filas()
    p.feed(html)
    out = []
    for f in p.filas:
        if len(f) < 2 or not f[0].strip().endswith(":") or not f[1].strip():
            continue
        cargo, nom = f[0], f[1]
        if not re.search(r"president|secretari|jefe|director", cargo, re.I):
            continue
        out.append((cargo.strip(), nom.strip()))
    return out


def main():
    try:
        html = descargar()
    except Exception as e:
        estado(False, "no se pudo descargar la página del Senado (%s); se conserva lo anterior" % type(e).__name__)
        return
    filas = parsear(html)
    if len(filas) < MIN_FILAS or not any(re.search(r"vice", c, re.I) for c, _ in filas):
        estado(False, "la página cambió de formato (%d filas leídas); no se tocó autoridades.json, revisar el script" % len(filas))
        return

    datos = leer_json(F_AUT, {})
    previas = [a for a in datos.get("autoridades", []) if isinstance(a, dict)]
    pol = leer_json(F_POL, [])
    senadores = [p for p in pol if p.get("chamber") == "Senado" and p.get("vigencia") == "vigente"]
    vice = next((p for p in pol if p.get("chamber") == "Ejecutivo" and re.search(r"vicegobernador", fold(p.get("cargo", "")))), None)
    avisos, nuevas = [], []
    nombres_previos = {tokens(a.get("nombre", "")): a.get("nombre") for a in previas if a.get("camara") == CAMARA}

    for cargo_crudo, nom_crudo in filas:
        cargo = limpiar_cargo(cargo_crudo)
        nombre = nombre_legible(nom_crudo)
        tk = tokens(nombre)
        if re.match(r"president[ea]$", fold(cargo)):
            if vice and not tk <= tokens(vice.get("name", "")):
                avisos.append("El presidente que figura en la página (%s) no coincide con el vicegobernador de la nómina (%s)." % (nombre, vice.get("name")))
            continue
        coin = [p for p in senadores if len(tk) >= 2 and tk <= tokens(p.get("name", ""))]
        if len(coin) == 1:
            nombre = coin[0]["name"]  # nombre completo y con tildes, como en la nómina
        else:
            nombre = nombres_previos.get(tk, nombre)  # conserva tildes ya cargadas
        nuevas.append({"camara": CAMARA, "cargo": cargo, "nombre": nombre,
                       "id": coin[0]["id"] if len(coin) == 1 else "", "fuente": URL, "fecha": hoy_ar()})

    if not nuevas:
        estado(False, "no se encontró ninguna autoridad para cargar; no se tocó autoridades.json")
        return

    resto = [a for a in previas if not (a.get("camara") == CAMARA and a.get("fuente") == URL)]
    viejas = {(a.get("cargo"), a.get("nombre")): a for a in previas if a.get("camara") == CAMARA and a.get("fuente") == URL}
    for n in nuevas:  # si nada cambió para esa persona, conserva su fecha anterior
        v = viejas.get((n["cargo"], n["nombre"]))
        if v and v.get("id", "") == n["id"]:
            n["fecha"] = v.get("fecha", n["fecha"])
    final = resto + nuevas
    if final == previas:
        estado(True, "sin cambios: la cúpula del Senado sigue igual (%d autoridades)" % len(nuevas), avisos)
        return
    datos["autoridades"] = final
    datos["actualizado"] = hoy_ar()
    escribir_json(F_AUT, datos)
    estado(True, "cúpula del Senado actualizada: %d autoridades leídas de la página oficial" % len(nuevas), avisos)


if __name__ == "__main__":
    main()
    sys.exit(0)
