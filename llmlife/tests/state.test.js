import { describe, it, expect, beforeEach } from "vitest";
import { defaultState, setState, save, load, S, addLedger, logToday, dayLog } from "../js/state.js";
import { START_MONEY, SLOT_COUNT } from "../js/config.js";

describe("state 存档 v1", () => {
  beforeEach(() => {
    localStorage.clear();
    setState(defaultState());
  });

  it("defaultState 形状完整", () => {
    const s = defaultState();
    expect(s.money).toBe(START_MONEY);
    expect(s.life.day).toBe(1);
    expect(s.life.ap).toBe(3);
    expect(s.life.attrs.stamina).toBe(100);
    expect(s.slots).toHaveLength(SLOT_COUNT);
    expect(s.partners).toEqual([]);
    expect(s.stats.byR).toHaveProperty("NB");
    expect(s.ending).toBeNull();
  });

  it("save/load 回环，下划线派生字段不落盘", () => {
    S.money = 12345;
    logToday("测试日志");
    save();
    const raw = JSON.parse(localStorage.getItem("llmlife_v1"));
    expect(raw.money).toBe(12345);
    expect(raw._today).toBeUndefined();
    const loaded = load();
    expect(loaded).not.toBeNull();
    expect(loaded.money).toBe(12345);
  });

  it("load 缺字段时逐项兜底", () => {
    localStorage.setItem("llmlife_v1", JSON.stringify({ money: 500 }));
    const s = load();
    expect(s.money).toBe(500);
    expect(s.life.day).toBe(1);
    expect(s.pity.partner).toBe(0);
    expect(Array.isArray(s.slots)).toBe(true);
    expect(s.ver).toBe(1);
  });

  it("损坏存档返回 null 并回退默认档", () => {
    localStorage.setItem("llmlife_v1", "{broken json");
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
