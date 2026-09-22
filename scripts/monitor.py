# -*- coding: utf-8 -*-
"""
Radar Político Salta - Recolector de menciones en medios digitales.

Qué hace:
1. Para cada político/persona en data/politicians.json, busca noticias
   recientes en Google News, limitado a un grupo de medios de Salta.
2. También lee directamente los RSS de El Tribuno (política y Salta) y
   cruza esas noticias contra la lista de nombres a seguir.
3. Calcula un puntaje de tono (positivo/negativo/neutral) con un método
   simple basado en palabras clave en español (no es Inteligencia
   Artificial "de verdad": es un punto de partida honesto y gratuito).
4. Guarda todo en data/mentions.json y arma data/aggregates.json con
   resúmenes por político y por día, que es lo que consume el panel web.

Este script está pensado para correr repetidamente (por ejemplo cada
15 minutos vía GitHub Actions) sin duplicar noticias ya guardadas.
"""

import os
import re
import json
import time
import hashlib
import calendar
import urllib.request
from collections import defaultdict
from itertools import combinations
from datetime import datetime, timezone
from urllib.parse import quote

import feedparser

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
POLITICIANS_FILE = os.path.join(DATA_DIR, "politicians.json")
TOPICS_FILE = os.path.join(DATA_DIR, "topics.json")
MENTIONS_FILE = os.path.join(DATA_DIR, "mentions.json")
TOPIC_MENTIONS_FILE = os.path.join(DATA_DIR, "topic_mentions.json")
TOPIC_DATA_FILE = os.path.join(DATA_DIR, "topics_data.json")
AGGREGATES_FILE = os.path.join(DATA_DIR, "aggregates.json")
DOSSIERS_FILE = os.path.join(DATA_DIR, "dossiers.json")
EVENTS_FILE = os.path.join(DATA_DIR, "events.json")
NEWS_GENERAL_FILE = os.path.join(DATA_DIR, "news_general.json")
CANDIDATES_FILE = os.path.join(DATA_DIR, "candidatos.json")
MEDIA_STATUS_FILE = os.path.join(DATA_DIR, "medios_status.json")

# Medios nacionales de alcance amplio, para la sección de noticias
# generales (no atada a políticos puntuales). Usamos Google News en vez
# de intentar adivinar la URL de RSS propia de cada uno.
NATIONAL_SITES = [
    "infobae.com", "clarin.com", "lanacion.com.ar", "pagina12.com.ar",
    "ambito.com", "tn.com.ar", "perfil.com",
]

MAX_GENERAL_ITEMS_STORED = 1200
MAX_GENERAL_ITEMS_PER_FEED = 60

# Medios de Salta verificados a los que restringimos una de las búsquedas
# (alta precisión). Agregá o sacá dominios según lo que quieras cubrir;
# solo agregá dominios que hayas confirmado vos mismo que existen.
SOURCE_SITES = [
    "eltribuno.com",
    "quepasasalta.com.ar",
    "elintra.com.ar",
    "salta12.com.ar",
    "informatesalta.com.ar",
    "elintransigente.com",
    "nuevodiariosalta.com.ar",
    "radiosalta.com.ar",
]

# Departamentos y localidades de la provincia, para una segunda búsqueda
# más amplia (sin restringir a dominios específicos) que capture medios
# locales de cada zona que Google News indexe, aunque no sepamos su URL.
DEPARTMENTS = [
    "Salta capital", "Orán", "Tartagal", "Metán", "Rosario de la Frontera",
    "Cafayate", "General Güemes", "Cachi", "Cerrillos", "Chicoana",
    "Rosario de Lerma", "San Ramón de la Nueva Orán", "Embarcación",
    "Joaquín V. González", "El Carril", "Guachipas", "Iruya", "La Caldera",
    "La Poma", "La Viña", "Los Andes", "San Carlos", "Molinos",
]

# Feeds propios que además leemos completos (no solo por nombre buscado),
# para detectar menciones que Google News podría no traer todavía.
DIRECT_FEEDS = [
    ("El Tribuno - Política", "https://www.eltribuno.com/rss-new/politica.rss"),
    ("El Tribuno - Salta", "https://www.eltribuno.com/rss-new/salta.rss"),
    ("El Tribuno - Municipios", "https://www.eltribuno.com/rss-new/municipios.rss"),
]

# Medios locales que se leen DIRECTO (no solo a través de Google News).
# El script descubre solo la dirección del RSS de cada uno (busca la
# etiqueta <link rel="alternate" type="application/rss+xml"> en la portada
# y, si no hay, prueba /feed/, /rss, etc.) y anota el resultado en
# data/medios_status.json para que puedas ver cuáles funcionan.
# Para sumar otro medio, agregá una línea (nombre, portada).
MEDIA_HOMEPAGES = [
    ("Qué Pasa Salta", "https://www.quepasasalta.com.ar/"),
    ("El Intra", "https://elintra.com.ar/"),
    ("Informate Salta", "https://www.informatesalta.com.ar/"),
    ("El Intransigente", "https://www.elintransigente.com/"),
    ("Salta12", "https://www.salta12.com.ar/"),
    ("Nuevo Diario de Salta", "https://www.nuevodiariosalta.com.ar/"),
    ("Radio Salta", "https://www.radiosalta.com.ar/"),
]
FEED_RETRY_HOURS = 6
FEED_FALLBACK_PATHS = ["feed/", "rss", "feed", "rss.xml", "feed.xml", "rss/"]
HTTP_USER_AGENT = "Mozilla/5.0 (compatible; RadarPoliticoSalta/1.0; lector de RSS)"
MAX_CANDIDATES_STORED = 200
CANDIDATE_KEEP_DAYS = 45

# Palabras a ignorar al calcular "temas en tendencia" (muy comunes en
# español y en el lenguaje periodístico, no aportan información).
STOPWORDS = {
    "de", "la", "el", "en", "y", "a", "los", "las", "un", "una", "por",
    "con", "para", "que", "su", "sus", "del", "al", "es", "se", "no",
    "más", "salta", "tras", "sobre", "como", "fue", "fueron", "entre",
    "esta", "este", "estos", "estas", "video", "así", "también", "hoy",
    "qué", "cómo", "gobierno", "provincia", "provincial", "les", "le",
}

