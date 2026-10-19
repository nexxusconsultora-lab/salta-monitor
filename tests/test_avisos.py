"""Pruebas de los avisos y del clasificador de áreas. Se corren con:  python -m unittest discover -s tests -v
Si una falla después de tocar scripts/resumen_diario.py o scripts/notificar.py, el cambio rompió algo que andaba bien."""
import json
import os
import re
import sys
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "scripts"))
import notificar as N        # noqa: E402
import resumen_diario as R   # noqa: E402

DATA = os.path.join(AQUI, "..", "data")


def nombres():
    try:
        with open(os.path.join(DATA, "politicians.json"), encoding="utf-8") as f:
            return list(R.nombres_conocidos(json.load(f)))
    except OSError:
        return []


def historia(titulo, tema="Política y gobierno", medios=("Infobae", "La Nación"), hora="10:00", **kw):
    h = {"titulo": titulo, "tema": tema, "medios": list(medios), "n_notas": len(medios), "alcance": "Nacional", "lugar": "", "personas": [],
         "links": [{"medio": m, "titulo": titulo, "hora": hora, "url": "https://ejemplo.com/" + str(abs(hash(titulo)) % 10**6)} for m in medios],
         "primera": hora}
    h.update(kw)
    return h


def documento(historias, fecha="2026-10-12"):
    return {"fecha": fecha, "generado": "2026-10-12T20:00:00+00:00", "totales": {"recolectadas": 100},
            "todos": {"historias": historias, "totales": {"notas": 100, "historias": len(historias)}}}


class Clasificador(unittest.TestCase):
    def test_titulares_reales(self):
        """Cada titular del set (tests/gold_titulares.json) cae en el área correcta."""
        with open(os.path.join(AQUI, "gold_titulares.json"), encoding="utf-8") as f:
            gold = json.load(f)
        nom = nombres()
        for titulo, esperado in gold:
            with self.subTest(titulo=titulo[:70]):
                self.assertEqual(R.tema_todos(R.fold(titulo), nom), esperado)

    def test_nota_del_exterior(self):
        for t in ("Marchan en Guatemala el Día de la Resistencia Indígena", "Un terremoto sacudió a Panamá", "Precio del dólar hoy en Brasil"):
            with self.subTest(t=t):
                self.assertTrue(R.solo_extranjero(R.fold(t), []))

    def test_nota_argentina_que_nombra_otro_pais(self):
        for t in ("El alfajor Rasta llega a Estados Unidos", "Argentina e Israel firmaron un acuerdo de defensa", "Javier Milei visita Estados Unidos",
                  "Detuvieron en Aeroparque a dos ciudadanos bolivianos con cocaína", "Accidente fatal en la Panamericana"):
            with self.subTest(t=t):
                self.assertFalse(R.solo_extranjero(R.fold(t), []))


class Titulos(unittest.TestCase):
    def test_saca_el_cartel_del_medio(self):
        casos = [
            ("Todas las empresas tendrán una nueva obligación - El Economista - Últimas noticias económicas de Argentina", "El Economista",
             "Todas las empresas tendrán una nueva obligación"),
            ("Dólar hoy: cómo cotiza - Infobae", "Infobae", "Dólar hoy: cómo cotiza"),
            ("Milei viaja - y vuelve - a EEUU", "Infobae", "Milei viaja - y vuelve - a EEUU"),        # guiones que son parte del titular
            ("Sin cartel alguno", "Clarín", "Sin cartel alguno"),
        ]
        for titulo, medio, esperado in casos:
            with self.subTest(titulo=titulo[:50]):
                self.assertEqual(R.limpiar_titulo(titulo, medio), esperado)


