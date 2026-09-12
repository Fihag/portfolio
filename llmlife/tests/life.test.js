import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { LIFE, ENDINGS, MMAP, PROBS } from "../js/config.js";
import { payoutParams, expectedWorkPay } from "../js/economy.js";
import { recruit, setSlot, slotBoosts, favorLevel, boostOf, effectOf } from "../js/partners.js";
import { addItem, useItem, itemCount, rollLottery } from "../js/items.js";
import { doAction, endDay, weekSettle, checkEnd, checkMilestones, canDo, restart } from "../js/life.js";

function fresh(){ setState(defaultState()); return S; }

describe("伙伴系统", () => {
  beforeEach(fresh);

  it("招募/重复折好感", () => {
    const a = recruit("glm-5-3");
    expect(a.dupe).toBe(false);
    expect(S.partners.length).toBe(1);
    const b = recruit("glm-5-3");
    expect(b.dupe).toBe(true);
    expect(b.partner.favor).toBe(10);
    expect(S.partners.length).toBe(1);
  });

  it("厂商决定效果类型，稀有度决定强度", () => {
    expect(effectOf(MMAP["claude-fable-5-1"])).toBe("work");
    expect(boostOf({m:"glm-5-3", favor:0})).toBeCloseTo(0.30, 6);   // UR 基础
    expect(boostOf({m:"glm-5-3", favor:30})).toBeCloseTo(0.345, 6); // 好感 Lv1 ×1.15
    expect(boostOf({m:"glm-5-3", favor:90})).toBeCloseTo(0.39, 6);  // 好感 Lv2 ×1.3
    expect(favorLevel({m:"glm-5-3", favor:29})).toBe(0);
    expect(favorLevel({m:"glm-5-3", favor:30})).toBe(1);
  });

  it("随行槽加成汇总与槽位抢占", () => {
    const p1 = recruit("claude-fable-5-1").partner; // UTR work .45
    const p2 = recruit("glm-5-3").partner;          // UR dual .30
    expect(setSlot(0, p1.uid)).toBe(true);
    expect(setSlot(0, p2.uid)).toBe(true); // 槽位 0 被抢占
    expect(S.slots[0]).toBe(p2.uid);
    const b = slotBoosts();
    expect(b.work).toBeCloseTo(0.18, 6);  // dual 六折
    expect(b.learn).toBeCloseTo(0.18, 6);
    expect(b.staminaMax).toBe(0);
    setSlot(1, p1.uid);
    expect(slotBoosts().work).toBeCloseTo(0.18 + 0.45, 6);
  });

  it("空槽随行无加成", () => {
    expect(slotBoosts()).toEqual({work:0, learn:0, mood:0, charm:0, staminaMax:0});
  });
});

describe("道具系统", () => {
  beforeEach(fresh);

  it("添加与使用扣库存", () => {
    addItem("coffee", 2);
    expect(itemCount("coffee")).toBe(2);
    const res = useItem("coffee");
    expect(res.ok).toBe(true);
    expect(itemCount("coffee")).toBe(1);
    expect(S.life.attrs.stamina).toBe(100); // 满体力钳制
    useItem("coffee");
    expect(itemCount("coffee")).toBe(0);
    expect(S.items.length).toBe(0);
  });

  it("体力道具在低体力时回血", () => {
    addItem("coffee");
    S.life.attrs.stamina = 50;
    useItem("coffee");
    expect(S.life.attrs.stamina).toBe(68);
  });

  it("好感道具作用于全体随行", () => {
    const p = recruit("glm-5-3").partner;
    setSlot(0, p.uid);
    addItem("figurine");
    useItem("figurine");
    expect(p.favor).toBe(10);
  });

  it("免费抽卡券与护身符走特殊通道", () => {
    addItem("pulltick");
    expect(useItem("pulltick").ok).toBe(true);
    expect(S.freePulls).toBe(1);
    addItem("amulet");
    const pityBefore = S.pity.partner;
    useItem("amulet");
    expect(S.pity.partner).toBe(pityBefore + 10);
  });

  it("刮刮乐分布有界且期望为正", () => {
    let sum = 0;
    for (let i = 0; i < 10000; i++) sum += rollLottery().amt;
    expect(sum / 10000).toBeGreaterThan(50);
    expect(sum / 10000).toBeLessThan(200);
  });
});

