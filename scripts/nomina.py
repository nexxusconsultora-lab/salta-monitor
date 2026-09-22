#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/nomina.py

Mantiene SOLA la lista de legisladores de data/politicians.json a partir
de las nóminas oficiales:

  - Cámara de Diputados de Salta   (tabla oficial)            -> se actualiza sola
  - Cámara de Senadores de Salta   (tabla oficial)            -> se actualiza sola
  - Concejo Deliberante de Salta   (lista de concejales)      -> se actualiza sola
  - Diputados nacionales por Salta (hcdn.gob.ar, por bloque)  -> verifica vigencia
  - Senadores nacionales por Salta                            -> cargados a mano (ver SEMILLA)

Qué hace en cada corrida:
  1. Lee la nómina oficial de cada fuente.
  2. Quien figura en la nómina queda como vigencia = "vigente" (con
     departamento, bloque y período cuando el sitio los publica).
  3. Quien estaba en tu lista, es de esa cámara y YA NO figura pasa a
     vigencia = "ex". No se borra: queda como historial, el panel lo
     oculta por defecto y el monitor deja de buscar noticias sobre esa persona.
  4. Quien figura en la nómina y no estaba en tu lista se agrega
     (salvo en diputados nacionales: ahí el sitio no separa apellido de
     nombre, así que se avisa en data/nomina_status.json y se agrega
     con el formulario "Agregar político").
  5. Completa "cargo", "ámbito" y "distrito" en todos los registros.

Salvaguardas (para no arruinar la lista si un sitio cambia de diseño):
  - Si una fuente devuelve menos filas de las esperadas, esa fuente NO se
    toca y el problema queda escrito en data/nomina_status.json.
  - Nunca se borra a nadie.
  - Los registros cargados a mano con el formulario (campo "manual") en
    cámaras que no se verifican solas no se tocan.

