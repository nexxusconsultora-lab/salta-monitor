/* ===== NEWAR · Elecciones (Parte 1) =====
   Pestaña «Elecciones», siempre visible, con tres subsecciones que se completan solas según la época:
   Próximas (calendario y cuenta regresiva), Candidatos (se habilitan por defecto 60 días antes de la elección) y
   Resultados (el día de la votación y hasta 7 días después) y Noticias (titulares y boletines oficiales sobre elecciones,
   separados por Salta y Argentina, que se renuevan solos). Cada elección tiene además su página de detalle.
   Datos: data/elecciones.json (calendario, candidatos con fuente, dónde está el conteo) y, para los resultados,
   el archivo que indica 'resultados_url' (lo llena el recolector de la Parte 2). Con #/elecciones/demo se ve una
   elección de EJEMPLO inventada (data/elecciones_demo.json).
   Reglas que respeta: un candidato sin fuente se muestra marcado como «no confirmado»; los resultados no se muestran
   antes de la hora de publicación (por defecto 21:00 de Argentina del día de la elección); el conteo provisorio se
   rotula siempre como provisorio y sin valor legal. No hace proyecciones: eso es la Parte 3.
   Se carga como argentina.js: no toca el resto de index.html. */
(()=>{
if(typeof V==='undefined'||typeof TABS==='undefined')return;
const DIA=864e5,ARG=3*36e5,CADA=30000,ACT=['candidatos','jornada','post'];
const E={cfg:null,err:'',res:{},resErr:{},hist:{},ult:{},timer:0,tick:0,not:null,notErr:'',timerN:0,filtro:'todo'};
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
.el-fr{font-size:.86rem;font-weight:600;margin:.3rem 0}.el-fr.ok{color:var(--pos)}.el-fr.mid{color:var(--clay)}.el-fr.bad{color:var(--negtx)}
.el-sub{display:flex;gap:.4rem;flex-wrap:wrap;margin:.4rem 0 .9rem}.el-sub a{padding:.3rem .85rem;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);font-size:.9rem}.el-sub a.on{background:var(--clay);color:var(--onclay);border-color:var(--clay);font-weight:700}
.el-cuenta{font-size:1.25rem;font-weight:800;margin:.1rem 0}.el-claves{margin:.4rem 0;padding-left:1.1rem;font-size:.88rem}
.el-fil{padding:.3rem .8rem;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--ink);font:inherit;font-size:.88rem;cursor:pointer;margin:0 .35rem .35rem 0}.el-fil.on{background:var(--clay);color:var(--onclay);border-color:var(--clay);font-weight:700}
.el-item{border-bottom:1px solid var(--line);padding:.5rem 0}.el-item a{font-weight:600}.el-item .meta{margin:.15rem 0 0;font-size:.8rem;color:var(--soft)}
.el-prog{height:1rem;background:var(--line);border-radius:6px;overflow:hidden;margin:.3rem 0}.el-prog i{display:block;height:100%;background:var(--pos)}
.el-demo{background:var(--clay);color:var(--onclay);padding:.5rem .8rem;border-radius:8px;font-weight:700;margin:.5rem 0}
.el-q{width:100%;max-width:24rem;padding:.45rem .6rem;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit;margin:.3rem 0 .6rem}
`;
{const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)}

async function cargar(demo){
 const u=demo==='simulacro'?'data/elecciones_simulacro.json':demo?'data/elecciones_demo.json':'data/elecciones.json';
 try{const r=await fetch(u+'?t='+Math.floor(Date.now()/6e4),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();if(!j||!Array.isArray(j.elecciones))throw new Error('el archivo no tiene la lista «elecciones»');return{cfg:j,err:''}}
 catch(x){return{cfg:null,err:String(x&&x.message||x)}}}

async function traerHist(e){
 if(e.historial_inline){E.hist[e.id]=e.historial_inline;return}
 const u=e.resultados_url;
 if(!u||!/^data\/[a-z0-9_-]+\.json$/.test(u))return;
 try{const r=await fetch(u.replace(/\.json$/,'_historial.json')+'?t='+Date.now(),{cache:'no-store'});if(r.ok){const h=await r.json();if(h&&h.eleccion_id===e.id)E.hist[e.id]=h}}catch(_){}}
async function traerRes(e){
 if(e.resultados_inline){E.res[e.id]=e.resultados_inline;E.resErr[e.id]='';await traerHist(e);return}
 const u=e.resultados_url;
 if(!u||!/^(https:\/\/|data\/)/.test(u)){E.resErr[e.id]='Esta elección no tiene una «resultados_url» válida en data/elecciones.json.';return}
 try{const r=await fetch(u+(u.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);E.res[e.id]=await r.json();E.ult[e.id]=Date.now();E.resErr[e.id]=''}
 catch(x){E.resErr[e.id]=String(x&&x.message||x)}
 await traerHist(e)}

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

function cuenta(e,st){
 if(st==='jornada')return'Hoy se vota';
 if(!fechaOk(e.fecha))return'Fecha sin confirmar';
 const n=Math.round((ms(e.fecha)-ms(hoyAR()))/DIA);
 return n>1?'Faltan '+num(n)+' días':n===1?'Es mañana':n===0?'Es hoy':'Fue hace '+num(-n)+' días'}

function claves(e){
 const f=fechaOk(e.fecha),d=f?(fechaOk(e.candidatos_desde)?e.candidatos_desde:suma(e.fecha,-60)):null;
 const rh=e.no_publicar_antes&&!isNaN(Date.parse(e.no_publicar_antes))?hora(Date.parse(e.no_publicar_antes)):'21:00';
 return`<ul class="el-claves"><li><b>Elección:</b> ${esc(f?dia(e.fecha):(e.fecha_estimada||'fecha sin definir'))}</li>${Array.isArray(e.cargos)&&e.cargos.length?'<li><b>Qué se vota:</b> '+e.cargos.map(esc).join('; ')+'</li>':''}<li><b>Candidatos visibles desde:</b> ${d?esc(dia(d)):'cuando se confirme la fecha'}</li><li><b>Resultados en vivo:</b> ${f?'el día de la elección, desde las '+rh+' (hora de Argentina)':'el día de la elección'}</li></ul>`}

function tarjetaPro(x){
 const{e,st}=x,t=ETQ[st]||['',0];
 return`<div class="el-card"><h4><a href="#/elecciones/${encodeURIComponent(e.id)}">${esc(e.nombre)}</a></h4><p class="el-cuenta">${esc(cuenta(e,st))}</p><p class="meta"><span class="el-st${t[1]?' on':''}">${esc(t[0])}</span>${esc(e.ambito||'')}${e.distrito?' · '+esc(e.distrito):''}</p>${claves(e)}${e.nota_fecha?`<p class="note">${esc(e.nota_fecha)}</p>`:''}${e.cargos_nota?`<p class="note">${esc(e.cargos_nota)}</p>`:''}</div>`}

const SUBS=[['proximas','Próximas'],['candidatos','Candidatos'],['resultados','Resultados'],['noticias','Noticias']];
function pastillas(sel,demo,simu){
 return`<nav class="el-sub" aria-label="Secciones de Elecciones">`+SUBS.map(([k,t])=>`<a href="#/elecciones${k==='proximas'?'':'/'+k}"${sel===k?' class="on" aria-current="page"':''}>${t}</a>`).join('')+(demo?`<a href="#/elecciones/demo" class="on" aria-current="page">Ejemplo</a>`:'')+(simu?`<a href="#/elecciones/simulacro" class="on" aria-current="page">Simulacro</a>`:'')+`</nav>`}

const orden=lista=>[...lista].sort((a,b)=>{const ra=ACT.includes(a.st)?0:1,rb=ACT.includes(b.st)?0:1;if(ra!==rb)return ra-rb;const fa=fechaOk(a.e.fecha)?a.e.fecha:'9999',fb=fechaOk(b.e.fecha)?b.e.fecha:'9999';return fa<fb?-1:fa>fb?1:0});
const vigentes=lista=>orden(lista).filter(x=>x.st!=='terminada');

function hitosHTML(hitos){
 const hoy=hoyAR();
 return(Array.isArray(hitos)?hitos:[]).filter(h=>h&&h.titulo&&(!fechaOk(h.desde)||hoy>=h.desde)&&(!fechaOk(h.hasta)||hoy<=h.hasta)).map(h=>{
  const n=fechaOk(h.hasta)?Math.round((ms(h.hasta)-ms(hoy))/DIA):null;
  const fs=(h.fuentes||[]).filter(f=>f&&urlOk(f.url)).map(f=>enlace(f.url,f.titulo||f.url)).join(' · ');
  return`<div class="el-card" role="status" style="border-color:var(--clay)"><h4 style="margin:0">${esc(h.titulo)}</h4>${n!=null?`<p class="el-cuenta">${n>1?'Vigente hasta el '+esc(dia(h.hasta))+' (faltan '+num(n)+' días)':n===1?'Último día mañana: '+esc(dia(h.hasta)):'Último día: hoy'}</p>`:''}<p style="margin:.2rem 0">${esc(h.detalle||'')}</p>${urlOk(h.url)?`<p style="margin:.3rem 0"><a href="${esc(safe(h.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(h.enlace_texto||'Ver más')}</b></a></p>`:''}${fs?`<p class="note">Fuentes: ${fs}</p>`:''}</div>`}).join('')}

function proximasHTML(lista,hitos){
 const v=vigentes(lista),fin=lista.filter(x=>x.st==='terminada'),act=v.filter(x=>ACT.includes(x.st));
 return convBanner()+hitosHTML(hitos)+`<p class="lede">Las próximas elecciones de la Argentina y de Salta: cuánto falta, cuándo se habilitan los candidatos y cuándo se pueden seguir los resultados en vivo. Se completa sola a medida que se acercan las fechas.</p>`
 +(act.length?`<p class="note"><b>Hay una elección en curso:</b> mirá <a href="#/elecciones/${act.some(x=>x.st==='candidatos')?'candidatos':'resultados'}">${act.some(x=>x.st==='candidatos')?'los candidatos':'los resultados'}</a>.</p>`:'')
 +(v.length?v.map(tarjetaPro).join(''):'<p class="empty">No hay elecciones cargadas.</p>')
 +(fin.length?`<h3 class="sh">Finalizadas</h3>`+fin.map(tarjetaPro).join(''):'')}

function candidatosHTML(lista){
 const v=vigentes(lista);
 return`<p class="lede">Candidatos, partidos y detalles de cada elección. Se muestran desde que se acerca la votación y siempre con su fuente: un dato sin fuente aparece marcado como «no confirmado».</p>`
 +v.map((x,k)=>{const{e,st}=x;
  if(ACT.includes(st))return`<h3 class="sh">${esc(e.nombre)}</h3>`+candBloque(e,k);
  const d=fechaOk(e.fecha)?(fechaOk(e.candidatos_desde)?e.candidatos_desde:suma(e.fecha,-60)):null;
  return`<h3 class="sh">${esc(e.nombre)}</h3><div class="el-card"><p style="margin:0"><b>Todavía no se habilitó.</b> ${d?'Los candidatos se muestran desde el '+esc(dia(d))+' ('+(cuenta(e,st).toLowerCase())+' para la elección).':'Se habilita cuando se confirme la fecha de la elección.'}</p><p class="note">Se cargan a medida que la Justicia Electoral oficializa las listas.</p></div>`}).join('')}

function resultadosHTML(lista){
 const v=vigentes(lista),act=v.filter(x=>x.st==='jornada'||x.st==='post');
 let h=`<p class="lede">Resultados oficiales en vivo el día de la elección y en los días siguientes. Los provisorios no tienen valor legal.</p>`;
 if(act.length===1)h+=`<h3 class="sh">${esc(act[0].e.nombre)}</h3><div id="elres" aria-live="polite"><p class="empty" role="status">Cargando resultados…</p></div>`+fuentesRes(act[0].e);
 else if(act.length>1)h+=`<p class="note">Hay varias elecciones con resultados. Elegí una:</p>`+act.map(x=>`<div class="el-card"><h4><a href="#/elecciones/${encodeURIComponent(x.e.id)}">${esc(x.e.nombre)}</a></h4></div>`).join('');
 else h+=`<p class="empty">Hoy no hay ninguna elección con conteo en curso.</p>`+v.map(x=>`<div class="el-card"><h4>${esc(x.e.nombre)}</h4><p style="margin:0">${esc(cuenta(x.e,x.st))}. Los resultados aparecen acá el día de la elección${fechaOk(x.e.fecha)?', desde las '+(x.e.no_publicar_antes&&!isNaN(Date.parse(x.e.no_publicar_antes))?hora(Date.parse(x.e.no_publicar_antes)):'21:00')+' (hora de Argentina)':''}.</p>${fuentesRes(x.e)}</div>`).join('');
 return h}
const fuentesRes=e=>e.fuente_resultados&&urlOk(e.fuente_resultados.url)?`<p class="note">Fuente oficial de los resultados: ${enlace(e.fuente_resultados.url,e.fuente_resultados.nombre||e.fuente_resultados.url)}.</p>`:'';

async function traerNot(){
 try{const r=await fetch('data/elecciones_noticias.json?t='+Math.floor(Date.now()/3e4),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();if(!j||!Array.isArray(j.noticias))throw new Error('formato inesperado');E.not=j;E.notErr=''}
 catch(x){E.notErr=String(x&&x.message||x)}}

const haceL=x=>x>=172800?Math.round(x/86400)+' días':hace(x);

function convBanner(){
 const c=((E.not&&E.not.convocatorias)||[]).slice(0,3);if(!c.length)return'';
 return`<div class="el-card" role="status" style="border-color:var(--clay)"><p style="margin:0"><b>Posible convocatoria a elecciones en un boletín oficial.</b> Confirmala en el documento y cargá la fecha en <code>data/elecciones.json</code>:</p>`
  +c.map(x=>`<p style="margin:.3rem 0">${enlace(x.url,x.titulo)}<br><span class="note">${esc(x.jurisdiccion||'')} · publicado el ${esc(x.fecha)}${fechaOk(x.fecha_detectada)?' · fecha de votación que figura en el texto: <b>'+esc(dia(x.fecha_detectada))+'</b>':''}</span></p>`).join('')+`</div>`}

function pintarNot(){
 const el=document.getElementById('elnot');if(!el)return;
 const d=E.not;
 if(!d){el.innerHTML=E.notErr?`<p class="empty">Todavía no hay noticias electorales cargadas (<code>${esc(E.notErr)}</code>). Se generan solas cada ~10 minutos una vez subidos los archivos.</p>`:'<p class="empty" role="status">Cargando…</p>';return}
 const f=E.filtro,ok=x=>f==='todo'||x.nivel===f,ns=(d.noticias||[]).filter(ok),os=(d.oficiales||[]).filter(ok);
 const cnt=k=>(d.noticias||[]).filter(x=>k==='todo'||x.nivel===k).length+(d.oficiales||[]).filter(x=>k==='todo'||x.nivel===k).length;
 const tag=x=>x.nivel==='salta'?'<span class="el-st on">Salta</span>':'<span class="el-st">Argentina</span>';
 const it=(x,of)=>`<div class="el-item"><a href="${esc(safe(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.titulo)}</a><p class="meta">${tag(x)}${esc(x.fuente||'')}${of&&x.jurisdiccion?' · '+esc(x.jurisdiccion):''} · ${of?(fechaOk(x.fecha)?esc(dia(x.fecha)):esc(x.fecha||'')):esc(haceL(Math.max(0,(Date.now()-Date.parse(x.fecha))/1000)))}${x.convocatoria?' · <b>posible convocatoria</b>':''}</p></div>`;
 const gen=Date.parse(d.generado);
 el.innerHTML=convBanner()
  +`<div role="group" aria-label="Filtrar por nivel">`+[['todo','Todo'],['salta','Salta'],['argentina','Argentina']].map(([k,t])=>`<button type="button" class="el-fil${f===k?' on':''}" data-f="${k}" aria-pressed="${f===k}">${t} (${cnt(k)})</button>`).join('')+`</div>`
  +(os.length?`<h3 class="sh">Publicaciones oficiales</h3>`+os.slice(0,12).map(x=>it(x,1)).join(''):'')
  +`<h3 class="sh">Titulares</h3>`+(ns.length?ns.slice(0,40).map(x=>it(x,0)).join(''):`<p class="empty">No hay titulares electorales${f==='todo'?'':' de este nivel'} en los últimos días.</p>`)
  +`<p class="note">${isNaN(gen)?'':'Lista actualizada hace '+esc(haceL(Math.max(0,(Date.now()-gen)/1000)))+' (se renueva sola cada ~10 minutos). '}${esc(d.criterio||'')}</p>`;
 el.querySelectorAll('.el-fil').forEach(b=>{b.onclick=()=>{E.filtro=b.getAttribute('data-f');pintarNot()}})}

