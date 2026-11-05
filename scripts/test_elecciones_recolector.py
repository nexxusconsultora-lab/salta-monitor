# -*- coding: utf-8 -*-
"""Pruebas del recolector de resultados electorales (scripts/elecciones.py). No usan internet."""
import os, sys, json, copy, tempfile, unittest, importlib.util
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("elecciones_rec", os.path.join(AQUI, "..", "scripts", "elecciones.py"))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)

ELE = {"id": "gen", "nombre": "General", "fecha": "2027-10-24", "resultados_url": "data/elecciones_resultados.json",
       "fuente_resultados": {"adaptador": "json_normalizado", "datos_url": "https://ejemplo.test/r.json"}}


def dato(**k):
    d = {"eleccion_id": "gen", "actualizado": "2027-10-24T22:00:00-03:00", "tipo": "provisorio",
         "mesas": {"escrutadas": 500, "total": 1000}, "participacion_pct": 70.5,
         "categorias": [{"id": "g", "nombre": "Gobernador", "votos_validos": 1000,
                         "listas": [{"nombre": "A", "votos": 600}, {"nombre": "B", "votos": "300"}]}]}
    d.update(k)
    return d


class Estado(unittest.TestCase):
    def test_estados(self):
        c = [("2027-08-01", "proxima"), ("2027-08-25", "candidatos"), ("2027-10-23", "candidatos"), ("2027-10-24", "jornada"),
             ("2027-10-31", "post"), ("2027-11-01", "terminada")]
        for hoy, esp in c:
            self.assertEqual(R.estado(ELE, hoy), esp, hoy)
        self.assertEqual(R.estado({"id": "x", "fecha": None}, "2027-10-24"), "sin_fecha")
        self.assertEqual(R.estado({"id": "x", "fecha": "basura"}, "2027-10-24"), "sin_fecha")
        self.assertEqual(R.estado({"id": "x", "forzar_estado": "jornada"}, "2020-01-01"), "jornada")

    def test_embargo(self):
        t = lambda s: R.datetime.fromisoformat(s)
        self.assertIsNotNone(R.embargo(ELE, "jornada", t("2027-10-24T20:59:00-03:00")))
        self.assertIsNone(R.embargo(ELE, "jornada", t("2027-10-24T21:00:00-03:00")))
        self.assertIsNone(R.embargo(ELE, "post", t("2027-10-25T10:00:00-03:00")))
        e2 = dict(ELE, no_publicar_antes="2027-10-24T20:00:00-03:00")
        self.assertIsNone(R.embargo(e2, "jornada", t("2027-10-24T20:30:00-03:00")))
        # 23:30 UTC del 24 = 20:30 de Argentina: todavía no
        self.assertIsNotNone(R.embargo(ELE, "jornada", t("2027-10-24T23:30:00+00:00")))


class Validar(unittest.TestCase):
    T = R.datetime.fromisoformat("2027-10-24T22:05:00-03:00")

    def v(self, d, previo=None):
        return R.validar(d, ELE, previo, self.T)

    def test_ok_y_limpia_tipos(self):
        p, o = self.v(dato())
        self.assertEqual(p, [])
        self.assertEqual(o["categorias"][0]["listas"][1]["votos"], 300)

    def test_rechaza(self):
        casos = [dato(eleccion_id="otra"), dato(actualizado="2027-10-24T22:00:00"), dato(actualizado="2028-01-01T00:00:00Z"),
                 dato(tipo="vivo"), dato(mesas={"escrutadas": 1200, "total": 1000}), dato(mesas={"escrutadas": 1, "total": 0}),
                 dato(participacion_pct=140), dato(categorias=[]),
                 dato(categorias=[{"nombre": "X", "votos_validos": 100, "listas": [{"nombre": "A", "votos": 90}, {"nombre": "B", "votos": 20}]}]),
                 dato(categorias=[{"nombre": "X", "listas": [{"nombre": "A", "votos": -5}]}]), "no es un dict", None]
        for d in casos:
            p, o = self.v(d)
            self.assertTrue(p and o is None, d)

    def test_no_retrocede(self):
        previo = dato(mesas={"escrutadas": 600, "total": 1000})
        p, _ = self.v(dato(), previo)
        self.assertTrue(any("retrocedi" in x for x in p))
        p, _ = self.v(dato(actualizado="2027-10-24T21:00:00-03:00", mesas={"escrutadas": 700, "total": 1000}), previo)
        self.assertTrue(any("viejos" in x for x in p))
        p, _ = self.v(dato(tipo="definitivo"), previo)  # el definitivo puede corregir el provisorio
        self.assertEqual(p, [])


