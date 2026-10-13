/* ===== NEWAR · Poder Judicial (Nación y Salta) =====
   Pestaña «Judicial»: panorama, autoridades, organización, noticias con fecha, estadísticas, red,
   glosario y enlaces. También suma a «Estadísticas» el bloque «Agenda por poder», a «Red» la capa
   «Poder Judicial» y a «Inicio» un recuadro con lo último.
   Datos: data/judicial.json (curado, cada dato con su fuente), data/autoridades.json (Corte de Justicia
   de Salta), prensa (news_general + archivo) y publicaciones oficiales (oficiales.json).
   Lo que no se pudo verificar NO se completa: figura como «sin dato».
   Detectar una nota como «judicial» solo mira palabras del título: no es una acusación ni una verificación legal. */
(()=>{
const Q=s=>document.querySelector(s),DAY=864e5;
const JU={amb:'',tema:'',per:30,q:'',ext:0,n:40,eper:30,eamb:'',gq:'',gamb:'',lq:'',rper:90,ramb:'',rmw:1,rn:40,rk:{ins:1,jud:1,pol:1,ent:1},rsel:'',rfoco:''};
let JD=null,JDP=null;
const jLoad=()=>JDP||(JDP=J('judicial',null,true).then(v=>(JD=v||{})));
const fD=ts=>ts?new Date(ts).toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}):'';
const fDc=ts=>ts?new Date(ts).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'}):'';
const dayK=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const lnk=(u,t)=>/^https?:\/\//i.test(u||'')?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t||u)}</a>`:esc(t||'');
const pctf=(a,b)=>b?Math.round(a/b*100):0;
/* ¿hay datos del período anterior como para comparar? (si no, no se muestra una variación engañosa) */
const cov=(all,days)=>{const now=Date.now(),c=all.filter(n=>n.ts>=now-days*DAY).length,p=all.filter(n=>n.ts>=now-2*days*DAY&&n.ts<now-days*DAY).length;return p>=c*.5};

/* ---------- Archivo de prensa (se comparte con Estadísticas) ---------- */
let JARC=null;
const jArc=()=>JARC||(JARC=(async()=>{if(ES.arc)return ES.arc;try{const ix=await J('archivo/index',null,true),mes=ix&&ix.meses?Object.keys(ix.meses).sort().slice(-2):[];let a=[];for(const m of mes){const l=await J('archivo/'+m,[],true);a=a.concat(l||[])}ES.arc=a}catch(e){ES.arc=ES.arc||[]}return ES.arc})());

/* ---------- Detección por vocabulario (solo título) ---------- */
const EXC=/defensa y justicia|tribunal de disciplina|(deficit|ajuste|politica|presion|superavit|equilibrio|cuentas?|resultado|reforma|gasto|pacto|consolidacion|esfuerzo|control|crisis|ancla|situacion|cepo|dato|numeros|saneamiento|sustentabilidad|responsabilidad|frente|emision|estimulo|impulso|exceso|desequilibrio|beneficios?|carga|bache|inocencia|presupuesto|tierras?|hectareas) fiscal(es)?\b|\bfiscal (primario|financiero|y monetari\w+)\b|justicia social|justicialist|\ -\ temas\ -\ /g;
const RX={
 corte:/\b(corte suprema|csjn|rosatti|lorenzetti|rosenkrantz)\b/,
 pj:/\b(poder judicial|justicia federal|justicia provincial|justicia salteña|justicia penal|justicia electoral|justicia ordinaria|justicia nacional|ministerio de justicia|ministro de justicia|ante la justicia|a la justicia|la justicia (ordeno|dispuso|avalo|rechazo|freno|suspendio|resolvio|fallo|declaro|ratifico|revoco|investiga|cito|libero|confirmo)|judicializ\w+|judiciales?)\b/,
 mp:/\b(fiscalia|fiscalias|el fiscal|la fiscal|los fiscales|las fiscales|fiscal (general|federal|de|penal|ante|a cargo|del caso|pidio|acuso|imputo|requirio|solicito)|procurador(a)?|procuracion general|defensor(a)? (general|oficial|publico|de menores)|ministerio publico|ministerio fiscal)\b/,
 mag:/\b(consejo de la magistratura|jurado de enjuiciamiento|jury de enjuiciamiento|juicio politico|pliego|magistrad[oa]s?|camaristas?|jueces|jueza|juezas|juez|tribunal(es)? (oral|federal|superior|penal|de juicio|de apelaciones|de familia)|el tribunal|camara federal|camara de apelaciones|casacion|comodoro py|corte de justicia|conjueces?)\b/,
 causa:/\b(imputad[oa]s?|procesad[oa]s?|indagatoria|sobreseimiento|sobresee\w*|sobreseid[oa]s?|condenad[oa]s?|prision (preventiva|perpetua|domiciliaria)|juicio (oral|por jurados)|sentencia|fallo|querella(nte)?|habeas corpus|amparo|medida cautelar|cautelar|recurso extraordinario|elevacion a juicio)\b/
};
const RX_GRE=/\b(judiciales|empleados judiciales|asociacion de magistrados|union de empleados judiciales)\b/,RX_GRE2=/\b(paro|salari\w+|paritaria|reclamo|conflicto|gremi\w+|medida de fuerza)\b/;
const RX_SAL=/\b(salta|salteñ[oa]s?|oran|tartagal|metan|cafayate|rosario de la frontera|general guemes|ovejero|chiban|faraldo|vittar|lopez vinals|gauffin|nallim|diez villa)\b/;
const RX_NACM=/\b(milei|dnu|casa rosada|comodoro py|kirchner|cristina|congreso|nacion)\b/;
const RX_FOR=/\b(trump|eeuu|ee uu|estados unidos|netanyahu|israel|gaza|bolsonaro|brasil|colombia|bogota|mexico|chile|peru|uruguay|paraguay|bolivia|venezuela|españa|madrid|francia|italia|ucrania|rusia|china|reino unido|londres|nueva york|florida|texas|california|sudafrica|africa|india|japon|corea|iran|irak|siria|turquia|canada|australia|alemania|portugal|ecuador|panama|cuba|taiwan|filipinas|nigeria|egipto|arabia|emiratos|pakistan|indonesia)\b/;
const RX_ARG=/\b(argentin\w*|milei|buenos aires|salta|cordoba|rosario|santa fe|mendoza|tucuman|jujuy|corrientes|misiones|chaco|neuquen|comodoro py|corte suprema de justicia de la nacion|kirchner|cristina)\b/;
const TEMAS=[['corte','Corte Suprema'],['gre','Gremial judicial'],['mp','Ministerio Público'],['mag','Jueces y tribunales'],['causa','Causas y fallos'],['pj','Justicia (general)']];
const TEMA_C={corte:'var(--clay)',gre:'#b8860b',mp:'var(--indigo)',mag:'var(--pos)',causa:'var(--neg)',pj:'var(--neu)'};
const TEMA_N=Object.fromEntries(TEMAS);
const RX_SPORT=/\b(boca|river|racing|independiente|futbol|formula 1|gp de|colapinto|alpine|seleccion|torneo|liga|partido|club|mundial|vasco|gol|dt|arbitro|tenis|rugby|basquet|automovilismo|copa)\b/;
const judHits=t=>{const f=fold(t).replace(EXC,' ');let h=Object.keys(RX).filter(k=>RX[k].test(f));if(RX_SPORT.test(f)&&!RX.corte.test(f)&&!RX.mp.test(f))h=h.filter(k=>k!=='causa'&&k!=='pj');if(RX_GRE.test(f)&&RX_GRE2.test(f))h.push('gre');return h};
const judTema=h=>(TEMAS.find(([k])=>h.includes(k))||[''])[0];

/* ---------- Notas: todas las recolectadas (hoy + archivo), deduplicadas ---------- */
let JN=null;
const jNotes=()=>{const raw=(S.news||[]).concat(ES.arc||[]),key=raw.length+':'+((S.news||[]).length);if(JN&&JN.k===key)return JN;
 const seen=new Set(),seenT=new Set(),all=[],jud=[];
 raw.forEach(n=>{if(!n||!n.id||seen.has(n.id))return;seen.add(n.id);
  const t=tituloSinMedio(n),ts=Date.parse(n.published_iso||n.collected_at)||0,f=fold(t);
  const o={id:n.id,t,f,link:n.link,src:n.source,mk:medioKey(n.source),mn:medioNombre(n.source),ts,pub:!!n.published_iso,cat:n.category,sent:n.sentiment_label||''};
  all.push(o);
  if(/ - temas - /i.test(n.title||''))return;
  const h=judHits(t);if(!h.length)return;
  const tk=f.replace(/[^a-z0-9]+/g,' ').trim()+'|'+o.mk;if(seenT.has(tk))return;seenT.add(tk);
  o.hit=h;o.tema=judTema(h);
  const ff=f.replace(EXC,' ');
  o.sal=RX_SAL.test(ff)||(o.cat==='Provincial'&&!h.includes('corte')&&!RX_NACM.test(ff));
  o.amb=o.sal?'sal':'nac';
  o.ext=RX_FOR.test(ff)&&!RX_ARG.test(ff)?1:0;
  jud.push(o)});
 all.sort((a,b)=>b.ts-a.ts);jud.sort((a,b)=>b.ts-a.ts);
 return JN={k:key,all,jud}};