function noticiasHTML(){
 return`<p class="lede">Lo último que publicaron los medios y los boletines oficiales sobre elecciones, separado por Salta y por Argentina. Se arma solo a partir de lo que el proyecto ya recolecta.</p><div id="elnot" aria-live="polite"></div>`}

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

function candBloque(e,k=''){
 const cs=Array.isArray(e.candidatos)?e.candidatos:[];
 if(!cs.length)return`<h3 class="sh">Candidatos</h3><p class="empty">Todavía no hay candidatos cargados para esta elección. Se cargan en <code>data/elecciones.json</code> a medida que la Justicia Electoral oficializa las listas. Un candidato sin fuente se muestra como «no confirmado».</p>`;
 return`<h3 class="sh">Candidatos <span class="meta">(${cs.length})</span></h3><input type="search" id="elq${k}" class="el-q" placeholder="Buscar por nombre, partido o cargo" aria-label="Buscar candidatos"><div id="elcl${k}">${listaCand(cs,'')}</div>`}

function fuentesBloque(e){
 const fs=(e.fuentes||[]).filter(f=>f&&urlOk(f.url)).map(f=>`<li>${enlace(f.url,f.titulo||f.url)}</li>`).join('');
 const fr=e.fuente_resultados&&urlOk(e.fuente_resultados.url)?`<p>Resultados oficiales: ${enlace(e.fuente_resultados.url,e.fuente_resultados.nombre||e.fuente_resultados.url)}. Si hay diferencias con esta pantalla, vale lo que publique el organismo oficial.</p>`:'';
 return`<h3 class="sh">Fechas y fuentes</h3>${tarjeta({e,st:estado(e,hoyAR())},false)}${fr}${fs?`<p class="note">De dónde salen las fechas:</p><ul>${fs}</ul>`:''}`}

