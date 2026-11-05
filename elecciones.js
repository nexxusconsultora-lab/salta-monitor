/* ===== NEWAR · Elecciones (Parte 1) =====
   Pestaña «Elecciones»: SOLO aparece cuando hay una elección en curso (por defecto, desde 60 días antes de la fecha
   hasta 7 días después). Tiene tres bloques: Candidatos (desde que se habilita la elección), Resultados (el día de la
   votación y después) y Fechas y fuentes.
   Datos: data/elecciones.json (calendario, candidatos con fuente, dónde está el conteo) y, para los resultados,
   el archivo que indica 'resultados_url' (lo llena el recolector de la Parte 2). Con #/elecciones/demo se ve una
   elección de EJEMPLO inventada (data/elecciones_demo.json).
   Reglas que respeta: un candidato sin fuente se muestra marcado como «no confirmado»; los resultados no se muestran
   antes de la hora de publicación (por defecto 21:00 de Argentina del día de la elección); el conteo provisorio se
   rotula siempre como provisorio y sin valor legal. No hace proyecciones: eso es la Parte 3.
   Se carga como argentina.js: no toca el resto de index.html. */
(()=>{
if(typeof V==='undefined'||typeof TABS==='undefined')return;
const DIA=864e5,ARG=3*36e5,CADA=60000,ACT=['candidatos','jornada','post'];
const E={cfg:null,err:'',res:{},resErr:{},timer:0};
const hoyAR=()=>new Date(Date.now()-ARG).toISOString().slice(0,10); /* Argentina es UTC-3 todo el año */
const ms=s=>Date.parse(s+'T00:00:00Z');
const suma=(s,n)=>new Date(ms(s)+n*DIA).toISOString().slice(0,10);
const fechaOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(ms(s));
const dia=s=>new Date(ms(s)).toLocaleDateString('es-AR',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
const hora=t=>new Date(t).toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit'});
const num=n=>(+n).toLocaleString('es-AR');
const pc=(n,d)=>d>0?(n/d*100).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:2}):'—';
const plegar=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const urlOk=u=>/^https?:\/\//i.test(u||'');
const enlace=(u,t)=>urlOk(u)?`<a href="${esc(safe(u))}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`:esc(t);

function estado(e,hoy){
 if(e.forzar_estado)return e.forzar_estado;
 if(!fechaOk(e.fecha))return'sin_fecha';
 const desde=fechaOk(e.candidatos_desde)?e.candidatos_desde:suma(e.fecha,-60);
 const hasta=suma(e.fecha,e.dias_post==null?7:+e.dias_post);
 if(hoy<desde)return'proxima';
 if(hoy<e.fecha)return'candidatos';
 if(hoy===e.fecha)return'jornada';
 if(hoy<=hasta)return'post';
 return'terminada'}

const CSS=`
.el-card{background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:.8rem 1rem;margin:.6rem 0}
.el-card h4{margin:0 0 .25rem;font-size:1rem}.el-card .meta{font-size:.82rem;color:var(--soft)}
.el-st{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.12rem .5rem;border-radius:3px;background:var(--neu);color:#fff;margin-right:.4rem}
.el-st.on{background:var(--clay)}
.el-grid{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))}
.el-cand{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:.6rem .8rem}
.el-cand b{display:block}.el-cand .meta{font-size:.8rem;color:var(--soft);margin:.15rem 0}
.el-nosrc{font-size:.78rem;color:var(--negtx);font-weight:600}
.el-bar{height:.8rem;background:var(--line);border-radius:6px;overflow:hidden;margin:.2rem 0 .5rem}.el-bar i{display:block;height:100%;background:var(--indigo)}.el-bar i.l{background:var(--clay)}
.el-row{display:flex;justify-content:space-between;gap:.6rem;font-variant-numeric:tabular-nums}.el-row span:first-child{min-width:0;overflow-wrap:anywhere}
.el-prog{height:1rem;background:var(--line);border-radius:6px;overflow:hidden;margin:.3rem 0}.el-prog i{display:block;height:100%;background:var(--pos)}
.el-demo{background:var(--clay);color:var(--onclay);padding:.5rem .8rem;border-radius:8px;font-weight:700;margin:.5rem 0}
.el-q{width:100%;max-width:24rem;padding:.45rem .6rem;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;margin:.3rem 0 .6rem}
`;
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)}

