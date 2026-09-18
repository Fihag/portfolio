import { describe, it, expect, beforeEach, vi } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { endDay, canDo, doAction, choiceEvent, resolveChoice, duoCards } from "../js/life.js";
import { recruit, setSlot, boostOf } from "../js/partners.js";
import { PROBS, CHOICE_EVENTS, LIFE, DUO_STAMINA } from "../js/config.js";

function fresh(){ setState(defaultState()); return S; }

/* 模拟 pulls.js 阶段三的获得计数自增（星级判定依赖 S.dex） */
function acquire(id, n){
  let last = null;
  for(let i = 0; i < n; i++){
    last = recruit(id);
    S.dex[id] = (S.dex[id] || 0) + 1;
  }
  return last;
}

describe("分支选择事件与后果链", () => {
  beforeEach(() => {
    fresh();
    PROBS.EVENT = 1;
    PROBS.EVENT_EXTRA = 0;
    PROBS.PARTNER_TALK = 0;
  });

  it("PROBS.CHOICE=1 时日切主事件换成分支抉择（挂 pending 待选）", () => {
    PROBS.CHOICE = 1;
    vi.spyOn(Math, "random").mockReturnValue(0.9); // pick 取末位候选 → ch_crypto（无门槛）
    const lines = endDay();
    vi.restoreAllMocks();
    expect(S.life.pendingChoice).toBeTruthy();
    expect(choiceEvent().id).toBe(S.life.pendingChoice.id);
    expect(lines.join("\n")).toContain("⚖️");
  });

  it("PROBS.CHOICE=0 时保持普通事件，不出现抉择", () => {
    PROBS.CHOICE = 0;
    const lines = endDay();
    expect(S.life.pendingChoice).toBeNull();
    expect(lines.join("\n")).not.toContain("⚖️");
    expect(lines.join("\n")).toContain("🎲"); // 普通事件照发
  });

  it("resolveChoice 结算选项 fx 并登记 after 后果链", () => {
    PROBS.CHOICE = 0;
    const hard = CHOICE_EVENTS.find(e => e.choices.some(c => c.after));
    S.life.pendingChoice = { id: hard.id };
    const idx = hard.choices.findIndex(c => c.after);
    const day = S.life.day;
    const line = resolveChoice(idx);
    expect(line).toContain("见分晓");
    expect(S.life.pendingChoice).toBeNull();
    const chain = S.life.chains.at(-1);
    expect(chain.ev).toBe(hard.choices[idx].after.ev);
    expect(chain.day).toBe(day + hard.choices[idx].after.days);
  });

  it("未选时反复日切不会重复抽抉择（pending 互斥）", () => {
    PROBS.CHOICE = 1;
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    endDay(); // 挂 pending
    const id = S.life.pendingChoice.id;
    const lines = endDay();
    vi.restoreAllMocks();
    expect(S.life.pendingChoice.id).toBe(id); // 仍是同一件事，不会换
    expect(lines.filter(l => l.startsWith("⚖️")).length).toBeLessThanOrEqual(1);
  });

  it("后果链到期注入定值事件：数值落在睡眠衰减之前", () => {
    PROBS.EVENT = 0; // 只验链注入，排除普通事件噪音
    S.life.chains = [{ day: S.life.day + 1, ev: "ch_fans_ask" }]; // mood+6 charm+2 定值
    endDay();
    expect(S.life.attrs.mood).toBe(70 + 6 - LIFE.MOOD_DECAY); // 76 → 衰减后 68
    expect(S.life.attrs.charm).toBe(10 + 2);
    expect(S.life.chains.length).toBe(0);
  });

  it("后果链区间事件按随机区间结算", () => {
    PROBS.EVENT = 0;
    S.life.chains = [{ day: S.life.day, ev: "ch_bet_result" }];
    const money0 = S.money;
    const lines = endDay();
    expect(lines.join("\n")).toContain("旧事回响");
    expect(S.money).toBeGreaterThanOrEqual(money0); // 区间 [0,9000] 恒非负
    expect(S.money - money0).toBeLessThanOrEqual(9000);
  });

  it("链目标是选择事件时重新挂 pending 而非自动结算", () => {
    PROBS.EVENT = 0;
    PROBS.CHOICE = 0;
    S.life.chains = [{ day: S.life.day, ev: "ch_joinstart" }];
    const lines = endDay();
    expect(lines.join("\n")).toContain("🧭");
    expect(S.life.pendingChoice.id).toBe("ch_joinstart");
  });
});

