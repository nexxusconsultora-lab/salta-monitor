#!/usr/bin/env python3
"""Controles de integridad de la pestaña Argentina. Sale con código 1 si algo no cierra.
Uso (desde la raíz del repo):  python scripts/validar_argentina.py
No modifica nada. Sirve para correrlo a mano después de tocar data/provincias_ar.json o regenerar el mapa."""
import json, os, re, sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
errores = []


def cargar(n):
    with open(os.path.join(RAIZ, "data", n), encoding="utf-8") as f:
        return json.load(f)


def ok(cond, msg):
    if not cond:
        errores.append(msg)


geo, pr = cargar("geo_argentina.json"), cargar("provincias_ar.json")
gp, pp = geo["provincias"], pr["provincias"]

ok(len(gp) == 24 and len(pp) == 24, f"debe haber 24 jurisdicciones (mapa: {len(gp)}, datos: {len(pp)})")
ok(set(gp) == set(pp), f"las claves del mapa y de los datos no coinciden: {sorted(set(gp) ^ set(pp))}")
suma = sum(p["poblacion"] for p in pp.values())
ok(suma == pr["total_censado"], f"la población suma {suma:,} y el total censado declarado es {pr['total_censado']:,}")
ok(sum(p["diputados"] for p in pp.values()) == pr["congreso"]["diputados"], "los diputados por provincia no suman el total")
ok(sum(p["senadores"] for p in pp.values()) == pr["congreso"]["senadores"], "los senadores por provincia no suman el total")
for k, g in gp.items():
    ok(g["partes"] and all(len(x["d"]) > 20 for x in g["partes"]), f"{k}: trazado vacío")
    ok(len(g.get("c", [])) == 2, f"{k}: falta el punto del rótulo")
ok({x["k"] for x in gp["tierra-del-fuego"]["partes"]} >= {"isla_grande", "atlantico_sur", "antartida"}, "Tierra del Fuego debe tener isla grande, Atlántico Sur y Antártida")
# todo nombre de ejecutivo cargado debe traer fuente
for k, p in pp.items():
    e = p.get("ejecutivo")
    if e and (e.get("gobernador") or e.get("vicegobernador")):
        ok(bool(e.get("fuente")), f"{k}: ejecutivo cargado sin fuente (regla: sin fuente queda vacío)")
        ok(re.match(r"^https?://", e.get("fuente", "")), f"{k}: la fuente del ejecutivo debe ser un enlace http(s)")
if errores:
    print("FALLÓ:")
    for e in errores:
        print(" -", e)
    sys.exit(1)
print(f"OK: 24 jurisdicciones, población {suma:,} = total censado, {pr['congreso']['diputados']} diputados, {pr['congreso']['senadores']} senadores.")
