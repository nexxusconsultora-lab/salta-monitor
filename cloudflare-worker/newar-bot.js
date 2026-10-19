/**
 * NEWAR · bot de Telegram con el que se puede conversar (Cloudflare Worker, gratis).
 *
 * Qué hace: contestás un mensaje al bot y te responde con datos de NEWAR. Se le puede preguntar:
 *   - lo de hoy y lo de ayer:    «qué pasó hoy», «lo último», «qué pasó ayer», «novedades de la tarde»
 *   - por área:                  «economía», «policiales en Salta», «salud ayer», /politica /seguridad ...
 *   - por medio:                 «qué dice Infobae», «qué publicó El Tribuno»
 *   - un tema cualquiera:        «dólar», «paro docente en Salta», «jubilados» (y si no hay, busca en vivo en Google News)
 *   - personas:                  «quién es Sáenz», «qué se dice de Cornejo», «quién es el gobernador», /personas
 *   - deportes:                  «cómo salió Boca», «resultado de River»
 *   - panorama:                  «de qué se habla hoy», «quién cubrió el paro de ATE»
 * No usa inteligencia artificial: busca en el índice liviano data/bot_index.json (lo arma scripts/bot_index.py cada pocos
 * minutos) y en el currículum de cada persona. Lo que no está en los datos, no lo inventa: lo dice.
 *
 * Instalación paso a paso: GUIA_BOT_TELEGRAM.md.
 * Variables (Settings → Variables and Secrets, como «Secret»):
 *   TELEGRAM_BOT_TOKEN  el token del bot (el mismo que ya usan los avisos)
 *   WEBHOOK_SECRET      una clave inventada por vos: solo letras, números, guion y guion bajo (ej. newar_2026_clave)
 *   ALLOWED_CHAT_IDS    tu chat id (el mismo TELEGRAM_CHAT_ID de los avisos); varios, separados por coma
 *   SITIO               (opcional) dirección del panel; por defecto la de abajo
 */

const SITIO_DEFECTO = "https://nexxusconsultora-lab.github.io/salta-monitor/";
const TTL_INDICE_MS = 120000;       // el índice se vuelve a bajar cada 2 minutos
const MAX_MENSAJE = 3900;           // Telegram admite 4096 caracteres por mensaje
const PAGINA = 8;                   // notas por respuesta; «➕ Ver más» muestra las siguientes
const TZ = "America/Argentina/Salta";

const EMOJI = {
  "Política y gobierno": "🏛️", "Economía y finanzas": "💰", "Policiales y seguridad": "🚨", "Justicia": "⚖️", "Salud": "🩺",
  "Educación y universidades": "🎓", "Minería y energía": "⛏️", "Agro y producción": "🌾", "Turismo": "🧳",
  "Transporte e infraestructura": "🚌", "Trabajo y gremios": "👷", "Clima y ambiente": "🌦️", "Accidentes y emergencias": "🚑",
  "Sociedad y género": "👥", "Ciencia y tecnología": "🔬", "Internacional": "🌎", "Deportes": "⚽", "Espectáculos y cultura": "🎭",
  "Otros temas": "📌",
};
const AREAS_SUAVES = new Set(["Deportes", "Espectáculos y cultura", "Internacional", "Otros temas"]);
// palabra que escribe la persona → área (la primera de cada área es la que usan los botones)
const AREAS = {
  politica: "Política y gobierno", gobierno: "Política y gobierno", economia: "Economía y finanzas", finanzas: "Economía y finanzas",
  seguridad: "Policiales y seguridad", policiales: "Policiales y seguridad", policia: "Policiales y seguridad", delitos: "Policiales y seguridad",
  justicia: "Justicia", tribunales: "Justicia", salud: "Salud", educacion: "Educación y universidades", universidades: "Educación y universidades",
  escuelas: "Educación y universidades", mineria: "Minería y energía", energia: "Minería y energía", agro: "Agro y producción",
  campo: "Agro y producción", turismo: "Turismo", transporte: "Transporte e infraestructura", trabajo: "Trabajo y gremios",
  gremios: "Trabajo y gremios", clima: "Clima y ambiente", tiempo: "Clima y ambiente", accidentes: "Accidentes y emergencias",
  sociedad: "Sociedad y género", tecnologia: "Ciencia y tecnología", ciencia: "Ciencia y tecnología",
  internacional: "Internacional", mundo: "Internacional", deportes: "Deportes", futbol: "Deportes", espectaculos: "Espectáculos y cultura",
  cultura: "Espectáculos y cultura",
};
const CLAVE_AREA = {};                      // área → palabra corta para los botones
for (const [k, a] of Object.entries(AREAS)) if (!CLAVE_AREA[a]) CLAVE_AREA[a] = k;

const FIN_FUERTE = /(dolar|\bbonos?\b|riesgo pais|reservas|bcra|banco central|inflacion|\btasas?\b|merval|acciones|plazo fijo|\bfmi\b|deuda|cepo|brecha|retenciones|aranceles|superavit|deficit|recaudacion|\barca\b|afip|jubilaciones|aguinaldo|salarios?|paritari|presupuesto|prestamos?|creditos?|bolsa|wall street|petroleo|brent|tarifas|inversion|rigi|exportaciones|importaciones|\bpbi\b|desempleo|canasta)/g;
const FIN_MERCADOS = /(wall street|bolsa|brent|precio del petroleo|\bdolar|bonos|riesgo pais|swap|mercados?)/;
const PALABRAS_VACIAS = new Set(("que se dice de sobre del la el los las en un una unos unas hoy ayer noticias noticia ultimas ultimos ultima novedades novedad " +
  "info informacion quien quienes es son fue era como esta estan hay algo nuevo con por para y a e o me contame decime hablame busca buscar buscame " +
  "dame mostrame quiero saber cosas ahora actual actualidad pasa paso pasan lo le al mas cual cuales cuando donde porque acerca tema temas " +
  "resultado resultados salio quedo gano ver mostrar sobre respecto segun dice dicen dijo publico publica").split(" "));
// palabras que se repiten en casi todos los titulares y no dicen de qué se habla
const GENERICAS = new Set(("argentina argentino argentinos gobierno nacional anos parte tras segun hace nuevo nueva nuevos nuevas video fotos claves dato datos " +
  "desde hasta entre sobre ante cuando donde porque ellos ellas todo toda todos todas cada puede pueden podria tiene tienen debe deben hoy ayer despues antes " +
  "primera primer primero mejor mayor menor luego ahora siempre nunca ademas aunque cuales cual quien quienes sera fueron esta este estos estas pais " +
  "salta salteno saltena provincia provincial ciudad contra semana semanas estados unidos artificial lunes martes miercoles jueves viernes sabado domingo " +
  "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre ultimo ultimos ultima ultimas fecha dias meses").split(" "));
// palabras que significan lo mismo para buscar: cualquiera del grupo encuentra a las demás
const GRUPOS_SINONIMOS = [
  ["paro", "huelga", "paros", "medida de fuerza"], ["sueldo", "salario", "salarios", "sueldos", "haberes"],
  ["nafta", "combustible", "combustibles", "gasoil"], ["jubilado", "jubilados", "jubilacion", "jubilaciones", "jubilatorio"],
  ["docente", "docentes", "maestro", "maestros", "maestra", "maestras"], ["policia", "policial", "policiales", "policias"],
  ["inflacion", "ipc", "precios"], ["cripto", "bitcoin", "criptomonedas"], ["colectivo", "colectivos", "omnibus"],
  ["alquiler", "alquileres", "inquilino", "inquilinos"], ["vacuna", "vacunas", "vacunacion"], ["incendio", "incendios", "fuego"],
  ["detenido", "detenidos", "detuvieron", "arrestado", "arrestados"], ["robo", "robos", "robaron", "robado"],
  ["escuela", "escuelas", "colegio", "colegios"], ["hospital", "hospitales", "sanatorio"], ["dolar", "dolares", "divisa", "divisas"],
];
const SINONIMOS = {};
for (const g of GRUPOS_SINONIMOS) for (const w of g) if (!w.includes(" ")) SINONIMOS[w] = g.filter((x) => x !== w && !x.includes(" "));

