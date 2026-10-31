# -*- coding: utf-8 -*-
"""
NEWAR · Encuestas en la prensa argentina.

Las encuestadoras no publican una API: lo que sale a la luz son sus informes y las notas que los cuentan. Este script
busca una vez por día las notas que nombran a cada encuestadora (Google Noticias), y de cada TÍTULO extrae, sólo cuando
está claro: encuestadora, medida (aprobación, desaprobación, imagen, intención de voto, confianza…), sujeto (persona,
espacio político o tema), valor en % y fecha de la nota. Cada dato queda con la nota original para poder verificarlo.

Límites que se declaran en el archivo: se lee el título (no el informe completo), la fecha es la de la nota (no la del
trabajo de campo) y no se pondera por muestra ni metodología. Escribe data/encuestas.json.
"""
import os, re, sys, json, hashlib, time, unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import consultoras as C  # noqa: E402  (reutiliza get, leer, limpia, iso, armar_alias, nombra)

DATA = C.DATA
OUT = os.path.join(DATA, "encuestas.json")
DIAS_BUSQUEDA = 90
DIAS_GUARDA = 400
MAX_NOTAS = 3000

# Encuestadoras que se suman a las del directorio (nombres con los que la prensa las cita). Sólo nombres propios claros.
EXTRAS = [
    ("daleessio", "D'Alessio IROL / Berensztein", ["D'Alessio", "Berensztein"]),
    ("aragon", "Raúl Aragón y Asociados", ["Raúl Aragón", "Raul Aragon"]),
    ("taquion", "Taquion", ["Taquion"]),
    ("rouvier", "Rouvier & Asociados", ["Rouvier"]),
    ("proyeccion", "Proyección Consultores", ["Proyección Consultores"]),
    ("pulsar", "Pulsar UBA", ["Pulsar UBA", "Pulsar-UBA"]),
    ("opinaia", "Opinaia", ["Opinaia"]),
    ("moiguer", "Moiguer", ["Moiguer"]),
    ("doxa", "Doxa", ["Doxa Consultora", "Doxa Data"]),
    ("zuban-extra", "Zuban Córdoba", ["Zuban Córdoba", "Zubán Córdoba"]),
]
# Encuestadoras del directorio que NO se usan acá (miden otros países) — se eligen por id.
USAR_IDS = {"zuban", "poliarquia", "mfit", "opina", "synopsis", "isonomia", "cb", "aresco", "giacobbe", "analogias", "atlas",
            "ipsos", "utdt", "udesa", "gebhard", "tendencias", "escenarios", "fgonzalez", "hugo-haime-y-asociados",
            "federico-gonzalez-asociados", "trespuntozero"}

