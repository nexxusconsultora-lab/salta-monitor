/* NEWAR — Explorador de conexiones (módulo propio, Cuenta 4)
   Lee data/conexiones.json (escáner scripts/conexiones.py) y, si existe, data/politicians.json
   (sólo lectura, para identificar actores). No modifica datos ni contratos.

   Montaje:   NewarConexiones.mount(elemento, {actor, destino, territorio, par, dias, estado, vista})
   Ruta hash: #/conexiones[/actor[/destino]]   (si existe window.V, se registra V.conexiones)
   Abrir desde fuera (voz, otros módulos): NewarConexiones.abrir({actor:'Sáenz', destino:'Milei'})

   Regla de evidencia: una coaparición sólo indica presencia conjunta en fuentes.
   No es alianza, relación personal ni causalidad. */
(function () {
  'use strict';
  var VERSION = '1.0';
  var VENCE_DIAS = 21;          // sin coaparición nueva desde hace más de N días => "vencida"
  var MAX_PASOS = 4;            // largo máximo de una ruta (en vínculos)
  var RUTAS_MAX = 6;
  var DATA_URL = 'data/conexiones.json', POL_URL = 'data/politicians.json';

  /* ------------------------------------------------------------------ utilidades */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fold(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function dia(s) { var t = Date.parse(s); return isNaN(t) ? null : t; }
  var DAY = 864e5;
  function fmtF(s) { if (!s) return 'sin fecha'; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[3] + '/' + m[2] + '/' + m[1] : esc(s); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }

  var TIPO_NOM = { persona: 'Persona', tema: 'Tema', frase: 'Frase automática', por_conocer: 'Por identificar', otro: 'Otro' };
  var ORIGEN = {
    nomina: 'Nómina de autoridades cargada en NEWAR', poderes: 'Poderes Ejecutivo/Legislativo cargados en NEWAR', judicial: 'Módulo judicial de NEWAR',
    'figura nacional': 'Figura nacional detectada por lista del escáner (no verificada contra fuente oficial)', tema: 'Tema definido por el escáner',
    frase: 'Frase repetida detectada automáticamente (puede ser ruido)', 'por conocer': 'Nombre que aparece en notas y todavía no se identificó'
  };
  var PAR_NOM = { pp: 'Persona–persona', pt: 'Persona–tema', pf: 'Persona–frase', pc: 'Con nombre por identificar', tt: 'Tema–tema / frase' };

  /* ------------------------------------------------------------------ adaptador */
  function tipoDe(t) { return t === 'p' || t === 'n' ? 'persona' : t === 't' ? 'tema' : t === 'f' ? 'frase' : t === 'c' ? 'por_conocer' : 'otro'; }
  function ambitoDe(a) { return a === 'sal' ? 'Salta' : a === 'nac' ? 'Nación' : a === 'mix' ? 'Ambos' : 'Sin dato'; }

  function adaptar(raw, pols) {
    var out = { ok: false, error: '', generado: '', ventana: 0, notas: 0, aviso: '', nodos: {}, aristas: [], ady: {}, puentes: [], sinEcoNac: [], sinEcoSal: [], porConocer: [], ref: Date.now(), advertencias: [] };
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodos) || !Array.isArray(raw.aristas)) { out.error = 'El archivo de conexiones no tiene el formato esperado (faltan nodos o aristas).'; return out; }
    out.generado = raw.generado || ''; out.ventana = raw.ventana_dias || 0; out.notas = raw.notas || 0; out.aviso = raw.aviso || '';
    var ref = dia(raw.generado); out.ref = ref == null ? Date.now() : ref;
    if (ref == null) out.advertencias.push('El archivo no informa cuándo se generó: «vencida» se calcula contra la fecha de hoy.');
    var polById = {};
    (Array.isArray(pols) ? pols : []).forEach(function (p) { if (p && p.id) polById[p.id] = p; });
    raw.nodos.forEach(function (n) {
      if (!n || !n.id) return;
      var pol = n.t === 'p' ? polById[String(n.id).slice(2)] : null;
      out.nodos[n.id] = {
        id: n.id, tipo: tipoDe(n.t), ambito: ambitoDe(n.a), label: n.l || n.id, cargo: n.r || (pol && pol.cargo) || '', vigente: n.v == null ? null : !!n.v,
        origen: n.k || '', n: n.n || 0, nn: n.nn || 0, ns: n.ns || 0, primera: n.p || '', ultima: n.u || '', nuevo: !!n.nuevo,
        notasEj: (n.ej || []).map(evid), ficha: pol ? { url: safeUrl(pol.source_url), verificado: pol.verificado_en || '', aliases: pol.aliases || [], distrito: pol.distrito || pol.department || '', vigencia: pol.vigencia || '', bloque: pol.bloque || '', ambito: pol.ambito || '' } : null
      };
    });
    (Array.isArray(pols) ? pols : []).forEach(function (p) {          // actores del padrón sin conexiones detectadas
      if (!p || !p.id || out.nodos['p:' + p.id]) return;
      out.nodos['p:' + p.id] = {
        id: 'p:' + p.id, tipo: 'persona', ambito: p.ambito === 'Nacional' ? 'Nación' : 'Salta', label: p.name || p.id, cargo: p.cargo || '', vigente: p.vigencia ? p.vigencia === 'vigente' : null,
        origen: 'padron', n: 0, nn: 0, ns: 0, primera: '', ultima: '', nuevo: false, notasEj: [],
        ficha: { url: safeUrl(p.source_url), verificado: p.verificado_en || '', aliases: p.aliases || [], distrito: p.distrito || p.department || '', vigencia: p.vigencia || '', bloque: p.bloque || '', ambito: p.ambito || '' }
      };
    });
    var vistos = {};
    raw.aristas.forEach(function (a) {
      if (!a || !out.nodos[a.a] || !out.nodos[a.b]) { out.advertencias.push('Se omitió un vínculo con un extremo que no está en la lista de actores.'); return; }
      var A = out.nodos[a.a], B = out.nodos[a.b], k = a.a + '|' + a.b;
      if (vistos[k]) return; vistos[k] = 1;
      var tp = [A.tipo, B.tipo].sort().join('+'), par;
      if (A.tipo === 'persona' && B.tipo === 'persona') par = 'pp';
      else if (A.tipo === 'por_conocer' || B.tipo === 'por_conocer') par = 'pc';
      else if (A.tipo === 'persona' || B.tipo === 'persona') par = (A.tipo === 'frase' || B.tipo === 'frase') ? 'pf' : 'pt';
      else par = 'tt';
      var ev = (a.e || []).map(evid), w = a.w || 0, ult = a.u || '', pri = a.p || '';
      var tu = dia(ult), vencida = tu != null && (out.ref - tu) > VENCE_DIAS * DAY;
      var motivos = [];
      if (!ult || !pri) motivos.push('faltan fechas de la primera o la última coaparición');
      if (!ev.length) motivos.push('el archivo no trae ninguna nota de respaldo para este vínculo');
      else {
        if (ev.some(function (e) { return !e.url; })) motivos.push('alguna nota de respaldo no tiene enlace');
        if (ev.some(function (e) { return !e.fecha; })) motivos.push('alguna nota de respaldo no tiene fecha');
        if (ev.some(function (e) { return !e.medio; })) motivos.push('alguna nota de respaldo no indica el medio');
      }
      if (w <= 1) motivos.push('una sola nota: es una pista, no un patrón');
      var indirecta = par !== 'pp';
      var terr = (a.cruce || (a.nn > 0 && a.ns > 0)) ? 'Cruce' : (a.nn > 0 ? 'Nación' : 'Salta');
      var e = { id: k, a: a.a, b: a.b, w: w, nn: a.nn || 0, ns: a.ns || 0, primera: pri, ultima: ult, ev: ev, par: par, terr: terr, cruce: !!a.cruce, nueva: !!a.nueva,
        vencida: vencida, incompleta: motivos.length > 0, motivos: motivos, indirecta: indirecta, edad: tu == null ? null : Math.round((out.ref - tu) / DAY) };
      out.aristas.push(e);
      (out.ady[a.a] = out.ady[a.a] || []).push(e); (out.ady[a.b] = out.ady[a.b] || []).push(e);
    });
    out.puentes = (raw.puentes || []).map(function (p) { return { id: p.id, score: p.score, pn: p.pn || [], ps: p.ps || [], en: (p.en || []).map(evid), es: (p.es || []).map(evid) }; });
    out.sinEcoNac = (raw.sin_eco_nacion || []).map(function (p) { return { id: p.id, n: p.n, pers: p.pn || [], ev: (p.en || []).map(evid) }; });
    out.sinEcoSal = (raw.sin_eco_salta || []).map(function (p) { return { id: p.id, n: p.n, pers: p.ps || [], ev: (p.es || []).map(evid) }; });
    out.porConocer = (raw.desconocidos || []).map(function (d) { return { id: d.id, con: d.con || [], temas: d.temas || [] }; });
    out.etiquetasRepetidas = {};
    var porEt = {};
    Object.keys(out.nodos).forEach(function (id) { var n = out.nodos[id]; if (n.tipo !== 'persona' && n.tipo !== 'por_conocer') return; var f = fold(n.label); (porEt[f] = porEt[f] || []).push(id); });
    Object.keys(porEt).forEach(function (f) { if (porEt[f].length > 1) porEt[f].forEach(function (id) { out.etiquetasRepetidas[id] = porEt[f].filter(function (x) { return x !== id; }); }); });
    out.ok = true; return out;
  }
  function evid(x) {
    if (Array.isArray(x)) return { titulo: x[0] || '', url: safeUrl(x[1]), medio: x[2] || '', fecha: x[3] || '', ambito: x[4] === 'nac' ? 'medio nacional' : x[4] === 'sal' ? 'medio de Salta' : '' };
    x = x || {}; return { titulo: x.titulo || '', url: safeUrl(x.url), medio: x.medio || '', fecha: x.fecha || '', ambito: x.ambito || '' };
  }

  /* ------------------------------------------------------------------ filtros, búsqueda, rutas */
  function filtroBase() { return { terr: '', par: { pp: 1, pt: 1, pf: 1, pc: 1, tt: 1 }, dias: 0, estado: '', viaTemas: true, viaFrases: false, viaPorConocer: false }; }
  function pasa(D, e, F) {
    if (F.terr && e.terr !== F.terr) return false;
    if (F.par && !F.par[e.par]) return false;
    if (F.dias) { if (e.edad == null || e.edad > F.dias) return false; }
    if (F.estado === 'vigente' && e.vencida) return false;
    if (F.estado === 'vencida' && !e.vencida) return false;
    if (F.estado === 'incompleta' && !e.incompleta) return false;
    return true;
  }
  function conexiones(D, id, F) { return (D.ady[id] || []).filter(function (e) { return pasa(D, e, F || filtroBase()); }); }
  function otro(e, id) { return e.a === id ? e.b : e.a; }

  function buscar(D, q, max) {
    q = fold(q); if (!q) return [];
    var toks = q.split(' '), res = [];
    Object.keys(D.nodos).forEach(function (id) {
      var n = D.nodos[id], h = fold(n.label + ' ' + n.cargo + ' ' + (n.ficha ? n.ficha.aliases.join(' ') : ''));
      var ok = toks.every(function (t) { return h.indexOf(t) >= 0; });
      if (!ok) return;
      var s = (fold(n.label) === q ? 100 : fold(n.label).indexOf(q) === 0 ? 50 : 10) + (n.tipo === 'persona' ? 5 : 0) + (D.ady[id] ? Math.min(D.ady[id].length, 20) / 4 : 0);
      res.push({ id: id, s: s });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, max || 12).map(function (r) { return D.nodos[r.id]; });
  }
  function resolver(D, x) {     // acepta id exacto o texto; devuelve un único actor o null (si es ambiguo, null)
    if (!x) return null; if (D.nodos[x]) return D.nodos[x];
    var r = buscar(D, x, 5); if (!r.length) return null;
    if (r.length === 1 || fold(r[0].label) === fold(x) && (r.length === 1 || fold(r[1].label) !== fold(x))) return r[0];
    return null;
  }

  function rutas(D, ida, idb, F, opt) {
    opt = opt || {}; var max = opt.max || RUTAS_MAX, largo = opt.largo || MAX_PASOS;
    var res = { ida: ida, idb: idb, rutas: [], motivo: '', cortado: false };
    if (!D.nodos[ida] || !D.nodos[idb]) { res.motivo = 'actor desconocido'; return res; }
    if (ida === idb) { res.motivo = 'mismo actor'; return res; }
    var gF = F || filtroBase();
    function permitido(id) { var t = D.nodos[id].tipo; return id === ida || id === idb || t === 'persona' || (t === 'tema' && gF.viaTemas) || (t === 'frase' && gF.viaFrases) || (t === 'por_conocer' && gF.viaPorConocer); }
    var ady = function (id) { return (D.ady[id] || []).filter(function (e) { return pasa(D, e, gF) && permitido(otro(e, id)); }); };
    if (!ady(ida).length) { res.motivo = 'sin_conexiones_a'; return res; }
    if (!ady(idb).length) { res.motivo = 'sin_conexiones_b'; return res; }
    // distancia mínima desde idb (BFS) para podar
    var dist = {}; dist[idb] = 0; var cola = [idb];
    while (cola.length) { var u = cola.shift(); if (dist[u] >= largo) continue; ady(u).forEach(function (e) { var v = otro(e, u); if (dist[v] == null && (v === ida || permitido(v))) { dist[v] = dist[u] + 1; cola.push(v); } }); }
    if (dist[ida] == null) { res.motivo = 'sin_ruta'; return res; }
    var hall = [], pasos = 0, visit = {}; visit[ida] = 1;
    (function dfs(u, camino, aristas) {
      if (res.cortado) return;
      if (++pasos > 60000) { res.cortado = true; return; }
      if (u === idb) { hall.push({ nodos: camino.slice(), aristas: aristas.slice() }); return; }
      if (aristas.length >= largo) return;
      ady(u).forEach(function (e) {
        var v = otro(e, u); if (visit[v] || dist[v] == null || dist[v] > largo - aristas.length - 1) return;
        visit[v] = 1; camino.push(v); aristas.push(e); dfs(v, camino, aristas); camino.pop(); aristas.pop(); visit[v] = 0;
      });
    })(ida, [ida], []);
    // (visit se marca para ida)
    hall.forEach(function (r) {
      r.pasos = r.aristas.length;
      r.debil = Math.min.apply(null, r.aristas.map(function (e) { return e.w; }));
      r.vencida = r.aristas.some(function (e) { return e.vencida; });
      r.incompleta = r.aristas.some(function (e) { return e.incompleta; });
      r.indirecta = r.pasos > 1 || r.aristas.some(function (e) { return e.indirecta; });
      r.reciente = Math.min.apply(null, r.aristas.map(function (e) { return e.edad == null ? 9999 : e.edad; }));
    });
    hall.sort(function (a, b) { return a.pasos - b.pasos || b.debil - a.debil || a.reciente - b.reciente; });
    var usadas = {}, sel = [];
    hall.forEach(function (r) { if (sel.length >= max) return; var clave = r.nodos.slice(1, -1).join('>'); if (usadas[clave]) return; usadas[clave] = 1; sel.push(r); });
    res.rutas = sel; res.total = hall.length;
    if (!sel.length) res.motivo = 'sin_ruta';
    return res;
  }

  /* ------------------------------------------------------------------ textos explicativos */
  function nombreT(n) { return n.tipo === 'tema' ? 'el tema «' + n.label + '»' : n.tipo === 'frase' ? 'la frase «' + n.label + '»' : n.label; }
  function explicaVinculo(D, e) {
    var A = D.nodos[e.a], B = D.nodos[e.b];
    var s = nombreT(A) + ' y ' + nombreT(B) + ' aparecen juntos en ' + plural(e.w, 'nota', 'notas') + ' del período relevado';
    if (e.ultima) s += ' (la última, el ' + fmtF(e.ultima) + ')'; s += '. ';
    s += 'Esto sólo indica presencia conjunta en fuentes: no prueba alianza, relación personal ni causalidad.';
    return s;
  }
  function explicaActor(D, id, F) {
    var n = D.nodos[id], es = conexiones(D, id, F), tot = (D.ady[id] || []).length;
    if (n.tipo === 'por_conocer') return 'Nombre pendiente de identificar. Aparece en notas junto a otros actores, pero NEWAR no sabe quién es ni lo une con ninguna persona por coincidencia de nombre.';
    if (!tot) return n.label + ' está en el padrón de NEWAR pero el escáner no detectó coapariciones con otros actores en la ventana de ' + (D.ventana || '?') + ' días. Eso no significa que no tenga relaciones: sólo que no hay notas relevadas que lo muestren.';
    if (!es.length) return n.label + ' tiene ' + plural(tot, 'conexión detectada', 'conexiones detectadas') + ', pero ninguna cumple los filtros actuales. Probá ampliar el período, el territorio o el tipo.';
    var c = { pp: 0, pt: 0, pf: 0, pc: 0, tt: 0 }, cruces = 0, venc = 0, inc = 0;
    es.forEach(function (e) { c[e.par]++; if (e.terr === 'Cruce') cruces++; if (e.vencida) venc++; if (e.incompleta) inc++; });
    var partes = [];
    if (c.pp) partes.push(plural(c.pp, 'persona', 'personas')); if (c.pt) partes.push(plural(c.pt, 'tema', 'temas')); if (c.pf) partes.push(plural(c.pf, 'frase automática', 'frases automáticas')); if (c.pc) partes.push(plural(c.pc, 'nombre por identificar', 'nombres por identificar'));
    var s = n.label + ' (' + n.ambito + (n.cargo ? ', ' + n.cargo : '') + ') coaparece en notas con ' + partes.join(', ') + '. ';
    if (cruces) s += plural(cruces, 'vínculo cruza', 'vínculos cruzan') + ' medios de Nación y de Salta. ';
    if (venc) s += plural(venc, 'está vencido', 'están vencidos') + ' (sin notas nuevas hace más de ' + VENCE_DIAS + ' días). ';
    if (inc) s += plural(inc, 'tiene', 'tienen') + ' evidencia incompleta. ';
    return s + 'Son coapariciones en fuentes: no indican alianza ni relación personal.';
  }
  function explicaRuta(D, r) {
    var p = r.nodos.map(function (id) { return D.nodos[id]; });
    if (r.pasos === 1) return explicaVinculo(D, r.aristas[0]);
    var t = 'Ruta de ' + r.pasos + ' pasos: ' + p.map(function (n) { return n.label; }).join(' → ') + '. ';
    r.aristas.forEach(function (e, i) { t += (i + 1) + ') ' + p[i].label + ' y ' + p[i + 1].label + ' aparecen juntos en ' + plural(e.w, 'nota', 'notas') + (e.vencida ? ' (vencida)' : '') + '. '; });
    return t + 'Es una ruta indirecta: cada paso es una presencia conjunta en fuentes; la ruta completa no demuestra que el primero y el último se conozcan o se relacionen.';
  }

  /* ------------------------------------------------------------------ carga de datos */
  var cache = null;
  function cargar(base) {
    if (cache) return cache;
    base = base || '';
    function J(u) { return fetch(base + u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + u); return r.json(); }); }
    cache = Promise.all([J(DATA_URL), J(POL_URL).catch(function () { return null; })]).then(function (r) {
      var D = adaptar(r[0], r[1]); if (!r[1]) D.advertencias.push('No se pudo leer data/politicians.json: se muestran sólo los actores del escáner, sin ficha de identificación.');
      return D;
    }).catch(function (e) { cache = null; return { ok: false, error: 'No se pudo cargar data/conexiones.json (' + (e && e.message || e) + '). Probá recargar; si sigue, el escáner todavía no generó el archivo.' }; });
    return cache;
  }

  /* ------------------------------------------------------------------ estilos */
  var CSS = '.nxc{--nxc-b:var(--line,#D9D1BF)}.nxc *{box-sizing:border-box}.nxc h2{margin:.2rem 0 .6rem}.nxc h3{margin:.9rem 0 .4rem;font-size:1.05rem}.nxc h4{margin:.7rem 0 .3rem;font-size:.95rem}' +
    '.nxc .aviso{background:var(--warn,#F6E7D8);border-left:4px solid var(--clay,#B1502E);padding:.6rem .8rem;border-radius:2px;font-size:.9rem;margin:.5rem 0}' +
    '.nxc details.lim{border:1px solid var(--nxc-b);border-radius:3px;padding:.4rem .8rem;margin:.5rem 0;font-size:.88rem;background:var(--raised,#FBF8F1)}.nxc details.lim summary{cursor:pointer;font-weight:600}.nxc details.lim ul{margin:.4rem 0 .2rem 1.1rem;padding:0}' +
    '.nxc .bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.7rem;margin:.7rem 0}.nxc label{display:block;font-size:.8rem;color:var(--soft,#5C554C);margin-bottom:.15rem}' +
    '.nxc input[type=text],.nxc select{width:100%;padding:.5rem .6rem;font:inherit;background:var(--raised,#FBF8F1);color:var(--ink,#211D1A);border:1px solid var(--soft,#5C554C);border-radius:3px;min-height:2.4rem}' +
    '.nxc .cb{position:relative}.nxc ul.lb{position:absolute;z-index:20;left:0;right:0;top:100%;margin:2px 0 0;padding:0;list-style:none;background:var(--raised,#FBF8F1);border:1px solid var(--soft,#5C554C);border-radius:3px;max-height:260px;overflow:auto;box-shadow:0 4px 14px rgba(0,0,0,.18)}' +
    '.nxc ul.lb li{padding:.45rem .6rem;cursor:pointer;border-bottom:1px solid var(--nxc-b);font-size:.9rem}.nxc ul.lb li[aria-selected=true],.nxc ul.lb li:hover{background:var(--indigo,#2B3A55);color:var(--onind,#fff)}.nxc ul.lb li small{opacity:.8;display:block}' +
    '.nxc .filt{display:flex;flex-wrap:wrap;gap:.8rem 1.2rem;align-items:flex-end;border:1px solid var(--nxc-b);padding:.6rem .8rem;border-radius:3px;background:var(--raised,#FBF8F1);margin:.5rem 0}.nxc .filt fieldset{border:0;margin:0;padding:0}.nxc .filt legend{font-size:.8rem;color:var(--soft)}.nxc .filt label.i{display:inline-flex;align-items:center;gap:.3rem;margin-right:.6rem;font-size:.85rem;color:var(--ink)}' +
    '.nxc button{font:inherit;cursor:pointer;border:1px solid var(--ink,#211D1A);background:var(--raised,#FBF8F1);color:var(--ink,#211D1A);padding:.35rem .7rem;border-radius:3px;min-height:2.2rem}.nxc button.pri{background:var(--indigo,#2B3A55);color:var(--onind,#fff);border-color:var(--indigo,#2B3A55)}.nxc button.lnk{border:0;background:none;text-decoration:underline;padding:.1rem .2rem;min-height:0;color:inherit;text-align:left}' +
    '.nxc :focus-visible{outline:3px solid var(--clay,#B1502E);outline-offset:2px}' +
    '.nxc [role=tablist]{display:flex;gap:.2rem;border-bottom:2px solid var(--ink,#211D1A);margin:.8rem 0 .6rem;flex-wrap:wrap}.nxc [role=tab]{border:1px solid transparent;border-bottom:0;margin-bottom:-2px;background:none}.nxc [role=tab][aria-selected=true]{background:var(--ink,#211D1A);color:var(--paper,#F3EEE2);font-weight:600}' +
    '.nxc .grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:1rem}@media(max-width:860px){.nxc .grid{grid-template-columns:1fr}}' +
    '.nxc .card{border:1px solid var(--nxc-b);background:var(--raised,#FBF8F1);padding:.8rem 1rem;border-radius:3px}.nxc .b{display:inline-block;font-size:.72rem;font-weight:600;padding:.05rem .45rem;border-radius:99px;border:1px solid currentColor;margin:0 .25rem .2rem 0;white-space:nowrap}' +
    '.nxc .b.sal{color:var(--pos,#4C7A5D)}.nxc .b.nac{color:var(--indigo,#2B3A55)}.nxc .b.mix,.nxc .b.cru{color:var(--clay,#B1502E)}.nxc .b.venc{color:var(--neg,#8B3A3A);border-style:dashed}.nxc .b.inc{color:var(--neu,#6F665A);border-style:dotted}.nxc .b.ind{color:var(--soft,#5C554C)}.nxc .b.nue{color:var(--pos,#4C7A5D)}' +
    '.nxc table{width:100%;border-collapse:collapse;font-size:.86rem}.nxc th,.nxc td{text-align:left;padding:.35rem .4rem;border-bottom:1px solid var(--nxc-b);vertical-align:top}.nxc th{font-size:.75rem;color:var(--soft);font-weight:600}.nxc tr.sel{background:var(--warn,#F6E7D8)}' +
    '.nxc .ev{list-style:none;margin:.3rem 0;padding:0}.nxc .ev li{border-left:3px solid var(--nxc-b);padding:.25rem .6rem;margin:.35rem 0;font-size:.86rem}.nxc .ev small{color:var(--soft)}' +
    '.nxc .vac{padding:1rem;border:1px dashed var(--soft);border-radius:3px;color:var(--soft);font-size:.92rem}.nxc .err{padding:.8rem 1rem;border:1px solid var(--neg,#8B3A3A);color:var(--negtx,#8B3A3A);border-radius:3px;background:var(--raised)}' +
    '.nxc .ruta{border:1px solid var(--nxc-b);border-radius:3px;margin:.6rem 0;padding:.6rem .8rem;background:var(--raised,#FBF8F1)}.nxc .ruta ol{margin:.3rem 0;padding-left:1.2rem}.nxc .dl{display:grid;grid-template-columns:max-content 1fr;gap:.2rem .8rem;font-size:.88rem;margin:.4rem 0}.nxc .dl dt{color:var(--soft)}.nxc .dl dd{margin:0}' +
    '.nxc svg.ego{width:100%;height:auto;max-height:420px;background:var(--paper,#F3EEE2);border:1px solid var(--nxc-b);border-radius:3px}.nxc svg.ego text{font-size:11px;fill:var(--ink,#211D1A)}.nxc .sr{position:absolute;left:-9999px}';
  function estilo() { if (document.getElementById('nxc-css')) return; var s = document.createElement('style'); s.id = 'nxc-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ------------------------------------------------------------------ interfaz */
  var uid = 0;
  function mount(el, params) {
    if (!el) return null; estilo(); params = params || {};
    var id0 = 'nxc' + (++uid), D = null;
    var S = { vista: params.vista || 'actor', a: '', b: '', sel: '', F: filtroBase(), mostrarTodas: false };
    var ctl = { abrir: abrir, estado: function () { return S; }, datos: function () { return D; } };
    el.innerHTML = '<section class="nxc" id="' + id0 + '" aria-labelledby="' + id0 + 't"><h2 id="' + id0 + 't">Explorador de conexiones</h2><p class="vac" role="status">Cargando conexiones…</p></section>';
    var root = el.querySelector('.nxc');
    cargar(params.base).then(function (d) {
      if (!d || !d.ok) { root.innerHTML = '<h2>Explorador de conexiones</h2><div class="err" role="alert">' + esc(d ? d.error : 'No se pudieron cargar los datos.') + '</div>'; return; }
      D = d; aplicarParams(params); pintar();
    });

    function aplicarParams(p) {
      var f = S.F;
      if (p.territorio) { var t = fold(p.territorio); f.terr = /cruce|ambos/.test(t) ? 'Cruce' : /salta|prov/.test(t) ? 'Salta' : /nac/.test(t) ? 'Nación' : ''; }
      if (p.par) { Object.keys(f.par).forEach(function (k) { f.par[k] = 0; }); String(p.par).split(',').forEach(function (k) { if (f.par.hasOwnProperty(k)) f.par[k] = 1; }); }
      if (p.dias) f.dias = +p.dias || 0;
      if (p.estado) f.estado = p.estado;
      if (p.actor) { var a = resolver(D, p.actor); if (a) S.a = a.id; else S.msg = 'No encontré un único actor para «' + p.actor + '». Elegilo en el buscador.'; }
      if (p.destino) { var b = resolver(D, p.destino); if (b) S.b = b.id; else S.msg = 'No encontré un único actor para «' + p.destino + '». Elegilo en el buscador.'; }
      if (S.a && S.b) S.vista = 'ruta'; else if (p.vista) S.vista = p.vista;
    }
    function abrir(p) { if (!D) { params = Object.assign({}, params, p); return; } S.sel = ''; S.msg = ''; aplicarParams(p || {}); pintar(); }

    function fila(label, inner) { return '<div>' + (label ? '<label for="' + label[0] + '">' + label[1] + '</label>' : '') + inner + '</div>'; }
    function filtros() {
      var f = S.F;
      function opt(v, t, cur) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + t + '</option>'; }
      return '<form class="filt" aria-label="Filtros" onsubmit="return false">' +
        '<div><label for="' + id0 + 'ft">Territorio del vínculo</label><select id="' + id0 + 'ft" data-f="terr">' + opt('', 'Todos', f.terr) + opt('Salta', 'Sólo notas de medios de Salta', f.terr) + opt('Nación', 'Sólo notas de medios nacionales', f.terr) + opt('Cruce', 'Cruce Nación↔Salta (ambos tipos de medios)', f.terr) + '</select></div>' +
        '<div><label for="' + id0 + 'fd">Período (última coaparición)</label><select id="' + id0 + 'fd" data-f="dias">' + opt('0', 'Todo el relevado (' + (D.ventana || '?') + ' días)', String(f.dias)) + opt('7', 'Últimos 7 días', String(f.dias)) + opt('14', 'Últimos 14 días', String(f.dias)) + opt('30', 'Últimos 30 días', String(f.dias)) + '</select></div>' +
        '<div><label for="' + id0 + 'fe">Estado</label><select id="' + id0 + 'fe" data-f="estado">' + opt('', 'Todos', f.estado) + opt('vigente', 'Sólo vigentes', f.estado) + opt('vencida', 'Sólo vencidos (sin notas hace más de ' + VENCE_DIAS + ' días)', f.estado) + opt('incompleta', 'Sólo con evidencia incompleta', f.estado) + '</select></div>' +
        '<fieldset><legend>Tipo de vínculo (entre qué se da la coaparición)</legend>' + Object.keys(PAR_NOM).map(function (k) { return '<label class="i"><input type="checkbox" data-par="' + k + '"' + (f.par[k] ? ' checked' : '') + '> ' + PAR_NOM[k] + '</label>'; }).join('') + '</fieldset>' +
        '<button type="button" data-act="limpiar">Quitar filtros</button></form>';
    }
    function badgesN(n) {
      var cl = n.ambito === 'Salta' ? 'sal' : n.ambito === 'Nación' ? 'nac' : 'mix';
      return '<span class="b ' + cl + '">' + esc(n.ambito) + '</span><span class="b ind">' + esc(TIPO_NOM[n.tipo]) + '</span>' + (n.vigente === false ? '<span class="b venc">cargo no vigente</span>' : '');
    }
    function badgesE(e) {
      return '<span class="b ' + (e.terr === 'Cruce' ? 'cru' : e.terr === 'Salta' ? 'sal' : 'nac') + '">' + (e.terr === 'Cruce' ? 'Cruce Nación↔Salta' : esc(e.terr)) + '</span>' +
        (e.indirecta ? '<span class="b ind" title="Vincula a un actor con un tema, una frase o un nombre sin identificar, no a dos personas">indirecto</span>' : '') +
        (e.vencida ? '<span class="b venc">vencido</span>' : '<span class="b nue">vigente</span>') + (e.incompleta ? '<span class="b inc">incompleto</span>' : '') + (e.nueva ? '<span class="b nue">nuevo</span>' : '');
    }
    function ident(n) {
      var h = '<div class="card"><h3 style="margin-top:0">' + esc(n.label) + '</h3><div>' + badgesN(n) + '</div><dl class="dl">';
      if (n.cargo) h += '<dt>Cargo</dt><dd>' + esc(n.cargo) + '</dd>';
      h += '<dt>Origen del dato</dt><dd>' + esc(ORIGEN[n.origen] || (n.origen === 'padron' ? 'Padrón de personas de NEWAR (sin coapariciones detectadas)' : n.origen || 'sin dato')) + '</dd>';
      if (n.ficha) {
        if (n.ficha.distrito) h += '<dt>Distrito/depto.</dt><dd>' + esc(n.ficha.distrito) + '</dd>';
        if (n.ficha.bloque) h += '<dt>Bloque</dt><dd>' + esc(n.ficha.bloque) + '</dd>';
        if (n.ficha.vigencia) h += '<dt>Vigencia</dt><dd>' + esc(n.ficha.vigencia) + '</dd>';
        h += '<dt>Fuente del cargo</dt><dd>' + (n.ficha.url ? '<a href="' + esc(n.ficha.url) + '" target="_blank" rel="noopener noreferrer">' + esc(n.ficha.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)) + '</a>' : 'sin enlace') + (n.ficha.verificado ? ' · verificado ' + fmtF(n.ficha.verificado) : ' · sin fecha de verificación') + '</dd>';
        if (n.ficha.aliases && n.ficha.aliases.length) h += '<dt>Alias</dt><dd>' + esc(n.ficha.aliases.join(', ')) + '</dd>';
      } else if (n.tipo === 'persona') h += '<dt>Identificación</dt><dd>sin ficha en el padrón de NEWAR: sólo se conoce el nombre y el ámbito que detectó el escáner</dd>';
      if (n.n) h += '<dt>Notas en la ventana</dt><dd>' + n.n + ' (' + n.nn + ' de medios nacionales, ' + n.ns + ' de Salta) · primera ' + fmtF(n.primera) + ' · última ' + fmtF(n.ultima) + '</dd>';
      h += '</dl>';
      if (D.etiquetasRepetidas[n.id]) h += '<p class="aviso" role="note">Hay otros actores con el mismo nombre (' + D.etiquetasRepetidas[n.id].map(function (i) { return esc(D.nodos[i].label + ' · ' + D.nodos[i].ambito + (D.nodos[i].cargo ? ' · ' + D.nodos[i].cargo : '')); }).join('; ') + '). NEWAR no los unifica: pueden ser la misma persona o homónimos.</p>';
      if (n.tipo === 'por_conocer') h += '<p class="aviso" role="note">Pista pendiente de identificar. Se detectó un nombre en las notas; NEWAR no lo asoció con ninguna persona por coincidencia de nombre.</p>';
      return h + '</div>';
    }
    function ego(n, es) {
      var top = es.slice().sort(function (x, y) { return y.w - x.w; }).slice(0, 14), W = 560, H = 360, cx = W / 2, cy = H / 2, R = 135;
      var h = '<svg class="ego" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" focusable="false">';
      top.forEach(function (e, i) { var ang = 2 * Math.PI * i / top.length - Math.PI / 2, x = cx + R * 1.5 * Math.cos(ang), y = cy + R * Math.sin(ang);
        h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--soft,#5C554C)" stroke-width="' + (1 + Math.min(4, e.w / 8)).toFixed(1) + '"' + (e.vencida || e.indirecta ? ' stroke-dasharray="5 4"' : '') + ' opacity="' + (e.vencida ? .45 : .85) + '"/>';
      });
      top.forEach(function (e, i) { var o = D.nodos[otro(e, n.id)], ang = 2 * Math.PI * i / top.length - Math.PI / 2, x = cx + R * 1.5 * Math.cos(ang), y = cy + R * Math.sin(ang), c = o.tipo === 'persona' ? (o.ambito === 'Salta' ? 'var(--pos,#4C7A5D)' : 'var(--indigo,#2B3A55)') : 'var(--neu,#6F665A)';
        h += '<g data-edge="' + esc(e.id) + '" style="cursor:pointer"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7" fill="' + c + '"/><text x="' + x.toFixed(1) + '" y="' + (y + (y > cy ? 19 : -12)).toFixed(1) + '" text-anchor="middle">' + esc(o.label.length > 22 ? o.label.slice(0, 21) + '…' : o.label) + '</text></g>'; });
      return h + '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="var(--clay,#B1502E)"/><text x="' + cx + '" y="' + (cy - 16) + '" text-anchor="middle" style="font-weight:700">' + esc(n.label) + '</text></svg><p class="sr">Gráfico decorativo: la misma información está en la lista de conexiones.</p>';
    }
    function tablaEdges(n, es) {
      var ord = es.slice().sort(function (x, y) { return (y.vencida ? 0 : 1) - (x.vencida ? 0 : 1) || y.w - x.w; }), lim = S.mostrarTodas ? ord.length : 25;
      var h = '<table><caption class="sr">Conexiones de ' + esc(n.label) + '</caption><thead><tr><th scope="col">Con</th><th scope="col">Tipo</th><th scope="col">Notas</th><th scope="col">Última</th><th scope="col">Estado</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>';
      ord.slice(0, lim).forEach(function (e) { var o = D.nodos[otro(e, n.id)];
        h += '<tr class="' + (S.sel === e.id ? 'sel' : '') + '"><td><button class="lnk" data-act="actor" data-id="' + esc(o.id) + '" aria-label="Ir al actor ' + esc(o.label) + '">' + esc(o.label) + '</button><br><small>' + esc(TIPO_NOM[o.tipo]) + ' · ' + esc(o.ambito) + '</small></td><td>' + esc(PAR_NOM[e.par]) + '</td><td>' + e.w + '</td><td>' + fmtF(e.ultima) + '</td><td>' + badgesE(e) + '</td>' +
          '<td><button data-act="vinculo" data-id="' + esc(e.id) + '" aria-label="Ver evidencia del vínculo con ' + esc(o.label) + '">Evidencia</button></td></tr>'; });
      h += '</tbody></table>';
      if (ord.length > lim) h += '<p><button data-act="todas">Mostrar las ' + ord.length + ' conexiones</button></p>';
      return h;
    }
    function detalleVinculo(eid) {
      var e = D.aristas.filter(function (x) { return x.id === eid; })[0]; if (!e) return '';
      var A = D.nodos[e.a], B = D.nodos[e.b];
      var h = '<div class="card" id="' + id0 + 'det" tabindex="-1"><h3 style="margin-top:0">' + esc(A.label) + ' ↔ ' + esc(B.label) + '</h3><div>' + badgesE(e) + '</div>' +
        '<p class="aviso" role="note">' + esc(explicaVinculo(D, e)) + '</p><dl class="dl">' +
        '<dt>Tipo de vínculo</dt><dd>Coaparición en fuentes (' + esc(PAR_NOM[e.par]) + ')</dd><dt>Dirección</dt><dd>ninguna: la coaparición no tiene sentido ni orden</dd>' +
        '<dt>Evidencia</dt><dd>' + (e.indirecta ? 'indirecta: ' + (e.par === 'pt' || e.par === 'pf' ? 'une a un actor con un tema o frase, no con otra persona' : e.par === 'pc' ? 'involucra un nombre sin identificar' : 'involucra temas') : 'presencia conjunta de dos personas en la misma nota') + '</dd>' +
        '<dt>Primera / última</dt><dd>' + fmtF(e.primera) + ' / ' + fmtF(e.ultima) + (e.edad != null ? ' (hace ' + e.edad + ' días respecto del escaneo)' : '') + '</dd>' +
        '<dt>Notas</dt><dd>' + e.w + ' en total: ' + e.nn + ' de medios nacionales, ' + e.ns + ' de medios de Salta</dd>' +
        '<dt>Estado</dt><dd>' + (e.vencida ? 'vencido: sin notas nuevas hace más de ' + VENCE_DIAS + ' días' : 'vigente en la ventana relevada') + '</dd></dl>';
      if (e.incompleta) h += '<h4>Evidencia incompleta</h4><ul>' + e.motivos.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      h += '<h4>Notas que sustentan el vínculo</h4>';
      if (!e.ev.length) h += '<p class="vac">El archivo no incluye notas de respaldo para este vínculo. No se puede revisar la fuente.</p>';
      else {
        h += '<ul class="ev">' + e.ev.map(function (x) { return '<li>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.titulo || 'sin título') + '</a>' : esc(x.titulo || 'sin título') + ' <em>(sin enlace)</em>') + '<br><small>' + esc(x.medio || 'medio sin dato') + ' · ' + fmtF(x.fecha) + (x.ambito ? ' · ' + esc(x.ambito) : '') + ' · tipo: nota de prensa</small></li>'; }).join('') + '</ul>';
        if (e.w > e.ev.length) h += '<p><small>Se muestran las ' + e.ev.length + ' notas más recientes de ' + e.w + '. El resto no se guarda en el archivo.</small></p>';
      }
      return h + '</div>';
    }
    function vistaActor() {
      var h = '';
      if (!S.a) return '<div class="vac">Buscá un actor arriba (persona, tema o nombre por identificar) para ver sus conexiones. También podés mirar el «Panorama del escáner».</div>';
      var n = D.nodos[S.a]; if (!n) return '<div class="err" role="alert">El actor «' + esc(S.a) + '» no está en los datos.</div>';
      var es = conexiones(D, S.a, S.F), tot = (D.ady[S.a] || []).length;
      h += '<div class="grid"><div>' + ident(n) + '</div><div class="card"><h3 style="margin-top:0">Explicación de la red</h3><p aria-live="polite">' + esc(explicaActor(D, S.a, S.F)) + '</p>' + (es.length ? ego(n, es) : '') + '</div></div>';
      h += '<h3>Conexiones directas (' + es.length + (es.length !== tot ? ' de ' + tot + ' sin filtrar' : '') + ')</h3>';
      if (!tot) h += '<div class="vac" role="status">Sin conexiones detectadas. ' + esc(n.label) + ' no coaparece con otros actores en las notas relevadas. No se inventan vínculos.</div>';
      else if (!es.length) h += '<div class="vac" role="status">Ningún vínculo cumple los filtros. <button data-act="limpiar">Quitar filtros</button></div>';
      else h += '<p><button data-act="csv">Descargar CSV de estas conexiones</button></p>' + tablaEdges(n, es);
      h += S.sel ? '<div id="' + id0 + 'dw">' + detalleVinculo(S.sel) + '</div>' : (es.length ? '<p class="vac">Elegí «Evidencia» en un vínculo para ver las notas que lo sustentan.</p>' : '');
      if (n.notasEj && n.notasEj.length) h += '<h3>Notas recientes donde aparece</h3><ul class="ev">' + n.notasEj.slice(0, 5).map(function (x) { return '<li>' + (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.titulo) + '</a>' : esc(x.titulo)) + '<br><small>' + esc(x.medio) + ' · ' + fmtF(x.fecha) + '</small></li>'; }).join('') + '</ul>';
      return h;
    }
    function vistaRuta() {
      var h = '<p>Elegí dos actores para buscar rutas explicables entre ellos. Cada paso es una coaparición en notas; la ruta completa es siempre indirecta.</p>';
      var f = S.F;
      h += '<fieldset class="filt" style="border:1px solid var(--line)"><legend>Por dónde puede pasar una ruta</legend><label class="i"><input type="checkbox" data-via="viaTemas"' + (f.viaTemas ? ' checked' : '') + '> Temas</label><label class="i"><input type="checkbox" data-via="viaFrases"' + (f.viaFrases ? ' checked' : '') + '> Frases automáticas (pueden ser ruido)</label><label class="i"><input type="checkbox" data-via="viaPorConocer"' + (f.viaPorConocer ? ' checked' : '') + '> Nombres por identificar</label></fieldset>';
      if (!S.a || !S.b) return h + '<div class="vac" role="status">Falta elegir ' + (!S.a && !S.b ? 'los dos actores' : !S.a ? 'el actor de origen' : 'el actor de destino') + '.</div>';
      var r = rutas(D, S.a, S.b, S.F), A = D.nodos[S.a], B = D.nodos[S.b];
      h += '<h3>' + esc(A.label) + ' → ' + esc(B.label) + '</h3>';
      if (r.motivo === 'mismo actor') return h + '<div class="vac" role="status">Elegiste el mismo actor dos veces.</div>';
      if (r.motivo === 'sin_conexiones_a' || r.motivo === 'sin_conexiones_b') { var q = r.motivo === 'sin_conexiones_a' ? A : B; return h + '<div class="vac" role="status">No hay ruta: ' + esc(q.label) + ' no tiene conexiones con los filtros actuales' + ((D.ady[q.id] || []).length ? ' (sí tiene sin filtrar: probá quitar filtros)' : ' ni sin filtrar: el escáner no lo detectó junto a otros actores') + '.</div>'; }
      if (r.motivo) return h + '<div class="vac" role="status">No se encontró ninguna ruta de hasta ' + MAX_PASOS + ' pasos con los filtros actuales. Eso no prueba que no haya relación: sólo que las notas relevadas no los conectan. Probá permitir temas o frases, o ampliar el período.</div>';
      h += '<p role="status">' + plural(r.total, 'ruta posible', 'rutas posibles') + (r.total > r.rutas.length ? ', se muestran las ' + r.rutas.length + ' más cortas y con más notas' : '') + (r.cortado ? '. La búsqueda se cortó por tamaño: puede haber más.' : '.') + '</p>';
      r.rutas.forEach(function (x, i) {
        h += '<div class="ruta"><h4 style="margin-top:0">Ruta ' + (i + 1) + ' · ' + plural(x.pasos, 'paso', 'pasos') + (x.indirecta ? ' <span class="b ind">indirecta</span>' : '') + (x.vencida ? '<span class="b venc">incluye vencidos</span>' : '') + (x.incompleta ? '<span class="b inc">evidencia incompleta</span>' : '') + '</h4><ol>';
        x.aristas.forEach(function (e, k) { var a = D.nodos[x.nodos[k]], b = D.nodos[x.nodos[k + 1]]; h += '<li>' + esc(a.label) + ' (' + esc(TIPO_NOM[a.tipo].toLowerCase()) + ') — ' + esc(b.label) + ' (' + esc(TIPO_NOM[b.tipo].toLowerCase()) + '): ' + plural(e.w, 'nota', 'notas') + ', última ' + fmtF(e.ultima) + ' ' + badgesE(e) + ' <button class="lnk" data-act="vinculo-ruta" data-id="' + esc(e.id) + '">ver evidencia</button></li>'; });
        h += '</ol><p>' + esc(explicaRuta(D, x)) + '</p></div>';
      });
      if (S.sel) h += '<div id="' + id0 + 'dw">' + detalleVinculo(S.sel) + '</div>';
      return h;
    }
    function nombreBtn(id) { var n = D.nodos[id]; return n ? '<button class="lnk" data-act="actor" data-id="' + esc(id) + '">' + esc(n.label) + '</button>' : esc(id); }
    function vistaPanorama() {
      var h = '<p class="aviso" role="note">Estos son resultados del escáner automático, no una validación. Que haya muchos vínculos o puentes no los vuelve más ciertos: cada uno se revisa con sus notas.</p>';
      h += '<p>Relevado el ' + fmtF(D.generado) + ': ' + D.notas.toLocaleString('es-AR') + ' notas de los últimos ' + D.ventana + ' días · ' + Object.keys(D.nodos).length + ' actores · ' + D.aristas.length + ' vínculos · ' + D.puentes.length + ' temas puente.</p>';
      h += '<h3>Temas puente Nación↔Salta</h3><p><small>Temas que aparecen en notas de medios nacionales y de Salta, con las personas más citadas en cada lado. Un tema compartido no implica que esas personas se relacionen.</small></p><ul>';
      D.puentes.slice(0, 15).forEach(function (p) { h += '<li><b>' + esc(D.nodos[p.id] ? D.nodos[p.id].label : p.id) + '</b> — Nación: ' + (p.pn.map(nombreBtn).join(', ') || 'sin dato') + ' · Salta: ' + (p.ps.map(nombreBtn).join(', ') || 'sin dato') + '</li>'; });
      h += '</ul><h3>Se habla en Nación y casi no en Salta</h3><ul>' + (D.sinEcoNac.slice(0, 10).map(function (p) { return '<li>' + nombreBtn(p.id) + ' · ' + p.n + ' notas</li>'; }).join('') || '<li>sin datos</li>') + '</ul>';
      h += '<h3>Se habla en Salta y casi no en Nación</h3><ul>' + (D.sinEcoSal.slice(0, 10).map(function (p) { return '<li>' + nombreBtn(p.id) + ' · ' + p.n + ' notas</li>'; }).join('') || '<li>sin datos</li>') + '</ul>';
      h += '<h3>Nombres por identificar (' + D.porConocer.length + ')</h3><p><small>Son pistas. No se unieron con ninguna persona. Aparecen en notas junto a:</small></p><ul>' + D.porConocer.slice(0, 25).map(function (p) { return '<li>' + nombreBtn(p.id) + ' — junto a ' + (p.con.map(nombreBtn).join(', ') || 'sin dato') + '</li>'; }).join('') + '</ul>';
      return h;
    }
    function limites() {
      return '<details class="lim" open><summary>Qué significa y qué no (límites del escáner)</summary><ul>' +
        '<li>Una <b>coaparición</b> sólo indica presencia conjunta en fuentes. No es alianza, relación personal ni causalidad.</li>' +
        '<li>Los vínculos salen de títulos de notas de los últimos ' + (D.ventana || '?') + ' días; no se lee el cuerpo de las notas.</li>' +
        '<li>Hay <b>frases automáticas ruidosas</b> (expresiones repetidas que no son temas políticos) y figuras extranjeras mezcladas.</li>' +
        '<li>Los <b>nombres por identificar</b> son pistas: no se asocian con personas del padrón por coincidencia de nombre.</li>' +
        '<li>Cada vínculo guarda sólo sus 2 notas más recientes. «Vencido» = sin notas nuevas hace más de ' + VENCE_DIAS + ' días.</li>' +
        '<li>No hay fechas de inicio/fin de cargos compartidos ni afiliaciones: ese tipo de vínculo documentado todavía no está cargado.</li></ul>' +
        (D.aviso ? '<p><small>Aviso del escáner: ' + esc(D.aviso) + '</small></p>' : '') + (D.advertencias.length ? '<p><small>Advertencias de carga: ' + esc(D.advertencias.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ')) + '</small></p>' : '') + '</details>';
    }
    function picker(idx, lab, valor, key) {
      var n = valor ? D.nodos[valor] : null;
      return '<div class="cb"><label for="' + id0 + idx + '">' + lab + '</label><input type="text" id="' + id0 + idx + '" data-pk="' + key + '" role="combobox" aria-expanded="false" aria-controls="' + id0 + idx + 'l" aria-autocomplete="list" autocomplete="off" value="' + esc(n ? n.label : '') + '" placeholder="Escribí un nombre…"><ul class="lb" id="' + id0 + idx + 'l" role="listbox" hidden></ul></div>';
    }
    function pintar(foco) {
      var tabs = [['actor', 'Actor y conexiones'], ['ruta', 'Rutas entre dos actores'], ['panorama', 'Panorama del escáner']];
      var h = '<h2 id="' + id0 + 't">Explorador de conexiones</h2>' +
        '<p class="aviso" role="note"><b>Una coaparición sólo indica presencia conjunta en fuentes.</b> No significa alianza, relación personal ni causalidad. Cada vínculo muestra las notas que lo sustentan.</p>' + limites() +
        '<div class="bar">' + picker('a', S.vista === 'ruta' ? 'Actor de origen' : 'Buscar actor', S.a, 'a') + (S.vista === 'ruta' ? picker('b', 'Actor de destino', S.b, 'b') : '') + '</div>' +
        (S.msg ? '<p class="aviso" role="alert">' + esc(S.msg) + '</p>' : '') + filtros() +
        '<div role="tablist" aria-label="Vistas">' + tabs.map(function (t) { return '<button role="tab" id="' + id0 + 'tb' + t[0] + '" aria-selected="' + (S.vista === t[0]) + '" tabindex="' + (S.vista === t[0] ? 0 : -1) + '" data-act="vista" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div role="tabpanel" aria-labelledby="' + id0 + 'tb' + S.vista + '">' + (S.vista === 'actor' ? vistaActor() : S.vista === 'ruta' ? vistaRuta() : vistaPanorama()) + '</div>';
      root.innerHTML = h;
      if (foco) { var f = root.querySelector(foco); if (f) f.focus(); }
    }

    /* ---- eventos (delegados) ---- */
    var pickIdx = -1;
    function cerrarLb(inp) { var lb = inp.parentNode.querySelector('ul.lb'); lb.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); pickIdx = -1; }
    function abrirLb(inp) {
      var lb = inp.parentNode.querySelector('ul.lb'), res = buscar(D, inp.value, 10);
      if (!inp.value.trim()) { cerrarLb(inp); return; }
      lb.innerHTML = res.length ? res.map(function (n, i) { return '<li role="option" id="' + lb.id + i + '" data-id="' + esc(n.id) + '" aria-selected="false">' + esc(n.label) + '<small>' + esc(TIPO_NOM[n.tipo]) + ' · ' + esc(n.ambito) + (n.cargo ? ' · ' + esc(n.cargo) : '') + ((D.ady[n.id] || []).length ? '' : ' · sin conexiones detectadas') + '</small></li>'; }).join('') : '<li role="option" aria-disabled="true">Sin resultados para «' + esc(inp.value) + '». Probá con otra parte del nombre o el cargo.</li>';
      lb.hidden = false; inp.setAttribute('aria-expanded', 'true'); pickIdx = -1;
    }
    function elegir(inp, id) {
      S[inp.getAttribute('data-pk')] = id; S.sel = ''; S.msg = ''; if (S.vista === 'panorama') S.vista = 'actor';
      pintar('#' + inp.id);
      var estado = root.querySelector('[role=tabpanel]'); if (estado) estado.setAttribute('tabindex', '-1');
    }
    root.addEventListener('input', function (ev) { var t = ev.target; if (t.getAttribute && t.getAttribute('data-pk')) abrirLb(t); });
    root.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (t.getAttribute && t.getAttribute('data-pk')) {
        var lb = t.parentNode.querySelector('ul.lb'), its = [].slice.call(lb.querySelectorAll('li[data-id]'));
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { if (lb.hidden) abrirLb(t); its = [].slice.call(lb.querySelectorAll('li[data-id]')); if (!its.length) return; ev.preventDefault(); pickIdx = (pickIdx + (ev.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length; its.forEach(function (x, i) { x.setAttribute('aria-selected', i === pickIdx); }); t.setAttribute('aria-activedescendant', its[pickIdx].id); }
        else if (ev.key === 'Enter') { ev.preventDefault(); var li = its[pickIdx >= 0 ? pickIdx : 0]; if (li) elegir(t, li.getAttribute('data-id')); else { var r = resolver(D, t.value); if (r) elegir(t, r.id); } }
        else if (ev.key === 'Escape') cerrarLb(t);
      } else if (t.getAttribute && t.getAttribute('role') === 'tab' && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
        var tabs = [].slice.call(root.querySelectorAll('[role=tab]')), i = tabs.indexOf(t); i = (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; S.vista = tabs[i].getAttribute('data-id'); pintar('#' + tabs[i].id);
      } else if (ev.key === 'Enter' && t.getAttribute && t.getAttribute('data-edge')) { S.sel = t.getAttribute('data-edge'); pintar('#' + id0 + 'det'); }
    });
    root.addEventListener('mousedown', function (ev) { var li = ev.target.closest && ev.target.closest('ul.lb li[data-id]'); if (li) { ev.preventDefault(); elegir(li.parentNode.parentNode.querySelector('input'), li.getAttribute('data-id')); } });
    root.addEventListener('focusout', function (ev) { var t = ev.target; if (t.getAttribute && t.getAttribute('data-pk')) setTimeout(function () { if (document.activeElement !== t && t.isConnected) cerrarLb(t); }, 120); });
    root.addEventListener('change', function (ev) {
      var t = ev.target, k;
      if ((k = t.getAttribute('data-f'))) { S.F[k] = k === 'dias' ? +t.value : t.value; pintar('#' + t.id); }
      else if ((k = t.getAttribute('data-par'))) { S.F.par[k] = t.checked ? 1 : 0; pintar(); }
      else if ((k = t.getAttribute('data-via'))) { S.F[k] = t.checked; pintar(); }
    });
    root.addEventListener('click', function (ev) {
      var g = ev.target.closest && ev.target.closest('[data-edge]'); if (g && !ev.target.closest('[data-act]')) { S.sel = g.getAttribute('data-edge'); pintar('#' + id0 + 'det'); return; }
      var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (a === 'vista') { S.vista = id; pintar('#' + b.id); }
      else if (a === 'actor') { S.a = id; S.sel = ''; S.vista = 'actor'; S.mostrarTodas = false; pintar('#' + id0 + 'a'); }
      else if (a === 'vinculo' || a === 'vinculo-ruta') { S.sel = id; pintar('#' + id0 + 'det'); }
      else if (a === 'limpiar') { S.F = Object.assign(filtroBase(), { viaTemas: S.F.viaTemas, viaFrases: S.F.viaFrases, viaPorConocer: S.F.viaPorConocer }); pintar(); }
      else if (a === 'todas') { S.mostrarTodas = true; pintar(); }
      else if (a === 'csv') csv();
    });
    function csv() {
      var n = D.nodos[S.a], es = conexiones(D, S.a, S.F), q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var l = [['actor', 'conectado_con', 'tipo_conexion', 'tipo_vinculo', 'notas', 'notas_nacionales', 'notas_salta', 'primera', 'ultima', 'estado', 'evidencia_incompleta', 'nota_titulo', 'nota_url', 'nota_medio', 'nota_fecha'].join(',')];
      es.forEach(function (e) { var o = D.nodos[otro(e, n.id)]; (e.ev.length ? e.ev : [{}]).forEach(function (x) { l.push([n.label, o.label, 'coaparición en fuentes', PAR_NOM[e.par], e.w, e.nn, e.ns, e.primera, e.ultima, e.vencida ? 'vencido' : 'vigente', e.incompleta ? 'sí' : 'no', x.titulo, x.url, x.medio, x.fecha].map(q).join(',')); }); });
      var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + l.join('\n')); a.download = 'conexiones-' + fold(n.label).replace(/ /g, '-') + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    }
    return ctl;
  }

  /* ------------------------------------------------------------------ API pública y registro */
  var activo = null;
  var API = {
    version: VERSION, mount: function (el, p) { activo = mount(el, p); return activo; },
    abrir: function (p) { if (activo) activo.abrir(p); else { location.hash = '#/conexiones' + (p && p.actor ? '/' + encodeURIComponent(p.actor) + (p.destino ? '/' + encodeURIComponent(p.destino) : '') : ''); } },
    core: { adaptar: adaptar, filtroBase: filtroBase, conexiones: conexiones, buscar: buscar, resolver: resolver, rutas: rutas, explicaActor: explicaActor, explicaRuta: explicaRuta, explicaVinculo: explicaVinculo, VENCE_DIAS: VENCE_DIAS },
    parametros: { actor: 'texto o id (p:..., n:..., t:...)', destino: 'texto o id', territorio: 'salta|nacion|cruce', par: 'pp,pt,pf,pc,tt', dias: '7|14|30', estado: 'vigente|vencida|incompleta', vista: 'actor|ruta|panorama' }
  };
  if (typeof window !== 'undefined') window.NewarConexiones = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  var VV = null; try { VV = (typeof V !== 'undefined') ? V : null; } catch (e) { VV = null; }
  if (VV && !VV.conexiones) {
    VV.conexiones = function (id, id2) {
      var cont = 'nxc-host-' + (++uid);
      setTimeout(function () { var el = document.getElementById(cont); if (el) API.mount(el, { actor: id ? decodeURIComponent(id) : '', destino: id2 ? decodeURIComponent(id2) : '' }); }, 0);
      return '<div id="' + cont + '"></div>';
    };
  }
})();