function detalle(e,st,demo){
 let h=(demo?`<p class="el-demo" role="note">DATOS DE EJEMPLO, TOTALMENTE INVENTADOS. Esta elección no existe.</p>`:'')+(e.simulacro?`<p class="el-demo" role="note">SIMULACRO: ensayo general con datos inventados que el sistema genera solo. Esta elección no existe.</p>`:'')+`<p><a href="#/elecciones">← Volver a Elecciones</a></p><h2 class="sec" style="margin-top:.5rem">${esc(e.nombre)}</h2>`;
 if(ACT.includes(st)){h+=candBloque(e)}
 else h+=`<p class="warn" role="status">Esta elección todavía no está habilitada: los candidatos y los resultados se muestran cuando falte poco para la votación.</p>`;
 if(st==='jornada'||st==='post')h+=`<h3 class="sh">Resultados</h3><div id="elres" aria-live="polite"><p class="empty" role="status">Cargando resultados…</p></div>`;
 return h+fuentesBloque(e)}

function embargo(e,st,demo){
 if(demo||e.simulacro||st!=='jornada')return 0;
 const t=e.no_publicar_antes?Date.parse(e.no_publicar_antes):(fechaOk(e.fecha)?Date.parse(e.fecha+'T21:00:00-03:00'):0);
 return t&&Date.now()<t?t:0}

