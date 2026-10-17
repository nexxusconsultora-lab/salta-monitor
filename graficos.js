/* ===== NEWAR · Generador de gráficos =====
   Pestaña «Gráficos»: el usuario elige QUÉ quiere medir (prensa por medio, por tono, por poder, por palabras
   que escriba, menciones de personas, legisladores por bloque, publicaciones oficiales…), el período, el
   ámbito y el tipo (torta, dona o barras). Se descarga como imagen (PNG), SVG o CSV, y se pueden guardar
   configuraciones en el navegador. Los datos salen de lo que NEWAR ya cargó; nada se inventa.
   Colores: paleta categórica validada (8 tonos en orden fijo; lo que sobra se agrupa en «Otros» gris).
   Se carga DESPUÉS de poderes.js. No depende de otros módulos. */
(()=>{
if(typeof V==='undefined'||typeof TABS==='undefined')return;
const Q=s=>document.querySelector(s),DAY=864e5;
const PAL={l:['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#6250d6','#e34948'],d:['#3987e5','#d95926','#199e70','#c98500','#d55181','#008300','#9085e9','#e66767']};
const OTROS={l:'#9a968e',d:'#7b766d'},INK={l:'#211D1A',d:'#F3EEE2'},SOFT={l:'#5C554C',d:'#B9B0A0'},SURF={l:'#FBF8F1',d:'#2B2621'};
const modo=()=>{const t=document.documentElement.getAttribute('data-theme');if(t==='dark')return'd';if(t==='light')return'l';return matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'d':'l'};
const nf=n=>Number(n).toLocaleString('es-AR');
const fD=ts=>ts?new Date(ts).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}):'';
const cut=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+'…':s};

/* ---------- Configuración ---------- */
const DEF={src:'prensa_medio',tipo:'dona',per:30,amb:'',q:'',terms:'',uno:1,max:6,cam:'',med:'n',tit:'',ord:'desc'};
let C=Object.assign({},DEF),LAST=null,LASTL=null;
const LSK='newar_graficos_guardados';
const gLs=()=>{try{return JSON.parse(localStorage.getItem(LSK)||'[]')}catch(e){return[]}};
const sLs=l=>{try{localStorage.setItem(LSK,JSON.stringify(l))}catch(e){}};

/* ---------- Notas de prensa (con archivo) ---------- */
let GN=null,GARC=null;
const arcLoad=()=>GARC||(GARC=(async()=>{if(ES.arc)return ES.arc;try{const ix=await J('archivo/index',null,true),mes=ix&&ix.meses?Object.keys(ix.meses).sort().slice(-2):[];let a=[];for(const m of mes){const d=await J('archivo/'+m,null,true);if(d&&d.items)a=a.concat(d.items)}ES.arc=a}catch(e){ES.arc=ES.arc||[]}return ES.arc})());
const notas=()=>{const raw=(S.news||[]).concat((ES&&ES.arc)||[]),key=raw.length;if(GN&&GN.k===key)return GN.l;
 const seen=new Set(),l=[];raw.forEach(n=>{if(!n||!n.id||seen.has(n.id))return;seen.add(n.id);if(/ - temas - /i.test(n.title||''))return;
  const t=tituloSinMedio(n);l.push({t,f:fold(t),ts:Date.parse(n.published_iso||n.collected_at)||0,mn:medioNombre(n.source),cat:n.category,sent:n.sentiment_label||'sin tono'})});
 GN={k:key,l};return l};
const filtraNotas=()=>{const lim=C.per?Date.now()-C.per*DAY:0,q=fold(C.q||'').trim();
 return notas().filter(n=>(!lim||n.ts>=lim)&&(!C.amb||(C.amb==='sal'?n.cat==='Provincial':n.cat==='Nacional'))&&(!q||n.f.includes(q)))};
const cuenta=(l,fn)=>{const m={};l.forEach(x=>{const k=fn(x);if(k===null||k===undefined||k==='')return;m[k]=(m[k]||0)+1});return Object.entries(m).map(([l,v])=>({l,v}))};

const RXP=[['Poder Judicial',/\b(juez|jueza|jueces|fiscal\w*|corte suprema|poder judicial|tribunal\w*|justicia|juicio|imputad\w+|procesad\w+|sentencia|fallo|camarista\w*|magistrad\w+|procurador\w*)\b/],
 ['Poder Legislativo',/\b(senador\w*|senado|diputad[oa]s?|legislatur\w+|legislativ\w+|concejo deliberante|concejal\w*|proyecto de ley|media sancion|bancas?|ordenanzas?)\b/],
 ['Poder Ejecutivo',/\b(gobernador\w*|gobierno|ministr[oa]s?|ministerio|gabinete|decreto|dnu|milei|saenz|casa rosada|intendente|adorni|caputo|secretari[oa])\b/]];
