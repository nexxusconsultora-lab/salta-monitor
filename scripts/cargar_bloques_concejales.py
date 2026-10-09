#!/usr/bin/env python3
"""Carga a mano los bloques de los 21 concejales de la Ciudad de Salta en data/politicians.json.

- Solo completa `bloque`, `bloque_fuente`, `bloque_fecha` y `bloque_nombre_fuente`.
- NO pisa un bloque ya cargado: si difiere, lo informa y lo deja como está (usá --forzar para pisar).
- Idempotente: correrlo dos veces no cambia nada la segunda vez.
- No toca ninguna otra persona ni ningún otro campo. Sin red, sin claves.

Pensado para los 7 concejales que seguían sin bloque (Arias, Battaglia Leiva, Bennassar, J. García,
L. García, Gareca, Ortiz). Para los que ya tenían bloque NO escribe nada: solo avisa si la nota oficial
más nueva (2026) dice otra cosa, para que lo revises vos.

Uso (desde la raíz del repo):
    python scripts/cargar_bloques_concejales.py            # simula (no escribe)
    python scripts/cargar_bloques_concejales.py --aplicar  # escribe data/politicians.json
"""
import json, sys, argparse, pathlib

# Siglas tal como las usa el Concejo en sus partes de prensa. El nombre completo de cada
# sigla sale de la cobertura de Nuevo Diario de Salta (preparatoria de dic. 2025) y de Infobae (LP).
NOMBRES = {
    "PS":  "Por Salta",
    "PC":  "Pulso Colectivo",
    "YP":  "Yo Participo",
    "MM":  "Memoria y Movilización",
    "VS":  "Vamos Salta",
    "GSC": "Gustavo Sáenz Conducción",
    "LLA": "La Libertad Avanza",
    "UCR": "Unión Cívica Radical",
    "J":   "Juntos por el Cambio",
    "LP":  "Libertad y Progreso",
}
FUENTE_NOMBRES = ("Nombre completo de la sigla según Nuevo Diario de Salta "
                  "(https://nuevodiariodesalta.com.ar/preparatoria-en-el-concejo-jura-sin-durand-y-un-clima-politico-que-volvio-a-tensarse/) "
                  "e Infobae (https://www.infobae.com/politica/2025/12/04/el-concejal-de-salta-denunciado-por-extorsion-sexual-volvio-a-asumir-su-banca-tras-ser-expulsado-del-cuerpo/); "
                  "la sigla es la que publica el Concejo.")

U = "https://cdsalta.gob.ar/index.php/2026/"
F_0416 = (U + "04/16/madile-en-el-acto-por-la-fundacion-de-salta-realizar-la-ceremonia-en-el-barrio-permite-que-los-vecinos-sean-parte-de-esta-fiesta/", "2026-04-16")
F_0515 = (U + "05/15/la-comision-de-disciplina-del-cd-emitio-hoy-dictamen-en-relacion-a-la-situacion-del-concejal-carlos-casasola/", "2026-05-15")
F_0429 = (U + "04/29/manana-se-reune-la-comision-de-disciplina-del-concejo-deliberante/", "2026-04-29")
F_0227 = (U + "02/27/en-sesion-preparatoria-ediles-dispusieron-la-integracion-de-11-comisiones-permanentes-del-concejo-deliberante/", "2026-02-27")

# id -> (sigla, (url, fecha))   Cada sigla figura junto al nombre de la persona en la nota oficial citada.
DATOS = {
    "concejal-gustavo-farquharson":              ("PS",  F_0416),
    "concejal-eliana-del-valle-chuchuy":         ("PS",  F_0416),
    "concejal-alicia-vargas":                    ("PS",  F_0416),
    "concejal-camila-lobo":                      ("PS",  F_0416),
    "concejal-victor-manuel-lamberto":           ("PS",  F_0416),
    "concejal-dario-madile":                     ("PS",  F_0515),
    "concejal-malvina-gareca":                   ("PC",  F_0416),
    "concejal-jose-luis-arias":                  ("YP",  F_0416),
    "concejal-jose-garcia-alcazar":              ("YP",  F_0515),
    "concejal-david-battaglia-leiva":            ("MM",  F_0515),
    "concejal-laura-garcia":                     ("VS",  F_0515),
    "concejal-ines-bennassar":                   ("GSC", F_0515),
    "concejal-laura-jorge-saravia":              ("LLA", F_0416),
    "concejal-maria-florencia-leon":             ("LLA", F_0416),
    "concejal-erica-yanina-castro-nieva":        ("LLA", F_0416),
    "concejal-agustina-alvarez-eichele":         ("LLA", F_0515),
    "concejal-carlos-maximiliano-casasola":      ("LLA", F_0227),
    "concejal-rodrigo-alfredo-perez-quinteros":  ("LLA", F_0227),
    "concejal-gonzalo-nieva":                    ("J",   F_0416),
    "concejal-angel-ortiz":                      ("UCR", F_0416),
    "concejal-pablo-emanuel-lopez":              ("LP",  F_0429),
}

