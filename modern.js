/* modern.js — Mejoras visuales a listas de noticias y menciones.
   Mantiene el esquema de colores v19 (naranja/azul noche).
   No toca index.html. Se carga desde la etiqueta <script src="modern.js"> que ya existe. */
(function () {
  const css = `

/* ============================================================
   CHIPS DE MEDIO: más prominentes, con pill coloreado
   ============================================================ */
.med {
  font-size: .73rem !important;
  padding: .2rem .68rem !important;
  font-weight: 700 !important;
  letter-spacing: .02em;
  border-radius: 99px !important;
  color: #fff !important;
  background: var(--mc, var(--neu)) !important;
  border: none !important;
  vertical-align: middle;
  display: inline-block;
}

/* ============================================================
   ARTÍCULOS Y MENCIONES: jerarquía visual más clara
   ============================================================ */
.art {
  padding: .75rem 0;
  gap: .9rem;
}
.art .t {
  font-size: 1rem !important;
  line-height: 1.4 !important;
  font-weight: 650 !important;
  margin: .3rem 0 .2rem !important;
}
.art .meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .35rem;
  font-size: .78rem !important;
  color: var(--soft);
}
/* Artículo con acento de medio: borde izquierdo más grueso */
.art.mc {
  border-left-width: 4px !important;
  padding-left: .75rem !important;
}
/* Hover con fondo sutil */
.art:hover { background: var(--hov); border-radius: 8px; }

/* ============================================================
   ETIQUETAS DE TONO: más redondas y con colores más vivos
   ============================================================ */
.tag {
  border-radius: 99px !important;
  padding: .2rem .68rem !important;
  font-size: .68rem !important;
  font-weight: 800 !important;
  letter-spacing: .05em !important;
  text-transform: uppercase !important;
}
.tag.positivo { background: var(--pos) !important; color: #fff !important; }
.tag.negativo { background: var(--neg) !important; color: #fff !important; }
.tag.neutral  { background: var(--soft) !important; color: #fff !important; }
.tag.vigente, .tag.vigente { background: var(--pos) !important; color: #fff !important; }
.tag.no-vigente { background: var(--neu) !important; color: #fff !important; }

/* ============================================================
   SEPARADORES DE DÍA: acento naranja
   ============================================================ */
.day {
  font-size: .75rem !important;
  font-weight: 800 !important;
  letter-spacing: .1em !important;
  text-transform: uppercase !important;
  color: var(--clay) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--clay) 30%, var(--line)) !important;
  padding-bottom: .3rem !important;
  margin: 1.6rem 0 .6rem !important;
}

/* ============================================================
   FILAS DE LISTA (row2): hover con deslizamiento
   ============================================================ */
a.row2:hover {
  padding-left: 1rem !important;
  background: var(--hov) !important;
}
.row2 { transition: padding .12s, background .12s; }

/* ============================================================
   CARDS DE CIFRAS: acento naranja arriba + número con gradiente
   ============================================================ */
.grid .card {
  border-top: 2px solid color-mix(in srgb, var(--clay) 35%, var(--line)) !important;
  transition: border-top-color .15s, transform .18s, box-shadow .18s !important;
}
.grid .card:hover { border-top-color: var(--clay) !important; }
.grid .card .n {
  background: linear-gradient(135deg, var(--ink), var(--clay)) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  color: transparent !important;
}

/* ============================================================
   BARRA DE MENCIONES (barras): bordes redondeados
   ============================================================ */
.bars i { border-radius: 3px 3px 0 0 !important; }

/* ============================================================
   PERSONA: ficha con mejor jerarquía de nombre
   ============================================================ */
.person h2 {
  letter-spacing: -.01em;
}
.cargo {
  border-left-color: var(--clay) !important;
}

/* ============================================================
   BOTONES DE CONTROL (.ctl): más uniformes
   ============================================================ */
.ctl button.on {
  background: var(--clay) !important;
  border-color: var(--clay) !important;
  color: var(--onclay) !important;
  box-shadow: 0 4px 14px -6px var(--glow) !important;
}

/* ============================================================
   CHIPS DE TEMAS/PALABRAS: acento naranja al hover
   ============================================================ */
.chips button:hover, .esn button:hover, .pill:hover {
  border-color: var(--clay) !important;
  color: var(--clay) !important;
}
.chips button.on {
  background: var(--clay) !important;
  border-color: var(--clay) !important;
  color: var(--onclay) !important;
}

/* ============================================================
   CITAS (quote): borde naranja + fondo suave
   ============================================================ */
.quote {
  border-left-color: var(--clay) !important;
  background: color-mix(in srgb, var(--clay) 7%, var(--raised)) !important;
  border-radius: 0 10px 10px 0 !important;
  padding: .55rem 1rem !important;
}

/* ============================================================
   ADVERTENCIAS: borde naranja
   ============================================================ */
.warn {
  border-left-color: var(--clay) !important;
  background: color-mix(in srgb, var(--clay) 8%, var(--raised)) !important;
}

/* ============================================================
   SELECTOR DE FECHA EN NOTAS/DIARIO: más legible
   ============================================================ */
.ctl select:focus, .ctl input:focus {
  border-color: var(--clay) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--clay) 25%, transparent) !important;
}

/* ============================================================
   BARRA SUPERIOR: línea de acento naranja más visible
   ============================================================ */
nav.top::after {
  background: linear-gradient(90deg, transparent 0%, var(--clay) 30%, var(--gold) 70%, transparent 100%) !important;
  opacity: .8;
}

/* ============================================================
   MENÚ LATERAL: ítem activo con fondo naranja suave
   ============================================================ */
nav .tabs a.on {
  background: linear-gradient(90deg, color-mix(in srgb, var(--clay) 18%, transparent), transparent) !important;
  box-shadow: inset 3px 0 0 var(--clay) !important;
  color: var(--clay) !important;
}
nav .tabs a:hover::before {
  transform: scale(1.1) rotate(-3deg) !important;
}

/* ============================================================
   TABLA DE CALIDAD/CONTROL: filas pares con fondo sutil
   ============================================================ */
.hmw table tbody tr:nth-child(even) { background: color-mix(in srgb, var(--clay) 4%, transparent); }

/* ============================================================
   BARRA DE SEGUIMIENTO (HUD): texto naranja más brillante
   ============================================================ */
#hudbar .hl i { background: var(--clay) !important; box-shadow: 0 0 10px var(--clay) !important; }
#hudbar { border-top-color: color-mix(in srgb, var(--clay) 55%, var(--line)) !important; }

`;

  if (!document.getElementById('modern-css')) {
    const st = document.createElement('style');
    st.id = 'modern-css';
    st.textContent = css;
    document.head.appendChild(st);
  }
})();
