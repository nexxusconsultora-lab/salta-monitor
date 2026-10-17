/* ===== NEWAR · Poder Ejecutivo y Poder Legislativo (versión ampliada) =====
   Convierte las pestañas «Ejecutivo» y «Legislativo» en vistas con secciones:
   Ejecutivo: Panorama · Gabinete de Salta · Nación · Noticias · Actividad oficial · Estadísticas · Enlaces
   Legislativo: Panorama · Legisladores · Bloques · Noticias · Actividad · Cambios · Estadísticas · Enlaces
   Datos: data/poderes.json (curado, con fuente), data/politicians.json, prensa (news_general + archivo),
   publicaciones oficiales (oficiales.json) y órdenes del día (orden_del_dia.json).
   Detectar una nota por palabras del título no es una verificación: es una ayuda para encontrarla.
   Se carga DESPUÉS de judicial.js (reutiliza sus estilos). */
(()=>{
if(typeof V==='undefined'||!V.ejecutivo||!V.legislativo)return;
const Q=s=>document.querySelector(s),DAY=864e5;
const PS={eje:{sec:'resumen',amb:'',per:30,q:'',n:40,eper:30},leg:{sec:'resumen',amb:'',per:30,q:'',n:40,eper:30,cam:'',oper:90}};
let PD=null,PDP=null;
const pLoad=()=>PDP||(PDP=J('poderes',null,true).then(v=>(PD=v||{})).catch(()=>(PD={})));
const fD=ts=>ts?new Date(ts).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}):'';
const dayK=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const lnk=(u,t)=>/^https?:\/\//i.test(u||'')?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t||u)}</a>`:esc(t||'');
const cov=(l,days)=>{const now=Date.now(),c=l.filter(n=>n.ts>=now-days*DAY).length,p=l.filter(n=>n.ts>=now-2*days*DAY&&n.ts<now-days*DAY).length;return p>=c*.5};
const kpi=(n,l,d,href)=>`<${href?'a href="'+href+'"':'div'}><span class="n">${n}</span><span class="l">${l}</span>${d?`<span class="d ${d.startsWith('▲')?'up':'dn2'}">${d}</span>`:''}</${href?'a':'div'}>`;
const delta=(a,b,c)=>c===false?'sin período anterior comparable':b?(a>=b?'▲ ':'▼ ')+Math.abs(Math.round((a-b)/b*100))+'% vs período anterior':(a?'▲ nuevo (antes 0)':'');
const segB=(at,l,cur)=>`<div class="seg" role="group">${l.map(([v,t])=>`<button type="button" data-${at}="${v}" aria-pressed="${String(v)===String(cur)}"${String(v)===String(cur)?' class="on"':''}>${t}</button>`).join('')}</div>`;
const barras=(l,mx,col)=>l.map(([lab,n,href])=>hbar(esc(lab),n,mx,href||'',col||'var(--clay)')).join('');
const csv=(name,rows)=>{try{bajarCSV(name,rows)}catch(e){console.error(e)}};
const css=document.createElement('style');css.textContent=`.pdq{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.4rem 0 .8rem}.pdq input[type=search]{flex:1;min-width:10rem}.pdav{border-left:3px solid var(--clay);padding:.5rem .8rem;margin:.6rem 0 1rem;background:var(--raised);font-size:.86rem}`;document.head.appendChild(css);

