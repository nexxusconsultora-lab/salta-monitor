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
.ag.pnt{cursor:cell}.apg.on2 path{stroke:var(--ink);stroke-width:2.2px;stroke-dasharray:6 4}.ar-leg2{display:flex;flex-wrap:wrap;gap:.4rem .8rem;margin:.4rem 0}.ar-leg2 label{display:flex;align-items:center;gap:.35rem;font-size:.8rem}.ar-leg2 i{width:1rem;height:1rem;border-radius:3px;border:1px solid var(--line);flex:none}.ar-leg2 input{width:11rem;max-width:100%}.ar-cmp{width:100%;border-collapse:collapse;font-size:.82rem;margin:.4rem 0}.ar-cmp th,.ar-cmp td{padding:.3rem .4rem;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}.ar-cmp th:first-child,.ar-cmp td:first-child{text-align:left;color:var(--soft)}.ar-cmp thead th{font-weight:700;color:var(--ink)}
.ag.dib{cursor:crosshair}.ag.bor{cursor:pointer}.ag.dib .apg,.ag.dib .apin,.ag.bor .apg,.ag.bor .apin{pointer-events:none}
.apg path{stroke:color-mix(in srgb,var(--ink) 38%,transparent);stroke-width:.9px;vector-effect:non-scaling-stroke;cursor:pointer;transition:filter .12s}.apg:hover path{filter:brightness(1.2)}
.apg:focus{outline:none}.apg:focus-visible path,.apg.on path{stroke:var(--ink);stroke-width:2.6px}
.apin{fill:var(--clay);stroke:var(--ink);stroke-width:1.4px;vector-effect:non-scaling-stroke;cursor:pointer}
#arl text{fill:var(--ink);paint-order:stroke;stroke:var(--paper);stroke-linejoin:round;text-anchor:middle;pointer-events:none;font-weight:600}
#arl .v{font-weight:500;font-size:.88em}#arl.lo text.m .v{display:none}#arl .e{font-style:italic;font-weight:500;font-size:.8em;fill:var(--soft)}
.agd{fill:none;stroke:var(--soft);stroke-width:1px;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.8}
#ard{pointer-events:none}#ard path{filter:drop-shadow(0 0 1.2px rgba(0,0,0,.55))}.dh{fill:none;stroke:transparent;stroke-width:16px;vector-effect:non-scaling-stroke;pointer-events:none;filter:none!important}
.ag.bor .dh{pointer-events:stroke}.ag.bor .dsh text{pointer-events:all;cursor:pointer}
.ar-tb{display:flex;flex-wrap:wrap;gap:.3rem;align-items:center;margin:.5rem 0 0;padding:.35rem;background:var(--raised);border:1px solid var(--line);border-radius:10px}
.ar-tb button{min-width:2.2rem;height:2.2rem;padding:0 .5rem;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:8px;cursor:pointer;font-weight:600;line-height:1}
.ar-tb button[aria-pressed=true]{background:var(--clay);color:#fff;border-color:var(--clay)}.ar-tb button:disabled{opacity:.35;cursor:default}
.ar-tb .sw{width:1.6rem;min-width:1.6rem;height:1.6rem;border-radius:50%;padding:0}.ar-tb .sw[aria-pressed=true]{outline:2px solid var(--ink);outline-offset:2px;border-color:var(--paper)}
.ar-tb .sep{width:1px;align-self:stretch;background:var(--line);margin:0 .15rem}
.ar-ti{position:absolute;z-index:8;min-width:12rem;padding:.35rem .5rem;border:2px solid var(--clay);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit}
.ar-cap{position:absolute;left:50%;top:.6rem;transform:translateX(-50%);z-index:6;display:flex;gap:.6rem;align-items:center;background:var(--raised);border:1px solid var(--line);border-radius:999px;padding:.3rem .5rem .3rem .9rem;font-weight:600;max-width:90%}.ar-cap button{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:999px;min-width:2rem;height:2rem;cursor:pointer}
.ar-esc{list-style:none;margin:.6rem 0;padding:0;display:grid;gap:.3rem}.ar-esc li{display:flex;gap:.4rem;align-items:center}.ar-esc li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ar-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.6rem,1fr));gap:.5rem;margin:.6rem 0}
.ar-c{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:.55rem .7rem}.ar-c b{display:block;font-size:1.25rem;font-variant-numeric:tabular-nums;line-height:1.2}.ar-c span{display:block;font-size:.76rem;color:var(--soft);margin-top:.15rem}
.ar-leg{display:flex;flex-wrap:wrap;gap:.35rem .9rem;font-size:.78rem;margin:.4rem 0}.ar-leg i{display:inline-block;width:.9rem;height:.9rem;border-radius:3px;vertical-align:-.15rem;margin-right:.3rem;border:1px solid var(--line)}
.ar-box{border:1px solid var(--line);border-radius:10px;padding:.7rem .9rem;margin:.8rem 0;background:var(--paper);font-size:.86rem;line-height:1.5}.ar-box h4{margin:0 0 .35rem;font-size:.82rem;letter-spacing:.04em;text-transform:uppercase;color:var(--soft)}
.ar-only-fs{display:none}
.ar-grid.fs{position:fixed;inset:0;z-index:60;display:block;background:var(--paper);padding:.6rem;height:100vh;height:100dvh;overflow:hidden}
.ar-grid.fs .ar-col{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}.ar-grid.fs .ar-hide{display:none!important}.ar-grid.fs .ar-only-fs{display:inline-block}
.ar-grid.fs .ar-w{flex:1;min-height:0;margin:.4rem 0 0}.ar-grid.fs .ag{height:100%}
.ar-grid.fs .ar-side{position:absolute;z-index:70;right:.6rem;top:.6rem;bottom:.6rem;width:min(26rem,94vw);max-height:none;transform:translateX(calc(100% + 1.5rem));transition:transform .2s}.ar-grid.fs.sd .ar-side{transform:none}
#arapp:fullscreen{background:var(--paper);overflow:auto}html:has(.ar-grid.fs){overflow:hidden}
.ar-grid .rr{grid-template-columns:11rem 1fr 6.5rem}
@media(max-width:860px){.ar-grid.fs .ar-tb{flex-wrap:nowrap;overflow-x:auto}.ar-grid.fs .ar-tb button{flex:none}.ar-grid.fs .ar-leg{flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;margin:.2rem 0}.ar-grid{grid-template-columns:1fr}.ar-side{position:static;max-height:none}.ar-grid .rr{grid-template-columns:8rem 1fr 5rem}.ag{height:min(78vh,900px)}}
@media print{.ar-w .mz,.ar-ctl,.ar-tb{display:none}.ar-side{position:static;max-height:none}.ag{height:auto;max-height:none}}