describe("在场伙伴小剧场", () => {
  beforeEach(() => {
    fresh();
    PROBS.EVENT = 0;
    PROBS.CHOICE = 0;
    PROBS.PARTNER_TALK = 1; // 概率拉满
  });

  it("无随行伙伴时不触发", () => {
    const lines = endDay();
    expect(lines.join("\n")).not.toContain("💞");
  });

  it("随行学习系伙伴触发学习台本：技术与好感上涨", () => {
    const p = recruit("deepseek-v4-1-flash").partner; // DeepSeek → learn 通道
    setSlot(0, p.uid);
    vi.spyOn(Math, "random").mockReturnValue(0); // pick 全取首位 → 确定台本 pt_learn1
    const s0 = S.life.attrs.skill;
    const lines = endDay();
    vi.restoreAllMocks();
    expect(lines.join("\n")).toContain("💞");
    expect(S.life.attrs.skill).toBe(s0 + 2);
    expect(p.favor).toBeGreaterThanOrEqual(2);
  });

  it("剧场收益不被睡眠衰减吞掉（mood 通道净收益保留）", () => {
    const p = recruit("muse-spark-1-3").partner; // Meta → mood 通道，台本 pt_mood1 mood+8
    setSlot(0, p.uid);
    vi.spyOn(Math, "random").mockReturnValue(0);
    endDay();
    vi.restoreAllMocks();
    expect(S.life.attrs.mood).toBe(70 + 8 - LIFE.MOOD_DECAY); // 剧场在衰减之后结算
  });
});

describe("满好感同行卡", () => {
  beforeEach(() => {
    fresh();
    PROBS.EVENT = 0;
    PROBS.CHOICE = 0;
    PROBS.PARTNER_TALK = 0;
  });

  it("好感不足或不在随行槽都不给卡", () => {
    const p = recruit("claude-fable-5-1").partner;
    expect(duoCards().length).toBe(0);
    p.favor = 90;
    expect(duoCards().length).toBe(0); // 满好感但未随行
    setSlot(0, p.uid);
    expect(duoCards().length).toBe(1);
    expect(duoCards()[0].id).toBe(`duo:${p.uid}`);
    expect(canDo("duo:" + (p.uid + 99)).ok).toBe(false); // 不存在的 uid
  });

  it("同行卡按通道结算且每人每日一次，日切后重置", () => {
    const p = recruit("claude-fable-5-1").partner; // Anthropic → work 通道 ¥120~180
    p.favor = 95;
    setSlot(0, p.uid);
    const m0 = S.money;
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 取区间中点 ¥150
    let r;
    try { r = doAction(`duo:${p.uid}`); } finally { vi.restoreAllMocks(); }
    expect(r.ok).toBe(true);
    expect(S.money).toBe(m0 + 150);
    expect(S.life.weekStats.duo).toBe(1);
    const again = doAction(`duo:${p.uid}`);
    expect(again.ok).toBe(false);
    expect(again.line).toContain("今天就同行过一次了");
    S.life.attrs.stamina = 100;
    endDay();
    expect(doAction(`duo:${p.uid}`).ok).toBe(true); // 新的一天再来一次
  });

  it("同行消耗体力，体力不足被 canDo 拦截", () => {
    const p = recruit("deepseek-v4-1-flash").partner;
    p.favor = 95;
    setSlot(0, p.uid);
    S.life.attrs.stamina = DUO_STAMINA;
    expect(doAction(`duo:${p.uid}`).ok).toBe(true);
    expect(S.life.attrs.stamina).toBe(0);
    S.life.duoUsed = {}; // 绕过限次，单独验证体力门
    expect(canDo(`duo:${p.uid}`).ok).toBe(false);
  });

  it("第 3/6 次获得升星（上限 2），boost 与同行收益吃星级系数", () => {
    acquire("glm-5-3", 2);
    const p = S.partners[0];
    expect(p.stars).toBe(0);
    acquire("glm-5-3", 1); // 第 3 次 → ★1
    expect(p.stars).toBe(1);
    expect(boostOf(p)).toBeCloseTo(0.50 * 1.08, 6);
    acquire("glm-5-3", 3); // 第 6 次 → ★2；此后钳制
    expect(p.stars).toBe(2);
    acquire("glm-5-3", 4);
    expect(p.stars).toBe(2);
    // 同行收益：dual 通道 skill [2,4] charm [2,4] ×（1+2×8%）；区间中点即 3×1.16
    p.favor = 95;
    setSlot(0, p.uid);
    const s0 = S.life.attrs.skill, c0 = S.life.attrs.charm;
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    let r;
    try { r = doAction(`duo:${p.uid}`); } finally { vi.restoreAllMocks(); }
    expect(r.ok).toBe(true);
    expect(S.life.attrs.skill - s0).toBeCloseTo(3 * 1.16, 1);
    expect(S.life.attrs.charm - c0).toBeCloseTo(3 * 1.16, 1);
    expect(duoCards()[0].desc).toContain("★2");
  });
});
