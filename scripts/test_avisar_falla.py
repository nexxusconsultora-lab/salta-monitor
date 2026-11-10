# -*- coding: utf-8 -*-
"""Pruebas de los avisos al celular (scripts/avisar_falla.py) y de cuándo los pide el ciclo de la noche de elecciones."""
import os, io, json, unittest, importlib.util, contextlib, urllib.error
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))


def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(AQUI, "..", "scripts", nombre + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


A, R = cargar("avisar_falla"), cargar("elecciones")
TOPIC = "abcdefghijklmnop1234"  # 20 caracteres
BOT = "123456789:" + "A" * 35


class Resp:
    def __init__(self, status=200):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Envio(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.dormir = mock.patch.object(A.time, "sleep")
        self.dormir.start()

    def tearDown(self):
        self.dormir.stop()
        self.env.stop()

    def test_sin_canal_no_rompe(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertFalse(A.enviar("t", "x"))
        self.assertIn("No hay ningún canal", out.getvalue())

    def test_ntfy_y_telegram(self):
        os.environ.update(NTFY_TOPIC=TOPIC, NTFY_TOKEN="tok-secreto-1", TELEGRAM_BOT_TOKEN=BOT, TELEGRAM_CHAT_ID="987654321")
        llamadas = []

        def f(req, timeout=0):
            llamadas.append((req.full_url, json.loads(req.data.decode()), dict(req.header_items())))
            return Resp(200)
        with mock.patch.object(A.urllib.request, "urlopen", side_effect=f):
            self.assertTrue(A.enviar("Falló", "Detalle", "https://github.com/x/y/actions/runs/1"))
        u1, c1, h1 = llamadas[0]
        self.assertEqual(u1, "https://ntfy.sh/")
        self.assertEqual((c1["topic"], c1["title"], c1["click"]), (TOPIC, "Falló", "https://github.com/x/y/actions/runs/1"))
        self.assertEqual(h1["Authorization"], "Bearer tok-secreto-1")
        u2, c2, _ = llamadas[1]
        self.assertEqual(u2, f"https://api.telegram.org/bot{BOT}/sendMessage")
        self.assertIn("Falló", c2["text"])
        self.assertIn("https://github.com/x/y/actions/runs/1", c2["text"])

    def test_enlace_no_https_se_ignora(self):
        os.environ.update(NTFY_TOPIC=TOPIC)
        vistos = []
        with mock.patch.object(A.urllib.request, "urlopen", side_effect=lambda req, timeout=0: (vistos.append(json.loads(req.data.decode())), Resp())[1]):
            A.enviar("t", "x", "javascript:alert(1)")
        self.assertNotIn("click", vistos[0])

    def test_configuracion_invalida_se_omite(self):
        os.environ.update(NTFY_TOPIC="corto", TELEGRAM_BOT_TOKEN="no-es-token", TELEGRAM_CHAT_ID="1")
        with mock.patch.object(A.urllib.request, "urlopen") as m:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertFalse(A.enviar("t", "x"))
        m.assert_not_called()
        self.assertIn("omitido", out.getvalue())

    def test_reintenta_en_error_de_red_y_no_en_error_de_credenciales(self):
        os.environ.update(NTFY_TOPIC=TOPIC)
        seq = [urllib.error.URLError("sin red"), Resp(200)]
        with mock.patch.object(A.urllib.request, "urlopen", side_effect=seq) as m:
            self.assertTrue(A.enviar("t", "x"))
        self.assertEqual(m.call_count, 2)
        with mock.patch.object(A.urllib.request, "urlopen", side_effect=urllib.error.HTTPError("u", 401, "no", {}, None)) as m:
            self.assertFalse(A.enviar("t", "x"))
        self.assertEqual(m.call_count, 1)

    def test_nunca_imprime_secretos(self):
        os.environ.update(NTFY_TOPIC=TOPIC, NTFY_TOKEN="tok-secreto-1", TELEGRAM_BOT_TOKEN=BOT, TELEGRAM_CHAT_ID="987654321")
        out = io.StringIO()
        with contextlib.redirect_stdout(out), mock.patch.object(A.urllib.request, "urlopen", side_effect=urllib.error.URLError(f"falló {TOPIC} {BOT} tok-secreto-1")):
            A.enviar("t", "x")
        for secreto in (TOPIC, BOT, "tok-secreto-1", "987654321"):
            self.assertNotIn(secreto, out.getvalue())

    def test_main_siempre_devuelve_cero(self):
        with mock.patch.object(A, "enviar", return_value=False):
            self.assertEqual(A.main(["titulo", "texto"]), 0)


class Reloj:
    def __init__(self):
        self.t = 1000.0

    def mono(self):
        return self.t

    def sleep(self, x):
        self.t += x


def pasada(**k):
    r = {"rc": 0, "activas": True, "esperando": None, "cambios": False, "completo": False, "intervalo": 60, "error": "", "resumen": ""}
    r.update(k)
    return r


class AvisosDelCiclo(unittest.TestCase):
    def setUp(self):
        self.r = Reloj()
        self.p = [mock.patch.object(R.time, "monotonic", self.r.mono), mock.patch.object(R.time, "sleep", self.r.sleep),
                  mock.patch.object(R, "guardar_git"), mock.patch.object(R, "alertar")]
        self.alerta = [x.start() for x in self.p][3]

    def tearDown(self):
        for x in self.p:
            x.stop()

    def titulos(self):
        return [c.args[0] for c in self.alerta.call_args_list]

    def test_primer_dato_avisa_una_sola_vez(self):
        with mock.patch.object(R, "_pasada", side_effect=lambda: pasada(cambios=True, resumen="120 de 1000 mesas escrutadas")):
            R.bucle(10)
        self.assertEqual(self.titulos(), ["Empezó a llegar el conteo"])
        self.assertIn("120 de 1000", self.alerta.call_args_list[0].args[1])

    def test_cinco_errores_seguidos_avisan_y_no_se_repite_enseguida(self):
        with mock.patch.object(R, "_pasada", side_effect=lambda: pasada(rc=1, error="HTTP 500")):
            R.bucle(20)
        self.assertEqual(self.titulos(), ["El recolector no logra leer los resultados"])
        self.assertIn("HTTP 500", self.alerta.call_args_list[0].args[1])

    def test_error_persistente_reavisa_a_los_30_minutos(self):
        with mock.patch.object(R, "_pasada", side_effect=lambda: pasada(rc=1, error="HTTP 500")):
            R.bucle(45)
        self.assertEqual(len(self.titulos()), 2)

    def test_un_error_aislado_no_avisa(self):
        seq = [pasada(rc=1)] + [pasada(cambios=True, resumen="x")] * 3 + [pasada(rc=1)] * 3 + [pasada(cambios=True)] * 10
        with mock.patch.object(R, "_pasada", side_effect=seq + [pasada()] * 30):
            R.bucle(10)
        self.assertEqual(self.titulos(), ["Empezó a llegar el conteo"])

    def test_sin_datos_nuevos_20_minutos(self):
        seq = [pasada(cambios=True, resumen="x")] + [pasada()] * 40
        with mock.patch.object(R, "_pasada", side_effect=seq):
            R.bucle(30)
        self.assertEqual(self.titulos(), ["Empezó a llegar el conteo", "Sin datos nuevos hace 20 minutos"])

    def test_nunca_llegaron_datos_despues_de_la_hora(self):
        with mock.patch.object(R, "_pasada", side_effect=lambda: pasada()):
            R.bucle(30)
        self.assertEqual(self.titulos(), ["Sin datos nuevos hace 20 minutos"])
        self.assertIn("todavía no hay resultados", self.alerta.call_args_list[0].args[1])

    def test_esperar_la_hora_de_publicacion_no_es_falla(self):
        lim = R.datetime.fromisoformat("2027-10-24T21:00:00-03:00")
        ahora_ = R.datetime.fromisoformat("2027-10-24T20:00:00-03:00")
        with mock.patch.object(R, "ahora", return_value=ahora_), mock.patch.object(R, "_pasada", side_effect=lambda: pasada(esperando=lim)):
            R.bucle(30)
        self.assertEqual(self.titulos(), [])

    def test_conteo_completo_no_dispara_aviso_de_silencio(self):
        seq = [pasada(cambios=True, completo=True, resumen="x")] + [pasada(completo=True)] * 40
        with mock.patch.object(R, "_pasada", side_effect=seq):
            R.bucle(60)
        self.assertEqual(self.titulos(), ["Empezó a llegar el conteo"])


class AlertarNoRompe(unittest.TestCase):
    def test_si_el_aviso_falla_la_recoleccion_sigue(self):
        with mock.patch.object(A, "enviar", side_effect=RuntimeError("boom")):
            with mock.patch.dict("sys.modules", {"avisar_falla": A}):
                R.alertar("t", "x")  # no debe lanzar


if __name__ == "__main__":
    unittest.main()