/* ---------- Detección por vocabulario (solo título) ---------- */
const RX_FOR=/\b(trump|eeuu|ee uu|estados unidos|netanyahu|israel|gaza|bolsonaro|brasil|colombia|bogota|mexico|chile|peru|uruguay|paraguay|bolivia|venezuela|españa|madrid|francia|italia|ucrania|rusia|china|reino unido|londres|guatemala|ecuador|honduras|cuba|panama|congreso de los estados|parlamento europeo)\b/;
const RX_ARG=/\b(argentin\w*|milei|buenos aires|salta|cordoba|rosario|santa fe|mendoza|tucuman|jujuy|corrientes|misiones|chaco|neuquen|casa rosada|kirchner|cristina)\b/;
const RX_SAL=/\b(salta|salteñ[oa]s?|saenz|oran|tartagal|metan|cafayate|rosario de la frontera|general guemes|chiban|cdsalta)\b/;
const RX_NAC=/\b(milei|casa rosada|gobierno nacional|adorni|caputo|dnu|nacion|congreso|pettovello|sturzenegger|bullrich)\b/;
const RX_EJ=/\b(gobernador|gobernadora|vicegobernador\w*|gobierno de salta|gobierno provincial|gobierno nacional|poder ejecutivo|jefe de gabinete|jefatura de gabinete|gabinete|ministro|ministra|ministerio|secretari[oa] de|subsecretari[oa]|casa rosada|decreto|dnu|presidente milei|milei|adorni|caputo|saenz)\b/;
const RX_LG=/\b(senador\w*|senadora\w*|senado|diputad[oa]s?|camara de diputados|legislatura|legislativ\w+|concejo deliberante|concejal\w*|concejales|sesion(es)? (ordinaria|extraordinaria|especial|del senado|de la camara|del concejo)|interbloque|bloque (oficialista|opositor|justicialista|peronista|radical|libertario|libertad avanza|pro|ucr|de diputados|de senadores)|proyecto de ley|media sancion|sancion definitiva|orden del dia|banca|bancas|fueros|desafuero|interpelacion|comision de|dictamen|ordenanza|ordenanzas)\b/;
const RX_SPORT=/\b(river|boca|racing|independiente|san lorenzo|gimnasia|central norte|juventud antoniana|mundial|torneo|liga profesional|copa libertadores|seleccion|partido|goles?|futbol|basquet|tenis|rugby|dakar)\b/;
const PLURAL=/\b(proyecto de ley|ordenanza)\b/;
let PN=null;
const pNotes=()=>{const raw=(S.news||[]).concat((ES&&ES.arc)||[]),key=raw.length+':'+personas.length+':'+(PD&&PD.actualizado||'');if(PN&&PN.k===key)return PN;
 const nm=[];personas.forEach(p=>{if(p.cargos&&p.cargos.some(c=>c.p&&c.p.chamber==='Ejecutivo'&&c.v===1)){const f=fold(p.nombre||'').replace(/[^a-z\s]/g,' ').trim();if(f.split(/\s+/).length>=2)nm.push(f)}});
 ((PD&&PD.ejecutivo_nacional&&PD.ejecutivo_nacional.autoridades)||[]).forEach(a=>{const f=fold(a.nombre).replace(/[^a-z\s]/g,' ').trim();if(f)nm.push(f)});
 const seen=new Set(),seenT=new Set(),eje=[],leg=[];
 raw.forEach(n=>{if(!n||!n.id||seen.has(n.id))return;seen.add(n.id);
  if(/ - temas - /i.test(n.title||''))return;
  const t=tituloSinMedio(n),f=fold(t),ts=Date.parse(n.published_iso||n.collected_at)||0;
  const isL=RX_LG.test(f),isE=RX_EJ.test(f)||nm.some(x=>f.includes(x));
  if(!isL&&!isE)return;
  if(RX_SPORT.test(f)&&!/\b(senador|diputad|gobernador|ministro|legislatura|concejal)\w*/.test(f))return;
  const tk=f.replace(/[^a-z0-9]+/g,' ').trim()+'|'+medioKey(n.source);if(seenT.has(tk))return;seenT.add(tk);
  const ext=RX_FOR.test(f)&&!RX_ARG.test(f)?1:0;
  const sal=RX_SAL.test(f)||(n.category==='Provincial'&&!RX_NAC.test(f));
  const o={id:n.id,t,f,link:n.link,mk:medioKey(n.source),mn:medioNombre(n.source),ts,pub:!!n.published_iso,cat:n.category,sent:n.sentiment_label||'',amb:sal?'sal':'nac',ext};
  if(isL)leg.push(Object.assign({},o,{h:'leg'}));
  if(isE&&!(isL&&!/\b(gobernador|ministr|gabinete|decreto|ejecutivo|milei|saenz|adorni|caputo)\w*/.test(f)))eje.push(Object.assign({},o,{h:'eje'}))});
 eje.sort((a,b)=>b.ts-a.ts);leg.sort((a,b)=>b.ts-a.ts);return PN={k:key,eje,leg}};