MAX_MENTIONS_STORED = 4000
MAX_ITEMS_PER_FEED = 40

# Diccionario de tono muy simple. Es deliberadamente básico: la idea es
# que puedas ampliarlo vos mismo, o más adelante reemplazarlo por una
# llamada a un modelo de lenguaje si querés más precisión.
POSITIVE_WORDS = [
    "elogia", "elogió", "destaca", "destacó", "logro", "logró", "avance",
    "avanzó", "acuerdo", "celebra", "celebró", "aprobó", "impulsa",
    "impulsó", "beneficio", "mejora", "mejoró", "respaldo", "apoyo",
    "reconocimiento", "éxito", "crecimiento", "inversión", "solución",
]

NEGATIVE_WORDS = [
    "crítica", "criticó", "denuncia", "denunció", "escándalo", "polémica",
    "polemizó", "rechazo", "rechazó", "acusación", "acusó", "corrupción",
    "fraude", "renuncia", "renunció", "conflicto", "crisis", "protesta",
    "cuestionó", "cuestionamiento", "investigación", "imputado", "condena",
    "fracaso", "reclamo", "reclamó",
]


def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def sentiment_score(text):
    text_low = text.lower()
    pos = sum(text_low.count(w) for w in POSITIVE_WORDS)
    neg = sum(text_low.count(w) for w in NEGATIVE_WORDS)
    score = pos - neg
    if score > 0:
        label = "positivo"
    elif score < 0:
        label = "negativo"
    else:
        label = "neutral"
    return score, label


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def entry_published_iso(entry):
    """Fecha REAL de publicación en ISO 8601 (UTC), tomada de la fuente.
    Devuelve None si la fuente no la trae (en ese caso el panel muestra
    'sin fecha' en vez de inventar una)."""
    for key in ("published_parsed", "updated_parsed"):
        tm = entry.get(key)
        if tm:
            try:
                ts = calendar.timegm(tm)
            except (TypeError, ValueError, OverflowError):
                continue
            # Una fecha en el futuro lejano es un error de la fuente.
            if ts > time.time() + 2 * 86400:
                continue
            return datetime.fromtimestamp(ts, timezone.utc).isoformat()
    return None


def is_active(p):
    """¿Esta persona está hoy en funciones?
    - data/politicians.json trae 'vigencia' (lo mantiene scripts/nomina.py).
    - Si no la trae, se deduce del año de fin de mandato."""
    vig = p.get("vigencia")
    if vig == "ex":
        return False
    if vig == "vigente":
        return True
    fin = str(p.get("term_end") or "").strip()
    if fin.isdigit() and int(fin) < datetime.now(timezone.utc).year:
        return False
    return True