// ---------- utilidades ----------
const plano = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const enlace = (t, u) => (u && /^https?:\/\//.test(u) ? `<a href="${escAttr(u)}">${esc(t)}</a>` : esc(t));
const sinTags = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const fechaCorta = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}/${m[2]}` : ""; };
const soloPalabras = (s) => plano(s).replace(/[^a-z0-9ñ]+/g, " ").trim();      // «paro:» y «paro» son la misma palabra

function palabrasClave(texto, max = 6) {
  const out = [];
  for (const w of soloPalabras(texto).split(" ")) {
    if (w.length >= 3 && !PALABRAS_VACIAS.has(w) && !out.includes(w)) out.push(w);
  }
  return out.slice(0, max);
}
// ¿la palabra t está en el texto f (ya normalizado)? Cortas: palabra entera o su plural («paro» sí, «parodia» no).
// Largas (6+): alcanza el comienzo de la palabra («jubilad» encuentra «jubilados»).
function coincide(f, t) {
  const h = f.charCodeAt(0) === 32 && f.charCodeAt(f.length - 1) === 32 ? f : " " + f + " ";      // en el índice ya viene con espacios a los lados
  if (t.length >= 6) return h.includes(" " + t);
  return h.includes(" " + t + " ") || h.includes(" " + t + "s ") || h.includes(" " + t + "es ");
}
const coincideConSinonimos = (f, t) => coincide(f, t) || (SINONIMOS[t] || []).some((s) => coincide(f, s));

function distancia(a, b) {            // distancia de edición (para errores de tipeo en nombres)
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// ---------- datos ----------
let CACHE = { t: 0, idx: null };

async function cargarIndice(env) {
  const ahora = Date.now();
  if (CACHE.idx && ahora - CACHE.t < TTL_INDICE_MS) return CACHE.idx;
  const sitio = env.SITIO || SITIO_DEFECTO;
  try {
    const r = await fetch(sitio + "data/bot_index.json", { cf: { cacheTtl: 60 } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const idx = await r.json();
    const medios = new Map();                                    // clave sin espacios → nombre del medio
    const memo = new Map();                                      // son pocos medios: cada clave se calcula una sola vez
    const k = (m) => { let v = memo.get(m); if (v === undefined) { v = clave(m); memo.set(m, v); medios.set(v, m); } return v; };
    const normalizar = !(idx.v >= 2);                            // el índice v2 ya trae los textos sin tildes ni signos
    for (const h of idx.historias || []) {
      h.f = " " + (normalizar ? soloPalabras(h.f) : h.f) + " ";   // con espacios a los lados: «paro» se busca como « paro »
      h.mp = (h.m || []).map(k);
    }
    idx.medios = medios;
    CACHE = { t: ahora, idx };
  } catch (e) {
    if (!CACHE.idx) throw e;      // si falla pero hay uno viejo, se usa el viejo
  }
  return CACHE.idx;
}
const clave = (s) => plano(s).replace(/[^a-z0-9]+/g, "");
const fechaMax = (idx) => (idx.fechas || []).slice(-1)[0] || "";
const fechaAyer = (idx) => (idx.fechas || []).slice(-2, -1)[0] || "";

// ---------- medios ----------
// «infobae», «el tribuno», «tribuno», «pagina 12», «la nacion»: se busca por el nombre completo o sin el artículo
function buscarMedio(idx, texto) {
  const q = clave(texto.replace(/^(el|la|los|las)\s+/i, ""));
  if (q.length < 4) return null;
  for (const [k, nombre] of idx.medios) {
    const sinArt = k.replace(/^(el|la|los|las)/, "");
    if (k === q || sinArt === q || (q.length >= 5 && (sinArt.startsWith(q) || k.startsWith(q)))) return nombre;
  }
  return null;
}

// ---------- filtros, orden y paginación ----------
function esFinanzas(h) {
  if (h.a === "Deportes" || h.a === "Espectáculos y cultura") return false;
  if (h.a === "Economía y finanzas") return true;
  const t = plano(h.t);
  if (h.a === "Internacional") return FIN_MERCADOS.test(t);
  return (t.match(FIN_FUERTE) || []).length >= 2;
}
const FRANJAS = { manana: [0, 12 * 60 + 59, "por la mañana"], tarde: [13 * 60, 19 * 60 + 59, "por la tarde"], noche: [20 * 60, 24 * 60, "por la noche"] };
const minutos = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ""); return m ? +m[1] * 60 + +m[2] : null; };

// ¿es una nota de Salta? el título nombra un lugar de Salta (campo s), dice «Salta», o nombra a una autoridad provincial o municipal con ficha
function esDeSalta(idx, h) {
  if (h.s || coincide(h.f, "salta") || coincide(h.f, "salteno") || coincide(h.f, "saltena")) return true;
  if (!idx.idsSalta) idx.idsSalta = new Set((idx.personas || []).filter((p) => /provincial|municipal|salta/i.test(`${p.amb} ${p.c}`)).map((p) => p.id));
  return (h.p || []).some((id) => idx.idsSalta.has(id));
}

// o = { area, salta, dia: "hoy"|"ayer", franja, medio, orden: "hora", blando: excluir deportes/espectáculos/exterior, finanzas }
function predicado(idx, o) {
  const hoy = fechaMax(idx), ayer = fechaAyer(idx);
  const fecha = o.dia === "ayer" ? ayer : o.dia === "hoy" ? hoy : "";
  const [d1, d2] = o.franja ? FRANJAS[o.franja] : [0, 24 * 60];
  const med = o.medio ? clave(o.medio) : "";
  return (h) => {
    if (o.area && h.a !== o.area) return false;
    if (o.finanzas && !esFinanzas(h)) return false;
    if (o.salta && !esDeSalta(idx, h)) return false;
    if (fecha && h.d !== fecha) return false;
    if (med && !(h.mp || []).includes(med)) return false;
    if (o.blando && AREAS_SUAVES.has(h.a)) return false;
    if (o.franja) { const m = minutos(h.h); if (m === null || m < d1 || m > d2) return false; }
    return true;
  };
}

function filtrar(idx, o) {
  const hoy = fechaMax(idx);
  const xs = (idx.historias || []).filter(predicado(idx, o));
  xs.sort((a, b) => {
    const dia = (b.d === hoy) - (a.d === hoy);
    if (o.orden === "hora") return (b.d === a.d ? 0 : b.d.localeCompare(a.d)) || (b.h || "").localeCompare(a.h || "");
    return dia || b.n - a.n || (b.h || "").localeCompare(a.h || "");
  });
  return xs;
}

function buscarHistorias(idx, consulta, { max = PAGINA, offset = 0, filtro = null } = {}) {
  const toks = palabrasClave(consulta);
  if (!toks.length) return { hits: [], total: 0, toks };
  const necesarias = toks.length <= 2 ? toks.length : Math.ceil(toks.length * 0.67);
  const hoy = fechaMax(idx);
  const frase = soloPalabras(consulta);
  const res = [];
  for (const h of idx.historias || []) {
    if (filtro && !filtro(h)) continue;
    const n = toks.reduce((a, t) => a + (coincideConSinonimos(h.f, t) ? 1 : 0), 0);
    if (n < necesarias) continue;
    const bonoFrase = toks.length > 1 && (" " + h.f + " ").includes(" " + frase + " ") ? 15 : 0;      // la frase tal cual vale más
    res.push([n * 10 + bonoFrase + Math.min(h.n, 5) * 2 + (h.d === hoy ? 3 : 0), h]);
  }
  res.sort((a, b) => b[0] - a[0] || (b[1].h || "").localeCompare(a[1].h || ""));
  return { hits: res.slice(offset, offset + max).map((x) => x[1]), total: res.length, toks };
}

// ---------- personas ----------
function buscarPersonas(idx, consulta) {
  const q = soloPalabras(consulta);
  if (q.length < 3) return [];
  const toks = palabrasClave(consulta);
  const sc = new Map();
  for (const p of idx.personas || []) {
    let s = 0;
    for (const k of p.k || []) if ((" " + q + " ").includes(" " + k + " ")) s = Math.max(s, 100 + k.length);
    if (!s && toks.length && toks.every((t) => (p.k || []).some((k) => coincide(k, t)))) s = 80;
    if (!s && toks.length && toks.every((t) => coincide(soloPalabras(p.c), t))) s = 40;
    if (s) sc.set(p, s);
  }
  const arr = [...sc.entries()].sort((a, b) => b[1] - a[1] || (b[0].vig === "vigente") - (a[0].vig === "vigente") || b[0].tot - a[0].tot);
  return arr.map(([p, s]) => ({ p, s }));
}

// errores de tipeo: «saens» → Sáenz. Solo para palabras de 5+ letras, con una sola diferencia (dos si son muy largas).
// El vocabulario (palabra → personas que la usan) se arma una sola vez por índice, no en cada pregunta.
function personasParecidas(idx, consulta) {
  const toks = palabrasClave(consulta).filter((t) => t.length >= 5);
  if (!toks.length) return [];
  if (!idx.vocab) {
    idx.vocab = new Map();
    for (const p of idx.personas || []) for (const k of p.k || []) for (const w of k.split(" ")) if (w.length >= 5) { if (!idx.vocab.has(w)) idx.vocab.set(w, new Set()); idx.vocab.get(w).add(p); }
  }
  let comunes = null;                                         // personas que tienen una palabra parecida a CADA palabra escrita
  for (const t of toks) {
    const tope = t.length >= 9 ? 2 : 1, quienes = new Set();
    for (const [w, ps] of idx.vocab) if (Math.abs(w.length - t.length) <= tope && distancia(t, w) <= tope) for (const p of ps) quienes.add(p);
    comunes = comunes ? new Set([...comunes].filter((p) => quienes.has(p))) : quienes;
    if (!comunes.size) return [];
  }
  return [...comunes].slice(0, 4);
}

function historiasDe(idx, p, max = 4) {
  const toks = (p.k || []).filter((k) => k.length >= 5);
  return filtrar(idx, {}).filter((h) => (h.p || []).includes(p.id) || toks.some((k) => coincide(h.f, k))).slice(0, max);
}

function fichaPersona(idx, p, sitio, vivo) {
  const L = [`👤 <b>${esc(p.n)}</b>`];
  L.push(`<i>${esc(p.c || "Sin cargo cargado")}</i>${p.amb ? " · " + esc(p.amb) : ""}${p.vig ? " · " + esc(p.vig) : ""}`);
  if (p.esp) L.push(`🏷️ ${esc(p.esp)}`);
  L.push("");
  if (p.cv && (p.cv.r || (p.cv.tr || []).length)) {
    L.push("📄 <b>Currículum</b> <i>(solo lo que dice una fuente enlazada en el panel" + (p.cv.ok === "si" ? "; verificado" : p.cv.ok === "no" ? "; todavía sin verificar" : "") + ")</i>");
    if (p.cv.r) L.push(esc(p.cv.r));
    for (const [c, per] of p.cv.tr || []) L.push(`• ${esc(c)}${per ? " — " + esc(per) : ""}`);
  } else {
    L.push("📄 Todavía no hay currículum cargado de esta persona.");
  }
  L.push("");
  if (p.tot) {
    L.push(`📰 <b>Prensa</b>: ${p.tot} menciones registradas${p.m7 ? ` (${p.m7} en los últimos 7 días)` : ""}.`);
    L.push(`<i>Tono por titular, clasificación automática: ${p.pos} positivas · ${p.neu} neutrales · ${p.neg} negativas.</i>`);
  } else {
    L.push("📰 Sin menciones registradas en la prensa monitoreada.");
  }
  const hs = historiasDe(idx, p, 4);
  if (hs.length) {
    L.push("", "🗞️ <b>Lo último</b>");
    for (const h of hs) L.push(...itemHistoria(h, true));
  } else if ((p.ult || []).length) {
    L.push("", "🗞️ <b>Últimas notas registradas</b>");
    for (const u of p.ult) L.push(`• ${enlace(u.t, u.u)}`, `    <i>${esc(u.s)}${u.d ? " · " + fechaCorta(u.d) : ""}</i>`);
  }
  if (vivo && vivo.length) {
    L.push("", "🔎 <b>En vivo (Google News)</b>");
    for (const v of vivo) L.push(...itemVivo(v));
  }
  L.push("", `🔗 <a href="${escAttr(sitio + "#/persona/" + p.id)}">Ficha completa en el panel</a>`);
  return L.join("\n");
}

