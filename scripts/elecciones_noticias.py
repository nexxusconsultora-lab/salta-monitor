# -*- coding: utf-8 -*-
"""
NEWAR · Noticias y publicaciones oficiales electorales (cuasi tiempo real).

Toma lo que el proyecto ya recolecta (data/news_general.json y data/oficiales.json), se queda solo con lo que trata
sobre elecciones de la Argentina y de Salta, y escribe data/elecciones_noticias.json, que lee la pestaña «Elecciones».

Cuida la PRECISIÓN antes que la cantidad: es preferible perder un titular dudoso que mostrar «a un paso de la
localía» (fútbol) o «elecciones en EE.UU.» como si fueran noticias electorales argentinas.

Además detecta, en los boletines oficiales, las publicaciones que parecen CONVOCAR a elecciones («Convócase al
cuerpo electoral…») y trata de leer la fecha de la votación. Esa fecha es solo una pista para que una persona la
confirme y la cargue en data/elecciones.json: nunca se aplica sola.

Sin dependencias: usa solo lo que trae Python.
"""
import os, re, sys, json, unicodedata
from datetime import datetime, timedelta, timezone

AQUI = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(AQUI, "..", "data"))
NOTICIAS, OFICIALES, SALIDA = (os.path.join(DATA, f) for f in ("news_general.json", "oficiales.json", "elecciones_noticias.json"))
DIAS_NOTICIAS, DIAS_OFICIALES, MAX_NOTICIAS, MAX_OFICIALES = 21, 120, 60, 40
MESES = {m: i + 1 for i, m in enumerate("enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split())}


def plegar(s):
    """Minúsculas y sin tildes, para comparar."""
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()


ACTORES = (r"(milei|kicillof|cristina|kirchner|massa|bullrich|macri|villarruel|llaryora|pullaro|jaldo|saenz|sadir|zdero|torres|frigerio|ziliotto|"
           r"melconian|tetaz|lousteau|larreta|libertad avanza|peronismo|kirchnerismo|casa rosada)")
CARGOS = r"(presidente|presidencia|vicepresidente|gobernador|gobernacion|vicegobernador|intendente|intendencia|diputad[oa]s?|senador(a|es)?|jefe de gobierno|legislador(a|es)?|concejal(es)?|convencional(es)?)"
PROVINCIAS = (r"(salta|jujuy|tucuman|santa fe|cordoba|mendoza|buenos aires|caba|catamarca|chaco|chubut|entre rios|formosa|la pampa|la rioja|"
              r"misiones|neuquen|rio negro|san juan|san luis|santa cruz|santiago del estero|tierra del fuego|corrientes)")

# Señales fuertes: con una sola alcanza (si no hay motivo de descarte).
FUERTES = [re.compile(p) for p in (
    r"\belecciones? (2027|presidenciales?|provinciales?|nacionales?|legislativas?|generales|municipales?|bonaerenses|primarias)\b",
    r"\belecciones? (en|de|del|para) " + PROVINCIAS,
    r"\b(calendario|cronograma) electoral\b", r"\breforma (electoral|politica)\b", r"\bboleta unica\b", r"\bcierre de listas\b",
    r"\b(alianza|frente|armado|interna) electoral(es)?\b", r"\blistas? colectoras?\b", r"\bdesdobl\w+", r"\b(balotaje|ballotage)\b",
    r"\bsegunda vuelta\b.{0,40}\b(presiden|2027)\b", r"\bcandidaturas?\b",
    r"\b(pre)?candidat[oa]s? (a|al|para) (la |el )?" + CARGOS, r"\bpre-?candidat[oa]s?\b", r"\bpostulantes? a (la |el )?" + CARGOS,
    r"\btribunal(es)? electoral(es)?\b", r"\bjusticia (nacional )?electoral\b", r"\bcamara nacional electoral\b", r"\bdireccion nacional electoral\b",
    r"\bjuntas? electorales?\b", r"\bescrutinio\b", r"\bpadron(es)? (provisorio |definitivo )?electoral(es)?\b", r"\bpadron(es)? provisorio\b",
    r"\b(el|la|un|una|ni) candidat[oa]s? (de|del|por) (la libertad avanza|lla|el pro|ucr|peronismo|justicialismo|kirchnerismo|oposicion|oficialismo|el frente|fuerza patria|el gobierno)\b",
    r"\bcandidat[oa]s?\b.{0,80}\b" + ACTORES + r"\b", r"\b" + ACTORES + r"\b.{0,80}\bcandidat[oa]s?\b",
    r"\bdebate presidencial\b", r"\bprimarias\b", r"\bsucesion presidencial\b", r"\breelecci(on|ones)\b", r"\bcomicios\b", r"\bsufragio\b",
)]
# «2027» junto a un nombre propio es una señal más floja: se descarta si habla de presupuesto, eventos, etc.
FUERTES_2027 = [re.compile(p) for p in (
    r"\b2027\b.{0,80}\b(milei|kicillof|candidat|presiden|gobernador|elecc|alianza|frente|libertad avanza|peronismo|massa|cristina|saenz)\b",
    r"\b(milei|kicillof|candidat|presiden|gobernador|elecc|alianza|frente|libertad avanza|peronismo|massa|cristina|saenz)\b.{0,80}\b2027\b",
)]
NO_2027 = re.compile(r"\b(presupuesto|argentina week|ejercicio|temporada|inflacion|paritarias?|ciclo lectivo|calendario escolar|aguinaldo|mundial|copa|cumbre|expo|feria)\b")
# Motivos de descarte: deporte, espectáculos y elecciones de otros países.
PAISES = (r"(ee\.? ?uu\.?|eeuu|estados unidos|brasil|chile|colombia|peru|mexico|espana|francia|italia|alemania|bolivia|ecuador|venezuela|"
          r"uruguay|paraguay|israel|ucrania|rusia|japon|canada|reino unido|portugal|hungria|nueva york|new york)")
DESCARTES = [re.compile(p) for p in (
    r"\belecciones?( \w+){0,2} (en|de|del) " + PAISES, r"\b(tras|por|luego de|despues de) (las )?elecciones (en|de) " + PAISES,
    r"\bmidterms?\b", r"\b(republican[oa]s?|demócrat\w+|democrat\w+)\b", r"\btrump\b",
    r"\b(river|boca|racing|independiente|san lorenzo|velez|newell\w*|lanus|banfield|huracan|platense|rosario central|gimnasia|atletico tucuman|juventud antoniana|"
    r"central cordoba|defensa y justicia|sudamericana|libertadores|copa|torneo|mundial|futbol|jugador|tenis|rugby|liga|gol|dt)\b",
    r"\bcandidat[oa]s? (a|al) (tocar|ganar el|premio|oscar|mejor|balon|ser (el|la) (mejor|nuevo|nueva))\b", r"\bcandidat[oa]s? a los premios\b",
    r"\bex[ -]candidat[oa]s?\b",
)]
FUENTES_DEPORTIVAS = re.compile(r"(sports|\bole\b|espn|deport|tycsports|doble amarilla|mundo deportivo)")
DELITOS = re.compile(r"\b(asesin\w+|perpetua|condenad\w+|detenid\w+|homicidio|crimen|femicidio|abuso|robo|estafa)\b")
ELECTORAL_DURO = re.compile(r"\b(elecciones|comicios|escrutinio|electoral(es)?)\b")
ANCLAS_ARG = re.compile(r"\b(2027|elecciones (provinciales|bonaerenses|nacionales|2027)|paso|salta|bonaerens\w*|gobernador|intendente|kicillof|libertad avanza)\b")
NACIONALES = re.compile(r"\b(kicillof|milei|nacion|presidente|bonaerens|cordoba|tucuman|santa fe|caba|macri|cristina|massa|congreso|senado de la nacion|"
                        r"diputados nacionales|argentina|camara nacional|direccion nacional|la libertad avanza|casa rosada|bullrich|gobernadores)\b")
NACIONAL_POLITICO = re.compile(r"\b(paso|presupuesto|congreso|aliados|reforma|oficialismo nacional|gobierno nacional|senado|diputados de la nacion|kirchner\w*|cristina|milei|peronismo|libertad avanza)\b")
SALTA = re.compile(r"\b(salta|salteñ\w+|salten\w+|saenz)\b")


def _es_mayuscula(t):
    return len(t) > 20 and t == t.upper()


def es_electoral_noticia(titulo, fuente=""):
    """True si el titular trata de elecciones argentinas. 'titulo' va con su mayúscula original (PASO)."""
    f = plegar(titulo)
    if FUENTES_DEPORTIVAS.search(plegar(fuente)) or any(d.search(f) for d in DESCARTES):
        return False
    if re.search(r"\b" + PAISES + r"\b", f) and not ANCLAS_ARG.search(f) and "PASO" not in titulo and " Paso" not in titulo:
        return False  # habla de otro país y no da ninguna pista de ser sobre la Argentina
    if DELITOS.search(f) and not ELECTORAL_DURO.search(f):
        return False
    if any(p.search(f) for p in FUERTES):
        return True
    if any(p.search(f) for p in FUERTES_2027) and not NO_2027.search(f):
        return True
    # «PASO» solo cuenta si viene en mayúsculas dentro de un titular normal (no «paso a paso», «Paso de los Libres», «a un paso de»)
    if _es_mayuscula(titulo):
        return False
    return bool((re.search(r"(?<![A-Za-z])PASO(?![A-Za-z])", titulo) and not re.search(r"\bPASO (DE|A)\b", titulo))
                or re.search(r"\b(las|Las|de las|con las|sin las) Paso\b(?! (de|a)\b)", titulo))


LOCALES = re.compile(r"\b(gobernador|vicegobernador|intendente|intendentes|concejal\w*|legislatura|senador(es)? provincial\w*|diputad\w+ provincial\w*|municipal\w*|capital)\b")


def nivel_noticia(titulo, categoria):
    """'salta' solo si el titular nombra a Salta o a su gobernador, o si es de un medio salteño y habla de autoridades locales sin
    ninguna pista de ser un tema nacional o de otra provincia. Ante la duda, 'argentina'."""
    f = plegar(titulo)
    if SALTA.search(f):
        return "salta"
    if (categoria == "Provincial" and LOCALES.search(f) and not NACIONALES.search(f) and not NACIONAL_POLITICO.search(f)
            and not re.search(r"\b" + PROVINCIAS + r"\b", f.replace("salta", ""))):
        return "salta"
    return "argentina"


# ---- boletines oficiales ----
OFICIALES_FUERTES = [re.compile(p) for p in (
    r"\bcuerpo electoral\b", r"\bconvoca\w*.{0,70}\b(elecciones|comicios|eleccion)\b", r"\b(calendario|cronograma) electoral\b", r"\btribunal(es)? electoral(es)?\b",
    r"\bjusticia (nacional )?electoral\b", r"\bcamara nacional electoral\b", r"\bdireccion nacional electoral\b", r"\bcodigo electoral\b",
    r"\bregimen electoral\b", r"\bley electoral\b", r"\bpadron(es)? electoral(es)?\b", r"\bboleta unica\b", r"\bjuntas? electorales?\b",
    r"\b(alianzas?|frentes?) electorales?\b", r"\baportes? publicos? de campana\b", r"\bpropaganda electoral\b",
    r"\belecciones (generales|provinciales|primarias|nacionales|municipales|2027)\b", r"\bsimultaneidad de elecciones\b",
)]
CONVOCA = re.compile(r"\bconvoca\w*\b.{0,80}\b(cuerpo electoral|elecciones|comicios|eleccion)\b|\bcuerpo electoral\b.{0,60}\bconvoca\w*\b")
FECHA = re.compile(r"\b(\d{1,2})\s+de\s+(" + "|".join(MESES) + r")\s+(?:de\s+)?(20\d\d)\b")


def es_electoral_oficial(titulo):
    return any(p.search(plegar(titulo)) for p in OFICIALES_FUERTES)


def fecha_votacion_detectada(texto, desde):
    """Primera fecha 'N de mes de AAAA' del texto que sea posterior a 'desde' (la de la votación, no la de publicación)."""
    for d, m, a in FECHA.findall(plegar(texto)):
        try:
            f = datetime(int(a), MESES[m], int(d)).date()
        except ValueError:
            continue
        if f > desde:
            return f.isoformat()
    return None


def _fecha(s):
    try:
        t = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return t if t.tzinfo else t.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def construir(noticias, oficiales, ahora):
    hoy = ahora.date()
    vistos, out_n = set(), []
    lim_n = ahora - timedelta(days=DIAS_NOTICIAS)
    for n in sorted(noticias, key=lambda n: n.get("published_iso") or "", reverse=True):
        t = _fecha(n.get("published_iso"))
        if not t or t < lim_n or t > ahora + timedelta(hours=6):
            continue
        titulo = (n.get("title") or "").strip()
        clave = re.sub(r"[^a-z0-9]+", " ", plegar(titulo))[:90]
        if not titulo or clave in vistos or not es_electoral_noticia(titulo, n.get("source")):
            continue
        vistos.add(clave)
        out_n.append({"id": n.get("id"), "titulo": titulo, "url": n.get("link"), "fuente": n.get("source"),
                      "fecha": t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "nivel": nivel_noticia(titulo, n.get("category"))})
        if len(out_n) >= MAX_NOTICIAS:
            break
    out_o, conv = [], []
    lim_o = hoy - timedelta(days=DIAS_OFICIALES)
    for o in sorted(oficiales, key=lambda o: o.get("fecha_publicacion") or "", reverse=True):
        fp = o.get("fecha_publicacion") or ""
        try:
            fd = datetime.strptime(fp, "%Y-%m-%d").date()
        except ValueError:
            continue
        titulo = (o.get("titulo") or "").strip()
        if fd < lim_o or not es_electoral_oficial(titulo):
            continue
        juris = o.get("jurisdiccion") or ""
        e = {"id": o.get("id"), "titulo": titulo, "url": o.get("url"), "fuente": o.get("fuente"), "jurisdiccion": juris, "tipo": o.get("tipo_acto"),
             "fecha": fp, "nivel": "salta" if juris.startswith("Salta") else "argentina", "convocatoria": False}
        if CONVOCA.search(plegar(titulo)):
            e["convocatoria"] = True
            e["fecha_detectada"] = fecha_votacion_detectada(titulo + " " + str(o.get("resumen") or ""), fd)
            conv.append(e)
        out_o.append(e)
        if len(out_o) >= MAX_OFICIALES:
            break
    return {"noticias": out_n, "oficiales": out_o, "convocatorias": conv,
            "criterio": "Titulares de la última etapa que mencionan elecciones argentinas, filtrados automáticamente (se descartan deportes, espectáculos y elecciones de otros países). Puede haber omisiones y, raramente, un titular de más. Una convocatoria detectada es una pista para confirmar, no una fecha oficial."}


def _leer(p):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def main():
    n, o = _leer(NOTICIAS), _leer(OFICIALES)
    if not isinstance(n, list) or not isinstance(o, dict) or not isinstance(o.get("items"), list):
        print("ERROR: no se pudieron leer data/news_general.json o data/oficiales.json.")
        return 1
    ahora = datetime.fromisoformat(os.environ["NEWAR_AHORA"].replace("Z", "+00:00")) if os.environ.get("NEWAR_AHORA") else datetime.now(timezone.utc)
    res = construir(n, o["items"], ahora)
    previo = _leer(SALIDA) or {}
    if all(res[k] == previo.get(k) for k in res):
        print("Sin cambios: %d noticias, %d oficiales." % (len(res["noticias"]), len(res["oficiales"])))
        return 0
    res["generado"] = ahora.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print("Guardado: %d noticias (%d de Salta), %d oficiales, %d posibles convocatorias." % (
        len(res["noticias"]), sum(1 for x in res["noticias"] if x["nivel"] == "salta"), len(res["oficiales"]), len(res["convocatorias"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
