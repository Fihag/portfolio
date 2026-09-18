import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { HOUSES, LIVING_BASE, LIVING_TIER, LIVING_HOUSE, DEBT_INTEREST, livingCost, PROBS } from "../js/config.js";
import { weekSettle, endDay, resolveChoice, checkEnd } from "../js/life.js";

/* 生活成本抬压：周账单随职级/住房上涨，欠租计息，按身家比例的账单事件 */
const P0 = { EVENT: PROBS.EVENT, EXTRA: PROBS.EVENT_EXTRA, CHOICE: PROBS.CHOICE, TALK: PROBS.PARTNER_TALK };
beforeEach(() => {
  setState(defaultState());
  PROBS.EVENT = 0; PROBS.EVENT_EXTRA = 0; PROBS.CHOICE = 0; PROBS.PARTNER_TALK = 0;
});
afterAll(() => Object.assign(PROBS, P0));

describe("生活水平随生活档次上涨", () => {
  it("livingCost = 基础 + 职级×500 + 住房×300", () => {
    expect(livingCost(S)).toBe(LIVING_BASE);
    S.life.tier = 2;
    expect(livingCost(S)).toBe(LIVING_BASE + 2 * LIVING_TIER);
    S.life.house = 3;
    expect(livingCost(S)).toBe(LIVING_BASE + 2 * LIVING_TIER + 3 * LIVING_HOUSE);
  });

  it("周结算 = 房租 + 生活水平，账单里能看见两笔", () => {
    S.life.tier = 3;
    S.money = 50000;
    const msg = weekSettle();
    expect(S.money).toBe(50000 - HOUSES[0].rent - livingCost(S));
    expect(msg).toContain("生活");
    expect(msg).toContain(HOUSES[0].name);
  });
});

describe("欠租滞纳金", () => {
  it("欠租当周按欠款计息，余额继续下探", () => {
    S.money = -1000; // 已经欠着
    const due = HOUSES[0].rent + livingCost(S);
    const msg = weekSettle();
    const debt = 1000 + due; // 结算后的欠款
    expect(S.debtWeeks).toBe(1);
    expect(msg).toContain("滞纳金");
    expect(S.money).toBe(-(debt + Math.round(debt * DEBT_INTEREST))); // -2800 再扣 140 利息
  });

  it("还清后欠租清零、不再计息", () => {
    S.money = 5000;
    const msg = weekSettle();
    expect(S.debtWeeks).toBe(0);
    expect(msg).not.toContain("滞纳金");
  });

  it("连续欠租两周仍然直接破产（滞纳金不改判负逻辑）", () => {
    S.money = -5000;
    weekSettle();
    weekSettle();
    expect(checkEnd().id).toBe("broke");
  });
});

describe("按身家计费的账单事件", () => {
  it("份子钱按当前身家比例扣（收入涨，账单跟着涨）", () => {
    S.money = 10000;
    S.life.chains = [{ day: 2, ev: "wedding" }];
    vi.spyOn(Math, "random").mockReturnValue(0); // 区间下沿 -4%
    let lines;
    try { lines = endDay(); } finally { vi.restoreAllMocks(); }
    expect(lines.some(l => l.includes("份子钱"))).toBe(true);
    expect(S.money).toBe(10000 - 400);
    S.money = 100; // 身家缩水后同一事件只扣得动 4 块
    S.life.chains = [{ day: S.life.day + 1, ev: "wedding" }];
    vi.spyOn(Math, "random").mockReturnValue(0);
    try { endDay(); } finally { vi.restoreAllMocks(); }
    expect(S.money).toBe(96);
  });

  it("消费主义分支抉择：买买买按 6% 扣款并涨心情", () => {
    S.money = 10000;
    S.life.pendingChoice = { id: "ch_consume" };
    const mood0 = S.life.attrs.mood;
    vi.spyOn(Math, "random").mockReturnValue(0);
    try { resolveChoice(0); } finally { vi.restoreAllMocks(); }
    expect(S.money).toBe(10000 - 600);
    expect(S.life.attrs.mood).toBeGreaterThan(mood0);
    expect(S.life.pendingChoice).toBeNull();
  });
});