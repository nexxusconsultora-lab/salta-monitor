# -*- coding: utf-8 -*-
"""Pruebas del clasificador de noticias y publicaciones oficiales electorales (scripts/elecciones_noticias.py).
Los casos salen de titulares reales que el proyecto recolectó. No usan internet."""
import os, json, tempfile, unittest, importlib.util
from datetime import datetime, timezone, timedelta
from unittest import mock

AQUI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("elec_noticias", os.path.join(AQUI, "..", "scripts", "elecciones_noticias.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
AHORA = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)

SI = [  # titulares electorales argentinos que TIENEN que entrar
    "Casi 7 de cada 10 bonaerenses pide un cambio de rumbo para las elecciones bonaerenses - REALPOLITIK",
    "Germán Martínez habló de economía y PASO tras el encuentro con Kicillof y Massa",
    "“No hay que tener miedo a la competencia”: Tolosa Paz defendió las Paso antes de la reunión del PJ Bonaerense",
    "Melconian anunció que será precandidato a presidente: “Hay dos tercios que no quieren los extremos”",
    "Se dio a conocer el dato que explica por qué Javier Milei puede perder las elecciones en 2027",
    "Enrique Cornejo afirmó que Gustavo Sáenz está habilitado para buscar una nueva reelección",
    "Santilli negó que el gobierno apoye la reelección indefinida de los intendentes - La Política Online",
    "Buenos Aires: estalló la pelea por las reelecciones indefinidas de los intendentes - Letra P",
    "Padrón provisorio para las elecciones 2027: dónde y hasta cuándo se puede consultar - TN",
    "El Gobierno busca a contrarreloj la eliminación de las PASO, pero el tiempo apremia",
    "Cristina Kirchner habló de una candidatura presidencial en 2027 - El Tribuno",
    "Ni candidata ni retirada: la Casa Rosada celebra que Cristina Kirchner concentre el juego opositor",
    "Javier Milei le avisa a Patricia Bullrich: el candidato de La Libertad Avanza soy yo - Letra P",
    "El calendario condiciona al Gobierno y coexisten versiones sobre el futuro de la reforma electoral",
    "Pullaro abrió la puerta a un acuerdo con La Libertad Avanza para 2027: “Se verá el año que viene”",
    "Martín Tetaz quiere ser candidato en la Ciudad en un frente que pueda disputar un balotaje contra LLA",
    "El Congreso posterga el debate del Presupuesto 2027 y las PASO por dos semanas",
    "Seis gobernadores no irán por la reelección en 2027 y se adelantó la pelea en las provincias",
    "Nueva integración del Tribunal Electoral de Salta para 2026-2028",
]
NO = [  # ruido que NO tiene que entrar
    "River venció con polémica a Adosivi y quedó a un paso de asegurar la localía",
    "Las banda argentina candidata a tocar en la previa de la final de la Sudamericana - TyC Sports",
    "Argentina y Venezuela, tras las elecciones en EE.UU: “Trump deberá enfrentar mayores controles”",
    "El revés electoral de Donald Trump sacude el mercado energético global: los dilemas para la Argentina",
    "Una causa del caso Alberdi avanza a paso lento y en la otra no hubo ninguna novedad - La Gaceta",
    "Argentina Week 2027: Milei confirmó cuándo será el encuentro de inversiones en Nueva York",
    "Javkin presentó el Presupuesto 2027 de Rosario con facturas para el socialismo y un desafío fiscal a Milei",
    "Nelson Cuevas habló sobre una posible candidatura política en Paraguay",
    "Cómo es el proceso de sucesión presidencial en Paraguay tras la renuncia de Santiago Peña",
    "El canciller Pablo Quirno ratificó la alianza con Estados Unidos tras las elecciones legislativas",
    "Estados Unidos alcanzó un récord de mujeres gobernadoras tras las elecciones de medio término",
    "Un ex candidato a intendente y un empleado municipal de Alberdi condenados a perpetua por asesinar a dos bolivianos",
    "Histórico: con fecha confirmada, Vélez tendrá un debate con los cuatro candidatos a presidente antes de sus elecciones",
    "Elecciones en la UNLP: desde hoy y hasta el viernes se vota en las 17 facultades",
    "Alerta. ¿Me dieron de baja la pensión no contributiva? Paso a paso para chequear la suspensión en Mi Anses",
    "Discapacidad: el Senado dio un paso clave y la nueva ley quedó cerca de ser aprobada",
    "PAMI 2027: qué cambios se esperan para los reintegros y medicamentos",
    "Elecciones en EEUU: cómo se vota y cuándo se sabe el resultado - El Tribuno",
    "Obras urgentes y recursos limitados: la preocupación de los intendentes salteños por el presupuesto 2027",
    "El golazo de Ocampos de chilena que promete ser candidato al Púskas",
]


class Noticias(unittest.TestCase):
    def test_entran(self):
        for t in SI:
            self.assertTrue(M.es_electoral_noticia(t), t)

    def test_no_entran(self):
        for t in NO:
            self.assertFalse(M.es_electoral_noticia(t), t)

    def test_fuente_deportiva_nunca(self):
        self.assertFalse(M.es_electoral_noticia("Los candidatos a presidente del club debaten", "Olé"))
        self.assertFalse(M.es_electoral_noticia("Elecciones en Rosario Central: quién se presenta", "TyC Sports"))

    def test_titular_en_mayusculas_no_activa_paso(self):
        self.assertFalse(M.es_electoral_noticia("ADUANA PASO DE LOS LIBRES AVISO OFICIAL SOBRE EL PASO FRONTERIZO"))

    def test_nivel(self):
        n = M.nivel_noticia
        self.assertEqual(n("Cómo se prepara el Tribunal Electoral de Salta para 2027", "Nacional"), "salta")
        self.assertEqual(n("Gustavo Sáenz y la reelección", "Nacional"), "salta")
        self.assertEqual(n("Los concejales debaten la fecha de las elecciones municipales", "Provincial"), "salta")
        self.assertEqual(n("Sin ceder a los aliados, se frena el debate del Presupuesto y las Paso", "Provincial"), "argentina")
        self.assertEqual(n("Candidaturas 2027: Pullaro y las alianzas", "Provincial"), "argentina")
        self.assertEqual(n("Kicillof y la interna del PJ", "Provincial"), "argentina")


class Oficiales(unittest.TestCase):
    def test_electorales(self):
        for t in ["Decreto 55/2026 - Convócase al Cuerpo Electoral de la Provincia", "Nueva integracion del tribunal electoral por el periodo 2026 2028",
                  "Resolución 12 de la Cámara Nacional Electoral - Cronograma electoral 2027", "Aportes públicos de campaña: distribución entre alianzas"]:
            self.assertTrue(M.es_electoral_oficial(t), t)

    def test_no_electorales(self):
        for t in ["Convocatoria nacional una adolescente de 15 anos suena con encontrar una familia", "ADUANA PASO DE LOS LIBRES Aviso Oficial",
                  "La sesion ordinaria de la fecha paso a cuarto intermedio hasta el miercoles 11", "Innovación Abierta Salta: convocatoria para conectar ciencia y empresas"]:
            self.assertFalse(M.es_electoral_oficial(t), t)

    def test_fecha_votacion(self):
        d = datetime(2026, 11, 6).date()
        self.assertEqual(M.fecha_votacion_detectada("Convócase al Cuerpo Electoral para el día domingo 16 de mayo de 2027", d), "2027-05-16")
        # ignora la fecha del propio decreto (anterior a la publicación) y toma la de la votación
        self.assertEqual(M.fecha_votacion_detectada("Decreto del 5 de noviembre de 2026: convoca a elecciones el 23 de mayo de 2027", d), "2027-05-23")
        self.assertIsNone(M.fecha_votacion_detectada("Convócase al Cuerpo Electoral oportunamente", d))
        self.assertIsNone(M.fecha_votacion_detectada("el 31 de febrero de 2027", d))  # fecha imposible


def n(i, titulo, dias=0, fuente="Infobae", cat="Nacional"):
    return {"id": str(i), "title": titulo, "link": f"https://x.test/{i}", "source": fuente, "category": cat,
            "published_iso": (AHORA - timedelta(days=dias)).isoformat()}


class Construir(unittest.TestCase):
    def test_filtra_ordena_deduplica_y_limita_por_fecha(self):
        noticias = [n(1, "Elecciones 2027: lo que viene", 2), n(2, "Elecciones 2027: lo que viene", 1, "Otro"),  # duplicado
                    n(3, "Otra nota sobre candidaturas a gobernador", 0), n(4, "Elecciones 2027 viejas", 40),
                    n(5, "River gana", 0), n(6, "Candidatura a intendente en Salta", 0.5, "El Tribuno", "Provincial")]
        r = M.construir(noticias, [], AHORA)
        ids = [x["id"] for x in r["noticias"]]
        self.assertEqual(ids, ["3", "6", "2"])  # más nuevo primero, sin duplicado ni viejas ni deportes
        self.assertEqual([x["nivel"] for x in r["noticias"]], ["argentina", "salta", "argentina"])

    def test_tope(self):
        r = M.construir([n(i, f"Elecciones 2027 caso número {i}", 0) for i in range(200)], [], AHORA)
        self.assertEqual(len(r["noticias"]), M.MAX_NOTICIAS)

    def test_convocatoria_detectada(self):
        of = [{"id": "a", "titulo": "Decreto 900/2026 - Convócase al Cuerpo Electoral para el día 16 de mayo de 2027", "url": "https://b.test/a", "fuente": "Boletín Oficial de Salta",
               "jurisdiccion": "Salta", "tipo_acto": "Decreto", "fecha_publicacion": "2026-11-05"},
              {"id": "b", "titulo": "Nueva integracion del tribunal electoral", "url": "https://b.test/b", "fuente": "Boletín", "jurisdiccion": "Salta", "fecha_publicacion": "2026-10-21"},
              {"id": "c", "titulo": "Convocatoria nacional una adolescente de 15 años", "url": "https://b.test/c", "jurisdiccion": "Salta", "fecha_publicacion": "2026-10-27"},
              {"id": "d", "titulo": "Convocase a elecciones provinciales el 9 de mayo de 2027 en Tucumán", "url": "https://b.test/d", "jurisdiccion": "Tucumán", "fecha_publicacion": "2026-11-01"}]
        r = M.construir([], of, AHORA)
        self.assertEqual([x["id"] for x in r["oficiales"]], ["a", "d", "b"])
        self.assertEqual([x["id"] for x in r["convocatorias"]], ["a", "d"])
        self.assertEqual(r["convocatorias"][0]["fecha_detectada"], "2027-05-16")
        self.assertEqual(r["oficiales"][0]["nivel"], "salta")
        self.assertEqual(r["oficiales"][1]["nivel"], "argentina")

    def test_ventana_de_oficiales(self):
        of = [{"id": "v", "titulo": "Convócase al Cuerpo Electoral", "url": "https://b.test/v", "jurisdiccion": "Salta", "fecha_publicacion": "2025-01-01"}]
        self.assertEqual(M.construir([], of, AHORA)["oficiales"], [])


class Principal(unittest.TestCase):
    def test_escribe_solo_si_cambia(self):
        tmp = tempfile.mkdtemp()
        ruta = lambda f: os.path.join(tmp, f)
        with open(ruta("news_general.json"), "w", encoding="utf-8") as f:
            json.dump([n(1, "Elecciones 2027: lo que viene", 1)], f)
        with open(ruta("oficiales.json"), "w", encoding="utf-8") as f:
            json.dump({"items": []}, f)
        patches = [mock.patch.object(M, "NOTICIAS", ruta("news_general.json")), mock.patch.object(M, "OFICIALES", ruta("oficiales.json")),
                   mock.patch.object(M, "SALIDA", ruta("elecciones_noticias.json"))]
        for p in patches:
            p.start()
        os.environ["NEWAR_AHORA"] = "2026-11-06T12:00:00+00:00"
        try:
            self.assertEqual(M.main(), 0)
            with open(ruta("elecciones_noticias.json"), encoding="utf-8") as f:
                a = f.read()
            self.assertIn("generado", a)
            os.environ["NEWAR_AHORA"] = "2026-11-06T12:30:00+00:00"  # otra hora, mismos datos: no se reescribe
            self.assertEqual(M.main(), 0)
            with open(ruta("elecciones_noticias.json"), encoding="utf-8") as f:
                self.assertEqual(f.read(), a)
        finally:
            os.environ.pop("NEWAR_AHORA")
            for p in patches:
                p.stop()

    def test_error_si_faltan_los_datos(self):
        with mock.patch.object(M, "NOTICIAS", "/no/existe.json"):
            self.assertEqual(M.main(), 1)


if __name__ == "__main__":
    unittest.main()
