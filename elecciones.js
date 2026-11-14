/* ===== Pantalla Elecciones ===== */
/* Lee data/elecciones.json si existe; si no, muestra estructura vacía lista para cargar datos.
   Formato de data/elecciones.json:
   {
     "titulo": "Elecciones Provinciales Salta 2027",
     "fecha": "2027-05-16",
     "estado": "convocadas",
     "categorias": [
       {
         "nombre": "Gobernador",
         "bancas_en_juego": 1,
         "candidatos": [
           {
             "nombre": "Nombre del candidato",
             "partido": "Nombre del partido",
             "votos": 0,
             "porcentaje": 0,
             "color": "#2D72D2"
           }
         ]
       }
     ],
     "fuente": "Tribunal Electoral de Salta",
     "fuente_url": "https://justiciaelectoral.jus.salta.gov.ar",
     "actualizado": "2027-05-16T22:00:00"
   }
*/

(function () {
  const css = `
.el-wrap { margin: 0 0 1.4rem }
.el-estado {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  padding: .3rem .8rem;
  border-radius: 99px;
  font-size: .78rem;
  font-weight: 700;
  letter-spacing: .04em;
  margin-bottom: 1rem;
}
.el-estado.el-en-curso { background: color-mix(in srgb, var(--pos) 18%, var(--raised)); color: var(--pos); border: 1px solid var(--pos); }
.el-estado.el-en-curso::before { content: ""; width: .55rem; height: .55rem; border-radius: 50%; background: var(--pos); animation: elpulse 1.4s ease-in-out infinite; }
.el-estado.el-convocadas { background: color-mix(in srgb, var(--clay) 12%, var(--raised)); color: var(--clay); border: 1px solid var(--clay); }
.el-estado.el-cerrado { background: var(--raised); color: var(--soft); border: 1px solid var(--line); }
@keyframes elpulse { 50% { opacity: .25 } }
.el-cat {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--raised);
  margin-bottom: 1.2rem;
  overflow: hidden;
}
.el-cat-h {
  padding: .8rem 1.1rem .5rem;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: baseline;
  gap: .7rem;
  flex-wrap: wrap;
}
.el-cat-h h3 { margin: 0; font-size: 1rem; font-weight: 700; }
.el-cat-h .el-bancas { font-size: .78rem; color: var(--soft); }
.el-cand {
  display: grid;
  grid-template-columns: minmax(0,1fr) 10rem 5.5rem;
  gap: .5rem;
  align-items: center;
  padding: .6rem 1.1rem;
  border-bottom: 1px solid var(--line);
  font-size: .88rem;
}
.el-cand:last-child { border-bottom: 0; }
.el-cand-nom { font-weight: 600; overflow-wrap: anywhere; }
.el-cand-par { font-size: .78rem; color: var(--soft); }
.el-bar-wrap { height: .65rem; background: var(--line); border-radius: 99px; overflow: hidden; }
.el-bar { height: 100%; border-radius: 99px; min-width: 2px; transition: width .4s ease; }
.el-pct { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; min-width: 3.5rem; }
.el-pct small { display: block; font-size: .7rem; font-weight: 400; color: var(--soft); }
@media (max-width: 600px) {
  .el-cand { grid-template-columns: minmax(0,1fr) 4rem; }
  .el-bar-wrap { display: none; }
}
.el-vacío {
  margin: 2rem 0;
  padding: 1.6rem 1.2rem;
  border: 2px dashed var(--line);
  border-radius: 14px;
  text-align: center;
  color: var(--soft);
}
.el-vacío h3 { margin: 0 0 .4rem; color: var(--ink); }
.el-vacío code { font-size: .82rem; }
.el-fuente { font-size: .78rem; color: var(--soft); margin-top: .6rem; }
`;

  if (!document.getElementById('el-css')) {
    const st = document.createElement('style');
    st.id = 'el-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function fdate2(v) {
    if (!v) return '';
    const d = new Date(v + (v.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d)) return v;
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderCategoria(cat) {
    const cands = (cat.candidatos || []).slice().sort((a, b) => (b.porcentaje || b.votos || 0) - (a.porcentaje || a.votos || 0));
    const maxPct = Math.max(1, ...cands.map(c => c.porcentaje || 0));
    const rows = cands.map(c => {
      const pct = c.porcentaje != null ? c.porcentaje : 0;
      const color = c.color || 'var(--clay)';
      return `
<div class="el-cand">
  <div>
    <div class="el-cand-nom">${esc(c.nombre)}</div>
    <div class="el-cand-par">${esc(c.partido || '')}</div>
  </div>
  <div class="el-bar-wrap">
    <div class="el-bar" style="width:${Math.max(2, pct / maxPct * 100).toFixed(1)}%;background:${esc(color)}"></div>
  </div>
  <div class="el-pct">
    ${pct ? pct.toFixed(2).replace('.', ',') + ' %' : '—'}
    ${c.votos ? `<small>${c.votos.toLocaleString('es-AR')} votos</small>` : ''}
  </div>
</div>`;
    }).join('');
    return `
<div class="el-cat">
  <div class="el-cat-h">
    <h3>${esc(cat.nombre)}</h3>
    ${cat.bancas_en_juego != null ? `<span class="el-bancas">${cat.bancas_en_juego} ${cat.bancas_en_juego === 1 ? 'banca en juego' : 'bancas en juego'}</span>` : ''}
    ${cat.escrutadas != null ? `<span class="el-bancas">${cat.escrutadas.toFixed(1).replace('.', ',')} % de mesas escrutadas</span>` : ''}
  </div>
  ${rows || '<p class="note" style="padding:.6rem 1.1rem">Sin candidatos cargados.</p>'}
</div>`;
  }

  V.elecciones = function () {
    /* Intentar cargar datos */
    leer('elecciones').then(function (data) {
      const el = document.getElementById('el-contenido');
      if (!el) return;
      if (!data || !data.categorias) {
        el.innerHTML = renderVacio();
        return;
      }
      el.innerHTML = renderDatos(data);
    }).catch(function () {
      const el = document.getElementById('el-contenido');
      if (el) el.innerHTML = renderVacio();
    });

    return `
<h2 class="sec">🗳️ Elecciones</h2>
<p class="lede">Resultados, candidatos y estado del escrutinio. Los datos se cargan de <code>data/elecciones.json</code> en el repositorio. Cuando ese archivo existe, esta pantalla muestra los resultados en tiempo real (si lo actualizás durante el escrutinio).</p>
<div id="el-contenido"><p class="empty">Cargando…</p></div>`;
  };

  function estadoClass(estado) {
    if (!estado) return 'el-cerrado';
    const e = estado.toLowerCase();
    if (e.includes('curso') || e.includes('vivo') || e.includes('escrutini')) return 'el-en-curso';
    if (e.includes('convocad') || e.includes('próxim') || e.includes('proxim')) return 'el-convocadas';
    return 'el-cerrado';
  }

  function estadoLabel(estado) {
    if (!estado) return 'Sin estado';
    const e = estado.toLowerCase();
    if (e.includes('curso') || e.includes('vivo') || e.includes('escrutini')) return '🔴 Escrutinio en curso';
    if (e.includes('convocad') || e.includes('próxim') || e.includes('proxim')) return '📅 Elecciones convocadas';
    if (e.includes('cerrad') || e.includes('final')) return '✓ Resultado final';
    return esc(estado);
  }

  function renderDatos(data) {
    const cats = (data.categorias || []).map(renderCategoria).join('');
    const estadoCls = estadoClass(data.estado || '');
    return `
<div class="el-wrap">
  ${data.titulo ? `<h3 style="margin:0 0 .5rem;font-size:1.2rem">${esc(data.titulo)}</h3>` : ''}
  ${data.fecha ? `<p class="note" style="margin:0 0 .6rem">${esc(fdate2(data.fecha))}</p>` : ''}
  <span class="el-estado ${estadoCls}">${estadoLabel(data.estado || '')}</span>
  ${data.mesas_escrutadas != null ? `<p class="note">Mesas escrutadas: <b>${data.mesas_escrutadas.toFixed(2).replace('.', ',')} %</b></p>` : ''}
  ${cats || '<p class="empty">No hay categorías cargadas todavía.</p>'}
  <p class="el-fuente">
    ${data.fuente ? `Fuente: ${data.fuente_url ? `<a href="${esc(data.fuente_url)}" target="_blank" rel="noopener noreferrer">${esc(data.fuente)}</a>` : esc(data.fuente)}.` : ''}
    ${data.actualizado ? ` Última actualización: ${fdate2(data.actualizado)}.` : ''}
  </p>
  <p class="note">Esta pantalla no se actualiza sola: para ver los datos del escrutinio en tiempo real, alguien tiene que actualizar <code>data/elecciones.json</code> durante la noche electoral. Podés hacerlo desde GitHub directamente o con un script.</p>
</div>`;
  }

  function renderVacio() {
    return `
<div class="el-vacío">
  <h3>Todavía no hay datos de elecciones</h3>
  <p>Cuando haya una elección, creá el archivo <code>data/elecciones.json</code> en el repositorio con este formato:</p>
  <pre style="text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:.8rem 1rem;font-size:.78rem;overflow:auto;margin:.8rem 0 0">{
  "titulo": "Elecciones Provinciales Salta 2027",
  "fecha": "2027-05-16",
  "estado": "convocadas",
  "categorias": [
    {
      "nombre": "Gobernador",
      "bancas_en_juego": 1,
      "candidatos": [
        {
          "nombre": "Nombre del candidato",
          "partido": "Partido",
          "votos": 0,
          "porcentaje": 0,
          "color": "#2D72D2"
        }
      ]
    }
  ],
  "fuente": "Tribunal Electoral de Salta",
  "fuente_url": "https://justiciaelectoral.jus.salta.gov.ar"
}</pre>
  <p style="margin:.8rem 0 0;font-size:.82rem">Los posibles valores de <code>"estado"</code>: <code>"convocadas"</code>, <code>"en curso"</code>, <code>"cerrado"</code>.</p>
</div>`;
  }

})();
