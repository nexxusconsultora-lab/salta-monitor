/* ===== NEWAR · Asistente de voz (estilo Jarvis) · v2 =====
   Hablale a NEWAR: «Newar, ir a mapa», «Newar, ¿cuántas notas hay hoy?», «Newar, ¿qué dicen de Sáenz?»…
   • Entiende «Newar» aunque el navegador lo escriba «Neward», «Nuar», «New ar», «Newart»… (también responde a «Jarvis»).
   • Responde en voz alta (voz a elección, velocidad y tono) y por escrito. Si no querés voz, la apagás en el panel.
   • Ejecuta órdenes (abrir pantallas, filtros, seguir personas, anotar…) y contesta preguntas con los datos de NEWAR.
   • Manos libres: escucha siempre; hay que empezar con «Newar» y después puede seguir hablando sin repetirlo unos segundos.
   • También se puede escribir la orden en el cuadro (sirve en cualquier navegador).
   PRIVACIDAD: el reconocimiento de voz lo hace el navegador (Chrome, Edge, Safari). En Chrome y Edge el audio se envía a un servicio de
   voz en la nube del fabricante; NEWAR no graba ni guarda audio, solo recibe el texto. Firefox no lo soporta: usá el cuadro de texto.
   Las cifras que dice salen de lo que el monitor ya guardó; si algo no está, dice «sin dato». */
