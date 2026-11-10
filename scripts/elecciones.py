# -*- coding: utf-8 -*-
"""
NEWAR · Recolector de resultados electorales (Parte 2).

Qué hace, cada vez que corre:
  1. Lee data/elecciones.json y mira si hay una elección en «jornada» (día de la votación) o «post» (días siguientes).
     Si no hay ninguna, termina sin tocar nada.
  2. Respeta la hora de publicación: antes de 'no_publicar_antes' (por defecto 21:00 de Argentina del día de la
     elección) no pide ni guarda nada.
  3. Pide los datos con el «adaptador» que la elección tenga configurado en fuente_resultados.adaptador.
  4. Valida lo recibido (fechas, mesas, votos que sumen, que el conteo no retroceda) y recién entonces escribe el
     archivo indicado en 'resultados_url' (por ejemplo data/elecciones_resultados.json). Si algo no cierra, deja el
     archivo anterior como estaba y lo cuenta en el registro de la corrida.

Adaptadores disponibles hoy:
  - json_normalizado: la fuente ya entrega el formato de NEWAR (ver data/elecciones_resultados.json). Sirve para el
    intermediario de la Parte 3 o para cualquier fuente que se convierta a ese formato. Se configura con
    "fuente_resultados": {"adaptador": "json_normalizado", "datos_url": "https://..."}.
  - dine_api: la API oficial de la Dirección Nacional Electoral (elecciones nacionales). Puede pedir un token (secreto DINE_TOKEN).
  - salta_tribunal: TODAVÍA NO EXISTE (las elecciones provinciales de Salta no pasan por la DINE). Falta ver el formato de esa fuente.

Sonda de la DINE (--probar-dine): pregunta a la API por la elección de 2023 para descubrir los códigos de distrito y categoría.

Simulacro (--simulacro MINUTOS): ensayo general con una elección INVENTADA (data/elecciones_simulacro.json). Genera un conteo que
avanza solo y lo hace pasar por el mismo camino que una elección real (validación, historial, subida a GitHub, pantalla,
avisos al celular). Sirve para medir la demora real de punta a punta. No toca los datos de ninguna elección real.

Modo diagnóstico (python scripts/elecciones.py --diagnosticar): visita las páginas oficiales, respeta su robots.txt,
y guarda en data/elecciones_diagnostico.json qué responde cada una y qué direcciones de datos (API) aparecen.
No guarda resultados.

Sin dependencias: usa solo lo que trae Python.
"""
import os, sys, json, re, time, argparse, subprocess, urllib.request, urllib.error, urllib.robotparser
from urllib.parse import urlparse, urljoin, urlencode
from datetime import datetime, timezone, timedelta

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
CFG = os.path.join(RAIZ, "data", "elecciones.json")
DIAG = os.path.join(RAIZ, "data", "elecciones_diagnostico.json")
AR = timezone(timedelta(hours=-3))  # Argentina: UTC-3 todo el año
UA = "NEWAR-monitor/1.0 (+https://github.com/nexxusconsultora-lab/salta-monitor)"
UA_TOKEN = "NEWAR-monitor"
RUTA_OK = re.compile(r"^data/[a-z0-9_\-]+\.json$")

# Páginas que mira el diagnóstico (fuentes oficiales mencionadas por la prensa y por la propia DINE)
DIAG_URLS = [
    "https://resultados.mininterior.gob.ar/",
    "https://resultados.elecciones.gob.ar/",
    "https://www.electoralsalta.gov.ar/",
]


def log(*a):
    print(*a, flush=True)


def ahora():
    v = os.environ.get("NEWAR_AHORA")  # solo para pruebas
    if v:
        t = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return t if t.tzinfo else t.replace(tzinfo=AR)
    return datetime.now(timezone.utc)


# ---------- estado de cada elección (mismo criterio que elecciones.js) ----------
def _dia_ok(s):
    try:
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", s or "")) and bool(datetime.strptime(s, "%Y-%m-%d"))
    except ValueError:
        return False


def _suma(s, n):
    return (datetime.strptime(s, "%Y-%m-%d") + timedelta(days=n)).strftime("%Y-%m-%d")


def estado(e, hoy):
    if e.get("forzar_estado"):
        return e["forzar_estado"]
    f = e.get("fecha")
    if not _dia_ok(f):
        return "sin_fecha"
    desde = e["candidatos_desde"] if _dia_ok(e.get("candidatos_desde")) else _suma(f, -60)
    dp = e.get("dias_post")
    hasta = _suma(f, 7 if dp is None else int(dp))
    if hoy < desde:
        return "proxima"
    if hoy < f:
        return "candidatos"
    if hoy == f:
        return "jornada"
    if hoy <= hasta:
        return "post"
    return "terminada"


