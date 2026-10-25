/* ===== NEWAR · Mundo (prensa internacional) =====
   Pestaña «Mundo»: titulares de diarios y agencias del mundo (The Economist, The Wall Street Journal, Miami Herald,
   Financial Times, The New York Times, BBC, etc.) que recolecta scripts/internacional.py y guarda en
   data/news_internacional.json. Se puede filtrar por medio, idioma, ventana de tiempo y por «Argentina» / «Latinoamérica».
   Los titulares NO se traducen: quedan en el idioma original del diario. «Argentina» y «Latinoamérica» se marcan
   por palabras del titular (Argentina, Milei, Salta, Mercosur…): es una pista, no un análisis.
   No inventa notas: cada fila es un titular real con su enlace. Se carga desde briefing.js (no hace falta tocar index.html). */
(()=>{
if(typeof V==='undefined'||typeof TABS==='undefined'||window.NewarMundo)return;
const H=36e5;
const esc2=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fo=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const url=u=>/^https?:\/\//i.test(u||'')?u:'#';
const nf=n=>Number(n).toLocaleString('es-AR');
const cut=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+'…':s};
const hace=(ts,ref)=>{const m=Math.max(0,Math.round((ref-ts)/6e4));return m<60?'hace '+m+' min':m<1440?'hace '+Math.round(m/60)+' h':'hace '+Math.round(m/1440)+' d'};
const ts=n=>Date.parse(n.published_iso||n.collected_at)||0;
try{SRC.mundo=['news_internacional',[],true];SRC.mundost=['internacional_status',{medios:{}},true]}catch(e){}
const ST={h:48,ambito:'',lang:'',medio:'',q:'',tema:''};
const STOPW=new Set(('that this with from have has had will would could about after before their there they them what when where which while into over under more most than then also been being were your you says said say new news year years first last week today amid just still back says make makes made take takes like only some other what them dijo para como pero este esta estos estas esos esas sobre entre desde hasta tras ante donde cuando quien cual sino tambien ahora hoy ayer nuevo nueva primer segun contra cada otro otra porque puede tiene tienen hace hizo fueron sera video photos live update updates analysis opinion explained').split(' '));
const toks=t=>new Set(fo(t).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(x=>x.length>=4&&!STOPW.has(x)));
const jac=(a,b)=>{let i=0;a.forEach(x=>{if(b.has(x))i++});return i?i/(a.size+b.size-i):0};
const TEMAS=[
 ['Economía y mercados',/econom|market|stock|bond|inflation|inflaci|\bfed\b|interest rate|tasa|dollar|d[oó]lar|trade|tariff|arancel|bank|banco|\bimf\b|\bfmi\b|debt|deuda|gdp|growth|recession|oil price|earnings|invest|bolsa|merc[ao]do|bitcoin|crypto/i],
 ['Guerra y geopolítica',/\bwar\b|guerra|ukrain|russia|rusia|gaza|israel|hamas|iran|china|taiwan|nato|otan|missile|misil|troops|ceasefire|alto el fuego|sanction|sanci[oó]n|military|militar|attack|ataque|\bun\b|putin|xi jinping|north korea/i],
 ['Política de EE.UU.',/trump|biden|congress|congreso|senate|senado|white house|casa blanca|republican|democrat|supreme court|washington|harris|vance|\bgop\b|election|elecci/i],
 ['Latinoamérica',/latin america|latam|latinoam|am[eé]rica latina|brazil|brasil|mexic|m[eé]xico|colombia|venezuela|chile\b|peru\b|per[uú]\b|bolivia|uruguay|paraguay|ecuador|cuba\b|argentin|milei|lula|maduro|sheinbaum|petro\b/i],
 ['Tecnología e IA',/\bai\b|artificial intelligence|inteligencia artificial|openai|nvidia|google|apple|microsoft|meta\b|tesla|musk|chip|semiconductor|tech|cyber|software|robot|starlink|\bx\b/i],
 ['Energía y clima',/climate|clima|energy|energ[ií]a|oil|petr[oó]leo|gas\b|lithium|litio|solar|renewable|emission|carbon|cop\d|hurricane|huracán|wildfire|flood|inundaci/i],
 ['Salud y ciencia',/health|salud|vaccine|vacuna|virus|outbreak|brote|cancer|c[aá]ncer|study|estudio|scientist|cient[ií]fic|nasa|space|espacio|pope|papa\b/i]
];
const temaDe=t=>{for(const[n,r]of TEMAS)if(r.test(t))return n;return'Otros'};
const CSS=`.mnd .tb{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;margin:.6rem 0 .9rem}
.mnd .seg{display:inline-flex;border:1px solid var(--line)}.mnd .seg button{border:0;border-right:1px solid var(--line);background:var(--raised);color:var(--ink);padding:.4rem .8rem;font:inherit;cursor:pointer;min-height:2.3rem}.mnd .seg button:last-child{border-right:0}.mnd .seg button[aria-pressed=true]{background:var(--clay);color:var(--onclay,#fff);font-weight:600}
.mnd .bq{font:inherit;padding:.4rem .6rem;border:1px solid var(--line);background:var(--raised);color:var(--ink);min-height:2.3rem;min-width:12rem}
.mnd .chips{display:flex;flex-wrap:wrap;gap:.35rem;margin:.2rem 0 1rem}.mnd .chips button{font:inherit;font-size:.78rem;padding:.25rem .6rem;border:1px solid var(--line);background:var(--raised);color:var(--soft);cursor:pointer}.mnd .chips button[aria-pressed=true]{color:var(--ink);border-color:var(--clay)}
.mnd .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.6rem;margin:.6rem 0 1rem}.mnd .kp>div{border:1px solid var(--line);background:var(--raised);padding:.6rem .8rem}.mnd .kp b{display:block;font-size:1.5rem}.mnd .kp span{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--soft)}
.mnd .li{list-style:none;margin:0;padding:0}.mnd .li li{border-top:1px solid var(--line);padding:.6rem 0}.mnd .li a{color:var(--ink);text-decoration:none;font-weight:600;line-height:1.35}.mnd .li a:hover{text-decoration:underline}
.mnd .meta{display:flex;flex-wrap:wrap;gap:.3rem .7rem;font-size:.76rem;color:var(--soft);margin-top:.2rem}.mnd .tg{border:1px solid var(--line);padding:0 .4rem;font-size:.7rem;letter-spacing:.05em}.mnd .tg.a{border-color:var(--clay);color:var(--clay)}.mnd .tg.l{border-color:var(--indigo);color:var(--indigo)}
.mnd .nota{font-size:.8rem;color:var(--soft);margin:.5rem 0}.mnd .cols{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem}@media(max-width:820px){.mnd .cols{grid-template-columns:1fr}}
.mnd table{width:100%;border-collapse:collapse;font-size:.85rem}.mnd td,.mnd th{padding:.4rem .3rem;border-top:1px solid var(--line);text-align:left}.mnd td.n{text-align:right;white-space:nowrap}.mnd .ok{color:var(--pos)}.mnd .er{color:var(--neg)}
.mnd .dl{font-size:.72rem;margin-left:.4rem;color:var(--soft)}.mnd .dl.up{color:var(--pos)}.mnd .dl.dn{color:var(--neg)}.mnd .bar{display:block;height:.35rem;background:var(--line);margin-top:.25rem}.mnd .bar i{display:block;height:100%;background:var(--clay)}.mnd .bar i.b{background:var(--indigo)}
.mnd .lead{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:.8rem;margin:.4rem 0 1rem}.mnd .card{border:1px solid var(--line);background:var(--raised);padding:.8rem .9rem;border-left:3px solid var(--indigo)}.mnd .card.a{border-left-color:var(--clay)}.mnd .card h4{margin:.1rem 0 .4rem;font-size:1rem;line-height:1.3}.mnd .card h4 a{color:var(--ink);text-decoration:none}.mnd .card h4 a:hover{text-decoration:underline}.mnd .card details{font-size:.8rem;color:var(--soft);margin-top:.4rem}.mnd .card summary{cursor:pointer}.mnd .card details a{color:var(--ink)}
.mnd .cp{font:inherit;border:1px solid var(--clay);background:var(--raised);color:var(--ink);padding:.4rem .8rem;cursor:pointer;min-height:2.3rem}.mnd .terms{display:flex;flex-wrap:wrap;gap:.35rem}.mnd .terms button{font:inherit;font-size:.8rem;border:1px solid var(--line);background:var(--raised);color:var(--ink);padding:.2rem .55rem;cursor:pointer}.mnd .terms button small{color:var(--soft);margin-left:.3rem}
.mnd .vac{border:1px dashed var(--line);padding:1rem;color:var(--soft)}`;
let cssOk=false;const css=()=>{if(cssOk)return;cssOk=true;const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)};
const dlt=(v,p)=>{const d=v-p;return d===0?'<span class="dl">=</span>':`<span class="dl ${d>0?'up':'dn'}" title="Frente a la ventana anterior de igual duración: ${p}">${d>0?'▲':'▼'} ${Math.abs(d)}</span>`};
const seg=(k,o)=>`<div class="seg" role="group" aria-label="${esc2(k)}">${o.map(x=>`<button type="button" data-mnd="${k}:${esc2(x[0])}" aria-pressed="${String(ST[k])===String(x[0])}">${x[1]}</button>`).join('')}</div>`;
function agrupa(items){
 const cl=[],ix=new Map(),ord=items.slice().sort((a,b)=>ts(a)-ts(b));
 ord.forEach(it=>{const T=toks(it.title);let best=null,bj=0;
  if(T.size>=3){const cand=new Map();T.forEach(w=>(ix.get(w)||[]).forEach(c=>cand.set(c,(cand.get(c)||0)+1)));
   cand.forEach((sh,c)=>{if(sh<3)return;if(ts(it)-c.last>72*H)return;const j=jac(T,c.T);if(j>=.3&&j>bj){bj=j;best=c}})}
  if(best){best.items.push(it);best.last=Math.max(best.last,ts(it));best.med.add(it.source)}
  else{const c={T,items:[it],last:ts(it),med:new Set([it.source])};cl.push(c);T.forEach(w=>{if(!ix.has(w))ix.set(w,[]);ix.get(w).push(c)})}});
 cl.forEach(c=>{c.rep=c.items.slice().sort((a,b)=>(b.arg?1:0)-(a.arg?1:0)||ts(b)-ts(a))[0];c.m=c.med.size;c.n=c.items.length;c.arg=c.items.some(x=>x.arg);c.lat=c.items.some(x=>x.lat);c.tema=temaDe(c.rep.title)});
 return cl}
