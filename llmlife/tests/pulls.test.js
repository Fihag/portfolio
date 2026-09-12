import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { defaultState, setState, S } from "../js/state.js";
import { PROBS, POOLS, LIMITED_IDS, MMAP, RARITY } from "../js/config.js";
import { syncBanner, bannerSlot, bannerCountdownText } from "../js/banner.js";
import { drawRarity, doPulls } from "../js/pulls.js";

function fresh(){
  localStorage.clear();
  setState(defaultState());
  syncBanner();
}

describe("赛季轮换 (banner.js)", () => {
  beforeEach(fresh);

  it("三赛季按时间轮换，当前限定集合同步", () => {
    const slot = bannerSlot();
    expect(POOLS.banner._seasonId).toBe(slot.season.id);
    expect(LIMITED_IDS.has(slot.season.limited[0])).toBe(true);
    expect(LIMITED_IDS.size).toBe(1);
  });

  it("倒计时文本随赛季生成", () => {
    expect(bannerCountdownText()).toContain("剩余");
  });
});

describe("抽卡核心 (pulls.js)", () => {
  beforeEach(() => {
    fresh();
    PROBS.EVENT = 0;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    PROBS.NEWBIE = 0.015;
    PROBS.FIHAG = 0.0001;
    PROBS.HALLUC = 0.002;
  });

  it("保底触发: 伙伴池 60 抽必出 SSR+", () => {
    S.pity.partner = 59;
    const r = drawRarity("partner");
    expect(["SSR","UR"]).toContain(r);
    const results = doPulls("partner", 1);
    expect(["SSR","UR"]).toContain(results[0].rarity);
    expect(S.pity.partner).toBe(0);
  });

  it("限定池大保底必出当期限定 UTR", () => {
    S.pity.banner = 99;
    const results = doPulls("banner", 1);
    expect(results[0].rarity).toBe("UTR");
    expect(LIMITED_IDS.has(results[0].id)).toBe(true);
    expect(S.pity.banner).toBe(0);
  });

  it("十连无 SR+ 时第 10 张强制补底 SR（Math.random 钉 0.5 → 全 R）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const results = doPulls("partner", 10);
    const rs = results.map(r=>r.rarity);
    expect(rs.slice(0,9).every(x=>x==="R")).toBe(true);
    expect(rs[9]).toBe("SR");
    expect(results[9]._bottom).toBe(true);
    expect(S.pity.partner).toBe(0); // 补底实际出货 SR+，保底计数清零（同 tokengacha）
  });

  it("普通池 SSR+ 清零保底计数", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.02); // 高→低累加: NB0/UTR.012/UR.045 → 0.02 命中 UR
    const results = doPulls("partner", 1);
    expect(results[0].rarity).toBe("UR");
    expect(S.pity.partner).toBe(0);
  });

  it("新秀独立爆率钉满 → 全出 DeepSeek V4.1 Flash", () => {
    PROBS.NEWBIE = 1;
    const results = doPulls("partner", 5);
    expect(results.every(r=>r.id==="deepseek-v4-1-flash")).toBe(true);
    expect(S.partners.length).toBe(1); // 同卡去重
    expect(S.partners[0].favor).toBe(40); // 4 张重复 ×10
  });

  it("Fihag NB 全池隐藏出货", () => {
    PROBS.FIHAG = 1;
    const results = doPulls("partner", 3);
    expect(results.every(r=>r.id==="fihagv1" && r.rarity==="NB")).toBe(true);
    expect(S.stats.byR.NB).toBe(3);
    expect(S.dex.fihagv1).toBe(3);
    expect(S.pity.partner).toBe(0); // NB 清零
  });

  it("幻觉彩蛋: 伪装 UR 揭晓为 R 且不清保底", () => {
    PROBS.HALLUC = 1;
    vi.spyOn(Math, "random").mockReturnValue(0.2); // 0.2 → N 档（非 UR）
    const results = doPulls("partner", 1);
    expect(results[0].rarity).toBe("R");
    expect(results[0]._halluc).toBeDefined();
    expect(RARITY[MMAP[results[0]._halluc].r].name).toBeTruthy();
    expect(S.pity.partner).toBe(1); // R 不清零
  });

  it("道具池出货为道具并累计 pity", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3); // item 累加: UR.005/SSR.05/SR.2/R.5 → 0.3 命中 R
    const results = doPulls("item", 10);
    expect(results.every(r=>r.kind==="item")).toBe(true);
    expect(results.every(r=>r.rarity==="R")).toBe(true);
    const total = S.items.reduce((s,x)=>s+x.qty,0);
    expect(total).toBe(10);
    expect(S.pity.item).toBe(10);
  });

  it("道具池保底 30 抽出 SR+", () => {
    S.pity.item = 29;
    const r = drawRarity("item");
    expect(["SR","UR"]).toContain(r);
  });

  it("结算完整性: 抽数=图鉴=hist=byR 总和", () => {
    doPulls("partner", 10);
    const dexSum = Object.values(S.dex).reduce((a,b)=>a+b,0);
    expect(dexSum).toBe(10);
    expect(S.stats.pulls).toBe(10);
    expect(S.hist.length).toBe(10);
    const byRSum = Object.values(S.stats.byR).reduce((a,b)=>a+b,0);
    expect(byRSum).toBe(10);
    expect(S.partners.length).toBeGreaterThan(0);
  });
});