function catHTML(c,top){
 const ls=(c.listas||[]).filter(l=>l&&isFinite(+l.votos)&&+l.votos>=0).map(l=>({n:l.nombre||'(sin nombre)',p:l.partido||'',v:+l.votos})).sort((a,b)=>b.v-a.v);
 const sm=ls.reduce((s,l)=>s+l.v,0),declarada=+c.votos_validos>0,base=declarada?+c.votos_validos:sm;
 const tit=`<h4 style="margin:0 0 .4rem">${esc(c.nombre||'Categoría')}${c.distrito?` <span class="note">· ${esc(c.distrito)}</span>`:''}</h4>`;
 if(!ls.length||!base)return`<div class="el-card">${tit}<p class="empty">Todavía no hay votos cargados en esta categoría.</p></div>`;
 const warn=declarada&&sm>base?`<p class="warn" role="alert">Dato inconsistente: la suma de las listas (${num(sm)}) supera los votos válidos informados (${num(base)}). Los porcentajes no son confiables.</p>`:'';
 const filas=ls.map((l,i)=>{const p=Math.min(100,l.v/base*100);return`<div><div class="el-row"><span><b>${esc(l.n)}</b>${l.p&&l.p!==l.n?` <span class="note">${esc(l.p)}</span>`:''}</span><span><b>${pc(l.v,base)}%</b> · ${num(l.v)}</span></div><div class="el-bar"><i${i===0?' class="l"':''} style="width:${p.toFixed(2)}%"></i></div></div>`}).join('');
 const mc=c.mesas&&+c.mesas.total>0&&top&&(+c.mesas.escrutadas!==+top.escrutadas||+c.mesas.total!==+top.total)?`<p class="note">Mesas de esta categoría: ${num(c.mesas.escrutadas)} de ${num(c.mesas.total)} (${pc(c.mesas.escrutadas,c.mesas.total)}%).</p>`:'';
 const bn=[c.en_blanco!=null&&isFinite(+c.en_blanco)?'En blanco: '+num(c.en_blanco):'',c.nulos!=null&&isFinite(+c.nulos)?'Nulos: '+num(c.nulos):''].filter(Boolean).join(' · ');
 const mg=ls.length>1?`<p class="note">Diferencia entre el primero y el segundo: <b>${pc(ls[0].v-ls[1].v,base)} puntos</b> (${num(ls[0].v-ls[1].v)} votos).</p>`:'';
 return`<div class="el-card">${tit}${warn}${mc}${filas}${mg}<p class="note">Porcentajes sobre ${c.base_nombre?'los '+esc(c.base_nombre):declarada?'los votos válidos informados':'la suma de las listas cargadas'} (${num(base)}).${bn?' '+esc(bn)+'.':''}</p></div>`}

