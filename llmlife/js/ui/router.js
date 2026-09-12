/* ================================================================
   LLMLife · 路由 (ui/router.js)
   ================================================================ */
import { $ } from "../state.js";
import { SFX } from "../fx.js";
import { renderAll } from "./render.js";

/* ---------- 路由 ---------- */
export const PAGES=['life','partners','gacha','bag','data'];
export function go(page){
  if(!PAGES.includes(page)) page='life';
  for(const p of PAGES){
    const el=$('page-'+p);
    if(!el) continue;
    el.classList.toggle('active', p===page);
    el.setAttribute('aria-hidden', p===page ? 'false' : 'true');
  }
  document.querySelectorAll('.top-nav button').forEach(b=>{
    const on=b.dataset.page===page;
    b.classList.toggle('active', on);
    if(on) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  if(location.hash!=='#'+page) history.replaceState(null,'','#'+page);
  if(window.llTrack) window.llTrack('nav', {page});
  renderAll();
}
// 顶部导航点击 / hash 直链（由 main.js 在启动时调用一次）
export function initRouter(){
  document.querySelectorAll('.top-nav button').forEach(b=>b.onclick=()=>{ SFX.click(); go(b.dataset.page); });
  addEventListener('hashchange',()=>go(location.hash.slice(1)));
}