Usa solo la biblioteca estándar de Python (no hace falta pip install).
"""

import json
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLITICIANS_PATH = ROOT / "data" / "politicians.json"
STATUS_PATH = ROOT / "data" / "nomina_status.json"

USER_AGENT = "Mozilla/5.0 (compatible; RadarPoliticoSalta/1.0; lectura de nomina publica)"

FUENTES = [
    {
        "id": "diputados-salta",
        "nombre": "Cámara de Diputados de Salta — nómina oficial",
        "tipo": "tabla",
        "chamber": "Diputados",
        "cargo": "Diputado/a provincial",
        "ambito": "Provincial",
        "prefijo": "dip",
        "urls": ["https://www.diputadosalta.gob.ar/web/diputados"],
        "minimo_esperado": 50,   # la Cámara tiene 60 bancas
        "maximo_esperado": 65,
        "max_altas": 60,         # la primera corrida agrega a los 60 actuales
    },
    {
        "id": "senado-salta",
        "nombre": "Cámara de Senadores de Salta — nómina oficial",
        "tipo": "tabla",
        "chamber": "Senado",
        "cargo": "Senador/a provincial",
        "ambito": "Provincial",
        "prefijo": "sen",
        "urls": [
            "https://senadosalta.gob.ar/senadores/nomina-de-senadores-departamento/",
            "https://senadosalta.gob.ar/senadores/nomina-de-senadores-alfabetico/",
        ],
        "minimo_esperado": 20,   # el Senado tiene 23 bancas
        "maximo_esperado": 25,
        "max_altas": 12,
    },
    {
        "id": "concejo-salta",
        "nombre": "Concejo Deliberante de la Ciudad de Salta — concejales",
        "tipo": "concejo",
        "chamber": "Concejo Deliberante",
        "cargo": "Concejal/a",
        "ambito": "Municipal",
        "distrito": "Ciudad de Salta",
        "role": "Concejal/a de la Ciudad de Salta",
        "prefijo": "concejal",
        "urls": ["https://cdsalta.gob.ar/index.php/concejales/"],
        "minimo_esperado": 15,   # el Concejo tiene 21 bancas
        "maximo_esperado": 25,
        "max_altas": 8,
    },
    {
        "id": "diputados-nacion",
        "nombre": "Cámara de Diputados de la Nación — diputados por Salta",
        "tipo": "hcdn",
        "chamber": "Diputados de la Nación",
        "cargo": "Diputado/a nacional",
        "ambito": "Nacional",
        "distrito": "Salta",
        "urls": ["https://www.hcdn.gob.ar/diputados/diputados-por-bloque.html"],
        "minimo_esperado": 5,    # Salta tiene 7 bancas
        "maximo_esperado": 10,
        "max_altas": 0,          # los diputados nacionales no se agregan solos
    },
]

# Senadores nacionales por Salta (período 2025-2031). Verificados el
# 20/9/2026 en el sitio del Senado de la Nación. NO se actualizan solos:
# si alguien renuncia o cambia, usá el formulario "Agregar político".
# Los diputados nacionales también se cargan acá la primera vez; después
# se verifican solos contra hcdn.gob.ar.
SEMILLA = [
    {"id": "snac-flavia-royon", "name": "Flavia Gabriela Royón", "chamber": "Senado de la Nación",
     "cargo": "Senador/a nacional", "bloque": "Primero los Salteños", "term_start": "2025", "term_end": "2031",
     "aliases": ["Flavia Royón", "Flavia Gabriela Royón"], "source_url": "https://www.senado.gob.ar/senadores/senador/593"},
    {"id": "snac-emilia-orozco", "name": "Emilia Orozco", "chamber": "Senado de la Nación",
     "cargo": "Senador/a nacional", "bloque": "La Libertad Avanza", "term_start": "2025", "term_end": "2031",
     "aliases": ["Emilia Orozco"], "source_url": "https://www.senado.gob.ar/"},
    {"id": "snac-gonzalo-guzman-coraita", "name": "Gonzalo Guzmán Coraita", "chamber": "Senado de la Nación",
     "cargo": "Senador/a nacional", "bloque": "La Libertad Avanza", "term_start": "2025", "term_end": "2031",
     "aliases": ["Gonzalo Guzmán Coraita", "Guzmán Coraita", "Gonzalo Guzmán"], "source_url": "https://www.senado.gob.ar/"},
    {"id": "dnac-eliana-bruno", "name": "Eliana Bruno", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "La Libertad Avanza", "term_start": "2023", "term_end": "2027",
     "aliases": ["Eliana Bruno"]},
    {"id": "dnac-maria-gabriela-flores", "name": "María Gabriela Flores", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "La Libertad Avanza", "term_start": "2025", "term_end": "2029",
     "aliases": ["Gabriela Flores", "María Gabriela Flores"]},
    {"id": "dnac-julio-moreno-ovalle", "name": "Julio Moreno Ovalle", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "La Libertad Avanza", "term_start": "2023", "term_end": "2027",
     "aliases": ["Julio Moreno Ovalle", "Moreno Ovalle"]},
    {"id": "dnac-carlos-raul-zapata", "name": "Carlos Raúl Zapata", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "La Libertad Avanza", "term_start": "2025", "term_end": "2029",
     "aliases": ["Carlos Zapata", "Carlos Raúl Zapata"]},
    {"id": "dnac-bernardo-biella", "name": "Bernardo Biella", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "Argentina Federal", "term_start": "2025", "term_end": "2029",
     "aliases": ["Bernardo Biella"]},
    {"id": "dnac-pablo-outes", "name": "Pablo Outes", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "Argentina Federal", "term_start": "2023", "term_end": "2027",
     "aliases": ["Pablo Outes"]},
    {"id": "dnac-yolanda-vega", "name": "Yolanda Vega", "chamber": "Diputados de la Nación",
     "cargo": "Diputado/a nacional", "bloque": "Argentina Federal", "term_start": "2023", "term_end": "2027",
     "aliases": ["Yolanda Vega"]},
]

PARTICULAS = {"de", "del", "la", "las", "los", "y", "e", "da", "di", "van", "von"}


# ---------------------------------------------------------------- utilidades

def ahora_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fold(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower()


def tokens(s):
    return set(re.findall(r"[a-z0-9]+", fold(s)))


def cargar_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def guardar_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def descargar(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "es-AR,es;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        crudo = resp.read()
        cs = resp.headers.get_content_charset() or "utf-8"
    try:
        return crudo.decode(cs, errors="replace")
    except LookupError:
        return crudo.decode("utf-8", errors="replace")


# ------------------------------------------------------------ lector de tablas

class TablaParser(HTMLParser):
    """Devuelve todas las tablas como listas de filas de texto."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tablas, self._fila, self._celda, self._en_celda = [], None, [], False
        self._prof = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._prof += 1
            self.tablas.append([])
        elif tag == "tr" and self.tablas:
            self._fila = []
        elif tag in ("td", "th") and self._fila is not None:
            self._en_celda, self._celda = True, []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._en_celda:
            self._fila.append(re.sub(r"\s+", " ", "".join(self._celda)).strip())
            self._en_celda = False
        elif tag == "tr" and self._fila is not None and self.tablas:
            if any(self._fila):
                self.tablas[-1].append(self._fila)
            self._fila = None
        elif tag == "table":
            self._prof = max(0, self._prof - 1)

    def handle_data(self, data):
        if self._en_celda:
            self._celda.append(data)