class Robots(unittest.TestCase):
    def setUp(self):
        R._ROBOTS.clear()

    def test_reglas(self):
        for st, body, esp in [(200, b"User-agent: *\nDisallow: /", False), (200, b"User-agent: *\nDisallow: /privado", True),
                              (404, b"", True), (500, b"", False)]:
            R._ROBOTS.clear()
            with mock.patch.object(R, "http_get", return_value=(st, "text/plain", body)):
                self.assertEqual(R.permitido("https://sitio.test/datos.json"), esp, (st, body))
        R._ROBOTS.clear()
        with mock.patch.object(R, "http_get", side_effect=OSError("sin red")):
            self.assertFalse(R.permitido("https://sitio.test/x"))


class Recolectar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmp, "data"))
        self.cfg = os.path.join(self.tmp, "data", "elecciones.json")
        self.out = os.path.join(self.tmp, "data", "elecciones_resultados.json")
        self.p = [mock.patch.object(R, "RAIZ", self.tmp), mock.patch.object(R, "CFG", self.cfg)]
        for x in self.p:
            x.start()
        self.llamadas = 0

    def tearDown(self):
        for x in self.p:
            x.stop()
        os.environ.pop("NEWAR_AHORA", None)

    def leer(self):
        with open(self.out, encoding="utf-8") as f:
            return f.read()

    def correr(self, ahora, e=None, crudo=None):
        with open(self.cfg, "w", encoding="utf-8") as f:
            json.dump({"elecciones": [e or ELE]}, f)
        os.environ["NEWAR_AHORA"] = ahora

        def falso(fuente, ee):
            self.llamadas += 1
            if isinstance(crudo, Exception):
                raise crudo
            return copy.deepcopy(crudo if crudo is not None else dato())
        with mock.patch.dict(R.ADAPTADORES, {"json_normalizado": falso}):
            return R.recolectar()

    def test_sin_eleccion_activa(self):
        self.assertEqual(self.correr("2027-03-01T12:00:00-03:00"), 0)
        self.assertEqual(self.llamadas, 0)
        self.assertFalse(os.path.exists(self.out))

    def test_antes_de_las_21_no_pide_nada(self):
        self.assertEqual(self.correr("2027-10-24T20:00:00-03:00"), 0)
        self.assertEqual(self.llamadas, 0)
        self.assertFalse(os.path.exists(self.out))

    def test_guarda_y_no_repite(self):
        self.assertEqual(self.correr("2027-10-24T22:05:00-03:00"), 0)
        with open(self.out, encoding="utf-8") as f:
            j = json.load(f)
        self.assertEqual(j["mesas"]["escrutadas"], 500)
        self.assertIn("recolectado", j)
        antes = self.leer()
        self.correr("2027-10-24T22:10:00-03:00")  # mismos datos: no se reescribe
        self.assertEqual(self.leer(), antes)

    def test_dato_malo_no_pisa_lo_bueno(self):
        self.correr("2027-10-24T22:05:00-03:00")
        antes = self.leer()
        rc = self.correr("2027-10-24T22:20:00-03:00", crudo=dato(mesas={"escrutadas": 9999, "total": 1000}))
        self.assertEqual(rc, 1)
        self.assertEqual(self.leer(), antes)

    def test_error_de_red(self):
        self.assertEqual(self.correr("2027-10-24T22:05:00-03:00", crudo=OSError("caído")), 1)
        self.assertFalse(os.path.exists(self.out))

    def test_sin_adaptador_no_falla(self):
        e = dict(ELE, fuente_resultados={"nombre": "x", "url": "https://x"})
        self.assertEqual(self.correr("2027-10-24T22:05:00-03:00", e=e), 0)
        e = dict(ELE, fuente_resultados={"adaptador": "adaptador_que_no_existe"})
        self.assertEqual(self.correr("2027-10-24T22:05:00-03:00", e=e), 0)
        self.assertFalse(os.path.exists(self.out))

    def test_ruta_peligrosa(self):
        for ruta in ["../afuera.json", "/tmp/x.json", "data/../x.json", "index.html", "data/sub/x.json"]:
            e = dict(ELE, resultados_url=ruta)
            self.assertEqual(self.correr("2027-10-24T22:05:00-03:00", e=e), 1, ruta)
        self.assertEqual(self.llamadas, 0)

    def test_dia_despues_sigue_activo(self):
        self.assertEqual(self.correr("2027-10-26T11:00:00-03:00", crudo=dato(tipo="definitivo", actualizado="2027-10-26T10:00:00-03:00")), 0)
        self.assertEqual(json.loads(self.leer())["tipo"], "definitivo")


