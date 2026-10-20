#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Escáner de conexiones (Nación ↔ Salta) de NEWAR.

Qué hace (sin inteligencia artificial ni claves: reglas y conteos, 100 % verificable):
  1. Lee las notas ya recolectadas (data/news_general.json + data/archivo/AAAA-MM.json, últimos 45 días).
  2. En cada título detecta:
       - PERSONAS CONOCIDAS (nómina de politicians.json, autoridades, poderes.json, judicial.json y una lista
         corta de figuras nacionales muy nombradas),
       - TEMAS (diccionario de temas + frases que se repiten en las notas),
       - PERSONAS QUE NO ESTÁN EN LA NÓMINA («por conocer»): nombres y apellidos que aparecen con un cargo
         («el senador X», «la jueza Y») o en 3 o más notas de 2 o más medios.
  3. Conecta lo que aparece junto en una misma nota (persona↔persona, persona↔tema, tema↔tema).
  4. Marca de qué lado se habla cada cosa (medios nacionales / medios de Salta) y arma:
       - PUENTES: temas y personas de los que se habla en Nación Y en Salta, con quién los une a cada lado,
       - SIN ECO: temas de los que se habla solo en Nación (todavía no en Salta) y viceversa,
       - CRUCES: personas nacionales ↔ personas de Salta nombradas en las mismas notas,
       - NUEVAS: conexiones cuya primera nota es de los últimos 3 días,
       - POR CONOCER: personas fuera de la nómina que ya aparecen con peso.
  5. Escribe data/conexiones.json y data/conexiones_status.json.

Lo que detecta es una PISTA basada en el título: que dos cosas aparezcan en la misma nota no prueba una
relación entre ellas. Cada conexión lleva sus notas de respaldo para que se pueda comprobar.

Uso (desde la raíz del repo):
    python scripts/conexiones.py
    python scripts/conexiones.py --dias 60