// ---------- formato ----------
const NUMEROS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
// n = posición en la lista (con número grande); sin n va con viñeta. destacar = titular en negrita (el primero de la lista)
function itemHistoria(h, conTema, n = 0, destacar = false) {
  const e = conTema ? "" : (EMOJI[h.a] || "📌") + " ";
  const pie = [(h.m || []).slice(0, 3).join(", ") + (h.n > 3 ? ` +${h.n - 3}` : ""), h.h, h.d ? fechaCorta(h.d) : ""].filter(Boolean).join(" · ");
  const tit = enlace(h.t, h.u);
  return [`${n ? NUMEROS[n - 1] || n + "." : "•"} ${h.s ? "📍 " : ""}${e}${destacar ? `<b>${tit}</b>` : tit}`, `    <i>${esc(pie)}</i>`];
}
const numerado = (hs, conTema, desde = 0) => hs.flatMap((h, i) => itemHistoria(h, conTema, desde + i + 1, desde + i === 0));
function itemVivo(v) { return [`• ${enlace(v.t, v.u)}`, `    <i>${esc([v.s, v.f].filter(Boolean).join(" · "))}</i>`]; }
function encabezado(idx, titulo) {
  const g = idx.generado ? new Date(idx.generado) : null;
  const hh = g && !isNaN(g) ? g.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
  return `${titulo}${hh ? `\n<i>Datos de las ${hh} · se actualizan cada pocos minutos</i>` : ""}`;
}

// botones que acompañan cada respuesta (tocar = como escribir el comando)
const BTN_PRINCIPAL = { inline_keyboard: [
  [{ text: "⚡ Hoy", callback_data: "/hoy" }, { text: "🕐 Lo último", callback_data: "/ultimas" }, { text: "💰 Economía", callback_data: "/economia" }],
  [{ text: "📍 Salta", callback_data: "/salta" }, { text: "🏛️ Política", callback_data: "/politica" }, { text: "🚨 Seguridad", callback_data: "/seguridad" }],
  [{ text: "📊 De qué se habla", callback_data: "/temas" }, { text: "👤 Personas", callback_data: "/personas" }],
] };
const conBotones = (extra) => ({ inline_keyboard: [...(extra ? [extra] : []), ...BTN_PRINCIPAL.inline_keyboard] });
const bytesDe = (s) => new TextEncoder().encode(s).length;
const botonMas = (cb, falta) => (bytesDe(cb) <= 64 ? [{ text: `➕ Ver más (${falta})`, callback_data: cb }] : null);

