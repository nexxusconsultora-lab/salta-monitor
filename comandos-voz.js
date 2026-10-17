/* ===== NEWAR · Control por voz =====
   Manejá NEWAR hablando: «ir a mapa», «buscar litio», «abrir ficha de Sáenz», «seguir a Sáenz», «solo nacionales», «últimos 7 días»,
   «resumen del día» (lo lee en voz alta), «anotar llamar a prensa», «sala de control», «rotar»… y, para todo lo demás, «tocá <texto de un botón>».
   También se puede escribir la orden en el cuadro (sirve en cualquier navegador). Se carga como pulso.js: una línea al final de index.html.
   PRIVACIDAD: el reconocimiento de voz lo hace el navegador (Chrome, Edge, Safari). En Chrome y Edge el audio se envía a un servicio de voz en
   la nube del fabricante; NEWAR no graba ni guarda audio, solo recibe el texto. Firefox no lo soporta: usá el cuadro de texto. */
(()=>{
'use strict';
const SR=window.SpeechRecognition||window.webkitSpeechRecognition,TTS='speechSynthesis' in window;
const VK='newar_voz_v1',CFG=Object.assign({hf:0,wake:1,say:0},(()=>{try{return JSON.parse(localStorage.getItem(VK)||'{}')}catch(e){return{}}})());
const save=()=>{try{localStorage.setItem(VK,JSON.stringify(CFG))}catch(e){}};
const norm=s=>fold(s).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const hoy=()=>new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long'});

const css=document.createElement('style');css.textContent=`
#nvfab{position:fixed;right:1rem;bottom:calc(8.4rem + env(safe-area-inset-bottom,0px));z-index:30;width:3.3rem;height:3.3rem;border-radius:50%;border:2px solid var(--ink);background:var(--indigo);color:var(--onind);font-size:1.35rem;line-height:1;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35);padding:0}
#nvfab:hover{filter:brightness(1.1)}#nvfab.on{background:var(--neg);color:#fff;animation:nvp 1.2s ease-in-out infinite}@keyframes nvp{50%{box-shadow:0 0 0 .7rem rgba(255,62,108,.0),0 3px 12px rgba(0,0,0,.35)}0%{box-shadow:0 0 0 0 rgba(255,62,108,.55),0 3px 12px rgba(0,0,0,.35)}}
#nvp{position:fixed;z-index:31;right:.8rem;bottom:calc(12.3rem + env(safe-area-inset-bottom,0px));width:min(26rem,calc(100vw - 1.6rem));max-height:min(36rem,calc(100vh - 8rem));display:flex;flex-direction:column;background:var(--raised);color:var(--ink);border:2px solid var(--ink);border-radius:.6rem;box-shadow:0 8px 28px rgba(0,0,0,.4);font-size:.86rem}
#nvp[hidden]{display:none}#nvp header{display:flex;align-items:center;gap:.4rem;padding:.45rem .6rem;border-bottom:1px solid var(--line)}#nvp header b{flex:1}
#nvp button,#nvp input,#nvp select{font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:.3rem;padding:.25rem .55rem}#nvp button{cursor:pointer;background:var(--raised)}#nvp button:hover{background:var(--hov)}#nvp button.on{background:var(--indigo);color:var(--onind)}
#nvb{overflow-y:auto;padding:.5rem .6rem;display:flex;flex-direction:column;gap:.45rem}
#nvt{min-height:2.6rem;border:1px dashed var(--line);border-radius:.3rem;padding:.4rem .55rem;font-size:.95rem}#nvt small{display:block;color:var(--soft)}
#nvt.ok{border-color:var(--pos)}#nvt.no{border-color:var(--neg)}
.nvr{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}.nvr input[type=text]{flex:1 1 11rem;min-width:0}.nvr label{display:flex;align-items:center;gap:.3rem;font-size:.8rem}
#nvh{font-size:.8rem}#nvh h4{margin:.5rem 0 .15rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--soft)}#nvh code{display:inline-block;margin:.1rem .2rem .1rem 0}
#nvlive{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(3.2rem + env(safe-area-inset-bottom,0px));z-index:45;max-width:min(36rem,92vw);padding:.55rem 1rem;border-radius:2rem;background:var(--ink);color:var(--paper);font:600 .95rem system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4);display:none}#nvlive.on{display:block}
body.hud #nvfab{background:linear-gradient(135deg,#22E3FF,#8FA8FF);color:#04101D}
@media print{#nvfab,#nvp,#nvlive{display:none!important}}
@media(max-width:640px){#nvp{left:.4rem;right:.4rem;width:auto}}
`;document.head.appendChild(css);
document.body.insertAdjacentHTML('beforeend',`<div id="nvlive" role="status" aria-live="polite"></div>
<button id="nvfab" type="button" aria-label="Control por voz" title="Control por voz (Alt+V para hablar)">🎤</button>
<section id="nvp" role="dialog" aria-label="Control por voz" hidden>
<header><b>🎤 Control por voz</b><button type="button" data-nv="help" title="Qué puedo decir">?</button><button type="button" data-nv="close" aria-label="Cerrar">✕</button></header>
<div id="nvb"><div id="nvt" aria-live="polite">Tocá el micrófono y decí una orden, por ejemplo <b>«ir a mapa»</b>.</div>
<div class="nvr"><button type="button" id="nvtalk" data-nv="talk">🎤 Hablar</button><button type="button" id="nvhf" data-nv="hf" title="Escucha siempre; hay que empezar cada orden con «NEWAR»">Manos libres</button></div>
<div class="nvr"><input type="text" id="nvin" placeholder="O escribí la orden: ir a red, buscar litio…" aria-label="Escribir una orden" autocomplete="off"><button type="button" data-nv="run">Ejecutar</button></div>
<div class="nvr"><label><input type="checkbox" id="nvwake"> Pedir «NEWAR» antes de cada orden (manos libres)</label><label><input type="checkbox" id="nvsay"> Confirmar en voz alta</label></div>
<p class="note" id="nvsup"></p><div id="nvh" hidden></div></div></section>`);
const fab=$('#nvfab'),pan=$('#nvp'),live=$('#nvlive'),tbox=$('#nvt');

/* ---------- salida: texto en pantalla y voz ---------- */
let _lt=0;const say=t=>{if(!TTS||!t)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(t).slice(0,900)),vs=speechSynthesis.getVoices();u.lang='es-AR';const v=vs.find(x=>/^es-AR/i.test(x.lang))||vs.find(x=>/^es/i.test(x.lang));if(v)u.voice=v;u.rate=1.02;speechSynthesis.speak(u)}catch(e){}};
const show=(heard,res,ok)=>{tbox.className=ok==null?'':ok?'ok':'no';tbox.innerHTML='';const a=document.createElement('div');a.textContent=heard?'«'+heard+'»':'';tbox.appendChild(a);if(res){const s=document.createElement('small');s.textContent=res;tbox.appendChild(s)}
 live.textContent=(ok===false?'✖ ':ok?'✔ ':'🎤 ')+(res||heard||'');live.classList.add('on');clearTimeout(_lt);_lt=setTimeout(()=>live.classList.remove('on'),ok==null?6000:3800)};

