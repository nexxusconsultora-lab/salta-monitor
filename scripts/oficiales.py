#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/oficiales.py

Recolector de publicaciones de fuentes OFICIALES para "Radar Político
Salta": boletines oficiales, justicia, legislatura provincial, Concejo
Deliberante de Salta capital y contrataciones/licitaciones.

No requiere instalar nada (no hay "pip install" en el workflow): usa
solo la biblioteca estándar de Python 3.11.

Entradas:
  - data/fuentes_oficiales.json  -> qué páginas leer y cómo
  - data/politicians.json        -> a quién buscar dentro de cada texto
  - data/oficiales.json          -> lo que ya se guardó en corridas anteriores

Salidas:
  - data/oficiales.json          -> publicaciones (viejas + nuevas)
  - data/oficiales_status.json   -> estado de cada fuente en esta corrida

Diseño a propósito:
  - Si una fuente falla, se anota su error y se sigue con las demás: una
    fuente caída no debe tirar abajo toda la corrida (por eso casi todo
    está envuelto en try/except).
  - Se respeta siempre el robots.txt de cada sitio. Si prohíbe el acceso
    automático, la fuente queda "bloqueada" y no se la toca.
  - Solo se leen enlaces (<a href="…">) presentes en el HTML que llega
    del servidor: páginas que arman su listado con JavaScript no se
    pueden leer así (quedan en "sin_resultados").
  - Es una coincidencia de texto para detectar nombres, no una
    verificación de identidad: puede haber homónimos. Por eso cada
    publicación guarda el fragmento de texto donde apareció el nombre.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib import robotparser
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

FUENTES_PATH = DATA_DIR / "fuentes_oficiales.json"
POLITICIANS_PATH = DATA_DIR / "politicians.json"
ITEMS_PATH = DATA_DIR / "oficiales.json"
STATUS_PATH = DATA_DIR / "oficiales_status.json"
ARCHIVO_PATH = DATA_DIR / "oficiales_archivo.json"
ALERTAS_PATH = DATA_DIR / "oficiales_nuevas_con_personas.json"

# Cuando oficiales.json acumule más publicaciones que esto, las más
# viejas (por fecha_publicacion o first_seen) se mueven a
# oficiales_archivo.json en vez de perderse, para que la página no
# tarde cada vez más en cargar. Con el volumen actual de estas fuentes
# (decenas por corrida) esto puede tardar años en activarse, así que es
# una protección a futuro, no algo urgente hoy.
TOPE_ITEMS_ACTIVOS = 3000

USER_AGENT = (
    "RadarPoliticoSaltaBot/1.0 "
    "(+https://github.com/nexxusconsultora-lab/salta-monitor; "
    "proyecto sin fines de lucro de monitoreo de publicaciones oficiales)"
)

MAX_ITEMS_PER_SOURCE = 40      # tope de publicaciones nuevas por fuente y por corrida
MAX_DETALLE_BORA = 80          # tope de decretos/resoluciones a abrir en detalle (BORA)
ARG_TZ = timezone(timedelta(hours=-3))


# ---------------------------------------------------------------------------
# Utilidades básicas
# ---------------------------------------------------------------------------

def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def fold(texto: str) -> str:
    """minúsculas y sin acentos, para comparar sin importar tildes."""
    texto = unicodedata.normalize("NFD", texto or "")
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto.lower()