const hace=x=>{x=Math.max(0,Math.round(x));return x<60?x+' s':x<600?Math.floor(x/60)+' min '+(x%60)+' s':x<3600?Math.round(x/60)+' min':Math.floor(x/3600)+' h '+Math.round(x%3600/60)+' min'};
const mins=x=>x<1?'menos de 1 min':x<60?Math.round(x)+' min':Math.floor(x/60)+' h '+Math.round(x%60)+' min';
const dos=n=>(+n).toLocaleString('es-AR',{maximumFractionDigits:2});
const top2=c=>(c&&c.listas||[]).filter(l=>l&&isFinite(+l.votos)&&+l.votos>=0).map(l=>({n:String(l.nombre||''),v:+l.votos})).sort((a,b)=>b.v-a.v);

function frescura(e,st,demo){
 const el=document.getElementById('elfr');if(!el)return;
 const j=E.res[e.id],t=j?Date.parse(j.actualizado):NaN;
 if(isNaN(t)||demo){el.textContent='';return}
 const edad=Math.max(0,(Date.now()-t)/1000),cl=st==='jornada'?(edad>900?'bad':edad>300?'mid':'ok'):'ok';
 el.className='el-fr '+cl;
 el.textContent='Dato oficial de las '+hora(t)+' (hace '+hace(edad)+')'+(E.ult[e.id]?' · consultado hace '+hace((Date.now()-E.ult[e.id])/1000):'')}

