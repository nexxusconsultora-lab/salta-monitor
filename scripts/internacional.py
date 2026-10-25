# -*- coding: utf-8 -*-
"""
NEWAR · Prensa internacional.

Lee los titulares de diarios y agencias del mundo (The Economist, The Wall Street Journal, Miami Herald,
Financial Times, The New York Times, BBC, etc.) y los guarda en data/news_internacional.json.
Marca cuáles hablan de Argentina / Salta (campo "arg") y cuáles de América Latina (campo "lat").

Cómo sumar un diario: agregá un bloque a MEDIOS (nombre, país, idioma, lista de RSS y, opcional, el dominio
para buscarlo en Google News si el RSS propio no anda). Si un diario falla, el script lo anota en
data/internacional_status.json y sigue con los demás. Nada de esto inventa notas: cada fila es un titular
que el propio diario publicó, con su enlace.
No traduce: los titulares quedan en el idioma original.
"""
import os, re, json, hashlib, calendar, time, urllib.request
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import feedparser

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
OUT = os.path.join(DATA, "news_internacional.json")
ST = os.path.join(DATA, "internacional_status.json")
UA = "Mozilla/5.0 (compatible; NEWAR/1.0; lector de RSS)"
MAX_POR_FEED = 40
MAX_GUARDADAS = 2500
DIAS = 21

# nombre, país, idioma, [RSS propios], dominio para Google News (respaldo)
MEDIOS = [
    ("The Economist", "Reino Unido", "en", ["https://www.economist.com/latest/rss.xml", "https://www.economist.com/the-americas/rss.xml"], "economist.com"),
    ("The Wall Street Journal", "EE.UU.", "en", ["https://feeds.a.dj.com/rss/RSSWorldNews.xml", "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml"], "wsj.com"),
    ("Miami Herald", "EE.UU.", "en", [], "miamiherald.com"),
    ("Financial Times", "Reino Unido", "en", ["https://www.ft.com/world?format=rss"], "ft.com"),
    ("The New York Times", "EE.UU.", "en", ["https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml"], "nytimes.com"),
    ("The Washington Post", "EE.UU.", "en", ["https://feeds.washingtonpost.com/rss/world"], "washingtonpost.com"),
    ("Bloomberg", "EE.UU.", "en", ["https://feeds.bloomberg.com/markets/news.rss", "https://feeds.bloomberg.com/politics/news.rss"], "bloomberg.com"),
    ("Reuters", "Reino Unido", "en", [], "reuters.com"),
    ("Associated Press", "EE.UU.", "en", [], "apnews.com"),
    ("BBC News", "Reino Unido", "en", ["https://feeds.bbci.co.uk/news/world/rss.xml"], "bbc.com"),
    ("BBC Mundo", "Reino Unido", "es", ["https://feeds.bbci.co.uk/mundo/rss.xml"], "bbc.com"),
    ("The Guardian", "Reino Unido", "en", ["https://www.theguardian.com/world/rss"], "theguardian.com"),
    ("Al Jazeera", "Catar", "en", ["https://www.aljazeera.com/xml/rss/all.xml"], "aljazeera.com"),
    ("DW Español", "Alemania", "es", ["https://rss.dw.com/rdf/rss-sp-all"], "dw.com"),
    ("France 24 Español", "Francia", "es", ["https://www.france24.com/es/rss"], "france24.com"),
    ("El País (América)", "España", "es", ["https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada"], "elpais.com"),
    ("CNN en Español", "EE.UU.", "es", [], "cnnespanol.cnn.com"),
]

ARG = re.compile(r"argentin|milei|buenos aires|salta\b|kicillof|mercosur|malvinas|falkland|\bcfk\b|kirchner|bullrich|caputo|\bbcra\b|peso argentino|patagoni|vaca muerta|noa\b", re.I)
LAT = re.compile(r"latin america|latam|latinoam|am[eé]rica latina|brazil|brasil|chile\b|mexic|m[eé]xico|colombia|venezuela|peru\b|per[uú]\b|bolivia|uruguay|paraguay|ecuador|cuba\b|lula|maduro|sheinbaum|petro\b|boric|kast\b|mercosur|the americas", re.I)