const nFilt=(p,o)=>{const L=pNotes()[p],lim=o.per?Date.now()-o.per*DAY:0,q=fold(o.q||'').trim();return L.filter(n=>!n.ext&&(!lim||n.ts>=lim)&&(!o.amb||n.amb===o.amb)&&(!q||n.f.includes(q)||fold(n.mn).includes(q)))};
const ambB=a=>`<span class="jb" style="background:${a==='sal'?'var(--pos)':'var(--indigo)'}">${a==='sal'?'Salta':'Nación'}</span>`;
const noteRow=n=>`<div class="jn"><a class="t" href="${esc(safe(n.link))}" target="_blank" rel="noopener noreferrer">${esc(n.t)}</a><div class="meta">${ambB(n.amb)}<b>${n.pub?fD(n.ts):'sin fecha de publicación (recolectada el '+fD(n.ts)+')'}</b> · ${esc(n.mn)}${n.sent?' · '+esc(n.sent):''}</div></div>`;
const ofRow=x=>`<div class="jn"><a class="t" href="${esc(safe(x.link))}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a><div class="meta">${ambB(x.amb)}${x.tipo?`<span class="jb">${esc(x.tipo)}</span>`:''}<b>${x.pub?fD(x.ts):'fecha de publicación no informada (detectada el '+fD(x.ts)+')'}</b> · ${esc(x.fuente)}</div></div>`;

/* ---------- Publicaciones oficiales ---------- */
const OF_EJ=/gobierno de salta|ministerio|economia|boletin oficial|jefatura|casa rosada|presidencia/,OF_LG=/senado|diputad|concejo|legislatura|congreso/;
const pOf=p=>{const it=(S.of&&S.of.items)||[],rx=p==='eje'?OF_EJ:OF_LG;
 return it.filter(x=>{const f=fold((x.fuente||'')+' '+(x.organismo||''));if(!rx.test(f))return false;if(p==='eje'&&OF_LG.test(f)&&!/boletin|gobierno|ministerio/.test(f))return false;return p==='eje'?!/judicial|corte suprema/.test(f):true})
  .map(x=>{const ts=Date.parse(x.fecha_publicacion||'')||0,seen=Date.parse(x.first_seen||'')||0;return{t:x.titulo,link:x.url,fuente:x.fuente||'',amb:/salta/i.test(x.jurisdiccion||'')?'sal':'nac',tipo:x.tipo_acto||'',ts:ts||seen,pub:!!ts}}).sort((a,b)=>b.ts-a.ts)};

