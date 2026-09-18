import { describe, it, expect, beforeEach } from "vitest";
import { defaultState, setState, save, load, S, addLedger, logToday, dayLog } from "../js/state.js";
import { START_MONEY, SLOT_COUNT, LIFE } from "../js/config.js";

describe("state 存档 v2", () => {
  beforeEach(() => {
    localStorage.clear();
    setState(defaultState());
  });

  it("defaultState 形状完整", () => {
    const s = defaultState();
    expect(s.money).toBe(START_MONEY);
    expect(s.life.day).toBe(1);
    expect(s.life.restUsed).toBe(0);
    expect(s.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY);
    expect(s.life.attrs.stamina).toBe(100);
    expect(s.slots).toHaveLength(SLOT_COUNT);
    expect(s.partners).toEqual([]);
    expect(s.stats.byR).toHaveProperty("NB");
    expect(s.ending).toBeNull();
    expect(s.ng).toBe(0);
    expect(s.endingsSeen).toEqual({});
    expect(s.chStart.money).toBe(START_MONEY);
  });

  it("save/load 回环，下划线派生字段不落盘", () => {
    S.money = 12345;
    logToday("测试日志");
    save();
    const raw = JSON.parse(localStorage.getItem("llmlife_v2"));
    expect(raw.money).toBe(12345);
    expect(raw._today).toBeUndefined();
    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded.money).toBe(12345);
  });

  it("load 缺字段时逐项兜底", () => {
    localStorage.setItem("llmlife_v2", JSON.stringify({ money: 500 }));
    const s = load();
    expect(s.money).toBe(500);
    expect(s.life.day).toBe(1);
    expect(s.life.timeLeft).toBe(LIFE.SLOTS_PER_DAY); // 老档回填满格
    expect(s.pity.partner).toBe(0);
    expect(Array.isArray(s.slots)).toBe(true);
    expect(s.ver).toBe(2);
    expect(s.ng).toBe(0);
    expect(s.endingsSeen).toEqual({});
    expect(s.chStart.money).toBe(START_MONEY);
  });

  it("v1 旧档迁移：只携带收集进度并提示一次", () => {
    localStorage.setItem("llmlife_v1", JSON.stringify({
      money: 99999, dex: { "glm-5-3": 2 }, skinsOwned: ["classic", "night"],
      skinTickets: 3, skin: "night", flags: { ms: { m2k: true }, muted: true },
    }));
    const s = load();
    expect(s.money).toBe(START_MONEY); // 数值清零重开
    expect(s.life.day).toBe(1);
    expect(s.dex["glm-5-3"]).toBe(2);  // 图鉴继承
    expect(s.skinsOwned).toContain("night");
    expect(s.skin).toBe("night");
    expect(s.skinTickets).toBe(3);
    expect(s.flags.ms.m2k).toBe(true);  // 成就标记继承
    expect(s.flags.muted).toBe(true);
    expect(s.flags.migrated).toBe(true); // 一次性迁移提示
  });

  it("损坏存档返回 null 并回退默认档", () => {
    localStorage.setItem("llmlife_v2", "{broken json");
    expect(load()).toBeNull();
  });

  it("setState 同步 live binding，账本与日志限量", () => {
    const fresh = defaultState();
    fresh.money = 777;
    setState(fresh);
    expect(S.money).toBe(777);
    for (let i = 0; i < 100; i++) addLedger(`条目${i}`, i);
    expect(S.ledger.length).toBe(80);
    for (let i = 0; i < 50; i++) logToday(`行${i}`);
    expect(dayLog().length).toBe(40);
  });
});
