#!/usr/bin/env node
/* ================================================================
   LLMLife · 卡池名单生成器 (tools/build-roster.mjs, 零依赖)
   从 Artificial Analysis Intelligence Index JSON 按精选表生成
   MODELS 数组，重写 js/config.js 的标记区（稀有度按 v4.3 分段
   由分数自动落档，卡面价格/速度取真实数据，quote 走本表）。

   用法: node tools/build-roster.mjs [index.json 路径]
   默认数据源: D:/agent/cc/aa_intelligence_index.json
   榜单更新后重跑即可刷新名单（分数变化会自动重算稀有度）。
   ================================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = process.argv[2] || "D:/agent/cc/aa_intelligence_index.json";

/* ---------- v4.3 稀有度分段（与 config.js RARITY.min/max 保持一致，测试兜底校验） ---------- */
const BANDS = [
  { r: "UTR", min: 47 },
  { r: "UR", min: 41.8 },
  { r: "SSR", min: 39 },
  { r: "SR", min: 35 },
  { r: "R", min: 31 },
  { r: "N", min: 0 },
];
const bandOf = (idx) => BANDS.find((b) => idx >= b.min).r;

/* ---------- 厂商 → lobehub 图标 slug ---------- */
const VENDOR_ICONS = {
  Anthropic: "claude-color",
  OpenAI: "openai",
  Google: "gemini-color",
  "Z AI": "zai",
  Alibaba: "qwen-color",
  DeepSeek: "deepseek-color",
  Meta: "meta-color",
  SpaceXAI: "grok",
  Kimi: "moonshot",
  MiniMax: "minimax-color",
  Xiaomi: "xiaomimimo",
  Mistral: "mistral-color",
  NVIDIA: "nvidia-color",
};

