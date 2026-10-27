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
UA = "Mozilla/5.0 (compatible; NEWAR/1.0)"
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


def get_json(url, t=30):
    rq = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(rq, timeout=t) as r:
        return json.loads(r.read().decode("utf-8"))


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


def main():
    try:
        previo = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        previo = {}
    ahora = datetime.now(timezone.utc)
    valores, estado = dict(previo.get("valores") or {}), {}
    for ind in INDICADORES:
        v, err = pide(ind)
        if v:
            valores[ind] = v
            estado[ind] = {"ok": True, "paises": len(v)}
        else:
            estado[ind] = {"ok": False, "message": err}
        time.sleep(0.5)
    ok = sum(1 for e in estado.values() if e["ok"])
    out = {"generado": ahora.isoformat(), "anio_actual": ahora.year,
           "fuente": "FMI · World Economic Outlook (DataMapper)",
           "nota": "Datos observados y proyecciones del FMI. Los años desde el actual en adelante son proyecciones. El FMI actualiza el WEO en abril y octubre (con actualizaciones en enero y julio).",
           "indicadores": {k: {"t": t, "u": u} for k, (t, u) in INDICADORES.items()},
           "paises": {k: {"n": n, "r": r} for k, (n, r) in PAISES.items()},
           "valores": valores, "estado": estado}
    if ok == 0 and previo:
        previo["estado"] = estado
        previo["error_ultima_corrida"] = ahora.isoformat()
        out = previo
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"Indicadores actualizados: {ok} de {len(INDICADORES)}")


if __name__ == "__main__":
    main()
