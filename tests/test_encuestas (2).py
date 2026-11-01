"""Pruebas de la lectura de encuestas en la prensa, del filtro de consultoras y de la validación de datos macro.
Se corren con:  python -m unittest discover -s tests -v   (usa sólo lo que trae Python; no necesita red).
Si una falla después de tocar scripts/encuestas.py, scripts/consultoras.py o scripts/macro.py, el cambio rompió algo que andaba bien."""
import json
import os
import sys
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "scripts"))
import consultoras as C   # noqa: E402
import encuestas as E     # noqa: E402
import macro as M         # noqa: E402


def lee(titulo, enc=("Zuban Córdoba",)):
    return [(r["sujeto"], r["medida"], r["valor"]) for r in E.extrae(titulo, list(enc), pais_ar=enc[0] not in ("AtlasIntel", "Ipsos"))]


class Extraccion(unittest.TestCase):
    def test_desaprobacion_no_es_aprobacion(self):
        self.assertEqual(lee("La desaprobación de la gestión de Milei se ubica en 65,2%, según una encuesta de Zuban Córdoba"),
                         [("Javier Milei", "Desaprobación", 65.2)])

    def test_dos_valores_dos_medidas(self):
        r = lee("Encuesta de Zuban Córdoba: la imagen de Milei está en 35% de aprobación y el 64% desaprueba su gestión")
        self.assertIn(("Javier Milei", "Aprobación", 35.0), r)
        self.assertIn(("Javier Milei", "Desaprobación", 64.0), r)

    def test_lider_extranjero_no_se_atribuye_a_milei(self):
        self.assertEqual(lee("Atención Milei: Donald Trump cae a 32% de aprobación en encuesta Reuters/Ipsos", ("Ipsos",)), [])

    def test_variaciones_no_son_niveles(self):
        self.assertEqual(lee("La confianza en el Gobierno de Milei subió 0,9% en octubre, según la Universidad Torcuato Di Tella", ("Di Tella",)), [])
        self.assertEqual(lee("El índice de la Di Tella cayó 5,9% y tocó el nivel más bajo del mandato de Milei", ("Di Tella",)), [])

    def test_frente_a(self):
        r = lee("Encuesta Zuban Córdoba: peronismo 41 % frente a 37,8 % de La Libertad Avanza de cara a 2027")
        self.assertEqual(sorted(r), sorted([("Peronismo", "Intención de voto", 41.0), ("La Libertad Avanza", "Intención de voto", 37.8)]))

    def test_medida_de_otra_frase_no_se_hereda_entre_tema_y_persona(self):
        r = lee("Encuesta de San Andrés: el 54% dice que no le alcanzan los ingresos y el 60% desaprueba al Gobierno", ("San Andrés",))
        self.assertIn(("Economía", "Sin clasificar", 54.0), r)
        self.assertIn(("Gobierno nacional", "Desaprobación", 60.0), r)

    def test_medida_al_final_vale_para_los_dos(self):
        r = lee("Encuesta Giacobbe: Grabois 21% y Lousteau 15% de imagen positiva", ("Giacobbe",))
        self.assertEqual(sorted(r), sorted([("Juan Grabois", "Imagen positiva", 21.0), ("Martín Lousteau", "Imagen positiva", 15.0)]))

    def test_candidato_extranjero_y_tema_sin_seña_de_argentina(self):
        self.assertEqual(lee("Aprobación de Abelardo de la Espriella cae a menos del 50% en encuesta de AtlasIntel y crece la preocupación por la corrupción", ("AtlasIntel",)), [])

    def test_sin_porcentaje_o_fuera_de_rango(self):
        self.assertEqual(lee("Encuesta Zuban Córdoba: Milei sube en las encuestas"), [])
        self.assertEqual(lee("Encuesta Zuban Córdoba: Milei tiene 140% de aprobación"), [])

    def test_salta(self):
        r = E.extrae("Encuesta Opina Argentina en Salta: Gustavo Sáenz tiene 58% de aprobación", ["Opina Argentina"])
        self.assertEqual((r[0]["sujeto"], r[0]["ambito"], r[0]["valor"]), ("Gustavo Sáenz", "Salta", 58.0))


class Encuestadoras(unittest.TestCase):
    def setUp(self):
        self.enc = E.encuestadoras()
        for e in self.enc:
            e["_pats"] = C.armar_alias({"nombre": e["nombre"], "alias": e["alias"]})

    def quien(self, t):
        return [e["id"] for e in self.enc if E.encuestadora_nombrada(e, t)]

    def test_nombre_comun_exige_contexto(self):
        self.assertEqual(self.quien("Tendencias de consumo: inflación 5% en octubre"), [])
        self.assertEqual(self.quien("Escenarios económicos para 2027: 3% de crecimiento"), [])
        self.assertIn("tendencias", self.quien("Encuesta de Tendencias: Milei tiene 40% de aprobación"))
        self.assertIn("escenarios", self.quien("La consultora Escenarios midió a Sáenz con 52%"))


class Alias(unittest.TestCase):
    def nombra(self, alias, texto):
        return C.nombra(C.armar_alias({"nombre": alias[0], "alias": alias}), texto)

    def test_sigla_dentro_de_otra_palabra(self):
        self.assertFalse(self.nombra(["ONS"], "Las acciones suben"))
        self.assertFalse(self.nombra(["UCA"], "Educación y trabajo"))
        self.assertFalse(self.nombra(["BID"], "Está prohibido"))
        self.assertFalse(self.nombra(["UBS"], "subsidios al gas"))

    def test_sigla_correcta(self):
        self.assertTrue(self.nombra(["UCA"], "Informe de la UCA sobre pobreza"))
        self.assertTrue(self.nombra(["INDEC"], "El Indec informó la inflación"))
        self.assertTrue(self.nombra(["CEPA"], "Informe de Cepa: Misiones perdió empleos"))

    def test_sigla_ambigua_exige_mayusculas(self):
        self.assertFalse(self.nombra(["GRADE"], "AI could push trading of U.S. investment-grade bonds"))
        self.assertTrue(self.nombra(["GRADE"], "Informe de GRADE sobre educación"))


class Seguridad(unittest.TestCase):
    def test_url_ok(self):
        self.assertTrue(C.url_ok("https://news.google.com/rss/articles/abc"))
        for mala in ("file:///etc/passwd", "javascript:alert(1)", "ftp://x.com/a", "https://x.com/a b", "", None, "https://x.com/<script>"):
            self.assertFalse(C.url_ok(mala), mala)

    def test_guardado_atomico(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, "x.json")
            C.guardar_json(ruta, {"a": 1})
            C.guardar_json(ruta, {"a": 2, "ñ": "á"})
            self.assertEqual(json.load(open(ruta, encoding="utf-8")), {"a": 2, "ñ": "á"})
            self.assertEqual(os.listdir(d), ["x.json"])

    def test_macro_descarta_valores_imposibles(self):
        r = M.limpiar({"ARG": {"2024": 5, "2025": float("nan"), "abc": 3, "1800": 2}, "XXX": {"2024": 1}}, "%")
        self.assertEqual(r, {"ARG": {"2024": 5}})
        self.assertEqual(M.limpiar({"ARG": {"2024": -5}}, "USD"), {})


if __name__ == "__main__":
    unittest.main()