Archivo opcional data/conexiones_manual.json (ver GUIA_CONEXIONES.md) para sumar personas, temas o ignorar nombres.
"""
import argparse, json, os, re, sys, time, unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from itertools import combinations

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(RAIZ, "data")
DIAS_DEFECTO = 45
DIAS_NUEVAS = 3
MAX_ARISTAS = 3500
MAX_EJ = 2          # notas de respaldo por conexión
MAX_EJ_NODO = 4
MIN_DESC_NOTAS = 3  # notas mínimas de una persona sin cargo para ser «por conocer»
MIN_DESC_MEDIOS = 2
MIN_FRASE = 4       # notas mínimas de una frase automática


def fold(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", fold(s)).strip()


def cargar(ruta, defecto):
    try:
        with open(os.path.join(DATA, ruta) if not os.path.isabs(ruta) else ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def parse_ts(s):
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------- palabras que NO son nombres
STOP = set("""a al algo ante antes aqui asi aun aunque bajo bien cada casi como con contra cual cuales cuando cuanto de del desde donde dos
durante e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estan estar este esto estos fue fueron ha han hasta hay
hoy la las le les lo los mas me mi mientras muy ni no nos nuestro o otra otras otro otros para pero poco por porque que quien quienes se
sea segun ser si sin sobre su sus tambien tan tanto te tiene tienen todo todos tras tu un una uno unas unos va van ya y yo
ayer como que quien cuando donde cual nuevo nueva nuevos nuevas primer primera ultimo ultima dias dia anos ano semana mes meses
asi pese tras segun hacia vs""".split())
# primeras palabras que van con mayúscula solo por ser inicio de título
INICIO = set("""hoy ayer como que quien cuando donde cual por tras con sin segun ante para desde hasta entre sobre mas menos
nuevo nueva nuevos nuevas primer primera ultimo ultima otro otra todos todas cada este esta estos estas ese esa asi
asegura aseguro afirma afirmo dijo dice anuncio anuncia pidio pide confirmo confirma denuncio denuncia""".split())
# no son nombres de persona (lugares, instituciones, medios, meses, cargos, marcas, etc.)
NO_NOMBRE = set("""salta argentina argentino argentinos argentinas nacion nacional provincia provincial municipal municipalidad ciudad capital
buenos aires cordoba rosario mendoza tucuman jujuy catamarca chaco formosa misiones corrientes neuquen chubut santa fe cruz tierra
fuego rio negro pampa luis san juan entre rios santiago estero bolivia chile brasil uruguay paraguay peru venezuela mexico espana
francia italia alemania china rusia ucrania israel gaza iran eeuu unidos estados europa latinoamerica america mundo mercosur onu
gobierno ministerio ministro ministra secretaria secretario subsecretario subsecretaria senado senador senadora diputado diputada
diputados camara concejo concejal concejala deliberante legislatura congreso corte suprema justicia juzgado juez jueza fiscal fiscalia
tribunal tribunales poder ejecutivo legislativo judicial policia policial gendarmeria ejercito fuerza fuerzas comision comite
consejo direccion banco central universidad hospital escuela colegio instituto club selecion seleccion liga copa mundial torneo
partido frente alianza union radical civica peronismo peronista libertad avanza kirchnerismo pro uni ucr pj
casa rosada boletin oficial decreto ley resolucion ordenanza presupuesto reforma proyecto
enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre lunes martes miercoles jueves viernes sabado domingo
infobae clarin tribuno intransigente perfil ambito cronista pagina lanacion telam noticias diario canal radio
anses afip arca indec inta senasa pami conicet uba bcra anmat cammesa enargas
aerolineas ypf edesa aysa mercado libre google facebook instagram twitter tiktok whatsapp youtube
dia dias semana ano anos mes hoy ayer mañana
guia como que cuando mundial bono aguinaldo paritaria tarifa
san santa santo costa rica reino unido inter miami mar plata vaca muerta wall street ingresos brutos seguridad social zona fria nino mesa politica nobel balon oro papa marcha federal universitaria financiamiento belgrano cargas florencio varela marcos paz vasco gama rural nuevo frio calor lluvia ola tarifa juicio plan ley fondo cuenta ruta tren puente autopista paso aeropuerto terminal feria fiesta festival dakar tren""".split())
CARGO = (r"(?:presidente|presidenta|vicepresidente|vicepresidenta|gobernador|gobernadora|vicegobernador|vicegobernadora|intendente|intendenta|"
         r"ministro|ministra|secretario|secretaria|subsecretario|subsecretaria|senador|senadora|diputado|diputada|concejal|concejala|"
         r"legislador|legisladora|juez|jueza|fiscal|camarista|procurador|procuradora|defensor|defensora|candidato|candidata|"
         r"jefe de gabinete|jefa de gabinete|titular|director|directora|interventor|interventora|embajador|embajadora|"
         r"dirigente|referente|diputado nacional|senador nacional|ex ministro|ex ministra|ex gobernador|ex intendente|"
         r"ex senador|ex diputado|ex presidente|ex presidenta|ex concejal)")
CONECT = r"(?:de la|de los|del|de|da|di|van|von|el|la)"
NOMBRE_RX = re.compile(r"[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]{2,}(?:\s+(?:" + CONECT + r"\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]{2,}){1,3}")
CARGO_RX = re.compile(r"\b(?:el|la|los|las|al|del|ex)?\s*(" + CARGO + r")\s+(" + NOMBRE_RX.pattern + r")")

PUERTA = re.compile(
    r"gobern|senad|diputad|concejal|concejo|intendent|ministr|president|milei|congreso|legislat|decreto|\bley(es)?\b|eleccion|candidat|"
    r"partido|bloque|alianza|justicia|\bjuez|jueza|fiscal|\bcorte\b|gobierno|municip|politic|oficialis|oposicion|gabinete|sesion|"
    r"presupuesto|paritaria|reforma|camara|peronis|radical|libertari|libertad avanza|kirchner|macri|secretari|casa rosada|\bdnu\b|\bveto\b|"
    r"interpelacion|impuest|tarifa|obra publica|salud publica|educacion|seguridad|narco|corrup|litio|miner|jubilac|inflacion|dolar|"
    r"deuda|cepo|banco central|fmi|aranceles|retenciones|gremi|sindicat|cgt|paro|desafuero|juicio politico|bullrich|caputo|adorni|saenz")

# ---------------------------------------------------------------- temas (diccionario)
TEMAS = {
    "Minería y litio": r"\blitio\b|miner[io]|salares?|cobre|\bminera",
    "Salud": r"hospital|salud publica|dengue|sarampion|vacun|obra social|medicament|sanatorio|\bpami\b|enfermer",
    "Educación": r"docente|escuela|educacion|universidad|alumnos|estudiantes|paro docente|\bunsa\b|\bconicet\b|ctera",
    "Seguridad y policía": r"policia|seguridad|crimen|delito|robo|inseguridad|gendarmer|penitenciar|carcel|motin",
    "Narcotráfico": r"narco|drogas?|estupefaciente|cocaina|trafico de",
    "Presupuesto": r"presupuesto|partida|recursos? coparticipab|coparticipacion|fondos? provincial",
    "Salarios y paritarias": r"paritari|salari|aumento salarial|sueldos?|aguinaldo|gremio|sindicat|\bcgt\b|\bparo\b",
    "Inflación y precios": r"inflacion|precios?|canasta basica|indec|costo de vida",
    "Dólar y cepo": r"dolar|cepo|tipo de cambio|reservas|\bbcra\b|banco central|brecha",
    "Reforma laboral": r"reforma laboral|modernizacion laboral|convenios? colectivos?",
    "Impuestos y tarifas": r"impuest|tarifa|retenciones|ingresos brutos|inmobiliario|monotribut|ganancias|aranceles",
    "Deuda y economía": r"\bdeuda\b|\bfmi\b|bonos?|riesgo pais|superavit|deficit|bcra",
    "Obra pública y rutas": r"obra publica|\brutas?\b|autopista|puente|pavimento|vialidad|viviendas?",
    "Transporte": r"colectivo|transporte|\bsaeta\b|tren|aeropuerto|aerolineas|vuelos?|combustible|nafta",
    "Turismo": r"turismo|turistas?|hotel|temporada|vacaciones",
    "Energía": r"energia|electricidad|\bgas\b|edesa|ypf|petroleo|hidrocarburo|gasoducto|generacion electrica",
    "Agro y producción": r"agro|ganader|soja|cana de azucar|tabaco|producc|cosecha|campo|exportacion",
    "Elecciones y candidaturas": r"elecc|candidat|\bpaso\b|boleta|escrutinio|comicios|reeleccion|campana",
    "Alianzas y frentes": r"alianza|frente|interbloque|armado politico|acuerdo politico|peronismo|libertad avanza|\bpro\b|\bucr\b|radical",
    "Corrupción y causas": r"corrup|coima|cuadernos|imputad|procesad|indagatoria|allanamiento|detenid|causa judicial|lavado|sobreseimiento",
    "Justicia y jueces": r"\bjuez|jueza|corte suprema|magistrad|fiscal|tribunal|consejo de la magistratura|pliego|procurador",
    "Jubilaciones": r"jubilad|jubilaci|haberes|anses|pensiones|\bpami\b",
    "Discapacidad": r"discapacidad|\bcud\b|prestadores",
    "Planes y asistencia social": r"plan social|asistencia social|\btarjeta alimentar|comedor|merendero|potenciar|desarrollo social|pobreza|indigencia",
    "Vivienda": r"vivienda|casas?\b|lotes?|terrenos|alquiler|hipotecari",
    "Ambiente y agua": r"ambiente|ambiental|\bagua\b|sequia|incendio|deforest|glaciar|contaminaci|aguas? potable|inundaci",
    "Violencia de género": r"femicidio|violencia de genero|ni una menos|genero|abuso",
    "Pueblos originarios": r"pueblos? originari|comunidad(es)? (wichi|guarani|kolla)|\bwichi|originarios|lhaka honhat",
    "Empleo y trabajo": r"empleo|desempleo|despidos?|trabajadores|\btrabajo\b|\bsuteba\b|suspensiones",
    "Municipios": r"intendente|municipio|municipal|concejo deliberante|concejal|ordenanza",
    "Congreso y leyes": r"congreso|\bsenado\b|diputados|proyecto de ley|media sancion|sancion definitiva|\bveto\b|\bdnu\b|sesion especial",
    "Relaciones exteriores": r"cancill|\bonu\b|mercosur|estados unidos|\beeuu\b|trump|\bbrics\b|tratado|embajad|aranceles",
    "Medios y comunicación": r"periodis|libertad de prensa|medios de comunicacion|pauta oficial|fake news",
    "Cultura": r"festival|cultura|museo|teatro|biblioteca|patrimonio",
}
TEMAS_RX = {k: re.compile(v) for k, v in TEMAS.items()}

# figuras nacionales muy nombradas (alias en minúscula sin tildes). Solo se suman si no están ya en la nómina.
NACIONALES = {
    "Javier Milei": ["javier milei", "milei"], "Karina Milei": ["karina milei"], "Manuel Adorni": ["manuel adorni", "adorni"],
    "Luis Caputo": ["luis caputo", "toto caputo", "caputo"], "Patricia Bullrich": ["patricia bullrich", "bullrich"],
    "Sandra Pettovello": ["sandra pettovello", "pettovello"], "Federico Sturzenegger": ["federico sturzenegger", "sturzenegger"],
    "Victoria Villarruel": ["victoria villarruel", "villarruel"], "Axel Kicillof": ["axel kicillof", "kicillof"],
    "Mauricio Macri": ["mauricio macri", "macri"], "Cristina Kirchner": ["cristina kirchner", "cristina fernandez de kirchner", "cfk"],
    "Sergio Massa": ["sergio massa", "massa"], "Santiago Caputo": ["santiago caputo"], "Martín Menem": ["martin menem"],
    "Guillermo Francos": ["guillermo francos", "francos"], "Mario Lugones": ["mario lugones", "lugones"],
    "Pablo Quirno": ["pablo quirno", "quirno"], "Diego Santilli": ["diego santilli", "santilli"],
    "Horacio Rodríguez Larreta": ["rodriguez larreta", "larreta"], "Máximo Kirchner": ["maximo kirchner"],
    "Ricardo Lorenzetti": ["ricardo lorenzetti", "lorenzetti"], "Horacio Rosatti": ["horacio rosatti", "rosatti"],
    "Carlos Rosenkrantz": ["carlos rosenkrantz", "rosenkrantz"], "Juan Bautista Mahiques": ["mahiques"],
    "Donald Trump": ["donald trump", "trump"], "Jorge Macri": ["jorge macri"], "Juan Schiaretti": ["schiaretti"],
    "Rogelio Frigerio": ["rogelio frigerio"], "Ignacio Torres": ["ignacio torres"], "Maximiliano Pullaro": ["pullaro"],
    "Martín Llaryora": ["llaryora"], "Raúl Jalil": ["jalil"], "Gerardo Morales": ["gerardo morales"], "Carlos Sadir": ["carlos sadir", "sadir"],
}


NOMBRES = set("""
adrian adriana agustin agustina alberto alejandra alejandro alfredo alicia alvaro ana andrea andres angel antonio ariel augusto beatriz benjamin
bruno camila camilo carla carlos carolina cecilia cesar claudia claudio cristian cristina cristobal damian daniel daniela dario david delfina
diego dolores eduardo elena eliana emanuel emilia emiliano emilio enrique ernesto esteban eugenia eva ezequiel fabian fabiana facundo federico
felipe fernanda fernando flavio florencia francisco franco gabriel gabriela gaston gerardo german gisela gladys gonzalo graciela gregorio
guadalupe guillermo gustavo hector hernan horacio hugo ignacio ines irma isabel ivan javier jeronimo jessica jimena joaquin jorge jose josefina
juan julia julian julieta karina laura lautaro leandro leonardo leticia lilia liliana lionel lisandro lorena lorenzo lucas lucia luciana
luis luisa luz manuel marcela marcelo marcos mariano maria mariana marina mario marta martin matias mauricio maximiliano maximo melisa mercedes
miguel mirta monica nahuel natalia nelson nestor nicolas noelia norma norberto olga omar pablo pamela patricia paula pedro rafael ramiro ramon
raul rebeca ricardo roberto rocio rodolfo rodrigo rogelio romina rosa ruben sabrina salvador samuel sandra santiago sara sebastian sergio silvana
silvia sofia sonia soledad tamara teresa tomas valentina valeria vanesa veronica victor victoria virginia viviana walter wanda yamila zulema
oscar osvaldo orlando ovidio patricio paola primitivo reynaldo rosario ruth sixto tadeo ulises vicente wenceslao yolanda ariana abel alan axel
bernardo bautista celeste clara dante elvio emma fabricio fidel gilda gimena horacio jonatan kevin lorena lourdes malena marcio micaela milagros
mora nadia nancy nilda noe paloma rafaela renata ricarda sabina selva silvio tobias tulio uriel yanina zoe amalia aurelia belen brenda candela
cintia dora edgardo elsa estela evelina fátima fatima florentina gloria hilda ivana jacqueline joel judith lidia lucio luna magdalena marisa
mathias maurizio miriam mónica monica nora ofelia pilar rolando rufino santos selene tatiana teodoro tito toto vilma wilfredo yesica
""".split())
EXT = re.compile(r"trump|eeuu|ee uu|estados unidos|brasil|bolsonaro|lula|espana|madrid|vaticano|\bpapa\b|ucrania|rusia|putin|china|israel|gaza|iran|"
                 r"venezuela|maduro|colombia|petro|mexico|sheinbaum|chile|kast|boric|uruguay|paraguay|bolivia|peru|europa|union europea|otan|\bonu\b|"
                 r"washington|casa blanca|sudafrica|japon|corea|india|reino unido|londres|francia|macron|alemania|italia|meloni")
DEPORTE = re.compile(r"futbol|\bgol(es)?\b|partido|liga profesional|copa|torneo|mundial|seleccion|\bclub\b|jugador|entrenador|\bdt\b|tenis|boxeo|\bnba\b|fifa|\bafa\b|"
                     r"\bboca\b|\bnewells\b|racing|independiente|river|belgrano de|gimnasia|vasco|inter miami|premier|champions|libertadores|balon de oro|"
                     r"rugby|automovilismo|formula 1|\bf1\b|olimpic")
FARANDULA = re.compile(r"farandula|espectaculo|cantante|actriz|\bactor\b|telenovela|pelicula|\bserie\b|reality|bailando|influencer|conductor(a)? de|programa de tv|"
                       r"\bshow\b|vedette|modelo y|streamer|youtuber|tiktoker|separacion de|casamiento|embarazo")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")[:48]


# ---------------------------------------------------------------- carga de notas
def cargar_notas(dias):
    ahora = datetime.now(timezone.utc)
    corte = ahora - timedelta(days=dias)
    items = {}
    fuentes = [cargar("news_general.json", [])]
    idx = cargar("archivo/index.json", {})
    meses = sorted((idx.get("meses") or {}).keys())[-3:] if isinstance(idx, dict) else []
    for m in meses:
        d = cargar("archivo/%s.json" % m, {})
        fuentes.append(d.get("items") if isinstance(d, dict) else d)
    for lista in fuentes:
        for n in lista or []:
            if not isinstance(n, dict) or not n.get("id") or n["id"] in items:
                continue
            ts = parse_ts(n.get("published_iso")) or parse_ts(n.get("collected_at"))
            if not ts:
                continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts < corte or ts > ahora + timedelta(days=1):
                continue
            items[n["id"]] = (n, ts)
    return items, ahora


def sin_medio(titulo, medio):
    t = str(titulo or "")
    if " - " in t:
        cola = t.rsplit(" - ", 1)[1]
        fm, fc = fold(medio), fold(cola)
        if fc and (fc in fm or fm in fc or len(fc) < 32):
            t = t.rsplit(" - ", 1)[0]
    return t.strip()


def historias(items):
    """Una historia = un título (aunque lo repitan varios medios)."""
    H = {}
    for n, ts in items.values():
        t = sin_medio(n.get("title"), n.get("source"))
        if not t or " - temas - " in str(n.get("title") or ""):
            continue
        k = norm(t)[:90]
        if len(k) < 12:
            continue
        h = H.get(k)
        cat = "nac" if n.get("category") == "Nacional" else "sal"
        enlace = {"t": t, "l": n.get("link") or "", "m": n.get("source") or "", "ts": ts, "c": cat}
        if not h:
            H[k] = {"k": k, "t": t, "f": fold(t), "ts": ts, "cats": {cat}, "medios": {fold(n.get("source"))},
                    "ej": [enlace]}
        else:
            h["cats"].add(cat)
            h["medios"].add(fold(n.get("source")))
            h["ej"].append(enlace)
            if ts < h["ts"]:
                h["ts"] = ts
    return list(H.values())


# ---------------------------------------------------------------- entidades conocidas
def armar_conocidas():
    """Devuelve (nodos, alias): nodos[id] = {l,a,k,...}; alias[texto_normalizado] = id (solo los que apuntan a UNA entidad)."""
    nodos, cand = {}, defaultdict(set)

    def sumar(id_, label, amb, fuente, cargo="", vigente=True, aliases=()):
        if id_ not in nodos:
            nodos[id_] = {"id": id_, "t": "p", "l": label, "a": amb, "k": fuente, "r": cargo, "v": 1 if vigente else 0}
        for al in [label] + list(aliases):
            f = norm(al)
            if not f or len(f) < 4:
                continue
            toks = f.split()
            if len(toks) == 1 and (len(f) < 5 or f in STOP or f in NO_NOMBRE):
                continue
            cand[f].add(id_)

    for p in cargar("politicians.json", []):
        amb = "nac" if p.get("ambito") == "Nacional" else "sal"
        vig = p.get("vigencia") == "vigente"
        sumar("p:" + str(p.get("id")), p.get("name") or "", amb, "nomina", p.get("cargo") or p.get("role") or "", vig, p.get("aliases") or [])
    pod = cargar("poderes.json", {})
    for a in ((pod.get("ejecutivo_nacional") or {}).get("autoridades") or []):
        sumar("n:" + slug(a.get("nombre")), a.get("nombre") or "", "nac", "poderes", a.get("cargo") or "", a.get("vigente", True) is not False)
    jud = cargar("judicial.json", {})
    for amb, bloque in (("nac", jud.get("nacional") or {}), ("sal", jud.get("salta") or {})):
        lst = bloque.get("autoridades")
        for a in (lst if isinstance(lst, list) else []):
            if isinstance(a, dict) and a.get("nombre"):
                sumar("j:" + slug(a["nombre"]), a["nombre"], amb, "judicial", a.get("cargo") or "", a.get("vigente", True) is not False)
    aut = cargar("autoridades.json", {})
    for a in (aut.get("autoridades") or []):
        if isinstance(a, dict) and a.get("nombre"):
            sumar("a:" + slug(a["nombre"]), a["nombre"], "sal", "autoridades", a.get("cargo") or "")
    for label, als in NACIONALES.items():
        existe = any(norm(label) in cand for _ in [0])
        if existe:
            continue
        sumar("n:" + slug(label), label, "nac", "figura nacional", "", True, als)
    man = cargar("conexiones_manual.json", {})
    for p in man.get("personas") or []:
        if p.get("nombre"):
            sumar("m:" + slug(p["nombre"]), p["nombre"], "nac" if str(p.get("ambito", "")).lower().startswith("nac") else "sal", "manual",
                  p.get("cargo") or "", True, p.get("alias") or [])
    # un alias solo vale si apunta a UNA persona; los apellidos sueltos comunes se descartan
    alias = {}
    for f, ids in cand.items():
        if len(ids) == 1:
            alias[f] = next(iter(ids))
    return nodos, alias, man


# ---------------------------------------------------------------- detección en cada historia
def entidades_conocidas(tokens, alias, maxn=5):
    hall, usados = set(), set()
    n = len(tokens)
    for i in range(n):
        for L in range(min(maxn, n - i), 0, -1):
            if any(j in usados for j in range(i, i + L)):
                continue
            g = " ".join(tokens[i:i + L])
            if g in alias:
                hall.add(alias[g])
                usados.update(range(i, i + L))
                break
    return hall


GENERICAS = set("""busca buscan sigue siguen alta alto baja bajo puede pueden cambiar sera seran hubo quieren quiere trabajar acelerar gran mejor peor
hace hizo dice dijo afirma anuncia anuncio confirma advierte reclama pide plantea propone define logra deja queda llega llegan fue son ser esta estan
tiene tienen tuvo habia habra podria podrian deberia debe deben vuelve vuelven lanza lanzo abre abrio cierra cerro suma sumo cae cayo sube subio
nuevo nueva nuevos nuevas primer primera ultimo ultima proximo proxima mismo misma todo toda todos todas cada otro otra varios varias mucho mucha
mas menos casi hasta tras ante bajo sobre entre contra desde hacia durante mediante segun ademas luego antes despues cuando donde mientras
muchos muchas pocos pocas tanto tanta tantos tantas cual cuales quien quienes cuyo cuya algo nada alguien nadie siempre nunca ahora hoy ayer
mañana tambien tampoco aqui alli asi bien mal muy poco bastante demasiado solo unico unica pais ciudad gente vez veces forma manera parte partes
lugar caso casos tema temas punto puntos modo tipo lado cosa cosas gobierno ministro presidente jefe""".split())


VERBAL = re.compile(r"(o|aron|ieron|ara|era|ira|aria|eria|iria|ando|iendo)$")
VERBAL = re.compile(r"(aron|ieron|ando|iendo|aria|eria|iria)$|^(dejo|denuncio|rechazo|prohibieron|ingresar|reclamo|pidio|dijo|anuncio)$")


def candidatos_de(titulo, conocidas_norm, ignorar):
    """Nombres propios de 2-4 palabras no conocidos. Devuelve [(nombre, cargo|None)]."""
    out = {}
    for m in CARGO_RX.finditer(titulo):
        nom = m.group(2)
        out[nom] = m.group(1).strip().lower()
    for m in NOMBRE_RX.finditer(titulo):
        nom = m.group(0)
        out.setdefault(nom, None)
    res = []
    for nom, cargo in out.items():
        toks = nom.split()
        # sacar palabras de inicio de oración que van en mayúscula solo por estar al principio
        while toks and (fold(toks[0]) in INICIO or fold(toks[0]) in STOP):
            toks = toks[1:]
        pal = [t for t in toks if fold(t) not in ("de", "la", "los", "del", "da", "di", "van", "von", "el")]
        if len(pal) < 2 or len(pal) > 4:
            continue
        ft = [fold(t) for t in pal]
        if any(t in NO_NOMBRE or t in STOP for t in ft):
            continue
        if any(len(t) < 3 for t in ft):
            continue
        nombre = " ".join(toks)
        nn = norm(nombre)
        if nn in ignorar:
            continue
        # si ya es (o contiene a) una persona conocida, no es candidato
        if nn in conocidas_norm or any(c in nn.split() and len(c) > 4 for c in conocidas_norm if " " not in c):
            continue
        res.append((nombre, cargo))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=DIAS_DEFECTO)
    args = ap.parse_args()
    t0 = time.time()
    items, ahora = cargar_notas(args.dias)
    H = historias(items)
    nodos, alias, man = armar_conocidas()
    ignorar = {norm(x) for x in (man.get("ignorar") or [])}
    conocidas_norm = set(alias.keys())
    temas_extra = {k: re.compile("|".join(re.escape(fold(x)) for x in v)) for k, v in (man.get("temas") or {}).items() if v}
    TR = dict(TEMAS_RX)
    TR.update(temas_extra)

    por_politica = [h for h in H if PUERTA.search(h["f"]) and not DEPORTE.search(h["f"]) and not FARANDULA.search(h["f"])]

    # ---- frases que se repiten (temas automáticos)
    cnt_frase = Counter()
    forma = defaultdict(Counter)
    med_frase = defaultdict(set)
    cap_frase = Counter()
    nombre_toks = set()
    for nd in nodos.values():
        nombre_toks.update(norm(nd["l"]).split())
    for h in por_politica:
        toks = [t for t in norm(h["t"]).split()]
        orig = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+", h["t"])
        vistas = set()
        for i in range(len(toks) - 1):
            a, b = toks[i], toks[i + 1]
            if a in STOP or b in STOP or len(a) < 4 or len(b) < 4 or a in NO_NOMBRE or b in NO_NOMBRE or a in nombre_toks or b in nombre_toks:
                continue
            if a.isdigit() or b.isdigit():
                continue
            if a in GENERICAS or b in GENERICAS or VERBAL.search(a) or VERBAL.search(b):
                continue
            g = a + " " + b
            if g in vistas:
                continue
            vistas.add(g)
            cnt_frase[g] += 1
            if i + 1 < len(orig) and orig[i][:1].isupper() and orig[i + 1][:1].isupper():
                cap_frase[g] += 1
            med_frase[g] |= h["medios"]
            if i + 1 < len(orig):
                forma[g][(orig[i] + " " + orig[i + 1]).lower()] += 1
    frases = {}
    for g, c in cnt_frase.most_common(400):
        if c < MIN_FRASE:
            break
        if len(med_frase[g]) < 3:
            continue
        if cap_frase[g] >= 0.5 * c:      # es un nombre propio: lo cubre la detección de personas
            continue
        if any(rx.search(g) for rx in TR.values()):
            continue
        frases["f:" + slug(g)] = (g, forma[g].most_common(1)[0][0] if forma[g] else g, c)
        if len(frases) >= 120:
            break
    frase_rx = {fid: re.compile(r"\b" + re.escape(g) + r"\b") for fid, (g, _, _) in frases.items()}

    # ---- detección por historia
    ev = []     # (historia, ids personas, ids candidatos, ids temas)
    cand_stats = defaultdict(lambda: {"h": [], "cargos": Counter(), "medios": set()})
    for h in por_politica:
        toks = norm(h["t"]).split()
        ids_p = entidades_conocidas(toks, alias)
        cands = candidatos_de(h["t"], conocidas_norm, ignorar)
        ids_c = []
        for nombre, cargo in cands:
            cid = "c:" + slug(nombre)
            st = cand_stats[cid]
            st["nombre"] = nombre
            st["h"].append(h)
            if cargo:
                st["cargos"][cargo] += 1
            st["medios"] |= h["medios"]
            ids_c.append(cid)
        ids_t = []
        for lab, rx in TR.items():
            if rx.search(h["f"]):
                ids_t.append("t:" + slug(lab))
                if "t:" + slug(lab) not in nodos:
                    nodos["t:" + slug(lab)] = {"id": "t:" + slug(lab), "t": "t", "l": lab, "a": "mix", "k": "tema"}
        for fid, rx in frase_rx.items():
            if rx.search(norm(h["t"])):
                ids_t.append(fid)
                if fid not in nodos:
                    nodos[fid] = {"id": fid, "t": "f", "l": frases[fid][1], "a": "mix", "k": "frase"}
        ev.append((h, sorted(ids_p), ids_c, ids_t))

    # ---- candidatos que alcanzan peso
    aceptados = {}
    for cid, st in cand_stats.items():
        n = len({x["k"] for x in st["h"]})
        con_cargo = sum(st["cargos"].values())
        if con_cargo >= 1 or (n >= MIN_DESC_NOTAS and len(st["medios"]) >= MIN_DESC_MEDIOS):
            if n >= 2 or con_cargo >= 1:
                primero = fold(st["nombre"].split()[0])
                if not con_cargo and primero not in NOMBRES and n < 8:
                    continue          # sin cargo y sin nombre de pila: probablemente un lugar o un concepto
                aceptados[cid] = st
    for cid, st in aceptados.items():
        cargo = st["cargos"].most_common(1)[0][0] if st["cargos"] else ""
        ext = sum(1 for x in st["h"] if EXT.search(x["f"])) >= 0.5 * len(st["h"])
        nodos[cid] = {"id": cid, "t": "c", "l": st["nombre"], "a": "mix", "k": "por conocer", "r": cargo}
        if ext:
            nodos[cid]["x"] = 1        # figura extranjera probable

    # ---- grafo
    stats = defaultdict(lambda: {"n": 0, "nn": 0, "ns": 0, "f": None, "p": None, "ej": []})
    aristas = {}
    for h, ids_p, ids_c, ids_t in ev:
        ids = ids_p[:6] + [c for c in ids_c if c in aceptados][:3] + ids_t[:5]
        ids = list(dict.fromkeys(ids))
        for i in ids:
            s = stats[i]
            s["n"] += 1
            if "nac" in h["cats"]:
                s["nn"] += 1
            if "sal" in h["cats"]:
                s["ns"] += 1
            if s["f"] is None or h["ts"] > s["f"]:
                s["f"] = h["ts"]
            if s["p"] is None or h["ts"] < s["p"]:
                s["p"] = h["ts"]
            s["ej"].append(h)
        for a, b in combinations(sorted(ids), 2):
            if nodos[a]["t"] in "tf" and nodos[b]["t"] in "tf" and nodos[a]["k"] == nodos[b]["k"] == "frase":
                continue
            e = aristas.setdefault((a, b), {"a": a, "b": b, "w": 0, "nn": 0, "ns": 0, "p": h["ts"], "u": h["ts"], "h": []})
            e["w"] += 1
            if "nac" in h["cats"]:
                e["nn"] += 1
            if "sal" in h["cats"]:
                e["ns"] += 1
            e["p"] = min(e["p"], h["ts"])
            e["u"] = max(e["u"], h["ts"])
            e["h"].append(h)

    def rep(h, lado=None):
        e = h["ej"][0]
        if lado:
            for x in h["ej"]:
                if x["c"] == lado:
                    e = x
                    break
        return [e["t"][:120], e["l"], e["m"], e["ts"].strftime("%Y-%m-%d"), e["c"]]

    def recientes(hs, lado=None, n=MAX_EJ):
        hs = [x for x in hs if not lado or lado in x["cats"]]
        hs = sorted(hs, key=lambda x: x["ts"], reverse=True)
        return [rep(x, lado) for x in hs[:n]]

    # ---- nodos de salida (solo los que tienen conexiones)
    en_aristas = set()
    L = sorted(aristas.values(), key=lambda e: (-e["w"], -e["u"].timestamp()))
    L = [e for e in L if e["w"] >= 2 or nodos[e["a"]]["t"] == "p" or nodos[e["b"]]["t"] == "p" or nodos[e["a"]]["t"] == "c" or nodos[e["b"]]["t"] == "c"]
    L = L[:MAX_ARISTAS]
    for e in L:
        en_aristas.add(e["a"])
        en_aristas.add(e["b"])
    corte_nuevas = ahora - timedelta(days=DIAS_NUEVAS)
    sal_nodos = []
    for i, nd in nodos.items():
        s = stats.get(i)
        if not s or s["n"] == 0:
            continue
        if i not in en_aristas and nd["t"] != "p":
            continue
        a = nd["a"]
        if nd["t"] in "tfc":
            a = "mix" if (s["nn"] and s["ns"]) else ("nac" if s["nn"] else "sal")
        o = {"id": i, "t": nd["t"], "l": nd["l"], "a": a, "n": s["n"], "nn": s["nn"], "ns": s["ns"],
             "u": s["f"].strftime("%Y-%m-%d"), "p": s["p"].strftime("%Y-%m-%d"), "k": nd["k"]}
        if nd.get("r"):
            o["r"] = nd["r"][:70]
        if nd["t"] == "p":
            o["v"] = nd.get("v", 1)
        if nd["t"] == "c" and s["p"] >= corte_nuevas:
            o["nuevo"] = 1
        if nd.get("x"):
            o["x"] = 1
        o["ej"] = recientes(s["ej"], None, MAX_EJ_NODO)
        sal_nodos.append(o)
    ids_ok = {o["id"] for o in sal_nodos}
    amb_de = {o["id"]: o["a"] for o in sal_nodos}
    L = [e for e in L if e["a"] in ids_ok and e["b"] in ids_ok]
    sal_aristas = []
    for e in L:
        o = {"a": e["a"], "b": e["b"], "w": e["w"], "nn": e["nn"], "ns": e["ns"], "p": e["p"].strftime("%Y-%m-%d"),
             "u": e["u"].strftime("%Y-%m-%d"), "e": recientes(e["h"])}
        if e["p"] >= corte_nuevas:
            o["nueva"] = 1
        aa, bb = amb_de.get(e["a"]), amb_de.get(e["b"])
        if aa and bb and {aa, bb} == {"nac", "sal"}:
            o["cruce"] = 1
        sal_aristas.append(o)

    # ---- vecinos por nodo (para puentes)
    vec = defaultdict(list)
    for o in sal_aristas:
        vec[o["a"]].append((o["b"], o["w"], o))
        vec[o["b"]].append((o["a"], o["w"], o))

    def top_personas(i, amb, n=5):
        r = [(j, w) for j, w, _ in vec[i] if j in ids_ok and amb_de.get(j) == amb and j.split(":")[0] in ("p", "n", "j", "a", "m", "c")]
        return [j for j, _ in sorted(r, key=lambda x: -x[1])[:n]]

    por_id = {o["id"]: o for o in sal_nodos}
    puentes, sin_eco_nac, sin_eco_sal = [], [], []
    for o in sal_nodos:
        if o["t"] not in "tfpc":
            continue
        s = stats[o["id"]]
        if o["nn"] >= 1 and o["ns"] >= 1:
            sc = min(o["nn"], o["ns"]) * 2 + (o["nn"] + o["ns"]) * .1
            puentes.append({"id": o["id"], "score": round(sc, 1), "pn": top_personas(o["id"], "nac"), "ps": top_personas(o["id"], "sal"),
                            "en": recientes(s["ej"], "nac", 2), "es": recientes(s["ej"], "sal", 2)})
        elif o["t"] in "tf" and o["nn"] >= 4 and o["ns"] == 0:
            sin_eco_nac.append({"id": o["id"], "n": o["nn"], "pn": top_personas(o["id"], "nac"), "en": recientes(s["ej"], "nac", 2)})
        elif o["t"] in "tf" and o["ns"] >= 4 and o["nn"] == 0:
            sin_eco_sal.append({"id": o["id"], "n": o["ns"], "ps": top_personas(o["id"], "sal"), "es": recientes(s["ej"], "sal", 2)})
    puentes.sort(key=lambda x: -x["score"])
    sin_eco_nac.sort(key=lambda x: -x["n"])
    sin_eco_sal.sort(key=lambda x: -x["n"])

    desconocidos = []
    for o in sal_nodos:
        if o["t"] != "c":
            continue
        con = sorted([(j, w) for j, w, _ in vec[o["id"]] if j in por_id and por_id[j]["t"] in "p"], key=lambda x: -x[1])[:6]
        temas = sorted([(j, w) for j, w, _ in vec[o["id"]] if j in por_id and por_id[j]["t"] in "tf"], key=lambda x: -x[1])[:4]
        desconocidos.append({"id": o["id"], "con": [j for j, _ in con], "temas": [j for j, _ in temas]})
    desconocidos.sort(key=lambda d: -por_id[d["id"]]["n"])

    salida = {
        "generado": ahora.strftime("%Y-%m-%dT%H:%M:%SZ"), "ventana_dias": args.dias, "dias_nuevas": DIAS_NUEVAS,
        "notas": len(items), "historias": len(H), "historias_politicas": len(por_politica),
        "nodos": sal_nodos, "aristas": sal_aristas, "puentes": puentes[:120], "sin_eco_nacion": sin_eco_nac[:40],
        "sin_eco_salta": sin_eco_sal[:40], "desconocidos": desconocidos[:80],
        "aviso": "Que dos cosas aparezcan en la misma nota es una pista, no una prueba de relación. Cada conexión trae sus notas de respaldo.",
    }
    with open(os.path.join(DATA, "conexiones.json"), "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))
    estado = {"generado": salida["generado"], "segundos": round(time.time() - t0, 1), "notas": len(items), "historias": len(H),
              "nodos": len(sal_nodos), "aristas": len(sal_aristas), "puentes": len(puentes), "por_conocer": len(desconocidos),
              "nuevas": sum(1 for a in sal_aristas if a.get("nueva")), "cruces": sum(1 for a in sal_aristas if a.get("cruce")),
              "frases": len(frases)}
    with open(os.path.join(DATA, "conexiones_status.json"), "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=1)
    print(json.dumps(estado, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
