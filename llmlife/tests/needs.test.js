import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { defaultState, setState, S, load } from "../js/state.js";
import { LIFE, PROBS } from "../js/config.js";
import { doAction, endDay, daySlots } from "../js/life.js";
import { clampAttrs, addAttrs } from "../js/items.js";
import { staminaCeiling } from "../js/partners.js";

/* 需求条：饱食（每天要吃）与健康（高压透支、病倒半休） */
const P0 = { EVENT: PROBS.EVENT, EXTRA: PROBS.EVENT_EXTRA, CHOICE: PROBS.CHOICE, TALK: PROBS.PARTNER_TALK };
beforeEach(() => {
  setState(defaultState());
  PROBS.EVENT = 0; PROBS.EVENT_EXTRA = 0; PROBS.CHOICE = 0; PROBS.PARTNER_TALK = 0;
});
afterAll(() => Object.assign(PROBS, P0));

describe("饱食：吃饭与饿肚子", () => {
  it("默认 80，日切衰减，吃饭/下馆子回补并钳到上限", () => {
    expect(S.life.attrs.satiety).toBe(80);
    endDay();
    expect(S.life.attrs.satiety).toBe(80 - LIFE.SATIETY_DECAY);
    S.money = 1000;
    doAction("eat"); // 🕒1 ¥40 🍚+50
    expect(S.life.attrs.satiety).toBe(Math.min(LIFE.SATIETY_MAX, 50 + 50));
    S.money = 1000;
    const m0 = S.life.attrs.mood;
    doAction("dine"); // 🍚+70 且心情 +
    expect(S.life.attrs.satiety).toBe(LIFE.SATIETY_MAX);
    expect(S.life.attrs.mood).toBeGreaterThan(m0);
  });

  it("饿肚子：学习收益 ×0.75、打工收入 ×0.75、睡眠只回八成", () => {
    S.money = 1000;
    S.life.attrs.satiety = 10;
    S.life.attrs.stamina = 100;
    vi.spyOn(Math, "random").mockReturnValue(0);
    try { doAction("learn"); } finally { vi.restoreAllMocks(); }
    expect(S.life.attrs.skill).toBeCloseTo(5 + 2 * 0.75, 6);

    // 打工：同一次抽样下，饿肚子只拿 75%（抽样≡期望同源，mult 是唯一变量）
    const pay = (sat) => {
      setState(defaultState());
      S.money = 1000;
      S.life.attrs.satiety = sat;
      S.life.attrs.stamina = 100;
      vi.spyOn(Math, "random").mockReturnValue(0.5); // ok 事件，倍率 1.0
      try { const r = doAction("work"); return Number(r.line.match(/¥([\d,]+)/)[1].replace(/,/g, "")); }
      finally { vi.restoreAllMocks(); }
    };
    const full = pay(80), hungry = pay(10);
    expect(hungry / full).toBeCloseTo(0.75, 2);

    S.life.attrs.satiety = 10; // 日切衰减到 0 之前先看回满倍率
    S.life.attrs.health = LIFE.HEALTH_MAX;
    endDay();
    expect(S.life.attrs.stamina).toBe(Math.round(staminaCeiling() * 0.8));
  });

  it("饱食归零每天额外扣健康", () => {
    S.life.attrs.satiety = 20; // 衰减后归零
    S.life.attrs.health = 60;
    endDay();
    expect(S.life.attrs.satiety).toBe(0);
    expect(S.life.attrs.health).toBe(60 + LIFE.HEALTH_REGEN - LIFE.SATIETY_HUNGRY_HP);
  });
});

describe("健康：高压透支、健身回补与病倒", () => {
  it("加班扣健康、健身涨健康", () => {
    S.money = 1000;
    S.life.tier = 1;
    S.life.attrs.stamina = 100;
    const before = S.life.attrs.health;
    doAction("overtime");
    expect(S.life.attrs.health).toBe(before - 8);
    S.money = 1000;
    S.life.attrs.health = 50;
    doAction("gym");
    expect(S.life.attrs.health).toBe(52);
  });

  it("健康低：体力上限打折（加班换钱的隐性账单）", () => {
    S.life.attrs.health = LIFE.HEALTH_LOW - 1;
    expect(staminaCeiling()).toBe(Math.round(S.life.staminaMax * LIFE.HEALTH_LOW_MUL));
    S.life.attrs.health = LIFE.HEALTH_LOW;
    expect(staminaCeiling()).toBe(S.life.staminaMax);
  });

  it("病倒：医药费 + 次日半休 + 体力回满打折，躺一天后恢复", () => {
    S.life.attrs.health = 15;
    S.life.attrs.satiety = 100;
    const money = S.money = 5000;
    endDay();
    expect(S.life.sick).toBe(true);
    expect(S.money).toBe(money - LIFE.SICK_COST);
    expect(daySlots()).toBe(Math.round(LIFE.SLOTS_PER_DAY * LIFE.SICK_SLOT_MUL));
    expect(S.life.timeLeft).toBe(daySlots());
    expect(S.life.attrs.stamina).toBe(Math.round(staminaCeiling() * LIFE.SICK_REFILL_MUL));
    // 病假这一天结束：强制恢复 12 点 → 脱离病态
    endDay();
    expect(S.life.sick).toBe(false);
    expect(daySlots()).toBe(LIFE.SLOTS_PER_DAY);
    expect(S.life.attrs.stamina).toBe(staminaCeiling());
  });
});

describe("属性结算与存档", () => {
  it("clampAttrs/addAttrs 覆盖饱食与健康", () => {
    addAttrs({ satiety: 999, health: -999 });
    expect(S.life.attrs.satiety).toBe(LIFE.SATIETY_MAX);
    expect(S.life.attrs.health).toBe(0);
    S.life.attrs.satiety = 150; S.life.attrs.health = -5; // 绕过 addAttrs 直接改也要能被钳回
    clampAttrs();
    expect(S.life.attrs.satiety).toBe(LIFE.SATIETY_MAX);
    expect(S.life.attrs.health).toBe(0);
  });

  it("老档缺饱食/健康逐键回填，不再出现 NaN", () => {
    const s = defaultState();
    delete s.life.attrs.satiety;
    delete s.life.attrs.health;
    localStorage.setItem("llmlife_v2", JSON.stringify(s));
    const back = load();
    expect(back.life.attrs.satiety).toBe(80);
    expect(back.life.attrs.health).toBe(LIFE.HEALTH_MAX);
  });

  it("事件可携带饱食/健康收益（后果链注入走同一 applyFx）", () => {
    S.money = 5000;
    S.life.attrs.health = 30;
    S.life.chains = [{ day: 2, ev: "checkup" }];
    endDay();
    expect(S.life.attrs.health).toBe(Math.min(LIFE.HEALTH_MAX, 30 + LIFE.HEALTH_REGEN + 8));
    expect(S.money).toBe(5000 - 150);
  });
});