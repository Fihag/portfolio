import { describe, it, expect, beforeEach } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { weekOf, ensureWeek, goalOf, goalProg, checkGoals, rewardText } from "../js/goals.js";
import { doAction } from "../js/life.js";
import { doPulls } from "../js/pulls.js";
import { addItem, useItem } from "../js/items.js";
import { GOAL_POOL, LIFE, PROBS } from "../js/config.js";

function fresh(){ setState(defaultState()); return S; }

describe("周目标引擎", () => {
  beforeEach(fresh);

  it("weekOf：每 7 个游戏日一周", () => {
    expect(weekOf(1)).toBe(0);
    expect(weekOf(7)).toBe(0);
    expect(weekOf(8)).toBe(1);
    expect(weekOf(14)).toBe(1);
    expect(weekOf(15)).toBe(2);
  });

  it("周初抽两条互异目标，同周幂等不重抽", () => {
    expect(ensureWeek()).toBe(true);
    expect(S.life.goals.items.length).toBe(2);
    expect(new Set(S.life.goals.items.map(i => i.id)).size).toBe(2);
    expect(S.life.goals.wk).toBe(0);
    expect(ensureWeek()).toBe(false); // 同周直接跳过
  });

  it("minTier 门槛：实习生永远抽不到高职级专属目标", () => {
    for(let k = 0; k < 300; k++){
      S.life.goals = null;
      ensureWeek();
      for(const item of S.life.goals.items){
        expect(goalOf(item.id).minTier || 0).toBe(0);
      }
    }
    S.life.tier = 2;
    let sawGated = false;
    for(let k = 0; k < 300; k++){
      S.life.goals = null;
      ensureWeek();
      if(S.life.goals.items.some(i => (goalOf(i.id).minTier || 0) > 0)) sawGated = true;
    }
    expect(sawGated).toBe(true); // 骨干后门槛目标进入池子
  });

  it("换周清零行动计数", () => {
    S.life.weekStats.learn = 4;
    S.life.day = 8; // 第二周
    ensureWeek();
    expect(S.life.weekStats.learn).toBe(0);
    expect(S.life.goals.wk).toBe(1);
  });

  it("行动推进进度，达成自动发奖且只发一次", () => {
    PROBS.EVENT = 0;
    S.life.goals = { wk: weekOf(), items: [{ id: "g_learn5", done: false }] };
    for(let i = 0; i < 4; i++){
      S.life.attrs.stamina = 100;
      doAction("learn");
    }
    expect(S.life.weekStats.learn).toBe(4);
    expect(goalProg(S.life.goals.items[0])).toBeCloseTo(0.8);
    S.life.attrs.stamina = 100;
    const hit = doAction("learn"); // 第 5 次 → 达成
    expect(S.life.goals.items[0].done).toBe(true);
    expect(hit.lines.join("\n")).toContain("周目标「本周学习 5 次」达成");
    expect(S.life.attrs.skill).toBeGreaterThanOrEqual(5 + 4 * 2 + 3); // 5次学习 + 奖励技能
    S.life.attrs.stamina = 100;
    const again = doAction("learn");
    expect(again.lines.join("\n")).not.toContain("周目标"); // 不重复发奖
    expect(again.lines.join("\n")).not.toContain("🎯");
  });

  it("抽卡与道具使用计入周计数", () => {
    S.money = 20000;
    doPulls("partner", 1);
    expect(S.life.weekStats.pulls).toBe(1);
    addItem("coffee");
    useItem("coffee");
    expect(S.life.weekStats.item).toBe(1);
  });

  it("goalProg 钳在 0~1，rewardText 覆盖各奖励通道", () => {
    S.life.weekStats.work = 99;
    expect(goalProg({ id: "g_work6", done: false })).toBe(1);
    expect(rewardText({ money: 300 })).toContain("¥300");
    expect(rewardText({ staminaMax: 2, skinTicket: 1 })).toContain("体力上限+2");
    expect(rewardText({ skinTicket: 1 })).toContain("皮肤券×1");
    expect(rewardText({ favor: 4 })).toContain("随行好感");
  });

  it("checkGoals 幂等：无目标/已完成时返回空", () => {
    expect(checkGoals()).toEqual([]);
    S.life.goals = { wk: 0, items: [{ id: GOAL_POOL[0].id, done: true }] };
    expect(checkGoals()).toEqual([]);
  });

  it("目标奖励走 addAttrs 软帽：体力上限到帽不再涨", () => {
    S.life.staminaMax = LIFE.STAMINA_CAP;
    S.life.goals = { wk: 0, items: [{ id: "g_gym5", done: false }] };
    S.life.weekStats.gym = 5;
    const lines = checkGoals();
    expect(lines.length).toBe(1);
    expect(S.life.staminaMax).toBe(LIFE.STAMINA_CAP); // 奖励 +2 被软帽吞掉，不越界
  });
});
