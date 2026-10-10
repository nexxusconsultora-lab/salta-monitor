#!/usr/bin/env python3
"""Resumen diario de política y de seguridad (Salta y toda la Argentina) a partir de lo que ya recolecta monitor.py.

Qué hace
- Lee data/news_general.json (titulares, medio, fecha, link), data/politicians.json,
  data/oficiales.json y escribe un resumen por día en data/resumenes/AAAA-MM-DD.json
  más un índice data/resumenes/index.json.
- NO usa inteligencia artificial ni claves: agrupa titulares parecidos en «historias» (una sola
  por noticia, con la lista de medios que la dicen) y filtra lo político y lo de seguridad por palabras clave. Solo guarda título, medio, hora y enlace
  (nunca el texto de las notas).
- No agrega fuentes nuevas: cubre únicamente los medios y búsquedas configurados en monitor.py.

Uso (desde la raíz del repo):
    python scripts/resumen_diario.py             # hoy y ayer (lo que corre el workflow)
    python scripts/resumen_diario.py --todo      # todos los días con notas desde 2026-09-30
    python scripts/resumen_diario.py --fecha 2026-10-08 --forzar
"""
import argparse, json, math, os, re, sys, unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
OUT = os.path.join(DATA, "resumenes")
AR = timezone(timedelta(hours=-3))          # Salta: UTC-3 todo el año
DESDE_DEFECTO = "2026-09-30"                 # --todo no mira notas más viejas que esto
UMBRAL_COBERTURA_BAJA = 100                  # menos notas recolectadas que esto = día incompleto
MAX_HISTORIAS = 40                           # por ámbito
MAX_LINKS = 10                               # por historia
REFRESCO_MIN = 25                            # no reescribe el día actual si se generó hace menos