def http_get(url, timeout=15):
    req = urllib.request.Request(url, headers={
        "User-Agent": HTTP_USER_AGENT,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def parse_feed_bytes(raw):
    feed = feedparser.parse(raw)
    return feed if feed.entries else None


def discover_feed(homepage):
    """Devuelve (url_del_feed, feed_parseado) o (None, None)."""
    candidates = []
    try:
        html = http_get(homepage).decode("utf-8", errors="replace")
        for tag in re.findall(r"<link[^>]+>", html, flags=re.I):
            if re.search(r"type=[\"'](application/(rss|atom)\+xml)[\"']", tag, flags=re.I):
                m = re.search(r"href=[\"']([^\"']+)[\"']", tag, flags=re.I)
                if m:
                    href = m.group(1).replace("&amp;", "&")
                    if href.startswith("//"):
                        href = "https:" + href
                    elif href.startswith("/"):
                        href = homepage.rstrip("/") + href
                    candidates.append(href)
    except Exception as exc:  # noqa: BLE001
        print(f"[aviso] no se pudo leer la portada {homepage}: {exc}")
    candidates += [homepage.rstrip("/") + "/" + path for path in FEED_FALLBACK_PATHS]
    seen = set()
    for url in candidates:
        if url in seen:
            continue
        seen.add(url)
        try:
            feed = parse_feed_bytes(http_get(url))
        except Exception:  # noqa: BLE001
            continue
        if feed:
            return url, feed
    return None, None


def fetch_media_batches():
    """Lee todos los feeds directos (los fijos de El Tribuno + los medios
    descubiertos). Devuelve una lista de {name, entries} y escribe el
    estado de cada medio en data/medios_status.json."""
    previous = load_json(MEDIA_STATUS_FILE, {}).get("media", {})
    batches, status = [], {}

    for name, url in DIRECT_FEEDS:
        raw_feed = None
        try:
            raw_feed = parse_feed_bytes(http_get(url))
        except Exception as exc:  # noqa: BLE001
            status[name] = {"state": "error", "feed_url": url, "message": str(exc)[:160], "checked_at": now_iso()}
            continue
        if raw_feed:
            batches.append({"name": name, "entries": raw_feed.entries[:MAX_ITEMS_PER_FEED]})
            status[name] = {"state": "ok", "feed_url": url, "items": len(raw_feed.entries), "checked_at": now_iso()}
        else:
            status[name] = {"state": "sin_resultados", "feed_url": url, "message": "El feed respondió vacío.", "checked_at": now_iso()}

    for name, homepage in MEDIA_HOMEPAGES:
        prev = previous.get(name, {})
        # Si ya se probó hace poco y no había RSS, no se vuelve a probar en
        # cada corrida (corre cada 5 min): se reintenta cada 6 horas.
        if prev.get("state") == "sin_feed" and prev.get("checked_at"):
            try:
                age = time.time() - datetime.fromisoformat(prev["checked_at"]).timestamp()
            except ValueError:
                age = 1e9
            if age < FEED_RETRY_HOURS * 3600:
                status[name] = prev
                continue
        feed, feed_url = None, prev.get("feed_url")
        if feed_url:  # ya lo habíamos descubierto: se reutiliza
            try:
                feed = parse_feed_bytes(http_get(feed_url))
            except Exception:  # noqa: BLE001
                feed = None
        if not feed:
            feed_url, feed = discover_feed(homepage)
        if not feed:
            status[name] = {"state": "sin_feed", "homepage": homepage, "checked_at": now_iso(),
                            "message": "No se encontró un RSS que funcione. Se sigue cubriendo a través de Google News."}
            continue
        entries = feed.entries[:MAX_ITEMS_PER_FEED]
        latest = max((entry_published_iso(e) or "" for e in entries), default="")
        batches.append({"name": name, "entries": entries})
        status[name] = {"state": "ok", "homepage": homepage, "feed_url": feed_url,
                        "items": len(feed.entries), "latest_published": latest or None, "checked_at": now_iso()}

    save_json(MEDIA_STATUS_FILE, {"generated_at": now_iso(), "media": status})
    return batches


# Cargos que, si aparecen pegados a un nombre en un titular, indican
# que alguien está ejerciendo (o ejerció) un cargo público.
CARGO_RE = (
    r"(?i:(?P<cargo>diputad[oa]s?|senador(?:a|es)?|concejal(?:a|es)?|intendente|"
    r"ministr[oa]|secretari[oa]|legislador(?:a|es)?|vicegobernador(?:a)?|"
    r"presidente del concejo|interventor(?:a)?))"
)
NAME_RE = (
    r"(?P<nombre>[A-ZÁÉÍÓÚÑ][\wáéíóúñü'’]+"
    r"(?:\s+(?:(?:de la|del|de|da|di)\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñü'’]+){0,3})"
)
CANDIDATE_PATTERN = re.compile(
    CARGO_RE + r"(?:\s+(?i:provincial|nacional|municipal|electo|electa|saliente))?\s+" + NAME_RE
)
CANDIDATE_STOP = {
    "salta", "nacional", "provincial", "municipal", "camara", "cámara", "concejo", "deliberante",
    "gobierno", "ley", "senado", "diputados", "argentina", "ciudad", "capital", "de", "la",
    "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo",
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
    "octubre", "noviembre", "diciembre", "presidente", "gobernador", "libertad", "avanza",
    "justicia", "fiscal", "juez", "policía", "policia", "ministerio", "secretaría", "secretaria",
    "hospital", "escuela", "universidad", "banco", "sesión", "sesion", "proyecto", "comisión", "comision",
}


def _fold(s):
    import unicodedata
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def known_surnames(politicians):
    """Apellidos (última palabra de nombre y alias) de TODA la nómina,
    incluidos los ex: sirven para no marcar como 'nuevo' a alguien que
    ya conocemos."""
    out = set()
    for p in politicians:
        for n in [p.get("name", "")] + list(p.get("aliases") or []):
            toks = re.findall(r"[a-z0-9]+", _fold(n))
            if toks:
                out.add(toks[-1])          # apellido
                if len(toks) >= 3:
                    out.add(toks[-2])      # apellido compuesto ("Cuellar Garnica")
    return out


def detect_candidates(batches, politicians):
    """Recorre TODOS los titulares de los medios y detecta nombres que
    aparecen con un cargo público ('el diputado X', 'la concejal Y') y
    que no están en tu lista. Es una heurística de texto: puede marcar
    falsos positivos, por eso solo genera una lista para revisar; no
    agrega a nadie automáticamente."""
    known = known_surnames(politicians)
    found = {}
    for batch in batches:
        for entry in batch["entries"]:
            title = entry.get("title", "")
            text = f"{title}. {entry.get('summary', '')}"
            text = re.sub(r"<[^>]+>", " ", text)
            for m in CANDIDATE_PATTERN.finditer(text):
                nombre = m.group("nombre").strip()
                toks = re.findall(r"[a-z0-9]+", _fold(nombre))
                if not toks or toks[0] in CANDIDATE_STOP or any(t in CANDIDATE_STOP for t in toks[:1]):
                    continue
                if toks[-1] in known:
                    continue
                key = " ".join(toks)
                cargo = m.group("cargo").lower()
                rec = found.setdefault(key, {
                    "name": nombre, "cargo_texto": cargo, "count": 0, "examples": [],
                })
                rec["count"] += 1
                if len(nombre) > len(rec["name"]):
                    rec["name"] = nombre
                link = entry.get("link", "")
                if link and all(ex["link"] != link for ex in rec["examples"]) and len(rec["examples"]) < 3:
                    rec["examples"].append({
                        "title": title, "link": link, "source": batch["name"],
                        "published_iso": entry_published_iso(entry),
                    })
    return found


def update_candidates_file(found):
    old = load_json(CANDIDATES_FILE, {}).get("items", [])
    merged = {" ".join(re.findall(r"[a-z0-9]+", _fold(i["name"]))): i for i in old}
    now = now_iso()
    for key, rec in found.items():
        if key in merged:
            cur = merged[key]
            cur["count"] = cur.get("count", 0) + rec["count"]
            cur["last_seen"] = now
            links = {e["link"] for e in cur.get("examples", [])}
            for ex in rec["examples"]:
                if ex["link"] not in links and len(cur["examples"]) < 3:
                    cur["examples"].append(ex)
        else:
            merged[key] = {**rec, "first_seen": now, "last_seen": now}
    cutoff = time.time() - CANDIDATE_KEEP_DAYS * 86400
    items = [i for i in merged.values()
             if datetime.fromisoformat(i["last_seen"]).timestamp() >= cutoff]
    items.sort(key=lambda i: (i.get("count", 0), i["last_seen"]), reverse=True)
    save_json(CANDIDATES_FILE, {"generated_at": now, "items": items[:MAX_CANDIDATES_STORED]})
    return len(found)


def build_national_query_url():
    sites = " OR ".join(f"site:{s}" for s in NATIONAL_SITES)
    return google_news_url(f"política Argentina ({sites})")


def build_provincial_query_url():
    sites = " OR ".join(f"site:{s}" for s in SOURCE_SITES)
    places = " OR ".join(f'"{d}"' for d in DEPARTMENTS)
    return google_news_url(f"Salta ({sites} OR {places})")


def collect_general_news():
    """Noticias generales de Nacional y Provincia, sin atarlas a un político
    puntual — para poder ver rápido 'qué pasó' en una ventana de horas,
    con la fuente de cada una a la vista."""
    existing = load_json(NEWS_GENERAL_FILE, [])
    existing_ids = {n["id"] for n in existing}
    new_count = 0

    queries = [
        ("Nacional", build_national_query_url()),
        ("Provincial", build_provincial_query_url()),
    ]
    for category, url in queries:
        feed = fetch_feed(url)
        if not feed:
            continue
        for entry in feed.entries[:MAX_GENERAL_ITEMS_PER_FEED]:
            link = entry.get("link", "")
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            mid = make_id(f"{category}|{link}")
            if mid in existing_ids or not link:
                continue
            score, label = sentiment_score(f"{title} {summary}")
            source = entry_source_name(entry, "Google News")
            published = entry.get("published", datetime.now(timezone.utc).isoformat())
            existing.append({
                "id": mid,
                "category": category,
                "title": title,
                "quote": extract_quote(title),
                "link": link,
                "source": source,
                "published": published,
                "published_iso": entry_published_iso(entry),
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "sentiment_label": label,
            })
            existing_ids.add(mid)
            new_count += 1

    existing.sort(key=lambda n: n.get("collected_at", ""), reverse=True)
    existing = existing[:MAX_GENERAL_ITEMS_STORED]
    save_json(NEWS_GENERAL_FILE, existing)
    return new_count


def google_news_url(query):
    return (
        "https://news.google.com/rss/search?q="
        + quote(query)
        + "&hl=es-419&gl=AR&ceid=AR:es-419"
    )


def build_query_url(politician):
    """Búsqueda de alta precisión: solo en los medios verificados."""
    names = " OR ".join(f'"{a}"' for a in politician["aliases"])
    sites = " OR ".join(f"site:{s}" for s in SOURCE_SITES)
    return google_news_url(f"({names}) ({sites})")


def build_wide_query_url(politician):
    """Búsqueda amplia: sin restringir dominio, agregando el nombre de la
    provincia y de los departamentos para capturar medios locales que no
    tenemos identificados por URL (radios, portales de cada zona, etc.)."""
    names = " OR ".join(f'"{a}"' for a in politician["aliases"])
    places = " OR ".join(f'"{d}"' for d in DEPARTMENTS)
    return google_news_url(f"({names}) ({places})")


def fetch_feed(url):
    try:
        return feedparser.parse(url)
    except Exception as exc:  # noqa: BLE001
        print(f"[aviso] no se pudo leer {url}: {exc}")
        return None


def make_id(seed):
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


def entry_source_name(entry, fallback):
    src = getattr(entry, "source", None)
    if src and getattr(src, "title", None):
        return src.title
    return fallback


def norm(s):
    """Minúsculas, sin tildes, apóstrofes unificados y espacios colapsados."""
    import unicodedata
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"[’‘´`]", "'", s)
    return re.sub(r"\s+", " ", s).strip()


# Palabras que indican que el texto habla de política/cargos. Se exigen
# cuando el nombre es corto y por lo tanto ambiguo (homónimos).
CARGO_CONTEXT_RE = re.compile(
    r"(?<![a-z0-9])(diputad[oa]s?|senador(?:a|es)?|concejal(?:a|es)?|legislador(?:a|es)?|"
    r"gobernador(?:a)?|intendente|legislatura|concejo|camara de (?:diputados|senadores)|"
    r"bloque|oficialismo|oposicion|ministr[oa]|libertad avanza|todos por salta|por salta)(?![a-z0-9])"
)

# Medios de Salta: dentro de ellos un nombre de dos palabras casi seguro
# es la persona local, por eso ahí no se exige contexto adicional.
LOCAL_SOURCE_KEYS = (
    "tribuno", "que pasa salta", "quepasasalta", "intra", "informate", "intransigente",
    "salta12", "salta 12", "nuevo diario", "radio salta", "salta4400", "salta 4400",
    "aries", "punto uno", "todo salta", "data salta", "gente de salta", "de frente salta",
)


def is_local_source(name):
    n = norm(name)
    return any(k in n for k in LOCAL_SOURCE_KEYS)


TOKEN_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)