/* ---------- búsqueda de personas, pestañas y elementos ---------- */
const STOPW=new Set(['de','del','la','el','a','al','los','las','y','e','con','sobre','para','por','me','mi','un','una']);
const findP=q=>{const ws=norm(q).split(' ').filter(w=>w.length>1&&!STOPW.has(w));if(!ws.length)return null;let best=null,bs=0;
 personas.forEach(p=>{if(p.homonimoDe)return;const nm=norm([p.nombre,...(p.aliases||[])].join(' ')).split(' ');let s=0;for(const w of ws){const m=Math.max(0,...nm.map(x=>x===w?4:x.startsWith(w)?3:(typeof wsc==='function'?wsc(w,x):0)));if(!m){s=-1;break}s+=m}
  if(s>0){s+=(p.v===1?1:0)+Math.min(2,total(p.id)/50);if(s>bs){bs=s;best=p}}});return best};
const ALIAS={inicio:['inicio','principal','pagina principal','home'],pulso:['pulso','tablero en vivo','centro de mando','pulso en vivo'],diario:['diario','resumen diario'],resumen:['resumen nacional','resumen provincial','resumen nacional provincial'],estadisticas:['estadisticas','estadistica','numeros','graficos'],voz:['voz y peso','peso de bloques'],mapas:['mapas','organigramas','mapas conceptuales'],mapa:['mapa','mapa de salta','mapa por departamento'],mayorias:['mayorias','laboratorio de mayorias'],hemiciclo:['hemiciclo','congreso'],red:['red','red de relaciones','grafo'],casos:['casos','monitores'],calidad:['calidad','calidad de datos'],fuentes:['fuentes','marco legal'],oficiales:['oficiales','publicaciones oficiales','boletin oficial'],control:['control','control de datos'],destacados:['destacados','favoritos'],menciones:['menciones','prensa'],medios:['medios','medios nacionales'],personas:['personas','politicos','funcionarios'],legislativo:['legislativo','legisladores','legislatura'],ejecutivo:['ejecutivo','gabinete','poder ejecutivo'],sesiones:['sesiones','sesion'],temas:['temas'],palabras:['palabras'],cruce:['cruce'],verificar:['verificar','verificador'],eventos:['eventos'],notas:['notas'],buscar:['buscar','busqueda','busqueda avanzada'],estrategia:['estrategia'],alertas:['alertas','avisos'],clientes:['clientes','informe de cliente'],judicial:['judicial','justicia','poder judicial'],argentina:['argentina','pais']};
const tabDe=p=>{p=norm(p);if(!p)return null;let best=null,bs=0;TABS.forEach(([k,l])=>{const als=[...new Set([norm(l),k,...(ALIAS[k]||[])])];als.forEach(a=>{let s=0;if(p===a)s=100+a.length;else if(new RegExp('(^| )'+a+'( |$)').test(p)&&a.length>=4)s=10+a.length;if(s>bs){bs=s;best=k}})});return best};
const visible=el=>!el.closest('[hidden],#nvp,#nvfab,#nvlive')&&getComputedStyle(el).display!=='none';
const clickByText=q=>{q=norm(q);if(!q)return null;const c=$$('#app button,#app a[href],#app [role=button],#app summary,#app label,#tabs a,.lv,#nbfab').filter(visible).map(el=>({el,t:norm(el.textContent+' '+(el.getAttribute('aria-label')||'')+' '+(el.title||''))})).filter(x=>x.t);
 const ex=c.filter(x=>x.t===q),st=c.filter(x=>x.t.startsWith(q)),inc=c.filter(x=>x.t.includes(q)),pool=ex.length?ex:st.length?st:inc;if(!pool.length)return null;
 pool.sort((a,b)=>a.t.length-b.t.length);const el=pool[0].el;try{el.scrollIntoView({block:'center'})}catch(e){}el.click();return(el.textContent||el.getAttribute('aria-label')||q).replace(/\s+/g,' ').trim().slice(0,40)};
