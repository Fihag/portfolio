import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { defaultState, setState, S, load } from "../js/state.js";
import { EXAM, CERT_PCT, ACTIONS, PROBS } from "../js/config.js";
import { examRate, workSuccessRate, sampleWorkPay } from "../js/economy.js";
import { doAction, canDo } from "../js/life.js";
import { incomeMult, tierMult } from "../js/careers.js";

/* 风险与门槛：成功率公示、事故下限、考证（考试/面试的等价物） */
const P0 = { EVENT: PROBS.EVENT, EXTRA: PROBS.EVENT_EXTRA, CHOICE: PROBS.CHOICE, TALK: PROBS.PARTNER_TALK };
beforeEach(() => {
  setState(defaultState());
  PROBS.EVENT = 0; PROBS.EVENT_EXTRA = 0; PROBS.CHOICE = 0; PROBS.PARTNER_TALK = 0;
});
afterAll(() => Object.assign(PROBS, P0));

describe("成功率公示与抽样同源", () => {
  it("成功率 = 1 − 返工率 − 事故率，随技术上升且有天花板", () => {
    expect(workSuccessRate(0, 70)).toBeLessThan(workSuccessRate(50, 70));
    expect(workSuccessRate(50, 70)).toBeLessThan(workSuccessRate(100, 70));
    expect(workSuccessRate(100, 70)).toBeLessThan(1);       // 到顶也不是 100%
    expect(workSuccessRate(50, 20)).toBeLessThan(workSuccessRate(50, 70)); // 低心情更容易翻车
  });

  it("抽样落在成功率预期内（蒙特卡洛 ±3%）", () => {
    const rate = workSuccessRate(60, 70);
    let ok = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const r = sampleWorkPay(60, 70, 0, { mult: 1, riskMul: 1 });
      if (r.evt === "ok" || r.evt === "great") ok++;
    }
    expect(ok / N).toBeCloseTo(rate, 1);
  });
});

describe("考证：技能到线才稳过", () => {
  it("通过率随技术单调上升，钳在 [min,max]，低心情打折", () => {
    expect(examRate(0, 70)).toBeCloseTo(EXAM.base, 6);       // 技能 0 = 基准通过率
    expect(examRate(0, 10)).toBe(EXAM.min);                  // 低心情 + 无技能 → 触发地板
    expect(examRate(100, 70)).toBe(EXAM.max);                // 技能拉满 → 天花板
    expect(examRate(50, 70)).toBeGreaterThan(examRate(20, 70));
    expect(examRate(50, 10)).toBeLessThan(examRate(50, 70));
    for (const s of [0, 25, 50, 75, 100]) {
      const r = examRate(s, 70);
      expect(r).toBeGreaterThanOrEqual(EXAM.min);
      expect(r).toBeLessThanOrEqual(EXAM.max);
    }
  });

  it("通过：证书 +1、收入倍率提升、技能与心情奖励", () => {
    S.money = 5000;
    S.life.attrs.skill = 100; // 通过率封顶
    vi.spyOn(Math, "random").mockReturnValue(0); // 必过
    let r;
    try { r = doAction("cert1"); } finally { vi.restoreAllMocks(); }
    expect(r.ok).toBe(true);
    expect(S.life.certs).toBe(1);
    expect(r.line).toContain("通过");
    expect(incomeMult()).toBeCloseTo(tierMult() * (1 + CERT_PCT), 6);
    expect(S.life.attrs.skill).toBeGreaterThan(100 - 1e-9);
    expect(S.money).toBe(5000 - 300);
  });

  it("落榜：不退报名费、心情 -6、证书不加，且可以再来", () => {
    S.money = 5000;
    S.life.attrs.skill = 0; // 通过率地板
    vi.spyOn(Math, "random").mockReturnValue(0.99); // 必挂
    let r;
    try { r = doAction("cert1"); } finally { vi.restoreAllMocks(); }
    expect(r.line).toContain("没过");
    expect(S.life.certs).toBe(0);
    expect(S.money).toBe(4700);
    expect(S.life.attrs.mood).toBe(70 - 6);
    S.money = 5000;
    expect(canDo("cert1").ok).toBe(true); // 没有次数限制，只是要再花时间和钱
  });

  it("证书阶梯：高级/行业认证需要前置证书", () => {
    S.money = 10000;
    expect(canDo("cert2").ok).toBe(false);
    expect(canDo("cert2").reason).toContain("前 1 张证");
    expect(canDo("cert3").ok).toBe(false);
    S.life.certs = 1;
    expect(canDo("cert2").ok).toBe(true);
    expect(canDo("cert3").ok).toBe(false);
    S.life.certs = 2;
    expect(canDo("cert3").ok).toBe(true);
  });

  it("证书溢价直接乘进打工收入（同一次抽样只差倍率）", () => {
    const pay = (certs) => {
      setState(defaultState());
      S.money = 1000;
      S.life.certs = certs;
      S.life.attrs.stamina = 100;
      vi.spyOn(Math, "random").mockReturnValue(0.5); // ok 事件，倍率 1.0
      try { return Number(doAction("work").line.match(/¥([\d,]+)/)[1].replace(/,/g, "")); }
      finally { vi.restoreAllMocks(); }
    };
    const base = pay(0), boosted = pay(3);
    expect(boosted / base).toBeCloseTo(1 + 3 * CERT_PCT, 2);
  });

  it("考证卡都带 exam 标记与格数成本（不会变成白送）", () => {
    for (const id of ["cert1", "cert2", "cert3"]) {
      const a = ACTIONS.find(x => x.id === id);
      expect(a.exam).toBe(true);
      expect(a.slots).toBeGreaterThan(0);
      expect(a.money).toBeGreaterThan(0);
    }
  });

  it("证书随存档持久化，老档回填 0", () => {
    S.life.certs = 2;
    const raw = JSON.parse(JSON.stringify(S));
    delete raw.life.certs;
    localStorage.setItem("llmlife_v2", JSON.stringify(raw));
    expect(load().life.certs).toBe(0);
  });
});