const termsDe=l=>{const m=new Map();l.forEach(n=>{toks(n.title).forEach(w=>{const o=m.get(w)||{n:0,med:new Set};o.n++;o.med.add(n.source);m.set(w,o)})});return m};
const calc=()=>{
 const raw=(typeof S!=='undefined'&&Array.isArray(S.mundo))?S.mundo:[];
 const tmax=raw.reduce((m,n)=>Math.max(m,ts(n)),0),seen=new Set();
 const all=raw.filter(n=>n&&n.id&&!seen.has(n.id)&&seen.add(n.id)&&n.title&&ts(n)>0);
 const ini=tmax-ST.h*H;
 const base=all.filter(n=>ts(n)>=ini);
 const f=base.filter(n=>(!ST.ambito||(ST.ambito==='arg'?n.arg:n.arg||n.lat))&&(!ST.lang||n.lang===ST.lang)&&(!ST.medio||n.source===ST.medio)&&(!ST.q||fo(n.title).includes(fo(ST.q)))&&(!ST.tema||temaDe(n.title)===ST.tema));
 f.sort((a,b)=>ts(b)-ts(a));
 const prev=all.filter(n=>ts(n)>=ini-ST.h*H&&ts(n)<ini);
 const cl=agrupa(base),tm={},tp={};
 base.forEach(n=>{const t=temaDe(n.title);tm[t]=(tm[t]||0)+1});prev.forEach(n=>{const t=temaDe(n.title);tp[t]=(tp[t]||0)+1});
 const T=termsDe(base),TP=termsDe(prev);
 const terms=[...T.entries()].filter(([w,o])=>o.med.size>=2&&o.n>=3).map(([w,o])=>({w,n:o.n,m:o.med.size,p:(TP.get(w)||{n:0}).n})).sort((a,b)=>b.m-a.m||b.n-a.n).slice(0,14);
 const top=cl.filter(c=>c.m>=2||c.arg).map(c=>({c,sc:Math.min(12,c.m*2)+(c.arg?3:0)+(c.lat?1.5:0)+Math.max(0,1-(tmax-c.last)/(ST.h*H))*2})).sort((a,b)=>b.sc-a.sc).slice(0,6);
 return{all,base,f,tmax,ini,prev,cl,tm,tp,prevOk:prev.length>=Math.max(15,base.length*.3),terms,top};
};
const bloques=d=>{
 const temas=Object.entries(d.tm).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...temas.map(x=>x[1]));
 const card=({c})=>{const ms=[...c.med].sort();return`<div class="card${c.arg?' a':''}"><div class="meta" style="display:flex;gap:.6rem;font-size:.74rem;color:var(--soft)"><span>${esc2(c.tema)}</span>${c.arg?'<span class="tg a">ARGENTINA</span>':c.lat?'<span class="tg l">LATAM</span>':''}</div><h4><a href="${esc2(url(c.rep.link))}" target="_blank" rel="noopener noreferrer">${esc2(cut(c.rep.title,150))}</a></h4><div class="meta" style="display:flex;gap:.7rem;font-size:.76rem;color:var(--soft)"><span><b>${c.m}</b> diario${c.m===1?'':'s'}</span><span>${c.n} nota${c.n===1?'':'s'}</span><span>${hace(c.last,d.tmax)}</span></div>${c.n>1?`<details><summary>Quiénes la publicaron (${ms.length})</summary>${c.items.slice().sort((a,b)=>ts(b)-ts(a)).map(x=>`<div><a href="${esc2(url(x.link))}" target="_blank" rel="noopener noreferrer">${esc2(x.source)}</a> · ${esc2(cut(x.title,90))}</div>`).join('')}</details>`:`<div class="meta" style="font-size:.76rem;color:var(--soft)">${esc2(c.rep.source)}</div>`}</div>`};
 const porMed=Object.entries(d.base.reduce((a,n)=>{const o=a[n.source]||(a[n.source]={n:0,a:0});o.n++;if(n.arg)o.a++;return a},{})).sort((a,b)=>b[1].n-a[1].n),mm=Math.max(1,...porMed.map(x=>x[1].n));
 return`<h3 class="sh2">Lo más importante del mundo</h3><div class="lead">${d.top.length?d.top.map(card).join(''):'<div class="vac">Todavía no hay historias cubiertas por más de un diario en esta ventana.</div>'}</div>
 <p class="nota">Una historia es un grupo de titulares parecidos de distintos diarios (se agrupan dentro del mismo idioma). Puntúa por cuántos diarios la publicaron, si nombra a Argentina o Latinoamérica y qué tan reciente es. Criterio automático, no editorial.</p>
 <div class="cols"><div><h3 class="sh2">Temas</h3><div class="chips" role="group" aria-label="Filtrar por tema"><button type="button" data-mnd="tema:" aria-pressed="${!ST.tema}">Todos</button></div><div style="overflow:auto"><table><tbody>${temas.map(([k,v])=>`<tr><td><a href="#/mundo" data-mnd="tema:${esc2(ST.tema===k?'':k)}" style="color:var(--ink);${ST.tema===k?'font-weight:700':''}">${esc2(k)}</a><span class="bar"><i class="b" style="width:${Math.round(v/mx*100)}%"></i></span></td><td class="n">${nf(v)}${d.prevOk?dlt(v,d.tp[k]||0):''}</td></tr>`).join('')}</tbody></table></div><p class="nota">Clasificación por palabras del titular, en inglés y español (sin IA).${d.prevOk?' Las flechas comparan con la ventana anterior de igual duración.':' Sin datos suficientes de la ventana anterior para comparar.'} Tocá un tema para filtrar la lista.</p></div>
 <div><h3 class="sh2">Términos en alza</h3>${d.terms.length?`<div class="terms">${d.terms.map(t=>`<button type="button" data-mnd="q:${esc2(t.w)}" title="${t.n} titulares en ${t.m} diarios">${esc2(t.w)}<small>${t.m}${d.prevOk?(t.n>t.p?' ▲':t.n<t.p?' ▼':''):''}</small></button>`).join('')}</div><p class="nota">Palabras que aparecen en titulares de al menos 2 diarios distintos. El número es la cantidad de diarios. Tocá una para buscarla.</p>`:'<div class="vac">Aún no hay suficientes titulares para detectar términos repetidos.</div>'}
 <h3 class="sh2">Titulares por diario</h3><div style="overflow:auto"><table><tbody>${porMed.map(([k,o])=>`<tr><td>${esc2(k)}<span class="bar"><i class="b" style="width:${Math.round(o.n/mm*100)}%"></i></span></td><td class="n">${o.n}${o.a?` · <span style="color:var(--clay)">${o.a} Arg.</span>`:''}</td></tr>`).join('')}</tbody></table></div></div></div>`};
