/* ===== Pantalla Briefing: resumen ejecutivo del día ===== */
/* Lee data/resumenes/<fecha>.json (el mismo que usa el Diario).
   Si hay datos, arma un briefing visual de una pantalla:
   - Titular del día (historia más cubierta)
   - Cifras clave (notas, medios, historias)
   - Personas mencionadas (top 6)
   - Temas del día con barras
   - Las 8 historias más cubiertas con sus medios
   - Acceso rápido al Diario completo */

(function () {

  /* Estilos propios del Briefing */
  const css = `
/* === Briefing: layout general === */
.bf-wrap { max-width: 820px }
.bf-hero {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  margin-bottom: 1.4rem;
  padding: 2rem 2rem 1.6rem;
  background:
    radial-gradient(600px 300px at 110% -10%, rgba(249,137,1,.22), transparent 65%),
    linear-gradient(135deg, #000 0%, #161616 60%, #0B0B0B 100%);
  border: 1px solid rgba(249,137,1,.3);
  color: #fff;
}
.bf-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(249,137,1,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(249,137,1,.05) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
.bf-fecha {
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: rgba(249,137,1,.9);
  margin-bottom: .5rem;
}
.bf-titular {
  font: 800 clamp(1.3rem, 4vw, 2.1rem)/1.2 Inter, system-ui, sans-serif;
  color: #fff;
  margin: 0 0 .5rem;
  max-width: 36rem;
}
.bf-medios-top {
  display: flex;
  flex-wrap: wrap;
  gap: .3rem;
  margin-top: .7rem;
}
.bf-medios-top span {
  font-size: .72rem;
  padding: .18rem .55rem;
  border-radius: 99px;
  background: rgba(255,255,255,.12);
  color: rgba(255,255,255,.85);
  border: 1px solid rgba(255,255,255,.18);
}
.bf-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: .6rem;
  margin-bottom: 1.4rem;
}
.bf-kpi {
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: .9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: .2rem;
  position: relative;
  overflow: hidden;
}
.bf-kpi::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--clay);
  border-radius: 3px 0 0 3px;
}
.bf-kpi-n {
  font: 800 1.9rem/1 Inter, system-ui, sans-serif;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.bf-kpi-l {
  font-size: .75rem;
  color: var(--soft);
  font-weight: 600;
  letter-spacing: .02em;
}
.bf-delta {
  font-size: .72rem;
  font-weight: 700;
  margin-top: .15rem;
}
.bf-delta.up { color: var(--pos); }
.bf-delta.dn { color: var(--negtx); }

/* === Sección de personas === */
.bf-pers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: .5rem;
  margin-bottom: 1.4rem;
}
.bf-per {
  display: flex;
  align-items: center;
  gap: .6rem;
  background: var(--raised);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: .6rem .8rem;
  text-decoration: none;
  color: var(--ink);
  transition: border-color .15s, background .15s;
}
.bf-per:hover { border-color: var(--clay); background: var(--hov); }
.bf-per-av {
  flex: none;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 700 1rem/1 Inter, system-ui, sans-serif;
  color: var(--onclay);
  background: var(--clay);
  text-transform: uppercase;
}
.bf-per-inf { min-width: 0 }
.bf-per-nm {
  font-size: .82rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bf-per-cargo {
  font-size: .68rem;
  color: var(--soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bf-per-n {
  font: 700 .82rem/1 Inter, system-ui, sans-serif;
  color: var(--clay);
  margin-left: auto;
  flex: none;
}

/* === Temas === */
.bf-temas { margin-bottom: 1.4rem }
.bf-tema-row {
  display: grid;
  grid-template-columns: 11rem 1fr 2.5rem;
  gap: .5rem;
  align-items: center;
  padding: .4rem .2rem;
  font-size: .85rem;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  border-radius: 6px;
  transition: background .12s;
}
.bf-tema-row:hover { background: var(--hov) }
.bf-tema-row:last-child { border-bottom: 0 }
.bf-tema-bar { height: .55rem; background: var(--line); border-radius: 99px; overflow: hidden }
.bf-tema-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--clay) 60%, transparent), var(--clay));
}
.bf-tema-n { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--clay) }

/* === Historias del día === */
.bf-hist {
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 1.4rem;
  background: var(--raised);
}
.bf-hist-h {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  gap: .5rem;
  align-items: flex-start;
  padding: .9rem 1.1rem;
  border-bottom: 1px solid var(--line);
}
.bf-hist-h:last-child { border-bottom: 0 }
.bf-hist-num {
  font-size: .68rem;
  font-weight: 800;
  color: var(--clay);
  letter-spacing: .06em;
  margin-bottom: .2rem;
}
.bf-hist-t {
  font: 600 .95rem/1.35 Inter, system-ui, sans-serif;
  color: var(--ink);
  margin: 0 0 .4rem;
}
.bf-hist-t a {
  color: inherit;
  text-decoration: none;
}
.bf-hist-t a:hover { text-decoration: underline }
.bf-hist-meds {
  display: flex;
  flex-wrap: wrap;
  gap: .25rem;
  margin-top: .3rem;
}
.bf-hist-mn {
  font-size: .68rem;
  font-weight: 600;
  padding: .15rem .55rem;
  border-radius: 99px;
  color: #fff;
  letter-spacing: .02em;
  white-space: nowrap;
}
.bf-hist-cnt {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: .2rem;
  min-width: 3.5rem;
}
.bf-hist-nbig {
  font: 800 1.5rem/1 Inter, system-ui, sans-serif;
  color: var(--clay);
  font-variant-numeric: tabular-nums;
}
.bf-hist-nlbl { font-size: .62rem; color: var(--soft); font-weight: 600; white-space: nowrap }

/* === Acceso rápido === */
.bf-acceso {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: 1rem;
}
.bf-acceso a {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--clay);
  background: color-mix(in srgb, var(--clay) 10%, var(--raised));
  color: var(--clay);
  font: 600 .85rem Inter, system-ui, sans-serif;
  text-decoration: none;
  transition: background .15s, transform .12s;
}
.bf-acceso a:hover {
  background: color-mix(in srgb, var(--clay) 20%, var(--raised));
  transform: translateY(-1px);
}
.bf-vacio {
  margin: 2rem 0;
  padding: 1.6rem 1.2rem;
  border: 2px dashed var(--line);
  border-radius: 14px;
  text-align: center;
  color: var(--soft);
}
.bf-vacio h3 { margin: 0 0 .5rem; color: var(--ink) }

/* === Mejoras generales a artículos y menciones (aplican en todo el sitio) === */

/* Chip de medio: más visible con gradiente suave */
.med {
  font-size: .73rem !important;
  padding: .2rem .65rem !important;
  font-weight: 700 !important;
  letter-spacing: .02em;
  border-radius: 99px !important;
  color: #fff !important;
  background: var(--mc, var(--neu)) !important;
  border: none !important;
}

/* Artículos: separación más clara entre título y meta */
.art .t {
  font-size: 1rem !important;
  line-height: 1.4 !important;
  margin: .3rem 0 .2rem !important;
}
.art .meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .35rem;
  font-size: .78rem !important;
}

/* Etiqueta de tono: más redonda y legible */
.tag {
  border-radius: 99px !important;
  padding: .2rem .65rem !important;
  font-size: .68rem !important;
  font-weight: 700 !important;
  letter-spacing: .04em !important;
}
.tag.positivo { background: var(--pos) !important; color: #fff !important }
.tag.negativo { background: var(--neg) !important; color: #fff !important }
.tag.neutral  { background: var(--soft) !important; color: #fff !important }

/* Separadores de día en el Resumen/Notas */
.day {
  font-size: .78rem !important;
  font-weight: 800 !important;
  letter-spacing: .08em !important;
  text-transform: uppercase !important;
  color: var(--clay) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--clay) 35%, var(--line)) !important;
  padding-bottom: .3rem !important;
  margin: 1.5rem 0 .5rem !important;
}

/* Artículo con color de medio: borde más grueso */
.art.mc { border-left-width: 4px !important; padding-left: .75rem !important; }

/* Hover en filas de lista: deslizamiento más suave */
a.row2:hover { padding-left: 1rem !important; }

/* Barras de menciones en el Inicio: más redondeadas */
.bars i { border-radius: 3px 3px 0 0 !important; }

/* Cards de estadísticas: acento naranja arriba */
.grid .card {
  border-top: 2px solid color-mix(in srgb, var(--clay) 40%, var(--line)) !important;
  transition: border-top-color .15s, transform .15s !important;
}
.grid .card:hover { border-top-color: var(--clay) !important; }

/* Número grande de las cards */
.grid .card .n {
  background: linear-gradient(135deg, var(--ink), var(--clay)) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  color: transparent !important;
}
`;

  if (!document.getElementById('bf-css')) {
    const st = document.createElement('style');
    st.id = 'bf-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* Helpers */
  function esc2(s) {
    return String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fecha(f, o) {
    const d = new Date(f + (f && f.length === 10 ? 'T12:00:00' : ''));
    return isNaN(d) ? f : d.toLocaleDateString('es-AR', o || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function iniciales(nombre) {
    return (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  /* Renderiza el briefing cuando hay datos */
  function renderBriefing(d, personas) {
    const T = d.totales || {};
    const tieneSeg = !!d.seguridad;
    const tieneTodo = !!d.todos;
    const fuente = tieneTodo ? d.todos : d;
    const historias = (fuente.historias || []).slice().sort(
      (a, b) => (b.medios || []).length - (a.medios || []).length
    );
    const temas = tieneTodo ? (d.todos.temas || []) : (d.temas || []);
    const topHist = historias[0];

    /* KPIs */
    const kpis = [
      { n: T.historias || 0, l: 'historias del día' },
      { n: T.medios || 0, l: 'medios activos' },
      { n: T.politicas || T.notas || 0, l: 'notas políticas' },
      tieneSeg ? { n: d.seguridad.totales.historias || 0, l: 'historias de seguridad' } : null,
      tieneTodo ? { n: d.todos.totales.historias || 0, l: 'historias en total' } : null,
    ].filter(Boolean).slice(0, 4);

    const kpisHtml = kpis.map(k => `
<div class="bf-kpi">
  <span class="bf-kpi-n">${esc2(k.n)}</span>
  <span class="bf-kpi-l">${esc2(k.l)}</span>
</div>`).join('');

    /* Personas del día */
    let persHtml = '';
    const persIds = tieneTodo ? (d.todos.personas || []) : (d.personas || []);
    if (persIds.length && typeof byId !== 'undefined') {
      const rows = persIds.slice(0, 6).map(x => {
        const p = byId[x.id || x];
        if (!p) return '';
        const cargo = p.cargos && p.cargos[0] ? p.cargos[0].titulo : '';
        const n = x.historias || x.notas || '';
        return `
<a class="bf-per" href="#/estrategia/${encodeURIComponent(p.id)}">
  <span class="bf-per-av">${esc2(iniciales(p.nombre))}</span>
  <span class="bf-per-inf">
    <div class="bf-per-nm">${esc2(p.nombre)}</div>
    <div class="bf-per-cargo">${esc2(cargo)}</div>
  </span>
  ${n ? `<span class="bf-per-n">${n}</span>` : ''}
</a>`;
      }).filter(Boolean).join('');
      if (rows) persHtml = `<h2 class="sec">Quiénes aparecen hoy</h2><div class="bf-pers">${rows}</div>`;
    }

    /* Temas */
    const mx = Math.max(1, ...(temas.map(t => t.historias || 0)));
    const temasHtml = temas.length ? `
<h2 class="sec">Temas del día</h2>
<div class="bf-temas">
  ${temas.slice(0, 10).map(t => `
  <div class="bf-tema-row" onclick="irArea(${JSON.stringify(t.tema || '')})">
    <span>${esc2(t.tema)}</span>
    <div class="bf-tema-bar"><i style="width:${Math.max(4, (t.historias || 0) / mx * 100).toFixed(1)}%"></i></div>
    <span class="bf-tema-n">${t.historias}</span>
  </div>`).join('')}
</div>` : '';

    /* Historias top */
    const histHtml = historias.length ? `
<h2 class="sec">Las historias más cubiertas</h2>
<div class="bf-hist">
  ${historias.slice(0, 8).map((h, i) => {
    const ms = (h.medios || []);
    const link = (h.links && h.links[0]) ? h.links[0].link : '';
    let medColor = 'var(--clay)';
    try { if (typeof medioColor !== 'undefined') medColor = medioColor(ms[0] || ''); } catch (e) {}
    return `
<div class="bf-hist-h">
  <div>
    <div class="bf-hist-num">N.º ${i + 1}</div>
    <p class="bf-hist-t">
      ${link ? `<a href="${esc2(link)}" target="_blank" rel="noopener noreferrer">${esc2(h.titulo)}</a>` : esc2(h.titulo)}
    </p>
    <div class="bf-hist-meds">
      ${ms.slice(0, 5).map(m => {
        let col = 'var(--clay)';
        try { if (typeof medioColor !== 'undefined') col = medioColor(m); } catch (e) {}
        let nom = m;
        try { if (typeof medioNombre !== 'undefined') nom = medioNombre(m); } catch (e) {}
        return `<span class="bf-hist-mn" style="background:${esc2(col)}">${esc2(nom)}</span>`;
      }).join('')}
      ${ms.length > 5 ? `<span class="bf-hist-mn" style="background:var(--soft)">+${ms.length - 5}</span>` : ''}
    </div>
  </div>
  <div class="bf-hist-cnt">
    <span class="bf-hist-nbig">${ms.length}</span>
    <span class="bf-hist-nlbl">${ms.length === 1 ? 'medio' : 'medios'}</span>
  </div>
</div>`;
  }).join('')}
</div>` : '';

    /* Hero: titular del día */
    const heroHtml = topHist ? `
<div class="bf-hero">
  <div class="bf-fecha">📰 Briefing · ${esc2(fecha(d.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
  <h2 class="bf-titular">${esc2(topHist.titulo)}</h2>
  <div class="meta" style="color:rgba(255,255,255,.65);font-size:.82rem">
    Historia más cubierta del día · ${(topHist.medios || []).length} medios
  </div>
  <div class="bf-medios-top">
    ${(topHist.medios || []).slice(0, 6).map(m => {
      let nom = m;
      try { if (typeof medioNombre !== 'undefined') nom = medioNombre(m); } catch (e) {}
      return `<span>${esc2(nom)}</span>`;
    }).join('')}
  </div>
</div>` : `
<div class="bf-hero">
  <div class="bf-fecha">📰 Briefing · ${esc2(fecha(d.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
  <h2 class="bf-titular">Sin historias destacadas para mostrar</h2>
</div>`;

    return `
<div class="bf-wrap">
  ${heroHtml}
  <div class="bf-kpis">${kpisHtml}</div>
  ${persHtml}
  ${temasHtml}
  ${histHtml}
  <div class="bf-acceso">
    <a href="#/diario">📅 Diario completo</a>
    <a href="#/menciones">💬 Menciones</a>
    <a href="#/estrategia">🎯 Estrategia</a>
    ${tieneSeg ? '<a href="#/diario">🔒 Seguridad</a>' : ''}
  </div>
  <p class="note" style="margin-top:1rem">
    Briefing del ${esc2(fecha(d.fecha))}. Generado el ${esc2(d.generado ? fecha(d.generado, { dateStyle: 'medium', timeStyle: 'short' }) : 'sin fecha')}.
    Cubre solo los medios que recolecta el monitor. ${esc2(d.metodo || '')}
  </p>
</div>`;
  }

  /* Vista principal */
  V.briefing = function () {
    /* Cargar índice y el resumen más reciente */
    setTimeout(async function () {
      const el = document.getElementById('bf-contenido');
      if (!el) return;
      try {
        const idx = await leer('resumenes/index');
        const dias = ((idx && idx.dias) || []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha));
        if (!dias.length) {
          el.innerHTML = renderVacio();
          return;
        }
        /* El más reciente que no sea de cobertura baja */
        const hoy = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
        const diaEl = dias.find(x => !x.cobertura_baja && x.fecha <= hoy) || dias[0];
        const d = await leer('resumenes/' + diaEl.fecha);
        if (!d) { el.innerHTML = renderVacio(); return; }
        el.innerHTML = renderBriefing(d);
      } catch (e) {
        el.innerHTML = renderVacio();
      }
    }, 0);

    return `
<h2 class="sec">📰 Briefing</h2>
<p class="lede">Resumen ejecutivo del día: la historia más cubierta, los temas que dominan la agenda, quiénes aparecen y cuántos medios los mencionan. Todo en una pantalla.</p>
<div id="bf-contenido"><p class="empty">Cargando…</p></div>`;
  };

  function renderVacio() {
    return `
<div class="bf-vacio">
  <h3>Todavía no hay resúmenes generados</h3>
  <p>El Briefing se arma a partir de los resúmenes diarios que genera el monitor automáticamente. Cuando haya datos en <code>data/resumenes/</code>, esta pantalla los va a mostrar.</p>
  <p style="margin-top:.8rem"><a href="#/diario">Ir al Diario →</a></p>
</div>`;
  }

})();
