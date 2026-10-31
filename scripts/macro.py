# -*- coding: utf-8 -*-
"""
NEWAR · Macro del mundo: baja de la API pública del FMI (DataMapper, World Economic Outlook) los indicadores clave de
Argentina y de decenas de países, con datos observados y proyecciones, y los guarda en data/macro_mundo.json.
No toca nada más. Si la API no responde, el archivo anterior se conserva y se anota el error.
"""
import os, json, time, urllib.request
from datetime import datetime, timezone

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
OUT = os.path.join(DATA, "macro_mundo.json")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
WB = "https://api.worldbank.org/v2/country/{p}/indicator/{i}?format=json&per_page=20000&date=2012:2030"
# Equivalencias del Banco Mundial (solo datos observados, sin proyecciones). PCPIEPCH no tiene equivalente.
WBTIT = {"GGXWDG_NGDP": "Deuda del gobierno central (% del PBI)", "GGXCNL_NGDP": "Resultado fiscal del gobierno central (% del PBI)",
         "LUR": "Desempleo (estimación OIT)"}
WBMAP = {"NGDP_RPCH": "NY.GDP.MKTP.KD.ZG", "PCPIPCH": "FP.CPI.TOTL.ZG", "LUR": "SL.UEM.TOTL.ZS",
         "BCA_NGDPD": "BN.CAB.XOKA.GD.ZS", "GGXWDG_NGDP": "GC.DOD.TOTL.GD.ZS",
         "GGXCNL_NGDP": ["GC.NLD.TOTL.GD.ZS", "GC.BAL.CASH.GD.ZS"], "NGDPDPC": "NY.GDP.PCAP.CD"}
BASE = "https://www.imf.org/external/datamapper/api/v1"

INDICADORES = {
    "NGDP_RPCH": ("PBI real: crecimiento anual", "%"),
    "PCPIPCH": ("Inflación (promedio anual)", "%"),
    "PCPIEPCH": ("Inflación (fin de período)", "%"),
    "LUR": ("Desempleo", "%"),
    "BCA_NGDPD": ("Cuenta corriente (% del PBI)", "% PBI"),
    "GGXWDG_NGDP": ("Deuda bruta del gobierno (% del PBI)", "% PBI"),
    "GGXCNL_NGDP": ("Resultado fiscal (% del PBI)", "% PBI"),
    "NGDPDPC": ("PBI per cápita (USD corrientes)", "USD"),
}
PAISES = {
    "ARG": ("Argentina", "Latinoamérica"), "BRA": ("Brasil", "Latinoamérica"), "CHL": ("Chile", "Latinoamérica"), "URY": ("Uruguay", "Latinoamérica"),
    "PRY": ("Paraguay", "Latinoamérica"), "BOL": ("Bolivia", "Latinoamérica"), "PER": ("Perú", "Latinoamérica"), "COL": ("Colombia", "Latinoamérica"),
    "ECU": ("Ecuador", "Latinoamérica"), "VEN": ("Venezuela", "Latinoamérica"), "MEX": ("México", "Latinoamérica"), "PAN": ("Panamá", "Latinoamérica"),
    "CRI": ("Costa Rica", "Latinoamérica"), "DOM": ("Rep. Dominicana", "Latinoamérica"), "USA": ("Estados Unidos", "Norteamérica"), "CAN": ("Canadá", "Norteamérica"),
    "DEU": ("Alemania", "Europa"), "FRA": ("Francia", "Europa"), "ITA": ("Italia", "Europa"), "ESP": ("España", "Europa"), "GBR": ("Reino Unido", "Europa"),
    "POL": ("Polonia", "Europa"), "TUR": ("Turquía", "Medio Oriente"), "RUS": ("Rusia", "Eurasia"), "UKR": ("Ucrania", "Eurasia"), "SAU": ("Arabia Saudita", "Medio Oriente"),
    "ARE": ("Emiratos Árabes", "Medio Oriente"), "ISR": ("Israel", "Medio Oriente"), "EGY": ("Egipto", "Medio Oriente"), "IRN": ("Irán", "Medio Oriente"),
    "ZAF": ("Sudáfrica", "África"), "NGA": ("Nigeria", "África"), "KEN": ("Kenia", "África"), "ETH": ("Etiopía", "África"), "MAR": ("Marruecos", "África"),
    "CHN": ("China", "Asia-Pacífico"), "JPN": ("Japón", "Asia-Pacífico"), "IND": ("India", "Asia-Pacífico"), "KOR": ("Corea del Sur", "Asia-Pacífico"),
    "IDN": ("Indonesia", "Asia-Pacífico"), "VNM": ("Vietnam", "Asia-Pacífico"), "PHL": ("Filipinas", "Asia-Pacífico"), "PAK": ("Pakistán", "Asia-Pacífico"),
    "AUS": ("Australia", "Oceanía"), "NZL": ("Nueva Zelanda", "Oceanía"),
}