function ritmo(h){
 const a=(h&&Array.isArray(h.muestras)?h.muestras:[]).filter(x=>x&&isFinite(Date.parse(x.t))&&isFinite(+x.m)&&isFinite(+x.n));
 if(a.length<2)return null;
 const u=a[a.length-1];let i=a.length-2;
 while(i>0&&Date.parse(u.t)-Date.parse(a[i].t)<15*6e4)i--;
 const dt=(Date.parse(u.t)-Date.parse(a[i].t))/6e4,dm=+u.m-+a[i].m;
 return dt>=3&&dm>=0?{xMin:dm/dt,dt:Math.round(dt)}:null}

function evolSVG(h,c){
 if(!h||!Array.isArray(h.muestras)||!c)return'';
 const ls=top2(c);if(ls.length<2)return'';
 const A=ls[0].n,B=ls[1].n,pts=[];
 h.muestras.forEach(s=>{
  const k=(s.c||[]).find(x=>String(x.id)===String(c.id))||(s.c||[])[0];
  if(!k||!(+k.b>0)||!(+s.n>0))return;
  const a=(k.v||[]).find(x=>x[0]===A.slice(0,40)),b=(k.v||[]).find(x=>x[0]===B.slice(0,40));
  if(a&&b)pts.push([+s.m/+s.n,(+a[1]-+b[1])/+k.b*100])});
 if(pts.length<3)return'';
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys,0),y1=Math.max(...ys,0.0001);
 const W=300,H=70,px=x=>x1>x0?4+(x-x0)/(x1-x0)*(W-8):W/2,py=y=>H-6-(y-y0)/((y1-y0)||1)*(H-12);
 const d=pts.map(p=>px(p[0]).toFixed(1)+','+py(p[1]).toFixed(1)).join(' '),ult=ys[ys.length-1];
 const txt='Diferencia entre '+A+' y '+B+' a medida que se cuentan las mesas: hoy '+dos(ult)+' puntos, entre '+dos(Math.min(...ys))+' y '+dos(Math.max(...ys));
 return`<div class="el-card"><p class="note" style="margin:0 0 .3rem"><b>Cómo evoluciona la diferencia</b> entre ${esc(A)} y ${esc(B)} mientras se cuentan las mesas (de ${pc(x0,1)}% a ${pc(x1,1)}%): hoy ${dos(ult)} puntos; mínimo ${dos(Math.min(...ys))}, máximo ${dos(Math.max(...ys))}.</p><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(txt)}" style="max-height:5rem"><line x1="0" x2="${W}" y1="${py(0).toFixed(1)}" y2="${py(0).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 3"/><polyline points="${d}" fill="none" stroke="var(--clay)" stroke-width="2"/></svg></div>`}

