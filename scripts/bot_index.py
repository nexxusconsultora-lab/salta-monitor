#!/usr/bin/env python3
"""Arma data/bot_index.json: el índice liviano que usa el bot de Telegram (cloudflare-worker/newar-bot.js).

Por qué existe: el bot corre en un Worker de Cloudflare con muy poco tiempo de cálculo por mensaje, así que no puede
bajar las 3.500 noticias ni las 2.600 menciones. Este script deja en un solo archivo chico:
  - las historias de los últimos días (ya sin relleno ni gacetillas de prensa, igual que los avisos de Telegram);
  - la ficha de cada persona de politicians.json: cargo, currículum con fuentes, menciones y las últimas notas.
Nada se inventa: lo que no está en los datos queda vacío y el bot lo dice.

Uso:  python scripts/bot_index.py            (lo corre monitor.yml después de resumen_diario.py)
      python scripts/bot_index.py --forzar   (reescribe aunque no haya cambios ni hayan pasado 15 minutos)

Para no llenar el repositorio de commits, solo reescribe el archivo si cambió el contenido y pasaron al menos 15 minutos.
"""
import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
import notificar as N  # noqa: E402  (se reutilizan los mismos filtros que el aviso: relleno, gacetillas, «es de Salta»)

DATA = os.path.join(QUI, "..", "data")
SALIDA = os.path.join(DATA, "bot_index.json")
DIAS = 2                  # cuántos días de historias lleva el índice (hoy y ayer)
MAX_HISTORIAS = 450       # tope: el archivo tiene que quedar en ~350-400 KB para que el Worker gratuito responda rápido
ULT_POR_PERSONA = 2       # últimas notas por persona (solo para quienes tienen movimiento)
MIN_ENTRE_ESCRITURAS = 15  # minutos
AR = timezone(timedelta(hours=-3))


