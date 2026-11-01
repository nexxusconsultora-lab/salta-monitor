#!/usr/bin/env python3
"""Pruebas automáticas del mapa de la Argentina (pestaña #/argentina) y de su contrato público NEWAR_MAPA.

Requisitos:  pip install playwright && playwright install chromium
Uso (desde la raíz del repo):  python scripts/probar_argentina.py
Levanta un servidor local en un puerto libre, abre Chromium sin ventana y sale con código 1 si algo falla.
No modifica ningún archivo del repo.

Cubre: carga y procedencia, zoom físico (botones, rueda y pellizco simulado), encuadres Argentina/Salta, pantalla completa
(rol de diálogo, foco, salida, que nada tape el mapa), selección y filtro sincronizados con la lista, teclado, estados (vacío,
error parcial y total, reintento), jurisdicción sin ubicación, contrato de intents (API y evento), delegación al mapa de Salta y móvil.
No cubre: pellizco en un dispositivo real, ni Firefox/Safari, ni lectores de pantalla reales.
"""
import http.server, json, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(RAIZ)


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Silencioso)
srv.daemon_threads = True
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
fallas, errores = [], []
GEO = json.load(open(os.path.join(RAIZ, "data", "geo_argentina.json"), encoding="utf-8"))


def ok(c, m):
    print(("  ok    " if c else "  FALLA ") + m)
    if not c:
        fallas.append(m)


def vb(pg, sel="svg.ag"):
    return [float(x) for x in pg.get_attribute(sel, "viewBox").split()]


def abrir(b, ruta="argentina", viewport=None, touch=False, antes=None):
    for viejo in list(b.contexts):  # cada escenario arranca limpio: sin páginas ni pantalla completa heredadas
        viejo.close()
    ctx = b.new_context(viewport=viewport or {"width": 1440, "height": 1500}, has_touch=touch)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errores.append(str(e)))
    if antes:
        antes(pg)
    pg.goto(f"{BASE}#/{ruta}")
    return pg


def listo(pg, sel="svg.ag", t=12000):
    pg.wait_for_selector(sel, timeout=t)
    pg.wait_for_timeout(600)


def grupo(t):
    print("\n" + t)


def bloquear(patron, estado=None):
    def f(pg):
        if estado is None:
            pg.route(patron, lambda r: r.abort())
        else:
            pg.route(patron, lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(estado)))
    return f