function pintarRes(e,st,demo){
 const el=document.getElementById('elres');if(!el)return;
 const emb=embargo(e,st,demo);
 if(emb){el.innerHTML=`<p class="warn" role="status"><b>Todavía no se muestran resultados.</b> Se publican desde las ${esc(hora(emb))} (hora de Argentina), cuando la Justicia Electoral habilita la difusión. Esta pantalla no muestra nada antes de esa hora.</p>`;return}
 const j=E.res[e.id];
 if(!j){el.innerHTML=E.resErr[e.id]?`<p class="warn" role="alert">No se pudieron leer los resultados: <code>${esc(E.resErr[e.id])}</code>. Todavía puede no haber un archivo cargado.</p>`:'<p class="empty">Todavía no hay resultados cargados.</p>';return}
 if(!j.eleccion_id){el.innerHTML='<p class="empty">Todavía no hay resultados cargados. Aparecen acá apenas los publique la fuente oficial.</p>';return}
 if(j.eleccion_id!==e.id){el.innerHTML='<p class="empty">Todavía no hay resultados cargados de esta elección (el archivo guardado es de otra).</p>';return}
 const t=Date.parse(j.actualizado),m=j.mesas||{},tot=+m.total,esc_=+m.escrutadas,mOk=tot>0&&esc_>=0&&esc_<=tot,def=j.tipo==='definitivo',hs=E.hist[e.id],cats=j.categorias||[];
 let h=`<p><span class="el-st on">${def?'Escrutinio definitivo':'Escrutinio provisorio'}</span> ${def?'':'<span class="note">Sin valor legal: el escrutinio definitivo lo hace la Justicia Electoral.</span>'}</p>`;
 if(!demo)h+=`<p class="el-fr" id="elfr" role="status"></p>${j.fuente&&j.fuente.nombre?`<p class="note">Fuente: ${enlace(j.fuente.url,j.fuente.nombre)}.</p>`:''}`;
 if(!demo&&st==='jornada'&&(isNaN(t)||Date.now()-t>15*6e4))h+=`<p class="warn" role="status"><b>Estos datos pueden estar atrasados.</b> ${isNaN(t)?'El archivo no informa cuándo se actualizó.':'No se actualizan desde hace más de 15 minutos.'} Puede ser que la fuente no haya publicado nada nuevo o que el recolector esté demorado: mirá el sitio oficial.</p>`;
 (Array.isArray(j.avisos)?j.avisos:[]).slice(0,6).forEach(a=>{h+=`<p class="warn" role="status"><b>Control de coherencia:</b> ${esc(a)}</p>`});
 if(m.total!=null)h+=mOk?`<div class="el-card"><div class="el-row"><span><b>Mesas escrutadas</b></span><span><b>${pc(esc_,tot)}%</b> · ${num(esc_)} de ${num(tot)}</span></div><div class="el-prog"><i style="width:${Math.min(100,esc_/tot*100).toFixed(1)}%"></i></div>${esc_<tot?`<p class="note">Falta contar el ${pc(tot-esc_,tot)}% de las mesas: el resultado puede cambiar. Esto no es una proyección.</p>`:''}`+(()=>{const r=mOk&&esc_<tot?ritmo(hs):null;if(!r||!(r.xMin>0))return'';const eta=(tot-esc_)/r.xMin;return eta<1440?`<p class="note">Ritmo de los últimos ${r.dt} min: ${r.xMin.toLocaleString('es-AR',{maximumFractionDigits:1})} mesas por minuto. Si se mantiene, el conteo completo llegaría en unos ${mins(eta)}. Es orientativo: el ritmo suele bajar al final.</p>`:''})()+`</div>`:`<p class="warn" role="alert">Dato inconsistente en las mesas escrutadas (${esc(m.escrutadas)} de ${esc(m.total)}).</p>`;
 if(j.participacion_pct!=null&&+j.participacion_pct>=0&&+j.participacion_pct<=100)h+=`<p>Participación informada: <b>${dos(j.participacion_pct)}%</b></p>`;
 const c0=cats.find(c=>top2(c).length>1),l0=top2(c0);
 if(c0&&mOk&&esc_>0&&esc_<tot&&+j.votantes>0){const marg=l0[0].v-l0[1].v,pend=Math.round((tot-esc_)*(+j.votantes/esc_));h+=`<div class="el-card"><p style="margin:0"><b>Votos que faltan contar:</b> unos ${num(pend)} (estimación con el promedio de votantes por mesa).</p><p class="note">La diferencia actual entre el primero y el segundo (${num(marg)} votos) equivale al ${pc(marg,pend)}% de esa cantidad. Las mesas que faltan pueden ser distintas de las ya contadas (otras zonas), así que esto no es una proyección.</p></div>`}
 h+=evolSVG(hs,c0);
 h+=cats.map(c=>catHTML(c,m)).join('')||'<p class="empty">El archivo no trae categorías todavía.</p>';
 el.innerHTML=h;frescura(e,st,demo)}