# ---------- entidades ----------
# (nombre, tipo, patrón sobre texto sin tildes y en minúsculas)
ENT = [
    ("Karina Milei", "persona", r"karina milei|karina"),
    ("Javier Milei", "persona", r"javier milei|\bmilei\b|presidente milei"),
    ("Cristina Kirchner", "persona", r"cristina|\bcfk\b|kirchner(?!ismo)"),
    ("Axel Kicillof", "persona", r"kicillof"),
    ("Mauricio Macri", "persona", r"macri"),
    ("Patricia Bullrich", "persona", r"bullrich"),
    ("Sergio Massa", "persona", r"\bmassa\b"),
    ("Gustavo Sáenz", "persona", r"gustavo saenz|\bsaenz\b|gobernador saenz"),
    ("Victoria Villarruel", "persona", r"villarruel"),
    ("Santiago Caputo", "persona", r"santiago caputo"),
    ("Luis Caputo", "persona", r"luis caputo|toto caputo|ministro caputo|\bcaputo\b"),
    ("Manuel Adorni", "persona", r"adorni"),
    ("Martín Llaryora", "persona", r"llaryora"),
    ("Maximiliano Pullaro", "persona", r"pullaro"),
    ("Ignacio Torres", "persona", r"ignacio torres|\btorres\b"),
    ("Diego Santilli", "persona", r"santilli"),
    ("Juan Schiaretti", "persona", r"schiaretti"),
    ("Máximo Kirchner", "persona", r"maximo kirchner"),
    ("Juan Grabois", "persona", r"grabois"),
    ("Martín Lousteau", "persona", r"lousteau"),
    ("Facundo Manes", "persona", r"\bmanes\b"),
    ("Leandro Santoro", "persona", r"santoro"),
    ("José Luis Espert", "persona", r"espert"),
    ("Daniel Scioli", "persona", r"scioli"),
    ("Alberto Fernández", "persona", r"alberto fernandez"),
    ("Guillermo Francos", "persona", r"francos"),
    ("Emiliano Durand", "persona", r"durand"),
    ("Bernardo Biella", "persona", r"biella"),
    ("La Libertad Avanza", "espacio", r"libertad avanza|\blla\b|libertarios?"),
    ("Fuerza Patria / Unión por la Patria", "espacio", r"fuerza patria|union por la patria|\bxp\b"),
    ("Peronismo", "espacio", r"peronismo|justicialismo|\bpj\b|peronistas?"),
    ("Kirchnerismo", "espacio", r"kirchnerismo|kirchneristas?"),
    ("Provincias Unidas", "espacio", r"provincias unidas"),
    ("Frente de Izquierda", "espacio", r"frente de izquierda|\bfit\b|izquierda"),
    ("UCR / radicalismo", "espacio", r"\bucr\b|radicalismo|radicales"),
    ("Gobierno nacional", "espacio", r"gobierno nacional|gestion nacional|gobierno de milei|gobierno de javier milei"),
    ("Gobierno de Salta", "espacio", r"gobierno de salta|gestion de saenz|gobierno provincial"),
    ("Líder extranjero", "ext", r"trump|lula|sheinbaum|noboa|petro\b|boric|kast\b|bukele|maduro|machado|starmer|macron|sanchez|merz|meloni|zelensk|putin|\bxi\b|modi\b|biden|harris|vance|mamdani|orsi|peña\b|abinader|arevalo|mulino|ortega|espriella|cepeda|fajardo|vizcarra|lopez aliaga|keiko|lacalle|bolsonaro|tarcisio|nasry|asfura|ramirez de aguila|fujimori|paz pereira"),
    ("Rumbo del país", "tema", r"rumbo del pais|marcha del pais|rumbo del gobierno|rumbo economico"),
    ("Tarifas de servicios", "tema", r"tarifas?|servicios publicos"),
    ("Impuestos", "tema", r"impuestos?|presion tributaria"),
    ("Inflación", "tema", r"inflacion|precios|costo de vida"),
    ("Economía", "tema", r"economia|situacion economica|salarios?|poder adquisitivo|ingresos"),
    ("Seguridad", "tema", r"inseguridad|seguridad|delito"),
    ("Empleo", "tema", r"desempleo|desocupacion|empleo|trabajo"),
    ("Corrupción", "tema", r"corrupcion"),
    ("Educación", "tema", r"educacion|escuelas?|universidades?"),
    ("Salud", "tema", r"sistema de salud|salud publica|hospitales?"),
    ("Dólar", "tema", r"dolar"),
    ("Expectativas del futuro", "tema", r"expectativas?|optimis|pesimis|futuro"),
    ("Gobierno nacional", "generico", r"\bgobierno\b|\bgestion\b"),  # genérico, va al final: sólo si nada más lo cubre
]
# Señas de que una nota habla de la Argentina. Un tema suelto («corrupción», «inflación») sin ninguna seña así puede ser de otro país.
CUE_AR = re.compile(r"argentin|\bsalta\b|salten|nacional|kirchner|peron|casa rosada|bonaerens|buenos aires|\bcaba\b|conurbano|provincia|milei|libertad avanza|gobernador|congreso|pais")
ENT_RE = [(n, t, re.compile(p)) for n, t, p in ENT]
# El PRO se reconoce sólo en mayúsculas (si no, "pro" confunde).
PRO_RE = re.compile(r"(?<![A-Za-z])PRO(?![A-Za-z])")
EXTRANJEROS = re.compile(r"trump|lula|sheinbaum|noboa|petro\b|boric|kast\b|bukele|maduro|starmer|macron|sanchez|merz|meloni|zelensk|putin|\bxi\b|modi\b|biden|harris|vance|mamdani|limen|lima\b|peru\b|chile\b|mexico|colombia|ecuador|brasil|uruguay|eeuu|estados unidos")
PROVINCIAS = ["Buenos Aires", "CABA", "Córdoba", "Santa Fe", "Mendoza", "Tucumán", "Jujuy", "Chaco", "Corrientes", "Misiones", "Neuquén", "Entre Ríos", "San Juan", "San Luis", "Santa Cruz", "Chubut", "Río Negro", "La Pampa", "Catamarca", "La Rioja", "Santiago del Estero", "Formosa", "Tierra del Fuego"]