def leer(ruta, defecto):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def corto(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def historias():
    out = []
    archivos = sorted(glob.glob(os.path.join(DATA, "resumenes", "????-??-??.json")))[-DIAS:]
    for ruta in archivos:
        fecha = os.path.basename(ruta)[:10]
        doc = leer(ruta, {})
        for h in ((doc.get("todos") or {}).get("historias") or []):
            if N.es_relleno(h) or N.es_gacetilla(h):
                continue
            titulo = str(h.get("titulo") or "").strip()
            if not titulo:
                continue
            hh = N.hora_nota(h)
            medios = [m for m in (h.get("medios") or []) if m][:6]
            out.append({
                "t": titulo,
                "f": re.sub(r"[^a-z0-9ñ]+", " ", N.plano(titulo + " " + " ".join(h.get("personas") or []))).strip(),   # palabras sueltas, sin tildes ni signos: el Worker no tiene que normalizar
                "m": medios,
                "n": len(h.get("medios") or []),
                "h": N._hhmm(hh) if hh is not None else "",
                "d": fecha,
                "a": h.get("tema") or "Otros temas",
                "u": N._link(h) or "",
                "s": 1 if N.es_salta(h) else 0,
                "p": (h.get("personas") or [])[:4],
            })
    out.sort(key=lambda x: (x["d"], x["n"]), reverse=True)
    return out[:MAX_HISTORIAS], [os.path.basename(a)[:10] for a in archivos]


def personas():
    pols = leer(os.path.join(DATA, "politicians.json"), [])
    cvs = (leer(os.path.join(DATA, "curriculums.json"), {}).get("personas")) or {}
    agg = (leer(os.path.join(DATA, "aggregates.json"), {}).get("by_politician")) or {}
    menciones = leer(os.path.join(DATA, "mentions.json"), [])
    corte7 = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    por = {}
    for m in menciones:
        pid = m.get("politician_id")
        if pid and m.get("title") and m.get("published_iso"):
            por.setdefault(pid, []).append(m)
    res = []
    for p in pols:
        pid = p.get("id")
        if not pid:
            continue
        ms = sorted(por.get(pid, []), key=lambda m: m["published_iso"], reverse=True)
        ms = [m for m in ms if m["published_iso"] <= datetime.now(timezone.utc).isoformat()]
        nombres = {p.get("name") or ""} | set(p.get("aliases") or [])
        cv = cvs.get(pid) or {}
        a = agg.get(pid) or {}
        res.append({
            "id": pid,
            "n": p.get("name") or pid,
            "c": p.get("cargo") or p.get("role") or "",
            "amb": p.get("ambito") or "",
            "vig": p.get("vigencia") or "",
            "k": sorted({N.plano(x).strip() for x in nombres if len(N.plano(x).strip()) >= 4}),
            "esp": corto(p.get("espacio"), 220),
            "cv": {
                "r": corto(cv.get("resumen"), 700),
                "tr": [[corto(t.get("cargo"), 160), corto(t.get("periodo"), 60)] for t in (cv.get("trayectoria") or [])[:4]],
                "ok": cv.get("verificado") or "",
            } if cv else {},
            "tot": a.get("total") or 0,
            "pos": a.get("positivo") or 0,
            "neg": a.get("negativo") or 0,
            "neu": a.get("neutral") or 0,
            "m7": sum(1 for m in ms if m["published_iso"] >= corte7),
            "ult": [{"t": corto(re.sub(r"\s+-\s+[^-]+$", "", m["title"]), 200), "s": m.get("source") or "",
                     "u": m.get("link") or "", "d": m["published_iso"][:10]} for m in ms[:ULT_POR_PERSONA]]
                   if (a.get("total") or 0) >= 20 else [],
        })
    return res


def detectar_personas(hs, ps):
    """Completa h["p"] (ids de personas nombradas) en cada historia. Los titulares usan apellidos («Sáenz dijo…»), así que se acepta:
    el nombre completo, o un apellido SOLO si tiene 5+ letras y pertenece a una única persona de la lista (para no confundir
    a dos personas con el mismo apellido)."""
    dueños = {}
    for p in ps:
        for k in p["k"]:
            dueños.setdefault(k, set()).add(p["id"])
    claves = {k: next(iter(v)) for k, v in dueños.items() if len(v) == 1 and (" " in k or len(k) >= 5)}
    if not claves:
        return
    rx = re.compile(r"(?<![a-z0-9])(" + "|".join(re.escape(k) for k in sorted(claves, key=len, reverse=True)) + r")(?![a-z0-9])")
    for h in hs:
        ids = list(h["p"])
        for m in rx.finditer(h["f"]):
            pid = claves[m.group(1)]
            if pid not in ids:
                ids.append(pid)
        h["p"] = ids[:4]


# Nombres de pila frecuentes: un nombre propio cuenta como PERSONA si empieza con uno de estos (o con el de alguien de politicians.json).
NOMBRES_DE_PILA = set("""javier karina luis patricia lionel axel cristina mauricio sergio victoria manuel sandra diego federico pablo franco santiago
alberto donald vladimir emmanuel mariano maria jose juan carlos jorge ricardo roberto daniel gabriel martin nicolas lucas matias facundo leandro
marcelo gustavo guillermo claudio fernando eduardo hernan julian ezequiel agustin ignacio rodrigo sebastian andres miguel pedro ramon raul oscar hugo
ruben alejandro adrian damian emilio esteban walter gonzalo bruno ana laura sofia valentina camila lucia julia paula claudia silvia marcela gabriela
mariana florencia carolina natalia veronica romina soledad yamila eugenia graciela susana mirtha moria wanda dario ben kevin lula jair benjamin
giorgia keir nayib delcy emanuel osvaldo nahuel thiago enzo alexis exequiel lisandro roman""".split())
NO_SON_PERSONAS = {"marcos paz", "walter white", "jose paz", "santa rosa"}
_NOMBRE = re.compile(r"(?<![\wáéíóúüñ])([A-ZÁÉÍÓÚÑ][a-záéíóúüñ]{2,}(?:\s+(?:de|del|da|di|van|von)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]+|(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]+){1,2}))")


def mas_nombrados(hs, ps, pila_extra=(), n=12):
    """Las personas más nombradas en los titulares del último día del índice: [[nombre, historias, id_de_ficha_o_"", cargo], ...].
    Cuenta las historias cuyo titular nombra a la persona (con nombre completo o solo por el apellido, como se usa en los titulares).
    Es un conteo de textos, no inventa: «Javier Milei» = historias con «Milei» en el titular. Las que están en politicians.json traen ficha."""
    if not hs:
        return []
    pila = NOMBRES_DE_PILA | set(pila_extra)
    ultimo = max(h["d"] for h in hs)
    dia = [h for h in hs if h["d"] == ultimo]
    completos = {}
    for h in dia:
        for m in _NOMBRE.finditer(h["t"]):
            nom = m.group(1)
            w = N.plano(nom).split()
            if w[0] not in pila or N.plano(nom) in NO_SON_PERSONAS or w[-1] in pila:        # «Juan Manuel» es medio nombre
                continue
            if " de " in N.plano(nom) and R_extranjero(N.plano(nom)):                         # «Santiago de Chile» es un lugar
                continue
            completos[nom] = completos.get(nom, 0) + 1
    grupos = {}
    for nom, c in completos.items():
        grupos.setdefault(N.plano(nom).split()[-1], []).append((c, nom))
    res = []
    por_alias = {k: p for p in ps for k in p["k"]}
    for ap, lista in grupos.items():
        nombre = max(lista)[1]
        rx = re.compile(r"(?<![a-z0-9])" + re.escape(ap) + r"(?![a-z0-9])")
        cuenta = sum(1 for h in dia if rx.search(h["f"]))
        if cuenta >= 2:
            ficha = por_alias.get(N.plano(nombre))
            res.append([nombre, cuenta, ficha["id"] if ficha else "", ficha["c"] if ficha else ""])
    # las personas con ficha entran aunque el titular las nombre solo por el apellido o en mayúsculas («A GUSTAVO SÁENZ»)
    ya = {N.plano(r[0]).split()[-1] for r in res}
    apellidos = {}
    for p in ps:
        ap = N.plano(p["n"]).split()[-1] if p.get("n") else ""
        apellidos.setdefault(ap, []).append(p)
    for ap, lista in apellidos.items():
        if len(lista) != 1 or len(ap) < 5 or ap in ya or ap in pila or es_lugar(ap):
            continue
        if any(a2 == ap and N.plano(nom2) != N.plano(lista[0]["n"]) for a2, l2 in grupos.items() for _, nom2 in l2):
            continue       # el apellido aparece con otro nombre de pila («Juan Román Riquelme»): no se asume que sea esta persona
        rx = re.compile(r"(?<![a-z0-9])" + re.escape(ap) + r"(?![a-z0-9])")
        # solo por apellido: no se cuentan las notas de deportes ni espectáculos (un legislador no es el «Riquelme» de Boca)
        cuenta = sum(1 for h in dia if h["a"] not in ("Deportes", "Espectáculos y cultura") and rx.search(h["f"]))
        if cuenta >= 2:
            res.append([lista[0]["n"], cuenta, lista[0]["id"], lista[0]["c"]])
    res.sort(key=lambda x: (-x[1], x[0]))
    return res[:n]


LUGARES_ARG = {"cordoba", "mendoza", "tucuman", "jujuy", "formosa", "misiones", "corrientes", "chubut", "neuquen", "rosario", "quilmes", "lanus",
               "tandil", "posadas", "olavarria", "pergamino", "trelew", "ushuaia", "catamarca", "santiago", "entre rios", "patagonia"}


def es_lugar(texto_plano):
    """¿Es una provincia, ciudad o país? («Córdoba» no es la persona de apellido Córdoba)."""
    import resumen_diario as R
    return texto_plano in LUGARES_ARG or bool(R._union(tuple(R.EXTRANJERO)).search(texto_plano))


def R_extranjero(texto_plano):
    import resumen_diario as R
    return bool(R._union(tuple(R.EXTRANJERO)).search(texto_plano))


def main():
    ap = argparse.ArgumentParser(description="Arma data/bot_index.json (índice del bot de Telegram)")
    ap.add_argument("--forzar", action="store_true", help="reescribir aunque no haya cambios ni hayan pasado 15 minutos")
    a = ap.parse_args()
    hs, fechas = historias()
    ps = personas()
    detectar_personas(hs, ps)
    doc = {"v": 2, "generado": datetime.now(AR).isoformat(timespec="seconds"), "fechas": fechas, "historias": hs, "personas": ps, "pp": mas_nombrados(hs, ps, {k.split()[0] for p in ps for k in p["k"] if " " in k})}
    previo = leer(SALIDA, None)
    if isinstance(previo, dict) and not a.forzar:
        igual = {k: v for k, v in previo.items() if k != "generado"} == {k: v for k, v in doc.items() if k != "generado"}
        try:
            reciente = datetime.now(AR) - datetime.fromisoformat(previo.get("generado")) < timedelta(minutes=MIN_ENTRE_ESCRITURAS)
        except (TypeError, ValueError):
            reciente = False
        if igual or reciente:
            print("Índice del bot: " + ("sin cambios." if igual else f"se actualizó hace menos de {MIN_ENTRE_ESCRITURAS} minutos; se espera."))
            return
    tmp = SALIDA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, SALIDA)
    print(f"Índice del bot: {len(hs)} historias de {fechas}, {len(ps)} personas, {os.path.getsize(SALIDA) // 1024} KB.")


if __name__ == "__main__":
    main()
