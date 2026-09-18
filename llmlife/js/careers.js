/* ================================================================
   LLMLife · 职业层 (careers.js)
   职级门槛判定 / 晋升与沉淀 / 净资产口径 / 收入倍率
   晋升只在年度结算时发生（living.js 弹窗驱动），此处纯逻辑
   ================================================================ */
import { CAREERS, ACTIONS, assetsOf } from "./config.js";
import { S, save } from "./state.js";
import { addAttrs } from "./items.js";

export function careerOf(tier = S.life.tier){ return CAREERS[Math.min(Math.max(tier,0), CAREERS.length-1)]; }
/** 工作类收入职级倍率 */
export function tierMult(){ return careerOf().mult; }

/** 净资产（现金 + 持仓市值 + 房产×0.7，与结局综合分同源口径） */
export function netWorth(){ return assetsOf(S); }

/** 指定职级晋升门槛是否全部达成 */
export function meetsReq(tier){
  const c = CAREERS[tier];
  if(!c) return false;
  const r = c.req || {};
  if((r.skill||0) > S.life.attrs.skill) return false;
  if((r.charm||0) > S.life.attrs.charm) return false;
  if((r.net||0) > netWorth()) return false;
  return true;
}

/** 晋升门槛展示文本（✓/✗ 现状），年度结算弹窗用 */
export function reqText(tier){
  const c = CAREERS[tier];
  if(!c || !c.req) return '';
  const parts = [];
  for(const [k, v] of Object.entries(c.req)){
    const now = k==='skill' ? Math.round(S.life.attrs.skill)
      : k==='charm' ? Math.round(S.life.attrs.charm)
      : Math.round(netWorth());
    parts.push(`${k==='skill'?'技术':k==='charm'?'魅力':'净资产'} ${v>now?`${now}/${v}✗`:`${v}✓`}`);
  }
  return parts.join(' · ');
}

/** 接受晋升（年度结算选择） */
export function tryPromote(){
  const next = S.life.tier + 1;
  if(next >= CAREERS.length) return {ok:false, line:'已是最高职级'};
  if(!meetsReq(next)) return {ok:false, line:'晋升条件未达成'};
  S.life.tier = next;
  save();
  const unlocked = ACTIONS.filter(a => a.tier === next).map(a => `${a.icon}${a.name}`);
  return {ok:true, line:`🎉 晋升「${CAREERS[next].name}」！工作类收入 ×${CAREERS[next].mult}${unlocked.length ? `，解锁新行动：${unlocked.join('、')}` : ''}`};
}

/** 拒绝晋升、再沉淀一年 */
export function stayPut(){
  addAttrs({skill:3, mood:10});
  save();
  return {ok:true, line:'🍵 再沉淀一年：技术 +3，心情 +10'};
}