VARIA = re.compile(r"(?:cayo|bajo|subio|crecio|aumento|disminuyo|retrocedio|avanzo|mejoro|empeoro|perdio|caida|baja|suba|aumento|descenso|crecimiento|variacion|retroceso|mejora|puntos?)\s+(?:de\s+|del\s+|un\s+|casi\s+|mas de\s+|unos\s+)*$")
PCT = re.compile(r"(\d{1,3}(?:[.,]\d{1,2})?)\s?%")
MEDIDAS = [
    ("Desaprobación", r"desaprueb|desaprobaci|rechaz|desaprob"),
    ("Aprobación", r"(?<!des)(?:aprobaci|aprueb|aprob)|aceptaci|respaldo|apoyo"),
    ("Principal preocupación", r"preocupaci|preocupa\b|preocupan|problema principal|principal problema"),
    ("Insatisfacción", r"insatisf|disconform|descontent|malestar|enojo"),
    ("Satisfacción", r"(?<!in)satisf|conform(?!e)"),
    ("Imagen negativa", r"imagen negativa|opinion negativa|imagen desfavorable|valoracion negativa"),
    ("Imagen positiva", r"imagen positiva|opinion positiva|imagen favorable|valoracion positiva"),
    ("Imagen", r"\bimagen\b"),
    ("Intención de voto", r"intencion de voto|votaria|votarian|votaria|votarian|ganaria|ganarian|\blidera|se impone|primer lugar|balotaje|segunda vuelta|elecciones|\bvoto\b|competencia electoral|de cara a 20"),
    ("Confianza", r"confianza|\bicg\b"),
    ("Expectativas", r"expectativ|optimis|pesimis|esperan que|cree que (?:mejorar|empeorar)"),
]
MEDIDAS_RE = [(n, re.compile(p)) for n, p in MEDIDAS]


# Nombres de encuestadora que también son palabras comunes: sólo valen si la nota las presenta como encuestadora
# («encuesta de Opina», «según Tendencias», «consultora Escenarios») y están escritas con mayúscula inicial.
AMBIGUAS_ENC = {"tendencias", "escenarios", "opina", "analogias", "synopsis", "doxa", "pulsar uba", "moiguer", "taquion", "proyeccion consultores"}
CONTEXTO_ENC = r"(?:encuesta|sondeo|consultora|estudio|relevamiento|informe|medicion|segun|seg\u00fan|de la consultora|de)\s+(?:de\s+|del\s+|la\s+|el\s+|consultora\s+)*"


def encuestadora_nombrada(e, titulo):
    """True si el título nombra a la encuestadora. Las de nombre ambiguo exigen contexto y mayúscula inicial."""
    pats = e["_pats"]
    if not C.nombra(pats, titulo):
        return False
    amb = [a for a in e["alias"] if plano(a).lower() in AMBIGUAS_ENC or plano(e["nombre"]).lower() in AMBIGUAS_ENC]
    if not amb:
        return True
    pl = plano(titulo)
    for a in e["alias"]:
        a0 = plano(a).strip()
        if not a0:
            continue
        if re.search(r"(?:^|[^A-Za-z])" + re.escape(a0[:1].upper() + a0[1:]) + r"(?![A-Za-z])", pl):
            if re.search(CONTEXTO_ENC.replace("\\u00fa", "u") + r"[\"'«]?" + re.escape(a0[:1].upper() + a0[1:]), pl, re.I) or re.match(re.escape(a0[:1].upper() + a0[1:]) + r"\s*[:,]", pl):
                return True
    return False