def leer_tablas(html_texto):
    p = TablaParser()
    p.feed(html_texto)
    return p.tablas


RE_MANDATO = re.compile(r"(\d{4})\s*[-–—]\s*(\d{4})")


def filas_de_legisladores(html_texto):
    """Busca la tabla con encabezado de nombre + período/mandato y devuelve
    dicts {apellido_nombre, departamento, bloque, inicio, fin}."""
    salida = []
    for tabla in leer_tablas(html_texto):
        if len(tabla) < 2:
            continue
        cab = [fold(c) for c in tabla[0]]
        i_nom = next((i for i, c in enumerate(cab) if "nombre" in c), None)
        i_per = next((i for i, c in enumerate(cab) if "periodo" in c or "mandato" in c), None)
        if i_nom is None or i_per is None:
            continue
        i_dep = next((i for i, c in enumerate(cab) if "departamento" in c), None)
        i_blo = next((i for i, c in enumerate(cab) if "bloque" in c), None)
        for fila in tabla[1:]:
            if len(fila) <= max(i_nom, i_per):
                continue
            m = RE_MANDATO.search(fila[i_per])
            nombre = fila[i_nom].strip()
            if not m or "," not in nombre:
                continue
            salida.append({
                "apellido_nombre": nombre,
                "departamento": fila[i_dep].strip() if i_dep is not None and i_dep < len(fila) else "",
                "bloque": fila[i_blo].strip() if i_blo is not None and i_blo < len(fila) else "",
                "inicio": m.group(1),
                "fin": m.group(2),
            })
    return salida


# ---------------------------------------------------------------- nombres

def titulo(texto):
    palabras = []
    for w in texto.strip().split():
        base = w.lower()
        if base in PARTICULAS:
            palabras.append(base)
            continue
        w2 = base.capitalize()
        # D'Andrea, D’Auria, O'Connor...
        w2 = re.sub(r"(['’])([a-záéíóúñü])", lambda m: m.group(1) + m.group(2).upper(), w2)
        palabras.append(w2)
    return " ".join(palabras)


def separar(apellido_nombre):
    apellido, _, nombre = apellido_nombre.partition(",")
    return titulo(apellido), titulo(nombre)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")


def generar_aliases(apellido, nombre):
    """Formas en que la prensa suele nombrar a una persona.
    Siempre 2 palabras o más, para no generar falsos positivos con un
    apellido suelto."""
    ap = [a for a in apellido.split() if a.lower() not in PARTICULAS]
    nom = nombre.split()
    alias = {f"{nombre} {apellido}".strip()}
    if nom and ap:
        alias.add(f"{nom[0]} {ap[0]}")
        alias.add(f"{nom[0]} {apellido}")
    return sorted(a for a in alias if len(a.split()) >= 2)


