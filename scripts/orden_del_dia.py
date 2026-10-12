#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/orden_del_dia.py — Alerta temprana del orden del día de las 4 cámaras.

Vigila las páginas de data/fuentes_orden_del_dia.json (Diputados y Senado de la Nación, Diputados y
Senado de Salta), detecta publicaciones NUEVAS de orden del día / plan de labor / convocatoria a sesión
y te las manda por Telegram, agrupadas por cámara. Si el documento es un PDF, lo lee y te dice qué temas
vigilados aparecen (litio, minería, presupuesto…) y qué políticos de tu lista (data/politicians.json) nombra.

Reglas del proyecto que respeta (reutiliza las funciones de scripts/oficiales.py):
  - Solo datos públicos. Respeta robots.txt. No ejecuta JavaScript (una página que arma su listado con
    JavaScript no se puede leer: queda marcada «sin_enlaces»).
  - Nunca inventa: avisa título + enlace + lo que el texto dice textualmente. Las menciones de personas son
    coincidencias de texto, no verificación de identidad.
  - Ninguna clave en el repo: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID vienen de «Secrets» (variables de entorno).

Primera corrida de cada cámara = LÍNEA BASE: guarda lo que ya estaba publicado SIN avisar (si no, te
llegarían decenas de mensajes viejos). Para forzar el aviso de lo existente: --avisar-primera.

Uso (desde la raíz del repo):
    python scripts/orden_del_dia.py                  # corrida normal (la que usa el workflow)
    python scripts/orden_del_dia.py --diagnostico    # muestra qué encuentra en cada página; no guarda ni envía
    python scripts/orden_del_dia.py --simular        # arma los mensajes y los muestra; no envía ni marca avisado
    python scripts/orden_del_dia.py --solo senado-salta
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import oficiales as of  # noqa: E402  (reutiliza descarga con robots.txt, enlaces, PDF y detección de personas)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FUENTES = DATA / "fuentes_orden_del_dia.json"
ITEMS = DATA / "orden_del_dia.json"
STATUS = DATA / "orden_del_dia_status.json"

AR = timezone(timedelta(hours=-3))
TOPE_ITEMS = 1500            # documentos guardados; los más viejos se descartan
MAX_LEIDOS_POR_CORRIDA = 8   # PDF/páginas de detalle que se abren por corrida
MAX_NUEVOS_POR_PAGINA = 40   # tope de novedades por página y por corrida
MAX_EDAD_AVISO_DIAS = 3      # no se avisa de algo visto por primera vez hace más que esto
DIAS_SIN_COINCIDENCIAS = 3   # aviso único si una página nunca coincide en tantos días
FALLOS_PARA_AVISAR = 6       # corridas seguidas con la página caída antes de avisarte
MAX_BYTES_MENSAJE = 3500     # Telegram corta en 4096
MAX_POR_MENSAJE = 6
INTENTOS = 3
ESPERA = float(os.environ.get("ODD_ESPERA", "3"))   # segundos; los tests la bajan

MESES = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
         "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}
RE_FECHA = re.compile(r"\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de|del)\s+(?:ano\s+)?(20\d{2})\b")


class ErrorEnvio(Exception):
    pass