const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const TONO={positivo:'Positivo',neutral:'Neutral',negativo:'Negativo','sin tono':'Sin tono'};

/* ---------- Fuentes de datos ---------- */
const pLg=()=>personas.map(p=>[p,(p.cargos||[]).find(c=>c.v===1&&c.p&&c.p.chamber!=='Ejecutivo')]).filter(x=>x[1]);
const ofItems=()=>{const lim=C.per?Date.now()-C.per*DAY:0;return((S.of&&S.of.items)||[]).filter(x=>{const ts=Date.parse(x.fecha_publicacion||'')||Date.parse(x.first_seen||'')||0;return!lim||ts>=lim})};
const SRC={
 prensa_medio:{g:'Prensa',t:'Notas por medio',u:'notas',f:{per:1,amb:1,q:1},fn:()=>cuenta(filtraNotas(),n=>n.mn)},
 prensa_tono:{g:'Prensa',t:'Notas por tono',u:'notas',f:{per:1,amb:1,q:1},fn:()=>cuenta(filtraNotas(),n=>TONO[n.sent]||n.sent),fijo:1},
 prensa_ambito:{g:'Prensa',t:'Notas: Salta vs Nación',u:'notas',f:{per:1,q:1},fn:()=>{const a=C.amb;C.amb='';const l=filtraNotas();C.amb=a;return cuenta(l,n=>n.cat==='Provincial'?'Medios de Salta':n.cat==='Nacional'?'Medios nacionales':'Otros')},fijo:1},
 prensa_poder:{g:'Prensa',t:'Notas por poder (Ejecutivo, Legislativo, Judicial)',u:'notas',f:{per:1,amb:1,q:1},fn:()=>cuenta(filtraNotas(),n=>{for(const[k,rx]of RXP)if(rx.test(n.f))return k;return'Otros temas'}),fijo:1,nota:'Cada nota se cuenta una sola vez, en el primer poder cuyas palabras aparecen en el título (orden: Judicial, Legislativo, Ejecutivo). Es una pista por palabras, no una clasificación verificada.'},
 prensa_dia:{g:'Prensa',t:'Notas por día de la semana',u:'notas',f:{per:1,amb:1,q:1},fn:()=>{const m=cuenta(filtraNotas().filter(n=>n.ts),n=>new Date(n.ts).getDay());return m.map(x=>({l:DIAS[+x.l],v:x.v,o:(+x.l+6)%7}))},fijo:1,orden:1},
 terminos:{g:'Prensa',t:'Palabras que yo elija',u:'notas',f:{per:1,amb:1,terms:1},fn:()=>{const ts=C.terms.split(',').map(s=>fold(s).trim()).filter(Boolean),raw=C.terms.split(',').map(s=>s.trim()).filter(Boolean),lim=C.per?Date.now()-C.per*DAY:0;if(!ts.length)return[];
   const L=notas().filter(n=>(!lim||n.ts>=lim)&&(!C.amb||(C.amb==='sal'?n.cat==='Provincial':n.cat==='Nacional'))),m=ts.map(()=>0);
   L.forEach(n=>{for(let i=0;i<ts.length;i++){if(n.f.includes(ts[i])){m[i]++;if(C.uno)break}}});return ts.map((t,i)=>({l:raw[i],v:m[i]}))},fijo:1,nota:'Cuenta las notas cuyo título contiene cada palabra o frase. Con «cada nota una sola vez» activado, una nota que tiene varias palabras se asigna a la primera que escribiste.'},
 menc_persona:{g:'Personas',t:'Personas más mencionadas',u:'menciones',f:{per:1},fn:()=>{const lim=C.per?Date.now()-C.per*DAY:0;return personas.map(p=>({l:p.nombre,v:(PM[p.id]||[]).filter(okPrec).filter(m=>!lim||(+m._d||0)>=lim).length}))}},
 pers_vig:{g:'Personas',t:'Personas por vigencia',u:'personas',f:{},fn:()=>cuenta(personas,p=>p.v===1?'Vigentes':p.v===0?'No vigentes':'Sin dato de vigencia'),fijo:1},
 pers_inst:{g:'Personas',t:'Personas por institución',u:'personas',f:{},fn:()=>cuenta(personas,p=>{const c=(p.cargos||[])[0];return c&&c.p?(INST[c.p.chamber]||[c.p.chamber])[0]:'Sin dato'})},
 leg_bloque:{g:'Legislativo',t:'Legisladores por bloque',u:'legisladores',f:{cam:1},fn:()=>cuenta(pLg().filter(([p,c])=>!C.cam||c.p.chamber===C.cam),([p,c])=>c.bloque||'Sin dato de bloque')},
 leg_depto:{g:'Legislativo',t:'Legisladores por departamento',u:'legisladores',f:{cam:1},fn:()=>cuenta(pLg().filter(([p,c])=>!C.cam||c.p.chamber===C.cam),([p,c])=>depto(c.p.department||c.lugar)),nota:'El departamento solo figura para quienes tienen ese dato cargado en la nómina; el resto aparece como «Sin dato».'},
 leg_camara:{g:'Legislativo',t:'Legisladores por cámara',u:'legisladores',f:{},fn:()=>cuenta(pLg(),([p,c])=>(INST[c.p.chamber]||[c.p.chamber])[0]),fijo:1},
 evolucion:{g:'Prensa',t:'Evolución semanal de palabras (líneas)',u:'notas',f:{per:1,amb:1,terms:1},linea:1,nota:'Cuenta, semana por semana, las notas cuyo título contiene cada palabra. La última semana puede estar incompleta.'},
 of_fuente:{g:'Publicaciones oficiales',t:'Publicaciones por fuente',u:'publicaciones',f:{per:1},fn:()=>cuenta(ofItems(),x=>x.fuente||'Sin fuente')},
 of_tipo:{g:'Publicaciones oficiales',t:'Publicaciones por tipo de acto',u:'publicaciones',f:{per:1},fn:()=>cuenta(ofItems(),x=>x.tipo_acto||'Sin tipo')},
 of_amb:{g:'Publicaciones oficiales',t:'Publicaciones: Salta vs Nación',u:'publicaciones',f:{per:1},fn:()=>cuenta(ofItems(),x=>/salta/i.test(x.jurisdiccion||'')?'Salta':'Nación'),fijo:1}
};
const depto=x=>{x=String(x||'').trim();if(!x)return'Sin dato de departamento';return/^(capital|ciudad de salta|salta|salta capital)$/i.test(fold(x))?'Capital (ciudad de Salta)':x};
const CAMS=['Senado de la Nación','Diputados de la Nación','Senado','Diputados','Concejo Deliberante'];

