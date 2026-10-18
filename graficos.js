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
const modo=()=>{if(C.fondo==='l')return'l';if(C.fondo==='d')return'd';const t=document.documentElement.getAttribute('data-theme');if(t==='dark')return'd';if(t==='light')return'l';return matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'d':'l'};
const nf=n=>Number(n).toLocaleString('es-AR');
const fD=ts=>ts?new Date(ts).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}):'';
const cut=(s,n)=>{s=String(s);return s.length>n?s.slice(0,n-1)+'…':s};

/* ---------- Configuración ---------- */
const DEF={src:'prensa_medio',tipo:'dona',per:30,amb:'',q:'',terms:'',uno:1,max:6,cam:'',med:'n',tit:'',ord:'desc',fondo:''};
let C=Object.assign({},DEF),LAST=null,LASTL=null,LASTC=null,LASTX=null;
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
const win=()=>{const now=Date.now(),off=C.off||0;return C.per?[now-(off+C.per)*DAY,now-off*DAY]:[0,Infinity]};
const filtraNotas=()=>{const W=win(),q=fold(C.q||'').trim();
 return notas().filter(n=>n.ts>=W[0]&&n.ts<W[1]&&(!C.amb||(C.amb==='sal'?n.cat==='Provincial':n.cat==='Nacional'))&&(!q||n.f.includes(q)))};
const cuenta=(l,fn)=>{const m={};l.forEach(x=>{const k=fn(x);if(k===null||k===undefined||k==='')return;m[k]=(m[k]||0)+1});return Object.entries(m).map(([l,v])=>({l,v}))};

const RXP=[['Poder Judicial',/\b(juez|jueza|jueces|fiscal\w*|corte suprema|poder judicial|tribunal\w*|justicia|juicio|imputad\w+|procesad\w+|sentencia|fallo|camarista\w*|magistrad\w+|procurador\w*)\b/],
 ['Poder Legislativo',/\b(senador\w*|senado|diputad[oa]s?|legislatur\w+|legislativ\w+|concejo deliberante|concejal\w*|proyecto de ley|media sancion|bancas?|ordenanzas?)\b/],
 ['Poder Ejecutivo',/\b(gobernador\w*|gobierno|ministr[oa]s?|ministerio|gabinete|decreto|dnu|milei|saenz|casa rosada|intendente|adorni|caputo|secretari[oa])\b/]];
const DIAS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const TONO={positivo:'Positivo',neutral:'Neutral',negativo:'Negativo','sin tono':'Sin tono'};

/* ---------- Fuentes de datos ---------- */
const pLg=()=>personas.map(p=>[p,(p.cargos||[]).find(c=>c.v===1&&c.p&&c.p.chamber!=='Ejecutivo')]).filter(x=>x[1]);
const ofItems=()=>{const W=win();return((S.of&&S.of.items)||[]).filter(x=>{const ts=Date.parse(x.fecha_publicacion||'')||Date.parse(x.first_seen||'')||0;return ts>=W[0]&&ts<W[1]})};
const SRC={
 prensa_medio:{g:'Prensa',t:'Notas por medio',u:'notas',f:{per:1,amb:1,q:1},fn:()=>cuenta(filtraNotas(),n=>n.mn)},
 prensa_tono:{g:'Prensa',t:'Notas por tono',tono:1,u:'notas',f:{per:1,amb:1,q:1},fn:()=>cuenta(filtraNotas(),n=>TONO[n.sent]||n.sent),fijo:1},
 menc_elegidas:{g:'Personas',t:'Menciones de personas que yo elija',u:'menciones',f:{per:1,terms:1},nombres:1,fijo:1,fn:()=>{const W=win(),raw=C.terms.split(',').map(x=>x.trim()).filter(Boolean);return raw.map(nm=>{const f=fold(nm);return{l:nm,v:personas.filter(p=>fold(p.nombre).includes(f)).reduce((q,p)=>q+(PM[p.id]||[]).filter(okPrec).filter(m=>{const t=+m._d||0;return t>=W[0]&&t<W[1]}).length,0)}})},nota:'Suma las menciones de todas las personas cuyo nombre contiene lo que escribiste (por ejemplo «Sáenz» puede incluir a más de una persona). Para ver una sola, escribí nombre y apellido.'},
 evolucion_personas:{g:'Personas',t:'Evolución semanal de menciones de personas (líneas)',u:'menciones',f:{per:1,terms:1},nombres:1,linea:1,pers:1,nota:'Menciones por semana de las personas cuyo nombre contiene lo que escribiste. Solo cuentan menciones con coincidencia de nombre suficientemente precisa.'},
 cruce_medio_tono:{g:'Prensa',t:'Medios × tono (barras apiladas)',u:'notas',f:{per:1,amb:1,q:1},cruce:1,nota:'Muestra, para los medios que más publican, qué parte de sus notas tiene tono positivo, neutral o negativo según el recolector. Es una pista basada en el titular, no un juicio.'},
 prensa_ambito:{g:'Prensa',t:'Notas: Salta vs Nación',u:'notas',f:{per:1,q:1},fn:()=>{const a=C.amb;C.amb='';const l=filtraNotas();C.amb=a;return cuenta(l,n=>n.cat==='Provincial'?'Medios de Salta':n.cat==='Nacional'?'Medios nacionales':'Otros')},fijo:1},
 prensa_poder:{g:'Prensa',t:'Notas por poder (Ejecutivo, Legislativo, Judicial)',u:'notas',f:{per:1,amb:1,q:1},fn:()=>cuenta(filtraNotas(),n=>{for(const[k,rx]of RXP)if(rx.test(n.f))return k;return'Otros temas'}),fijo:1,nota:'Cada nota se cuenta una sola vez, en el primer poder cuyas palabras aparecen en el título (orden: Judicial, Legislativo, Ejecutivo). Es una pista por palabras, no una clasificación verificada.'},
 prensa_dia:{g:'Prensa',t:'Notas por día de la semana',u:'notas',f:{per:1,amb:1,q:1},fn:()=>{const m=cuenta(filtraNotas().filter(n=>n.ts),n=>new Date(n.ts).getDay());return m.map(x=>({l:DIAS[+x.l],v:x.v,o:(+x.l+6)%7}))},fijo:1,orden:1},
 terminos:{g:'Prensa',t:'Palabras que yo elija',u:'notas',f:{per:1,amb:1,terms:1},fn:()=>{const ts=C.terms.split(',').map(s=>fold(s).trim()).filter(Boolean),raw=C.terms.split(',').map(s=>s.trim()).filter(Boolean),W=win();if(!ts.length)return[];
   const L=notas().filter(n=>n.ts>=W[0]&&n.ts<W[1]&&(!C.amb||(C.amb==='sal'?n.cat==='Provincial':n.cat==='Nacional'))),m=ts.map(()=>0);
   L.forEach(n=>{for(let i=0;i<ts.length;i++){if(n.f.includes(ts[i])){m[i]++;if(C.uno)break}}});return ts.map((t,i)=>({l:raw[i],v:m[i]}))},fijo:1,nota:'Cuenta las notas cuyo título contiene cada palabra o frase. Con «cada nota una sola vez» activado, una nota que tiene varias palabras se asigna a la primera que escribiste.'},
 menc_persona:{g:'Personas',t:'Personas más mencionadas',u:'menciones',f:{per:1},fn:()=>{const W=win();return personas.map(p=>({l:p.nombre,v:(PM[p.id]||[]).filter(okPrec).filter(m=>{const t=+m._d||0;return t>=W[0]&&t<W[1]}).length}))}},
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
const TC2={Positivo:'#4c7a5d',Neutral:'#9a968e',Negativo:'#b04a4a','Sin tono':'#c9c4b9'};
const colorDe=(d,i)=>{const m=modo();return d.otros?OTROS[m]:(SRC[C.src]&&SRC[C.src].tono&&TC2[d.l])||PAL[m][i%8]};

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
 if(SRC[C.src].pers){ts.forEach((t,k)=>personas.filter(p=>fold(p.nombre).includes(t)).forEach(p=>(PM[p.id]||[]).filter(okPrec).forEach(m=>{const tt=+m._d||0;if(tt<desde)return;const i=idx.get(semana(tt));if(i!==undefined)vals[k][i]++})))}
 else notas().filter(n=>n.ts&&n.ts>=desde&&(!C.amb||(C.amb==='sal'?n.cat==='Provincial':n.cat==='Nacional'))).forEach(n=>{const i=idx.get(semana(n.ts));if(i===undefined)return;ts.forEach((t,k)=>{if(n.f.includes(t))vals[k][i]++})});
 return{ws,names:raw,vals}};