# Palabras que suelen empezar oración con mayúscula: no cuentan como
# "otro nombre propio" pegado al nombre buscado.
STARTERS = {
    "el", "la", "los", "las", "un", "una", "segun", "para", "por", "con", "sin", "ante", "tras",
    "desde", "hasta", "en", "de", "del", "al", "y", "o", "que", "si", "no", "hoy", "ayer", "sobre",
    "entre", "como", "cuando", "donde", "mientras", "aunque", "tambien", "ademas", "luego", "pero",
    "dijo", "afirmo", "aseguro", "senalo", "advirtio", "anuncio", "presento", "pidio", "critico",
}

_PATTERN_CACHE = {}


def _alias_tokens(p):
    key = (p.get("id"), p.get("name"), tuple(p.get("aliases") or []))
    hit = _PATTERN_CACHE.get(key)
    if hit:
        return hit
    strong, weak, seen = [], [], set()
    for name in [p.get("name", "")] + list(p.get("aliases") or []):
        toks = tuple(norm(m.group()) for m in TOKEN_RE.finditer(norm(name)))
        if not toks or toks in seen:
            continue
        seen.add(toks)
        (strong if len(toks) >= 3 else weak).append(toks)
    _PATTERN_CACHE[key] = (strong, weak)
    return strong, weak


def _find(seq, alias):
    n = len(alias)
    return [i for i in range(len(seq) - n + 1) if tuple(seq[i:i + n]) == alias]


def _es_nombre_propio_pegado(matches, i, n, cargo_words):
    """¿Hay otro nombre propio pegado al nombre encontrado?
    'Juan Esteban Romero' contiene 'Juan Esteban', pero es otra persona."""
    a, b = matches[i], matches[i + n - 1]
    # palabra siguiente, pegada (solo espacios de por medio) y con mayúscula
    if i + n < len(matches):
        nxt = matches[i + n]
        if (not text_between(a, b, nxt) and nxt.group()[0].isupper()
                and norm(nxt.group()) not in STARTERS):
            return True
    # palabra anterior, pegada, con mayúscula, que no sea cargo ni inicio de oración
    if i > 0:
        prv = matches[i - 1]
        if (not text_between(a, b, prv, before=True) and prv.group()[0].isupper()
                and norm(prv.group()) not in STARTERS and norm(prv.group()) not in cargo_words):
            return True
    return False


def text_between(first, last, other, before=False):
    """Texto entre el nombre encontrado y la palabra vecina; vacío = pegadas."""
    src = first.string
    gap = src[other.end():first.start()] if before else src[last.end():other.start()]
    return gap.strip()


