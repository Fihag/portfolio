/* ================================================================
   LLMLife · 埋点 (track.js)
   极简埋点：控制台可见；配置 LL_CF_TOKEN 后转发 Cloudflare Web Analytics
   自定义事件（beacon 动态注入，无 token 时零网络请求）
   ================================================================ */
import { LL_CF_TOKEN } from "./config.js";

let beaconInjected = false;
function injectBeacon(){
  if(beaconInjected || !LL_CF_TOKEN || typeof document==='undefined') return;
  beaconInjected = true;
  const s=document.createElement('script');
  s.defer=true;
  s.src='https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: LL_CF_TOKEN, spa: false }));
  document.head.appendChild(s);
}
function reportCustom(name){
  try{
    const b=window.beacon;
    if(b && typeof b.report==='function') b.report({ name });
  }catch(e){}
}

export function initTrack(){
  window.llTrack = function(evt, data){
    try{
      console.debug('[LL]', evt, data||'');
    }catch(e){}
    if(!LL_CF_TOKEN) return;
    injectBeacon();
    reportCustom('ll_'+evt);
  };
  window.llTrack('page_view', { hash: location.hash || '#life' });
  window.addEventListener('hashchange', () => window.llTrack('nav', { hash: location.hash }));
}
