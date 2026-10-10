#!/usr/bin/env python3
"""Genera data/geo_salta.json (mapa geográfico de los 23 departamentos de Salta) para la pestaña Mapa.

Fuente de los límites: Instituto Geográfico Nacional (IGN), capa SIG 250, tal como la publica
https://github.com/mgaitan/departamentos_argentina (archivo departamentos-salta.json).
El repositorio de origen no declara licencia propia: confirmá las condiciones de uso de los datos del IGN
antes de difundir públicamente.

Qué hace: baja el GeoJSON, simplifica cada contorno (Douglas-Peucker, ~700 m), lo proyecta (equirrectangular
con corrección por latitud) y escribe un trazado SVG por departamento. Corre una sola vez; los límites
departamentales no cambian. No toca ningún otro dato.

Uso (desde la raíz del repo):  python scripts/preparar_mapa_salta.py
"""
import json, math, os, sys, unicodedata, urllib.request

URL = "https://raw.githubusercontent.com/mgaitan/departamentos_argentina/master/departamentos-salta.json"
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "geo_salta.json")
TOL = 0.0065      # grados (~700 m)
ANCHO = 760       # ancho del viewBox
NOMBRES = {       # nombre del IGN -> clave que usa index.html (mapaKey)
    "GENERAL JOSE DE SAN MARTIN": "san martin", "GENERAL GÜEMES": "guemes",
}


def fold(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    # versión iterativa (Los Andes tiene miles de puntos)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norma = math.hypot(dx, dy) or 1e-12
        mejor, idx = 0.0, None
        for i in range(a + 1, b):
            d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / norma
            if d > mejor:
                mejor, idx = d, i
        if idx is not None and mejor > tol:
            keep[idx] = True
            pila += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def rdp_anillo(pts, tol):
    """Los contornos son cerrados (primer punto = último): se parten en el punto más lejano y se simplifica cada mitad."""
    if len(pts) < 4:
        return pts
    x0, y0 = pts[0]
    m = max(range(len(pts)), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
    if m in (0, len(pts) - 1):
        return pts
    return rdp(pts[:m + 1], tol)[:-1] + rdp(pts[m:], tol)


def dentro(x, y, pol):
    r = False
    j = len(pol) - 1
    for i in range(len(pol)):
        xi, yi = pol[i]; xj, yj = pol[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            r = not r
        j = i
    return r


def dist_borde(x, y, pol):
    m = 1e18
    for i in range(len(pol) - 1):
        (x1, y1), (x2, y2) = pol[i], pol[i + 1]
        dx, dy = x2 - x1, y2 - y1
        l2 = dx * dx + dy * dy
        u = 0 if l2 == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / l2))
        d = (x - (x1 + u * dx)) ** 2 + (y - (y1 + u * dy)) ** 2
        if d < m:
            m = d
    return m ** 0.5


def centro_visual(contornos, pasos=36):
    """Punto interior más alejado del borde (aprox.): sirve para ubicar la etiqueta aunque el departamento sea cóncavo."""
    mayor = max(contornos, key=lambda s: abs(sum(s[i][0] * s[i + 1][1] - s[i + 1][0] * s[i][1] for i in range(len(s) - 1))))
    xs, ys = [p[0] for p in mayor], [p[1] for p in mayor]
    mejor, pt = -1, (sum(xs) / len(xs), sum(ys) / len(ys))
    for i in range(pasos + 1):
        for j in range(pasos + 1):
            x = min(xs) + (max(xs) - min(xs)) * i / pasos
            y = min(ys) + (max(ys) - min(ys)) * j / pasos
            if dentro(x, y, mayor):
                d = dist_borde(x, y, mayor)
                if d > mejor:
                    mejor, pt = d, (x, y)
    return pt, mejor


def anillos(geom):
    polis = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [anillo for poli in polis for anillo in poli[:1]]   # solo contornos exteriores


def main():
    with urllib.request.urlopen(URL, timeout=60) as r:
        gj = json.load(r)
    feats = gj["features"]
    if len(feats) != 23:
        sys.exit(f"Se esperaban 23 departamentos y llegaron {len(feats)}: no escribo nada.")
    todos = [p for f in feats for a in anillos(f["geometry"]) for p in a]
    lon0, lon1 = min(p[0] for p in todos), max(p[0] for p in todos)
    lat0, lat1 = min(p[1] for p in todos), max(p[1] for p in todos)
    k = math.cos(math.radians((lat0 + lat1) / 2))
    esc = ANCHO / ((lon1 - lon0) * k)
    alto = round((lat1 - lat0) * esc)
    proy = lambda p: ((p[0] - lon0) * k * esc, (lat1 - p[1]) * esc)
    deptos = {}
    for f in feats:
        nombre = f["properties"]["departamento"]
        clave = NOMBRES.get(nombre) or fold(nombre)
        d, area, cx, cy, conts = [], 0.0, 0.0, 0.0, []
        for a in anillos(f["geometry"]):
            s = [proy(p) for p in rdp_anillo([(p[0], p[1]) for p in a], TOL)]
            d.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in s) + "Z")
            conts.append(s)
            for i in range(len(s) - 1):          # centroide por área (fórmula del polígono)
                (x1, y1), (x2, y2) = s[i], s[i + 1]
                c = x1 * y2 - x2 * y1
                area += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c
        (cx, cy), radio = centro_visual(conts)
        deptos[clave] = {"nombre": f["properties"]["departamento"].title().replace(" De ", " de ").replace("General Jose", "General José"),
                         "cabecera": f["properties"]["cabecera"].title(), "d": "".join(d), "c": [round(cx, 1), round(cy, 1)], "r": round(radio, 1)}
    # nombres en castellano correcto para los que .title() deja mal
    deptos["oran"]["nombre"] = "Orán"; deptos["la vina"]["nombre"] = "La Viña"; deptos["metan"]["nombre"] = "Metán"
    deptos["rosario de la frontera"]["nombre"] = "Rosario de la Frontera"; deptos["guemes"]["nombre"] = "General Güemes"; deptos["san martin"]["nombre"] = "General José de San Martín"
    salida = {"fuente": "Instituto Geográfico Nacional (IGN), capa SIG 250, vía github.com/mgaitan/departamentos_argentina",
              "nota": "Contornos simplificados (~700 m) para visualización; no sirven para medir superficies ni límites.",
              "viewBox": [0, 0, ANCHO, alto], "deptos": deptos}
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(salida, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"Escrito {os.path.normpath(SALIDA)}: {len(deptos)} departamentos, {os.path.getsize(SALIDA)//1024} KB, viewBox {ANCHO}x{alto}")


if __name__ == "__main__":
    main()