with sync_playwright() as p:
    b = p.chromium.launch()

    grupo("1. Carga, datos y procedencia")
    pg = abrir(b); listo(pg)
    ok(pg.evaluate("document.querySelectorAll('g.apg').length") == 24, "24 jurisdicciones dibujadas")
    ok("Fuente:" in pg.inner_text(".ar-hud"), "la tarjeta del mapa indica la fuente del indicador")
    ok("Zoom ×1,0" in pg.inner_text(".ar-hud"), "la tarjeta muestra el zoom actual")
    ok(pg.evaluate("document.querySelectorAll('.ar-alt tbody tr').length") == 24, "hay una tabla de texto con las 24 jurisdicciones (alternativa accesible)")
    ok(pg.evaluate("document.getElementById('ar-desc').textContent.length") > 80, "el mapa tiene descripción textual (aria-describedby)")
    ok(pg.evaluate("document.querySelectorAll('svg.ag g.apg[tabindex=\"0\"]').length") == 1, "solo una provincia está en el orden de tabulación (foco itinerante)")
    ok(pg.evaluate("NEWAR_MAPA.estado().datos.contornos && NEWAR_MAPA.estado().datos.valores"), "el estado informa que contornos y valores cargaron")

    grupo("2. Zoom con controles físicos")
    v0 = vb(pg)
    pg.click(".ar-w .mz button[aria-label='Acercar']"); pg.wait_for_timeout(200)
    v1 = vb(pg); ok(v1[2] < v0[2] - 1, "el botón + acerca")
    pg.click(".ar-w .mz button[aria-label='Alejar']"); pg.wait_for_timeout(200)
    ok(vb(pg)[2] > v1[2], "el botón − aleja")
    pg.click(".ar-w .mz button[aria-label='Alejar']"); pg.click(".ar-w .mz button[aria-label='Alejar']"); pg.wait_for_timeout(200)
    ok(abs(vb(pg)[2] - v0[2]) < 1.5, "no se puede alejar más allá del encuadre inicial")
    box = pg.locator("svg.ag").bounding_box()
    pg.mouse.move(box["x"] + box["width"] * .4, box["y"] + 300); pg.mouse.wheel(0, -400); pg.wait_for_timeout(250)
    ok(vb(pg)[2] < v0[2] - 1, "la rueda del mouse acerca")
    pg.click(".ar-w .mz button[aria-label^='Volver al encuadre inicial']"); pg.wait_for_timeout(250)
    ok(abs(vb(pg)[2] - v0[2]) < 1.5, "el botón de encuadre inicial vuelve a toda la Argentina")

    grupo("3. Encuadres Argentina y Salta")
    pg.click(".ar-nav button:has-text('Salta')"); pg.wait_for_timeout(500)
    e = pg.evaluate("NEWAR_MAPA.estado()")
    ok(e["encuadre"] == "salta" and e["seleccion"] == "salta" and e["zoom"] > 1.5, "«Salta» acerca y selecciona Salta")
    ok("SALTA" in pg.inner_text("#arside").upper() and "Departamentos" in pg.inner_text(".ar-nav"), "el panel muestra Salta y se ofrece ir al mapa de departamentos")
    pg.click(".ar-nav button:has-text('Argentina')"); pg.wait_for_timeout(500)
    e = pg.evaluate("NEWAR_MAPA.estado()")
    ok(e["encuadre"] == "argentina" and e["zoom"] == 1 and e["seleccion"] == "", "«Argentina» vuelve a toda la Argentina y quita la selección")

    grupo("4. Selección y filtros sincronizados con la lista")
    pg.click(".ar-grid .rr[data-ak='jujuy']"); pg.wait_for_timeout(500)
    ok(pg.evaluate("!!document.querySelector('g.apg.on[data-ak=\"jujuy\"]')"), "elegir en la lista marca la provincia en el mapa")
    pg.fill("#arq", "sal"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelectorAll('svg.ag g.apg.dim').length") == 23, "el filtro atenúa en el mapa las provincias que no coinciden (23 de 24)")
    ok(pg.evaluate("[...document.querySelectorAll('.ar-grid .rr')].filter(b=>!b.hidden).length") == 1, "el filtro deja una sola fila en la lista")
    pg.fill("#arq", ""); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.querySelectorAll('svg.ag g.apg.dim').length") == 0, "borrar el filtro restablece el mapa")
    pg.mouse.move(2, 2); pg.wait_for_timeout(150)  # el puntero real queda sobre la barra superior: no genera eventos espurios al reacomodarse la lista
    pg.locator(".ar-grid .rr[data-ak='chubut']").dispatch_event("pointerover", {"bubbles": True}); pg.wait_for_timeout(150)
    ok(pg.evaluate("!!document.querySelector('svg.ag g.apg.hl[data-ak=\"chubut\"]')"), "pasar el mouse por la lista resalta la provincia en el mapa")

    grupo("5. Teclado")
    pg.goto(f"{BASE}#/argentina"); listo(pg)
    pg.focus("svg.ag g.apg[tabindex='0']")
    a0 = pg.evaluate("document.activeElement.dataset.ak")
    pg.keyboard.press("ArrowRight"); pg.keyboard.press("ArrowDown")
    a1 = pg.evaluate("document.activeElement.dataset.ak")
    ok(bool(a1) and a0 != a1, f"las flechas cambian de provincia ({a0} → {a1})")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    ok(pg.evaluate("NEWAR_MAPA.estado().seleccion") == a1, "Enter elige la provincia enfocada")
    ok(pg.evaluate("(document.activeElement.dataset||{}).ak") == a1, "el foco no se pierde al volver a dibujar el mapa")
    z = pg.evaluate("NEWAR_MAPA.estado().zoom")
    pg.keyboard.press("+"); pg.wait_for_timeout(200)
    ok(pg.evaluate("NEWAR_MAPA.estado().zoom") > z, "la tecla + acerca")
    pg.keyboard.press("-"); pg.wait_for_timeout(200)
    pg.keyboard.press("0"); pg.wait_for_timeout(400)
    ok(pg.evaluate("NEWAR_MAPA.estado().zoom") == 1, "la tecla 0 muestra toda la Argentina")
    pg.focus("svg.ag g.apg[tabindex='0']"); pg.keyboard.press("s"); pg.wait_for_timeout(500)
    ok(pg.evaluate("NEWAR_MAPA.estado().seleccion") == "salta", "la tecla S encuadra Salta")

    grupo("6. Pantalla completa")
    pg.goto(f"{BASE}#/argentina"); listo(pg)
    pg.click(".ar-w .mz button[aria-label^='Modo mapa']"); pg.wait_for_timeout(700)
    ok(pg.evaluate("!!document.querySelector('.ar-grid.fs')"), "el botón ⤢ entra a pantalla completa")
    ok(pg.evaluate("document.querySelector('.ar-grid.fs').getAttribute('role')") == "dialog" and pg.evaluate("document.querySelector('.ar-grid.fs').getAttribute('aria-modal')") == "true", "la pantalla completa es un diálogo modal accesible")
    ok(pg.evaluate("document.activeElement.textContent.includes('Salir')"), "el foco pasa al botón «Salir»")
    ok(pg.evaluate("document.querySelector('nav.top').hasAttribute('inert')"), "el resto de la página queda inerte mientras el mapa ocupa la pantalla")
    h = pg.evaluate("document.querySelector('svg.ag').getBoundingClientRect().height / innerHeight")
    ok(h > .7, f"el mapa ocupa más del 70 % del alto de la ventana ({h:.0%})")
    ok(pg.evaluate("getComputedStyle(document.querySelector('.ar-tb')).display") == "none", "las herramientas de dibujo no tapan el mapa por defecto")
    ok(pg.evaluate("document.getElementById('arside').hasAttribute('inert')"), "el panel de datos está cerrado y fuera del orden de tabulación")
    ok(pg.evaluate("(()=>{const w=innerWidth,h=innerHeight;return [[w-40,h-40],[w-40,h-120],[40,h-40]].every(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.closest('svg.ag')})})()"), "ningún botón flotante de otra pestaña tapa las esquinas del mapa")
    pg.click("button:has-text('Datos')"); pg.wait_for_timeout(500)
    ok(not pg.evaluate("document.getElementById('arside').hasAttribute('inert')"), "«Datos» abre el panel lateral")
    pg.click("button:has-text('Datos')"); pg.wait_for_timeout(300)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    ok(not pg.evaluate("!!document.querySelector('.ar-grid.fs')"), "Esc sale de la pantalla completa")
    ok(not pg.evaluate("document.querySelector('nav.top').hasAttribute('inert')"), "al salir se restablece el resto de la página")
    ok((pg.evaluate("document.activeElement.getAttribute('aria-label')") or "").startswith("Modo mapa"), "el foco vuelve al botón que abrió la pantalla completa")
    pg.evaluate("(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('denegado'))})()")
    pg.evaluate("NEWAR_MAPA.accion('pantalla_completa',true)"); pg.wait_for_timeout(400)
    ok(pg.evaluate("!!document.querySelector('.ar-grid.fs')"), "sin la API nativa de pantalla completa, el modo propio igual funciona")
    pg.evaluate("NEWAR_MAPA.accion('pantalla_completa',false)"); pg.wait_for_timeout(300)

    grupo("7. Contrato de intents (API y evento)")
    r = pg.evaluate("NEWAR_MAPA.accion('centrar','salta')"); pg.wait_for_timeout(400)
    ok(r["ok"] and r["estado"]["seleccion"] == "salta", "centrar «salta» (lo que sigue a «acercá Salta»)")
    r = pg.evaluate("NEWAR_MAPA.accion('centrar','argentina')"); pg.wait_for_timeout(300)
    ok(r["ok"] and r["estado"]["zoom"] == 1, "centrar «argentina» (lo que sigue a «mostrame Argentina»)")
    pg.evaluate("NEWAR_MAPA.accion('acercar')"); pg.wait_for_timeout(300)
    r = pg.evaluate("NEWAR_MAPA.accion('reiniciar')"); pg.wait_for_timeout(300)
    ok(r["ok"] and r["estado"]["zoom"] == 1, "reiniciar (lo que sigue a «volvé al mapa completo»)")
    r = pg.evaluate("NEWAR_MAPA.accion('centrar','tierra del fuego')")
    ok(r["ok"] and r["estado"]["seleccion"] == "tierra-del-fuego", "las jurisdicciones se resuelven por nombre")
    r = pg.evaluate("NEWAR_MAPA.accion('centrar','narnia')")
    ok(not r["ok"] and r["motivo"] == "jurisdiccion_desconocida", "una jurisdicción desconocida devuelve un motivo claro")
    r = pg.evaluate("NEWAR_MAPA.accion('bailar')")
    ok(not r["ok"] and r["motivo"] == "intent_desconocido" and "acercar" in r["validos"], "un intent inexistente lista los válidos")
    r = pg.evaluate("NEWAR_MAPA.accion('indicador','densidad')"); pg.wait_for_timeout(300)
    ok(r["ok"] and r["estado"]["indicador"]["clave"] == "dens", "el indicador se elige por nombre")
    ok(pg.evaluate("(()=>{const d={intent:'acercar'};document.dispatchEvent(new CustomEvent('newar:mapa',{detail:d}));return !!(d.resultado&&d.resultado.ok)})()"), "el evento newar:mapa ejecuta el intent y devuelve el resultado")
    ok(pg.evaluate("NEWAR_MAPA.activo()") == "argentina", "activo() informa qué mapa está a la vista (para que la voz decida a quién llamar)")
    ok(len(pg.evaluate("NEWAR_MAPA.ayuda()")) >= 8, "ayuda() entrega frases de ejemplo con su intent para probar la voz")
    pg.goto(f"{BASE}#/inicio"); pg.wait_for_timeout(2500)
    ok(pg.evaluate("NEWAR_MAPA.activo()") is None, "activo() es null cuando no hay mapa a la vista")
    r = pg.evaluate("NEWAR_MAPA.accion('centrar','salta')")
    ok(r["ok"] and r.get("pendiente"), "sin mapa a la vista, el intent abre el mapa y queda pendiente")
    pg.wait_for_selector("svg.ag", timeout=12000); pg.wait_for_timeout(1800)
    ok(pg.evaluate("NEWAR_MAPA.estado().seleccion") == "salta", "después de abrir, se ejecuta el intent pendiente")
    pg.goto(f"{BASE}#/mapa"); pg.wait_for_selector("svg.mg", timeout=12000); pg.wait_for_timeout(1500)
    ok(pg.evaluate("NEWAR_MAPA.activo()") == "salta", "activo() reconoce el mapa de Salta")
    v0s = vb(pg, "svg.mg")
    r = pg.evaluate("NEWAR_MAPA.accion('acercar')"); pg.wait_for_timeout(300)
    ok(r["ok"] and vb(pg, "svg.mg")[2] < v0s[2], "con el mapa de Salta a la vista, «acercar» actúa sobre ese mapa")
    r = pg.evaluate("NEWAR_MAPA.accion('reiniciar')"); pg.wait_for_timeout(300)
    ok(r["ok"] and abs(vb(pg, "svg.mg")[2] - v0s[2]) < 1.5, "«reiniciar» vuelve a toda la provincia de Salta")

    grupo("8. Estados: vacío, error, reintento y sin ubicación")
    pg = abrir(b, antes=bloquear("**/provincias_ar.json*", {"provincias": {}, "total_censado": 0, "congreso": {"diputados": 0, "senadores": 0}})); listo(pg)
    ok("No hay datos para este indicador" in pg.inner_text("#arapp"), "con datos vacíos se avisa en lugar de mostrar un mapa mudo")
    ok(pg.evaluate("document.querySelectorAll('g.apg').length") == 24, "con datos vacíos el mapa se dibuja igual, todo «sin dato»")

    pg = abrir(b, antes=bloquear("**/provincias_ar.json*")); listo(pg)
    ok("No se pudieron cargar los datos de población y bancas" in pg.inner_text("#arapp"), "si fallan los datos, se explica qué archivo falta y el mapa sigue")
    ok(pg.evaluate("document.querySelectorAll('g.apg').length") == 24, "con los datos caídos igual se ven los contornos")

    pg = abrir(b, antes=bloquear("**/geo_argentina.json*"))
    pg.wait_for_selector(".ar-err", timeout=12000); pg.wait_for_timeout(500)
    ok("contornos del mapa" in pg.inner_text("#arapp"), "si fallan los contornos, se avisa")
    ok(pg.evaluate("document.querySelectorAll('.ar-alt tbody tr').length") == 24, "con los contornos caídos los datos siguen disponibles en la tabla")
    r = pg.evaluate("NEWAR_MAPA.accion('acercar')")
    ok(not r["ok"] and r["motivo"] == "sin_contornos", "los intents informan que no hay contornos en lugar de fallar en silencio")

    def ambos(pg):
        pg.route("**/geo_argentina.json*", lambda r: r.abort())
        pg.route("**/provincias_ar.json*", lambda r: r.abort())
    pg = abrir(b, antes=ambos)
    pg.wait_for_selector(".ar-err button", timeout=12000)
    ok("No se pudo cargar el mapa" in pg.inner_text("#arapp"), "si falla todo, se muestra un error con botón para reintentar")
    pg.unroute("**/geo_argentina.json*"); pg.unroute("**/provincias_ar.json*")
    pg.click(".ar-err button"); pg.wait_for_selector("svg.ag", timeout=12000)
    ok(pg.evaluate("document.querySelectorAll('g.apg').length") == 24, "«Reintentar» recupera el mapa cuando vuelve la conexión")

    def geo_incompleto(pg):
        g = json.loads(json.dumps(GEO))
        g["provincias"].pop("misiones")
        g["provincias"]["chaco"].pop("c", None)
        pg.route("**/geo_argentina.json*", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(g)))
    pg = abrir(b, antes=geo_incompleto); listo(pg)
    ok(pg.evaluate("document.querySelectorAll('g.apg').length") == 23, "una jurisdicción sin contorno no se dibuja (23 de 24)")
    ok("Misiones" in pg.inner_text(".ar-sinubi"), "se lista aparte «sin ubicación en el mapa»")
    ok(pg.evaluate("[...document.querySelectorAll('.ar-alt tbody tr')].some(t=>t.textContent.includes('sin ubicación'))"), "la tabla de texto igual incluye a la jurisdicción sin ubicación")
    ok(pg.evaluate("document.querySelector('g.apg[data-ak=\"chaco\"]')!==null"), "si solo falta el punto del rótulo, el contorno se dibuja igual")
    r = pg.evaluate("NEWAR_MAPA.accion('seleccionar','misiones')"); pg.wait_for_timeout(400)
    ok(r["ok"] and r.get("sinUbicacion") and "MISIONES" in pg.inner_text("#arside").upper(), "elegir una jurisdicción sin ubicación muestra sus datos en el panel")

    grupo("9. Móvil (390 × 844, táctil)")
    pg = abrir(b, viewport={"width": 390, "height": 844}, touch=True); listo(pg)
    ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "no hay desplazamiento horizontal")
    tam = pg.evaluate("[...document.querySelectorAll('.ar-w .mz button,.ar-nav button')].map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height))")
    ok(bool(tam) and min(tam) >= 43.5, f"los botones del mapa miden al menos 44 px (mínimo {min(tam):.0f})")
    pg.evaluate("document.querySelector('.ar-w').scrollIntoView()"); pg.wait_for_timeout(300)
    cdp = pg.context.new_cdp_session(pg)
    bx = pg.locator("svg.ag").bounding_box()
    cx, cy = bx["x"] + bx["width"] * .35, max(bx["y"], 0) + 220
    w0 = vb(pg)[2]
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": cx - 20, "y": cy, "id": 1}, {"x": cx + 20, "y": cy, "id": 2}]})
    for s in range(1, 7):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": cx - 20 - s * 12, "y": cy, "id": 1}, {"x": cx + 20 + s * 12, "y": cy, "id": 2}]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    pg.wait_for_timeout(300)
    ok(vb(pg)[2] < w0 - 1, "el pellizco con dos dedos acerca el mapa")
    pg.click(".ar-w .mz button[aria-label^='Modo mapa']"); pg.wait_for_timeout(700)
    ok(pg.evaluate("!!document.querySelector('.ar-grid.fs')") and pg.evaluate("document.querySelector('svg.ag').getBoundingClientRect().height / innerHeight") > .6, "en el celular la pantalla completa deja el mapa como protagonista")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)

    ok(not errores, "sin errores de JavaScript durante toda la prueba" + (": " + "; ".join(errores[:2]) if errores else ""))
    b.close()

srv.shutdown()
print("\nRESULTADO:", "TODO BIEN" if not fallas else f"{len(fallas)} falla(s)")
sys.exit(1 if fallas else 0)
