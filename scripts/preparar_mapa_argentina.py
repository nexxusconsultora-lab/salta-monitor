#!/usr/bin/env python3
"""Genera data/geo_argentina.json: mapa bicontinental de la República Argentina para la pestaña Argentina.

Fuente de los límites: Instituto Geográfico Nacional (IGN), capa SIG 250, tal como la publica
https://github.com/mgaitan/departamentos_argentina (departamentos-argentina.json). El repositorio de origen no
declara licencia propia: confirmá las condiciones de uso de los datos del IGN antes de difundir públicamente.

Qué hace:
  1. Baja el GeoJSON de los 527 departamentos y los agrupa por provincia (disolviendo los límites internos).
  2. Parte "Tierra del Fuego, Antártida e Islas del Atlántico Sur" en sus tres porciones mirando la geometría
     (no el nombre: en la fuente, el polígono del sector antártico viene rotulado «ISLAS MALVINAS»).
  3. Proyecta la parte americana e insular con una cónica conforme de Lambert, y el sector antártico
     (60°S-90°S, 25°O-74°O) con una acimutal equidistante polar, a la MISMA escala, como inset debajo del mapa.
  4. Simplifica los contornos de a todo el conjunto a la vez (se mantienen los bordes compartidos entre provincias).
  5. Calcula la superficie de cada provincia sobre los contornos originales, con una proyección de área equivalente.

Uso (desde la raíz del repo):  pip install shapely pyproj && python scripts/preparar_mapa_argentina.py
Corre una sola vez; los límites provinciales no cambian. No toca ningún otro dato.
"""
import json, math, os, sys, unicodedata, urllib.request

import numpy as np
import shapely
from shapely.geometry import shape, MultiPolygon, Polygon, box
from shapely.ops import unary_union
from shapely import affinity
from pyproj import Transformer

URL = "https://raw.githubusercontent.com/mgaitan/departamentos_argentina/master/departamentos-argentina.json"
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "geo_argentina.json")

# clave, nombre, código INDEC de provincia, capital
PROVINCIAS = [
    ("buenos-aires", "Buenos Aires", "06", "La Plata"),
    ("caba", "Ciudad Autónoma de Buenos Aires", "02", "Buenos Aires"),
    ("catamarca", "Catamarca", "10", "San Fernando del Valle de Catamarca"),
    ("chaco", "Chaco", "22", "Resistencia"),
    ("chubut", "Chubut", "26", "Rawson"),
    ("cordoba", "Córdoba", "14", "Córdoba"),
    ("corrientes", "Corrientes", "18", "Corrientes"),
    ("entre-rios", "Entre Ríos", "30", "Paraná"),
    ("formosa", "Formosa", "34", "Formosa"),
    ("jujuy", "Jujuy", "38", "San Salvador de Jujuy"),
    ("la-pampa", "La Pampa", "42", "Santa Rosa"),
    ("la-rioja", "La Rioja", "46", "La Rioja"),
    ("mendoza", "Mendoza", "50", "Mendoza"),
    ("misiones", "Misiones", "54", "Posadas"),
    ("neuquen", "Neuquén", "58", "Neuquén"),
    ("rio-negro", "Río Negro", "62", "Viedma"),
    ("salta", "Salta", "66", "Salta"),
    ("san-juan", "San Juan", "70", "San Juan"),
    ("san-luis", "San Luis", "74", "San Luis"),
    ("santa-cruz", "Santa Cruz", "78", "Río Gallegos"),
    ("santa-fe", "Santa Fe", "82", "Santa Fe"),
    ("santiago-del-estero", "Santiago del Estero", "86", "Santiago del Estero"),
    ("tierra-del-fuego", "Tierra del Fuego, Antártida e Islas del Atlántico Sur", "94", "Ushuaia"),
    ("tucuman", "Tucumán", "90", "San Miguel de Tucumán"),
]


