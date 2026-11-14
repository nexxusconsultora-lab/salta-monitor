/* ===== En vivo v3: sin barras laterales, controles flotantes, diseño moderno ===== */
(function () {

  const CANALES_DEFAULT = [
    { id: 'UCdDq0WZtf5yF0TQPNK-UkIw', nombre: 'Canal 9 Salta' },
    { id: 'UCZbcchpKLSXiIfJaKTkMThg', nombre: 'El Tribuno TV' },
    { id: 'UC9BwDqzIPQdkh3bI_Jg8nig', nombre: 'Aries TV Salta' },
    { id: 'UCFXaLKr2ZYEP4oDqXB1gjNg', nombre: 'Canal 6 Salta' },
  ];

  const CALIDADES = [
    { v: '',       l: 'Auto'  },
    { v: 'hd1080', l: '1080p' },
    { v: 'hd720',  l: '720p'  },
    { v: 'large',  l: '480p'  },
    { v: 'medium', l: '360p'  },
    { v: 'small',  l: '240p'  },
    { v: 'tiny',   l: '144p'  },
  ];

  const ST = {
    canales: [],
    muted:   [true, true, true, true],
    calidad: ['', '', '', ''],
    foco:    -1,
    layout:  4,
  };

  /* ─────────────────────────────────────────────
     CSS v3
     ───────────────────────────────────────────── */
  const CSS = `
#ev-root {
  --ev-gap: .5rem;
  --ev-radius: 14px;
}

/* ── Toolbar ── */
.ev-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem;
  margin-bottom: .9rem;
}
.ev-seg {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  flex: none;
}
.ev-seg button {
  font: 600 .8rem/1 Inter, system-ui, sans-serif;
  padding: .42rem .8rem;
  border: 0;
  border-right: 1px solid var(--line);
  background: var(--raised);
  color: var(--soft);
  cursor: pointer;
  transition: background .12s, color .12s;
}
.ev-seg button:last-child { border-right: 0; }
.ev-seg button.on {
  background: var(--clay);
  color: var(--onclay);
}

/* ── Grilla ── */
.ev-grid {
  display: grid;
  gap: var(--ev-gap);
  margin-bottom: .9rem;
}
.ev-grid.ev-lay-4 { grid-template-columns: repeat(2, 1fr); }
.ev-grid.ev-lay-2 { grid-template-columns: repeat(2, 1fr); }
.ev-grid.ev-lay-1 { grid-template-columns: 1fr; }
@media (max-width: 600px) {
  .ev-grid.ev-lay-4,
  .ev-grid.ev-lay-2 { grid-template-columns: 1fr; }
}
.ev-grid.ev-foco   { grid-template-columns: 1fr !important; }

/* ── Slot ── */
.ev-slot {
  position: relative;
  border-radius: var(--ev-radius);
  overflow: hidden;         /* recorta todo lo que sobresale */
  background: #000;
  /* ratio 16:9 mediante padding-top */
  aspect-ratio: 16 / 9;
  border: 1.5px solid rgba(255,255,255,.08);
  transition: border-color .2s, box-shadow .2s;
  box-shadow: 0 4px 20px -8px rgba(0,0,0,.7);
}
.ev-slot:hover { border-color: color-mix(in srgb, var(--clay) 55%, transparent); }
.ev-slot.ev-on  {
  border-color: var(--clay);
  box-shadow: 0 0 0 1.5px var(--clay), 0 8px 28px -10px var(--glow);
}
.ev-slot.ev-oculto { display: none; }

/* ── iframe: ligeramente sobredimensionado para eliminar barras laterales.
      YouTube rellena con negro cuando el contenedor no es exactamente 16:9;
      escalamos el iframe al 110% y lo centramos; overflow:hidden del slot
      recorta el exceso. ── */
.ev-slot iframe {
  position: absolute;
  /* overscan horizontal: -5% a cada lado → elimina barras negras laterales */
  left: -5%;
  top: 0;
  width: 110%;
  height: 100%;
  border: 0;
  display: block;
  /* z-index bajo: los controles van encima */
  z-index: 1;
}

/* ── Escudo anti-cuadrícula de YouTube ──
      Capa transparente que cubre las zonas donde YouTube
      muestra la cuadrícula de sugerencias (esquinas y bordes).
      pointer-events:auto en zonas peligrosas, none en el centro
      para que el clic en Play siga funcionando. ── */
.ev-shield {
  position: absolute;
  inset: 0;
  z-index: 2;
  /* Gradiente de máscara: opaco en bordes, transparente en centro */
  background: transparent;
  pointer-events: none;
}
/* Cuando el slot NO está en foco, el escudo captura eventos en los bordes */
.ev-slot:not(.ev-on) .ev-shield {
  pointer-events: auto;
  cursor: default;
}
/* En el centro dejamos pasar los clics al iframe */
.ev-slot:not(.ev-on) .ev-shield::after {
  content: "";
  position: absolute;
  /* zona central donde el clic pasa al iframe */
  inset: 15% 20%;
  pointer-events: none;
}

/* ── Barra de controles flotante (glassmorphism) ── */
.ev-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: .35rem;
  padding: .55rem .75rem;
  /* glassmorphism */
  background: linear-gradient(
    to top,
    rgba(0,0,0,.82) 0%,
    rgba(0,0,0,.55) 60%,
    transparent 100%
  );
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  /* se oculta y aparece al hacer hover */
  opacity: 0;
  transform: translateY(4px);
  transition: opacity .2s, transform .2s;
}
.ev-slot:hover .ev-bar,
.ev-slot.ev-on  .ev-bar { opacity: 1; transform: translateY(0); }

/* número de canal */
.ev-num {
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .1em;
  color: var(--clay);
  flex: none;
  min-width: 1rem;
}
/* nombre */
.ev-nom {
  flex: 1;
  font-size: .78rem;
  font-weight: 600;
  color: rgba(255,255,255,.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  text-shadow: 0 1px 4px rgba(0,0,0,.8);
}

/* botones de la barra */
.ev-btn {
  font: 600 .72rem/1 Inter, system-ui, sans-serif;
  padding: .3rem .55rem;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.45);
  color: rgba(255,255,255,.85);
  cursor: pointer;
  border-radius: 7px;
  transition: background .12s, border-color .12s, color .12s;
  white-space: nowrap;
  flex: none;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}
.ev-btn:hover {
  border-color: var(--clay);
  background: rgba(0,0,0,.65);
  color: #fff;
}
.ev-btn.ev-on {
  background: var(--clay);
  border-color: var(--clay);
  color: var(--onclay);
}

/* selector de calidad */
.ev-cal {
  font: 600 .7rem/1 Inter, system-ui, sans-serif;
  padding: .3rem .4rem;
  border: 1px solid rgba(255,255,255,.22);
  background: rgba(0,0,0,.45);
  color: rgba(255,255,255,.8);
  cursor: pointer;
  border-radius: 7px;
  flex: none;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  transition: border-color .12s;
  max-width: 5rem;
}
.ev-cal:hover, .ev-cal:focus {
  border-color: var(--clay);
  outline: none;
  color: #fff;
}
.ev-cal.ev-hq { border-color: var(--clay); color: var(--clay); }

/* ── Indicador LIVE ── */
.ev-live {
  position: absolute;
  top: .6rem;
  left: .7rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: .3rem;
  font: 700 .62rem/1 Inter, system-ui, sans-serif;
  letter-spacing: .1em;
  color: #fff;
  background: rgba(220,38,38,.85);
  border-radius: 4px;
  padding: .2rem .5rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity .3s;
}
.ev-live i {
  width: .45rem;
  height: .45rem;
  border-radius: 50%;
  background: #fff;
  animation: ev-pulse 1.4s ease-in-out infinite;
}
@keyframes ev-pulse { 50% { opacity: .2; } }
.ev-slot:hover .ev-live,
.ev-slot.ev-on  .ev-live { opacity: 1; }

/* ── Panel de configuración ── */
.ev-cfg {
  margin-top: 1rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--raised);
  padding: .8rem 1rem;
}
.ev-cfg summary {
  cursor: pointer;
  font: 700 .88rem Inter, system-ui, sans-serif;
  color: var(--clay);
  list-style: none;
  display: flex;
  align-items: center;
  gap: .4rem;
}
.ev-cfg summary::-webkit-details-marker { display: none; }
.ev-cfg[open] summary { margin-bottom: .7rem; }
.ev-cfg-row {
  display: grid;
  grid-template-columns: 5rem 1fr 10rem;
  gap: .4rem;
  align-items: center;
  margin-bottom: .4rem;
  font-size: .84rem;
}
.ev-cfg-row label { color: var(--soft); font-weight: 600; }
.ev-cfg-row input {
  font: inherit;
  font-size: .84rem;
  padding: .32rem .6rem;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  border-radius: 8px;
  min-width: 0;
}
.ev-cfg-row input:focus {
  outline: none;
  border-color: var(--clay);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--clay) 20%, transparent);
}
@media (max-width: 540px) {
  .ev-cfg-row { grid-template-columns: 1fr; }
}
`;

  /* ── Inyectar CSS una sola vez ── */
  if (!document.getElementById('ev-css3')) {
    const st = document.createElement('style');
    st.id = 'ev-css3';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ── Helpers ── */
  function esc2(s) {
    return String(s == null ? '' : s)
      .replace(/[&<>"']/g, c =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function iframeSrc(id, cal) {
    let url =
      'https://www.youtube-nocookie.com/embed/live_stream' +
      '?channel=' + encodeURIComponent(id) +
      '&autoplay=1&mute=1&controls=1&rel=0&modestbranding=1' +
      '&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    if (cal) url += '&vq=' + encodeURIComponent(cal);
    return url;
  }

  function yt(iframe, cmd, args) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: cmd, args: args || [] }),
        '*'
      );
    } catch (e) {}
  }

  /* Cuando YouTube dice onReady, aplicar estado */
  window.addEventListener('message', function (e) {
    let d;
    try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    if (!d || d.event !== 'onReady') return;
    for (let i = 0; i < 4; i++) {
      const fr = document.getElementById('ev-iframe-' + i);
      if (fr && fr.contentWindow === e.source) {
        yt(fr, ST.muted[i] ? 'mute' : 'unMute');
        if (ST.calidad[i]) yt(fr, 'setPlaybackQuality', [ST.calidad[i]]);
      }
    }
  });

  /* ── Acciones globales ── */

  window.evMute = function (i) {
    ST.muted[i] = !ST.muted[i];
    const fr  = document.getElementById('ev-iframe-' + i);
    const btn = document.getElementById('ev-mbtn-' + i);
    yt(fr, ST.muted[i] ? 'mute' : 'unMute');
    if (btn) {
      btn.textContent = ST.muted[i] ? '🔇' : '🔊';
      btn.classList.toggle('ev-on', !ST.muted[i]);
      btn.title = ST.muted[i] ? 'Activar sonido' : 'Silenciar';
    }
    /* activar uno → silenciar los demás */
    if (!ST.muted[i]) {
      for (let j = 0; j < 4; j++) {
        if (j === i) continue;
        ST.muted[j] = true;
        const fj = document.getElementById('ev-iframe-' + j);
        const bj = document.getElementById('ev-mbtn-' + j);
        yt(fj, 'mute');
        if (bj) { bj.textContent = '🔇'; bj.classList.remove('ev-on'); }
      }
    }
  };

  window.evCalidad = function (i, val) {
    ST.calidad[i] = val;
    const fr  = document.getElementById('ev-iframe-' + i);
    const sel = document.getElementById('ev-csel-' + i);
    if (fr && val) yt(fr, 'setPlaybackQuality', [val]);
    if (sel) sel.classList.toggle('ev-hq', !!val);
  };

  window.evFoco = function (i) {
    const grid = document.getElementById('ev-grid');
    if (!grid) return;
    if (ST.foco === i) {
      ST.foco = -1;
      grid.classList.remove('ev-foco');
      for (let j = 0; j < ST.canales.length; j++) {
        const s = document.getElementById('ev-slot-' + j);
        if (s) { s.classList.remove('ev-oculto', 'ev-on'); }
      }
      const btn = document.getElementById('ev-fbtn-' + i);
      if (btn) btn.textContent = '⤢';
    } else {
      ST.foco = i;
      grid.classList.add('ev-foco');
      for (let j = 0; j < ST.canales.length; j++) {
        const s = document.getElementById('ev-slot-' + j);
        if (!s) continue;
        if (j === i) { s.classList.remove('ev-oculto'); s.classList.add('ev-on'); }
        else s.classList.add('ev-oculto');
      }
      const btn = document.getElementById('ev-fbtn-' + i);
      if (btn) btn.textContent = '⊠';
    }
  };

  window.evLayout = function (n) {
    ST.layout = n;
    ST.foco = -1;
    const grid = document.getElementById('ev-grid');
    if (!grid) return;
    grid.className = 'ev-grid ev-lay-' + n;
    for (let j = 0; j < ST.canales.length; j++) {
      const s = document.getElementById('ev-slot-' + j);
      if (!s) continue;
      s.classList.remove('ev-oculto', 'ev-on');
      s.style.display = j < n ? '' : 'none';
    }
    [1, 2, 4].forEach(function (v) {
      const b = document.getElementById('ev-lay-' + v);
      if (b) b.classList.toggle('on', v === n);
    });
  };

  window.evAplicar = function () {
    ST.canales = ST.canales.map(function (c, i) {
      const idEl = document.getElementById('ev-ci-' + i);
      const nmEl = document.getElementById('ev-cn-' + i);
      return {
        id:     (idEl && idEl.value.trim()) || c.id,
        nombre: (nmEl && nmEl.value.trim()) || c.nombre,
      };
    });
    renderGrid();
    if (typeof aviso !== 'undefined') aviso('Canales actualizados.');
  };

  /* ── Render de un slot ── */
  function renderSlot(i, canal) {
    const cal   = ST.calidad[i];
    const muted = ST.muted[i];
    const calOpts = CALIDADES.map(function (q) {
      return '<option value="' + esc2(q.v) + '"' + (q.v === cal ? ' selected' : '') + '>' + esc2(q.l) + '</option>';
    }).join('');

    return [
      '<div class="ev-slot" id="ev-slot-' + i + '"',
        i >= ST.layout ? ' style="display:none"' : '',
      '>',

        /* iframe sobredimensionado */
        '<iframe',
          ' id="ev-iframe-' + i + '"',
          ' src="' + esc2(iframeSrc(canal.id, cal)) + '"',
          ' allow="autoplay; encrypted-media; fullscreen"',
          ' allowfullscreen',
          ' title="' + esc2(canal.nombre) + '"',
          ' loading="lazy"',
        '></iframe>',

        /* escudo anti-cuadrícula */
        '<div class="ev-shield" aria-hidden="true"></div>',

        /* indicador LIVE */
        '<div class="ev-live" aria-hidden="true">',
          '<i></i>EN VIVO',
        '</div>',

        /* barra flotante */
        '<div class="ev-bar">',
          '<span class="ev-num">' + (i + 1) + '</span>',
          '<span class="ev-nom" title="' + esc2(canal.nombre) + '">' + esc2(canal.nombre) + '</span>',

          '<select class="ev-cal' + (cal ? ' ev-hq' : '') + '"',
            ' id="ev-csel-' + i + '"',
            ' onchange="evCalidad(' + i + ',this.value)"',
            ' title="Calidad de video"',
            ' aria-label="Calidad canal ' + (i + 1) + '"',
          '>' + calOpts + '</select>',

          '<button class="ev-btn' + (muted ? '' : ' ev-on') + '"',
            ' id="ev-mbtn-' + i + '"',
            ' type="button"',
            ' onclick="evMute(' + i + ')"',
            ' title="' + (muted ? 'Activar sonido' : 'Silenciar') + '"',
          '>' + (muted ? '🔇' : '🔊') + '</button>',

          '<button class="ev-btn"',
            ' id="ev-fbtn-' + i + '"',
            ' type="button"',
            ' onclick="evFoco(' + i + ')"',
            ' title="Expandir canal"',
          '>⤢</button>',
        '</div>',

      '</div>',
    ].join('');
  }

  function renderGrid() {
    const grid = document.getElementById('ev-grid');
    if (!grid) return;
    grid.className = 'ev-grid ev-lay-' + ST.layout;
    grid.innerHTML = ST.canales.map(function (c, i) { return renderSlot(i, c); }).join('');
  }

  function renderCfgRows() {
    return ST.canales.map(function (c, i) {
      return [
        '<div class="ev-cfg-row">',
          '<label>Canal ' + (i + 1) + '</label>',
          '<input id="ev-ci-' + i + '" type="text" placeholder="ID de YouTube" value="' + esc2(c.id) + '">',
          '<input id="ev-cn-' + i + '" type="text" placeholder="Nombre" value="' + esc2(c.nombre) + '">',
        '</div>',
      ].join('');
    }).join('');
  }

  /* ── Vista V.envivo ── */
  V.envivo = function () {
    setTimeout(function () {
      (typeof leer !== 'undefined' ? leer('canales_envivo') : Promise.reject())
        .then(function (data) {
          ST.canales = (data && Array.isArray(data) && data.length)
            ? data.slice(0, 4)
            : CANALES_DEFAULT.slice();
        })
        .catch(function () { ST.canales = CANALES_DEFAULT.slice(); })
        .finally(function () {
          renderGrid();
          const cfg = document.getElementById('ev-cfg-rows');
          if (cfg) cfg.innerHTML = renderCfgRows();
        });
    }, 0);

    if (!ST.canales.length) ST.canales = CANALES_DEFAULT.slice();

    const layBtns = [[1,'▣','1 canal'],[2,'▣▣','2 canales'],[4,'▦','4 canales']].map(function (x) {
      return '<button type="button" id="ev-lay-' + x[0] + '" class="' + (ST.layout === x[0] ? 'on' : '') +
        '" onclick="evLayout(' + x[0] + ')" title="' + x[2] + '">' + x[1] + ' ' + x[2] + '</button>';
    }).join('');

    return [
      '<h2 class="sec">📺 En vivo</h2>',
      '<p class="lede">Transmisiones en directo. Los controles aparecen al pasar el mouse sobre cada canal. ',
        'Activar el audio en uno silencia los demás automáticamente.</p>',

      '<div id="ev-root">',
        '<div class="ev-toolbar">',
          '<span class="ev-seg">' + layBtns + '</span>',
        '</div>',

        '<div class="ev-grid ev-lay-' + ST.layout + '" id="ev-grid">',
          ST.canales.map(function (c, i) { return renderSlot(i, c); }).join(''),
        '</div>',

        '<p class="note" style="margin-top:.4rem">',
          'Pasá el mouse sobre un canal para ver los controles. ',
          '⤢ expande ese canal a toda la grilla · ',
          '🔇/🔊 controla el audio · ',
          'El selector de calidad pide al reproductor que cambie la resolución (YouTube puede ignorarlo según la conexión). ',
          'Pantalla negra = el canal no está transmitiendo en este momento.',
        '</p>',

        '<details class="ev-cfg">',
          '<summary>⚙️ Configurar canales</summary>',
          '<p class="note">ID del canal: el código largo después de <code>/channel/</code> en la URL de YouTube. ',
            'Para que quede fijo, editá <code>data/canales_envivo.json</code> en el repositorio.</p>',
          '<div id="ev-cfg-rows">' + renderCfgRows() + '</div>',
          '<div style="margin-top:.5rem">',
            '<button type="button" onclick="evAplicar()" ',
              'style="font:inherit;font-size:.84rem;font-weight:700;padding:.4rem .9rem;',
              'border:1px solid var(--clay);background:var(--clay);color:var(--onclay);',
              'border-radius:9px;cursor:pointer">✓ Aplicar</button>',
          '</div>',
        '</details>',
      '</div>',
    ].join('\n');
  };

})();