def _lista(s):
    return re.findall(r"[a-z0-9]+", fold(s))


def coincide(registro, apellido, nombre):
    """¿El registro existente es la misma persona que la fila oficial?

    Regla estricta, pensada para NO confundir a dos personas distintas:
      1. El apellido oficial tiene que ser el FINAL del nombre del registro
         ("Juan Esteban Romero" NO coincide con "ESTEBAN, Juan José",
         aunque compartan palabras).
      2. Los nombres de pila tienen que coincidir en el primero, o uno
         tiene que estar contenido en el otro ("Luis Arnaldo" ~ "Arnaldo").
    Ante la duda, NO coincide: el registro viejo pasa a 'ex' y la persona
    de la nómina se agrega como nueva, que es el error más seguro.
    """
    ap = [t for t in _lista(apellido) if t not in PARTICULAS]
    no = [t for t in _lista(nombre) if len(t) > 1 and t not in PARTICULAS]
    if not ap or not no:
        return False
    for nombre_reg in [registro.get("name", "")] + list(registro.get("aliases") or []):
        toks = [t for t in _lista(nombre_reg) if t not in PARTICULAS]
        if len(toks) < 2:
            continue
        # Regla A: el apellido oficial es el FINAL del nombre del registro.
        if len(toks) > len(ap) and toks[-len(ap):] == ap:
            pila = [t for t in toks[:-len(ap)] if len(t) > 1]
            if pila and (pila[0] == no[0] or set(no) <= set(pila) or set(pila) <= set(no)):
                return True
        # Regla B: el sitio publica solo el primer apellido ("Cornejo, Enrique")
        # y el registro tiene el compuesto ("Enrique Antonio Cornejo Saravia").
        # Se exige que TODOS los nombres de pila oficiales estén en el registro.
        for i in range(1, len(toks) - len(ap)):
            if toks[i:i + len(ap)] == ap:
                pila = [t for t in toks[:i] if len(t) > 1]
                if pila and set(no) <= set(pila):
                    return True
    return False


def coincide_sin_orden(registro, nombre_pagina):
    """Para hcdn.gob.ar, que publica 'apellido nombre' sin coma: se comparan
    conjuntos de palabras (deben coincidir al menos 2 y uno contener al otro)."""
    a = {t for t in _lista(nombre_pagina) if t not in PARTICULAS and len(t) > 1}
    for nombre_reg in [registro.get("name", "")] + list(registro.get("aliases") or []):
        b = {t for t in _lista(nombre_reg) if t not in PARTICULAS and len(t) > 1}
        if len(a & b) >= 2 and (a <= b or b <= a):
            return True
    return False


# ---------------------------------------------------- lectores de otras páginas

class TextoParser(HTMLParser):
    """Devuelve los trozos de texto visibles, en orden."""

    def __init__(self, solo_tags=None):
        super().__init__(convert_charrefs=True)
        self.trozos, self._skip, self._solo, self._dentro = [], 0, solo_tags, 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        if self._solo and tag in self._solo:
            self._dentro += 1
            self.trozos.append("")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1
        if self._solo and tag in self._solo and self._dentro:
            self._dentro -= 1

    def handle_data(self, data):
        if self._skip:
            return
        if self._solo:
            if self._dentro and self.trozos:
                self.trozos[-1] += data
        else:
            t = re.sub(r"\s+", " ", data).strip()
            if t:
                self.trozos.append(t)


RE_PERIODO = re.compile(r"^(\d{4})\s*[-–—]\s*(\d{4})$")
RE_APELLIDO_NOMBRE = re.compile(r"^[A-Za-zÁÉÍÓÚÑÜáéíóúñü'’. \-]{2,60},\s+[A-Za-zÁÉÍÓÚÑÜáéíóúñü'’. \-]{2,60}$")


