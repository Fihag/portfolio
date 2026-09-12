/* ================================================================
   LLMLife · 经济层 (economy.js)
   打工事件参数单一数据源：概率与倍率只在此定义，
   sampleWorkPay(life.js) 据此抽样、expectedWorkPay 据此求期望、
   单测直接 import 断言两者同源。
   梯度按 v4.3 重标后的技能值域 0~100 线性标定。
   ================================================================ */
import { LIFE, PAY_BOOST, skillMult, moodMult } from "./config.js";

/**
 * 打工事件参数（skill 0~100; mood 仅影响低心情惩罚）
 * @param {number} skill
 * @param {number} [mood]
 */
export function payoutParams(skill, mood){
  const lowMood = (mood==null ? 70 : mood) < LIFE.MOOD_LOW;
  return {
    pGreat: .02 + Math.max(0, skill) * .0009,                       // 技术越高大成功越多
    pRework: Math.min(.3, Math.max(.04, .25 - Math.max(0, skill) * .0021) + (lowMood ? .05 : 0)),
    pDisaster: Math.min(.03, Math.max(0, (20 - Math.max(0, skill)) / 1000) + (lowMood ? .01 : 0)),
    mult: { great: 2.5, rework: .4 },
    okRange: [.85, 1.15],          // ok 事件随机区间（期望取中点 1.0）
    disasterPenalty: 50 * PAY_BOOST,
    boost: PAY_BOOST,
  };
}

/**
 * 单次打工的基础价（未含事件倍率）：基础单价 × 技术系数 × 心情系数 × 伙伴加成
 * @param {number} skill
 * @param {number} mood
 * @param {number} [workBoost] 伙伴收入加成小数（0.3 = +30%）
 */
export function workBasePay(skill, mood, workBoost){
  return LIFE.WORK_BASE * skillMult(skill) * moodMult(mood) * (1 + (workBoost||0));
}

/**
 * 各事件的固定结算额（ok 取区间中点）。
 * 期望 = Σ p_e × amt_e，由 expectedWorkPay 保证与抽样公式同源。
 */
export function workPayEvents(skill, mood, workBoost){
  const base = workBasePay(skill, mood, workBoost);
  const {mult, okRange, disasterPenalty, boost} = payoutParams(skill, mood);
  return {
    ok:       base * ((okRange[0]+okRange[1])/2) * boost,
    great:    base * mult.great * boost,
    rework:   base * mult.rework * boost,
    disaster: -disasterPenalty,
  };
}

/** 单次打工期望收益（与 sampleWorkPay 抽样同源） */
export function expectedWorkPay(skill, mood, workBoost){
  const {pGreat, pRework, pDisaster} = payoutParams(skill, mood);
  const ev = workPayEvents(skill, mood, workBoost);
  const pOk = Math.max(0, 1 - pGreat - pRework - pDisaster);
  return pOk*ev.ok + pGreat*ev.great + pRework*ev.rework + pDisaster*ev.disaster;
}

/** 抽样一次打工结算（life.js doAction('work') 调用） */
export function sampleWorkPay(skill, mood, workBoost){
  const {pGreat, pRework, pDisaster, mult, okRange, disasterPenalty, boost} = payoutParams(skill, mood);
  const base = workBasePay(skill, mood, workBoost);
  const roll = Math.random();
  if(roll < pDisaster) return {amt:-disasterPenalty, evt:'disaster'};
  if(roll < pDisaster + pRework) return {amt:base*mult.rework*boost, evt:'rework'};
  if(roll > 1 - pGreat) return {amt:base*mult.great*boost, evt:'great'};
  return {amt:base*(okRange[0]+Math.random()*(okRange[1]-okRange[0]))*boost, evt:'ok'};
}