// ---------- Google News en vivo ----------
const ent = (s) => String(s).replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
async function buscarEnVivo(q, max = 5, ventana = "when:3d") {
  const base = "https://news.google.com/rss/search?q=";
  for (const extra of [" " + ventana, ""]) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 4500);
      const r = await fetch(base + encodeURIComponent(q + extra) + "&hl=es-419&gl=AR&ceid=AR:es-419", { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; NEWAR-bot/1.0)" } });
      clearTimeout(to);
      if (!r.ok) continue;
      const xml = await r.text();
      const out = [], vistos = new Set();
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const it = m[1];
        const t0 = /<title>([\s\S]*?)<\/title>/.exec(it), u = /<link>([\s\S]*?)<\/link>/.exec(it);
        if (!t0 || !u) continue;
        const src = /<source[^>]*>([\s\S]*?)<\/source>/.exec(it);
        const d = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(it);
        let t = ent(t0[1]).trim();
        const fuente = src ? ent(src[1]).trim() : "";
        if (fuente && t.endsWith(" - " + fuente)) t = t.slice(0, -(fuente.length + 3));
        const k = plano(t).slice(0, 50);
        if (vistos.has(k)) continue;
        vistos.add(k);
        let f = "";
        if (d) { const dt = new Date(ent(d[1])); if (!isNaN(dt)) f = dt.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(",", ""); }
        out.push({ t, u: ent(u[1]).trim(), s: fuente, f });
        if (out.length >= max) break;
      }
      if (out.length) return out;
    } catch (_) { /* se prueba sin ventana, o se sigue sin resultados en vivo */ }
  }
  return [];
}

// ---------- entender lo que escribe la persona ----------
const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

