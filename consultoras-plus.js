/* ===== NEWAR · Consultoras PLUS =====
   Suma a la pestaña «Consultoras» (newar-consultoras.js) tres bloques, sin tocar lo que ya existe:
   1) «Macro del mundo»: indicadores del FMI (World Economic Outlook) de Argentina y +40 países, con comparación y evolución.
      Datos: data/macro_mundo.json (lo arma scripts/macro.py desde la API pública del FMI).
   2) «Qué tan al día está cada fuente»: cuántas fuentes tuvieron notas hoy, esta semana o este mes, y qué cifras cargadas están viejas.
   3) «El directorio por región y tipo».
   Todo marca de dónde sale cada dato y cuándo se actualizó. Se carga desde newar-consultoras.js (no hace falta tocar index.html). */
(()=>{
if(window.NewarConsultorasPlus)return;
const DAY=864e5,esc2=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(n,d)=>Number(n).toLocaleString('es-AR',{maximumFractionDigits:d==null?1:d});
const cut=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+'…':s};
const S2={ind:'NGDP_RPCH',anio:0,reg:''};
let M=null,F=null,N=null,CARGADO=false;
const CSS=`#ncp .tb{display:flex;flex-wrap:wrap;gap:.5rem .9rem;align-items:center;margin:.5rem 0 .8rem}#ncp select{font:inherit;padding:.4rem .6rem;border:1px solid var(--line);background:var(--raised);color:var(--ink);min-height:2.3rem;max-width:100%}
#ncp .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.6rem;margin:.5rem 0 1rem}#ncp .kp>div{border:1px solid var(--line);background:var(--raised);padding:.6rem .8rem}#ncp .kp b{display:block;font-size:1.4rem}#ncp .kp span{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--soft)}
#ncp .cols{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem}@media(max-width:820px){#ncp .cols{grid-template-columns:1fr}}#ncp .cols>div{min-width:0}
#ncp .nota{font-size:.8rem;color:var(--soft);margin:.5rem 0}#ncp table{width:100%;border-collapse:collapse;font-size:.85rem}#ncp td,#ncp th{padding:.35rem .3rem;border-top:1px solid var(--line);text-align:left}#ncp td.n{text-align:right;white-space:nowrap}
#ncs .hmw{overflow-x:auto;max-width:100%}#ncs select,#ncs input{max-width:100%;box-sizing:border-box}#ncs .nci{overflow-wrap:anywhere}#ncp .mal{color:var(--neg)}#ncp .bien{color:var(--pos)}#ncp .vac{border:1px dashed var(--line);padding:1rem;color:var(--soft)}`;
const css=()=>{if(document.getElementById('ncp-css'))return;const s=document.createElement('style');s.id='ncp-css';s.textContent=CSS;document.head.appendChild(s)};
const mediana=a=>{a=a.filter(x=>typeof x==='number').sort((x,y)=>x-y);if(!a.length)return null;const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
const fmtV=(v,u)=>typeof v!=='number'?'s/d':u==='USD'?'USD '+nf(v,0):nf(v,1)+(u==='%'?' %':u==='% PBI'?' % del PBI':'');
function barras(rows,u,hl){const W=640,rh=22,pl=130,pr=70,Hh=rows.length*rh+10,ab=Math.max(1e-9,...rows.map(r=>Math.abs(r.v)));
 const neg=rows.some(r=>r.v<0),z=neg?pl+(W-pl-pr)*.3:pl,sc=(W-pl-pr)*(neg?.7:1)/ab,scn=neg?(z-pl)/ab:0;
 return`<svg class="ch" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Comparación entre países" style="width:100%;height:auto">${rows.map((r,i)=>{const y=5+i*rh,w=Math.abs(r.v)*(r.v<0?scn:sc),x=r.v<0?z-w:z,a=r.id===hl;
  return`<text x="${pl-6}" y="${y+15}" text-anchor="end" font-size="12.5" fill="${a?'var(--clay)':'var(--ink)'}" font-weight="${a?700:400}">${esc2(cut(r.n,18))}</text><rect x="${x}" y="${y+3}" width="${Math.max(1,w)}" height="${rh-8}" fill="${a?'var(--clay)':'var(--indigo)'}"><title>${esc2(r.n)}: ${esc2(fmtV(r.v,u))}</title></rect><text x="${(r.v<0?x-4:x+w+5)}" y="${y+15}" ${r.v<0?'text-anchor="end"':''} font-size="12" fill="var(--soft)">${esc2(nf(r.v,u==='USD'?0:1))}</text>`}).join('')}${neg?`<line x1="${z}" x2="${z}" y1="2" y2="${Hh-2}" stroke="var(--line)"/>`:''}</svg>`}
function lineas(series,anios,anioAct,u){const W=640,Hh=210,pl=44,pr=12,pt=12,pb=26,vals=series.flatMap(s=>anios.map(a=>s.d[a])).filter(v=>typeof v==='number');if(!vals.length)return'';
 let mn=Math.min(0,...vals),mx=Math.max(...vals);if(mx===mn)mx=mn+1;const X=a=>pl+(W-pl-pr)*(anios.indexOf(a))/Math.max(1,anios.length-1),Y=v=>pt+(Hh-pt-pb)*(1-(v-mn)/(mx-mn));
 let g=[0,.5,1].map(f=>{const v=mn+(mx-mn)*f,y=Y(v);return`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl-5}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--soft)">${nf(v,u==='USD'?0:1)}</text>`}).join('');
 anios.forEach((a,i)=>{if(i%2===0)g+=`<text x="${X(a)}" y="${Hh-8}" text-anchor="middle" font-size="11" fill="var(--soft)">${a}</text>`});
 g+=`<line x1="${X(anioAct)||pl}" x2="${X(anioAct)||pl}" y1="${pt}" y2="${Hh-pb}" stroke="var(--soft)" stroke-dasharray="3 3"/><text x="${(X(anioAct)||pl)+4}" y="${pt+10}" font-size="10.5" fill="var(--soft)">proyecciones →</text>`;
 series.forEach(s=>{const pts=anios.filter(a=>typeof s.d[a]==='number');if(pts.length<2)return;const d1=pts.map((a,i)=>(i?'L':'M')+X(a).toFixed(1)+' '+Y(s.d[a]).toFixed(1)).join(' ');
  g+=`<path d="${d1}" fill="none" stroke="${s.c}" stroke-width="${s.w||2}" ${s.dash?'stroke-dasharray="5 4"':''}/>`});
 return`<svg class="ch" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Evolución en el tiempo" style="width:100%;height:auto">${g}</svg><div class="nota">${series.map(s=>`<span style="display:inline-block;width:.8rem;height:.15rem;background:${s.c};margin:0 .3rem 0 .6rem;vertical-align:middle"></span>${esc2(s.l)}`).join('')}</div>`}
function macroHtml(){
 if(!M||!M.valores||!Object.keys(M.valores).length)return`<h2 class="sec">Macro del mundo (FMI)</h2><div class="vac">Todavía no hay datos macro. Se arman solos desde la API pública del FMI cuando corre el workflow «Consultoras, bancos y organismos» (GitHub → Actions → Run workflow).</div>`;
 const IND=M.indicadores||{},P=M.paises||{},ya=M.anio_actual||new Date().getFullYear(),ids=Object.keys(IND).filter(k=>M.valores[k]);
 if(!ids.includes(S2.ind))S2.ind=ids[0];const V=M.valores[S2.ind]||{},u=(IND[S2.ind]||{}).u||'';
 const anios=[...new Set(Object.values(V).flatMap(o=>Object.keys(o)))].map(Number).filter(a=>a>=2015).sort((a,b)=>a-b);
 if(!S2.anio||!anios.includes(S2.anio))S2.anio=anios.includes(ya)?ya:anios[anios.length-1];
 const regs=[...new Set(Object.values(P).map(p=>p.r))];
 const filas=Object.entries(V).filter(([id])=>P[id]&&(!S2.reg||P[id].r===S2.reg||id==='ARG')).map(([id,o])=>({id,n:P[id].n,r:P[id].r,v:o[S2.anio]})).filter(r=>typeof r.v==='number').sort((a,b)=>b.v-a.v);
 const pos=filas.findIndex(r=>r.id==='ARG'),arg=filas[pos],medG=mediana(filas.map(r=>r.v)),medL=mediana(filas.filter(r=>r.r==='Latinoamérica').map(r=>r.v));
 const sArg={l:'Argentina',c:'var(--clay)',w:3,d:(V.ARG||{})},sL={l:'Mediana de Latinoamérica',c:'var(--indigo)',d:{}},sG={l:'Mediana de los países elegidos',c:'var(--soft)',dash:1,d:{}};
 anios.forEach(a=>{sL.d[a]=mediana(Object.entries(V).filter(([id])=>P[id]&&P[id].r==='Latinoamérica'&&id!=='ARG').map(([id,o])=>o[a]));sG.d[a]=mediana(Object.entries(V).filter(([id])=>P[id]&&id!=='ARG'&&(!S2.reg||P[id].r===S2.reg)).map(([id,o])=>o[a]))});
 const proy=S2.anio>=ya;
 return`<h2 class="sec">Macro del mundo</h2><p class="nota">Fuente de este indicador: <b>${esc2((M.fuentes||{})[S2.ind]||'FMI')}</b>. ${esc2(M.fuente||'FMI')} · recolectado ${esc2(new Date(M.generado).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'}))}. ${esc2(M.nota||'')} Son datos de un tercero: abrí la fuente antes de citarlos.</p>
 <div class="tb"><select id="ncpi" aria-label="Indicador">${ids.map(k=>`<option value="${k}"${S2.ind===k?' selected':''}>${esc2(IND[k].t)}</option>`).join('')}</select><select id="ncpa" aria-label="Año">${anios.map(a=>`<option value="${a}"${S2.anio===a?' selected':''}>${a}${a>=ya?' (proyección)':''}</option>`).join('')}</select><select id="ncpr" aria-label="Región"><option value="">Todo el mundo</option>${regs.map(r=>`<option${S2.reg===r?' selected':''}>${esc2(r)}</option>`).join('')}</select></div>
 <div class="kp"><div><b>${arg?esc2(fmtV(arg.v,u)):'s/d'}</b><span>Argentina ${S2.anio}${proy?' (proy.)':''}</span></div><div><b>${arg?`${pos+1} de ${filas.length}`:'—'}</b><span>Puesto (1 = valor más alto)</span></div><div><b>${medL!=null?esc2(fmtV(medL,u)):'s/d'}</b><span>Mediana Latinoamérica</span></div><div><b>${medG!=null?esc2(fmtV(medG,u)):'s/d'}</b><span>Mediana elegida</span></div></div>
 <div class="cols"><div><h3 class="sh">Comparación entre países, ${S2.anio}${proy?' (proyección)':''}</h3>${filas.length?barras(filas.slice(0,28),u,'ARG'):'<div class="vac">Sin datos para esta combinación.</div>'}${filas.length>28?`<p class="nota">Se muestran 28 de ${filas.length}${pos>=28?'. Argentina está más abajo en el ranking: mirá su puesto arriba.':'.'}</p>`:''}</div>
 <div><h3 class="sh">Evolución</h3>${lineas([sG,sL,sArg],anios,ya,u)}<p class="nota">${(M.fuentes||{})[S2.ind]==='Banco Mundial'?'Esta serie viene del Banco Mundial: son datos observados, sin proyecciones.':'La línea punteada vertical marca el año actual: desde ahí son proyecciones del FMI, que se revisan dos veces por año.'} Valores altos no siempre son «mejores» (en inflación o deuda, mayor es peor).</p></div></div>`}
function frescuraHtml(){
 if(!F)return'';const fu=F.fuentes||[],items=(N&&N.items)||[],now=Date.now(),ult={},n7={},n30={};
 items.forEach(x=>{const t=Date.parse(x.published_iso||x.collected_at)||0;if(!t)return;if(!(x.fuente in ult)||t>ult[x.fuente])ult[x.fuente]=t;if(now-t<7*DAY)n7[x.fuente]=(n7[x.fuente]||0)+1;if(now-t<30*DAY)n30[x.fuente]=(n30[x.fuente]||0)+1});
 const c7=fu.filter(f=>n7[f.id]).length,c30=fu.filter(f=>n30[f.id]).length,sin=fu.filter(f=>!n30[f.id]);
 const cif=(F.cifras||[]).map(c=>({c,dias:Math.floor((now-Date.parse(c.fecha))/DAY)})).filter(x=>!isNaN(x.dias)),viejas=cif.filter(x=>x.dias>30).sort((a,b)=>b.dias-a.dias);
 const nom=id=>(fu.find(f=>f.id===id)||{nombre:id}).nombre;
 return`<h2 class="sec">Qué tan al día está cada fuente</h2>${N?`<div class="kp"><div><b>${c7}</b><span>fuentes con notas en 7 días</span></div><div><b>${c30}</b><span>con notas en 30 días</span></div><div><b>${sin.length}</b><span>sin notas en 30 días</span></div><div><b>${viejas.length}</b><span>cifras con más de 30 días</span></div></div>`:'<div class="vac">Todavía no hay notas recolectadas: corré el workflow «Consultoras, bancos y organismos» en Actions.</div>'}
 <div class="cols"><div><h3 class="sh">Cifras cargadas más viejas</h3>${viejas.length?`<table><tbody>${viejas.slice(0,12).map(x=>`<tr><td>${esc2(nom(x.c.fuente))}<div class="nota" style="margin:0">${esc2(cut(((F.indicadores||[]).find(i=>i.id===x.c.ind)||{t:x.c.ind}).t,48))} · ${esc2(x.c.fecha)}</div></td><td class="n mal">${x.dias} días</td></tr>`).join('')}</tbody></table><p class="nota">Cifras cargadas a mano: pasado el mes conviene verificarlas en la fuente. No se actualizan solas.</p>`:'<div class="vac">Todas las cifras cargadas tienen menos de 30 días.</div>'}</div>
 <div><h3 class="sh">Fuentes sin notas en 30 días</h3>${N?(sin.length?`<p class="nota">${sin.slice(0,40).map(f=>esc2(f.nombre)).join(' · ')}${sin.length>40?' · …':''}</p><p class="nota">Que no tengan notas no quiere decir que no publiquen: el recolector sólo encuentra lo que Google Noticias y los RSS propios muestran.</p>`:'<div class="vac">Todas las fuentes tuvieron notas.</div>'):''}</div></div>`}
function regionHtml(){
 if(!F||!(F.fuentes||[]).length)return'';const fu=F.fuentes,R={},T=[...new Set(fu.map(f=>f.tipo))];fu.forEach(f=>{const r=f.region||'Global';(R[r]=R[r]||{})[f.tipo]=(R[r][f.tipo]||0)+1});
 const rs=Object.entries(R).map(([r,o])=>[r,Object.values(o).reduce((a,b)=>a+b,0),o]).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...rs.map(x=>x[1])),W=640,rh=26,pl=120,PAL=['#4E79A7','#F28E2B','#59A14F','#E15759','#B07AA1','#76B7B2','#EDC948','#9C755F','#FF9DA7','#8CD17D','#86BCB6','#BAB0AC','#D37295','#A0CBE8'];
 const svg=`<svg class="ch" viewBox="0 0 ${W} ${rs.length*rh+10}" role="img" aria-label="Fuentes por región y tipo" style="width:100%;height:auto">${rs.map(([r,t,o],i)=>{let x=pl;const y=5+i*rh;return`<text x="${pl-6}" y="${y+16}" text-anchor="end" font-size="12.5" fill="var(--ink)">${esc2(r)}</text>`+T.map((tp,j)=>{const v=o[tp]||0;if(!v)return'';const w=(W-pl-40)*v/mx,rect=`<rect x="${x}" y="${y+2}" width="${w}" height="${rh-8}" fill="${PAL[j%PAL.length]}"><title>${esc2(r)} · ${esc2(tp)}: ${v}</title></rect>`;x+=w;return rect}).join('')+`<text x="${x+5}" y="${y+16}" font-size="12" fill="var(--soft)">${t}</text>`}).join('')}</svg><div class="nota">${T.map((tp,j)=>`<span style="display:inline-block;width:.7rem;height:.7rem;background:${PAL[j%PAL.length]};margin:0 .25rem 0 .6rem;vertical-align:-1px"></span>${esc2(tp)}`).join('')}</div>`;
 return`<h2 class="sec">El directorio por región y tipo</h2><p class="nota">${fu.length} fuentes en ${rs.length} regiones. Más abajo, en «Directorio de fuentes», podés buscarlas y filtrarlas por tipo.</p>${svg}`}
async function carga(){if(CARGADO)return;CARGADO=true;try{[F,N,M]=await Promise.all([leer('consultoras'),leer('consultoras_news'),leer('macro_mundo')])}catch(e){}}
function pinta(){const ncs=document.getElementById('ncs');if(!ncs)return;let c=document.getElementById('ncp');if(!c){const w=ncs.querySelector('.warn,[role=note]');c=document.createElement('div');c.id='ncp';if(w&&w.nextSibling)w.parentNode.insertBefore(c,w.nextSibling);else ncs.insertBefore(c,ncs.firstChild)}
 css();c.innerHTML=macroHtml()+frescuraHtml()+regionHtml()}
let tm=null;const obs=new MutationObserver(()=>{clearTimeout(tm);tm=setTimeout(async()=>{const ncs=document.getElementById('ncs');if(!ncs||document.getElementById('ncp')||!ncs.querySelector('.sec'))return;await carga();pinta()},80)});
const arranca=()=>{const app=document.getElementById('app');if(app)obs.observe(app,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arranca);else arranca();
document.addEventListener('change',e=>{const i=e.target;if(!i||!i.id||!document.getElementById('ncp'))return;if(i.id==='ncpi'){S2.ind=i.value;S2.anio=0}else if(i.id==='ncpa')S2.anio=+i.value;else if(i.id==='ncpr')S2.reg=i.value;else return;const c=document.getElementById('ncp');if(c){const pos=window.scrollY;c.innerHTML=macroHtml()+frescuraHtml()+regionHtml();window.scrollTo(0,pos)}});
window.NewarConsultorasPlus={estado:S2};
})();
