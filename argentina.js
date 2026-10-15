/* ===== NEWAR · Argentina (mapa bicontinental) =====
   Pestaña «Argentina»: las 24 jurisdicciones, las islas del Atlántico Sur y el Sector Antártico Argentino en un solo
   mapa, que se puede pintar por población, densidad, superficie y representación en el Congreso de la Nación.
   Datos: data/geo_argentina.json (límites del IGN, ver scripts/preparar_mapa_argentina.py) y data/provincias_ar.json
   (población: Censo 2022 definitivo del INDEC; bancas: composición legal del Congreso). Para Salta se suman las
   personas de data/politicians.json. Lo que no se pudo verificar NO se completa: figura como «sin dato verificado».
   Se carga como judicial.js: no toca el resto de index.html. */
(()=>{
const CSS=`
.ar-grid{display:grid;gap:1rem;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);align-items:start}.ar-col{min-width:0}
.ar-side{position:sticky;top:.75rem;background:var(--raised);border:1px solid var(--line);border-radius:12px;padding:1rem;max-height:calc(100vh - 1.5rem);overflow:auto;box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 28px -14px rgba(0,0,0,.25)}
.ar-w{position:relative;margin:.75rem 0}
.ag{display:block;width:100%;height:min(86vh,1150px);background:var(--paper);border:1px solid var(--line);border-radius:12px;cursor:grab;touch-action:none;user-select:none}.ag:active{cursor:grabbing}
.apg path{stroke:color-mix(in srgb,var(--ink) 38%,transparent);stroke-width:.9px;vector-effect:non-scaling-stroke;cursor:pointer;transition:filter .12s}.apg:hover path{filter:brightness(1.2)}
.apg:focus{outline:none}.apg:focus-visible path,.apg.on path{stroke:var(--ink);stroke-width:2.6px}
.apin{fill:var(--clay);stroke:var(--ink);stroke-width:1.4px;vector-effect:non-scaling-stroke;cursor:pointer}
#arl text{fill:var(--ink);paint-order:stroke;stroke:var(--paper);stroke-linejoin:round;text-anchor:middle;pointer-events:none;font-weight:600}
#arl .v{font-weight:500;font-size:.88em}#arl.lo text.m .v{display:none}#arl .e{font-style:italic;font-weight:500;font-size:.8em;fill:var(--soft)}
.agd{fill:none;stroke:var(--soft);stroke-width:1px;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.8}
.ar-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.6rem,1fr));gap:.5rem;margin:.6rem 0}
.ar-c{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:.55rem .7rem}.ar-c b{display:block;font-size:1.25rem;font-variant-numeric:tabular-nums;line-height:1.2}.ar-c span{display:block;font-size:.76rem;color:var(--soft);margin-top:.15rem}
.ar-leg{display:flex;flex-wrap:wrap;gap:.35rem .9rem;font-size:.78rem;margin:.4rem 0}.ar-leg i{display:inline-block;width:.9rem;height:.9rem;border-radius:3px;vertical-align:-.15rem;margin-right:.3rem;border:1px solid var(--line)}
.ar-box{border:1px solid var(--line);border-radius:10px;padding:.7rem .9rem;margin:.8rem 0;background:var(--paper);font-size:.86rem;line-height:1.5}.ar-box h4{margin:0 0 .35rem;font-size:.82rem;letter-spacing:.04em;text-transform:uppercase;color:var(--soft)}
.ar-grid.fs{position:fixed;inset:0;z-index:60;background:var(--paper);padding:.7rem;height:100vh;height:100dvh;overflow:hidden}.ar-grid.fs .ar-col{overflow:auto;height:100%}.ar-grid.fs .ar-side{position:static;max-height:100%;height:100%}.ar-grid.fs .ag{height:calc(100dvh - 13rem)}
html:has(.ar-grid.fs){overflow:hidden}
.ar-grid .rr{grid-template-columns:11rem 1fr 6.5rem}
@media(max-width:860px){.ar-grid{grid-template-columns:1fr}.ar-side{position:static;max-height:none}.ar-grid .rr{grid-template-columns:8rem 1fr 5rem}.ag{height:min(78vh,900px)}.ar-grid.fs{grid-template-columns:1fr;grid-template-rows:minmax(0,3fr) minmax(0,2fr)}}
@media print{.ar-w .mz,.ar-ctl{display:none}.ar-side{position:static;max-height:none}.ag{height:auto;max-height:none}}
`;
if(!document.getElementById('ar-css')){const s=document.createElement('style');s.id='ar-css';s.textContent=CSS;document.head.appendChild(s)}

const AR={col:'pob',sel:'',vals:true,vb:null,fs:false,fit:'',q:''};
let G=null,P=null,LD=false,ROWS=[],CLS={};
const NF=(v,d)=>v==null||isNaN(v)?'s/d':v.toLocaleString('es-AR',{maximumFractionDigits:d==null?0:d});
const COMP=(v,d)=>{if(v==null||isNaN(v))return '';const a=Math.abs(v);if(a>=1e6)return NF(v/1e6,1)+' M';if(a>=1e4)return NF(Math.round(v/1e3))+' mil';return NF(v,d)};
const MENOR=['tucuman','catamarca','la-rioja','san-juan','san-luis','entre-rios','misiones','tierra-del-fuego'];/* con el mapa entero no entra el valor: aparece al acercar */
const CORTO={'caba':'CABA','tierra-del-fuego':'T. del Fuego','santiago-del-estero':'Sgo. del Estero','buenos-aires':'Buenos Aires'};
const IND=[
 {k:'pob',t:'Población 2022',u:'hab.',g:'Población (INDEC, Censo 2022)',f:r=>r.pob,d:0},
 {k:'pct',t:'Peso en la población del país',u:'%',g:'Población (INDEC, Censo 2022)',f:r=>r.pct,d:1},
 {k:'dens',t:'Densidad (parte americana)',u:'hab/km²',g:'Población (INDEC, Censo 2022)',f:r=>r.dens,d:1},
 {k:'sup',t:'Superficie (parte americana)',u:'km²',g:'Territorio',f:r=>r.sup,d:0},
 {k:'dip',t:'Diputados nacionales',u:'bancas',g:'Congreso de la Nación',f:r=>r.dip,d:0},
 {k:'hdip',t:'Habitantes por diputado nacional',u:'hab.',g:'Congreso de la Nación',f:r=>r.hdip,d:0},
 {k:'hsen',t:'Habitantes por senador nacional',u:'hab.',g:'Congreso de la Nación',f:r=>r.hsen,d:0},
 {k:'rep',t:'Bancas de Diputados respecto del peso poblacional (1 = proporcional)',u:'veces',g:'Congreso de la Nación',f:r=>r.rep,d:2}
];
const ind=()=>IND.find(i=>i.k===AR.col)||IND[0];
const PCT=[22,38,54,72,92];
const fillOf=r=>{const c=CLS[r.k];return c==null?'var(--line)':`color-mix(in srgb, var(--clay) ${PCT[c]}%, var(--raised))`};

function build(){
 const tot=P.total_censado,D=P.congreso.diputados,Sn=P.congreso.senadores;
 ROWS=Object.keys(G.provincias).map(k=>{
  const g=G.provincias[k],p=P.provincias[k]||{},sp=g.superficie_km2||{};
  const sup=(sp.continental||0)+(sp.isla_grande||0),pob=p.poblacion;
  const pct=pob==null?null:pob/tot*100,pd=p.diputados==null?null:p.diputados/D*100;
  return{k,nombre:g.nombre,corto:CORTO[k]||g.nombre,capital:g.capital,indec:g.indec,pob,pct,sup,
   dens:pob==null||!sup?null:pob/sup,dip:p.diputados,sen:p.senadores,
   hdip:pob==null||!p.diputados?null:pob/p.diputados,hsen:pob==null||!p.senadores?null:pob/p.senadores,
   pdip:pd,psen:p.senadores==null?null:p.senadores/Sn*100,rep:pd==null||!pct?null:pd/pct,
   ej:p.ejecutivo||null,g,sp}});
}
function classes(){
 const f=ind().f,v=ROWS.map(r=>[r.k,f(r)]).filter(x=>x[1]!=null).sort((a,b)=>a[1]-b[1]);
 CLS={};const n=v.length;v.forEach(([k],i)=>{CLS[k]=Math.min(4,Math.floor(i*5/n))});
 return[0,1,2,3,4].map(c=>{const xs=v.filter(([k])=>CLS[k]===c).map(x=>x[1]);return xs.length?[Math.min(...xs),Math.max(...xs)]:null});
}
const fv=(v,i)=>v==null?'s/d':NF(v,i.d)+(i.u==='%'?' %':'')+(i.u&&i.u!=='%'&&i.u!=='veces'?' '+i.u:'')+(i.u==='veces'?' ×':'');
const cur=()=>AR.vb||G.viewBox;
/* encuadre de una provincia: caja de sus trazados (en Tierra del Fuego, solo la isla grande) con margen y un tope de 12 aumentos */
const bbox=r=>{const ps=r.k==='tierra-del-fuego'?r.g.partes.filter(p=>p.k==='isla_grande'):r.g.partes;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 ps.forEach(p=>{const n=p.d.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=0;i+1<n.length;i+=2){x0=Math.min(x0,n[i]);x1=Math.max(x1,n[i]);y0=Math.min(y0,n[i+1]);y1=Math.max(y1,n[i+1])}});return[x0,y0,x1,y1]};
const fit=r=>{const B=G.viewBox,[x0,y0,x1,y1]=bbox(r),ar=B[2]/B[3];let w=Math.max(x1-x0,1)*1.6,h=Math.max(y1-y0,1)*1.6;if(w/h<ar)w=h*ar;w=Math.max(w,B[2]/12);h=w/ar;
 if(w>=B[2])return null;const cx=(x0+x1)/2,cy=(y0+y1)/2;return[Math.min(Math.max(B[0],cx-w/2),B[0]+B[2]-w),Math.min(Math.max(B[1],cy-h/2),B[1]+B[3]-h),w,h]};
const svgEl=()=>document.querySelector('svg.ag');

function paths(){
 const out=[];const sel=ROWS.find(r=>r.k===AR.sel);
 const one=r=>`<g class="apg${r.k===AR.sel?' on':''}" data-ak="${r.k}" role="button" tabindex="0" aria-pressed="${r.k===AR.sel}" aria-label="${esc(r.nombre)}: ${esc(fv(ind().f(r),ind()))}">${r.g.partes.map(pt=>`<path d="${pt.d}" style="fill:${fillOf(r)}"/>`).join('')}</g>`;
 ROWS.forEach(r=>{if(r!==sel)out.push(one(r))});if(sel)out.push(one(sel));
 return out.join('');
}
function labels(){
 const i=ind(),t=[];
 ROWS.forEach(r=>{if(!r.g.c)return;const[x,y]=r.g.c;
  if(r.k==='caba'){t.push(`<circle class="apin" data-ak="caba" cx="${x}" cy="${y}" r="5"/><text x="${x+8}" y="${y-8}" style="text-anchor:start">CABA</text>`);return}
  t.push(`<text${MENOR.includes(r.k)?' class="m"':''} x="${x}" y="${y}">${esc(r.corto)}${AR.vals?`<tspan class="v" x="${x}" dy="1.15em">${esc(COMP(i.f(r),i.d))}</tspan>`:''}</text>`)});
 (G.etiquetas||[]).forEach(e=>t.push(`<text class="e" x="${e.c[0]}" y="${e.c[1]+(e.dy||0)}">${esc(e.t)}</text>`));
 return t.join('');
}
function guia(){const g=G.guia;if(!g)return '';return`<path class="agd" d="${g.arco60}"/><path class="agd" d="${g.lado_o}"/><path class="agd" d="${g.lado_e}"/>`}

function apply(){
 const sv=svgEl();if(!sv)return;const v=cur();
 sv.setAttribute('viewBox',v.map(n=>Math.round(n*10)/10).join(' '));
 const r=sv.getBoundingClientRect(),s=Math.min(r.width/v[2],r.height/v[3])||1,u=1/s;
 const L=sv.querySelector('#arl');if(L){L.style.fontSize=(11*u)+'px';L.style.strokeWidth=(3.4*u)+'px';L.classList.toggle('lo',G.viewBox[2]/v[2]<1.7)}
 sv.querySelectorAll('.apin').forEach(c=>c.setAttribute('r',(5*u).toFixed(2)));
}
window.argZoom=(f,cx,cy)=>{if(!G)return;const B=G.viewBox,v=cur().slice(),w=Math.min(B[2],Math.max(B[2]/25,v[2]*f)),h=w*B[3]/B[2];
 if(cx==null){cx=v[0]+v[2]/2;cy=v[1]+v[3]/2}
 const rx=(cx-v[0])/v[2],ry=(cy-v[1])/v[3];v[2]=w;v[3]=h;
 v[0]=Math.min(Math.max(B[0],cx-rx*w),B[0]+B[2]-w);v[1]=Math.min(Math.max(B[1],cy-ry*h),B[1]+B[3]-h);
 AR.vb=w>=B[2]-0.5?null:v;apply()};
window.argReset=()=>{AR.vb=null;apply()};
window.argFS=()=>{AR.fs=!AR.fs;const g=document.querySelector('.ar-grid');if(g)g.classList.toggle('fs',AR.fs);setTimeout(apply,30)};
const nrm=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
window.argQ=v=>{AR.q=v;const q=nrm(v.trim());document.querySelectorAll('.ar-grid .rr').forEach(b=>{b.hidden=!!q&&!nrm(b.textContent).includes(q)})};
window.argCfg=(k,v)=>{AR[k]=v;paint()};
window.argSel=k=>{AR.sel=AR.sel===k?'':k;AR.vb=null;AR.fit=AR.sel;try{history.replaceState(null,'','#/argentina'+(AR.sel?'/'+AR.sel:''))}catch(e){}
 paint();if(AR.sel&&window.innerWidth<=860&&!AR.fs){const a=document.getElementById('arside');if(a&&a.scrollIntoView)a.scrollIntoView({behavior:'smooth',block:'start'})}};
window.argCSV=()=>{if(typeof bajarCSV!=='function')return;const i=ind();
 bajarCSV('argentina-provincias-censo2022.csv',[['Jurisdicción','Código INDEC','Capital','Población 2022','% del país','Superficie parte americana (km², calculada)','Densidad (hab/km²)','Diputados nacionales','Senadores nacionales','Habitantes por diputado','Bancas de Diputados / peso poblacional'],
  ...ROWS.slice().sort((a,b)=>(b.pob||0)-(a.pob||0)).map(r=>[r.nombre,r.indec,r.capital,r.pob,r.pct==null?'':r.pct.toFixed(2),r.sup,r.dens==null?'':r.dens.toFixed(1),r.dip,r.sen,r.hdip==null?'':Math.round(r.hdip),r.rep==null?'':r.rep.toFixed(2)]),
  ['Fuente: '+P.fuente_poblacion]])};

function salta(){
 const L=(typeof S!=='undefined'&&S.pol||[]).filter(p=>p.vigencia==='vigente');
 const li=p=>`<a href="#/persona/${encodeURIComponent(p.id)}">${esc(p.name)}</a>`;
 const gob=L.filter(p=>/^Gobernador de Salta/.test(p.role||p.cargo||'')),vic=L.filter(p=>/^Vicegobernador de Salta/.test(p.role||p.cargo||''));
 const sn=L.filter(p=>p.chamber==='Senado de la Nación'),dn=L.filter(p=>p.chamber==='Diputados de la Nación');
 return`<h4 class="sh">Gobierno y representantes de Salta</h4><p class="meta">${gob.length?'Gobernador: '+gob.map(li).join(', '):'Gobernador: sin dato'}${gob[0]&&gob[0].source_url?` · <a href="${esc(safe(gob[0].source_url))}" rel="noopener noreferrer">fuente</a>`:''}</p>
 <p class="meta">${vic.length?'Vicegobernador: '+vic.map(li).join(', '):'Vicegobernador: sin dato'}</p>
 <p class="meta">Senadores nacionales (${sn.length}): ${sn.map(li).join(', ')||'sin dato'}</p>
 <p class="meta">Diputados nacionales (${dn.length}): ${dn.map(li).join(', ')||'sin dato'}</p>
 <p class="meta"><a href="#/mapa">Ver el mapa de los 23 departamentos de Salta →</a> · <a href="#/hemiciclo">Hemiciclo</a></p>`;
}
function ejecutivo(r){
 const e=r.ej;
 if(e&&(e.gobernador||e.vicegobernador))return`<h4 class="sh">Gobierno provincial</h4><p class="meta">Gobernador/a: ${esc(e.gobernador||'sin dato')}${e.partido?' · '+esc(e.partido):''}</p><p class="meta">Vicegobernador/a: ${esc(e.vicegobernador||'sin dato')}${e.mandato_hasta?' · mandato hasta '+esc(e.mandato_hasta):''}</p>${e.fuente?`<p class="meta">Fuente: <a href="${esc(safe(e.fuente))}" rel="noopener noreferrer">enlace</a>${e.verificado?'':' · <b>sin verificar</b>'}</p>`:''}`;
 return`<h4 class="sh">Gobierno provincial</h4><p class="empty">Sin dato verificado todavía. No se carga nada de memoria: se completa en <code>data/provincias_ar.json</code> (campo <code>ejecutivo</code>) cuando hay fuente oficial.</p>`;
}
function detalle(r){
 const i=ind();
 const sub=r.k==='tierra-del-fuego'?`<div class="ar-box"><h4>Antártida e islas del Atlántico Sur</h4>Esta jurisdicción incluye la isla grande de Tierra del Fuego, las islas del Atlántico Sur y el Sector Antártico Argentino. La población censada vive en la isla grande, por eso la densidad se calcula solo sobre su superficie (${NF(r.sup)} km², sobre los contornos del IGN).</div>`:'';
 return`<p class="meta"><a href="#" onclick="argSel('${r.k}');return false">← Volver al país</a></p><h3 class="sh">${esc(r.nombre)}</h3>
 <p class="meta">Capital: ${esc(r.capital)} · Código INDEC ${esc(r.indec)}</p>
 <div class="ar-k"><div class="ar-c"><b>${NF(r.pob)}</b><span>habitantes (Censo 2022)</span></div><div class="ar-c"><b>${NF(r.pct,1)} %</b><span>de la población del país</span></div><div class="ar-c"><b>${NF(r.sup)} km²</b><span>superficie, parte americana (calculada)</span></div><div class="ar-c"><b>${NF(r.dens,1)}</b><span>hab/km²</span></div></div>
 <h4 class="sh">Representación en el Congreso de la Nación</h4>
 <div class="ar-k"><div class="ar-c"><b>${NF(r.dip)}</b><span>diputados nacionales (de ${NF(P.congreso.diputados)})</span></div><div class="ar-c"><b>${NF(r.sen)}</b><span>senadores nacionales (de ${NF(P.congreso.senadores)})</span></div><div class="ar-c"><b>${NF(r.hdip)}</b><span>habitantes por diputado</span></div><div class="ar-c"><b>${NF(r.rep,2)} ×</b><span>bancas de Diputados respecto de su peso poblacional</span></div></div>
 <p class="note"><b>Puesto ${NF(ROWS.filter(x=>i.f(x)!=null&&i.f(x)>i.f(r)).length+1)} de ${NF(ROWS.filter(x=>i.f(x)!=null).length)}</b> en «${esc(i.t)}» (${esc(fv(i.f(r),i))}). ${NF(r.pct,1)} % de la población y ${NF(r.pdip,1)} % de las bancas de Diputados; ${NF(r.psen,1)} % de los escaños del Senado. Es la composición legal, no un resultado electoral. Ver «Voz y peso» para el caso de Salta en la prensa.</p>
 ${r.k==='salta'?salta():ejecutivo(r)}${sub}`;
}
function general(){
 return`<h3 class="sh">Argentina en cifras</h3><div class="ar-k"><div class="ar-c"><b>${NF(P.total_censado)}</b><span>personas censadas en 2022 (INDEC, definitivo)</span></div><div class="ar-c"><b>24</b><span>jurisdicciones: 23 provincias y la Ciudad Autónoma de Buenos Aires</span></div><div class="ar-c"><b>${NF(P.congreso.diputados)}</b><span>diputados nacionales</span></div><div class="ar-c"><b>${NF(P.congreso.senadores)}</b><span>senadores nacionales (3 por jurisdicción)</span></div></div>
 <p class="note">Tocá una provincia del mapa o de la lista para ver su detalle. Cambiá el indicador arriba para pintar el mapa con otro dato.</p>
 <div class="ar-box"><h4>Cómo leer el mapa bicontinental</h4>Muestra en un solo mapa la Argentina americana, las islas del Atlántico Sur y el Sector Antártico Argentino (al sur del paralelo 60° S, entre los meridianos 25° y 74° al oeste de Greenwich). El sector antártico va en un recuadro, a la mitad de la escala del resto, con su propia proyección; las líneas punteadas marcan su perímetro.</div>
 <div class="ar-box"><h4>Soberanía</h4>Las islas Malvinas, Georgias del Sur y Sandwich del Sur están en disputa de soberanía: la Argentina las reclama (Disposición Transitoria Primera de la Constitución Nacional) y hoy las administra el Reino Unido. En el Sector Antártico rige el Tratado Antártico (en vigor desde 1961), cuyo artículo IV congela las reclamaciones de soberanía mientras el tratado esté vigente.</div>`;
}
function paint(){
 const el=document.getElementById('arapp');if(!el)return;
 if(G===null||P===null){el.innerHTML='<p class="empty" role="status">Cargando el mapa…</p>';return}
 if(!G||!P){el.innerHTML='<p class="warn" role="alert">No se pudieron cargar <code>data/geo_argentina.json</code> o <code>data/provincias_ar.json</code>. Probá recargar la página.</p>';return}
 if(!ROWS.length)build();
 const i=ind(),rg=classes(),sel=ROWS.find(r=>r.k===AR.sel);
 if(AR.fit&&sel){AR.vb=fit(sel);AR.fit=''}else AR.fit='';
 const groups={};IND.forEach(x=>{(groups[x.g]=groups[x.g]||[]).push(x)});
 const opts=Object.entries(groups).map(([g,xs])=>`<optgroup label="${esc(g)}">${xs.map(x=>`<option value="${x.k}"${x.k===AR.col?' selected':''}>${esc(x.t)}</option>`).join('')}</optgroup>`).join('');
 const rank=ROWS.filter(r=>i.f(r)!=null).sort((a,b)=>i.f(b)-i.f(a));const mx=Math.max(...rank.map(r=>i.f(r)),1);
 const vb=cur();
 el.innerHTML=`<div class="ar-grid${AR.fs?' fs':''}"><div class="ar-col">
 <div class="ctl ar-ctl"><select aria-label="Pintar el mapa por" onchange="argCfg('col',this.value)">${opts}</select><label class="chk"><input type="checkbox"${AR.vals?' checked':''} onchange="argCfg('vals',this.checked)"> Mostrar valores en el mapa</label><input type="search" id="arq" placeholder="Buscar provincia…" aria-label="Buscar provincia en la lista" value="${esc(AR.q)}" oninput="argQ(this.value)" style="max-width:12rem"><button type="button" onclick="argCSV()">Descargar CSV</button><button type="button" onclick="window.print()">Imprimir / PDF</button></div>
 <div class="ar-leg" aria-label="Escala de colores">${rg.map((x,c)=>x?`<span><i style="background:color-mix(in srgb, var(--clay) ${PCT[c]}%, var(--raised))"></i>${esc(NF(x[0],i.d))}–${esc(NF(x[1],i.d))}</span>`:'').join('')}<span><i style="background:var(--line)"></i>sin dato</span></div>
 <div class="ar-w"><div class="mz"><button type="button" onclick="argZoom(0.7)" aria-label="Acercar">+</button><button type="button" onclick="argZoom(1.4)" aria-label="Alejar">−</button><button type="button" onclick="argReset()" aria-label="Ver todo el país">⌂</button><button type="button" onclick="argFS()" aria-label="Pantalla completa del mapa (Esc para salir)" title="Pantalla completa">⤢</button></div>
 <svg class="ag" viewBox="${vb.map(n=>Math.round(n*10)/10).join(' ')}" role="group" aria-label="Mapa bicontinental de la República Argentina. La lista de abajo tiene los mismos datos en texto.">${guia()}${paths()}<g id="arl">${labels()}</g></svg></div>
 <p class="note">Arrastrá para mover. Acercá con la rueda del mouse, el pellizco o los botones + / −; ⤢ para pantalla completa. Tocá una provincia, o llegá con Tab y Enter, para ver su detalle. Color por cuartiles: ${esc(i.t)}. ${esc(G.nota)}</p>
 <h3 class="sh">${esc(i.t)}: ranking</h3><div class="rk">${rank.map(r=>`<button type="button" class="rr${r.k===AR.sel?' on':''}" data-ak="${r.k}" aria-pressed="${r.k===AR.sel}"><span class="nm">${esc(r.corto)}</span><span class="rb"><i style="width:${Math.max(1,i.f(r)/mx*100).toFixed(1)}%"></i></span><span class="meta">${esc(fv(i.f(r),i))}</span></button>`).join('')}</div>
 <p class="note">Población: ${esc(P.fuente_poblacion)} Congreso: ${esc(P.congreso.fuente)} Superficies: calculadas sobre los contornos del IGN, pueden diferir de las cifras oficiales.</p>
 </div><aside class="ar-side" id="arside" aria-live="polite">${sel?detalle(sel):general()}</aside></div>`;
 apply();if(AR.q)argQ(AR.q);
}

/* ---- interacción: arrastrar, rueda, pellizco, teclado ---- */
if(!window.__arIn){window.__arIn=1;
 const PT=new Map();let d=null,mov=false,pd=0;
 const pt=(sv,x,y)=>{const p=sv.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(sv.getScreenCTM().inverse());return[q.x,q.y]};
 document.addEventListener('pointerdown',e=>{const sv=e.target.closest&&e.target.closest('svg.ag');if(!sv)return;PT.set(e.pointerId,[e.clientX,e.clientY]);
  if(PT.size===2){const a=[...PT.values()];pd=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);d=null;return}
  d={x:e.clientX,y:e.clientY,v:cur().slice(),s:sv.getScreenCTM().a};mov=false});
 document.addEventListener('pointermove',e=>{if(!PT.has(e.pointerId))return;PT.set(e.pointerId,[e.clientX,e.clientY]);const sv=svgEl();if(!sv||!G)return;
  if(PT.size===2){const a=[...PT.values()],nd=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pd>0&&nd>0){const c=pt(sv,(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2);argZoom(pd/nd,c[0],c[1])}pd=nd;mov=true;return}
  if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!mov&&Math.hypot(dx,dy)<5)return;mov=true;
  const B=G.viewBox;if(!AR.vb&&d.v[2]>=B[2]-0.5)return;
  const x=Math.min(Math.max(B[0],d.v[0]-dx/d.s),B[0]+B[2]-d.v[2]),y=Math.min(Math.max(B[1],d.v[1]-dy/d.s),B[1]+B[3]-d.v[3]);AR.vb=[x,y,d.v[2],d.v[3]];apply()});
 const up=e=>{PT.delete(e.pointerId);if(PT.size<2)pd=0;if(!PT.size)d=null};document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
 document.addEventListener('click',e=>{const q=e.target.closest&&e.target.closest('[data-ak]');if(!q||!q.closest('#arapp'))return;if(mov){mov=false;e.preventDefault();return}argSel(q.dataset.ak)});
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('g.apg')){e.preventDefault();argSel(e.target.dataset.ak)}else if(e.key==='Escape'&&AR.fs)argFS()});
 document.addEventListener('wheel',e=>{const sv=e.target.closest&&e.target.closest('svg.ag');if(!sv||!G)return;e.preventDefault();const c=pt(sv,e.clientX,e.clientY);argZoom(Math.min(1.4,Math.max(0.7,Math.exp(e.deltaY*0.0022))),c[0],c[1])},{passive:false});
 window.addEventListener('resize',()=>{if(G)apply()});
}

