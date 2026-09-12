import { describe, it, expect } from "vitest";
import {
  payoutParams, workPayEvents, expectedWorkPay, sampleWorkPay,
} from "../js/economy.js";
import { LIFE, PAY_BOOST, skillMult, moodMult } from "../js/config.js";

describe("payoutParams（v4.3 重标梯度）", () => {
  it("大成功概率随技术单调不减，端点对齐设计值", () => {
    let prev = -1;
    for (let s = 0; s <= 100; s += 10) {
      const p = payoutParams(s, 70);
      expect(p.pGreat).toBeGreaterThanOrEqual(prev);
      prev = p.pGreat;
    }
    expect(payoutParams(0, 70).pGreat).toBeCloseTo(0.02, 6);
    expect(payoutParams(100, 70).pGreat).toBeCloseTo(0.11, 6);
  });
  it("返工概率随技术单调不增，钳制在 [0.04, 0.3]", () => {
    let prev = 1;
    for (let s = 0; s <= 100; s += 10) {
      const p = payoutParams(s, 70);
      expect(p.pRework).toBeLessThanOrEqual(prev);
      prev = p.pRework;
      expect(p.pRework).toBeGreaterThanOrEqual(0.04);
      expect(p.pRework).toBeLessThanOrEqual(0.3);
    }
  });
  it("生产事故只属于低技术区，且低心情加重惩罚", () => {
    expect(payoutParams(50, 70).pDisaster).toBe(0);
    expect(payoutParams(0, 70).pDisaster).toBeGreaterThan(0);
    expect(payoutParams(10, 20).pRework).toBeGreaterThan(payoutParams(10, 70).pRework);
    expect(payoutParams(10, 20).pDisaster).toBeGreaterThan(payoutParams(10, 70).pDisaster);
  });
  it("概率和不超过 1", () => {
    for (let s = 0; s <= 100; s += 5) {
      const p = payoutParams(s, 10); // 最低心情最坏情况
      expect(p.pGreat + p.pRework + p.pDisaster).toBeLessThanOrEqual(1);
    }
  });
  it("倍率与惩罚保持 tokengacha 手感", () => {
    const p = payoutParams(50, 70);
    expect(p.mult).toEqual({ great: 2.5, rework: 0.4 });
    expect(p.disasterPenalty).toBeCloseTo(50 * PAY_BOOST, 6);
    expect(p.okRange).toEqual([0.85, 1.15]);
  });
});

describe("期望同源（expectedWorkPay ≡ sampleWorkPay 抽样公式）", () => {
  it("固定结算额公式正确", () => {
    const ev = workPayEvents(40, 70, 0.3);
    const base = LIFE.WORK_BASE * skillMult(40) * moodMult(70) * 1.3;
    expect(ev.ok).toBeCloseTo(base * 1.0 * PAY_BOOST, 6);
    expect(ev.great).toBeCloseTo(base * 2.5 * PAY_BOOST, 6);
    expect(ev.rework).toBeCloseTo(base * 0.4 * PAY_BOOST, 6);
    expect(ev.disaster).toBeCloseTo(-50 * PAY_BOOST, 6);
  });
  it("期望随技术单调不减", () => {
    let prev = -Infinity;
    for (let s = 10; s <= 100; s += 10) {
      const ev = expectedWorkPay(s, 70, 0);
      expect(ev).toBeGreaterThan(prev);
      prev = ev;
    }
  });
  it("期望随伙伴加成单调不减", () => {
    expect(expectedWorkPay(40, 70, 0.3)).toBeGreaterThan(expectedWorkPay(40, 70, 0));
  });
  it("蒙特卡洛抽样收敛到解析期望（±3%）", () => {
    const skill = 35, mood = 70, boost = 0.2;
    const analytic = expectedWorkPay(skill, mood, boost);
    let sum = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) sum += sampleWorkPay(skill, mood, boost).amt;
    const mc = sum / N;
    expect(Math.abs(mc - analytic) / analytic).toBeLessThan(0.03);
  });
});
