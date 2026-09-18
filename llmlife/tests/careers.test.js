import { describe, it, expect, beforeEach, vi } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { careerOf, tierMult, netWorth, meetsReq, reqText, tryPromote, stayPut } from "../js/careers.js";
import { canDo, doAction } from "../js/life.js";
import { CAREERS, PROBS } from "../js/config.js";

function fresh(){ setState(defaultState()); return S; }

describe("职业晋升", () => {
  beforeEach(fresh);

  it("默认实习生，倍率 ×1.0", () => {
    expect(careerOf().name).toBe("实习生");
    expect(tierMult()).toBe(1);
    expect(S.life.tier).toBe(0);
  });

  it("高职级行动卡职级不足时禁止执行并给出晋升提示", () => {
    expect(canDo("overtime").ok).toBe(false);
    expect(canDo("overtime").reason).toContain("正式员工");
    expect(canDo("work").ok).toBe(true);
    S.life.tier = 1;
    expect(canDo("overtime").ok).toBe(true);
    expect(canDo("bigorder").ok).toBe(false); // 骨干卡仍锁定
  });

  it("晋升门槛：技能/魅力/净资产逐项判定", () => {
    expect(meetsReq(1)).toBe(false); // skill 5 < 30
    S.life.attrs.skill = 30;
    expect(meetsReq(1)).toBe(true);
    expect(meetsReq(2)).toBe(false);
    S.life.attrs.skill = 55; S.life.attrs.charm = 25;
    expect(meetsReq(2)).toBe(true);
    S.life.attrs.skill = 85; S.life.attrs.charm = 45; S.money = 29999;
    expect(meetsReq(4)).toBe(false); // 净资产差 ¥1
    S.money = 30000;
    expect(netWorth()).toBe(30000);
    expect(meetsReq(4)).toBe(true);
    expect(meetsReq(5)).toBe(false); // 超出职级表
  });

  it("reqText 用 ✓/✗ 呈现现状", () => {
    S.life.attrs.skill = 20;
    const t = reqText(1);
    expect(t).toContain("技术");
    expect(t).toContain("20/30✗");
    S.life.attrs.skill = 30;
    expect(reqText(1)).toContain("✓");
  });

  it("tryPromote 逐级晋升并播报解锁，条件不足拒绝", () => {
    expect(tryPromote().ok).toBe(false);
    S.life.attrs.skill = 30;
    const r = tryPromote();
    expect(r.ok).toBe(true);
    expect(S.life.tier).toBe(1);
    expect(r.line).toContain("正式员工");
    expect(r.line).toContain("×1.35");
    expect(r.line).toContain("加班冲刺");
    expect(tryPromote().ok).toBe(false); // 骨干门槛未达，不能连跳
    expect(S.life.tier).toBe(1);
  });

  it("顶格后 tryPromote 提示已是最高职级", () => {
    S.life.tier = CAREERS.length - 1;
    const r = tryPromote();
    expect(r.ok).toBe(false);
    expect(r.line).toContain("最高职级");
  });

  it("stayPut 沉淀补偿技术+3 心情+10", () => {
    S.life.attrs.skill = 20; S.life.attrs.mood = 20;
    const r = stayPut();
    expect(r.ok).toBe(true);
    expect(S.life.attrs.skill).toBe(23);
    expect(S.life.attrs.mood).toBe(30);
  });

  it("职级倍率进入打工结算：晋升后同参数收入 ×1.35", () => {
    PROBS.EVENT = 0;
    vi.spyOn(Math, "random").mockReturnValue(0.5); // 固定走 ok 事件中点
    const r1 = doAction("work");
    const amt1 = Number(r1.line.match(/¥([\d,.]+)/)[1].replace(/,/g, ""));
    S.life.tier = 1;
    S.life.attrs.stamina = 100;
    const r2 = doAction("work");
    const amt2 = Number(r2.line.match(/¥([\d,.]+)/)[1].replace(/,/g, ""));
    expect(amt2 / amt1).toBeCloseTo(1.35, 2);
    vi.restoreAllMocks();
  });
});