(()=>{
'use strict';
const SR=window.SpeechRecognition||window.webkitSpeechRecognition,TTS='speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';
const VK='newar_voz_v2',CFG=Object.assign({hf:0,wake:1,say:1,conf:1,voice:'',gen:'',rate:1,pitch:1},(()=>{try{return JSON.parse(localStorage.getItem(VK)||'{}')}catch(e){return{}}})());
const save=()=>{try{localStorage.setItem(VK,JSON.stringify(CFG))}catch(e){}};
const norm=s=>fold(s).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const f1=n=>Number(n).toLocaleString('es-AR',{maximumFractionDigits:1});
const lv=(a,b)=>typeof lev==='function'?lev(a,b):(a===b?0:9);
const nn=v=>typeof verNum==='function'?verNum(v):v;
const hoyF=()=>new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const saludoHora=()=>{const h=new Date().getHours();return h<6?'Buenas noches':h<13?'Buen día':h<20?'Buenas tardes':'Buenas noches'};

/* ---------- interfaz ---------- */
const css=document.createElement('style');css.textContent=`
#nvfab{position:fixed;right:1rem;bottom:calc(8.4rem + env(safe-area-inset-bottom,0px));z-index:30;width:3.4rem;height:3.4rem;border-radius:50%;border:2px solid var(--ink);background:var(--indigo);color:var(--onind);font-size:1.35rem;line-height:1;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35);padding:0}
#nvfab:hover{filter:brightness(1.1)}#nvfab.on{background:var(--neg);color:#fff;animation:nvp 1.2s ease-in-out infinite}#nvfab.th{animation:nvt 1s linear infinite}#nvfab.spk{background:var(--pos);color:#fff;animation:nvs .9s ease-in-out infinite}
@keyframes nvp{0%{box-shadow:0 0 0 0 rgba(255,62,108,.6),0 3px 12px rgba(0,0,0,.35)}100%{box-shadow:0 0 0 .8rem rgba(255,62,108,0),0 3px 12px rgba(0,0,0,.35)}}
@keyframes nvs{0%,100%{transform:scale(1)}50%{transform:scale(1.12);box-shadow:0 0 18px var(--pos)}}@keyframes nvt{to{filter:hue-rotate(360deg)}}
#nvp{position:fixed;z-index:31;right:.8rem;bottom:calc(12.4rem + env(safe-area-inset-bottom,0px));width:min(27rem,calc(100vw - 1.6rem));max-height:min(38rem,calc(100vh - 8rem));display:flex;flex-direction:column;background:var(--raised);color:var(--ink);border:2px solid var(--ink);border-radius:.6rem;box-shadow:0 8px 28px rgba(0,0,0,.4);font-size:.86rem}
#nvp[hidden]{display:none}#nvp header{display:flex;align-items:center;gap:.4rem;padding:.45rem .6rem;border-bottom:1px solid var(--line)}#nvp header b{flex:1}
#nvp button,#nvp input[type=text],#nvp select{font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:.3rem;padding:.25rem .55rem}#nvp button{cursor:pointer;background:var(--raised)}#nvp button:hover{background:var(--hov)}#nvp button.on{background:var(--indigo);color:var(--onind)}
#nvb{overflow-y:auto;padding:.5rem .6rem;display:flex;flex-direction:column;gap:.45rem}
#nvt{min-height:2.6rem;border:1px dashed var(--line);border-radius:.3rem;padding:.4rem .55rem;font-size:.95rem}#nvt small{display:block;color:var(--soft)}#nvt.ok{border-color:var(--pos)}#nvt.no{border-color:var(--neg)}
#nvlog{display:flex;flex-direction:column;gap:.25rem;max-height:9.5rem;overflow-y:auto;font-size:.8rem}#nvlog div{padding:.15rem .4rem;border-radius:.3rem}#nvlog .u{background:var(--hov);align-self:flex-end;max-width:90%}#nvlog .n{background:var(--sel);max-width:92%}
.nvr{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}.nvr input[type=text]{flex:1 1 11rem;min-width:0}.nvr label{display:flex;align-items:center;gap:.3rem;font-size:.8rem}.nvr input[type=range]{width:7rem}
#nvh{font-size:.8rem}#nvh h4{margin:.5rem 0 .15rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--soft)}#nvh code{display:inline-block;margin:.1rem .2rem .1rem 0}
details.nvs summary{cursor:pointer;font-size:.8rem;color:var(--soft)}
#nvlive{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(3.2rem + env(safe-area-inset-bottom,0px));z-index:45;max-width:min(38rem,92vw);padding:.55rem 1rem;border-radius:2rem;background:var(--ink);color:var(--paper);font:600 .95rem system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4);display:none}#nvlive.on{display:block}
body.hud #nvfab{background:linear-gradient(135deg,#22E3FF,#8FA8FF);color:#04101D}
@media print{#nvfab,#nvp,#nvlive{display:none!important}}@media(max-width:640px){#nvp{left:.4rem;right:.4rem;width:auto}}
`;document.head.appendChild(css);
document.body.insertAdjacentHTML('beforeend',`<div id="nvlive" role="status" aria-live="polite"></div>
<button id="nvfab" type="button" aria-label="Asistente de voz" title="Asistente de voz (Alt+V para hablar)">🎤</button>
<section id="nvp" role="dialog" aria-label="Asistente de voz" hidden>
<header><b>🎤 NEWAR · asistente</b><button type="button" data-nv="help" title="Qué puedo decir">?</button><button type="button" data-nv="close" aria-label="Cerrar">✕</button></header>
<div id="nvb"><div id="nvt" aria-live="polite">Tocá el micrófono y decí una orden o una pregunta. Por ejemplo: <b>«¿cuántas notas hay hoy?»</b></div><div id="nvlog" aria-label="Conversación"></div>
<div class="nvr"><button type="button" id="nvtalk" data-nv="talk">🎤 Hablar</button><button type="button" id="nvhf" data-nv="hf" title="Escucha siempre; empezá cada orden con «Newar»">Manos libres</button><button type="button" id="nvstop" data-nv="shh" title="Callar la voz">🔇 Callar</button></div>
<div class="nvr"><input type="text" id="nvin" placeholder="O escribí: ir a red, ¿qué dicen de Sáenz?…" aria-label="Escribir una orden" autocomplete="off"><button type="button" data-nv="run">Enviar</button></div>
<details class="nvs"><summary>Voz y ajustes</summary><div class="nvr" style="margin-top:.4rem"><label><input type="checkbox" id="nvsay"> Responder en voz alta</label><label><input type="checkbox" id="nvconf"> Confirmar cada orden</label><label><input type="checkbox" id="nvwake"> Pedir «Newar» (manos libres)</label></div>
<div class="nvr" style="margin-top:.4rem"><select id="nvvoice" aria-label="Voz"><option value="">Mejor voz automática</option></select><select id="nvgen" aria-label="Tipo de voz"><option value="">Cualquiera</option><option value="f">Mujer</option><option value="m">Hombre</option></select><button type="button" data-nv="test">▶ Probar</button></div><p class="note" id="nvvn"></p>
<div class="nvr" style="margin-top:.4rem"><label>Velocidad <input type="range" id="nvrate" min="0.7" max="1.5" step="0.05"></label><label>Tono <input type="range" id="nvpitch" min="0.6" max="1.5" step="0.05"></label></div></details>
<p class="note" id="nvsup"></p><div id="nvh" hidden></div></div></section>`);
const fab=$('#nvfab'),pan=$('#nvp'),live=$('#nvlive'),tbox=$('#nvt');
let _lt=0;const show=(heard,res,ok)=>{tbox.className=ok==null?'':ok?'ok':'no';tbox.innerHTML='';const a=document.createElement('div');a.textContent=heard?'«'+heard+'»':'';tbox.appendChild(a);if(res){const s=document.createElement('small');s.textContent=res;tbox.appendChild(s)}
 live.textContent=(ok===false?'✖ ':ok?'✔ ':'🎤 ')+(String(res||heard||'').slice(0,220));live.classList.add('on');clearTimeout(_lt);_lt=setTimeout(()=>live.classList.remove('on'),ok==null?6000:Math.min(9000,3500+String(res||'').length*35))};
const logAdd=(who,txt)=>{const l=$('#nvlog'),d=document.createElement('div');d.className=who;d.textContent=(who==='u'?'🗣 ':'◈ ')+txt;l.appendChild(d);while(l.children.length>10)l.removeChild(l.firstChild);l.scrollTop=l.scrollHeight};

/* ---------- voz (síntesis) ---------- */
let voices=[],hablando=false,cancelado=false,awakeUntil=0,ultima='',colaLect=[],ctx={p:null,tema:''},pend=null,lastSpoken='',speakEnd=0;
const FEM=/elena|dalia|elvira|paulina|monica|helena|sabina|laura|marisol|lucia|sofia|paloma|camila|valentina|salome|esperanza|catalina|carmen|isabela|natalia|female|mujer|ximena|larissa|marta|rosa|ines|estrella|nuria|abril|lupe/i;
const MAS=/tomas|jorge|alvaro|diego|pablo|raul|juan|carlos|enrique|miguel|andres|gonzalo|alonso|male|hombre|arnau|saul|lorenzo|alberto|ramon|ricardo|sergio|manuel|mateo|dario/i;
/* Calidad estimada: las voces «Natural/Neural/Online» de Microsoft Edge, las de Google y las «Siri/Premium» de Apple suenan mucho más humanas */
const calidad=v=>{const n=(v.name||'').toLowerCase(),l=(v.lang||'').toLowerCase();let s=0;if(/natural|neural|multilingual/.test(n))s+=60;if(/online/.test(n))s+=25;if(/google/.test(n))s+=30;if(/siri|premium|enhanced|mejorada|ampliada/.test(n))s+=40;if(/es[-_]ar/.test(l))s+=14;else if(/es[-_](us|mx|419|co|cl|pe|uy)/.test(l))s+=11;else if(/es[-_]es/.test(l))s+=5;if(/compact|espeak|festival|novelty|whisper|zarvox|trinoids|bubbles|cellos|bells|albert|fred|bad news|good news/.test(n))s-=60;if(v.localService===false)s+=4;return s};
const esVoces=()=>voices.filter(v=>/^es/i.test(v.lang));
const ordenVoces=()=>{let c=esVoces();if(CFG.gen){const f=c.filter(v=>CFG.gen==='f'?FEM.test(v.name):MAS.test(v.name)&&!FEM.test(v.name));if(f.length)c=f}const sc=v=>calidad(v)+(!CFG.gen&&FEM.test(v.name)?.5:0);return c.slice().sort((a,b)=>sc(b)-sc(a))};
const voz=()=>{const es=esVoces(),fix=CFG.voice&&es.find(v=>v.name===CFG.voice);return fix||ordenVoces()[0]||null};
const vozNota=()=>{const v=voz();if(!TTS)return'Este navegador no puede hablar.';if(!v)return'No hay voces en español instaladas: se usará la voz por defecto del navegador.';return'Voz actual: '+v.name+' ('+v.lang+')'+(calidad(v)>=40?' · voz natural.':'. Para una voz más natural abrí NEWAR en Microsoft Edge (trae voces neuronales gratis), o en Chrome con conexión.')};
const cargaVoces=()=>{try{voices=speechSynthesis.getVoices()||[]}catch(e){voices=[]}const s=$('#nvvoice');if(!s)return;const es=esVoces().slice().sort((a,b)=>calidad(b)-calidad(a));s.innerHTML='<option value="">Mejor voz automática</option>'+es.map(v=>`<option value="${v.name.replace(/"/g,'&quot;')}"${v.name===CFG.voice?' selected':''}>${calidad(v)>=40?'★ ':''}${v.name} (${v.lang})</option>`).join('');const g=$('#nvgen');if(g)g.value=CFG.gen||'';const n=$('#nvvn');if(n)n.textContent=vozNota()};
if(TTS){cargaVoces();try{speechSynthesis.addEventListener('voiceschanged',cargaVoces)}catch(e){}}
const limpiaTTS=t=>String(t).replace(/https?:\/\/\S+/g,'').replace(/[«»"“”]/g,'').replace(/%/g,' por ciento').replace(/[·•▲▼★☆✔✖→◈🎤]/g,', ').replace(/\s*[-–—]\s*/g,', ').replace(/\s+/g,' ').trim();
const trozos=t=>{const ss=t.match(/[^.!?;:]+[.!?;:]?/g)||[t],out=[];let cur='';ss.forEach(s=>{s=s.trim();if(!s)return;if(cur&&(cur+' '+s).length>150){out.push(cur);cur=s}else cur=cur?cur+' '+s:s});if(cur)out.push(cur);return out.flatMap(x=>x.length>200?(x.match(/.{1,170}(\s|$)/g)||[x]):[x])};
function cancelaHabla(){cancelado=true;try{speechSynthesis.cancel()}catch(e){}hablando=false;fab.classList.remove('spk')}
function say(t){return new Promise(res=>{if(!TTS||!CFG.say||!t){res();return}if(!voices.length)cargaVoces();const parts=trozos(limpiaTTS(t));if(!parts.length){res();return}lastSpoken=String(t);
 try{speechSynthesis.cancel()}catch(e){}cancelado=false;hablando=true;fab.classList.add('spk');if(oyendo&&rec){try{rec.abort()}catch(e){}}
 let i=0;const fin=()=>{if(!hablando&&!cancelado){res();return}hablando=false;speakEnd=Date.now();fab.classList.remove('spk');awakeUntil=Date.now()+12000;res();if(quiere&&CFG.hf&&!blocked)setTimeout(start,350)};
 const next=()=>{if(i>=parts.length||cancelado){fin();return}const u=new SpeechSynthesisUtterance(parts[i++]),v=voz();u.lang=v?v.lang:'es-AR';if(v)u.voice=v;u.rate=+CFG.rate||1;u.pitch=+CFG.pitch||1;u.volume=1;u.onend=()=>setTimeout(next,i<parts.length?40:0);u.onerror=next;try{speechSynthesis.speak(u)}catch(e){fin()}};next()})}

/* ---------- «Newar»: detección tolerante de la palabra de activación ---------- */
const WK=['newar','neward','newart','nuar','nuard','neuar','neuard','niuar','niuard','nehuar','nuevar','nuevard','newer','nuer','neguar','neguard','nijuar','nyuar','ñuar','nihuar','nueva','nuevar','newarr','neuvar','neubar','nuvar','jarvis','yarvis','charvis','garvis','jarbis','yarbis','narvis'];
const FILL=new Set(['oye','hola','ok','okey','okay','hey','che','bueno','dale','a','ver','epa','disculpa','perdon','decime','dime','si','vamos','listo','buenas']);
const isWake=t=>{if(!t||t.length<3||t.length>8)return false;if(WK.includes(t))return true;if(/^(oye|nueva)$/.test(t))return false;return lv(t,'newar')<=1||lv(t,'neward')<=1||(t.length>=5&&(lv(t,'newar')<=2||lv(t,'neward')<=2)&&/^[nñ][a-z]?[eiu]/.test(t))||lv(t,'jarvis')<=1};
function quitaWake(t){const k=t.split(' ');for(let i=0;i<Math.min(4,k.length);i++){const a=k[i],b=k[i+1]||'';
  if(isWake(a))return{woke:true,rest:k.slice(i+1).join(' '),n:i+1};
  if(b&&isWake(a+b)&&a.length<=4&&b.length<=4)return{woke:true,rest:k.slice(i+2).join(' '),n:i+2};
  if(!FILL.has(a)&&i>=1)break}
 return{woke:false,rest:t,n:0}}

/* ---------- datos para responder ---------- */
const STOPW=new Set(['de','del','la','el','a','al','los','las','y','e','con','sobre','para','por','me','mi','un','una','que','en','le','lo','su','sus']);
const findP=q=>{const ws=norm(q).split(' ').filter(w=>w.length>1&&!STOPW.has(w));if(!ws.length)return null;let best=null,bs=0;
 personas.forEach(p=>{if(p.homonimoDe)return;const nm=norm([p.nombre,...(p.aliases||[])].join(' ')).split(' ');let s=0;for(const w of ws){const m=Math.max(0,...nm.map(x=>x===w?4:x.startsWith(w)?3:(typeof wsc==='function'?wsc(w,x):0)));if(!m){s=-1;break}s+=m}
  if(s>0){s+=(p.v===1?1:0)+Math.min(2,total(p.id)/50);if(s>bs){bs=s;best=p}}});return best};
const D=864e5,H36=36e5;
const notas=h=>{const now=Date.now();return(S.news||[]).filter(x=>{const d=pd(x.published_iso||x.collected_at);return d&&now-d<h*H36&&d<=now+H36})};
const ultimaNota=()=>(S.news||[]).reduce((m,x)=>{const d=pd(x.published_iso||x.collected_at);return d&&(!m||d>m)?d:m},null);
const aviso24=()=>{const u=ultimaNota();return u&&Date.now()-u>3*H36?' Ojo: la última nota guardada es de '+rel(u)+', así que el monitor puede estar atrasado.':''};
async function listo(){try{await need('news')}catch(e){}}
const ventana=t=>/esta semana|ultimos? 7 dias|ultima semana|semana/.test(t)?[7*24,'la última semana']:/este mes|ultimos? 30 dias|ultimo mes|mes/.test(t)?[30*24,'el último mes']:(m=>m?[+m[1],'las últimas '+m[1]+' horas']:[24,'las últimas 24 horas'])(t.match(/ultimas? (\d+) horas/));
async function masMencionados(h){await listo();const now=Date.now(),c={};MX().forEach(m=>{if(!m._d||!okPrec(m))return;const p=byId[m._pid];if(!p||!actP(p))return;if(now-m._d<h*H36&&m._d<=now+H36)c[m._pid]=(c[m._pid]||0)+1});return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,n])=>({p:byId[id],n}))}
async function resumenPersona(p){await listo();ctx.p=p;const F=esFilas(p),now=Date.now(),c=(a,b)=>F.filter(f=>f.d&&+f.d>=now-a*D&&+f.d<now-b*D).length,n7=c(7,0),p7=c(14,7),n30=c(30,0),tm={};
 F.filter(f=>f.d&&+f.d>=now-30*D).forEach(f=>{if(f.tema!=='Sin tema claro')tm[f.tema]=(tm[f.tema]||0)+1});const tp=Object.entries(tm).sort((a,b)=>b[1]-a[1])[0],u=F[0],neg=F.filter(f=>f.tono==='negativo'&&f.d&&+f.d>=now-30*D).length,pos=F.filter(f=>f.tono==='positivo'&&f.d&&+f.d>=now-30*D).length;
 const m=p.nombre+', '+esCargo(p)+'. '+(F.length?n7+' nota'+(n7===1?'':'s')+' en la última semana'+(p7||n7?' ('+(n7>p7?'más que':n7<p7?'menos que':'igual que')+' la semana anterior, que tuvo '+p7+')':'')+' y '+n30+' en el último mes.'+(tp?' El tema que más aparece es '+tp[0]+'.':'')+(pos+neg>=3?' Tono: '+pos+' positivas y '+neg+' negativas.':'')+(u?' La última nota es de '+medioNombre(u.med)+', '+rel(u.d)+': '+u.tt+'.':''):'No hay notas guardadas de esta persona.');return{m,s:m}}
const cabeceras=async n=>{await listo();return(S.news||[]).slice().sort((a,b)=>(pd(b.published_iso||b.collected_at)||0)-(pd(a.published_iso||a.collected_at)||0)).slice(0,n)};
const tabNom=k=>(TABS.find(t=>t[0]===k)||[0,k])[1];

/* ---------- pestañas, clics y selección ---------- */
const ALIAS={inicio:['inicio','principal','pagina principal','home'],pulso:['pulso','tablero en vivo','centro de mando','pulso en vivo'],diario:['diario','resumen diario'],resumen:['resumen nacional','resumen provincial'],estadisticas:['estadisticas','estadistica','numeros','graficos'],voz:['voz y peso','peso de bloques'],mapas:['mapas','organigramas','mapas conceptuales'],mapa:['mapa','mapa de salta','mapa por departamento'],mayorias:['mayorias','laboratorio de mayorias'],hemiciclo:['hemiciclo','congreso'],red:['red','red de relaciones','grafo'],casos:['casos','monitores'],calidad:['calidad','calidad de datos'],fuentes:['fuentes','marco legal'],oficiales:['oficiales','publicaciones oficiales','boletin oficial'],control:['control','control de datos'],destacados:['destacados','favoritos'],menciones:['menciones','prensa'],medios:['medios','medios nacionales'],personas:['personas','politicos','funcionarios'],legislativo:['legislativo','legisladores','legislatura'],ejecutivo:['ejecutivo','gabinete','poder ejecutivo'],sesiones:['sesiones','sesion'],temas:['temas'],palabras:['palabras'],cruce:['cruce'],verificar:['verificar','verificador'],eventos:['eventos'],notas:['notas'],buscar:['buscar','busqueda','busqueda avanzada'],estrategia:['estrategia'],alertas:['alertas','avisos'],clientes:['clientes','informe de cliente'],judicial:['judicial','justicia','poder judicial'],argentina:['argentina','pais'],poderes:['poderes','cupula'],modern:['moderno']};
const tabDe=p=>{p=norm(p);if(!p)return null;let best=null,bs=0;TABS.forEach(([k,l])=>{[...new Set([norm(l),k,...(ALIAS[k]||[])])].forEach(a=>{let s=0;if(p===a)s=100+a.length;else if(a.length>=4&&new RegExp('(^| )'+a+'( |$)').test(p))s=10+a.length;if(s>bs){bs=s;best=k}})});
 if(best)return best;let bd=9;TABS.forEach(([k,l])=>{[...new Set([norm(l),k,...(ALIAS[k]||[])])].forEach(a=>{const lim=a.length>=8?2:a.length>=5?1:0,d=lv(p,a);if(d<=lim&&d<bd){bd=d;best=k}})});return best};
const visible=el=>!el.closest('[hidden],#nvp,#nvfab,#nvlive')&&getComputedStyle(el).display!=='none';
const clickByText=q=>{q=norm(q);if(!q)return null;const c=$$('#app button,#app a[href],#app [role=button],#app summary,#app label,#tabs a,.lv,#nbfab').filter(visible).map(el=>({el,t:norm(el.textContent+' '+(el.getAttribute('aria-label')||'')+' '+(el.title||''))})).filter(x=>x.t);
 const ex=c.filter(x=>x.t===q),st=c.filter(x=>x.t.startsWith(q)),inc=c.filter(x=>x.t.includes(q)),pool=ex.length?ex:st.length?st:inc;if(!pool.length)return null;pool.sort((a,b)=>a.t.length-b.t.length);const el=pool[0].el;try{el.scrollIntoView({block:'center'})}catch(e){}el.click();return(el.textContent||el.getAttribute('aria-label')||q).replace(/\s+/g,' ').trim().slice(0,40)};
const go=h=>{if(location.hash===h)route();else location.hash=h};
const hudOn=()=>document.body.classList.contains('hud');
const timers=[];

/* ---------- lectura de pantalla y resumen ---------- */
const briefing=async()=>{await listo();const n=notas(24),md=new Set(n.map(x=>medioKey(x.source))),now=Date.now(),mm=MEN.filter(m=>m._d&&now-m._d<D&&okPrec(m)).length,tc={};n.forEach(x=>{const t=esTema(x.title);if(t!=='Sin tema claro')tc[t]=(tc[t]||0)+1});
 const tt=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,c])=>t+', '+c+' notas'),last=n.slice().sort((a,b)=>(pd(b.published_iso||b.collected_at)||0)-(pd(a.published_iso||a.collected_at)||0))[0];
 return'Resumen al '+new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long'})+'. En las últimas 24 horas hay '+n.length+' notas de '+md.size+' medios y '+mm+' menciones de personas de la nómina. '+(tt.length?'Los temas que más se tratan son: '+tt.join('; ')+'. ':'')+(last?'La última nota es de '+medioNombre(last.source)+': '+tituloSinMedio(last)+'.':'')+aviso24()};
