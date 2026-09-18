import { describe, it, expect } from "vitest";
import {
  MODELS, MMAP, RARITY, POOLS, BANNER_SEASONS, ITEMS, ITEM_RARITY,
  EVENTS, MILESTONES, ENDINGS, ACTIONS, VENDOR_EFFECTS, DEFAULT_EFFECT, EFFECTS,
  LIFE, CHAPTER_TITLES, CAREERS, GOAL_POOL, WEEK_STAT_KEYS, CHOICE_EVENTS,
} from "../js/config.js";
import { validateConfig } from "../js/validate.js";

describe("roster (AA v4.3 精选名单)", () => {
  it("模型 id 唯一且 55 张", () => {
    expect(MODELS.length).toBe(55);
    expect(new Set(MODELS.map(m => m.id)).size).toBe(55);
  });
  it("每张非 NB 卡的真实分数落在其稀有度分段内", () => {
    for (const m of MODELS) {
      const band = RARITY[m.r];
      if (m.r === "NB") {
        expect(m.idx).toBeGreaterThanOrEqual(band.min);
        expect(m.idx).toBeLessThanOrEqual(band.max);
      } else {
        expect(m.idx, `${m.id} idx=${m.idx} r=${m.r}`).toBeGreaterThanOrEqual(band.min);
        expect(m.idx, `${m.id} idx=${m.idx} r=${m.r}`).toBeLessThan(band.max);
      }
    }
  });
  it("指定 8 卡落在第一/第二梯队", () => {
    expect(MMAP["claude-fable-5-1"].r).toBe("UTR");
    expect(MMAP["gpt-6-astra"].r).toBe("UTR");
    expect(MMAP["muse-spark-1-3"].r).toBe("UTR");
    expect(MMAP["glm-5-3"].r).toBe("UR");
    expect(MMAP["glm-5-3-flash"].r).toBe("UR");
    expect(MMAP["gemini-3-8-flash"].r).toBe("SSR");
    expect(MMAP["qwen3-8-flash-next"].r).toBe("SSR");
    expect(MMAP["deepseek-v4-1-flash"].r).toBe("SSR");
  });
  it("三张限定卡 bannerOnly 且为三赛季镇池", () => {
    const bannerOnly = MODELS.filter(m => m.bannerOnly).map(m => m.id).sort();
    expect(bannerOnly).toEqual(["claude-fable-5-1", "gpt-6-astra", "muse-spark-1-3"]);
    expect(BANNER_SEASONS.length).toBe(3);
    BANNER_SEASONS.forEach((s, i) => {
      expect(s.limited.length).toBe(1);
      expect(MMAP[s.limited[0]].bannerOnly).toBe(true);
      expect(s.limited[0]).toBe(bannerOnly[i]);
    });
  });
  it("卡面成本与速度字段齐备", () => {
    for (const m of MODELS) {
      expect(typeof m.cost).toBe("string");
      expect(m.cost.length).toBeGreaterThan(0);
      expect(m.spd).toBeGreaterThanOrEqual(0);
      expect(typeof m.quote).toBe("string");
    }
  });
  it("全量 validateConfig 通过", () => {
    const res = validateConfig();
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });
});

describe("卡池与道具数据", () => {
  it("三池概率和为 1", () => {
    for (const [k, p] of Object.entries(POOLS)) {
      const sum = Object.values(p.rates).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1), `pool ${k}`).toBeLessThan(0.001);
    }
  });
  it("道具与 ITEM_RARITY 双向登记一致", () => {
    const flat = Object.values(ITEM_RARITY).flat();
    for (const it of ITEMS) expect(flat).toContain(it.id);
    for (const id of flat) expect(ITEMS.some(i => i.id === id)).toBe(true);
    expect(ITEMS.length).toBeGreaterThanOrEqual(20);
  });
  it("事件表 weight 为正且数量充足（chainOnly 后续事件除外）", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(18);
    for (const e of EVENTS) {
      if (e.chainOnly) continue;
      expect(e.weight).toBeGreaterThan(0);
    }
    // chainOnly 事件只经后果链注入
    expect(EVENTS.filter(e => e.chainOnly).length).toBeGreaterThanOrEqual(5);
  });
  it("分支选择事件齐备且链目标可解析", () => {
    expect(CHOICE_EVENTS.length).toBeGreaterThanOrEqual(10);
    const all = new Set(EVENTS.map(e => e.id));
    for (const e of CHOICE_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of e.choices) if (c.after) expect(all.has(c.after.ev) || CHOICE_EVENTS.some(x => x.id === c.after.ev)).toBe(true);
    }
  });
  it("结局阈值严格递减", () => {
    for (let i = 1; i < ENDINGS.length; i++) expect(ENDINGS[i].min).toBeLessThan(ENDINGS[i - 1].min);
  });
  it("行动 id 唯一", () => {
    expect(new Set(ACTIONS.map(a => a.id)).size).toBe(ACTIONS.length);
  });
});

