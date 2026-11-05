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


# ---- precisión en tiempo real: controles, historial, ciclo continuo y subida a Git ----
class Reloj:
    def __init__(self):
        self.t, self.dormidos = 1000.0, []

    def mono(self):
        return self.t

    def sleep(self, x):
        self.dormidos.append(x)
        self.t += x


def pasada(**k):
    r = {"rc": 0, "activas": True, "esperando": None, "cambios": False, "completo": False, "intervalo": 60}
    r.update(k)
    return r


class Controles(unittest.TestCase):
    def test_coherente_no_avisa(self):
        for esc in (100, 1):
            er = {"mesasTotalizadas": 500, "mesasEsperadas": 1000, "mesasTotalizadasPorcentaje": 50.0 / (100 / esc),
                  "cantidadVotantes": 140000, "cantidadElectores": 200000, "participacionPorcentaje": 70.0 / (100 / esc)}
            self.assertEqual(R._controles("Pres", er), [], esc)

    def test_incoherente_avisa(self):
        er = {"mesasTotalizadas": 500, "mesasEsperadas": 1000, "mesasTotalizadasPorcentaje": 80.0,
              "cantidadVotantes": 140000, "cantidadElectores": 200000, "participacionPorcentaje": 55.0}
        av = R._controles("Pres", er)
        self.assertEqual(len(av), 2)
        self.assertIn("80.0%", av[0])

    def test_categoria_menos_avanzada_manda(self):
        R._ROBOTS.clear()
        r1, r2 = resp_dine(mesas=(900, 1000)), resp_dine(mesas=(400, 1000))
        resp = iter([r1, r2])

        def f(url, max_bytes=0, timeout=0, headers=None):
            return 200, "application/json", json.dumps(next(resp)).encode()
        with mock.patch.object(R, "permitido", return_value=True), mock.patch.object(R.time, "sleep"), mock.patch.object(R, "http_get", side_effect=f):
            crudo = R.adaptador_dine_api(FUENTE_DINE, ELE)
        self.assertEqual(crudo["mesas"], {"escrutadas": 400, "total": 1000})
        self.assertEqual(crudo["categorias"][0]["mesas"]["escrutadas"], 900)
        self.assertEqual((crudo["electores"], crudo["votantes"]), (200000, 140000))
        p, o = R.validar(crudo, ELE, None, R.datetime.fromisoformat("2027-10-24T22:05:00-03:00"))
        self.assertEqual(p, [])
        self.assertEqual(o["categorias"][1]["mesas"], {"escrutadas": 400, "total": 1000})
        self.assertEqual(o["electores"], 200000)


class Historial(unittest.TestCase):
    def test_muestras(self):
        tmp = tempfile.mkdtemp()
        destino = os.path.join(tmp, "res.json")
        mk = lambda t, m: {"actualizado": t, "mesas": {"escrutadas": m, "total": 1000},
                           "categorias": [{"id": "1", "votos_validos": 1000, "listas": [{"nombre": "A", "votos": 500}, {"nombre": "B", "votos": 300}] + [{"nombre": f"L{i}", "votos": 10} for i in range(6)]}]}
        R._historial(ELE, mk("2027-10-24T22:00:00-03:00", 100), destino)
        R._historial(ELE, mk("2027-10-24T22:00:00-03:00", 100), destino)  # repetido: no suma
        R._historial(ELE, mk("2027-10-24T22:05:00-03:00", 200), destino)
        with open(destino[:-5] + "_historial.json", encoding="utf-8") as f:
            h = json.load(f)
        self.assertEqual([m["m"] for m in h["muestras"]], [100, 200])
        self.assertEqual(len(h["muestras"][0]["c"][0]["v"]), 5)
        self.assertEqual(h["muestras"][0]["c"][0]["b"], 1000)
        R._historial(dict(ELE, id="otra"), mk("2027-10-24T22:10:00-03:00", 300), destino)  # otra elección: empieza de cero
        with open(destino[:-5] + "_historial.json", encoding="utf-8") as f:
            h = json.load(f)
        self.assertEqual((h["eleccion_id"], len(h["muestras"])), ("otra", 1))

    def test_tope(self):
        tmp = tempfile.mkdtemp()
        destino = os.path.join(tmp, "res.json")
        for i in range(520):
            R._historial(ELE, {"actualizado": f"2027-10-24T22:{i % 60:02d}:00-03:00", "mesas": {"escrutadas": i, "total": 1000},
                               "categorias": [{"id": "1", "listas": [{"nombre": "A", "votos": i}]}]}, destino)
        with open(destino[:-5] + "_historial.json", encoding="utf-8") as f:
            h = json.load(f)
        self.assertEqual(len(h["muestras"]), 500)
        self.assertEqual(h["muestras"][-1]["m"], 519)