/* ---------- 精选表: slug → { name, quote, icon? }（名单与文案的唯一人工源） ---------- */
const CURATED = {
  // ==== UTR 神话 ≥47（三张赛季限定 + 三张常驻神话）====
  "claude-fable-5-1": { name: "Claude Fable 5.1", quote: "限定·v4.3 重标后 53.4 分全场登基。写作 Fable，读作「每月自发更新」" },
  "gpt-6-astra": { name: "GPT-6 Astra", quote: "限定·52.8 分的星空旗舰，Astra 是星，价格也是天文数字" },
  "muse-spark-1-3": { name: "Muse Spark 1.3", quote: "限定·48.2 分还能跑 223 tok/s，4.25 刀/M，性价比神话" },
  "claude-opus-5": { name: "Claude Opus 5", quote: "63 分时代的榜一，重定标后依然前十——瘦死的骆驼比马大" },
  "claude-fable-5": { name: "Claude Fable 5", quote: "上一代传奇，自带 Opus 4.8 备胎上场，家族内卷第一名" },
  "gpt-5-6-sol": { name: "GPT-5.6 Sol", quote: "Sol 是太阳，照到哪里哪里亮，就是账单也亮" },
  // ==== UR 传说 41.8~47 ====
  "glm-5-3": { name: "GLM-5.3", quote: "后训练仙人正统续作，44.9 分开源天花板，4.4 刀/M 比良心还便宜" },
  "grok-4-6-xhigh": { name: "Grok 4.6", quote: "马斯克：这次真的是地表最强（xhigh 档），下次一定还是这句" },
  "kimi-k3": { name: "Kimi K3", quote: "月之暗面杀进 UR，国产之光 +1，就是 42 tok/s 有点慢性子" },
  "gpt-5-6-terra": { name: "GPT-5.6 Terra", quote: "Terra 是大地，稳重输出型选手，速度智商两开花" },
  "claude-opus-4-8": { name: "Claude Opus 4.8", quote: "Fable 5 的御用备胎，戏份不多但每场都在" },
  "glm-5-3-flash": { name: "GLM-5.3-Flash", quote: "0.5 刀/M 的闪电仙人，120 tok/s，白嫖党与生产环境共同的挚爱" },
  // ==== SSR 史诗 39~41.8 ====
  "gemini-3-8-flash": { name: "Gemini 3.8 Flash", quote: "278 tok/s 的谷歌闪电侠，3.75 刀/M，闪得你看不清扣费明细" },
  "claude-opus-4-7": { name: "Claude Opus 4.7", quote: "4.8 的哥哥，5 的叔叔，Claude 家族族谱最忙碌的一支" },
  "qwen3-8-max": { name: "Qwen3.8 Max", quote: "通义顶配 Max，阿里含泪开源的排面担当" },
  "qwen3-8-2-4t-a95b": { name: "Qwen3.8 2.4T A95B", quote: "2.4 万亿参数 95B 激活，名字比卡面还长" },
  "qwen3-8-flash-next": { name: "Qwen3.8-Flash-Next", quote: "0.47 刀/M 的下一代 Flash，性价比卷到没有对手" },
  "muse-spark-1-2": { name: "Muse Spark 1.2", quote: "上一代缪斯，1.3 出来后主动让出 C 位" },
  "deepseek-v4-1-flash": { name: "DeepSeek V4.1 Flash", quote: "0910 刚发布的新秀，1.2 刀/M 跑 285 tok/s，性价比正统" },
  "gemini-3-7-flash": { name: "Gemini 3.7 Flash", quote: "3.6 → 3.7 → 3.8，谷歌把 Flash 系列做成了连续剧" },
  "grok-4-5": { name: "Grok 4.5", quote: "4.6 的前传，马斯克：地表最强（上一代）" },
  // ==== SR 精锐 35~39 ====
  "gpt-5-4": { name: "GPT-5.4", quote: "5.5 的哥哥，重定标受害者联盟荣誉会员" },
  "gpt-5-5": { name: "GPT-5.5", quote: "发布时 56 分的 UR，重定标后 38.6 分守 SR——分数没变，是天变了" },
  "claude-sonnet-5": { name: "Claude Sonnet 5", quote: "打工人标配，Opus 太贵时的体面选择" },
  "gpt-5-6-luna": { name: "GPT-5.6 Luna", quote: "Luna 是月亮，1.2 刀/M 静静发光，价格也温柔" },
  "deepseek-v4-pro": { name: "DeepSeek V4 Pro 0813", quote: "开源上桌的中坚力量，定价是门艺术" },
  "agnes-3-0-flash": { name: "Agnes 3.0 Flash", quote: "0.15 刀/M 全场最便宜一档，Agnes 家族的黑马" },
  "agnes-2-5-pro-beta": { name: "Agnes 2.5 Pro", quote: "Beta 还在跑，3.0 已经发布——家族内卷 ×2" },
  "deepseek-v4-flash-vision": { name: "DeepSeek V4 Flash Vision", quote: "带眼睛的 Flash，多模态白菜价" },
  // ==== R 普通 31~35 ====
  "deepseek-v4-flash": { name: "DeepSeek V4 Flash 0731", quote: "0731 老兵，v4.1.1 时代 52 分 SSR，重定标后跌进 R 档——见证历史" },
  "gemini-3-6-flash": { name: "Gemini 3.6 Flash", quote: "Flash 连续剧第三季，剧情开始重复" },
  "muse-spark-1-1": { name: "Muse Spark 1.1", quote: "缪斯初代目，粉丝口中「最有力的一版」" },
  "glm-5-2": { name: "GLM-5.2", quote: "仙人前传的前传，53 分时代是 SSR，如今在 R 档发光发热" },
  "qwen3-8-27b": { name: "Qwen3.8 27B", quote: "27B 开源小钢炮，本地部署党的无限火力" },
  "motif-3": { name: "Motif 3", quote: "匿名研究室的神秘作品，榜上有名但查无此人" },
  "gemini-3-5-flash": { name: "Gemini 3.5 Flash", quote: "Flash 连续剧第二季，已经没人记得第一季" },
  "gpt-5-3-codex": { name: "GPT-5.3 Codex", quote: "专精写代码的分支，改 bug 依旧靠运气" },
  "kimi-k2-6": { name: "Kimi K2.6", quote: "K3 的弟弟，重定标后和哥哥隔了一个宇宙" },
  "muse-spark": { name: "Muse Spark", quote: "缪斯零代目，收藏价值大于实用价值" },
  // ==== N 路人 <31 ====
  "deepseek-v4-pro-0424": { name: "DeepSeek V4 Pro 0424", quote: "0424 老版本，API 下架前最后的高光" },
  "k2-horizon-375b-a23b": { name: "K2 Horizon 375B", quote: "375B 参数 23B 激活，名字长到卡面放不下" },
  "claude-sonnet-4-6-adaptive": { name: "Claude Sonnet 4.6", quote: "Adaptive 变形金刚版，聪明是聪明，就是辈分有点乱" },
  "gpt-5-2": { name: "GPT-5.2", quote: "曾经的旗舰，如今在 N 档教新模型做人" },
  "apodex-1-1": { name: "Apodex 1.1", quote: "又一家新厂商，行业门槛：起个没人听过的名字" },
  "gemini-3-1-pro-preview": { name: "Gemini 3.1 Pro", quote: "Preview 了一辈子，也没等来正式版" },
  "qwen3-7-max": { name: "Qwen3.7 Max", quote: "上一代通义顶配，退休返聘中" },
  "minimax-m3": { name: "MiniMax-M3", quote: "海螺家的 M3，名字很 Mini，参数可不 Mini" },
  "claude-opus-4-5-thinking": { name: "Claude Opus 4.5", quote: "2025 年的 45 分神话，2026 年的 N 档化石" },
  "mimo-v2-pro": { name: "MiMo-V2-Pro", quote: "雷军家的 Pro，为发烧而生" },
  "qwen3-6-max": { name: "Qwen3.6 Max Preview", quote: "Preview 家族再添一员" },
  "glm-5": { name: "GLM-5", quote: "仙人出道作，如今在 N 档带新人" },
  "gemini-3-pro": { name: "Gemini 3 Pro", quote: "27.9 分的前顶配，Preview 之名贯彻始终" },
  "gpt-5-1": { name: "GPT-5.1", quote: "v4.1.1 时代 37.5 分，重定标后 24.7 分——跌得最惨的一集" },
  "gpt-5": { name: "GPT-5", quote: "2025 年的皇帝，博物馆新馆长" },
};