async function arrancarRes(e,st,demo){
 await traerRes(e);pintarRes(e,st,demo);
 if(demo)return;
 clearInterval(E.timer);clearInterval(E.tick);
 E.tick=setInterval(()=>{if(!document.getElementById('elres')){clearInterval(E.tick);return}frescura(e,st,demo)},1000);
 E.timer=setInterval(async()=>{if(!document.getElementById('elres')){clearInterval(E.timer);clearInterval(E.tick);return}await traerRes(e);pintarRes(e,st,demo)},CADA)}

async function pintar(id){
 const box=document.getElementById('elapp');if(!box)return;
 clearInterval(E.timer);clearInterval(E.tick);clearInterval(E.timerN);
 const demo=id==='demo',simu=id==='simulacro';let c;
 if(demo||simu){const r=await cargar(simu?'simulacro':true);c=r.cfg;if(!c){box.innerHTML=`<p class="warn" role="alert">No se pudo leer <code>data/elecciones_${simu?'simulacro':'demo'}.json</code> (${esc(r.err)}). ¿Lo subiste a la carpeta data?</p>`;return}}
 else{if(!E.cfg){const r=await cargar(false);E.cfg=r.cfg;E.err=r.err}c=E.cfg;
  if(!c){box.innerHTML=`<p class="warn" role="alert">No se pudo leer <code>data/elecciones.json</code> (${esc(E.err)}). Revisá que el archivo exista en la carpeta data y que no tenga errores de comas o comillas.</p>`;return}}
 if(!document.getElementById('elapp'))return;
 document.title='NEWAR — Elecciones';
 const hoy=hoyAR(),lista=c.elecciones.filter(e=>e&&e.id).map(e=>({e,st:estado(e,hoy)}));
 const sub=['','proximas','candidatos','resultados','noticias'].includes(id)?(id||'proximas'):null;
 const sel=(demo||simu)?lista[0]:(sub?null:lista.find(x=>x.e.id===id));
 const cablear=(l)=>l.forEach((x,k)=>{const q=document.getElementById('elq'+k);if(q)q.oninput=()=>{document.getElementById('elcl'+k).innerHTML=listaCand(x.e.candidatos,q.value)}});
 if(sel){box.innerHTML=pastillas('',demo,simu)+detalle(sel.e,sel.st,demo);
  const q=document.getElementById('elq');if(q)q.oninput=()=>{document.getElementById('elcl').innerHTML=listaCand(sel.e.candidatos,q.value)};
  if(sel.st==='jornada'||sel.st==='post')arrancarRes(sel.e,sel.st,demo)}
 else if(sub){
  const v=vigentes(lista);
  if(sub==='proximas')await traerNot();
  box.innerHTML=pastillas(sub)+(sub==='proximas'?proximasHTML(lista,c.hitos):sub==='candidatos'?candidatosHTML(lista):sub==='noticias'?noticiasHTML():resultadosHTML(lista));
  if(sub==='noticias'){await traerNot();pintarNot();clearInterval(E.timerN);E.timerN=setInterval(async()=>{if(!document.getElementById('elnot')){clearInterval(E.timerN);return}await traerNot();pintarNot()},60000)}
  if(sub==='candidatos')cablear(v);
  if(sub==='resultados'){const a=v.filter(x=>x.st==='jornada'||x.st==='post');if(a.length===1)arrancarRes(a[0].e,a[0].st,false)}}
 else box.innerHTML=pastillas('proximas')+`<p class="warn" role="status">No existe una elección con el código «${esc(id)}».</p>`+proximasHTML(lista,c.hitos)}

V.elecciones=id=>{setTimeout(()=>pintar(id||''),0);return'<h2 class="sec">Elecciones</h2><div id="elapp"><p class="empty" role="status" aria-busy="true">Cargando…</p></div>'};
NEEDS.elecciones=['pol'];

/* La pestaña «Elecciones» está siempre visible */
function refrescarNav(){
 const t=document.getElementById('tabs');if(!t||!t.children.length||typeof navTabs!=='function')return;
 const k=(location.hash.replace(/^#\/?/,'')||'inicio').split('/')[0];
 t.innerHTML=navTabs(k==='persona'?'personas':k==='tema'?'temas':k==='palabra'?'palabras':k)}
if(!TABS.some(t=>t[0]==='elecciones'))TABS.splice(Math.min(2,TABS.length),0,['elecciones','Elecciones']);
try{if(!TGRP[0][1].includes('elecciones'))TGRP[0][1].push('elecciones')}catch(_){}
setTimeout(refrescarNav,0);
cargar(false).then(r=>{E.cfg=r.cfg;E.err=r.err});

window.NEWAR_ELECCIONES={estado,hoyAR};
})();