def cargar_json(path: Path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as e:
        print(f"[aviso] {path} tiene JSON inválido, se ignora: {e}", file=sys.stderr)
        return default


def guardar_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def id_estable(*partes: str) -> str:
    crudo = "|".join(partes)
    return hashlib.sha1(crudo.encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Descarga y robots.txt
# ---------------------------------------------------------------------------

def robots_permite(url: str) -> bool:
    """
    Devuelve False solo si el robots.txt del sitio dice explícitamente
    que no se puede acceder a esta URL. Ante cualquier duda (no hay
    robots.txt, no se pudo leer, etc.) se asume que sí se permite: no
    queremos bloquear una fuente por un problema de red al pedir el
    robots.txt, solo por una prohibición real y explícita.
    """
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        req = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as resp:
            crudo = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return True
    rp = robotparser.RobotFileParser()
    rp.parse(crudo.splitlines())
    try:
        return rp.can_fetch(USER_AGENT, url)
    except Exception:
        return True


def descargar(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "es-AR,es;q=0.9",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        crudo = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
        return crudo.decode(charset, errors="replace")


# ---------------------------------------------------------------------------
# Extracción de enlaces de una página de listado
# ---------------------------------------------------------------------------

_BLOQUE_TAGS = {"p", "div", "li", "article", "section", "tr", "td",
                "h1", "h2", "h3", "h4", "h5", "h6"}
_TITULO_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


class ExtractorDeEnlaces(HTMLParser):
    """
    Recorre una página HTML y junta, por cada <a href="…">, el texto del
    enlace, el texto del bloque donde está (para usar como resumen) y el
    título de sección más reciente (para fuentes que agrupan por
    categoría, como el Senado de Salta).
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.enlaces = []
        self._href_actual = None
        self._texto_enlace = []
        self._texto_bloque = []
        self._seccion_actual = None
        self._en_titulo = False
        self._texto_titulo = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in _TITULO_TAGS:
            self._en_titulo = True
            self._texto_titulo = []
        if tag in _BLOQUE_TAGS:
            self._texto_bloque = []
        if tag == "a" and attrs.get("href"):
            self._href_actual = attrs["href"]
            self._texto_enlace = []

    def handle_endtag(self, tag):
        if tag in _TITULO_TAGS:
            self._en_titulo = False
            texto = " ".join(self._texto_titulo).strip()
            if texto:
                self._seccion_actual = texto
        if tag == "a" and self._href_actual is not None:
            self.enlaces.append({
                "href": self._href_actual,
                "texto_enlace": " ".join(self._texto_enlace).strip(),
                "texto_bloque": " ".join(self._texto_bloque).strip(),
                "seccion": self._seccion_actual,
            })
            self._href_actual = None

    def handle_data(self, data):
        texto = re.sub(r"\s+", " ", data).strip()
        if not texto:
            return
        if self._href_actual is not None:
            self._texto_enlace.append(texto)
        if self._en_titulo:
            self._texto_titulo.append(texto)
        self._texto_bloque.append(texto)


def extraer_enlaces(html_texto: str):
    parser = ExtractorDeEnlaces()
    parser.feed(html_texto)
    return parser.enlaces


# ---------------------------------------------------------------------------
# Detección de fecha a partir de la URL, cuando se puede
# ---------------------------------------------------------------------------

_RE_FECHA_CDSALTA = re.compile(r"/(20\d{2})/(\d{2})/(\d{2})/")
_RE_FECHA_8DIG = re.compile(r"(20\d{2})(\d{2})(\d{2})(?!\d)")


def fecha_desde_url(url: str):
    for patron in (_RE_FECHA_CDSALTA, _RE_FECHA_8DIG):
        m = patron.search(url)
        if m:
            y, mo, d = m.groups()
            try:
                datetime(int(y), int(mo), int(d))
                return f"{y}-{mo}-{d}"
            except ValueError:
                continue
    return None


# ---------------------------------------------------------------------------
# Políticos: a quién buscar en el texto
# ---------------------------------------------------------------------------

def cargar_politicos():
    personas = cargar_json(POLITICIANS_PATH, [])
    if not isinstance(personas, list):
        return []
    salida = []
    for p in personas:
        nombres = set()
        nombre_display = (p.get("name") or "").strip()
        if nombre_display:
            nombres.add(nombre_display)
        for alias in p.get("aliases") or []:
            alias = (alias or "").strip()
            if alias:
                nombres.add(alias)
        # Solo nombres de 2 o más palabras: un apellido suelto da
        # demasiados falsos positivos en documentos oficiales.
        nombres = {n for n in nombres if len(n.split()) >= 2}
        if nombres and p.get("id"):
            salida.append({
                "id": p["id"],
                "nombres": nombres,
                "nombre_display": nombre_display or next(iter(nombres)),
            })
    return salida


def detectar_personas(texto: str, politicos):
    if not texto or not politicos:
        return [], None
    encontrados = []
    contexto = None
    texto_plegado = fold(texto)
    for persona in politicos:
        for nombre in persona["nombres"]:
            pos = texto_plegado.find(fold(nombre))
            if pos != -1:
                encontrados.append(persona["id"])
                if contexto is None:
                    ini = max(0, pos - 50)
                    fin = min(len(texto), pos + len(nombre) + 50)
                    contexto = texto[ini:fin].strip()
                break
    return encontrados, contexto


# ---------------------------------------------------------------------------
# Detalle de un decreto/resolución individual (hoy, solo BORA)
# ---------------------------------------------------------------------------

def obtener_tipo_y_texto_detalle(fuente: dict, abs_url: str, presupuesto: dict):
    """
    Para fuentes con fetch_detail=true (hoy, el Boletín Oficial de la
    Nación): abre la publicación individual, arma su texto plano (para
    buscar nombres adentro) y trata de reconocer el tipo de acto (Ley,
    Decreto, Resolución, etc.). Respeta un tope global de aperturas por
    corrida para no tardar horas.
    """
    if not fuente.get("fetch_detail"):
        return None, None
    if presupuesto["usado"] >= presupuesto["tope"]:
        return None, None
    try:
        html_detalle = descargar(abs_url)
    except Exception:
        return None, None
    presupuesto["usado"] += 1

    texto_plano = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html_detalle,
                          flags=re.S | re.I)
    texto_plano = re.sub(r"<[^>]+>", " ", texto_plano)
    texto_plano = re.sub(r"\s+", " ", texto_plano).strip()

    excluir = [fold(s) for s in (fuente.get("detalle_excluir_secciones") or [])]
    if excluir and any(e in fold(texto_plano)[:800] for e in excluir):
        return None, None

    tipo = None
    for candidato in fuente.get("detalle_tipos") or []:
        if fold(candidato) in fold(texto_plano)[:400]:
            tipo = candidato
            break

    return tipo, texto_plano[:6000]  # se recorta: alcanza para detectar nombres


# ---------------------------------------------------------------------------
# Armar una publicación a partir de un enlace encontrado
# ---------------------------------------------------------------------------

def armar_item(fuente: dict, enlace: dict, abs_url: str, politicos,
                texto_detalle=None, tipo_desde_detalle=None):
    titulo = enlace["texto_enlace"] or enlace["texto_bloque"][:160]
    titulo = re.sub(r"\s+", " ", titulo).strip()
    if not titulo:
        return None

    resumen = None
    if fuente.get("use_summary"):
        resumen = enlace["texto_bloque"]
        if resumen and titulo and resumen.startswith(titulo):
            resumen = resumen[len(titulo):].strip(" -–—:")
        resumen = resumen[:400] if resumen else None

    tipo_acto = tipo_desde_detalle or fuente.get("tipo_fijo")
    if not tipo_acto:
        mapa_seccion = fuente.get("tipo_por_seccion") or {}
        tipo_acto = mapa_seccion.get(enlace.get("seccion") or "")
    tipo_acto = tipo_acto or "Otro"

    fecha = fecha_desde_url(abs_url) or fecha_desde_url(enlace["href"])

    texto_para_buscar = " ".join(t for t in [titulo, resumen, texto_detalle] if t)
    personas, contexto = detectar_personas(texto_para_buscar, politicos)

    jurisdiccion = fuente.get("jurisdiccion", "")
    menciona_salta = False
    if jurisdiccion not in ("Salta", "Salta Capital"):
        menciona_salta = "salta" in fold(texto_para_buscar)

    return {
        "id": f"{fuente['id']}-{id_estable(fuente['id'], abs_url)}",
        "titulo": titulo,
        "url": abs_url,
        "fuente": fuente.get("name", fuente["id"]),
        "organismo": fuente.get("organismo"),
        "jurisdiccion": jurisdiccion,
        "tipo_acto": tipo_acto,
        "resumen": resumen,
        "fecha_publicacion": fecha,
        "personas": personas,
        "contexto": contexto,
        "menciona_salta": menciona_salta,
        "first_seen": ahora_iso(),
    }


# ---------------------------------------------------------------------------
# Procesar una fuente completa
# ---------------------------------------------------------------------------

def procesar_fuente(fuente: dict, politicos, urls_ya_guardadas, presupuesto_detalle):
    fid = fuente["id"]
    nombre = fuente.get("name", fid)
    url = fuente["url"]
    estado = {"name": nombre, "url": url, "checked_at": ahora_iso()}

    if not fuente.get("enabled", True):
        estado["state"] = "desactivada"
        estado["message"] = "Fuente desactivada en fuentes_oficiales.json."
        return estado, []

    try:
        if not robots_permite(url):
            estado["state"] = "bloqueada"
            estado["message"] = ("El robots.txt de este sitio no permite el acceso "
                                  "automático. No se accede, tal como pide el sitio.")
            return estado, []
    except Exception:
        pass  # no bloqueamos la fuente por un problema al leer robots.txt

    try:
        html_texto = descargar(url)
    except urllib.error.HTTPError as e:
        estado["state"] = "error"
        estado["message"] = f"El sitio respondió con un error HTTP {e.code}."
        return estado, []
    except Exception as e:
        estado["state"] = "error"
        estado["message"] = f"No se pudo descargar la página ({type(e).__name__}: {e})."
        return estado, []

    try:
        enlaces = extraer_enlaces(html_texto)
    except Exception as e:
        estado["state"] = "error"
        estado["message"] = f"No se pudo interpretar el HTML de la página ({e})."
        return estado, []

    patron = re.compile(fuente["link_pattern"])
    secciones_incluir = fuente.get("sections_include")

    candidatos = []
    vistos = set()
    for enlace in enlaces:
        href = enlace["href"]
        if not href or href.startswith("#") or href.lower().startswith(("javascript:", "mailto:")):
            continue
        abs_url = urljoin(url, href)
        if fuente.get("skip_query"):
            abs_url = abs_url.split("?")[0]
        if not (patron.search(abs_url) or patron.search(href)):
            continue
        if secciones_incluir:
            seccion = enlace.get("seccion") or ""
            if not any(fold(s) in fold(seccion) for s in secciones_incluir):
                continue
        if abs_url in vistos:
            continue
        vistos.add(abs_url)
        candidatos.append((enlace, abs_url))

    if not candidatos:
        estado["state"] = "sin_resultados"
        estado["message"] = ("Se pudo leer la página pero no se encontró ningún enlace "
                              "que coincida con el patrón configurado. Puede que el sitio "
                              "haya cambiado de diseño, o que arme su listado con JavaScript.")
        return estado, []

    nuevos = []
    for enlace, abs_url in candidatos:
        if abs_url in urls_ya_guardadas:
            continue
        if len(nuevos) >= MAX_ITEMS_PER_SOURCE:
            break
        tipo_detalle, texto_detalle = obtener_tipo_y_texto_detalle(fuente, abs_url, presupuesto_detalle)
        item = armar_item(fuente, enlace, abs_url, politicos, texto_detalle, tipo_detalle)
        if item:
            nuevos.append(item)

    estado["state"] = "ok"
    if nuevos:
        estado["message"] = f"{len(nuevos)} publicación(es) nueva(s) en esta corrida."
    else:
        estado["message"] = "Sin publicaciones nuevas desde la última corrida (no es un error)."

    return estado, nuevos


# ---------------------------------------------------------------------------
# Archivado: no perder historial, pero mantener el archivo activo liviano
# ---------------------------------------------------------------------------

def compactar_items(items: list, tope: int = TOPE_ITEMS_ACTIVOS):
    """
    Si hay más de `tope` publicaciones guardadas, mueve las más viejas
    (por fecha_publicacion, o por first_seen si no hay fecha) a un
    archivo aparte. Devuelve (items_activos, items_para_archivar).
    Nunca borra nada: solo separa.
    """
    if len(items) <= tope:
        return items, []

    def clave_orden(it):
        return it.get("fecha_publicacion") or (it.get("first_seen") or "")[:10] or "0000-00-00"

    ordenados = sorted(items, key=clave_orden, reverse=True)  # más nuevo primero
    activos = ordenados[:tope]
    para_archivar = ordenados[tope:]
    return activos, para_archivar


# ---------------------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------------------

def main() -> int:
    config = cargar_json(FUENTES_PATH, {"sources": []})
    fuentes = config.get("sources", [])
    if not fuentes:
        print("[error] data/fuentes_oficiales.json no tiene fuentes configuradas.", file=sys.stderr)
        return 1

    politicos = cargar_politicos()

    datos_previos = cargar_json(ITEMS_PATH, {"items": []})
    items_previos = datos_previos.get("items", [])
    urls_ya_guardadas = {it.get("url") for it in items_previos if it.get("url")}

    presupuesto_detalle = {"usado": 0, "tope": MAX_DETALLE_BORA}

    nuevos_status = {}
    todos_los_nuevos = []

    for fuente in fuentes:
        fid = fuente.get("id", "?")
        print(f"-> Procesando fuente: {fid}")
        try:
            estado, nuevos = procesar_fuente(fuente, politicos, urls_ya_guardadas, presupuesto_detalle)
        except Exception as e:
            estado = {
                "name": fuente.get("name", fid),
                "url": fuente.get("url"),
                "checked_at": ahora_iso(),
                "state": "error",
                "message": f"Error inesperado al procesar esta fuente: {type(e).__name__}: {e}",
            }
            nuevos = []
        nuevos_status[fid] = estado
        todos_los_nuevos.extend(nuevos)
        print(f"   estado: {estado['state']} — {estado['message']}")

    items_finales = items_previos + todos_los_nuevos

    activos, para_archivar = compactar_items(items_finales)
    if para_archivar:
        archivo_previo = cargar_json(ARCHIVO_PATH, {"items": []})
        ids_en_archivo = {it.get("id") for it in archivo_previo.get("items", [])}
        nuevos_en_archivo = [it for it in para_archivar if it.get("id") not in ids_en_archivo]
        guardar_json(ARCHIVO_PATH, {
            "generated_at": ahora_iso(),
            "items": archivo_previo.get("items", []) + nuevos_en_archivo,
        })
        print(f"Se archivaron {len(nuevos_en_archivo)} publicación(es) vieja(s) en {ARCHIVO_PATH.name} "
              f"(no se pierden, solo salen del archivo activo).")

    guardar_json(ITEMS_PATH, {
        "generated_at": ahora_iso(),
        "items": activos,
    })
    guardar_json(STATUS_PATH, {
        "generated_at": ahora_iso(),
        "sources": nuevos_status,
    })

    # Aviso opcional por Telegram: solo se arma este archivo si de verdad
    # hay publicaciones nuevas que nombran a alguien de tu lista. Un paso
    # aparte del workflow (scripts/alertar_telegram.py) lo lee y lo borra;
    # si no configuraste Telegram, este archivo simplemente no se usa.
    id_a_nombre = {p["id"]: p["nombre_display"] for p in politicos}
    con_personas = [it for it in todos_los_nuevos if it.get("personas")]
    if con_personas:
        for it in con_personas:
            it["personas_nombres"] = [id_a_nombre.get(pid, pid) for pid in it["personas"]]
        guardar_json(ALERTAS_PATH, con_personas)
    elif ALERTAS_PATH.exists():
        ALERTAS_PATH.unlink()

    print(f"\nListo: {len(todos_los_nuevos)} publicación(es) nueva(s), {len(activos)} activas "
          f"({len(para_archivar)} archivadas en esta corrida).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