def plano(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def num(v):
    try:
        return float(v.replace(",", "."))
    except ValueError:
        return None


def sin_medio(t):
    return re.sub(r"\s+[-–|]\s+[^-–|]{2,45}$", "", t).strip()


# Encuestadoras que miden varios países: con ellas un tema suelto necesita alguna seña de Argentina en la nota.
MULTIPAIS = {"ipsos", "atlas"}


def extrae(titulo, encuestadora_pats, pais_ar=True):
    """Devuelve la lista de registros (dicts sin metadatos de la nota) que se pueden afirmar a partir del título."""
    t0 = sin_medio(titulo)
    # se saca el nombre de la encuestadora para que «Zuban Córdoba» no se lea como la provincia ni «Opina» como verbo
    t1 = t0
    low = plano(t1).lower()
    for nom in encuestadora_pats:
        low = low.replace(plano(nom).lower(), " " * len(nom))
    orig = plano(t1)
    if not re.search(r"encuest|sondeo|relevamiento|estudio|medicion|indice|barometro|poll|ranking|informe|panel|consultora", low) and not any(m.search(low) for _, m in MEDIDAS_RE):
        return []
    pcts = [(m.start(), m.end(), num(m.group(1))) for m in PCT.finditer(low) if num(m.group(1)) is not None and 0 <= num(m.group(1)) <= 100]
    if not pcts:
        return []
    # entidades con posición
    ents = []
    taken = []
    for nom, tipo, rx in ENT_RE:
        for m in rx.finditer(low):
            if any(a <= m.start() < b for a, b in taken):
                continue
            ents.append((m.start(), m.end(), nom, tipo))
            taken.append((m.start(), m.end()))
    for m in PRO_RE.finditer(orig):
        if not any(a <= m.start() < b for a, b in taken):
            ents.append((m.start(), m.end(), "PRO", "espacio"))
    ents.sort()
    if not ents:
        return []
    if EXTRANJEROS.search(low) and not any(t in ("persona", "espacio") and n not in ("Gobierno nacional",) for _, _, n, t in ents):
        return []
    if EXTRANJEROS.search(low) and "argentin" not in low and "salta" not in low and "milei" not in low:
        return []
    # medida general del título
    meds = []
    for n, rx in MEDIDAS_RE:
        for m in rx.finditer(low):
            meds.append((m.start(), n))
    ambito = "Nacional"
    if re.search(r"\bsalta\b|salten|saenz|durand|biella", low):
        ambito = "Salta"
    else:
        for pv in PROVINCIAS:
            if re.search(r"\b" + re.escape(plano(pv).lower()) + r"\b", low):
                ambito = pv
                break
    cortes = [m.start() for m in re.finditer(r"\s+y\s+|[,;:]|\s+mientras\s+|\s+pero\s+|\s+frente a\s+|\s+aunque\s+", low)]
    clausula = lambda pos: sum(1 for c in cortes if c < pos)  # noqa: E731
    regs = []
    for a, b, v in pcts:
        if VARIA.search(low[max(0, a - 28):a]):
            continue  # es un cambio («cayó 5,9%»), no un nivel: no se guarda como dato
        # sujeto: la entidad más cercana al valor dentro de 80 caracteres
        cand = sorted(ents, key=lambda e: (clausula(e[0]) != clausula(a), min(abs(e[0] - b), abs(e[1] - a))))
        e = cand[0]
        dist = min(abs(e[0] - b), abs(e[1] - a))
        if dist > 80 or e[3] == "ext":
            continue
        if not pais_ar and e[3] in ("tema", "generico") and not CUE_AR.search(low) and not any(x[3] in ("persona", "espacio") for x in ents):
            continue  # un tema sin ninguna seña de Argentina: no se asume
        if e[2] == "Gobierno nacional" and e[3] in ("generico", "espacio") and ambito == "Salta" and not re.search(r"gobierno nacional|milei", low):
            e = (e[0], e[1], "Gobierno de Salta", e[3])
        # medida: la palabra clave más cercana DENTRO de la misma frase (se corta en «y», comas, «frente a», «pero»…);
        # si la frase no trae ninguna, sirve la del título sólo cuando es una sola.
        medida, conf = None, "baja"
        cl = clausula(a)
        locales = [m for m in meds if clausula(m[0]) == cl]
        if locales:
            medida = sorted(locales, key=lambda m: abs(m[0] - a))[0][1]
            conf = "alta" if dist <= 45 else "media"
        elif len({m[1] for m in meds}) == 1 and not any(clausula(p[0]) == clausula(meds[0][0]) for p in pcts):
            medida, conf = meds[0][1], "media"
        if medida is None:
            medida = "Sin clasificar"
        if e[3] == "generico":
            personas = {x[2] for x in ents if x[3] == "persona"}
            if len(personas) == 1:
                e = (e[0], e[1], next(iter(personas)), "persona")
        regs.append({"sujeto": e[2], "sujeto_tipo": e[3], "medida": medida, "valor": v, "ambito": ambito, "confianza": conf, "_cl": cl})
    # «A 21 % y B 15 % de imagen positiva»: la medida está al final y vale para los dos. Sólo se hereda entre personas
    # (o entre espacios) de frases vecinas; nunca entre un tema y una persona.
    for r in regs:
        if r["medida"] == "Sin clasificar" and r["sujeto_tipo"] in ("persona", "espacio"):
            for o in regs:
                if o is not r and abs(o["_cl"] - r["_cl"]) == 1 and o["sujeto_tipo"] == r["sujeto_tipo"] and o["medida"] != "Sin clasificar":
                    r["medida"], r["confianza"] = o["medida"], "media"
                    break
    for r in regs:
        r.pop("_cl", None)
    # un mismo sujeto+medida+valor una sola vez
    vistos, out = set(), []
    for r in regs:
        k = (r["sujeto"], r["medida"], r["valor"])
        if k not in vistos:
            vistos.add(k)
            out.append(r)
    return out


# ---------- recolección ----------
def encuestadoras():
    d = json.load(open(C.IN, encoding="utf-8"))
    out = []
    for f in d.get("fuentes", []):
        if f["id"] in USAR_IDS:
            out.append({"id": f["id"], "nombre": f["nombre"], "alias": f.get("alias") or [f["nombre"]]})
    ya = {x["id"] for x in out}
    nombres = {C.fold(a) for x in out for a in x["alias"]}
    for i, n, al in EXTRAS:
        if i in ya or all(C.fold(a) in nombres for a in al):
            continue
        out.append({"id": i, "nombre": n, "alias": al})
    return out


def gn(q, dias=DIAS_BUSQUEDA):
    return "https://news.google.com/rss/search?q=%s&hl=es-419&gl=AR&ceid=AR:es-419" % quote(f"{q} when:{dias}d")


CONSULTAS = [
    '"{n}" encuesta Milei imagen aprobación',
    '"{n}" encuesta intención de voto',
    '"{n}" encuesta Salta Sáenz',
    '"{n}" sondeo inflación economía seguridad',
    '"{n}" encuesta',
    '"{n}" imagen gobierno encuesta nacional',
]
GENERICAS = [
    "encuesta imagen Milei", "encuesta aprobación gobierno Milei", "encuesta intención de voto 2027", "encuesta aprobación Kicillof",
    "encuesta imagen Cristina Kirchner", "encuesta aprobación gobernador Sáenz", "encuesta intención de voto Salta",
    "encuesta imagen Bullrich Macri", "encuesta inflación preocupación argentinos", "encuesta inseguridad principal preocupación",
    "sondeo expectativas económicas argentinos", "encuesta peronismo La Libertad Avanza", "encuesta Provincias Unidas Llaryora Pullaro",
    "encuesta confianza en el gobierno Di Tella", "encuesta elecciones legislativas Salta",
]


DESC_MEDIDAS = {
    "Aprobación": ("Cuánta gente aprueba la gestión o el desempeño de alguien.", "¿Cuánto aprueban a Milei?"),
    "Desaprobación": ("Cuánta gente desaprueba la gestión o el desempeño.", "¿Cuánto desaprueban a Kicillof?"),
    "Imagen": ("Imagen general, cuando la nota no aclara si es positiva o negativa.", "imagen de Cristina Kirchner"),
    "Imagen positiva": ("Porcentaje con opinión o imagen favorable.", "imagen positiva de Sáenz"),
    "Imagen negativa": ("Porcentaje con opinión o imagen desfavorable.", "imagen negativa de Milei"),
    "Intención de voto": ("A quién votaría la gente o qué espacio lidera en una elección.", "intención de voto peronismo vs La Libertad Avanza"),
    "Confianza": ("Confianza en el gobierno u otras instituciones.", "confianza en el gobierno"),
    "Expectativas": ("Optimismo, pesimismo y expectativas sobre el futuro.", "expectativas económicas"),
    "Principal preocupación": ("Qué problema preocupa más a la gente (inflación, inseguridad, tarifas…).", "principal preocupación de los argentinos"),
    "Insatisfacción": ("Disconformidad o malestar con el rumbo del país.", "insatisfacción con el rumbo del país"),
    "Satisfacción": ("Satisfacción con el rumbo del país o con la gestión.", "satisfacción con el rumbo"),
    "Sin clasificar": ("El título trae un porcentaje pero no dice qué mide: se muestra sin interpretar.", ""),
}
# palabras con las que se busca cada sujeto (sin tildes, minúsculas), además del nombre completo
BUSCA = {
    "Javier Milei": ["milei", "javier"], "Karina Milei": ["karina"], "Cristina Kirchner": ["cristina", "cfk", "kirchner"],
    "Axel Kicillof": ["kicillof", "axel"], "Mauricio Macri": ["macri"], "Patricia Bullrich": ["bullrich"], "Sergio Massa": ["massa"],
    "Gustavo Sáenz": ["saenz", "gustavo saenz"], "Victoria Villarruel": ["villarruel"], "Luis Caputo": ["caputo", "toto"],
    "Manuel Adorni": ["adorni"], "Martín Llaryora": ["llaryora"], "Maximiliano Pullaro": ["pullaro"], "Ignacio Torres": ["torres"],
    "Diego Santilli": ["santilli"], "Juan Schiaretti": ["schiaretti"], "Máximo Kirchner": ["maximo"], "Emiliano Durand": ["durand"],
    "Bernardo Biella": ["biella"], "La Libertad Avanza": ["lla", "libertad avanza", "libertarios", "libertario"],
    "Fuerza Patria / Unión por la Patria": ["fuerza patria", "union por la patria"], "Peronismo": ["peronismo", "pj", "justicialismo"],
    "Kirchnerismo": ["kirchnerismo"], "Provincias Unidas": ["provincias unidas"], "Frente de Izquierda": ["izquierda", "fit"],
    "UCR / radicalismo": ["ucr", "radicalismo", "radicales"], "PRO": ["pro"], "Gobierno nacional": ["gobierno nacional", "gobierno"],
    "Gobierno de Salta": ["gobierno de salta", "gobierno provincial"], "Inflación": ["inflacion", "precios"], "Economía": ["economia", "salarios", "ingresos"],
    "Seguridad": ["seguridad", "inseguridad", "delito"], "Empleo": ["empleo", "desempleo", "trabajo"], "Corrupción": ["corrupcion"],
    "Educación": ["educacion", "escuelas"], "Salud": ["salud", "hospitales"], "Dólar": ["dolar"], "Rumbo del país": ["rumbo", "rumbo del pais"],
    "Tarifas de servicios": ["tarifas", "servicios publicos"], "Impuestos": ["impuestos"], "Expectativas del futuro": ["expectativas", "futuro"],
}
STOP = set("""para como pero esta este estos estas esto sobre entre desde hasta segun tras ante cada todo toda todos todas mas menos muy
tambien donde cuando porque mientras luego ahora hace hacen hizo tiene tienen tuvo ser fue son sus nos les los las del una uno unos unas que
con por sin del al se su lo le es en el la de y o a un ha han hay encuesta encuestas sondeo sondeos estudio relevamiento medicion informe
consultora consultoras segunda primera nivel parte aunque ademas tras contra otro otra otros otras quien quienes cual cuales cuyo cuya
argentina argentinos argentinas pais gobierno mientras sigue siguen queda quedo quedan dice dicen dijo seria serian podria
""".split())


def stats_sujetos(unidos, nombres_enc):
    """Por sujeto: cuántas veces apareció en notas de encuestas, en cuántos medios distintos, cuáles, y con qué palabras."""
    por = {}
    for u in unidos:
        por.setdefault(u["sujeto"], []).append(u)
    out = {}
    ahora = datetime.now(timezone.utc)
    lim30 = (ahora - timedelta(days=30)).isoformat()
    for suj, us in por.items():
        urls, medios, tit_vistos, cuenta = set(), {}, set(), {}
        n30 = 0
        propios = set(plano(suj).lower().replace("/", " ").split())
        for al in BUSCA.get(suj, []):
            propios |= set(al.split())
        prohibidas = set()
        for nm in nombres_enc:
            prohibidas |= set(plano(nm).lower().replace("/", " ").replace("&", " ").split())
        for u in us:
            for n in u["notas"]:
                if n["url"] in urls:
                    continue
                urls.add(n["url"])
                medios[n["medio"]] = medios.get(n["medio"], 0) + 1
                if n["fecha"] >= lim30:
                    n30 += 1
            for n in u["notas"][:1]:
                if n["titulo"] in tit_vistos:
                    continue
                tit_vistos.add(n["titulo"])
                toks = set(re.findall(r"[a-z]{4,}", plano(n["titulo"]).lower()))
                for w in toks - STOP - propios - prohibidas:
                    cuenta[w] = cuenta.get(w, 0) + 1
        top_m = sorted(medios.items(), key=lambda x: (-x[1], x[0]))
        palabras = [[w, c] for w, c in sorted(cuenta.items(), key=lambda x: (-x[1], x[0])) if c >= 2][:12]
        out[suj] = {"datos": len(us), "apariciones": len(urls), "apariciones_30d": n30, "medios_distintos": len(medios),
                    "medios": [[m, c] for m, c in top_m[:8]], "palabras": palabras,
                    "encuestadoras": sorted({u["encuestadora"] for u in us}), "ultima": max(u["fecha"] for u in us),
                    "tipo": us[0]["sujeto_tipo"], "medidas": sorted({u["medida"] for u in us})}
    return out


def catalogo(unidos, stats, enc):
    cm = {}
    for u in unidos:
        cm[u["medida"]] = cm.get(u["medida"], 0) + 1
    medidas = [{"n": n, "desc": DESC_MEDIDAS.get(n, ("", ""))[0], "ejemplo": DESC_MEDIDAS.get(n, ("", ""))[1], "datos": cm.get(n, 0)}
               for n in DESC_MEDIDAS if n != "Sin clasificar" or cm.get(n)]
    medidas.sort(key=lambda m: -m["datos"])
    sujetos = []
    vistos = set()
    for nom, tipo, _ in ENT:
        if tipo in ("ext", "generico") or nom in vistos:
            continue
        vistos.add(nom)
        st = stats.get(nom, {})
        sujetos.append({"n": nom, "tipo": tipo, "busca": BUSCA.get(nom, []), "datos": st.get("datos", 0)})
    if "PRO" not in vistos:
        sujetos.append({"n": "PRO", "tipo": "espacio", "busca": BUSCA["PRO"], "datos": stats.get("PRO", {}).get("datos", 0)})
    sujetos.sort(key=lambda x: (-x["datos"], x["n"]))
    ambitos = {}
    for u in unidos:
        ambitos[u["ambito"]] = ambitos.get(u["ambito"], 0) + 1
    return {"medidas": medidas, "sujetos": sujetos, "ambitos": [[a, c] for a, c in sorted(ambitos.items(), key=lambda x: -x[1])],
            "encuestadoras": [{"id": e["id"], "nombre": e["nombre"]} for e in enc]}



def main():
    ahora = datetime.now(timezone.utc)
    iso_ahora = ahora.isoformat()
    enc = encuestadoras()
    pats = {e["id"]: C.armar_alias({"nombre": e["nombre"], "alias": e["alias"]}) for e in enc}
    for e in enc:
        e["_pats"] = pats[e["id"]]
    try:
        previo = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        previo = {}
    notas = {n["id"]: n for n in previo.get("notas", [])}

    tareas = []
    for e in enc:
        for q in CONSULTAS:
            tareas.append((e["id"], q.format(n=e["nombre"].split(" / ")[0])))
    for q in GENERICAS:
        tareas.append((None, q))

    def correr(t):
        # Google Noticias a veces responde vacío o con error pasajero: se reintenta con espera creciente.
        ents, err = [], None
        for intento in range(3):
            ents, err = C.leer(gn(t[1]))
            if ents:
                break
            time.sleep(1.5 * (intento + 1))
        return t, ents[:40], err

    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(correr, tareas))

    errores = sum(1 for _, _, err in res if err)
    vacias = sum(1 for _, ents, _ in res if not ents)
    # Si TODAS las búsquedas fallaron o vinieron vacías, lo más probable es un bloqueo o falta de red: se conserva lo anterior.
    if vacias == len(res) and previo:
        previo["ultima_corrida_fallida"] = iso_ahora
        previo["busquedas"] = {"total": len(res), "con_error": errores, "vacias": vacias, "notas_nuevas": 0}
        C.guardar_json(OUT, previo)
        print("Todas las búsquedas vinieron vacías: se conserva el archivo anterior.")
        return
    nuevas = 0
    descartes = {"url_invalida": 0, "titulo_largo": 0, "fecha_futura": 0}
    por_enc_estado = {e["id"]: {"busquedas": 0, "con_resultados": 0} for e in enc}
    for (eid, q), ents, err in res:
        if eid in por_enc_estado:
            por_enc_estado[eid]["busquedas"] += 1
            por_enc_estado[eid]["con_resultados"] += 1 if ents else 0
    for (eid, q), ents, err in res:
        for x in ents:
            link, tit = x.get("link", ""), C.limpia(x.get("title", ""))
            if not C.url_ok(link):
                descartes["url_invalida"] += 1
                continue
            if not tit:
                continue
            if len(tit) > 300:
                descartes["titulo_largo"] += 1
                continue
            sin = sin_medio(tit)
            medio = C.limpia(((x.get("source") or {}).get("title")) or "")[:80]
            # la encuestadora se identifica por nombre en el título, nunca por la búsqueda
            donde = [e for e in enc if encuestadora_nombrada(e, sin)]
            if not donde or not PCT.search(sin):
                continue
            for e in donde[:1]:
                clave = re.sub(r"\W+", "", sin.lower())[:100]
                i = hashlib.sha256(f"E|{e['id']}|{clave}".encode()).hexdigest()[:16]
                f_nota = C.iso(x) or iso_ahora
                if f_nota > iso_ahora:  # una fecha del futuro es un error de la fuente: se usa el momento en que se vio
                    descartes["fecha_futura"] += 1
                    f_nota = iso_ahora
                m_nota = medio or "Google Noticias"
                if i in notas:
                    # mismo título en otro medio: es otra aparición de la misma encuesta, no una encuesta nueva
                    n0 = notas[i]
                    n0.setdefault("medios", [{"medio": n0["medio"], "url": n0["url"], "fecha": n0["fecha"]}])
                    if all(m["medio"] != m_nota for m in n0["medios"]) and len(n0["medios"]) < 15:
                        n0["medios"].append({"medio": m_nota, "url": link, "fecha": f_nota})
                    continue
                notas[i] = {"id": i, "enc": e["id"], "titulo": sin, "medio": m_nota, "url": link, "fecha": f_nota,
                            "visto": iso_ahora, "medios": [{"medio": m_nota, "url": link, "fecha": f_nota}]}
                nuevas += 1

    corte = (ahora - timedelta(days=DIAS_GUARDA)).isoformat()
    lista = sorted((n for n in notas.values() if n["fecha"] >= corte), key=lambda n: n["fecha"], reverse=True)[:MAX_NOTAS]

    # Los registros se rehacen cada vez desde las notas guardadas: si mejora el extractor, mejora todo el historial.
    nombre_de = {e["id"]: e["nombre"] for e in enc}
    alias_de = {e["id"]: e["alias"] for e in enc}
    regs = []
    for n in lista:
        if n["enc"] not in nombre_de:
            continue
        for r in extrae(n["titulo"], alias_de[n["enc"]], pais_ar=n["enc"] not in MULTIPAIS):
            regs.append({**r, "enc": n["enc"], "encuestadora": nombre_de[n["enc"]], "fecha": n["fecha"], "titulo": n["titulo"],
                         "medio": n["medio"], "url": n["url"], "visto": n.get("visto") or n["fecha"],
                         "medios": n.get("medios") or [{"medio": n["medio"], "url": n["url"], "fecha": n["fecha"]}]})

    # Misma encuestadora, sujeto, medida y valor con fechas a menos de 7 días = un solo dato con varias notas.
    regs.sort(key=lambda r: r["fecha"])
    unidos = []
    for r in regs:
        for u in unidos:
            if (u["enc"], u["sujeto"], u["medida"], u["valor"], u["ambito"]) == (r["enc"], r["sujeto"], r["medida"], r["valor"], r["ambito"]):
                if abs(Date(r["fecha"]) - Date(u["fecha"])) < 7 * 86400:
                    for m in r["medios"]:
                        if all(m["url"] != z["url"] for z in u["notas"]):
                            u["notas"].append({"medio": m["medio"], "url": m["url"], "titulo": r["titulo"], "fecha": m["fecha"]})
                    u["detectado"] = min(u["detectado"], r["visto"])
                    break
        else:
            u = dict(r)
            u["notas"] = [{"medio": m["medio"], "url": m["url"], "titulo": r["titulo"], "fecha": m["fecha"]} for m in r["medios"]]
            u["detectado"] = r["visto"]
            for k in ("medio", "url", "titulo", "visto", "medios"):
                u.pop(k, None)
            unidos.append(u)
    for k, u in enumerate(unidos):
        u["id"] = hashlib.sha256(f"R|{u['enc']}|{u['sujeto']}|{u['medida']}|{u['valor']}|{u['fecha'][:10]}".encode()).hexdigest()[:12]
        u["cobertura"] = len(u["notas"])
    unidos.sort(key=lambda u: u["fecha"], reverse=True)

    # Resumen: último dato de cada encuestadora, por sujeto+medida+ámbito, de los últimos 45 días.
    lim = (ahora - timedelta(days=45)).isoformat()
    ult = {}
    for u in unidos:
        if u["fecha"] < lim or u["medida"] == "Sin clasificar":
            continue
        ult.setdefault((u["sujeto"], u["medida"], u["ambito"], u["enc"]), u)
    grupos = {}
    for (suj, med, amb, enc_id), u in ult.items():
        grupos.setdefault((suj, med, amb), []).append(u)
    resumen = []
    for (suj, med, amb), us in grupos.items():
        vs = [x["valor"] for x in us]
        resumen.append({"sujeto": suj, "sujeto_tipo": us[0]["sujeto_tipo"], "medida": med, "ambito": amb, "n": len(us),
                        "promedio": round(sum(vs) / len(vs), 1), "min": min(vs), "max": max(vs),
                        "ultima": max(x["fecha"] for x in us), "encuestadoras": sorted({x["encuestadora"] for x in us})})
    resumen.sort(key=lambda r: (-r["n"], r["sujeto"]))

    por_enc = {}
    for u in unidos:
        d = por_enc.setdefault(u["enc"], {"id": u["enc"], "nombre": u["encuestadora"], "datos": 0, "ultima": ""})
        d["datos"] += 1
        d["ultima"] = max(d["ultima"], u["fecha"])
    st = stats_sujetos(unidos, [e["nombre"] for e in enc])
    out = {
        "generado": iso_ahora,
        "sujetos": st,
        "catalogo": catalogo(unidos, st, enc),
        "nota": ("Datos de encuestas que la prensa publicó, extraídos automáticamente del TÍTULO de cada nota. No son los informes completos: "
                 "la fecha es la de la nota (no la del trabajo de campo), no se ven muestra ni margen de error, y una misma encuestadora puede "
                 "medir distinto que otra. El promedio es simple y sólo resume lo publicado: no es una encuesta ni un pronóstico. "
                 "Antes de citar un número, abrí la nota."),
        "busquedas": {"total": len(tareas), "con_error": errores, "vacias": vacias, "notas_nuevas": nuevas},
        "calidad": {"descartes": descartes,
                    "reglas": "Sólo se guardan notas con encuestadora nombrada, un porcentaje entre 0 y 100, una URL http(s) y un título de hasta 300 caracteres. Se descartan variaciones («cayó 5 %») y datos de otros países."},
        "estado_encuestadoras": [{"id": e["id"], "nombre": e["nombre"], **por_enc_estado[e["id"]],
                                  "datos": (por_enc.get(e["id"]) or {}).get("datos", 0), "ultima": (por_enc.get(e["id"]) or {}).get("ultima", "")}
                                 for e in enc],
        "encuestadoras": sorted(por_enc.values(), key=lambda d: -d["datos"]),
        "resumen": resumen,
        "registros": unidos[:4000],
        "notas": lista,
    }
    C.guardar_json(OUT, out)
    print(f"Búsquedas: {len(tareas)} ({errores} con error) · notas nuevas: {nuevas} · datos: {len(unidos)} · grupos en el resumen: {len(resumen)}")


def Date(s):
    try:
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        return 0.0


if __name__ == "__main__":
    main()