V.argentina=id=>{
 if(id&&id!==AR.sel&&((P&&P.provincias&&P.provincias[id])||!P)){AR.sel=id;AR.fit=id}
 if(!LD){LD=true;Promise.all([J('geo_argentina',undefined,true),J('provincias_ar',undefined,true)]).then(([g,p])=>{G=g&&g.provincias?g:false;P=p&&p.provincias?p:false;paint()})}
 setTimeout(paint,0);
 return`<h2 class="sec">Mapa de la Argentina</h2><p class="lede">El mapa bicontinental de la República Argentina con las 23 provincias, la Ciudad Autónoma de Buenos Aires, las islas del Atlántico Sur y el Sector Antártico Argentino. Se pinta con datos del Censo 2022 del INDEC y muestra cuánto pesa cada provincia en el Congreso de la Nación. Para Salta, además, están sus representantes y el mapa de departamentos.</p><div id="arapp"><p class="empty" role="status">Cargando el mapa…</p></div>`;
};
NEEDS.argentina=['pol'];
if(!TABS.some(t=>t[0]==='argentina')){const i=TABS.findIndex(t=>t[0]==='mapa');TABS.splice(i<0?TABS.length:i+1,0,['argentina','Argentina'])}

/* si el primer render ya corrió antes de que cargara este módulo, se repite para que aparezca la pestaña */
setTimeout(()=>{const t=document.getElementById('tabs');if(typeof route==='function'&&t&&t.children.length&&!t.querySelector('a[href="#/argentina"]'))route()},0);
})();