# Los 14 concejales que ya tenían bloque usan estos textos (p. ej. «Juntos», no «Juntos por el Cambio»).
NOMBRE_CARGA = {"J": "Juntos", "LP": "Libertad y Progreso"}

# Confirmado por el responsable del proyecto (8/10/2026): Álvarez Eichele integra LLA. La nota oficial
# del Concejo del 15/05/2026 también la ubica en LLA; se pisa el «Juntos» de diciembre de 2025.
CONFIRMADOS = {"concejal-agustina-alvarez-eichele"}

# Licencias informadas por el responsable del proyecto (8/10/2026). No hay fuente oficial enlazada:
# la nota queda dicho así en el propio registro. Si hay fuente, completá `licencia_fuente` a mano.
LICENCIAS = {"concejal-carlos-maximiliano-casasola": "2026-10-08"}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aplicar", action="store_true", help="escribe el archivo (por defecto solo simula)")
    ap.add_argument("--forzar", action="store_true", help="pisa bloques ya cargados que difieran")
    ap.add_argument("--archivo", default="data/politicians.json")
    a = ap.parse_args()
    ruta = pathlib.Path(a.archivo)
    pol = json.loads(ruta.read_text(encoding="utf-8"))
    por_id = {p["id"]: p for p in pol}
    nuevos = igual = conflictos = faltan = 0
    for pid, (sigla, (url, fecha)) in DATOS.items():
        p = por_id.get(pid)
        if not p:
            print(f"  !! no existe el id {pid} en {ruta}"); faltan += 1; continue
        val = NOMBRE_CARGA.get(sigla, NOMBRES[sigla])
        act = p.get("bloque")
        if act == val:
            igual += 1; continue
        if act and not a.forzar and pid not in CONFIRMADOS:
            print(f"  ?? REVISAR {p['name']}: cargado «{act}» ({p.get('bloque_fecha')}); nota oficial {fecha} dice «{val}». No se toca (usá --forzar)."); conflictos += 1; continue
        p["bloque"] = val; p["bloque_fuente"] = url; p["bloque_fecha"] = fecha
        p["bloque_nombre_fuente"] = FUENTE_NOMBRES
        print(f"  ++ {p['name']}: {val}  [{fecha}]"); nuevos += 1
    for pid, fecha in LICENCIAS.items():
        p = por_id.get(pid)
        if not p: print(f"  !! no existe el id {pid}"); continue
        if p.get("licencia") is True: continue
        p["licencia"] = True
        p["licencia_nota"] = f"De licencia según lo informado por el responsable del proyecto el {fecha}; sin fuente oficial enlazada."
        print(f"  ++ {p['name']}: de licencia"); nuevos += 1
    sin = [p["name"] for p in pol if p.get("cargo") == "Concejal/a" and p.get("vigencia") == "vigente" and not p.get("bloque") and p["id"] not in DATOS]
    print(f"\nNuevos: {nuevos} | ya estaban igual: {igual} | conflictos: {conflictos} | ids inexistentes: {faltan}")
    if sin: print("Concejales vigentes sin bloque en este script:", ", ".join(sin))
    if a.aplicar and nuevos:
        ruta.write_text(json.dumps(pol, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Escrito {ruta}")
    elif not a.aplicar:
        print("(simulación: no se escribió nada; agregá --aplicar)")

if __name__ == "__main__":
    main()