# ---- API de la DINE: respuestas falsas con el formato de la especificación oficial (ValorElectoralTotalizado) ----
def resp_dine(escala=100, base="positivos", fecha="2027-10-24T22:00:00-03:00", mesas=(500, 1000)):
    v = [600, 300, 100]
    sp = sum(v)
    blanco, nulos = 50, 30
    tot = {"positivos": sp, "validos": sp + blanco, "emitidos": sp + blanco + nulos}[base]
    f = escala / 100.0
    return {"fechaTotalizacion": fecha,
            "estadoRecuento": {"mesasEsperadas": mesas[1], "mesasTotalizadas": mesas[0], "mesasTotalizadasPorcentaje": 50.0,
                               "cantidadElectores": 200000, "cantidadVotantes": 140000, "participacionPorcentaje": 70.0},
            "valoresTotalizadosPositivos": [{"idAgrupacion": str(i), "nombreAgrupacion": n, "votos": x, "votosPorcentaje": round(x / tot * 100 * f, 2 if escala == 100 else 6)}
                                            for i, (n, x) in enumerate(zip(["Lista A", "Lista B", "Lista C"], v))],
            "valoresTotalizadosOtros": [{"votosNulos": nulos, "votosEnBlanco": blanco, "votosRecurridosComandoImpugnados": 0}]}


FUENTE_DINE = {"adaptador": "dine_api", "anio": 2027, "tipo_eleccion": 2, "categorias": [{"id": 1, "nombre": "Presidente"}, {"id": 2, "nombre": "Diputados", "distritoId": 17}]}