.ar-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0}
.ar-nav{position:absolute;top:.7rem;right:4.1rem;z-index:4;display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end;max-width:calc(100% - 5rem)}
.ar-nav button,.ar-nav a{display:inline-flex;align-items:center;min-height:2.3rem;padding:0 .8rem;border-radius:999px;border:1px solid var(--glass-b,var(--line));background:var(--glass,var(--raised));color:var(--ink);font:600 .82rem/1 inherit;text-decoration:none;cursor:pointer;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.ar-nav button[aria-pressed=true]{background:linear-gradient(135deg,var(--nx-acc2,#6366f1),var(--nx-acc,#38bdf8));color:#fff;border-color:transparent}
.ar-nav button:focus-visible,.ar-nav a:focus-visible,.ar-w .mz button:focus-visible{outline:2px solid var(--nx-acc,var(--clay));outline-offset:2px}
.ar-hud small{display:block;font-size:.68rem;color:var(--soft);margin-top:.2rem}
.ar-err{padding:.9rem 1.1rem;border:1px solid var(--line);border-left:4px solid var(--neg,#ac2f33);border-radius:12px;background:var(--raised);margin:.6rem 0}.ar-err p{margin:.3rem 0 .6rem;color:var(--soft);font-size:.86rem}.ar-err button{border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:.4rem .9rem;cursor:pointer;font-weight:600}
.ar-skel{height:min(60vh,520px);border-radius:16px;background:linear-gradient(100deg,var(--raised) 30%,color-mix(in srgb,var(--ink) 8%,var(--raised)) 50%,var(--raised) 70%);background-size:200% 100%;animation:arsk 1.4s linear infinite}
@keyframes arsk{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.ar-skel{animation:none}}
.ag .apg.dim path{opacity:.2}.ag .apg.hl path{stroke:var(--ink);stroke-width:2.4px}.ar-grid .rr.hl{background:color-mix(in srgb,var(--ink) 9%,transparent)}
.ar-alt{margin:.8rem 0}.ar-alt summary{cursor:pointer;font-weight:600}.ar-alt table{width:100%;border-collapse:collapse;font-size:.82rem;margin-top:.4rem}.ar-alt caption{text-align:left;color:var(--soft);padding:.3rem 0}.ar-alt th,.ar-alt td{padding:.3rem .4rem;border-bottom:1px solid var(--line);text-align:left}.ar-alt td:nth-child(2),.ar-alt td:nth-child(3){text-align:right;font-variant-numeric:tabular-nums}
.ar-grid.fs .ar-w .mz button,.ar-grid.fs .ar-nav button,.ar-grid.fs .ar-nav a{min-height:2.75rem;min-width:2.75rem}
@media(max-width:860px){.ar-w .mz button{width:2.75rem;height:2.75rem}.ar-nav button,.ar-nav a{min-height:2.75rem}.ar-nav{right:3.9rem}}
.ar-grid.fs:not(.herr) .ar-tb,.ar-grid.fs .ar-leg{display:none}
.ar-grid .ar-tb{z-index:3}
`;
if(!document.getElementById('ar-css')){const s=document.createElement('style');s.id='ar-css';s.textContent=CSS;document.head.appendChild(s)}

const AR={col:'pob',sel:'',vals:true,vb:null,fs:false,sd:false,fit:'',q:'',tool:'mover',pc:'#ff4d4f',pw:4,dib:[],redo:[],cur:null,pres:null,pintado:{},leyenda:{},capa:false,cmp:'',help:false};
let G=null,P=null,LD=false,ROWS=[],CLS={},RK={},ERR={g:false,p:false};
const NF=(v,d)=>v==null||isNaN(v)?'s/d':v.toLocaleString('es-AR',{maximumFractionDigits:d==null?0:d});
const COMP=(v,d)=>{if(v==null||isNaN(v))return '';const a=Math.abs(v);if(a>=1e6)return NF(v/1e6,1)+' M';if(a>=1e4)return NF(Math.round(v/1e3))+' mil';return NF(v,d)};
const MENOR=['tucuman','catamarca','la-rioja','san-juan','san-luis','entre-rios','misiones','tierra-del-fuego'];/* con el mapa entero no entra el valor: aparece al acercar */
const CORTO={'caba':'CABA','tierra-del-fuego':'T. del Fuego','santiago-del-estero':'Sgo. del Estero','buenos-aires':'Buenos Aires'};
const IND=[
 {k:'pob',t:'Población 2022',u:'hab.',g:'Población (INDEC, Censo 2022)',f:r=>r.pob,d:0},
 {k:'pct',t:'Peso en la población del país',u:'%',g:'Población (INDEC, Censo 2022)',f:r=>r.pct,d:1},
 {k:'dens',t:'Densidad (hab/km², superficie del IGN)',u:'hab/km²',g:'Población (INDEC, Censo 2022)',f:r=>r.dens,d:1},
 {k:'sup',t:'Superficie (IGN)',u:'km²',g:'Territorio',f:r=>r.sup,d:0},
 {k:'dip',t:'Diputados nacionales',u:'bancas',g:'Congreso de la Nación',f:r=>r.dip,d:0},
 {k:'hdip',t:'Habitantes por diputado nacional',u:'hab.',g:'Congreso de la Nación',f:r=>r.hdip,d:0},
 {k:'hsen',t:'Habitantes por senador nacional',u:'hab.',g:'Congreso de la Nación',f:r=>r.hsen,d:0},
 {k:'rep',t:'Bancas de Diputados respecto del peso poblacional (1 = proporcional)',u:'veces',g:'Congreso de la Nación',f:r=>r.rep,d:2},
 {k:'dsim',t:'Diputados si el reparto fuera proporcional a la población',u:'bancas',g:'Simulaciones (no son propuestas)',f:r=>r.dsim,d:0},
 {k:'ddif',t:'Bancas actuales menos las proporcionales',u:'bancas',g:'Simulaciones (no son propuestas)',f:r=>r.ddif,d:0}
];
const ind=()=>IND.find(i=>i.k===AR.col)||IND[0];
const PCT=[22,38,54,72,92];
const fillOf=r=>{if(AR.capa)return AR.pintado[r.k]||'var(--line)';const c=CLS[r.k];return c==null?'var(--line)':`var(--r${c})`};

function build(){
 const tot=P.total_censado,D=P.congreso.diputados,Sn=P.congreso.senadores;
 ROWS=[...new Set([...Object.keys(G.provincias),...Object.keys(P.provincias)])].map(k=>{
  const g=Object.assign({nombre:k.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase()),partes:[]},G.provincias[k]),p=P.provincias[k]||{},sp=g.superficie_km2||{};
  if(g.partes&&g.partes.length&&!(Array.isArray(g.c)&&g.c.length===2)){const bb=bbox({k,sinGeo:false,g});if(bb)g.c=[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2]}
  const sup=p.superficie_oficial_km2||((sp.continental||0)+(sp.isla_grande||0)),pob=p.poblacion;
  const pct=pob==null?null:pob/tot*100,pd=p.diputados==null?null:p.diputados/D*100;
  return{k,sinGeo:!(g.partes&&g.partes.length),nombre:g.nombre,corto:CORTO[k]||g.nombre,capital:g.capital,indec:g.indec,pob,pct,sup,
   dens:pob==null||!sup?null:pob/sup,dip:p.diputados,sen:p.senadores,
   hdip:pob==null||!p.diputados?null:pob/p.diputados,hsen:pob==null||!p.senadores?null:pob/p.senadores,
   pdip:pd,psen:p.senadores==null?null:p.senadores/Sn*100,rep:pd==null||!pct?null:pd/pct,
   ej:p.ejecutivo||null,g,sp}});
 /* simulación: 257 bancas repartidas en proporción a la población censada, por el método del resto mayor y sin mínimo por provincia */
 const q=ROWS.filter(r=>r.pob!=null).map(r=>({r,q:r.pob/tot*D}));let base=0;q.forEach(o=>{o.n=Math.floor(o.q);base+=o.n});
 q.slice().sort((a,b)=>(b.q-b.n)-(a.q-a.n)).slice(0,D-base).forEach(o=>o.n++);q.forEach(o=>{o.r.dsim=o.n;o.r.ddif=o.r.dip==null?null:o.r.dip-o.n});
}
function classes(){
 const f=ind().f,v=ROWS.map(r=>[r.k,f(r)]).filter(x=>x[1]!=null).sort((a,b)=>a[1]-b[1]);
 CLS={};RK={};const n=v.length;v.forEach(([k],i)=>{CLS[k]=Math.min(4,Math.floor(i*5/n));RK[k]=n-i});
 return[0,1,2,3,4].map(c=>{const xs=v.filter(([k])=>CLS[k]===c).map(x=>x[1]);return xs.length?[Math.min(...xs),Math.max(...xs)]:null});
}
const sg=(v,i)=>i.k==='ddif'&&v>0?'+':'';
const fv=(v,i)=>v==null?'s/d':sg(v,i)+NF(v,i.d)+(i.u==='%'?' %':'')+(i.u&&i.u!=='%'&&i.u!=='veces'?' '+i.u:'')+(i.u==='veces'?' ×':'');
const cur=()=>AR.vb||G.viewBox;
/* encuadre de una provincia: caja de sus trazados (en Tierra del Fuego, solo la isla grande) con margen y un tope de 12 aumentos */
const bbox=r=>{if(r.sinGeo)return null;const ps=r.k==='tierra-del-fuego'?r.g.partes.filter(p=>p.k==='isla_grande'):r.g.partes;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 ps.forEach(p=>{const n=p.d.match(/-?\d+(?:\.\d+)?/g).map(Number);for(let i=0;i+1<n.length;i+=2){x0=Math.min(x0,n[i]);x1=Math.max(x1,n[i]);y0=Math.min(y0,n[i+1]);y1=Math.max(y1,n[i+1])}});return[x0,y0,x1,y1]};
const fit=r=>{const bb=bbox(r);if(!bb)return null;const B=G.viewBox,[x0,y0,x1,y1]=bb,ar=B[2]/B[3];let w=Math.max(x1-x0,1)*1.6,h=Math.max(y1-y0,1)*1.6;if(w/h<ar)w=h*ar;w=Math.max(w,B[2]/12);h=w/ar;
 if(w>=B[2])return null;const cx=(x0+x1)/2,cy=(y0+y1)/2;return[Math.min(Math.max(B[0],cx-w/2),B[0]+B[2]-w),Math.min(Math.max(B[1],cy-h/2),B[1]+B[3]-h),w,h]};
const svgEl=()=>document.querySelector('svg.ag');

function paths(){
 const out=[];const sel=ROWS.find(r=>r.k===AR.sel);const fk=(AR.foc&&ROWS.some(x=>x.k===AR.foc&&!x.sinGeo))?AR.foc:(sel&&!sel.sinGeo?sel.k:(ROWS.find(x=>!x.sinGeo)||{}).k);
 const one=r=>r.sinGeo?'':`<g class="apg${r.k===AR.sel?' on':''}${r.k===AR.cmp?' on2':''}" style="--i:${ROWS.indexOf(r)}" data-nx-t="${esc(r.nombre)}" data-nx-v="${esc(AR.capa?(AR.pintado[r.k]&&AR.leyenda[AR.pintado[r.k]]||''):fv(ind().f(r),ind()))}" data-nx-s="${esc(AR.capa?'':(RK[r.k]?'Puesto '+RK[r.k]+' de '+Object.keys(RK).length+' · '+ind().t:'Sin dato'))}" data-ak="${r.k}" role="button" tabindex="${r.k===fk?0:-1}" aria-pressed="${r.k===AR.sel}" aria-label="${esc(r.nombre)}: ${esc(fv(ind().f(r),ind()))}"><title>${esc(r.nombre)}: ${esc(fv(ind().f(r),ind()))}</title>${r.g.partes.map(pt=>`<path d="${pt.d}" style="fill:${fillOf(r)}"/>`).join('')}</g>`;
 const c2=ROWS.find(r=>r.k===AR.cmp);ROWS.forEach(r=>{if(r!==sel&&r!==c2)out.push(one(r))});if(c2)out.push(one(c2));if(sel)out.push(one(sel));
 return out.join('');
}
function labels(){
 const i=ind(),t=[];
 ROWS.forEach(r=>{if(r.sinGeo||!r.g.c)return;const[x,y]=r.g.c;
  if(r.k==='caba'){t.push(`<circle class="apin" data-ak="caba" cx="${x}" cy="${y}" r="5"/><text x="${x+8}" y="${y-8}" style="text-anchor:start">CABA</text>`);return}
  t.push(`<text${MENOR.includes(r.k)?' class="m"':''} x="${x}" y="${y}">${esc(r.corto)}${AR.vals&&!AR.capa?`<tspan class="v" x="${x}" dy="1.15em">${esc(sg(i.f(r),i)+COMP(i.f(r),i.d))}</tspan>`:''}</text>`)});
 (G.etiquetas||[]).forEach(e=>t.push(`<text class="e" x="${e.c[0]+(e.dx||0)}" y="${e.c[1]+(e.dy||0)}">${esc(e.t)}</text>`));
 return t.join('');
}
function guia(){const g=G.guia;if(!g)return '';return`<path class="agd" d="${g.arco60}"/><path class="agd" d="${g.lado_o}"/><path class="agd" d="${g.lado_e}"/>`}

function apply(){
 const sv=svgEl();if(!sv)return;const v=cur();
 sv.setAttribute('viewBox',v.map(n=>Math.round(n*10)/10).join(' '));
 const r=sv.getBoundingClientRect(),s=Math.min(r.width/v[2],r.height/v[3])||1,u=1/s;
 const L=sv.querySelector('#arl');if(L){L.style.fontSize=(11*u)+'px';L.style.strokeWidth=(3.4*u)+'px';L.classList.toggle('lo',G.viewBox[2]/v[2]<1.7)}
 sv.querySelectorAll('.apin').forEach(c=>c.setAttribute('r',(5*u).toFixed(2)));const zi=document.getElementById('ar-zi');if(zi)zi.textContent=zoomTxt();
}
window.argZoom=(f,cx,cy)=>{if(!G)return;const B=G.viewBox,v=cur().slice(),w=Math.min(B[2],Math.max(B[2]/25,v[2]*f)),h=w*B[3]/B[2];
 if(cx==null){cx=v[0]+v[2]/2;cy=v[1]+v[3]/2}
 const rx=(cx-v[0])/v[2],ry=(cy-v[1])/v[3];v[2]=w;v[3]=h;
 v[0]=Math.min(Math.max(B[0],cx-rx*w),B[0]+B[2]-w);v[1]=Math.min(Math.max(B[1],cy-ry*h),B[1]+B[3]-h);
 AR.vb=w>=B[2]-0.5?null:v;apply()};
window.argReset=()=>{AR.vb=null;apply()};
window.argFS=forzar=>{const q=typeof forzar==='boolean'?forzar:!AR.fs;if(q===AR.fs)return;AR.fs=q;AR.sd=false;const g=document.querySelector('.ar-grid'),h=document.getElementById('arapp');
 if(g){g.classList.toggle('fs',AR.fs);g.classList.remove('sd')}marcarFS();inertar(AR.fs);
 try{if(AR.fs&&h&&h.requestFullscreen)h.requestFullscreen().catch(()=>{});else if(!AR.fs&&document.fullscreenElement)document.exitFullscreen()}catch(e){}
 if(AR.fs){const a=document.activeElement;AR.opener=a&&a!==document.body?a:null;setTimeout(()=>{const b=document.querySelector('.ar-grid.fs button.ar-only-fs:last-of-type')||document.querySelector('.ar-grid.fs button');if(b)b.focus()},50);anuncia('Mapa a pantalla completa. Escape para salir.')}
 else{const o=AR.opener;AR.opener=null;setTimeout(()=>{const t=(o&&document.contains(o))?o:document.querySelector('.ar-w .mz button[aria-label^="Modo mapa"]');if(t)t.focus()},50);anuncia('Saliste de la pantalla completa.')}
 setTimeout(apply,60)};
window.argHerr=()=>{AR.herr=!AR.herr;const g=document.querySelector('.ar-grid');if(g)g.classList.toggle('herr',AR.herr);const b=document.querySelector('.ar-ctl button[onclick="argHerr()"]');if(b)b.setAttribute('aria-pressed',String(AR.herr));setTimeout(apply,60)};
window.argPanel=()=>{AR.sd=!AR.sd;const g=document.querySelector('.ar-grid');if(g)g.classList.toggle('sd',AR.sd);marcarFS()};
const nrm=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
window.argQ=v=>{AR.q=v;const q=nrm(v.trim()),keep=new Set();let n=0;document.querySelectorAll('.ar-grid .rr').forEach(b=>{const ok=!q||nrm(b.textContent).includes(q);b.hidden=!ok;if(ok){keep.add(b.dataset.ak);n++}});
 document.querySelectorAll('svg.ag g.apg').forEach(g=>g.classList.toggle('dim',!!q&&!keep.has(g.dataset.ak)));
 if(q&&AR._fq!==v){AR._fq=v;clearTimeout(AR._ft);AR._ft=setTimeout(()=>anuncia(n?n+' de '+ROWS.length+' jurisdicciones coinciden con «'+v.trim()+'».':'Ninguna jurisdicción coincide con «'+v.trim()+'».'),500)}};
window.argCfg=(k,v)=>{AR[k]=v;guardarPref();paint()};
window.argSel=k=>{AR.sel=AR.sel===k?'':k;if(!AR.sel||AR.cmp===AR.sel)AR.cmp='';AR.vb=null;AR.fit=AR.sel;try{history.replaceState(null,'','#/argentina'+(AR.sel?'/'+AR.sel:''))}catch(e){}
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
 const e=r.ej,ct=(e&&e.cargo_titular)||'Gobernador/a',cv=(e&&e.cargo_vice)||'Vicegobernador/a';
 if(e&&(e.gobernador||e.vicegobernador))return`<h4 class="sh">Gobierno provincial</h4><p class="meta">${esc(ct)}: ${esc(e.gobernador||'sin dato')}${e.partido?' · '+esc(e.partido):''}</p><p class="meta">${esc(cv)}: ${esc(e.vicegobernador||'sin dato')}${e.mandato_hasta?' · mandato hasta '+esc(e.mandato_hasta):''}</p>${e.fuente?`<p class="meta">Fuente: <a href="${esc(safe(e.fuente))}" rel="noopener noreferrer">enlace</a>${e.verificado?'':' · pendiente de cotejo oficial'}</p>`:''}${e.nota?`<p class="note">${esc(e.nota)}</p>`:''}`;
 return`<h4 class="sh">Gobierno provincial</h4><p class="empty">Sin dato verificado todavía. No se carga nada de memoria: se completa en <code>data/provincias_ar.json</code> (campo <code>ejecutivo</code>) cuando hay fuente.</p>`;
}
function detalle(r){
 const i=ind();
 const sub=r.k==='tierra-del-fuego'?`<div class="ar-box"><h4>Antártida e islas del Atlántico Sur</h4>Esta jurisdicción incluye la isla grande de Tierra del Fuego, las islas del Atlántico Sur y el Sector Antártico Argentino. La población censada vive en la isla grande, por eso la densidad se calcula solo sobre su superficie (${NF(r.sup)} km², según el IGN).</div>`:'';
 return`<p class="meta"><a href="#" onclick="argSel('${r.k}');return false">← Volver al país</a></p><h3 class="ar-title">${esc(r.nombre)}</h3>
 <p class="meta">Capital: ${esc(r.capital)} · Código INDEC ${esc(r.indec)}</p>
 <div class="ar-k"><div class="ar-c"><b>${NF(r.pob)}</b><span>habitantes (Censo 2022)</span><div class="ar-bar"><i style="width:${(r.pob/Math.max(...ROWS.map(x=>x.pob||0))*100).toFixed(1)}%"></i></div></div><div class="ar-c"><b>${NF(r.pct,1)} %</b><span>de la población del país</span><div class="ar-bar"><i style="width:${(r.pct/Math.max(...ROWS.map(x=>x.pct||0))*100).toFixed(1)}%"></i></div></div><div class="ar-c"><b>${NF(r.sup)} km²</b><span>superficie${r.k==='tierra-del-fuego'?' (isla grande)':''}, según el IGN</span></div><div class="ar-c"><b>${NF(r.dens,1)}</b><span>hab/km²</span></div></div>
 <h4 class="sh">Representación en el Congreso de la Nación</h4>
 <div class="ar-k"><div class="ar-c"><b>${NF(r.dip)}</b><span>diputados nacionales (de ${CD()})</span></div><div class="ar-c"><b>${NF(r.sen)}</b><span>senadores nacionales (de ${CS()})</span></div><div class="ar-c"><b>${NF(r.hdip)}</b><span>habitantes por diputado</span></div><div class="ar-c"><b>${NF(r.rep,2)} ×</b><span>bancas de Diputados respecto de su peso poblacional</span></div></div>
 <div class="ar-duo" role="img" aria-label="Peso comparado: ${NF(r.pct,1)} % de la población, ${NF(r.pdip,1)} % de los diputados, ${NF(r.psen,1)} % del Senado">${[['Población',r.pct],['Diputados',r.pdip],['Senado',r.psen]].map(([l,v])=>`<div class="ar-row"><span>${l}</span><div class="ar-bar"><i style="width:${(v/Math.max(r.pct,r.pdip,r.psen)*100).toFixed(1)}%"></i></div><b>${NF(v,1)} %</b></div>`).join('')}</div>
 <p class="note"><b>Puesto ${NF(ROWS.filter(x=>i.f(x)!=null&&i.f(x)>i.f(r)).length+1)} de ${NF(ROWS.filter(x=>i.f(x)!=null).length)}</b> en «${esc(i.t)}» (${esc(fv(i.f(r),i))}). Con un reparto proporcional a la población (simulación, método del resto mayor, sin mínimo por provincia) tendría ${NF(r.dsim)} diputados: ${r.ddif>0?'hoy tiene '+NF(r.ddif)+' de más':r.ddif<0?'hoy tiene '+NF(-r.ddif)+' de menos':'coincide con el reparto vigente'}. ${NF(r.pct,1)} % de la población y ${NF(r.pdip,1)} % de las bancas de Diputados; ${NF(r.psen,1)} % de los escaños del Senado. Es la composición legal, no un resultado electoral. Ver «Voz y peso» para el caso de Salta en la prensa.</p>
 ${cmpHtml(r)}${r.k==='salta'?salta():ejecutivo(r)}${sub}`;
}
function general(){
 return`<h3 class="sh">Argentina en cifras</h3><div class="ar-k"><div class="ar-c"><b>${TC()}</b><span>personas censadas en 2022 (INDEC, definitivo)</span></div><div class="ar-c"><b>24</b><span>jurisdicciones: 23 provincias y la Ciudad Autónoma de Buenos Aires</span></div><div class="ar-c"><b>${CD()}</b><span>diputados nacionales</span></div><div class="ar-c"><b>${CS()}</b><span>senadores nacionales (3 por jurisdicción)</span></div></div>
 <p class="note">Tocá una provincia del mapa o de la lista para ver su detalle. Cambiá el indicador arriba para pintar el mapa con otro dato.</p>
 <div class="ar-box"><h4>Cómo leer el mapa bicontinental</h4>Muestra en un solo mapa la Argentina americana, las islas del Atlántico Sur y el Sector Antártico Argentino (al sur del paralelo 60° S, entre los meridianos 25° y 74° al oeste de Greenwich, según la Cancillería). El sector antártico va en un recuadro, a la mitad de la escala del resto, con su propia proyección; las líneas punteadas marcan su perímetro. Lo que se dibuja es el polígono del IGN, no el mar del sector; la Cancillería da para todo el sector 1.461.597 km², de los cuales 965.314 km² son tierra firme.</div>
 <div class="ar-box"><h4>Soberanía</h4>La Constitución Nacional (Disposición Transitoria Primera) ratifica la soberanía argentina sobre las islas Malvinas, Georgias del Sur y Sandwich del Sur y los espacios marítimos e insulares correspondientes. Esos territorios están en disputa con el Reino Unido, que los administra; por eso el INDEC no pudo censarlos en 2022 y consigna que están sometidos a una ocupación que la Argentina considera ilegal. En el Sector Antártico rige el Tratado Antártico (en vigor desde 1961): su artículo IV deja en suspenso las reclamaciones mientras el tratado esté vigente, y de la Antártida el INDEC solo censó las bases permanentes. Tierra del Fuego, Antártida e Islas del Atlántico Sur es una sola provincia, con límites fijados por la ley 26.552.<br><a href="${esc((P.enlaces_oficiales||{}).sector_antartico_cancilleria)}" rel="noopener noreferrer">Cancillería: Sector Antártico</a> · <a href="${esc((P.enlaces_oficiales||{}).tratado_antartico_cancilleria)}" rel="noopener noreferrer">Tratado Antártico</a> · <a href="${esc((P.enlaces_oficiales||{}).soberania_indec)}" rel="noopener noreferrer">INDEC (nota sobre las islas)</a></div>`;
}
/* ================= Pizarra sobre el mapa =================
   Los dibujos viven en las coordenadas del mapa (se mueven y acercan con él) y se guardan solos en este navegador (localStorage).
   Nada se sube a ningún servidor. Se pueden exportar a PNG/SVG o a un archivo .json y volver a abrir. */

const IC={mover:'<path d="m5 9-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',lapiz:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',linea:'<path d="M5 19 19 5"/>',flecha:'<path d="M7 17 17 7M8 7h9v9"/>',rect:'<rect x="3.5" y="5" width="17" height="14" rx="2"/>',elipse:'<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',texto:'<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',regla:'<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',borrar:'<path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21M22 21H7M5 11l9 9"/>',pintar:'<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11ZM5 2l5 5M2 13h15M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',deshacer:'<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',rehacer:'<path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',ayuda:'<circle cx="12" cy="12" r="9.5"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',mas:'<path d="M5 12h14M12 5v14"/>',menos:'<path d="M5 12h14"/>',casa:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1ZM9 21v-7h6v7"/>',pantalla:'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',imagen:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',guardar:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',abrir:'<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',papelera:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'};
const icon=(k,z)=>`<svg viewBox="0 0 24 24" width="${z||18}" height="${z||18}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]||''}</svg>`;
const COLS=['#ff4d4f','#ffd43b','#51cf66','#4dabf7','#ffffff','#111111'];
const TOOLS=[['mover','✥','Mover el mapa y elegir provincias (V)'],['lapiz','✎','Lápiz (P)'],['linea','╱','Línea (L)'],['flecha','➜','Flecha (A)'],['rect','▭','Rectángulo (R)'],['elipse','◯','Elipse (E)'],['texto','T','Texto (T)'],['regla','⟷','Regla: distancia aproximada en km (M)'],['borrar','⌫','Borrar un dibujo (X)'],['pintar','▦','Pintar provincias con el color elegido para armar un mapa propio (C)']];
const KEYS={v:'mover',p:'lapiz',l:'linea',a:'flecha',r:'rect',e:'elipse',t:'texto',m:'regla',x:'borrar',c:'pintar'};
const DRAW=['lapiz','linea','flecha','rect','elipse','regla','texto'];
const LSG=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
const LSS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const fin=v=>typeof v==='number'&&isFinite(v);
const pnt=p=>Array.isArray(p)&&p.length===2&&fin(p[0])&&fin(p[1]);
/* todo lo que viene de afuera (archivo abierto, almacenamiento) se valida antes de dibujarlo */
const limpia=L=>(Array.isArray(L)?L:[]).filter(s=>s&&typeof s==='object'&&/^#[0-9a-f]{3,8}$/i.test(s.c||'')&&fin(s.w)&&s.w>0&&s.w<=20&&(
 (s.t==='lapiz'&&Array.isArray(s.p)&&s.p.length>1&&s.p.length<4000&&s.p.every(pnt))||
 (['linea','flecha','rect','elipse','regla'].includes(s.t)&&pnt(s.a)&&pnt(s.b))||
 (s.t==='texto'&&pnt(s.a)&&typeof s.s==='string'&&fin(s.f)))).slice(0,500).map(s=>{const o={...s};if(typeof o.s==='string')o.s=o.s.slice(0,200);else delete o.s;if(!fin(o.f))o.f=12;if(!fin(o.h))o.h=8;return o});
AR.dib=limpia(LSG('newar-ar-pizarra'));
const R1=v=>Math.round(v*10)/10;
const upp=()=>{const sv=svgEl(),m=sv&&sv.getScreenCTM();return 1/((m&&m.a)||1)};
const pt=(sv,x,y)=>{const p=sv.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(sv.getScreenCTM().inverse());return[q.x,q.y]};
const enInset=p=>{const g=G&&G.guia;return!!g&&Math.hypot(p[0]-g.polo[0],p[1]-g.polo[1])<=g.radio60*1.03&&p[1]<=g.polo[1]};
const kmTxt=(a,b)=>{if(enInset(a)||enInset(b))return'no aplica en el recuadro antártico';const k=Math.hypot(b[0]-a[0],b[1]-a[1])*G.km_por_unidad;return'≈ '+NF(k<100?Math.round(k):Math.round(k/5)*5)+' km'};
function shp(s,i){
 const st=`stroke:${s.c};stroke-width:${s.w}px;fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke`,a=s.a,b=s.b;let vis='',hit='',txt='';
 const L=(d,dash)=>{vis=`<path d="${d}" style="${st}${dash?';stroke-dasharray:7 5':''}"/>`;hit=`<path class="dh" d="${d}"/>`};
 if(s.t==='lapiz')L('M'+s.p.map(q=>R1(q[0])+' '+R1(q[1])).join('L'));
 else if(s.t==='linea'||s.t==='regla')L(`M${R1(a[0])} ${R1(a[1])}L${R1(b[0])} ${R1(b[1])}`,s.t==='regla');
 else if(s.t==='flecha'){const h=s.h,an=Math.atan2(b[1]-a[1],b[0]-a[0]);L(`M${R1(a[0])} ${R1(a[1])}L${R1(b[0])} ${R1(b[1])}M${R1(b[0]-h*Math.cos(an-.45))} ${R1(b[1]-h*Math.sin(an-.45))}L${R1(b[0])} ${R1(b[1])}L${R1(b[0]-h*Math.cos(an+.45))} ${R1(b[1]-h*Math.sin(an+.45))}`)}
 else if(s.t==='rect'){const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);L(`M${R1(x)} ${R1(y)}h${R1(w)}v${R1(h)}h${R1(-w)}Z`)}
 else if(s.t==='elipse'){const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.abs(b[0]-a[0])/2,ry=Math.abs(b[1]-a[1])/2;L(`M${R1(cx-rx)} ${R1(cy)}a${R1(rx)} ${R1(ry)} 0 1 0 ${R1(2*rx)} 0a${R1(rx)} ${R1(ry)} 0 1 0 ${R1(-2*rx)} 0Z`)}
 if(s.t==='texto'||s.t==='regla'){const rg=s.t==='regla',p=rg?[(a[0]+b[0])/2,(a[1]+b[1])/2]:a,halo=/^#(111|111111|000|000000)$/i.test(s.c)?'#fff':'#000';
  txt=`<text x="${R1(p[0])}" y="${R1(p[1]-(rg?s.f*.6:0))}" style="font-size:${R1(s.f)}px;fill:${s.c};paint-order:stroke;stroke:${halo};stroke-width:${R1(s.f*.16)}px;stroke-linejoin:round;font-weight:700;text-anchor:${rg?'middle':'start'}">${esc(s.s||'')}</text>`}
 return`<g class="dsh" data-di="${i}">${hit}${vis}${txt}</g>`}
function layer(){const g=document.getElementById('ard');if(!g)return;const L=AR.cur?AR.dib.concat([AR.cur]):AR.dib;g.innerHTML=L.map(shp).join('');tbState()}
function tbState(){const u=document.getElementById('ar-undo'),r=document.getElementById('ar-redo');if(u)u.disabled=!AR.dib.length;if(r)r.disabled=!AR.redo.length}
const guardar=()=>LSS('newar-ar-pizarra',AR.dib);
const commit=s=>{AR.dib.push(s);AR.redo=[];guardar();layer()};
window.argUndo=()=>{if(!AR.dib.length)return;AR.redo.push(AR.dib.pop());guardar();layer()};
window.argRedo=()=>{if(!AR.redo.length)return;AR.dib.push(AR.redo.pop());guardar();layer()};
window.argClear=()=>{if(!AR.dib.length)return;if(!confirm('¿Borrar todos los dibujos de la pizarra?'))return;AR.dib=[];AR.redo=[];guardar();layer()};
window.argMenu=btn=>{const pop=document.querySelector('.ar-pop');if(!pop)return;if(!btn){pop.hidden=true;const b=document.querySelector('.ar-menu>button');if(b)b.setAttribute('aria-expanded','false');return}const ab=pop.hidden;pop.hidden=!ab;btn.setAttribute('aria-expanded',String(ab))};
window.argTool=k=>{AR.tool=k;paint()};
window.argColor=c=>{AR.pc=c;paint()};
window.argWidth=w=>{AR.pw=w;paint()};
function tb(){return`<div class="ar-tb" role="toolbar" aria-label="Pizarra: dibujar sobre el mapa">${TOOLS.map(([k,g,t])=>`<button type="button" aria-pressed="${AR.tool===k}" title="${esc(t)}" aria-label="${esc(t)}" onclick="argTool('${k}')">${icon(k)}</button>`).join('')}<span class="sep"></span>${COLS.map(c=>`<button type="button" class="sw" style="background:${c}" aria-pressed="${AR.pc===c}" aria-label="Color ${c}" onclick="argColor('${c}')"></button>`).join('')}<span class="sep"></span>${[2,4,7].map(w=>`<button type="button" aria-pressed="${AR.pw===w}" aria-label="Grosor ${w}" title="Grosor ${w}" onclick="argWidth(${w})" style="font-size:${6+w*2}px">●</button>`).join('')}<span class="sep"></span><button type="button" id="ar-undo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" onclick="argUndo()">${icon('deshacer')}</button><button type="button" id="ar-redo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" onclick="argRedo()">${icon('rehacer')}</button><span class="sep"></span><button type="button" id="ar-capa" aria-pressed="${AR.capa}" ${Object.keys(AR.pintado).length?'':'disabled'} title="Ver tu pintado en lugar de los datos" onclick="argCapa()">Mi mapa</button><div class="ar-menu"><button type="button" aria-haspopup="true" aria-expanded="false" onclick="argMenu(this)">Más ▾</button><div class="ar-pop" hidden role="menu"><button type="button" role="menuitem" onclick="argMenu();argPNG()">${icon('imagen',16)} Guardar imagen PNG</button><button type="button" role="menuitem" onclick="argMenu();argSVG()">${icon('imagen',16)} Guardar mapa SVG</button><hr><button type="button" role="menuitem" onclick="argMenu();argSave()">${icon('guardar',16)} Guardar pizarra (.json)</button><button type="button" role="menuitem" onclick="argMenu();document.getElementById('arfile').click()">${icon('abrir',16)} Abrir pizarra…</button><hr><button type="button" role="menuitem" ${Object.keys(AR.pintado).length?'':'disabled'} onclick="argMenu();argLimpiaPintado()">${icon('pintar',16)} Quitar colores pintados</button><button type="button" role="menuitem" onclick="argMenu();argClear()">${icon('papelera',16)} Borrar toda la pizarra</button></div></div><input type="file" id="arfile" accept="application/json,.json" hidden onchange="argOpen(this)"><button type="button" aria-pressed="${AR.help}" title="Ayuda y atajos" aria-label="Ayuda y atajos" onclick="argHelp()">${icon('ayuda')}</button></div>`}
function askText(s,e){const w=document.querySelector('.ar-w');if(!w)return;const r=w.getBoundingClientRect(),i=document.createElement('input');i.className='ar-ti';i.maxLength=120;i.placeholder='Escribí y Enter';i.setAttribute('aria-label','Texto para el mapa');
 i.style.left=Math.max(0,Math.min(e.clientX-r.left,r.width-210))+'px';i.style.top=Math.max(0,e.clientY-r.top)+'px';w.appendChild(i);setTimeout(()=>i.focus(),0);
 let hecho=false;const fn=ok=>{if(hecho)return;hecho=true;const v=i.value.trim();if(i.parentNode)i.remove();if(ok&&v){s.s=v;commit(s)}else layer()};
 i.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter')fn(true);else if(ev.key==='Escape')fn(false)});i.addEventListener('blur',()=>fn(true))}

/* ---- exportar ---- */
const dl=(nom,blob)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nom;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
function snap(){
 const sv=svgEl();if(!sv)return null;const r=sv.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height),cl=sv.cloneNode(true),O=sv.querySelectorAll('*'),C=cl.querySelectorAll('*');
 const PR=['fill','stroke','stroke-width','stroke-dasharray','stroke-linejoin','stroke-linecap','paint-order','text-anchor','font-size','font-weight','font-style','opacity','display','vector-effect'];
 O.forEach((o,i)=>{const cs=getComputedStyle(o);C[i].setAttribute('style',PR.map(p=>p+':'+cs.getPropertyValue(p)).join(';')+';font-family:Inter,Arial,sans-serif');['class','tabindex','role','aria-label','aria-pressed','data-ak','data-di'].forEach(a=>C[i].removeAttribute(a))});
 cl.removeAttribute('class');cl.removeAttribute('style');cl.setAttribute('xmlns','http://www.w3.org/2000/svg');cl.setAttribute('width',w);cl.setAttribute('height',h);
 cl.insertAdjacentHTML('afterbegin',`<rect x="-9000" y="-9000" width="30000" height="30000" style="fill:${getComputedStyle(sv).backgroundColor}"/>`);
 return{svg:new XMLSerializer().serializeToString(cl),w,h}}
window.argSVG=()=>{const s=snap();if(s)dl('argentina-mapa.svg',new Blob([s.svg],{type:'image/svg+xml'}))};
window.argPNG=()=>{
 const s=snap();if(!s)return;const i=ind(),cw=Math.max(s.w,1000),k=Math.min(2,3600/cw),cv=document.createElement('canvas'),x=cv.getContext('2d');
 const paper=getComputedStyle(svgEl()).backgroundColor,ink=getComputedStyle(document.body).color,soft=getComputedStyle(svgEl()).getPropertyValue('--soft').trim()||ink;
 const leg=AR.capa?[...new Set(Object.values(AR.pintado))].filter(c=>AR.leyenda[c]).map(c=>({t:AR.leyenda[c],c})):[...document.querySelectorAll('.ar-leg span')].map(sp=>({t:sp.textContent.trim(),c:sp.querySelector('i')&&getComputedStyle(sp.querySelector('i')).backgroundColor})).filter(l=>l.c);
 const pie=['Población: INDEC, Censo 2022 (definitivo). Contornos: IGN (SIG 250), simplificados por NEWAR; no son contornos oficiales. Bancas: composición legal, no resultados electorales.','Generado en NEWAR el '+new Date().toLocaleDateString('es-AR')+'. El recuadro antártico está a la mitad de la escala del resto del mapa.'];
 if(AR.capa)pie[0]='Contornos: IGN (SIG 250), simplificados por NEWAR; no son contornos oficiales. Colores y leyenda: elaboración propia de quien armó el mapa.';
 x.font=`500 ${Math.round(12.5*k)}px Inter,Arial,sans-serif`;
 /* leyenda en renglones */
 let lx=16,fila=0;const pos=leg.map(l=>{const w=17+x.measureText(l.t).width/k+16;if(lx+w>cw-16){lx=16;fila++}const p={l,x:lx,f:fila};lx+=w;return p});
 const hd=Math.round((62+fila*20)*k);
 x.font=`${Math.round(11*k)}px Inter,Arial,sans-serif`;
 const lines=[];pie.forEach(t=>{let cur='';t.split(' ').forEach(w=>{if(x.measureText(cur+' '+w).width>(cw-32)*k&&cur){lines.push(cur);cur=w}else cur=cur?cur+' '+w:w});lines.push(cur)});
 const ft=Math.round((14+lines.length*16)*k);
 cv.width=Math.round(cw*k);cv.height=Math.round(s.h*k)+hd+ft;
 const im=new Image();
 im.onload=()=>{x.fillStyle=paper;x.fillRect(0,0,cv.width,cv.height);x.fillStyle=ink;x.font=`700 ${Math.round(22*k)}px Inter,Arial,sans-serif`;x.fillText(AR.capa?'Argentina · Mapa propio':'Argentina · '+i.t,16*k,30*k);
  x.font=`500 ${Math.round(12.5*k)}px Inter,Arial,sans-serif`;
  pos.forEach(p=>{const y=(46+p.f*20)*k;x.fillStyle=p.l.c;x.fillRect(p.x*k,y,12*k,12*k);x.fillStyle=soft;x.fillText(p.l.t,(p.x+17)*k,y+11*k)});
  x.drawImage(im,Math.round((cw-s.w)/2*k),hd,s.w*k,s.h*k);x.fillStyle=soft;x.font=`${Math.round(11*k)}px Inter,Arial,sans-serif`;
  lines.forEach((t,j)=>x.fillText(t,16*k,hd+s.h*k+(18+j*16)*k));
  cv.toBlob(b=>{if(b)dl('argentina-mapa.png',b);else alert('No se pudo generar la imagen. Probá con SVG.')},'image/png')};
 im.onerror=()=>alert('No se pudo generar la imagen en este navegador. Probá con SVG.');
 im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s.svg)};
window.argSave=()=>dl('pizarra-argentina.json',new Blob([JSON.stringify({v:2,col:AR.col,sel:AR.sel,vals:AR.vals,vb:AR.vb,dib:AR.dib,pintado:AR.pintado,leyenda:AR.leyenda,capa:AR.capa},null,1)],{type:'application/json'}));
function aplicar(o){
 if(!o||typeof o!=='object')return;if(IND.some(x=>x.k===o.col))AR.col=o.col;AR.sel=(typeof o.sel==='string'&&P.provincias[o.sel])?o.sel:'';AR.vals=o.vals!==false;
 AR.vb=Array.isArray(o.vb)&&o.vb.length===4&&o.vb.every(fin)&&o.vb[2]>5&&o.vb[3]>5?o.vb:null;AR.dib=limpia(o.dib);AR.redo=[];AR.fit='';const[pi,le]=limpiaP(o.pintado,o.leyenda);AR.pintado=pi;AR.leyenda=le;AR.capa=!!o.capa&&Object.keys(pi).length>0;AR.cmp='';guardar();guardarP();paint()}
window.argOpen=inp=>{const f=inp.files&&inp.files[0];if(!f)return;if(f.size>2e6){alert('El archivo es demasiado grande para ser una pizarra.');return}
 f.text().then(t=>{let o;try{o=JSON.parse(t)}catch(e){alert('Ese archivo no es una pizarra válida.');return}aplicar(o)});inp.value=''};

/* ---- escenas y presentación ---- */
const escs=()=>{const l=LSG('newar-ar-escenas');return(Array.isArray(l)?l:[]).filter(e=>e&&typeof e.n==='string').slice(0,30)};
window.argEsc=(a,i)=>{const L=escs();
 if(a==='save'){const inp=document.getElementById('arescn'),n=((inp&&inp.value.trim())||('Escena '+(L.length+1))).slice(0,60);L.push({n,col:AR.col,sel:AR.sel,vals:AR.vals,vb:AR.vb,dib:AR.dib.slice(),pintado:{...AR.pintado},leyenda:{...AR.leyenda},capa:AR.capa});LSS('newar-ar-escenas',L);paint();return}
 if(a==='del'){L.splice(i,1);LSS('newar-ar-escenas',L);paint();return}
 if(a==='go'){if(L[i])aplicar(L[i]);return}
 if(a==='pres'){if(!L.length)return;AR.pres=0;if(!AR.fs)argFS();aplicar(L[0]);return}
 if(a==='next'||a==='prev'){if(AR.pres===null||!L.length)return;AR.pres=(AR.pres+(a==='next'?1:L.length-1))%L.length;aplicar(L[AR.pres]);return}
 if(a==='end'){AR.pres=null;if(AR.fs)argFS();paint()}};
function escenasHtml(){const L=escs();return`<div class="ar-box" id="aresc"><h4>Escenas y presentación</h4><p class="note" style="margin:.2rem 0 .5rem">Guardá la vista actual (indicador, provincia, zoom y dibujos) como una escena y pasalas como diapositivas, con las flechas del teclado. Se guardan solo en este navegador.</p><div class="ctl"><input id="arescn" maxlength="60" placeholder="Nombre de la escena" aria-label="Nombre de la escena" style="flex:1;min-width:8rem"><button type="button" onclick="argEsc('save')">Guardar escena</button></div>${L.length?`<ol class="ar-esc">${L.map((e,i)=>`<li><span>${esc(e.n)}</span><button type="button" onclick="argEsc('go',${i})">Ver</button><button type="button" onclick="argEsc('del',${i})" aria-label="Borrar la escena ${esc(e.n)}">✕</button></li>`).join('')}</ol><button type="button" onclick="argEsc('pres')">▶ Presentar ${L.length} escena${L.length>1?'s':''}</button>`:'<p class="meta">Todavía no hay escenas guardadas.</p>'}</div>`}

/* ================= Pintar provincias (mapa propio), comparar, ayuda, preferencias ================= */
const COLR=/^#[0-9a-f]{3,8}$/i;
const limpiaP=(p,l)=>{const o={},q={};if(p&&typeof p==='object')Object.keys(p).forEach(k=>{if(P.provincias[k]&&typeof p[k]==='string'&&COLR.test(p[k]))o[k]=p[k].toLowerCase()});
 if(l&&typeof l==='object')Object.keys(l).forEach(c=>{if(COLR.test(c)&&typeof l[c]==='string')q[c.toLowerCase()]=l[c].slice(0,40)});return[o,q]};
const guardarP=()=>LSS('newar-ar-pintado',{pintado:AR.pintado,leyenda:AR.leyenda,capa:AR.capa});
const guardarPref=()=>LSS('newar-ar-pref',{col:AR.col,vals:AR.vals});
function restaurar(){const pf=LSG('newar-ar-pref');if(pf&&typeof pf==='object'){if(IND.some(x=>x.k===pf.col))AR.col=pf.col;if(typeof pf.vals==='boolean')AR.vals=pf.vals}
 const pp=LSG('newar-ar-pintado');if(pp&&typeof pp==='object'){const[o,q]=limpiaP(pp.pintado,pp.leyenda);AR.pintado=o;AR.leyenda=q;AR.capa=!!pp.capa&&Object.keys(o).length>0}}
function pintaProv(k){if(!P.provincias[k])return;if(AR.pintado[k]===AR.pc.toLowerCase())delete AR.pintado[k];else AR.pintado[k]=AR.pc.toLowerCase();AR.capa=Object.keys(AR.pintado).length>0;guardarP();paint()}
window.argCapa=()=>{AR.capa=!AR.capa&&Object.keys(AR.pintado).length>0;guardarP();paint()};
window.argLeyenda=(c,v)=>{AR.leyenda[c.toLowerCase()]=String(v).slice(0,40);guardarP()};
window.argLimpiaPintado=()=>{if(!Object.keys(AR.pintado).length)return;if(!confirm('¿Quitar todos los colores que pintaste?'))return;AR.pintado={};AR.leyenda={};AR.capa=false;guardarP();paint()};
function leyendaPropia(){const used=[...new Set(Object.values(AR.pintado))];
 if(!used.length)return`<p class="note">${AR.tool==='pintar'?'Elegí un color en la barra y tocá las provincias para pintarlas; volvé a tocar para quitar el color. Después podés ponerle nombre a cada color.':''}</p>`;
 return`<div class="ar-leg2" aria-label="Leyenda de tu mapa">${used.map(c=>`<label><i style="background:${c}"></i><input type="text" maxlength="40" placeholder="Qué significa este color" value="${esc(AR.leyenda[c]||'')}" aria-label="Significado del color ${c}" oninput="argLeyenda('${c}',this.value)"></label>`).join('')}</div>`}
window.argCmp=k=>{AR.cmp=k===AR.sel?'':k;paint()};
function cmpHtml(a){
 const opts='<option value="">Elegir otra provincia…</option>'+ROWS.filter(r=>r.k!==a.k).slice().sort((x,y)=>x.nombre.localeCompare(y.nombre,'es')).map(r=>`<option value="${r.k}"${r.k===AR.cmp?' selected':''}>${esc(r.corto)}</option>`).join('');
 const b=ROWS.find(r=>r.k===AR.cmp);let t='';
 if(b){const F=[['Población',r=>NF(r.pob)],['% del país',r=>NF(r.pct,1)+' %'],['Superficie (km²)',r=>NF(r.sup)],['Densidad (hab/km²)',r=>NF(r.dens,1)],['Diputados nacionales',r=>NF(r.dip)],['Habitantes por diputado',r=>NF(r.hdip)],['Bancas vs peso poblacional',r=>NF(r.rep,2)+' ×'],['Diputados proporcionales (simulación)',r=>NF(r.dsim)]];
  t=`<table class="ar-cmp"><thead><tr><th></th><th>${esc(a.corto)}</th><th>${esc(b.corto)}</th></tr></thead><tbody>${F.map(([l,f])=>`<tr><td>${l}</td><td>${f(a)}</td><td>${f(b)}</td></tr>`).join('')}</tbody></table><p class="note">En el mapa, la segunda provincia se marca con borde punteado.</p>`}
 return`<h4 class="sh">Comparar</h4><div class="ctl"><select aria-label="Comparar ${esc(a.corto)} con otra provincia" onchange="argCmp(this.value)">${opts}</select></div>${t}`}
window.argHelp=()=>{AR.help=!AR.help;paint()};
const ayuda=()=>AR.help?`<div class="ar-box" role="region" aria-label="Ayuda"><h4>Ayuda</h4><b>Teclas:</b> V mover y elegir · P lápiz · L línea · A flecha · R rectángulo · E elipse · T texto · M regla · X borrar · C pintar provincias · Ctrl+Z deshacer · Ctrl+Y rehacer.<br><b>Zoom:</b> rueda del mouse, pellizco o los botones + / −. <b>Modo mapa:</b> ⤢ (Esc para salir). <b>Presentación:</b> flechas ← → y Esc.<br><b>Pintar:</b> elegí un color y tocá las provincias; «Mi mapa» alterna entre tu pintado y los datos. <b>Todo se guarda solo en este navegador.</b></div>`:'';

/* ================= Mapa: contrato público, encuadres, accesibilidad y estados =================
   Esta parte NO interpreta frases: expone intents explícitos para que el asistente de voz (comandos-voz.js, otra cuenta)
   o cualquier otro módulo los invoque. Ver CONTRATO_MAPA_VOZ.md. */
const nrmE=t=>String(t==null?'':t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const FUENTE={pob:'INDEC, Censo 2022 (definitivo)',pct:'INDEC, Censo 2022 (definitivo)',dens:'INDEC, Censo 2022, y superficie del IGN',sup:'IGN, difundida por educ.ar',dip:'Composición legal del Congreso',hdip:'Congreso e INDEC, Censo 2022',hsen:'Congreso e INDEC, Censo 2022',rep:'Congreso e INDEC, Censo 2022',dsim:'Cálculo propio sobre INDEC y Congreso',ddif:'Cálculo propio sobre INDEC y Congreso'};
const GSTUB=()=>({provincias:{},viewBox:[0,0,900,1400],etiquetas:[],guia:null,nota:'',km_por_unidad:0,__falla:true});
const PSTUB=()=>({provincias:{},total_censado:0,congreso:{diputados:0,senadores:0,fuente:''},fuente_poblacion:'',fuente_superficie:'',enlaces_oficiales:{},__falla:true});
const TC=()=>ERR.p?'s/d':NF(P.total_censado),CD=()=>ERR.p?'s/d':NF(P.congreso.diputados),CS=()=>ERR.p?'s/d':NF(P.congreso.senadores);
const zoomN=()=>G&&G.viewBox?G.viewBox[2]/cur()[2]:1;
const zoomTxt=()=>'Zoom ×'+zoomN().toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1});
const sinUbi=()=>ROWS.filter(r=>r.sinGeo);
const anuncia=m=>{AR.msg=m;const l=document.getElementById('ar-live');if(l){l.textContent='';setTimeout(()=>{const x=document.getElementById('ar-live');if(x)x.textContent=m},60)}};
const descMapa=()=>{const i=ind(),v=ROWS.filter(r=>!r.sinGeo&&i.f(r)!=null).sort((a,b)=>i.f(b)-i.f(a)),n=ROWS.length,su=sinUbi().length,sd=ROWS.filter(r=>i.f(r)==null).length;
 return'Mapa bicontinental de la Argentina con '+n+' jurisdicciones. '+(AR.capa?'Se muestran los colores que elegiste.':'Indicador: '+i.t+'. '+(v.length?'Valor más alto: '+v[0].nombre+' ('+fv(i.f(v[0]),i)+'). Valor más bajo: '+v[v.length-1].nombre+' ('+fv(i.f(v[v.length-1]),i)+').':'Sin datos para este indicador.'))+(sd?' '+sd+' sin dato.':'')+(su?' '+su+' sin ubicación en el mapa.':'')+' '+zoomTxt()+'. Hay una tabla con los mismos datos debajo del mapa.'};
const tablaAlt=()=>{const i=ind(),ord=ROWS.slice().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 return`<details class="ar-alt ar-hide"><summary>Datos del mapa en tabla (alternativa en texto)</summary><table><caption>${esc(i.t)} por jurisdicción. Fuente: ${esc(FUENTE[i.k]||'')}</caption><thead><tr><th scope="col">Jurisdicción</th><th scope="col">${esc(i.t)}</th><th scope="col">Puesto</th><th scope="col">Ubicación</th></tr></thead><tbody>${ord.map(r=>`<tr><th scope="row">${esc(r.nombre)}</th><td>${esc(fv(i.f(r),i))}</td><td>${RK[r.k]?RK[r.k]+' de '+Object.keys(RK).length:'sin dato'}</td><td>${r.sinGeo?'sin ubicación en el mapa':'en el mapa'}</td></tr>`).join('')}</tbody></table></details>`};
const cajaErrorMapa=()=>`<div class="ar-err" role="alert"><b>No se pudieron cargar los contornos del mapa</b><p>Falta <code>data/geo_argentina.json</code>. Los datos siguen disponibles en la lista y en la tabla de abajo.</p><button type="button" onclick="argRetry()">Reintentar</button></div>`;
const bannerDatos=()=>ERR.p?`<div class="ar-err" role="alert"><b>No se pudieron cargar los datos de población y bancas</b><p>Falta <code>data/provincias_ar.json</code>. El mapa se muestra sin valores (todo «sin dato»).</p><button type="button" onclick="argRetry()">Reintentar</button></div>`:'';
const avisoSinUbi=()=>{const l=sinUbi();return l.length?`<p class="note ar-hide ar-sinubi" role="note"><b>Sin ubicación en el mapa (${l.length}):</b> ${l.map(r=>esc(r.nombre)).join(', ')}. No se dibujan, pero sus datos figuran en la lista y en la tabla.</p>`:''};
const avisoVacio=n=>n?'':'<p class="warn" role="status">No hay datos para este indicador en ninguna jurisdicción. Probá con otro indicador o reintentá la carga de los datos.</p>';
window.argRetry=()=>{G=null;P=null;LD=false;ERR={g:false,p:false};ROWS=[];paint();cargar()};
function cargar(){LD=true;ERR={g:false,p:false};
 Promise.all([J('geo_argentina',undefined,true),J('provincias_ar',undefined,true)]).then(([g,p])=>{
  ERR={g:!(g&&g.provincias&&g.viewBox),p:!(p&&p.provincias)};G=ERR.g?GSTUB():g;P=ERR.p?PSTUB():p;ROWS=[];if(!ERR.p)restaurar();paint()}).catch(()=>{ERR={g:true,p:true};G=GSTUB();P=PSTUB();ROWS=[];paint()})}

/* ---- resolución de entidades (no es un parser de frases: recibe un nombre ya extraído) ---- */
const ALIAS={'capital federal':'caba','ciudad de buenos aires':'caba','ciudad autonoma de buenos aires':'caba','bs as':'buenos-aires','provincia de buenos aires':'buenos-aires','tdf':'tierra-del-fuego','antartida':'tierra-del-fuego','antartida argentina':'tierra-del-fuego','islas malvinas':'tierra-del-fuego','malvinas':'tierra-del-fuego','islas del atlantico sur':'tierra-del-fuego','santiago':'santiago-del-estero'};
function resolver(t){if(t==null||t==='')return null;const q=nrmE(t);if(!q)return null;
 if(ROWS.some(r=>r.k===t))return t;
 const ex=ROWS.find(r=>nrmE(r.nombre)===q||nrmE(r.corto)===q||nrmE(r.k)===q);if(ex)return ex.k;
 if(ALIAS[q])return ROWS.some(r=>r.k===ALIAS[q])?ALIAS[q]:null;
 const c=ROWS.filter(r=>nrmE(r.nombre).includes(q)||nrmE(r.corto).includes(q));return c.length===1?c[0].k:null}
function resolverInd(t){if(t==null||t==='')return null;const q=nrmE(t);const x=IND.find(i=>i.k===t||nrmE(i.k)===q)||IND.find(i=>nrmE(i.t)===q)||IND.filter(i=>nrmE(i.t).includes(q));return Array.isArray(x)?(x.length===1?x[0].k:null):(x?x.k:null)}
const fila=k=>ROWS.find(r=>r.k===k);
function irA(k){const r=fila(k);if(!r)return false;AR.sel=k;AR.cmp=k===AR.cmp?'':AR.cmp;AR.vb=null;AR.fit=r.sinGeo?'':k;try{history.replaceState(null,'','#/argentina/'+k)}catch(e){}paint();return true}
function todoElPais(){AR.sel='';AR.cmp='';AR.vb=null;AR.fit='';try{history.replaceState(null,'','#/argentina')}catch(e){}paint()}
const vistaActiva=()=>(document.querySelector('.ar-grid')&&G&&!ERR.g)?'argentina':(document.querySelector('svg.mg')&&typeof window.mapaZoom==='function'?'salta':null);
const estadoMapa=()=>{const i=ind(),s=AR.sel?fila(AR.sel):null,enc=!AR.vb?'argentina':(AR.sel==='salta'?'salta':'personalizado');
 return{vista:vistaActiva(),zoom:+zoomN().toFixed(2),encuadre:enc,seleccion:AR.sel||'',seleccionNombre:s?s.nombre:'',indicador:{clave:i.k,titulo:i.t,unidad:i.u,fuente:FUENTE[i.k]||''},pantallaCompleta:!!AR.fs,filtro:AR.q||'',jurisdicciones:ROWS.length,sinUbicacion:sinUbi().map(r=>r.k),datos:{contornos:!ERR.g,valores:!ERR.p}}};
const INTENTS=['acercar','alejar','reiniciar','centrar','pantalla_completa','seleccionar','limpiar_seleccion','indicador','estado'];
const RES=(ok,intent,mensaje,extra)=>Object.assign({ok,intent,mensaje,estado:G?estadoMapa():null},extra||{});
function accion(intent,arg,opc){opc=opc||{};
 if(!INTENTS.includes(intent))return RES(false,intent,'Ese intent no existe en el mapa.',{motivo:'intent_desconocido',validos:INTENTS});
 if(intent==='estado')return RES(true,intent,'Estado del mapa.');
 if(ERR.g&&document.querySelector('.ar-grid'))return RES(false,intent,'No hay contornos cargados.',{motivo:'sin_contornos'});
 const v=vistaActiva();
 if(!v){if(opc.abrir!==false&&intent!=='indicador'){AR.pend={intent,arg};try{location.hash='#/argentina'}catch(e){}return RES(true,intent,'Abriendo el mapa de la Argentina.',{pendiente:true})}return RES(false,intent,'No hay ningún mapa a la vista.',{motivo:'sin_mapa_visible',sugerencia:'#/argentina'})}
 if(v==='salta'){ /* mapa de departamentos de Salta: se usan sus funciones globales ya existentes, sin modificarlo */
  if(intent==='acercar'){window.mapaZoom(0.7);return RES(true,intent,'Acerqué el mapa de Salta.')}
  if(intent==='alejar'){window.mapaZoom(1.4);return RES(true,intent,'Alejé el mapa de Salta.')}
  if(intent==='reiniciar'||(intent==='centrar'&&nrmE(arg)==='salta')){window.mapaReset();return RES(true,intent,'Mostrando toda la provincia de Salta.')}
  if(intent==='pantalla_completa'&&typeof window.mapaFS==='function'){const q=arg===false?false:(arg===true?true:null),g=document.querySelector('.mgrid'),est=!!(g&&g.classList.contains('mfs'));if(q===null||q!==est)window.mapaFS();return RES(true,intent,(q===null?!est:q)?'Mapa de Salta a pantalla completa.':'Salí de la pantalla completa.')}
  if(intent==='centrar'){AR.pend={intent,arg};try{location.hash='#/argentina'}catch(e){}return RES(true,intent,'Abriendo el mapa de la Argentina.',{pendiente:true})}
  return RES(false,intent,'Esa acción no está disponible en el mapa de Salta.',{motivo:'no_disponible_en_salta'})}
 /* vista Argentina */
 if(intent==='acercar'){argZoom(0.7);const m=zoomTxt();anuncia(m);return RES(true,intent,m)}
 if(intent==='alejar'){argZoom(1.4);const m=zoomTxt();anuncia(m);return RES(true,intent,m)}
 if(intent==='reiniciar'){todoElPais();const m='Mostrando la Argentina completa.';anuncia(m);return RES(true,intent,m)}
 if(intent==='centrar'){const q=nrmE(arg);if(!q||q==='argentina'||q==='pais'||q==='todo'||q==='completo'){todoElPais();const m='Mostrando la Argentina completa.';anuncia(m);return RES(true,intent,m)}
  const k=resolver(arg);if(!k)return RES(false,intent,'No encontré esa jurisdicción en el mapa.',{motivo:'jurisdiccion_desconocida',arg});
  const r=fila(k);irA(k);const m=r.sinGeo?r.nombre+' no tiene ubicación en el mapa; sus datos están en el panel.':'Mapa centrado en '+r.nombre+'. '+zoomTxt()+'.';anuncia(m);return RES(true,intent,m,{sinUbicacion:!!r.sinGeo})}
 if(intent==='pantalla_completa'){const q=arg===false||arg==='salir'?false:(arg===true||arg==='entrar'?true:!AR.fs);if(q===AR.fs)return RES(true,intent,q?'Ya estaba a pantalla completa.':'Ya estaba en vista normal.');argFS(q);return RES(true,intent,q?'Mapa a pantalla completa. Escape para salir.':'Salí de la pantalla completa.')}
 if(intent==='seleccionar'){const k=resolver(arg);if(!k)return RES(false,intent,'No encontré esa jurisdicción.',{motivo:'jurisdiccion_desconocida',arg});if(AR.sel!==k)irA(k);const r=fila(k),i=ind(),vt=fv(i.f(r),i),m=r.nombre+': '+vt+(/[.!?]$/.test(vt)?'':'.');anuncia(m);return RES(true,intent,m,{sinUbicacion:!!r.sinGeo})}
 if(intent==='limpiar_seleccion'){AR.sel='';AR.cmp='';AR.fit='';try{history.replaceState(null,'','#/argentina')}catch(e){}paint();const m='Quité la selección.';anuncia(m);return RES(true,intent,m)}
 if(intent==='indicador'){const k=resolverInd(arg);if(!k)return RES(false,intent,'No encontré ese indicador.',{motivo:'indicador_desconocido',arg,validos:IND.map(x=>x.k)});argCfg('col',k);const m='Mapa pintado por '+ind().t+'.';anuncia(m);return RES(true,intent,m)}
 return RES(false,intent,'No se pudo ejecutar.',{motivo:'sin_efecto'})}
function pend(){if(AR.pend&&G&&!ERR.g&&document.querySelector('svg.ag')){const p=AR.pend;AR.pend=null;setTimeout(()=>accion(p.intent,p.arg,{abrir:false}),30)}}
const AYUDA=[{frase:'acercá el mapa',intent:'acercar'},{frase:'alejá el mapa',intent:'alejar'},{frase:'acercá Salta',intent:'centrar',arg:'salta'},{frase:'mostrame Argentina',intent:'centrar',arg:'argentina'},{frase:'volvé al mapa completo',intent:'reiniciar'},{frase:'pantalla completa',intent:'pantalla_completa',arg:true},{frase:'salí de pantalla completa',intent:'pantalla_completa',arg:false},{frase:'elegí Jujuy',intent:'seleccionar',arg:'jujuy'},{frase:'quitá la selección',intent:'limpiar_seleccion'},{frase:'pintá el mapa por población',intent:'indicador',arg:'pob'}];
window.NEWAR_MAPA=Object.freeze({version:1,intents:INTENTS.slice(),accion,estado:estadoMapa,activo:()=>vistaActiva(),ayuda:()=>AYUDA.map(x=>Object.assign({},x))});
document.addEventListener('newar:mapa',e=>{const d=(e&&e.detail)||{};d.resultado=accion(d.intent||d.accion,d.arg,d)});
window.argCentrar=k=>{accion('centrar',k,{abrir:false})};
window.argPan=(dx,dy)=>{if(!G||!AR.vb)return;const B=G.viewBox,v=AR.vb.slice();v[0]=Math.min(Math.max(B[0],v[0]+dx*v[2]),B[0]+B[2]-v[2]);v[1]=Math.min(Math.max(B[1],v[1]+dy*v[3]),B[1]+B[3]-v[3]);AR.vb=v;apply()};
/* teclado: foco itinerante entre provincias, según la posición en el mapa */
function vecino(k0,dir){const a=fila(k0);if(!a||a.sinGeo||!a.g.c)return null;const[ax,ay]=a.g.c;let best=null,bd=1e9;
 ROWS.forEach(r=>{if(r.sinGeo||!r.g.c||r.k===k0)return;const dx=r.g.c[0]-ax,dy=r.g.c[1]-ay,al={ArrowRight:dx,ArrowLeft:-dx,ArrowDown:dy,ArrowUp:-dy}[dir],pe=(dir==='ArrowRight'||dir==='ArrowLeft')?Math.abs(dy):Math.abs(dx);if(al<=1)return;const d=al+pe*1.6;if(d<bd){bd=d;best=r.k}});return best}
function enfocar(k){const g=document.querySelector('svg.ag g.apg[data-ak="'+k+'"]');if(!g)return;document.querySelectorAll('svg.ag g.apg[tabindex="0"]').forEach(x=>x.tabIndex=-1);g.tabIndex=0;AR.foc=k;g.focus();const r=fila(k);if(AR.vb&&r&&r.g.c){const v=cur(),B=G.viewBox,c=r.g.c;if(c[0]<v[0]+8||c[0]>v[0]+v[2]-8||c[1]<v[1]+8||c[1]>v[1]+v[3]-8){AR.vb=[Math.min(Math.max(B[0],c[0]-v[2]/2),B[0]+B[2]-v[2]),Math.min(Math.max(B[1],c[1]-v[3]/2),B[1]+B[3]-v[3]),v[2],v[3]];apply()}}}
function resaltar(k){if(AR._hl===k&&(!k||document.querySelector('.ar-grid .hl')))return;AR._hl=k;document.querySelectorAll('.ar-grid .hl').forEach(x=>x.classList.remove('hl'));if(k)document.querySelectorAll('.ar-grid .rr[data-ak="'+k+'"],svg.ag g.apg[data-ak="'+k+'"]').forEach(x=>x.classList.add('hl'))}
/* pantalla completa: oculta el resto de la página a la tecnología asistiva mientras el mapa ocupa la pantalla */
function inertar(on){document.querySelectorAll('[data-ar-inert]').forEach(n=>{n.removeAttribute('inert');n.removeAttribute('data-ar-inert')});if(!on)return;const g=document.querySelector('.ar-grid');let n=g;
 while(n&&n!==document.documentElement){const p=n.parentElement;if(!p)break;[...p.children].forEach(c=>{if(c!==n&&c.tagName!=='SCRIPT'&&c.tagName!=='STYLE'&&!c.hasAttribute('inert')){c.setAttribute('inert','');c.setAttribute('data-ar-inert','1')}});n=p}}
function marcarFS(){const g=document.querySelector('.ar-grid');if(!g)return;if(AR.fs){g.setAttribute('role','dialog');g.setAttribute('aria-modal','true');g.setAttribute('aria-label','Mapa de la Argentina a pantalla completa. Escape para salir.')}else{['role','aria-modal','aria-label'].forEach(a=>g.removeAttribute(a))}
 const s=document.getElementById('arside');if(s){if(AR.fs&&!AR.sd)s.setAttribute('inert','');else s.removeAttribute('inert')}}
/* el foco no se pierde cuando se vuelve a dibujar el mapa (al elegir una provincia, cambiar de indicador, etc.) */
const firmaFoco=()=>{const a=document.activeElement,w=document.getElementById('arapp');if(!a||!w||!w.contains(a))return'';
 if(a.matches('g.apg[data-ak]'))return'svg.ag g.apg[data-ak="'+a.dataset.ak+'"]';if(a.matches('.rr[data-ak]'))return'.rr[data-ak="'+a.dataset.ak+'"]';if(a.id)return'#'+a.id;
 const l=a.getAttribute('aria-label');if(l&&a.tagName==='BUTTON')return'button[aria-label="'+l.replace(/"/g,'\\"')+'"]';if(a.tagName==='BUTTON'&&a.title)return'button[title="'+a.title.replace(/"/g,'\\"')+'"]';return''};

function paint(){
 const el=document.getElementById('arapp');if(!el)return;
 if(G===null||P===null){el.innerHTML='<div class="ar-skel" role="status" aria-busy="true" aria-label="Cargando el mapa de la Argentina"></div>';return}
 if(ERR.g&&ERR.p){el.innerHTML='<div class="ar-err" role="alert"><b>No se pudo cargar el mapa</b><p>No se pudieron leer <code>data/geo_argentina.json</code> ni <code>data/provincias_ar.json</code>. Revisá la conexión y probá de nuevo.</p><button type="button" onclick="argRetry()">Reintentar</button></div>';return}
 if(!ROWS.length)build();
 const i=ind(),rg=classes(),sel=ROWS.find(r=>r.k===AR.sel);
 if(AR.fit&&sel){AR.vb=fit(sel);AR.fit=''}else AR.fit='';
 const groups={};IND.forEach(x=>{(groups[x.g]=groups[x.g]||[]).push(x)});
 const opts=Object.entries(groups).map(([g,xs])=>`<optgroup label="${esc(g)}">${xs.map(x=>`<option value="${x.k}"${x.k===AR.col?' selected':''}>${esc(x.t)}</option>`).join('')}</optgroup>`).join('');
 const rank=ROWS.filter(r=>i.f(r)!=null).sort((a,b)=>i.f(b)-i.f(a));const mx=Math.max(...rank.map(r=>i.f(r)),1);
 const vb=cur(),swap=AR.lastSel!==AR.sel;AR.lastSel=AR.sel;
 const foco=firmaFoco();
 el.innerHTML=`<div class="ar-grid${AR.fs?' fs':''}${AR.sd?' sd':''}${AR.herr?' herr':''}"><div class="ar-col">${bannerDatos()}
 <div class="ctl ar-ctl"><select aria-label="Pintar el mapa por" onchange="argCfg('col',this.value)">${opts}</select><label class="chk"><input type="checkbox"${AR.vals?' checked':''} onchange="argCfg('vals',this.checked)"> Mostrar valores en el mapa</label><input class="ar-hide" type="search" id="arq" placeholder="Buscar provincia…" aria-label="Buscar provincia en la lista" value="${esc(AR.q)}" oninput="argQ(this.value)" style="max-width:12rem"><button class="ar-hide" type="button" onclick="argCSV()">Descargar CSV</button><button class="ar-hide" type="button" onclick="window.print()">Imprimir / PDF</button><button class="ar-only-fs" type="button" onclick="argPanel()">Datos</button><button class="ar-only-fs" type="button" aria-pressed="${!!AR.herr}" onclick="argHerr()">Dibujar</button><button class="ar-only-fs" type="button" onclick="argFS()">Salir (Esc)</button></div>
 ${AR.capa?leyendaPropia():`<div class="ar-leg" aria-label="Escala de colores">${rg.map((x,c)=>x?`<span><i style="background:var(--r${c})"></i>${esc(NF(x[0],i.d))}–${esc(NF(x[1],i.d))}</span>`:'').join('')}<span><i style="background:var(--line)"></i>sin dato</span></div>`}${AR.tool==='pintar'&&!AR.capa?leyendaPropia():''}
 ${tb()}${ayuda()}
 <div class="ar-w">${AR.pres!==null&&escs()[AR.pres]?`<div class="ar-cap" role="status"><button type="button" onclick="argEsc('prev')" aria-label="Escena anterior">‹</button><span>${esc(escs()[AR.pres].n)} · ${AR.pres+1}/${escs().length}</span><button type="button" onclick="argEsc('next')" aria-label="Escena siguiente">›</button><button type="button" onclick="argEsc('end')" aria-label="Terminar la presentación">✕</button></div>`:''}<div class="ar-hud">${AR.capa?'<b>Mi mapa</b><em>Colores y leyenda propios</em>':`<b>${esc(i.t)}</b><em>${esc(i.g)}${i.u?' · '+esc(i.u):''}</em><i></i><div><span>${esc(NF(rg[0]?rg[0][0]:null,i.d))}</span><span>${esc(NF(rg[4]?rg[4][1]:null,i.d))}</span></div><small>Fuente: ${esc(FUENTE[i.k]||'')}</small>`}<small id="ar-zi">${zoomTxt()}</small></div><div class="ar-nav" role="group" aria-label="Encuadre del mapa"><button type="button" aria-pressed="${!AR.vb&&!AR.sel}" onclick="argCentrar('argentina')">Argentina</button><button type="button" aria-pressed="${AR.sel==='salta'}" onclick="argCentrar('salta')">Salta</button>${AR.sel==='salta'?'<a href="#/mapa">Departamentos →</a>':''}</div><div class="mz"><button type="button" onclick="argZoom(0.7)" aria-label="Acercar">${icon('mas')}</button><button type="button" onclick="argZoom(1.4)" aria-label="Alejar">${icon('menos')}</button><button type="button" onclick="argCentrar('argentina')" aria-label="Volver al encuadre inicial: toda la Argentina" title="Encuadre inicial (0)">${icon('casa')}</button><button type="button" onclick="argFS()" aria-label="Modo mapa: pantalla completa solo con el mapa (Esc para salir)" title="Modo mapa (pantalla completa)">${icon('pantalla')}</button></div>
 ${ERR.g?cajaErrorMapa():`<svg class="ag${AR.anim?'':' anim'}${AR.tool==='mover'?'':AR.tool==='pintar'?' pnt':AR.tool==='borrar'?' bor':' dib'}" viewBox="${vb.map(n=>Math.round(n*10)/10).join(' ')}" role="group" aria-roledescription="mapa" aria-label="Mapa bicontinental de la República Argentina. Con el foco en el mapa: las flechas cambian de provincia, Enter la elige, más y menos acercan y cero muestra todo el país." aria-describedby="ar-desc">${guia()}${paths()}<g id="arl">${labels()}</g><g id="ard">${AR.dib.map(shp).join('')}</g></svg>`}<p id="ar-desc" class="ar-sr">${esc(descMapa())}</p><div id="ar-live" class="ar-sr" role="status" aria-live="polite"></div></div>
 <p class="note ar-hide"><b>Pizarra:</b> elegí una herramienta (atajos V P L A R E T M X) y dibujá sobre el mapa; la regla mide km en línea recta, de forma aproximada y solo en el mapa americano. Los dibujos se guardan solos en este navegador. Arrastrá para mover. Acercá con la rueda del mouse, el pellizco o los botones + / −; ⤢ para el modo mapa. Tocá una provincia para ver su detalle. Con el teclado: Tab entra al mapa, las flechas cambian de provincia, Enter la elige, + y − acercan, 0 muestra toda la Argentina, S encuadra Salta, F pantalla completa y Esc sale. Color por cuartiles: ${esc(i.t)}.${i.g.startsWith('Simulaciones')?' <b>Es una simulación, no una propuesta:</b> reparte las 257 bancas en proporción a la población censada (método del resto mayor, sin mínimo por provincia) para mostrar cuánto se aparta el reparto vigente.':''} ${esc(G.nota)}</p>
 <h3 class="sh ar-hide">${esc(i.t)}: ranking</h3><div class="rk ar-hide">${rank.map(r=>`<button type="button" class="rr${r.k===AR.sel?' on':''}" data-ak="${r.k}" aria-pressed="${r.k===AR.sel}"><span class="nm">${esc(r.corto)}</span><span class="rb"><i style="width:${Math.max(1,i.f(r)/mx*100).toFixed(1)}%"></i></span><span class="meta">${esc(fv(i.f(r),i))}</span></button>`).join('')}</div>
${avisoVacio(rank.length)}${avisoSinUbi()}${tablaAlt()}
 <p class="note ar-hide">Población: ${esc(P.fuente_poblacion)} Congreso: ${esc(P.congreso.fuente)} Superficies: ${esc(P.fuente_superficie)}</p>
 <p class="note ar-hide">Contornos: FUENTE: Instituto Geográfico Nacional de la República Argentina (capa SIG 250), en la versión publicada por github.com/mgaitan/departamentos_argentina; la fecha de los datos originales no consta en esa fuente. Simplificados y reproyectados por NEWAR: sirven para visualizar, no son los contornos oficiales ni cuentan con el aval del IGN.</p>
 </div><aside class="ar-side${swap?' nx-swap':''}" id="arside" aria-live="polite">${sel?detalle(sel):general()}${escenasHtml()}</aside></div>`;
 AR.anim=true;apply();tbState();if(AR.q)argQ(AR.q);AR._hl='';marcarFS();if(foco){const x=el.querySelector(foco);if(x){try{x.focus({preventScroll:true})}catch(e){}}}pend();
}

/* ---- interacción: arrastrar, rueda, pellizco, dibujo y teclado ---- */
if(!window.__arIn){window.__arIn=1;
 const PT=new Map();let d=null,mov=false,pd=0;
 document.addEventListener('pointerdown',e=>{const sv=e.target.closest&&e.target.closest('svg.ag');if(!sv||!G)return;if(e.pointerType==='mouse'&&e.button!==0)return;PT.set(e.pointerId,[e.clientX,e.clientY]);
  if(PT.size===2){AR.cur=null;layer();const a=[...PT.values()];pd=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);d=null;return}
  if(DRAW.includes(AR.tool)){const q=pt(sv,e.clientX,e.clientY),u=upp(),t=AR.tool,c=AR.pc,w=AR.pw;AR.cur=t==='lapiz'?{t,c,w,p:[q],f:12,h:8}:{t,c,w,a:q,b:q,h:12*u,f:14*u};d=null;mov=false;layer();return}
  d={x:e.clientX,y:e.clientY,v:cur().slice(),s:sv.getScreenCTM().a};mov=false});
 document.addEventListener('pointermove',e=>{if(!PT.has(e.pointerId))return;PT.set(e.pointerId,[e.clientX,e.clientY]);const sv=svgEl();if(!sv||!G)return;
  if(PT.size===2){const a=[...PT.values()],nd=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pd>0&&nd>0){const c=pt(sv,(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2);argZoom(pd/nd,c[0],c[1])}pd=nd;mov=true;return}
  if(AR.cur){const q=pt(sv,e.clientX,e.clientY);if(AR.cur.t==='lapiz'){const l=AR.cur.p[AR.cur.p.length-1];if(Math.hypot(q[0]-l[0],q[1]-l[1])>=1.2*upp()&&AR.cur.p.length<3900)AR.cur.p.push(q)}else AR.cur.b=q;mov=true;layer();return}
  if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!mov&&Math.hypot(dx,dy)<5)return;mov=true;
  const B=G.viewBox;if(!AR.vb&&d.v[2]>=B[2]-0.5)return;
  const x=Math.min(Math.max(B[0],d.v[0]-dx/d.s),B[0]+B[2]-d.v[2]),y=Math.min(Math.max(B[1],d.v[1]-dy/d.s),B[1]+B[3]-d.v[3]);AR.vb=[x,y,d.v[2],d.v[3]];apply()});
 const up=e=>{const was=PT.size;PT.delete(e.pointerId);if(PT.size<2)pd=0;if(!PT.size)d=null;
  if(AR.cur&&was===1){const s=AR.cur;AR.cur=null;
   if(e.type==='pointercancel'){layer();return}
   if(s.t==='lapiz'){if(s.p.length>1)commit(s);else layer()}
   else if(s.t==='texto')askText(s,e);
   else if(Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1])>3*upp()){if(s.t==='regla')s.s=kmTxt(s.a,s.b);commit(s)}else layer()}};
 document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
 document.addEventListener('click',e=>{
  const sh=e.target.closest&&e.target.closest('.dsh');
  if(sh&&AR.tool==='borrar'&&sh.closest('#arapp')){const i=+sh.dataset.di;if(i>=0&&i<AR.dib.length){AR.dib.splice(i,1);AR.redo=[];guardar();layer()}return}
  const q=e.target.closest&&e.target.closest('[data-ak]');if(!q||!q.closest('#arapp'))return;
  if(AR.tool==='pintar'&&q.closest('svg.ag')){if(mov){mov=false;e.preventDefault();return}pintaProv(q.dataset.ak);return}
  if(AR.tool!=='mover'&&q.closest('svg.ag'))return;
  if(mov){mov=false;e.preventDefault();return}argSel(q.dataset.ak)});
 document.addEventListener('keydown',e=>{
  if(!document.getElementById('arapp'))return;const t=e.target,tag=t&&t.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
  if(AR.fs&&e.key==='Tab'){const g=document.querySelector('.ar-grid.fs');if(g){const f=[...g.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&!x.closest('[inert]')&&x.offsetParent!==null);if(f.length){const a=document.activeElement,p=f[0],u=f[f.length-1];if(e.shiftKey&&(a===p||!g.contains(a))){e.preventDefault();u.focus()}else if(!e.shiftKey&&(a===u||!g.contains(a))){e.preventDefault();p.focus()}}}return}
  if(t.closest&&t.closest('svg.ag')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const k=e.key;
   if(k==='+'||k==='='){e.preventDefault();accion('acercar');return}
   if(k==='-'||k==='_'){e.preventDefault();accion('alejar');return}
   if(k==='0'||k==='Home'){e.preventDefault();accion('reiniciar');return}
   if(k==='s'||k==='S'){e.preventDefault();accion('centrar','salta');return}
   if(k==='f'||k==='F'){e.preventDefault();accion('pantalla_completa');return}
   if(k.startsWith('Arrow')&&t.matches('g.apg')){e.preventDefault();if(e.shiftKey){argPan(k==='ArrowRight'?.2:k==='ArrowLeft'?-.2:0,k==='ArrowDown'?.2:k==='ArrowUp'?-.2:0)}else{const n=vecino(t.dataset.ak,k);if(n)enfocar(n)}return}}
  if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('g.apg')){e.preventDefault();argSel(t.dataset.ak);return}
  if(e.key==='Escape'){const pp=document.querySelector('.ar-pop');if(pp&&!pp.hidden){argMenu();return}if(AR.pres!==null)argEsc('end');else if(AR.fs)argFS();return}
  if(AR.pres!==null){if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){e.preventDefault();argEsc('next')}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();argEsc('prev')}return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?argRedo():argUndo();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();argRedo();return}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&KEYS[e.key.toLowerCase()]&&KEYS[e.key.toLowerCase()]!==AR.tool){argTool(KEYS[e.key.toLowerCase()])}});
 document.addEventListener('click',e=>{if(!(e.target.closest&&e.target.closest('.ar-menu')))argMenu()});
 document.addEventListener('wheel',e=>{const sv=e.target.closest&&e.target.closest('svg.ag');if(!sv||!G)return;e.preventDefault();const c=pt(sv,e.clientX,e.clientY);argZoom(Math.min(1.4,Math.max(0.7,Math.exp(e.deltaY*0.0022))),c[0],c[1])},{passive:false});
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&AR.fs&&document.getElementById('arapp'))argFS(false)});
 document.addEventListener('pointerover',e=>resaltar((e.target.closest&&e.target.closest('.ar-grid .rr[data-ak],svg.ag g.apg[data-ak]')||{dataset:{}}).dataset.ak||''));
 document.addEventListener('focusin',e=>{const x=e.target.closest&&e.target.closest('.ar-grid .rr[data-ak]');if(x)resaltar(x.dataset.ak)});document.addEventListener('focusout',e=>{if(e.target.closest&&e.target.closest('.ar-grid .rr[data-ak]'))resaltar('')});
 window.addEventListener('resize',()=>{if(G)apply()});
}

