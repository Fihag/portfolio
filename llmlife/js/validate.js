/* ================================================================
   LLMLife · 校验层 (validate.js)
   运行时轻量校验（浏览器）+ 导出供 Node 单测直接 import
   重点：卡面分数必须落在其稀有度分段内（AA v4.3 真实分一致性）
   ================================================================ */
import { MODELS, POOLS, MMAP, RARITY, RORDER, MILESTONES, EVENTS, ITEMS, ITEM_RARITY, BANNER_SEASONS, ENDINGS, ACTIONS } from "./config.js";

/**
 * 轻量校验，供浏览器启动时自检
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateConfig() {
  const errors = [];
  const ids = new Set();
  for (const m of MODELS) {
    if (!m.id || typeof m.id !== "string") errors.push(`Model 缺 id: ${JSON.stringify(m)}`);
    if (ids.has(m.id)) errors.push(`Model 重复 id: ${m.id}`);
    ids.add(m.id);
    if (!m.name) errors.push(`Model ${m.id} 缺 name`);
    if (!m.vendor) errors.push(`Model ${m.id} 缺 vendor`);
    if (typeof m.idx !== "number" || m.idx < 0 || m.idx > 100) errors.push(`Model ${m.id} idx 非法: ${m.idx}`);
    if (!RORDER.includes(m.r)) errors.push(`Model ${m.id} 稀有度非法: ${m.r}`);
    // 分档一致性: 真实分数必须落在其稀有度分段内（NB 彩蛋卡上限含边界）
    const band = RARITY[m.r];
    const inBand = m.r === "NB" ? (m.idx >= band.min && m.idx <= band.max) : (m.idx >= band.min && m.idx < band.max);
    if (!inBand) errors.push(`Model ${m.id} idx ${m.idx} 越出 ${m.r} 分段 [${band.min},${band.max})`);
  }
  for (const [k, p] of Object.entries(POOLS)) {
    const sum = Object.values(p.rates || {}).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.001) errors.push(`Pool ${k} rates 和非1: ${sum}`);
    const known = p.isItem ? new Set(ITEMS.map(i => i.id)) : new Set(MODELS.map(m => m.id));
    for (const fid of p.featured || []) if (!known.has(fid)) errors.push(`Pool ${k} featured 不存在: ${fid}`);
    for (const lid of p.limited || []) {
      if (!MMAP[lid]) errors.push(`Pool ${k} limited 不存在: ${lid}`);
      else if (!MMAP[lid].bannerOnly) errors.push(`Pool ${k} limited ${lid} 未标记 bannerOnly`);
    }
  }
  for (const b of BANNER_SEASONS) {
    for (const lid of b.limited || []) {
      if (!MMAP[lid]) errors.push(`赛季 ${b.id} limited 不存在: ${lid}`);
      else if (!MMAP[lid].bannerOnly) errors.push(`赛季 ${b.id} limited ${lid} 未标记 bannerOnly`);
    }
  }
  for (const r of RORDER) if (!RARITY[r]) errors.push(`RARITY 缺 ${r}`);
  if (EVENTS.length === 0) errors.push("EVENTS 为空");
  for (const e of EVENTS) {
    if (!e.id || !e.text) errors.push(`EVENT ${JSON.stringify(e)} 缺 id/text`);
    if (!e.weight || e.weight <= 0) errors.push(`EVENT ${e.id} weight 非法`);
  }
  const itemIds = new Set();
  for (const it of ITEMS) {
    if (!it.id || itemIds.has(it.id)) errors.push(`ITEM id 缺失或重复: ${it.id}`);
    itemIds.add(it.id);
    if (!ITEM_RARITY[it.r] || !ITEM_RARITY[it.r].includes(it.id)) errors.push(`ITEM ${it.id} 未登记进 ITEM_RARITY.${it.r}`);
    if (!it.effect && !it.special) errors.push(`ITEM ${it.id} 既无 effect 也无 special`);
  }
  if (MILESTONES.length === 0) errors.push("MILESTONES 为空");
  const ats = MILESTONES.filter(m => m.at != null);
  for (let i = 1; i < ats.length; i++) if (ats[i].at <= ats[i-1].at) errors.push(`MILESTONES 非递增: ${ats[i-1].id} -> ${ats[i].id}`);
  for (const m of MILESTONES) {
    if (m.at == null && typeof m.check !== "function") errors.push(`MILESTONES ${m.id} 既无 at 也无 check`);
  }
  for (let i = 1; i < ENDINGS.length; i++) if (ENDINGS[i].min >= ENDINGS[i-1].min) errors.push(`ENDINGS min 非严格递减: ${ENDINGS[i-1].id} -> ${ENDINGS[i].id}`);
  const actionIds = new Set(ACTIONS.map(a => a.id));
  if (actionIds.size !== ACTIONS.length) errors.push("ACTIONS id 重复");
  return { ok: errors.length === 0, errors };
}

// 浏览器启动自检（失败仅 console.error，不阻断）；结果同时导出供数据页展示
export const validateResult = (() => {
  try {
    const res = validateConfig();
    if (!res.ok) console.error("[validate] config errors:", res.errors);
    else console.debug("[validate] config ok", { models: MODELS.length, pools: Object.keys(POOLS).length, events: EVENTS.length, items: ITEMS.length });
    return res;
  } catch (e) {
    console.error("[validate] exception", e);
    return { ok: false, errors: [String(e)] };
  }
})();