const jFilt=(o)=>{const lim=o.per?Date.now()-o.per*DAY:0,q=fold(o.q||'').trim();
 return jNotes().jud.filter(n=>(!lim||n.ts>=lim)&&(!o.amb||n.amb===o.amb)&&(!o.tema||n.hit.includes(o.tema))&&(o.ext||!n.ext)&&(!q||n.f.includes(q)||fold(n.mn).includes(q)))};

/* ---------- Publicaciones oficiales con tema judicial ---------- */
const OFJ=/\b(consejo de la magistratura|poder judicial|ministerio de justicia|ministerio publico|jurado de enjuiciamiento|corte suprema|corte de justicia|juzgado|juez|jueza|fiscal general|procurador|defensor general|camara federal|camara nacional|tribunal)\b/;
let JO=null;
const jOf=()=>{const it=(S.of&&S.of.items)||[];if(JO&&JO.n===it.length)return JO.l;
 const l=it.filter(x=>/poder judicial de salta|corte suprema/i.test(x.fuente||'')||(/boletin oficial/.test(fold(x.fuente||''))&&OFJ.test(fold(x.titulo)))).map(x=>{const ts=Date.parse(x.fecha_publicacion||'')||0,seen=Date.parse(x.first_seen||'')||0;
  return{t:x.titulo,link:x.url,fuente:x.fuente,org:x.organismo||'',amb:/salta/i.test(x.jurisdiccion||'')?'sal':'nac',tipo:x.tipo_acto||'',ts:ts||seen,pub:!!ts}}).sort((a,b)=>b.ts-a.ts);
 JO={n:it.length,l};return l};

/* ---------- Piezas visuales ---------- */
const css=document.createElement('style');css.textContent=`
.jt{display:flex;flex-wrap:wrap;gap:.35rem;margin:.2rem 0 1.1rem}.jt a{font-size:.82rem;padding:.3rem .75rem;border:1px solid var(--line);border-radius:99px;text-decoration:none;color:var(--ink);background:var(--raised)}.jt a:hover{border-color:var(--ink)}.jt a.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.jk{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.7rem;margin:.8rem 0 1.2rem}.jk>*{background:var(--raised);border:1px solid var(--line);padding:.7rem .9rem;border-radius:2px;text-decoration:none;color:var(--ink)}.jk .n{font:700 1.6rem/1.1 Newsreader,serif;display:block}.jk .l{font-size:.78rem;color:var(--soft)}.jk .d{font-size:.74rem}.jk .up{color:var(--negtx)}.jk .dn2{color:var(--soft)}
.jn{border-bottom:1px solid var(--line);padding:.6rem 0}.jn a.t{font-weight:600;overflow-wrap:anywhere}.jn .meta{margin-top:.15rem}
.jb{display:inline-block;font-size:.66rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:.08rem .45rem;border-radius:2px;color:#fff;background:var(--neu);margin-right:.3rem;vertical-align:.1em}.jb.ok{background:var(--pos)}.jb.no{background:var(--neg)}.jb.sd{background:transparent;color:var(--soft);border:1px dashed var(--soft)}
.jp{display:grid;grid-template-columns:repeat(auto-fit,minmax(17rem,1fr));gap:.8rem}.jp>div{background:var(--raised);border:1px solid var(--line);padding:.8rem 1rem;border-radius:2px}.jp h4{margin:0 0 .3rem;font-size:.95rem}.jp p{margin:.2rem 0;font-size:.84rem}
.jtr details{border-left:2px solid var(--line);margin:.35rem 0 .35rem .3rem;padding-left:.8rem}.jtr summary{cursor:pointer;font-weight:600;font-size:.9rem}.jtr details p{font-size:.84rem;margin:.3rem 0}
.jsvg{width:100%;height:auto;background:var(--raised);border:1px solid var(--line)}.jsvg text{font:9.5px Inter,sans-serif;fill:var(--soft)}
.jtbl{width:100%;border-collapse:collapse;font-size:.84rem}.jtbl th,.jtbl td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid var(--line)}.jtbl td.r,.jtbl th.r{text-align:right;font-variant-numeric:tabular-nums}
.jglo dt{font-weight:700;margin-top:.7rem}.jglo dd{margin:.1rem 0 0;font-size:.9rem;color:var(--soft);max-width:70ch}
.jlg{display:flex;flex-wrap:wrap;gap:.3rem .9rem;font-size:.78rem;color:var(--soft);margin:.4rem 0}.jlg i{display:inline-block;width:.7rem;height:.7rem;border-radius:50%;margin-right:.3rem;vertical-align:-.05em}
`;document.head.appendChild(css);

const SECS=[['resumen','Panorama'],['autoridades','Autoridades'],['organizacion','Organización'],['noticias','Noticias'],['estadisticas','Estadísticas'],['red','Red'],['glosario','Glosario'],['enlaces','Enlaces']];
const nav=s=>`<div class="jt" role="navigation" aria-label="Secciones del Poder Judicial">${SECS.map(([k,l])=>`<a href="#/judicial/${k}"${k===s?' class="on" aria-current="page"':''}>${l}</a>`).join('')}</div>`;
const ambB=a=>`<span class="jb" style="background:${a==='sal'?'var(--pos)':'var(--indigo)'}">${a==='sal'?'Salta':'Nación'}</span>`;
const temB=n=>n.tema?`<span class="jb" style="background:${TEMA_C[n.tema]}">${esc(TEMA_N[n.tema])}</span>`:'';
const noteRow=n=>`<div class="jn"><a class="t" href="${esc(safe(n.link))}" target="_blank" rel="noopener noreferrer">${esc(n.t)}</a><div class="meta">${ambB(n.amb)}${temB(n)}<b>${n.pub?fD(n.ts):'sin fecha de publicación (recolectada el '+fD(n.ts)+')'}</b> · ${esc(n.mn)}${n.ext?' · otro país':''}</div></div>`;
const ofRow=x=>`<div class="jn"><a class="t" href="${esc(safe(x.link))}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a><div class="meta">${ambB(x.amb)}${x.tipo?`<span class="jb">${esc(x.tipo)}</span>`:''}<b>${x.pub?fD(x.ts):'fecha de publicación no informada (detectada el '+fD(x.ts)+')'}</b> · ${esc(x.fuente)}</div></div>`;
const segB=(at,l,cur)=>`<div class="seg" role="group">${l.map(([v,t])=>`<button type="button" data-${at}="${v}" aria-pressed="${String(v)===String(cur)}"${String(v)===String(cur)?' class="on"':''}>${t}</button>`).join('')}</div>`;
const kpi=(n,l,d,href)=>`<${href?'a href="'+href+'"':'div'}><span class="n">${n}</span><span class="l">${l}</span>${d?`<span class="d ${d.startsWith('▲')?'up':'dn2'}">${d}</span>`:''}</${href?'a':'div'}>`;
const delta=(a,b,cov)=>cov===false?'sin período anterior comparable':b?(a>=b?'▲ ':'▼ ')+Math.abs(Math.round((a-b)/b*100))+'% vs período anterior':(a?'▲ nuevo (antes 0)':'');
const barras=(l,mx,col)=>l.map(([lab,n,href])=>hbar(esc(lab),n,mx,href||'',col||'var(--clay)')).join('');

/* ---------- Autoridades ---------- */
const AMBG=new Set(['villa','plaza']);
const keyOf=nom=>{const t=fold(nom).replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean),l=t[t.length-1]||'';return(AMBG.has(l)||l.length<5)&&t.length>1?t.slice(-2).join(' '):l};
const jPeople=()=>{
 const nac=((JD&&JD.nacional&&JD.nacional.autoridades)||[]).map(a=>Object.assign({amb:'nac'},a));
 const sal=(AUT.list||[]).filter(a=>a.camara==='Corte de Justicia').map(a=>({amb:'sal',id:a.id||('s-'+fold(a.nombre)),nombre:a.nombre,cargo:a.cargo,organismo:'Corte de Justicia de Salta',vigente:true,fuente:a.fuente,verificado:a.fecha||AUT.f,nota:''}));
 return nac.concat(sal)};
const mentionsOf=(p)=>{const k=keyOf(p.nombre),rx=new RegExp('\\b'+k.replace(/[^a-z\s]/g,'')+'\\b'),lim=Date.now()-30*DAY;
 const l=jNotes().all.filter(n=>rx.test(n.f));return{k,l,n30:l.filter(n=>n.ts>=lim).length}};