MAX_BYTES = 12 * 1024 * 1024
LIMITE = {"%": (-100.0, 100000.0), "% PBI": (-1000.0, 5000.0), "USD": (0.0, 1e7)}  # rangos físicamente posibles


def valido(v, u):
    import math
    lo, hi = LIMITE.get(u, (-1e9, 1e9))
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and lo <= v <= hi


def limpiar(serie, u):
    """Se descartan valores imposibles (por ejemplo un PBI per cápita negativo o NaN) y años que no son años."""
    out = {}
    for iso, anios in (serie or {}).items():
        if iso not in PAISES or not isinstance(anios, dict):
            continue
        ok = {a: x for a, x in anios.items() if str(a).isdigit() and 1950 <= int(a) <= 2100 and valido(x, u)}
        if ok:
            out[iso] = ok
    return out


def get_json(url, t=30):
    if not url.startswith("https://"):
        raise ValueError("URL no permitida")
    rq = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "Referer": "https://www.imf.org/external/datamapper/"})
    with urllib.request.urlopen(rq, timeout=t) as r:
        datos = r.read(MAX_BYTES + 1)
    if len(datos) > MAX_BYTES:
        raise ValueError("respuesta demasiado grande")
    return json.loads(datos.decode("utf-8"))


def pide(ind):
    paises = "/".join(PAISES)
    err = "sin datos"
    for url in (f"{BASE}/{ind}/{paises}", f"{BASE}/{ind}"):
        try:
            j = get_json(url)
            v = (j.get("values") or {}).get(ind) or {}
            if v:
                return {k: {a: x for a, x in d.items() if isinstance(x, (int, float))} for k, d in v.items() if k in PAISES}, None
        except Exception as ex:  # noqa: BLE001
            err = str(ex)[:140]
    return {}, err


def pide_wb(ind):
    """Respaldo: Banco Mundial (observados; sin proyecciones)."""
    cods = WBMAP.get(ind)
    if not cods:
        return {}, "sin equivalente en Banco Mundial"
    if isinstance(cods, str):
        cods = [cods]
    err = "sin datos"
    for cod in cods:
        try:
            j = get_json(WB.format(p=";".join(PAISES), i=cod), 60)
            filas = j[1] if isinstance(j, list) and len(j) > 1 and j[1] else []
            out = {}
            for f in filas:
                iso, v = f.get("countryiso3code"), f.get("value")
                if iso in PAISES and isinstance(v, (int, float)):
                    out.setdefault(iso, {})[str(f.get("date"))] = round(v, 2)
            if len(out) >= 10:
                return out, None
        except Exception as ex:  # noqa: BLE001
            err = str(ex)[:140]
    return {}, err


def main():
    try:
        previo = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        previo = {}
    ahora = datetime.now(timezone.utc)
    valores, estado = dict(previo.get("valores") or {}), {}
    fuentes = dict(previo.get("fuentes") or {})
    for ind in INDICADORES:
        v, err = pide(ind)
        v = limpiar(v, INDICADORES[ind][1])
        fuente = "FMI"
        if not v:
            v2, err2 = pide_wb(ind)
            v2 = limpiar(v2, INDICADORES[ind][1])
            if v2:
                v, fuente = v2, "Banco Mundial"
            else:
                err = f"FMI: {err} | BM: {err2}"
        if v:
            valores[ind] = v
            fuentes[ind] = fuente
            estado[ind] = {"ok": True, "paises": len(v), "fuente": fuente}
        else:
            estado[ind] = {"ok": False, "message": err}
        time.sleep(0.5)
    ok = sum(1 for e in estado.values() if e["ok"])
    out = {"generado": ahora.isoformat(), "anio_actual": ahora.year,
           "fuente": "FMI · World Economic Outlook (DataMapper)",
           "nota": "Datos del FMI (observados y proyecciones) y, si la API del FMI no responde, del Banco Mundial (solo observados, sin proyecciones). Los años desde el actual en adelante son proyecciones. El FMI actualiza el WEO en abril y octubre (con actualizaciones en enero y julio).",
           "indicadores": {k: {"t": (WBTIT.get(k, t) if fuentes.get(k) == "Banco Mundial" else t), "u": u} for k, (t, u) in INDICADORES.items()},
           "paises": {k: {"n": n, "r": r} for k, (n, r) in PAISES.items()},
           "fuentes": fuentes, "valores": valores, "estado": estado}
    if ok == 0 and previo:
        previo["estado"] = estado
        previo["error_ultima_corrida"] = ahora.isoformat()
        out = previo
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)  # escritura atómica: si se corta a la mitad, queda el archivo anterior
    print(f"Indicadores actualizados: {ok} de {len(INDICADORES)}")


if __name__ == "__main__":
    main()