CARGO_WORDS = {
    "diputado", "diputada", "diputados", "senador", "senadora", "senadores", "concejal", "concejala",
    "concejales", "legislador", "legisladora", "gobernador", "gobernadora", "intendente", "ministro",
    "ministra", "presidente", "presidenta", "vicegobernador", "vicegobernadora", "doctor", "doctora",
    "dr", "dra", "sr", "sra", "don", "dona", "ing", "lic", "cr", "cra",
}


def person_match(text, p, lenient=False):
    """¿El texto nombra a esta persona?

    - Nombre de 3 o más palabras ("Claudio José Cansino"): coincidencia directa.
    - Nombre de 1 o 2 palabras ("Enzo Alabi", "Sáenz"): puede ser un
      homónimo, así que además tiene que haber contexto político
      (diputado, senador, bloque...) en el texto. Excepción: en un medio de
      Salta (lenient=True) alcanza con el nombre de 2 palabras.
    - Se busca palabra completa y sin importar tildes ("Cari" no coincide
      dentro de "Carina").
    - Si el nombre corto viene pegado a otro nombre propio ("Juan Esteban
      Romero" cuando buscamos a "Juan Esteban"), es otra persona: se descarta.
    """
    text = str(text or "")
    matches = list(TOKEN_RE.finditer(text))
    if not matches:
        return False
    seq = [norm(m.group()) for m in matches]
    strong, weak = _alias_tokens(p)
    for alias in strong:
        if _find(seq, alias):
            return True
    hits = []
    for alias in weak:
        for i in _find(seq, alias):
            if not _es_nombre_propio_pegado(matches, i, len(alias), CARGO_WORDS):
                hits.append(len(alias))
    if not hits:
        return False
    if CARGO_CONTEXT_RE.search(norm(text)):
        return True
    return bool(lenient and (max(hits) >= 2 or p.get("chamber") == "Ejecutivo"))


def match_politicians(text, politicians, lenient=False):
    return [p["id"] for p in politicians if person_match(text, p, lenient=lenient)]


# Evita repetir la misma nota (mismo título) para la misma persona cuando
# llega por dos caminos (feed directo y Google News).
SEEN_TITLES = set()


def title_key(title):
    t = re.sub(r"\s+[-–—|]\s+[^-–—|]{2,40}$", "", str(title or ""))
    return " ".join(re.findall(r"[a-z0-9]+", norm(t)))


LEGAL_KEYWORDS = [
    "denuncia", "denunciado", "denunciada", "imputado", "imputada",
    "procesado", "procesada", "indagatoria", "fiscalía", "causa judicial",
    "juicio", "condena", "condenado", "condenada", "allanamiento",
    "investigación penal", "sobreseído", "sobreseída", "fraude",
    "corrupción", "malversación", "coima",
]


def has_legal_signal(text):
    """Marca si el título/copete usa vocabulario de contexto judicial.
    ¡OJO! Esto NO determina ni afirma que la persona tenga una causa
    real: solo indica que la nota usa esas palabras. Puede ser sobre la
    causa de un tercero, una nota que la menciona sin acusarla, una
    desmentida, etc. Siempre hay que leer la nota original — por eso el
    link está siempre a la vista donde se muestra esto."""
    text_low = text.lower()
    return any(k in text_low for k in LEGAL_KEYWORDS)


def extract_quote(text):
    """Extrae una frase textual citada en el título/copete, si la hay.
    Los medios argentinos suelen citar así: Fulano: "la frase" o
    Fulano dijo que “la frase”. Es una extracción simple por comillas,
    no una atribución verificada: siempre hay que poder ver la nota
    original (por eso guardamos también el link)."""
    match = re.search(r'[“"]([^”"]{10,220})[”"]', text)
    return match.group(1).strip() if match else None


def add_mention(mentions, existing_ids, *, mid, politician, title, link,
                 source, published, sentiment_score_value, sentiment_label,
                 published_iso=None):
    if mid in existing_ids or not link:
        return False
    tkey = (politician["id"], title_key(title))
    if tkey[1] and tkey in SEEN_TITLES:
        return False
    SEEN_TITLES.add(tkey)
    mentions.append({
        "id": mid,
        "politician_id": politician["id"],
        "politician_name": politician["name"],
        "title": title,
        "quote": extract_quote(title),
        "legal_signal": has_legal_signal(title),
        "link": link,
        "source": source,
        "published": published,
        "published_iso": published_iso,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "sentiment_score": sentiment_score_value,
        "sentiment_label": sentiment_label,
    })
    existing_ids.add(mid)
    return True


def _collect_from_url(url, p, mentions, existing_ids):
    new_count = 0
    feed = fetch_feed(url)
    if not feed:
        return 0
    for entry in feed.entries[:MAX_ITEMS_PER_FEED]:
        link = entry.get("link", "")
        title = entry.get("title", "")
        summary = entry.get("summary", "")
        # El id incluye al político (no solo el link): así, si una misma
        # noticia menciona a más de una persona, queda un registro por
        # cada una -y extract_comentions() puede detectar el cruce-, en
        # vez de que la segunda persona quede descartada como "duplicado".
        mid = make_id(f"{link}|{p['id']}")
        source = entry_source_name(entry, "Google News")
        # Google News a veces devuelve notas que no nombran a la persona
        # (o nombran a un homónimo): se descartan.
        clean_summary = re.sub(r"<[^>]+>", " ", summary)
        if not person_match(f"{title}. {clean_summary}", p, lenient=is_local_source(source)):
            continue
        score, label = sentiment_score(f"{title} {summary}")
        published = entry.get("published", datetime.now(timezone.utc).isoformat())
        if add_mention(
            mentions, existing_ids, mid=mid, politician=p, title=title,
            link=link, source=source, published=published,
            sentiment_score_value=score, sentiment_label=label,
            published_iso=entry_published_iso(entry),
        ):
            new_count += 1
    return new_count


