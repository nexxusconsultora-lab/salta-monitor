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
MAX_TITULO = 180
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
    t = limpiar(h.get("titulo"), 170)
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
AREAS_SUAVES = {"Deportes", "Espectáculos y cultura", "Otros temas"}
TG_TOP = 5            # historias en «Lo más importante»
TG_SALTA = 6          # historias en «En Salta»
TG_X_AREA = 2         # historias por área (en las áreas más movidas)
TG_AREAS_GRANDES = 8  # cuántas áreas muestran TG_X_AREA historias; el resto muestra 1
TG_MAX_AREAS = 14     # no se muestran más áreas que estas (se omite «Otros temas»)
TG_TIT = 95          # largo máximo de cada titular (se lee de un vistazo)
LINEA = "━━━━━━━━━━━━━━"


def _titular_html(h, marca=True):
    """Titular corto y con enlace a la nota. 📍 = pasó en Salta; 🔁 = sigue de ayer."""
    t = limpiar(h.get("titulo"), TG_TIT)
    u = _link(h)
    base = f'<a href="{_html.escape(u, quote=True)}">{_e(t)}</a>' if u else _e(t)
    if marca and h.get("alcance") == "Salta":
        base = "📍 " + base
    if h.get("sigue_de_ayer"):
        base += " 🔁"
    n = len(h.get("medios") or [])
    return base + (f" <i>· {n} medios</i>" if n > 1 else "")


def armar_html(dia, fecha, edicion="manana"):
    """Versión para Telegram, pensada para captar la idea rápido: primero lo más importante, después lo que
    pasó en Salta y por último un resumen área por área, todo con emojis y titulares cortos con enlace.
    Cada línea es autónoma (sin etiquetas abiertas entre líneas) para poder partirla sin romper el formato."""
    d = datetime.strptime(fecha, "%Y-%m-%d")
    cab = f"{DIAS[d.weekday()]} {d.strftime('%d/%m/%Y')}"
    todos = dia.get("todos") or {}
    hist = todos.get("historias") or []
    if not hist:      # resúmenes viejos sin «todos»: se arma con política + seguridad
        hist = [dict(h, tema=h.get("tema") or "Política y gobierno") for h in (dia.get("historias") or [])] + \
               [dict(h, tema="Policiales y seguridad") for h in ((dia.get("seguridad") or {}).get("historias") or [])]
    tt = todos.get("totales") or {}
    t = dia.get("totales") or {}
    notas = tt.get("notas") or t.get("recolectadas") or 0
    titulo = ("📰 <b>Resumen de ayer</b> · " if edicion == "manana" else "🗞️ <b>Novedades de hoy</b> · ") + _e(cab)
    n_salta = len([h for h in hist if h.get("alcance") == "Salta"])
    out = [titulo,
           f"📊 <b>{len(hist)}</b> historias" + (f" de {notas} notas" if notas else "")
           + (f" · 📡 {t.get('medios')} medios" if t.get("medios") else "") + f" · 📍 {n_salta} en Salta"]
    if dia.get("cobertura_baja"):
        out.append("⚠️ <i>Se recolectaron pocas notas: el resumen puede estar incompleto.</i>")

    # 1) Lo más importante: lo que cubrieron más medios, sin deportes ni espectáculos
    top = ordenar([h for h in hist if h.get("tema") not in AREAS_SUAVES])[:TG_TOP]
    out += ["", LINEA, "⚡ <b>LO MÁS IMPORTANTE</b>"]
    for i, h in enumerate(top, 1):
        out.append(f"{i}. {EMOJI_AREA.get(h.get('tema'), '📌')} {_titular_html(h, marca=False)}")
    if not top:
        out.append("Sin historias.")

    # 2) En Salta, de cualquier área
    salta = ordenar([h for h in hist if h.get("alcance") == "Salta" and h.get("tema") not in AREAS_SUAVES])[:TG_SALTA]
    out += ["", LINEA, "📍 <b>EN SALTA</b>"]
    for h in salta:
        out.append(f"• {EMOJI_AREA.get(h.get('tema'), '📌')} {_titular_html(h, marca=False)}")
    if not salta:
        out.append("Sin historias de Salta.")

    # 3) Por área: las 2 historias principales de cada una, ordenadas por cantidad
    vistos = {h.get("titulo") for h in top + salta}      # lo ya mostrado arriba no se repite
    por = {}
    for h in hist:
        por.setdefault(h.get("tema") or "Otros temas", []).append(h)
    areas = [a for a in sorted(por, key=lambda a: (a in AREAS_SUAVES, -len(por[a]), a)) if a != "Otros temas"][:TG_MAX_AREAS]
    out += ["", LINEA, "🗂️ <b>POR ÁREA</b>"]
    for k, a in enumerate(areas):
        nuevos = [h for h in ordenar(por[a]) if h.get("titulo") not in vistos][:(TG_X_AREA if k < TG_AREAS_GRANDES else 1)]
        if not nuevos:
            continue
        out += ["", f"{EMOJI_AREA.get(a, '📌')} <b>{_e(a)}</b> ({len(por[a])})"]
        for h in nuevos:
            out.append("• " + _titular_html(h))

    out += ["", LINEA,
            f'🔎 <a href="{SITIO}#/diario">Todo el detalle</a> · ⚖️ <a href="{SITIO}#/judicial">Justicia</a> · 🗺️ <a href="{SITIO}#/mapas">Mapas</a>',
            "<i>Estimación por titulares, sin IA. 📍 = en Salta · 🔁 = sigue de ayer.</i>"]
    return titulo, "\n".join(out)