def get(url, t=20):
    rq = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*;q=0.5"})
    with urllib.request.urlopen(rq, timeout=t) as r:
        return r.read()


def iso(e):
    for k in ("published_parsed", "updated_parsed"):
        tm = e.get(k)
        if tm:
            try:
                ts = calendar.timegm(tm)
            except (TypeError, ValueError, OverflowError):
                continue
            if ts > time.time() + 2 * 86400:
                continue
            return datetime.fromtimestamp(ts, timezone.utc).isoformat()
    return None


def limpia(t):
    import html
    t = html.unescape(str(t or ""))
    t = re.sub(r"<[^>]*>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def gnews(dom, idioma):
    # Titulares recientes del dominio, con foco en Argentina y Latinoamérica además del mundo en general.
    q = f"site:{dom} when:2d"
    if idioma == "es":
        return f"https://news.google.com/rss/search?q={quote(q)}&hl=es-419&gl=AR&ceid=AR:es-419"
    return f"https://news.google.com/rss/search?q={quote(q)}&hl=en-US&gl=US&ceid=US:en"


def idn(link, titulo):
    return hashlib.sha256(f"Internacional|{link or titulo}".encode()).hexdigest()[:16]


def main():
    try:
        viejas = json.load(open(OUT, encoding="utf-8"))
        if not isinstance(viejas, list):
            viejas = []
    except Exception:
        viejas = []
    ids = {n.get("id") for n in viejas}
    ahora = datetime.now(timezone.utc).isoformat()
    status, nuevas = {}, 0
    for nombre, pais, idioma, rss, dom in MEDIOS:
        entradas, via, err = [], None, None
        for u in rss:
            try:
                f = feedparser.parse(get(u))
                if f.entries:
                    entradas += f.entries[:MAX_POR_FEED]
                    via = "rss"
            except Exception as ex:  # noqa: BLE001
                err = str(ex)[:140]
        if not entradas and dom:
            try:
                f = feedparser.parse(get(gnews(dom, idioma)))
                entradas = f.entries[:MAX_POR_FEED]
                via = "google_news" if entradas else None
            except Exception as ex:  # noqa: BLE001
                err = str(ex)[:140]
        hechas = 0
        for e in entradas:
            link, tit = e.get("link", ""), limpia(e.get("title", ""))
            if via == "google_news":
                tit = re.sub(r"\s+-\s+[^-]{2,40}$", "", tit)  # saca « - Nombre del medio » del final
            if not link or not tit:
                continue
            i = idn(link, tit)
            if i in ids:
                continue
            ids.add(i)
            txt = tit + " " + limpia(e.get("summary", ""))[:300]
            viejas.append({"id": i, "category": "Internacional", "title": tit, "link": link, "source": nombre,
                           "country": pais, "lang": idioma, "published_iso": iso(e), "collected_at": ahora,
                           "arg": bool(ARG.search(txt)), "lat": bool(LAT.search(txt)), "via": via})
            hechas += 1
        nuevas += hechas
        status[nombre] = {"state": "ok" if entradas else ("error" if err else "sin_resultados"), "via": via,
                          "items": len(entradas), "nuevas": hechas, "message": err, "checked_at": ahora}
        print(f"{nombre}: {len(entradas)} titulares ({via or 'nada'}), {hechas} nuevos")
    corte = (datetime.now(timezone.utc) - timedelta(days=DIAS)).isoformat()
    viejas = [n for n in viejas if (n.get("published_iso") or n.get("collected_at") or "") >= corte]
    viejas.sort(key=lambda n: n.get("published_iso") or n.get("collected_at") or "", reverse=True)
    viejas = viejas[:MAX_GUARDADAS]
    os.makedirs(DATA, exist_ok=True)
    json.dump(viejas, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"generated_at": ahora, "medios": status}, open(ST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Nuevas: {nuevas} · guardadas: {len(viejas)}")


if __name__ == "__main__":
    main()
