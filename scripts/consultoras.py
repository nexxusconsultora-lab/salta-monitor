# -*- coding: utf-8 -*-
"""
NEWAR · Consultoras, bancos y organismos: recolector de notas.

Para cada fuente de data/consultoras.json:
  1) si tiene "rss" (feeds propios), lee sus publicaciones;
  2) busca en Google News las notas de la prensa que la nombran (campo "busca"), y se queda sólo con las que
     nombran a la fuente en el título (alias), para evitar ruido.
Guarda todo en data/consultoras_news.json con fecha de publicación, medio y enlace, y anota en "estado" cuáles
fuentes respondieron. No inventa nada: cada fila es un titular real con su enlace. Los números que aparecen en el
título se copian tal como los escribió el medio (NO están verificados).
"""
import os, re, json, hashlib, calendar, time, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import feedparser

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
IN = os.path.join(DATA, "consultoras.json")
OUT = os.path.join(DATA, "consultoras_news.json")
UA = "Mozilla/5.0 (compatible; NEWAR/1.0; lector de RSS)"
DIAS = 60
MAX_GUARDADAS = 5000
POR_BUSQUEDA = 15


def get(url, t=15):
    rq = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*;q=0.5"})
    with urllib.request.urlopen(rq, timeout=t) as r:
        return r.read()