V.argentina=id=>{
 if(id&&id!==AR.sel&&((P&&P.provincias&&P.provincias[id])||!P)){AR.sel=id;AR.fit=id}
 if(!LD)cargar();
 setTimeout(paint,0);
 return`<h2 class="sec">Mapa de la Argentina</h2><p class="lede">El mapa bicontinental de la República Argentina con las 23 provincias, la Ciudad Autónoma de Buenos Aires, las islas del Atlántico Sur y el Sector Antártico Argentino. Se pinta con datos del Censo 2022 del INDEC y muestra cuánto pesa cada provincia en el Congreso de la Nación. Para Salta, además, están sus representantes y el mapa de departamentos.</p><div id="arapp"><div class="ar-skel" role="status" aria-busy="true" aria-label="Cargando el mapa de la Argentina"></div></div>`;
};
NEEDS.argentina=['pol'];
if(!TABS.some(t=>t[0]==='argentina')){const i=TABS.findIndex(t=>t[0]==='mapa');TABS.splice(i<0?TABS.length:i+1,0,['argentina','Argentina'])}

/* si el primer render ya corrió antes de que cargara este módulo, se repite para que aparezca la pestaña */
setTimeout(()=>{const t=document.getElementById('tabs');if(typeof route==='function'&&t&&t.children.length&&!t.querySelector('a[href="#/argentina"]'))route()},0);
})();
