#!/usr/bin/env python3
"""Resumen diario de TODOS los temas (política, seguridad, economía, deportes, salud, etc.), con clasificación por ministerio nacional y de Salta (Salta y toda la Argentina) a partir de lo que ya recolecta monitor.py.

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
from functools import lru_cache

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
OUT = os.path.join(DATA, "resumenes")
AR = timezone(timedelta(hours=-3))          # Salta: UTC-3 todo el año
DESDE_DEFECTO = "2026-09-30"                 # --todo no mira notas más viejas que esto
UMBRAL_COBERTURA_BAJA = 100                  # menos notas recolectadas que esto = día incompleto
MAX_HISTORIAS = 40                           # por ámbito
MAX_LINKS = 10                               # por historia
TOPE_TEMA = 20                               # historias guardadas por tema en la sección «Todos los temas»
TOPE_SUB = 6                                 # y por subtema
TOPE_MIN = 15                                # y por ministerio
MAX_LINKS_TODOS = 5                          # enlaces por historia en esa sección
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
              "revista noticias", "cronista", "iprofesional", "c5n", "a24", "el destape", "minutouno", "lanacion",
              "cadena 3", "cadena3", "la politica online", "lapoliticaonline", "parlamentario", "letra p", "eldiarioar",
              "noticias argentinas", "radio mitre", "tiempo argentino"]
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
    "fiscal federal", "procurador", "boletin oficial", "licitacion", "embaj", "juro como", "interna ", "internas", "campana electoral", "boleta", "recesion", "fmi", "retenciones", "aranceles", "dnu", "reeleccion", "urnas", "golpe de estado", "golpes de estado",
    "financiamiento universitario", "ley de", "ley y orden", "legislatura", "sesion", "audiencia publica", "emergencia",
    "politic", "partido justicialista", "partido radical", "pro ", "ucr", "pj ",
    # figuras (nacionales y de Salta) cuyo nombre solo ya indica nota política
    "milei", "karina milei", "villarruel", "macri", "kicillof", "cristina fernandez", "massa", "bullrich", "caputo",
    "pettovello", "adorni", "francos", "grabois", "monteoliva", "sturzenegger", "menem", "saenz", "emiliano durand",
    "bettina romero", "sergio camacho", "marocco", "jarsun", "dib ashur", "royon", "orozco", "zapata",
    "bregman", "izquierda ", "municipal", "municipios", "fuerzas armadas", "defensa nacional", "submarinos", "voto ", "votos", "votantes", "votacion", "votar", "maria eugenia vidal", "cristina", "cfk", "lla ", "llaryora", "pullaro", "jaldo", "sadir", "cornejo", "zdero", "frigerio", "weretilneck", "quintela", "ziliotto", "insfran",
]
FIGURAS_NACIONALES = ["milei", "karina", "kicillof", "caputo", "bullrich", "macri", "massa", "cristina", "kirchner", "villarruel", "adorni",
                      "pettovello", "francos", "santilli", "sturzenegger", "llaryora", "saenz", "jarsun"]
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
    "policia", "detenid", "detuvieron", "detienen", "detuvo", "aprehend", "robo ", "robos", "robaron", "asalto", "asaltaron", "homicid",
    "asesin", "crimen", "femicid", "narco", "droga", "balacera", "tiroteo", "secuestr", "allanamiento", "estafa", "estafador",
    "fraude", "abuso sexual", "violacion", "banda criminal", "banda narco", "banda de ladrones", "desbarat", "desarticul", "motochorro", "inseguridad", "ministerio de seguridad", "gendarmeria",
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
    r"Hipólito Yrigoyen|Coronel Moldes|Chicoana|La Caldera|Guachipas|Seclantás|La Poma|Los Toldos|Nazareno|Cerrillos|"
    r"Portezuelo|Rotonda de los Gauchos|Limache|Castañares|Tres Cerritos|Grand Bourg|Villa Las Rosas|Valles Calchaquíes|Calchaquí|"
    r"Cabeza de Buey|Ruta Nacional 81|Gustavo Sáenz|\bSáenz\b|Jarsún|Dib Ashur|\bIPS\b|\bSAETA\b|Güemes|Quebrada del Toro|"
    r"Tren a las Nubes|Virgen del Milagro|Cerro San Bernardo|Campo Santo|El Tala|Pocitos|Profesor Salvador Mazza")

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

# ---------- TODOS los temas (clasificación automática por palabras clave del título; se editan acá) ----------
# Cada titular recibe UN tema principal: el que más palabras clave tenga (el peso multiplica). Si hay empate, gana el que está primero.
# Lo que no encaja en ninguno queda en «Otros temas». Es una estimación por el título: puede equivocarse.
TEMAS_TODOS = [
    # (tema, peso, palabras clave)
    ("Deportes", 2, ["culturismo", "hincha", "deporte", "deportiv", "futbol", "goles", "gol de ", "el gol ", "un gol ", "goleador", "seleccion", "messi", "mundialista", "el mundial", "del mundial", "mundial 20", "mundial de futbol", "mundial de rugby", "mundial de clubes", "mundial femenino", "mundial sub", "copa del mundo", "torneo", "liga ", "copa", "partido de", "superclasico", "el clasico",
                     "colapinto", "verstappen", "alpine", "f1 ", "delantero", "arquero", "mediocampista", "atajada", "goleada",
                     "boxes", "gran premio", "le mans", "motogp", "pole position", "libertadores", "patinaje", "natacion", "esqui", "surf", "padel", "golf ", "triatlon", "judo", "esgrima", "handball",
                     "tenis", "rugby", "basquet", "voley", "automovilismo", "turismo carretera", "formula 1", "boca", "river", "racing",
                     "independiente", "san lorenzo", "talleres", "belgrano", "gimnasia", "velez", "central norte", "juventud antoniana",
                     "olimpic", "atletismo", "boxeo", "ciclismo", "hockey", "dt ", "nuevo refuerzo", "primer refuerzo", "los refuerzos", "pase de", "campeonato", "ascenso", "entrenador", "atletico", "jugador", "gran fondo", "scaloni", "mercado de pases", "fichaje", "tabla anual", "arbitro", "cancha", "hinchas", "barras", "estadio", "gimnasia y tiro", "ciclismo", "maraton", "plantel", "dirigente deportivo", "futbolista", "fecha fifa", "gallardo", "eliminatorias", "tabla de posiciones", "descenso"]),
    ("Policiales y seguridad", 1.5, SEGURIDAD + [
        "masacre", "mato a ", "mataron", "carcel", "penitenciari", "alcohol al volante", "trapitos",
        "prender fuego", "prendio fuego", "rocio con nafta", "punalad", "mato a su", "quemacoches", "incendiaron", "robad", "robar", "sin vida", "hallaron muerta", "expareja", "apunalaron", "apunalo", "demorad"]),
    ("Accidentes y emergencias", 1.5, ["volco", "volcaron", "accidente", "choque", "vuelco", "incendio", "atropell", "derrumbe", "explosion", "rescate", "bomberos",
                                       "defensa civil", "siniestro", "emergencia", "murio tras", "murio en", "murio al", "murieron en", "murieron tras", "murieron al", "mueren", "tragedia",
                                       "explot", "garrafa", "herid", "muere", "ahog", "electrocut", "intoxic", "pitbull", "atacado por"]),
    ("Clima y ambiente", 1.5, ["super nino", "clima", "pronostico", "lluvias", "con lluvia", "lluvia y ", "lluvia en ", "chaparron", "llovizna", "temporal", "tornado", "ciclon", "vientos", "humedad", "smn", "meteorolog", "nublado", "niebla", "el nino", "tormenta", "alerta meteorologica", "alerta amarilla", "alerta naranja", "calor",
                               "frio", "temperatura", "granizo", "helada", "zonda", "sequia", "ambiente", "contaminacion", "residuos",
                               "reciclaje", "fauna", "bosque", "deforestacion", "cambio climatico", "sismo", "temblor", "terremoto",
                               "inundacion", "crecida", "nevada", "ola de calor"]),
    ("Espectáculos y cultura", 1.5, ["netflix", "serie ", "pelicula", "estreno", "show ", "famosos", "farandula", "instagram", "reality",
                                     "masterchef", "cantante", "recital", "concierto", "festival", "musica", "teatro", "cine", "libro",
                                     "artista", "actriz", "actor ", "television", "streaming", "tiktok", "youtube", "cumbia", "folklore",
                                     "pena ", "cumpleanos", "casamiento", "separacion", "horoscopo", "receta de", "recetas de", "receta facil", "museo", "exposicion", "nieta de", "hija de", "hijo de", "conductor", "conductora", "novio", "noviazgo", "romance", "telefe", "vedette", "la modelo", "top model", "polemica", "mediatic", "influencer", "bailando", "pareja", "embarazo", "fans", "banda de rock", "disco ", "bebe", "infidelidad", "martin fierro", "ternas", "wanda nara", "se separo", "primer hijo",
                                     "cantautor", "musico", "musicos", "nobel de literatura", "grammy", "lollapalooza", "premios", "narrativa", "novela", "poesia", "poeta", "escritor", "escritora", "elenco", "miniserie", "thriller",
                                     "filme", "taquilla", "headliner", "entradas", "donde ver", "pogo", "orquesta", "ballet", "danza"]),
    ("Justicia", 1, ["poder judicial", "organos judiciales", "magistratura", "magistrad", "jueces", "supremo", "la corte", "corte de justicia", "casacion", "camara de apelaciones", "fiscalia", "ministerio publico", "cautelar", "prision preventiva", "indulto",
                     "justicia", "juez", "jueza", "el fiscal", "la fiscal", "fiscal federal", "fiscal general", "fiscal de", "fiscales", "causa ", "causas", "tribunal", "corte suprema", "juicio", "imputad", "procesad", "denuncia",
                     "amparo", "fallo", "sentencia", "camara federal", "procurador", "indagatoria", "procesamiento"]),
    ("Salud", 1, ["ceguera", "dolor cronico", "bienestar emocional", "emocional", "tratamiento", "terapia", "obras sociales", "diabet", "hipertens", "alzheimer", "oncolog", "pediatr", "psicolog", "psiquiatr", "dialisis", "terapia intensiva", "guardia medica", "centro de salud", "sobrepeso", "obesidad", "cambio de sexo", "quirurgic", "dieta", "salud", "hospital", "sanitari", "medic", "vacuna", "dengue", "sarampion", "epidemia", "enfermedad", "cancer", "paciente",
                  "obra social", "pami", "farmac", "nutricion", "covid", "gripe", "clinica", "cirugia", "trasplante"]),
    ("Educación y universidades", 1, ["educativ", "escolar", "universitari", "secretaria de educacion", "educacion", "escuela", "docente", "universidad", "alumnos", "clases", "ciclo lectivo", "colegio", "beca",
                                      "unsa", "estudiantil", "maestr", "paro docente", "financiamiento universitario", "aula"]),
    ("Ciencia y tecnología", 1, ["marte", "galaxia", "astronomia", "universo", "nobel de fisica", "nobel de quimica", "nobel de medicina", "astronauta", "artemis", "cohete", "espacial", "semana del espacio", "semana mundial del espacio", "moleculas", "ia ", "data center", "robotaxi", "tesla", "anthropic", "ciberataque",
                                 "inteligencia artificial", "tecnologia", "ciberseguridad", "celular", "apple", "google", "openai", "satelite",
                                 "nasa", "robot", "internet", "software", "starlink", "ciencia", "investigadores", "conicet", "hackeo",
                                 "algoritmo", "chatgpt", "tecnologico", "aplicacion", "app "]),
    ("Minería y energía", 1, ["barril", "brent", "crudo", "gasoducto", "oleoducto", "ypf", "litio", "mineria", "minera", "energia", "petroleo", "gas ", "hidrocarburo", "posco", "vaca muerta",
                              "electricidad", "combustible", "nafta", "yacimiento", "solar", "renovable", "cobre", "oro blanco", "mina de oro", "minas de oro", "rio tinto"]),
    ("Agro y producción", 1, ["campos", "tierras rurales", "autos", "automovil", "0km", "concesionari", "stellantis", "automotriz", "cierre de plantas", "fabrica", "autopartis", "metalurgic", "textil", "manufactur", "agro", "campo ", "soja", "maiz", "trigo", "cosecha", "ganader", "exportacion", "industria", "pyme",
                              "produccion", "tabaco", "azucar", "limon", "citrus", "vino", "bodega", "frigorifico", "carne", "productores",
                              "siembra", "agricultura", "zafra", "cupo"]),
    ("Transporte e infraestructura", 1, ["telepase", "cortes de luz", "epec", "edenor", "edesur", "cammesa", "flybondi", "ferroviari", "ramales", "aeroestacion", "avion", "subte", "autopista", "trenes", "ruta ", "rutas", "vial", "vialidad", "obra", "puente", "aeropuerto", "vuelo", "aerolinea", "tren ",
                                         "colectivo", "saeta", "transporte", "peaje", "pavimento", "cloaca", "agua potable", "aguas del norte",
                                         "edesa", "corte de luz", "infraestructura", "bacheo", "asfalto", "ferrocarril"]),
    ("Turismo", 1, ["parque nacional", "iguazu", "cataratas", "arancibia", "promocion de salta", "promocion turistica", "conectividad", "turismo", "turista", "hotel", "vacaciones", "fin de semana largo", "feriado", "cafayate", "quebrada", "tren a las nubes",
                    "ocupacion hotelera", "destino", "temporada alta", "receptivo"]),
    ("Trabajo y gremios", 1, ["albanil", "plomero", "electricista", "empleadas domesticas", "empleada domestica", "personal domestico", "trabajo domestico", "emplead", "laboral", "informalidad", "cuentapropis", "monotribut", "uocra", "cuanto gana", "aguinaldo", "desocupacion", "puestos de trabajo", "paro nacional", "ate ", "ctera", "conadu", "paritaria", "gremio", "sindicat", "cgt", "despido", "desempleo", "empleo", "trabajadores", "paro ", "huelga",
                              "convenio colectivo", "salario", "sueldo", "reforma laboral", "asamblea"]),
    ("Economía y finanzas", 1, ["equilibrio fiscal", "politica fiscal", "ajuste fiscal", "gasto publico", "transferencias", "coparticipacion", "rigi", "fechas de cobro", "calendario de pagos", "morosidad", "endeudad", "economi", "inflacion", "dolar", "presupuesto", "ajuste", "recesion", "fmi", "deuda", "impuest", "tarifa",
                                "banco mundial", "crecimiento", "comercio", "previsional", "jubilatori", "cotiza", "euro ", "tasas", "ahorr", "invertir", "invierto", "finanzas", "financier", "mercados",
                                "anses", "jubilad", "auh", "haberes", "retro suplemento", "moratoria", "empresas", "pension", "bono previsional",
                                "jubilaci", "inversion", "retenciones", "aranceles", "caputo", "bcra", "banco central", "plazo fijo",
                                "riesgo pais", "bolsa", "bonos", "reservas", "consumo", "precios", "canasta", "alquiler",
                                "credito", "tasa de interes", "afip ", "arca ", "indec ", "pbi ", "superavit", "deficit"]),
    ("Sociedad y género", 1, ["vivienda", "virgen", "devocion", "procesion", "novena", "personas mayores", "potenciar trabajo", "planes sociales", "el papa", "papa leon", "papa francisco", "leon xiv", "visita del papa", "peregrin", "aborto", "activista", "desalojo", "vejez", "demograf", "genero", "mujer", "discapacidad", "adultos mayores", "ninez", "infancia", "adolescente", "familia", "comunidad",
                              "pueblos originarios", "indigena", "vecinos", "barrio", "solidari", "ong ", "iglesia", "obispo", "derechos humanos",
                              "migrante", "pobreza", "comedor", "alimentos", "adopcion", "diversidad", "lgbt", "comunitari"]),
    ("Internacional", 1, ["israel", "hamas", "gaza", "estados unidos", "eeuu", "trump", "guerra", "ucrania", "rusia", "china", "europa", "brasil",
                          "chile", "bolivia", "paraguay", "uruguay", "venezuela", "mexico", "onu", "otan", "union europea", "maduro", "putin",
                          "zelenski", "espana", "francia", "italia", "reino unido", "japon", "iran", "vaticano", "cancilleria", "lula", "bolsonaro", "san pablo", "sao paulo", "ecuador", "colombia", "peru ", "cuba", "peste neumonica", "nobel de la paz", "premio nobel de la paz"]),
    ("Política y gobierno", 1, POLITICA),
]
TEMA_OTROS = "Otros temas"

# ---------- Ministerios (se editan acá). Solo palabras de cargos y organismos; no se nombra a personas salvo apellidos muy estables ----------
# NACIONALES: estructura según la Ley de Ministerios vigente al armar esta lista. REVISAR si el Gobierno nacional cambia ministerios.
MIN_NAC = [
    ("Jefatura de Gabinete", ["jefe de gabinete", "jefatura de gabinete", "adorni", "gabinete nacional", "vocero presidencial"]),
    ("Interior", ["ministerio del interior", "ministro del interior", "santilli", "renaper ", "registro nacional de las personas", "vicejefe de gabinete del interior"]),
    ("Relaciones Exteriores", ["cancilleria", "canciller", "relaciones exteriores", "comercio internacional", "embajad", "quirno", "mercosur"]),
    ("Economía", ["ministerio de economia", "ministro de economia", "caputo", "arca ", "afip ", "bcra ", "banco central", "indec ", "hacienda", "secretaria de energia",
                  "tesoro", "inflacion", "dolar", "deuda", "retenciones", "aranceles", "fmi", "riesgo pais", "presupuesto nacional", "tarifas"]),
    ("Defensa", ["ministerio de defensa", "ministro de defensa", "presti", "fuerzas armadas", "ejercito", "armada ", "fuerza aerea", "cazas", "servicio militar"]),
    ("Seguridad Nacional", ["ministerio de seguridad nacional", "ministra de seguridad", "monteoliva", "gendarmeria", "prefectura", "policia federal",
                            "fuerzas federales", "policia de seguridad aeroportuaria", "bullrich"]),
    ("Justicia", ["ministerio de justicia", "ministro de justicia", "servicio penitenciario federal", "reforma judicial", "codigo penal", "indulto", "mahiques"]),
    ("Salud", ["ministerio de salud", "ministro de salud", "lugones", "anmat", "pami ", "garrahan", "calendario de vacunacion", "sarampion"]),
    ("Capital Humano", ["capital humano", "pettovello", "anses ", "asignacion universal", "asignaciones familiares", "progresar", "secretaria de trabajo",
                        "secretaria de educacion", "financiamiento universitario", "planes sociales", "jubilaciones", "pensiones"]),
    ("Desregulación y Transformación del Estado", ["sturzenegger", "desregulacion", "desregula", "hojarasca", "privatizacion", "reforma del estado", "empleo publico"]),
]
# SALTA: los ministerios son los que figuran en data/politicians.json (cargos vigentes). Se aplican solo a notas de Salta.
MIN_PROV = [
    ("Jefatura de Gabinete (Salta)", ["jefe de gabinete de salta", "jefatura de gabinete de salta", "camacho"]),
    ("Gobierno y Justicia (Salta)", ["ministerio de gobierno", "gobierno y justicia", "jarsun", "secretaria de gobierno", "registro civil", "derechos humanos"]),
    ("Economía y Servicios Públicos (Salta)", ["economia y servicios publicos", "dib ashur", "rentas ", "aguas del norte", "edesa", "ente regulador", "servicios publicos", "ingresos brutos"]),
    ("Desarrollo Social (Salta)", ["desarrollo social", "mimessi", "tarjeta alimentaria", "asistencia social", "comedores", "adultos mayores"]),
    ("Producción y Minería (Salta)", ["produccion y mineria", "lupion", "litio", "mineria", "minera", "agro", "ganader", "zafra", "cosecha", "carrizo"]),
    ("Salud Pública (Salta)", ["salud publica", "mangione", "hospital", "ministerio de salud", "dengue", "vacunacion", "sarampion", "ambulancia"]),
    ("Educación y Cultura (Salta)", ["educacion y cultura", "fiore", "ministerio de educacion", "escuela", "docente", "ciclo lectivo", "colegio", "clases"]),
    ("Turismo y Deportes (Salta)", ["turismo y deportes", "arancibia", "turismo", "turista", "ocupacion hotelera", "fin de semana largo", "secretaria de deportes"]),
    ("Seguridad (Salta)", ["ministerio de seguridad", "avellaneda", "vilchez", "policia de salta", "policia", "comisaria", "inseguridad", "penitenciario", "bomberos"]),
]
SIN_MIN = "Sin ministerio identificado"
# En notas que nombran un lugar de Salta, el tema indica el área de gobierno provincial que corresponde (salud, educación, seguridad...).
# No quiere decir que la nota hable del ministerio: es el área que atiende ese tema.
TEMA_A_MIN_PROV = {
    "Salud": "Salud Pública (Salta)", "Educación y universidades": "Educación y Cultura (Salta)",
    "Policiales y seguridad": "Seguridad (Salta)", "Turismo": "Turismo y Deportes (Salta)", "Deportes": "Turismo y Deportes (Salta)",
    "Minería y energía": "Producción y Minería (Salta)", "Agro y producción": "Producción y Minería (Salta)",
    "Economía y finanzas": "Economía y Servicios Públicos (Salta)", "Sociedad y género": "Desarrollo Social (Salta)",
    "Justicia": "Gobierno y Justicia (Salta)",
}


# ---------- ¿es una nota del exterior? ----------
# Una nota de México o de Guatemala no tiene que caer en «Trabajo» o «Salud» porque el título diga «salario» u «hospitales».
# Regla: si el título nombra algo del exterior (país, ciudad, gobernante, organismo) y NADA argentino, el área es «Internacional».
# Si nombra las dos cosas («Milei y Lula», «Argentina y Brasil») se clasifica por el tema de siempre.
# Quedan afuera de la regla Deportes, Espectáculos y Ciencia: son temas que no dependen del país. Se editan acá.
# Todo se busca sobre el título sin tildes y en minúsculas; un patrón con espacio al final solo vale como palabra entera.
EXTRANJERO = [
    # países y gentilicios (el recorte final cubre «mexicano», «peruana», «chilenas»...)
    "mexic", "guatemal", "honduras", "hondureno", "nicaragua", "costa rica", "costarric", "panama", "panameno", "panamena", "cuba", "haiti", "dominican",
    "puerto rico", "venezol", "venezuel", "colombi", "ecuador", "ecuator", "peru", "bolivia", "chile", "paraguay", "uruguay", "brasil",
    "estados unidos", "estadounidense", "eeuu", "ee.uu", "ee uu", "canad", "espana", "francia", "frances", "italia", "aleman",
    "portugal", "portugues", "reino unido", "gran bretana", "britanic", "inglaterra", "irland", "belg", "holand", "paises bajos",
    "suiz", "austria", "suec", "norueg", "dinamarca", "finland", "polonia", "ucrani", "rusia", "rusa ", "rusas", "ruso", "bielorrusia",
    "turqu", "grecia", "griego", "hungr", "rumania", "montenegro", "serbia", "croacia", "andorra", "israel", "palestin", "gaza",
    "cisjordania", "libano", "siria", "irak", "teheran", "arabia", "emiratos", "qatar", "egipt", "sudafrica", "nigeria", "kenia",
    "marruec", "argelia", "libia", "etiopia", "china", "chino ", "chinos", "japon", "corea", "india ", "pakistan", "afganistan",
    "tailandia", "vietnam", "filipinas", "indonesia", "taiwan", "hong kong", "australia", "nueva zelanda", "birmania", "nepal", "bangladesh",
    "sri lanka", "myanmar", "mongolia", "camboya", "malasia", "yemen", "jordania", "sudan", "somalia", "cartagena",
    "vox ", "abinader", "delcy rodriguez", "alcalde", "alcaldesa", "congresista", "millones de soles", "jep ", "onp ",
    # regiones, ciudades y organismos
    "europa", "asia", "africa", "union europea", "otan", "onu ", "naciones unidas", "ocde", "madrid", "barcelona", "londres", "paris",
    "berlin", "moscu", "kiev", "kyiv", "pekin", "tokio", "washington", "nueva york", "california", "texas", "pensilvania", "miami",
    "las vegas", "pentagono", "casa blanca", "silicon valley", "wall street", "nasdaq", "reserva federal", "bruselas", "ginebra",
    "sao paulo", "san pablo", "rio de janeiro", "lima ", "bogota", "caracas", "quito ", "montevideo", "asuncion", "dubai",
    # México: nombres que aparecen solos en notas de servicio
    "sheinbaum", "amlo", "pemex", "imss", "cdmx", "ciudad de mexico", "t-mec", "chiapas", "jalisco", "monterrey", "tijuana",
    "rita cetina", "benito juarez", "ayuntamiento",
    # gobernantes y figuras del exterior
    "trump", "putin", "zelenski", "maduro", "lula", "bolsonaro", "gustavo petro", "boric", "kast", "keiko", "fujimori", "noboa",
    "bukele", "evo morales", "rodrigo paz", "boluarte", "netanyahu", "hamas", "macron", "starmer", "meloni", "pedro sanchez",
    "von der leyen", "erdogan", "xi jinping", "kremlin",
]
# Marcas de que la nota es argentina o de Salta. Si aparece una, NO es «solo exterior». Hay que sumar acá lo que falte.
ARG_PATRONES = [
    "argentin", "salta ", "salten", "oran ", "tartagal", "embarcacion", "metan ", "cafayate", "rosario de la frontera", "general guemes",
    "pichanal", "salvador mazza", "aguaray", "mosconi", "rosario de lerma", "campo quijano", "san antonio de los cobres", "cachi ",
    "molinos", "iruya", "santa victoria", "apolinario saravia", "la merced", "aguas blancas", "chicoana", "cerrillos",
    "caba ", "amba ", "afip", "arca ", "anses", "bcra", "indec", "pami", "unsa ", "conicet", "ypf", "aysa", "edesa", "saeta", "senasa",
    "anmat", "cgt", "uocra", "ctera", "conadu", "pj ", "ucr ", "lla ", "cfk",
    "buenos aires", "bonaerense", "conurbano", "cordoba", "mendoza", "tucuman", "jujuy", "santa fe", "rosario ", "chaco ", "corrientes",
    "misiones", "neuquen", "chubut", "santa cruz", "tierra del fuego", "la pampa", "la rioja", "catamarca", "san juan", "san luis",
    "formosa", "entre rios", "rio negro", "mar del plata", "bariloche", "patagonia", "malvinas",
    "casa rosada", "gobierno nacional", "milei", "karina", "kicillof", "caputo", "bullrich", "macri", "massa", "cristina", "kirchner",
    "villarruel", "adorni", "francos", "pettovello", "lugones", "sturzenegger", "santilli", "quirno", "monteoliva", "cavallo",
    "llaryora", "pullaro", "saenz", "peronis", "libertari",
    "aeroparque", "ezeiza", "vaca muerta", "concordia", "mercosur", "rio uruguay", "rio de la plata", "avenida ", "intendente",
    "provincia de ", "la plata", "quilmes", "lanus", "devoto", "marcos paz", "escobar", "san isidro",
    "exportaciones a ", "exportaciones hacia", "importaciones desde",
    # ciudades y barrios
    "bahia blanca", "rio cuarto", "villa maria", "lomas de zamora", "la matanza", "berazategui", "florencio varela", "vicente lopez",
    "almirante brown", "esteban echeverria", "caballito", "puerto madero", "santiago del estero", "carlos paz", "ushuaia",
    "rio gallegos", "comodoro rivadavia", "trelew", "puerto madryn", "posadas", "san nicolas", "tandil", "olavarria",
    "pergamino", "porteno", "olivos", "obelisco", "parque nacional", "iguazu",
    # instituciones, plata y vida cotidiana de acá
    "inta ", "enacom", "enargas", "iosfa", "banco nacion", "banco provincia", "banco galicia", "mercado libre", "mercadolibre",
    "aerolineas argentinas", "flybondi", "telefe", "monotribut", "paritaria", "dolar blue", "dolar mep", "cepo", "brecha cambiaria",
    "merval", "riesgo pais", "rigi", "ley bases", "asignacion universal", "prepaga", "quini 6", "quiniela", "potenciar trabajo",
    "alfajor", "dulce de leche", "fernet", "choripan", "empanada", "fiesta nacional", "federacion argentina",
]
# «El Gobierno» a secas es el argentino; «el Gobierno de Colombia» o «el Gobierno chileno» no.
ARG_GOBIERNO = re.compile(r"(?:(?<![a-z0-9])el gobierno|^gobierno)(?! de | del | (?:chileno|mexicano|peruano|colombiano|brasileno|venezolano|cubano|boliviano|paraguayo|uruguayo|"
                          r"ecuatoriano|espanol|frances|aleman|italiano|britanico|ruso|ucraniano|israeli|chino|japones|estadounidense|taiwanes|iraqui|iraní|saudi)\b)")


@lru_cache(maxsize=None)
def _union(pats):
    return re.compile("|".join(_rx(p).pattern for p in pats))


@lru_cache(maxsize=None)
def _en_exterior():
    return re.compile("|".join(r"(?<![a-z0-9])en " + _rx(p).pattern for p in EXTRANJERO))


def gobierno_argentino(tf):
    """«El Gobierno» a secas es el de acá, salvo que la nota transcurra «en Rusia», «en Brasil», etc."""
    return bool(ARG_GOBIERNO.search(tf)) and not _en_exterior().search(tf)


def solo_extranjero(titulo_fold, nombres=()):
    """True si el título nombra algo del exterior y nada argentino (ver EXTRANJERO / ARG_PATRONES)."""
    if not _union(tuple(EXTRANJERO)).search(titulo_fold):
        return False
    if _union(tuple(ARG_PATRONES)).search(titulo_fold) or gobierno_argentino(titulo_fold):
        return False
    return not any(n in titulo_fold for n in nombres)


TEMAS_SIN_PAIS = {"Deportes", "Espectáculos y cultura", "Ciencia y tecnología"}   # no pasan a «Internacional» aunque nombren otro país


def tema_todos(titulo_fold, nombres):
    mejor, smax = TEMA_OTROS, 0.0
    con_arg = bool(_union(tuple(ARG_PATRONES)).search(titulo_fold) or gobierno_argentino(titulo_fold))
    for nombre, peso, pats in TEMAS_TODOS:
        sc = len(hay(titulo_fold, pats)) * peso
        if nombre == "Internacional" and con_arg:
            sc *= 0.5          # «Argentina e Israel firmaron...»: es una nota argentina, el tema es el de acá
        if nombre == "Política y gobierno" and any(n in titulo_fold for n in nombres):
            sc += peso
        if nombre == "Política y gobierno" and sc and hay(titulo_fold, FIGURAS_NACIONALES):
            sc += 0.75         # «Milei... Kast...»: gana la política ante el empate con un tema de 1 punto
        if sc > smax or (sc == smax and sc > 0 and mejor == "Internacional" and nombre == "Política y gobierno"):
            mejor, smax = nombre, sc
    if mejor not in TEMAS_SIN_PAIS and solo_extranjero(titulo_fold, nombres):
        return "Internacional"
    return mejor


def ministerios(texto, tabla, pre=None):
    t = texto if pre is None else pre(texto)
    return [nombre for nombre, pats in tabla if hay(t, pats)]



# ---------- SUBTEMAS: dentro de cada tema, el subtema que más palabras clave tenga (se editan acá) ----------
SUBTEMAS = {
    "Deportes": [("Fútbol", ["futbol", "gol ", "boca", "river", "racing", "independiente", "san lorenzo", "talleres", "belgrano", "gimnasia", "velez", "central norte", "juventud antoniana", "seleccion", "liga ", "copa", "tabla", "descenso", "ascenso", "jugador", "fecha fifa", "mundial", "eliminatorias", "messi", "dt ", "atletico", "gallardo", "scaloni", "plantel", "pase de", "mercado de pases", "fichaje", "arbitro", "cancha", "estadio", "futbolista", "goleador", "clasico"]),
                 ("Violencia en el deporte", ["hinchas", "barras", "incidentes", "violencia en"]),
                 ("Automovilismo y motores", ["automovilismo", "turismo carretera", "formula 1", "rally", "dakar", "motogp"]),
                 ("Tenis", ["tenis", "atp", "wimbledon", "roland garros"]), ("Rugby y hockey", ["rugby", "pumas", "hockey", "leonas"]),
                 ("Básquet y vóley", ["basquet", "voley", "handball"]), ("Boxeo y artes marciales", ["boxeo", "ufc", "mma", "kick"]),
                 ("Running y ciclismo", ["maraton", "atletismo", "ciclismo", "gran fondo", "running"])],
    "Policiales y seguridad": SEG_SUBTEMAS,
    "Accidentes y emergencias": [("Accidentes viales", ["accidente", "choque", "vuelco", "atropell", "ruta", "moto", "colectivo"]), ("Incendios", ["incendio", "fuego", "bomberos"]),
                                 ("Rescates y derrumbes", ["rescate", "derrumbe", "explosion", "sepultad"]), ("Tragedias y víctimas", ["tragedia", "murio", "murieron", "siniestro", "victima"])],
    "Clima y ambiente": [("Pronóstico y alertas", ["clima", "pronostico", "alerta", "lluvia", "tormenta", "granizo", "viento", "zonda"]), ("Temperaturas", ["calor", "frio", "helada", "temperatura", "ola de calor", "nevada"]),
                         ("Sismos", ["sismo", "temblor", "terremoto"]), ("Ambiente y residuos", ["ambiente", "contaminacion", "residuos", "reciclaje", "fauna", "bosque", "deforestacion", "cambio climatico", "basura"]),
                         ("Sequía e inundaciones", ["sequia", "inundacion", "crecida", "rio"])],
    "Espectáculos y cultura": [("Famosos y farándula", ["famosos", "farandula", "conductor", "conductora", "novio", "noviazgo", "separacion", "romance", "vedette", "pareja", "embarazo", "hijos", "su hija", "su hijo", "wanda", "infidelidad"]),
                               ("Cine y series", ["netflix", "serie ", "pelicula", "estreno", "cine", "streaming"]), ("Música y recitales", ["musica", "recital", "concierto", "cantante", "cumbia", "folklore", "festival", "disco ", "banda de rock"]),
                               ("Televisión", ["television", "telefe", "reality", "masterchef", "bailando", "martin fierro", "ternas"]), ("Teatro, museos y libros", ["teatro", "museo", "exposicion", "libro", "artista"])],
    "Justicia": [("Causas y fallos", ["causa ", "causas", "fallo", "sentencia", "juicio", "amparo"]), ("Corte y tribunales", ["corte suprema", "tribunal", "camara federal", "corte de justicia"]),
                 ("Fiscales y denuncias", ["fiscal", "denuncia", "imputad", "procesad", "indagatoria", "procesamiento", "procurador"]), ("Jueces y designaciones", ["juez", "jueza", "pliego", "magistrad"])],
    "Salud": [("Hospitales y atención", ["hospital", "clinica", "paciente", "cirugia", "trasplante", "sanitari"]), ("Epidemias y vacunación", ["dengue", "vacuna", "sarampion", "epidemia", "gripe", "covid", "peste"]),
              ("Obras sociales y PAMI", ["obra social", "pami"]), ("Medicamentos y farmacias", ["medic", "farmac"]), ("Enfermedades y prevención", ["enfermedad", "cancer", "nutricion", "salud mental"])],
    "Educación y universidades": [("Escuelas y docentes", ["escuela", "docente", "maestr", "colegio", "clases", "ciclo lectivo", "aula", "paro docente"]), ("Universidades", ["universidad", "unsa", "financiamiento universitario", "estudiantil"]),
                                  ("Becas y ciencia", ["beca", "conicet"])],
    "Ciencia y tecnología": [("Inteligencia artificial", ["inteligencia artificial", "chatgpt", "openai", "algoritmo"]), ("Ciberseguridad", ["ciberseguridad", "hackeo"]),
                             ("Espacio", ["nasa", "satelite", "starlink"]), ("Dispositivos y apps", ["celular", "apple", "google", "app ", "software", "internet", "robot", "tecnolog"]), ("Ciencia", ["ciencia", "investigadores", "conicet"])],
    "Minería y energía": [("Litio y minería", ["litio", "mineria", "minera", "yacimiento", "cobre", "oro ", "posco"]), ("Petróleo y gas", ["petroleo", "gas ", "hidrocarburo", "vaca muerta", "combustible", "nafta"]),
                          ("Electricidad y renovables", ["electricidad", "solar", "renovable", "energia"])],
    "Agro y producción": [("Cosechas y cultivos", ["soja", "maiz", "trigo", "cosecha", "siembra", "agricultura", "tabaco", "azucar", "limon", "citrus", "zafra", "agro"]), ("Ganadería y carne", ["ganader", "frigorifico", "carne"]),
                          ("Vino y bodegas", ["vino", "bodega"]), ("Industria, pymes y exportaciones", ["industria", "pyme", "produccion", "exportacion", "cupo", "productores", "campo "])],
    "Transporte e infraestructura": [("Rutas y obras viales", ["ruta ", "rutas", "vial", "vialidad", "peaje", "pavimento", "asfalto", "bacheo", "puente", "obra"]), ("Transporte público", ["colectivo", "saeta", "tren ", "transporte", "ferrocarril"]),
                                     ("Aeropuertos y vuelos", ["aeropuerto", "vuelo", "aerolinea"]), ("Agua, luz y servicios", ["agua potable", "cloaca", "aguas del norte", "edesa", "corte de luz", "infraestructura"])],
    "Turismo": [("Destinos", ["cafayate", "quebrada", "tren a las nubes", "destino"]), ("Hotelería y ocupación", ["hotel", "ocupacion hotelera"]), ("Feriados y fines de semana largos", ["feriado", "fin de semana largo", "vacaciones"]),
                ("Turismo receptivo", ["turismo", "turista", "temporada alta", "receptivo"])],
    "Trabajo y gremios": [("Paritarias y salarios", ["paritaria", "salario", "sueldo", "convenio colectivo"]), ("Gremios y paros", ["gremio", "sindicat", "cgt", "paro ", "huelga", "asamblea"]),
                          ("Empleo y despidos", ["empleo", "desempleo", "despido", "trabajadores"]), ("Reforma laboral", ["reforma laboral"])],
    "Economía y finanzas": [("Dólar y mercados", ["dolar", "bolsa", "bonos", "plazo fijo", "riesgo pais", "reservas", "bcra", "banco central"]), ("Inflación y precios", ["inflacion", "precios", "canasta", "consumo", "alquiler"]),
                            ("Impuestos y tarifas", ["impuest", "tarifa", "afip", "arca ", "retenciones", "aranceles"]), ("Deuda, FMI y presupuesto", ["deuda", "fmi", "superavit", "deficit", "presupuesto", "ajuste", "recesion"]),
                            ("Jubilaciones y crédito", ["jubilaci", "credito", "tasa de interes"])],
    "Sociedad y género": [("Género y diversidad", ["genero", "mujer", "diversidad", "lgbt"]), ("Niñez y familia", ["ninez", "infancia", "adolescente", "familia", "adopcion"]),
                          ("Pobreza y asistencia", ["pobreza", "comedor", "alimentos", "asistencia"]), ("Discapacidad y adultos mayores", ["discapacidad", "adultos mayores", "jubilad"]),
                          ("Comunidades y vecinos", ["pueblos originarios", "indigena", "comunitari", "vecinos", "barrio", "solidari"]), ("Iglesia y derechos humanos", ["el papa", "papa leon", "leon xiv", "peregrin", "iglesia", "obispo", "derechos humanos", "migrante", "ong "])],
    "Internacional": [("Estados Unidos", ["estados unidos", "eeuu", "trump"]), ("Medio Oriente", ["israel", "hamas", "gaza", "iran"]), ("Rusia y Ucrania", ["rusia", "ucrania", "putin", "zelenski"]),
                      ("América Latina", ["brasil", "chile", "bolivia", "paraguay", "uruguay", "venezuela", "mexico", "ecuador", "colombia", "peru ", "cuba", "lula", "bolsonaro", "maduro", "mercosur"]),
                      ("Europa y Asia", ["europa", "china", "espana", "francia", "italia", "reino unido", "japon", "union europea"]), ("Vaticano", ["papa ", "vaticano"])],
    "Política y gobierno": [("Poder Legislativo", ["senad", "diputad", "legisl", "congreso", "concejo", "concejal", "sesion", "proyecto de ley"]), ("Gobierno y gabinete", ["gobernador", "gobierno", "ministr", "gabinete", "decreto", "casa rosada", "intendente", "municip", "licitacion"]),
                            ("Elecciones y partidos", ["eleccion", "electoral", "candidat", "partido", "alianza", "interna", "oposicion", "oficialismo", "bloque", "peronis", "libertari", "radicalis", "campana"]),
                            ("Corrupción y escándalos", ["corrupcion", "escandalo", "coima", "cuadernos", "sobreprecio", "denuncia"]), ("Relación Nación-provincias", ["gobernadores", "coparticipacion", "provincias", "fondos"])],
}
SUB_GENERAL = "General"


def subtema_todos(tema, texto):
    mejor, nmax = SUB_GENERAL if tema != "Policiales y seguridad" else "Otros hechos de seguridad", 0
    for nombre, pats in SUBTEMAS.get(tema, []):
        n = len(hay(texto, pats))
        if n > nmax:
            mejor, nmax = nombre, n
    return mejor



STOP = set("""para como pero porque sobre entre desde hasta cuando donde este esta estos estas esto esos esas ellos ellas sera fue fueron
ser han hay muy mas menos tras ante bajo segun sino cada todo todos toda todas otra otro otros otras tambien ademas aunque luego
solo sido tiene tienen tener quien quienes cual cuales ese esa nuestro nuestra salta argentina nacional provincial provincia
infobae clarin tribuno perfil ambito noticias nueva nuevo nuevos nuevas anos dias dijo dice dicen habia hizo hace hacen""".split())


@lru_cache(maxsize=4096)
def _rx(p):
    return re.compile(r"(?<![a-z0-9])" + re.escape(p.strip()) + (r"" if p.endswith(" ") is False and len(p.strip()) > 3 else r"(?![a-z0-9])"))


def hay(texto, patrones):
    return [p for p in patrones if _rx(p).search(texto)]


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


_PROPIO = re.compile(r"(?<![\wáéíóúüñ])([A-ZÁÉÍÓÚÑ][a-záéíóúüñ]{2,}|[A-ZÁÉÍÓÚÑ]{3,})")


def propios(titulo):
    """Nombres propios del título (lugares y personas), sin contar la primera palabra ni la que sigue a «:», «.» o «¿»."""
    res = set()
    for m in _PROPIO.finditer(str(titulo or "")):
        previo = titulo[:m.start()].rstrip()
        if not previo or previo[-1] in ":.¿¡\"“«-–|":
            continue
        res.add(fold(m.group(1)))
    return res


def distintos(t1, t2):
    """True si los dos títulos nombran lugares o personas y no comparten ninguno: son notas distintas aunque se parezcan
    («Clima en Santa Fe: cómo estará el tiempo...» y «Clima en Córdoba: cómo estará el tiempo...»)."""
    a, b = propios(t1), propios(t2)
    return bool(a) and bool(b) and not (a & b)


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
            if distintos(items[i]["titulo"], items[j]["titulo"]):
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


def armar_historias(items, tema_fn, alcance_fn, previas, extra_fn=None, selector=None, max_links=None):
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
             "medios": medios_g, "n_notas": len(g), "primera": g[0]["hora"], "links": links[:(max_links or MAX_LINKS)]}
        if extra_fn:
            h.update(extra_fn(g, h))
        if sigue:
            h["sigue_de_ayer"] = True
        historias.append(h)
    clave = lambda h: (-len(h["medios"]), -h["n_notas"], [-ord(c) for c in h["primera"]], h["titulo"])
    historias.sort(key=clave)
    top = []
    if selector:
        top = selector(historias)
    else:
        for amb in ("Salta", "Nacional", "Ambos"):
            top += [h for h in historias if h["alcance"] == amb][:MAX_HISTORIAS]
    top.sort(key=clave)
    for i, h in enumerate(top, 1):
        h["n"] = i
    return historias, top


def alcance_politica(g):
    ambs = {x["ambito"] for x in g}
    if ambs == {"Salta"}:
        return "Salta"
    if ambs == {"Nacional"}:
        # Nota de medios nacionales que nombra un lugar salteño: entra en el filtro «Salta» (estimación por el título).
        return "Ambos" if any(SALTA_MARCAS.search(x["titulo"]) for x in g) else "Nacional"
    return "Ambos"


def alcance_seguridad(g):
    """Provincia de Salta solo si algún titular de la historia nombra un lugar salteño; todo lo demás es «resto del país».
    Es una estimación por el título: puede dejar como nacional una nota local que no nombra el lugar."""
    return "Salta" if any(SALTA_MARCAS.search(x["titulo"]) for x in g) else "Nacional"


def tokens_previos(fecha):
    """Palabras de las historias del día anterior (política y seguridad) para marcar lo que «sigue de ayer»."""
    ayer = (datetime.fromisoformat(fecha) - timedelta(days=1)).strftime("%Y-%m-%d")
    d = cargar(os.path.join("resumenes", ayer + ".json"), None)
    if not d:
        return [], [], []
    f = lambda hs: [raices(fold(" ".join([h["titulo"]] + [l["titulo"] for l in h.get("links", [])[:3]]))) for h in hs]
    return f(d.get("historias", [])), f((d.get("seguridad") or {}).get("historias", [])), f((d.get("todos") or {}).get("historias", []))


def resumen_del_dia(fecha, noticias, politicos, oficiales, nombres):
    dia = [n for n in noticias if fecha_ar(n.get("published_iso")) == fecha]
    por_id = {p["id"]: p for p in politicos}
    todas, politicas, seguras, todos_t, medios, vistos_t = 0, [], [], [], defaultdict(lambda: {"ambito": "", "notas": 0, "politicas": 0, "seguridad": 0}), set()
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
        todos_t.append(base)
        fuera = solo_extranjero(tf, nombres_l)      # nota solo del exterior: va a «Internacional», no a política ni seguridad de acá
        if es_politica(tf, nombres_l) and not fuera:
            m["politicas"] += 1
            politicas.append(base)
        if es_seguridad(tf) and not fuera:
            m["seguridad"] += 1
            seguras.append(base)
    prev_pol, prev_seg, prev_todos = tokens_previos(fecha)
    historias, top = armar_historias(politicas, tema_de, alcance_politica, prev_pol)
    hist_seg, top_seg = armar_historias(seguras, subtema_seg, alcance_seguridad, prev_seg)
    # ---- TODOS los temas, con ministerio nacional y de Salta ----
    sin_salud_pub = lambda t: t.replace("ministerio de salud publica", "").replace("salud publica", "")

    def extra_todos(g, h):
        texto = " ".join(fold(x["titulo"]) for x in g[:3])
        fuera = solo_extranjero(texto, nombres_l)       # nota solo del exterior: no corresponde ministerio argentino
        mn = [] if fuera else ministerios(texto, MIN_NAC, sin_salud_pub)
        mp = ministerios(texto, MIN_PROV) if (h["alcance"] in ("Salta", "Ambos") and not fuera) else []
        m_tema = TEMA_A_MIN_PROV.get(h["tema"])
        if m_tema and m_tema not in mp and not fuera and any(SALTA_MARCAS.search(x["titulo"]) for x in g):
            mp.append(m_tema)
        pers = []
        for nom, pid in nombres.items():
            if nom in texto and pid not in pers:
                pers.append(pid)
        return {"min_nac": mn, "min_prov": mp, "sub": subtema_todos(h["tema"], texto), "lugar": any(SALTA_MARCAS.search(x["titulo"]) for x in g), "personas": pers[:3]}

    def elegir(hs):
        # Se guardan las historias más cubiertas de CADA tema y de CADA ministerio, para que ningún tema quede vacío.
        sel, cta, cmn, cmp_, csub = {}, Counter(), Counter(), Counter(), Counter()
        for i, h in enumerate(hs):             # hs ya viene ordenada por cobertura
            quedar = cta[h["tema"]] < TOPE_TEMA or csub[(h["tema"], h["sub"])] < TOPE_SUB
            for m in h["min_nac"]:
                if cmn[m] < TOPE_MIN:
                    quedar = True
            for m in h["min_prov"]:
                if cmp_[m] < TOPE_MIN:
                    quedar = True
            if quedar:
                sel[i] = h
                cta[h["tema"]] += 1
                csub[(h["tema"], h["sub"])] += 1
                for m in h["min_nac"]:
                    cmn[m] += 1
                for m in h["min_prov"]:
                    cmp_[m] += 1
        return list(sel.values())

    hist_todos_all, top_todos = armar_historias(todos_t, lambda t: tema_todos(t, nombres_l), alcance_politica, prev_todos,
                                                extra_fn=extra_todos, selector=elegir, max_links=MAX_LINKS_TODOS)
    cnt_tema, notas_tema = Counter(), Counter()
    cnt_mn, cnt_mp, cnt_sub, cnt_per = Counter(), Counter(), Counter(), Counter()
    for h in hist_todos_all:
        cnt_sub[(h["tema"], h["sub"])] += 1
        for pid in h["personas"]:
            cnt_per[pid] += 1
        cnt_tema[h["tema"]] += 1
        notas_tema[h["tema"]] += h["n_notas"]
        for m in h["min_nac"]:
            cnt_mn[m] += 1
        for m in h["min_prov"]:
            cnt_mp[m] += 1
    todos = {
        "totales": {"notas": len(todos_t), "historias": len(hist_todos_all), "guardadas": len(top_todos), "temas": len(cnt_tema),
                    "con_ministerio_nacional": sum(1 for h in hist_todos_all if h["min_nac"]),
                    "con_ministerio_salta": sum(1 for h in hist_todos_all if h["min_prov"]),
                    "salta": sum(1 for h in hist_todos_all if h["alcance"] == "Salta"),
                    "nacional": sum(1 for h in hist_todos_all if h["alcance"] == "Nacional"),
                    "ambos": sum(1 for h in hist_todos_all if h["alcance"] == "Ambos"),
                    "nombran_lugar_salta": sum(1 for h in hist_todos_all if h["lugar"])},
        "temas": [{"tema": t, "historias": n, "notas": notas_tema[t]} for t, n in cnt_tema.most_common()],
        "subtemas": [{"tema": t, "subtema": sb, "historias": n} for (t, sb), n in sorted(cnt_sub.items(), key=lambda kv: (-kv[1], kv[0]))],
        "personas": [{"id": pid, "nombre": por_id[pid]["name"], "historias": n} for pid, n in sorted(cnt_per.items(), key=lambda kv: (-kv[1], kv[0]))[:15] if pid in por_id],
        "ministerios_nacionales": [{"ministerio": m, "historias": cnt_mn[m]} for m, _ in MIN_NAC if cnt_mn[m]],
        "ministerios_salta": [{"ministerio": m, "historias": cnt_mp[m]} for m, _ in MIN_PROV if cnt_mp[m]],
        "historias": top_todos,
    }
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
        "todos": todos,
        "palabras": [{"t": w, "n": n} for w, n in sorted(palabras.items(), key=lambda kv: (-kv[1], kv[0]))[:15] if n >= 3],
        "personas": [{"id": pid, "nombre": por_id[pid]["name"], "notas": n} for pid, n in sorted(personas.items(), key=lambda kv: (-kv[1], kv[0]))[:15] if pid in por_id],
        "oficiales": {"total": len(of), "con_personas_o_salta": len(destac),
                      "destacadas": [{"titulo": i.get("titulo", ""), "fuente": i.get("fuente", ""), "link": i.get("url", "")} for i in destac[:8]]},
        "medios": sorted([{"nombre": k, **v} for k, v in medios.items()], key=lambda x: -x["notas"]),
        "metodo": "Titulares agrupados por palabras en común (una historia por noticia, con todos los medios que la dicen); el tema, lo político, lo de seguridad y el ministerio (nacional o de Salta) se detectan por palabras clave del título. No usa IA ni lee el texto de las notas.",
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
            json.dump(nuevo, fh, ensure_ascii=False, separators=(",", ":"))
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
                idx.append({"fecha": d["fecha"], **d["totales"], "temas_todos": (d.get("todos") or {}).get("totales", {}).get("temas"), "cobertura_baja": d.get("cobertura_baja", False)})
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
    # tendencias: por día, cuántas historias hubo de cada tema y subtema (para el radar de temas). Se fusiona con lo anterior
    ruta_t = os.path.join(OUT, "tendencias.json")
    previo_t = cargar(os.path.join("resumenes", "tendencias.json"), {}).get("dias", [])
    por_dia = {x["fecha"]: x for x in previo_t if isinstance(x, dict) and x.get("fecha")}
    for nombre in os.listdir(OUT):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", nombre):
            continue
        try:
            with open(os.path.join(OUT, nombre), encoding="utf-8") as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            continue
        td = d.get("todos")
        if not td:
            continue
        por_dia[d["fecha"]] = {"fecha": d["fecha"], "notas": td["totales"]["notas"], "historias": td["totales"]["historias"],
                               "temas": {x["tema"]: x["historias"] for x in td["temas"]},
                               "subtemas": {x["tema"] + "|" + x["subtema"]: x["historias"] for x in td.get("subtemas", [])}}
    dias_t = sorted(por_dia.values(), key=lambda x: x["fecha"])[-60:]
    nuevo_t = json.dumps({"dias": dias_t}, ensure_ascii=False, separators=(",", ":")) + "\n"
    try:
        actual_t = open(ruta_t, encoding="utf-8").read()
    except OSError:
        actual_t = ""
    if actual_t != nuevo_t:
        open(ruta_t, "w", encoding="utf-8").write(nuevo_t)
        cambios += 1
    print(f"Listo. Archivos escritos: {cambios}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