// la frase se entiende sobre el texto sin tildes ni mayúsculas, pero lo que se repite en pantalla conserva cómo lo escribió la persona
function restaurar(crudo, residual) {
  const quedan = String(residual).split(" ").filter(Boolean);
  const out = [];
  let k = 0;
  for (const w of crudo.replace(/[¿?¡!.,;:"()]/g, " ").split(/\s+/).filter(Boolean)) {
    if (k < quedan.length && plano(w) === quedan[k]) { out.push(w); k++; }
  }
  return k === quedan.length ? out.join(" ") : String(residual);
}

// «/ver economia salta ayer tarde ultimas medio:infobae +8» → filtros (así se arman los botones «Ver más»)
function filtrosDeTexto(texto) {
  const o = {};
  for (const w of plano(texto).split(/\s+/).filter(Boolean)) {
    if (w === "plata") o.finanzas = true;
    else if (AREAS[w]) o.area = AREAS[w];
    else if (w === "salta") o.salta = true;
    else if (w === "ayer" || w === "hoy") o.dia = w;
    else if (FRANJAS[w]) o.franja = w;
    else if (w === "ultimas") o.orden = "hora";
    else if (w.startsWith("medio:")) o.medio = w.slice(6);
    else if (/^\+\d+$/.test(w)) o.offset = +w.slice(1);
  }
  return o;
}
function comandoVer(o, offset) {
  const p = ["/ver"];
  if (o.area) p.push(CLAVE_AREA[o.area]);
  if (o.finanzas) p.push("plata");
  if (o.salta) p.push("salta");
  if (o.dia) p.push(o.dia);
  if (o.franja) p.push(o.franja);
  if (o.orden === "hora") p.push("ultimas");
  if (o.medio) p.push("medio:" + clave(o.medio));
  p.push("+" + offset);
  return p.join(" ");
}

function entenderComando(crudo) {
  const m = /^\/([a-zA-ZñÑáéíóúÁÉÍÓÚ_]+)(?:@\w+)?\s*([\s\S]*)$/.exec(crudo);
  if (!m) return { cmd: "ayuda", arg: "", o: {} };
  const cmd = plano(m[1]);
  let arg = m[2].trim();
  const off = /\s*\+(\d+)$/.exec(arg);
  const o = {};
  if (off) { o.offset = +off[1]; arg = arg.slice(0, off.index).trim(); }
  if (cmd === "ver") return { cmd: "ver", arg, o: { ...filtrosDeTexto(arg), ...o } };
  if (cmd === "hoy") return { cmd: "ver", arg, o: { ...o, blando: true } };
  if (cmd === "ultimas" || cmd === "ultimo") return { cmd: "ver", arg, o: { ...o, orden: "hora", blando: true } };
  if (cmd === "ayer") return { cmd: "ver", arg, o: { ...o, dia: "ayer", blando: true } };
  if (cmd === "salta") return { cmd: "ver", arg, o: { ...o, salta: true, blando: true } };
  if (cmd === "economia" || cmd === "finanzas") return { cmd: "ver", arg, o: { ...o, finanzas: true } };
  if (AREAS[cmd]) return { cmd: "ver", arg, o: { ...o, area: AREAS[cmd], ...(plano(arg) === "salta" ? { salta: true } : {}) } };
  if (cmd === "dolar") return { cmd: "buscar", arg: "dolar", o };
  return { cmd, arg, o };
}

function entender(texto) {
  const crudo = String(texto || "").trim();
  if (crudo.startsWith("/")) return entenderComando(crudo);
  let t = plano(crudo).replace(/[¿?¡!.,;:"()]/g, " ").replace(/\s+/g, " ").trim();
  const o = {};
  // saludos, gracias y «¿qué sos?»
  if (/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|menu|ayuda|help|start|empezar|comenzar|hola newar)$/.test(t)) return { cmd: "ayuda", arg: "", o };
  if (/^(gracias|muchas gracias|mil gracias|genial|excelente|perfecto|buenisimo|ok|oka|dale|listo|joya|barbaro|chau|adios|hasta luego|de nada)$/.test(t)) return { cmd: "social", arg: t, o };
  if (/(quien sos|que sos|que haces|que podes hacer|como funcionas|para que servis|que sabes hacer|como te uso|como se usa|que te puedo preguntar|que puedo preguntar)/.test(t)) return { cmd: "ayuda", arg: "", o };
  if (/^(ejemplos?|preguntas de ejemplo|dame ejemplos|dame un ejemplo|que preguntas)$/.test(t)) return { cmd: "ejemplos", arg: "", o };
  // un día que ya no está en el índice (solo hay hoy y ayer): se lo explica en vez de contestar cualquier cosa
  if (/(que paso|noticias|novedades|que se dijo|resumen|titulares)/.test(t) &&
      new RegExp(`\\b(\\d{1,2} de (${MESES})|semana pasada|la semana|anteayer|antes de ayer|hace \\d+ dias|el mes pasado|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo)\\b`).test(t)) return { cmd: "fecha_vieja", arg: "", o };

  // modificadores: día, franja horaria, «lo último», «en Salta». Se sacan del texto y quedan como filtros.
  const toma = (rx) => { const r = rx.test(t); if (r) t = t.replace(rx, " ").replace(/\s+/g, " ").trim(); return r; };
  if (toma(/\banoche\b/)) { o.dia = "ayer"; o.franja = "noche"; }
  if (toma(/\bayer\b/)) o.dia = "ayer";
  if (toma(/\bhoy\b/)) o.dia = o.dia || "hoy";
  if (toma(/\b(?:esta|por la|a la|durante la|de la|en la) manana\b/)) o.franja = "manana";
  else if (toma(/\b(?:esta|por la|a la|durante la|de la|en la) tarde\b/)) o.franja = "tarde";
  else if (toma(/\b(?:esta noche|por la noche|a la noche|de la noche|durante la noche)\b/)) o.franja = "noche";
  if (toma(/\b(?:lo ultimo|ultimas?|ultimos?|recientes?|recien|ahora mismo|en este momento|ahora)\b/)) o.orden = "hora";
  if (toma(/\b(?:en|de|del|para|desde|por)(?: la ciudad de| la provincia de)? salta\b|\bsalten[oa]s?\b/)) o.salta = true;

  // al sacar «ayer» de «titulares de ayer» queda un «de» colgando: se limpia
  let previo;
  do { previo = t; t = t.replace(/\s+(?:de la|de|del|en|para|por|desde|durante|a la)$/, "").trim(); } while (t !== previo);
  let m;
  const arg = (x) => restaurar(crudo, x);
  if (/^(?:quienes|que personas|que personajes|a quienes|que politicos|que gente)(?: estan| aparecen| salen| nombran| mas| se nombran| hay)*(?: en las noticias| en los titulares| en el diario)?$|^(?:personajes|personas|politicos|gente|protagonistas)(?: del dia| mas nombrados)?$|^(?:los )?mas nombrados$/.test(t)) return { cmd: "personas", arg: "", o };
  if (/^(?:de que se habla|de que hablan|que se habla|temas|tendencias|trending|que es tendencia|que esta de moda|que es lo que mas se habla|de que habla la prensa|panorama|que temas hay)$/.test(t)) return { cmd: "temas", arg: "", o };
  if ((m = /^(?:que medios|que diarios|que portales|cuantos medios|quien|quienes|que medio) (?:cubrio|cubrieron|publico|publicaron|hablan|hablaron|dicen|dijeron|trataron|tocaron|levanto|levantaron) (?:de |sobre |del |acerca de |el |la |los |las )?(.+)$/.exec(t))) return { cmd: "cobertura", arg: arg(m[1]), o };
  if ((m = /^quien (?:es|fue|era|son) (.+)$/.exec(t))) return { cmd: "quien", arg: arg(m[1] + (o.salta ? " salta" : "")), o };
  if ((m = /^(?:resultado|como salio|como quedo|como le fue|quien gano|cuanto salio|marcador|como va|como van|como salieron|como quedaron)(?: de| del| el| la| los| las)? ?(.*)$/.exec(t))) return { cmd: "deporte", arg: arg(m[1]), o };
  if ((m = /^(?:que )?(?:dice|dicen|publico|publica|publicaron|informa|informo|titula|titulo|trae|tiene|segun)(?: el| la| los| las)? (.+)$/.exec(t)) && !/^(?:se )/.test(m[1])) return { cmd: "libre", arg: arg(m[1]), o, medioPosible: true };
  if (/^(?:(?:que|q) (?:paso|pasa|hay de nuevo|esta pasando|hay|novedades hay|se sabe|onda|sabemos)|noticias|novedades|lo mas importante|resumen(?: del dia)?|titulares|que hay|info|informacion)?$/.test(t)) return { cmd: "ver", arg: "", o: { ...o, blando: true } };
  const sinPrefijo = t.replace(/^(?:(?:ultimas )?noticias|novedades|que pasa|que paso|que hay|informacion|info|todo|lo que pasa|que se dice|que dicen|que se sabe)(?: de| del| sobre| en| con| acerca de)? /, "").replace(/^(?:la|el|los|las) /, "");
  if (/^(?:economia|finanzas|plata|la plata|la economia)$/.test(sinPrefijo)) return { cmd: "ver", arg: "", o: { ...o, finanzas: true } };
  if (AREAS[sinPrefijo]) return { cmd: "ver", arg: "", o: { ...o, area: AREAS[sinPrefijo] } };
  if ((m = /^(?:(?:que|q) (?:se dice|dicen|dijo|paso|pasa|hay|novedades hay|sabemos|se sabe|onda)|ultimas noticias|noticias|novedades|info|informacion|contame|decime|hablame|mostrame|dame|busca|buscame|buscar|quiero saber|quiero ver|quiero info)(?: de| sobre| del| con| acerca de| respecto a| en)? ?(.+)$/.exec(t))) return { cmd: "libre", arg: arg(m[1]), o, medioPosible: true };
  return { cmd: "libre", arg: arg(t) || crudo.replace(/[¿?¡!]/g, "").trim(), o };
}

// ---------- respuestas ----------
const AYUDA = [
  "Soy <b>NEWAR</b>, el bot de prensa de Salta. Preguntame como si hablaras con una persona:",
  "",
  "🕐 <b>Lo de hoy</b>: «qué pasó hoy», «lo último», «qué pasó ayer», «novedades de la tarde», «anoche»",
  "🗂️ <b>Por área</b>: «economía», «policiales en Salta», «salud ayer», «política» (o /economia /salud /politica…)",
  "📰 <b>Por medio</b>: «qué dice Infobae», «qué publicó El Tribuno»",
  "🔎 <b>Un tema</b>: «dólar», «paro docente en Salta», «jubilados». Si no está en NEWAR, busco en vivo en Google News",
  "👤 <b>Personas</b>: «quién es Sáenz», «qué se dice de Cornejo», «quién es el intendente», /personas",
  "⚽ <b>Deportes</b>: «cómo salió Boca», «resultado de River»",
  "📊 <b>Panorama</b>: «de qué se habla hoy», «quién cubrió el paro de ATE»",
  "",
  "Escribí /ejemplos para ver más ideas, o /estado para saber si los datos están al día.",
  "<i>Respondo con titulares de los medios monitoreados y fichas con fuente. No invento nada: si no encuentro algo, te lo digo.</i>",
].join("\n");

const EJEMPLOS = [
  "💡 <b>Probá preguntarme…</b>", "",
  "• qué pasó hoy", "• lo último", "• qué pasó ayer", "• novedades de la tarde en Salta", "• economía", "• policiales en Salta",
  "• qué dice Infobae", "• qué publicó El Tribuno sobre el paro", "• dólar", "• paro docente en Salta", "• jubilados ayer",
  "• quién es Sáenz", "• qué se dice de Cornejo", "• quién es el intendente de Salta", "• quiénes están en las noticias",
  "• cómo salió Boca", "• de qué se habla hoy", "• quién cubrió el paro de ATE", "",
  "<i>Los botones de abajo te llevan a las secciones principales sin escribir.</i>",
].join("\n");

function titulo(idx, o, base) {
  const partes = [];
  const soloSalta = o.salta && !o.area && !o.finanzas && !o.medio;
  if (o.area) partes.push(`${EMOJI[o.area] || "📌"} <b>${esc(o.area)}</b>`);
  else if (o.finanzas) partes.push("💰 <b>Economía y finanzas</b>");
  else if (soloSalta) partes.push("📍 <b>En Salta</b>");
  else if (o.medio) partes.push(`📰 <b>${esc(idx.medios.get(clave(o.medio)) || o.medio)}</b>`);
  else partes.push(base);
  const extra = [];
  if (o.salta && !soloSalta) extra.push("en Salta");
  if (o.dia === "ayer") extra.push("ayer"); else if (o.dia === "hoy") extra.push("hoy");
  if (o.franja) extra.push(FRANJAS[o.franja][2]);
  if (o.orden === "hora") extra.push("lo más reciente primero");
  return partes[0] + (extra.length ? " · " + extra.join(" · ") : "");
}

async function responder(env, texto) {
  const idx = await cargarIndice(env);
  const sitio = env.SITIO || SITIO_DEFECTO;
  const q = entender(texto);
  const { cmd, arg } = q;
  const o = q.o || {};

  if (cmd === "start" || cmd === "ayuda" || cmd === "help") return { texto: AYUDA, foto: cmd === "start" };
  if (cmd === "ejemplos") return { texto: EJEMPLOS };
  if (cmd === "social") return { texto: /chau|adios|hasta/.test(arg) ? "¡Hasta luego! Cuando quieras, escribime." : "¡De nada! Si querés, probá <b>lo último</b> o <b>de qué se habla hoy</b>." };
  if (cmd === "fecha_vieja") return { texto: `Mi índice tiene solo <b>hoy y ayer</b> (${esc((idx.fechas || []).map(fechaCorta).join(" y "))}). Para días anteriores usá el panel:`, botones: { inline_keyboard: [[{ text: "🔎 Panel completo", url: sitio + "#/diario" }]] } };
  if (cmd === "estado") return { texto: estado(idx, env) };
  if (cmd === "personas" || cmd === "personajes") return personasDelDia(idx);
  if (cmd === "temas") return temasDelDia(idx);
  if (cmd === "cobertura" || cmd === "medios") return cobertura(idx, arg);
  if (cmd === "ver") return listado(idx, o, "⚡ <b>Lo más importante</b>");
  if (cmd === "medio") { const nombre = buscarMedio(idx, arg); return nombre ? listado(idx, { ...o, medio: nombre }, "📰") : { texto: `No encontré un medio llamado «${esc(arg)}» en los datos de hoy y ayer.` }; }
  if (cmd === "deporte") return await porDeporte(idx, arg, o);
  if (cmd === "persona" || cmd === "quien") return await porPersona(env, idx, sitio, arg);
  if (cmd === "buscar" || cmd === "libre") {
    if (q.medioPosible || cmd === "libre") {                  // «qué dice Infobae», «noticias de El Tribuno»: si es un medio, se lista el medio
      const nombre = buscarMedio(idx, arg);
      if (nombre && (q.medioPosible || clave(arg) === clave(nombre))) return listado(idx, { ...o, medio: nombre, offset: o.offset }, "📰");
    }
    if (cmd === "libre") {
      const cand = buscarPersonas(idx, arg).filter((c) => c.s >= 80);      // nombre completo o apellido
      if (cand.length) return await porPersona(env, idx, sitio, arg, cand);
    }
    return await porBusqueda(idx, arg, o);
  }
  return { texto: "No conozco ese comando. Escribime lo que quieras saber, /ejemplos o /ayuda." };
}

// lista paginada con filtros: lo más importante, por área, en Salta, por día, franja, medio…
function listado(idx, o, base) {
  const todo = filtrar(idx, { ...o, blando: o.blando && !o.area && !o.medio });
  const desde = o.offset || 0;
  const hs = todo.slice(desde, desde + PAGINA);
  const tit = titulo(idx, o, base);
  if (!hs.length) {
    return { texto: desde ? "No hay más notas para ese filtro." : `${tit}\n\nNo encontré notas con ese filtro en los datos de hoy y ayer. Probá sin «${o.franja ? "la franja horaria" : o.salta ? "en Salta" : "el día"}» o escribí /ejemplos.` };
  }
  const conTema = !!o.area;
  const falta = todo.length - desde - hs.length;
  const mas = falta > 0 ? botonMas(comandoVer(o, desde + PAGINA), falta) : null;
  return { texto: [encabezado(idx, tit + (todo.length > PAGINA ? ` — ${todo.length} historias` : "")), "", ...numerado(hs, conTema, desde)].join("\n"), botones: conBotones(mas) };
}

async function porPersona(env, idx, sitio, consulta, cand) {
  if (!palabrasClave(consulta).length) return { texto: "Decime de quién: por ejemplo <b>quién es Sáenz</b> o /persona Caputo." };
  cand = cand || buscarPersonas(idx, consulta);
  let nota = "";
  if (!cand.length) {
    const parecidas = personasParecidas(idx, consulta);       // errores de tipeo: «saens» → Sáenz
    if (parecidas.length === 1) { cand = [{ p: parecidas[0], s: 100 }]; nota = `<i>Entendí «${esc(consulta.trim())}» como «${esc(parecidas[0].n)}».</i>\n\n`; }
    else if (parecidas.length > 1) {
      return { texto: ["¿Quisiste decir alguna de estas personas?", "", ...parecidas.map((p) => `• <b>${esc(p.n)}</b> — ${esc(p.c)}`)].join("\n"),
               botones: { inline_keyboard: parecidas.map((p) => [{ text: "👤 " + p.n, callback_data: "/persona " + p.id }]) } };
    }
  }
  if (!cand.length) {
    const r = await porBusqueda(idx, consulta, {});
    return { texto: `No tengo a «${esc(consulta.trim())}» en la lista de personas de NEWAR; te muestro lo que encontré en las noticias:\n\n` + r.texto, botones: r.botones };
  }
  const top = cand[0];
  const empatadas = cand.filter((c) => c.s === top.s);
  if (empatadas.length > 1 && top.s >= 40 && new Set(empatadas.map((c) => c.p.id)).size > 1) {
    return { texto: ["Hay varias personas con ese nombre. ¿Cuál?", "", ...empatadas.slice(0, 6).map((c) => `• <b>${esc(c.p.n)}</b> — ${esc(c.p.c)}`), "", "Tocá una, o escribí el nombre completo."].join("\n"),
             botones: { inline_keyboard: empatadas.slice(0, 6).map((c) => [{ text: "👤 " + c.p.n, callback_data: "/persona " + c.p.id }]) } };
  }
  const p = top.p;
  const hs = historiasDe(idx, p, 4);
  const vivo = hs.length >= 2 ? [] : await buscarEnVivo(p.n, 3, "when:7d");
  const alias = (p.k || []).slice().sort((a, b) => a.length - b.length).find((k) => k.length >= 5) || (p.k || [])[0] || p.n;
  return { texto: nota + fichaPersona(idx, p, sitio, vivo), botones: { inline_keyboard: [
    [{ text: "🗞️ Más notas", callback_data: ("/buscar " + alias).slice(0, 60) }, { text: "🔗 Ficha completa", url: sitio + "#/persona/" + p.id }],
    [{ text: "⚡ Hoy", callback_data: "/hoy" }, { text: "📍 Salta", callback_data: "/salta" }],
  ] } };
}

async function porBusqueda(idx, consulta, o = {}) {
  const q = consulta.trim();
  if (!palabrasClave(q).length) return { texto: "Decime qué buscar, por ejemplo: <b>dólar</b>, <b>paro docente</b> o /buscar jubilados." };
  const offset = o.offset || 0;
  const filtro = (o.salta || o.dia || o.franja || o.area) ? predicado(idx, o) : null;
  let { hits, total } = buscarHistorias(idx, q, { max: PAGINA, offset, filtro });
  let relajado = "";
  if (!hits.length && filtro && !offset) {                  // sin resultados con el filtro: se prueba sin él y se aclara
    ({ hits, total } = buscarHistorias(idx, q, { max: PAGINA }));
    if (hits.length) relajado = "<i>No hay notas con ese filtro; te muestro todo lo que encontré.</i>\n";
  }
  const L = [];
  if (hits.length) {
    const donde = [o.salta && !relajado ? "en Salta" : "", relajado ? "" : (o.dia === "ayer" ? "ayer" : o.dia === "hoy" ? "hoy" : ""), relajado || !o.franja ? "" : FRANJAS[o.franja][2]].filter(Boolean).join(" · ") || "hoy y ayer";
    L.push(encabezado(idx, `🔎 <b>${esc(q)}</b> — ${total} historia${total === 1 ? "" : "s"} (${donde})`), relajado, ...numerado(hits, false, offset));
  }
  if (hits.length < 3 && !offset) {
    const vivo = await buscarEnVivo(q, 6 - hits.length);
    if (vivo.length) { L.push("", "🔎 <b>En vivo (Google News)</b>"); for (const v of vivo) L.push(...itemVivo(v)); }
    else if (!hits.length) {
      const parecidas = personasParecidas(idx, q);
      L.push(`No encontré nada reciente sobre «${esc(q)}». Probá con otras palabras.` + (parecidas.length ? `\n¿Quisiste decir <b>${esc(parecidas[0].n)}</b>? Escribí /persona ${esc(parecidas[0].n)}.` : ""));
    }
  }
  const falta = total - offset - hits.length;
  const mas = falta > 0 ? botonMas(("/buscar " + q + " +" + (offset + PAGINA)).slice(0, 64), falta) : null;
  return { texto: L.join("\n").trim(), botones: conBotones(mas) };
}

// «cómo salió Boca»: primero lo más reciente de Google News (resultados), después lo que haya en NEWAR
async function porDeporte(idx, tema, o) {
  const q = tema.trim();
  if (!q) return { texto: "¿De qué equipo o partido? Por ejemplo: <b>cómo salió Boca</b> o <b>resultado de River</b>." };
  const vivo = await buscarEnVivo(q + " resultado", 5, "when:2d");
  const { hits } = buscarHistorias(idx, q, { max: 4, filtro: (h) => h.a === "Deportes" });
  const L = [encabezado(idx, `⚽ <b>${esc(q)}</b>`), ""];
  if (vivo.length) { L.push("🔎 <b>Lo último (Google News)</b>"); for (const v of vivo) L.push(...itemVivo(v)); }
  if (hits.length) { L.push("", "📰 <b>En NEWAR</b>"); L.push(...numerado(hits, true)); }
  if (!vivo.length && !hits.length) L.push(`No encontré resultados recientes de «${esc(q)}». Probá con el nombre del equipo o /buscar.`);
  return { texto: L.join("\n"), botones: BTN_PRINCIPAL };
}

// quiénes están más nombrados en los titulares de hoy (conteo de historias); si tiene ficha en el panel, el botón la abre
function personasDelDia(idx) {
  const pp = idx.pp || [];
  if (!pp.length) return { texto: "No encontré nombres repetidos en los titulares de hoy. Probá /buscar con un nombre." };
  const L = [encabezado(idx, "👤 <b>Más nombrados hoy</b>"), ""];
  pp.slice(0, 10).forEach(([nombre, n, id, cargo], i) => L.push(`${NUMEROS[i] || i + 1 + "."} <b>${esc(nombre)}</b> — ${n} historia${n === 1 ? "" : "s"}${cargo ? " · " + esc(cargo) : ""}${id ? " · 📄 con ficha" : ""}`));
  L.push("", "<i>Conteo de las historias del día cuyo titular nombra a la persona. Tocá un nombre: si tiene ficha la abre; si no, muestra lo último que se publicó.</i>");
  // los botones priorizan a quienes tienen ficha (hasta 3), después completan los más nombrados
  const orden = [...pp.filter((x) => x[2]).slice(0, 3), ...pp.filter((x) => !x[2])].slice(0, 6);
  const botones = orden.map(([nombre, , id]) => {
    let cb = id ? "/persona " + id : "/buscar " + nombre;
    while (bytesDe(cb) > 64) cb = cb.slice(0, -1);
    return { text: (id ? "📄 " : "🗞️ ") + nombre.split(" ").slice(-2).join(" "), callback_data: cb };
  });
  const filas = [];
  for (let i = 0; i < botones.length; i += 2) filas.push(botones.slice(i, i + 2));
  filas.push(BTN_PRINCIPAL.inline_keyboard[0]);
  return { texto: L.join("\n"), botones: { inline_keyboard: filas } };
}

// «de qué se habla»: cuántas historias hay por área y qué palabras se repiten más en los titulares del día
function temasDelDia(idx) {
  const hoy = fechaMax(idx);
  const dia = (idx.historias || []).filter((h) => h.d === hoy);
  if (!dia.length) return { texto: "Todavía no hay historias de hoy en el índice." };
  const porArea = {};
  for (const h of dia) porArea[h.a] = (porArea[h.a] || 0) + 1;
  const areas = Object.entries(porArea).filter(([a]) => a !== "Otros temas").sort((a, b) => b[1] - a[1]).slice(0, 7);
  const df = new Map();
  for (const h of dia) {
    const vistos = new Set();
    for (const k of h.f.split(" ")) {                          // h.f ya viene sin tildes ni signos
      if (k.length < 5 || vistos.has(k) || PALABRAS_VACIAS.has(k) || GENERICAS.has(k) || /^\d/.test(k)) continue;
      vistos.add(k);
      df.set(k, (df.get(k) || 0) + 1);
    }
  }
  const palabras = [...df.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 10);
  // para mostrar con tildes se busca la forma original SOLO de las 10 ganadoras, en una pasada y con un plegado de acentos barato
  const orig = new Map(), top = new Set(palabras.map(([k]) => k));
  const SIN = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n" };
  for (const h of dia) {
    for (const w of h.t.split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9$]+/)) {
      if (w.length < 5) continue;
      const l = w.toLowerCase(), k = l.replace(/[áéíóúüñ]/g, (c) => SIN[c]);
      if (top.has(k) && !orig.has(k)) orig.set(k, l);
    }
    if (orig.size === top.size) break;
  }
  const L = [encabezado(idx, `📊 <b>De qué se habla hoy</b> — ${dia.length} historias`), ""];
  L.push("<b>Por área</b>");
  for (const [a, n] of areas) L.push(`${EMOJI[a] || "📌"} ${esc(a)} — ${n}`);
  if (palabras.length) { L.push("", "<b>Palabras que más se repiten en los titulares</b>"); L.push(palabras.map(([k, n]) => `${esc(orig.get(k))} (${n})`).join(" · ")); }
  L.push("", "<i>Tocá un área o escribí una palabra para ver las notas.</i>");
  const filas = [];
  const bs = areas.slice(0, 6).map(([a]) => ({ text: `${EMOJI[a] || "📌"} ${a.split(" ")[0]}`, callback_data: "/ver " + CLAVE_AREA[a] }));
  for (let i = 0; i < bs.length; i += 3) filas.push(bs.slice(i, i + 3));
  return { texto: L.join("\n"), botones: { inline_keyboard: [...filas, ...BTN_PRINCIPAL.inline_keyboard.slice(0, 1)] } };
}

// «quién cubrió el paro de ATE»: qué medios hablaron del tema y cuántas historias
function cobertura(idx, tema) {
  const q = (tema || "").trim();
  if (!palabrasClave(q).length) return { texto: "¿De qué tema? Por ejemplo: <b>quién cubrió el paro de ATE</b>." };
  const { hits, total } = buscarHistorias(idx, q, { max: 80 });
  if (!hits.length) return { texto: `No encontré historias sobre «${esc(q)}» en hoy y ayer.` };
  const cuenta = new Map();
  for (const h of hits) for (const m of h.m || []) cuenta.set(m, (cuenta.get(m) || 0) + 1);
  const medios = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  const L = [encabezado(idx, `📰 <b>Cobertura de «${esc(q)}»</b> — ${total} historia${total === 1 ? "" : "s"}`), ""];
  L.push(...medios.map(([m, n]) => `• ${esc(m)} — ${n}`));
  L.push("", "<i>Cuenta hasta los 6 medios principales de cada historia.</i>", "", "🗞️ <b>Las más cubiertas</b>");
  L.push(...numerado(hits.slice(0, 3), false));
  return { texto: L.join("\n"), botones: conBotones() };
}

function estado(idx, env) {
  const g = idx.generado ? new Date(idx.generado) : null;
  const min = g && !isNaN(g) ? Math.round((Date.now() - g.getTime()) / 60000) : null;
  const hh = g && !isNaN(g) ? g.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "?";
  const L = ["🩺 <b>Estado de NEWAR</b>", "",
    `• Índice de noticias: ${min === null ? "sin fecha" : `generado a las ${hh} (hace ${min < 90 ? min + " min" : Math.round(min / 60) + " h"})`}`,
    `• Historias: ${(idx.historias || []).length} de ${esc((idx.fechas || []).map(fechaCorta).join(" y "))}`,
    `• Medios: ${idx.medios ? idx.medios.size : "?"} · Personas con ficha: ${(idx.personas || []).length}`,
    `• Panel: ${esc(env.SITIO || SITIO_DEFECTO)}`];
  if (min !== null && min > 90) L.push("", "⚠️ El índice tiene más de 1 hora y media. Revisá en GitHub → Actions que el workflow «Monitor de medios» siga corriendo.");
  else L.push("", "✅ Todo al día.");
  return L.join("\n");
}

// ---------- Telegram ----------
async function tg(env, metodo, cuerpo) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
  });
  return r.json().catch(() => ({ ok: false, description: "respuesta ilegible" }));
}

