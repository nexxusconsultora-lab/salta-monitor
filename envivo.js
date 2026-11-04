/* NEWAR · envivo.js · pestaña «En vivo»
   Muestra dentro del panel de 1 a 4 transmisiones de YouTube a la vez, a elección:
   se tocan los canales del catálogo (data/canales_envivo.json) o los que cada persona agregue con un link.
   No retransmite nada: incrusta el reproductor oficial de YouTube (youtube-nocookie.com).
   El panel lo carga con <script src="envivo.js"> y se registra solo como la vista «envivo». */
(function () {
  "use strict";

  var CLAVE = "newar_envivo_v3", MAX = 4, MAX_PROPIOS = 8;
  var estado = { sel: null, propios: [] };   /* sel: ids elegidos (null = todavía no eligió) */
  var catalogo = [], pendientes = [], catalogoListo = false;
  var parado = false, uid = 0, host = null, aviso = "", avisoMalo = false;

  /* ---------- lectura de links ---------- */
  function leer(txt) {
    txt = String(txt || "").trim();
    if (!txt) return null;
    var m;
    if (/^UC[\w-]{22}$/.test(txt)) return { t: "canal", id: txt };
    if ((m = txt.match(/youtube\.com\/channel\/(UC[\w-]{22})/i))) return { t: "canal", id: m[1] };
    if (/^[\w-]{11}$/.test(txt)) return { t: "video", id: txt };
    if (/(^|\/\/|\.)youtube\.com\//i.test(txt) && (m = txt.match(/[?&]v=([\w-]{11})/))) return { t: "video", id: m[1] };
    if ((m = txt.match(/youtu\.be\/([\w-]{11})/i))) return { t: "video", id: m[1] };
    if ((m = txt.match(/youtube\.com\/(?:live|embed)\/([\w-]{11})/i))) return { t: "video", id: m[1] };
    if (/^@/.test(txt) || /youtube\.com\/(@|c\/|user\/)/i.test(txt)) return { error: "handle" };
    return { error: "raro" };
  }
  function valido(v) {
    return !!v && (v.t === "canal" || v.t === "video") && (v.t === "canal" ? /^UC[\w-]{22}$/ : /^[\w-]{11}$/).test(String(v.id || ""));
  }
  function srcEmbed(v) {
    var q = "autoplay=1&mute=1&playsinline=1&rel=0";
    return v.t === "canal"
      ? "https://www.youtube-nocookie.com/embed/live_stream?channel=" + encodeURIComponent(v.id) + "&" + q
      : "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.id) + "?" + q;
  }
  function linkYT(v) {
    return v.t === "canal" ? "https://www.youtube.com/channel/" + v.id + "/live" : "https://www.youtube.com/watch?v=" + v.id;
  }

  /* ---------- guardado en el navegador ---------- */
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { } }
  function cargar() {
    var a = null;
    try { a = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { a = null; }
    estado = { sel: null, propios: [] };
    if (!a || typeof a !== "object") return;
    if (Array.isArray(a.propios)) {
      a.propios.slice(0, MAX_PROPIOS).forEach(function (p) {
        if (p && typeof p.id === "string" && /^p\d{1,6}$/.test(p.id) && valido(p.v)) {
          estado.propios.push({ id: p.id, n: typeof p.n === "string" ? p.n.slice(0, 40) : "", v: { t: p.v.t, id: p.v.id } });
        }
      });
    }
    if (Array.isArray(a.sel)) estado.sel = a.sel.filter(function (x) { return typeof x === "string"; }).slice(0, MAX);
  }

  /* ---------- catálogo ---------- */
  function todos() {
    var l = catalogo.map(function (c) { return { id: c.id, n: c.nombre, tipo: c.tipo || "", v: { t: "canal", id: c.ch }, propio: false }; });
    estado.propios.forEach(function (p) { l.push({ id: p.id, n: p.n || "Mi canal", tipo: "Mío", v: p.v, propio: true }); });
    return l;
  }
  function porId(id) { var t = todos(); for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; }
  function seleccion() {
    var t = todos();
    if (estado.sel === null) return t.slice(0, 2).map(function (c) { return c.id; });   /* primera vez: los dos primeros */
    return estado.sel.filter(function (id) { return !!porId(id); });
  }
  function cargarCatalogo() {
    if (typeof fetch !== "function") { catalogoListo = true; return; }
    fetch("data/canales_envivo.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        var l = (d && Array.isArray(d.canales)) ? d.canales : [];
        catalogo = []; pendientes = [];
        l.forEach(function (c) {
          if (!c || typeof c.id !== "string" || typeof c.nombre !== "string") return;
          if (!/^[\w-]{1,40}$/.test(c.id)) return;
          if (typeof c.ch === "string" && /^UC[\w-]{22}$/.test(c.ch)) catalogo.push({ id: c.id, nombre: c.nombre.slice(0, 40), tipo: String(c.tipo || "").slice(0, 20), ch: c.ch });
          else pendientes.push(c.nombre.slice(0, 40));
        });
      })
      .catch(function () { catalogo = []; pendientes = []; })
      .then(function () { catalogoListo = true; dibujar(); });
  }

  /* ---------- estilos (usan los colores del panel) ---------- */
  function estilos() {
    if (document.getElementById("nxv-css")) return;
    var s = document.createElement("style"); s.id = "nxv-css";
    s.textContent =
      ".nxv .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}" +
      ".nxv button{font:inherit;font-size:.92rem;padding:8px 13px;border-radius:999px;border:1px solid var(--line,#ccc);background:var(--raised,#fff);color:var(--ink,#222);cursor:pointer}" +
      ".nxv .chips button[aria-pressed=true]{background:var(--indigo,#2B3A55);color:var(--onind,#fff);border-color:var(--indigo,#2B3A55)}" +
      ".nxv .barra{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 12px}" +
      ".nxv .barra .der{margin-left:auto}" +
      ".nxv .cuenta{font-size:.9rem;color:var(--soft,#666)}" +
      ".nxv .rejilla{display:grid;grid-template-columns:1fr;gap:14px}" +
      "@media (min-width:900px){.nxv .rejilla.n2,.nxv .rejilla.n3,.nxv .rejilla.n4{grid-template-columns:1fr 1fr}}" +
      "@media (min-width:1400px){.nxv .rejilla.n3{grid-template-columns:1fr 1fr 1fr}}" +
      ".nxv .cas{min-width:0}.nxv .cas h3{margin:0 0 6px;font-size:1rem}" +
      ".nxv .marco{position:relative;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden}" +
      ".nxv .marco iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
      ".nxv .vacio{display:flex;align-items:center;justify-content:center;height:100%;color:#aab4c5;font-size:.9rem;text-align:center;padding:12px}" +
      ".nxv .pie{margin:5px 2px 0;font-size:.85rem}" +
      ".nxv details.ed{margin-top:18px;border:1px solid var(--line,#ccc);border-radius:10px;padding:10px 12px;background:var(--raised,#fff)}" +
      ".nxv details.ed summary{cursor:pointer;font-weight:600}" +
      ".nxv .fila{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}" +
      ".nxv .fila input{flex:1 1 160px;min-width:0;padding:9px 10px;border-radius:8px;border:1px solid var(--line,#ccc);background:var(--paper,#fff);color:var(--ink,#222);font:inherit;font-size:.92rem}" +
      ".nxv .fila input.nom{flex:0 1 170px}" +
      ".nxv .aviso{min-height:1.2em;margin:6px 0;font-size:.9rem;color:var(--soft,#666)}" +
      ".nxv .aviso.mal{color:var(--negtx,#8B3A3A)}" +
      ".nxv .propios{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}" +
      ".nxv .propios span{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line,#ccc);border-radius:999px;padding:4px 6px 4px 12px;font-size:.9rem}" +
      ".nxv .propios button{padding:2px 8px}";
    document.head.appendChild(s);
  }

  function crear(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function decir(t, mal) { aviso = t || ""; avisoMalo = !!mal; }

  function alternar(id) {
    var sel = seleccion().slice();
    var i = sel.indexOf(id);
    if (i >= 0) { sel.splice(i, 1); decir(""); }
    else if (sel.length >= MAX) { decir("Podés ver hasta " + MAX + " a la vez. Sacá uno para sumar otro.", true); dibujar(); return; }
    else { sel.push(id); decir(""); }
    estado.sel = sel; guardar(); dibujar();
  }

  function casilla(c) {
    var s = crear("section", "cas");
    s.appendChild(crear("h3", "", c.n));
    var m = crear("div", "marco");
    if (parado) {
      m.appendChild(crear("div", "vacio", "En pausa. Tocá «Reanudar» para volver a verlo."));
    } else {
      var f = document.createElement("iframe");
      f.src = srcEmbed(c.v);
      f.title = "Transmisión en vivo: " + c.n;
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
      f.setAttribute("allowfullscreen", "");
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      m.appendChild(f);
    }
    s.appendChild(m);
    var pie = crear("p", "pie");
    var a = crear("a", "", "¿No carga? Abrir en YouTube");
    a.href = linkYT(c.v); a.target = "_blank"; a.rel = "noopener noreferrer";
    pie.appendChild(a); s.appendChild(pie);
    return s;
  }

  function dibujar() {
    if (!host) return;
    estilos();
    host.textContent = "";
    var raiz = crear("div", "nxv");
    raiz.appendChild(crear("h2", "sec", "En vivo"));
    raiz.appendChild(crear("p", "lede", "Elegí cuántos y cuáles canales querés mirar, de 1 a " + MAX + " a la vez, sin salir de NEWAR. Arrancan sin sonido (lo exige el navegador): tocá el volumen del que quieras escuchar."));

    var lista = todos(), sel = seleccion();
    if (!catalogoListo) {
      raiz.appendChild(crear("p", "empty", "Cargando canales…"));
    } else if (!lista.length) {
      raiz.appendChild(crear("p", "empty", "Todavía no hay canales disponibles. Agregá uno con su link, abajo."));
    } else {
      var chips = crear("div", "chips"); chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Canales disponibles");
      lista.forEach(function (c) {
        var b = crear("button", "", c.n); b.type = "button";
        b.setAttribute("aria-pressed", sel.indexOf(c.id) >= 0 ? "true" : "false");
        b.addEventListener("click", function () { alternar(c.id); });
        chips.appendChild(b);
      });
      raiz.appendChild(chips);

      var barra = crear("div", "barra");
      barra.appendChild(crear("span", "cuenta", "Viendo " + sel.length + " de " + MAX));
      var bl = crear("button", "", "Quitar todos"); bl.type = "button";
      bl.addEventListener("click", function () { estado.sel = []; guardar(); decir(""); dibujar(); });
      barra.appendChild(bl);
      var bp = crear("button", "der", parado ? "▶ Reanudar" : "⏸ Parar todos"); bp.type = "button";
      bp.setAttribute("aria-pressed", parado ? "true" : "false");
      bp.addEventListener("click", function () { parado = !parado; dibujar(); });
      barra.appendChild(bp);
      raiz.appendChild(barra);

      var av = crear("p", "aviso" + (avisoMalo ? " mal" : ""), aviso); av.setAttribute("role", "status");
      raiz.appendChild(av);

      if (sel.length) {
        var rej = crear("div", "rejilla n" + sel.length);
        sel.forEach(function (id) { rej.appendChild(casilla(porId(id))); });
        raiz.appendChild(rej);
      } else {
        raiz.appendChild(crear("p", "empty", "No elegiste ningún canal. Tocá uno de arriba para verlo."));
      }
    }
    if (catalogoListo && pendientes.length) {
      raiz.appendChild(crear("p", "note", "Todavía sin activar (se suman solos cuando se confirma su código de YouTube): " + pendientes.join(", ") + "."));
    }

    /* agregar un canal propio */
    var det = crear("details", "ed");
    det.appendChild(crear("summary", "", "＋ Agregar un canal con su link"));
    det.appendChild(crear("p", "note", "Abrí la transmisión en vivo en YouTube y copiá la dirección de la barra del navegador (youtube.com/watch?v=…). También sirve youtu.be/…, youtube.com/live/… o el código del canal (empieza con UC). Queda guardado en este navegador."));
    var fila = crear("div", "fila");
    var nom = document.createElement("input"); nom.type = "text"; nom.className = "nom"; nom.maxLength = 40; nom.placeholder = "Nombre"; nom.setAttribute("aria-label", "Nombre del canal");
    var li = document.createElement("input"); li.type = "text"; li.autocomplete = "off"; li.placeholder = "Link de YouTube en vivo"; li.setAttribute("aria-label", "Link de la transmisión");
    var ba = crear("button", "", "Agregar"); ba.type = "button";
    fila.appendChild(nom); fila.appendChild(li); fila.appendChild(ba); det.appendChild(fila);
    var err = crear("p", "aviso mal"); err.setAttribute("role", "status"); det.appendChild(err);
    ba.addEventListener("click", function () {
      var r = leer(li.value);
      if (r === null) { err.textContent = "Pegá primero un link."; return; }
      if (r.error === "handle") { err.textContent = "Con el @nombre no alcanza. Abrí la transmisión en vivo en YouTube y copiá el link de la barra de direcciones (youtube.com/watch?v=…)."; return; }
      if (r.error) { err.textContent = "No reconozco ese link. Tiene que ser de YouTube."; return; }
      if (estado.propios.length >= MAX_PROPIOS) { err.textContent = "Ya agregaste " + MAX_PROPIOS + " canales propios. Quitá alguno para sumar otro."; return; }
      var n = 0; estado.propios.forEach(function (p) { n = Math.max(n, parseInt(p.id.slice(1), 10) || 0); });
      var nuevo = { id: "p" + (n + 1), n: nom.value.trim().slice(0, 40), v: r };
      estado.propios.push(nuevo);
      var s2 = seleccion().slice();
      if (s2.length < MAX) s2.push(nuevo.id);
      estado.sel = s2; guardar(); decir(""); dibujar();
    });
    if (estado.propios.length) {
      var pr = crear("div", "propios");
      estado.propios.forEach(function (p) {
        var sp = crear("span", "", p.n || "Mi canal");
        var q = crear("button", "", "✕"); q.type = "button"; q.setAttribute("aria-label", "Quitar " + (p.n || "este canal"));
        q.addEventListener("click", function () {
          estado.propios = estado.propios.filter(function (x) { return x.id !== p.id; });
          estado.sel = seleccion().filter(function (id) { return id !== p.id; });
          guardar(); decir(""); dibujar();
        });
        sp.appendChild(q); pr.appendChild(sp);
      });
      det.appendChild(pr);
    }
    raiz.appendChild(det);
    host.appendChild(raiz);
  }

  function montar(el) { host = el; cargar(); dibujar(); if (!catalogoListo) cargarCatalogo(); }

  var API = { montar: montar, leer: leer, srcEmbed: srcEmbed };
  if (typeof window !== "undefined") window.NewarEnVivo = API;

  /* ---------- registro en el panel ---------- */
  var VV = null; try { VV = (typeof V !== "undefined") ? V : null; } catch (e) { VV = null; }
  if (VV && !VV.envivo) {
    VV.envivo = function () {
      var id = "nxv-host-" + (++uid);
      setTimeout(function () { var el = document.getElementById(id); if (el) montar(el); }, 0);
      return '<div id="' + id + '"></div>';
    };
    /* Entrar directo por #/envivo: si el panel eligió la vista antes de que este módulo se registrara, se vuelve a rutear una vez. */
    try {
      var reintento = function () { if (/^#\/envivo(\/|$)/.test(location.hash) && !document.querySelector(".nxv")) { try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch (e) { } } };
      if (document.readyState === "complete") setTimeout(reintento, 300); else window.addEventListener("load", function () { setTimeout(reintento, 600); });
    } catch (e) { }
  }
})();
