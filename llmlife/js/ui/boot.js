/* ================================================================
   LLMLife · 事件与启动 (ui/boot.js)
   bindUI() 挂事件, boot() 启动; 由 main.js 按序调用
   ================================================================ */
import { NOTICES, RARITY } from "../config.js";
import { S, $, save, pick } from "../state.js";
import { SFX, toast, setMuted, toggleMute } from "../fx.js";
import { applySkin } from "../skins.js";
import { go } from "./router.js";
import { initLiving, handleUseItem, handleSlotAction, handleEndDay, handleConfirmEndDay, handleRestartAsk, handleConfirmReset } from "./living.js";
import { showModal, closeModal, welcomeHTML, helpHTML, ratesHTML, dexHTML, skinPickerHTML, handleModalAction, showEnding } from "./modals.js";
import { tryPull, acceptHalluc } from "./gacha.js";

/* ---------- 事件绑定 ---------- */
export function bindUI(){
  $('btn-rates').onclick = ()=>{ SFX.click(); showModal(ratesHTML()); };
  $('btn-dex').onclick = ()=>{ SFX.click(); dexHTML(); };
  $('btn-help').onclick = ()=>{ SFX.click(); showModal(helpHTML()); };
  $('btn-skin').onclick = ()=>{ SFX.click(); skinPickerHTML(); };
  $('btn-mute').onclick = ()=>{ toggleMuteUI(); };
  $('btn-restart').onclick = ()=>{ SFX.click(); handleRestartAsk(); };
  $('btn-end-day').onclick = ()=>{ SFX.click(); handleEndDay(); };

  // 弹窗/卡片内按钮委托: 成就分享、随行编排、道具使用、重开、皮肤
  document.addEventListener('click', e=>{
    const pullEl = e.target.closest ? e.target.closest('[data-pull]') : null;
    if(pullEl){ SFX.click(); tryPull(pullEl.dataset.pull, Number(pullEl.dataset.n)); return; }
    const el = e.target.closest ? e.target.closest('[data-act]') : null;
    if(el){
      if(el.dataset.act === 'accept-halluc'){ acceptHalluc(); return; }
      if(el.dataset.act === 'close-modal'){ SFX.click(); closeModal(); return; }
      if(el.dataset.act === 'confirm-end-day'){ handleConfirmEndDay(); return; }
      if(el.dataset.act === 'confirm-reset'){ handleConfirmReset(); return; }
      if(el.dataset.act === 'slot'){ handleSlotAction(el.dataset.slot, el.dataset.uid); return; }
      if(el.dataset.act === 'use-item'){ SFX.click(); handleUseItem(el.dataset.item); return; }
      if(handleModalAction(el)) return;
    }
    // 生活页/伙伴页空槽 → 去伙伴页编排
    const slotBox = e.target.closest ? e.target.closest('[data-slot-open]') : null;
    if(slotBox){ SFX.click(); go('partners'); return; }
    if(e.target.id === 'btn-reset'){
      localStorage.removeItem('llmlife_v1');
      location.reload();
    }
  });
}
function toggleMuteUI(){
  const m = toggleMute(); S.flags.muted = m; save();
  $('btn-mute').innerHTML = m ? '🔇<span class="lbl"> 静音</span>' : '🔊<span class="lbl"> 音效</span>';
  if(m) toast('🔇 已静音'); else toast('🔊 音效已开启');
}

/* ---------- 启动（由 main.js 在所有模块加载后调用） ---------- */
export function boot(){
  // RARITY 色值同步到 CSS 变量（单源）
  try{
    const root = document.documentElement.style;
    for(const [k,v] of Object.entries(RARITY)) root.setProperty('--'+k, v.hex);
  }catch(e){}
  applySkin(S.skin);
  setMuted(!!S.flags.muted);
  $('btn-mute').innerHTML = S.flags.muted ? '🔇<span class="lbl"> 静音</span>' : '🔊<span class="lbl"> 音效</span>';
  const notice = $('notice-text'); if(notice) notice.textContent = pick(NOTICES);
  const notice2 = $('notice-text2'); if(notice2) notice2.textContent = pick(NOTICES);
  go(location.hash.slice(1) || 'life');
  if(!S.flags.welcomed){ showModal(welcomeHTML(), true); }
  else if(S.ending){ setTimeout(()=>showEnding(S.ending), 300); }
}