def sin_etiquetas(texto):
    return _html.unescape(re.sub(r"<[^>]+>", "", texto))


def partir(texto, medir=None, tope=MAX_BYTES_PARTE):
    """Parte el texto en trozos de hasta `tope` unidades, cortando entre líneas.
    Por defecto mide bytes; para Telegram se mide el texto visible (las direcciones de los enlaces no cuentan)."""
    medir = medir or (lambda t: len(t.encode("utf-8")))
    partes, actual = [], ""
    for linea in texto.split("\n"):
        if actual and medir(actual + "\n" + linea) > tope:
            partes.append(actual)
            actual = linea
        else:
            actual = linea if not actual else actual + "\n" + linea
    if actual:
        partes.append(actual)
    return partes


# ----------------------------------------------------------------------------------------------
# Envío
# ----------------------------------------------------------------------------------------------
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

        def enviar_telegram(titulo, partes):
            for i, parte in enumerate(partes, 1):
                cab = "" if len(partes) == 1 else f"<i>({i}/{len(partes)})</i>\n"
                cuerpo = {"chat_id": chat, "text": cab + parte, "parse_mode": "HTML",
                          "disable_web_page_preview": True}
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
def main():
    ap = argparse.ArgumentParser(description="Notifica el resumen de ayer al celular")
    ap.add_argument("--forzar", action="store_true", help="enviar aunque ya se haya avisado ese día")
    ap.add_argument("--fecha", help="AAAA-MM-DD (por defecto: ayer, hora de Argentina)")
    ap.add_argument("--simular", action="store_true", help="mostrar el texto sin enviar nada")
    ap.add_argument("--edicion", choices=["manana", "tarde"], default="manana",
                    help="manana = resumen de ayer (por defecto); tarde = novedades de HOY hasta ahora")
    a = ap.parse_args()

    base_dia = datetime.now(AR) - (timedelta(days=0) if a.edicion == "tarde" else timedelta(days=1))
    fecha = a.fecha or base_dia.strftime("%Y-%m-%d")
    clave = fecha if a.edicion == "manana" else fecha + "-tarde"      # una vez por edición y por día
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fecha):
        print("ERROR: la fecha tiene que ser AAAA-MM-DD.")
        return 1
    ruta = os.path.join(RESUMENES, f"{fecha}.json")
    dia = leer_json(ruta, None)
    if not isinstance(dia, dict):
        print(f"ERROR: no existe el resumen de {fecha} (data/resumenes/{fecha}.json). "
              f"Corré antes: python scripts/resumen_diario.py")
        return 1

    titulo, texto = armar_texto(dia, fecha)
    if a.edicion == "tarde":
        titulo = titulo.replace("Resumen de ayer", "Novedades de hoy")
    titulo_tg, texto_tg = armar_html(dia, fecha, a.edicion)
    if a.simular:
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

    reg = leer_json(REGISTRO, {})
    avisos = reg.get("avisos") if isinstance(reg.get("avisos"), dict) else {}
    hechos = avisos.get(clave) if isinstance(avisos.get(clave), dict) else {}
    pendientes = [c for c in canales if a.forzar or c not in hechos]
    if not pendientes:
        print(f"Ya se avisó el resumen de {clave} por: {', '.join(hechos)}. Nada que hacer (usá --forzar para repetir).")
        return 0

    partes = partir(texto)
    partes_tg = partir(texto_tg, medir=lambda t: len(sin_etiquetas(t)), tope=3800)
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
        reg["avisos"] = dict(sorted(avisos.items())[-60:])       # se guardan los últimos 60 días
        guardar_registro(reg)
        print("   enviado.")
    if fallos:
        print("ERROR: no se pudo avisar por: " + "; ".join(fallos))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
