#!/usr/bin/env python3
"""Fotos de personas para NEWAR.

Uso (desde la raiz del repo; requiere Pillow: pip install pillow):

  python scripts/fotos.py faltantes
      Lista quien todavia no tiene foto (id, nombre, cargo). Escribe fotos_faltantes.csv.

  python scripts/fotos.py agregar ID ARCHIVO --credito "..." [--fuente URL]
      Procesa UNA imagen y la registra para ese id.

  python scripts/fotos.py lote CARPETA --credito "..." [--fuente URL]
      Procesa todas las imagenes de la carpeta cuyo nombre sea <id>.jpg|png|webp.
      Si en la carpeta hay un fuentes.csv (columnas: id,credito,fuente_url), cada fila manda sobre los flags.

  python scripts/fotos.py verificar
      Revisa que cada entrada de data/fotos.json tenga su archivo y su id en la nomina.

Reglas: el credito es obligatorio (de donde salio la foto); nada se inventa ni se genera;
la imagen queda en fotos/<id>.jpg, cuadrada de 256 px, sin EXIF.
"""
import argparse, csv, json, sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
POL = RAIZ / "data" / "politicians.json"
FOT = RAIZ / "data" / "fotos.json"
DIR = RAIZ / "fotos"
LADO = 256
MAX_BYTES = 15 * 1024 * 1024
EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _pillow():
    try:
        from PIL import Image, ImageOps
        return Image, ImageOps
    except ImportError:
        sys.exit("Falta Pillow: pip install pillow")


def cargar_pol():
    return {p["id"]: p for p in json.loads(POL.read_text(encoding="utf-8"))}


def cargar_fotos():
    if FOT.exists():
        d = json.loads(FOT.read_text(encoding="utf-8"))
        d.setdefault("fotos", {})
        return d
    return {"fotos": {}}


def guardar_fotos(d):
    d["fotos"] = dict(sorted(d["fotos"].items()))
    FOT.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def procesar(origen: Path, pid: str):
    Image, ImageOps = _pillow()
    if origen.stat().st_size > MAX_BYTES:
        raise ValueError("pesa mas de 15 MB")
    with Image.open(origen) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        if min(w, h) < 120:
            raise ValueError(f"muy chica ({w}x{h}); minimo 120 px de lado")
        lado = min(w, h)
        # recorte cuadrado: centrado a lo ancho y pegado arriba a lo alto (la cara suele estar arriba)
        x0 = (w - lado) // 2
        y0 = 0
        im = im.crop((x0, y0, x0 + lado, y0 + lado)).resize((LADO, LADO), Image.LANCZOS)
        DIR.mkdir(exist_ok=True)
        destino = DIR / f"{pid}.jpg"
        im.save(destino, "JPEG", quality=85, optimize=True)  # re-guardar descarta EXIF
    return destino


def registrar(d, pid, credito, fuente):
    d["fotos"][pid] = {
        "archivo": f"fotos/{pid}.jpg",
        "credito": credito,
        "fuente_url": fuente or "",
        "fecha": date.today().isoformat(),
    }


def cmd_faltantes(_):
    pol, fot = cargar_pol(), cargar_fotos()["fotos"]
    falta = [p for i, p in pol.items() if i not in fot]
    with open(RAIZ / "fotos_faltantes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "nombre", "cargo", "camara"])
        for p in falta:
            w.writerow([p["id"], p["name"], p.get("cargo") or p.get("role", ""), p.get("chamber", "")])
    print(f"{len(pol) - len(falta)} con foto, {len(falta)} sin foto de {len(pol)}. Lista en fotos_faltantes.csv")


def cmd_agregar(a):
    pol = cargar_pol()
    if a.id not in pol:
        sys.exit(f"El id {a.id!r} no esta en data/politicians.json")
    if not a.credito.strip():
        sys.exit("--credito es obligatorio")
    d = cargar_fotos()
    procesar(Path(a.archivo), a.id)
    registrar(d, a.id, a.credito.strip(), a.fuente)
    guardar_fotos(d)
    print("OK", a.id)


def cmd_lote(a):
    pol, d = cargar_pol(), cargar_fotos()
    carpeta = Path(a.carpeta)
    filas = {}
    fcsv = carpeta / "fuentes.csv"
    if fcsv.exists():
        with open(fcsv, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                filas[(r.get("id") or "").strip()] = r
    ok = mal = 0
    for img in sorted(carpeta.iterdir()):
        if img.suffix.lower() not in EXT:
            continue
        pid = img.stem
        if pid not in pol:
            print(f"SALTEADA {img.name}: el id no esta en la nomina"); mal += 1; continue
        r = filas.get(pid, {})
        credito = (r.get("credito") or a.credito or "").strip()
        fuente = (r.get("fuente_url") or a.fuente or "").strip()
        if not credito:
            print(f"SALTEADA {img.name}: falta credito (usa --credito o fuentes.csv)"); mal += 1; continue
        try:
            procesar(img, pid)
        except Exception as e:
            print(f"SALTEADA {img.name}: {e}"); mal += 1; continue
        registrar(d, pid, credito, fuente); ok += 1
    guardar_fotos(d)
    print(f"{ok} fotos cargadas, {mal} salteadas")


def cmd_verificar(_):
    pol, fot = cargar_pol(), cargar_fotos()["fotos"]
    mal = 0
    for pid, f in fot.items():
        if pid not in pol:
            print("ID que no esta en la nomina:", pid); mal += 1
        if not (RAIZ / f.get("archivo", "")).exists():
            print("Falta el archivo de", pid); mal += 1
        if not f.get("credito"):
            print("Sin credito:", pid); mal += 1
    print("Todo en orden" if not mal else f"{mal} problema(s)")
    return 1 if mal else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="c", required=True)
    sp.add_parser("faltantes").set_defaults(f=cmd_faltantes)
    sp.add_parser("verificar").set_defaults(f=cmd_verificar)
    p = sp.add_parser("agregar"); p.add_argument("id"); p.add_argument("archivo")
    p.add_argument("--credito", required=True); p.add_argument("--fuente", default=""); p.set_defaults(f=cmd_agregar)
    p = sp.add_parser("lote"); p.add_argument("carpeta")
    p.add_argument("--credito", default=""); p.add_argument("--fuente", default=""); p.set_defaults(f=cmd_lote)
    a = ap.parse_args()
    return a.f(a) or 0


if __name__ == "__main__":
    sys.exit(main())
