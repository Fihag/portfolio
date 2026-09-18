import { describe, it, expect, beforeEach, vi } from "vitest";
import { defaultState, setState, S, freshMarket } from "../js/state.js";
import { MARKET, HOUSES, STOCK_SLOTS, PROBS, HOUSE_EQUITY, LIFE, assetsOf, houseOf, endingScore } from "../js/config.js";
import { tickMarket, shockMarket, holdingsValue, buyStock, sellStock, buyHouse, nextHouse } from "../js/market.js";
import { staminaCeiling } from "../js/partners.js";
import { weekSettle, endDay } from "../js/life.js";

function fresh(){ setState(defaultState()); return S; }

describe("行情：初始/tick/冲击", () => {
  beforeEach(fresh);

  it("freshMarket 基准价挂牌、持仓清零、昨价=现价", () => {
    const m = freshMarket();
    for(const t of MARKET){
      expect(m.price[t.id]).toBe(t.base);
      expect(m.hold[t.id]).toBe(0);
      expect(m.prev[t.id]).toBe(t.base);
    }
  });

  it("tickMarket 快照昨价并按随机游走推进", () => {
    const before = { ...S.market.price };
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 游走项恰好为 0，只剩漂移
    try {
      tickMarket();
      for(const t of MARKET){
        expect(S.market.prev[t.id]).toBe(before[t.id]);
        expect(S.market.price[t.id]).toBe(Math.max(1, Math.round(t.base * (1 + t.drift))));
      }
    } finally { vi.restoreAllMocks(); }
  });

  it("tickMarket 随机游走落在 drift±vol 带内", () => {
    const t = MARKET.find(x=>x.id==="meme");
    vi.spyOn(Math, "random").mockReturnValue(0); // 带内下沿
    try { tickMarket(); } finally { vi.restoreAllMocks(); }
    expect(S.market.price[t.id]).toBe(Math.round(t.base * (1 + t.drift - t.vol)));
  });

  it("shockMarket 全标的一次性乘性冲击且价格有底 ≥1", () => {
    shockMarket(0.7);
    for(const t of MARKET) expect(S.market.price[t.id]).toBe(Math.round(t.base * 0.7));
    shockMarket(0.0001); // 极端利空也砸不到 0
    for(const t of MARKET) expect(S.market.price[t.id]).toBe(1);
  });
});

describe("股票买卖", () => {
  beforeEach(fresh);

  it("买入记账：扣现金、增持仓、流水入账", () => {
    S.money = 5000;
    const t = MARKET.find(x=>x.id==="meme");
    const r = buyStock("meme", 10); // 10×50=500
    expect(r.amt).toBe(10 * t.base);
    expect(S.money).toBe(4500);
    expect(S.market.hold.meme).toBe(10);
    expect(S.ledger[0].amt).toBe(-r.amt);
    expect(holdingsValue()).toBe(500);
  });

  it("现金不足 / 步进非法 / 持仓不足 均拒绝且不改账", () => {
    S.money = 100;
    expect(buyStock("meme", 10).err).toBe("现金不足");
    expect(buyStock("meme", 2).err).toBe("无效交易"); // 步进不在 STOCK_SLOTS
    expect(sellStock("meme", 1).err).toBe("持仓不足");
    expect(S.money).toBe(100);
    expect(S.market.hold.meme).toBe(0);
  });

  it("低卖高买往返：市值差进现金", () => {
    S.money = 1000;
    buyStock("meme", 10);
    S.market.price.meme = 100; // 行情翻倍后卖出
    const r = sellStock("meme", 5);
    expect(r.amt).toBe(500);
    expect(S.money).toBe(1000); // 买 500 卖 500 净额不变
    expect(S.market.hold.meme).toBe(5);
  });

  it("STOCK_SLOTS 步进都是正整数", () => {
    for(const q of STOCK_SLOTS) expect(Number.isInteger(q) && q > 0).toBe(true);
  });
});