# --------------------------------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------------------------------
def ahora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def limpiar(s, tope=200):
    s = re.sub(r"[\x00-\x1f\x7f]+", " ", str(s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= tope else s[:tope - 1].rstrip() + "…"


def ocultar(texto, secretos):
    texto = str(texto)
    for v in secretos:
        if v and len(v) >= 4:
            texto = texto.replace(v, "***")
    return texto


def url_segura(url):
    p = urlparse(url or "")
    return p.scheme in ("http", "https") and bool(p.hostname)


def sin_fragmento(url):
    return urlparse(url)._replace(fragment="").geturl()


def mismo_sitio(url, pagina):
    base = (urlparse(pagina).hostname or "").lower()
    base = base[4:] if base.startswith("www.") else base
    host = (urlparse(url).hostname or "").lower()
    return bool(base) and (host == base or host.endswith("." + base))


def fecha_mencionada(texto):
    """Primera fecha del tipo «14 de octubre de 2026» (u «octubre del 2026») que aparece en el texto."""
    for m in RE_FECHA.finditer(of.fold(texto)):
        mes = MESES.get(m.group(2))
        if mes:
            try:
                return datetime(int(m.group(3)), mes, int(m.group(1))).strftime("%d/%m/%Y")
            except ValueError:
                continue
    return None


def dia_aviso_vigente(first_seen):
    try:
        t = datetime.fromisoformat(first_seen)
    except (TypeError, ValueError):
        return False
    return datetime.now(timezone.utc) - t <= timedelta(days=MAX_EDAD_AVISO_DIAS)


# --------------------------------------------------------------------------------------------------
# Lectura de páginas
# --------------------------------------------------------------------------------------------------
def coincide(enlace, abs_url, pagina, cfg):
    """True si el enlace parece un orden del día / plan de labor / convocatoria."""
    texto = of.fold(" ".join([enlace.get("texto_enlace", ""), enlace.get("titulo_attr", ""),
                              urllib.parse.unquote(abs_url)]))
    if any(of.fold(x) in texto for x in cfg.get("excluir_enlace", [])):
        return False
    patron = (pagina.get("link_pattern") or "").strip()
    if patron:
        try:
            return re.search(patron, abs_url) is not None
        except re.error:
            return False
    return any(of.fold(p) in texto for p in cfg.get("palabras_enlace", []))


def titulo_de(enlace, abs_url):
    t = limpiar(enlace.get("texto_enlace") or "", 220)
    if of.titulo_vacio(t) or len(t) < 4:
        # enlaces tipo «descargar»: el nombre del archivo suele estar en el atributo title
        t = limpiar(enlace.get("titulo_attr") or "", 220)
        t = re.sub(r"^archivo nombre:\s*", "", t, flags=re.I)
        t = re.sub(r"\.pdf$", "", t, flags=re.I).strip()
    if of.titulo_vacio(t) or len(t) < 4:
        partes = [x for x in urlparse(abs_url).path.split("/") if x and x.lower() != "download"]
        nombre = urllib.parse.unquote(partes[-1]) if partes else abs_url
        t = limpiar(re.sub(r"[-_]+", " ", re.sub(r"\.\w{2,4}$", "", nombre)), 220)
    return t


def leer_pagina(camara, pagina, cfg, diagnostico=False):
    """Devuelve (estado, mensaje, total_enlaces, lista de dicts {url,titulo})."""
    url = pagina["url"]
    if not url_segura(url):
        return "error", "la url no es http(s) válida", 0, []
    try:
        if not of.robots_permite(url):
            return "bloqueada", "el robots.txt del sitio no permite leer esta página", 0, []
    except Exception:
        pass
    try:
        texto = of.descargar(url)
    except urllib.error.HTTPError as e:
        return "error", f"el sitio respondió {e.code}", 0, []
    except Exception as e:
        return "error", f"no se pudo abrir la página ({type(e).__name__})", 0, []
    enlaces = of.extraer_enlaces(texto)
    if not enlaces:
        return "sin_enlaces", "la página no trae enlaces en el HTML (¿arma el listado con JavaScript?)", 0, []
    vistos, encontrados, descartados = set(), [], []
    for e in enlaces:
        href = (e.get("href") or "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        abs_url = sin_fragmento(urljoin(url, href))
        if not url_segura(abs_url) or not mismo_sitio(abs_url, url) or abs_url in vistos:
            continue
        vistos.add(abs_url)
        if coincide(e, abs_url, pagina, cfg):
            encontrados.append({"url": abs_url, "titulo": titulo_de(e, abs_url)})
        elif diagnostico:
            descartados.append(limpiar(e.get("texto_enlace"), 70) or abs_url)
    if diagnostico:
        print(f"      enlaces en la página: {len(vistos)} · con filtro: {len(encontrados)}")
        for x in encontrados[:15]:
            print(f"        ✓ {x['titulo'][:90]}  →  {x['url']}")
        if not encontrados:
            print("      (ninguno pasó el filtro) ejemplos de enlaces que se descartaron:")
            for t in descartados[:12]:
                print(f"        · {t}")
    return "ok", f"{len(encontrados)} documento(s) coinciden con el filtro", len(vistos), encontrados


def extracto(texto, tope=1500):
    """Primeras líneas del documento, en una sola línea de texto: es lo que NEWAR muestra como «qué dice»."""
    t = re.sub(r"\s+", " ", texto or "").strip()
    return t[:tope] + ("…" if len(t) > tope else "")


def fecha_de_sesion(doc):
    """Fecha de la sesión (datetime) si el título/enlace/texto la trae como dd/mm/aaaa o dd-mm-aaaa; si no, None."""
    for campo in (doc.get("titulo", ""), doc.get("url", ""), doc.get("fecha_mencionada", "")):
        m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](20\d{2})", str(campo))
        if m:
            try:
                return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            except ValueError:
                continue
    return None


def es_proxima(doc):
    f = fecha_de_sesion(doc)
    return bool(f and f >= datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1))


def analizar(doc, politicos, temas, presupuesto):
    """Abre el PDF (o la página) del documento nuevo y le saca temas vigilados, personas y fecha.
    Nunca bloquea el aviso: si falla, se avisa igual con título y enlace."""
    url = doc["url"]
    doc["texto_leido"] = False
    paginas = None
    if presupuesto["usados"] >= MAX_LEIDOS_POR_CORRIDA:
        return
    if of.es_pdf(url):
        paginas, estado, _motivo = of.leer_pdf_fuente(url, {"pdf_usado": presupuesto["usados"],
                                                            "pdf_tope": MAX_LEIDOS_POR_CORRIDA})
        presupuesto["usados"] += 1
        if estado != "ok" or not paginas:
            paginas = None
    else:
        try:
            if of.robots_permite(url):
                presupuesto["usados"] += 1
                paginas = [of.html_a_texto(of.descargar(url))]
        except Exception:
            paginas = None
    base = doc["titulo"]
    if not paginas:
        f = fecha_mencionada(base)
        if f:
            doc["fecha_mencionada"] = f
        return
    doc["texto_leido"] = True
    completo = " ".join(paginas)
    plegado = of.fold(completo)
    doc["temas"] = [t for t in temas if re.search(r"(?<![a-z0-9])" + re.escape(of.fold(t)) + r"(?![a-z0-9])", plegado)]
    ctx = of.contextos_en_paginas(paginas, politicos)
    nombres = {p["id"]: p["nombre_display"] for p in politicos}
    doc["personas"] = [nombres.get(pid, pid) for pid in ctx][:12]
    f = fecha_mencionada(base) or fecha_mencionada(completo[:3000])
    if f:
        doc["fecha_mencionada"] = f
    doc["paginas"] = len(paginas)
    doc["extracto"] = extracto(completo)


# --------------------------------------------------------------------------------------------------
# Telegram
# --------------------------------------------------------------------------------------------------
def enviar(token, chat_id, texto):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    datos = urllib.parse.urlencode({"chat_id": chat_id, "text": texto, "parse_mode": "HTML",
                                    "disable_web_page_preview": "true"}).encode("utf-8")
    ultimo = None
    for i in range(1, INTENTOS + 1):
        try:
            req = urllib.request.Request(url, data=datos, method="POST")
            with urllib.request.urlopen(req, timeout=20) as r:
                r.read()
            return
        except urllib.error.HTTPError as e:
            ultimo = f"Telegram respondió {e.code}"
            if e.code in (400, 401, 403, 404):      # error de configuración o de texto: no se arregla reintentando
                break
        except Exception as e:
            ultimo = f"error de red ({type(e).__name__})"
        if i < INTENTOS:
            time.sleep(ESPERA * i)
    raise ErrorEnvio(ocultar(ultimo or "no se pudo enviar", [token, chat_id]))


def linea_doc(i, d):
    t = html.escape(limpiar(d["titulo"], 160), quote=False)
    u = html.escape(d["url"], quote=True)
    partes = [f"{i}. <a href=\"{u}\">{t}</a>"]
    meta = []
    if d.get("fecha_mencionada"):
        meta.append(f"Fecha en el texto: {html.escape(d['fecha_mencionada'])}")
    if d.get("temas"):
        meta.append("Temas vigilados: " + html.escape(", ".join(d["temas"])))
    if d.get("personas"):
        meta.append("Nombra a: " + html.escape(", ".join(d["personas"][:6])))
    if meta:
        partes.append("   " + " · ".join(meta))
    return "\n".join(partes)


def armar_mensajes(camara, docs):
    """Parte las novedades de una cámara en mensajes cortos. Devuelve [(texto, [docs])]."""
    docs = sorted(docs, key=lambda d: (not d.get("temas"), not d.get("personas")))   # primero los que tocan tus temas
    salida, bloque = [], []

    def cerrar():
        if bloque:
            cab = f"{camara.get('icono', '🏛️')} <b>{html.escape(camara['nombre'])}</b> — {len(docs)} novedad(es) de orden del día"
            cuerpo = "\n".join(linea_doc(i, d) for i, d in enumerate(bloque, 1))
            salida.append((cab + "\n\n" + cuerpo + "\n\nCoincidencia de texto, no verificación. Revisá el documento original.",
                           list(bloque)))
            bloque.clear()

    for d in docs:
        prueba = bloque + [d]
        largo = sum(len(linea_doc(i, x).encode("utf-8")) + 1 for i, x in enumerate(prueba, 1)) + 300
        if bloque and (len(prueba) > MAX_POR_MENSAJE or largo > MAX_BYTES_MENSAJE):
            cerrar()
        bloque.append(d)
    cerrar()
    return salida


# --------------------------------------------------------------------------------------------------
# Principal
# --------------------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--diagnostico", action="store_true", help="muestra qué encuentra en cada página; no guarda ni envía")
    ap.add_argument("--simular", action="store_true", help="arma y muestra los mensajes; no envía ni marca avisado")
    ap.add_argument("--avisar-primera", action="store_true", help="avisa también lo que ya estaba publicado en la primera corrida")
    ap.add_argument("--solo", help="id de una cámara (ej. senado-salta)")
    a = ap.parse_args()

    cfg = of.cargar_json(FUENTES, {})
    camaras = [c for c in cfg.get("camaras", []) if c.get("enabled", True) and (not a.solo or c["id"] == a.solo)]
    if not camaras:
        print("No hay cámaras configuradas (revisá data/fuentes_orden_del_dia.json).")
        return 1
    temas = cfg.get("temas_vigilados", [])
    politicos = of.cargar_politicos()
    guardado = of.cargar_json(ITEMS, {})
    items = {d["id"]: d for d in guardado.get("items", []) if d.get("id")}
    estado_prev = of.cargar_json(STATUS, {})
    paginas_prev = estado_prev.get("paginas", {})
    base_hecha = dict(estado_prev.get("linea_base", {}))
    estado = {"generated_at": ahora(), "paginas": {}, "linea_base": base_hecha}
    presupuesto = {"usados": 0}
    avisos_sistema = []
    nuevos_por_camara = {}

    for cam in camaras:
        print(f"\n== {cam['nombre']} ==")
        hubo_lectura_ok = False
        nuevos = []
        for pag in cam.get("paginas", []):
            clave = f"{cam['id']}|{pag['url']}"
            prev = paginas_prev.get(clave, {})
            print(f"   {pag['url']}")
            st, msg, total, docs = leer_pagina(cam, pag, cfg, diagnostico=a.diagnostico)
            print(f"      → {st}: {msg}")
            falla = st != "ok"
            hubo_lectura_ok = hubo_lectura_ok or (st == "ok" and total > 0)
            reg = {"url": pag["url"], "estado": st, "mensaje": msg, "checked_at": ahora(),
                   "enlaces_en_pagina": total, "coincidencias": len(docs),
                   "primera_vez": prev.get("primera_vez") or ahora(),
                   "coincidencias_total": int(prev.get("coincidencias_total", 0)) + (len(docs) if st == "ok" else 0),
                   "fallos_seguidos": (int(prev.get("fallos_seguidos", 0)) + 1) if falla else 0,
                   "avisado_caida": bool(prev.get("avisado_caida")) and falla,
                   "avisado_sin_coincidencias": bool(prev.get("avisado_sin_coincidencias"))}
            estado["paginas"][clave] = reg
            if falla and reg["fallos_seguidos"] >= FALLOS_PARA_AVISAR and not reg["avisado_caida"]:
                avisos_sistema.append((clave, "avisado_caida",
                                       f"⚠️ <b>Orden del día: fuente con problemas</b>\n{html.escape(cam['nombre'])}\n"
                                       f"{html.escape(pag['url'])}\n{html.escape(msg)} ({reg['fallos_seguidos']} corridas seguidas)."))
            try:
                dias = (datetime.now(timezone.utc) - datetime.fromisoformat(reg["primera_vez"])).days
            except ValueError:
                dias = 0
            if (st == "ok" and reg["coincidencias_total"] == 0 and dias >= DIAS_SIN_COINCIDENCIAS
                    and not reg["avisado_sin_coincidencias"]):
                avisos_sistema.append((clave, "avisado_sin_coincidencias",
                                       f"🔎 <b>Orden del día: revisá esta página</b>\n{html.escape(cam['nombre'])}\n"
                                       f"{html.escape(pag['url'])}\nLleva {dias} días y nunca encontró un orden del día. "
                                       f"Probablemente no es la sección correcta: abrila y reemplazá la url en "
                                       f"data/fuentes_orden_del_dia.json."))
            for d in docs[:MAX_NUEVOS_POR_PAGINA]:
                did = of.id_estable(cam["id"], d["url"])
                if did in items:
                    continue
                doc = {"id": did, "camara": cam["id"], "camara_nombre": cam["nombre"], "ambito": cam.get("ambito", ""),
                       "titulo": d["titulo"], "url": d["url"], "first_seen": ahora(), "avisado": False}
                nuevos.append(doc)

        if a.diagnostico:
            continue
        primera = cam["id"] not in base_hecha
        if primera and hubo_lectura_ok and not a.avisar_primera:
            for d in nuevos:
                d["avisado"], d["linea_base"] = True, True
            print(f"   Línea base: {len(nuevos)} documento(s) ya publicados, guardados sin avisar.")
            base_hecha[cam["id"]] = ahora()
        elif primera and hubo_lectura_ok:
            base_hecha[cam["id"]] = ahora()
        a_analizar = [d for d in nuevos if not d["avisado"]]
        for d in a_analizar:
            analizar(d, politicos, temas, presupuesto)
        for d in nuevos:
            items[d["id"]] = d
        pend = [d for d in items.values() if d["camara"] == cam["id"] and not d["avisado"] and dia_aviso_vigente(d["first_seen"])]
        if pend:
            nuevos_por_camara[cam["id"]] = (cam, pend)
        print(f"   Nuevos para avisar: {len(pend)}")

    if a.diagnostico:
        print("\nDiagnóstico terminado (no se guardó ni se envió nada).")
        return 0

    # Documentos de sesiones próximas que ya se habían leído antes de que existiera el extracto: se vuelven a leer
    # (con tope, y hasta 3 intentos por documento) para poder mostrar «qué dice» en la página.
    for d in list(items.values()):
        if presupuesto["usados"] >= MAX_LEIDOS_POR_CORRIDA:
            break
        if d.get("texto_leido") and not d.get("extracto") and d.get("extracto_intentos", 0) < 3 and es_proxima(d):
            previo = dict(d)
            analizar(d, politicos, temas, presupuesto)
            if not d.get("texto_leido"):
                d.clear()
                d.update(previo)
            d["extracto_intentos"] = previo.get("extracto_intentos", 0) + 1

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    secretos = [token, chat]
    enviados, fallidos = 0, 0
    configurado = bool(token and chat)
    mensajes = [(c, t, ds) for c, pend in nuevos_por_camara.values() for t, ds in armar_mensajes(c, pend)]
    if not configurado and not a.simular and (mensajes or avisos_sistema):
        print("\nTelegram no está configurado (faltan los Secrets TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID): "
              "se guarda todo pero no se avisa. Los documentos de los últimos "
              f"{MAX_EDAD_AVISO_DIAS} días se avisarán cuando lo configures.")
    for cam, texto, ds in mensajes:
        if a.simular:
            print("\n--- mensaje simulado ---\n" + re.sub(r"<[^>]+>", "", html.unescape(texto)))
            continue
        if not configurado:
            continue
        try:
            enviar(token, chat, texto)
            for d in ds:
                items[d["id"]]["avisado"] = True
                items[d["id"]]["avisado_at"] = ahora()
            enviados += 1
        except ErrorEnvio as e:
            fallidos += 1
            print(f"No se pudo enviar el aviso de {cam['nombre']}: {e}", file=sys.stderr)
    for clave, campo, texto in avisos_sistema:
        if a.simular:
            print("\n--- aviso de sistema simulado ---\n" + re.sub(r"<[^>]+>", "", html.unescape(texto)))
            continue
        if not configurado:
            continue
        try:
            enviar(token, chat, texto)
            estado["paginas"][clave][campo] = True
        except ErrorEnvio as e:
            fallidos += 1
            print(f"No se pudo enviar el aviso de sistema: {e}", file=sys.stderr)

    if not a.simular:
        ordenados = sorted(items.values(), key=lambda d: d.get("first_seen", ""), reverse=True)[:TOPE_ITEMS]
        of.guardar_json(ITEMS, {"generated_at": ahora(), "items": ordenados})
        of.guardar_json(STATUS, estado)
    print(f"\nAvisos de orden del día: {enviados} mensaje(s) enviado(s), {fallidos} con error.")
    return 1 if fallidos else 0


if __name__ == "__main__":
    sys.exit(main())
