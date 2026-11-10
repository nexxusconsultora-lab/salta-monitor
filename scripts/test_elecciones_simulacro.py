# -*- coding: utf-8 -*-
"""Pruebas del simulacro de elección (scripts/elecciones.py --simulacro). No usan internet ni tocan elecciones reales."""
import os, re, json, shutil, tempfile, unittest, importlib.util
from datetime import datetime, timedelta
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("elecciones_sim", os.path.join(AQUI, "..", "scripts", "elecciones.py"))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)
RUTA_CFG = os.path.join(AQUI, "..", "data", "elecciones_simulacro.json")


class Reloj:
    def __init__(self):
        self.t = 1000.0

    def mono(self):
        return self.t

    def sleep(self, x):
        self.t += x

    def ahora(self):
        return datetime(2027, 10, 24, 21, 0, tzinfo=R.AR) + timedelta(seconds=self.t - 1000)


def cfg_sim():
    with open(RUTA_CFG, encoding="utf-8") as f:
        return json.load(f)["elecciones"][0]


class Configuracion(unittest.TestCase):
    def test_archivo_de_simulacro(self):
        e = cfg_sim()
        self.assertTrue(e["simulacro"])
        self.assertEqual(e["forzar_estado"], "jornada")
        self.assertIsNone(e["fecha"])  # sin fecha: no hay hora de publicación que esperar
        self.assertEqual(e["fuente_resultados"]["adaptador"], "simulacro")
        self.assertIn("simulacro", R.ADAPTADORES)
        self.assertTrue(R.RUTA_OK.match(e["resultados_url"]))
        # el workflow guarda 'data/elecciones_resultados*.json': el simulacro tiene que caer ahí (y no pisar la elección real)
        self.assertTrue(re.match(r"^data/elecciones_resultados.*\.json$", e["resultados_url"]))
        self.assertNotEqual(e["resultados_url"], "data/elecciones_resultados.json")
        for c in e["candidatos"]:
            self.assertTrue(c["fuente_url"].startswith("https://"))


class Adaptador(unittest.TestCase):
    def setUp(self):
        self.r = Reloj()
        self.p = [mock.patch.object(R.time, "monotonic", self.r.mono), mock.patch.object(R, "ahora", self.r.ahora)]
        for x in self.p:
            x.start()
        R._SIM["t0"] = None

    def tearDown(self):
        for x in self.p:
            x.stop()

    def test_avanza_valida_y_la_lista_a_siempre_lidera(self):
        e, fuente = cfg_sim(), cfg_sim()["fuente_resultados"]
        mesas, margenes, previo = [], [], None
        for minuto in range(0, 14):
            self.r.t = 1000 + minuto * 60
            crudo = R.adaptador_simulacro(fuente, e)
            probs, limpio = R.validar(crudo, e, previo, self.r.ahora())
            self.assertEqual(probs, [], f"minuto {minuto}")
            previo = limpio
            ls = sorted(limpio["categorias"][0]["listas"], key=lambda l: -l["votos"])
            self.assertEqual(ls[0]["nombre"], "Lista Simulada A")
            mesas.append(limpio["mesas"]["escrutadas"])
            margenes.append((ls[0]["votos"] - ls[1]["votos"]) / limpio["categorias"][0]["votos_validos"] * 100)  # en puntos
        self.assertEqual(mesas, sorted(mesas))  # nunca retrocede
        self.assertTrue(all(b > a for a, b in zip(mesas[:12], mesas[1:13])), mesas)  # y avanza en cada consulta, hasta llegar al 100%
        self.assertGreater(mesas[0], 0)
        self.assertEqual(mesas[-1], 1000)  # llegó al 100%
        self.assertGreater(margenes[1], margenes[-1] + 8)  # la diferencia (en puntos) se achica de unos 20 a unos 9
        self.assertGreater(margenes[-1], 5)  # pero la lista A nunca pierde el primer puesto
        c = limpio["categorias"][0]
        self.assertEqual(sum(l["votos"] for l in c["listas"]) + c["en_blanco"] + c["nulos"], limpio["votantes"])

    def test_arranque_nunca_en_cero(self):
        crudo = R.adaptador_simulacro(cfg_sim()["fuente_resultados"], cfg_sim())
        self.assertGreaterEqual(crudo["mesas"]["escrutadas"], 1)
        self.assertEqual(R.validar(crudo, cfg_sim(), None, self.r.ahora())[0], [])