/* ---------- Armado de datos ---------- */
const agrupa=(d,max,fijo)=>{d=d.filter(x=>x.v>0);
 if(fijo){if(d.some(x=>x.o!==undefined))d.sort((a,b)=>a.o-b.o);else d.sort((a,b)=>b.v-a.v);if(d.length>8){const r=d.slice(7).reduce((s,x)=>s+x.v,0);d=d.slice(0,7).concat([{l:'Otros ('+(d.length-7)+')',v:r,otros:1}])}return d}
 d.sort((a,b)=>b.v-a.v||String(a.l).localeCompare(String(b.l),'es'));
 if(d.length>max+1||(d.length>max&&max<7)){const r=d.slice(max).reduce((s,x)=>s+x.v,0);d=d.slice(0,max).concat([{l:'Otros ('+(d.length-max)+')',v:r,otros:1}])}
 if(C.ord==='asc'&&!d.some(x=>x.otros))d.reverse();return d};
const colorDe=(d,i)=>{const m=modo();return d.otros?OTROS[m]:PAL[m][i%8]};

/* ---------- Dibujo (SVG único: pantalla, PNG y SVG descargado) ---------- */
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pt=(cx,cy,r,a)=>[cx+r*Math.sin(a),cy-r*Math.cos(a)];
const arco=(cx,cy,r0,r1,a0,a1)=>{const L=a1-a0>Math.PI?1:0,[x0,y0]=pt(cx,cy,r1,a0),[x1,y1]=pt(cx,cy,r1,a1);
 if(r0<=0)return`M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${L} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
 const[x2,y2]=pt(cx,cy,r0,a1),[x3,y3]=pt(cx,cy,r0,a0);return`M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${L} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${L} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`};
const valTxt=(v,tot)=>C.med==='p'?(v/tot*100).toFixed(v/tot<.1?1:0)+'%':nf(v);
const titulo=()=>C.tit.trim()||((SRC[C.src]||{}).t||'Gráfico')+(SRC[C.src]&&SRC[C.src].f.per&&C.per?' · últimos '+C.per+' días':'');
const svgGrafico=(d)=>{const m=modo(),ink=INK[m],soft=SOFT[m],surf=SURF[m],tot=d.reduce((s,x)=>s+x.v,0),S_=SRC[C.src],W=520,fam='Inter,system-ui,sans-serif';
 const tt=titulo(),sub=(S_.u?nf(tot)+' '+S_.u:'')+' · NEWAR · '+fD(Date.now());
 let body='',H;
 if(C.tipo==='barras'){const rowH=28,top=62,lab=190,bw=W-lab-70,mx=Math.max(...d.map(x=>x.v));
  H=top+d.length*rowH+16;
  d.forEach((x,i)=>{const y=top+i*rowH,w=Math.max(2,x.v/mx*bw);
   body+=`<g class="gi" data-i="${i}"><text x="${lab-8}" y="${y+16}" text-anchor="end" font-size="12" fill="${ink}">${xml(cut(x.l,26))}</text><path d="M${lab} ${y+4}h${(w-4).toFixed(1)}a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-${(w-4).toFixed(1)}z" fill="${colorDe(x,i)}"/><text x="${lab+w+6}" y="${y+16}" font-size="12" fill="${soft}">${valTxt(x.v,tot)}${C.med==='p'?'':' · '+(x.v/tot*100).toFixed(x.v/tot<.1?1:0)+'%'}</text><rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/></g>`});
 }else{const cx=W/2,cy=190,R=120,r0=C.tipo==='dona'?70:0;let a=-0;const dos=d.length===1;
  d.forEach((x,i)=>{const sw=x.v/tot*Math.PI*2,a1=a+sw,col=colorDe(x,i);
   body+=dos?`<g class="gi" data-i="${i}"><circle cx="${cx}" cy="${cy}" r="${R}" fill="${col}"/>${r0?`<circle cx="${cx}" cy="${cy}" r="${r0}" fill="${surf}"/>`:''}</g>`:`<g class="gi" data-i="${i}"><path d="${arco(cx,cy,r0,R,a,a1)}" fill="${col}" stroke="${surf}" stroke-width="2" stroke-linejoin="round"/></g>`;
   if(x.v/tot>=.05){const[lx,ly]=pt(cx,cy,R+16,a+sw/2),ls=Math.sin(a+sw/2);body+=`<text x="${lx.toFixed(1)}" y="${(ly+4).toFixed(1)}" text-anchor="${ls>.25?'start':ls<-.25?'end':'middle'}" font-size="12" font-weight="600" fill="${ink}">${(x.v/tot*100).toFixed(x.v/tot<.1?1:0)}%</text>`}
   a=a1});
  if(r0)body+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="26" font-weight="700" fill="${ink}" font-family="Newsreader,Georgia,serif">${nf(tot)}</text><text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="12" fill="${soft}">${xml(S_.u||'')}</text>`;
  const ly0=cy+R+34,rh=22;
  d.forEach((x,i)=>{const y=ly0+i*rh;body+=`<g class="gi" data-i="${i}"><rect x="40" y="${y-10}" width="12" height="12" rx="2" fill="${colorDe(x,i)}"/><text x="60" y="${y}" font-size="12.5" fill="${ink}">${xml(cut(x.l,36))}</text><text x="${W-40}" y="${y}" text-anchor="end" font-size="12.5" fill="${soft}">${nf(x.v)} · ${(x.v/tot*100).toFixed(x.v/tot<.1?1:0)}%</text><rect x="36" y="${y-14}" width="${W-72}" height="${rh}" fill="transparent"/></g>`});
  H=ly0+d.length*rh+10}
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${fam}" role="img" aria-label="${xml(tt)}"><rect width="${W}" height="${H}" fill="${surf}"/><text x="24" y="30" font-size="17" font-weight="700" fill="${ink}" font-family="Newsreader,Georgia,serif">${xml(cut(tt,62))}</text><text x="24" y="48" font-size="11.5" fill="${soft}">${xml(sub)}</text>${body}</svg>`};