const svgLinea=(L)=>{const m=modo(),ink=INK[m],soft=SOFT[m],surf=SURF[m],W=520,H=380,l=44,r=20,t=70,b=120,pw=W-l-r,ph=H-t-b,mx=Math.max(1,...L.vals.flat()),n=L.ws.length,fam='Inter,system-ui,sans-serif';
 const X=i=>l+(n<2?pw/2:i/(n-1)*pw),Y=v=>t+ph-v/mx*ph,tt=titulo(),ft=w=>new Date(w).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
 let g='';for(let k=0;k<=4;k++){const v=Math.round(mx*k/4),y=Y(v);g+=`<line x1="${l}" x2="${W-r}" y1="${y}" y2="${y}" stroke="${soft}" stroke-opacity=".25"/><text x="${l-6}" y="${y+4}" text-anchor="end" font-size="11" fill="${soft}">${v}</text>`}
 const paso=Math.ceil(n/6);L.ws.forEach((w,i)=>{if(i%paso===0||i===n-1)g+=`<text x="${X(i)}" y="${t+ph+16}" text-anchor="middle" font-size="11" fill="${soft}">${ft(w)}</text>`});
 L.names.forEach((nm,k)=>{const col=PAL[m][k%8],pts=L.vals[k].map((v,i)=>[X(i),Y(v)]);g+=`<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${pts.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}"/>`;pts.forEach((q,i)=>{g+=`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5" fill="${col}" stroke="${surf}" stroke-width="2"><title>${xml(nm)} · semana del ${ft(L.ws[i])}: ${L.vals[k][i]}</title></circle>`});
  const ly=t+ph+40+k*20,tot=L.vals[k].reduce((a,x)=>a+x,0);g+=`<rect x="40" y="${ly-10}" width="12" height="12" rx="2" fill="${col}"/><text x="60" y="${ly}" font-size="12.5" fill="${ink}">${xml(cut(nm,30))}</text><text x="${W-40}" y="${ly}" text-anchor="end" font-size="12.5" fill="${soft}">${nf(tot)} en total</text>`});
 const HH=H+Math.max(0,L.names.length-3)*20;
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" font-family="${fam}" role="img" aria-label="${xml(tt)}"><rect width="${W}" height="${HH}" fill="${surf}"/><text x="24" y="30" font-size="17" font-weight="700" fill="${ink}" font-family="Newsreader,Georgia,serif">${xml(cut(tt,62))}</text><text x="24" y="48" font-size="11.5" fill="${soft}">Notas por semana (lunes de cada semana) · NEWAR · ${fD(Date.now())}</text>${g}</svg>`};

const pctTxt=(a,b)=>b?((a>=b?'▲ ':'▼ ')+Math.abs(Math.round((a-b)/b*100))+'%'):(a?'nuevo':'—');
const svgComparar=(R)=>{const m=modo(),ink=INK[m],soft=SOFT[m],surf=SURF[m],W=520,top=84,rh=46,lab=150,bw=W-lab-100,mx=Math.max(1,...R.rows.map(x=>Math.max(x.v,x.p))),H=top+R.rows.length*rh+16,tt=titulo(),c1=PAL[m][0],c2=m==='d'?'#7b766d':'#b9b2a5',fam='Inter,system-ui,sans-serif';
 let g=`<rect x="24" y="58" width="12" height="12" rx="2" fill="${c1}"/><text x="42" y="68" font-size="12" fill="${ink}">Últimos ${C.per} días</text><rect x="190" y="58" width="12" height="12" rx="2" fill="${c2}"/><text x="208" y="68" font-size="12" fill="${ink}">${C.per} días anteriores</text>`;
 R.rows.forEach((x,i)=>{const y=top+i*rh,w1=Math.max(2,x.v/mx*bw),w2=Math.max(2,x.p/mx*bw);
  g+=`<g class="gi" data-i="${i}"><text x="${lab-8}" y="${y+20}" text-anchor="end" font-size="12" fill="${ink}">${xml(cut(x.l,24))}</text><rect x="${lab}" y="${y+4}" width="${w1.toFixed(1)}" height="14" rx="3" fill="${c1}"/><rect x="${lab}" y="${y+22}" width="${w2.toFixed(1)}" height="14" rx="3" fill="${c2}"/><text x="${lab+Math.max(w1,w2)+6}" y="${y+19}" font-size="12" fill="${ink}">${nf(x.v)} vs ${nf(x.p)}</text><text x="${lab+Math.max(w1,w2)+6}" y="${y+35}" font-size="11.5" fill="${soft}">${pctTxt(x.v,x.p)}</text></g>`});
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${fam}" role="img" aria-label="${xml(tt)}"><rect width="${W}" height="${H}" fill="${surf}"/><text x="24" y="30" font-size="17" font-weight="700" fill="${ink}" font-family="Newsreader,Georgia,serif">${xml(cut(tt,62))}</text><text x="24" y="48" font-size="11.5" fill="${soft}">Comparación con el período anterior · NEWAR · ${fD(Date.now())}</text>${g}</svg>`};
const TCOL={positivo:'#4c7a5d',neutral:'#9a968e',negativo:'#b04a4a'};
const svgCruce=(R)=>{const m=modo(),ink=INK[m],soft=SOFT[m],surf=SURF[m],W=520,top=84,rh=30,lab=150,bw=W-lab-70,H=top+R.rows.length*rh+16,tt=titulo(),fam='Inter,system-ui,sans-serif';
 let g=['positivo','neutral','negativo'].map((k,i)=>`<rect x="${24+i*110}" y="58" width="12" height="12" rx="2" fill="${TCOL[k]}"/><text x="${42+i*110}" y="68" font-size="12" fill="${ink}">${TONO[k]}</text>`).join('');
 R.rows.forEach((x,i)=>{const y=top+i*rh;let cx=lab;g+=`<g class="gi" data-i="${i}"><text x="${lab-8}" y="${y+17}" text-anchor="end" font-size="12" fill="${ink}">${xml(cut(x.l,24))}</text>`;
  ['positivo','neutral','negativo'].forEach(k=>{const w=x[k]/x.tot*bw;if(w>0){g+=`<rect x="${cx.toFixed(1)}" y="${y+4}" width="${Math.max(w-2,1).toFixed(1)}" height="18" fill="${TCOL[k]}"><title>${xml(x.l)} · ${TONO[k]}: ${x[k]} (${(x[k]/x.tot*100).toFixed(0)}%)</title></rect>`;cx+=w}});
  g+=`<text x="${lab+bw+6}" y="${y+17}" font-size="12" fill="${soft}">${nf(x.tot)}</text></g>`});
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${fam}" role="img" aria-label="${xml(tt)}"><rect width="${W}" height="${H}" fill="${surf}"/><text x="24" y="30" font-size="17" font-weight="700" fill="${ink}" font-family="Newsreader,Georgia,serif">${xml(cut(tt,62))}</text><text x="24" y="48" font-size="11.5" fill="${soft}">Proporción de tono por medio (100% = notas del medio) · NEWAR · ${fD(Date.now())}</text>${g}</svg>`};
/* lectura rápida: frases calculadas con los mismos datos del gráfico */
const lectura=(d,s)=>{const tot=d.reduce((a,x)=>a+x.v,0),r=[];if(!tot)return'';const real=d.filter(x=>!x.otros),p=x=>(x.v/tot*100).toFixed(x.v/tot<.1?1:0)+'%';
 const a=real[0];if(a)r.push(`<b>${esc(a.l)}</b> es lo más frecuente: ${nf(a.v)} de ${nf(tot)} ${esc(s.u||'')} (${p(a)}).`);
 if(real.length>=3){const t3=real.slice(0,3).reduce((q,x)=>q+x.v,0);r.push(`Las 3 primeras categorías concentran el ${(t3/tot*100).toFixed(0)}%.`)}
 const o=d.find(x=>x.otros);if(o)r.push(`${esc(o.l)} suma ${p(o)}: si querés verlas, subí «Porciones máximas».`);
 const sd=d.find(x=>/^sin dato/i.test(x.l));if(sd&&sd.v/tot>=.1)r.push(`Ojo: ${p(sd)} no tiene dato cargado en esta categoría, así que la foto está incompleta.`);
 if(d.length===2&&a)r.push(`Con solo dos categorías conviene mirar los números, no el dibujo.`);
 return r.length?`<div class="pdav" role="note"><b>Lectura rápida</b><ul style="margin:.3rem 0 0;padding-left:1.1rem">${r.map(x=>`<li>${x}</li>`).join('')}</ul></div>`:''};
const lecturaComp=(R)=>{const r=[],rows=R.rows.filter(x=>x.v||x.p);if(!rows.length)return'';const rows2=rows.filter(x=>!/^Otros \(/.test(x.l)),sub=rows2.filter(x=>x.p>=3&&x.v>x.p).sort((a,b)=>(b.v-b.p)-(a.v-a.p))[0],baj=rows2.filter(x=>x.p>=3&&x.v<x.p).sort((a,b)=>(a.v-a.p)-(b.v-b.p))[0],nue=rows2.filter(x=>x.p===0&&x.v>=3)[0];
 const T=rows.reduce((q,x)=>q+x.v,0),P=rows.reduce((q,x)=>q+x.p,0);r.push(`En total: ${nf(T)} ahora vs ${nf(P)} antes (${pctTxt(T,P)}).`);
 if(sub)r.push(`Sube más: <b>${esc(sub.l)}</b> (${nf(sub.p)} → ${nf(sub.v)}).`);if(baj)r.push(`Baja más: <b>${esc(baj.l)}</b> (${nf(baj.p)} → ${nf(baj.v)}).`);if(nue)r.push(`Aparece como novedad: <b>${esc(nue.l)}</b> (${nf(nue.v)}, antes 0).`);
 return`<div class="pdav" role="note"><b>Lectura rápida</b><ul style="margin:.3rem 0 0;padding-left:1.1rem">${r.map(x=>`<li>${x}</li>`).join('')}</ul></div>`};

/* ---------- «Pedilo con tus palabras» ---------- */
const EJEMPLOS=['torta de los medios de los últimos 7 días','dona del tono de las notas del último mes','evolución de minería, salud y educación','barras de menciones de Sáenz, Orozco','comparar medios con la semana anterior','legisladores por bloque en torta'];
const cortaTerm=t=>t.split(/\b(?:ultim\w*|en los|durante|desde|por semana|en torta|en barras|en dona|con barras|como torta|con la semana|en el periodo|de los|de las)\b/i)[0];
const lista=x=>x.split(/,|;|\sy\s|\se\s/i).map(q=>q.replace(/[.:"«»]/g,'').trim()).filter(q=>q.length>1).slice(0,5);
const parsea=(txt)=>{const t=fold(txt),cfg={},ent=[];let src=null;
 let terms=[];const m=txt.match(/(?:palabras?|terminos?|temas?|sobre|menciones? (?:de|del|de la|a)|nombres?|evolucion de|evolución de|comparar|compara)\s*:?\s+([^\n]+)/i);
 if(m){const c=cortaTerm(m[1]);const l=lista(c);if(l.length&&!/^(los|las|medios?|notas|el|la|mas|más|top|principales|mencionad\w*)\b/i.test(l[0]))terms=l}
 const evo=/evolucion|semana a semana|por semana|linea|tendencia|como (cambia|vario|evoluciono)/.test(t);
 if(evo&&terms.length)src=/persona|mencion|nombre/.test(t)&&!/palabra|tema/.test(t)?'evolucion_personas':'evolucion';
 else if(terms.length&&/mencion|persona|nombre|polit/.test(t)&&!/palabra|tema|notas/.test(t))src='menc_elegidas';
 else if(terms.length&&!/medio|bloque|oficial|camara|vigen/.test(t))src='terminos';
 else if(/tono|positiv|negativ/.test(t))src=/por medio|cada medio|segun el medio|de cada diario/.test(t)?'cruce_medio_tono':'prensa_tono';
 else if(/oficial|publicacion|boletin/.test(t))src=/tipo/.test(t)?'of_tipo':/\bvs\b|ambito|contra/.test(t)?'of_amb':'of_fuente';
 else if(/salta (vs|contra|y) nacion|nacion (vs|contra|y) salta|ambito/.test(t))src='prensa_ambito';
 else if(/bloque/.test(t))src='leg_bloque';else if(/departamento/.test(t))src='leg_depto';else if(/camara/.test(t))src='leg_camara';
 else if(/vigent|vigencia/.test(t))src='pers_vig';else if(/institucion|organismo/.test(t))src='pers_inst';
 else if(/poder|ejecutivo|legislativo|judicial/.test(t))src='prensa_poder';
 else if(/(dia|dias) de la semana|que dia/.test(t))src='prensa_dia';
 else if(/mencion|mencionad|persona|polit/.test(t))src='menc_persona';
 else if(/medio|diario|portal|notas/.test(t))src='prensa_medio';
 if(!src)return null;cfg.src=src;const S_=SRC[src];ent.push(S_.t);
 if(S_.f.terms){if(!terms.length)return{cfg,ent,falta:'Escribí también las palabras o nombres a comparar, por ejemplo: «'+(S_.nombres?'menciones de Sáenz, Orozco':'evolución de minería, salud y educación')+'».'};cfg.terms=terms.join(', ');ent.push((S_.nombres?'Nombres: ':'Palabras: ')+cfg.terms)}
 if(/torta|pastel|\bpie\b/.test(t))cfg.tipo='torta';else if(/dona|rosca|anillo/.test(t))cfg.tipo='dona';else if(/barra/.test(t))cfg.tipo='barras';
 if(S_.f.per&&!S_.linea&&!S_.cruce&&/compar|anterior|sube|baja|subi|bajo|crecio|cambio/.test(t)&&!terms.length)cfg.tipo='comparar';
 if(cfg.tipo&&!S_.linea&&!S_.cruce)ent.push({torta:'Torta',dona:'Dona',barras:'Barras',comparar:'Comparación con el período anterior'}[cfg.tipo]);
 if(S_.f.per){let p=null;const n=t.match(/(\d+)\s*dias?/);if(n)p=+n[1]<=10?7:+n[1]<=45?30:60;else if(/semana/.test(t))p=7;else if(/dos meses|bimestre/.test(t))p=60;else if(/mes/.test(t))p=30;else if(/todo|siempre|historic/.test(t))p=0;
  if(p!==null){cfg.per=p;ent.push(p?'Últimos '+p+' días':'Todo lo cargado')}}
 if(S_.f.amb&&!/salta (vs|contra|y) nacion/.test(t)){if(/medios? (de )?salta|salten|provincial|locales/.test(t)){cfg.amb='sal';ent.push('Medios de Salta')}else if(/medios? nacional|nacionales/.test(t)){cfg.amb='nac';ent.push('Medios nacionales')}}
 if(S_.f.cam){const k=/senad\w*.*nacion|nacion.*senad/.test(t)?'Senado de la Nación':/diputad\w*.*nacion|nacion.*diputad/.test(t)?'Diputados de la Nación':/senad/.test(t)?'Senado':/diputad/.test(t)?'Diputados':/concej/.test(t)?'Concejo Deliberante':'';if(k){cfg.cam=k;ent.push((INST[k]||[k])[0])}}
 const mx=t.match(/top\s*(\d)|(\d)\s*(?:principales|mas)/);if(mx){const v=Math.min(7,Math.max(3,+(mx[1]||mx[2])));cfg.max=v;ent.push('Hasta '+v+' porciones')}
 return{cfg,ent}};
const pedido=()=>{const el=Q('#gnl'),msg=Q('#gnlm');if(!el||!msg)return;const r=parsea(el.value);
 if(!r){msg.innerHTML='<span class="note">No lo entendí. Probá, por ejemplo: '+EJEMPLOS.slice(0,3).map(x=>'«'+esc(x)+'»').join(', ')+'.</span>';return}
 if(r.falta){msg.innerHTML='<span class="note">'+esc(r.falta)+'</span>';return}
 C=Object.assign({},DEF,r.cfg);dibuja();const m2=Q('#gnlm');if(m2)m2.innerHTML='<span class="note">Entendí: '+r.ent.map(esc).join(' · ')+'. Podés ajustarlo con los controles de abajo.</span>'};

/* ---------- Pantalla ---------- */
const css=document.createElement('style');css.textContent=`
.gf{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.7rem;margin:.6rem 0 1rem}.gf label{display:flex;flex-direction:column;gap:.2rem;font-size:.78rem;color:var(--soft)}.gf input,.gf select{font:inherit;font-size:.9rem;padding:.45rem .6rem;border:1px solid var(--ink);background:var(--raised);color:var(--ink);min-width:0}.gf .chk{flex-direction:row;align-items:center;gap:.4rem}
.gid{display:flex;flex-wrap:wrap;gap:.35rem;margin:.3rem 0 .9rem}.gid button,.gac button,.gsv button{font:inherit;font-size:.82rem;padding:.3rem .75rem;border:1px solid var(--line);border-radius:99px;background:var(--raised);color:var(--ink);cursor:pointer}.gid button:hover,.gac button:hover{border-color:var(--ink)}
.gac{display:flex;flex-wrap:wrap;gap:.4rem;margin:.8rem 0}.gac button.pri{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.gch{max-width:560px;margin:0 auto;border:1px solid var(--line);background:var(--raised)}.gch svg{display:block;width:100%;height:auto}.gch .gi{cursor:default}.gch .gi.dim{opacity:.35}
#gtip{position:fixed;z-index:50;pointer-events:none;background:var(--ink);color:var(--paper);font-size:.8rem;padding:.3rem .55rem;border-radius:3px;display:none;max-width:16rem}
.gsv{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}.gsv span{display:inline-flex;gap:.2rem;align-items:center}.gsv .x{border:0;background:none;padding:0 .3rem;color:var(--soft)}
.gtabg{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:1rem}.gtabc .gch{margin:0 auto}
.gnl{margin:.4rem 0 1rem}.gnl input{flex:1;min-width:12rem;font:inherit;padding:.5rem .7rem;border:1px solid var(--ink);background:var(--raised);color:var(--ink)}.ctlb{font:inherit;padding:.5rem .9rem;border:1px solid var(--ink);background:var(--ink);color:var(--paper);cursor:pointer}
.gtb{width:100%;border-collapse:collapse;font-size:.85rem;margin:.4rem 0}.gtb th,.gtb td{text-align:left;padding:.3rem .4rem;border-bottom:1px solid var(--line)}.gtb td:nth-child(n+2),.gtb th:nth-child(n+2){text-align:right}`;
document.head.appendChild(css);

const opt=(v,t,cur)=>`<option value="${esc(v)}"${String(v)===String(cur)?' selected':''}>${esc(t)}</option>`;
const IDEAS=[['Qué medios publican más',{src:'prensa_medio',tipo:'dona',per:30}],['Tono de las notas',{src:'prensa_tono',tipo:'torta',per:30}],['Salta vs Nación',{src:'prensa_ambito',tipo:'torta',per:30}],['Notas por poder',{src:'prensa_poder',tipo:'dona',per:30}],['Legisladores por bloque',{src:'leg_bloque',tipo:'torta',max:7}],['Personas más mencionadas',{src:'menc_persona',tipo:'barras',per:30,max:8}],['Publicaciones oficiales por fuente',{src:'of_fuente',tipo:'dona',per:30}],['Qué sube y qué baja (medios)',{src:'prensa_medio',tipo:'comparar',per:30,max:6}],['Tono por medio',{src:'cruce_medio_tono',per:30,max:5}],['Evolución de temas',{src:'evolucion',per:60,terms:'minería, salud, educación, seguridad'}]];
const form=()=>{const s=SRC[C.src],f=s.f,gr={};Object.entries(SRC).forEach(([k,v])=>(gr[v.g]=gr[v.g]||[]).push([k,v.t]));
 return`<div class="gid" role="group" aria-label="Ideas rápidas"><span class="note" style="align-self:center">Ideas:</span>${IDEAS.map((x,i)=>`<button type="button" data-idea="${i}">${esc(x[0])}</button>`).join('')}</div>
 <div class="gf" id="gform"><label>¿Qué querés medir?<select data-k="src">${Object.entries(gr).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(([k,t])=>opt(k,t,C.src)).join('')}</optgroup>`).join('')}</select></label>
 ${s.linea||s.cruce?'':`<label>Tipo de gráfico<select data-k="tipo">${opt('torta','Torta',C.tipo)}${opt('dona','Dona',C.tipo)}${opt('barras','Barras',C.tipo)}${f.per?opt('comparar','Comparar con el período anterior',C.tipo):''}</select></label>`}
 ${f.per?`<label>Período<select data-k="per" data-n="1">${opt(7,'Últimos 7 días',C.per)}${opt(30,'Últimos 30 días',C.per)}${opt(60,'Últimos 60 días',C.per)}${opt(0,'Todo lo cargado',C.per)}</select></label>`:''}
 ${f.amb?`<label>Ámbito de los medios<select data-k="amb">${opt('','Todos',C.amb)}${opt('sal','Medios de Salta',C.amb)}${opt('nac','Medios nacionales',C.amb)}</select></label>`:''}
 ${f.cam?`<label>Cámara<select data-k="cam">${opt('','Todas',C.cam)}${CAMS.map(k=>opt(k,(INST[k]||[k])[0],C.cam)).join('')}</select></label>`:''}
 ${f.q?`<label>Solo notas que contengan…<input type="search" data-k="q" value="${esc(C.q)}" placeholder="ej.: minería" autocomplete="off"></label>`:''}
 ${f.terms?`<label style="grid-column:1/-1">${s.nombres?'Nombres a comparar':'Palabras a comparar'} (separados por coma${s.linea?', hasta 5':''})<input type="text" data-k="terms" value="${esc(C.terms)}" placeholder="${s.nombres?'ej.: Sáenz, Villada, Orozco':'ej.: minería, salud, educación, seguridad'}" autocomplete="off"></label>${s.linea||s.nombres?'':`<label class="chk"><input type="checkbox" data-k="uno" data-b="1"${C.uno?' checked':''}> Cada nota cuenta una sola vez</label>`}`:''}
 ${s.fijo||s.linea||s.cruce?'':`<label>Porciones máximas<select data-k="max" data-n="1">${[3,4,5,6,7].map(n=>opt(n,n+' (el resto va a «Otros»)',C.max)).join('')}</select></label>`}
 ${s.linea||s.cruce?'':`<label>Mostrar<select data-k="med">${opt('n','Cantidades',C.med)}${opt('p','Porcentajes',C.med)}</select></label>`}
 <label>Fondo del gráfico<select data-k="fondo">${opt('','Según el tema de la página',C.fondo)}${opt('l','Claro (ideal para imprimir)',C.fondo)}${opt('d','Oscuro',C.fondo)}</select></label>
 <label style="grid-column:1/-1">Título (opcional)<input type="text" data-k="tit" value="${esc(C.tit)}" placeholder="Si lo dejás vacío se arma solo" autocomplete="off"></label></div>`};
const guardados=()=>{const l=gLs();return l.length?`<h3 class="sh">Mis gráficos guardados</h3><div class="gac"><button type="button" data-ac="tab">Ver todos juntos (tablero)</button></div><div class="gsv">${l.map((x,i)=>`<span><button type="button" data-ld="${i}">${esc(cut(x.name,40))}</button><button type="button" class="x" data-rm="${i}" aria-label="Borrar ${esc(x.name)}">✕</button></span>`).join('')}</div><p class="note">Se guardan solo en este navegador.</p>`:''};
const covIni=()=>{const t=notas().map(n=>n.ts).filter(Boolean).sort((x,y)=>x-y);return t.length?t[Math.floor(t.length*.02)]:0};
const cobertura=()=>{const now=Date.now(),l=notas().filter(n=>n.ts),b=l.filter(n=>n.ts>=now-30*DAY).length,a=l.filter(n=>n.ts>=now-60*DAY&&n.ts<now-30*DAY).length,c=l.filter(n=>n.ts>=now-7*DAY).length;if(!l.length)return'';return`<p class="note">Notas cargadas en NEWAR: ${nf(c)} en los últimos 7 días, ${nf(b)} en los últimos 30 y ${nf(a)} en los 30 anteriores.${a<b*.4?' <b>Ojo:</b> el historial es corto, así que períodos largos muestran solo lo que NEWAR guardó.':''}</p>`};
const chartLinea=()=>{const box=Q('#gout');if(!box)return;LASTL=null;LAST=null;
 if(!C.terms.trim()){box.innerHTML='<p class="empty">Escribí arriba hasta 5 palabras separadas por coma (ej.: minería, salud, educación).</p>';return}
 const L=serie();LASTL=L;if(!L||!L.vals.some(v=>v.some(x=>x>0))){box.innerHTML='<p class="empty" role="status">Ninguna de esas palabras aparece en los títulos del período.</p>';return}
 box.innerHTML=`<div class="gch" id="gsvg">${svgLinea(L)}</div>${accs()}<p class="note">${esc(SRC[C.src].nota)}</p>${cobertura()}`};
const accs=()=>`<div class="gac"><button type="button" class="pri" data-ac="png">Descargar imagen (PNG)</button><button type="button" data-ac="svg">Descargar SVG</button><button type="button" data-ac="csv">Descargar CSV</button><button type="button" data-ac="save">Guardar esta configuración</button><button type="button" data-ac="link">Copiar enlace</button></div>`;
const chartComp=()=>{const s=SRC[C.src],box=Q('#gout');if(!box)return;LAST=null;LASTL=null;
 if((C.src==='terminos'||C.src==='menc_elegidas')&&!C.terms.trim()){box.innerHTML='<p class="empty">Escribí arriba las palabras que quieras comparar, separadas por coma.</p>';return}
 if(!C.per){box.innerHTML='<p class="empty" role="status">Para comparar con el período anterior elegí un período (7, 30 o 60 días), no «Todo».</p>';return}
 let d,pv;try{C.off=0;d=agrupa(s.fn(),C.max,s.fijo);C.off=C.per;pv=s.fn()}catch(e){console.error('NEWAR Gráficos',e);d=[];pv=[]}finally{C.off=0}
 const mp=new Map(pv.map(x=>[x.l,x.v])),usados=new Set(),rows=d.map(x=>{if(x.otros){const r=pv.filter(y=>!d.some(z=>!z.otros&&z.l===y.l)).reduce((q,y)=>q+y.v,0);return{l:x.l,v:x.v,p:r}}usados.add(x.l);return{l:x.l,v:x.v,p:mp.get(x.l)||0}});
 LASTC={rows};
 if(!rows.length){box.innerHTML='<p class="empty" role="status">No hay datos para esta combinación.</p>';return}
 let aviso='';if(s.u==='notas'){const TT=rows.reduce((q,x)=>q+x.v,0),PP=rows.reduce((q,x)=>q+x.p,0);if(PP<TT*.4){box.innerHTML=`<p class="empty" role="status">No se puede comparar con honestidad: en los últimos ${C.per} días NEWAR tiene ${nf(TT)} registros y en los ${C.per} anteriores solo ${nf(PP)}, porque el historial guardado es corto. ${C.per>7?'Probá con 7 días. ':''}Así se evita mostrar subas falsas como «▲4000%».</p>`;LASTC=null;return}}
 box.innerHTML=`<div class="gch" id="gsvg">${svgComparar(LASTC)}</div>${accs()}${lecturaComp(LASTC)}${aviso}${s.nota?`<p class="note">${esc(s.nota)}</p>`:''}<details><summary class="note">Ver los números en tabla</summary><table class="gtb"><thead><tr><th>Categoría</th><th>Ahora</th><th>Antes</th><th>Cambio</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.l)}</td><td>${nf(x.v)}</td><td>${nf(x.p)}</td><td>${pctTxt(x.v,x.p)}</td></tr>`).join('')}</tbody></table></details>`};
const chartCruce=()=>{const box=Q('#gout');if(!box)return;LAST=null;LASTL=null;LASTC=null;const L=filtraNotas(),m={};
 L.forEach(n=>{const o=m[n.mn]=m[n.mn]||{l:n.mn,positivo:0,neutral:0,negativo:0,tot:0};const k=n.sent==='positivo'||n.sent==='negativo'?n.sent:'neutral';o[k]++;o.tot++});
 const rows=Object.values(m).sort((a,b)=>b.tot-a.tot).slice(0,Math.max(3,C.max+3));LASTX={rows};
 if(!rows.length){box.innerHTML='<p class="empty" role="status">No hay notas con estos filtros.</p>';return}
 box.innerHTML=`<div class="gch" id="gsvg">${svgCruce(LASTX)}</div>${accs()}<p class="note">${esc(SRC[C.src].nota)}</p>${cobertura()}`};
const chart=()=>{const s=SRC[C.src];LASTC=null;LASTX=null;if(s.linea)return chartLinea();if(s.cruce)return chartCruce();if(C.tipo==='comparar'&&s.f.per)return chartComp();LASTL=null;let d;try{d=agrupa(s.fn(),C.max,s.fijo)}catch(e){console.error('NEWAR Gráficos',e);d=[]}
 LAST=d;const box=Q('#gout');if(!box)return;
 if((C.src==='terminos'||C.src==='menc_elegidas')&&!C.terms.trim()){box.innerHTML='<p class="empty">Escribí arriba las palabras que quieras comparar, separadas por coma.</p>';return}
 if(!d.length){box.innerHTML='<p class="empty" role="status">No hay datos para esta combinación. Probá con un período más largo o sacá el filtro.</p>';return}
 const tot=d.reduce((a,x)=>a+x.v,0);
 box.innerHTML=`<div class="gch" id="gsvg">${svgGrafico(d)}</div>
 ${accs()}
 ${lectura(d,s)}
 ${s.nota?`<p class="note">${esc(s.nota)}</p>`:''}
 ${s.u==='notas'?cobertura():''}
 <details><summary class="note">Ver los números en tabla</summary><table class="gtb"><thead><tr><th>Categoría</th><th>${esc(s.u||'Valor')}</th><th>%</th></tr></thead><tbody>${d.map(x=>`<tr><td>${esc(x.l)}</td><td>${nf(x.v)}</td><td>${(x.v/tot*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></details>`};
const dibuja=()=>{const f=Q('#gformbox');if(f)f.innerHTML=form();chart();const g=Q('#gsave');if(g)g.innerHTML=guardados()};
const archivo=()=>{if(ES.arc&&ES.arc.length)return;arcLoad().then(()=>{GN=null;if(Q('#gout'))chart()})};

V.graficos=(id)=>{if(id){try{const c=JSON.parse(decodeURIComponent(escape(atob(id))));if(c&&SRC[c.src])C=Object.assign({},DEF,c)}catch(e){}}setTimeout(async()=>{try{await need('news','of')}catch(e){}if(!Q('#gout'))return;dibuja();archivo()},0);
 return`<h2 class="sec">Generador de gráficos</h2><div class="gnl"><label for="gnl"><b>Pedilo con tus palabras</b></label><div class="pdq"><input type="text" id="gnl" placeholder="ej.: torta de los medios de los últimos 7 días" autocomplete="off"><button type="button" class="ctlb" data-ac="pedir">Armar gráfico</button></div><div class="gid">${EJEMPLOS.map((x,i)=>`<button type="button" data-ej="${i}">${esc(x)}</button>`).join('')}</div><div id="gnlm" aria-live="polite"></div></div><p class="lede">Elegí qué querés medir y NEWAR arma una torta, una dona o un gráfico de barras con los datos que ya tiene cargados. Podés descargarlo como imagen, bajar los números o guardar la configuración para repetirlo.</p><div id="gformbox"></div><div id="gout"><p class="empty" role="status">Cargando…</p></div><div id="gsave"></div><div id="gtip" role="tooltip"></div>`};
if(typeof NEEDS!=='undefined')NEEDS.graficos=['news','of'];
if(!TABS.some(t=>t[0]==='graficos')){const i=TABS.findIndex(t=>t[0]==='estadisticas');TABS.splice(i<0?TABS.length:i+1,0,['graficos','Gráficos'])}

/* ---------- Eventos ---------- */
const bajar=(name,blob)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
const slug=s=>fold(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'grafico';
const enlace=()=>{const j=btoa(unescape(encodeURIComponent(JSON.stringify(C)))),u=location.href.split('#')[0]+'#/graficos/'+encodeURIComponent(j);
 (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(u):Promise.reject()).then(()=>alert('Enlace copiado. Quien lo abra ve este mismo gráfico.')).catch(()=>prompt('Copiá este enlace:',u))};
let C0=null;
const tablero=()=>{const l=gLs();if(!l.length)return;const fb=Q('#gformbox'),go=Q('#gout');if(!fb||!go)return;C0=Object.assign({},C);fb.innerHTML=`<div class="gac"><button type="button" data-ac="volver">← Volver al generador</button><button type="button" class="pri" data-ac="tabpng">Descargar tablero (PNG)</button></div><p class="note">Se arma con tus ${l.length} gráficos guardados, con los datos de hoy.</p>`;
 go.id='gtab';go.innerHTML='<div class="gtabg"></div>';const g=go.querySelector('.gtabg');
 l.forEach(x=>{C=Object.assign({},DEF,x.cfg);const cell=document.createElement('div');cell.className='gtabc';cell.id='gout';g.appendChild(cell);try{chart()}catch(e){console.error(e)}
  cell.querySelectorAll('.gac,.pdav,details,p.note').forEach(n=>n.remove());const sv=cell.querySelector('svg');if(sv)sv.removeAttribute('id');cell.removeAttribute('id');cell.dataset.t=x.name});
 C=C0;LAST=LASTL=LASTC=LASTX=null};
const volver=()=>{const go=Q('#gtab');if(go){go.id='gout';go.innerHTML=''}if(C0)C=C0;C0=null;dibuja()};
const tabPng=()=>{const sv=[...document.querySelectorAll('#gtab svg')];if(!sv.length)return;const cols=sv.length>1?2:1,pad=16,imgs=[];let done=0;
 sv.forEach((e,i)=>{const x=new XMLSerializer().serializeToString(e),m=x.match(/viewBox="0 0 (\d+) (\d+)"/),im=new Image();im.onload=()=>{imgs[i]={im,w:+m[1],h:+m[2]};if(++done===sv.length){const rows=Math.ceil(sv.length/cols),cw=520,rh=[];for(let r=0;r<rows;r++)rh.push(Math.max(...imgs.slice(r*cols,r*cols+cols).map(q=>q.h)));
   const W=cols*cw+(cols+1)*pad,H=rh.reduce((a,b)=>a+b,0)+(rows+1)*pad,cv=document.createElement('canvas');cv.width=W*2;cv.height=H*2;const c=cv.getContext('2d');c.scale(2,2);c.fillStyle=SURF[modo()];c.fillRect(0,0,W,H);
   let y=pad;for(let r=0;r<rows;r++){imgs.slice(r*cols,r*cols+cols).forEach((q,k)=>c.drawImage(q.im,pad+k*(cw+pad),y,q.w,q.h));y+=rh[r]+pad}
   cv.toBlob(b=>b&&bajar('newar-tablero.png',b),'image/png')}};im.onerror=()=>{done++};im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(x.replace(/^<svg /,'<svg xmlns="http://www.w3.org/2000/svg" ').replace('xmlns="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg"','xmlns="http://www.w3.org/2000/svg"'))})};
const accion=a=>{if(a==='tab')return tablero();if(a==='volver')return volver();if(a==='tabpng')return tabPng();if(a==='link')return enlace();if(LASTC||LASTX){const svg=LASTC?svgComparar(LASTC):svgCruce(LASTX),nom='newar-'+slug(titulo());
  if(a==='svg')return bajar(nom+'.svg',new Blob([svg],{type:'image/svg+xml'}));
  if(a==='csv')return typeof bajarCSV==='function'?bajarCSV(nom+'.csv',LASTC?[['Categoría','Ahora','Antes']].concat(LASTC.rows.map(x=>[x.l,x.v,x.p])):[['Medio','Positivo','Neutral','Negativo','Total']].concat(LASTX.rows.map(x=>[x.l,x.positivo,x.neutral,x.negativo,x.tot]))):0;
  if(a==='png')return png(svg,nom);if(a==='save')return guarda()}
 if(LASTL){const svg=svgLinea(LASTL),nom='newar-'+slug(titulo());
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
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.gnl button,#gformbox button,#gout button,#gsave button');if(!t)return;
 if(t.dataset.ej!==undefined){const i=Q('#gnl');if(i){i.value=EJEMPLOS[+t.dataset.ej];pedido()}return}
 if(t.dataset.ac==='pedir')return pedido();
 if(t.dataset.idea!==undefined){C=Object.assign({},DEF,IDEAS[+t.dataset.idea][1]);return dibuja()}
 if(t.dataset.ac)return accion(t.dataset.ac);
 if(t.dataset.ld!==undefined){const x=gLs()[+t.dataset.ld];if(x){C=Object.assign({},DEF,x.cfg);dibuja();scrollTo(0,0)}return}
 if(t.dataset.rm!==undefined){const l=gLs();l.splice(+t.dataset.rm,1);sLs(l);const g=Q('#gsave');if(g)g.innerHTML=guardados()}});
const cambio=e=>{const el=e.target;if(!el.closest||!el.closest('#gform')||!el.dataset.k)return;const k=el.dataset.k;
 C[k]=el.dataset.b?(el.checked?1:0):el.dataset.n?+el.value:el.value;
 if(k==='src'){const keep={tipo:C.tipo,med:C.med};C=Object.assign({},DEF,keep,{src:el.value});return dibuja()}
 chart()};
document.addEventListener('change',cambio);
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='gnl'){e.preventDefault();pedido()}});
document.addEventListener('input',e=>{if(e.target&&e.target.type!=='checkbox'&&e.target.tagName!=='SELECT')cambio(e)});
/* tooltip y resaltado */
document.addEventListener('mousemove',e=>{const tip=Q('#gtip');if(!tip)return;const g=e.target.closest&&e.target.closest('#gsvg .gi');
 document.querySelectorAll('#gsvg .gi.dim').forEach(x=>x.classList.remove('dim'));
 if(!g||!LAST){tip.style.display='none';return}
 const i=+g.dataset.i,x=LAST[i],tot=LAST.reduce((s,y)=>s+y.v,0);if(!x){tip.style.display='none';return}
 document.querySelectorAll('#gsvg .gi').forEach(y=>{if(y!==g&&y.dataset.i!==g.dataset.i)y.classList.add('dim')});
 tip.textContent=x.l+': '+nf(x.v)+' ('+(x.v/tot*100).toFixed(1)+'%)';tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(e.clientY+14)+'px'});
})();
