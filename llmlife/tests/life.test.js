import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { LIFE, ENDINGS, MMAP, PROBS } from "../js/config.js";import { payoutParams, expectedWorkPay } from "../js/economy.js";
import { recruit, setSlot, slotBoosts, favorLevel, boostOf, effectOf, staminaCeiling } from "../js/partners.js";
import { addItem, useItem, itemCount, rollLottery } from "../js/items.js";
import { doAction, endDay, weekSettle, checkEnd, checkMilestones, canDo, anyActionAvailable, restart } from "../js/life.js";

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
    expect(boostOf({m:"glm-5-3", favor:0})).toBeCloseTo(0.50, 6);   // UR 基础（温和加强档）
    expect(boostOf({m:"glm-5-3", favor:30})).toBeCloseTo(0.575, 6); // 好感 Lv1 ×1.15
    expect(boostOf({m:"glm-5-3", favor:90})).toBeCloseTo(0.65, 6);  // 好感 Lv2 ×1.3
    expect(favorLevel({m:"glm-5-3", favor:29})).toBe(0);
    expect(favorLevel({m:"glm-5-3", favor:30})).toBe(1);
  });

  it("随行槽加成汇总与槽位抢占", () => {
    const p1 = recruit("claude-fable-5-1").partner; // UTR work .75
    const p2 = recruit("glm-5-3").partner;          // UR dual .50
    expect(setSlot(0, p1.uid)).toBe(true);
    expect(setSlot(0, p2.uid)).toBe(true); // 槽位 0 被抢占
    expect(S.slots[0]).toBe(p2.uid);
    const b = slotBoosts();
    expect(b.work).toBeCloseTo(0.30, 6);  // dual 六折
    expect(b.learn).toBeCloseTo(0.30, 6);
    expect(b.staminaMax).toBe(0);
    setSlot(1, p1.uid);
    expect(slotBoosts().work).toBeCloseTo(0.30 + 0.75, 6);
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

  it("道具体力上限成长同样吃 200 软帽", () => {
    S.life.staminaMax = 199;
    addItem("chair");
    useItem("chair"); // +5 → 只补到 200
    expect(S.life.staminaMax).toBe(200);
    S.life.staminaMax = 150;
    addItem("monitor");
    useItem("monitor"); // 未到帽照常 +3
    expect(S.life.staminaMax).toBe(153);
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

  it("行动守卫：体力/钱包/躺平限次", () => {
    expect(canDo("work").ok).toBe(true);
    S.life.attrs.stamina = 10;
    expect(canDo("work").ok).toBe(false);
    S.life.attrs.stamina = 100;
    S.money = 0;
    expect(canDo("play").ok).toBe(false);
    S.money = 1000;
    expect(canDo("rest").ok).toBe(true);
    doAction("rest");
    expect(canDo("rest").ok).toBe(false); // 每天限 1 次
    expect(canDo("work").ok).toBe(true);  // 其他行动不受躺平限制
  });

  it("无行动点上限：体力足够时可连续行动，日切只由结束今天触发", () => {
    PROBS.EVENT = 0;
    S.life.attrs.stamina = 100;
    S.money = 1000;
    const day = S.life.day;
    doAction("work"); // 100 → 62
    doAction("work"); // 62 → 24
    expect(S.stats.workDays).toBe(2);
    expect(S.life.day).toBe(day); // 不再自动日切
    doAction("rest"); // 24 → 64（每天 1 次）
    doAction("work"); // 64 → 26，一天第三份工
    expect(S.stats.workDays).toBe(3);
    expect(S.life.day).toBe(day);
    expect(S.life.restUsed).toBe(1);
  });

  it("结束今天：日切推进、躺平次数重置", () => {
    PROBS.EVENT = 0;
    doAction("rest");
    const lines = endDay();
    expect(S.life.day).toBe(2);
    expect(S.life.restUsed).toBe(0);
    expect(lines.join("\n")).not.toContain("🎲");
  });

  it("每天必发 1 个事件，概率追加第 2 个", () => {
    PROBS.EVENT = 1; PROBS.EVENT_EXTRA = 0;
    let lines = endDay();
    expect(lines.filter(l=>l.startsWith("🎲")).length).toBe(1);
    S.life.day = 1; // 回退再测追加
    PROBS.EVENT_EXTRA = 1;
    lines = endDay();
    expect(lines.filter(l=>l.startsWith("🎲")).length).toBe(2);
  });

  it("体力见底且钱包空时 anyActionAvailable 为 false", () => {
    PROBS.EVENT = 0;
    S.money = 0;
    S.life.attrs.stamina = 10;
    doAction("rest"); // 10 → 50，用掉当天唯一一次躺平
    S.life.attrs.stamina = 10; // 强制见底
    expect(anyActionAvailable()).toBe(false);
    const r = doAction("learn");
    expect(r.ok).toBe(false);
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

  it("健身提升体力上限与魅力，休息回 40 体力", () => {
    S.life.attrs.stamina = 100;
    S.money = 1000;
    doAction("gym");
    expect(S.life.staminaMax).toBe(LIFE.STAMINA_MAX + 1);
    expect(S.life.attrs.charm).toBe(12);
    S.life.attrs.stamina = 20;
    doAction("rest");
    expect(S.life.attrs.stamina).toBe(60);
  });

  it("撸铁比打工更累：42 体力门槛", () => {
    S.life.attrs.stamina = 38; // 够打工但不够撸铁
    expect(canDo("work").ok).toBe(true);
    expect(canDo("gym").ok).toBe(false);
  });

  it("体力上限软帽 200：到帽后健身只涨魅力", () => {
    S.life.staminaMax = LIFE.STAMINA_CAP;
    S.life.attrs.stamina = LIFE.STAMINA_CAP;
    S.money = 1000;
    const r = doAction("gym");
    expect(S.life.staminaMax).toBe(LIFE.STAMINA_CAP);
    expect(S.life.attrs.charm).toBe(12);
    expect(r.line).toContain("身体到极限");
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

  it("日切体力回满（含伙伴上限加成）并衰减心情", () => {
    S.life.attrs.stamina = 5;
    S.life.attrs.mood = 50;
    endDay();
    expect(S.life.attrs.stamina).toBe(LIFE.STAMINA_MAX);
    expect(S.life.attrs.mood).toBe(42);
  });

  it("伙伴加成端到端：随行 Google 伙伴抬高体力上限，睡觉回满到新上限", () => {
    const gem = recruit("gemini-3-8-flash").partner; // SSR Google +30% → +12 上限
    setSlot(0, gem.uid);
    expect(staminaCeiling()).toBe(112);
    S.life.attrs.stamina = 0;
    endDay();
    expect(S.life.attrs.stamina).toBe(112); // 回满到加成后上限
    setSlot(0, null);
    expect(staminaCeiling()).toBe(100); // 下场立即回落
  });

  it("伙伴加成端到端：随行 Anthropic 伙伴打工收入 ×1.75", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // roll=ok 且 okRange 中点 → amt = base×1.3
    const base = doAction("work");
    const unslottedAmt = base.line.match(/¥([\d,.]+)/)[1];
    const fable = recruit("claude-fable-5-1").partner; // UTR work +75%
    setSlot(0, fable.uid);
    S.life.attrs.stamina = 100;
    const boosted = doAction("work");
    const slottedAmt = boosted.line.match(/¥([\d,.]+)/)[1];
    const ratio = parseFloat(slottedAmt.replace(/,/g, "")) / parseFloat(unslottedAmt.replace(/,/g, ""));
    expect(ratio).toBeCloseTo(1.75, 2);
    vi.restoreAllMocks();
  });

  it("伙伴加成端到端：学习收益保留小数（不被取整吞掉）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // rand(2,4) → 2
    const ds = recruit("deepseek-v4-1-flash").partner; // SSR Alibaba/DeepSeek 学习 +30%
    setSlot(0, ds.uid);
    const before = S.life.attrs.skill;
    doAction("learn");
    expect(S.life.attrs.skill - before).toBeCloseTo(2 * 1.3, 6); // 2.6 而非取整
    vi.restoreAllMocks();
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