const resumenTxt=d=>{const L=['NEWAR · Mundo · últimas '+ST.h+' h de datos',''];d.top.forEach(({c},i)=>L.push((i+1)+'. '+c.rep.title+' ('+c.m+' diario'+(c.m===1?'':'s')+': '+[...c.med].join(', ')+')'+(c.arg?' [Argentina]':'')));L.push('',...d.base.filter(n=>n.arg).slice(0,8).map(n=>'· '+n.source+': '+n.title+' '+n.link));return L.join('\n')};
async function pinta(){
 const el=document.getElementById('mnd');if(!el)return;
 try{await need('mundo','mundost')}catch(e){}
 if(!document.getElementById('mnd'))return;
 const d=calc(),st=((typeof S!=='undefined'&&S.mundost)||{}).medios||{};
 if(!d.all.length){el.innerHTML=`<div class="vac" role="status"><b>Todavía no hay titulares internacionales.</b><br>El recolector (scripts/internacional.py) corre solo cada 30 minutos desde GitHub Actions. Si recién subiste los archivos, andá a la pestaña <b>Actions</b> del repo, elegí «Prensa internacional» y tocá <b>Run workflow</b>; en un par de minutos aparecen acá.</div>`;return}
 const medios=[...new Set(d.base.map(n=>n.source))].sort();
 const cnt={};d.base.forEach(n=>{cnt[n.source]=(cnt[n.source]||0)+1});
 const viejo=Date.now()-d.tmax>12*H;
 const arg=d.base.filter(n=>n.arg),lat=d.base.filter(n=>n.lat&&!n.arg);
 const lista=d.f.slice(0,80);
 const tr=n=>`<li><a href="${esc2(url(n.link))}" target="_blank" rel="noopener noreferrer">${esc2(cut(n.title,200))}</a><div class="meta"><span>${esc2(n.source)}</span><span>${esc2(n.country||'')}</span><span>${n.lang==='es'?'ES':'EN'}</span><span>${hace(ts(n),d.tmax)}</span>${n.arg?'<span class="tg a">ARGENTINA</span>':''}${n.lat&&!n.arg?'<span class="tg l">LATAM</span>':''}</div></li>`;
 el.innerHTML=
 `<p class="lede">Titulares de diarios y agencias del mundo, tal como los publicó cada uno (sin traducir), hasta ${esc2(new Date(d.tmax).toLocaleString('es-AR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}))}.${viejo?' El recolector no trae titulares más nuevos: revisá la pestaña Control o la sección Actions del repo.':''}</p>
 <div class="tb">${seg('h',[[24,'24 h'],[48,'48 h'],[168,'7 días']])}${seg('ambito',[['','Todo'],['arg','Argentina'],['lat','Argentina + Latam']])}${seg('lang',[['','Todos'],['en','Inglés'],['es','Español']])}<button type="button" class="cp" data-mnd-copy>Copiar resumen</button><input type="search" id="mndq" class="bq" placeholder="Buscar palabra en los titulares…" aria-label="Buscar palabra en los titulares" value="${esc2(ST.q)}"></div>
 <div class="chips" role="group" aria-label="Filtrar por diario"><button type="button" data-mnd="medio:" aria-pressed="${!ST.medio}">Todos los diarios</button>${medios.map(m=>`<button type="button" data-mnd="medio:${esc2(m)}" aria-pressed="${ST.medio===m}">${esc2(m)} · ${cnt[m]}</button>`).join('')}</div>
 <div class="kp"><div><b>${nf(d.base.length)}</b><span>titulares</span></div><div><b>${nf(medios.length)}</b><span>diarios</span></div><div><b>${nf(arg.length)}</b><span>mencionan Argentina</span></div><div><b>${nf(lat.length)}</b><span>otros de Latinoamérica</span></div></div>
 ${bloques(d)}
 <div class="cols"><div><h3 class="sh2">${ST.medio||ST.ambito||ST.q||ST.lang?'Titulares filtrados':'Últimos titulares'} (${nf(d.f.length)})</h3>${lista.length?`<ul class="li">${lista.map(tr).join('')}</ul>${d.f.length>lista.length?`<p class="nota">Se muestran los ${lista.length} más recientes. Afiná con los filtros de arriba.</p>`:''}`:'<div class="vac">Ningún titular coincide con los filtros. Probá «Todo» o una ventana más larga.</div>'}</div>
 <div><h3 class="sh2">Argentina en la prensa del mundo</h3>${arg.length?`<ul class="li">${arg.sort((a,b)=>ts(b)-ts(a)).slice(0,8).map(tr).join('')}</ul>`:'<div class="vac">En esta ventana ningún diario mencionó Argentina en el titular.</div>'}<p class="nota">«Argentina» se marca si el titular (o su bajada) nombra Argentina, Milei, Salta, Mercosur, Malvinas y similares. Es una pista por palabras, no un análisis.</p>
 <h3 class="sh2">Estado de las fuentes</h3><div style="overflow:auto"><table><thead><tr><th>Diario</th><th>Vía</th><th>Titulares</th></tr></thead><tbody>${Object.entries(st).map(([k,v])=>`<tr><td>${esc2(k)}</td><td class="${v.state==='ok'?'ok':'er'}">${v.state==='ok'?(v.via==='rss'?'RSS propio':'Google News'):esc2(v.state==='error'?'con error':'sin resultados')}</td><td class="n">${nf(v.items||0)}</td></tr>`).join('')||'<tr><td colspan="3">Sin datos de estado.</td></tr>'}</tbody></table></div><p class="nota">«Google News» significa que el RSS propio del diario no respondió y se tomaron sus titulares desde ahí. Los diarios «con error» o «sin resultados» no aportan por ahora.</p></div></div>`;
}
V.mundo=()=>{css();setTimeout(pinta,0);return`<h2 class="sec">Mundo · prensa internacional</h2><div class="mnd" id="mnd"><p class="vac" role="status">Cargando titulares…</p></div>`};
try{if(!TABS.some(t=>t[0]==='mundo'))TABS.splice(2,0,['mundo','Mundo'])}catch(e){}
try{if(typeof TGRP!=='undefined'&&TGRP[0]&&!TGRP[0][1].includes('mundo'))TGRP[0][1].splice(2,0,'mundo')}catch(e){}
try{NEEDS.mundo=['mundo','mundost']}catch(e){}
document.addEventListener('click',e=>{const cp=e.target.closest&&e.target.closest('#mnd [data-mnd-copy]');if(cp){const tx=resumenTxt(calc());const ok=m=>{const t=cp.textContent;cp.textContent=m;setTimeout(()=>{if(cp.isConnected)cp.textContent=t},1800)};try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(tx).then(()=>ok('Copiado'),()=>ok('No se pudo copiar'));return}}catch(x){}try{const ta=document.createElement('textarea');ta.value=tx;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();const r=document.execCommand('copy');ta.remove();ok(r?'Copiado':'No se pudo copiar')}catch(x){ok('No se pudo copiar')}return}
 const b=e.target.closest&&e.target.closest('#mnd [data-mnd]');if(!b)return;e.preventDefault();const a=b.getAttribute('data-mnd'),i=a.indexOf(':'),k=a.slice(0,i),v=a.slice(i+1);ST[k]=k==='h'?+v:v;pinta()});
let tq=null;document.addEventListener('input',e=>{const i=e.target;if(!i||i.id!=='mndq')return;clearTimeout(tq);tq=setTimeout(async()=>{ST.q=i.value.trim();await pinta();const n=document.getElementById('mndq');if(n){n.focus();const l=n.value.length;try{n.setSelectionRange(l,l)}catch(x){}}},300)});
window.NewarMundo={calc,agrupa,temaDe,estado:ST};
})();