// parte un texto en mensajes sin separar un titular de su línea de medios (la que empieza con 4 espacios)
function partir(texto, tope = MAX_MENSAJE) {
  const largo = (t) => sinTags(t).length;           // Telegram cuenta el texto visible, no las direcciones de los enlaces
  const bloques = [];
  for (const l of texto.split("\n")) {
    if (l.startsWith("    ") && bloques.length) bloques[bloques.length - 1] += "\n" + l; else bloques.push(l);
  }
  const partes = [];
  let act = "";
  for (const b of bloques) {
    if (act && largo(act + "\n" + b) > tope) { partes.push(act); act = b; } else act = act ? act + "\n" + b : b;
  }
  if (act) partes.push(act);
  return partes;
}

async function enviar(env, chat, texto, botones) {
  const partes = partir(texto);
  for (let i = 0; i < partes.length; i++) {
    const extra = i === partes.length - 1 && botones ? { reply_markup: botones } : {};      // los botones van en el último mensaje
    let r = await tg(env, "sendMessage", { chat_id: chat, text: partes[i], parse_mode: "HTML", disable_web_page_preview: true, ...extra });
    if (!r.ok && /parse|entit/i.test(r.description || "")) {      // si Telegram rechaza el formato, se manda en texto plano
      await tg(env, "sendMessage", { chat_id: chat, text: sinTags(partes[i]), disable_web_page_preview: true, ...extra });
    }
  }
}