describe("回合引擎", () => {
  beforeEach(() => {
    fresh();
    PROBS.EVENT = 0; // 事件随机性不好单测，关掉保证确定性（afterAll 恢复）
  });
  afterAll(() => { PROBS.EVENT = 0.62; });

  it("行动守卫：行动点/体力/钱包", () => {
    expect(canDo("work").ok).toBe(true);
    S.life.attrs.stamina = 10;
    expect(canDo("work").ok).toBe(false);
    S.life.attrs.stamina = 100;
    S.money = 0;
    expect(canDo("play").ok).toBe(false);
    S.life.ap = 0;
    expect(canDo("rest").ok).toBe(false);
  });

  it("行动点耗尽后自动日切（体力只够打两份工）", () => {
    PROBS.EVENT = 0;
    const day = S.life.day;
    let r;
    for (let i = 0; i < 2; i++) r = doAction("work");
    expect(S.stats.workDays).toBe(2); // 38×2 ≤ 100 < 38×3，一天天然最多两份工
    r = doAction("rest");
    expect(r.ok).toBe(true);
    expect(S.life.day).toBe(day + 1);
    expect(r.dayEnded).toBe(true);
    expect(S.life.ap).toBe(3);
  });

  it("第 7 天结束触发周结算", () => {
    S.life.day = 7;
    S.life.ap = 0;
    const lines = endDay();
    expect(lines.join("\n")).toContain("周结算");
  });

  it("学习涨技术且受心情影响", () => {
    S.life.attrs.mood = 10; // 低心情
    const s0 = S.life.attrs.skill;
    doAction("learn");
    const g1 = S.life.attrs.skill - s0;
    expect(g1).toBeLessThanOrEqual(2); // 心情低落效率减半
    S.life.attrs.mood = 80;
    doAction("learn");
    const g2 = S.life.attrs.skill - s0 - g1;
    expect(g2).toBeGreaterThanOrEqual(2);
  });

  it("健身提升体力上限与魅力，休息回体力", () => {
    S.life.attrs.stamina = 100;
    S.money = 1000;
    doAction("gym");
    expect(S.life.staminaMax).toBe(LIFE.STAMINA_MAX + 1);
    expect(S.life.attrs.charm).toBe(12);
    S.life.attrs.stamina = 20;
    doAction("rest");
    expect(S.life.attrs.stamina).toBe(50);
  });

  it("周结算扣房租，付不起计欠租，两周破产结局", () => {
    S.money = 100000;
    const msg = weekSettle();
    expect(S.money).toBe(100000 - LIFE.RENT - LIFE.LIVING);
    expect(S.debtWeeks).toBe(0);
    expect(msg).toContain("余额");
    S.money = -500;
    weekSettle();
    expect(S.debtWeeks).toBe(1);
    expect(checkEnd()).toBeNull();
    S.money = -500;
    weekSettle();
    const end = checkEnd();
    expect(end.id).toBe("broke");
    expect(S.ending.id).toBe("broke");
  });

  it("360 天长一岁，60 岁触发退休结算", () => {
    S.life.day = 360 * 38; // 22 + 38 = 60
    const lines = endDay();
    expect(S.life.age).toBe(60);
    expect(S.ending).not.toBeNull();
    expect(ENDINGS.some(e => e.id === S.ending.id) || S.ending.id === "chosen").toBe(true);
    expect(lines.join("\n")).toContain("人生结算");
  });

  it("综合分决定结局档位", () => {
    S.life.day = 360 * 38;
    S.money = 300000; S.life.attrs.skill = 100; S.life.attrs.charm = 100;
    S.life.staminaMax = 140;
    const partner = recruit("glm-5-3").partner;
    partner.favor = 100;
    endDay();
    expect(S.ending.id).toBe("god");
  });

  it("持有 Fihag V1 触发天选结局", () => {
    S.life.day = 360 * 38;
    S.dex.fihagv1 = 1;
    S.money = 60000;
    endDay();
    expect(S.ending.id).toBe("chosen");
  });

  it("日切自然恢复体力并衰减心情", () => {
    S.life.attrs.stamina = 0;
    S.life.attrs.mood = 50;
    endDay();
    expect(S.life.attrs.stamina).toBe(LIFE.SLEEP_RECOVER);
    expect(S.life.attrs.mood).toBe(42);
  });

  it("结局后禁止行动，restart 重开", () => {
    S.debtWeeks = LIFE.GRACE_WEEKS;
    checkEnd();
    expect(canDo("work").ok).toBe(false);
    restart();
    expect(S.ending).toBeNull();
    expect(S.life.day).toBe(1);
    expect(S.money).toBe(800);
  });

  it("余额成就触发一次即锁存", () => {
    S.money = 6000;
    const got = checkMilestones();
    expect(got.some(m => m.id === "m2k")).toBe(true);
    expect(got.some(m => m.id === "m5k")).toBe(true);
    expect(checkMilestones().length).toBe(0);
  });
});

describe("引擎与经济一致性", () => {
  it("技能 35 心情 70 无加成的打工期望与公示参数一致", () => {
    expect(expectedWorkPay(35, 70, 0)).toBeGreaterThan(200);
    expect(payoutParams(35, 70).pGreat).toBeCloseTo(0.0515, 6);
  });
});