# Palabras de menú/navegación que NO son apellidos ni nombres.
PALABRAS_DE_MENU = {
    "contacto", "sistemas", "comisiones", "concejales", "noticias", "sesiones", "inicio",
    "institucional", "transparencia", "facebook", "instagram", "twitter", "youtube", "proyectos",
    "ordenanzas", "autoridades", "bloques", "prensa", "agenda", "historia", "biblioteca",
    "novedades", "mapa", "buscar", "buscador", "suscribite", "secretaria", "presidencia",
}


def filas_de_concejales(html_texto):
    """Títulos 'Apellido, Nombre' de la página de concejales."""
    p = TextoParser(solo_tags=("h2", "h3", "h4"))
    p.feed(html_texto)
    filas = []
    for t in p.trozos:
        t = re.sub(r"\s+", " ", t).strip()
        if (RE_APELLIDO_NOMBRE.match(t) and len(t.split()) <= 8
                and not (set(_lista(t)) & PALABRAS_DE_MENU)):
            filas.append({"apellido_nombre": t, "departamento": "", "bloque": "", "inicio": "", "fin": ""})
    return filas


def entradas_hcdn_salta(html_texto):
    """En hcdn.gob.ar, cada diputado tiene: nombre, distrito y mandato, en
    ese orden. Devuelve los de distrito 'salta'."""
    p = TextoParser()
    p.feed(html_texto)
    t = p.trozos
    salida = []
    for i, trozo in enumerate(t):
        if fold(trozo) != "salta" or i + 1 >= len(t):
            continue
        m = RE_PERIODO.match(t[i + 1])
        if not m or i == 0:
            continue
        j = i - 1
        while j > 0 and fold(t[j]) in ("presidente", "presidenta", "vicepresidente", "vicepresidenta"):
            j -= 1
        nombre = re.sub(r"(?i)\s*(presidente|presidenta)\s*$", "", t[j]).strip()
        if nombre:
            salida.append({"nombre_pagina": nombre, "inicio": m.group(1), "fin": m.group(2)})
    return salida


# ------------------------------------------------------------ proceso principal

def _descargar_filas(fuente):
    """Devuelve (filas, url_usada, ultimo_error)."""
    filas, usada, err = [], fuente["urls"][0], None
    for url in fuente["urls"]:
        try:
            html_texto = descargar(url)
            if fuente["tipo"] == "tabla":
                filas = filas_de_legisladores(html_texto)
            elif fuente["tipo"] == "concejo":
                filas = filas_de_concejales(html_texto)
            elif fuente["tipo"] == "hcdn":
                filas = entradas_hcdn_salta(html_texto)
            usada = url
            if len(filas) >= fuente["minimo_esperado"]:
                break
        except Exception as e:  # noqa: BLE001
            err = f"{type(e).__name__}: {e}"
    return filas, usada, err


def _error_estado(estado, fuente, n, err):
    estado["state"] = "error"
    estado["message"] = (
        f"Se leyeron {n} filas y se esperaban al menos {fuente['minimo_esperado']}. "
        "Por seguridad esta fuente NO se modificó. "
        + (f"Último error: {err}. " if err else "")
        + "Puede que el sitio haya cambiado de diseño o cargue su lista con JavaScript."
    )
    return estado