/* ---------- Personas ---------- */
const pEj=()=>personas.map(p=>[p,(p.cargos||[]).find(c=>c.p&&c.p.chamber==='Ejecutivo')]).filter(x=>x[1]);
const pLg=()=>personas.map(p=>[p,(p.cargos||[]).find(c=>c.v===1&&c.p&&c.p.chamber!=='Ejecutivo')]).filter(x=>x[1]);
const mArr=(p,lim)=>(PM[p.id]||[]).filter(okPrec).filter(m=>!lim||(+m._d||0)>=lim);
const topPers=(list,lim,n)=>list.map(([p,c])=>({p,c,n:mArr(p,lim).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,n);
const rowP=({p,c,n})=>`<a class="row2" href="#/persona/${encodeURIComponent(p.id)}"><div><div class="nm">${esc(p.nombre)}</div><div class="meta">${esc(c.titulo||'')}${c.bloque?' · bloque '+esc(c.bloque):''} · ${n} menciones</div></div>${badge(p)}</a>`;

/* ---------- Secciones comunes ---------- */
const SEC={eje:[['resumen','Panorama'],['gabinete','Gabinete de Salta'],['nacion','Nación'],['noticias','Noticias'],['actividad','Actividad oficial'],['estadisticas','Estadísticas'],['enlaces','Enlaces']],
 leg:[['resumen','Panorama'],['legisladores','Legisladores'],['bloques','Bloques'],['noticias','Noticias'],['actividad','Actividad'],['cambios','Cambios'],['estadisticas','Estadísticas'],['enlaces','Enlaces']]};
const nav=(p,s)=>`<div class="jt" role="navigation" aria-label="Secciones">${SEC[p].map(([k,l])=>`<a href="#/${p==='eje'?'ejecutivo':'legislativo'}/${k}"${k===s?' class="on" aria-current="page"':''}>${l}</a>`).join('')}</div>`;
const TIT={eje:'Poder Ejecutivo · Salta y Nación',leg:'Poder Legislativo · Nación, Salta y Concejo'};
const ctrl=(p)=>{const o=PS[p];return`<div class="pdq"><input type="search" id="pq" aria-label="Buscar en las notas" placeholder="Buscar en los títulos…" value="${esc(o.q)}" autocomplete="off">${segB('amb',[['','Todo'],['sal','Salta'],['nac','Nación']],o.amb)}${segB('per',[[7,'7 días'],[30,'30 días'],[90,'90 días'],[0,'Todo']],o.per)}</div>`};
const statsBlock=(p,L,per)=>{
 const now=Date.now(),a=L.filter(n=>!n.ext&&n.ts>=now-per*DAY),b=L.filter(n=>!n.ext&&n.ts>=now-2*per*DAY&&n.ts<now-per*DAY);
 const tono={positivo:0,neutral:0,negativo:0};a.forEach(n=>{if(tono[n.sent]!==undefined)tono[n.sent]++});
 const med={};a.forEach(n=>{med[n.mn]=(med[n.mn]||0)+1});const mt=Object.entries(med).sort((x,y)=>y[1]-x[1]).slice(0,8);
 const sem={};a.forEach(n=>{const d=new Date(n.ts);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));const k=dayK(d);sem[k]=(sem[k]||0)+1});
 const sl=Object.entries(sem).sort((x,y)=>x[0].localeCompare(y[0])).slice(-10);
 const tot=a.length||1,mx=Math.max(1,...sl.map(x=>x[1]),...mt.map(x=>x[1]));
 return{a,b,html:`<h3 class="sh">Notas por semana (lunes de cada semana)</h3>${sl.length?barras(sl.map(([k,n])=>[k,n]),mx):'<p class="empty">Sin notas en el período.</p>'}
  <h3 class="sh">Tono de las notas</h3>${barras([['Positivo',tono.positivo],['Neutral',tono.neutral],['Negativo',tono.negativo]],Math.max(1,tono.positivo,tono.neutral,tono.negativo))}<p class="note">El tono lo calcula el recolector con palabras del titular: sirve como pista, no como juicio. Sobre ${a.length} notas del período.</p>
  <h3 class="sh">Medios que más publican</h3>${mt.length?barras(mt,mx):'<p class="empty">Sin datos.</p>'}`}};
const noticiasHtml=(p)=>{const o=PS[p],L=nFilt(p,o);return`${ctrl(p)}<p class="note" id="pcn">${L.length} notas${o.per?' en los últimos '+o.per+' días':''}. Cada una muestra su fecha de publicación; si el medio no la informó, se indica.</p><div class="ctl"><button type="button" data-act="csv">Exportar CSV</button></div><div id="pl">${L.slice(0,o.n).map(noteRow).join('')||'<p class="empty">No hay notas con estos filtros.</p>'}</div>${L.length>o.n?'<button type="button" class="more" data-act="mas">Mostrar más</button>':''}`};
const actividadHtml=(p)=>{const l=pOf(p),o=PS[p];const lim=o.oper?Date.now()-o.oper*DAY:0,f=l.filter(x=>!lim||x.ts>=lim);
 let h=`<div class="pdq">${segB('oper',[[30,'30 días'],[90,'90 días'],[0,'Todo']],o.oper)}</div>`;
 if(p==='leg'){const it=((S.odd&&S.odd.items)||[]).map(d=>Object.assign({},d,{_f:sesFecha(d)})),hoy=new Date();hoy.setHours(0,0,0,0);
  const prox=it.filter(d=>d._f&&d._f>=hoy).sort((a,b)=>a._f-b._f),rec=it.filter(d=>!(d._f&&d._f>=hoy)).sort((a,b)=>(Date.parse(b.first_seen)||0)-(Date.parse(a.first_seen)||0)).slice(0,8);
  h+=`<h3 class="sh">Sesiones próximas (${prox.length})</h3>${prox.map(sesCard).join('')||'<p class="empty">No hay sesiones próximas registradas. El detalle de todas las sesiones está en <a href="#/sesiones">Sesiones</a>.</p>'}<h3 class="sh">Últimos documentos de sesión</h3>${rec.map(sesCard).join('')||'<p class="empty">Sin documentos.</p>'}<p class="note"><a href="#/sesiones">Ver todas las sesiones</a></p>`}
 h+=`<h3 class="sh">Publicaciones oficiales (${f.length})</h3>${f.slice(0,60).map(ofRow).join('')||'<p class="empty">No hay publicaciones oficiales detectadas en el período.</p>'}${f.length>60?`<p class="note">Se muestran las 60 más recientes de ${f.length}.</p>`:''}<p class="note">Salen de los boletines oficiales y sitios de gobierno que NEWAR vigila (ver <a href="#/fuentes">Fuentes</a>). Si una fuente no responde ese día, no aparece.</p>`;return h};