const semana=ts=>{const d=new Date(ts);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime()};
const serie=()=>{const raw=C.terms.split(',').map(s=>s.trim()).filter(Boolean).slice(0,5),ts=raw.map(t=>fold(t));if(!ts.length)return null;
 const per=C.per||60,hasta=semana(Date.now()),desde=semana(Date.now()-per*DAY),ws=[];for(let w=desde;w<=hasta;w+=7*DAY){ws.push(w);const d=new Date(w);d.setDate(d.getDate()+0)}
 const vals=ts.map(()=>ws.map(()=>0)),idx=new Map(ws.map((w,i)=>[w,i]));
 notas().filter(n=>n.ts&&n.ts>=desde&&(!C.amb||(C.amb==='sal'?n.cat==='Provincial':n.cat==='Nacional'))).forEach(n=>{const i=idx.get(semana(n.ts));if(i===undefined)return;ts.forEach((t,k)=>{if(n.f.includes(t))vals[k][i]++})});
 return{ws,names:raw,vals}};
const svgLinea=(L)=>{const m=modo(),ink=INK[m],soft=SOFT[m],surf=SURF[m],W=520,H=380,l=44,r=20,t=70,b=120,pw=W-l-r,ph=H-t-b,mx=Math.max(1,...L.vals.flat()),n=L.ws.length,fam='Inter,system-ui,sans-serif';
 const X=i=>l+(n<2?pw/2:i/(n-1)*pw),Y=v=>t+ph-v/mx*ph,tt=titulo(),ft=w=>new Date(w).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
 let g='';for(let k=0;k<=4;k++){const v=Math.round(mx*k/4),y=Y(v);g+=`<line x1="${l}" x2="${W-r}" y1="${y}" y2="${y}" stroke="${soft}" stroke-opacity=".25"/><text x="${l-6}" y="${y+4}" text-anchor="end" font-size="11" fill="${soft}">${v}</text>`}
 const paso=Math.ceil(n/6);L.ws.forEach((w,i)=>{if(i%paso===0||i===n-1)g+=`<text x="${X(i)}" y="${t+ph+16}" text-anchor="middle" font-size="11" fill="${soft}">${ft(w)}</text>`});
 L.names.forEach((nm,k)=>{const col=PAL[m][k%8],pts=L.vals[k].map((v,i)=>[X(i),Y(v)]);g+=`<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${pts.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}"/>`;pts.forEach((q,i)=>{g+=`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5" fill="${col}" stroke="${surf}" stroke-width="2"><title>${xml(nm)} · semana del ${ft(L.ws[i])}: ${L.vals[k][i]}</title></circle>`});
  const ly=t+ph+40+k*20,tot=L.vals[k].reduce((a,x)=>a+x,0);g+=`<rect x="40" y="${ly-10}" width="12" height="12" rx="2" fill="${col}"/><text x="60" y="${ly}" font-size="12.5" fill="${ink}">${xml(cut(nm,30))}</text><text x="${W-40}" y="${ly}" text-anchor="end" font-size="12.5" fill="${soft}">${nf(tot)} en total</text>`});
 const HH=H+Math.max(0,L.names.length-3)*20;
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" font-family="${fam}" role="img" aria-label="${xml(tt)}"><rect width="${W}" height="${HH}" fill="${surf}"/><text x="24" y="30" font-size="17" font-weight="700" fill="${ink}" font-family="Newsreader,Georgia,serif">${xml(cut(tt,62))}</text><text x="24" y="48" font-size="11.5" fill="${soft}">Notas por semana (lunes de cada semana) · NEWAR · ${fD(Date.now())}</text>${g}</svg>`};

/* ---------- Pantalla ---------- */
const css=document.createElement('style');css.textContent=`
.gf{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.7rem;margin:.6rem 0 1rem}.gf label{display:flex;flex-direction:column;gap:.2rem;font-size:.78rem;color:var(--soft)}.gf input,.gf select{font:inherit;font-size:.9rem;padding:.45rem .6rem;border:1px solid var(--ink);background:var(--raised);color:var(--ink);min-width:0}.gf .chk{flex-direction:row;align-items:center;gap:.4rem}
.gid{display:flex;flex-wrap:wrap;gap:.35rem;margin:.3rem 0 .9rem}.gid button,.gac button,.gsv button{font:inherit;font-size:.82rem;padding:.3rem .75rem;border:1px solid var(--line);border-radius:99px;background:var(--raised);color:var(--ink);cursor:pointer}.gid button:hover,.gac button:hover{border-color:var(--ink)}
.gac{display:flex;flex-wrap:wrap;gap:.4rem;margin:.8rem 0}.gac button.pri{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.gch{max-width:560px;margin:0 auto;border:1px solid var(--line);background:var(--raised)}.gch svg{display:block;width:100%;height:auto}.gch .gi{cursor:default}.gch .gi.dim{opacity:.35}
#gtip{position:fixed;z-index:50;pointer-events:none;background:var(--ink);color:var(--paper);font-size:.8rem;padding:.3rem .55rem;border-radius:3px;display:none;max-width:16rem}
.gsv{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}.gsv span{display:inline-flex;gap:.2rem;align-items:center}.gsv .x{border:0;background:none;padding:0 .3rem;color:var(--soft)}
.gtb{width:100%;border-collapse:collapse;font-size:.85rem;margin:.4rem 0}.gtb th,.gtb td{text-align:left;padding:.3rem .4rem;border-bottom:1px solid var(--line)}.gtb td:nth-child(n+2),.gtb th:nth-child(n+2){text-align:right}`;
document.head.appendChild(css);

const opt=(v,t,cur)=>`<option value="${esc(v)}"${String(v)===String(cur)?' selected':''}>${esc(t)}</option>`;
const IDEAS=[['Qué medios publican más',{src:'prensa_medio',tipo:'dona',per:30}],['Tono de las notas',{src:'prensa_tono',tipo:'torta',per:30}],['Salta vs Nación',{src:'prensa_ambito',tipo:'torta',per:30}],['Notas por poder',{src:'prensa_poder',tipo:'dona',per:30}],['Legisladores por bloque',{src:'leg_bloque',tipo:'torta',max:7}],['Personas más mencionadas',{src:'menc_persona',tipo:'barras',per:30,max:8}],['Publicaciones oficiales por fuente',{src:'of_fuente',tipo:'dona',per:30}],['Evolución de temas',{src:'evolucion',per:60,terms:'minería, salud, educación, seguridad'}]];
const form=()=>{const s=SRC[C.src],f=s.f,gr={};Object.entries(SRC).forEach(([k,v])=>(gr[v.g]=gr[v.g]||[]).push([k,v.t]));
 return`<div class="gid" role="group" aria-label="Ideas rápidas"><span class="note" style="align-self:center">Ideas:</span>${IDEAS.map((x,i)=>`<button type="button" data-idea="${i}">${esc(x[0])}</button>`).join('')}</div>
 <div class="gf" id="gform"><label>¿Qué querés medir?<select data-k="src">${Object.entries(gr).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(([k,t])=>opt(k,t,C.src)).join('')}</optgroup>`).join('')}</select></label>
 ${s.linea?'':`<label>Tipo de gráfico<select data-k="tipo">${opt('torta','Torta',C.tipo)}${opt('dona','Dona',C.tipo)}${opt('barras','Barras',C.tipo)}</select></label>`}
 ${f.per?`<label>Período<select data-k="per" data-n="1">${opt(7,'Últimos 7 días',C.per)}${opt(30,'Últimos 30 días',C.per)}${opt(60,'Últimos 60 días',C.per)}${opt(0,'Todo lo cargado',C.per)}</select></label>`:''}
 ${f.amb?`<label>Ámbito de los medios<select data-k="amb">${opt('','Todos',C.amb)}${opt('sal','Medios de Salta',C.amb)}${opt('nac','Medios nacionales',C.amb)}</select></label>`:''}
 ${f.cam?`<label>Cámara<select data-k="cam">${opt('','Todas',C.cam)}${CAMS.map(k=>opt(k,(INST[k]||[k])[0],C.cam)).join('')}</select></label>`:''}
 ${f.q?`<label>Solo notas que contengan…<input type="search" data-k="q" value="${esc(C.q)}" placeholder="ej.: minería" autocomplete="off"></label>`:''}
 ${f.terms?`<label style="grid-column:1/-1">Palabras a comparar (separadas por coma${s.linea?', hasta 5':''})<input type="text" data-k="terms" value="${esc(C.terms)}" placeholder="ej.: minería, salud, educación, seguridad" autocomplete="off"></label>${s.linea?'':`<label class="chk"><input type="checkbox" data-k="uno" data-b="1"${C.uno?' checked':''}> Cada nota cuenta una sola vez</label>`}`:''}
 ${s.fijo||s.linea?'':`<label>Porciones máximas<select data-k="max" data-n="1">${[3,4,5,6,7].map(n=>opt(n,n+' (el resto va a «Otros»)',C.max)).join('')}</select></label>`}
 ${s.linea?'':`<label>Mostrar<select data-k="med">${opt('n','Cantidades',C.med)}${opt('p','Porcentajes',C.med)}</select></label>`}
 <label style="grid-column:1/-1">Título (opcional)<input type="text" data-k="tit" value="${esc(C.tit)}" placeholder="Si lo dejás vacío se arma solo" autocomplete="off"></label></div>`};
const guardados=()=>{const l=gLs();return l.length?`<h3 class="sh">Mis gráficos guardados</h3><div class="gsv">${l.map((x,i)=>`<span><button type="button" data-ld="${i}">${esc(cut(x.name,40))}</button><button type="button" class="x" data-rm="${i}" aria-label="Borrar ${esc(x.name)}">✕</button></span>`).join('')}</div><p class="note">Se guardan solo en este navegador.</p>`:''};
const cobertura=()=>{const l=notas().filter(n=>n.ts);if(!l.length)return'';let a=Infinity,b=0;l.forEach(n=>{if(n.ts<a)a=n.ts;if(n.ts>b)b=n.ts});const dias=Math.round((b-a)/DAY),corto=C.per&&dias<C.per*0.8;return`<p class="note">Las notas cargadas van del ${fD(a)} al ${fD(b)} (${dias} días).${corto?' <b>Ojo:</b> pediste '+C.per+' días pero NEWAR solo tiene '+dias+'; el gráfico muestra únicamente lo disponible.':''}</p>`};
const chartLinea=()=>{const box=Q('#gout');if(!box)return;LASTL=null;LAST=null;
 if(!C.terms.trim()){box.innerHTML='<p class="empty">Escribí arriba hasta 5 palabras separadas por coma (ej.: minería, salud, educación).</p>';return}
 const L=serie();LASTL=L;if(!L||!L.vals.some(v=>v.some(x=>x>0))){box.innerHTML='<p class="empty" role="status">Ninguna de esas palabras aparece en los títulos del período.</p>';return}
 box.innerHTML=`<div class="gch" id="gsvg">${svgLinea(L)}</div>${accs()}<p class="note">${esc(SRC[C.src].nota)}</p>${cobertura()}`};
const accs=()=>`<div class="gac"><button type="button" class="pri" data-ac="png">Descargar imagen (PNG)</button><button type="button" data-ac="svg">Descargar SVG</button><button type="button" data-ac="csv">Descargar CSV</button><button type="button" data-ac="save">Guardar esta configuración</button><button type="button" data-ac="link">Copiar enlace</button></div>`;
const chart=()=>{const s=SRC[C.src];if(s.linea)return chartLinea();LASTL=null;let d;try{d=agrupa(s.fn(),C.max,s.fijo)}catch(e){console.error('NEWAR Gráficos',e);d=[]}
 LAST=d;const box=Q('#gout');if(!box)return;
 if(C.src==='terminos'&&!C.terms.trim()){box.innerHTML='<p class="empty">Escribí arriba las palabras que quieras comparar, separadas por coma.</p>';return}
 if(!d.length){box.innerHTML='<p class="empty" role="status">No hay datos para esta combinación. Probá con un período más largo o sacá el filtro.</p>';return}
 const tot=d.reduce((a,x)=>a+x.v,0);
 box.innerHTML=`<div class="gch" id="gsvg">${svgGrafico(d)}</div>
 ${accs()}
 ${s.nota?`<p class="note">${esc(s.nota)}</p>`:''}
 ${s.u==='notas'?cobertura():''}
 <details><summary class="note">Ver los números en tabla</summary><table class="gtb"><thead><tr><th>Categoría</th><th>${esc(s.u||'Valor')}</th><th>%</th></tr></thead><tbody>${d.map(x=>`<tr><td>${esc(x.l)}</td><td>${nf(x.v)}</td><td>${(x.v/tot*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></details>`};
const dibuja=()=>{const f=Q('#gformbox');if(f)f.innerHTML=form();chart();const g=Q('#gsave');if(g)g.innerHTML=guardados()};
const archivo=()=>{if(ES.arc&&ES.arc.length)return;arcLoad().then(()=>{GN=null;if(Q('#gout'))chart()})};

V.graficos=(id)=>{if(id){try{const c=JSON.parse(decodeURIComponent(escape(atob(id))));if(c&&SRC[c.src])C=Object.assign({},DEF,c)}catch(e){}}setTimeout(async()=>{try{await need('news','of')}catch(e){}if(!Q('#gout'))return;dibuja();archivo()},0);
 return`<h2 class="sec">Generador de gráficos</h2><p class="lede">Elegí qué querés medir y NEWAR arma una torta, una dona o un gráfico de barras con los datos que ya tiene cargados. Podés descargarlo como imagen, bajar los números o guardar la configuración para repetirlo.</p><div id="gformbox"></div><div id="gout"><p class="empty" role="status">Cargando…</p></div><div id="gsave"></div><div id="gtip" role="tooltip"></div>`};
if(typeof NEEDS!=='undefined')NEEDS.graficos=['news','of'];
if(!TABS.some(t=>t[0]==='graficos')){const i=TABS.findIndex(t=>t[0]==='estadisticas');TABS.splice(i<0?TABS.length:i+1,0,['graficos','Gráficos'])}

/* ---------- Eventos ---------- */
const bajar=(name,blob)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
const slug=s=>fold(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'grafico';
const enlace=()=>{const j=btoa(unescape(encodeURIComponent(JSON.stringify(C)))),u=location.href.split('#')[0]+'#/graficos/'+encodeURIComponent(j);
 (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(u):Promise.reject()).then(()=>alert('Enlace copiado. Quien lo abra ve este mismo gráfico.')).catch(()=>prompt('Copiá este enlace:',u))};
const accion=a=>{if(a==='link')return enlace();if(LASTL){const svg=svgLinea(LASTL),nom='newar-'+slug(titulo());
  if(a==='svg')return bajar(nom+'.svg',new Blob([svg],{type:'image/svg+xml'}));
  if(a==='csv')return typeof bajarCSV==='function'?bajarCSV(nom+'.csv',[['Semana (lunes)'].concat(LASTL.names)].concat(LASTL.ws.map((w,i)=>[dayK(w)].concat(LASTL.vals.map(v=>v[i]))))):0;
  if(a==='png')return png(svg,nom);if(a==='save')return guarda()}
 if(!LAST)return;const svg=svgGrafico(LAST),nom='newar-'+slug(titulo());
 if(a==='svg')return bajar(nom+'.svg',new Blob([svg],{type:'image/svg+xml'}));
 if(a==='csv'){const tot=LAST.reduce((s,x)=>s+x.v,0);const rows=[['Categoría',(SRC[C.src].u||'Valor'),'Porcentaje']].concat(LAST.map(x=>[x.l,x.v,(x.v/tot*100).toFixed(1)+'%']));return typeof bajarCSV==='function'?bajarCSV(nom+'.csv',rows):0}
 if(a==='png')return png(svg,nom);
 if(a==='save')return guarda()};
const dayK=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const guarda=()=>{const n=prompt('¿Con qué nombre lo guardás?',titulo());if(!n)return;const l=gLs();l.push({name:n,cfg:Object.assign({},C)});sLs(l.slice(-20));const g=Q('#gsave');if(g)g.innerHTML=guardados()};
const png=(svg,nom)=>{const m=svg.match(/viewBox="0 0 (\d+) (\d+)"/),w=+m[1],h=+m[2],img=new Image(),u='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  img.onload=()=>{const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const x=cv.getContext('2d');x.scale(2,2);x.drawImage(img,0,0,w,h);cv.toBlob(b=>b&&bajar(nom+'.png',b),'image/png')};img.onerror=()=>{alert('No se pudo armar la imagen. Probá con «Descargar SVG».')};img.src=u};
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#gformbox button,#gout button,#gsave button');if(!t)return;
 if(t.dataset.idea!==undefined){C=Object.assign({},DEF,IDEAS[+t.dataset.idea][1]);return dibuja()}
 if(t.dataset.ac)return accion(t.dataset.ac);
 if(t.dataset.ld!==undefined){const x=gLs()[+t.dataset.ld];if(x){C=Object.assign({},DEF,x.cfg);dibuja();scrollTo(0,0)}return}
 if(t.dataset.rm!==undefined){const l=gLs();l.splice(+t.dataset.rm,1);sLs(l);const g=Q('#gsave');if(g)g.innerHTML=guardados()}});
const cambio=e=>{const el=e.target;if(!el.closest||!el.closest('#gform')||!el.dataset.k)return;const k=el.dataset.k;
 C[k]=el.dataset.b?(el.checked?1:0):el.dataset.n?+el.value:el.value;
 if(k==='src'){const keep={tipo:C.tipo,med:C.med};C=Object.assign({},DEF,keep,{src:el.value});return dibuja()}
 chart()};
document.addEventListener('change',cambio);
document.addEventListener('input',e=>{if(e.target&&e.target.type!=='checkbox'&&e.target.tagName!=='SELECT')cambio(e)});
/* tooltip y resaltado */
document.addEventListener('mousemove',e=>{const tip=Q('#gtip');if(!tip)return;const g=e.target.closest&&e.target.closest('#gsvg .gi');
 document.querySelectorAll('#gsvg .gi.dim').forEach(x=>x.classList.remove('dim'));
 if(!g||!LAST){tip.style.display='none';return}
 const i=+g.dataset.i,x=LAST[i],tot=LAST.reduce((s,y)=>s+y.v,0);if(!x){tip.style.display='none';return}
 document.querySelectorAll('#gsvg .gi').forEach(y=>{if(y!==g&&y.dataset.i!==g.dataset.i)y.classList.add('dim')});
 tip.textContent=x.l+': '+nf(x.v)+' ('+(x.v/tot*100).toFixed(1)+'%)';tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(e.clientY+14)+'px'});
})();
