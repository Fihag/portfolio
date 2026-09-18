/* ================================================================
   LLMLife · 经济层 (economy.js)
   打工事件参数单一数据源：概率与倍率只在此定义，
   sampleWorkPay(life.js) 据此抽样、expectedWorkPay 据此求期望、
   单测直接 import 断言两者同源。
   梯度按 v4.3 重标后的技能值域 0~100 线性标定。
   第 4 参 opts 为工作类行动修正：tierMult 职级倍率 / workMult 行动倍率 /
   riskMul 事故放大（加班冲刺、外包大单等高收益卡用）。
   ================================================================ */
import { LIFE, PAY_BOOST, skillMult, moodMult, DISASTER_FLOOR, EXAM } from "./config.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 打工事件参数（skill 0~100; mood 仅影响低心情惩罚; riskMul 放大事故概率）
 * @param {number} skill
 * @param {number} [mood]
 * @param {number} [riskMul]
 */
export function payoutParams(skill, mood, riskMul = 1){
  const lowMood = (mood==null ? 70 : mood) < LIFE.MOOD_LOW;
  return {
    pGreat: .02 + Math.max(0, skill) * .0009,                       // 技术越高大成功越多
    pRework: Math.min(.3, Math.max(.04, .25 - Math.max(0, skill) * .0021) + (lowMood ? .05 : 0)),
    // 事故下限：技术到顶也不再归零，riskMul 永远有效（加班/大单的代价不能白送）
    pDisaster: clamp(Math.max(DISASTER_FLOOR, (20 - Math.max(0, skill)) / 1000) * riskMul + (lowMood ? .01 : 0), 0, .1),
    mult: { great: 2.5, rework: .4 },
    okRange: [.85, 1.15],          // ok 事件随机区间（期望取中点 1.0）
    disasterPenalty: 50 * PAY_BOOST * riskMul,
    boost: PAY_BOOST,
  };
}

/** 工作类行动的成功率（拿到正常及以上结果的概率；行动卡公示用，与抽样同源） */
export function workSuccessRate(skill, mood, riskMul = 1){
  const {pRework, pDisaster} = payoutParams(skill, mood, riskMul);
  return clamp(1 - pRework - pDisaster, 0, 1);
}

/** 考证通过率：技能是硬底（0.35~0.95），心情低落再打点折（考试/面试的等价物） */
export function examRate(skill, mood){
  const lowMood = (mood==null ? 70 : mood) < LIFE.MOOD_LOW;
  return clamp(EXAM.base + Math.max(0, skill) * EXAM.perSkill - (lowMood ? EXAM.lowMoodPen : 0), EXAM.min, EXAM.max);
}

/**
 * 单次打工的基础价（未含事件倍率）：基础单价 × 技术系数 × 心情系数 × 伙伴加成 × 职级倍率 × 行动倍率
 * @param {number} skill
 * @param {number} mood
 * @param {number} [workBoost] 伙伴收入加成小数（0.3 = +30%）
 * @param {number} [mult] 职级×行动复合倍率
 */
export function workBasePay(skill, mood, workBoost, mult = 1){
  return LIFE.WORK_BASE * skillMult(skill) * moodMult(mood) * (1 + (workBoost||0)) * mult;
}

/**
 * 各事件的固定结算额（ok 取区间中点）。
 * 期望 = Σ p_e × amt_e，由 expectedWorkPay 保证与抽样公式同源。
 */
export function workPayEvents(skill, mood, workBoost, mult = 1, riskMul = 1){
  const base = workBasePay(skill, mood, workBoost, mult);
  const {mult: evMult, okRange, disasterPenalty, boost} = payoutParams(skill, mood, riskMul);
  return {
    ok:       base * ((okRange[0]+okRange[1])/2) * boost,
    great:    base * evMult.great * boost,
    rework:   base * evMult.rework * boost,
    disaster: -disasterPenalty,
  };
}

/** 单次打工期望收益（与 sampleWorkPay 抽样同源） */
export function expectedWorkPay(skill, mood, workBoost, mult = 1, riskMul = 1){
  const {pGreat, pRework, pDisaster} = payoutParams(skill, mood, riskMul);
  const ev = workPayEvents(skill, mood, workBoost, mult, riskMul);
  const pOk = Math.max(0, 1 - pGreat - pRework - pDisaster);
  return pOk*ev.ok + pGreat*ev.great + pRework*ev.rework + pDisaster*ev.disaster;
}

/** 抽样一次打工结算（life.js 工作类行动调用） */
export function sampleWorkPay(skill, mood, workBoost, opts = {}){
  const {mult = 1, riskMul = 1} = opts;
  const {pGreat, pRework, pDisaster, mult: evMult, okRange, disasterPenalty, boost} = payoutParams(skill, mood, riskMul);
  const base = workBasePay(skill, mood, workBoost, mult);
  const roll = Math.random();
  if(roll < pDisaster) return {amt:-disasterPenalty, evt:'disaster'};
  if(roll < pDisaster + pRework) return {amt:base*evMult.rework*boost, evt:'rework'};
  if(roll > 1 - pGreat) return {amt:base*evMult.great*boost, evt:'great'};
  return {amt:base*(okRange[0]+Math.random()*(okRange[1]-okRange[0]))*boost, evt:'ok'};
}