const enlacesHtml=(p)=>{const l=((PD&&PD.enlaces)||[]).filter(x=>x.p===p),g={};l.forEach(x=>(g[x.g]=g[x.g]||[]).push(x));return Object.entries(g).map(([k,v])=>`<h3 class="sh">${esc(k)}</h3><ul class="note">${v.map(x=>`<li>${lnk(x.u,x.t)} <span class="meta">${esc(x.a)}</span></li>`).join('')}</ul>`).join('')||'<p class="empty">Sin enlaces.</p>'};

/* ---------- Ejecutivo ---------- */
const BE={
 resumen(){const N=pNotes(),per=30,st=statsBlock('eje',N.eje,per),a7=N.eje.filter(n=>!n.ext&&n.ts>=Date.now()-7*DAY),of=pOf('eje'),of30=of.filter(x=>x.ts>=Date.now()-30*DAY),e=pEj(),vig=e.filter(x=>x[0].v===1),nov=e.filter(x=>x[0].v===0);
  const top=topPers(vig,Date.now()-30*DAY,6);
  return`<div class="jk">${kpi(vig.length,'autoridades de Salta vigentes',nov.length?nov.length+' con mandato terminado':'','#/ejecutivo/gabinete')}${kpi(st.a.length,'notas en 30 días',delta(st.a.length,st.b.length,cov(N.eje,30)),'#/ejecutivo/noticias')}${kpi(a7.length,'notas en 7 días','','#/ejecutivo/noticias')}${kpi(of30.length,'publicaciones oficiales (30 d)','','#/ejecutivo/actividad')}</div>
  <h3 class="sh">Más mencionados en 30 días</h3>${top.map(rowP).join('')||'<p class="empty">Sin menciones suficientes.</p>'}
  <h3 class="sh">Últimas notas</h3>${N.eje.filter(n=>!n.ext).slice(0,8).map(noteRow).join('')||'<p class="empty">Sin notas.</p>'}
  <h3 class="sh">Última actividad oficial</h3>${of.slice(0,5).map(ofRow).join('')||'<p class="empty">Sin publicaciones.</p>'}
  <h3 class="sh">Estructura del Ejecutivo de Salta</h3><ul class="note">${((PD&&PD.ejecutivo_salta_estructura)||[]).map(x=>`<li><b>${esc(x.t)}</b>: ${esc(x.d)}</li>`).join('')}</ul>`},
 gabinete(){let h=V._ejeOrig();return h.replace(/<h2 class="sec">[\s\S]*?<\/h2>/,'')},
 nacion(){const n=(PD&&PD.ejecutivo_nacional)||{},l=n.autoridades||[];
  return`<div class="pdav" role="note"><b>Antes de usar estos datos:</b> ${esc(n.aviso||'Datos sin fecha de verificación.')}</div>
  ${l.map(a=>`<div class="row2"><div><div class="nm">${esc(a.nombre)}</div><div class="meta">${esc(a.cargo)} · verificado el ${esc(a.verificado||'sin fecha')}${a.nota?' · '+esc(a.nota):''}${a.fuente?' · '+lnk(a.fuente,'fuente'):''}</div></div>${a.vigente===false?'<span class="tag no-vigente">no vigente'+(a.hasta?' desde '+esc(a.hasta):'')+'</span>':'<span class="tag vigente">vigente (según la fuente)</span>'}</div>`).join('')||'<p class="empty">Sin datos.</p>'}
  <h3 class="sh">Sin dato</h3><ul class="note">${(n.sin_dato||[]).map(x=>`<li><b>${esc(x.cargo)}</b>: ${esc(x.motivo)}</li>`).join('')}</ul>
  <p class="note">Para corregir o sumar a alguien se edita <code>data/poderes.json</code>. Para marcar una baja: <code>"vigente": false</code> y, si querés, <code>"hasta"</code> y <code>"motivo"</code>.</p>`},
 noticias:()=>noticiasHtml('eje'),
 actividad:()=>actividadHtml('eje'),
 estadisticas(){const N=pNotes(),per=PS.eje.eper,st=statsBlock('eje',N.eje,per),vig=pEj().filter(x=>x[0].v===1),top=topPers(vig,Date.now()-per*DAY,10);
  return`<div class="pdq">${segB('eper',[[7,'7 días'],[30,'30 días'],[90,'90 días']],per)}</div><div class="jk">${kpi(st.a.length,'notas en el período',delta(st.a.length,st.b.length,cov(N.eje,per)))}${kpi(st.a.filter(n=>n.amb==='sal').length,'sobre Salta')}${kpi(st.a.filter(n=>n.amb==='nac').length,'sobre Nación')}</div>${st.html}<h3 class="sh">Autoridades más mencionadas</h3>${top.length?barras(top.map(x=>[x.p.nombre,x.n,'#/persona/'+encodeURIComponent(x.p.id)]),Math.max(1,top[0].n)):'<p class="empty">Sin datos.</p>'}`},
 enlaces:()=>enlacesHtml('eje')};

