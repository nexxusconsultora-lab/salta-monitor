/* ===== NEWAR · capa visual moderna para los mapas (Salta y Argentina) =====
   Solo estilo y un tooltip: no cambia datos ni lógica. Se carga después de argentina.js.
   Si algo no te gusta, borrá la línea <script src="modern.js"></script> de index.html y vuelve el diseño anterior
   (el mapa de Salta usa NXRAMP si existe y, si no, su escala de color de siempre). */
(()=>{
const CSS=`
:root{--nx-ease:cubic-bezier(.22,.9,.3,1);
 --r0:#1e4180;--r1:#2250b8;--r2:#2f7fe8;--r3:#3db8f2;--r4:#b5f0fb;--nx-acc:#38bdf8;--nx-acc2:#6366f1;--nx-sel:#fff;--nx-edge:color-mix(in srgb,var(--paper) 72%,transparent);
 --glass:color-mix(in srgb,var(--raised) 68%,transparent);--glass-b:color-mix(in srgb,var(--ink) 13%,transparent);
 --nx-sh:0 1px 0 color-mix(in srgb,var(--ink) 7%,transparent) inset,0 18px 40px -20px rgba(0,0,0,.6)}
:root[data-theme=light]{--r0:#d3e3ff;--r1:#a9c8fb;--r2:#5b93f0;--r3:#2b5cd0;--r4:#16296f;--nx-acc:#2563eb;--nx-acc2:#7c3aed;--nx-sel:#0f172a;--nx-edge:rgba(30,41,59,.30);
 --nx-sh:0 1px 0 rgba(255,255,255,.9) inset,0 18px 36px -22px rgba(30,41,59,.38)}
/* navegadores sin color-mix: colores fijos equivalentes (la rampa ya es de colores planos) */
@supports not (color:color-mix(in srgb,red,blue)){:root{--glass:rgba(28,33,39,.82);--glass-b:rgba(255,255,255,.16);--nx-edge:rgba(17,20,24,.65)}:root[data-theme=light]{--glass:rgba(255,255,255,.88);--glass-b:rgba(15,23,42,.14);--nx-edge:rgba(30,41,59,.3)}.apg path{stroke:var(--nx-edge)}}
body:has(.ar-grid),body:has(.mgrid){background:radial-gradient(1100px 520px at 88% -8%,color-mix(in srgb,var(--nx-acc) 11%,transparent),transparent 62%),radial-gradient(900px 520px at -4% 18%,color-mix(in srgb,var(--nx-acc2) 10%,transparent),transparent 60%),var(--paper)}

/* lienzo del mapa */
.ag,.mg{border-radius:20px;border:1px solid var(--glass-b);box-shadow:var(--nx-sh);
 background:radial-gradient(900px 520px at 10% -12%,color-mix(in srgb,var(--nx-acc) 15%,transparent),transparent 62%),radial-gradient(760px 520px at 100% 108%,color-mix(in srgb,var(--nx-acc2) 13%,transparent),transparent 60%),radial-gradient(color-mix(in srgb,var(--ink) 10%,transparent) 1px,transparent 1.3px) 0 0/22px 22px,var(--paper)}
.apg path,.dp{stroke:var(--nx-edge);stroke-width:.9px;stroke-opacity:1;transition:filter .2s var(--nx-ease),stroke .2s,stroke-width .2s}
.apg:hover path,.dp:hover{filter:brightness(1.16) saturate(1.12);stroke:var(--nx-acc);stroke-width:1.8px;stroke-opacity:1}
.apg.on path,.dp.on{stroke:var(--nx-sel);stroke-width:2.4px;stroke-opacity:1;filter:drop-shadow(0 0 9px color-mix(in srgb,var(--nx-acc) 75%,transparent))}
.ar-grid .apg.on2 path{stroke:var(--nx-acc2);stroke-width:2.2px}
#arl text,.dl{letter-spacing:.01em}
.agd{stroke:color-mix(in srgb,var(--ink) 40%,transparent)}

/* controles flotantes de vidrio */
.mz,.ar-tb,.ar-cap,.ar-hud{background:var(--glass);-webkit-backdrop-filter:blur(14px) saturate(1.5);backdrop-filter:blur(14px) saturate(1.5);border:1px solid var(--glass-b);box-shadow:var(--nx-sh)}
.mz{border-radius:16px;padding:.25rem;gap:.15rem;top:.7rem;right:.7rem}
.mz button,.ar-tb button,.ar-cap button{border:0;background:transparent;color:var(--ink);border-radius:11px;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;transition:background .15s,transform .12s var(--nx-ease),box-shadow .2s;cursor:pointer}
.mz button{width:2.3rem;height:2.3rem}
.mz button:hover,.ar-tb button:hover:not(:disabled),.ar-cap button:hover{background:color-mix(in srgb,var(--ink) 11%,transparent)}
.mz button:active,.ar-tb button:active:not(:disabled){transform:scale(.93)}
.mz svg,.ar-tb svg{display:block}
.ar-tb{border-radius:18px;padding:.4rem;gap:.2rem;margin:.6rem 0 0;position:relative;z-index:12}
.ar-tb button{min-width:2.35rem;height:2.35rem;padding:0 .55rem;font-weight:600;font-size:.84rem}
.ar-tb button[aria-pressed=true]:not(.sw){background:linear-gradient(135deg,var(--nx-acc2),var(--nx-acc));color:#fff;box-shadow:0 8px 18px -8px color-mix(in srgb,var(--nx-acc) 85%,transparent)}
.ar-tb .sw{width:1.55rem;min-width:1.55rem;height:1.55rem;border:2px solid color-mix(in srgb,var(--ink) 25%,transparent);transition:transform .15s var(--nx-ease)}.ar-tb .sw:hover{transform:scale(1.14)}
.ar-tb .sw[aria-pressed=true]{outline:2px solid var(--nx-acc);outline-offset:2px;border-color:var(--paper)}
.ar-tb .sep{background:var(--glass-b);margin:0 .25rem}
.ar-cap{border-radius:999px}
.ar-hud{position:absolute;left:.8rem;bottom:.8rem;z-index:3;border-radius:14px;padding:.5rem .8rem;pointer-events:none;max-width:min(24rem,70%)}
.ar-hud b{display:block;font-size:.84rem;letter-spacing:-.005em}.ar-hud em{display:block;font-style:normal;font-size:.72rem;color:var(--soft);margin-top:.05rem}
.ar-hud i{display:block;height:.42rem;border-radius:99px;margin-top:.4rem;background:linear-gradient(90deg,var(--r0),var(--r1),var(--r2),var(--r3),var(--r4))}
.ar-hud div{display:flex;justify-content:space-between;font-size:.68rem;color:var(--soft);margin-top:.15rem;font-variant-numeric:tabular-nums}

/* controles de formulario */
.ar-ctl,.mgrid .ctl{gap:.5rem}
.ar-ctl select,.ar-ctl input[type=search],.ar-ctl button,.mgrid .ctl select,.mgrid .ctl input,.mgrid .ctl button{border:1px solid var(--glass-b);border-radius:12px;background:var(--glass);color:var(--ink);padding:.55rem .85rem;font-size:.88rem;transition:border-color .15s,box-shadow .15s,background .15s}
.ar-ctl button:hover,.mgrid .ctl button:hover{background:color-mix(in srgb,var(--ink) 9%,var(--raised))}
.ar-ctl select:focus,.ar-ctl input:focus,.ar-ctl button:focus-visible,.mgrid .ctl select:focus,.mgrid .ctl input:focus,.ar-tb button:focus-visible,.mz button:focus-visible,.rr:focus-visible{outline:none;border-color:var(--nx-acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--nx-acc) 35%,transparent)}
.ar-grid .chk,.mgrid .chk{gap:.55rem;cursor:pointer}
.ar-grid .chk input[type=checkbox],.mgrid .chk input[type=checkbox]{appearance:none;-webkit-appearance:none;width:2.2rem;height:1.3rem;border-radius:99px;background:color-mix(in srgb,var(--ink) 22%,transparent);position:relative;cursor:pointer;margin:0;transition:background .2s;border:0;padding:0;flex:none}
.ar-grid .chk input[type=checkbox]::after,.mgrid .chk input[type=checkbox]::after{content:"";position:absolute;top:.15rem;left:.15rem;width:1rem;height:1rem;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:transform .22s var(--nx-ease)}
.ar-grid .chk input[type=checkbox]:checked,.mgrid .chk input[type=checkbox]:checked{background:linear-gradient(135deg,var(--nx-acc2),var(--nx-acc))}
.ar-grid .chk input[type=checkbox]:checked::after,.mgrid .chk input[type=checkbox]:checked::after{transform:translateX(.9rem)}
.ar-grid .chk input[type=checkbox]:focus-visible,.mgrid .chk input[type=checkbox]:focus-visible{outline:2px solid var(--nx-acc);outline-offset:2px}

/* leyenda */
.ar-leg{gap:.4rem}.ar-leg span{background:var(--glass);border:1px solid var(--glass-b);border-radius:99px;padding:.18rem .65rem .18rem .45rem;font-variant-numeric:tabular-nums}
.ar-leg i{border-radius:50%;border:0;width:.8rem;height:.8rem;vertical-align:-.12rem;box-shadow:0 0 0 1px color-mix(in srgb,var(--ink) 18%,transparent)}
.lgb{height:.55rem;background:linear-gradient(90deg,var(--r0),var(--r1),var(--r2),var(--r3),var(--r4));border:0;box-shadow:0 0 0 1px var(--glass-b)}

/* paneles */
.ar-side,.mside{background:linear-gradient(180deg,color-mix(in srgb,var(--raised) 90%,var(--nx-acc) 5%),var(--raised));border:1px solid var(--glass-b);border-radius:22px;box-shadow:var(--nx-sh);scrollbar-width:thin}
.ar-side .sh,.mside .sh{display:flex;align-items:center;gap:.5rem;font:700 .7rem Inter,system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 .5rem;border:0}
.ar-side .sh::before,.mside .sh::before{content:"";width:.22rem;height:.9rem;border-radius:9px;background:linear-gradient(180deg,var(--nx-acc2),var(--nx-acc))}
.ar-side .sh:first-child,.mside .sh:first-child{margin-top:.2rem}
.ar-title{font:700 1.7rem/1.15 Inter,system-ui,sans-serif;letter-spacing:-.025em;margin:.4rem 0 .15rem;background:linear-gradient(120deg,var(--ink),color-mix(in srgb,var(--ink) 55%,var(--nx-acc)));-webkit-background-clip:text;background-clip:text;color:transparent}
.ar-c,.kt{background:color-mix(in srgb,var(--paper) 62%,transparent);border:1px solid var(--glass-b);border-radius:15px;transition:transform .2s var(--nx-ease),border-color .2s,box-shadow .2s}
.ar-c:hover,.kt:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--nx-acc) 55%,transparent);box-shadow:0 10px 24px -14px color-mix(in srgb,var(--nx-acc) 70%,transparent)}
.ar-c b{font-size:1.55rem;letter-spacing:-.025em;font-weight:700}
.ar-box{border-radius:15px;background:color-mix(in srgb,var(--paper) 55%,transparent);border-color:var(--glass-b)}
.ar-bar{height:.4rem;border-radius:99px;background:color-mix(in srgb,var(--ink) 11%,transparent);margin-top:.45rem;overflow:hidden}.ar-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--nx-acc2),var(--nx-acc));transition:width .6s var(--nx-ease)}
.ar-duo{display:grid;gap:.55rem;margin:.6rem 0}.ar-duo .ar-row{display:grid;grid-template-columns:6.2rem 1fr 3.6rem;align-items:center;gap:.5rem;font-size:.8rem}.ar-duo span{color:var(--soft)}.ar-duo b{text-align:right;font-variant-numeric:tabular-nums}.ar-duo .ar-bar{margin:0}
.ar-duo .ar-row:nth-child(2) .ar-bar i{background:linear-gradient(90deg,#f59e0b,#f97316)}.ar-duo .ar-row:nth-child(3) .ar-bar i{background:linear-gradient(90deg,#ec4899,#f43f5e)}

/* ranking */
.rr{border-radius:12px;transition:background .15s,border-color .15s}.rr:hover{background:color-mix(in srgb,var(--ink) 7%,transparent)}
.rr.on{border-color:var(--nx-acc);background:color-mix(in srgb,var(--nx-acc) 12%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--nx-acc) 18%,transparent)}
.rb{height:.5rem;border-radius:99px;background:color-mix(in srgb,var(--ink) 11%,transparent)}.rb i{border-radius:99px;background:linear-gradient(90deg,var(--r1),var(--r2) 60%,var(--r3));transition:width .5s var(--nx-ease)}
.mstrip{border-radius:16px;background:var(--glass);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-color:var(--glass-b)}

/* tooltip */
.ar-leg2 label{background:var(--glass);border:1px solid var(--glass-b);border-radius:99px;padding:.25rem .35rem .25rem .6rem}.ar-leg2 i{border-radius:50%}
.ar-leg2 input,.ar-ti,.ar-side input,.ar-side select{border:1px solid var(--glass-b);border-radius:10px;background:color-mix(in srgb,var(--paper) 70%,transparent);color:var(--ink);padding:.4rem .6rem;font:inherit;font-size:.84rem}
.ar-leg2 input:focus,.ar-ti:focus,.ar-side input:focus,.ar-side select:focus{outline:none;border-color:var(--nx-acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--nx-acc) 30%,transparent)}
.ar-side button:not(.rr){border:1px solid var(--glass-b);border-radius:10px;background:var(--glass);color:var(--ink);padding:.4rem .75rem;cursor:pointer;font-size:.84rem;transition:background .15s,transform .12s}.ar-side button:not(.rr):hover{background:color-mix(in srgb,var(--ink) 10%,var(--raised))}.ar-side button:not(.rr):active{transform:scale(.96)}
/* menú «Más» de la barra */
.ar-menu{position:relative}.ar-menu>button{display:inline-flex}
.ar-pop{position:absolute;z-index:20;top:calc(100% + .4rem);right:0;min-width:15rem;padding:.35rem;border-radius:14px;background:var(--glass);-webkit-backdrop-filter:blur(18px) saturate(1.6);backdrop-filter:blur(18px) saturate(1.6);border:1px solid var(--glass-b);box-shadow:0 18px 44px -14px rgba(0,0,0,.65);display:grid;gap:.1rem}
.ar-pop[hidden]{display:none}.ar-pop button{justify-content:flex-start;width:100%;height:2.3rem;font-weight:500}.ar-pop hr{border:0;border-top:1px solid var(--glass-b);margin:.2rem 0;width:100%}
#nxtip2{position:fixed;z-index:80;pointer-events:none;min-width:9.5rem;max-width:19rem;padding:.6rem .8rem;border-radius:15px;background:var(--glass);-webkit-backdrop-filter:blur(18px) saturate(1.6);backdrop-filter:blur(18px) saturate(1.6);border:1px solid var(--glass-b);box-shadow:0 16px 42px -14px rgba(0,0,0,.65);opacity:0;transform:translateY(5px) scale(.98);transition:opacity .12s,transform .14s var(--nx-ease)}
#nxtip2.on{opacity:1;transform:none}
#nxtip2 b{display:block;font-size:.78rem;color:var(--soft);font-weight:600;margin-bottom:.1rem}#nxtip2 strong{display:block;font-size:1.3rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.2}#nxtip2 small{display:block;color:var(--soft);font-size:.74rem;margin-top:.25rem;line-height:1.35}

/* movimiento (solo si la persona no pidió menos) */
@keyframes nxIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
@keyframes nxUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:no-preference){
 .ag.anim .apg{animation:nxIn .65s var(--nx-ease) both;animation-delay:calc(var(--i,0)*22ms)}
 .ar-side.nx-swap>*{animation:nxUp .42s var(--nx-ease) both}.ar-side.nx-swap>*:nth-child(2){animation-delay:.04s}.ar-side.nx-swap>*:nth-child(3){animation-delay:.08s}.ar-side.nx-swap>*:nth-child(4){animation-delay:.12s}.ar-side.nx-swap>*:nth-child(5){animation-delay:.16s}.ar-side.nx-swap>*:nth-child(n+6){animation-delay:.2s}
 .ar-grid.fs .ar-side{transition:transform .32s var(--nx-ease)}
}
@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
@media print{.mz,.ar-tb,.ar-hud,#nxtip2{display:none!important}}
`;
if(!document.getElementById('nx-modern')){const s=document.createElement('style');s.id='nx-modern';s.textContent=CSS;document.head.appendChild(s)}

/* rampa de color de 5 paradas (0 a 1), compartida por los dos mapas */
window.NXRAMP=v=>{v=Math.max(0,Math.min(1,+v||0));const x=v*4,i=Math.min(3,Math.floor(x)),t=Math.round((x-i)*100);return`color-mix(in srgb, var(--r${i+1}) ${t}%, var(--r${i}))`};

/* tooltip con nombre, valor y contexto (reemplaza el cartel nativo de <title>) */
const tip=document.createElement('div');tip.id='nxtip2';tip.setAttribute('aria-hidden','true');document.body.appendChild(tip);
const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const info=el=>{
 if(el.dataset&&el.dataset.nxT)return{t:el.dataset.nxT,v:el.dataset.nxV||'',s:el.dataset.nxS||''};
 const l=el.getAttribute('aria-label')||'';const i=l.indexOf(': ');return i<0?{t:l,v:'',s:''}:{t:l.slice(0,i),v:'',s:l.slice(i+2)}};
const hide=()=>tip.classList.remove('on');
document.addEventListener('pointermove',ev=>{
 if(ev.pointerType==='touch'){hide();return}
 const el=ev.target.closest&&ev.target.closest('.apg,.dp');if(!el){hide();return}
 const d=info(el);if(!d.t){hide();return}
 tip.innerHTML=`<b>${e(d.t)}</b>${d.v?`<strong>${e(d.v)}</strong>`:''}${d.s?`<small>${e(d.s)}</small>`:''}`;tip.classList.add('on');
 const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(ev.clientX+16,innerWidth-w-8))+'px';tip.style.top=Math.max(8,Math.min(ev.clientY+18,innerHeight-h-8))+'px'});
document.addEventListener('pointerleave',hide,true);document.addEventListener('scroll',hide,true);document.addEventListener('pointerdown',hide,true);
/* los carteles nativos se quitan para que no se encimen con este */
let raf=0;const strip=()=>{raf=0;document.querySelectorAll('.apg > title,.dp > title').forEach(t=>t.remove())};
new MutationObserver(()=>{if(!raf)raf=requestAnimationFrame(strip)}).observe(document.body,{childList:true,subtree:true});strip();
})();