def procesar_hcdn(fuente, filas, politicos, hoy, estado):
    """Diputados nacionales: solo verifica vigencia (el sitio no separa
    apellido y nombre, así que no se agregan solos)."""
    propios = [p for p in politicos if p.get("chamber") == fuente["chamber"]]
    vistos, sin_cargar = set(), []
    for fila in filas:
        reg = next((p for p in propios if id(p) not in vistos and coincide_sin_orden(p, fila["nombre_pagina"])), None)
        if reg is None:
            sin_cargar.append(titulo(fila["nombre_pagina"]))
            continue
        reg.update({"vigencia": "vigente", "term_start": fila["inicio"], "term_end": fila["fin"],
                    "verificado_en": hoy, "source_url": estado["url"], "role": fuente["cargo"] + " por Salta"})
        reg.pop("ex_desde", None)
        vistos.add(id(reg))
    pasan = 0
    for p in propios:
        if id(p) not in vistos:
            if p.get("vigencia") != "ex":
                pasan += 1
                p["ex_desde"] = hoy
            p.update({"vigencia": "ex", "verificado_en": hoy, "role": f"Ex {fuente['cargo'].lower()} por Salta"})
    estado["state"] = "ok"
    estado["message"] = f"{len(filas)} diputados por Salta en el sitio oficial; {pasan} pasaron a 'ex'."
    if sin_cargar:
        estado["message"] += (" ATENCIÓN: figuran en el sitio y no están en tu lista: "
                              + "; ".join(sin_cargar) + ". Agregalos con el formulario 'Agregar político'.")
    return estado


def procesar_fuente(fuente, politicos, hoy):
    estado = {"name": fuente["nombre"], "url": fuente["urls"][0], "checked_at": ahora_iso()}
    filas, estado["url"], err = _descargar_filas(fuente)
    if len(filas) < fuente["minimo_esperado"]:
        return _error_estado(estado, fuente, len(filas), err)
    if len(filas) > fuente.get("maximo_esperado", 10**6):
        estado["state"] = "error"
        estado["message"] = (f"Se leyeron {len(filas)} filas y se esperaban como máximo {fuente['maximo_esperado']}. "
                             "Por seguridad esta fuente NO se modificó: el sitio puede haber cambiado de estructura.")
        return estado
    if fuente["tipo"] == "hcdn":
        return procesar_hcdn(fuente, filas, politicos, hoy, estado)

    chamber = fuente["chamber"]
    propios = [p for p in politicos if p.get("chamber") == chamber]

    # Fase 1: se decide quién es quién SIN modificar nada, para poder
    # abortar si el resultado es sospechoso.
    plan, usados = [], set()
    for fila in filas:
        apellido, nombre = separar(fila["apellido_nombre"])
        reg = next((p for p in propios if id(p) not in usados and coincide(p, apellido, nombre)), None)
        if reg is not None:
            usados.add(id(reg))
        plan.append((fila, apellido, nombre, reg))
    altas = sum(1 for _, _, _, r in plan if r is None)
    if altas > fuente.get("max_altas", 10**6):
        estado["state"] = "error"
        estado["message"] = (f"La nómina traería {altas} personas nuevas de golpe (el máximo razonable es "
                             f"{fuente['max_altas']}). Por seguridad esta fuente NO se modificó; revisala a mano.")
        return estado

    # Fase 2: se aplica.
    vistos = set()
    agregados = actualizados = 0
    for fila, apellido, nombre, reg in plan:
        nombre_completo = f"{nombre} {apellido}".strip()
        depto = fila["departamento"] or fuente.get("distrito", "")
        campos = {
            "role": fuente.get("role") or (f"{fuente['cargo']} por {depto}" if depto else fuente["cargo"]),
            "cargo": fuente["cargo"],
            "ambito": fuente["ambito"],
            "distrito": depto,
            "vigencia": "vigente",
            "source_url": estado["url"],
            "verificado_en": hoy,
        }
        if fila["bloque"]:
            campos["bloque"] = fila["bloque"].title()
        if fila["inicio"]:
            campos["term_start"], campos["term_end"] = fila["inicio"], fila["fin"]
        if reg is None:
            reg = {
                "id": f"{fuente['prefijo']}-{slug(nombre_completo)}",
                "name": nombre_completo,
                "chamber": chamber,
                "aliases": generar_aliases(apellido, nombre),
            }
            if fila["departamento"]:
                reg["department"] = depto
            reg.update(campos)
            politicos.append(reg)
            agregados += 1
        else:
            reg.update(campos)
            if fila["departamento"]:
                reg["department"] = depto
            reg.pop("ex_desde", None)
            reg["aliases"] = sorted(set(reg.get("aliases") or []) | set(generar_aliases(apellido, nombre)))
            actualizados += 1
        vistos.add(id(reg))

    pasan_a_ex = 0
    for p in propios:
        if id(p) in vistos:
            continue
        if p.get("vigencia") != "ex":
            pasan_a_ex += 1
            p["ex_desde"] = hoy
        p["vigencia"] = "ex"
        p["cargo"] = p.get("cargo") or fuente["cargo"]
        p["ambito"] = fuente["ambito"]
        p["role"] = f"Ex {fuente['cargo'].lower()} (ya no figura en la nómina oficial)"
        p["verificado_en"] = hoy

    estado["state"] = "ok"
    estado["message"] = (
        f"{len(filas)} en la nómina oficial: {actualizados} ya estaban, {agregados} nuevos agregados, "
        f"{pasan_a_ex} pasaron a 'ex'."
    )
    return estado