const vigB=p=>p.vigente===false?`<span class="jb no">No vigente${p.hasta?' desde '+esc(p.hasta):''}</span>`:'<span class="jb ok">Vigente</span>';
const personRow=p=>{const m=mentionsOf(p);return`<div class="jn"><span class="nm">${esc(p.nombre)}</span> ${vigB(p)}<div class="meta">${esc(p.cargo)} · ${esc(p.organismo)}${p.desde?' · desde '+esc(p.desde):''}</div>${p.nota?`<div class="meta">${esc(p.nota)}</div>`:''}<div class="meta">Dato verificado el ${esc(p.verificado||'—')} · ${lnk(p.fuente,'fuente')}${p.vigente===false&&p.motivo?' · '+esc(p.motivo):''} · ${m.n30} nota${m.n30===1?'':'s'} en 30 días que lo nombran${m.l.length?` · <a href="#/judicial/noticias" data-jq="${esc(m.k)}">ver notas</a>`:''}</div></div>`};
const sinDato=l=>(l||[]).map(s=>`<div class="jn"><span class="nm">${esc(s.cargo)}</span> <span class="jb sd">sin dato</span><div class="meta">${esc(s.organismo)} · ${esc(s.motivo)}${s.fuente?' · '+lnk(s.fuente,'dónde verificar'):''}</div></div>`).join('');

/* ---------- Secciones ---------- */
function sResumen(){
 const N=jNotes(),now=Date.now(),w=(a,b)=>N.jud.filter(n=>!n.ext&&n.ts>=now-a*DAY&&n.ts<now-b*DAY),a30=w(30,0),p30=w(60,30),a7=w(7,0),p7=w(14,7);
 const nac=a30.filter(n=>n.amb==='nac').length,sal=a30.length-nac,of=jOf(),of30=of.filter(x=>x.ts>=now-30*DAY),corte7=a7.filter(n=>n.hit.includes('corte')).length;
 const tot30=N.all.filter(n=>n.ts>=now-30*DAY).length;
 const rec=[...a30.slice(0,6)];const ofr=of.slice(0,4);
 const STOP=new Set('de la el los las un una en y a que por con para del al se su sus es lo como mas pero sobre tras entre ante hasta desde este esta fue fueron ser son hay no si ya o u e le les nuevo nueva primer segunda justicia judicial juez jueza jueces fallo corte suprema tribunal fiscal fiscalia causa juicio nacion federal'.split(' '));
 const bg={};a30.filter(n=>Date.now()-n.ts<=14*DAY).forEach(n=>{const tk=n.f.replace(EXC,' ').replace(/[^a-z0-9ñ ]+/g,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)),s=new Set();for(let i=0;i<tk.length-1;i++)s.add(tk[i]+' '+tk[i+1]);s.forEach(g=>{(bg[g]=bg[g]||[]).push(n)})});
 const cal=Object.entries(bg).filter(([,l])=>l.length>=3).sort((a,b)=>b[1].length-a[1].length).slice(0,8);
 const conv=((JD&&JD.convocatorias)||[]).filter(c=>!c.hasta||Date.parse(c.hasta)>=now-DAY);
 return`<p class="lede">Poder Judicial de la Nación y de la provincia de Salta: quiénes lo conducen, cómo se organiza, qué dice la prensa y qué publican los organismos oficiales. Cada nota muestra su fecha de publicación; cada dato de personas, su fuente.</p>
 <div class="jk">${kpi(a30.length,'notas judiciales en 30 días',delta(a30.length,p30.length,cov(N.all,30)),'#/judicial/noticias')}${kpi(nac,'de ámbito nacional','')}${kpi(sal,'de ámbito Salta','')}${kpi(pctf(a30.length,tot30)+'%','de todo lo recolectado','')}${kpi(corte7,'Corte Suprema, últimos 7 días',delta(corte7,p7.filter(n=>n.hit.includes('corte')).length,cov(N.all,7)))}${kpi(of30.length,'publicaciones oficiales en 30 días','','#/judicial/noticias')}</div>
 <p class="warn" role="note"><b>Cómo leer esto.</b> Una nota se marca como «judicial» si su título usa vocabulario judicial. <b>No es una acusación ni una verificación legal</b>: mencionar una causa no prueba nada sobre una persona. El ámbito (Nación o Salta) se estima por el contenido del título.</p>
 <h3 class="sh">Lo último en la prensa</h3>${rec.length?rec.map(noteRow).join(''):'<p class="empty">No hay notas judiciales en los últimos 30 días en lo recolectado.</p>'}<p class="note"><a href="#/judicial/noticias">Ver todas las noticias judiciales</a></p>
 ${ofr.length?`<h3 class="sh">Lo último que publicaron los organismos</h3>${ofr.map(ofRow).join('')}`:''}
 ${cal.length?`<h3 class="sh">De qué se habla (últimos 14 días)</h3><p class="note">Pares de palabras que se repiten en 3 o más notas judiciales. Tocá uno para ver las notas.</p><div>${cal.map(([g,l])=>`<a class="pill" href="#/judicial/noticias" data-jq="${esc(g)}">${esc(g)} <b>${l.length}</b></a>`).join('')}</div>`:''}
 ${conv.length?`<h3 class="sh">Convocatorias y plazos</h3>${conv.map(c=>`<div class="jn"><b>${esc(c.t)}</b> ${ambB(c.ambito==='Salta'?'sal':'nac')}<div class="meta">${esc(c.d)} ${c.desde?'Del '+esc(c.desde.split('-').reverse().join('/'))+' al '+esc((c.hasta||'').split('-').reverse().join('/')):''} · dato verificado el ${esc(c.verificado||'—')} · ${lnk(c.fuente,'fuente')}</div></div>`).join('')}`:''}
 <div class="jp" style="margin-top:1.4rem"><div><h4>Nación</h4><p>Corte Suprema, Consejo de la Magistratura, Ministerio Público y Ministerio de Justicia.</p><p><a href="#/judicial/autoridades">Ver autoridades</a> · <a href="#/judicial/organizacion">Cómo se organiza</a></p></div><div><h4>Salta</h4><p>Corte de Justicia, Consejo de la Magistratura, ministerios públicos y cuatro distritos judiciales.</p><p><a href="#/judicial/autoridades">Ver autoridades</a> · <a href="#/judicial/organizacion">Distritos y sedes</a></p></div><div><h4>Para investigar</h4><p>Consulta de causas, sentencias, estadísticas oficiales y directorios.</p><p><a href="#/judicial/enlaces">Enlaces oficiales</a> · <a href="#/judicial/glosario">Glosario</a></p></div></div>`}

function sAutoridades(){
 const P=jPeople(),nacP=P.filter(p=>p.amb==='nac'),salP=P.filter(p=>p.amb==='sal');
 const grp=l=>{const g={};l.forEach(p=>(g[p.organismo]=g[p.organismo]||[]).push(p));return Object.entries(g).map(([o,ps])=>`<h4 style="margin:1rem 0 .1rem;font-size:.9rem">${esc(o)}</h4>${ps.map(personRow).join('')}`).join('')};
 const nd=JD&&JD.nacional&&JD.nacional.sin_dato,sd=JD&&JD.salta&&JD.salta.sin_dato;
 return`<p class="lede">Autoridades que conducen el Poder Judicial. Cada persona tiene su fuente, la fecha en que se verificó y su estado (vigente / no vigente). Lo que no figura en una fuente oficial aparece como «sin dato» y nunca se completa con suposiciones.</p>
 <div class="ctl"><button type="button" data-jcsv="aut">⭳ CSV de autoridades</button></div>
 <h3 class="sh">Nación</h3>${grp(nacP)||'<p class="empty">Sin datos cargados.</p>'}${sinDato(nd)}
 <h3 class="sh">Provincia de Salta</h3>${grp(salP)||'<p class="empty">No se pudieron leer las autoridades de la Corte de Justicia de Salta.</p>'}${sinDato(sd)}
 <p class="note">Las autoridades de la Corte de Justicia de Salta se leen de <code>data/autoridades.json</code>, que se actualiza una vez por día desde justiciasalta.gov.ar${AUT.f?' (último dato: '+esc(AUT.f)+')':''}. Las de la Nación están en <code>data/judicial.json</code>: si alguien cambia de cargo, renuncia o fallece, se pone <code>"vigente": false</code>.</p>`}