const go=h=>{if(location.hash===h)route();else location.hash=h};

/* ---------- lectura en voz alta ---------- */
const nuevas=()=>{const now=Date.now();return(S.news||[]).filter(x=>{const d=pd(x.published_iso||x.collected_at);return d&&now-d<864e5&&d<=now+36e5})};
const briefing=async()=>{await need('news').catch(()=>0);const n=nuevas(),md=new Set(n.map(x=>medioKey(x.source))),now=Date.now(),mm=MEN.filter(m=>m._d&&now-m._d<864e5&&okPrec(m)).length,tc={};n.forEach(x=>{const t=esTema(x.title);if(t!=='Sin tema claro')tc[t]=(tc[t]||0)+1});
 const tt=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,c])=>t+', '+c+' notas'),last=n.slice().sort((a,b)=>(pd(b.published_iso||b.collected_at)||0)-(pd(a.published_iso||a.collected_at)||0))[0];
 return 'Resumen al '+hoy()+'. En las últimas 24 horas hay '+n.length+' notas de '+md.size+' medios y '+mm+' menciones de personas de la nómina. '+(tt.length?'Los temas que más se tratan son: '+tt.join('; ')+'. ':'')+(last?'La última nota es de '+medioNombre(last.source)+': '+tituloSinMedio(last)+'.':'')};