class MasNombrados(unittest.TestCase):
    """El conteo de «quiénes están en las noticias» (scripts/bot_index.py): cuenta textos de titulares, nunca inventa."""

    def setUp(self):
        import bot_index as B
        self.B = B
        self.ps = [{"id": "gustavo-saenz", "n": "Gustavo Sáenz", "c": "Gobernador de Salta", "k": ["gustavo saenz", "saenz"]},
                   {"id": "teodora-riquelme", "n": "Teodora Riquelme", "c": "Diputada", "k": ["teodora riquelme", "riquelme"]},
                   {"id": "ana-cordoba", "n": "Ana Córdoba", "c": "Diputada", "k": ["ana cordoba", "cordoba"]}]

    def hist(self, titulos, tema="Política y gobierno"):
        return [{"t": t, "f": N.plano(t), "d": "2026-10-12", "a": tema, "p": []} for t in titulos]

    def nombres(self, titulos, tema="Política y gobierno"):
        return {r[0]: r for r in self.B.mas_nombrados(self.hist(titulos, tema), self.ps)}

    def test_cuenta_por_apellido(self):
        r = self.nombres(["Javier Milei viaja a Estados Unidos", "Milei respaldó a Caputo", "Luis Caputo habló del dólar", "Pablo Quirno viajó a la ONU"])
        self.assertEqual(r["Javier Milei"][1], 2)
        self.assertEqual(r["Luis Caputo"][1], 2)           # «Caputo» suelto también cuenta
        self.assertNotIn("Pablo Quirno", r)                # una sola historia: todavía no es «nombrado»

    def test_no_son_personas(self):
        r = self.nombres(["Santiago de Chile recibió a Lula", "Santiago de Chile cierra el aeropuerto", "Juan Manuel dijo algo", "Juan Manuel volvió"])
        self.assertNotIn("Santiago de Chile", r)
        self.assertNotIn("Juan Manuel", r)

    def test_persona_con_ficha_por_apellido(self):
        r = self.nombres(["Sáenz reclamó inversiones para los ramales", "PARO DOCENTE: reclaman a GUSTAVO SÁENZ"])
        self.assertEqual(r["Gustavo Sáenz"][2], "gustavo-saenz")
        self.assertEqual(r["Gustavo Sáenz"][3], "Gobernador de Salta")

    def test_apellidos_que_son_lugares_o_deportes_no_cuentan(self):
        r = self.nombres(["Córdoba lidera el ranking", "Clima en Córdoba: lluvias"])
        self.assertNotIn("Ana Córdoba", r)                  # es la provincia
        r = self.nombres(["Riquelme habló tras el empate", "Riquelme y el mercado de pases"], tema="Deportes")
        self.assertNotIn("Teodora Riquelme", r)             # es el de Boca


class Filtros(unittest.TestCase):
    def test_relleno(self):
        for t in ("Quiniela vespertina: los números ganadores de hoy", "Horóscopo de hoy", "Efemérides del 12 de octubre"):
            self.assertTrue(N.es_relleno(historia(t)), t)
        for t in ("Contenido no encontrado", "Noticias de clases", "Últimas noticias de Argentina y el mundo", "Empleos y servicios"):   # páginas de sección, no noticias
            self.assertTrue(N.es_relleno(historia(t)), t)
        self.assertFalse(N.es_relleno(historia("El FMI recortó la proyección de crecimiento")))
        self.assertFalse(N.es_relleno(historia("Las últimas noticias de la causa Vialidad: la Justicia rechazó el pedido")))

    def test_gacetilla_provincial(self):
        sal = ("El Tribuno", "Informate Salta")
        self.assertTrue(N.es_gacetilla(historia("Sáenz inauguró una escuela en Cafayate", medios=sal)))
        self.assertTrue(N.es_gacetilla(historia("El Gobierno de Salta entregó viviendas a familias", medios=sal)))
        # con un medio de afuera de Salta, o con conflicto/plata/policía, es noticia
        self.assertFalse(N.es_gacetilla(historia("Sáenz inauguró una escuela en Cafayate", medios=("Infobae", "El Tribuno"))))
        self.assertFalse(N.es_gacetilla(historia("Sáenz anunció un aumento para estatales y hay reclamos gremiales", medios=sal)))
        self.assertFalse(N.es_gacetilla(historia("Detuvieron a un hombre por robo en Salta", medios=sal)))


class Repetidas(unittest.TestCase):
    def test_misma_noticia(self):
        a = N.firma("Javier Milei respaldó a Luis Caputo y habló sobre la visita del Papa a la Argentina")
        b = N.firma("Milei ratificó a Caputo y habló sobre la visita del Papa León XIV a la Argentina")
        self.assertTrue(N.parecida(a, b))

    def test_notas_distintas(self):
        a = N.firma("Clima en Rosario: cómo estará el tiempo este lunes 12 de octubre")
        b = N.firma("Quiniela de la tarde: los números ganadores de hoy lunes 12 de octubre")
        self.assertFalse(N.parecida(a, b))


