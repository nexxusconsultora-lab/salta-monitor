# -*- coding: utf-8 -*-
"""
Alarma contra subidas equivocadas: se pone en ROJO si un módulo importante pierde sus funciones clave, si index.html
pide un archivo que no existe, o si un archivo de datos importante queda vacío o con el formato roto.

Nota: briefing.js y modern.js ya no se controlan acá. El Briefing se incrustó en index.html y modern.js es solo estilo de mapas.

Por qué existe: el 14/11/2026 una subida "Add files via upload" reemplazó briefing.js, envivo.js, modern.js y elecciones.js
por versiones mucho más chicas y distintas. Sin avisar, desaparecieron las pestañas Briefing y Mundo y se perdieron funciones.
Esta prueba lo habría detectado en minutos. Otro caso real: el 13/11/2026 una subida dejó data/politicians.json vacío
(de 173 políticos a 0); se arregló a mano 3 minutos después, pero podría haber pasado desapercibido.

Si falla: casi seguro se subió una versión vieja o equivocada del archivo que nombra el mensaje. Se recupera desde el historial
de GitHub (README, sección "Si desaparece una pantalla"). Si el cambio fue a propósito, actualizá la lista MARCAS de este archivo.
Corre desde tests/ o desde scripts/ (busca la raíz del repositorio un nivel más arriba). No usa internet.
"""
import os, re, json, unittest

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# archivo -> textos que SIEMPRE tienen que estar (registran la pestaña o son el corazón de la función)
MARCAS = {
    # El Briefing vive DENTRO de index.html (así no depende de ningún otro archivo): ahí tienen que estar su pestaña,
    # su pantalla y la carga de mundo.js. El archivo briefing.js ya no se usa y no se controla.
    "index.html": ["['briefing','Briefing']", 'src="mundo.js"', "V.briefing=", "Briefing v2"],
    "mundo.js": ["V.mundo", "['mundo','Mundo']"],
    "envivo.js": ["V.envivo", "pared de TV"],
    "elecciones.js": ["V.elecciones", "simulacro", "noticias", "hitos"],
    "argentina.js": ["V.argentina"],
    "judicial.js": ["V.judicial"],
    "conexiones.js": ["V.conexiones"],
}


# archivo de datos -> (clave de la lista dentro del archivo, o None si el archivo ES la lista, mínimo razonable de elementos)
DATOS = {
    "data/politicians.json": (None, 100),        # hoy ~173
    "data/canales_envivo.json": ("canales", 5),  # hoy 14
    "data/news_general.json": (None, 200),       # hoy ~3500
    "data/oficiales.json": ("items", 200),       # hoy ~2300
    "data/elecciones.json": ("elecciones", 1),
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
        # index.html carga mundo.js directamente. Si esa línea desaparece, la pestaña Mundo desaparece.
        self.assertIn('src="mundo.js"', leer("index.html"), "index.html no carga mundo.js: la pestaña Mundo no va a aparecer.")


    def test_datos_criticos_no_estan_vacios_ni_rotos(self):
        problemas = []
        for archivo, (clave, minimo) in DATOS.items():
            ruta = os.path.join(RAIZ, archivo)
            if not os.path.exists(ruta):
                problemas.append(f"{archivo}: el archivo no existe")
                continue
            try:
                with open(ruta, encoding="utf-8") as f:
                    d = json.load(f)
            except ValueError as e:
                problemas.append(f"{archivo}: no es un JSON válido ({e})")
                continue
            lista = d.get(clave) if clave and isinstance(d, dict) else d
            n = len(lista) if isinstance(lista, (list, dict)) else 0
            if n < minimo:
                problemas.append(f"{archivo}: tiene {n} elementos y debería tener al menos {minimo}")
        self.assertEqual(problemas, [], "\n  " + "\n  ".join(problemas) + "\n  ¿Una subida lo dejó vacío o roto? Recuperá la versión anterior desde el historial de GitHub.")


if __name__ == "__main__":
    unittest.main()