const pantalla=()=>{const h=$('#app h2'),k=$$('#app .news .box,#app .grid .card,#app .pl-k .box,#app .kt').slice(0,8).map(x=>x.textContent.replace(/\s+/g,' ').trim());return(h?h.textContent.trim()+'. ':'')+(k.length?k.join('. '):'No encuentro cifras para leer en esta pantalla.')};

/* ---------- órdenes y preguntas: [expresión, función]. Cada una devuelve un texto (confirmación), {m,s} (respuesta) o false ---------- */
const MODOS={analisis:/analiz|contradic/,debate:/debat/,rebatir:/rebat/,exponer:/expon|inconsisten/,defender:/defend|defensa/,ensalzar:/relato|ensalz/,mejorar:/mejorar|discurso y mensaje/,nacional:/nacional/,agenda:/agenda|hueco/,entrevista:/entrevist/,crisis:/crisis/,comparar:/compar/,discurso:/discurso/,mensajes:/mensaje/,periodista:/periodista|simulacro/,alianzas:/alianza|aliado/,semana:/semana|plan de comunicacion/,resumen:/resumen ejecutivo/,columna:/columna|posteo/};
const persDe=q=>{q=norm(q);if((!q||/^(el|ella|lo|la|el mismo|ella misma|esa persona|ese politico|esa politica|el politico)$|^(el|ella) /.test(q))&&ctx.p)return ctx.p;return findP(q)};
const ordenes=[
 [/^(ayuda|que puedo decir|que comandos hay|comandos|como funciona)$/,()=>{ayuda(true);return{m:'Te muestro lo que podés decirme.',s:'Podés pedirme que abra pantallas, que busque, que siga personas o que anote. También podés preguntarme cosas como: cuántas notas hay hoy, quién es el más mencionado, qué dicen de una persona, o cuántos diputados tiene un bloque.'}}],
 [/^(que (podes|sabes) hacer|para que servis|que haces)$/,()=>({m:'Abro pantallas, busco, filtro, sigo personas, anoto, leo y respondo preguntas con los datos de NEWAR.',s:'Puedo abrir cualquier pantalla, buscar, filtrar, seguir personas, tomar notas y leerte el resumen del día. También respondo preguntas con los datos de NEWAR, por ejemplo cuántas notas hay hoy, quién es el más mencionado o qué dicen de una persona. Decí ayuda para ver la lista completa.'})],
 [/^(quien sos|como te llamas|quien eres|presentate|que sos)$/,()=>({m:'Soy NEWAR, el asistente del radar político de Salta.',s:'Soy NEWAR, el asistente del radar político de Salta. Leo lo que publican los medios y las fuentes oficiales, y te lo explico. A sus órdenes.'})],
 [/^(hola|buenas|que tal|como estas|como andas|buen(os|as) (dias|tardes|noches))( .*)?$/,(m,a,b,c)=>/dias/.test(m)?briefing().then(t=>({m:t,s:saludoHora()+'. '+t})):{m:saludoHora()+'. A sus órdenes.',s:pick([saludoHora()+'. A sus órdenes.',saludoHora()+'. Decime qué necesitás.','Hola. Te escucho.'])}],
 [/^(gracias|muchas gracias|genial|perfecto|buenisimo|excelente|joya|barbaro)( .*)?$/,()=>({m:'De nada.',s:pick(['De nada.','Un placer.','Para eso estoy.'])})],
 [/^(chau|adios|hasta luego|nos vemos)$/,()=>{stop();return{m:'Hasta luego.',s:'Hasta luego.'}}],
 [/^(dejar de escuchar|apagar (el )?microfono|parar de escuchar|cerrar microfono|desactivar manos libres)$/,()=>{CFG.hf=0;save();ui();stop();return'Micrófono apagado.'}],
 [/^(callate|callar|parar de leer|deja de leer|silencio|basta|para|pare|alto)$/,()=>{cancelaHabla();colaLect=[];return'Listo.'}],
 [/^(repeti|repite|que dijiste|otra vez|repetime)( eso)?$/,()=>ultima?{m:ultima,s:ultima}:'Todavía no dije nada.'],
 [/^(habla|hablame|hablas)( mas)? (rapido|veloz)$/,()=>{CFG.rate=Math.min(1.5,+(+CFG.rate+.15).toFixed(2));save();ui();return'Hablo más rápido.'}],
 [/^(habla|hablame|hablas)( mas)? (lento|despacio)$/,()=>{CFG.rate=Math.max(.7,+(+CFG.rate-.15).toFixed(2));save();ui();return'Hablo más despacio.'}],
 [/^(cambia|cambiar|otra) (la )?voz$/,()=>{const es=ordenVoces();if(es.length<2)return{m:'Solo hay una voz en español en este dispositivo.',s:'Solo hay una voz en español en este dispositivo.'};const i=es.findIndex(v=>v===voz());CFG.voice=es[(i+1)%es.length].name;save();cargaVoces();return{m:'Cambié la voz a '+CFG.voice+'.',s:'Listo, esta es mi nueva voz.'}}],
 [/(voz|habla) (de |como )?(hombre|masculina|varon|chico)|voz de hombre/,()=>{CFG.gen='m';CFG.voice='';save();cargaVoces();ui();return{m:vozNota(),s:'Listo, ahora hablo con voz masculina.'}}],
 [/(voz|habla) (de |como )?(mujer|femenina|chica)|voz de mujer/,()=>{CFG.gen='f';CFG.voice='';save();cargaVoces();ui();return{m:vozNota(),s:'Listo, ahora hablo con voz femenina.'}}],
 [/(mejor|la mejor|mas natural|natural|humana) voz|voz (natural|humana|de chat ?gpt|como chat ?gpt)|voz automatica/,()=>{CFG.voice='';CFG.gen='';save();cargaVoces();ui();const v=voz();return{m:vozNota(),s:v&&calidad(v)>=40?'Listo. Estoy usando la voz más natural que tiene este dispositivo.':'Listo. Esta es la mejor voz que encontré en este dispositivo. Con Microsoft Edge suena mucho más natural.'}}],
 [/(desactiva|desactivar|apaga|apagar|quita|quitar|no uses) (la )?voz|no me respondas|respondeme (por )?escrito/,()=>{cancelaHabla();CFG.say=0;save();ui();return'Respondo solo por escrito.'}],
 [/(activa|activar|prende|prender|usa|usar) (la )?voz|respondeme (en|con) voz|hablame/,()=>{CFG.say=1;save();ui();return{m:'Respondo en voz alta.',s:'Listo. Ahora te respondo en voz alta.'}}],
 [/^modo (jarvis|asistente|manos libres)$/,()=>{CFG.hf=1;CFG.say=1;save();ui();setTimeout(()=>{if(!oyendo)start()},600);return{m:'Modo asistente: escucho siempre. Empezá con «Newar».',s:'Modo asistente activado. Decí Newar y tu orden.'}}],
 [/^(volver|volver atras|atras|pagina anterior)$/,()=>{history.back();return'Volviendo.'}],
 [/^(actualizar|recargar|refrescar|actualizar datos|buscar datos nuevos)$/,()=>{const b=$('#lvb');if(b)b.click();return'Actualizando los datos.'}],
 [/(modo|tema) (oscuro|claro)|cambiar (el )?(modo|tema)/,(m,a,t)=>{const dark=document.documentElement.getAttribute('data-theme')!=='light',want=/oscuro/.test(t||'')?true:/claro/.test(t||'')?false:!dark;if(want!==dark)$('#thb').click();return want?'Tema oscuro.':'Tema claro.'}],
 [/(salir|apagar|desactivar|quitar|cerrar) (de )?(la )?(sala de control|pantalla completa|modo hud|modo futurista)/,()=>{if(hudOn())$('#hudb').click();return'Saliendo de la Sala de control.'}],
 [/(sala de control|pantalla completa|modo hud|modo futurista)/,()=>{if(!hudOn()&&$('#hudb'))$('#hudb').click();return'Sala de control activada.'}],
 [/(detener|parar|pausar|apagar|sacar) (la )?(rotacion|presentacion)/,()=>{const b=$('#hudrot');if(b&&b.classList.contains('on'))b.click();return'Rotación detenida.'}],
 [/(rotar|rotacion|modo presentacion|presentacion automatica|pasar pantallas)/,()=>{if(!hudOn()){$('#hudb').click();setTimeout(()=>{const b=$('#hudrot');if(b&&!b.classList.contains('on'))b.click()},500)}else{const b=$('#hudrot');if(b&&!b.classList.contains('on'))b.click()}return'Rotación automática activada.'}],
 [/(texto|letra) (mas )?(grande|grandes)|agrandar (el )?texto|aumentar (el )?texto/,()=>{$('#szp').click();return'Texto más grande.'}],
 [/(texto|letra) (mas )?(chico|chica|chicos|pequeno|pequena)|achicar (el )?texto|disminuir (el )?texto/,()=>{$('#szm').click();return'Texto más chico.'}],
 [/^(bajar|abajo|mas abajo|scroll abajo|bajar la pantalla)$/,()=>{scrollBy({top:innerHeight*.8,behavior:'smooth'});return'Bajando.'}],
 [/^(subir|arriba|mas arriba|ir arriba|al principio|scroll arriba)$/,()=>{scrollTo({top:0,behavior:'smooth'});return'Subiendo.'}],
 [/^(imprimir|guardar como pdf|exportar a pdf)$/,()=>{setTimeout(()=>print(),200);return'Abriendo la impresión.'}],
 /* --- hora, fecha, cálculo, temporizador --- */
 [/(que hora|hora actual|la hora|^hora$)/,()=>{const d=new Date(),hh=d.getHours(),mm=d.getMinutes(),t=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');return{m:'Son las '+t+'.',s:'Son las '+hh+(mm?' y '+mm:' en punto')+'.'}}],
 [/(que dia es|fecha de hoy|a cuanto estamos|que fecha es)/,()=>{const f=hoyF();return{m:'Hoy es '+f+'.',s:'Hoy es '+f+'.'}}],
 [/^(calcula|calcular|cuanto es|cuanto da|resolve|cuanto sale)\s+(.+)$/,(m,a,e)=>{let x=e;const pc=x.match(/^(\d+(?:[.,]\d+)?) por ciento de (\d+(?:[.,]\d+)?)$/);let r;if(pc)r=+pc[1].replace(',','.')/100*+pc[2].replace(',','.');else{x=x.replace(/\bcien(to)?\b/g,'100').replace(/\bmil\b/g,'1000').replace(/\bcero\b/g,'0').replace(/\b(un|uno)\b/g,'1').replace(/multiplicado por|por/g,'*').replace(/dividido (por|entre)|sobre|entre/g,'/').replace(/\bmas\b/g,'+').replace(/\bmenos\b/g,'-').replace(/,/g,'.');if(!/^[\d\s+\-*/().]+$/.test(x))return false;try{r=Function('"use strict";return('+x+')')()}catch(er){return false}}
  if(typeof r!=='number'||!isFinite(r))return false;const t=f1(Math.round(r*1e4)/1e4);return{m:'Da '+t+'.',s:'Da '+t+'.'}}],
 [/(pone|programa|arma|activa|crea)\w* (un )?(temporizador|alarma|recordatorio|cuenta regresiva)( de| para)? (\d+) (segundo|minuto|hora)s?|avisame en (\d+) (segundo|minuto|hora)s?/,(m,a,b,c,d,e,f,g,h,i)=>{const n=+(e||h),u=(f||i),ms=n*(u==='hora'?36e5:u==='minuto'?6e4:1e3);if(!n||ms>864e5)return false;const et=n+' '+u+(n===1?'':'s');timers.push(setTimeout(()=>{aviso('⏰ Pasaron '+et+'.');say('Pasaron '+et+'.');show('','⏰ Pasaron '+et+'.',true)},ms));return{m:'Listo, te aviso en '+et+'.',s:'Listo, te aviso en '+et+'.'}}],
 /* --- preguntas sobre los datos --- */
 [/cuantas (notas|noticias|publicaciones)( hay| se publicaron| salieron| tenemos| guardadas)?( .*)?$/,async(m,a,b,c)=>{await listo();const [h,lab]=ventana(norm(m)),n=notas(h),nac=n.filter(x=>x.category==='Nacional').length,md=new Set(n.map(x=>medioKey(x.source))).size;const t='En '+lab+' hay '+n.length+' notas de '+md+' medios: '+nac+' de medios nacionales y '+(n.length-nac)+' de Salta.'+aviso24();return{m:t,s:t}}],
 [/(quien|quienes|que persona|que personas|que politico|que politicos)( es| son| fue| fueron)?( el| los| la| las)? (mas|mas) (mencionad\w+|nombrad\w+|citad\w+)|mas mencionad\w+|(quien|quienes) (aparece|aparecen) mas/,async m=>{const [h,lab]=ventana(norm(m));let r=await masMencionados(h),usado=lab;if(!r.length&&h<24*7){r=await masMencionados(24*7);usado='la última semana'}if(!r.length)return{m:'No hay menciones de personas de la nómina en '+lab+'.',s:'No encuentro menciones de personas de la nómina en '+lab+'.'};ctx.p=r[0].p;
  const t='Los más mencionados en '+usado+': '+r.slice(0,3).map(x=>x.p.nombre+' con '+x.n).join(', ')+'.'+(r[3]?' Le siguen '+r.slice(3).map(x=>x.p.nombre).join(' y ')+'.':'')+aviso24();return{m:t,s:t}}],
 [/(que|cuales) temas|de que (se )?(habla|hablan)|tema(s)? (del dia|de hoy|principales)|que (esta )?pasando|como esta la agenda|que hay de nuevo en (la )?prensa/,async m=>{await listo();const [h,lab]=ventana(norm(m)),n=notas(h),tc={};n.forEach(x=>{const t=esTema(x.title);if(t!=='Sin tema claro')tc[t]=(tc[t]||0)+1});const l=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,4);if(!l.length)return{m:'No hay temas claros en '+lab+'.',s:'No encuentro temas claros en '+lab+'.'};const t='En '+lab+' se habla sobre todo de '+l.map(([k,c])=>k.replace(' › ',', ')+' con '+c+' notas').join('; ')+'.'+aviso24();return{m:t,s:t}}],
 [/(que|cuales) medios (publican|estan publicando|son los mas activos|mas activos|publican mas)|medios mas activos/,async()=>{await listo();const n=notas(24),c={};n.forEach(x=>{const k=medioNombre(x.source);c[k]=(c[k]||0)+1});const l=Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4);if(!l.length)return{m:'No hay notas en las últimas 24 horas.',s:'No hay notas guardadas en las últimas 24 horas.'};const t='Los medios más activos hoy: '+l.map(([k,v])=>k+' con '+v).join(', ')+'.';return{m:t,s:t}}],
 [/^(que|como) (dicen|dice|se dice|esta|le va|anda|viene|va)( de| el| la| con| a)? ?(.*)$|^(novedades|noticias|informacion|resumen|como esta) (de|del|sobre) (.+)$/,async(m,a,b,c,q,d,e,f,q2)=>{const x=(q||q2||'').trim();if(!x)return false;await listo();const p=persDe(x);if(p)return resumenPersona(p);
  const re=reTerm(x);if(!re||x.split(' ').length>4)return false;const n=(S.news||[]).filter(n=>{const d=pd(n.published_iso||n.collected_at);return d&&Date.now()-d<7*D&&re.test(fold(tituloSinMedio(n)))}).sort((a,b)=>(pd(b.published_iso||b.collected_at)||0)-(pd(a.published_iso||a.collected_at)||0));
  if(!n.length)return false;const t='Sobre '+x+' hay '+n.length+' nota'+(n.length===1?'':'s')+' en la última semana. La más reciente es de '+medioNombre(n[0].source)+': '+tituloSinMedio(n[0])+'.';return{m:t,s:t}}],
 [/^(quien es|quien fue|que cargo tiene|que hace|datos de|informacion de)( el| la)? (.+)$/,(m,a,b,q)=>{const p=findP(q);if(!p)return false;ctx.p=p;const c=p.cargos.find(x=>x.v===1)||p.cargos[0],t=p.nombre+': '+esCargo(p)+(c&&c.bloque?', bloque '+c.bloque:'')+'. '+(c?c.txt:'')+'.';return{m:t,s:t}}],
 [/cuantos (diputados|senadores|concejales|legisladores|miembros|integrantes)( provinciales| nacionales)? (tiene|tienen|hay|son|posee|suma)( .*)?$/,(m)=>{const t=norm(m),cam=verCam(t)||'Diputados',g=verGrupos(cam),N=g.reduce((a,x)=>a+x.w,0);if(!N)return{m:'No hay datos de ese cuerpo.',s:'No tengo datos de ese cuerpo.'};const bl=verBloque(t,g),gb=bl&&g.find(x=>x.b===bl),need=Math.floor(N/2)+1;
  const r=bl?bl+' tiene '+gb.w+' de '+N+' en '+verCamN(cam)+' ('+f1(gb.w/N*100)+' por ciento). '+(gb.w>=need?'Alcanza la mayoría absoluta, que son '+need+'.':'Para la mayoría absoluta hacen falta '+need+'.'):verCamN(cam)+' tiene '+N+' integrantes. Los bloques más grandes: '+g.filter(x=>x.b!=='Sin dato de bloque').slice(0,3).map(x=>x.b+' con '+x.w).join(', ')+'.';return{m:r,s:r}}],
 [/(quien|que bloque) (tiene|tienen|posee) (la )?mayoria( en (diputados|el senado|senado|el concejo|concejo))?/,m=>{const t=norm(m),cam=verCam(t)||'Diputados',g=verGrupos(cam).filter(x=>x.b!=='Sin dato de bloque'),N=verGrupos(cam).reduce((a,x)=>a+x.w,0),need=Math.floor(N/2)+1;if(!g.length)return{m:'Sin datos de bloques.',s:'No tengo datos de bloques.'};const r=g[0].w>=need?g[0].b+' tiene mayoría propia en '+verCamN(cam)+': '+g[0].w+' de '+N+'.':'Nadie tiene mayoría propia en '+verCamN(cam)+'. El bloque más grande es '+g[0].b+' con '+g[0].w+' de '+N+'; la mayoría absoluta es '+need+'.';return{m:r,s:r}}],
 [/(estan|esta) (los datos )?(actualizad\w+|al dia)|estado (de los datos|del sistema|del monitor)|cuando se actualizo|funciona el monitor/,async()=>{await listo();const u=ultimaNota(),g=typeof GEN!=='undefined'?GEN:null;const t=(g?'Los datos se generaron '+rel(g)+'. ':'')+(u?'La última nota guardada es de '+rel(u)+'.':'No hay notas guardadas.')+(u&&Date.now()-u>3*H36?' Eso es más de tres horas: el monitor puede estar atrasado, revisá la pestaña Control.':' Todo parece al día.');return{m:t,s:t}}],
 [/(que hay de nuevo|novedades|como estan|que hay) (de |con )?(mis )?(seguidos|los que sigo)|mis seguidos|a quienes sigo/,async()=>{await listo();const l=esSig().filter(x=>byId[x.id]);if(!l.length)return{m:'Todavía no seguís a nadie.',s:'Todavía no seguís a nadie. Decí seguir a, y el nombre de una persona.'};const r=l.map(x=>{const p=byId[x.id],F=esFilas(p);return{p,nw:F.filter(f=>f.d&&+f.d>x.vis).length,n7:F.filter(f=>f.d&&+f.d>=Date.now()-7*D).length}}).sort((a,b)=>b.nw-a.nw);const con=r.filter(x=>x.nw>0);
  const t=con.length?'Tenés novedades de '+con.length+' de '+l.length+' personas que seguís: '+con.slice(0,4).map(x=>x.p.nombre+', '+x.nw+' nota'+(x.nw===1?'':'s')+' nueva'+(x.nw===1?'':'s')).join('; ')+'.':'No hay notas nuevas '+(l.length===1?'de la persona que seguís':'de las '+l.length+' personas que seguís')+' desde tu última visita.';return{m:t,s:t}}],
 [/^(lee|leer|leeme|decime) (las |los )?(noticias|titulares|ultimas noticias)$/,async()=>{const l=await cabeceras(12);if(!l.length)return{m:'No hay titulares guardados.',s:'No hay titulares guardados.'};colaLect=l.slice(3).map(n=>medioNombre(n.source)+': '+tituloSinMedio(n));const t='Últimos titulares. '+l.slice(0,3).map((n,i)=>(i+1)+'. '+medioNombre(n.source)+': '+tituloSinMedio(n)).join('. ')+'. Decí siguiente para escuchar más.';return{m:t,s:t}}],
 [/^(siguiente|segui|seguime|mas|continua|otra|las siguientes|otras noticias)$/,()=>{if(!colaLect.length)return false;const l=colaLect.splice(0,3),t=l.map((x,i)=>x).join('. ')+(colaLect.length?'. ¿Sigo?':'. Eso es todo.');return{m:t,s:t}}],
 [/(resumen del dia|que paso hoy|dame el resumen|resumen de hoy|el resumen|resumen diario)$/,async()=>{const t=await briefing();return{m:t,s:t}}],
 [/(leer|lee|leeme|lee) (la )?(pantalla|esto|cifras)/,()=>{const t=pantalla();return{m:t,s:t}}],
 [/^(abrir|mostrar|ver) (el )?anotador$|^anotador$/,()=>{const b=$('#nbfab');if(b)b.click();return'Anotador.'}],
 [/^(anotar|apuntar|agregar nota|nota|tomar nota|anota|apunta)\s+(.+)$/,(m,a,txt)=>{const raw=RAW.replace(/^\s*(anotar|anota|apuntar|apunta|agregar nota|nota|tomar nota)[\s,:]*/i,'').trim()||txt;if(window.NX&&NX.nota){NX.nota('Nota por voz · '+new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long'}),raw);return'Nota guardada en el anotador.'}return false}],
 /* --- personas, seguimiento y herramientas de Estrategia --- */
 [/^(seguir|segui|seguime|seguilo|seguila) ?(a )?(.*)$/,(m,a,b,q)=>{const p=persDe(q||'el');if(!p)return'No encontré a esa persona en la nómina.';ctx.p=p;segSet(p.id,true);return'Ahora seguís a '+p.nombre+'.'}],
 [/^(dejar de seguir|no seguir mas|deja de seguir|dejalo de seguir) ?(a )?(.*)$/,(m,a,b,q)=>{const p=persDe(q||'el');if(!p)return'No encontré a esa persona.';ctx.p=p;segSet(p.id,false);return'Dejaste de seguir a '+p.nombre+'.'}],
 [/^comparar (.+?) (con|contra|y) (.+)$/,(m,a,c,b)=>{const A=persDe(a),B=findP(b);if(!A||!B)return'No encontré a las dos personas.';ctx.p=A;EST.id=A.id;EST.vs=B.id;go('#/estrategia/'+encodeURIComponent(A.id));return'Comparando '+A.nombre+' con '+B.nombre+'.'}],
 [/camino (mas corto )?(entre|de) (.+?) (y|e|hasta|a) (.+)$/,(m,a,b,c,d,e)=>{const A=findP(c),B=findP(e);if(!A||!B)return'No encontré a las dos personas.';RED.pa=A.id;RED.pb=B.id;go('#/red');return'Camino más corto entre '+A.nombre+' y '+B.nombre+'.'}],
 [/^(su |la )?(red|relaciones|vinculos|conexiones)( de| del| de la)? ?(.*)$/,(m,a,b,c,q)=>{const p=persDe(q||'el');if(!p)return false;ctx.p=p;verEnRed(p.id);return'Red de '+p.nombre+'.'}],
 [/^(armar|arma|preparame|prepara|hace|haceme|genera|dame)? ?(el |un |una )?(informe|reporte)( para cliente| en pdf| de seguimiento)?( de| del| sobre| de la)? ?(.*)$/,(m,a,b,c,d,e,q)=>{const p=persDe(q||'el');if(!p)return false;ctx.p=p;EST.id=p.id;go('#/estrategia/'+encodeURIComponent(p.id));setTimeout(()=>{try{esInforme()}catch(e){}},1500);return{m:'Armando el informe de '+p.nombre+'. Imprimilo o guardalo como PDF.',s:'Armando el informe de '+p.nombre+'.'}}],
 [/(armar|arma|preparame|prepara|dame|generame) (la |una )?consulta( de estrategia)?( para| de| sobre)?( .*)?$/,(m,a,b,c,d,rest)=>{const t=norm(m);let modo='analisis';for(const[k,re]of Object.entries(MODOS)){if(re.test(t)){modo=k;break}}const p=persDe((rest||'').replace(/\b(modo|para|debate|debatir|rebatir|defender|entrevista|crisis|discurso)\b/g,' ').trim()||'el')||ctx.p;if(!p)return'Decime de quién querés la consulta.';ctx.p=p;EST.id=p.id;EST.modo=modo;go('#/estrategia/'+encodeURIComponent(p.id));setTimeout(()=>{try{esArmar();esCopiar()}catch(e){}},1600);return{m:'Consulta de «'+(ES_MODOS[modo]?ES_MODOS[modo][0]:modo)+'» sobre '+p.nombre+' lista y copiada. Pegala en Claude, ChatGPT o Gemini.',s:'Armé y copié la consulta sobre '+p.nombre+'. Pegala en tu inteligencia artificial.'}}],
 [/(estrategia|dossier|tablero|analisis) (de|del|de la|sobre) (.+)$|^(su |la )(estrategia|dossier)$/,(m,a,b,q)=>{const p=q?findP(q):ctx.p;if(!p)return'No encontré a esa persona.';ctx.p=p;go('#/estrategia/'+encodeURIComponent(p.id));return'Estrategia de '+p.nombre+'.'}],
 [/^(su |la )?(ficha|perfil)( de| del| de la)? ?(.*)$|^(abrir a|abri a|mostrame a|abrir ficha) (.+)$/,(m,a,b,c,q,d,q2)=>{const x=(q||q2||'').trim(),p=x?findP(x):ctx.p;if(!p)return false;ctx.p=p;go('#/persona/'+encodeURIComponent(p.id));return'Ficha de '+p.nombre+'.'}],
 [/^(buscar|busca|encontrar|encontra) en (las )?notas (.+)$/,(m,a,b,q)=>{Object.assign(NT,{k:'',m:'',c:'',q,d1:'',d2:'',o:'rec',n:50});go('#/notas');return'Buscando «'+q+'» en las notas.'}],
 [/^(buscar|busca|encontrar|encontra) (la )?palabra (.+)$/,(m,a,b,q)=>{go('#/palabra/'+encodeURIComponent(q));return'Palabra «'+q+'».'}],
 [/^(buscar|busca|busqueda de|encontrar|encontra) (.+)$/,(m,a,q)=>{go('#/buscar/'+encodeURIComponent(q));return'Buscando «'+q+'».'}],
 [/^(hemiciclo|ver el hemiciclo|mostrame el hemiciclo)( de)?( diputados| senado| concejo)( nacionales| provinciales)?$/,(m,a,b,c)=>{const t=norm(m),cam=verCam(t)||'Diputados';HEM.cam=cam;HEM.hl='';go('#/hemiciclo');return'Hemiciclo de '+verCamN(cam)+'.'}],
 /* --- filtros de la pantalla actual --- */
 [/solo (los )?(medios )?(nacionales|nacional)/,()=>{const b=$('[data-amb="nac"],[data-pl="amb:nac"]');if(b){b.click();return'Solo medios nacionales.'}return clickByText('nacionales')?'Solo nacionales.':false}],
 [/solo (los )?(medios )?(de )?(salta|provinciales|provincial)/,()=>{const b=$('[data-amb="prov"],[data-pl="amb:prov"]');if(b){b.click();return'Solo medios de Salta.'}return clickByText('salta')?'Solo Salta.':false}],
 [/^(todos los medios|todos|sin filtro|quitar filtros|limpiar filtros|limpiar)$/,()=>{const b=$('[data-amb=""],[data-pl="amb:"]')||$$('#app button').find(x=>/^(limpiar|quitar filtros|limpiar filtros)/.test(norm(x.textContent)));if(b){b.click();return'Filtros quitados.'}return false}],
 [/(ultimas|ultimos|de|en) (\d+) (horas|hs|h)\b/,(m,a,n)=>{n=+n;const b=$(`[data-pl="w:${n}"]`)||(n===24?$('[data-per="1"]'):null);if(b){b.click();return'Ventana de '+n+' horas.'}return false}],
 [/(ultimos|ultimas|de|en) (\d+) dias/,(m,a,n)=>{n=+n;const bs=$$('[data-per]').filter(visible);if(!bs.length)return false;bs.sort((x,y)=>Math.abs(+x.dataset.per-n)-Math.abs(+y.dataset.per-n));bs[0].click();return'Período de '+bs[0].dataset.per+' días.'}],
 [/(mostrar|ver|cargar) mas/,()=>{const b=$$('#app .more,#app button').filter(visible).find(x=>/mostrar mas|ver mas|cargar mas|mas$/.test(norm(x.textContent)));if(b){b.click();return'Mostrando más.'}return false}],
 [/(descargar|exportar|bajar) (el |la |los )?(csv|excel|tabla|planilla)/,()=>{const b=$$('#app button').filter(visible).find(x=>/csv|descargar|exportar/.test(norm(x.textContent)));if(b){b.click();return'Descargando.'}return false}],
 [/^(escribir|escribe|teclear|poner en el buscador) (.+)$/,(m,a,q)=>{const i=$$('#app input[type=search],#app input[type=text]').filter(visible)[0];if(!i)return'No hay un cuadro de búsqueda en esta pantalla.';i.focus();i.value=q;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return'Escribí «'+q+'».'}],
 [/^(aceptar|enter|confirmar|buscar ahora|dale)$/,()=>{const i=document.activeElement&&/INPUT/.test(document.activeElement.tagName)?document.activeElement:$$('#app input[type=search],#app input[type=text]').filter(visible)[0];if(!i)return false;i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return'Listo.'}],
 [/^(elegir|elegi|seleccionar|selecciona|poner|ordenar por|cambiar a) (.+)$/,(m,a,q)=>{q=norm(q);for(const s of $$('#app select').filter(visible)){const o=[...s.options].find(x=>norm(x.textContent).includes(q));if(o){s.value=o.value;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));return'Elegí «'+o.textContent.trim().slice(0,40)+'».'}}return false}],
 [/^(tocar|toca|toca|clic en|click en|hacer clic en|presionar|presiona|apretar|apreta|pulsar|pulsa|abrir el boton|boton) (.+)$/,(m,a,q)=>{const r=clickByText(q);return r?'Toqué «'+r+'».':false}],
 [/^(ir|abrir|abri|mostrar|mostrame|llevame|ver|volver|anda|andate|pasa|pasame|cambia|cambiar) (a |al |a la |a los )?(la |el |las |los )?(pestana |seccion |pantalla |panel |pagina )?(de |del )?(.+)$/,(m,a,b,c,d,e,q)=>{const k=tabDe(q);if(k){go('#/'+k);return'Abriendo '+tabNom(k)+'.'}const p=findP(q);if(p){ctx.p=p;go('#/persona/'+encodeURIComponent(p.id));return'Ficha de '+p.nombre+'.'}return false}],
 [/^(.+)$/,(m,q)=>{const k=tabDe(q);if(k){go('#/'+k);return'Abriendo '+tabNom(k)+'.'}return false}]
];
let RAW='';
const FILT=/^(por favor |porfa |podes |podrias |quiero |necesito |decime |dime |a ver |ahora |me |mostrame |dale |y |e |entonces |bueno |ok |listo |che |mira |escucha |oi |fijate |haceme el favor de )+/;
const CONJ=/\s(?:y luego|y despues|y tambien|y a continuacion|despues|luego|y)\s(?=(?:abri|abrir|ir|anda|pone|poner|solo|mostra|mostrame|mostrar|segui|seguir|anota|anotar|busca|buscar|elegi|elegir|toca|tocar|lee|leer|filtra|ultimos|ultimas|descarga|descargar|exporta|cambia|cambiar|calcula|hace|haceme|arma|armar|dame|decime|contame|volve|volver|baja|subi|activa|desactiva|prende|apaga|pasame|llevame|compara|comparar|cuantos|cuantas|quien|quienes|cual|cuales|que|como)\b)/;
const pack=r=>typeof r==='string'?{ok:true,m:r,s:r,c:1}:{ok:true,m:r.m,s:r.s||r.m};
const esperar=ms=>new Promise(r=>setTimeout(r,ms));
const sugerir=(r,q,fn)=>{pend={fn,ttl:Date.now()+25000};return{m:r.m+' '+q,s:(r.s||r.m)+' '+q}};
/* --- interpretación libre: entidades (persona, pantalla, tema) + intención --- */
const COMUN=new Set(['opinas','opinan','opinion','pensas','crees','piensas','sabes','que','como','hay','pasa','onda','noticias','noticia','novedades','dicen','dice','habla','hablan','informacion','info','algo','sobre','acerca','esta','estan','del','con','para','hoy','ultimas','ultimos','dias','semana','mes','prensa','medios','notas','quiero','necesito','mostrame','mostrar','abrir','abri','llevame','donde','cuando','cuanto','cuantos','cuantas','quien','quienes','cual','cuales','tiene','tienen','tengo','dame','decime','contame','todo','toda','todos','todas','mas','menos','muy','esto','eso','ese','esa','estos','estas','ver','ver','tema','temas','datos','numeros','cifras','resumen','lista','listado','por','favor','puedo','podes','podria','quisiera','gustaria','importante','importantes','nuevo','nueva','nuevos','nuevas','ultimo','ultima','reciente','recientes','general','generales','cosa','cosas','poco','bien','mal','tambien','entre','desde','hasta','aqui','alla','ahi','aca','mismo','misma']);
const SEMTAB=[['estadisticas',/(numero|estadistica|grafico|cifra|ranking|cuanto publican)/],['medios',/(medios|diarios|portales|periodicos)/],['hemiciclo',/(banca|hemiciclo|composicion)/],['legislativo',/(legislador|legislatura|diputados|senadores|concejales|camara)/],['ejecutivo',/(gabinete|ministro|ministerio|gobierno|gobernador)/],['mapa',/(mapa|departamento|municipio|censo|poblacion)/],['mapas',/(organigrama|mapa conceptual)/],['red',/(relacion|vinculo|conexion|red de|aliado)/],['diario',/(resumen diario|noticias del dia|que paso|diario)/],['pulso',/(pulso|en vivo|tablero|panorama)/],['alertas',/(alerta|aviso|notificacion)/],['clientes',/(cliente|marca blanca)/],['judicial',/(juez|jueces|justicia|judicial|tribunal|fiscal|causa)/],['sesiones',/(sesion|orden del dia|plan de labor)/],['oficiales',/(boletin|publicacion oficial|decreto|oficial)/],['personas',/(personas|politicos|funcionarios|nomina)/],['notas',/(notas|noticias|titulares)/],['estrategia',/(estrategia|consultoria|campana)/],['calidad',/(calidad|procedencia)/],['control',/(control|estado del sistema)/],['casos',/(caso|monitor)/],['fuentes',/(fuente|marco legal)/],['mayorias',/(mayoria|votacion|votos)/],['verificar',/(verificar|chequear)/],['temas',/(temas seguidos)/],['palabras',/(palabra)/],['eventos',/(evento)/],['buscar',/(buscar|busqueda|encontrar)/]];
const NAVV=/\b(ver|mostra|mostrame|mostrar|abrir|abri|llevame|ir|anda|quiero ver|necesito ver|dejame ver|pasame|ponme|pone|entrar|entra|metete|cambia|cambiar|volve)\b/;
const semTab=t=>{for(const[k,re]of SEMTAB){if(re.test(t)&&TABS.some(x=>x[0]===k))return k}return null};
function entidad(t){const tk=t.split(' ');for(let n=Math.min(3,tk.length);n>=1;n--)for(let i=0;i+n<=tk.length;i++){const g=tk.slice(i,i+n);if(n===1&&(g[0].length<4||COMUN.has(g[0])||STOPW.has(g[0])||ALIASSET.has(g[0])))continue;if(g.every(w=>STOPW.has(w)||COMUN.has(w)))continue;const p=findP(g.join(' '));if(p)return{p,i,n}}return{p:null}}
const ALIASSET=new Set(Object.values(ALIAS).flat().flatMap(a=>a.split(' ')).concat(TABS.map(x=>x[0])));
const palabrasTema=(t,ex)=>t.split(' ').filter(w=>w.length>=4&&!COMUN.has(w)&&!STOPW.has(w)&&!ALIASSET.has(w)&&!(ex&&ex.has(w)));
async function tema(q,ws){await listo();const lim=Date.now()-30*D,l=(S.news||[]).filter(n=>{const d=pd(n.published_iso||n.collected_at);return d&&d>=lim&&ws.every(w=>fold(n.title).includes(w))}).sort((a,b)=>(pd(b.published_iso||b.collected_at)||0)-(pd(a.published_iso||a.collected_at)||0));
 if(!l.length){const r={m:'No encuentro notas del último mes sobre «'+q+'».',s:'No encuentro notas del último mes sobre '+q+'.'};return sugerir(r,'¿Lo busco en todo el archivo?',()=>{go('#/buscar/'+encodeURIComponent(q));return'Buscando «'+q+'».'})}
 const n7=l.filter(n=>{const d=pd(n.published_iso||n.collected_at);return Date.now()-d<7*D}).length,md=Object.entries(l.reduce((a,n)=>{const k=medioNombre(n.source);a[k]=(a[k]||0)+1;return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);ctx.tema=q;
 const r={m:'Sobre «'+q+'» hay '+l.length+' nota'+(l.length===1?'':'s')+' en el último mes, '+n7+' en la última semana. La más reciente es de '+medioNombre(l[0].source)+': '+tituloSinMedio(l[0])+'.'+(md.length>1?' Lo cubren sobre todo '+md.join(', ')+'.':'')};
 return sugerir(r,'¿Te abro esas notas?',()=>{Object.assign(NT,{k:'',m:'',c:'',q,d1:'',d2:'',o:'rec',n:50});go('#/notas');return'Notas sobre «'+q+'».'})}
async function entender(t,opts){const{p,i,n}=entidad(t),tk=t.split(' ');
 if(p){ctx.p=p;const ex=new Set(tk.slice(i,i+n));
  if(/\b(ficha|perfil|datos personales|cargo|bloque)\b/.test(t)){go('#/persona/'+encodeURIComponent(p.id));return'Ficha de '+p.nombre+'.'}
  if(/\b(red|relaciones|vinculos|conexiones|aliados|con quien)\b/.test(t)){verEnRed(p.id);return'Red de '+p.nombre+'.'}
  if(/\b(informe|reporte|pdf)\b/.test(t)){EST.id=p.id;go('#/estrategia/'+encodeURIComponent(p.id));setTimeout(()=>{try{esInforme()}catch(e){}},1500);return'Armando el informe de '+p.nombre+'.'}
  if(/\b(seguir|segui|seguimiento|seguilo)\b/.test(t)&&!/dejar|no /.test(t)){segSet(p.id,true);return'Ahora seguís a '+p.nombre+'.'}
  if(/\b(estrategia|dossier|analisis|analizar|debate|debatir|defender|rebatir|entrevista|crisis)\b/.test(t)){go('#/estrategia/'+encodeURIComponent(p.id));return'Estrategia de '+p.nombre+'.'}
  if(/\b(comparar|compara|contra|versus|vs)\b/.test(t)){const rest=tk.filter((w,k)=>k<i||k>=i+n).join(' '),q2=entidad(rest).p;if(q2&&q2!==p){EST.id=p.id;EST.vs=q2.id;go('#/estrategia/'+encodeURIComponent(p.id));return'Comparando '+p.nombre+' con '+q2.nombre+'.'}}
  const r=await resumenPersona(p);return sugerir(r,'¿Te abro su estrategia?',()=>{go('#/estrategia/'+encodeURIComponent(p.id));return'Estrategia de '+p.nombre+'.'})}
 const tab=semTab(t);
 if(tab&&(NAVV.test(t)||t.split(' ').length<=4)){go('#/'+tab);return'Abriendo '+tabNom(tab)+'.'}
 const ws=palabrasTema(t);
 if(ws.length&&ws.length<=3&&/\b(que|como|hay|pasa|onda|noticias|novedades|dicen|habla|hablan|info|informacion|cuentame|contame|sabes|opinan|esta|estan|viene|vienen|anda|andan)\b/.test(t))return tema(ws.join(' '),ws);
 if(ws.length&&ws.length<=3){const q=ws.join(' '),r={m:'No estoy seguro de qué querés hacer con «'+q+'».',s:'No estoy seguro de qué querés hacer con '+q+'.'};return sugerir(r,'¿Lo busco?',()=>{go('#/buscar/'+encodeURIComponent(q));return'Buscando «'+q+'».'})}
 return null}
async function uno(t,opts){opts=opts||{};
 for(const[re,fn]of ordenes){const m=t.match(re);if(!m)continue;let r;try{r=await fn.apply(null,m)}catch(e){console.error('NEWAR voz',e);r=false}if(r){const o=pack(r);o.cmd=t;return o}}
 let r2=null;try{r2=await entender(t,opts)}catch(e){console.error('NEWAR voz (intención)',e)}if(r2){const o=pack(r2);o.cmd=t;return o}
 if(t.split(' ').length<=3){const c=clickByText(t);if(c)return{ok:true,m:'Toqué «'+c+'».',s:'Toqué '+c+'.',c:1,cmd:t}}
 return{ok:false,m:'No entendí «'+t+'». Probá de otra forma o decí «ayuda».',s:pick(['No te entendí del todo. ¿Me lo decís de otra forma?','Perdón, no llegué a entenderte. Probá de nuevo, o decí ayuda.']),cmd:t}}
async function ejecutar(texto,opts){opts=opts||{};const orig=String(texto||'').trim();let t=norm(orig);if(!t)return{ok:false,m:'No escuché nada.',s:''};
 const w=quitaWake(t);RAW=orig.split(/\s+/).slice(w.woke?w.n:0).join(' ');
 if(w.woke)t=w.rest;else if(opts.hf&&CFG.wake&&Date.now()>awakeUntil)return{ok:null,m:''};
 t=nn(t.replace(FILT,'').replace(/ (por favor|porfa|gracias)$/,'').trim());
 if(!t)return{ok:true,m:'Te escucho.',s:pick(['Te escucho.','Decime.','A sus órdenes.'])};
 if(pend&&Date.now()<pend.ttl){if(/^(si|sii|dale|ok|okey|claro|por favor|de una|hacelo|bueno|obvio|exacto|correcto|afirmativo|mandale|adelante|abrilo|abrila|si dale|si por favor|si abrilo|si abrila|si claro)$/.test(t)){const q=pend;pend=null;return pack(await q.fn())}
  if(/^(no|nop|nada|dejalo|dejala|cancelar|cancela|olvidalo|no gracias|no hace falta|no no)$/.test(t)){pend=null;return{ok:true,m:'Bueno.',s:pick(['Bueno.','Perfecto, lo dejo así.']),c:1}}}
 pend=null;
 const partes=t.split(CONJ).map(x=>x.trim()).filter(Boolean);
 if(partes.length>1&&!opts.sub){const rs=[];for(const x of partes){const r=await uno(x,Object.assign({},opts,{sub:1}));rs.push(r);await esperar(/^(ir|abri|abrir|anda|llevame|mostrame|mostrar|pasame|volver|volve|cambia|cambiar)/.test(x)?1100:350)}
  return{ok:rs.some(r=>r.ok),m:rs.map(r=>r.m).join(' · '),s:rs.map(r=>r.s||r.m).join(' '),c:rs.every(r=>r.c)}}
 return uno(t,opts)}
async function run(texto,opts){opts=opts||{};fab.classList.add('th');let r;try{r=await ejecutar(texto,opts)}finally{fab.classList.remove('th')}
 if(r.ok===null)return r;show(texto,r.m,r.ok);logAdd('u',String(texto).trim());logAdd('n',r.m);if(r.ok){ultima=r.s||r.m}
 if(CFG.say&&(r.ok?(!r.c||CFG.conf):1)&&r.s)say(r.s);return r}

/* ---------- reconocimiento ---------- */
let rec=null,oyendo=false,quiere=false,blocked=false,fails=0,buf=[],bufT=0;
function ui(on){if(on!=null)oyendo=on;fab.classList.toggle('on',oyendo);const t=$('#nvtalk');t.classList.toggle('on',oyendo);t.textContent=oyendo?'⏹ Escuchando…':'🎤 Hablar';$('#nvhf').classList.toggle('on',!!CFG.hf);$('#nvsay').checked=!!CFG.say;$('#nvconf').checked=!!CFG.conf;$('#nvwake').checked=!!CFG.wake;$('#nvrate').value=CFG.rate;$('#nvpitch').value=CFG.pitch;const g=$('#nvgen');if(g)g.value=CFG.gen||'';const n=$('#nvvn');if(n)n.textContent=vozNota()}
const solape=(a,b)=>{const A=norm(a).split(' ').filter(w=>w.length>2),B=new Set(norm(b).split(' ').filter(w=>w.length>2));if(!A.length)return 0;return A.filter(w=>B.has(w)).length/A.length};
const eco=a=>!!lastSpoken&&Date.now()-speakEnd<3000&&solape(a,lastSpoken)>=.6;
async function procesar(items){const alts=items.length>1?[items.map(i=>i.alts[0]).join(' ')].concat(items[0].alts.slice(1)):items[0].alts,conf=Math.min(...items.map(i=>i.conf==null?1:i.conf)),hf=!!CFG.hf;
 if(eco(alts[0])){show(alts[0],'(era el eco de mi propia voz: lo ignoro)',null);return}
 if(hf&&CFG.wake){const ok=alts.find(a=>quitaWake(norm(a)).woke);if(!ok&&Date.now()>awakeUntil){show(alts[0],'(esperando «Newar»…)',null);return}
  if(!ok&&conf<.3){show(alts[0],'(no lo entendí bien: lo ignoro)',null);return}
  const r=await run(ok||alts[0],{hf});if(r&&r.ok)awakeUntil=Date.now()+15000;return}
 for(const a of alts.slice(0,4)){const r=await run(a,{hf});if(r.ok===null)continue;if(r.ok)break}
 if(hf)awakeUntil=Date.now()+15000}
function start(){if(!SR){show('','Este navegador no tiene reconocimiento de voz. Usá Chrome, Edge o Safari, o escribí la orden en el cuadro.',false);abrir(true);return}
 if(oyendo||hablando)return;blocked=false;quiere=true;rec=new SR();rec.lang='es-AR';rec.continuous=!!CFG.hf;rec.interimResults=true;rec.maxAlternatives=5;let hecho=-1;
 rec.onstart=()=>{ui(true);fails=0;show('',CFG.hf?'Escucho. Decí «Newar» y tu orden.':'Te escucho…',null)};
 rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(!r.isFinal){show(r[0].transcript,'…',null);continue}if(i<=hecho)continue;hecho=i;const alts=Array.from(r).map(a=>a.transcript).filter(Boolean);if(!alts.length)continue;
   buf.push({alts,conf:r[0].confidence});clearTimeout(bufT);
   bufT=setTimeout(()=>{const b=buf;buf=[];Promise.resolve(procesar(b)).then(()=>{if(!CFG.hf){quiere=false;try{rec.stop()}catch(x){}}})},CFG.hf?800:450)}};
 rec.onerror=e=>{const c=e.error;if(c==='not-allowed'||c==='service-not-allowed'){blocked=true;quiere=false;CFG.hf=0;show('','El navegador no dio permiso al micrófono. Habilitalo desde el candado de la barra de direcciones.',false)}else if(c==='audio-capture'){blocked=true;quiere=false;show('','No encuentro un micrófono.',false)}else if(c==='network'){fails++;show('','Falló la conexión del servicio de voz del navegador'+(fails>2?'. Probá escribir las órdenes.':'; reintento…'),false);if(fails>4){quiere=false}}};
 rec.onend=()=>{ui(false);if(quiere&&CFG.hf&&!blocked&&!hablando)setTimeout(()=>{if(quiere&&!oyendo)start()},fails>2?2500:300)};
 try{rec.start()}catch(e){ui(false)}}
function stop(){quiere=false;try{rec&&rec.stop()}catch(e){}ui(false)}
const abrir=v=>{const a=v==null?pan.hidden:v;pan.hidden=!a;if(a){ui();cargaVoces();$('#nvin').focus()}};
function ayuda(forzar){const h=$('#nvh');if(forzar||h.hidden){h.hidden=false;h.innerHTML=`<h4>Hablame normal</h4><code>quiero ver los números de los medios</code><code>llevame a donde están los legisladores</code><code>cómo viene Sáenz</code><code>qué onda con la minería</code><code>abrí estadísticas y poné solo nacionales</code><code>sí / no</code> (para responder a lo que te propongo)<h4>Preguntas</h4><code>¿cuántas notas hay hoy?</code><code>¿quién es el más mencionado esta semana?</code><code>¿qué temas se hablan?</code><code>¿qué dicen de Sáenz?</code><code>¿quién es Sáenz?</code><code>¿cuántos diputados tiene Todos por Salta?</code><code>¿quién tiene la mayoría en el Senado?</code><code>¿están los datos actualizados?</code><code>novedades de mis seguidos</code>
<h4>Moverse</h4><code>ir a mapa</code><code>abrir pulso</code><code>estadísticas</code><code>volver</code><code>arriba</code><code>bajar</code><code>hemiciclo del senado</code>
<h4>Personas</h4><code>ficha de Sáenz</code><code>su red</code><code>estrategia de Sáenz</code><code>informe de Sáenz</code><code>armá la consulta de Sáenz para debate</code><code>comparar Sáenz con Dib Ashur</code><code>camino entre Sáenz y Dib Ashur</code><code>seguir a Sáenz</code>
<h4>Pantalla actual</h4><code>solo nacionales</code><code>últimos 7 días</code><code>últimas 6 horas</code><code>mostrar más</code><code>descargar CSV</code><code>elegir más mencionados</code><code>escribir litio</code><code>tocá comparar</code>
<h4>Escuchar y herramientas</h4><code>resumen del día</code><code>leé los titulares</code><code>siguiente</code><code>leé la pantalla</code><code>repetí</code><code>callate</code><code>anotar llamar a prensa</code><code>temporizador de 5 minutos</code><code>calculá 15 por ciento de 2300</code><code>qué hora es</code>
<h4>Voz y modos</h4><code>mejor voz</code><code>voz de hombre</code><code>voz de mujer</code><code>modo Jarvis</code><code>hablá más rápido</code><code>cambiá la voz</code><code>no me respondas en voz</code><code>sala de control</code><code>rotar</code><code>tema claro</code>
<p class="note">Después de «Newar» podés seguir hablando unos segundos sin repetirlo. También respondo a «Jarvis». Si el navegador escribe «Neward» o «Nuar», igual te entiendo. Pronombres: después de hablar de alguien, «su ficha», «su red», «seguilo» o «su informe» usan a esa persona. El reconocimiento lo hace tu navegador; en Chrome y Edge el audio pasa por un servicio de voz en la nube. NEWAR no guarda audio.</p>`}else h.hidden=true}
$('#nvsup').textContent=(SR?'Reconocimiento de voz disponible. ':'Este navegador no reconoce voz: usá el cuadro de texto (o abrí NEWAR en Chrome, Edge o Safari). ')+(TTS?'Voz de respuesta disponible.':'Este navegador no puede hablar.');ui();
fab.addEventListener('click',()=>{if(hablando){cancelaHabla();return}abrir()});
pan.addEventListener('click',e=>{const b=e.target.closest('[data-nv]');if(!b)return;const a=b.dataset.nv;
 if(a==='close')abrir(false);else if(a==='help')ayuda();else if(a==='talk')oyendo?stop():start();else if(a==='shh'){cancelaHabla();colaLect=[]}
 else if(a==='test'){const m='Hola, soy NEWAR. Así suena mi voz.';const s=CFG.say;CFG.say=1;say(m).then(()=>{CFG.say=s})}
 else if(a==='hf'){CFG.hf=CFG.hf?0:1;save();ui();if(oyendo)stop();if(CFG.hf){start();const m='Modo manos libres. Decí Newar y tu orden.';show('',m,true);say(m)}else show('','Manos libres apagado.',true)}
 else if(a==='run'){const i=$('#nvin');if(i.value.trim()){run(i.value.trim());i.value=''}}});
$('#nvin').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const i=e.target;if(i.value.trim()){run(i.value.trim());i.value=''}}else if(e.key==='Escape')abrir(false)});
const tg=(id,k)=>$('#'+id).addEventListener('change',e=>{CFG[k]=e.target.checked?1:0;save()});tg('nvsay','say');tg('nvconf','conf');tg('nvwake','wake');
$('#nvvoice').addEventListener('change',e=>{CFG.voice=e.target.value;save();ui()});$('#nvgen').addEventListener('change',e=>{CFG.gen=e.target.value;CFG.voice='';save();cargaVoces();ui()});$('#nvrate').addEventListener('input',e=>{CFG.rate=+e.target.value;save()});$('#nvpitch').addEventListener('input',e=>{CFG.pitch=+e.target.value;save()});
document.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.code==='KeyV'||e.key==='v'||e.key==='V')){e.preventDefault();if(hablando)cancelaHabla();else if(oyendo)stop();else{abrir(true);start()}}});
window.NXV={run,ejecutar,abrir,start,stop,say,findP,tabDe,isWake,quitaWake,cfg:CFG,ctx,estado:()=>({oyendo,hablando,awakeUntil,quiere}),soportado:!!SR};
})();