describe("厂商效果映射", () => {
  it("映射值全部是合法效果类型", () => {
    for (const v of Object.values(VENDOR_EFFECTS)) expect(EFFECTS[v]).toBeDefined();
    expect(EFFECTS[DEFAULT_EFFECT]).toBeDefined();
  });
  it("指定 8 卡的厂商效果类型符合设计", () => {
    expect(VENDOR_EFFECTS[MMAP["claude-fable-5-1"].vendor]).toBe("work");
    expect(VENDOR_EFFECTS[MMAP["deepseek-v4-1-flash"].vendor]).toBe("learn");
    expect(VENDOR_EFFECTS[MMAP["qwen3-8-flash-next"].vendor]).toBe("learn");
    expect(VENDOR_EFFECTS[MMAP["glm-5-3"].vendor]).toBe("dual");
    expect(VENDOR_EFFECTS[MMAP["gemini-3-8-flash"].vendor]).toBe("stamina");
    expect(VENDOR_EFFECTS[MMAP["muse-spark-1-3"].vendor]).toBe("mood");
    expect(VENDOR_EFFECTS[MMAP["gpt-6-astra"].vendor]).toBe("charm");
  });
});

describe("章节制常量", () => {
  it("22→30 共 8 章，每章 24 天，章标题数与章数一致", () => {
    expect(LIFE.START_AGE).toBe(22);
    expect(LIFE.RETIRE_AGE).toBe(30);
    expect(LIFE.CHAPTER_DAYS).toBe(24);
    expect(CHAPTER_TITLES.length).toBe(LIFE.RETIRE_AGE - LIFE.START_AGE);
  });
  it("结局阈值严格递减且含 0 分兜底档", () => {
    expect(ENDINGS[ENDINGS.length - 1].min).toBe(0);
    for (let i = 1; i < ENDINGS.length; i++) expect(ENDINGS[i].min).toBeLessThan(ENDINGS[i - 1].min);
  });
});

describe("职业与周目标数据（阶段 2）", () => {
  it("职级连续、薪资倍率单调增、仅 0 级无门槛", () => {
    CAREERS.forEach((c, i) => {
      expect(c.tier).toBe(i);
      if (i > 0) {
        expect(c.mult).toBeGreaterThan(CAREERS[i - 1].mult);
        expect(c.req).toBeTruthy();
      } else {
        expect(c.req).toBe(null);
        expect(c.mult).toBe(1);
      }
    });
    expect(CAREERS.length).toBe(5);
  });
  it("行动卡按职级分布：实习 11 张（含吃饭/考证）、后续每级 2 张", () => {
    expect(ACTIONS.length).toBe(19);
    for (let t = 0; t < CAREERS.length; t++) {
      expect(ACTIONS.filter(a => (a.tier || 0) === t).length).toBe(t === 0 ? 11 : 2);
    }
    for (const a of ACTIONS) expect(a.tier || 0).toBeLessThan(CAREERS.length);
    // 每张卡都要吃到时间格预算，且有一条需求/体力成本，否则就是白送的点击
    for (const a of ACTIONS) expect(a.slots).toBeGreaterThan(0);
    // 工作类卡必须带倍率语义
    expect(ACTIONS.find(a => a.id === "overtime").workMult).toBeGreaterThan(1);
    expect(ACTIONS.find(a => a.id === "overtime").riskMul).toBeGreaterThan(1);
    expect(ACTIONS.find(a => a.id === "overtime").health).toBeLessThan(0); // 高压行动的代价
    expect(ACTIONS.find(a => a.id === "lecture").fee[1]).toBeGreaterThan(ACTIONS.find(a => a.id === "lecture").fee[0]);
    // 吃饭两条线：便宜的补饱食、贵的补心情
    expect(ACTIONS.find(a => a.id === "eat").satiety).toBeGreaterThan(0);
    expect(ACTIONS.find(a => a.id === "dine").mood).toBeGreaterThan(0);
  });
  it("周目标模板 stat 全部登记在 WEEK_STAT_KEYS，minTier 不越职级上限", () => {
    expect(new Set(GOAL_POOL.map(g => g.id)).size).toBe(GOAL_POOL.length);
    for (const g of GOAL_POOL) {
      expect(WEEK_STAT_KEYS, g.id).toContain(g.stat);
      expect(g.target).toBeGreaterThan(0);
      expect(Object.keys(g.reward).length).toBeGreaterThan(0);
      expect(g.minTier || 0).toBeLessThan(CAREERS.length);
    }
    // 每个行动 id 都有对应周计数键
    for (const a of ACTIONS) expect(WEEK_STAT_KEYS).toContain(a.id);
  });
});