const titulares=async()=>{await need('news').catch(()=>0);const l=(S.news||[]).slice().sort((a,b)=>(pd(b.published_iso||b.collected_at)||0)-(pd(a.published_iso||a.collected_at)||0)).slice(0,5);return l.length?'Últimos titulares. '+l.map((n,i)=>(i+1)+'. '+medioNombre(n.source)+': '+tituloSinMedio(n)).join('. '):'No hay titulares guardados.'};
const pantalla=()=>{const h=$('#app h2'),k=$$('#app .news .box,#app .grid .card,#app .pl-k .box').slice(0,8).map(x=>x.textContent.replace(/\s+/g,' ').trim());return(h?h.textContent.trim()+'. ':'')+(k.length?k.join('. '):'No encuentro cifras para leer en esta pantalla.')};

/* ---------- órdenes: cada una es [expresión, función]. Se prueban en orden; la función devuelve el mensaje (o false si no aplica) ---------- */
const hudOn=()=>document.body.classList.contains('hud');
const ordenes=[
 [/^(ayuda|que puedo decir|que comandos hay|comandos|como funciona)$/,()=>{ayuda(true);return'Te muestro lo que podés decir.'}],
 [/^(dejar de escuchar|apagar (el )?microfono|parar de escuchar|chau|cerrar microfono)$/,()=>{stop();return'Micrófono apagado.'}],
 [/^(callate|callar|parar de leer|deja de leer|silencio|basta)$/,()=>{try{speechSynthesis.cancel()}catch(e){}return'Listo.'}],
 [/^(volver|volver atras|atras|pagina anterior)$/,()=>{history.back();return'Volviendo.'}],
 [/^(actualizar|recargar|refrescar|actualizar datos|buscar datos nuevos)$/,()=>{const b=$('#lvb');if(b)b.click();return'Actualizando los datos.'}],
 [/(modo|tema) (oscuro|claro)|cambiar (el )?(modo|tema)/,(m,a,t)=>{const dark=document.documentElement.getAttribute('data-theme')!=='light',want=/oscuro/.test(t||'')?true:/claro/.test(t||'')?false:!dark;if(want!==dark)$('#thb').click();return want?'Tema oscuro.':'Tema claro.'}],
 [/(salir|apagar|desactivar|quitar|cerrar) (de )?(la )?(sala de control|pantalla completa|modo hud|modo futurista)/,()=>{if(hudOn())$('#hudb').click();return'Saliendo de la Sala de control.'}],
 [/(sala de control|pantalla completa|modo hud|modo futurista)/,()=>{if(!hudOn())$('#hudb').click();return'Sala de control activada.'}],
 [/(detener|parar|pausar|apagar|sacar) (la )?(rotacion|presentacion)/,()=>{const b=$('#hudrot');if(b&&b.classList.contains('on'))b.click();return'Rotación detenida.'}],
 [/(rotar|rotacion|modo presentacion|presentacion automatica|pasar pantallas)/,()=>{if(!hudOn()){$('#hudb').click();setTimeout(()=>{const b=$('#hudrot');if(b&&!b.classList.contains('on'))b.click()},500)}else{const b=$('#hudrot');if(b&&!b.classList.contains('on'))b.click()}return'Rotación automática activada.'}],
 [/(texto|letra) (mas )?(grande|grandes)|agrandar (el )?texto|aumentar (el )?texto/,()=>{$('#szp').click();return'Texto más grande.'}],
 [/(texto|letra) (mas )?(chico|chica|chicos|pequeno|pequena)|achicar (el )?texto|disminuir (el )?texto/,()=>{$('#szm').click();return'Texto más chico.'}],
 [/^(bajar|abajo|mas abajo|scroll abajo|bajar la pantalla)$/,()=>{scrollBy({top:innerHeight*.8,behavior:'smooth'});return'Bajando.'}],
 [/^(subir|arriba|mas arriba|ir arriba|al principio|scroll arriba)$/,()=>{scrollTo({top:0,behavior:'smooth'});return'Subiendo.'}],
 [/^(imprimir|guardar como pdf|exportar a pdf)$/,()=>{setTimeout(()=>print(),200);return'Abriendo la impresión.'}],
 [/(resumen del dia|que paso hoy|que hay de nuevo|novedades|dame el resumen|resumen de hoy|buenos dias newar)/,()=>{briefing().then(t=>{say(t);show('',t,true)});return'Preparando el resumen…'}],
 [/(leer|lee|leeme|leé|decime|dime) (los )?titulares/,()=>{titulares().then(t=>{say(t);show('',t,true)});return'Leyendo los titulares…'}],
 [/(leer|lee|leeme|leé) (la )?(pantalla|esto|cifras)/,()=>{const t=pantalla();say(t);return t}],
 [/^(abrir|mostrar|ver) (el )?anotador$|^anotador$/,()=>{const b=$('#nbfab');if(b)b.click();return'Anotador.'}],
 [/^(anotar|apuntar|agregar nota|nota|tomar nota)\s+(.+)$/,(m,a,txt)=>{const raw=RAW.replace(/^\s*(anotar|apuntar|agregar nota|nota|tomar nota)[\s,:]*/i,'').trim()||txt;if(window.NX&&NX.nota){NX.nota('Nota por voz · '+hoy(),raw);return'Nota guardada en el anotador.'}return false}],
 [/^(seguir|segui|seguime) a (.+)$/,(m,a,q)=>{const p=findP(q);if(!p)return'No encontré a esa persona en la nómina.';segSet(p.id,true);return'Ahora seguís a '+p.nombre+'.'}],
 [/^(dejar de seguir|no seguir mas|quitar de seguidos) a (.+)$/,(m,a,q)=>{const p=findP(q);if(!p)return'No encontré a esa persona.';segSet(p.id,false);return'Dejaste de seguir a '+p.nombre+'.'}],
 [/^comparar (.+?) (con|contra|y) (.+)$/,(m,a,c,b)=>{const A=findP(a),B=findP(b);if(!A||!B)return'No encontré a las dos personas.';EST.id=A.id;EST.vs=B.id;go('#/estrategia/'+encodeURIComponent(A.id));return'Comparando '+A.nombre+' con '+B.nombre+'.'}],
 [/camino (mas corto )?(entre|de) (.+?) (y|e|hasta|a) (.+)$/,(m,a,b,c,d,e)=>{const A=findP(c),B=findP(e);if(!A||!B)return'No encontré a las dos personas.';RED.pa=A.id;RED.pb=B.id;go('#/red');return'Camino más corto entre '+A.nombre+' y '+B.nombre+'.'}],
 [/(red|relaciones|vinculos|conexiones) (de|del|de la) (.+)$/,(m,a,b,q)=>{const p=findP(q);if(!p)return'No encontré a esa persona.';verEnRed(p.id);return'Red de '+p.nombre+'.'}],
 [/(estrategia|dossier|tablero|analisis) (de|del|de la|sobre) (.+)$/,(m,a,b,q)=>{const p=findP(q);if(!p)return'No encontré a esa persona.';go('#/estrategia/'+encodeURIComponent(p.id));return'Estrategia de '+p.nombre+'.'}],
 [/^(ficha|perfil|persona|datos|informacion|quien es|abrir a|abri a|mostrame a|abrir ficha|ficha de|perfil de|datos de|informacion de) ?(de|del|de la)? ?(.+)$/,(m,a,b,q)=>{const p=findP(q);if(!p)return false;go('#/persona/'+encodeURIComponent(p.id));return'Ficha de '+p.nombre+'.'}],
 [/^(buscar|busca|encontrar|encontra) en (las )?notas (.+)$/,(m,a,b,q)=>{Object.assign(NT,{k:'',m:'',c:'',q,d1:'',d2:'',o:'rec',n:50});go('#/notas');return'Buscando «'+q+'» en las notas.'}],
 [/^(buscar|busca|encontrar|encontra) (la )?palabra (.+)$/,(m,a,b,q)=>{go('#/palabra/'+encodeURIComponent(q));return'Palabra «'+q+'».'}],
 [/^(buscar|busca|busqueda de|encontrar|encontra) (.+)$/,(m,a,q)=>{go('#/buscar/'+encodeURIComponent(q));return'Buscando «'+q+'».'}],
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
 [/^(ir|abrir|abri|mostrar|mostrame|llevame|ver|volver) (a |al |a la |a los )?(la |el |las |los )?(pestana |seccion |pantalla |panel |pagina )?(de |del )?(.+)$/,(m,a,b,c,d,e,q)=>{const k=tabDe(q);if(!k)return false;go('#/'+k);return'Abriendo '+(TABS.find(t=>t[0]===k)||[0,k])[1]+'.'}],
 [/^(.+)$/,(m,q)=>{const k=tabDe(q);if(k){go('#/'+k);return'Abriendo '+(TABS.find(t=>t[0]===k)||[0,k])[1]+'.'}return false}]
];
let RAW='';
const WAKE=/^(oye |hola |ok |che |a ver )?(newar|nuar|nuevar|neguar|neuar|neovar|nijuar|niuar|ñuar)( |$)/;
function ejecutar(texto,opts){opts=opts||{};RAW=String(texto||'').replace(/^\s*(oye |hola |ok |che |a ver )?(newar|nuar|nuevar|neguar|neuar|neovar|nijuar|niuar|ñuar)[\s,:]*/i,'');let t=norm(texto);if(!t)return{ok:false,msg:'No escuché nada.'};
 const w=t.match(WAKE);if(w)t=t.slice(w[0].length).trim();else if(opts.exigeWake)return{ok:null,msg:''};
 t=t.replace(/^(por favor |porfa |podes |podrias |quiero |necesito |decime |dime |a ver |ahora )+/,'').replace(/ (por favor|porfa|gracias)$/,'').trim();
 t=t.replace(/^(abrir|abri|mostrar|mostrame|ver|quiero ver|llevame a|ir a)\s+(?=(ficha|perfil|estrategia|dossier|red |camino|comparar))/,'');
 if(!t)return{ok:true,msg:'Te escucho.'};
 for(const[re,fn]of ordenes){const m=t.match(re);if(!m)continue;let r;try{r=fn.apply(null,m)}catch(e){console.error('NEWAR voz',e);r=false}if(r)return{ok:true,msg:r,cmd:t}}
 const c=clickByText(t);if(c)return{ok:true,msg:'Toqué «'+c+'».',cmd:t};
 return{ok:false,msg:'No entendí «'+t+'». Decí «ayuda» para ver qué puedo hacer.',cmd:t}}
