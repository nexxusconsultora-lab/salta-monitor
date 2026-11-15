# -*- coding: utf-8 -*-
"""
Alarma contra subidas equivocadas: se pone en ROJO si un módulo importante pierde sus funciones clave, o si index.html
pide un archivo que no existe.

Por qué existe: el 14/11/2026 una subida "Add files via upload" reemplazó briefing.js, envivo.js, modern.js y elecciones.js
por versiones mucho más chicas y distintas. Sin avisar, desaparecieron las pestañas Briefing y Mundo y se perdieron funciones.
Esta prueba lo habría detectado en minutos.

Si falla: casi seguro se subió una versión vieja o equivocada del archivo que nombra el mensaje. Se recupera desde el historial
de GitHub (README, sección "Si desaparece una pantalla"). Si el cambio fue a propósito, actualizá la lista MARCAS de este archivo.
Corre desde tests/ o desde scripts/ (busca la raíz del repositorio un nivel más arriba). No usa internet.
"""
import os, re, unittest

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# archivo -> textos que SIEMPRE tienen que estar (registran la pestaña o son el corazón de la función)
MARCAS = {
    "briefing.js": ["['briefing','Briefing']", "mundo.js", "V.briefing"],   # registra Briefing y carga la pestaña Mundo
    "mundo.js": ["V.mundo", "['mundo','Mundo']"],
    "envivo.js": ["V.envivo", "pared de TV"],
    "modern.js": ["window.NXRAMP="],
    "elecciones.js": ["V.elecciones", "simulacro", "noticias", "hitos"],
    "argentina.js": ["V.argentina"],
    "judicial.js": ["V.judicial"],
    "conexiones.js": ["V.conexiones"],
}


def leer(nombre):
    with open(os.path.join(RAIZ, nombre), encoding="utf-8", errors="replace") as f:
        return f.read()


class ModulosClave(unittest.TestCase):
    def test_cada_modulo_conserva_sus_funciones_clave(self):
        faltan = []
        for archivo, marcas in MARCAS.items():
            if not os.path.exists(os.path.join(RAIZ, archivo)):
                faltan.append(f"{archivo}: el archivo no existe")
                continue
            t = leer(archivo)
            for m in marcas:
                if m not in t:
                    faltan.append(f"{archivo} perdió «{m}»")
        self.assertEqual(faltan, [], "\n  " + "\n  ".join(faltan) + "\n  ¿Se subió una versión vieja o equivocada de esos archivos? Mirá el historial en GitHub.")

    def test_index_no_pide_archivos_que_no_existen(self):
        t = leer("index.html")
        faltan = [s for s in re.findall(r'<script[^>]+src="([^"]+)"', t)
                  if not s.startswith(("http://", "https://", "//")) and not os.path.exists(os.path.join(RAIZ, s.split("?")[0]))]
        self.assertEqual(faltan, [], f"index.html pide archivos que no están en el repositorio: {faltan}")

    def test_la_pestana_mundo_tiene_quien_la_cargue(self):
        # mundo.js no figura en index.html: lo carga briefing.js. Si ninguno de los dos lo pide, Mundo desaparece.
        self.assertTrue('src="mundo.js"' in leer("index.html") or "mundo.js" in leer("briefing.js"),
                        "Nadie carga mundo.js: la pestaña Mundo no va a aparecer.")


if __name__ == "__main__":
    unittest.main()
