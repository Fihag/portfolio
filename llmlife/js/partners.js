/* ================================================================
   LLMLife · 伙伴层 (partners.js)
   伙伴招募 / 重复折好感 / 好感等级 / 随行槽加成汇总
   效果类型由厂商决定（config.VENDOR_EFFECTS），强度由稀有度决定
   ================================================================ */
import { MMAP, RBOOST, VENDOR_EFFECTS, DEFAULT_EFFECT, FAVOR_LEVELS, FAVOR_MULT, DUPE_FAVOR, SLOT_COUNT, RORDER } from "./config.js";
import { S } from "./state.js";

/** 模型的效果类型 */
export function effectOf(m){ return VENDOR_EFFECTS[m.vendor] || DEFAULT_EFFECT; }

/** 好感等级 0/1/2 */
export function favorLevel(p){
  let lv = 0;
  for(let i=0;i<FAVOR_LEVELS.length;i++) if(p.favor >= FAVOR_LEVELS[i]) lv = i;
  return lv;
}
export function favorLevelMax(){ return FAVOR_LEVELS.length - 1; }
/** 升到下一级所需好感（已满级返回 null） */
export function favorNext(p){
  const lv = favorLevel(p);
  return lv >= favorLevelMax() ? null : FAVOR_LEVELS[lv+1];
}

/** 单伙伴裸强度（稀有度基础 × 好感系数） */
export function boostOf(p){
  const m = MMAP[p.m];
  return RBOOST[m.r] * FAVOR_MULT[favorLevel(p)];
}

/** 随行中的伙伴实例 */
export function activePartners(){
  return S.slots
    .map(uid => S.partners.find(p => p.uid === uid))
    .filter(Boolean);
}

/**
 * 有效体力上限 = 基础上限（健身成长）+ 随行伙伴加成（实时计算，
 * 编队/好感变化即时生效）。所有体力钳制必须用本函数而非裸读状态。
 */
export function staminaCeiling(){
  return S.life.staminaMax + slotBoosts().staminaMax;
}

/**
 * 随行伙伴加成合计
 * @returns {{work:number, learn:number, mood:number, charm:number, staminaMax:number}}
 *   work/learn/mood/charm 为加成小数（0.3 = +30%），staminaMax 为绝对值加成
 */
export function slotBoosts(){
  const acc = {work:0, learn:0, mood:0, charm:0, staminaMax:0};
  for(const p of activePartners()){
    const m = MMAP[p.m];
    const b = boostOf(p);
    const eff = effectOf(m);
    if(eff === 'dual'){ acc.work += b*.6; acc.learn += b*.6; }
    else if(eff === 'stamina'){ acc.staminaMax += b*40; }
    else acc[eff] += b;
  }
  return acc;
}

/** 招募伙伴（抽卡出货入口）：重复自动折算好感 */
export function recruit(modelId){
  const owned = S.partners.find(p => p.m === modelId);
  if(owned){
    owned.favor += DUPE_FAVOR;
    return {partner:owned, dupe:true, favor:DUPE_FAVOR};
  }
  const p = {uid:S.uid++, m:modelId, favor:0, stars:0};
  S.partners.push(p);
  return {partner:p, dupe:false, favor:0};
}

/** 随行编排（uid=null 清空槽位） */
export function setSlot(slotIdx, uid){
  if(slotIdx < 0 || slotIdx >= SLOT_COUNT) return false;
  if(uid != null){
    if(!S.partners.some(p => p.uid === uid)) return false;
    const prev = S.slots.indexOf(uid);
    if(prev >= 0) S.slots[prev] = null; // 已在别的槽位则先移出
  }
  S.slots[slotIdx] = uid;
  return true;
}

/** 全体随行伙伴加好感（社交/礼物） */
export function favorAll(amount){
  for(const p of activePartners()) p.favor += amount;
}

/** 最佳伙伴（图鉴/统计用） */
export function bestPartner(){
  let best = null;
  for(const p of S.partners){
    const m = MMAP[p.m];
    if(!best){
      best = p; continue;
    }
    const b = MMAP[best.m];
    const d = RORDER.indexOf(m.r) - RORDER.indexOf(b.r);
    if(d > 0 || (d === 0 && m.idx > b.idx)) best = p;
  }
  return best;
}