def fold(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def sin_tildes(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


AMBIGUAS = {"GRADE", "FIEL", "CERES", "DANE", "CAME", "CAEM", "IEP", "ONS", "REM", "CAF", "BID", "UCA"}


def armar_alias(f):
    """Patrones de reconocimiento, siempre como palabra entera (así 'ONS' no coincide con 'acciones' ni 'UCA' con 'educación').
    Siglas de hasta 3 letras y las ambiguas (GRADE, FIEL, DANE, CERES…) exigen las mayúsculas exactas; las demás siglas
    aceptan también 'Indec' o 'Cepa'. Los nombres normales van sin distinguir mayúsculas ni tildes."""
    pats = []
    for a in (f.get("alias") or [f["nombre"]]):
        a = str(a or "").strip()
        if not a:
            continue
        plano = sin_tildes(a)
        sigla = len(a) <= 5 and a.upper() == a and any(c.isalpha() for c in a)
        lim = (r"(?<![A-Za-z0-9])", r"(?![A-Za-z0-9])")
        if sigla and (len(a) <= 3 or a in AMBIGUAS):
            pats.append(("S", re.compile(lim[0] + re.escape(plano) + lim[1])))
        elif sigla:
            pats.append(("S", re.compile(lim[0] + "(?:" + re.escape(plano) + "|" + re.escape(plano.capitalize()) + ")" + lim[1])))
        else:
            pats.append(("N", re.compile(r"(?<![a-z0-9])" + re.escape(fold(a)) + r"(?![a-z0-9])")))
    return pats


def nombra(pats, texto):
    plano = sin_tildes(texto)
    bajo = plano.lower()
    return any(p.search(plano if tipo == "S" else bajo) for tipo, p in pats)

def limpia(t):
    import html
    t = html.unescape(str(t or ""))
    t = re.sub(r"<[^>]*>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


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


NUM = re.compile(r"\d{1,3}(?:[.,]\d+)?\s?(?:%|puntos(?: básicos)?|pb|millones(?: de (?:dólares|pesos|personas))?|mil millones|USD|US\$|dólares)", re.I)


def numeros(t):
    out = []
    for m in NUM.finditer(t):
        s = m.group(0).strip()
        if s not in out:
            out.append(s)
    return out[:3]


def leer(url):
    try:
        f = feedparser.parse(get(url))
        return list(f.entries), None
    except Exception as ex:  # noqa: BLE001
        return [], str(ex)[:140]


def gn(busca, es):
    q = quote(f"{busca} when:45d")
    if es:
        return f"https://news.google.com/rss/search?q={q}&hl=es-419&gl=AR&ceid=AR:es-419"
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


def main():
    d = json.load(open(IN, encoding="utf-8"))
    fuentes = d.get("fuentes", [])
    try:
        viejas = json.load(open(OUT, encoding="utf-8")).get("items", [])
    except Exception:
        viejas = []
    # Re-filtra lo ya guardado con la regla actual (palabra entera): saca falsos positivos de corridas anteriores.
    pat_por_id = {f["id"]: armar_alias(f) for f in fuentes}
    antes = len(viejas)
    viejas = [x for x in viejas if x.get("via") != "google_news" or nombra(pat_por_id.get(x.get("fuente"), []), x.get("title", ""))]
    quitadas = antes - len(viejas)
    vistos = {x.get("id") for x in viejas}
    ahora = datetime.now(timezone.utc).isoformat()

    def tarea(f):
        es = f.get("region") in ("Latinoamérica",) or f.get("pais") in ("España",)
        res = {"rss": [], "gn": [], "err": None}
        for u in f.get("rss") or []:
            ents, err = leer(u)
            res["rss"] += ents[:20]
            if err:
                res["err"] = err
        pats_f = armar_alias(f)
        base = re.sub(r"[()&\"]", " ", f["nombre"])
        base = re.sub(r"\s+", " ", base).strip()
        # Consulta propia primero; si no trae notas que nombren a la fuente, se prueban respaldos más simples.
        consultas = [f.get("busca") or '"%s"' % base, '"%s"' % base, base]
        vistas_q, todos, err = set(), [], None
        for q in consultas:
            if q in vistas_q:
                continue
            vistas_q.add(q)
            for ed in ((es, not es) if len(vistas_q) == 3 else (es,)):
                ents, e2 = leer(gn(q, ed))
                err = e2 or err
                todos += ents[:POR_BUSQUEDA * 3]
            utiles = sum(1 for e in todos if nombra(pats_f, re.sub(r"\s+-\s+[^-]{2,40}$", "", limpia(e.get("title", "")))))
            if utiles >= 3:
                break
        res["gn"] = todos
        if err and not res["rss"] and not todos:
            res["err"] = err
        return res

    with ThreadPoolExecutor(max_workers=10) as ex:
        res = list(ex.map(tarea, fuentes))

    estado, nuevas = {}, 0
    for f, r in zip(fuentes, res):
        pats = armar_alias(f)
        n_f = 0
        for e in r["rss"]:
            link, tit = e.get("link", ""), limpia(e.get("title", ""))
            if not link or not tit:
                continue
            i = hashlib.sha256(f"C|{f['id']}|{link}".encode()).hexdigest()[:16]
            if i in vistos:
                continue
            vistos.add(i)
            viejas.append({"id": i, "fuente": f["id"], "title": tit, "link": link, "source": f["nombre"],
                           "published_iso": iso(e), "numeros": numeros(tit), "via": "rss_propio", "collected_at": ahora})
            nuevas += 1
            n_f += 1
        c = 0
        for e in r["gn"]:
            if c >= POR_BUSQUEDA:
                break
            link, tit = e.get("link", ""), limpia(e.get("title", ""))
            medio = limpia(((e.get("source") or {}).get("title")) or "")
            tit2 = re.sub(r"\s+-\s+[^-]{2,40}$", "", tit)
            if not link or not tit2:
                continue
            if not nombra(pats, tit2):
                continue
            clave = re.sub(r"\W+", "", tit2.lower())[:90]
            i = hashlib.sha256(("C|%s|%s" % (f["id"], clave)).encode()).hexdigest()[:16]
            c += 1
            if i in vistos:
                continue
            vistos.add(i)
            viejas.append({"id": i, "fuente": f["id"], "title": tit2, "link": link, "source": medio or "Google News",
                           "published_iso": iso(e), "numeros": numeros(tit2), "via": "google_news", "collected_at": ahora})
            nuevas += 1
            n_f += 1
        ok = bool(r["rss"] or r["gn"])
        estado[f["id"]] = {"ok": ok if not (r["err"] and not ok) else False, "rss": len(r["rss"]), "gn": len(r["gn"]), "nuevas": n_f,
                           "message": r["err"] if not ok else None}
    corte = (datetime.now(timezone.utc) - timedelta(days=DIAS)).isoformat()
    viejas = [x for x in viejas if (x.get("published_iso") or x.get("collected_at") or "") >= corte]
    viejas.sort(key=lambda x: x.get("published_iso") or x.get("collected_at") or "", reverse=True)
    viejas = viejas[:MAX_GUARDADAS]
    json.dump({"generado": ahora, "items": viejas, "estado": estado}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    bien = sum(1 for v in estado.values() if v["ok"])
    print(f"Fuentes con respuesta: {bien} de {len(estado)} · notas nuevas: {nuevas} · falsos positivos quitados: {quitadas} · guardadas: {len(viejas)}")


if __name__ == "__main__":
    main()