async function atender(env, update) {
  const cq = update.callback_query;                       // se tocó un botón: se trata como si hubiera escrito el comando
  const msg = cq ? { chat: cq.message && cq.message.chat, text: cq.data } : (update.message || update.edited_message);
  if (!msg || !msg.chat || typeof msg.text !== "string") return;
  const chat = msg.chat.id;
  if (cq) await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  const permitidos = String(env.ALLOWED_CHAT_IDS || env.TELEGRAM_CHAT_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!permitidos.includes(String(chat))) {
    await tg(env, "sendMessage", { chat_id: chat, text: `🔒 Este bot es privado. Tu chat id es ${chat}; si corresponde, pedile a quien lo administra que lo agregue.` });
    return;
  }
  await tg(env, "sendChatAction", { chat_id: chat, action: "typing" });
  let r;
  try {
    r = await responder(env, msg.text);
  } catch (e) {
    r = { texto: "⚠️ No pude leer los datos de NEWAR en este momento. Probá de nuevo en un minuto." };
  }
  if (r.foto) {
    const foto = (env.SITIO || SITIO_DEFECTO) + "assets/nexus-avatar.png";
    await tg(env, "sendPhoto", { chat_id: chat, photo: foto, caption: "<b>NEWAR</b> · prensa de Salta\n<i>NEXUS · el arte de la política, el poder de la conexión</i>", parse_mode: "HTML" });
  }
  await enviar(env, chat, r.texto, r.botones || BTN_PRINCIPAL);
}

