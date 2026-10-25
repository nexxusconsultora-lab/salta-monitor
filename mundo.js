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
const ST={h:48,ambito:'',lang:'',medio:'',q:''};
const CSS=`.mnd .tb{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;margin:.6rem 0 .9rem}
.mnd .seg{display:inline-flex;border:1px solid var(--line)}.mnd .seg button{border:0;border-right:1px solid var(--line);background:var(--raised);color:var(--ink);padding:.4rem .8rem;font:inherit;cursor:pointer;min-height:2.3rem}.mnd .seg button:last-child{border-right:0}.mnd .seg button[aria-pressed=true]{background:var(--clay);color:var(--onclay,#fff);font-weight:600}
.mnd .bq{font:inherit;padding:.4rem .6rem;border:1px solid var(--line);background:var(--raised);color:var(--ink);min-height:2.3rem;min-width:12rem}
.mnd .chips{display:flex;flex-wrap:wrap;gap:.35rem;margin:.2rem 0 1rem}.mnd .chips button{font:inherit;font-size:.78rem;padding:.25rem .6rem;border:1px solid var(--line);background:var(--raised);color:var(--soft);cursor:pointer}.mnd .chips button[aria-pressed=true]{color:var(--ink);border-color:var(--clay)}
.mnd .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.6rem;margin:.6rem 0 1rem}.mnd .kp>div{border:1px solid var(--line);background:var(--raised);padding:.6rem .8rem}.mnd .kp b{display:block;font-size:1.5rem}.mnd .kp span{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--soft)}
.mnd .li{list-style:none;margin:0;padding:0}.mnd .li li{border-top:1px solid var(--line);padding:.6rem 0}.mnd .li a{color:var(--ink);text-decoration:none;font-weight:600;line-height:1.35}.mnd .li a:hover{text-decoration:underline}
.mnd .meta{display:flex;flex-wrap:wrap;gap:.3rem .7rem;font-size:.76rem;color:var(--soft);margin-top:.2rem}.mnd .tg{border:1px solid var(--line);padding:0 .4rem;font-size:.7rem;letter-spacing:.05em}.mnd .tg.a{border-color:var(--clay);color:var(--clay)}.mnd .tg.l{border-color:var(--indigo);color:var(--indigo)}
.mnd .nota{font-size:.8rem;color:var(--soft);margin:.5rem 0}.mnd .cols{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem}@media(max-width:820px){.mnd .cols{grid-template-columns:1fr}}
.mnd table{width:100%;border-collapse:collapse;font-size:.85rem}.mnd td,.mnd th{padding:.4rem .3rem;border-top:1px solid var(--line);text-align:left}.mnd td.n{text-align:right;white-space:nowrap}.mnd .ok{color:var(--pos)}.mnd .er{color:var(--neg)}
.mnd .vac{border:1px dashed var(--line);padding:1rem;color:var(--soft)}`;
let cssOk=false;const css=()=>{if(cssOk)return;cssOk=true;const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)};
const seg=(k,o)=>`<div class="seg" role="group" aria-label="${esc2(k)}">${o.map(x=>`<button type="button" data-mnd="${k}:${esc2(x[0])}" aria-pressed="${String(ST[k])===String(x[0])}">${x[1]}</button>`).join('')}</div>`;
const calc=()=>{
 const raw=(typeof S!=='undefined'&&Array.isArray(S.mundo))?S.mundo:[];
 const tmax=raw.reduce((m,n)=>Math.max(m,ts(n)),0),seen=new Set();
 const all=raw.filter(n=>n&&n.id&&!seen.has(n.id)&&seen.add(n.id)&&n.title&&ts(n)>0);
 const ini=tmax-ST.h*H;
 const base=all.filter(n=>ts(n)>=ini);
 const f=base.filter(n=>(!ST.ambito||(ST.ambito==='arg'?n.arg:n.arg||n.lat))&&(!ST.lang||n.lang===ST.lang)&&(!ST.medio||n.source===ST.medio)&&(!ST.q||fo(n.title).includes(fo(ST.q))));
 f.sort((a,b)=>ts(b)-ts(a));
 return{all,base,f,tmax,ini};
};
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
 <div class="tb">${seg('h',[[24,'24 h'],[48,'48 h'],[168,'7 días']])}${seg('ambito',[['','Todo'],['arg','Argentina'],['lat','Argentina + Latam']])}${seg('lang',[['','Todos'],['en','Inglés'],['es','Español']])}<input type="search" id="mndq" class="bq" placeholder="Buscar palabra en los titulares…" aria-label="Buscar palabra en los titulares" value="${esc2(ST.q)}"></div>
 <div class="chips" role="group" aria-label="Filtrar por diario"><button type="button" data-mnd="medio:" aria-pressed="${!ST.medio}">Todos los diarios</button>${medios.map(m=>`<button type="button" data-mnd="medio:${esc2(m)}" aria-pressed="${ST.medio===m}">${esc2(m)} · ${cnt[m]}</button>`).join('')}</div>
 <div class="kp"><div><b>${nf(d.base.length)}</b><span>titulares</span></div><div><b>${nf(medios.length)}</b><span>diarios</span></div><div><b>${nf(arg.length)}</b><span>mencionan Argentina</span></div><div><b>${nf(lat.length)}</b><span>otros de Latinoamérica</span></div></div>
 <div class="cols"><div><h3 class="sh2">${ST.medio||ST.ambito||ST.q||ST.lang?'Titulares filtrados':'Últimos titulares'} (${nf(d.f.length)})</h3>${lista.length?`<ul class="li">${lista.map(tr).join('')}</ul>${d.f.length>lista.length?`<p class="nota">Se muestran los ${lista.length} más recientes. Afiná con los filtros de arriba.</p>`:''}`:'<div class="vac">Ningún titular coincide con los filtros. Probá «Todo» o una ventana más larga.</div>'}</div>
 <div><h3 class="sh2">Argentina en la prensa del mundo</h3>${arg.length?`<ul class="li">${arg.sort((a,b)=>ts(b)-ts(a)).slice(0,8).map(tr).join('')}</ul>`:'<div class="vac">En esta ventana ningún diario mencionó Argentina en el titular.</div>'}<p class="nota">«Argentina» se marca si el titular (o su bajada) nombra Argentina, Milei, Salta, Mercosur, Malvinas y similares. Es una pista por palabras, no un análisis.</p>
 <h3 class="sh2">Estado de las fuentes</h3><div style="overflow:auto"><table><thead><tr><th>Diario</th><th>Vía</th><th>Titulares</th></tr></thead><tbody>${Object.entries(st).map(([k,v])=>`<tr><td>${esc2(k)}</td><td class="${v.state==='ok'?'ok':'er'}">${v.state==='ok'?(v.via==='rss'?'RSS propio':'Google News'):esc2(v.state==='error'?'con error':'sin resultados')}</td><td class="n">${nf(v.items||0)}</td></tr>`).join('')||'<tr><td colspan="3">Sin datos de estado.</td></tr>'}</tbody></table></div><p class="nota">«Google News» significa que el RSS propio del diario no respondió y se tomaron sus titulares desde ahí. Los diarios «con error» o «sin resultados» no aportan por ahora.</p></div></div>`;
}
V.mundo=()=>{css();setTimeout(pinta,0);return`<h2 class="sec">Mundo · prensa internacional</h2><div class="mnd" id="mnd"><p class="vac" role="status">Cargando titulares…</p></div>`};
try{if(!TABS.some(t=>t[0]==='mundo'))TABS.splice(2,0,['mundo','Mundo'])}catch(e){}
try{if(typeof TGRP!=='undefined'&&TGRP[0]&&!TGRP[0][1].includes('mundo'))TGRP[0][1].splice(2,0,'mundo')}catch(e){}
try{NEEDS.mundo=['mundo','mundost']}catch(e){}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#mnd [data-mnd]');if(!b)return;const a=b.getAttribute('data-mnd'),i=a.indexOf(':'),k=a.slice(0,i),v=a.slice(i+1);ST[k]=k==='h'?+v:v;pinta()});
let tq=null;document.addEventListener('input',e=>{const i=e.target;if(!i||i.id!=='mndq')return;clearTimeout(tq);tq=setTimeout(async()=>{ST.q=i.value.trim();await pinta();const n=document.getElementById('mndq');if(n){n.focus();const l=n.value.length;try{n.setSelectionRange(l,l)}catch(x){}}},300)});
window.NewarMundo={calc,estado:ST};
})();