async function cargar(demo){
 const u=demo?'data/elecciones_demo.json':'data/elecciones.json';
 try{const r=await fetch(u+'?t='+Math.floor(Date.now()/6e4),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();if(!j||!Array.isArray(j.elecciones))throw new Error('el archivo no tiene la lista «elecciones»');return{cfg:j,err:''}}
 catch(x){return{cfg:null,err:String(x&&x.message||x)}}}

async function traerRes(e){
 if(e.resultados_inline){E.res[e.id]=e.resultados_inline;E.resErr[e.id]='';return}
 const u=e.resultados_url;
 if(!u||!/^(https:\/\/|data\/)/.test(u)){E.resErr[e.id]='Esta elección no tiene una «resultados_url» válida en data/elecciones.json.';return}
 try{const r=await fetch(u+(u.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);E.res[e.id]=await r.json();E.resErr[e.id]=''}
 catch(x){E.resErr[e.id]=String(x&&x.message||x)}}

/* ---------- pantallas ---------- */
const ETQ={sin_fecha:['Fecha sin confirmar',0],proxima:['Próxima',0],candidatos:['En campaña · candidatos',1],jornada:['Hoy se vota',1],post:['Resultados',1],terminada:['Finalizada',0]};

function tarjeta(x,link){
 const{e,st}=x,t=ETQ[st]||['',0];
 const f=fechaOk(e.fecha)?dia(e.fecha):(e.fecha_estimada||'Fecha sin definir');
 let extra='';
 if(st==='proxima'){const n=Math.round((ms(e.fecha)-ms(hoyAR()))/DIA),d=fechaOk(e.candidatos_desde)?e.candidatos_desde:suma(e.fecha,-60);extra=` · faltan ${num(n)} días · los candidatos se habilitan el ${dia(d)}`}
 return`<div class="el-card"><h4>${link?`<a href="#/elecciones/${encodeURIComponent(e.id)}">${esc(e.nombre)}</a>`:esc(e.nombre)}</h4>
 <p class="meta"><span class="el-st${t[1]?' on':''}">${esc(t[0])}</span>${esc(e.ambito||'')}${e.distrito?' · '+esc(e.distrito):''} · ${esc(f)}${extra}</p>
 ${e.nota_fecha?`<p class="note">${esc(e.nota_fecha)}</p>`:''}</div>`}

function portada(lista){
 const act=lista.filter(x=>ACT.includes(x.st)),otras=lista.filter(x=>!ACT.includes(x.st));
 return`<p class="lede">Candidatos y resultados oficiales de las elecciones de la Argentina y de Salta. Esta sección se completa sola: los candidatos se habilitan antes de cada elección y los resultados, el día de la votación.</p>`
 +(act.length?`<h3 class="sh">En curso</h3>`+act.map(x=>tarjeta(x,true)).join(''):`<p class="empty">Hoy no hay ninguna elección en curso.</p>`)
 +(otras.length?`<h3 class="sh">Calendario</h3>`+otras.map(x=>tarjeta(x,false)).join(''):'')}

function candItem(c){
 const per=(typeof byId!=='undefined'&&c.politico_id&&byId[c.politico_id])||null;
 const nom=per?`<a href="#/persona/${encodeURIComponent(c.politico_id)}">${esc(c.nombre)}</a>`:esc(c.nombre);
 const meta=[c.partido,c.alianza,c.numero_lista?'Lista '+c.numero_lista:'',c.estado].filter(Boolean).map(esc).join(' · ');
 const fu=urlOk(c.fuente_url)?`<a href="${esc(safe(c.fuente_url))}" target="_blank" rel="noopener noreferrer">Fuente</a>${c.verificado_en?` <span class="note">(verificado el ${esc(c.verificado_en)})</span>`:''}`:`<span class="el-nosrc">Sin fuente: dato no confirmado</span>`;
 return`<div class="el-cand"><b>${nom}</b><p class="meta">${meta}</p>${c.detalle?`<p style="margin:.2rem 0;font-size:.86rem">${esc(c.detalle)}</p>`:''}<p style="margin:.2rem 0">${fu}</p></div>`}

function listaCand(cs,q){
 const k=plegar(q).trim(),f=k?cs.filter(c=>plegar([c.nombre,c.partido,c.alianza,c.cargo,c.distrito].join(' ')).includes(k)):cs;
 if(!f.length)return'<p class="empty">Ningún candidato coincide con la búsqueda.</p>';
 const g=new Map();f.forEach(c=>{const kk=(c.cargo||'Sin cargo indicado')+(c.distrito?' · '+c.distrito:'');if(!g.has(kk))g.set(kk,[]);g.get(kk).push(c)});
 return[...g].map(([t,l])=>`<h4 style="margin:1rem 0 .4rem">${esc(t)} <span class="note">(${l.length})</span></h4><div class="el-grid">${l.map(candItem).join('')}</div>`).join('')}

function candBloque(e){
 const cs=Array.isArray(e.candidatos)?e.candidatos:[];
 if(!cs.length)return`<h3 class="sh">Candidatos</h3><p class="empty">Todavía no hay candidatos cargados para esta elección. Se cargan en <code>data/elecciones.json</code> a medida que la Justicia Electoral oficializa las listas. Un candidato sin fuente se muestra como «no confirmado».</p>`;
 return`<h3 class="sh">Candidatos <span class="meta">(${cs.length})</span></h3><input type="search" id="elq" class="el-q" placeholder="Buscar por nombre, partido o cargo" aria-label="Buscar candidatos"><div id="elcl">${listaCand(cs,'')}</div>`}

function fuentesBloque(e){
 const fs=(e.fuentes||[]).filter(f=>f&&urlOk(f.url)).map(f=>`<li>${enlace(f.url,f.titulo||f.url)}</li>`).join('');
 const fr=e.fuente_resultados&&urlOk(e.fuente_resultados.url)?`<p>Resultados oficiales: ${enlace(e.fuente_resultados.url,e.fuente_resultados.nombre||e.fuente_resultados.url)}. Si hay diferencias con esta pantalla, vale lo que publique el organismo oficial.</p>`:'';
 return`<h3 class="sh">Fechas y fuentes</h3>${tarjeta({e,st:estado(e,hoyAR())},false)}${fr}${fs?`<p class="note">De dónde salen las fechas:</p><ul>${fs}</ul>`:''}`}

function detalle(e,st,demo){
 let h=(demo?`<p class="el-demo" role="note">DATOS DE EJEMPLO, TOTALMENTE INVENTADOS. Esta elección no existe.</p>`:'')+`<p><a href="#/elecciones">← Volver a Elecciones</a></p><h2 class="sec" style="margin-top:.5rem">${esc(e.nombre)}</h2>`;
 if(ACT.includes(st)){h+=candBloque(e)}
 else h+=`<p class="warn" role="status">Esta elección todavía no está habilitada: los candidatos y los resultados se muestran cuando falte poco para la votación.</p>`;
 if(st==='jornada'||st==='post')h+=`<h3 class="sh">Resultados</h3><div id="elres" aria-live="polite"><p class="empty" role="status">Cargando resultados…</p></div>`;
 return h+fuentesBloque(e)}

function embargo(e,st,demo){
 if(demo||st!=='jornada')return 0;
 const t=e.no_publicar_antes?Date.parse(e.no_publicar_antes):(fechaOk(e.fecha)?Date.parse(e.fecha+'T21:00:00-03:00'):0);
 return t&&Date.now()<t?t:0}

function catHTML(c){
 const ls=(c.listas||[]).filter(l=>l&&isFinite(+l.votos)&&+l.votos>=0).map(l=>({n:l.nombre||'(sin nombre)',p:l.partido||'',v:+l.votos})).sort((a,b)=>b.v-a.v);
 const sm=ls.reduce((s,l)=>s+l.v,0),declarada=+c.votos_validos>0,base=declarada?+c.votos_validos:sm;
 const tit=`<h4 style="margin:0 0 .4rem">${esc(c.nombre||'Categoría')}${c.distrito?` <span class="note">· ${esc(c.distrito)}</span>`:''}</h4>`;
 if(!ls.length||!base)return`<div class="el-card">${tit}<p class="empty">Todavía no hay votos cargados en esta categoría.</p></div>`;
 const warn=declarada&&sm>base?`<p class="warn" role="alert">Dato inconsistente: la suma de las listas (${num(sm)}) supera los votos válidos informados (${num(base)}). Los porcentajes no son confiables.</p>`:'';
 const filas=ls.map((l,i)=>{const p=Math.min(100,l.v/base*100);return`<div><div class="el-row"><span><b>${esc(l.n)}</b>${l.p&&l.p!==l.n?` <span class="note">${esc(l.p)}</span>`:''}</span><span><b>${pc(l.v,base)}%</b> · ${num(l.v)}</span></div><div class="el-bar"><i${i===0?' class="l"':''} style="width:${p.toFixed(2)}%"></i></div></div>`}).join('');
 const bn=[c.en_blanco!=null&&isFinite(+c.en_blanco)?'En blanco: '+num(c.en_blanco):'',c.nulos!=null&&isFinite(+c.nulos)?'Nulos: '+num(c.nulos):''].filter(Boolean).join(' · ');
 const mg=ls.length>1?`<p class="note">Diferencia entre el primero y el segundo: <b>${pc(ls[0].v-ls[1].v,base)} puntos</b> (${num(ls[0].v-ls[1].v)} votos).</p>`:'';
 return`<div class="el-card">${tit}${warn}${filas}${mg}<p class="note">Porcentajes sobre ${c.base_nombre?'los '+esc(c.base_nombre):declarada?'los votos válidos informados':'la suma de las listas cargadas'} (${num(base)}).${bn?' '+esc(bn)+'.':''}</p></div>`}

function pintarRes(e,st,demo){
 const el=document.getElementById('elres');if(!el)return;
 const emb=embargo(e,st,demo);
 if(emb){el.innerHTML=`<p class="warn" role="status"><b>Todavía no se muestran resultados.</b> Se publican desde las ${esc(hora(emb))} (hora de Argentina), cuando la Justicia Electoral habilita la difusión. Esta pantalla no muestra nada antes de esa hora.</p>`;return}
 const j=E.res[e.id];
 if(!j){el.innerHTML=E.resErr[e.id]?`<p class="warn" role="alert">No se pudieron leer los resultados: <code>${esc(E.resErr[e.id])}</code>. Todavía puede no haber un archivo cargado.</p>`:'<p class="empty">Todavía no hay resultados cargados.</p>';return}
 if(!j.eleccion_id){el.innerHTML='<p class="empty">Todavía no hay resultados cargados. Aparecen acá apenas los publique la fuente oficial.</p>';return}
 if(j.eleccion_id!==e.id){el.innerHTML='<p class="empty">Todavía no hay resultados cargados de esta elección (el archivo guardado es de otra).</p>';return}
 const t=Date.parse(j.actualizado),m=j.mesas||{},tot=+m.total,esc_=+m.escrutadas,mOk=tot>0&&esc_>=0&&esc_<=tot,def=j.tipo==='definitivo';
 let h=`<p><span class="el-st on">${def?'Escrutinio definitivo':'Escrutinio provisorio'}</span> ${def?'':'<span class="note">Sin valor legal: el escrutinio definitivo lo hace la Justicia Electoral.</span>'}</p>`;
 if(!isNaN(t)&&!demo)h+=`<p class="note">Datos de ${esc(fdate(t))} (${esc(rel(t))}).${j.fuente&&j.fuente.nombre?' Fuente: '+enlace(j.fuente.url,j.fuente.nombre)+'.':''}</p>`;
 if(!demo&&st==='jornada'&&(isNaN(t)||Date.now()-t>15*6e4))h+=`<p class="warn" role="status"><b>Estos datos pueden estar atrasados.</b> ${isNaN(t)?'El archivo no informa cuándo se actualizó.':'No se actualizan desde hace más de 15 minutos.'} El recolector puede estar demorado: mirá el sitio oficial.</p>`;
 if(m.total!=null)h+=mOk?`<div class="el-card"><div class="el-row"><span><b>Mesas escrutadas</b></span><span><b>${pc(esc_,tot)}%</b> · ${num(esc_)} de ${num(tot)}</span></div><div class="el-prog"><i style="width:${Math.min(100,esc_/tot*100).toFixed(1)}%"></i></div>${esc_<tot?`<p class="note">Falta contar el ${pc(tot-esc_,tot)}% de las mesas: el resultado puede cambiar. Esto no es una proyección.</p>`:''}</div>`:`<p class="warn" role="alert">Dato inconsistente en las mesas escrutadas (${esc(m.escrutadas)} de ${esc(m.total)}).</p>`;
 if(j.participacion_pct!=null&&+j.participacion_pct>=0&&+j.participacion_pct<=100)h+=`<p>Participación informada: <b>${(+j.participacion_pct).toLocaleString('es-AR',{maximumFractionDigits:2})}%</b></p>`;
 h+=(j.categorias||[]).map(catHTML).join('')||'<p class="empty">El archivo no trae categorías todavía.</p>';
 el.innerHTML=h}

async function arrancarRes(e,st,demo){
 await traerRes(e);pintarRes(e,st,demo);
 if(demo)return;
 clearInterval(E.timer);
 E.timer=setInterval(async()=>{if(!document.getElementById('elres')){clearInterval(E.timer);return}await traerRes(e);pintarRes(e,st,demo)},CADA)}

async function pintar(id){
 const box=document.getElementById('elapp');if(!box)return;
 clearInterval(E.timer);
 const demo=id==='demo';let c;
 if(demo){const r=await cargar(true);c=r.cfg;if(!c){box.innerHTML=`<p class="warn" role="alert">No se pudo leer <code>data/elecciones_demo.json</code> (${esc(r.err)}). ¿Lo subiste a la carpeta data?</p>`;return}}
 else{if(!E.cfg){const r=await cargar(false);E.cfg=r.cfg;E.err=r.err}c=E.cfg;
  if(!c){box.innerHTML=`<p class="warn" role="alert">No se pudo leer <code>data/elecciones.json</code> (${esc(E.err)}). Revisá que el archivo exista en la carpeta data y que no tenga errores de comas o comillas.</p>`;return}}
 if(!document.getElementById('elapp'))return;
 document.title='NEWAR — Elecciones';
 const hoy=hoyAR(),lista=c.elecciones.filter(e=>e&&e.id).map(e=>({e,st:estado(e,hoy)}));
 const sel=demo?lista[0]:(id?lista.find(x=>x.e.id===id):null);
 if(sel){box.innerHTML=detalle(sel.e,sel.st,demo);
  const q=document.getElementById('elq');if(q)q.oninput=()=>{document.getElementById('elcl').innerHTML=listaCand(sel.e.candidatos,q.value)};
  if(sel.st==='jornada'||sel.st==='post')arrancarRes(sel.e,sel.st,demo)}
 else box.innerHTML=(id?`<p class="warn" role="status">No existe una elección con el código «${esc(id)}».</p>`:'')+portada(lista)}

V.elecciones=id=>{setTimeout(()=>pintar(id||''),0);return'<h2 class="sec">Elecciones</h2><div id="elapp"><p class="empty" role="status" aria-busy="true">Cargando…</p></div>'};
NEEDS.elecciones=['pol'];

/* La pestaña aparece sola solo si hay una elección en curso (o si data/elecciones.json tiene forzar_activa:true) */
function refrescarNav(){
 const t=document.getElementById('tabs');if(!t||!t.children.length||typeof navTabs!=='function')return;
 const k=(location.hash.replace(/^#\/?/,'')||'inicio').split('/')[0];
 t.innerHTML=navTabs(k==='persona'?'personas':k==='tema'?'temas':k==='palabra'?'palabras':k)}
cargar(false).then(r=>{
 E.cfg=r.cfg;E.err=r.err;if(!r.cfg)return;
 const hoy=hoyAR();
 if(!(r.cfg.forzar_activa||r.cfg.elecciones.some(e=>e&&ACT.includes(estado(e,hoy)))))return;
 if(!TABS.some(t=>t[0]==='elecciones'))TABS.splice(Math.min(2,TABS.length),0,['elecciones','Elecciones']);
 try{if(!TGRP[0][1].includes('elecciones'))TGRP[0][1].push('elecciones')}catch(_){}
 refrescarNav()});

window.NEWAR_ELECCIONES={estado,hoyAR};
})();