def fold(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()


def clave_de(prov):
    f = fold(prov)
    for k, nom, _, _ in PROVINCIAS:
        if fold(nom) == f:
            return k
    return {"ciudad autonoma de buenos aires": "caba", "tierra del fuego": "tierra-del-fuego"}.get(f)


def cargar():
    print("Bajando", URL)
    req = urllib.request.Request(URL, headers={"User-Agent": "newar-salta-monitor/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def partes(geoms_por_prov):
    """Devuelve {(clave, parte): geometría WGS84}. Tierra del Fuego se parte por ubicación."""
    out = {}
    for k, gs in geoms_por_prov.items():
        if k != "tierra-del-fuego":
            out[(k, "")] = unary_union(gs["geoms"])
            continue
        cont, islas, antar = [], [], []
        for g, nom in zip(gs["geoms"], gs["nombres"]):
            if g.bounds[1] < -80:                # llega casi al polo: sector antártico (en la fuente viene rotulado «ISLAS MALVINAS»)
                antar.append(g)
            elif nom == "ISLAS DEL ATLANTICO SUR":
                islas.append(g)
            else:                                # Río Grande y Ushuaia: la isla grande de Tierra del Fuego
                cont.append(g)
        out[(k, "isla_grande")] = unary_union(cont)
        out[(k, "atlantico_sur")] = unary_union(islas)
        out[(k, "antartida")] = unary_union(antar)
    return out


def main():
    d = cargar()
    por = {}
    for f in d["features"]:
        p = f["properties"]
        k = clave_de(p["provincia"])
        if not k:
            print("Provincia no reconocida:", p["provincia"]); sys.exit(1)
        por.setdefault(k, {"geoms": [], "nombres": []})
        g = shape(f["geometry"]).buffer(0)
        # la fuente trae un vértice en -90,00000011° (fuera de rango): se lo lleva al polo
        g = shapely.transform(g, lambda c: np.column_stack((c[:, 0], np.clip(c[:, 1], -90, 90))))
        por[k]["geoms"].append(g)
        por[k]["nombres"].append(p["departamento"])
    faltan = [k for k, *_ in PROVINCIAS if k not in por]
    if faltan:
        print("Faltan provincias:", faltan); sys.exit(1)

    P = partes(por)
    print("Porciones:", sorted(f"{k}/{a}" if a else k for k, a in P))

    # --- superficies (sobre los contornos originales, proyección de área equivalente de Lambert) ---
    laea = Transformer.from_crs("EPSG:4326", "+proj=laea +lat_0=-45 +lon_0=-60 +datum=WGS84 +units=m", always_xy=True)
    laea_polo = Transformer.from_crs("EPSG:4326", "+proj=laea +lat_0=-90 +lon_0=0 +datum=WGS84 +units=m", always_xy=True)
    from shapely.ops import transform  # noqa
    sup = {}
    for (k, a), g in P.items():
        t = laea_polo if a == "antartida" else laea
        sup.setdefault(k, {})[a or "continental"] = round(transform(t.transform, g).area / 1e6)

    # --- proyección del mapa: cónica conforme de Lambert para América + islas ---
    lcc = Transformer.from_crs("EPSG:4326", "+proj=lcc +lat_1=-33 +lat_2=-52 +lat_0=-42 +lon_0=-63 +datum=WGS84 +units=m", always_xy=True)
    proy = {}
    for (k, a), g in P.items():
        if a == "antartida":
            continue
        proy[(k, a)] = transform(lcc.transform, g)

    # --- sector antártico: acimutal equidistante polar, meridiano central 49,5°O hacia arriba ---
    LC = -49.5
    R = 6371008.8
    ESC_ANT = 0.5   # el inset antártico va a la mitad de la escala del mapa americano, para que entre junto al mapa

    def antartico(x, y, z=None):
        xs, ys = [], []
        for lon, lat in zip(x, y):
            rho = math.radians(90 + lat) * R * ESC_ANT
            dl = math.radians(lon - LC)
            xs.append(rho * math.sin(dl)); ys.append(rho * math.cos(dl))
        return xs, ys

    from shapely.ops import transform as tr
    antar = tr(antartico, P[("tierra-del-fuego", "antartida")])

    # posición del inset: el polo cae sobre el Atlántico, al este de Buenos Aires y al norte de Malvinas y Georgias
    cx_polo, cy_polo = lcc.transform(-43.0, -47.5)
    arco = math.radians(30) * R * ESC_ANT                      # 60°S está a 30° del polo
    antar = affinity.translate(antar, cx_polo, cy_polo)
    proy[("tierra-del-fuego", "antartida")] = antar

    # --- simplificación conjunta (se conservan los bordes compartidos) ---
    claves = list(proy.keys())
    geoms = [proy[c] for c in claves]
    TOL = 2500  # m
    try:
        simp = list(shapely.coverage_simplify(geoms, TOL))
        print("coverage_simplify OK")
    except Exception as e:
        print("coverage_simplify no se pudo (", e, "); se simplifica de a una")
        simp = [g.simplify(TOL, preserve_topology=True) for g in geoms]

    # --- pasar a coordenadas SVG ---
    W = 900.0
    from shapely.geometry import LineString
    arco_m = [(cx_polo + arco * math.sin(math.radians(l - LC)), cy_polo + arco * math.cos(math.radians(l - LC))) for l in [-74 + i * (49 / 48) for i in range(49)]]
    allb = unary_union(simp + [LineString(arco_m + [(cx_polo, cy_polo)])]).bounds
    pad = 60_000
    x0, y0, x1, y1 = allb[0] - pad, allb[1] - pad, allb[2] + pad, allb[3] + pad
    esc = W / (x1 - x0)
    H = (y1 - y0) * esc

    def px(x, y):
        return (round((x - x0) * esc, 1), round((y1 - y) * esc, 1))

    def anillo(c):
        pts = [px(x, y) for x, y in c]
        # quitar repetidos consecutivos tras el redondeo
        out = [pts[0]]
        for p in pts[1:]:
            if p != out[-1]:
                out.append(p)
        if len(out) < 4:
            return ""
        return "M" + "L".join(f"{x} {y}" for x, y in out[:-1]) + "Z"

    def trazado(g, min_km2):
        polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
        s = []
        for p in polys:
            if p.is_empty or p.area / 1e6 < min_km2:
                continue
            s.append(anillo(list(p.exterior.coords)))
            for h in p.interiors:
                if Polygon(h).area / 1e6 >= max(min_km2 * 4, 50):
                    s.append(anillo(list(h.coords)))
        return "".join(x for x in s if x)

    provs = {}
    for (k, a), g in zip(claves, simp):
        nom, ind, cap = next((n, i, c) for kk, n, i, c in PROVINCIAS if kk == k)
        e = provs.setdefault(k, {"nombre": nom, "indec": ind, "capital": cap, "partes": []})
        minkm = 40 if a in ("atlantico_sur",) else (5 if k == "caba" else 15)
        d_ = trazado(g, minkm)
        if not d_:
            continue
        mayor = max(g.geoms, key=lambda p: p.area) if isinstance(g, MultiPolygon) else g
        rp = mayor.representative_point()
        e["partes"].append({"k": a or "continental", "d": d_, "c": list(px(rp.x, rp.y))})
    for k, e in provs.items():
        e["superficie_km2"] = sup[k]
        e["c"] = e["partes"][0]["c"]
        if k == "tierra-del-fuego":
            # el rótulo va en la isla grande, no en el sector antártico
            e["c"] = next(p["c"] for p in e["partes"] if p["k"] == "isla_grande")

    # marco del sector antártico y su arco de 60°S, para dibujar la guía
    arco_pts = []
    for lon in [-74 + i * (49 / 48) for i in range(49)]:
        dl = math.radians(lon - LC)
        arco_pts.append(px(cx_polo + arco * math.sin(dl), cy_polo + arco * math.cos(dl)))
    guia = {
        "polo": list(px(cx_polo, cy_polo)),
        "arco60": "M" + "L".join(f"{x} {y}" for x, y in arco_pts),
        "lado_o": "M" + f"{px(cx_polo, cy_polo)[0]} {px(cx_polo, cy_polo)[1]}L{arco_pts[0][0]} {arco_pts[0][1]}",
        "lado_e": "M" + f"{px(cx_polo, cy_polo)[0]} {px(cx_polo, cy_polo)[1]}L{arco_pts[-1][0]} {arco_pts[-1][1]}",
    }
    def en_mapa(lon, lat):
        x, y = lcc.transform(lon, lat)
        return list(px(x, y))
    def en_inset(lon, lat):
        dl = math.radians(lon - LC)
        rho = math.radians(90 + lat) * R * ESC_ANT
        return list(px(cx_polo + rho * math.sin(dl), cy_polo + rho * math.cos(dl)))
    etiquetas = [
        {"t": "Islas Malvinas", "c": en_mapa(-59.5, -51.7), "dy": -10},
        {"t": "Islas Georgias del Sur", "c": en_mapa(-36.5, -54.3), "dy": 16},
        {"t": "Islas Sandwich del Sur", "c": en_mapa(-26.5, -58.0), "dy": 16},
        {"t": "Sector Antártico Argentino", "c": en_inset(-49.5, -64.0), "dy": 0, "inset": True},
        {"t": "60°S", "c": en_inset(-74.0, -60.0), "dy": -4, "inset": True},
    ]
    salida = {
        "etiquetas": etiquetas,
        "fuente": "Instituto Geográfico Nacional (IGN), capa SIG 250, vía github.com/mgaitan/departamentos_argentina",
        "nota": ("Contornos simplificados (~2,5 km) para visualización; no sirven para medir superficies ni límites. "
                 "Parte americana e insular: proyección cónica conforme de Lambert. Sector antártico (60°S-90°S, 25°O-74°O): "
                 "proyección acimutal equidistante polar, a la mitad de la escala, como inset. Las superficies se calcularon sobre los "
                 "contornos originales con una proyección de área equivalente y pueden diferir de las cifras oficiales."),
        "escala_antartida": ESC_ANT,
        "viewBox": [0, 0, round(W, 1), round(H, 1)],
        "guia": guia,
        "provincias": dict(sorted(provs.items())),
    }
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))
    print("Escrito", os.path.normpath(SALIDA), round(os.path.getsize(SALIDA) / 1024), "KB; viewBox", salida["viewBox"])
    for k in ("salta", "buenos-aires", "santa-cruz", "tierra-del-fuego", "caba"):
        print(k, sup[k])


if __name__ == "__main__":
    main()