def embargo(e, st, t):
    """Devuelve el momento antes del cual NO se publica, o None si ya se puede."""
    if st != "jornada":
        return None
    if e.get("no_publicar_antes"):
        lim = datetime.fromisoformat(e["no_publicar_antes"].replace("Z", "+00:00"))
    elif _dia_ok(e.get("fecha")):
        lim = datetime.fromisoformat(e["fecha"] + "T21:00:00-03:00")
    else:
        return None
    return lim if t < lim else None


# ---------- red (con robots.txt) ----------
_ROBOTS = {}


def http_get(url, max_bytes=3_000_000, timeout=20, headers=None):
    h = {"User-Agent": UA, "Accept": "application/json, text/html;q=0.8, */*;q=0.5"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read(max_bytes)
    except urllib.error.HTTPError as x:
        return x.code, x.headers.get("Content-Type", "") if x.headers else "", b""


def permitido(url):
    """True si el robots.txt del sitio deja leer esa dirección. Ante un error del servidor, se asume que NO."""
    p = urlparse(url)
    base = f"{p.scheme}://{p.netloc}"
    if base not in _ROBOTS:
        try:
            st, _, body = http_get(base + "/robots.txt", 300_000)
            if st == 200:
                rp = urllib.robotparser.RobotFileParser()
                rp.parse(body.decode("utf-8", "replace").splitlines())
                _ROBOTS[base] = rp
            else:
                _ROBOTS[base] = 400 <= st < 500  # 4xx = no hay reglas; 5xx = no arriesgar
        except Exception:
            _ROBOTS[base] = False
    r = _ROBOTS[base]
    return r if isinstance(r, bool) else r.can_fetch(UA_TOKEN, url)


# ---------- adaptadores ----------
class SinAdaptador(Exception):
    pass


def adaptador_json_normalizado(fuente, e):
    url = fuente.get("datos_url") or ""
    if not url.startswith("https://"):
        raise ValueError("falta 'datos_url' (https) en fuente_resultados")
    if not permitido(url):
        raise PermissionError("el robots.txt de esa fuente no permite leerla; no se accede")
    st, _, body = http_get(url)
    if st != 200:
        raise ValueError(f"la fuente respondió HTTP {st}")
    return json.loads(body.decode("utf-8"))


ADAPTADORES = {"json_normalizado": adaptador_json_normalizado}


# ---------- adaptador de la Dirección Nacional Electoral (API oficial, formato según su documentación v1.0.1) ----------
DINE_URL = "https://resultados.mininterior.gob.ar/api/resultados/getResultados"
DINE_FUENTE = {"nombre": "Dirección Nacional Electoral (recuento provisional)", "url": "https://resultados.mininterior.gob.ar/"}
MSJ_TOKEN = ("la API pide un token de acceso (JWT). Se pide a soportedine@mininterior.gob.ar y se guarda en el "
             "repositorio como secreto DINE_TOKEN (Settings > Secrets and variables > Actions)")


def _dine_pedir(params, token):
    url = DINE_URL + "?" + urlencode({k: v for k, v in params.items() if v is not None})
    if not permitido(url):
        raise PermissionError("el robots.txt de resultados.mininterior.gob.ar no permite leer esa dirección; no se accede")
    st, _, body = http_get(url, headers={"Authorization": "Bearer " + token} if token else None)
    if st in (401, 403):
        raise ValueError(f"HTTP {st}: {MSJ_TOKEN}")
    if st != 200:
        raise ValueError(f"la API respondió HTTP {st}")
    return json.loads(body.decode("utf-8"))


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _con_zona(s):
    """La documentación no aclara si la fecha trae zona horaria; si no la trae se asume hora de Argentina."""
    s = str(s or "")
    return s if (_fecha(s) is not None) or _fecha(s + "-03:00") is None else s + "-03:00"


def _base_porcentajes(pos, otros):
    """Averigua sobre qué total calcula la DINE sus porcentajes, comparando el de la lista más votada con los
    posibles totales. Devuelve (nombre_de_la_base, cantidad) o (None, None) si ninguno coincide."""
    vs = [(_num(a.get("votos")), _num(a.get("votosPorcentaje"))) for a in pos]
    vs = [(v, p) for v, p in vs if v is not None and p is not None]
    if not vs:
        return None, None
    sp = sum(v for v, _ in vs)
    bl, nu, re_ = (_num(otros.get(k)) or 0 for k in ("votosEnBlanco", "votosNulos", "votosRecurridosComandoImpugnados"))
    cand = [("votos positivos", sp), ("votos válidos", sp + bl), ("votos emitidos", sp + bl + nu + re_)]
    f = 1 if sum(p for _, p in vs) <= 1.5 else 100  # porcentajes expresados de 0 a 1 o de 0 a 100
    v, p = max(vs)
    if p <= 0 or v <= 0:
        return None, None
    implicito = v / (p / f)
    nombre, cant = min(cand, key=lambda c: abs(c[1] - implicito))
    return (nombre, int(cant)) if abs(cant - implicito) <= 0.003 * implicito else (None, None)


def convertir_dine(r, cfg_cat):
    pos = r.get("valoresTotalizadosPositivos") or []
    otros = r.get("valoresTotalizadosOtros")
    otros = (otros[0] if otros else {}) if isinstance(otros, list) else (otros or {})
    cat = {"id": str(cfg_cat["id"]), "nombre": cfg_cat.get("nombre") or f"Categoría {cfg_cat['id']}",
           "distrito": cfg_cat.get("distrito_nombre", ""),
           "listas": [{"nombre": a.get("nombreAgrupacion") or "(sin nombre)", "partido": "", "votos": a.get("votos")} for a in pos]}
    er = r.get("estadoRecuento") or {}
    if er.get("mesasTotalizadas") is not None and er.get("mesasEsperadas") is not None:
        cat["mesas"] = {"escrutadas": er["mesasTotalizadas"], "total": er["mesasEsperadas"]}
    base, cant = _base_porcentajes(pos, otros)
    if base:
        cat["votos_validos"], cat["base_nombre"] = cant, base
    for k_out, k_in in (("en_blanco", "votosEnBlanco"), ("nulos", "votosNulos")):
        if otros.get(k_in) is not None:
            cat[k_out] = otros[k_in]
    return cat


def _avance(er):
    esc_, tot = _num(er.get("mesasTotalizadas")), _num(er.get("mesasEsperadas"))
    return esc_ / tot if esc_ is not None and tot else 1.0


def _controles(nombre, er):
    """Compara lo que informa la API con lo que se calcula a partir de sus propios números."""
    av = []
    esc_, tot = _num(er.get("mesasTotalizadas")), _num(er.get("mesasEsperadas"))
    rep = _num(er.get("mesasTotalizadasPorcentaje"))
    if rep is not None and tot and esc_ is not None:
        calc = esc_ / tot * 100
        if rep <= 1 < calc:
            rep *= 100  # vino de 0 a 1
        if abs(rep - calc) > 0.5:
            av.append(f"{nombre}: la API informa {rep:.1f}% de mesas pero {int(esc_)} de {int(tot)} es {calc:.1f}%")
    vot, ele, rp = _num(er.get("cantidadVotantes")), _num(er.get("cantidadElectores")), _num(er.get("participacionPorcentaje"))
    if rp is not None and vot is not None and ele:
        calc = vot / ele * 100
        if rp <= 1 < calc:
            rp *= 100
        if abs(rp - calc) > 1:
            av.append(f"{nombre}: la participación informada ({rp:.1f}%) no coincide con votantes sobre electores ({calc:.1f}%)")
    return av


def adaptador_dine_api(fuente, e):
    cats = fuente.get("categorias") or []
    if not cats:
        raise ValueError("falta la lista 'categorias' en fuente_resultados")
    token = os.environ.get(fuente.get("token_env") or "DINE_TOKEN", "")
    base = {"anioEleccion": fuente.get("anio"), "tipoRecuento": fuente.get("tipo_recuento", 1), "tipoEleccion": fuente.get("tipo_eleccion")}
    out_cats, fechas, ers, avisos = [], [], [], []
    for c in cats:
        r = _dine_pedir(dict(base, categoriaId=c["id"], distritoId=c.get("distritoId"), seccionId=c.get("seccionId")), token)
        cat = convertir_dine(r, c)
        out_cats.append(cat)
        er = r.get("estadoRecuento") or {}
        ers.append(er)
        avisos += _controles(cat["nombre"], er)
        if r.get("fechaTotalizacion"):
            fechas.append(_con_zona(r["fechaTotalizacion"]))
        time.sleep(0.3)
    er = min(ers, key=_avance)  # el avance que se muestra es el de la categoría menos avanzada: nunca sobrestima
    vot, ele = _num(er.get("cantidadVotantes")), _num(er.get("cantidadElectores"))
    res = {"eleccion_id": e["id"], "tipo": fuente.get("tipo", "provisorio"), "fuente": DINE_FUENTE,
           "mesas": {"escrutadas": er.get("mesasTotalizadas"), "total": er.get("mesasEsperadas")}, "categorias": out_cats}
    validas = [x for x in fechas if _fecha(x)]
    if validas:
        res["actualizado"] = max(validas, key=_fecha)
    if vot is not None and ele and ele > 0:
        res["participacion_pct"] = round(vot / ele * 100, 2)
        res["electores"], res["votantes"] = er.get("cantidadElectores"), er.get("cantidadVotantes")
    if avisos:
        res["avisos"] = avisos
    return res


# ---------- simulacro: un conteo inventado que avanza con el tiempo ----------
_SIM = {"t0": None}
SIM_FINAL = [("Lista Simulada A", 0.43), ("Lista Simulada B", 0.34), ("Lista Simulada C", 0.15), ("Lista Simulada D", 0.08)]


def adaptador_simulacro(fuente, e):
    """Devuelve el conteo de una elección inventada, según cuánto pasó desde la primera consulta. La lista A arranca con
    ventaja amplia y la va reduciendo (como cuando entran primero las mesas de una zona), pero nunca pierde el primer puesto."""
    dur = max(3.0, float(fuente.get("duracion_min") or 12))
    total = int(fuente.get("mesas") or 1000)
    if _SIM["t0"] is None:
        _SIM["t0"] = time.monotonic()
    p = min(1.0, (time.monotonic() - _SIM["t0"]) / (dur * 60))
    p = 0.05 + 0.95 * (p * p * (3 - 2 * p))  # arranca en 5% (una categoría sin votos no es válida) y siempre avanza
    esc_ = max(1, int(round(total * p)))
    electores = esc_ * 320
    votantes = int(electores * 0.72)
    blancos, nulos = int(votantes * 0.02), int(votantes * 0.01)
    positivos = votantes - blancos - nulos
    ventaja = 1 - p  # 1 al principio, 0 al final
    shares = [SIM_FINAL[0][1] + 0.07 * ventaja, SIM_FINAL[1][1] - 0.05 * ventaja, SIM_FINAL[2][1] - 0.01 * ventaja, SIM_FINAL[3][1] - 0.01 * ventaja]
    listas, resto = [], positivos
    for (nombre, _), sh in zip(SIM_FINAL[:-1], shares[:-1]):
        v = int(round(positivos * sh))
        listas.append({"nombre": nombre, "partido": "", "votos": v})
        resto -= v
    listas.append({"nombre": SIM_FINAL[-1][0], "partido": "", "votos": resto})
    ahora_ = ahora().astimezone(timezone.utc)
    return {"eleccion_id": e["id"], "actualizado": ahora_.strftime("%Y-%m-%dT%H:%M:%SZ"), "tipo": "provisorio",
            "fuente": {"nombre": "SIMULACRO: datos inventados por el sistema", "url": "https://github.com/nexxusconsultora-lab/salta-monitor"},
            "mesas": {"escrutadas": esc_, "total": total}, "participacion_pct": 72.0, "electores": electores, "votantes": votantes,
            "categorias": [{"id": "simulacro", "nombre": "Gobernador (simulacro)", "distrito": e.get("distrito", ""), "votos_validos": positivos + blancos,
                            "base_nombre": "votos válidos", "en_blanco": blancos, "nulos": nulos, "listas": listas,
                            "mesas": {"escrutadas": esc_, "total": total}}]}


ADAPTADORES["simulacro"] = adaptador_simulacro
ADAPTADORES["dine_api"] = adaptador_dine_api


def pedir_datos(e):
    fuente = e.get("fuente_resultados") or {}
    nombre = fuente.get("adaptador")
    if not nombre:
        raise SinAdaptador("esta elección no tiene 'adaptador' en fuente_resultados (todavía no se escribió el lector de esa fuente)")
    if nombre not in ADAPTADORES:
        raise SinAdaptador(f"el adaptador «{nombre}» no existe")
    return ADAPTADORES[nombre](fuente, e)


# ---------- validación ----------
def _fecha(s):
    try:
        t = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return t if t.tzinfo else None  # sin zona horaria no sirve: no se sabe a qué hora corresponde
    except (ValueError, TypeError):
        return None


def _entero(v):
    if isinstance(v, bool):
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return int(n) if n >= 0 and n == int(n) else None


def validar(j, e, previo, t_ahora):
    """Devuelve (problemas, resultado_limpio). Si hay problemas, NO se escribe."""
    if not isinstance(j, dict):
        return ["la fuente no devolvió un objeto JSON"], None
    p = []
    out = {"eleccion_id": j.get("eleccion_id") or e["id"]}
    if out["eleccion_id"] != e["id"]:
        p.append(f"el dato es de otra elección ({out['eleccion_id']})")
    t = _fecha(j.get("actualizado"))
    if t is None:
        p.append("'actualizado' falta, es inválido o no trae zona horaria")
    elif t > t_ahora + timedelta(minutes=10):
        p.append("'actualizado' está en el futuro")
    out["actualizado"] = j.get("actualizado")
    out["tipo"] = j.get("tipo")
    if out["tipo"] not in ("provisorio", "definitivo"):
        p.append("'tipo' debe ser provisorio o definitivo")
    if isinstance(j.get("fuente"), dict):
        out["fuente"] = {"nombre": str(j["fuente"].get("nombre", ""))[:200], "url": str(j["fuente"].get("url", ""))[:500]}
    m = j.get("mesas") or {}
    esc_, tot = _entero(m.get("escrutadas")), _entero(m.get("total"))
    if esc_ is None or not tot or esc_ > tot:
        p.append(f"mesas inconsistentes ({m.get('escrutadas')} de {m.get('total')})")
    else:
        out["mesas"] = {"escrutadas": esc_, "total": tot}
    pp = j.get("participacion_pct")
    if pp is not None:
        try:
            if 0 <= float(pp) <= 100:
                out["participacion_pct"] = float(pp)
            else:
                p.append("participacion_pct fuera de 0–100")
        except (TypeError, ValueError):
            p.append("participacion_pct inválida")
    for k in ("electores", "votantes"):
        if j.get(k) is not None:
            n = _entero(j[k])
            if n is None:
                p.append(f"'{k}' inválido")
            else:
                out[k] = n
    if isinstance(j.get("avisos"), list):
        out["avisos"] = [str(x)[:220] for x in j["avisos"][:6]]
    cats = j.get("categorias")
    if not isinstance(cats, list) or not cats:
        p.append("no trae categorías")
        cats = []
    out["categorias"] = []
    for c in cats:
        nom = (c or {}).get("nombre", "?")
        ls, suma = [], 0
        for l in (c or {}).get("listas") or []:
            v = _entero((l or {}).get("votos"))
            if v is None:
                p.append(f"{nom}: votos inválidos en la lista «{(l or {}).get('nombre')}»")
                continue
            suma += v
            ls.append({"nombre": str(l.get("nombre", ""))[:200], "partido": str(l.get("partido", ""))[:200], "votos": v})
        if not ls:
            p.append(f"{nom}: sin listas")
        cc = {"id": c.get("id", ""), "nombre": str(nom)[:200], "distrito": str(c.get("distrito", ""))[:200], "listas": ls}
        for k in ("en_blanco", "nulos"):
            if c.get(k) is not None:
                n = _entero(c[k])
                if n is None:
                    p.append(f"{nom}: '{k}' inválido")
                else:
                    cc[k] = n
        if c.get("base_nombre") in ("votos positivos", "votos válidos", "votos emitidos"):
            cc["base_nombre"] = c["base_nombre"]
        mc = c.get("mesas")
        if isinstance(mc, dict):
            e1, t1 = _entero(mc.get("escrutadas")), _entero(mc.get("total"))
            if e1 is None or not t1 or e1 > t1:
                p.append(f"{nom}: mesas de la categoría inconsistentes")
            else:
                cc["mesas"] = {"escrutadas": e1, "total": t1}
        if c.get("votos_validos") is not None:
            vv = _entero(c["votos_validos"])
            if not vv:
                p.append(f"{nom}: votos_validos inválido")
            elif suma > vv:
                p.append(f"{nom}: las listas suman {suma}, más que los votos válidos ({vv})")
            else:
                cc["votos_validos"] = vv
        out["categorias"].append(cc)
    # el conteo no puede volver atrás
    if previo and previo.get("eleccion_id") == e["id"] and not p:
        tp = _fecha(previo.get("actualizado"))
        if tp and t and t < tp:
            p.append("los datos son más viejos que los ya guardados")
        pm = (previo.get("mesas") or {}).get("escrutadas")
        if isinstance(pm, int) and esc_ is not None and esc_ < pm and out["tipo"] != "definitivo":
            p.append(f"el conteo retrocedió (de {pm} a {esc_} mesas)")
    return p, (None if p else out)


# ---------- recolección ----------
def _leer(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _igual(a, b):
    f = lambda x: {k: v for k, v in (x or {}).items() if k != "recolectado"}
    return f(a) == f(b)


def _historial(e, limpio, destino):
    """Va guardando una muestra por cada dato nuevo, para poder mostrar el ritmo del conteo y cómo evoluciona la diferencia."""
    ruta = destino[:-5] + "_historial.json"
    h = _leer(ruta)
    if not isinstance(h, dict) or h.get("eleccion_id") != e["id"] or not isinstance(h.get("muestras"), list):
        h = {"eleccion_id": e["id"], "muestras": []}
    m = limpio["mesas"]
    ult = h["muestras"][-1] if h["muestras"] else None
    if ult and ult.get("t") == limpio["actualizado"] and ult.get("m") == m["escrutadas"]:
        return
    cs = []
    for c in limpio["categorias"]:
        ls = sorted(c["listas"], key=lambda l: -l["votos"])
        cs.append({"id": c.get("id", ""), "b": c.get("votos_validos") or sum(l["votos"] for l in ls),
                   "v": [[l["nombre"][:40], l["votos"]] for l in ls[:5]]})
    h["muestras"].append({"t": limpio["actualizado"], "m": m["escrutadas"], "n": m["total"], "c": cs})
    h["muestras"] = h["muestras"][-500:]
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(h, f, ensure_ascii=False, separators=(",", ":"))


def _pasada():
    """Una vuelta completa. Devuelve qué pasó, para que el modo bucle decida cuándo seguir."""
    r = {"rc": 0, "activas": False, "esperando": None, "cambios": False, "completo": False, "intervalo": 60, "error": "", "resumen": ""}
    cfg = _leer(CFG)
    if not cfg or not isinstance(cfg.get("elecciones"), list):
        log("ERROR: no se pudo leer data/elecciones.json o no tiene la lista «elecciones».")
        r["rc"] = 1
        return r
    t = ahora()
    hoy = t.astimezone(AR).strftime("%Y-%m-%d")
    activas = [(e, estado(e, hoy)) for e in cfg["elecciones"] if e and e.get("id")]
    activas = [(e, st) for e, st in activas if st in ("jornada", "post")]
    if not activas:
        log(f"{hoy}: no hay elecciones en jornada ni en los días posteriores. No hay nada que recolectar.")
        return r
    r["activas"] = True
    completos = []
    for e, st in activas:
        log(f"— {e['id']} ({st})")
        try:
            r["intervalo"] = min(r["intervalo"], max(30, int(e.get("intervalo_seg") or 60)))
        except (TypeError, ValueError):
            pass
        lim = embargo(e, st, t)
        if lim:
            log(f"  Antes de la hora de publicación ({lim.astimezone(AR):%H:%M} de Argentina): no se pide ni se guarda nada.")
            if r["esperando"] is None or lim < r["esperando"]:
                r["esperando"] = lim
            continue
        ruta = e.get("resultados_url") or ""
        if not RUTA_OK.match(ruta):
            log(f"  ERROR: 'resultados_url' ({ruta!r}) debe ser un archivo de la carpeta data, por ejemplo data/elecciones_resultados.json.")
            r["rc"] = 1
            continue
        destino = os.path.join(RAIZ, ruta)
        try:
            crudo = pedir_datos(e)
        except SinAdaptador as x:
            log(f"  Sin lector: {x}.")
            continue
        except Exception as x:
            log(f"  ERROR al pedir los datos: {type(x).__name__}: {x}")
            r["rc"] = 1
            r["error"] = f"{type(x).__name__}: {x}"
            continue
        previo = _leer(destino)
        probs, limpio = validar(crudo, e, previo, t)
        if probs:
            log("  Los datos recibidos NO se guardaron. Motivos:")
            for p in probs:
                log("   -", p)
            r["rc"] = 1
            r["error"] = "datos rechazados por la validación: " + "; ".join(probs[:2])
            continue
        for a in limpio.get("avisos", []):
            log("  AVISO:", a)
        m = limpio["mesas"]
        completos.append(m["escrutadas"] == m["total"])
        if _igual(limpio, previo):
            log("  Sin cambios respecto de lo guardado.")
            continue
        limpio["recolectado"] = t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(destino, "w", encoding="utf-8") as f:
            json.dump(limpio, f, ensure_ascii=False, indent=1)
        _historial(e, limpio, destino)
        r["cambios"] = True
        r["resumen"] = f"{m['escrutadas']} de {m['total']} mesas escrutadas"
        log(f"  Guardado en {ruta}: {m['escrutadas']} de {m['total']} mesas.")
    r["completo"] = bool(completos) and all(completos)
    return r


def recolectar():
    return _pasada()["rc"]


def alertar(titulo, texto):
    """Aviso al celular (usa scripts/avisar_falla.py y los secretos de siempre). Nunca rompe la recolección."""
    try:
        if AQUI not in sys.path:
            sys.path.insert(0, AQUI)
        import avisar_falla
        avisar_falla.enviar(titulo, texto, os.environ.get("ENLACE_CORRIDA") or None)
    except Exception as x:
        log(f"  (no se pudo mandar el aviso: {type(x).__name__})")


def guardar_git():
    """Sube los resultados al repositorio (solo si NEWAR_GIT=1, o sea, dentro del workflow)."""
    if os.environ.get("NEWAR_GIT") != "1":
        return True
    def g(*a):
        return subprocess.run(["git", *a], cwd=RAIZ, capture_output=True, text=True)
    g("config", "user.name", "radar-politico-bot")
    g("config", "user.email", "radar-politico-bot@users.noreply.github.com")
    g("add", "--", "data/elecciones_resultados*.json")
    if g("diff", "--cached", "--quiet").returncode == 0:
        return True
    g("commit", "-m", "Actualización automática de resultados electorales")
    rama = g("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() or "main"
    for intento in (1, 2, 3):
        if g("pull", "--rebase", "-X", "theirs", "origin", rama).returncode == 0 and g("push", "origin", rama).returncode == 0:
            return True
        g("rebase", "--abort")
        time.sleep(3)
    log("  AVISO: no se pudo subir al repositorio tras 3 intentos; se reintenta en la próxima vuelta.")
    return False


ERRORES_PARA_AVISAR, MINUTOS_SIN_DATOS, SEPARACION_AVISOS = 5, 20, 30 * 60


def bucle(minutos, quietos_max=10):
    """Repite la recolección cada ~60 segundos durante 'minutos', subiendo cada dato nuevo apenas llega.
    Avisa al celular: cuando llega el primer dato, tras 5 fallas seguidas y si pasan 20 minutos sin datos nuevos."""
    fin = time.monotonic() + minutos * 60
    quietos, exito, errores, hubo_dato = 0, False, 0, False
    desde_publicacion = ultimo_cambio = None
    ultimo_aviso = {"errores": None, "quieto": None}

    def puede(clave, ahora_m):
        a = ultimo_aviso[clave]
        return a is None or ahora_m - a >= SEPARACION_AVISOS

    while True:
        r = _pasada()
        m = time.monotonic()
        exito = exito or (r["rc"] == 0 and r["activas"])
        quietos = 0 if r["cambios"] else quietos + 1
        errores = errores + 1 if (r["rc"] != 0 and r["activas"]) else 0
        if r["activas"] and not r["esperando"] and desde_publicacion is None:
            desde_publicacion = m
        if r["cambios"]:
            ultimo_cambio = m
            if not hubo_dato:
                hubo_dato = True
                alertar("Empezó a llegar el conteo", "Primer dato oficial guardado: " + (r.get("resumen") or "ver el sitio") + ". El seguimiento está funcionando.")
        if errores >= ERRORES_PARA_AVISAR and puede("errores", m):
            ultimo_aviso["errores"] = m
            alertar("El recolector no logra leer los resultados", f"{errores} intentos seguidos con error. Último: {r.get('error') or 'ver el registro'}. Revisá la fuente oficial.")
        ref = ultimo_cambio if hubo_dato else desde_publicacion
        if (ref is not None and r["activas"] and not r["esperando"] and not r["completo"] and r["rc"] == 0
                and m - ref >= MINUTOS_SIN_DATOS * 60 and puede("quieto", m)):
            ultimo_aviso["quieto"] = m
            alertar("Sin datos nuevos hace %d minutos" % ((m - ref) // 60),
                    ("La fuente oficial no publicó novedades." if hubo_dato else "Pasó la hora de publicación y todavía no hay resultados.")
                    + " Puede ser normal o un problema: mirá el sitio oficial.")
        if r["cambios"] or quietos == 1:
            guardar_git()
        if not r["activas"]:
            log("No hay nada más que recolectar: termina el ciclo.")
            return 0
        if r["completo"] and quietos >= quietos_max:
            log(f"Conteo completo y sin novedades en {quietos_max} consultas seguidas: termina el ciclo.")
            break
        espera = r["intervalo"]
        if r["esperando"]:
            espera = max(1, min(60, (r["esperando"] - ahora()).total_seconds()))
        if time.monotonic() + espera >= fin:
            log("Se cumplió el tiempo previsto del ciclo.")
            break
        time.sleep(espera)
    guardar_git()
    return 0 if exito else 1


SIM_CFG = "data/elecciones_simulacro.json"


def _reiniciar_simulacro(ruta_cfg):
    """Borra los resultados de un simulacro anterior (si no, el nuevo arranque parecería un 'retroceso' y se rechazaría).
    Salvaguarda: solo toca elecciones marcadas como simulacro, con lector 'simulacro', y jamás el archivo de la elección real."""
    cfg = _leer(ruta_cfg) or {}
    for e in cfg.get("elecciones") or []:
        r = (e or {}).get("resultados_url") or ""
        if (e or {}).get("simulacro") is True and ((e.get("fuente_resultados") or {}).get("adaptador") == "simulacro") \
                and RUTA_OK.match(r) and r != "data/elecciones_resultados.json":
            for rel in (r, r[:-5] + "_historial.json"):
                try:
                    os.remove(os.path.join(RAIZ, rel))
                except OSError:
                    pass


def simulacro(minutos):
    """Ensayo general: corre el ciclo de la noche de elecciones, pero con la elección inventada del archivo de simulacro."""
    global CFG
    ruta = os.path.join(RAIZ, SIM_CFG)
    if not os.path.exists(ruta):
        log(f"ERROR: falta {SIM_CFG}. Subilo a la carpeta data y volvé a intentar.")
        return 1
    CFG = ruta
    _SIM["t0"] = None
    _reiniciar_simulacro(ruta)
    log(f"SIMULACRO de {minutos} minutos: elección inventada, no se toca ninguna elección real.")
    rc = bucle(minutos, quietos_max=2)
    alertar("Terminó el simulacro de elección", "El ensayo general terminó. Abrí el sitio en Elecciones > simulacro para ver el recorrido completo.")
    return rc


# ---------- diagnóstico ----------
PAT_DIRS = re.compile(r"""["'`]((?:https?:)?//[^"'`\s]+|/[A-Za-z0-9_\-./]*(?:api|json|resultados)[A-Za-z0-9_\-./?=&%]*)["'`]""", re.I)


def _tipo_json(v, prof=0):
    if isinstance(v, dict):
        return {k: (_tipo_json(x, prof + 1) if prof < 2 else type(x).__name__) for k, x in list(v.items())[:25]}
    if isinstance(v, list):
        return [f"lista de {len(v)}", _tipo_json(v[0], prof + 1) if v and prof < 2 else None]
    return type(v).__name__


def diagnosticar():
    res = {"generado": ahora().astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "sitios": []}
    for url in DIAG_URLS:
        s = {"url": url}
        res["sitios"].append(s)
        try:
            if not permitido(url):
                s["resultado"] = "no se accede: el robots.txt lo prohíbe, o no se pudo confirmar (error de red o del servidor)"
                log(f"{url}: {s['resultado']}")
                continue
            st, ct, body = http_get(url)
            s.update(http=st, tipo=ct, bytes=len(body))
            txt = body.decode("utf-8", "replace")
            s["inicio"] = re.sub(r"\s+", " ", txt[:400])
            log(f"{url}: HTTP {st}, {ct}, {len(body)} bytes")
            if "json" in ct.lower():
                try:
                    s["estructura_json"] = _tipo_json(json.loads(txt))
                except ValueError:
                    pass
            scripts = [urljoin(url, m) for m in re.findall(r"<script[^>]+src=[\"']([^\"']+)", txt, re.I)]
            s["scripts"] = scripts[:15]
            dirs = set(m for m in PAT_DIRS.findall(txt))
            propios = [u for u in scripts if urlparse(u).netloc == urlparse(url).netloc][:3]
            for sc in propios:  # los datos de una página moderna suelen estar nombrados dentro de sus scripts
                if permitido(sc):
                    st2, _, b2 = http_get(sc, 4_000_000)
                    if st2 == 200:
                        dirs |= set(PAT_DIRS.findall(b2.decode("utf-8", "replace")))
            s["direcciones_que_parecen_datos"] = sorted(d for d in dirs if len(d) < 220)[:60]
            for d in s["direcciones_que_parecen_datos"][:8]:
                log("   posible dato:", d)
        except Exception as x:
            s["error"] = f"{type(x).__name__}: {x}"
            log(f"{url}: ERROR {s['error']}")
    with open(DIAG, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    log("Diagnóstico guardado en data/elecciones_diagnostico.json")
    return 0


# ---------- sonda de la API de la DINE (para descubrir códigos de categoría y de distrito) ----------
def probar_dine():
    """Consulta la API con una elección ya terminada (generales 2023) para ver si pide token y cómo se llaman los distritos."""
    token = os.environ.get("DINE_TOKEN", "")
    res = {"generado": ahora().astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "con_token": bool(token), "distritos": [], "categorias": []}
    base = {"anioEleccion": 2023, "tipoRecuento": 1, "tipoEleccion": 2}

    def resumen(r):
        er = r.get("estadoRecuento") or {}
        pos = r.get("valoresTotalizadosPositivos") or []
        return {"fecha": r.get("fechaTotalizacion"), "mesasEsperadas": er.get("mesasEsperadas"), "electores": er.get("cantidadElectores"),
                "votantes": er.get("cantidadVotantes"), "primeras": [(a.get("nombreAgrupacion"), a.get("votos"), a.get("votosPorcentaje")) for a in pos[:3]],
                "otros": r.get("valoresTotalizadosOtros")}

    def barrido(clave, lista, armar):
        for n in lista:
            item = {"id": n}
            try:
                item.update(resumen(_dine_pedir(armar(n), token)))
            except Exception as x:
                item["error"] = f"{type(x).__name__}: {x}"
            res[clave].append(item)
            log(f"{clave} {n}:", item.get("error") or item.get("primeras"))
            if item.get("error") and n == lista[0]:
                return False  # si la primera consulta falla (token, bloqueo) no se insiste
            time.sleep(0.4)
        return True
    if barrido("distritos", range(1, 25), lambda d: dict(base, categoriaId=1, distritoId=d)):
        barrido("categorias", range(1, 13), lambda c: dict(base, categoriaId=c))
    with open(os.path.join(RAIZ, "data", "elecciones_diagnostico_dine.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    log("Guardado en data/elecciones_diagnostico_dine.json")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--diagnosticar", action="store_true", help="visita las páginas oficiales y guarda qué responden")
    ap.add_argument("--bucle", type=int, metavar="MINUTOS", help="recolecta cada ~60 segundos durante esos minutos y sube cada dato nuevo")
    ap.add_argument("--simulacro", type=int, metavar="MINUTOS", help="ensayo general con una elección inventada, durante esos minutos")
    ap.add_argument("--probar-dine", action="store_true", help="consulta la API de la DINE con la elección de 2023 para ver códigos y acceso")
    a = ap.parse_args()
    sys.exit(simulacro(a.simulacro) if a.simulacro else bucle(a.bucle) if a.bucle else probar_dine() if a.probar_dine else diagnosticar() if a.diagnosticar else recolectar())
