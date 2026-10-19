#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Manda el resumen de AYER (política + seguridad) a tu celular. Solo a vos.

Canales (se usa el que tengas configurado, o los dos). Todo dato de entrega va en «Secrets» de GitHub:
  ntfy      NTFY_TOPIC   (obligatorio para ntfy: un tema largo y aleatorio, de 16 a 64 letras/números/_/-)
            NTFY_SERVER  (opcional; por defecto https://ntfy.sh)
            NTFY_TOKEN   (opcional; solo si tu servidor ntfy pide login)
  Telegram  TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (los dos)

Qué hace
  - Lee data/resumenes/AAAA-MM-DD.json del día de ayer (hora de Argentina) y arma un texto corto:
    las historias más cubiertas de política y de seguridad (Provincia de Salta / resto del país),
    con los medios que dice cada una. No manda el texto de las notas: solo titulares y nombres de medios.
  - No repite: anota en data/resumenes/notificado.json qué día ya se avisó por cada canal.
  - Exige HTTPS (salvo localhost para pruebas) y un tema de ntfy largo, para que nadie adivine tu canal.
  - Reintenta 3 veces ante errores de red o del servidor. Si no puede enviar, FALLA (el workflow se pone
    en rojo y GitHub te avisa por mail): un resumen que no llegó nunca pasa en silencio.

Uso (desde la raíz del repo)
    python scripts/notificar.py               # ayer, si todavía no se avisó
    python scripts/notificar.py --forzar      # ayer, aunque ya se haya avisado
    python scripts/notificar.py --fecha 2026-10-10 --forzar
    python scripts/notificar.py --simular     # muestra el texto en pantalla sin enviar nada
"""
import argparse
import html as _html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

AQUI = os.path.dirname(os.path.abspath(__file__))
RESUMENES = os.path.join(AQUI, "..", "data", "resumenes")
REGISTRO = os.path.join(RESUMENES, "notificado.json")
SITIO = "https://nexxusconsultora-lab.github.io/salta-monitor/"
AR = timezone(timedelta(hours=-3))
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

MAX_POLITICA = 8
MAX_SEG_SALTA = 6
MAX_SEG_PAIS = 4
# Telegram admite mensajes más largos y con formato: se manda más y mejor ordenado
TG_POLITICA = 18
TG_SEG_SALTA = 10
TG_SEG_PAIS = 6
TG_POR_TEMA = 4
MAX_MEDIOS = 6
MAX_TITULO = 400                # los titulares van enteros (los más largos de origen miden ~200)
MAX_BYTES_PARTE = 3500          # ntfy corta en 4096 bytes y Telegram en 4096 caracteres
INTENTOS = 3
ESPERA_BASE = float(os.environ.get("NOTIFICAR_ESPERA", "3"))   # segundos; los tests la bajan
HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1"}


class ErrorEnvio(Exception):
    pass


# ----------------------------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------------------------
def limpiar(s, tope=MAX_TITULO):
    s = re.sub(r"[\x00-\x1f\x7f]+", " ", str(s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= tope else s[:tope - 1].rstrip() + "…"


def ocultar(texto, secretos):
    """Saca de cualquier mensaje de error los valores secretos."""
    texto = str(texto)
    for v in secretos:
        if v and len(v) >= 4:
            texto = texto.replace(v, "***")
    return texto


def url_valida(url, nombre):
    p = urlparse(url)
    if p.scheme == "https" and p.hostname:
        return url.rstrip("/")
    if p.scheme == "http" and p.hostname in HOSTS_LOCALES:
        return url.rstrip("/")
    raise ErrorEnvio(f"{nombre} tiene que empezar con https:// (se recibió «{p.scheme or 'nada'}://»). "
                     f"Solo se acepta http:// para pruebas en localhost.")


def leer_json(ruta, defecto):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def guardar_registro(reg):
    os.makedirs(RESUMENES, exist_ok=True)
    tmp = REGISTRO + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, REGISTRO)


def ahora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ----------------------------------------------------------------------------------------------
# Armado del texto
# ----------------------------------------------------------------------------------------------
def ordenar(historias):
    return sorted(historias or [], key=lambda h: (-len(h.get("medios") or []), -int(h.get("n_notas") or 0)))


def bloque(historias, tope):
    lineas = []
    for i, h in enumerate(ordenar(historias)[:tope], 1):
        medios = [limpiar(m, 40) for m in (h.get("medios") or []) if m]
        extra = f" y {len(medios) - MAX_MEDIOS} más" if len(medios) > MAX_MEDIOS else ""
        marca = " (sigue de ayer)" if h.get("sigue_de_ayer") else ""
        lineas.append(f"{i}. {limpiar(h.get('titulo'))}{marca}")
        if medios:
            lineas.append(f"   Lo dicen: {', '.join(medios[:MAX_MEDIOS])}{extra}")
    return lineas


def armar_texto(dia, fecha):
    d = datetime.strptime(fecha, "%Y-%m-%d")
    cab = f"{DIAS[d.weekday()]} {d.strftime('%d/%m/%Y')}"
    seg = dia.get("seguridad") or {}
    hs = seg.get("historias") or []
    salta = [h for h in hs if h.get("alcance") == "Salta"]
    pais = [h for h in hs if h.get("alcance") != "Salta"]
    pol = dia.get("historias") or []

    out = [f"Política: {len(pol)} historias · Seguridad: {len(hs)} ({len(salta)} en la provincia de Salta)"]
    if dia.get("cobertura_baja"):
        out.append("Ojo: ese día se recolectaron pocas notas; el resumen puede estar incompleto.")
    out += ["", "POLÍTICA"] + (bloque(pol, MAX_POLITICA) or ["Sin historias."])
    out += ["", "SEGURIDAD · PROVINCIA DE SALTA"] + (bloque(salta, MAX_SEG_SALTA) or ["Sin historias."])
    out += ["", "SEGURIDAD · RESTO DEL PAÍS"] + (bloque(pais, MAX_SEG_PAIS) or ["Sin historias."])
    out += ["", "Es una estimación por titulares (sin IA). Todo el detalle y los enlaces:", f"{SITIO}#/diario"]
    return f"Resumen de ayer · {cab}", "\n".join(out)


def _e(x):
    return _html.escape(str(x or ""), quote=False)


def _link(h):
    for l in (h.get("links") or []):
        u = str(l.get("link") or "")
        if u.startswith(("http://", "https://")):
            return u
    return ""


def _item_html(h, n=None):
    t = limpiar(h.get("titulo"), MAX_TITULO)
    u = _link(h)
    titulo = f'<a href="{_html.escape(u, quote=True)}">{_e(t)}</a>' if u else _e(t)
    medios = [limpiar(m, 30) for m in (h.get("medios") or []) if m]
    quien = (f"{len(medios)} medios: " + ", ".join(medios[:4]) + ("…" if len(medios) > 4 else "")) if len(medios) > 1 \
        else (medios[0] if medios else "")
    marca = " 🔁" if h.get("sigue_de_ayer") else ""
    pre = f"{n}. " if n else "• "
    return [f"{pre}{titulo}{marca}", f"    <i>{_e(quien)}</i>" if quien else ""]


# Emoji de cada área (los nombres salen de resumen_diario.py; un área nueva usa 📌)
EMOJI_AREA = {
    "Política y gobierno": "🏛️", "Economía y finanzas": "💰", "Policiales y seguridad": "🚨",
    "Justicia": "⚖️", "Salud": "🩺", "Educación y universidades": "🎓", "Minería y energía": "⛏️",
    "Agro y producción": "🌾", "Turismo": "🧳", "Transporte e infraestructura": "🚌",
    "Trabajo y gremios": "👷", "Clima y ambiente": "🌦️", "Accidentes y emergencias": "🚑",
    "Sociedad y género": "👥", "Ciencia y tecnología": "🔬", "Internacional": "🌎",
    "Deportes": "⚽", "Espectáculos y cultura": "🎭", "Otros temas": "📌",
}
# Áreas que no entran en «Lo más importante» ni se muestran antes que las demás
# (la prioridad es lo que pasa en la Argentina: lo del exterior va al final, en «Por área»)
AREAS_SUAVES = {"Deportes", "Espectáculos y cultura", "Internacional", "Otros temas"}
# «alcance = Salta» solo dice que la publicaron medios salteños (también publican Boca, River, famosos y política nacional).
# Para «En Salta» se usa: el título nombra un lugar de Salta, o la publican solo medios de Salta y es un tema de servicio local.
TEMAS_LOCALES = {"Policiales y seguridad", "Accidentes y emergencias", "Clima y ambiente", "Transporte e infraestructura", "Turismo",
                 "Educación y universidades", "Salud", "Minería y energía", "Agro y producción", "Sociedad y género"}


def es_salta(h):
    if h.get("lugar"):
        return True
    return h.get("alcance") == "Salta" and ("lugar" not in h or h.get("tema") in TEMAS_LOCALES)


# Ediciones del día (hora de Argentina). «desde» = minuto del día desde el que cuentan las notas como nuevas
# (media hora antes de la edición anterior, por si una corrida programada se demora).
EDICIONES = {
    "manana":   {"titulo": "🌅 Buen día · Resumen de ayer",            "dia": "ayer", "desde": None,           "hora": "09:00"},
    "mediodia": {"titulo": "☀️ Mediodía · Lo nuevo de la mañana",      "dia": "hoy",  "desde": 0,              "hora": "12:00"},
    "tarde":    {"titulo": "🌇 Tarde · Lo nuevo desde el mediodía",    "dia": "hoy",  "desde": 11 * 60 + 30,   "hora": "17:00"},
    "noche":    {"titulo": "🌙 Noche · Cierre del día",                "dia": "hoy",  "desde": 16 * 60 + 30,   "hora": "21:00"},
}
TG_TOP = 8            # historias en «Lo más importante»
TG_ECO = 10           # historias en «Economía y finanzas»
TG_SALTA = 8          # historias en «En Salta»
TG_MADRUGADA = 5      # historias en «Desde la medianoche» (solo edición de la mañana)
TG_X_AREA = 3         # historias por área (en las áreas más movidas)
TG_AREAS_GRANDES = 6  # cuántas áreas muestran TG_X_AREA historias; el resto muestra 1
TG_MAX_AREAS = 14     # no se muestran más áreas que estas (se omite «Otros temas»)
ATRASO_AVISO_H = 3    # si el resumen tiene más horas de atraso, el mensaje lo avisa
TG_TIT = 400          # largo máximo de cada titular: en la práctica, el titular completo (nunca «…»)
LINEA = "━━━━━━━━━━━━━━"
DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def plano(x):
    """Minúsculas y sin tildes, para comparar textos."""
    x = unicodedata.normalize("NFD", str(x or "").lower())
    return "".join(c for c in x if unicodedata.category(c) != "Mn")


# ---- qué NO se manda: relleno y gacetillas de prensa del gobierno provincial / municipal ----
RELLENO = re.compile(r"(quiniela|loteria|numeros ganadores|resultados? del (quini|loto|brinco)|horoscopo|efemerides|un dia como hoy|"
                     r"temas del dia|segui en vivo|sigue en vivo|minuto a minuto|donde ver|a que hora juega|ver online|frase del dia|santoral|"
                     r"contenido no encontrado|^ultimas noticias|^noticias de |clasificados|empleos y servicios)")
ACTOR_PROV = re.compile(r"(gobierno de salta|gobierno provincial|gobernador|saenz|municipalidad|intendente|ministerio de|ministro de|ministra de|"
                        r"secretaria de|secretario de|subsecretari|concejo deliberante|municipio)")
VERBO_PRENSA = re.compile(r"(inauguro|entrego|entregaron|firmo|firmaron|encabezo|recorrio|visito|participo|brindo|acompano|superviso|puso en marcha|"
                          r"pusieron en marcha|lanzo|lanzaron|capacitacion|capacitan|jornada|taller|reunion|agenda|habilito|dejo habilitad|continua|"
                          r"llevo adelante|llevaron adelante|realizo|realizaron|reconocimiento|homenaje|beneficia|fortalece|fortalecen|avanza la obra|"
                          r"avanzan las obras|operativo de|programa )")
NOTICIA_DURA = re.compile(r"(policia|detenid|murio|muerte|accidente|robo|denuncia|paro |incendio|violencia|femicid|hospital|crisis|recorte|"
                          r"despid|polemica|critic|rechaz|reclam|protesta|investig|imputad|procesad|aumento|suba)")
MEDIOS_SALTA = ("el tribuno", "informate salta", "que pasa salta", "el intransigente")


def es_relleno(h):
    return bool(RELLENO.search(plano(h.get("titulo"))))


def es_gacetilla(h):
    """Prensa del gobierno provincial o municipal publicada por medios de Salta («Sáenz inauguró…», «jornada de…»).
    Se detecta por el título y solo si NINGÚN medio de afuera de Salta la levantó. Las notas con conflicto, plata o policía se mantienen."""
    medios = h.get("medios") or []
    if not medios or not all(plano(m).startswith(MEDIOS_SALTA) for m in medios):
        return False
    t = plano(h.get("titulo"))
    return bool(ACTOR_PROV.search(t) and VERBO_PRENSA.search(t) and not NOTICIA_DURA.search(t))


# ---- economía y finanzas ----
FIN_FUERTE = re.compile(r"(dolar|\bbonos?\b|riesgo pais|reservas|bcra|banco central|inflacion|\btasas?\b|merval|acciones|cedear|plazo fijo|\bfmi\b|deuda|"
                        r"swap|cepo|brecha|retenciones|aranceles|superavit|deficit|recaudacion|\barca\b|afip|jubilaciones|aguinaldo|salarios?|paritari|"
                        r"presupuesto|emision|prestamos?|creditos?|hipotecari|bolsa|wall street|petroleo|brent|\bfed\b|tarifas|inversion|rigi|"
                        r"exportaciones|importaciones|\bpbi\b|actividad economica|desempleo|pobreza|canasta|morosidad|plata)")
FIN_MERCADOS = re.compile(r"(wall street|bolsa|brent|precio del petroleo|\bfed\b|dolar|bonos|tasas? de interes|riesgo pais|swap|mercados?)")


def n_fin(h):
    return len(FIN_FUERTE.findall(plano(h.get("titulo"))))


def es_finanzas(h):
    tema = h.get("tema")
    if tema in ("Deportes", "Espectáculos y cultura"):
        return False
    if tema == "Economía y finanzas":
        return True
    if tema == "Internacional":
        return bool(FIN_MERCADOS.search(plano(h.get("titulo"))))
    return n_fin(h) >= 2


# ---- horas y repetidas ----
def _min(hhmm):
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", str(hhmm or "").strip())
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


def hora_nota(h):
    """Minuto del día de la nota más reciente de la historia (None si no hay hora)."""
    hs = [x for x in (_min(l.get("hora")) for l in (h.get("links") or [])) if x is not None]
    return max(hs) if hs else _min(h.get("primera"))


def _hhmm(m):
    return f"{m // 60:02d}:{m % 60:02d}"


_STOP = {"para", "como", "sobre", "tras", "este", "esta", "entre", "desde", "hasta", "pero", "cuando", "donde", "porque", "ayer",
         "segun", "ante", "todo", "toda", "todos", "cada", "tiene", "tienen", "hace", "hacen", "sera", "fueron", "mientras"}


def firma(titulo):
    return frozenset(w for w in re.findall(r"[a-z0-9]{4,}", plano(titulo)) if w not in _STOP)


def parecida(a, b, comunes=frozenset()):
    """Dos titulares hablan de lo mismo si comparten bastantes palabras clave. Las palabras que aparecen en muchos titulares
    del día («argentina», «milei», el mes...) no cuentan, para no juntar notas distintas que solo se parecen en eso."""
    ra, rb = a - comunes, b - comunes
    if len(ra) < 3 or len(rb) < 3:
        return False
    i = len(ra & rb)
    return i >= 3 and i >= 0.4 * min(len(ra), len(rb))


def palabras_comunes(historias, limite=12):
    from collections import Counter
    c = Counter(w for h in historias for w in firma(h.get("titulo")))
    return frozenset(w for w, n in c.items() if n > limite)


SERVICIO = re.compile(r"(cuanto cobra|cuanto cobran|cuanto gana|cuando cobro|cuando cobran|fechas? de cobro|calendario de|paso a paso|"
                      r"como anotarse|quienes cobran|que dia cobro|es feriado|hay clases|cuanto cuesta|como saber)")


def rankear(historias):
    """Más importantes primero: cuántos medios la cubren, más medio punto si nombra figuras y medio si toca un ministerio;
    las notas de servicio («cuánto cobran», «cómo anotarse») valen un punto menos."""
    def clave(h):
        return (-(len(h.get("medios") or []) + 0.5 * bool(h.get("personas")) + 0.5 * bool(h.get("min_nac"))
                  - (1.0 if SERVICIO.search(plano(h.get("titulo"))) else 0.0)),
                -int(h.get("n_notas") or 0), -(hora_nota(h) or 0))
    return sorted(historias or [], key=clave)


# ---- cómo se ve cada historia ----
def _pie(h, n_max=3):
    medios = [limpiar(m, 28) for m in (h.get("medios") or []) if m]
    quien = ", ".join(medios[:n_max]) + (f" +{len(medios) - n_max}" if len(medios) > n_max else "")
    hh = hora_nota(h)
    return " · ".join(x for x in (quien, _hhmm(hh) if hh is not None else "") if x)


NUMEROS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]


def _num(i):
    return NUMEROS[i - 1] if 1 <= i <= len(NUMEROS) else f"{i}."


def _titular_html(h, marca=True, pie=True, n_max=3, destacar=False):
    """Titular COMPLETO con enlace a la nota, y debajo los medios y la hora. 📍 = pasó en Salta; 🔁 = sigue de ayer."""
    t = limpiar(h.get("titulo"), TG_TIT)
    u = _link(h)
    base = f'<a href="{_html.escape(u, quote=True)}">{_e(t)}</a>' if u else _e(t)
    if destacar:
        base = f"<b>{base}</b>"          # la historia más importante del mensaje se lee primero
    if marca and es_salta(h):
        base = "📍 " + base
    if h.get("sigue_de_ayer"):
        base += " 🔁"
    p = _pie(h, n_max) if pie else ""
    return base + (f"\n    <i>{_e(p)}</i>" if p else "")


def atraso_horas(doc):
    """Horas desde que se generó el resumen (None si no se sabe). Sirve para avisar si el monitor dejó de actualizar."""
    try:
        g = datetime.fromisoformat(str((doc or {}).get("generado")))
        return max(0.0, (datetime.now(AR) - g).total_seconds() / 3600)
    except (TypeError, ValueError):
        return None


def armar_html(dia, fecha, edicion="manana", hoy=None, enviados=(), atraso=None):
    """Mensaje de Telegram. Devuelve (título, texto, historias_de_hoy_mostradas).
    Orden: lo más importante → economía y finanzas → en Salta → por área. Los titulares van completos y se manda MÁS
    de un mensaje si hace falta (nunca se corta un titular). Cada ítem es un bloque («título» + línea de medios y hora).
    - edición «manana»: resumen de ayer + lo que pasó desde la medianoche (con `hoy`).
    - otras ediciones: solo lo nuevo desde la edición anterior y que no se haya mandado ya hoy (`enviados`)."""
    ed = EDICIONES.get(edicion) or EDICIONES["manana"]
    d = datetime.strptime(fecha, "%Y-%m-%d")
    cab = f"{DIAS_CORTOS[d.weekday()]} {d.strftime('%d/%m')}"

    def historias(doc):
        todos = (doc or {}).get("todos") or {}
        hs = todos.get("historias") or []
        if not hs:      # resúmenes viejos sin «todos»: se arma con política + seguridad
            hs = [dict(h, tema=h.get("tema") or "Política y gobierno") for h in ((doc or {}).get("historias") or [])] + \
                 [dict(h, tema="Policiales y seguridad") for h in (((doc or {}).get("seguridad") or {}).get("historias") or [])]
        return [h for h in hs if not es_relleno(h) and not es_gacetilla(h)]

    comunes = palabras_comunes(historias(dia) + (historias(hoy) if hoy else []))

    def nuevas(hs, desde=None, hasta=None):
        res = []
        for h in hs:
            m = hora_nota(h)
            if desde is not None and m is not None and m < desde:
                continue
            if hasta is not None and m is not None and m > hasta:
                continue
            f = firma(h.get("titulo"))
            if any(parecida(f, e, comunes) for e in enviados):
                continue
            res.append(h)
        return res

    base = nuevas(historias(dia), desde=ed["desde"])
    madrugada = rankear(nuevas(historias(hoy), hasta=9 * 60 + 15))[:TG_MADRUGADA] if (edicion == "manana" and hoy) else []
    tt = (dia.get("todos") or {}).get("totales") or {}
    t = dia.get("totales") or {}
    notas = tt.get("notas") or t.get("recolectadas") or 0

    titulo = f"<b>{ed['titulo']}</b> · {_e(cab)}"
    n_salta = len([h for h in base if es_salta(h)])
    cuenta = f"📊 <b>{len(base)}</b> historias" + (" nuevas" if ed["desde"] is not None else "") \
        + (f" de {notas} notas" if (notas and ed["desde"] is None) else "") + f" · 📍 {n_salta} en Salta"
    out = [titulo, cuenta]
    if atraso is not None and atraso > ATRASO_AVISO_H:
        out.append(f"⚠️ <i>Los datos tienen {atraso:.0f} h de atraso: puede que el monitor esté fallando (GitHub → Actions → Monitor de medios).</i>")
    if dia.get("cobertura_baja") and ed["desde"] is None:
        out.append("⚠️ <i>Se recolectaron pocas notas: el resumen puede estar incompleto.</i>")

    mostradas = []          # todo lo que sale en el mensaje
    firmas = []

    def ya(h):
        f = firma(h.get("titulo"))
        return any(parecida(f, e, comunes) for e in firmas)

    def tomar(h):
        mostradas.append(h)
        firmas.append(firma(h.get("titulo")))

    # 0) solo a la mañana: lo que pasó desde la medianoche
    if madrugada:
        out.extend(["", LINEA, "🌙 <b>DESDE LA MEDIANOCHE</b>"])
        for h in madrugada:
            tomar(h)
            out.append(f"• {EMOJI_AREA.get(h.get('tema'), '📌')} " + _titular_html(h))

    # 1) lo más importante (sin deportes, espectáculos ni exterior; la plata va en su propio bloque)
    top = []
    for h in rankear([h for h in base if h.get("tema") not in AREAS_SUAVES and not es_finanzas(h)]):
        if len(top) >= TG_TOP:
            break
        if not ya(h):
            top.append(h)
            tomar(h)
    out.extend(["", LINEA, "⚡ <b>LO MÁS IMPORTANTE</b>"])
    for i, h in enumerate(top, 1):
        out.append(f"{_num(i)} {EMOJI_AREA.get(h.get('tema'), '📌')} " + _titular_html(h, marca=True, destacar=(i == 1)))
    if not top:
        out.append("Sin historias nuevas." if ed["desde"] is not None else "Sin historias.")

    # 2) economía y finanzas: lo más cubierto y lo que más habla de plata
    eco = []
    for h in sorted([h for h in base if es_finanzas(h) and h not in top],
                    key=lambda h: (-(len(h.get("medios") or []) + 0.5 * min(n_fin(h), 3)), -(hora_nota(h) or 0))):
        if len(eco) >= TG_ECO:
            break
        if not ya(h):
            eco.append(h)
            tomar(h)
    if eco:
        out.extend(["", LINEA, "💰 <b>ECONOMÍA Y FINANZAS</b>"])
        for i, h in enumerate(eco, 1):
            out.append(f"{_num(i)} " + _titular_html(h, destacar=(i == 1)))

    # 3) en Salta, de cualquier área
    salta = []
    for h in rankear([h for h in base if es_salta(h) and h.get("tema") not in AREAS_SUAVES]):
        if len(salta) >= TG_SALTA:
            break
        if h not in top and h not in eco and not ya(h):
            salta.append(h)
            tomar(h)
    if salta:
        out.extend(["", LINEA, "📍 <b>EN SALTA</b>"])
        for h in salta:
            out.append(f"• {EMOJI_AREA.get(h.get('tema'), '📌')} " + _titular_html(h, marca=False))

    # 4) por área: lo que falta, sin repetir el mismo tema en varias áreas
    por = {}
    for h in base:
        if h not in mostradas:
            por.setdefault(h.get("tema") or "Otros temas", []).append(h)
    areas = [a for a in sorted(por, key=lambda a: (a in AREAS_SUAVES, -len(por[a]), a)) if a not in ("Otros temas", "Economía y finanzas")][:TG_MAX_AREAS]
    bloques = []
    for k, a in enumerate(areas):
        elegidas = []
        for h in rankear(por[a]):
            if len(elegidas) >= (TG_X_AREA if k < TG_AREAS_GRANDES else 1):
                break
            if not ya(h):
                elegidas.append(h)
                tomar(h)
        if elegidas:
            items = ["• " + _titular_html(h, pie=True, n_max=2) for h in elegidas]
            items[0] = "<blockquote expandable>" + items[0]          # la cita plegable agrupa las notas del área
            items[-1] += "</blockquote>"
            bloques.append(["", f"{EMOJI_AREA.get(a, '📌')} <b>{_e(a)}</b> ({len(por[a])})"] + items)
    if bloques:
        out.extend(["", LINEA, "🗂️ <b>POR ÁREA</b>"])
        for b_ in bloques:
            out.extend(b_)

    out.extend(["", LINEA, "<i>Estimación por titulares, sin IA · 📍 en Salta · 🔁 sigue de ayer · tocá un área para ver sus notas.</i>"])
    de_hoy = [h for h in mostradas if (edicion != "manana") or h in madrugada]
    return titulo, "\n".join(out), de_hoy


def sin_etiquetas(texto):
    return _html.unescape(re.sub(r"<[^>]+>", "", texto))


def partir(texto, medir=None, tope=MAX_BYTES_PARTE, pegar=False):
    """Parte el texto en trozos de hasta `tope` unidades, cortando entre líneas.
    Por defecto mide bytes; para Telegram se mide el texto visible (las direcciones de los enlaces no cuentan).
    Con pegar=True nunca se separa un titular de su línea de medios (la que empieza con 4 espacios) ni un rótulo
    de sección de su primer ítem."""
    medir = medir or (lambda t: len(t.encode("utf-8")))
    if not pegar:
        unidades = texto.split("\n")
    else:
        bloques = []
        for linea in texto.split("\n"):
            if linea.startswith("    ") and bloques:
                bloques[-1] += "\n" + linea
            else:
                bloques.append(linea)
        unidades, pendiente = [], []
        for b_ in bloques:
            es_rotulo = (b_.strip() == "" or b_.startswith("━") or re.match(r"^\S+ <b>[^<]+</b>( \(\d+\))?$", b_))
            if es_rotulo:
                pendiente.append(b_)
            else:
                unidades.append("\n".join(pendiente + [b_]))
                pendiente = []
        if pendiente:
            unidades.append("\n".join(pendiente))
        # un área («🩺 Salud (14)» y sus notas) viaja completa: se pegan las notas siguientes a su rótulo
        juntas = []
        for u in unidades:
            if juntas and not u.startswith(("\n", "━")) and re.search(r"(?m)^\S+ <b>[^<]+</b> \(\d+\)$", juntas[-1]):
                juntas[-1] += "\n" + u
            else:
                juntas.append(u)
        unidades = juntas
    partes, actual = [], ""
    for u in unidades:
        if actual and medir(actual + "\n" + u) > tope:
            partes.append(actual)
            actual = u.lstrip("\n")
        else:
            actual = u if not actual else actual + "\n" + u
    if actual:
        partes.append(actual)
    return partes


def post_json(url, cuerpo, cabeceras, secretos):
    datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
    cab = {"Content-Type": "application/json; charset=utf-8", "User-Agent": "NEWAR-notificador/1.0"}
    cab.update(cabeceras)
    ultimo = ""
    for intento in range(1, INTENTOS + 1):
        try:
            req = urllib.request.Request(url, data=datos, headers=cab, method="POST")
            with urllib.request.urlopen(req, timeout=20) as r:
                if 200 <= r.status < 300:
                    return
                ultimo = f"respuesta {r.status}"
        except urllib.error.HTTPError as e:
            ultimo = f"HTTP {e.code}"
            if e.code in (400, 401, 403, 404):
                raise ErrorEnvio({400: "el servidor rechazó el mensaje (400)",
                                  401: "credenciales rechazadas (401): revisá el token",
                                  403: "sin permiso (403): revisá el token o el tema",
                                  404: "no se encontró el destino (404): revisá el tema o el chat"}[e.code])
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            ultimo = ocultar(f"error de red ({getattr(e, 'reason', e)})", secretos)
        if intento < INTENTOS:
            print(f"   reintento {intento}/{INTENTOS - 1} ({ultimo})…")
            time.sleep(ESPERA_BASE * intento)
    raise ErrorEnvio(f"no se pudo enviar tras {INTENTOS} intentos ({ultimo})")


def canales_configurados():
    """Devuelve ({nombre: función_enviar}, secretos). Lanza ErrorEnvio si la configuración es inválida."""
    env = os.environ
    topic = (env.get("NTFY_TOPIC") or "").strip()
    server = (env.get("NTFY_SERVER") or "").strip() or "https://ntfy.sh"
    token = (env.get("NTFY_TOKEN") or "").strip()
    bot = (env.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat = (env.get("TELEGRAM_CHAT_ID") or "").strip()
    api = (env.get("TELEGRAM_API_URL") or "").strip() or "https://api.telegram.org"
    secretos = [topic, token, bot, chat]
    canales = {}

    if topic:
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,64}", topic):
            raise ErrorEnvio("NTFY_TOPIC tiene que tener entre 16 y 64 caracteres (letras, números, _ o -). "
                             "Generá uno aleatorio con: python -c \"import secrets; print(secrets.token_urlsafe(16))\"")
        base = url_valida(server, "NTFY_SERVER")

        def enviar_ntfy(titulo, partes):
            for i, parte in enumerate(partes, 1):
                t = titulo if len(partes) == 1 else f"{titulo} ({i}/{len(partes)})"
                cuerpo = {"topic": topic, "title": t, "message": parte, "tags": ["newspaper"], "click": SITIO + "#/diario"}
                post_json(base + "/", cuerpo, {"Authorization": f"Bearer {token}"} if token else {}, secretos)
        canales["ntfy"] = enviar_ntfy

    if bot or chat:
        if not (bot and chat):
            raise ErrorEnvio("Telegram necesita los dos: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (falta uno).")
        if not re.fullmatch(r"\d{6,12}:[A-Za-z0-9_-]{30,50}", bot):
            raise ErrorEnvio("TELEGRAM_BOT_TOKEN no tiene la forma de un token de bot (123456789:ABC...).")
        base_t = url_valida(api, "TELEGRAM_API_URL")

        teclado = {"inline_keyboard": [
            [{"text": "🔎 Panel completo", "url": SITIO + "#/diario"}, {"text": "⚖️ Justicia", "url": SITIO + "#/judicial"}],
            [{"text": "🗺️ Mapas", "url": SITIO + "#/mapas"}, {"text": "📈 Radar de temas", "url": SITIO + "#/temas"}]]}

        def enviar_telegram(titulo, partes):
            for i, parte in enumerate(partes, 1):
                if i > 1:
                    time.sleep(min(ESPERA_BASE, 1.0))      # Telegram: ~1 mensaje por segundo al mismo chat, y se mantiene el orden
                cab = "" if len(partes) == 1 else f"<i>({i}/{len(partes)})</i>\n"
                cuerpo = {"chat_id": chat, "text": cab + parte, "parse_mode": "HTML",
                          "disable_web_page_preview": True}
                if i == len(partes):
                    cuerpo["reply_markup"] = teclado          # los botones van solo en el último mensaje
                try:
                    post_json(f"{base_t}/bot{bot}/sendMessage", cuerpo, {}, secretos)
                except ErrorEnvio as e:
                    if "400" not in str(e):
                        raise
                    # el formato HTML fue rechazado: se reenvía como texto plano para no perder el aviso
                    plano = {"chat_id": chat, "text": sin_etiquetas(cab + parte), "disable_web_page_preview": True}
                    post_json(f"{base_t}/bot{bot}/sendMessage", plano, {}, secretos)
        canales["telegram"] = enviar_telegram

    return canales, secretos


# ----------------------------------------------------------------------------------------------
def edicion_por_hora(ahora_ar):
    """Si no se indica, la edición se elige por la hora de Argentina (una corrida programada que se demora sigue cayendo bien)."""
    m = ahora_ar.hour * 60 + ahora_ar.minute
    return "manana" if m < 10 * 60 + 30 else "mediodia" if m < 14 * 60 + 30 else "tarde" if m < 19 * 60 else "noche"


def main():
    ap = argparse.ArgumentParser(description="Notifica el resumen del día al celular (4 ediciones: 9, 12, 17 y 21 h)")
    ap.add_argument("--forzar", action="store_true", help="enviar aunque ya se haya avisado esa edición (y sin descontar lo ya enviado)")
    ap.add_argument("--fecha", help="AAAA-MM-DD (por defecto: ayer en la edición de la mañana, hoy en las demás)")
    ap.add_argument("--simular", action="store_true", help="mostrar el texto sin enviar nada")
    ap.add_argument("--edicion", choices=list(EDICIONES), default=None,
                    help="manana (09:00, resumen de ayer) · mediodia (12:00) · tarde (17:00) · noche (21:00). Por defecto, según la hora")
    a = ap.parse_args()

    ahora_ar = datetime.now(AR)
    edicion = a.edicion or edicion_por_hora(ahora_ar)
    ed = EDICIONES[edicion]
    base_dia = ahora_ar - (timedelta(days=1) if ed["dia"] == "ayer" else timedelta(days=0))
    fecha = a.fecha or base_dia.strftime("%Y-%m-%d")
    hoy_fecha = a.fecha if (a.fecha and ed["dia"] == "hoy") else ahora_ar.strftime("%Y-%m-%d")
    clave = fecha if edicion == "manana" else f"{fecha}-{edicion}"      # una vez por edición, por día y por canal
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fecha):
        print("ERROR: la fecha tiene que ser AAAA-MM-DD.")
        return 1
    ruta = os.path.join(RESUMENES, f"{fecha}.json")
    dia = leer_json(ruta, None)
    if not isinstance(dia, dict):
        print(f"ERROR: no existe el resumen de {fecha} (data/resumenes/{fecha}.json). "
              f"Corré antes: python scripts/resumen_diario.py")
        return 1
    hoy = leer_json(os.path.join(RESUMENES, f"{hoy_fecha}.json"), None) if edicion == "manana" else None
    hoy = hoy if isinstance(hoy, dict) else None

    reg = leer_json(REGISTRO, {})
    enviados_reg = reg.get("enviados") if isinstance(reg.get("enviados"), dict) else {}
    ya_enviados = [] if (a.forzar or a.simular) else [frozenset(x) for x in (enviados_reg.get(hoy_fecha) or []) if isinstance(x, list)]

    titulo, texto = armar_texto(dia, fecha)
    titulo = titulo.replace("Resumen de ayer", ed["titulo"].split(" · ", 1)[-1] if edicion != "manana" else "Resumen de ayer")
    atraso = None if a.fecha else atraso_horas(hoy if (edicion == "manana" and hoy) else dia)
    titulo_tg, texto_tg, de_hoy = armar_html(dia, fecha, edicion, hoy, ya_enviados, atraso)
    if a.simular:
        print(f"[edición: {edicion} · {ed['hora']}]")
        print(titulo + "\n" + "-" * len(titulo) + "\n" + texto)
        print("\n===== TELEGRAM (HTML) =====\n" + texto_tg)
        return 0

    try:
        canales, secretos = canales_configurados()
    except ErrorEnvio as e:
        print(f"ERROR de configuración: {e}")
        return 1
    if not canales:
        print("ERROR: no hay ningún canal configurado. Cargá NTFY_TOPIC o TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID "
              "en Settings → Secrets and variables → Actions (guía: GUIA_NOTIFICACIONES.md).")
        return 1
    if edicion in ("mediodia", "tarde"):          # ntfy (política + seguridad) solo a la mañana y a la noche
        canales = {k: v for k, v in canales.items() if k == "telegram"}
        if not canales:
            print("Edición solo para Telegram y no hay Telegram configurado. Nada que hacer.")
            return 0

    avisos = reg.get("avisos") if isinstance(reg.get("avisos"), dict) else {}
    hechos = avisos.get(clave) if isinstance(avisos.get(clave), dict) else {}
    pendientes = [c for c in canales if a.forzar or c not in hechos]
    if not pendientes:
        print(f"Ya se avisó el resumen de {clave} por: {', '.join(hechos)}. Nada que hacer (usá --forzar para repetir).")
        return 0

    partes = partir(texto)
    partes_tg = partir(texto_tg, medir=lambda t: len(sin_etiquetas(t)), tope=4000, pegar=True)   # Telegram admite 4096
    fallos = []
    for c in pendientes:
        pc = partes_tg if c == "telegram" else partes
        print(f"Enviando el resumen de {clave} por {c} ({len(pc)} mensaje/s)…")
        try:
            canales[c](titulo, pc)
        except ErrorEnvio as e:
            fallos.append(f"{c}: {ocultar(e, secretos)}")
            print(f"   FALLÓ: {fallos[-1]}")
            continue
        hechos[c] = ahora()
        avisos[clave] = hechos
        reg["avisos"] = dict(sorted(avisos.items())[-80:])       # se guardan los últimos avisos
        if c == "telegram":                                     # lo mandado se descuenta en las próximas ediciones del día
            lista = [sorted(firma(h.get("titulo"))) for h in de_hoy]
            enviados_reg[hoy_fecha] = (enviados_reg.get(hoy_fecha) or []) + lista
            reg["enviados"] = dict(sorted(enviados_reg.items())[-3:])
        guardar_registro(reg)
        print("   enviado.")
    if fallos:
        print("ERROR: no se pudo avisar por: " + "; ".join(fallos))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