const run=(texto,opts)=>{const r=ejecutar(texto,opts);if(r.ok===null)return r;show(texto,r.msg,r.ok);if(CFG.say&&r.ok&&r.msg&&!/Preparando|Leyendo|Te muestro/.test(r.msg))say(r.msg);else if(r.ok===false&&CFG.say)say('No entendí.');return r};

/* ---------- reconocimiento ---------- */
let rec=null,oyendo=false,quiere=false,blocked=false;
const setOn=v=>{oyendo=v;fab.classList.toggle('on',v);$('#nvtalk').classList.toggle('on',v);$('#nvtalk').textContent=v?'⏹ Escuchando…':'🎤 Hablar';$('#nvhf').classList.toggle('on',!!CFG.hf)};
function start(){if(!SR){show('','Este navegador no tiene reconocimiento de voz. Usá Chrome, Edge o Safari, o escribí la orden en el cuadro.',false);abrir(true);return}
 if(oyendo)return;blocked=false;quiere=true;rec=new SR();rec.lang='es-AR';rec.continuous=!!CFG.hf;rec.interimResults=true;rec.maxAlternatives=3;
 rec.onstart=()=>{setOn(true);show('',CFG.hf?'Escuchando. Empezá con «NEWAR»'+(CFG.wake?'':' (o decí la orden directo)')+'.':'Te escucho…',null)};
 rec.onresult=e=>{let fin='',inte='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)fin+=r[0].transcript;else inte+=r[0].transcript}
  if(inte&&!fin)show(inte,'…',null);
  if(fin){const last=e.results[e.results.length-1],alts=[...last].map(a=>a.transcript);let hecho=false;
   for(const a of alts){const r=ejecutar(a,{exigeWake:!!CFG.hf&&!!CFG.wake});if(r.ok===null){hecho=true;break}if(r.ok){run(a,{exigeWake:!!CFG.hf&&!!CFG.wake});hecho=true;break}}
   if(!hecho)run(alts[0],{exigeWake:!!CFG.hf&&!!CFG.wake});
   if(!CFG.hf){quiere=false;try{rec.stop()}catch(x){}}}};
 rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){blocked=true;quiere=false;show('','El navegador no dio permiso al micrófono. Habilitalo en el candado de la barra de direcciones.',false)}else if(e.error==='no-speech'){}else if(e.error==='network'){show('','Falló la conexión del servicio de voz del navegador.',false)}else if(e.error!=='aborted')show('','Error de voz: '+e.error,false)};
 rec.onend=()=>{setOn(false);if(quiere&&CFG.hf&&!blocked)setTimeout(()=>{try{start()}catch(x){}},350)};
 try{rec.start()}catch(e){setOn(false)}}