def fold(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()


def cargar(nombre, defecto):
    try:
        with open(os.path.join(DATA, nombre), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


# ---------- medios: dónde se publicó (no de qué habla la nota) ----------
NACIONALES = ["infobae", "clarin", "la nacion", "pagina|12", "pagina12", "pagina/12", "ambito", "perfil",
              "revista noticias", "cronista", "iprofesional", "c5n", "a24", "el destape", "minutouno", "lanacion"]
SALTENOS = ["tribuno", "intransigente", "el intra", "elintra", "informate salta", "informatesalta", "que pasa salta",
            "quepasasalta", "nuevo diario", "nuevodiario", "radio salta", "radiosalta", "salta12", "salta/12",
            "defrentesalta", "de frente"]


def ambito_medio(source, categoria):
    s = fold(source)
    if re.search(r"(^|[^a-z0-9])tn([^a-z0-9]|$)", s) or any(k in s for k in NACIONALES):
        return "Nacional"
    if any(k in s for k in SALTENOS):
        return "Salta"
    return "Salta" if categoria == "Provincial" else "Nacional"


# ---------- ¿es política? palabras clave (se editan acá) ----------
# Cada patrón se busca sobre el título sin tildes y en minúsculas, al inicio de una palabra.
POLITICA = [
    "gobierno", "gobernador", "vicegobernador", "gobernacion", "senad", "diputad", "legisl", "congreso", "concejo", "concejal",
    "intendente", "intendencia", "municipalidad", "ministr", "gabinete", "decreto", "casa rosada", "presidente milei",
    "elecciones", "electoral", "candidat", "oposicion", "oficialismo", "bloque", "peronis", "kirchner", "libertari",
    "la libertad avanza", "justicialista", "radicalis", "juntos por el cambio", "union por la patria", "frente renovador",
    "proyecto de ley", "veto", "reforma", "presupuesto", "ajuste", "paritaria", "cgt", "gremio", "sindicat", "corte suprema",
    "fiscal federal", "procurador", "boletin oficial", "licitacion", "embaj", "juro como", "interna", "campana electoral", "boleta", "recesion", "fmi", "retenciones", "aranceles",
    "financiamiento universitario", "ley de", "ley y orden", "legislatura", "sesion", "audiencia publica", "emergencia",
    "politic", "partido justicialista", "partido radical", "pro ", "ucr", "pj ",
    # figuras (nacionales y de Salta) cuyo nombre solo ya indica nota política
    "milei", "karina milei", "villarruel", "macri", "kicillof", "cristina fernandez", "massa", "bullrich", "caputo",
    "pettovello", "adorni", "francos", "grabois", "monteoliva", "sturzenegger", "menem", "saenz", "emiliano durand",
    "bettina romero", "sergio camacho", "marocco", "jarsun", "dib ashur", "royon", "orozco", "zapata",
]
# Palabras que, solas, hacen pensar en deportes o espectáculos; descartan salvo que haya un término político FUERTE.
NO_POLITICA = [
    "river", "boca", "racing", "independiente", "san lorenzo", "estudiantes", "velez", "talleres", "belgrano", "gimnasia",
    "futbol", "gol ", "goleador", "seleccion", "messi", "mundial", "torneo", "liga ", "dt ", "refuerzo", "pase de",
    "copa", "partido de", "fecha del", "clasico", "tenis", "rugby", "basquet", "automovilismo", "turismo carretera",
    "masterchef", "netflix", "serie ", "pelicula", "estreno", "show ", "famosos", "farandula", "instagram", "reality",
    "cumpleanos", "casamiento", "separacion", "horoscopo", "receta", "clima ", "pronostico", "loteria", "quiniela",
    "accidente", "choque", "atropell", "incendio", "sismo", "temblor",
]
FUERTES = ["gobierno", "gobernador", "senad", "diputad", "legisl", "concejal", "concejo", "intendente", "ministr", "decreto",
           "elecciones", "milei", "kicillof", "ley ", "presupuesto", "justicia", "fiscal", "oposicion", "oficialismo"]

# ---------- seguridad pública (delito, policía, justicia penal) ----------
SEGURIDAD = [
    "policia", "detenid", "detuvieron", "detienen", "detuvo", "aprehend", "robo", "robaron", "asalto", "asaltaron", "homicid",
    "asesin", "crimen", "femicid", "narco", "droga", "balacera", "tiroteo", "secuestr", "allanamiento", "estafa", "estafador",
    "fraude", "abuso sexual", "violacion", "banda", "motochorro", "inseguridad", "ministerio de seguridad", "gendarmeria",
    "prefectura", "comisaria", "preso", "prision", "condenad", "condena", "juicio oral", "imputad", "profugo", "cuerpo hallado",
    "hallaron un cuerpo", "hallaron muerto", "apunalad", "baleado", "baleada", "linchamiento", "trata de personas", "contrabando",
]
SEG_FUERTES = ["policia", "detenid", "detuvieron", "detienen", "detuvo", "homicid", "asesin", "femicid", "narco", "balacera",
               "secuestr", "allanamiento", "gendarmeria", "prefectura", "comisaria"]
NO_SEGURIDAD = ["gol ", "goleador", "river", "boca", "racing", "futbol", "partido de", "torneo", "seleccion", "netflix", "serie ",
                "pelicula", "masterchef", "show ", "farandula", "robo de base", "robo de pelota", "tenis", "rugby", "basquet"]
SEG_SUBTEMAS = [
    ("Violencia de género", ["femicid", "violencia de genero", "abuso sexual", "violacion", "acoso"]),
    ("Homicidios y violencia", ["homicid", "asesin", "crimen", "balacera", "tiroteo", "apunalad", "baleado", "baleada", "linchamiento", "cuerpo", "muerto"]),
    ("Narcotráfico y contrabando", ["narco", "droga", "contrabando", "trata de personas", "estupefaciente"]),
    ("Robos y estafas", ["robo", "robaron", "asalto", "asaltaron", "motochorro", "estafa", "estafador", "fraude", "secuestr"]),
    ("Policía y fuerzas de seguridad", ["policia", "gendarmeria", "prefectura", "comisaria", "ministerio de seguridad", "allanamiento", "detenid", "detuvieron", "detienen", "detuvo", "aprehend", "prof"]),
    ("Justicia penal", ["juicio", "condena", "condenad", "imputad", "preso", "prision", "fiscal", "juez", "jueza", "audiencia"]),
]
# Marcas de que una nota de seguridad es de la provincia de Salta (se busca en el título, respetando mayúsculas).
SALTA_MARCAS = re.compile(
    r"\bSalta\b|salteñ|\bOrán\b|Tartagal|Embarcación|\bMetán\b|Cafayate|Rosario de la Frontera|General Güemes|Pichanal|"
    r"Salvador Mazza|Aguaray|Mosconi|Rosario de Lerma|Campo Quijano|San Antonio de los Cobres|\bCachi\b|Molinos|\bIruya\b|"
    r"Santa Victoria|Joaquín V\. González|Apolinario Saravia|Vaqueros|La Merced|El Carril|Aguas Blancas|Colonia Santa Rosa|"
    r"Hipólito Yrigoyen|Coronel Moldes|Chicoana|La Caldera|Guachipas|Seclantás|La Poma|Los Toldos|Nazareno|Cerrillos")

TEMAS = [
    ("Economía y finanzas", ["economi", "inflacion", "dolar", "presupuesto", "ajuste", "recesion", "fmi", "deuda", "impuest", "tarifa",
                             "salari", "jubilaci", "pyme", "inversion", "retenciones", "aranceles", "caputo", "paritaria", "cgt", "gremio"]),
    ("Minería y energía", ["litio", "mineria", "minera", "energia", "petroleo", "gas ", "hidrocarburo", "posco"]),
    ("Poder Legislativo", ["senad", "diputad", "legisl", "congreso", "concejo", "concejal", "sesion", "comision", "proyecto de ley", "ley "]),
    ("Justicia y seguridad", ["justicia", "juez", "jueza", "fiscal", "causa", "corte suprema", "denuncia", "policia", "seguridad",
                              "detenid", "juicio", "imputad", "procurador", "monteoliva"]),
    ("Elecciones y partidos", ["eleccion", "electoral", "candidat", "partido", "alianza", "frente", "interna", "libertari", "peronis",
                               "kirchner", "radical", "boleta", "campana", "oposicion", "oficialismo", "bloque"]),
    ("Salud y educación", ["salud", "hospital", "educacion", "escuela", "docente", "universidad", "sanitari", "medic"]),
    ("Gobierno y gestión", ["gobierno", "gobernador", "intendente", "municip", "ministr", "gabinete", "decreto", "obra", "gestion",
                            "milei", "casa rosada", "licitacion"]),
    ("Internacional", ["israel", "hamas", "estados unidos", "eeuu", "trump", "guerra", "embajad", "ucrania", "china"]),
]

STOP = set("""para como pero porque sobre entre desde hasta cuando donde este esta estos estas esto esos esas ellos ellas sera fue fueron
ser han hay muy mas menos tras ante bajo segun sino cada todo todos toda todas otra otro otros otras tambien ademas aunque luego
solo sido tiene tienen tener quien quienes cual cuales ese esa nuestro nuestra salta argentina nacional provincial provincia
infobae clarin tribuno perfil ambito noticias nueva nuevo nuevos nuevas anos dias dijo dice dicen habia hizo hace hacen""".split())


def hay(texto, patrones):
    return [p for p in patrones if re.search(r"(?<![a-z0-9])" + re.escape(p.strip()) + (r"" if p.endswith(" ") is False and len(p.strip()) > 3 else r"(?![a-z0-9])"), texto)]


def es_politica(titulo_fold, nombres):
    if any(n in titulo_fold for n in nombres):
        return True
    pol = hay(titulo_fold, POLITICA)
    if not pol:
        return False
    if hay(titulo_fold, NO_POLITICA) and not hay(titulo_fold, FUERTES):
        return False
    return True


def es_seguridad(titulo_fold):
    if not hay(titulo_fold, SEGURIDAD):
        return False
    if hay(titulo_fold, NO_SEGURIDAD) and not hay(titulo_fold, SEG_FUERTES):
        return False
    return True


def subtema_seg(titulo_fold):
    mejor, nmax = "Otros hechos de seguridad", 0
    for nombre, pats in SEG_SUBTEMAS:
        n = len(hay(titulo_fold, pats))
        if n > nmax:
            mejor, nmax = nombre, n
    return mejor


def tema_de(titulo_fold):
    mejor, nmax = "Otros temas políticos", 0
    for nombre, pats in TEMAS:
        n = len(hay(titulo_fold, pats))
        if n > nmax:
            mejor, nmax = nombre, n
    return mejor


def medio_canonico(source):
    """Une las variantes de un mismo medio: «El Tribuno - Salta» y «El Tribuno - Municipios» cuentan como «El Tribuno»."""
    s = (source or "Sin medio").strip()
    base = re.split(r"\s+[-–|]\s+", s)[0].strip()
    base = re.sub(r"\.(com\.ar|com|ar|net)$", "", base, flags=re.I).strip() or s
    return base.title() if base.islower() else base


def limpiar_titulo(titulo, medio):
    t = str(titulo or "").strip()
    if " - " in t:
        cola = t.rsplit(" - ", 1)[1].strip()
        fc, fm = fold(cola), fold(medio)
        if len(cola) <= 35 and (fc in fm or fm in fc or re.search(r"\.(com|ar|net)\b", fc) or fc.split(" ")[0] in fm):
            t = t.rsplit(" - ", 1)[0].strip()
    return t


def tokens(titulo_fold):
    return {w for w in re.findall(r"[a-z]{4,}", titulo_fold) if w not in STOP}


def raices(titulo_fold):
    """Palabras recortadas a 6 letras (las largas), para que «entregó» y «entrega» cuenten como la misma al agrupar."""
    return {w[:6] if len(w) >= 7 else w for w in tokens(titulo_fold)}


def agrupar(items):
    """Une titulares que cuentan la misma noticia. Dos criterios, ambos conservadores:
    (a) 3 o más palabras significativas en común y al menos el 55 % de las del título más corto;
    (b) 2 o más palabras en común que además son raras ese día (peso tipo IDF >= 0,45) y ambos títulos con 4+ palabras.
    Un mismo medio casi nunca repite la historia con otro título: solo se une si es casi idéntico."""
    n = len(items)
    padre = list(range(n))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    tk = [it["tok"] for it in items]
    df = Counter(w for s in tk for w in s)
    idf = lambda w: math.log((n + 1) / (df[w] + 0.5))
    peso = [sum(idf(w) for w in s) for s in tk]
    for i in range(n):
        for j in range(i + 1, n):
            inter = tk[i] & tk[j]
            if len(inter) < 2:
                continue
            menor = min(len(tk[i]), len(tk[j]))
            mismo = items[i]["medio"] == items[j]["medio"] and fold(items[i]["titulo"]) != fold(items[j]["titulo"])
            a = len(inter) >= 3 and menor and len(inter) / menor >= (0.8 if mismo else 0.55)
            pm = min(peso[i], peso[j])
            b = (not mismo) and menor >= 4 and pm > 0 and sum(idf(w) for w in inter) / pm >= 0.45
            if a or b:
                padre[raiz(i)] = raiz(j)
    grupos = defaultdict(list)
    for i in range(n):
        grupos[raiz(i)].append(items[i])
    return list(grupos.values())


def nombres_conocidos(politicos):
    """Nombres completos (2+ palabras) de personas vigentes; sirve para detectar política y personas nombradas."""
    res = {}
    for p in politicos:
        if p.get("vigencia") != "vigente":
            continue
        for nombre in [p.get("name")] + list(p.get("aliases") or []):
            f = fold(nombre)
            if "," in f:
                continue
            if len(f.split()) >= 2 and len(f) >= 9:
                res.setdefault(f, p["id"])
    # variantes «nombre apellido» para quienes tienen 3 o más palabras; si una variante sirve para dos personas distintas, se descarta
    var = defaultdict(set)
    for f, pid in list(res.items()):
        w = f.split()
        if len(w) >= 3:
            for v in (w[0] + " " + w[1], w[0] + " " + w[-1]):
                if len(v) >= 9 and v not in res:
                    var[v].add(pid)
    for v, ids in var.items():
        if len(ids) == 1:
            res[v] = next(iter(ids))
    return res


def hora(iso):
    try:
        return datetime.fromisoformat(iso).astimezone(AR).strftime("%H:%M")
    except (TypeError, ValueError):
        return ""


def fecha_ar(iso):
    try:
        return datetime.fromisoformat(iso).astimezone(AR).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def armar_historias(items, tema_fn, alcance_fn, previas):
    """Agrupa los titulares en historias: una por noticia, con TODOS los medios que la dicen y el titular de cada uno."""
    historias = []
    for g in agrupar(items):
        g.sort(key=lambda x: x["iso"])
        medios_g = sorted({x["medio"] for x in g})
        titulo = max(g[:3], key=lambda x: len(x["titulo"]))["titulo"]
        vistos, links = set(), []
        for x in g:
            if x["link"] and (x["medio"], x["titulo"]) not in vistos:
                vistos.add((x["medio"], x["titulo"]))
                links.append({"medio": x["medio"], "titulo": x["titulo"], "link": x["link"], "hora": x["hora"]})
        tok = set().union(*[x["tok"] for x in g])
        sigue = any(len(tok & p) >= 3 and len(tok & p) / min(len(tok), len(p)) >= 0.55 for p in previas if p)
        h = {"titulo": titulo, "alcance": alcance_fn(g), "tema": tema_fn(" ".join(fold(x["titulo"]) for x in g[:3])),
             "medios": medios_g, "n_notas": len(g), "primera": g[0]["hora"], "links": links[:MAX_LINKS]}
        if sigue:
            h["sigue_de_ayer"] = True
        historias.append(h)
    clave = lambda h: (-len(h["medios"]), -h["n_notas"], [-ord(c) for c in h["primera"]], h["titulo"])
    historias.sort(key=clave)
    top = []
    for amb in ("Salta", "Nacional", "Ambos"):
        top += [h for h in historias if h["alcance"] == amb][:MAX_HISTORIAS]
    top.sort(key=clave)
    for i, h in enumerate(top, 1):
        h["n"] = i
    return historias, top


def alcance_politica(g):
    ambs = {x["ambito"] for x in g}
    return "Salta" if ambs == {"Salta"} else "Nacional" if ambs == {"Nacional"} else "Ambos"


def alcance_seguridad(g):
    """Provincia de Salta solo si algún titular de la historia nombra un lugar salteño; todo lo demás es «resto del país».
    Es una estimación por el título: puede dejar como nacional una nota local que no nombra el lugar."""
    return "Salta" if any(SALTA_MARCAS.search(x["titulo"]) for x in g) else "Nacional"


def tokens_previos(fecha):
    """Palabras de las historias del día anterior (política y seguridad) para marcar lo que «sigue de ayer»."""
    ayer = (datetime.fromisoformat(fecha) - timedelta(days=1)).strftime("%Y-%m-%d")
    d = cargar(os.path.join("resumenes", ayer + ".json"), None)
    if not d:
        return [], []
    f = lambda hs: [raices(fold(" ".join([h["titulo"]] + [l["titulo"] for l in h.get("links", [])[:3]]))) for h in hs]
    return f(d.get("historias", [])), f((d.get("seguridad") or {}).get("historias", []))


def resumen_del_dia(fecha, noticias, politicos, oficiales, nombres):
    dia = [n for n in noticias if fecha_ar(n.get("published_iso")) == fecha]
    por_id = {p["id"]: p for p in politicos}
    todas, politicas, seguras, medios, vistos_t = 0, [], [], defaultdict(lambda: {"ambito": "", "notas": 0, "politicas": 0, "seguridad": 0}), set()
    nombres_l = list(nombres)
    for n in dia:
        todas += 1
        crudo = (n.get("source") or "Sin medio").strip()
        medio = medio_canonico(crudo)
        amb = ambito_medio(crudo, n.get("category"))
        m = medios[medio]
        m["ambito"] = amb
        m["notas"] += 1
        t = limpiar_titulo(n.get("title"), crudo)
        tf = fold(t)
        if (fold(medio), tf) in vistos_t:      # el mismo titular repetido en el mismo medio cuenta una vez
            continue
        vistos_t.add((fold(medio), tf))
        base = {"titulo": t, "tf": tf, "tok": raices(tf), "medio": medio, "ambito": amb,
                "link": n.get("link", ""), "hora": hora(n.get("published_iso")), "iso": n.get("published_iso", "")}
        if es_politica(tf, nombres_l):
            m["politicas"] += 1
            politicas.append(base)
        if es_seguridad(tf):
            m["seguridad"] += 1
            seguras.append(base)
    prev_pol, prev_seg = tokens_previos(fecha)
    historias, top = armar_historias(politicas, tema_de, alcance_politica, prev_pol)
    hist_seg, top_seg = armar_historias(seguras, subtema_seg, alcance_seguridad, prev_seg)
    temas = Counter(h["tema"] for h in historias)
    subtemas = Counter(h["tema"] for h in hist_seg)
    palabras = Counter()
    for p in politicas:
        palabras.update(tokens(p["tf"]))
    personas = Counter()
    for p in politicas:
        vistos = set()
        for nom, pid in nombres.items():
            if nom in p["tf"] and pid not in vistos:
                vistos.add(pid)
                personas[pid] += 1
    of = [i for i in (oficiales.get("items") or []) if (i.get("fecha_publicacion") or "")[:10] == fecha]
    destac = [i for i in of if i.get("personas") or i.get("menciona_salta")]
    destac.sort(key=lambda i: (-(len(i.get("personas") or [])), i.get("titulo", "")))
    return {
        "fecha": fecha,
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "totales": {"recolectadas": todas, "politicas": len(politicas), "seguridad": len(seguras),
                    "descartadas": todas - len({x["titulo"] + x["medio"] for x in politicas + seguras}),
                    "historias": len(historias), "historias_seguridad": len(hist_seg), "medios": len(medios)},
        "cobertura_baja": todas < UMBRAL_COBERTURA_BAJA,
        "temas": [{"tema": t, "historias": n} for t, n in temas.most_common()],
        "historias": top,
        "seguridad": {
            "totales": {"notas": len(seguras), "historias": len(hist_seg),
                        "salta": sum(1 for h in hist_seg if h["alcance"] == "Salta"),
                        "nacional": sum(1 for h in hist_seg if h["alcance"] == "Nacional")},
            "subtemas": [{"tema": t, "historias": n} for t, n in subtemas.most_common()],
            "historias": top_seg,
        },
        "palabras": [{"t": w, "n": n} for w, n in sorted(palabras.items(), key=lambda kv: (-kv[1], kv[0]))[:15] if n >= 3],
        "personas": [{"id": pid, "nombre": por_id[pid]["name"], "notas": n} for pid, n in sorted(personas.items(), key=lambda kv: (-kv[1], kv[0]))[:15] if pid in por_id],
        "oficiales": {"total": len(of), "con_personas_o_salta": len(destac),
                      "destacadas": [{"titulo": i.get("titulo", ""), "fuente": i.get("fuente", ""), "link": i.get("url", "")} for i in destac[:8]]},
        "medios": sorted([{"nombre": k, **v} for k, v in medios.items()], key=lambda x: -x["notas"]),
        "metodo": "Titulares agrupados por palabras en común (una historia por noticia, con todos los medios que la dicen); lo político y lo de seguridad se detectan por palabras clave. No usa IA ni lee el texto de las notas.",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fecha", help="AAAA-MM-DD")
    ap.add_argument("--todo", action="store_true")
    ap.add_argument("--forzar", action="store_true")
    a = ap.parse_args()
    noticias = cargar("news_general.json", [])
    politicos = cargar("politicians.json", [])
    oficiales = cargar("oficiales.json", {})
    if not noticias:
        print("Sin noticias en data/news_general.json: nada que resumir.")
        return 0
    nombres = nombres_conocidos(politicos)
    hoy = datetime.now(AR).strftime("%Y-%m-%d")
    ayer = (datetime.now(AR) - timedelta(days=1)).strftime("%Y-%m-%d")
    if a.fecha:
        fechas = [a.fecha]
    elif a.todo:
        fechas = sorted({fecha_ar(n.get("published_iso")) for n in noticias} - {None})
        fechas = [f for f in fechas if f >= DESDE_DEFECTO and f <= hoy]
    else:
        fechas = [ayer, hoy]
    os.makedirs(OUT, exist_ok=True)
    cambios = 0
    for f in fechas:
        ruta = os.path.join(OUT, f + ".json")
        previo = None
        try:
            with open(ruta, encoding="utf-8") as fh:
                previo = json.load(fh)
        except (OSError, ValueError):
            pass
        if previo and f == hoy and not a.forzar:
            try:
                edad = (datetime.now(timezone.utc) - datetime.fromisoformat(previo["generado"])).total_seconds() / 60
                if edad < REFRESCO_MIN:
                    continue
            except (KeyError, ValueError):
                pass
        nuevo = resumen_del_dia(f, noticias, politicos, oficiales, nombres)
        if nuevo["totales"]["recolectadas"] == 0:
            continue
        # nunca reemplazar un resumen más completo por uno hecho con menos notas (las viejas se descartan del archivo general)
        if previo and not a.forzar and previo["totales"]["recolectadas"] > nuevo["totales"]["recolectadas"]:
            continue
        if previo:
            a1 = {k: v for k, v in previo.items() if k != "generado"}
            a2 = {k: v for k, v in nuevo.items() if k != "generado"}
            if a1 == a2:
                continue
        with open(ruta, "w", encoding="utf-8") as fh:
            json.dump(nuevo, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        cambios += 1
        t = nuevo["totales"]
        print(f"{f}: {t['recolectadas']} notas, {t['politicas']} políticas, {t['historias']} historias, {t['medios']} medios")
    # índice
    idx = []
    for nombre in os.listdir(OUT):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", nombre):
            try:
                with open(os.path.join(OUT, nombre), encoding="utf-8") as fh:
                    d = json.load(fh)
                idx.append({"fecha": d["fecha"], **d["totales"], "cobertura_baja": d.get("cobertura_baja", False)})
            except (OSError, ValueError, KeyError):
                continue
    idx.sort(key=lambda x: x["fecha"], reverse=True)
    ruta_idx = os.path.join(OUT, "index.json")
    nuevo_idx = json.dumps({"dias": idx[:400]}, ensure_ascii=False, indent=1) + "\n"
    try:
        actual = open(ruta_idx, encoding="utf-8").read()
    except OSError:
        actual = ""
    if actual != nuevo_idx:
        open(ruta_idx, "w", encoding="utf-8").write(nuevo_idx)
        cambios += 1
    print(f"Listo. Archivos escritos: {cambios}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