def collect_by_politician(politicians, mentions, existing_ids):
    """Dos pasadas por político: una de alta precisión (medios verificados)
    y otra amplia (toda la provincia y sus departamentos), para no perder
    cobertura de medios locales que no tenemos mapeados por dominio."""
    new_count = 0
    for p in politicians:
        new_count += _collect_from_url(build_query_url(p), p, mentions, existing_ids)
        new_count += _collect_from_url(build_wide_query_url(p), p, mentions, existing_ids)
    return new_count


def collect_from_direct_feeds(politicians, mentions, existing_ids, batches):
    """Cruza cada titular de cada medio leído directo contra la lista de
    políticos EN FUNCIONES (los 'ex' no generan menciones nuevas)."""
    new_count = 0
    by_id = {p["id"]: p for p in politicians}
    for batch in batches:
        feed_name = batch["name"]
        for entry in batch["entries"]:
            link = entry.get("link", "")
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            full_text = f"{title} {summary}"
            matched_ids = match_politicians(re.sub(r"<[^>]+>", " ", full_text), politicians, lenient=True)
            if not matched_ids:
                continue
            score, label = sentiment_score(full_text)
            published = entry.get("published", datetime.now(timezone.utc).isoformat())
            published_iso = entry_published_iso(entry)
            for pid in matched_ids:
                mid = make_id(f"{link}|{pid}")
                if add_mention(
                    mentions, existing_ids, mid=mid, politician=by_id[pid],
                    title=title, link=link, source=feed_name,
                    published=published, sentiment_score_value=score,
                    sentiment_label=label, published_iso=published_iso,
                ):
                    new_count += 1
    return new_count


def collect_media_general(batches):
    """Los titulares de los medios locales leídos directo también van a
    la sección de noticias generales (Provincial), con su fecha real."""
    existing = load_json(NEWS_GENERAL_FILE, [])
    existing_ids = {n["id"] for n in existing}
    new_count = 0
    for batch in batches:
        for entry in batch["entries"]:
            link = entry.get("link", "")
            title = entry.get("title", "")
            if not link or not title:
                continue
            mid = make_id(f"Provincial|{link}")
            if mid in existing_ids:
                continue
            score, label = sentiment_score(f"{title} {entry.get('summary', '')}")
            existing.append({
                "id": mid,
                "category": "Provincial",
                "title": title,
                "quote": extract_quote(title),
                "link": link,
                "source": batch["name"],
                "published": entry.get("published", datetime.now(timezone.utc).isoformat()),
                "published_iso": entry_published_iso(entry),
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "sentiment_label": label,
            })
            existing_ids.add(mid)
            new_count += 1
    existing.sort(key=lambda n: n.get("collected_at", ""), reverse=True)
    save_json(NEWS_GENERAL_FILE, existing[:MAX_GENERAL_ITEMS_STORED])
    return new_count


def extract_trending_terms(mentions, hours=48, top_n=15):
    """Cuenta qué palabras significativas se repiten más en los títulos de
    las últimas `hours` horas. Es una heurística simple (frecuencia de
    palabras, sin stopwords), no un modelo de lenguaje: sirve para detectar
    de qué se está hablando más, no para entender matices."""
    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    counts = defaultdict(int)
    for m in mentions:
        try:
            collected = datetime.fromisoformat(m["collected_at"]).timestamp()
        except (KeyError, ValueError):
            continue
        if collected < cutoff:
            continue
        words = re.findall(r"[a-záéíóúñü]{4,}", m["title"].lower())
        seen_in_title = set()
        for w in words:
            if w in STOPWORDS or w in seen_in_title:
                continue
            seen_in_title.add(w)
            counts[w] += 1
    top = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:top_n]
    return [{"term": t, "count": c} for t, c in top if c > 1]


def extract_comentions(mentions, politicians):
    """Detecta qué políticos aparecen mencionados en la misma noticia
    (mismo link), como señal simple de qué figuras se asocian entre sí
    en la cobertura mediática."""
    by_id = {p["id"]: p["name"] for p in politicians}
    politicians_by_link = defaultdict(set)
    for m in mentions:
        politicians_by_link[m["link"]].add(m["politician_id"])

    pair_counts = defaultdict(int)
    for pids in politicians_by_link.values():
        if len(pids) < 2:
            continue
        for a, b in combinations(sorted(pids), 2):
            pair_counts[(a, b)] += 1

    pairs = sorted(pair_counts.items(), key=lambda kv: kv[1], reverse=True)[:20]
    return [
        {"a": by_id.get(a, a), "b": by_id.get(b, b), "count": c}
        for (a, b), c in pairs
    ]


def build_topic_query_url(topic):
    """Igual criterio que para políticos: una búsqueda por tema, restringida
    a Salta (o a medios nacionales si el tema tiene scope: "nacional")."""
    names = " OR ".join(f'"{k}"' for k in topic["keywords"])
    if topic.get("scope") == "nacional":
        sites = " OR ".join(f"site:{s}" for s in NATIONAL_SITES)
    else:
        places = " OR ".join(f'"{d}"' for d in DEPARTMENTS)
        site_list = " OR ".join(f"site:{s}" for s in SOURCE_SITES)
        sites = f"{site_list} OR {places}"
    return google_news_url(f"({names}) ({sites})")


def collect_by_topic(topics, topic_mentions, existing_ids, politicians):
    new_count = 0
    for t in topics:
        feed = fetch_feed(build_topic_query_url(t))
        if not feed:
            continue
        for entry in feed.entries[:MAX_ITEMS_PER_FEED]:
            link = entry.get("link", "")
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            mid = make_id(f"{link}|tema|{t['id']}")
            if mid in existing_ids or not link:
                continue
            score, label = sentiment_score(f"{title} {summary}")
            source = entry_source_name(entry, "Google News")
            published = entry.get("published", datetime.now(timezone.utc).isoformat())
            topic_mentions.append({
                "id": mid,
                "topic_id": t["id"],
                "topic_name": t["name"],
                "title": title,
                "quote": extract_quote(title),
                "link": link,
                "source": source,
                "published": published,
                "published_iso": entry_published_iso(entry),
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "sentiment_score": score,
                "sentiment_label": label,
                # Qué políticos, si los hay, están mencionados en esta nota
                # sobre el tema — así se puede ver quién se asocia a qué.
                "politicians_mentioned": match_politicians(f"{title} {summary}", politicians),
            })
            existing_ids.add(mid)
            new_count += 1
    return new_count