function stop(){quiere=false;try{rec&&rec.stop()}catch(e){}setOn(false)}
const abrir=v=>{const a=v==null?pan.hidden:v;pan.hidden=!a;if(a){$('#nvin').focus()}};
function ayuda(forzar){const h=$('#nvh');if(forzar||h.hidden){h.hidden=false;h.innerHTML=`<h4>Moverse</h4><code>ir a mapa</code><code>abrir pulso</code><code>estadísticas</code><code>volver</code><code>arriba</code><code>bajar</code>
<h4>Buscar y personas</h4><code>buscar litio</code><code>buscar en las notas paritaria</code><code>ficha de Sáenz</code><code>estrategia de Sáenz</code><code>red de Sáenz</code><code>camino entre Sáenz y Dib Ashur</code><code>comparar Sáenz con Dib Ashur</code><code>seguir a Sáenz</code>
<h4>Filtros de la pantalla</h4><code>solo nacionales</code><code>solo Salta</code><code>todos los medios</code><code>últimos 7 días</code><code>últimas 6 horas</code><code>mostrar más</code><code>descargar CSV</code><code>elegir más mencionados</code><code>escribir litio</code>
<h4>Escuchar</h4><code>resumen del día</code><code>leer titulares</code><code>leer pantalla</code><code>callate</code>
<h4>Herramientas</h4><code>anotar llamar a prensa</code><code>abrir anotador</code><code>sala de control</code><code>rotar</code><code>tema claro</code><code>texto más grande</code><code>actualizar</code><code>imprimir</code>
<h4>Para todo lo demás</h4><code>tocá seguir</code><code>tocá comparar</code><code>tocá 30 d</code> — toca el botón o enlace visible que tenga ese texto.
<p class="note">En manos libres, empezá cada orden con «NEWAR» (ej.: «NEWAR, ir a mapa»). El reconocimiento lo hace tu navegador; en Chrome y Edge el audio pasa por un servicio de voz en la nube del fabricante. NEWAR no guarda audio.</p>`}else h.hidden=true}
$('#nvwake').checked=!!CFG.wake;$('#nvsay').checked=!!CFG.say;$('#nvsup').textContent=SR?'Reconocimiento de voz disponible en este navegador.':'Este navegador no reconoce voz: usá el cuadro de texto (o abrí NEWAR en Chrome, Edge o Safari).';$('#nvhf').classList.toggle('on',!!CFG.hf);
fab.addEventListener('click',()=>abrir());
pan.addEventListener('click',e=>{const b=e.target.closest('[data-nv]');if(!b)return;const a=b.dataset.nv;
 if(a==='close')abrir(false);else if(a==='help')ayuda();else if(a==='talk')oyendo?stop():start();
 else if(a==='hf'){CFG.hf=CFG.hf?0:1;save();b.classList.toggle('on',!!CFG.hf);if(oyendo)stop();if(CFG.hf)start();else show('','Manos libres apagado.',true)}
 else if(a==='run'){const i=$('#nvin');if(i.value.trim()){run(i.value.trim());i.value=''}}});
$('#nvin').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const i=e.target;if(i.value.trim()){run(i.value.trim());i.value=''}}else if(e.key==='Escape')abrir(false)});
$('#nvwake').addEventListener('change',e=>{CFG.wake=e.target.checked?1:0;save()});$('#nvsay').addEventListener('change',e=>{CFG.say=e.target.checked?1:0;save()});
document.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.code==='KeyV'||e.key==='v'||e.key==='V')){e.preventDefault();if(oyendo)stop();else{abrir(true);start()}}});
window.NXV={run,ejecutar,abrir,start,stop,say,findP,tabDe,soportado:!!SR};
if(CFG.hf&&SR){/* el navegador exige un gesto del usuario para activar el micrófono: no se enciende solo */}
})();
