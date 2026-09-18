import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { LIFE, ENDINGS, MMAP, PROBS, HOUSES, livingCost } from "../js/config.js";import { payoutParams, expectedWorkPay } from "../js/economy.js";
import { recruit, setSlot, slotBoosts, favorLevel, boostOf, effectOf, staminaCeiling } from "../js/partners.js";
import { addItem, useItem, itemCount, rollLottery } from "../js/items.js";
import { doAction, endDay, weekSettle, checkEnd, checkMilestones, canDo, anyActionAvailable, restart, newGamePlus, chapterIndex, CHAPTER_TOTAL } from "../js/life.js";

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
    PROBS.CHOICE = 0;
    PROBS.PARTNER_TALK = 0;
  });
  afterAll(() => { PROBS.EVENT = 0.62; PROBS.CHOICE = 0.35; PROBS.PARTNER_TALK = 0.18; });

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

  it("时间格制：行动吃格、格不够被拒、格尽标记收工、日切回满", () => {
    PROBS.EVENT = 0;
    S.money = 1000;
    S.life.attrs.stamina = LIFE.STAMINA_MAX;
    const day = S.life.day;
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY);
    doAction("work"); // 🕒3 ⚡24
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY - 3);
    doAction("learn"); // 🕒2 ⚡20
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY - 5);
    S.life.timeLeft = 1; // 只剩 1 格
    expect(canDo("work").ok).toBe(false);
    expect(canDo("work").reason).toContain("时间格");
    expect(canDo("rest").ok).toBe(true); // 1 格的行动还做得动
    S.life.timeLeft = 3;
    S.life.attrs.stamina = LIFE.STAMINA_MAX;
    const r = doAction("work");
    expect(S.life.timeLeft).toBe(0);
    expect(r.dayEnded).toBe(true);   // 引擎侧标记「该收工了」
    expect(S.life.day).toBe(day);    // 日切本身仍由 endDay 执行
    endDay();
    expect(S.life.day).toBe(day + 1);
    expect(S.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY);
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
    // 追加位：固定随机序列让两次 weightedPick 落在不同事件（同事件去重是特性）
    S.life.day = 1; // 回退再测追加
    PROBS.EVENT_EXTRA = 1;
    const seq = [0.5, 0, 0.01, 0.5, 0, 0.99, 0.5];
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seq[i++] ?? 0.5);
    lines = endDay();
    vi.restoreAllMocks();
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

  it("撸铁比打工更累：体力门槛更高", () => {
    S.life.attrs.stamina = 26; // 够打工（24）但不够撸铁（28）
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

  it("周结算扣房租（随住房档位）+ 生活水平，付不起计欠租，两周破产结局", () => {
    S.money = 100000;
    const msg = weekSettle();
    expect(S.money).toBe(100000 - HOUSES[0].rent - livingCost(S));
    expect(S.debtWeeks).toBe(0);
    expect(msg).toContain("余额");
    expect(msg).toContain(HOUSES[0].name);
    // 升房后周支出随新档位走
    S.money = 100000;
    S.life.house = 2;
    weekSettle();
    expect(S.money).toBe(100000 - HOUSES[2].rent - livingCost(S));
    S.money = -500;
    S.life.house = 0;
    weekSettle();
    expect(S.debtWeeks).toBe(1);
    expect(checkEnd()).toBeNull();
    S.money = -500;
    weekSettle();
    const end = checkEnd();
    expect(end.id).toBe("broke");
    expect(S.ending.id).toBe("broke");
  });

  it("章计算：24 天一章、一局 8 章", () => {
    expect(CHAPTER_TOTAL).toBe(8);
    expect(LIFE.CHAPTER_DAYS).toBe(24);
    expect(chapterIndex(1)).toBe(0);
    expect(chapterIndex(24)).toBe(0);
    expect(chapterIndex(25)).toBe(1);
    expect(chapterIndex(24 * 8)).toBe(7);
  });

  it("章末（第 24 天日切）触发年度结算，chStart 快照滚动", () => {
    S.life.day = 24;
    S.chStart = { day:24, money:5000, earned:1000, spent:800, workDays:10, pulls:3 };
    S.money = 9000; S.stats.earned = 5000; S.stats.spent = 2000; S.stats.workDays = 40; S.stats.pulls = 8;
    const lines = endDay();
    expect(lines.join("\n")).toContain("年度结算");
    expect(S.life.age).toBe(23); // 一章恰好一年：生日=章末
    const st = S._settle;
    expect(st.no).toBe(0);
    expect(st.ageFrom).toBe(22);
    expect(st.ageTo).toBe(23);
    expect(st.net).toBe(4000);
    expect(st.earned).toBe(4000);
    expect(st.workDays).toBe(30);
    expect(st.pulls).toBe(5);
    expect(st.nextTitle).toBeTruthy();
    expect(S.chStart.day).toBe(25);
    expect(S.chStart.money).toBe(9000);
  });

  it("章中不触发年度结算", () => {
    S.life.day = 10;
    const lines = endDay();
    expect(lines.join("\n")).not.toContain("年度结算");
    expect(S._settle).toBeUndefined();
    expect(S.life.age).toBe(22);
  });

  it("八章走完（192 天）触发 30 岁结算结局并记录收集", () => {
    S.life.day = LIFE.CHAPTER_DAYS * 8;
    const lines = endDay();
    expect(S.life.age).toBe(30);
    expect(S.ending).not.toBeNull();
    expect(ENDINGS.some(e => e.id === S.ending.id) || S.ending.id === "chosen" || S.ending.id === "broke").toBe(true);
    expect(lines.join("\n")).toContain("人生结算");
    expect(S.endingsSeen[S.ending.id]).toBe(true);
  });

  it("综合分决定结局档位", () => {
    S.life.day = LIFE.CHAPTER_DAYS * 8;
    S.money = 300000; S.life.attrs.skill = 100; S.life.attrs.charm = 100;
    S.life.staminaMax = 140;
    const partner = recruit("glm-5-3").partner;
    partner.favor = 100;
    endDay();
    expect(S.ending.id).toBe("god");
  });

  it("持有 Fihag V1 触发天选结局", () => {
    S.life.day = LIFE.CHAPTER_DAYS * 8;
    S.dex.fihagv1 = 1;
    S.money = 120000; // money/400=300 叠加基础属性分 ≥300 门槛
    endDay();
    expect(S.ending.id).toBe("chosen");
  });

  it("newGamePlus 继承收集、发起步资金、清数值", () => {
    S.ng = 2;
    S.money = 99999;
    S.dex = { "glm-5-3": 3 };
    S.skinsOwned = ["classic", "night"];
    S.skinTickets = 5;
    S.flags.ms = { m2k: true };
    S.endingsSeen = { free: true };
    S.ending = { id: "free" };
    const ns = newGamePlus();
    expect(S).toBe(ns);
    expect(ns.ng).toBe(3);
    expect(ns.money).toBe(800 + 3 * 500);
    expect(ns.chStart.money).toBe(ns.money);
    expect(ns.dex["glm-5-3"]).toBe(3);
    expect(ns.skinsOwned).toContain("night");
    expect(ns.skinTickets).toBe(5);
    expect(ns.flags.ms.m2k).toBe(true);
    expect(ns.flags.welcomed).toBe(true);
    expect(ns.endingsSeen.free).toBe(true);
    expect(ns.ending).toBeNull();
    expect(ns.life.day).toBe(1);
    expect(ns.partners).toEqual([]);
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