/* ---------- 限定池镇池（BANNER_SEASONS 的 limited 引用同名 id） ---------- */
const BANNER_ONLY = new Set(["claude-fable-5-1", "gpt-6-astra", "muse-spark-1-3"]);

/* ---------- 读取榜单 ---------- */
if (!fs.existsSync(srcPath)) {
  console.error(`✗ 找不到指数数据: ${srcPath}（可传参指定路径）`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(srcPath, "utf8"));
const bySlug = new Map(data.models.map((m) => [m.slug, m]));

/* ---------- 生成 MODELS 条目（稀有度高→低排序） ---------- */
const entries = [];
const missing = [];
for (const [slug, cur] of Object.entries(CURATED)) {
  const m = bySlug.get(slug);
  if (!m) {
    missing.push(slug);
    continue;
  }
  const idx = m.intelligenceIndex;
  const r = bandOf(idx);
  const price = m.price1mOutputTokens;
  const spd = m.medianCanonicalAnswerOutputSpeed;
  const cost = price == null ? "开源" : `$${price < 1 ? price.toFixed(2) : price.toFixed(2)}/M出`;
  entries.push({
    id: slug,
    name: cur.name,
    vendor: m.creatorName,
    icon: cur.icon ?? VENDOR_ICONS[m.creatorName] ?? null,
    idx: Math.round(idx * 100) / 100,
    r,
    bannerOnly: BANNER_ONLY.has(slug) || undefined,
    cost,
    spd: spd == null ? 0 : Math.round(spd),
    quote: cur.quote,
  });
}
if (missing.length) {
  console.error(`✗ 精选表 slug 在榜单中不存在: ${missing.join(", ")}`);
  process.exit(1);
}
const RORDER_DESC = ["UTR", "UR", "SSR", "SR", "R", "N"];
entries.sort(
  (a, b) => RORDER_DESC.indexOf(a.r) - RORDER_DESC.indexOf(b.r) || b.idx - a.idx
);

/* ---------- 重写 config.js 标记区 ---------- */
const cfgPath = path.join(root, "js", "config.js");
const cfg = fs.readFileSync(cfgPath, "utf8");
const BEGIN = "/* ==== MODELS:BEGIN";
const END = "/* ==== MODELS:END";
const bi = cfg.indexOf(BEGIN);
const ei = cfg.indexOf(END);
if (bi < 0 || ei < 0 || ei < bi) {
  console.error("✗ config.js 缺少 MODELS:BEGIN/END 标记区");
  process.exit(1);
}
const byR = {};
for (const e of entries) byR[e.r] = (byR[e.r] || 0) + 1;
const header = `${BEGIN} (tools/build-roster.mjs 生成 — 勿手改)
   数据源: ${path.basename(srcPath)} · indexVersion ${data.indexVersion || "?"} · fetchedAt ${data.fetchedAt || "?"}
   生成 ${entries.length} 张: ${Object.entries(byR).map(([r, n]) => `${r}×${n}`).join(" ")} + NB 彩蛋(手写)
   名单/文案人工源: 本文件 CURATED 表；榜单更新后重跑 node tools/build-roster.mjs ==== */
${entries
  .map(
    (e) =>
      `  {id:${JSON.stringify(e.id)}, name:${JSON.stringify(e.name)}, vendor:${JSON.stringify(
        e.vendor
      )}, icon:${JSON.stringify(e.icon)}, idx:${e.idx}, r:${JSON.stringify(e.r)}${
        e.bannerOnly ? ", bannerOnly:true" : ""
      }, cost:${JSON.stringify(e.cost)}, spd:${e.spd}, quote:${JSON.stringify(e.quote)}},`
  )
  .join("\n")}
`;
const next = cfg.slice(0, bi) + header + cfg.slice(ei);
fs.writeFileSync(cfgPath, next);
console.log(
  `build-roster: ${entries.length} 张写入 config.js (${Object.entries(byR)
    .map(([r, n]) => `${r}×${n}`)
    .join(" ")})`
);