/* ---------- Legislativo ---------- */
const CAMS=['Senado de la Nación','Diputados de la Nación','Senado','Diputados','Concejo Deliberante'];
const BL={
 resumen(){const N=pNotes(),st=statsBlock('leg',N.leg,30),l=pLg(),a7=N.leg.filter(n=>!n.ext&&n.ts>=Date.now()-7*DAY),hoy=new Date();hoy.setHours(0,0,0,0);
  const ses=((S.odd&&S.odd.items)||[]).map(sesFecha).filter(f=>f&&f>=hoy).length,top=topPers(l,Date.now()-30*DAY,6);
  const comp=CAMS.map(k=>[(INST[k]||[k])[0],l.filter(x=>x[1].p.chamber===k).length]).filter(x=>x[1]);
  return`<div class="jk">${kpi(l.length,'legisladores en ejercicio','','#/legislativo/legisladores')}${kpi(st.a.length,'notas en 30 días',delta(st.a.length,st.b.length,cov(N.leg,30)),'#/legislativo/noticias')}${kpi(a7.length,'notas en 7 días','','#/legislativo/noticias')}${kpi(ses,'sesiones próximas registradas','','#/legislativo/actividad')}</div>
  <h3 class="sh">Composición</h3>${barras(comp,Math.max(1,...comp.map(x=>x[1])))}
  <h3 class="sh">Legisladores más mencionados (30 días)</h3>${top.map(rowP).join('')||'<p class="empty">Sin menciones suficientes.</p>'}
  <h3 class="sh">Últimas notas</h3>${N.leg.filter(n=>!n.ext).slice(0,8).map(noteRow).join('')||'<p class="empty">Sin notas.</p>'}
  <h3 class="sh">Estructura</h3>${['nacional','salta'].map(k=>`<h4 class="sh">${k==='nacional'?'Nación':'Salta'}</h4><ul class="note">${(((PD&&PD.legislativo_estructura)||{})[k]||[]).map(x=>`<li><b>${x.url?lnk(x.url,x.t):esc(x.t)}</b>: ${esc(x.d)}</li>`).join('')}</ul>`).join('')}`},
 legisladores(){return V._legOrig().replace(/<h2 class="sec">[\s\S]*?<\/h2>/,'')},
 bloques(){const l=pLg(),lim=Date.now()-90*DAY,g={};
  l.forEach(([p,c])=>{const k=(c.p.chamber)+'|'+(c.bloque||'sin dato');const o=g[k]=g[k]||{cam:c.p.chamber,b:c.bloque||'sin dato',n:0,m:0,pos:0,neg:0,neu:0};o.n++;mArr(p,lim).forEach(m=>{o.m++;if(m.sentiment_label==='positivo')o.pos++;else if(m.sentiment_label==='negativo')o.neg++;else o.neu++})});
  return`<p class="note">Menciones y tono de los últimos 90 días por bloque. Los bloques de Salta se toman de la nómina cargada y pueden haber cambiado: confirmalos en cada cámara.</p>`+CAMS.map(k=>{const x=Object.values(g).filter(o=>o.cam===k).sort((a,b)=>b.n-a.n);if(!x.length)return'';
   return`<h3 class="sh">${esc((INST[k]||[k])[0])}</h3>${x.map(o=>`<div class="row2"><div><div class="nm">${esc(o.b)}</div><div class="meta">${o.n} integrantes · ${o.m} menciones (${o.pos} positivas · ${o.neu} neutrales · ${o.neg} negativas)</div></div></div>`).join('')}`}).join('')||'<p class="empty">Sin datos.</p>'},
 noticias:()=>noticiasHtml('leg'),
 actividad:()=>actividadHtml('leg'),
 cambios(){const hoy=Date.now(),all=personas.map(p=>[p,(p.cargos||[]).find(c=>c.p&&c.p.chamber!=='Ejecutivo')]).filter(x=>x[1]);
  const bajas=all.filter(([p,c])=>p.v===0||c.v===0).map(([p,c])=>({p,c,f:Date.parse(c.p.ex_desde||c.hasta||'')||0})).sort((a,b)=>b.f-a.f).slice(0,25);
  const vence=all.filter(([p,c])=>c.v===1&&c.hasta&&Date.parse(c.hasta)>hoy-DAY).map(([p,c])=>({p,c,f:Date.parse(c.hasta)})).sort((a,b)=>a.f-b.f).slice(0,25);
  const lic=all.filter(([p,c])=>c.p&&c.p.licencia);
  const row=(x,t)=>`<a class="row2" href="#/persona/${encodeURIComponent(x.p.id)}"><div><div class="nm">${esc(x.p.nombre)}</div><div class="meta">${esc(x.c.titulo||'')}${x.c.bloque?' · bloque '+esc(x.c.bloque):''}${x.f?' · '+t+' '+fD(x.f):''}</div></div>${badge(x.p)}</a>`;
  return`<p class="note">Altas y bajas dependen de la nómina oficial: si falta una fecha, se muestra sin fecha. No se infiere nada que la fuente no diga.</p><h3 class="sh">Con licencia (${lic.length})</h3>${lic.map(([p,c])=>row({p,c,f:0},'')).join('')||'<p class="empty">Ninguna registrada.</p>'}<h3 class="sh">Mandatos que vencen próximamente (${vence.length})</h3>${vence.map(x=>row(x,'hasta')).join('')||'<p class="empty">Ninguno con fecha de fin cargada.</p>'}<h3 class="sh">Bajas y mandatos terminados recientes (${bajas.length})</h3>${bajas.map(x=>row(x,'desde')).join('')||'<p class="empty">Ninguna registrada.</p>'}`},
 estadisticas(){const N=pNotes(),per=PS.leg.eper,st=statsBlock('leg',N.leg,per),top=topPers(pLg(),Date.now()-per*DAY,10);
  return`<div class="pdq">${segB('eper',[[7,'7 días'],[30,'30 días'],[90,'90 días']],per)}</div><div class="jk">${kpi(st.a.length,'notas en el período',delta(st.a.length,st.b.length,cov(N.leg,per)))}${kpi(st.a.filter(n=>n.amb==='sal').length,'sobre Salta')}${kpi(st.a.filter(n=>n.amb==='nac').length,'sobre Nación')}</div>${st.html}<h3 class="sh">Legisladores más mencionados</h3>${top.length?barras(top.map(x=>[x.p.nombre,x.n,'#/persona/'+encodeURIComponent(x.p.id)]),Math.max(1,top[0].n)):'<p class="empty">Sin datos.</p>'}`},
 enlaces:()=>enlacesHtml('leg')};