# Cámaras que este script verifica solo. Los registros de otras cámaras
# ("Otros": intendentes, ministros, etc.) no se tocan nunca.
CAMARAS_VERIFICADAS = {f["chamber"] for f in FUENTES}


def sembrar(politicos):
    """Agrega los registros de SEMILLA que todavía no estén (por id)."""
    ids = {p.get("id") for p in politicos}
    n = 0
    for base in SEMILLA:
        if base["id"] in ids:
            continue
        reg = dict(base)
        reg.update({
            "ambito": "Nacional", "distrito": "Salta", "vigencia": "vigente",
            "role": f"{base['cargo']} por Salta",
        })
        politicos.append(reg)
        n += 1
    return n


def completar_campos(politicos):
    """Cargo y ámbito para los registros que ninguna fuente verificó."""
    for p in politicos:
        if p.get("cargo") and p.get("ambito"):
            continue
        ch = p.get("chamber")
        if ch == "Ejecutivo":
            p.update({"cargo": p.get("role") or "Poder Ejecutivo", "ambito": "Provincial"})
            p.setdefault("vigencia", "vigente")
        elif ch in ("Diputados", "Senado"):
            p.update({
                "cargo": "Senador/a provincial" if ch == "Senado" else "Diputado/a provincial",
                "ambito": "Provincial",
                "distrito": p.get("distrito") or p.get("department", ""),
            })
        elif ch == "Concejo Deliberante":
            p.update({"cargo": "Concejal/a", "ambito": "Municipal", "distrito": "Ciudad de Salta"})
        else:
            p.setdefault("cargo", p.get("role", ""))
            p.setdefault("ambito", "")


def main():
    politicos = cargar_json(POLITICIANS_PATH, [])
    if not isinstance(politicos, list) or not politicos:
        print("No se pudo leer data/politicians.json (o está vacío). No se toca nada.")
        return 0

    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    resultado = {"generated_at": ahora_iso(), "sources": {}}

    n_semilla = sembrar(politicos)
    if n_semilla:
        print(f"Se cargaron {n_semilla} legisladores nacionales de la semilla.")

    for fuente in FUENTES:
        estado = procesar_fuente(fuente, politicos, hoy)
        resultado["sources"][fuente["id"]] = estado
        print(f"[{estado['state']}] {fuente['nombre']}: {estado['message']}")

    resultado["sources"]["senado-nacion"] = {
        "name": "Senado de la Nación — senadores por Salta",
        "url": "https://www.senado.gob.ar/",
        "state": "manual",
        "checked_at": ahora_iso(),
        "message": "Cargados a mano (Royón, Orozco, Guzmán Coraita; mandato hasta 2031). No se verifican solos: "
                   "si alguien cambia, usá el formulario 'Agregar político'.",
    }

    completar_campos(politicos)
    guardar_json(POLITICIANS_PATH, politicos)
    guardar_json(STATUS_PATH, resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main())