class Dine(unittest.TestCase):
    def setUp(self):
        R._ROBOTS.clear()
        self.urls, self.cabeceras = [], []
        self.p = [mock.patch.object(R, "permitido", return_value=True), mock.patch.object(R.time, "sleep")]
        for x in self.p:
            x.start()
        os.environ["DINE_TOKEN"] = "abc.def.ghi"

    def tearDown(self):
        for x in self.p:
            x.stop()
        os.environ.pop("DINE_TOKEN", None)

    def falso(self, respuesta=None, status=200):
        def f(url, max_bytes=0, timeout=0, headers=None):
            self.urls.append(url)
            self.cabeceras.append(headers)
            return status, "application/json", json.dumps(respuesta or resp_dine()).encode()
        return mock.patch.object(R, "http_get", side_effect=f)

    def test_base_de_porcentajes(self):
        for esc in (100, 1):
            for base, nombre in [("positivos", "votos positivos"), ("validos", "votos válidos"), ("emitidos", "votos emitidos")]:
                r = resp_dine(escala=esc, base=base)
                self.assertEqual(R._base_porcentajes(r["valoresTotalizadosPositivos"], r["valoresTotalizadosOtros"][0])[0], nombre, (esc, base))
        # porcentajes que no corresponden a ningún total: no se inventa una base
        r = resp_dine()
        for a in r["valoresTotalizadosPositivos"]:
            a["votosPorcentaje"] = 12.34
        self.assertEqual(R._base_porcentajes(r["valoresTotalizadosPositivos"], r["valoresTotalizadosOtros"][0]), (None, None))

    def test_convierte_y_valida(self):
        e = dict(ELE, fuente_resultados=FUENTE_DINE)
        with self.falso(resp_dine(base="validos", fecha="2027-10-24T22:00:00")):  # fecha sin zona: se asume Argentina
            crudo = R.adaptador_dine_api(FUENTE_DINE, e)
        self.assertEqual(self.cabeceras[0], {"Authorization": "Bearer abc.def.ghi"})
        self.assertIn("categoriaId=1", self.urls[0])
        self.assertNotIn("distritoId", self.urls[0])
        self.assertIn("distritoId=17", self.urls[1])
        self.assertEqual(crudo["actualizado"], "2027-10-24T22:00:00-03:00")
        self.assertEqual(crudo["participacion_pct"], 70.0)
        self.assertEqual(crudo["mesas"], {"escrutadas": 500, "total": 1000})
        p, o = R.validar(crudo, e, None, R.datetime.fromisoformat("2027-10-24T22:05:00-03:00"))
        self.assertEqual(p, [])
        c = o["categorias"][0]
        self.assertEqual((c["votos_validos"], c["base_nombre"], c["en_blanco"], c["nulos"]), (1050, "votos válidos", 50, 30))
        self.assertEqual([l["votos"] for l in c["listas"]], [600, 300, 100])

    def test_sin_token_y_error_claro(self):
        os.environ.pop("DINE_TOKEN")
        with self.falso(status=401):
            with self.assertRaises(ValueError) as cm:
                R.adaptador_dine_api(FUENTE_DINE, ELE)
        self.assertIn("DINE_TOKEN", str(cm.exception))
        self.assertIsNone(self.cabeceras[0])  # sin token no se manda cabecera

    def test_otros_errores_y_robots(self):
        with self.falso(status=500):
            with self.assertRaises(ValueError):
                R.adaptador_dine_api(FUENTE_DINE, ELE)
        with self.assertRaises(ValueError):
            R.adaptador_dine_api({"adaptador": "dine_api"}, ELE)
        with mock.patch.object(R, "permitido", return_value=False):
            with self.assertRaises(PermissionError):
                R.adaptador_dine_api(FUENTE_DINE, ELE)

    def test_de_punta_a_punta(self):
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "data"))
        cfg = os.path.join(tmp, "data", "elecciones.json")
        with open(cfg, "w", encoding="utf-8") as f:
            json.dump({"elecciones": [dict(ELE, fuente_resultados=FUENTE_DINE)]}, f)
        os.environ["NEWAR_AHORA"] = "2027-10-24T22:05:00-03:00"
        try:
            with mock.patch.object(R, "RAIZ", tmp), mock.patch.object(R, "CFG", cfg), self.falso():
                self.assertEqual(R.recolectar(), 0)
            with open(os.path.join(tmp, "data", "elecciones_resultados.json"), encoding="utf-8") as f:
                j = json.load(f)
            self.assertEqual(j["mesas"]["escrutadas"], 500)
            self.assertEqual(j["categorias"][1]["nombre"], "Diputados")
        finally:
            os.environ.pop("NEWAR_AHORA")

    def test_sonda_se_detiene_si_falla_la_primera(self):
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "data"))
        with mock.patch.object(R, "RAIZ", tmp), self.falso(status=403):
            self.assertEqual(R.probar_dine(), 0)
        self.assertEqual(len(self.urls), 1)
        with open(os.path.join(tmp, "data", "elecciones_diagnostico_dine.json"), encoding="utf-8") as f:
            self.assertIn("DINE_TOKEN", json.load(f)["distritos"][0]["error"])

    def test_sonda_completa(self):
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "data"))
        with mock.patch.object(R, "RAIZ", tmp), self.falso():
            R.probar_dine()
        self.assertEqual(len(self.urls), 24 + 12)
        self.assertIn("anioEleccion=2023", self.urls[0])


if __name__ == "__main__":
    unittest.main()