// ---------- instalación (una sola vez, desde el navegador) ----------
async function instalar(env, origen) {
  const sitio = env.SITIO || SITIO_DEFECTO;
  const L = [];
  const paso = (n, r) => L.push(`${r && r.ok ? "✓" : "✗"} ${n}${r && r.ok ? "" : " → " + (r && r.description ? r.description : "sin respuesta")}`);
  paso("Conectar el bot con este Worker", await tg(env, "setWebhook", { url: origen + "/webhook", secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }));
  paso("Menú de comandos", await tg(env, "setMyCommands", { commands: [
    { command: "hoy", description: "Lo más importante de hoy" },
    { command: "ultimas", description: "Lo más reciente" },
    { command: "economia", description: "Economía y finanzas" },
    { command: "salta", description: "Lo que pasa en Salta" },
    { command: "politica", description: "Política y gobierno" },
    { command: "seguridad", description: "Policiales y seguridad" },
    { command: "temas", description: "De qué se habla hoy" },
    { command: "personas", description: "Quiénes están en las noticias hoy" },
    { command: "persona", description: "Ficha de un político o funcionario" },
    { command: "buscar", description: "Buscar noticias actuales" },
    { command: "ejemplos", description: "Ideas de qué preguntarme" },
    { command: "estado", description: "¿Está todo al día?" },
    { command: "ayuda", description: "Cómo usarme" },
  ] }));
  paso("Descripción del bot", await tg(env, "setMyDescription", { description: "NEWAR · prensa de Salta. Preguntame qué pasó hoy, por la economía, qué dice un medio, o quién es y qué se dice de una persona." }));
  paso("Descripción corta", await tg(env, "setMyShortDescription", { short_description: "Prensa de Salta: noticias actuales y fichas de personas." }));
  try {
    const img = await fetch(sitio + "assets/nexus-avatar.png");
    if (!img.ok) throw new Error("no se pudo bajar el logo (HTTP " + img.status + ")");
    const fd = new FormData();
    fd.append("photo", JSON.stringify({ type: "static", photo: "attach://foto" }));
    fd.append("foto", await img.blob(), "nexus-avatar.png");
    const r = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setMyProfilePhoto`, { method: "POST", body: fd })).json();
    paso("Foto del bot", r);
    if (!r.ok) L.push("   La foto se pone a mano con @BotFather: /setuserpic → elegí el bot → mandá la imagen assets/nexus-avatar.png (GUIA_BOT_TELEGRAM.md, paso 6).");
  } catch (e) {
    L.push("✗ Foto del bot → " + e.message);
    L.push("   La foto se pone a mano con @BotFather: /setuserpic (GUIA_BOT_TELEGRAM.md, paso 6).");
  }
  L.push("", "Listo. Abrí el bot en Telegram y escribile «qué pasó hoy».");
  return L.join("\n");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/instalar") {
      if (!env.TELEGRAM_BOT_TOKEN || !env.WEBHOOK_SECRET) return new Response("Faltan las variables TELEGRAM_BOT_TOKEN y WEBHOOK_SECRET en el Worker.", { status: 500 });
      if (url.searchParams.get("clave") !== env.WEBHOOK_SECRET) return new Response("Clave incorrecta.", { status: 403 });
      return new Response(await instalar(env, url.origin), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (request.method === "POST" && url.pathname === "/webhook") {
      if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("no autorizado", { status: 401 });
      let update;
      try { update = await request.json(); } catch (_) { return new Response("ok"); }
      ctx.waitUntil(atender(env, update).catch(() => {}));      // Telegram recibe «ok» enseguida; la respuesta se manda después
      return new Response("ok");
    }
    return new Response("NEWAR bot activo.", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  },
};

// (solo para las pruebas locales: node)
export { predicado, entender, buscarHistorias, buscarPersonas, personasParecidas, coincide, buscarMedio, filtrar, responder, partir, atender };