describe("住房升级链", () => {
  beforeEach(fresh);

  it("只能逐级升房，价高一级，首档免费", () => {
    expect(S.life.house).toBe(0);
    expect(HOUSES[0].cost).toBe(0);
    for(let i = 1; i < HOUSES.length; i++) expect(HOUSES[i].cost).toBeGreaterThan(HOUSES[i-1].cost);
  });

  it("buyHouse 扣款升档，周结算与体力上限随房走", () => {
    S.money = 10000;
    const r = buyHouse(); // → 一居室 ¥6,000
    expect(S.money).toBe(4000);
    expect(S.life.house).toBe(1);
    expect(r.house.name).toBe(HOUSES[1].name);
    expect(houseOf(S).name).toBe(HOUSES[1].name);
    expect(nextHouse().idx).toBe(2);
    expect(S.money).toBe(4000); // nextHouse 不扣款
    const before = S.money;
    weekSettle();
    expect(before - S.money).toBe(HOUSES[1].rent + LIFE.LIVING);
    S.money = 100000;
    expect(staminaCeiling()).toBe(S.life.staminaMax + HOUSES[1].sta);
  });

  it("钱不够升不了房；顶档之后无路可升", () => {
    S.money = 100;
    expect(buyHouse().err).toBe("现金不足");
    S.life.house = HOUSES.length - 1;
    expect(buyHouse().err).toBe("已住进顶配");
    expect(nextHouse()).toBeNull();
  });
});

describe("净资产口径与结局联动", () => {
  beforeEach(fresh);

  it("assetsOf = 现金 + 持仓市值 + 房产×0.7", () => {
    S.money = 10000;
    expect(assetsOf(S)).toBe(10000); // 无持仓、住免费隔断间
    buyStock("compute", 5); // 5×1000=5000
    S.life.house = 1;
    expect(assetsOf(S)).toBe(
      (10000 - 5000) + 5 * MARKET.find(x=>x.id==="compute").base + HOUSES[1].cost * HOUSE_EQUITY
    );
  });

  it("持仓与房产进入 endingScore：现金换持仓保分，买房按七折净值", () => {
    S.money = 20000;
    const before = endingScore(S);
    buyStock("compute", 5); // 现金→持仓 1:1 计净值，分数不动
    expect(endingScore(S)).toBe(before);
    buyHouse(); // 现金→房产净值 0.7 折，净资产缩水 cost×0.3
    const lost = HOUSES[1].cost * (1 - HOUSE_EQUITY);
    expect(assetsOf(S)).toBe(20000 - lost);
    const rest = before - Math.round(20000 / 400); // 非资产项（属性/伙伴/体力），前后同值
    expect(endingScore(S)).toBe(Math.round((20000 - lost) / 400 + rest));
  });

  it("行情冲击事件经 applyFx 生效（endDay 集成，游走钉在漂移位）", () => {
    const old = { EVENT: PROBS.EVENT, EXTRA: PROBS.EVENT_EXTRA, CHOICE: PROBS.CHOICE, TALK: PROBS.PARTNER_TALK };
    PROBS.EVENT = 0; PROBS.EVENT_EXTRA = 0; PROBS.CHOICE = 0; PROBS.PARTNER_TALK = 0;
    try {
      S.life.chains = [{ day: 2, ev: "mkt_boom" }];
      S.money = 5000;
      buyStock("meme", 10);
      const meme = MARKET.find(x=>x.id==="meme");
      const ticked = Math.round(meme.base * (1 + meme.drift)); // random=0.5 → 游走项为 0
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      let lines;
      try { lines = endDay(); } finally { vi.restoreAllMocks(); }
      expect(lines.some(l => l.includes("旧事回响"))).toBe(true);
      expect(S.market.price.meme).toBe(Math.round(ticked * 1.3));
      expect(S.life.chains.length).toBe(0);
    } finally { Object.assign(PROBS, old); }
  });

  it("好房子睡眠加成：日切心情衰减被住房抵扣、满值钳 100", () => {
    const old = { EVENT: PROBS.EVENT, EXTRA: PROBS.EVENT_EXTRA, CHOICE: PROBS.CHOICE, TALK: PROBS.PARTNER_TALK };
    PROBS.EVENT = 0; PROBS.EVENT_EXTRA = 0; PROBS.CHOICE = 0; PROBS.PARTNER_TALK = 0;
    try {
      S.life.house = 2; // 江景大平层 心情 +6 < 衰减 8 → 净 -2
      S.life.attrs.mood = 50;
      endDay();
      expect(S.life.attrs.mood).toBe(50 - LIFE.MOOD_DECAY + HOUSES[2].mood);
      S.life.house = 3; // 豪宅 +9 > 衰减 8 → 净 +1，钳到满值
      S.life.attrs.mood = 100;
      endDay();
      expect(S.life.attrs.mood).toBe(100);
    } finally { Object.assign(PROBS, old); }
  });
});
