/* ================================================================
   LLMLife · 皮肤层 (skins.js)
   CSS 变量切换主题 / 抽卡掉落 hook（pulls.js 调用）
   ================================================================ */
import { SKINS, SKIN_DROP_RATE } from "./config.js";
import { S, save } from "./state.js";

export function applySkin(id){
  const sk = SKINS.find(s => s.id === id) || SKINS[0];
  const root = document.documentElement.style;
  // 先重置为主题外所有已注册变量，避免主题间残留
  for(const other of SKINS){
    for(const k of Object.keys(other.vars||{})) root.removeProperty(k);
  }
  for(const [k,v] of Object.entries(sk.vars||{})) root.setProperty(k,v);
  S.skin = sk.id;
}
export function ownSkin(id){
  if(S.skinsOwned.includes(id)) return false;
  S.skinsOwned.push(id);
  return true;
}
/** 抽卡皮肤掉落 hook：SSR+ 出货时 1.5% 掉皮肤券（由 pulls.js 调用） */
export function rollSkinDrop(results){
  const hasHigh = (results||[]).some(r => ['SSR','UR','UTR','NB'].includes(r.rarity));
  if(!hasHigh || Math.random() >= SKIN_DROP_RATE) return false;
  S.skinTickets++;
  save();
  return true;
}