def build_topics_data(topic_mentions, topics, politicians):
    by_id_name = {p["id"]: p["name"] for p in politicians}
    result = {"generated_at": datetime.now(timezone.utc).isoformat(), "topics": {}}

    for t in topics:
        own = [m for m in topic_mentions if m["topic_id"] == t["id"]]
        own_sorted = sorted(own, key=lambda m: m.get("collected_at", ""), reverse=True)

        total = len(own)
        pos = sum(1 for m in own if m["sentiment_label"] == "positivo")
        neg = sum(1 for m in own if m["sentiment_label"] == "negativo")
        neu = total - pos - neg

        by_day = defaultdict(lambda: {"total": 0, "score_sum": 0})
        for m in own:
            day = (m.get("published") or m["collected_at"])[:10]
            by_day[day]["total"] += 1
            by_day[day]["score_sum"] += m["sentiment_score"]

        politician_counts = defaultdict(int)
        for m in own:
            for pid in m.get("politicians_mentioned", []):
                politician_counts[pid] += 1
        involved = sorted(politician_counts.items(), key=lambda kv: kv[1], reverse=True)
        involved = [{"name": by_id_name.get(pid, pid), "count": c} for pid, c in involved]

        quotes = [
            {"quote": m["quote"], "source": m["source"], "link": m["link"],
             "date": m.get("published") or m["collected_at"]}
            for m in own_sorted if m.get("quote")
        ][:15]

        result["topics"][t["id"]] = {
            "id": t["id"], "name": t["name"], "role": t.get("role", ""),
            "total_mentions": total,
            "sentiment_breakdown": {"positivo": pos, "negativo": neg, "neutral": neu},
            "sentiment_by_day": by_day,
            "top_topics": extract_trending_terms(own, hours=24 * 30, top_n=8),
            "politicians_involved": involved,
            "quotes": quotes,
            "recent_articles": [
                {"title": m["title"], "link": m["link"], "source": m["source"],
                 "date": m.get("published") or m["collected_at"],
                 "sentiment_label": m["sentiment_label"]}
                for m in own_sorted[:30]
            ],
        }
    return result


def politician_trending_terms(mentions, politician_id, hours=168, top_n=8):
    """Igual que extract_trending_terms pero acotado a un solo político,
    para mostrar de qué temas se habla específicamente sobre esa persona."""
    own = [m for m in mentions if m["politician_id"] == politician_id]
    return extract_trending_terms(own, hours=hours, top_n=top_n)


def build_dossiers(mentions, politicians):
    """Arma una ficha pública por político: historial, tono, temas propios,
    declaraciones citadas (extraídas de títulos) y con quién aparece
    mencionado. Todo a partir de datos ya recolectados de medios públicos."""
    dossiers = {}
    for p in politicians:
        own = [m for m in mentions if m["politician_id"] == p["id"]]
        own_sorted = sorted(own, key=lambda m: m.get("collected_at", ""), reverse=True)

        total = len(own)
        pos = sum(1 for m in own if m["sentiment_label"] == "positivo")
        neg = sum(1 for m in own if m["sentiment_label"] == "negativo")
        neu = total - pos - neg

        by_day = defaultdict(lambda: {"total": 0, "score_sum": 0})
        for m in own:
            day = (m.get("published") or m["collected_at"])[:10]
            by_day[day]["total"] += 1
            by_day[day]["score_sum"] += m["sentiment_score"]

        quotes = [
            {
                "quote": m["quote"],
                "source": m["source"],
                "link": m["link"],
                "date": m.get("published") or m["collected_at"],
            }
            for m in own_sorted if m.get("quote")
        ][:15]

        legal_mentions = [
            {
                "title": m["title"],
                "source": m["source"],
                "link": m["link"],
                "date": m.get("published") or m["collected_at"],
            }
            for m in own_sorted if m.get("legal_signal")
        ][:20]

        dossiers[p["id"]] = {
            "id": p["id"],
            "name": p["name"],
            "role": p.get("role", ""),
            "total_mentions": total,
            "sentiment_breakdown": {"positivo": pos, "negativo": neg, "neutral": neu},
            "sentiment_by_day": by_day,
            "top_topics": politician_trending_terms(mentions, p["id"]),
            "quotes": quotes,
            "legal_mentions": legal_mentions,
            "recent_articles": [
                {
                    "title": m["title"], "link": m["link"], "source": m["source"],
                    "date": m.get("published") or m["collected_at"],
                    "sentiment_label": m["sentiment_label"],
                }
                for m in own_sorted[:30]
            ],
        }
    return dossiers


def _significant_words(title):
    return {
        w for w in re.findall(r"[a-záéíóúñü]{5,}", title.lower())
        if w not in STOPWORDS
    }


