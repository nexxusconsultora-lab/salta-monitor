"""Pruebas de la identidad visual (NEXUS): los íconos existen, son del tamaño correcto y el panel y el bot apuntan a archivos que están.
No usa librerías externas (lee el tamaño de los PNG directamente). Se corren con:  python -m unittest discover -s tests -v"""
import os
import re
import struct
import unittest
import xml.dom.minidom

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ASSETS = os.path.join(RAIZ, "assets")


def tam_png(ruta):
    with open(ruta, "rb") as f:
        cab = f.read(24)
    assert cab[:8] == b"\x89PNG\r\n\x1a\n", ruta + " no es un PNG"
    return struct.unpack(">II", cab[16:24])


class Marca(unittest.TestCase):
    def test_tamanos(self):
        esperados = {"nexus-avatar.png": (640, 640), "nexus-avatar-negro.png": (640, 640), "nexus-app-icon.png": (1024, 1024),
                     "apple-touch-icon.png": (180, 180), "favicon-32.png": (32, 32), "favicon-16.png": (16, 16)}
        for nombre, tam in esperados.items():
            with self.subTest(nombre):
                self.assertEqual(tam_png(os.path.join(ASSETS, nombre)), tam)

    def test_logos_png_proporcion(self):
        for nombre in ("nexus-logo.png", "nexus-logo-blanco.png"):
            ancho, alto = tam_png(os.path.join(ASSETS, nombre))
            self.assertGreater(ancho, 2000)
            self.assertAlmostEqual(ancho / alto, 433.7 / 153.6, delta=0.05)

    def test_svg_validos_y_con_la_paleta_de_la_guia(self):
        for nombre in ("nexus-icono.svg", "nexus-icono-blanco.svg", "nexus-logo.svg", "nexus-logo-blanco.svg", "favicon.svg"):
            with self.subTest(nombre):
                texto = open(os.path.join(ASSETS, nombre), encoding="utf-8").read()
                xml.dom.minidom.parseString(texto)                                    # es XML válido
                self.assertIn("viewBox", texto)
                self.assertTrue(set(re.findall(r'(?:fill|stroke)="(#[0-9A-Fa-f]{6})"', texto)) <= {"#0D0D0D", "#FFFFFF"}, "usa un color fuera de la paleta")
                self.assertNotIn("<text", texto, "el texto va convertido a curvas, para no depender de la tipografía")

    def test_el_panel_y_el_bot_apuntan_a_archivos_que_existen(self):
        panel = open(os.path.join(RAIZ, "index.html"), encoding="utf-8", errors="replace").read()
        bot = open(os.path.join(RAIZ, "cloudflare-worker", "newar-bot.js"), encoding="utf-8").read()
        usados = set(re.findall(r'href="(assets/[^"]+)"', panel)) | set(re.findall(r'"(assets/[A-Za-z0-9_.\-]+\.(?:png|svg))"', bot))
        usados |= set(re.findall(r"(assets/[A-Za-z0-9_.\-]+\.(?:png|svg))", bot))
        self.assertTrue(usados, "no se encontró ninguna referencia a assets/")
        for ruta in sorted(usados):
            with self.subTest(ruta):
                self.assertTrue(os.path.exists(os.path.join(RAIZ, ruta)), f"{ruta} no existe en la carpeta assets/")

    def test_panel_con_el_icono_de_nexus(self):
        panel = open(os.path.join(RAIZ, "index.html"), encoding="utf-8", errors="replace").read()
        self.assertIn('rel="icon" type="image/svg+xml" href="assets/favicon.svg"', panel)
        self.assertIn("nav h1::before", panel)
        regla = re.search(r"nav h1::before\{[^}]*\}", panel).group(0)
        self.assertIn("data:image/svg+xml", regla)                                    # el ícono va embebido (la política de seguridad del panel permite data:)
        self.assertNotIn("var(--clay)", regla)                                        # ya no es el cuadradito de color

    def test_el_bot_usa_el_avatar_de_nexus(self):
        bot = open(os.path.join(RAIZ, "cloudflare-worker", "newar-bot.js"), encoding="utf-8").read()
        self.assertIn("assets/nexus-avatar.png", bot)
        self.assertNotIn("newar-logo", bot)


if __name__ == "__main__":
    unittest.main()
