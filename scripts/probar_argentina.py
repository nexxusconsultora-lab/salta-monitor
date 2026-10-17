#!/usr/bin/env python3
"""Prueba automática de la pestaña Argentina (necesita: pip install playwright && playwright install chromium).
Levanta un servidor local, abre la pestaña, y comprueba lo esencial: 24 jurisdicciones dibujadas, clic en una provincia,
dibujar con la pizarra, exportar un PNG y que no haya errores de JavaScript. Sale con código 1 si algo falla.
Uso (desde la raíz del repo):  python scripts/probar_argentina.py"""
import http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(RAIZ)
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), http.server.SimpleHTTPRequestHandler)
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/index.html#/argentina"
fallas, errores = [], []

def ok(c, m):
    print(("  ok  " if c else "  FALLA ") + m)
    if not c: fallas.append(m)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 1500}, accept_downloads=True)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(3500)
    ok(pg.evaluate("document.querySelectorAll('g.apg').length") == 24, "24 jurisdicciones dibujadas")
    ok(pg.evaluate("!!document.querySelector('#tabs a[href=\"#/argentina\"]')"), "la pestaña Argentina está en el menú")
    pg.click(".ar-grid .rr[data-ak='salta']"); pg.wait_for_timeout(300)
    ok("SALTA" in pg.inner_text("#arside").upper() and "1.441.351" in pg.inner_text("#arside"), "el detalle de Salta muestra 1.441.351 habitantes")
    pg.wait_for_timeout(900)  # la página se desplaza con animación al elegir una provincia: esperar a que termine
    box = pg.locator("svg.ag").bounding_box(); x, y = box["x"] + box["width"] * .4, max(box["y"], 0) + 200
    pg.keyboard.press("l"); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 90, y + 40, steps=6); pg.mouse.up(); pg.wait_for_timeout(150)
    ok(pg.evaluate("document.querySelectorAll('#ard .dsh').length") == 1, "la pizarra dibuja una línea")
    pg.click(".ar-menu>button")
    with pg.expect_download() as d: pg.click(".ar-pop button:has-text('PNG')")
    d.value.save_as("/tmp/prueba_argentina.png")
    ok(os.path.getsize("/tmp/prueba_argentina.png") > 50000, "se exporta un PNG")
    pg.keyboard.press("Escape"); pg.evaluate("localStorage.clear()")
    ok(not errores, "sin errores de JavaScript" + (": " + "; ".join(errores[:2]) if errores else ""))
    b.close()
srv.shutdown()
print("\nRESULTADO:", "TODO BIEN" if not fallas else f"{len(fallas)} falla(s)")
sys.exit(1 if fallas else 0)
