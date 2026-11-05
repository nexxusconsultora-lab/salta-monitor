/* NEWAR · envivo.js · pestaña «En vivo» — pared de TV
   Muestra dentro del panel de 1 a 4 transmisiones de YouTube a la vez, repartidas en partes iguales.
   - Elegís cuántos y cuáles canales ver (1, 2, 3 o 4).
   - Pantalla completa de toda la pared (o de un solo canal), con los canales simétricos.
   - Audio inteligente: tocás «Escuchar» en un canal y solo ese suena; los demás quedan en silencio.
   - Cada persona puede cambiar, agregar o quitar canales desde «Administrar canales».
   No retransmite nada: incrusta el reproductor oficial de YouTube (youtube-nocookie.com).
   El panel lo carga con <script src="envivo.js"> y se registra solo como la vista «envivo». */
(function () {
  "use strict";

  var CLAVE = "newar_envivo_v3", MAX = 4, MAX_PROPIOS = 12, MAX_ESC = 8, REPOSO_MS = 4000;
  var YT = "https://www.youtube-nocookie.com";
  var estado = { sel: null, propios: [], ajustes: {}, escenas: [] };  /* ajustes: cambios propios sobre canales del catálogo; escenas: combinaciones guardadas */
  var catalogo = [], pendientes = [], catalogoListo = false;
  var ZONA = "America/Argentina/Salta", relojT = null;
  var adminAbierto = false, parado = false, uid = 0, host = null, aviso = "", avisoMalo = false, audioId = null, pantalla = null;

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
  function msgError(r) {
    return r.error === "handle"
      ? "Con el @nombre no alcanza. Abrí la transmisión en vivo en YouTube y copiá el link de la barra de direcciones (youtube.com/watch?v=…)."
      : "No reconozco ese link. Tiene que ser de YouTube (youtube.com/watch?v=…, youtu.be/… o el código del canal que empieza con UC).";
  }
  function valido(v) {
    return !!v && (v.t === "canal" || v.t === "video") && (v.t === "canal" ? /^UC[\w-]{22}$/ : /^[\w-]{11}$/).test(String(v.id || ""));
  }
  function srcEmbed(v) {
    var q = "autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1" + (location && location.origin && location.origin !== "null" ? "&origin=" + encodeURIComponent(location.origin) : "");
    return v.t === "canal"
      ? YT + "/embed/live_stream?channel=" + encodeURIComponent(v.id) + "&" + q
      : YT + "/embed/" + encodeURIComponent(v.id) + "?" + q;
  }
  function linkYT(v) { return v.t === "canal" ? "https://www.youtube.com/channel/" + v.id + "/live" : "https://www.youtube.com/watch?v=" + v.id; }
  function textoLink(v) { return v.t === "canal" ? v.id : "https://www.youtube.com/watch?v=" + v.id; }
  function igual(a, b) { return !!a && !!b && a.t === b.t && a.id === b.id; }

  /* ---------- guardado en el navegador ---------- */
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { } }
  function cargar() {
    var a = null;
    try { a = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { a = null; }
    estado = { sel: null, propios: [], ajustes: {}, escenas: [] };
    if (!a || typeof a !== "object") return;
    if (Array.isArray(a.propios)) {
      a.propios.slice(0, MAX_PROPIOS).forEach(function (p) {
        if (p && typeof p.id === "string" && /^p\d{1,6}$/.test(p.id) && valido(p.v)) {
          estado.propios.push({ id: p.id, n: typeof p.n === "string" ? p.n.slice(0, 40) : "", v: { t: p.v.t, id: p.v.id } });
        }
      });
    }
    if (a.ajustes && typeof a.ajustes === "object" && !Array.isArray(a.ajustes)) {
      Object.keys(a.ajustes).slice(0, 60).forEach(function (k) {
        var x = a.ajustes[k];
        if (!/^[\w-]{1,40}$/.test(k) || !x || typeof x !== "object") return;
        var o = {};
        if (typeof x.n === "string") o.n = x.n.slice(0, 40);
        if (valido(x.v)) o.v = { t: x.v.t, id: x.v.id };
        if (x.oculto === true) o.oculto = true;
        if (Object.keys(o).length) estado.ajustes[k] = o;
      });
    }
    if (Array.isArray(a.escenas)) {
      a.escenas.slice(0, MAX_ESC).forEach(function (e) {
        if (!e || typeof e.n !== "string" || !e.n.trim() || !Array.isArray(e.ids)) return;
        var ids = e.ids.filter(function (x) { return typeof x === "string" && /^[\w-]{1,40}$/.test(x); }).slice(0, MAX);
        if (ids.length) estado.escenas.push({ n: e.n.trim().slice(0, 30), ids: ids });
      });
    }
    if (Array.isArray(a.sel)) estado.sel = a.sel.filter(function (x) { return typeof x === "string"; }).slice(0, MAX);
  }

  /* ---------- canales: catálogo + cambios propios ---------- */
  function todos(conOcultos) {
    var l = [];
    catalogo.forEach(function (c) {
      var aj = estado.ajustes[c.id] || {};
      if (aj.oculto && !conOcultos) return;
      l.push({ id: c.id, n: aj.n !== undefined ? aj.n : c.nombre, tipo: c.tipo || "", v: aj.v || { t: "canal", id: c.ch }, propio: false, oculto: !!aj.oculto, cambiado: !!(aj.n !== undefined || aj.v), orig: { n: c.nombre, v: { t: "canal", id: c.ch } } });
    });
    estado.propios.forEach(function (p) { l.push({ id: p.id, n: p.n || "Mi canal", tipo: "Mío", v: p.v, propio: true, oculto: false, cambiado: false }); });
    return l;
  }
  function porId(id) { var t = todos(); for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; }
  function seleccion() {
    var t = todos();
    if (estado.sel === null) return t.slice(0, 2).map(function (c) { return c.id; });
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
      ".nxv button{font:inherit;font-size:.92rem;padding:8px 13px;border-radius:999px;border:1px solid var(--line,#ccc);background:var(--raised,#fff);color:var(--ink,#222);cursor:pointer}" +
      ".nxv .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}" +
      ".nxv .chips button[aria-pressed=true]{background:var(--indigo,#2B3A55);color:var(--onind,#fff);border-color:var(--indigo,#2B3A55)}" +
      ".nxv .barra{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 12px}" +
      ".nxv .barra .der{margin-left:auto}" +
      ".nxv .cuenta{font-size:.9rem;color:var(--soft,#666)}" +
      /* pared: partes iguales */
      ".nxv .rejilla{display:grid;grid-template-columns:1fr;gap:14px}" +
      "@media (min-width:900px){.nxv .rejilla.n2,.nxv .rejilla.n3,.nxv .rejilla.n4{grid-template-columns:1fr 1fr}.nxv .rejilla.n3 .cas:nth-child(3){grid-column:1/-1;justify-self:center;width:calc(50% - 7px)}}" +
      "@media (min-width:1400px){.nxv .rejilla.n3{grid-template-columns:1fr 1fr 1fr}.nxv .rejilla.n3 .cas:nth-child(3){grid-column:auto;justify-self:stretch;width:auto}}" +
      ".nxv .cas{min-width:0;position:relative}" +
      ".nxv .cab{display:flex;gap:8px;align-items:center;margin:0 0 6px}" +
      ".nxv .cab h3{margin:0;font-size:1rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".nxv .cab button{padding:4px 10px;font-size:.85rem}" +
      ".nxv .cab button[aria-pressed=true]{background:var(--indigo,#2B3A55);color:var(--onind,#fff);border-color:var(--indigo,#2B3A55)}" +
      ".nxv .marco{position:relative;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden}" +
      ".nxv .marco iframe{position:absolute;inset:0;width:100%;height:100%;border:0}" +
      ".nxv .vacio{display:flex;align-items:center;justify-content:center;height:100%;color:#aab4c5;font-size:.9rem;text-align:center;padding:12px}" +
      ".nxv .pie{margin:5px 2px 0;font-size:.85rem}" +
      /* pantalla completa = centro de mando (también funciona donde el navegador no tiene pantalla completa real, como el iPhone) */
      ".nxv .pared .cm{display:none}" +
      ".nxv .pc{position:fixed;inset:0;z-index:2147483000;background:#000;margin:0;padding:0;width:auto;height:auto;border-radius:0}" +
      ".nxv .pared.pc{display:flex;flex-direction:column}" +
      ".nxv .pared.pc .cm{display:flex}" +
      ".nxv .pared.pc .rejilla{flex:1;min-height:0;display:grid;gap:3px;width:auto;height:auto;grid-template-columns:1fr;grid-auto-rows:1fr}" +
      "@media (orientation:landscape){.nxv .pared.pc .rejilla.n2{grid-template-columns:1fr 1fr}.nxv .pared.pc .rejilla.n3{grid-template-columns:1fr 1fr 1fr}.nxv .pared.pc .rejilla.n4{grid-template-columns:1fr 1fr}}" +
      "@media (orientation:portrait){.nxv .pared.pc .rejilla.n4{grid-template-columns:1fr 1fr}}" +
      ".nxv .pared.pc .rejilla .cas:nth-child(3){grid-column:auto;justify-self:stretch;width:auto}" +
      ".nxv .pared.pc .cas,.nxv .cas.pc{position:relative;min-height:0}" +
      ".nxv .pared.pc .marco,.nxv .cas.pc .marco{position:absolute;inset:0;aspect-ratio:auto;border-radius:0}" +
      ".nxv .pc .cab{position:absolute;top:6px;left:6px;z-index:3;margin:0;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:999px;max-width:70%}" +
      ".nxv .pc .cab h3{color:#fff;font-size:.8rem}" +
      ".nxv .pc .pie{display:none}" +
      ".nxv .cm{align-items:center;gap:14px;flex:0 0 auto;background:#05070d;color:#e8edf7;padding:6px 12px;font-size:.85rem;border-bottom:1px solid #1b2538;padding-top:max(6px,env(safe-area-inset-top))}" +
      ".nxv .cm .vivo{display:flex;align-items:center;gap:6px;font-weight:700;letter-spacing:.06em;white-space:nowrap}" +
      ".nxv .cm .vivo i{width:.55rem;height:.55rem;border-radius:50%;background:#ff3e6c;box-shadow:0 0 10px #ff3e6c;animation:nxvp 1.4s infinite}" +
      "@keyframes nxvp{50%{opacity:.35}}" +
      ".nxv .cm .nc{color:#aab4c5;white-space:nowrap}" +
      ".nxv .cm .aud{flex:1;min-width:0;color:#aab4c5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".nxv .cm button{background:rgba(255,255,255,.08);color:#fff;border-color:#3a4660;padding:4px 12px}" +
      ".nxv .rj{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;line-height:1.15;white-space:nowrap}" +
      ".nxv .cm .rj{text-align:right}.nxv .rj b{font-size:1.1rem}.nxv .rj span{display:block;font-size:.7rem;opacity:.75}" +
      ".nxv .barra .rj{display:inline-flex;gap:8px;align-items:baseline;font-size:.9rem;color:var(--soft,#666)}.nxv .barra .rj b{font-size:.95rem;color:var(--ink,#222)}.nxv .barra .rj span{display:inline;font-size:.78rem}" +
      ".nxv .cab .num{display:none}.nxv .pc .cab .num{display:inline;font-weight:700;color:#ffd166;margin-right:6px}" +
      ".nxv .cm .teclas{color:#7f8ba3;font-size:.75rem;white-space:nowrap}@media (max-width:900px){.nxv .cm .teclas{display:none}}" +
      ".nxv .pared.pc .cm{transition:opacity .6s}.nxv .pared.pc.quieto .cm{opacity:.18}.nxv .pared.pc.quieto .cm:hover{opacity:1}" +
      ".nxv .escenas{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}" +
      ".nxv .escenas .esc{display:inline-flex;align-items:center;gap:2px}.nxv .escenas .esc button:last-child{padding:6px 9px}" +
      ".nxv .escenas input{width:11rem;max-width:100%;padding:7px 10px;border-radius:8px;border:1px solid var(--line,#ccc);background:var(--paper,#fff);color:var(--ink,#222);font:inherit;font-size:.9rem}" +
      ".nxv .salir{position:fixed;top:8px;right:8px;z-index:2147483001;background:rgba(0,0,0,.75);color:#fff;border-color:#888}" +
      /* al abrir la pantalla completa se guarda la barra superior y la lateral del panel, igual que hace el panel con sus mapas */
      "html:has(.nxv .pc){overflow:hidden}" +
      "html:has(.nxv .pc) body>*:not(#app):not(script):not(style):not(.toast){display:none!important}" +
      "html:has(.nxv .pc) #app,html:has(.nxv .pc) .wrap{z-index:auto!important;margin:0!important;padding:0!important;max-width:none!important;animation:none!important}" +
      /* administrar */
      ".nxv details.ed{margin-top:18px;border:1px solid var(--line,#ccc);border-radius:10px;padding:10px 12px;background:var(--raised,#fff)}" +
      ".nxv details.ed summary{cursor:pointer;font-weight:600}" +
      ".nxv .fila{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;align-items:center}" +
      ".nxv .fila input{flex:1 1 150px;min-width:0;padding:9px 10px;border-radius:8px;border:1px solid var(--line,#ccc);background:var(--paper,#fff);color:var(--ink,#222);font:inherit;font-size:.92rem}" +
      ".nxv .fila input.nom{flex:0 1 170px}" +
      ".nxv .fila .oc{opacity:.55}" +
      ".nxv .aviso{min-height:1.2em;margin:6px 0;font-size:.9rem;color:var(--soft,#666)}" +
      ".nxv .aviso.mal{color:var(--negtx,#8B3A3A)}";
    document.head.appendChild(s);
  }

  function crear(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function decir(t, mal) { aviso = t || ""; avisoMalo = !!mal; }

  /* ---------- pantalla completa ---------- */
  var wl = null, reposoT = null, enReposo = null;
  function pedirWL() {
    try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then(function (l) { wl = l; l.addEventListener("release", function () { wl = null; }); }).catch(function () { }); } catch (e) { }
  }
  function soltarWL() { try { if (wl) { var l = wl; wl = null; l.release(); } } catch (e) { } }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && pantalla && !wl) pedirWL(); });
  function despertar() {
    if (!pantalla) return;
    pantalla.classList.remove("quieto");
    clearTimeout(reposoT);
    reposoT = setTimeout(function () { if (pantalla) pantalla.classList.add("quieto"); }, REPOSO_MS);
  }
  function salir() {
    if (!host) return;
    clearTimeout(reposoT); soltarWL();
    if (enReposo) { ["mousemove", "touchstart", "pointerdown", "keydown"].forEach(function (t) { enReposo.removeEventListener(t, despertar); }); enReposo = null; }
    [].forEach.call(host.querySelectorAll(".pc"), function (e) { e.classList.remove("pc"); e.classList.remove("quieto"); });
    var b = host.querySelector(".salir"); if (b && b.parentNode) b.parentNode.removeChild(b);
    pantalla = null;
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) { }
  }
  function entrar(el) {
    salir();
    el.classList.add("pc"); pantalla = el; pedirWL();
    if (el.classList.contains("pared")) { enReposo = el; ["mousemove", "touchstart", "pointerdown", "keydown"].forEach(function (t) { el.addEventListener(t, despertar); }); despertar(); }
    if (!el.classList.contains("pared")) { var b = crear("button", "salir", "✕ Salir"); b.type = "button"; b.addEventListener("click", salir); el.appendChild(b); }
    try { var f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) { var p = f.call(el); if (p && p.catch) p.catch(function () { }); } } catch (e) { }
  }
  document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement && pantalla) salir(); });
  document.addEventListener("webkitfullscreenchange", function () { if (!document.webkitFullscreenElement && pantalla) salir(); });
  document.addEventListener("keydown", function (e) {
    if (!pantalla) return;
    if (e.key === "Escape") { salir(); return; }
    var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || !pantalla.classList.contains("pared")) return;
    var k = String(e.key || "");
    if (/^[1-4]$/.test(k)) {
      var cas = pantalla.querySelectorAll(".cas"), c = cas[parseInt(k, 10) - 1];
      if (c) { var id = c.getAttribute("data-id"); audioId = (audioId === id) ? null : id; aplicarAudio(); e.preventDefault(); }
    } else if (k === "0" || k.toLowerCase() === "m") { audioId = null; aplicarAudio(); e.preventDefault(); }
  });


  /* ---------- reloj preciso (hora de Salta, con segundos, alineado al cambio de segundo) ---------- */
  function horaTxt() {
    var n = new Date();
    try {
      return {
        h: n.toLocaleTimeString("es-AR", { hour12: false, timeZone: ZONA, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        f: n.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short", timeZone: ZONA })
      };
    } catch (e) { return { h: n.toTimeString().slice(0, 8), f: "" }; }
  }
  function pintarReloj() {
    if (!host || !document.body.contains(host)) { relojT = null; return false; }
    var t = horaTxt();
    [].forEach.call(host.querySelectorAll(".rj"), function (e) {
      e.textContent = "";
      e.appendChild(crear("b", "", t.h));
      if (t.f) e.appendChild(crear("span", "", t.f + " · hora de Salta"));
    });
    return true;
  }
  function programarReloj() {
    clearTimeout(relojT);
    relojT = setTimeout(function () { if (pintarReloj()) programarReloj(); }, 1000 - (Date.now() % 1000) + 5);
  }
  function textoAudio() {
    var c = audioId ? porId(audioId) : null;
    return c ? "🔊 Escuchando: " + c.n : "🔇 Sin audio: tocá «Escuchar» en un canal";
  }

  /* ---------- audio inteligente ---------- */
  function mandar(f, fn) {
    try { f.contentWindow.postMessage(JSON.stringify({ event: "command", func: fn, args: [] }), YT); } catch (e) { }
  }
  function aplicarAudio() {
    if (!host) return;
    [].forEach.call(host.querySelectorAll("iframe[data-cid]"), function (f) { mandar(f, f.getAttribute("data-cid") === audioId ? "unMute" : "mute"); });
    [].forEach.call(host.querySelectorAll(".cm .aud"), function (e) { e.textContent = textoAudio(); });
    [].forEach.call(host.querySelectorAll("button[data-audio]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-audio") === audioId ? "true" : "false"); b.textContent = b.getAttribute("data-audio") === audioId ? "🔊 Escuchando" : "🔇 Escuchar"; });
  }

  function alternar(id) {
    var sel = seleccion().slice(), i = sel.indexOf(id);
    if (i >= 0) { sel.splice(i, 1); if (audioId === id) audioId = null; decir(""); }
    else if (sel.length >= MAX) { decir("Podés ver hasta " + MAX + " a la vez. Sacá uno para sumar otro.", true); dibujar(); return; }
    else { sel.push(id); decir(""); }
    estado.sel = sel; guardar(); dibujar();
  }

  function casilla(c, n) {
    var s = crear("section", "cas"); s.setAttribute("data-id", c.id);
    var cab = crear("div", "cab");
    var h3 = crear("h3", "");
    h3.appendChild(crear("span", "num", String(n)));
    h3.appendChild(document.createTextNode(c.n));
    cab.appendChild(h3);
    var ba = crear("button", "", "🔇 Escuchar"); ba.type = "button"; ba.setAttribute("data-audio", c.id); ba.setAttribute("aria-pressed", "false");
    ba.setAttribute("aria-label", "Escuchar solo " + c.n);
    ba.addEventListener("click", function () { audioId = (audioId === c.id) ? null : c.id; aplicarAudio(); });
    var bf = crear("button", "", "⛶"); bf.type = "button"; bf.title = "Pantalla completa de " + c.n; bf.setAttribute("aria-label", "Pantalla completa de " + c.n);
    bf.addEventListener("click", function () { entrar(s); });
    cab.appendChild(ba); cab.appendChild(bf); s.appendChild(cab);
    var m = crear("div", "marco");
    if (parado) {
      m.appendChild(crear("div", "vacio", "En pausa. Tocá «Reanudar» para volver a verlo."));
    } else {
      var f = document.createElement("iframe");
      f.src = srcEmbed(c.v); f.setAttribute("data-cid", c.id);
      f.title = "Transmisión en vivo: " + c.n;
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
      f.setAttribute("allowfullscreen", "");
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      f.addEventListener("load", function () { if (audioId) setTimeout(aplicarAudio, 1500); });
      m.appendChild(f);
    }
    s.appendChild(m);
    var pie = crear("p", "pie");
    var a = crear("a", "", "¿No carga? Abrir en YouTube");
    a.href = linkYT(c.v); a.target = "_blank"; a.rel = "noopener noreferrer";
    pie.appendChild(a); s.appendChild(pie);
    return s;
  }

  /* ---------- administrar canales ---------- */
  function administrar(raiz) {
    var det = crear("details", "ed");
    if (adminAbierto) det.open = true;
    det.addEventListener("toggle", function () { adminAbierto = det.open; });
    det.appendChild(crear("summary", "", "⚙ Administrar canales (cambiar, agregar o quitar)"));
    det.appendChild(crear("p", "note", "Cambiá el nombre o el link de cualquier canal y tocá Guardar. Para el link: abrí la transmisión en vivo en YouTube y copiá la dirección de la barra del navegador (youtube.com/watch?v=…); también sirve youtu.be/…, youtube.com/live/… o el código del canal (empieza con UC). Todo queda guardado en este navegador."));
    var err = crear("p", "aviso mal"); err.setAttribute("role", "status");

    todos(true).forEach(function (c) {
      var fila = crear("div", "fila");
      var nom = document.createElement("input"); nom.type = "text"; nom.className = "nom" + (c.oculto ? " oc" : ""); nom.maxLength = 40; nom.value = c.n; nom.setAttribute("aria-label", "Nombre de " + c.n);
      var li = document.createElement("input"); li.type = "text"; li.autocomplete = "off"; li.value = textoLink(c.v); li.className = c.oculto ? "oc" : ""; li.setAttribute("aria-label", "Link de " + c.n);
      var bg = crear("button", "", "Guardar"); bg.type = "button";
      var bq = crear("button", "", c.oculto ? "Volver a mostrar" : "Quitar"); bq.type = "button";
      fila.appendChild(nom); fila.appendChild(li); fila.appendChild(bg); fila.appendChild(bq);
      if (!c.propio && c.cambiado) {
        var br = crear("button", "", "Restablecer"); br.type = "button";
        br.addEventListener("click", function () { var aj = estado.ajustes[c.id] || {}; if (aj.oculto) estado.ajustes[c.id] = { oculto: true }; else delete estado.ajustes[c.id]; guardar(); decir(""); adminAbierto = true; dibujar(); });
        fila.appendChild(br);
      }
      bg.addEventListener("click", function () {
        var r = leer(li.value), n = nom.value.trim().slice(0, 40);
        if (r === null) { err.textContent = "Pegá primero un link."; return; }
        if (r.error) { err.textContent = c.n + ": " + msgError(r); return; }
        if (!n) n = c.propio ? "Mi canal" : c.orig.n;
        if (c.propio) {
          estado.propios.forEach(function (p) { if (p.id === c.id) { p.n = n; p.v = r; } });
        } else {
          var aj = estado.ajustes[c.id] || {};
          if (n === c.orig.n) delete aj.n; else aj.n = n;
          if (igual(r, c.orig.v)) delete aj.v; else aj.v = r;
          if (Object.keys(aj).length) estado.ajustes[c.id] = aj; else delete estado.ajustes[c.id];
        }
        guardar(); decir(""); adminAbierto = true; dibujar();
      });
      bq.addEventListener("click", function () {
        var selAntes = seleccion();   /* se calcula antes del cambio para no «completar» con otro canal */
        if (c.propio) {
          estado.propios = estado.propios.filter(function (x) { return x.id !== c.id; });
        } else {
          var aj = estado.ajustes[c.id] || {};
          if (c.oculto) delete aj.oculto; else aj.oculto = true;
          if (Object.keys(aj).length) estado.ajustes[c.id] = aj; else delete estado.ajustes[c.id];
        }
        estado.sel = selAntes.filter(function (id) { return c.oculto ? true : id !== c.id; });
        if (audioId === c.id) audioId = null;
        guardar(); decir(""); adminAbierto = true; dibujar();
      });
      det.appendChild(fila);
    });

    det.appendChild(crear("p", "note", "Agregar un canal nuevo:"));
    var fn = crear("div", "fila");
    var nom2 = document.createElement("input"); nom2.type = "text"; nom2.className = "nom"; nom2.maxLength = 40; nom2.placeholder = "Nombre"; nom2.setAttribute("aria-label", "Nombre del canal nuevo");
    var li2 = document.createElement("input"); li2.type = "text"; li2.autocomplete = "off"; li2.placeholder = "Link de YouTube en vivo"; li2.setAttribute("aria-label", "Link del canal nuevo");
    var ba = crear("button", "", "Agregar"); ba.type = "button";
    fn.appendChild(nom2); fn.appendChild(li2); fn.appendChild(ba); det.appendChild(fn);
    ba.addEventListener("click", function () {
      var r = leer(li2.value);
      if (r === null) { err.textContent = "Pegá primero un link."; return; }
      if (r.error) { err.textContent = msgError(r); return; }
      if (estado.propios.length >= MAX_PROPIOS) { err.textContent = "Ya agregaste " + MAX_PROPIOS + " canales propios. Quitá alguno para sumar otro."; return; }
      var n = 0; estado.propios.forEach(function (p) { n = Math.max(n, parseInt(p.id.slice(1), 10) || 0); });
      var nuevo = { id: "p" + (n + 1), n: nom2.value.trim().slice(0, 40), v: r };
      estado.propios.push(nuevo);
      var s2 = seleccion().slice(); if (s2.length < MAX) s2.push(nuevo.id);
      estado.sel = s2; guardar(); decir(""); adminAbierto = true; dibujar();
    });
    det.appendChild(err);
    var hay = Object.keys(estado.ajustes).length > 0;
    if (hay) {
      var bt = crear("button", "", "Restaurar los canales originales (deshacer mis cambios y los que quité)"); bt.type = "button";
      bt.addEventListener("click", function () { estado.ajustes = {}; guardar(); decir(""); adminAbierto = true; dibujar(); });
      det.appendChild(bt);
    }
    raiz.appendChild(det);
  }

  function dibujar() {
    if (!host) return;
    estilos();
    host.textContent = ""; pantalla = null;
    var raiz = crear("div", "nxv");
    raiz.appendChild(crear("h2", "sec", "En vivo"));
    raiz.appendChild(crear("p", "lede", "Armá tu pared de TV: elegí de 1 a " + MAX + " canales y se reparten en partes iguales. Arrancan sin sonido (lo exige el navegador): tocá «Escuchar» en el que quieras oír, o usá ⛶ para pantalla completa."));

    var lista = todos(), sel = seleccion();
    if (!catalogoListo) {
      raiz.appendChild(crear("p", "empty", "Cargando canales…"));
    } else if (!lista.length) {
      raiz.appendChild(crear("p", "empty", "No hay canales para mostrar. Agregá uno en «Administrar canales»."));
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
      barra.appendChild(crear("span", "rj"));
      var bl = crear("button", "", "Quitar todos"); bl.type = "button";
      bl.addEventListener("click", function () { estado.sel = []; audioId = null; guardar(); decir(""); dibujar(); });
      barra.appendChild(bl);
      var bpc = crear("button", "", "⛶ Pantalla completa"); bpc.type = "button"; bpc.disabled = !sel.length;
      barra.appendChild(bpc);
      var bp = crear("button", "der", parado ? "▶ Reanudar" : "⏸ Parar todos"); bp.type = "button";
      bp.setAttribute("aria-pressed", parado ? "true" : "false");
      bp.addEventListener("click", function () { parado = !parado; dibujar(); });
      barra.appendChild(bp);
      raiz.appendChild(barra);

      var esc = crear("div", "escenas"); esc.setAttribute("role", "group"); esc.setAttribute("aria-label", "Escenas guardadas");
      esc.appendChild(crear("span", "cuenta", "Escenas:"));
      estado.escenas.forEach(function (e) {
        var w = crear("span", "esc");
        var bo = crear("button", "", e.n); bo.type = "button"; bo.title = "Mostrar esta combinación de canales";
        bo.addEventListener("click", function () {
          var ids = e.ids.filter(function (x) { return !!porId(x); }).slice(0, MAX);
          if (!ids.length) { decir("A la escena «" + e.n + "» ya no le queda ningún canal disponible.", true); dibujar(); return; }
          estado.sel = ids; audioId = null; guardar(); decir(ids.length < e.ids.length ? "Se abrió «" + e.n + "» sin los canales que ya no están." : ""); dibujar();
        });
        var bx = crear("button", "", "✕"); bx.type = "button"; bx.setAttribute("aria-label", "Borrar la escena " + e.n);
        bx.addEventListener("click", function () { estado.escenas = estado.escenas.filter(function (x) { return x !== e; }); guardar(); decir(""); dibujar(); });
        w.appendChild(bo); w.appendChild(bx); esc.appendChild(w);
      });
      var ne = document.createElement("input"); ne.type = "text"; ne.maxLength = 30; ne.placeholder = "Nombre de la escena"; ne.setAttribute("aria-label", "Nombre para guardar la pared actual como escena");
      var bg = crear("button", "", "＋ Guardar esta pared"); bg.type = "button"; bg.disabled = !sel.length;
      bg.addEventListener("click", function () {
        var n = ne.value.trim().slice(0, 30);
        if (!n) { decir("Escribí un nombre para la escena.", true); dibujar(); return; }
        var ya = -1; estado.escenas.forEach(function (x, i) { if (x.n.toLowerCase() === n.toLowerCase()) ya = i; });
        if (ya < 0 && estado.escenas.length >= MAX_ESC) { decir("Ya tenés " + MAX_ESC + " escenas. Borrá alguna para guardar otra.", true); dibujar(); return; }
        var nueva = { n: n, ids: sel.slice() };
        if (ya >= 0) estado.escenas[ya] = nueva; else estado.escenas.push(nueva);
        guardar(); decir("Escena «" + n + "» guardada."); dibujar();
      });
      ne.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); bg.click(); } });
      esc.appendChild(ne); esc.appendChild(bg);
      raiz.appendChild(esc);

      var av = crear("p", "aviso" + (avisoMalo ? " mal" : ""), aviso); av.setAttribute("role", "status");
      raiz.appendChild(av);

      if (sel.length) {
        var rej = crear("div", "rejilla n" + sel.length);
        sel.forEach(function (id, i) { rej.appendChild(casilla(porId(id), i + 1)); });
        var pared = crear("div", "pared");
        var cm = crear("div", "cm");
        var vv = crear("span", "vivo"); vv.appendChild(document.createElement("i")); vv.appendChild(document.createTextNode("EN VIVO"));
        cm.appendChild(vv);
        cm.appendChild(crear("span", "nc", sel.length + (sel.length === 1 ? " canal" : " canales")));
        cm.appendChild(crear("span", "aud", textoAudio()));
        cm.appendChild(crear("span", "teclas", "Teclas: 1-" + sel.length + " escuchar · 0 silencio · Esc salir"));
        cm.appendChild(crear("div", "rj"));
        var bs = crear("button", "", "✕ Salir"); bs.type = "button"; bs.addEventListener("click", salir); cm.appendChild(bs);
        pared.appendChild(cm); pared.appendChild(rej);
        raiz.appendChild(pared);
        bpc.addEventListener("click", function () { entrar(pared); });
      } else {
        raiz.appendChild(crear("p", "empty", "No elegiste ningún canal. Tocá uno de arriba para verlo."));
      }
    }
    if (catalogoListo && pendientes.length) {
      raiz.appendChild(crear("p", "note", "Todavía sin activar (se suman solos cuando se confirma su código de YouTube): " + pendientes.join(", ") + "."));
    }
    host.appendChild(raiz);
    if (catalogoListo) administrar(raiz);
    if (audioId) setTimeout(aplicarAudio, 50);
    pintarReloj(); programarReloj();
  }

  function montar(el) { host = el; cargar(); dibujar(); if (!catalogoListo) cargarCatalogo(); }

  var API = { montar: montar, leer: leer, srcEmbed: srcEmbed, _reposo: function (ms) { REPOSO_MS = ms; } };
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
