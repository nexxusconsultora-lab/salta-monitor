/* ===== NEWAR · Pantalla completa para gráficos y retoques visuales =====
   Agrega un botón «Pantalla completa» (y la tecla F) a los gráficos de Estadísticas, al generador de gráficos,
   al hemiciclo y al Briefing. Los mapas con zoom (Mapas, Argentina, Red de relaciones, Conexiones) ya tienen
   el suyo y no se tocan. Sólo cambia cómo se ve y se agranda; no toca ningún dato.
   Se carga al final (después de briefing.js). */
(()=>{
const SEL='svg.ch, svg.hem, #gsvg, #gout svg, #brf';
const CSS=`
.vbar{display:flex;justify-content:flex-end;margin:.2rem 0 -.2rem}
.vfsb{font:inherit;font-size:.78rem;letter-spacing:.04em;border:1px solid var(--line);background:var(--raised);color:var(--soft);padding:.25rem .65rem;cursor:pointer;min-height:2rem}
.vfs-on::before,.vfs-on::after{display:none!important}
.vfsb:hover{color:var(--ink);border-color:var(--clay)}.vfsb:focus-visible{outline:2px solid var(--clay);outline-offset:2px}
.vfs-on{position:fixed!important;inset:0!important;z-index:2147483000!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;background:var(--paper,#0b0f14)!important;background-image:none!important;border:0!important;overflow:auto;padding:3.6rem 1rem 1rem;box-sizing:border-box}
svg.vfs-on{object-fit:contain}
#vfsx{position:fixed;top:.7rem;right:.7rem;z-index:2147483600;font:inherit;border:1px solid var(--clay);background:var(--raised);color:var(--ink);padding:.5rem .9rem;cursor:pointer;min-height:2.6rem;font-weight:600}
#vfsx:focus-visible{outline:2px solid var(--clay);outline-offset:2px}
svg.ch rect{rx:2px}svg.ch text{font-variant-numeric:tabular-nums}
body.vfs-body :is(nav.top,#tabs,#up,#nbfab,#nvfab,#hudbar,#toast,#tip,#nxtip2,.ticker,#live){display:none!important}
@media print{.vbar,#vfsx{display:none}}`;
const st=document.createElement('style');st.id='vfs-css';st.textContent=CSS;document.head.appendChild(st);
let ON=null,SCR='',HOV=null;
const ex=()=>{if(!ON)return;ON.classList.remove('vfs-on');document.body.classList.remove('vfs-body');ON=null;document.body.style.overflow=SCR;const x=document.getElementById('vfsx');if(x)x.remove();
 try{if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch(e){}};
const en=el=>{if(!el)return;if(ON)ex();ON=el;SCR=document.body.style.overflow;document.body.style.overflow='hidden';el.classList.add('vfs-on');document.body.classList.add('vfs-body');
 const x=document.createElement('button');x.id='vfsx';x.type='button';x.textContent='✕ Salir (Esc o F)';x.addEventListener('click',ex);document.body.appendChild(x);x.focus({preventScroll:true});
 try{if(document.documentElement.requestFullscreen&&!document.fullscreenElement){const p=document.documentElement.requestFullscreen();if(p&&p.catch)p.catch(()=>{})}}catch(e){}};
const targets=()=>[...document.querySelectorAll('#app '+SEL.split(', ').join(', #app '))].filter(e=>e.getBoundingClientRect().width>0);
const marca=()=>{
 document.querySelectorAll('#app '+SEL.split(', ').join(', #app ')).forEach(el=>{
  if(el.dataset.vfs)return;el.dataset.vfs='1';
  const w=document.createElement('div');w.className='vbar';w.innerHTML='<button type="button" class="vfsb" aria-label="Ver en pantalla completa (tecla F)">⛶ Pantalla completa (F)</button>';
  w.firstChild.addEventListener('click',()=>{ON===el?ex():en(el)});
  el.parentNode.insertBefore(w,el);
  el.addEventListener('pointerenter',()=>{HOV=el});
 });
};
let tm=null;const prog=()=>{clearTimeout(tm);tm=setTimeout(marca,120)};
const app=document.getElementById('app');
if(app){new MutationObserver(prog).observe(app,{childList:true,subtree:true})}
window.addEventListener('hashchange',()=>{ex();HOV=null;prog()});
prog();
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const t=e.target,tn=t&&t.tagName;if(/INPUT|SELECT|TEXTAREA/.test(tn||'')||(t&&t.isContentEditable))return;
 if(e.key==='Escape'&&ON){e.preventDefault();ex();return}
 if(e.key==='f'||e.key==='F'){
  if(t&&t.closest&&t.closest('.pzw,.nxc,.mgrid'))return;      // los mapas con zoom y Conexiones tienen su propia tecla F
  if(ON){e.preventDefault();ex();return}
  const l=targets();if(!l.length)return;
  const vis=l.find(x=>{const r=x.getBoundingClientRect();return r.top<innerHeight*.7&&r.bottom>innerHeight*.2});
  const el=(HOV&&HOV.isConnected&&l.includes(HOV)?HOV:null)||vis||l[0];e.preventDefault();en(el)}
});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&ON)ex()});
})();