class DePuntaAPunta(unittest.TestCase):
    def setUp(self):
        self.r = Reloj()
        self.tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmp, "data"))
        self.p = [mock.patch.object(R.time, "monotonic", self.r.mono), mock.patch.object(R.time, "sleep", self.r.sleep),
                  mock.patch.object(R, "ahora", self.r.ahora), mock.patch.object(R, "RAIZ", self.tmp),
                  mock.patch.object(R, "CFG", os.path.join(self.tmp, "data", "x.json")), mock.patch.object(R, "guardar_git"),
                  mock.patch.object(R, "alertar")]
        mocks = [x.start() for x in self.p]
        self.git, self.alerta = mocks[5], mocks[6]
        R._SIM["t0"] = None

    def tearDown(self):
        for x in self.p:
            x.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_ensayo_completo(self):
        shutil.copy(RUTA_CFG, os.path.join(self.tmp, "data", "elecciones_simulacro.json"))
        self.assertEqual(R.simulacro(20), 0)
        with open(os.path.join(self.tmp, "data", "elecciones_resultados_simulacro.json"), encoding="utf-8") as f:
            res = json.load(f)
        self.assertEqual(res["mesas"], {"escrutadas": 1000, "total": 1000})
        self.assertEqual(res["eleccion_id"], "simulacro")
        with open(os.path.join(self.tmp, "data", "elecciones_resultados_simulacro_historial.json"), encoding="utf-8") as f:
            h = json.load(f)
        self.assertGreaterEqual(len(h["muestras"]), 10)
        self.assertEqual([m["m"] for m in h["muestras"]], sorted(m["m"] for m in h["muestras"]))
        titulos = [c.args[0] for c in self.alerta.call_args_list]
        self.assertEqual(titulos[0], "Empezó a llegar el conteo")
        self.assertEqual(titulos[-1], "Terminó el simulacro de elección")
        self.assertGreaterEqual(self.git.call_count, 10)  # subió cada dato nuevo
        # no tocó ningún archivo de una elección real
        self.assertEqual(sorted(os.listdir(os.path.join(self.tmp, "data"))),
                         sorted(["elecciones_simulacro.json", "elecciones_resultados_simulacro.json", "elecciones_resultados_simulacro_historial.json"]))

    def test_un_segundo_ensayo_arranca_de_cero(self):
        shutil.copy(RUTA_CFG, os.path.join(self.tmp, "data", "elecciones_simulacro.json"))
        self.assertEqual(R.simulacro(20), 0)
        self.r.t += 3600
        self.assertEqual(R.simulacro(20), 0)  # antes se rechazaba como "el conteo retrocedió"
        with open(os.path.join(self.tmp, "data", "elecciones_resultados_simulacro_historial.json"), encoding="utf-8") as f:
            h = json.load(f)
        self.assertEqual(h["muestras"][0]["m"], 50)  # el historial del primer ensayo se descartó
        with open(os.path.join(self.tmp, "data", "elecciones_resultados_simulacro.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["mesas"]["escrutadas"], 1000)

    def test_nunca_borra_los_archivos_de_una_eleccion_real(self):
        cfg = {"elecciones": [dict(cfg_sim(), resultados_url="data/elecciones_resultados.json"),                       # apunta al archivo real
               dict(cfg_sim(), id="b", simulacro=False, resultados_url="data/elecciones_resultados_otra.json"),       # no es simulacro
               dict(cfg_sim(), id="c", resultados_url="data/elecciones_resultados_c.json",
                    fuente_resultados={"adaptador": "dine_api"})]}                                                    # lector real
        with open(os.path.join(self.tmp, "data", "elecciones_simulacro.json"), "w", encoding="utf-8") as f:
            json.dump(cfg, f)
        archivos = ["elecciones_resultados.json", "elecciones_resultados_historial.json", "elecciones_resultados_otra.json",
                    "elecciones_resultados_otra_historial.json", "elecciones_resultados_c.json", "elecciones_resultados_c_historial.json"]
        for a in archivos:
            with open(os.path.join(self.tmp, "data", a), "w", encoding="utf-8") as f:
                f.write("{}")
        R._reiniciar_simulacro(os.path.join(self.tmp, "data", "elecciones_simulacro.json"))
        self.assertTrue(all(os.path.exists(os.path.join(self.tmp, "data", a)) for a in archivos))

    def test_sin_el_archivo_de_configuracion_avisa_y_no_hace_nada(self):
        self.assertEqual(R.simulacro(5), 1)
        self.assertEqual(os.listdir(os.path.join(self.tmp, "data")), [])


if __name__ == "__main__":
    unittest.main()
