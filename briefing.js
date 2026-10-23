/* ===== NEWAR · Briefing de noticias =====
   Pestaña «Briefing»: lo más importante de la ventana elegida (24 h, 48 h o 7 días), un top de las notas más
   cubiertas, las más abiertas en este dispositivo, las personas más nombradas y los temas dominantes.
   Todo sale de data/news_general.json (S.news) y de las menciones que NEWAR ya calcula. No inventa nada.

   Sobre «más vistas»: NEWAR no tiene acceso a las lecturas de los medios. Por eso hay dos rankings honestos:
     · «Más cubiertas»: cuántos medios distintos publicaron la misma historia (agrupadas por parecido de título).
     · «Más abiertas por vos»: las notas que abriste desde NEWAR en este navegador (se guarda sólo acá).
   La «importancia» es una puntuación explicada en pantalla (cobertura, presencia de personas de la nómina,
   tema político/económico/judicial, alcance Nación + Salta y frescura). No es un juicio editorial.

   Se carga DESPUÉS de poderes.js y graficos.js. Usa las variables de color de NEWAR (sirve en todos los temas). */
(()=>{
if(typeof V==='undefined'||typeof TABS==='undefined')return;
const H=36e5,DAY=864e5,LS='newar_briefing_abiertas';
const esc2=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fo=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const url=u=>/^https?:\/\//i.test(u||'')?u:'#';
const nf=n=>Number(n).toLocaleString('es-AR');
const cut=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+'…':s};
const medio=n=>(typeof medioNombre==='function'?medioNombre(n.source):String(n.source||'').split(' - ')[0].trim())||'sin medio';
const sinMedio=n=>(typeof tituloSinMedio==='function'?tituloSinMedio(n):String(n.title||''));
const fh=ts=>ts?new Date(ts).toLocaleString('es-AR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}):'sin fecha';
const hace=(ts,ref)=>{const m=Math.max(0,Math.round((ref-ts)/6e4));return m<60?'hace '+m+' min':m<1440?'hace '+Math.round(m/60)+' h':'hace '+Math.round(m/1440)+' d'};

/* ---------- Registro local de notas abiertas ---------- */
const lsGet=()=>{try{return JSON.parse(localStorage.getItem(LS)||'{}')}catch(e){return{}}};
const lsSet=o=>{try{localStorage.setItem(LS,JSON.stringify(o))}catch(e){}};
let LK=null;
const linkMap=()=>{const n=(S.news||[]).length;if(LK&&LK.n===n)return LK.m;const m=new Map();(S.news||[]).forEach(x=>{if(x&&x.link)m.set(x.link,x)});LK={n,m};return m};
const reg=e=>{if(e.type==='auxclick'&&e.button!==1)return;const a=e.target&&e.target.closest&&e.target.closest('a[href^="http"]');if(!a)return;
 const x=linkMap().get(a.href)||linkMap().get(a.getAttribute('href'));if(!x)return;
 const o=lsGet(),k=x.id||a.href;const r=o[k]||{n:0};r.n++;r.t=Date.now();r.h=a.href;r.s=cut(sinMedio(x),140);r.m=medio(x);o[k]=r;
 const ks=Object.keys(o);if(ks.length>300){ks.sort((p,q)=>o[p].t-o[q].t).slice(0,ks.length-300).forEach(z=>delete o[z])}lsSet(o)};
document.addEventListener('click',reg,true);document.addEventListener('auxclick',reg,true);

/* ---------- Clasificación por tema (palabras, sin IA) ---------- */
const TEMAS=[
 ['Política y gobierno',/\b(gobiern\w*|gobernador\w*|president\w*|ministr\w*|gabinete|decreto|dnu|senad\w*|diputad\w*|congreso|legislatur\w*|concej\w*|intendent\w*|elecci\w*|candidat\w*|oficialismo|oposicion|casa rosada|milei|saenz|kicillof|bullrich|macri|kirchner\w*|libertarios?|peronis\w*|pj|lealtad|alianza|reforma|veto|ley|leyes|boleta|diplomatic\w*|embajad\w*)\b/],
 ['Internacional',/\b(trump|eeuu|ee uu|estados unidos|brasil|chile|bolivia|venezuela|ucrania|ucrania|rusia|china|israel|gaza|iran|espana|europa|francia|italia|alemania|mexico|peru|colombia|paraguay|uruguay|japon|reino unido|papa|vaticano|onu|otan|zelenski|putin|sanciones)\b/],
 ['Justicia',/\b(juez\w*|jueza\w*|fiscal\w*|corte suprema|justicia|juicio|imputad\w+|procesad\w+|sentencia|fallo|camarista\w*|tribunal\w*|causa|condena\w*|cuadernos|lijo|mpf)\b/],
 ['Economía',/\b(inflacion|dolar\w*|cepo|economi\w*|presupuesto|deuda|salari\w*|paritaria\w*|jubilacion\w*|tarifa\w*|impuest\w*|aranceles?|banco central|bcra|riesgo pais|bonos?|fmi|exportacion\w*|importacion\w*|precios?|mercados?|pbi|desempleo|empleo|pobreza|rigi|inversion\w*|ventas|costo de vida|arba)\b/],
 ['Seguridad',/\b(policia\w*|crimen\w*|homicidio\w*|robo\w*|narco\w*|asesinat\w*|detenid\w*|detuvieron|operativo|seguridad|balacera|ataque|muerto\w*|tragedia|avalancha|incendio)\b/],
 ['Salud y educación',/\b(salud|hospital\w*|vacun\w*|dengue|universidad\w*|docentes?|escuela\w*|educacion|alumnos?|cirujano|cancer|operacion)\b/]
];
const NOPOL=/\b(futbol|gol|goles|boca|river|racing|independiente|san lorenzo|belgrano|talleres|libertadores|copa|liga|torneo|tenis|nba|pilot[oa]|formula 1|f1|gp|colapinto|automovilismo|deport\w*|selecciones?|seleccion|amistosos?|rugby|basquet|dibu|chelsea|palmeiras|femenina|quini|show|farandula|famos[oa]s?|actriz|actor|serie|pelicula|cine|festival|cantante|recital|reality|pampita|conductor\w*|horoscopo|receta\w*|clima|pronostico|feria del libro)\b/;
const temaDe=t=>{const f=fo(t);if(NOPOL.test(f))return'Deportes y espectáculos';for(const[n,rx]of TEMAS)if(rx.test(f))return n;return'Otros'};

/* ---------- Figuras públicas conocidas (para el título que sólo trae el apellido) ---------- */
const FIG=[['Javier Milei',/\bmilei\b/,/karina milei/g],['Karina Milei',/\bkarina milei\b/],['Luis Caputo',/\bcaputo\b/,/santiago caputo/g],['Santiago Caputo',/\bsantiago caputo\b/],
 ['Patricia Bullrich',/\bbullrich\b/],['Victoria Villarruel',/\bvillarruel\b/],['Axel Kicillof',/\bkicillof\b/],['Mauricio Macri',/\bmacri\b/,/jorge macri/g],['Jorge Macri',/\bjorge macri\b/],
 ['Cristina Kirchner',/\bcristina\b.{0,25}\bkirchner\b|\bcfk\b/],['Máximo Kirchner',/\bmaximo kirchner\b/],['Sergio Massa',/\bmassa\b/],['Martín Menem',/\bmenem\b/],['Diego Santilli',/\bsantilli\b/],
 ['Manuel Adorni',/\badorni\b/],['Federico Sturzenegger',/\bsturzenegger\b/],['Sandra Pettovello',/\bpettovello\b/],['Gustavo Sáenz',/\bsaenz\b/],['Martín Llaryora',/\bllaryora\b/],['Maximiliano Pullaro',/\bpullaro\b/],
 ['Raúl Jalil',/\bjalil\b/],['Carlos Sadir',/\bsadir\b/],['Rogelio Frigerio',/\bfrigerio\b/],['Donald Trump',/\btrump\b/],['Ricardo Lorenzetti',/\blorenzetti\b/]];
const figs=t=>{const f=' '+fo(t).replace(/[^a-z0-9 ]+/g,' ')+' ';const o=[];FIG.forEach(([n,rx,ex])=>{const g=ex?f.replace(ex,' '):f;if(rx.test(g))o.push(n)});return o};
const perId=l=>{try{const k=fo(l);const p=(personas||[]).find(x=>fo(x.nombre)===k);return p?p.id:''}catch(e){return''}};

/* ---------- Agrupar notas que cuentan lo mismo ---------- */
const STOP=new Set('para como pero este esta estos estas esos esas sobre entre desde hasta tras ante donde cuando quien cual sino tambien ahora hoy ayer nuevo nueva primer primera segundo anos ano dias dia mas muy casi todo toda todos todas luego aunque porque segun contra cada otro otra otros otras tiene tienen hacer hizo hace fue fueron sera seran puede pueden quedo dijo dice dicen'.split(' '));
const toks=t=>{const w=fo(t).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(x=>x.length>=4&&!STOP.has(x));return new Set(w)};
const jac=(a,b)=>{let i=0;a.forEach(x=>{if(b.has(x))i++});return i?i/(a.size+b.size-i):0};
function agrupa(items,TH){TH=TH||.3;
 const cl=[],ix=new Map(),ord=items.slice().sort((a,b)=>a.ts-b.ts);
 ord.forEach(it=>{
  const T=toks(it.t);let best=null,bj=0;
  if(T.size>=3){const cand=new Map();T.forEach(w=>(ix.get(w)||[]).forEach(c=>cand.set(c,(cand.get(c)||0)+1)));
   cand.forEach((sh,c)=>{if(sh<3&&!(sh>=2&&T.size<=4))return;if(it.ts-c.last>72*H)return;const j=jac(T,c.T);if(j>=TH&&j>bj){bj=j;best=c}})}
  if(best){best.items.push(it);best.last=Math.max(best.last,it.ts);best.med.add(it.mn);if(it.cat==='Nacional')best.nac++;else best.sal++}
  else{const c={T,items:[it],last:it.ts,first:it.ts,med:new Set([it.mn]),nac:it.cat==='Nacional'?1:0,sal:it.cat==='Nacional'?0:1};cl.push(c);T.forEach(w=>{if(!ix.has(w))ix.set(w,[]);ix.get(w).push(c)})}
 });
 cl.forEach(c=>{
  // título representativo: el más parecido a los demás (o el más reciente si el grupo es grande)
  let rep=c.items[0];if(c.items.length>1&&c.items.length<=14){let bs=-1;c.items.forEach(a=>{const ta=toks(a.t);let s=0;c.items.forEach(b=>{if(a!==b)s+=jac(ta,toks(b.t))});if(s>bs){bs=s;rep=a}})}
  c.rep=rep;c.tema=temaDe(c.rep.t);c.n=c.items.length;c.m=c.med.size;
 });
 return cl;
}

/* ---------- Datos de la ventana ---------- */
const ST={h:48,amb:'',tema:'',deportes:0};
let CACHE=null;
function base(){
 const raw=S.news||[],ahora=Date.now();let tmax=0;
 raw.forEach(n=>{const ts=Date.parse(n.published_iso||n.collected_at)||0;if(ts>tmax&&ts<=ahora+H)tmax=ts});
 return{tmax:tmax||ahora,raw};
}
function calcula(){
 const{tmax,raw}=base(),key=[raw.length,ST.h,ST.amb,tmax].join('|');if(CACHE&&CACHE.key===key)return CACHE;
 const ini=tmax-ST.h*H,seen=new Set(),items=[];
 raw.forEach(n=>{if(!n||!n.id||seen.has(n.id))return;seen.add(n.id);if(/ - temas - /i.test(n.title||''))return;
  const ts=Date.parse(n.published_iso||n.collected_at)||0;if(ts<ini||ts>tmax)return;
  if(ST.amb==='sal'&&n.category!=='Provincial')return;if(ST.amb==='nac'&&n.category!=='Nacional')return;
  items.push({n,t:sinMedio(n),ts,mn:medio(n),cat:n.category,link:n.link})});
 // personas de la nómina nombradas (reusa las menciones que ya calcula NEWAR)
 const pm=new Map();try{if(typeof newsMen==='function')newsMen().forEach(m=>{if(!m.link)return;if(!pm.has(m.link))pm.set(m.link,new Set());pm.get(m.link).add(m._pid)})}catch(e){}
 const cl=agrupa(items);
 const abiertas=lsGet();
 cl.forEach(c=>{
  const cnt=new Map(),lab=new Map();c.items.forEach(x=>{const un=new Map();(pm.get(x.link)||[]).forEach(p=>{const q=(typeof byId!=='undefined')&&byId[p];if(q)un.set(fo(q.nombre),q.nombre)});figs(x.t).forEach(l=>un.set(fo(l),l));un.forEach((l,k)=>{cnt.set(k,(cnt.get(k)||0)+1);lab.set(k,l)})});
  const enRep=new Set();(pm.get(c.rep.link)||[]).forEach(p=>{const q=(typeof byId!=='undefined')&&byId[p];if(q)enRep.add(fo(q.nombre))});figs(c.rep.t).forEach(l=>enRep.add(fo(l)));
  c.pers=[...cnt.entries()].filter(([k,v])=>enRep.has(k)||v>=2||c.items.length===1).sort((a,b)=>b[1]-a[1]).map(([k])=>lab.get(k));
  c.cruce=c.nac>0&&c.sal>0;
  const pol=['Política y gobierno','Economía','Justicia','Seguridad','Internacional','Salud y educación'].includes(c.tema);
  const frescura=Math.max(0,1-(tmax-c.last)/(ST.h*H));
  c.puntos={cobertura:Math.min(10,c.m*2),personas:Math.min(4,c.pers.length*1.5),tema:pol?3:(c.tema==='Deportes y espectáculos'?-6:0),alcance:c.cruce?2:0,fresca:+(frescura*2).toFixed(1)};
  c.score=Object.values(c.puntos).reduce((a,b)=>a+b,0);
  c.abierta=c.items.reduce((a,x)=>a+((abiertas[x.n.id]||{}).n||0),0);
 });
 CACHE={key,tmax,ini,items,cl,pm};return CACHE;
}

/* ---------- Pantalla ---------- */
const CSS=`.brf{--bl:var(--line,#D9D1BF)}.brf *{box-sizing:border-box}
.brf .tb{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;margin:.6rem 0 1rem}.brf .seg{display:inline-flex;border:1px solid var(--bl)}.brf .seg button{border:0;border-right:1px solid var(--bl);background:var(--raised);color:var(--ink);padding:.4rem .8rem;font:inherit;cursor:pointer;min-height:2.3rem}.brf .seg button:last-child{border-right:0}.brf .seg button[aria-pressed=true]{background:var(--clay);color:var(--onclay,#fff);font-weight:600}
.brf .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin:.4rem 0 1.2rem}.brf .kp div{border:1px solid var(--bl);background:var(--raised);padding:.55rem .75rem}.brf .kp b{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums;line-height:1.1}.brf .kp span{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--soft)}
.brf h3.sh2{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);border-bottom:1px solid var(--bl);padding-bottom:.35rem;margin:1.6rem 0 .8rem}
.brf .lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:.8rem}
.brf .st{border:1px solid var(--bl);background:var(--raised);padding:.8rem .95rem;position:relative;display:flex;flex-direction:column;gap:.45rem}.brf .st.p1{border-left:4px solid var(--clay)}
.brf .st .rk{position:absolute;top:.5rem;right:.7rem;font-size:1.6rem;font-weight:700;color:var(--bl);font-variant-numeric:tabular-nums;line-height:1}
.brf .st h4{margin:0;padding-right:2rem;font-size:1.02rem;line-height:1.3;font-weight:600}.brf .st h4 a{color:inherit;text-decoration:none}.brf .st h4 a:hover{text-decoration:underline}
.brf .meta{font-size:.78rem;color:var(--soft);display:flex;flex-wrap:wrap;gap:.2rem .7rem}.brf .tg{display:inline-block;font-size:.7rem;font-weight:600;padding:.05rem .45rem;border:1px solid currentColor;border-radius:99px;margin-right:.25rem;white-space:nowrap}
.brf .tg.sal{color:var(--pos,#4C7A5D)}.brf .tg.nac{color:var(--indigo,#2B3A55)}.brf .tg.cru{color:var(--clay,#B1502E)}.brf .tg.tm{color:var(--soft)}
.brf details{font-size:.83rem}.brf details summary{cursor:pointer;color:var(--soft)}.brf details ul{margin:.3rem 0 0 1rem;padding:0}.brf details li{margin:.15rem 0}
.brf .why{font-size:.74rem;color:var(--soft)}
.brf .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:1.2rem}
.brf table{width:100%;border-collapse:collapse;font-size:.86rem}.brf td,.brf th{padding:.4rem .4rem;border-bottom:1px solid var(--bl);text-align:left;vertical-align:top}.brf th{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);font-weight:600}.brf td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.brf .bar{display:block;height:.5rem;background:var(--bl);margin-top:.25rem}.brf .bar i{display:block;height:100%;background:var(--clay)}
.brf .tw{overflow-x:auto}.brf .vac{padding:.9rem 1rem;border:1px dashed var(--soft);color:var(--soft);font-size:.9rem}
.brf a{color:var(--ink)}.brf button.cp{font:inherit;border:1px solid var(--ink);background:var(--raised);color:var(--ink);padding:.4rem .8rem;cursor:pointer;min-height:2.3rem}
.brf.vfs-on{padding:4.2rem 1.4rem 1.4rem!important}
.brf .nota{font-size:.8rem;color:var(--soft);margin:.5rem 0}`;
function css(){if(document.getElementById('brf-css'))return;const s=document.createElement('style');s.id='brf-css';s.textContent=CSS;document.head.appendChild(s)}

const seg=(k,opts)=>`<div class="seg" role="group" aria-label="${esc2(k)}">${opts.map(o=>`<button type="button" data-brf="${k}:${o[0]}" aria-pressed="${String(ST[k])===String(o[0])}">${o[1]}</button>`).join('')}</div>`;
const tagCat=c=>c.cruce?'<span class="tg cru">Nación + Salta</span>':c.sal?'<span class="tg sal">Salta</span>':'<span class="tg nac">Nación</span>';
function cardHist(c,i,ref,top){
 const pers=c.pers.slice(0,4).map(l=>{const id=perId(l);return id?`<a class="tg tm" href="#/estrategia/${encodeURIComponent(id)}">${esc2(l)}</a>`:`<a class="tg tm" href="#/conexiones/${encodeURIComponent(l)}" title="Ver conexiones">${esc2(l)}</a>`}).join('');
 const src=c.items.slice().sort((a,b)=>a.ts-b.ts);
 const ms=[...c.med];
 return `<article class="st${i===0&&top?' p1':''}">${top?`<span class="rk" aria-hidden="true">${i+1}</span>`:''}
 <div>${tagCat(c)}<span class="tg tm">${esc2(c.tema)}</span></div>
 <h4><a href="${esc2(url(c.rep.link))}" target="_blank" rel="noopener noreferrer">${esc2(cut(c.rep.t,170))}</a></h4>
 <div class="meta"><span><b>${c.m}</b> medio${c.m===1?'':'s'}</span><span>${c.n} nota${c.n===1?'':'s'}</span><span>${hace(c.last,ref)}</span>${c.abierta?`<span>abierta ${c.abierta}×</span>`:''}</div>
 ${pers?`<div>${pers}</div>`:''}
 <details><summary>Quiénes la publicaron (${ms.length})</summary><ul>${src.slice(0,12).map(x=>`<li><a href="${esc2(url(x.link))}" target="_blank" rel="noopener noreferrer">${esc2(x.mn)}</a> <span class="why">· ${fh(x.ts)}</span></li>`).join('')}${src.length>12?`<li class="why">y ${src.length-12} más</li>`:''}</ul></details>
 ${top?`<div class="why">Por qué sube: cobertura ${c.puntos.cobertura}${c.puntos.personas?` · personas ${c.puntos.personas}`:''}${c.puntos.tema?` · tema ${c.puntos.tema>0?'+':''}${c.puntos.tema}`:''}${c.puntos.alcance?` · Nación y Salta +${c.puntos.alcance}`:''} · frescura ${c.puntos.fresca}</div>`:''}
 </article>`}

function resumenTexto(d){
 const L=['NEWAR · Briefing · '+fh(d.tmax)+' (últimas '+ST.h+' h de datos'+(ST.amb?', '+(ST.amb==='sal'?'Salta':'Nación'):'')+')',''];
 L.push('LO MÁS IMPORTANTE');
 top(d).slice(0,6).forEach((c,i)=>L.push((i+1)+'. '+cut(c.rep.t,150)+' ('+c.m+' medio'+(c.m===1?'':'s')+')'));
 L.push('','MÁS CUBIERTAS');
 cubiertas(d).slice(0,5).forEach((c,i)=>L.push((i+1)+'. '+cut(c.rep.t,150)+' ('+c.m+' medios)'));
 L.push('','Aviso: el orden es una puntuación automática por cobertura y relevancia; no mide lecturas.');
 return L.join('\n')}
const top=d=>d.cl.filter(c=>ST.deportes||c.tema!=='Deportes y espectáculos').slice().sort((a,b)=>b.score-a.score||b.last-a.last).slice(0,9);
const cubiertas=d=>d.cl.filter(c=>ST.deportes||c.tema!=='Deportes y espectáculos').slice().sort((a,b)=>b.m-a.m||b.n-a.n||b.last-a.last);

V.briefing=()=>{css();setTimeout(pinta,0);return`<h2 class="sec">Briefing de noticias</h2><div class="brf" id="brf"><p class="vac" role="status">Armando el resumen…</p></div>`};
async function pinta(){
 const el=document.getElementById('brf');if(!el)return;
 try{if(typeof need==='function'&&typeof S!=='undefined'&&!('news' in S))await need('news')}catch(e){}
 if(!document.getElementById('brf'))return;
 const d=calcula(),ref=d.tmax,gen=(typeof GEN!=='undefined'&&GEN)?GEN:0;
 if(!d.items.length){el.innerHTML=`<p class="lede">No hay notas en la ventana elegida.</p>${barra()}<div class="vac" role="status">Sin notas entre ${esc2(fh(d.ini))} y ${esc2(fh(d.tmax))}. Probá una ventana más larga o «Todo» en el ámbito.</div>`;return}
 const t=top(d),c=cubiertas(d),ab=Object.entries(lsGet()).map(([k,v])=>Object.assign({k},v)).sort((a,b)=>b.n-a.n||b.t-a.t).slice(0,6);
 const medios=new Set(d.items.map(x=>x.mn)),pS=d.items.filter(x=>x.cat!=='Nacional').length;
 // personas
 const cp=new Map();d.cl.forEach(g=>g.pers.forEach(p=>cp.set(p,(cp.get(p)||0)+g.n)));
 const pers=[...cp.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),maxP=Math.max(1,...pers.map(x=>x[1]));
 // temas
 const ct={};d.cl.forEach(g=>{ct[g.tema]=(ct[g.tema]||0)+g.n});const temas=Object.entries(ct).filter(x=>ST.deportes||x[0]!=='Deportes y espectáculos').sort((a,b)=>b[1]-a[1]),maxT=Math.max(1,...temas.map(x=>x[1]));
 const viejo=Date.now()-d.tmax>36*H;
 el.innerHTML=
 `<p class="lede">Lo más importante de las últimas ${ST.h} horas <b>de datos</b> (hasta ${esc2(fh(d.tmax))})${viejo?`: el recolector no trae notas más nuevas, por eso el resumen no llega a hoy`:''}. Las notas que cuentan lo mismo se agrupan en una historia.</p>
 <div class="tb">${seg('h',[[24,'24 h'],[48,'48 h'],[168,'7 días']])}${seg('amb',[['','Todo'],['sal','Salta'],['nac','Nación']])}<label class="i" style="display:inline-flex;gap:.35rem;align-items:center;font-size:.85rem"><input type="checkbox" data-brf-dep ${ST.deportes?'checked':''}> Incluir deportes y espectáculos</label><button type="button" class="cp" data-brf-copy>Copiar resumen</button></div>
 <div class="kp"><div><b>${nf(d.items.length)}</b><span>notas</span></div><div><b>${nf(d.cl.length)}</b><span>historias</span></div><div><b>${nf(medios.size)}</b><span>medios</span></div><div><b>${d.items.length?Math.round(pS/d.items.length*100):0}%</b><span>de Salta</span></div><div><b>${nf(d.cl.filter(x=>x.cruce).length)}</b><span>en Nación y Salta</span></div></div>
 <h3 class="sh2">Lo más importante</h3>
 <div class="lead">${t.slice(0,6).map((g,i)=>cardHist(g,i,ref,true)).join('')||'<div class="vac">Sin historias para mostrar.</div>'}</div>
 <p class="nota">La puntuación suma cobertura (cuántos medios la publicaron), personas de la nómina nombradas, tema político, económico o judicial, alcance Nación + Salta y frescura. Es un criterio automático y explicado en cada tarjeta, no una decisión editorial.</p>
 <div class="cols">
  <div><h3 class="sh2">Más cubiertas</h3><div class="tw"><table><thead><tr><th>#</th><th>Historia</th><th>Medios</th></tr></thead><tbody>${c.slice(0,10).map((g,i)=>`<tr><td class="n">${i+1}</td><td><a href="${esc2(url(g.rep.link))}" target="_blank" rel="noopener noreferrer">${esc2(cut(g.rep.t,110))}</a><div class="meta"><span>${esc2(g.tema)}</span><span>${hace(g.last,ref)}</span></div></td><td class="n"><b>${g.m}</b><span class="bar"><i style="width:${Math.round(g.m/Math.max(1,c[0].m)*100)}%"></i></span></td></tr>`).join('')}</tbody></table></div><p class="nota">«Más cubiertas» cuenta medios distintos por historia. NEWAR no tiene las lecturas de los medios: no es un ranking de «más vistas».</p></div>
  <div><h3 class="sh2">Más abiertas por vos</h3>${ab.length?`<div class="tw"><table><thead><tr><th>Nota</th><th>Veces</th></tr></thead><tbody>${ab.map(x=>`<tr><td><a href="${esc2(url(x.h))}" target="_blank" rel="noopener noreferrer">${esc2(cut(x.s,100))}</a><div class="meta"><span>${esc2(x.m||'')}</span></div></td><td class="n">${x.n}</td></tr>`).join('')}</tbody></table></div>`:'<div class="vac">Todavía no abriste notas desde NEWAR en este navegador. A medida que abras notas acá, aparecen las que más abrís.</div>'}<p class="nota">Se guarda sólo en este navegador y cuenta las aperturas desde NEWAR. Borrar los datos del sitio lo reinicia.</p></div>
 </div>
 <div class="cols">
  <div><h3 class="sh2">Personas en el centro</h3>${pers.length?`<div class="tw"><table><tbody>${pers.map(([id,n])=>`<tr><td><a href="${perId(id)?'#/estrategia/'+encodeURIComponent(perId(id)):'#/conexiones/'+encodeURIComponent(id)}">${esc2(id)}</a><span class="bar"><i style="width:${Math.round(n/maxP*100)}%"></i></span></td><td class="n">${n} nota${n===1?'':'s'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="vac">No hay personas de la nómina ni figuras públicas conocidas en los títulos de esta ventana.</div>'}<p class="nota">Cuenta a las personas de la nómina (nombre completo en el título) y a figuras públicas conocidas por su apellido. Cada nombre lleva a su ficha o a sus <a href="#/conexiones">conexiones</a>.</p></div>
  <div><h3 class="sh2">Temas dominantes</h3><div class="tw"><table><tbody>${temas.map(([n,v])=>`<tr><td>${esc2(n)}<span class="bar"><i style="width:${Math.round(v/maxT*100)}%"></i></span></td><td class="n">${nf(v)} notas</td></tr>`).join('')}</tbody></table></div><p class="nota">Clasificación por palabras del título (sin IA). «Otros» agrupa lo que no encaja en ningún tema.</p></div>
 </div>
 ${gen?`<p class="nota">Datos recolectados al ${esc2(fh(gen))}.</p>`:''}`;
}
function barra(){return`<div class="tb">${seg('h',[[24,'24 h'],[48,'48 h'],[168,'7 días']])}${seg('amb',[['','Todo'],['sal','Salta'],['nac','Nación']])}</div>`}

document.addEventListener('click',e=>{
 const b=e.target.closest&&e.target.closest('#brf [data-brf]');
 if(b){const[k,v]=b.getAttribute('data-brf').split(':');ST[k]=k==='h'?+v:v;pinta();return}
 const c=e.target.closest&&e.target.closest('#brf [data-brf-copy]');
 if(c){const tx=resumenTexto(calcula());const ok=m=>{const t=c.textContent;c.textContent=m;setTimeout(()=>{if(c.isConnected)c.textContent=t},1800)};
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(tx).then(()=>ok('Copiado'),()=>ok('No se pudo copiar'));return}}catch(x){}
  try{const ta=document.createElement('textarea');ta.value=tx;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();const r=document.execCommand('copy');ta.remove();ok(r?'Copiado':'No se pudo copiar')}catch(x){ok('No se pudo copiar')}}
});
document.addEventListener('change',e=>{if(e.target&&e.target.hasAttribute&&e.target.hasAttribute('data-brf-dep')){ST.deportes=e.target.checked?1:0;pinta()}});

/* pestaña y grupo del menú */
if(!TABS.some(t=>t[0]==='briefing'))TABS.splice(1,0,['briefing','Briefing']);
try{if(typeof TGRP!=='undefined'&&TGRP[0]&&!TGRP[0][1].includes('briefing'))TGRP[0][1].splice(1,0,'briefing')}catch(e){}
try{if(typeof NEEDS!=='undefined')NEEDS.briefing=['news']}catch(e){}
window.NewarBriefing={agrupa,temaDe,toks,jac,calcula,top,cubiertas,estado:ST};
})();