/* ---------- Pintado y eventos ---------- */
const BUILD={eje:BE,leg:BL};let CUR={p:'',s:''};
const paint=async(p,s)=>{const b=Q('#pbody');if(!b)return;
 try{await Promise.all([pLoad(),need('news','of')]);if(!Q('#pbody'))return;
  b.innerHTML=BUILD[p][s]();
  if(['resumen','noticias','estadisticas'].includes(s)&&!((ES&&ES.arc)||[]).length&&typeof ES!=='undefined'){arcLoad().then(()=>{PN=null;if(Q('#pbody')&&CUR.p===p&&CUR.s===s){const y=scrollY;Q('#pbody').innerHTML=BUILD[p][s]();scrollTo(0,y)}})}
 }catch(e){console.error('NEWAR Poderes',e);if(Q('#pbody'))Q('#pbody').innerHTML='<p class="warn" role="alert">No se pudo armar esta sección. Probá recargar la página.</p>'}};
/* archivo de prensa compartido con Estadísticas */
let ARCP=null;const arcLoad=()=>ARCP||(ARCP=(async()=>{if(ES.arc)return ES.arc;try{const ix=await J('archivo/index',null,true),mes=ix&&ix.meses?Object.keys(ix.meses).sort().slice(-2):[];let a=[];for(const m of mes){const d=await J('archivo/'+m,null,true);if(d&&d.items)a=a.concat(d.items)}ES.arc=a}catch(e){ES.arc=ES.arc||[]}return ES.arc})());
const repaint=()=>{const y=scrollY;paint(CUR.p,CUR.s).then(()=>scrollTo(0,y))};
const mk=(p,orig)=>{const nombre=p==='eje'?'ejecutivo':'legislativo';
 return function(id){const s=BUILD[p][id]?id:'resumen';CUR={p,s};PS[p].sec=s;setTimeout(()=>paint(p,s),0);
  return`<h2 class="sec">${TIT[p]}</h2>${nav(p,s)}<div id="pbody"><p class="empty" role="status">Cargando…</p></div>`}};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#pbody button');if(!b)return;const p=CUR.p;if(!p||!PS[p])return;const o=PS[p];
 if(b.dataset.amb!==undefined){o.amb=b.dataset.amb;o.n=40;return repaint()}
 if(b.dataset.per!==undefined){o.per=+b.dataset.per;o.n=40;return repaint()}
 if(b.dataset.eper!==undefined){o.eper=+b.dataset.eper;return repaint()}
 if(b.dataset.oper!==undefined){o.oper=+b.dataset.oper;return repaint()}
 if(b.dataset.act==='mas'){o.n+=40;return repaint()}
 if(b.dataset.act==='csv'){const L=nFilt(p,o);csv((p==='eje'?'ejecutivo':'legislativo')+'-notas.csv',[['Fecha','Titular','Medio','Ámbito','Tono','Enlace']].concat(L.map(n=>[n.pub?dayK(n.ts):'',n.t,n.mn,n.amb==='sal'?'Salta':'Nación',n.sent,n.link])))}});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='pq'&&CUR.p){const o=PS[CUR.p];o.q=e.target.value;o.n=40;const L=nFilt(CUR.p,o);const l=Q('#pl');if(l)l.innerHTML=L.slice(0,o.n).map(noteRow).join('')||'<p class="empty">No hay notas con estos filtros.</p>';const c=Q('#pcn');if(c)c.textContent=L.length+' notas'+(o.per?' en los últimos '+o.per+' días':'')+'.'}});

/* envolver las vistas originales */
const oE=V.ejecutivo,oL=V.legislativo;
V._ejeOrig=oE;V._legOrig=oL;
V.ejecutivo=mk('eje',oE);V.legislativo=mk('leg',oL);
if(NEEDS){NEEDS.ejecutivo=Array.from(new Set((NEEDS.ejecutivo||[]).concat(['news','of'])));NEEDS.legislativo=Array.from(new Set((NEEDS.legislativo||[]).concat(['news','of','odd'])))}
})();