const details=(t,d,open)=>`<details${open?' open':''}><summary>${t}</summary>${d}</details>`;
const lst=l=>l&&l.length?'<ul>'+l.map(x=>`<li>${x.url?lnk(x.url,x.t):esc(x.t||x)}${x.d?` — <span class="meta">${esc(x.d)}</span>`:''}</li>`).join('')+'</ul>':'';
function sOrganizacion(){
 const n=(JD&&JD.nacional)||{},s=(JD&&JD.salta)||{},mj=n.ministerio_justicia||{};
 const pills=l=>(l||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('');
 return`<p class="lede">Cómo está armado el Poder Judicial: quién hace qué. Es la estructura general, tal como la describen los sitios oficiales.</p>
 <h3 class="sh">Nación</h3><div class="jtr">${details('Organismos del Poder Judicial de la Nación',lst(n.estructura),1)}${details('Fueros (materias)',`<p>${pills(n.fueros)}</p>`)}${details('Ministerio de Justicia (Poder Ejecutivo) · titular: '+esc(mj.titular||'sin dato'),`<p class="meta">Secretarías: ${esc((mj.secretarias||[]).join(' · '))} · ${lnk(mj.fuente,'fuente')}</p><p><b>Organismos</b></p>${lst(mj.organismos)}<p><b>Registros</b></p>${lst(mj.registros)}`)}</div>
 <h3 class="sh">Provincia de Salta</h3><div class="jtr">${details('Órganos y ministerios públicos',lst(s.organos),1)}${details('Distritos judiciales y sedes',`<table class="jtbl"><tr><th>Distrito</th><th>Sede</th><th>Dirección</th></tr>${(s.distritos||[]).map(d=>d.sedes.map((x,i)=>`<tr><td>${i?'':'<b>'+esc(d.t)+'</b>'}</td><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join('')).join('')}</table><p class="note">Fuente: ${lnk(s.distritos_fuente,'justiciasalta.gov.ar')}</p>`)}${details('Fueros',`<p>${pills(s.fueros)}</p>`)}${details('Corte de Justicia: datos de la institución',`<p>Integrantes según la ley: <b>${esc(s.corte&&s.corte.integrantes_legales)}</b> · Presidencia: <b>${esc(s.corte&&s.corte.presidencia_anios)} años</b> · Ley Orgánica: <b>${esc(s.corte&&s.corte.ley_organica)}</b></p><p>Sede: ${esc(s.corte&&s.corte.sede)} · ${lnk(s.corte&&s.corte.fuente,'fuente')}</p>`)}${details('Servicios del Poder Judicial de Salta',`<p>${pills(s.servicios)}</p>`)}${details('Redes sociales oficiales',`<p>${(s.redes||[]).map(r=>`<span class="pill">${esc(r.t)}: <b>${esc(r.v)}</b></span>`).join('')}</p>`)}</div>
 <p class="note">Datos de <code>data/judicial.json</code>, verificados el ${esc((JD&&JD.actualizado)||'—')} en los sitios oficiales.</p>`}

function sNoticias(){
 const L=jFilt(Object.assign({},JU,{per:JU.per})),of=jOf().filter(x=>(!JU.amb||x.amb===JU.amb)&&(!JU.per||x.ts>=Date.now()-JU.per*DAY)&&(!JU.q||fold(x.t).includes(fold(JU.q))));
 return`<p class="lede">Notas de prensa con vocabulario judicial y publicaciones oficiales, siempre con su fecha. El filtro mira solo el título.</p>
 <div id="jnf"><div class="ctl">${segB('amb',[['','Todas'],['nac','Nación'],['sal','Salta']],JU.amb)}${segB('per',[[7,'7 d'],[30,'30 d'],[90,'90 d'],[0,'Todo']],JU.per)}<input type="search" id="jnq" placeholder="Buscar en títulos" value="${esc(JU.q)}" aria-label="Buscar en los títulos"></div>
 <div class="ctl">${segB('tema',[['','Todos los temas'],...TEMAS.map(([k,l])=>[k,l])],JU.tema)}<label class="chk"><input type="checkbox" id="jnx"${JU.ext?' checked':''}> Incluir justicia de otros países</label><button type="button" data-jcsv="not">⭳ CSV</button></div></div>
 <p class="note" role="status"><b>${L.length}</b> nota${L.length===1?'':'s'} judicial${L.length===1?'':'es'} · <b>${of.length}</b> ${of.length===1?'publicación oficial':'publicaciones oficiales'}${ES.arc&&ES.arc.length?'':' · cargando el archivo de días anteriores…'}</p>
 <h3 class="sh">Prensa</h3>${L.slice(0,JU.n).map(noteRow).join('')||'<p class="empty">No hay notas con estos filtros.</p>'}${L.length>JU.n?`<p><button type="button" data-jmore="1">Mostrar más (${L.length-JU.n} restantes)</button></p>`:''}
 <h3 class="sh">Publicaciones oficiales (Poder Judicial de Salta, Corte Suprema y Boletín Oficial)</h3>${of.slice(0,30).map(ofRow).join('')||'<p class="empty">No hay publicaciones oficiales con estos filtros.</p>'}${of.length>30?`<p class="note">Se muestran las 30 más recientes de ${of.length}. Ver todas en <a href="#/oficiales">Oficiales</a>.</p>`:''}`}

/* --- Estadísticas judiciales --- */
const serie=(L,per,all)=>{const a=[],end=new Date();end.setHours(0,0,0,0);const n=Math.min(per||90,90),m={};
 for(let i=n-1;i>=0;i--){const d=new Date(end.getTime()-i*DAY),k=dayK(d);m[k]={k,ts:d.getTime(),nac:0,sal:0,tot:0};a.push(m[k])}
 L.forEach(x=>{const o=m[dayK(x.ts)];if(o){o[x.amb]++}});(all||[]).forEach(x=>{const o=m[dayK(x.ts)];if(o)o.tot++});return a};
const chartBars=(d,H)=>{const W=640,P=22,mx=Math.max(1,...d.map(x=>x.nac+x.sal)),bw=(W-P)/d.length,y=v=>(H-P)-v/mx*(H-P-8),st=Math.ceil(d.length/8);
 return`<svg class="jsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Notas judiciales por día, Nación y Salta"><line x1="${P}" y1="${H-P}" x2="${W}" y2="${H-P}" stroke="var(--line)"/><text x="2" y="12">${mx}</text>${d.map((x,i)=>{const X=P+i*bw,h1=(x.nac)/mx*(H-P-8),h2=(x.sal)/mx*(H-P-8);return`<g><title>${esc(fD(x.ts))}: ${x.nac+x.sal} (Nación ${x.nac}, Salta ${x.sal})</title><rect x="${X.toFixed(1)}" y="${(H-P-h1).toFixed(1)}" width="${Math.max(1,bw-1).toFixed(1)}" height="${h1.toFixed(1)}" fill="var(--indigo)"/><rect x="${X.toFixed(1)}" y="${(H-P-h1-h2).toFixed(1)}" width="${Math.max(1,bw-1).toFixed(1)}" height="${h2.toFixed(1)}" fill="var(--pos)"/>${i%st?'':`<text x="${(X+bw/2).toFixed(1)}" y="${H-7}" text-anchor="middle">${fDc(x.ts)}</text>`}</g>`}).join('')}</svg><div class="jlg"><span><i style="background:var(--indigo)"></i>Nación</span><span><i style="background:var(--pos)"></i>Salta</span></div>`};
function sEstadisticas(){
 const per=JU.eper||90,now=Date.now(),N=jNotes(),lim=now-per*DAY,plim=now-2*per*DAY;
 const base=n=>!n.ext&&(!JU.eamb||n.amb===JU.eamb);
 const cur=N.jud.filter(n=>base(n)&&n.ts>=lim),prev=N.jud.filter(n=>base(n)&&n.ts>=plim&&n.ts<lim);
 const allCur=N.all.filter(n=>n.ts>=lim&&(!JU.eamb||(JU.eamb==='sal')===(n.cat==='Provincial')));
 const tem={},med={},sent={},dow=[0,0,0,0,0,0,0],per2={};
 cur.forEach(n=>{tem[n.tema]=(tem[n.tema]||0)+1;const o=med[n.mk]=med[n.mk]||{l:n.mn,n:0};o.n++;sent[n.sent||'sin dato']=(sent[n.sent||'sin dato']||0)+1;dow[(new Date(n.ts).getDay()+6)%7]++});
 const medAll={};allCur.forEach(n=>{medAll[n.mk]=(medAll[n.mk]||0)+1});
 const medL=Object.entries(med).sort((a,b)=>b[1].n-a[1].n).slice(0,10);
 const sentAll={};allCur.forEach(n=>{sentAll[n.sent||'sin dato']=(sentAll[n.sent||'sin dato']||0)+1});
 const tone=(o,T)=>['positivo','neutral','negativo'].map(k=>pctf(o[k]||0,T));
 const tj=cur.length,ta=allCur.length,tJ=tone(sent,tj),tA=tone(sentAll,ta);
 const P=jPeople().map(p=>Object.assign({p},mentionsOf(p))).map(o=>Object.assign(o,{n:o.l.filter(n=>n.ts>=lim).length})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n).slice(0,10);
 const of=jOf().filter(x=>x.ts>=lim&&(!JU.eamb||x.amb===JU.eamb)),ofOrg={};of.forEach(x=>{const k=x.org||x.fuente;ofOrg[k]=(ofOrg[k]||0)+1});
 const ofL=Object.entries(ofOrg).sort((a,b)=>b[1]-a[1]).slice(0,8);
 const dn=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],dmx=Math.max(1,...dow);
 const sd=cur.filter(n=>!n.pub).length;
 return`<p class="lede">Cuánta atención recibe la justicia en la prensa y qué publican los organismos. Se calcula sobre las notas recolectadas (no sobre toda la prensa) y cuenta una nota como judicial por el vocabulario de su título.</p>
 <div id="jef"><div class="ctl">${segB('eper',[[7,'7 d'],[30,'30 d'],[60,'60 d'],[90,'90 d']],JU.eper)}${segB('eamb',[['','Todo'],['nac','Nación'],['sal','Salta']],JU.eamb)}<button type="button" data-jcsv="est">⭳ CSV diario</button></div></div>
 <div class="jk">${kpi(cur.length,'notas judiciales',delta(cur.length,prev.length,cov(N.all,per)))}${kpi(pctf(cur.length,ta)+'%','del total recolectado','')}${kpi(Object.keys(med).length,'medios que las publican','')}${kpi(of.length,'publicaciones oficiales','')}${kpi(tJ[2]+'%','con tono negativo (resto: '+tA[2]+'%)','')}</div>
 <h3 class="sh">Evolución diaria</h3>${chartBars(serie(cur,per,[]),170)}
 <h3 class="sh">Por tema</h3>${barras(TEMAS.map(([k,l])=>[l,tem[k]||0]).filter(x=>x[1]),Math.max(1,...Object.values(tem)),'var(--clay)')||'<p class="empty">Sin datos.</p>'}<p class="note">Una nota puede tocar varios temas; acá cuenta una vez, en el principal.</p>
 <h3 class="sh">Qué medios cubren más la justicia</h3><table class="jtbl"><tr><th>Medio</th><th class="r">Notas judiciales</th><th class="r">% de lo que publica</th></tr>${medL.map(([k,o])=>`<tr><td>${esc(o.l)}</td><td class="r">${o.n}</td><td class="r">${pctf(o.n,medAll[k]||o.n)}%</td></tr>`).join('')||'<tr><td colspan="3">Sin datos</td></tr>'}</table>
 <h3 class="sh">Tono: cobertura judicial vs. todo lo recolectado</h3><table class="jtbl"><tr><th></th><th class="r">Positivo</th><th class="r">Neutral</th><th class="r">Negativo</th></tr><tr><td>Notas judiciales (${tj})</td>${tJ.map(v=>`<td class="r">${v}%</td>`).join('')}</tr><tr><td>Todo lo recolectado (${ta})</td>${tA.map(v=>`<td class="r">${v}%</td>`).join('')}</tr></table><p class="note">El tono lo asigna el recolector a partir del título; en temas judiciales tiende a ser negativo porque el vocabulario lo es, aunque la nota sea informativa.</p>
 <h3 class="sh">Autoridades judiciales más nombradas</h3>${P.length?barras(P.map(o=>[o.p.nombre+' · '+o.p.cargo,o.n]),P[0].n,'var(--indigo)'):'<p class="empty">Ninguna autoridad cargada aparece nombrada en el período.</p>'}
 <h3 class="sh">Día de la semana</h3><div class="jlg">${dn.map((d,i)=>`<span>${d} <b>${dow[i]}</b></span>`).join('')}</div>${barras(dn.map((d,i)=>[d,dow[i]]),dmx,'var(--neu)')}
 <h3 class="sh">Publicaciones oficiales por organismo</h3>${ofL.length?barras(ofL,ofL[0][1],'var(--ink)'):'<p class="empty">Sin publicaciones oficiales judiciales en el período.</p>'}
 <h3 class="sh">Calidad de este cálculo</h3><p class="note">${cur.length} notas detectadas por vocabulario; ${sd} sin fecha de publicación propia (se usó la fecha de recolección). Falsos positivos posibles (por ejemplo «fiscal» como adjetivo económico se descarta, pero no todo). ${ES.arc&&ES.arc.length?'Incluye el archivo de días anteriores ('+ES.arc.length+' notas).':'El archivo de días anteriores todavía no se cargó.'}</p>`}

/* --- Red judicial: quién y qué aparecen juntos en las notas judiciales --- */
const INST=[['i:csjn','Corte Suprema',/corte suprema|csjn/],['i:casacion','Cámara de Casación',/casacion/],['i:py','Comodoro Py',/comodoro py/],['i:cm','Consejo de la Magistratura',/consejo de la magistratura/],['i:jury','Jury / juicio político',/jurado de enjuiciamiento|jury de enjuiciamiento|juicio politico/],['i:mp','Ministerio Público',/ministerio publico|procuracion general|procurador/],['i:fed','Justicia Federal',/justicia federal|juzgado federal|camara federal|juez federal|jueza federal/],['i:sal','Justicia de Salta',/corte de justicia de salta|justicia de salta|poder judicial de salta|justicia salteña/],['i:mj','Ministerio de Justicia',/ministerio de justicia|ministro de justicia/]];
const PNRX=/(?:[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]+)(?:\s+(?:de|del|la|los|las|y)?\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]+){0,3}/g;
const PNSTOP=new Set(['justicia','corte','suprema','juez','jueza','fiscal','tribunal','gobierno','ley','nacion','salta','argentina','presidente','ministro','gobernador','senado','diputados','congreso','policia','casa','rosada','milei','buenos','aires','poder','judicial','federal','provincial','causa','juicio','caso','cámara','camara','infobae','estados','unidos','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','por','como','tras','sobre','ante','qué','que','cómo','cuál','quién','el','la','los','las','un','una','entre','hasta','desde','este','esta','año','años','nuevo','nueva','primera','primer','segunda','consejo','magistratura','comodoro','py','camara','cámara','tribunal','ministerio','publico','público']);
const jPol=()=>{const idx=[];(personas||[]).filter(p=>!p.homonimoDe&&p.cargos.some(c=>c.v===1)).forEach(p=>{[p.nombre,...(p.aliases||[])].forEach(a=>{const f=fold(a).replace(/[^a-z0-9]+/g,' ').trim();if(f.split(' ').length>=2)idx.push([p.id,p.nombre,new RegExp('\\b'+f.replace(/ /g,'\\s+')+'\\b')])})});return idx};
function redGraph(){
 const lim=JU.rper?Date.now()-JU.rper*DAY:0,L=jNotes().jud.filter(n=>!n.ext&&(!lim||n.ts>=lim)&&(!JU.ramb||n.amb===JU.ramb)),K=JU.rk;
 const aut=jPeople().filter(p=>p.vigente!==false).map(p=>({id:'j:'+p.id,lab:p.nombre,kind:'jud',rx:new RegExp('\\b'+keyOf(p.nombre)+'\\b'),cargo:p.cargo})),pol=jPol();
 const cnt={},M={};
 L.forEach(n=>{const e=new Map(),f=n.f;
  INST.forEach(([id,lab,rx])=>{if(K.ins&&rx.test(f))e.set(id,{lab,kind:'ins'})});
  aut.forEach(a=>{if(K.jud&&a.rx.test(f))e.set(a.id,{lab:a.lab,kind:'jud',cargo:a.cargo})});
  pol.forEach(([id,nom,rx])=>{if(K.pol&&rx.test(f))e.set('p:'+id,{lab:nom,kind:'pol',pid:id})});
  if(K.ent){const seen=new Set(),orig=n.t;(orig.match(PNRX)||[]).forEach((m,i)=>{const w=m.trim().split(/\s+/);if(w.length===1&&(w[0].length<6||PNSTOP.has(fold(w[0]))))return;if(w.every(x=>PNSTOP.has(fold(x))))return;const k=fold(m);if(seen.has(k))return;seen.add(k);if(INST.some(([,,rx])=>rx.test(k))||aut.some(a=>a.rx.test(k))||pol.some(q=>q[2].test(k)))return;e.set('e:'+k,{lab:m,kind:'ent'})})}
  const ids=[...e.keys()].slice(0,10);ids.forEach(i=>{const o=cnt[i]=cnt[i]||Object.assign({id:i,n:0},e.get(i));o.n++});
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=ids[i]<ids[j]?ids[i]:ids[j],b=a===ids[i]?ids[j]:ids[i],k=a+'|'+b,o=M[k]=M[k]||{a,b,w:0,n:[]};o.w++;o.n.push(n)}});
 let E=Object.values(M).filter(x=>x.w>=JU.rmw),deg={};
 E=E.filter(x=>{const A=cnt[x.a],B=cnt[x.b];return !(A.kind==='ent'&&B.kind==='ent'&&x.w<2)});
 E.forEach(x=>{deg[x.a]=(deg[x.a]||0)+x.w;deg[x.b]=(deg[x.b]||0)+x.w});
 let top=new Set(Object.keys(deg).sort((a,b)=>deg[b]-deg[a]).slice(0,JU.rn));
 if(JU.rfoco&&cnt[JU.rfoco]){const nb=new Set([JU.rfoco]);E.forEach(x=>{if(x.a===JU.rfoco)nb.add(x.b);if(x.b===JU.rfoco)nb.add(x.a)});top=nb}
 E=E.filter(x=>top.has(x.a)&&top.has(x.b));const dg={};E.forEach(x=>{dg[x.a]=(dg[x.a]||0)+x.w;dg[x.b]=(dg[x.b]||0)+x.w});
 const Nn=Object.keys(dg).map(id=>Object.assign({},cnt[id],{id,deg:dg[id]}));return{N:Nn,E,notas:L.length}}
const KC={ins:'var(--ink)',jud:'var(--clay)',pol:'var(--indigo)',ent:'var(--neu)'},KL={ins:'Institución',jud:'Autoridad judicial',pol:'Político de Salta',ent:'Persona o tema detectado en los títulos'};
const rjMove=(id,x,y)=>{const n=JU._ix&&JU._ix[id],b=Q('#rgbox');if(!n||!b)return;n.x=x;n.y=y;const g=[...b.querySelectorAll('g.nd')].find(q=>q.dataset.id===id);if(g)g.setAttribute('transform','translate('+x.toFixed(1)+','+y.toFixed(1)+')');b.querySelectorAll('line').forEach(l=>{if(l.dataset.a===id){l.setAttribute('x1',x.toFixed(1));l.setAttribute('y1',y.toFixed(1))}if(l.dataset.b===id){l.setAttribute('x2',x.toFixed(1));l.setAttribute('y2',y.toFixed(1))}})};
function paintRed(keep){const el=Q('#jrg');if(!el)return;
 const G=redGraph(),N=G.N,E=G.E;
 if(!N.length){el.innerHTML='<p class="empty">No hay conexiones con este filtro. Probá con un período más largo, «Desde 1 nota» o prendé más tipos de nodo.</p>';return}
 const W=1000,H=680,key=[JU.rper,JU.ramb,JU.rmw,JU.rn,JU.rfoco,Object.keys(JU.rk).filter(k=>JU.rk[k]).join(),N.length,E.length].join('|');
 JU._pos=JU._pos||{};const ix={};N.forEach(n=>ix[n.id]=n);let pos=JU._pos[key];if(pos)N.forEach(n=>{const q=pos[n.id];if(q){n.x=q[0];n.y=q[1]}});
 if(!pos||N.some(n=>n.x==null)){layoutRed(N,E.map(x=>({a:x.a,b:x.b,w:x.w})),W,H);pos=JU._pos[key]={};N.forEach(n=>pos[n.id]=[n.x,n.y])}
 JU._ix=ix;JU._E=E;JU._N=N;const f=v=>v.toFixed(1),sel=JU.rsel,top=new Set([...N].sort((a,b)=>b.deg-a.deg).slice(0,14).map(n=>n.id));
 const ln=E.map(e=>{const a=ix[e.a],b=ix[e.b];return`<line data-a="${esc(e.a)}" data-b="${esc(e.b)}" x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="var(--soft)" stroke-opacity="${Math.min(.8,.25+e.w*.1)}" stroke-width="${Math.min(3.2,.6+Math.sqrt(e.w)*.7)}"/>`}).join('');
 const nd=N.map(n=>{const r=n.kind==='ins'?10:4+Math.min(9,Math.sqrt(n.deg)*1.2),t=n.lab.length<=24?n.lab:n.lab.split(' ').slice(-2).join(' ');return`<g class="nd${n.id===sel?' sel':''}${top.has(n.id)||n.kind==='ins'||n.kind==='jud'?' top':''}" data-id="${esc(n.id)}" transform="translate(${f(n.x)},${f(n.y)})"><title>${esc(n.lab+' · '+KL[n.kind]+(n.cargo?' · '+n.cargo:''))}</title><circle r="${f(r)}" fill="${n.kind==='ent'?'var(--paper)':KC[n.kind]}" stroke="${n.kind==='ent'?'var(--neu)':'var(--raised)'}" stroke-width="1.6"/><text class="lb" y="${f(-r-3)}" text-anchor="middle">${esc(t)}</text></g>`}).join('');
 let pn='<p class="note">Tocá un círculo para ver con quién aparece y en qué notas. Arrastrá un círculo para acomodarlo. Una línea significa «aparecen en el título de la misma nota»: no implica relación, acuerdo ni responsabilidad.</p>';
 if(sel&&ix[sel]){const cs=E.filter(e=>e.a===sel||e.b===sel).sort((a,b)=>b.w-a.w).slice(0,25);
  pn=`<h3 class="sh">${esc(ix[sel].lab)} <span class="meta">· ${esc(KL[ix[sel].kind])}${ix[sel].cargo?' · '+esc(ix[sel].cargo):''}</span></h3>`+cs.map(e=>{const o=ix[e.a===sel?e.b:e.a];return`<div class="row2"><span class="nm"><a href="#" data-rsel="${esc(o.id)}">${esc(o.lab)}</a></span><span class="meta">${e.w} nota${e.w===1?'':'s'} en común · ${esc(KL[o.kind])}</span></div>${e.n.slice(0,3).map(m=>`<div class="meta"><a href="${esc(safe(m.link))}" target="_blank" rel="noopener noreferrer">${esc(m.t)}</a> · ${m.pub?fD(m.ts):'sin fecha propia'} · ${esc(m.mn)}</div>`).join('')}`}).join('')+`<p><button type="button" data-rfoco="${esc(sel)}">Ver solo su entorno</button></p>`}
 const kinds={};N.forEach(n=>kinds[n.kind]=(kinds[n.kind]||0)+1);
 el.innerHTML=`<p class="note"><b>${N.length}</b> nodos · <b>${E.length}</b> conexiones · calculado sobre <b>${G.notas}</b> notas judiciales</p><div class="jlg">${Object.keys(KC).map(k=>`<span><i style="background:${k==='ent'?'var(--paper);border:1.5px solid var(--neu)':KC[k]}"></i>${KL[k]} (${kinds[k]||0})</span>`).join('')}</div><div class="pzw rgv" id="rgbox" tabindex="0" role="region" aria-label="Grafo de la agenda judicial: ${N.length} nodos, ${E.length} conexiones. Rueda para acercar, arrastrar para mover."><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafo de la agenda judicial"><g>${ln}</g><g>${nd}</g></svg></div>${pn}`;
 pzMount(Q('#rgbox'),'rj',keep,rjMove);rgHl(sel)}
function sRed(){return`<p class="lede">Quiénes y qué aparecen juntos en las notas judiciales: instituciones, autoridades judiciales, políticos de Salta y las personas o temas que más se repiten en los títulos. Sirve para ver de un vistazo el núcleo de la agenda judicial de estos días. Para la red completa del poder en Salta, mirá la pestaña <a href="#/red">Red</a>, que ahora tiene una capa «Poder Judicial».</p>
 <div id="jrc"><div class="ctl">${segB('rper',[[30,'30 d'],[90,'90 d'],[0,'Todo']],JU.rper)}${segB('ramb',[['','Todo'],['nac','Nación'],['sal','Salta']],JU.ramb)}${segB('rmw',[[1,'Desde 1 nota'],[2,'Desde 2'],[3,'Desde 3']],JU.rmw)}${segB('rn',[[25,'25 nodos'],[40,'40'],[70,'70']],JU.rn)}</div>
 <div class="ctl">${[['ins','Instituciones'],['jud','Autoridades judiciales'],['pol','Políticos de Salta'],['ent','Personas y temas detectados']].map(([k,l])=>`<label class="chk"><input type="checkbox" data-rk="${k}"${JU.rk[k]?' checked':''}> ${l}</label>`).join('')}${JU.rfoco?'<button type="button" data-rfoco="">✕ Quitar foco</button>':''}<button type="button" data-jcsv="red">⭳ CSV de conexiones</button></div></div><div class="rg" id="jrg"><p class="empty">Calculando…</p></div>
 <p class="note">Las «personas y temas detectados» se extraen automáticamente de los títulos (palabras con mayúscula inicial que se repiten), por eso puede haber nombres de lugares u organizaciones mezclados. Las instituciones y autoridades salen de listas fijas.</p>`}

function sGlosario(){const g=(JD&&JD.glosario)||[],q=fold(JU.gq||'');const l=g.filter(x=>!q||fold(x.t+' '+x.d).includes(q));
 return`<p class="lede">Qué quiere decir cada palabra cuando aparece en una nota judicial. Es una guía orientativa de lenguaje; para casos concretos, consultá a un abogado o el glosario oficial.</p>
 <div class="ctl"><input type="search" id="jgq" placeholder="Buscar un término" value="${esc(JU.gq)}" aria-label="Buscar un término"></div>
 <p class="warn"><b>Ojo con los títulos.</b> «Imputado», «denunciado» o «investigado» no es lo mismo que «condenado». Hasta que una sentencia queda firme se presume la inocencia.</p>
 <dl class="jglo" id="jgl">${l.map(x=>`<dt>${esc(x.t)}</dt><dd>${esc(x.d)}</dd>`).join('')||'<p class="empty">No hay términos con esa búsqueda.</p>'}</dl><p class="note">Glosario oficial más completo: ${lnk('https://www.justicia.ar/herramientas/glosario','justicia.ar')}.</p>`}

function sEnlaces(){const e=(JD&&JD.enlaces)||[],q=fold(JU.lq||''),g={};
 e.filter(x=>(!JU.gamb||(JU.gamb==='sal')===(x.a==='Salta'))&&(!q||fold(x.t+' '+x.g).includes(q))).forEach(x=>(g[x.g]=g[x.g]||[]).push(x));
 return`<p class="lede">Portales oficiales para consultar causas, sentencias, estadísticas y trámites. Todos abren en una pestaña nueva, en el sitio oficial.</p>
 <div id="jlf"><div class="ctl">${segB('gamb',[['','Todos'],['nac','Nación'],['sal','Salta']],JU.gamb)}<input type="search" id="jlq" placeholder="Buscar un enlace" value="${esc(JU.lq)}" aria-label="Buscar un enlace"></div></div>
 ${Object.entries(g).map(([k,l])=>`<h3 class="sh">${esc(k)}</h3>${l.map(x=>`<div class="row2"><span class="nm">${lnk(x.u,x.t)}</span><span class="meta">${esc(x.a)}</span></div>`).join('')}`).join('')||'<p class="empty">No hay enlaces con esa búsqueda.</p>'}`}

/* ---------- Vista y eventos ---------- */
const BUILD={resumen:sResumen,autoridades:sAutoridades,organizacion:sOrganizacion,noticias:sNoticias,estadisticas:sEstadisticas,red:sRed,glosario:sGlosario,enlaces:sEnlaces};
let CUR='resumen';
async function paint(sec,keepScroll){const b=Q('#jbody');if(!b)return;
 try{await Promise.all([jLoad(),autLoad(),need('news','of')]);if(!Q('#jbody'))return;
  b.innerHTML=BUILD[sec]();if(sec==='red')paintRed(false);
  if(['resumen','noticias','estadisticas','red'].includes(sec)&&!(ES.arc&&ES.arc.length)){jArc().then(()=>{JN=null;if(Q('#jbody')&&CUR===sec){const y=window.scrollY;Q('#jbody').innerHTML=BUILD[sec]();if(sec==='red')paintRed(false);window.scrollTo(0,y)}})}
 }catch(e){console.error('NEWAR Judicial',e);if(Q('#jbody'))Q('#jbody').innerHTML='<p class="warn" role="alert">No se pudo armar esta sección. Probá recargar la página.</p>'}}
const repaint=()=>{const y=window.scrollY;paint(CUR).then(()=>window.scrollTo(0,y))};
V.judicial=(id)=>{CUR=BUILD[id]?id:'resumen';setTimeout(()=>paint(CUR),0);
 return`<h2 class="sec">Poder Judicial · Nación y Salta</h2>${nav(CUR)}<div id="jbody"><p class="empty" role="status">Cargando…</p></div>`};
NEEDS.judicial=['news','of'];
if(!TABS.some(t=>t[0]==='judicial')){const i=TABS.findIndex(t=>t[0]==='legislativo');TABS.splice(i<0?TABS.length:i+1,0,['judicial','Judicial'])}

const csv=(nom,filas)=>bajarCSV(nom,filas);
document.addEventListener('click',e=>{const t=e.target;if(!Q('#jbody'))return;
 const b=t.closest&&t.closest('button[data-amb],button[data-per],button[data-tema],button[data-eper],button[data-eamb],button[data-gamb],button[data-rper],button[data-ramb],button[data-rmw],button[data-rn],button[data-jmore],button[data-jcsv],button[data-rfoco]');
 const a=t.closest&&t.closest('a[data-jq],a[data-rsel]');
 if(a){e.preventDefault();if(a.dataset.jq!=null){JU.q=a.dataset.jq;JU.amb='';JU.tema='';JU.per=30;location.hash='#/judicial/noticias'}else{JU.rsel=a.dataset.rsel;paintRed(true)}return}
 if(!b)return;const d=b.dataset;
 if(d.amb!=null){JU.amb=d.amb;JU.n=40}else if(d.per!=null){JU.per=+d.per;JU.n=40}else if(d.tema!=null){JU.tema=d.tema;JU.n=40}
 else if(d.eper!=null)JU.eper=+d.eper;else if(d.eamb!=null)JU.eamb=d.eamb;else if(d.gamb!=null)JU.gamb=d.gamb;
 else if(d.rper!=null||d.ramb!=null||d.rmw!=null||d.rn!=null){if(d.rper!=null)JU.rper=+d.rper;if(d.ramb!=null)JU.ramb=d.ramb;if(d.rmw!=null)JU.rmw=+d.rmw;if(d.rn!=null)JU.rn=+d.rn;JU.rsel='';repaint();return}
 else if(d.rfoco!=null){JU.rfoco=d.rfoco;JU.rsel=d.rfoco;repaint();return}
 else if(d.jmore){JU.n+=40}
 else if(d.jcsv){const k=d.jcsv;
  if(k==='aut')csv('autoridades-judiciales-'+dayK(Date.now())+'.csv',[['Nombre','Cargo','Organismo','Vigente','Desde','Verificado','Fuente'],...jPeople().map(p=>[p.nombre,p.cargo,p.organismo,p.vigente===false?'no':'sí',p.desde||'',p.verificado||'',p.fuente||''])]);
  else if(k==='not')csv('notas-judiciales-'+dayK(Date.now())+'.csv',[['Fecha de publicación','Ámbito','Tema','Medio','Título','Enlace'],...jFilt(JU).map(n=>[n.pub?dayK(n.ts):'sin fecha',n.amb==='sal'?'Salta':'Nación',TEMA_N[n.tema]||'',n.mn,n.t,n.link])]);
  else if(k==='est'){const per=JU.eper||90,c=jNotes().jud.filter(n=>!n.ext&&n.ts>=Date.now()-per*DAY&&(!JU.eamb||n.amb===JU.eamb));csv('estadisticas-judiciales-'+per+'d.csv',[['Día','Nación','Salta','Total'],...serie(c,per,[]).map(x=>[x.k,x.nac,x.sal,x.nac+x.sal])])}
  else if(k==='red'){const G=redGraph(),ix={};G.N.forEach(n=>ix[n.id]=n);csv('red-judicial.csv',[['Entidad A','Tipo A','Entidad B','Tipo B','Notas en común'],...G.E.map(x=>[ix[x.a].lab,KL[ix[x.a].kind],ix[x.b].lab,KL[ix[x.b].kind],x.w])])}
  return}
 repaint()});
document.addEventListener('input',e=>{const t=e.target;if(!t||!Q('#jbody'))return;
 if(t.id==='jnq'){clearTimeout(jnqT);jnqT=setTimeout(()=>{JU.q=t.value;JU.n=40;const y=window.scrollY,p=t.selectionStart;paint(CUR).then(()=>{const i=Q('#jnq');if(i){i.focus();try{i.setSelectionRange(p,p)}catch(x){}}window.scrollTo(0,y)})},250)}
 else if(t.id==='jgq'){JU.gq=t.value;const g=(JD&&JD.glosario)||[],q=fold(JU.gq);Q('#jgl').innerHTML=g.filter(x=>!q||fold(x.t+' '+x.d).includes(q)).map(x=>`<dt>${esc(x.t)}</dt><dd>${esc(x.d)}</dd>`).join('')||'<p class="empty">No hay términos con esa búsqueda.</p>'}
 else if(t.id==='jlq'){JU.lq=t.value;const p=t.selectionStart;paint(CUR).then(()=>{const i=Q('#jlq');if(i){i.focus();try{i.setSelectionRange(p,p)}catch(x){}}})}});
let jnqT=0;
document.addEventListener('change',e=>{const t=e.target;if(!t||!Q('#jbody'))return;
 if(t.id==='jnx'){JU.ext=t.checked?1:0;repaint()}
 else if(t.dataset&&t.dataset.rk){JU.rk[t.dataset.rk]=t.checked?1:0;JU.rsel='';repaint()}});
document.addEventListener('mouseover',e=>{if(!Q('#jrg'))return;const g=e.target.closest&&e.target.closest('#jrg g.nd');rgHl(g?g.dataset.id:JU.rsel)});
document.addEventListener('mouseleave',e=>{if(Q('#jrg'))rgHl(JU.rsel)},true);
document.addEventListener('click',e=>{const g=e.target.closest&&e.target.closest('#jrg g.nd');if(!g)return;const b=Q('#rgbox');if(b&&b._mv)return;JU.rsel=JU.rsel===g.dataset.id?'':g.dataset.id;paintRed(true)});

/* ---------- Red (pestaña principal): capa «Poder Judicial» ---------- */
RCAP.splice(RCAP.findIndex(x=>x[0]==='cup')+1,0,['jud','Poder Judicial (autoridades)','var(--clay)'],['jco','Poder Judicial: nombrados en una misma nota','#7b3fa0']);
RED.cap.jud=1;RED.cap.jco=1;
RST.jud=['var(--clay)','2 3'];RST.jco=['#7b3fa0','1 2'];
RLB.jud=e=>'autoridad judicial'+(e.l?' · '+e.l:'');RLB.jco=e=>e.w+' nota'+(e.w===1?'':'s')+' judicial'+(e.w===1?'':'es')+' donde se los nombra';
window.judRed=(N,E,add,hub,L,cp)=>{
 if(!JD)return;
 const people=jPeople().filter(p=>p.vigente!==false),idOf={};
 /* nodos: autoridades de la Nación (las de la Corte de Salta ya entran con la capa «Autoridades de cámara») */
 if(cp.jud){people.filter(p=>p.amb==='nac').forEach(p=>{const org=p.organismo,hid='c:'+org;hub(hid,org.replace(/ \(.*/,''));const id='jn:'+p.id;add(id,{a:{cargo:p.cargo,camara:org,fecha:p.verificado,fuente:p.fuente},lab:p.nombre});N[id].cup=p.cargo;L(id,hid,'jud',2,[],p.cargo)})}
 /* ids de nodo de cada autoridad (Nación: 'jn:..'; Salta: nodo con .a.camara = Corte de Justicia) */
 people.forEach(p=>{const nid=p.amb==='nac'?'jn:'+p.id:Object.keys(N).find(k=>N[k].a&&N[k].a.camara==='Corte de Justicia'&&fold(N[k].lab)===fold(p.nombre));if(nid&&N[nid])idOf[p.id]={nid,rx:new RegExp('\\b'+keyOf(p.nombre)+'\\b')}});
 if(!cp.jco)return;
 const lim=RED.per?Date.now()-RED.per*DAY:0,pol=Object.keys(N).filter(k=>N[k].p).map(k=>({k,rx:null,p:N[k].p}));
 const idx=jPol(),M={};
 jNotes().jud.filter(n=>!n.ext&&(!lim||n.ts>=lim)).forEach(n=>{const ids=new Set();
  Object.values(idOf).forEach(o=>{if(o.rx.test(n.f))ids.add(o.nid)});
  idx.forEach(([pid,,rx])=>{if(N[pid]&&rx.test(n.f))ids.add(pid)});
  const a=[...ids].sort();for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const k=a[i]+'|'+a[j];(M[k]=M[k]||{a:a[i],b:a[j],w:0,n:[]});M[k].w++;M[k].n.push({title:n.t,link:n.link})}});
 Object.values(M).filter(e=>e.w>=RED.mw).forEach(e=>E.push(Object.assign(e,{t:'jco'})))};

{const o=V.red;V.red=function(){const h=o.apply(this,arguments);
 if(!JD)jLoad().then(()=>{setTimeout(()=>{if(Q('#rg')&&RED._N)try{dibujaRed(true)}catch(e){console.error('NEWAR Judicial (red)',e)}},300)});
 return h}}
/* ---------- Estadísticas (pestaña principal): «Agenda por poder» ---------- */
const PODER={
 eje:['Ejecutivo','var(--clay)',/\b(gobernador|presidente de la nacion|milei|saenz|casa rosada|gabinete|ministr[oa]s? (de|del)|decreto|dnu|intendente|jefe de gabinete|poder ejecutivo|gobierno (nacional|provincial)|boletin oficial)\b/],
 leg:['Legislativo','var(--indigo)',/\b(senad\w*|diputad\w*|legislat\w*|congreso|concejal\w*|concejo deliberante|sesion|proyecto de ley|interbloque|bloque)\b/],
 jud:['Judicial','var(--pos)',null]};
const poderPaint=()=>{const el=Q('#jpd');if(!el)return;
 const per=ES.per||14,now=Date.now(),lim=now-per*DAY,plim=now-2*per*DAY,N=jNotes(),amb=ES.amb;
 const ok=n=>!amb||(amb==='nac')===(n.cat==='Nacional');
 const cl=n=>{const o=[];if(PODER.eje[2].test(n.f))o.push('eje');if(PODER.leg[2].test(n.f))o.push('leg');if(judHits(n.t).length&&!RX_FOR.test(n.f))o.push('jud');return o};
 const cur={eje:[],leg:[],jud:[]},prev={eje:0,leg:0,jud:0};let totC=0,totP=0;
 N.all.forEach(n=>{if(!ok(n)||n.ts<plim)return;const isC=n.ts>=lim;isC?totC++:totP++;cl(n).forEach(k=>{isC?cur[k].push(n):prev[k]++})});
 const ks=['eje','leg','jud'],byM={};ks.forEach(k=>cur[k].forEach(n=>{const o=byM[n.mk]=byM[n.mk]||{l:n.mn,eje:0,leg:0,jud:0,t:0};o[k]++}));
 N.all.forEach(n=>{if(ok(n)&&n.ts>=lim&&byM[n.mk])byM[n.mk].t++});
 const M=Object.values(byM).sort((a,b)=>(b.eje+b.leg+b.jud)-(a.eje+a.leg+a.jud)).slice(0,8);
 const days=[],end=new Date();end.setHours(0,0,0,0);const nd=Math.min(per,30);for(let i=nd-1;i>=0;i--)days.push(end.getTime()-i*DAY);
 const sr={};ks.forEach(k=>{const m={};cur[k].forEach(n=>{const d=dayK(n.ts);m[d]=(m[d]||0)+1});sr[k]=days.map(d=>m[dayK(d)]||0)});
 const mx=Math.max(1,...ks.flatMap(k=>sr[k])),W=640,H=150,P=22,X=i=>P+i*(W-P-6)/Math.max(1,nd-1),Y=v=>H-P-v/mx*(H-P-10),st=Math.ceil(nd/8);
 const line=k=>`<polyline fill="none" stroke="${PODER[k][1]}" stroke-width="2" points="${sr[k].map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/>`;
 const tone=k=>{const c={};cur[k].forEach(n=>{c[n.sent||'x']=(c[n.sent||'x']||0)+1});const t=cur[k].length;return t?[pctf(c.positivo||0,t),pctf(c.neutral||0,t),pctf(c.negativo||0,t)]:[0,0,0]};
 el.innerHTML=`<h2 class="sec" style="margin-top:1.4rem">Agenda por poder</h2><p class="note">Cuántas notas del período tocan al Poder Ejecutivo, al Legislativo y al Judicial (por palabras del título; una nota puede contar en más de uno). Sigue los filtros de arriba (período y ámbito). Detalle del Poder Judicial en <a href="#/judicial/estadisticas">Judicial › Estadísticas</a>.</p>
 <div class="jk">${ks.map(k=>kpi(cur[k].length,PODER[k][0]+' · '+pctf(cur[k].length,totC)+'% de las notas',delta(cur[k].length,prev[k],cov(N.all,per)))).join('')}</div>
 <svg class="jsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Notas por día según el poder"><line x1="${P}" y1="${H-P}" x2="${W}" y2="${H-P}" stroke="var(--line)"/><text x="2" y="12">${mx}</text>${ks.map(line).join('')}${days.map((d,i)=>i%st?'':`<text x="${X(i).toFixed(1)}" y="${H-7}" text-anchor="middle">${fDc(d)}</text>`).join('')}</svg>
 <div class="jlg">${ks.map(k=>`<span><i style="background:${PODER[k][1]}"></i>${PODER[k][0]}</span>`).join('')}</div>
 <table class="jtbl"><tr><th>Medio</th><th class="r">Ejecutivo</th><th class="r">Legislativo</th><th class="r">Judicial</th><th class="r">% judicial de lo que publica</th></tr>${M.map(o=>`<tr><td>${esc(o.l)}</td><td class="r">${o.eje}</td><td class="r">${o.leg}</td><td class="r">${o.jud}</td><td class="r">${pctf(o.jud,o.t||1)}%</td></tr>`).join('')||'<tr><td colspan="5">Sin datos en el período</td></tr>'}</table>
 <table class="jtbl" style="margin-top:.8rem"><tr><th>Tono de las notas</th><th class="r">Positivo</th><th class="r">Neutral</th><th class="r">Negativo</th></tr>${ks.map(k=>`<tr><td>${PODER[k][0]}</td>${tone(k).map(v=>`<td class="r">${v}%</td>`).join('')}</tr>`).join('')}</table>`};
{const o=V.estadisticas;V.estadisticas=function(){const h=o.apply(this,arguments);
 setTimeout(()=>{need('news').catch(()=>0).then(()=>{try{poderPaint()}catch(x){console.error('NEWAR Agenda por poder',x)}});
  const c=Q('#esc');if(c){c.addEventListener('click',()=>setTimeout(poderPaint,30));c.addEventListener('change',()=>setTimeout(poderPaint,30))}
  jArc().then(()=>{JN=null;try{poderPaint()}catch(x){}})},60);
 return h+'<div id="jpd"></div>'}}

/* ---------- Inicio: recuadro «Poder Judicial» ---------- */
{const o=V.inicio;V.inicio=function(){const h=o.apply(this,arguments);
 setTimeout(()=>{need('news').catch(()=>0).then(()=>{const el=Q('#jini');if(!el)return;const now=Date.now(),L=jNotes().jud.filter(n=>!n.ext&&n.ts>=now-7*DAY),top=L.slice(0,4);
  el.innerHTML=`<h2 class="sec">Poder Judicial</h2><p class="note"><b>${L.length}</b> nota${L.length===1?'':'s'} judicial${L.length===1?'':'es'} en los últimos 7 días (${L.filter(n=>n.amb==='sal').length} de Salta). <a href="#/judicial">Abrir la pestaña Judicial</a></p>${top.map(noteRow).join('')}`}).catch(()=>0)},80);
 return h+'<div id="jini"></div>'}}
})();