class Bucle(unittest.TestCase):
    def setUp(self):
        self.r = Reloj()
        self.p = [mock.patch.object(R.time, "monotonic", self.r.mono), mock.patch.object(R.time, "sleep", self.r.sleep),
                  mock.patch.object(R, "guardar_git")]
        self.git = [x.start() for x in self.p][2]

    def tearDown(self):
        for x in self.p:
            x.stop()

    def test_sin_eleccion_termina_enseguida(self):
        with mock.patch.object(R, "_pasada", return_value=pasada(activas=False)) as m:
            self.assertEqual(R.bucle(170), 0)
        self.assertEqual(m.call_count, 1)

    def test_corre_hasta_agotar_el_tiempo_y_sube_cada_cambio(self):
        with mock.patch.object(R, "_pasada", side_effect=lambda: pasada(cambios=True)) as m:
            self.assertEqual(R.bucle(10), 0)
        self.assertEqual(m.call_count, 10)  # una por minuto durante 10 minutos
        self.assertGreaterEqual(self.git.call_count, 10)
        self.assertTrue(all(x == 60 for x in self.r.dormidos))

    def test_termina_cuando_el_conteo_esta_completo_y_quieto(self):
        with mock.patch.object(R, "_pasada", side_effect=[pasada(cambios=True, completo=True)] + [pasada(completo=True)] * 30) as m:
            self.assertEqual(R.bucle(170), 0)
        self.assertEqual(m.call_count, 11)  # la que trajo el dato + 10 sin novedades

    def test_espera_a_la_hora_de_publicacion(self):
        lim = R.datetime.fromisoformat("2027-10-24T21:00:00-03:00")
        ahora_ = R.datetime.fromisoformat("2027-10-24T20:59:30-03:00")
        with mock.patch.object(R, "ahora", return_value=ahora_), \
                mock.patch.object(R, "_pasada", side_effect=[pasada(esperando=lim), pasada(activas=False)]):
            R.bucle(170)
        self.assertAlmostEqual(self.r.dormidos[0], 30, delta=0.01)

    def test_errores_permanentes_dan_rojo_y_transitorios_no(self):
        with mock.patch.object(R, "_pasada", return_value=pasada(rc=1)):
            self.assertEqual(R.bucle(5), 1)
        with mock.patch.object(R, "_pasada", side_effect=[pasada(rc=1), pasada(cambios=True)] + [pasada(rc=1)] * 10):
            self.assertEqual(R.bucle(5), 0)

    def test_intervalo_configurable_con_piso_de_30s(self):
        e = dict(ELE, intervalo_seg=5)
        tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(tmp, "data"))
        cfg = os.path.join(tmp, "data", "elecciones.json")
        with open(cfg, "w", encoding="utf-8") as f:
            json.dump({"elecciones": [e]}, f)
        os.environ["NEWAR_AHORA"] = "2027-10-24T22:05:00-03:00"
        try:
            with mock.patch.object(R, "RAIZ", tmp), mock.patch.object(R, "CFG", cfg), \
                    mock.patch.dict(R.ADAPTADORES, {"json_normalizado": lambda f, ee: dato()}):
                self.assertEqual(R._pasada()["intervalo"], 30)
        finally:
            os.environ.pop("NEWAR_AHORA")


@unittest.skipUnless(__import__("shutil").which("git"), "no hay git en este equipo")
class SubidaAGit(unittest.TestCase):
    def git(self, cwd, *a):
        env = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
        return R.subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, env=env, check=True).stdout

    def test_sube_y_resiste_cambios_de_otros(self):
        tmp = tempfile.mkdtemp()
        origen = os.path.join(tmp, "origen.git")
        self.git(tmp, "init", "--bare", "-q", origen)
        a, b = os.path.join(tmp, "a"), os.path.join(tmp, "b")
        self.git(tmp, "clone", "-q", origen, a)
        os.makedirs(os.path.join(a, "data"))
        with open(os.path.join(a, "data", "elecciones_resultados.json"), "w") as f:
            f.write("{}")
        self.git(a, "add", "."), self.git(a, "commit", "-q", "-m", "inicio"), self.git(a, "push", "-q", "origin", "HEAD")
        self.git(tmp, "clone", "-q", origen, b)  # otro proceso (otro bot) que también sube cosas
        os.environ["NEWAR_GIT"] = "1"
        try:
            with mock.patch.object(R, "RAIZ", a), mock.patch.object(R.time, "sleep"):
                self.assertTrue(R.guardar_git())  # sin cambios: no hace nada
                n0 = self.git(origen, "rev-list", "--count", "HEAD").strip()
                with open(os.path.join(a, "data", "elecciones_resultados.json"), "w") as f:
                    f.write('{"mesas": 1}')
                with open(os.path.join(a, "data", "elecciones_resultados_historial.json"), "w") as f:
                    f.write("{}")
                with open(os.path.join(b, "otro.txt"), "w") as f:  # el otro bot sube primero
                    f.write("x")
                self.git(b, "add", "."), self.git(b, "commit", "-q", "-m", "otro"), self.git(b, "push", "-q", "origin", "HEAD")
                self.assertTrue(R.guardar_git())
        finally:
            os.environ.pop("NEWAR_GIT")
        self.assertEqual(self.git(origen, "rev-list", "--count", "HEAD").strip(), str(int(n0) + 2))
        self.git(b, "pull", "-q")
        with open(os.path.join(b, "data", "elecciones_resultados.json")) as f:
            self.assertIn('"mesas": 1', f.read())
        self.assertTrue(os.path.exists(os.path.join(b, "data", "elecciones_resultados_historial.json")))
        self.assertTrue(os.path.exists(os.path.join(b, "otro.txt")))

    def test_sin_la_marca_no_toca_git(self):
        os.environ.pop("NEWAR_GIT", None)
        with mock.patch.object(R.subprocess, "run") as m:
            self.assertTrue(R.guardar_git())
        m.assert_not_called()


if __name__ == "__main__":
    unittest.main()
