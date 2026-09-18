/* ================================================================
   LLMLife · 周目标引擎 (goals.js)
   每周初抽 2 条目标 → 行动计数推进 → 达成自动发奖（toast 行回传）
   数据源 GOAL_POOL（config），行动计数 S.life.weekStats（state 单源）
   ================================================================ */
import { GOAL_POOL, LIFE } from "./config.js";
import { S, save, freshWeekStats } from "./state.js";
import { addAttrs } from "./items.js";
import { favorAll } from "./partners.js";

/** 周序号：每 7 个游戏日一周（周结算节拍） */
export function weekOf(day = S.life.day){ return Math.floor((day - 1) / LIFE.WEEK_DAYS); }

/** 周切换检测：新的一周 → 重抽目标、清零计数（返回 true 表示换周） */
export function ensureWeek(){
  const wk = weekOf();
  if(S.life.goals && S.life.goals.wk === wk) return false;
  S.life.weekStats = freshWeekStats();
  const pool = GOAL_POOL.filter(g => (g.minTier || 0) <= S.life.tier);
  const items = [];
  const cands = pool.slice();
  while(items.length < 2 && cands.length){
    const i = Math.floor(Math.random() * cands.length);
    items.push({ id: cands.splice(i, 1)[0].id, done: false });
  }
  S.life.goals = { wk, items };
  save();
  return true;
}

export function goalOf(id){ return GOAL_POOL.find(g => g.id === id); }
/** 单条目标进度 0~1 */
export function goalProg(goalItem){
  const g = goalOf(goalItem.id);
  if(!g) return 0;
  const cur = (S.life.weekStats || {})[g.stat] || 0;
  return Math.min(1, cur / g.target);
}

/** 奖励文本（渲染与 toast 共用） */
export function rewardText(r){
  const parts = [];
  if(r.money) parts.push(`¥${r.money}`);
  if(r.skill) parts.push(`技术+${r.skill}`);
  if(r.charm) parts.push(`魅力+${r.charm}`);
  if(r.mood) parts.push(`心情+${r.mood}`);
  if(r.staminaMax) parts.push(`体力上限+${r.staminaMax}`);
  if(r.favor) parts.push(`随行好感+${r.favor}`);
  if(r.freePull) parts.push(`免费抽券×${r.freePull}`);
  if(r.skinTicket) parts.push(`皮肤券×${r.skinTicket}`);
  return parts.join(' · ');
}

/** 发放一份奖励 */
function applyReward(r){
  if(r.money) S.money += r.money;
  if(r.freePull) S.freePulls += r.freePull;
  if(r.skinTicket) S.skinTickets += r.skinTicket;
  if(r.favor) favorAll(r.favor);
  addAttrs({ skill:r.skill||0, charm:r.charm||0, mood:r.mood||0, staminaMax:r.staminaMax||0 });
}

/** 检查新达成的目标并发奖；返回文案行（供 doAction lines / toast） */
export function checkGoals(){
  const lines = [];
  const gs = S.life.goals;
  if(!gs) return lines;
  let changed = false;
  for(const item of gs.items){
    if(item.done) continue;
    if(goalProg(item) >= 1){
      item.done = true; changed = true;
      const g = goalOf(item.id);
      applyReward(g.reward);
      lines.push(`🎯 周目标「${g.label}」达成 → ${rewardText(g.reward)}`);
    }
  }
  if(changed) save();
  return lines;
}