def build_events(mentions, topic_mentions, general_news, politicians, topics,
                  hours=72, min_shared_words=2, max_items=400):
    """El 'cerebro': agrupa noticias de distintas fuentes/tipos que
    probablemente hablan del mismo hecho (comparten al menos
    `min_shared_words` palabras significativas en el título y ocurrieron
    dentro de la misma ventana de horas), y arma un 'evento' que muestra
    qué políticos y temas están conectados a él. Es agrupamiento por
    texto, no comprensión real del contenido: dos notas no relacionadas
    que casualmente comparten palabras pueden agruparse por error —
    revisá siempre los artículos originales de cada evento."""
    items = []
    for m in mentions:
        items.append({
            "title": m["title"], "link": m["link"], "source": m["source"],
            "date": m.get("published") or m["collected_at"], "collected_at": m["collected_at"],
            "politician_ids": {m["politician_id"]}, "topic_ids": set(),
        })
    for m in topic_mentions:
        items.append({
            "title": m["title"], "link": m["link"], "source": m["source"],
            "date": m.get("published") or m["collected_at"], "collected_at": m["collected_at"],
            "politician_ids": set(m.get("politicians_mentioned", [])), "topic_ids": {m["topic_id"]},
        })
    for n in general_news:
        items.append({
            "title": n["title"], "link": n["link"], "source": n["source"],
            "date": n.get("published") or n["collected_at"], "collected_at": n["collected_at"],
            "politician_ids": set(), "topic_ids": set(),
        })

    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    recent = []
    for it in items:
        try:
            t = datetime.fromisoformat(it["collected_at"]).timestamp()
        except (ValueError, KeyError):
            continue
        if t >= cutoff:
            it["_words"] = _significant_words(it["title"])
            recent.append(it)
    recent = recent[:max_items]

    parent = list(range(len(recent)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for i in range(len(recent)):
        for j in range(i + 1, len(recent)):
            if len(recent[i]["_words"] & recent[j]["_words"]) >= min_shared_words:
                union(i, j)

    clusters = defaultdict(list)
    for i in range(len(recent)):
        clusters[find(i)].append(recent[i])

    pol_names = {p["id"]: p["name"] for p in politicians}
    topic_names = {t["id"]: t["name"] for t in topics}

    events = []
    for cluster in clusters.values():
        seen_links, unique_items = set(), []
        for it in cluster:
            if it["link"] in seen_links:
                continue
            seen_links.add(it["link"])
            unique_items.append(it)
        if len(unique_items) < 2:
            continue

        pol_ids, topic_ids = set(), set()
        for it in unique_items:
            pol_ids |= it["politician_ids"]
            topic_ids |= it["topic_ids"]
        unique_items.sort(key=lambda x: x["collected_at"], reverse=True)

        events.append({
            "id": make_id("evento|" + unique_items[0]["link"]),
            "title": unique_items[0]["title"],
            "items_count": len(unique_items),
            "politicians": sorted(pol_names.get(pid, pid) for pid in pol_ids),
            "topics": sorted(topic_names.get(tid, tid) for tid in topic_ids),
            "sources": sorted({it["source"] for it in unique_items}),
            "first_seen": min(it["collected_at"] for it in unique_items),
            "last_seen": max(it["collected_at"] for it in unique_items),
            "items": [
                {"title": it["title"], "link": it["link"], "source": it["source"], "date": it["date"]}
                for it in unique_items[:15]
            ],
        })

    events.sort(key=lambda e: e["items_count"], reverse=True)
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "events": events[:50]}


def build_aggregates(mentions, politicians):
    by_politician = defaultdict(lambda: {
        "total": 0, "positivo": 0, "negativo": 0, "neutral": 0, "score_sum": 0,
    })
    by_day = defaultdict(lambda: defaultdict(lambda: {"total": 0, "score_sum": 0}))

    for m in mentions:
        pid = m["politician_id"]
        by_politician[pid]["total"] += 1
        by_politician[pid][m["sentiment_label"]] += 1
        by_politician[pid]["score_sum"] += m["sentiment_score"]

        day = (m.get("published") or m["collected_at"])[:10]
        by_day[day][pid]["total"] += 1
        by_day[day][pid]["score_sum"] += m["sentiment_score"]

    aggregates = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "by_politician": by_politician,
        "by_day": by_day,
        "politicians": politicians,
        "trending_terms": extract_trending_terms(mentions),
        "comentions": extract_comentions(mentions, politicians),
    }
    save_json(AGGREGATES_FILE, aggregates)


def main():
    politicians = load_json(POLITICIANS_FILE, [])
    topics = load_json(TOPICS_FILE, [])
    if not politicians and not topics:
        print("No hay políticos ni temas configurados.")
        return

    # Solo se buscan noticias nuevas sobre quien está EN FUNCIONES. Los
    # "ex" quedan en la lista (historial) pero no generan menciones nuevas.
    active = [p for p in politicians if is_active(p)]
    print(f"Políticos en funciones: {len(active)} de {len(politicians)} en la lista.")

    # Medios locales leídos directo (RSS descubierto solo) — una sola vez
    # por corrida, se reutiliza abajo.
    media_batches = fetch_media_batches()
    print(f"Medios leídos directo: {len(media_batches)}")
    print(f"Nombres nuevos con cargo detectados en titulares: "
          f"{update_candidates_file(detect_candidates(media_batches, politicians))}")

    if politicians:
        mentions = load_json(MENTIONS_FILE, [])
        existing_ids = {m["id"] for m in mentions}

        SEEN_TITLES.clear()
        SEEN_TITLES.update((m["politician_id"], title_key(m.get("title", ""))) for m in mentions)
        # Primero los feeds directos (traen el enlace real de la nota) y
        # después Google News (cuyos enlaces son redirecciones).
        new_by_feeds = collect_from_direct_feeds(active, mentions, existing_ids, media_batches)
        new_by_search = collect_by_politician(active, mentions, existing_ids)

        mentions.sort(key=lambda m: m.get("collected_at", ""), reverse=True)
        mentions = mentions[:MAX_MENTIONS_STORED]

        save_json(MENTIONS_FILE, mentions)
        build_aggregates(mentions, politicians)
        save_json(DOSSIERS_FILE, build_dossiers(mentions, politicians))

        total_new = new_by_search + new_by_feeds
        print(f"Menciones nuevas: {total_new} (búsqueda: {new_by_search}, feeds directos: {new_by_feeds})")
        print(f"Total menciones almacenadas: {len(mentions)}")
    else:
        mentions = []

    if topics:
        topic_mentions = load_json(TOPIC_MENTIONS_FILE, [])
        existing_topic_ids = {m["id"] for m in topic_mentions}
        new_topic_count = collect_by_topic(topics, topic_mentions, existing_topic_ids, active)

        topic_mentions.sort(key=lambda m: m.get("collected_at", ""), reverse=True)
        topic_mentions = topic_mentions[:MAX_MENTIONS_STORED]

        save_json(TOPIC_MENTIONS_FILE, topic_mentions)
        save_json(TOPIC_DATA_FILE, build_topics_data(topic_mentions, topics, politicians))
        print(f"Menciones de temas nuevas: {new_topic_count}")

    new_general = collect_general_news() + collect_media_general(media_batches)
    general_news = load_json(NEWS_GENERAL_FILE, [])
    print(f"Noticias generales nuevas (nacional + provincial + medios directos): {new_general}")

    topic_mentions_for_events = load_json(TOPIC_MENTIONS_FILE, []) if topics else []
    events_data = build_events(mentions, topic_mentions_for_events, general_news, politicians, topics)
    save_json(EVENTS_FILE, events_data)
    print(f"Eventos detectados: {len(events_data['events'])}")


if __name__ == "__main__":
    main()
