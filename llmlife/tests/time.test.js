import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { LIFE, ACTIONS, DUO_SLOTS, PROBS } from "../js/config.js";
import { doAction, canDo, endDay, anyActionAvailable, duoCards } from "../js/life.js";

/* 时间格制：一天 12 格是主预算，体力是并行的身体闸门（两者任一不足即不可行） */
const P0 = { EVENT: PROBS.EVENT, EXTRA: PROBS.EVENT_EXTRA, CHOICE: PROBS.CHOICE, TALK: PROBS.PARTNER_TALK };
beforeEach(() => {
  setState(defaultState());
  PROBS.EVENT = 0; PROBS.EVENT_EXTRA = 0; PROBS.CHOICE = 0; PROBS.PARTNER_TALK = 0;
});
afterAll(() => Object.assign(PROBS, P0));

describe("时间格：预算与守卫", () => {
  it("每个行动都有正整数格数，且一天装不下全部行动（取舍存在）", () => {
    let sum = 0;
    for(const a of ACTIONS){
      expect(Number.isInteger(a.slots) && a.slots > 0).toBe(true);
      sum += a.slots;
    }
    expect(sum).toBeGreaterThan(LIFE.SLOTS_PER_DAY);
  });

  it("行动按卡面格数扣时间", () => {
    S.money = 1000;
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY);
    doAction("work"); // 3
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY - 3);
    doAction("learn"); // 2
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY - 5);
    doAction("rest"); // 1
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY - 6);
  });

  it("格不够时行动被拒，理由指向时间格", () => {
    S.money = 1000;
    S.life.timeLeft = 2;
    expect(canDo("work").ok).toBe(false);
    expect(canDo("work").reason).toContain("时间格");
    expect(canDo("learn").ok).toBe(true); // 2 格刚好
    expect(canDo("rest").ok).toBe(true);  // 1 格
  });

  it("格与体力是两个独立闸门", () => {
    S.money = 1000;
    S.life.attrs.stamina = 10;
    S.life.timeLeft = LIFE.SLOTS_PER_DAY;
    expect(canDo("work").reason).toContain("体力");
    S.life.attrs.stamina = 100;
    S.life.timeLeft = 1;
    expect(canDo("work").reason).toContain("时间格");
  });
});

describe("时间格：日切与同行卡", () => {
  it("格尽：dayEnded 标记 + 无可做行动 + 日切回满", () => {
    S.money = 1000;
    S.life.attrs.stamina = 200;
    S.life.timeLeft = 3;
    const r = doAction("work");
    expect(r.dayEnded).toBe(true);
    expect(S.life.timeLeft).toBe(0);
    expect(anyActionAvailable()).toBe(false);
    endDay();
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY);
  });

  it("格未尽时 dayEnded 为假，还能继续安排", () => {
    S.money = 1000;
    S.life.attrs.stamina = 200;
    const r = doAction("work");
    expect(r.dayEnded).toBe(false);
    expect(anyActionAvailable()).toBe(true);
  });

  it("同行卡同时吃格与体力，格不够时被拒", () => {
    S.partners = [{ uid: 1, m: "glm-5-3", favor: 95, stars: 0 }];
    S.slots = [1, null, null];
    const cards = duoCards();
    expect(cards.length).toBe(1);
    S.life.attrs.stamina = 100;
    S.life.timeLeft = 1;
    expect(canDo(cards[0].id).ok).toBe(false);
    expect(canDo(cards[0].id).reason).toContain("时间格");
    S.life.timeLeft = DUO_SLOTS;
    const r = doAction(cards[0].id);
    expect(r.ok).toBe(true);
    expect(S.life.timeLeft).toBe(0);
    expect(r.dayEnded).toBe(true);
  });
});