class Mensaje(unittest.TestCase):
    def armar(self, historias, edicion="noche", **kw):
        return N.armar_html(documento(historias), "2026-10-12", edicion, **kw)

    def hs(self):
        return [historia("El FMI recortó la proyección de crecimiento de la Argentina", "Economía y finanzas", ("Infobae", "Clarín", "La Nación"), "23:00"),
                historia("Milei respaldó a Caputo ante los rumores de cambios en el Gabinete", "Política y gobierno", ("Infobae", "Perfil"), "18:00"),
                historia("Detuvieron a un hombre por robo en barrio Tres Cerritos de Salta", "Policiales y seguridad", ("El Tribuno",), "20:00", alcance="Salta", lugar="Salta"),
                historia("Lanús venció a Vélez 2-0 y se afianzó en el Grupo A", "Deportes", ("Olé",), "21:00"),
                historia("Una nota vieja de la mañana sobre educación y universidades", "Educación y universidades", ("Infobae",), "08:00")]

    def test_estructura_y_titulares_completos(self):
        largo = "Un titular larguísimo " + "que sigue y sigue " * 12 + "hasta el final completo"
        _, texto, _ = self.armar(self.hs() + [historia(largo, "Salud", ("Infobae", "Perfil"), "19:00")])
        self.assertNotIn("…", texto)                       # nunca se corta un titular
        self.assertIn("hasta el final completo", texto)
        self.assertIn("LO MÁS IMPORTANTE", texto)
        self.assertIn("ECONOMÍA Y FINANZAS", texto)
        self.assertIn("1️⃣", texto)
        self.assertEqual(texto.count("<blockquote expandable>"), texto.count("</blockquote>"))
        self.assertEqual(texto.count("<a "), texto.count("</a>"))

    def test_solo_lo_nuevo_desde_la_edicion_anterior(self):
        _, texto, _ = self.armar(self.hs(), edicion="noche")           # la noche cuenta desde las 16:30
        self.assertNotIn("nota vieja de la mañana", texto)
        _, texto, _ = self.armar(self.hs(), edicion="mediodia")        # el mediodía cuenta desde las 00:00
        self.assertIn("nota vieja de la mañana", texto)

    def test_no_repite_lo_ya_enviado(self):
        _, _, mostradas = self.armar(self.hs())
        enviados = [N.firma(h["titulo"]) for h in mostradas]
        _, texto, _ = self.armar(self.hs(), enviados=enviados)
        self.assertIn("Sin historias nuevas", texto)

    def test_aviso_de_datos_atrasados(self):
        _, texto, _ = self.armar(self.hs(), atraso=6.0)
        self.assertIn("de atraso", texto)
        _, texto, _ = self.armar(self.hs(), atraso=0.5)
        self.assertNotIn("de atraso", texto)

    def test_partir_no_deja_huerfanos(self):
        _, texto, _ = self.armar([historia(f"Noticia número {i} sobre economía y finanzas del país hoy", "Economía y finanzas",
                                           ("Infobae", "Clarín"), "2%d:00" % (i % 4)) for i in range(60)])
        partes = N.partir(texto, medir=lambda t: len(N.sin_etiquetas(t)), tope=900, pegar=True)
        self.assertGreater(len(partes), 1)
        for p in partes:
            self.assertFalse(p.lstrip("\n").startswith("    "), "una parte empieza con una línea de medios suelta")
            ultima = [l for l in p.split("\n") if l.strip()][-1]
            self.assertFalse(ultima.startswith("━"), "una parte termina con un separador")
            self.assertLessEqual(len(N.sin_etiquetas(p)), 900)


class Edicion(unittest.TestCase):
    def test_edicion_por_hora(self):
        from datetime import datetime
        casos = {(8, 45): "manana", (9, 10): "manana", (11, 50): "mediodia", (12, 20): "mediodia", (16, 50): "tarde", (17, 25): "tarde",
                 (20, 50): "noche", (21, 30): "noche"}
        for (h, m), esperado in casos.items():
            self.assertEqual(N.edicion_por_hora(datetime(2026, 10, 12, h, m, tzinfo=N.AR)), esperado, f"{h}:{m}")


if __name__ == "__main__":
    unittest.main()
