// 解析题库.txt → server/data/soups.json
// 支持两种格式:
//   A) 纯数字编号行("1"、"2"...)+ 汤面/汤底
//   B) "数字、《标题》" 行 + 空行 + 汤面:/汤底:(支持多行)
// 输出: [{ id, title?, surface, truth }]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = process.argv[2] || resolve(ROOT, "..", "题库.txt");
const OUT = resolve(ROOT, "server", "data", "soups.json");

const raw = readFileSync(SRC, "utf8");
const lines = raw.split(/\r?\n/);

// ---------- 解析 ----------
const NUM_ONLY = /^\s*(\d+)\s*$/;
const NUM_TITLE = /^\s*(\d+)\s*、\s*《(.+?)》\s*$/;
const SURFACE_MARK = /^汤面\s*[:：]/;
const TRUTH_MARK = /^汤底\s*[:：]/;

/** @type {{title: string|null, surface: string[], truth: string[], cur: 'surface'|'truth'|null, hasSurface: boolean, hasTruth: boolean}[]} */
const entries = [];
let cur = null;

function startEntry(title) {
  cur = { title, surface: [], truth: [], cur: null, hasSurface: false, hasTruth: false };
  entries.push(cur);
}

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) {
    // 空行:保留在内容里(多行汤面诗句排版),由后处理压缩
    if (cur && cur.cur) cur[cur.cur].push("");
    continue;
  }
  const mTitle = trimmed.match(NUM_TITLE);
  if (mTitle) {
    startEntry(mTitle[2]);
    continue;
  }
  const mNum = trimmed.match(NUM_ONLY);
  if (mNum) {
    startEntry(null);
    continue;
  }
  const mSurf = trimmed.match(SURFACE_MARK);
  if (mSurf) {
    if (!cur) startEntry(null);
    cur.cur = "surface";
    cur.hasSurface = true;
    const rest = trimmed.replace(SURFACE_MARK, "").trim();
    if (rest) cur.surface.push(rest);
    continue;
  }
  const mTruth = trimmed.match(TRUTH_MARK);
  if (mTruth) {
    if (!cur) startEntry(null);
    cur.cur = "truth";
    cur.hasTruth = true;
    const rest = trimmed.replace(TRUTH_MARK, "").trim();
    if (rest) cur.truth.push(rest);
    continue;
  }
  // 普通内容行,追加到当前段落
  if (cur && cur.cur) cur[cur.cur].push(trimmed);
  else if (cur) {
    // 汤面标记之前的游离文本,直接视为汤面(容错)
    cur.cur = "surface";
    cur.hasSurface = true;
    cur.surface.push(trimmed);
  }
}

// ---------- 后处理 ----------
function cleanLines(arr) {
  // 压缩连续空行,首尾去掉空行,每行 trim 已在上面完成
  const out = [];
  let blank = 0;
  for (const l of arr) {
    if (!l) {
      blank++;
      continue;
    }
    if (out.length && blank > 0) out.push(""); // 段落间保留一个空行
    out.push(l);
    blank = 0;
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out
    .join("\n")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/害S/g, "害死")
    .replace(/S体/g, "尸体")
    .replace(/守天平间/g, "守太平间")
    .trim();
}

const norm = (s) =>
  s
    .replace(/[\s\u3000，。、；：！？…·《》「」"'“”‘’()（）,.!?;:]/g, "")
    .replace(/S/g, "死")
    .toLowerCase();

function jaccard(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const c of setA) if (setB.has(c)) inter++;
  const union = new Set([...setA, ...setB]).size;
  return union ? inter / union : 0;
}

const soups = [];
const dropped = [];
const anomalies = [];

// 原始题库无标题条目的标题映射(按内容关键词匹配,与 add-titles.mjs 一致)
const UNTITLED_TITLES = [
  { key: "牙齿是绿色", title: "绿牙" },
  { key: "外公去世", title: "纸房子" },
  { key: "女孩醒来总有新伤", title: "新伤" },
  { key: "寻人启事", title: "稻草人" },
  { key: "火车经过一个隧道", title: "隧道" },
  { key: "孤寡老人", title: "流浪猫" },
  { key: "男友帮我喂鱼", title: "食人鱼" },
  { key: "我就只有一半", title: "一半" },
  { key: "新年快到了", title: "面食店" },
];

for (const e of entries) {
  const surface = cleanLines(e.surface);
  const truth = cleanLines(e.truth);
  if (!surface || !truth) {
    anomalies.push({ title: e.title, reason: !surface ? "缺汤面" : "缺汤底" });
    continue;
  }
  const ns = norm(surface);
  const dup = soups.find((s) => {
    const t = norm(s.surface);
    if (t === ns) return true;
    if (ns.includes(t) || t.includes(ns)) return Math.min(ns.length, t.length) > 8;
    return jaccard(ns, t) > 0.5 && Math.min(ns.length, t.length) > 8;
  });
  if (dup) {
    // 优先保留带标题的版本
    if (e.title && !dup.title) {
      const idx = soups.indexOf(dup);
      dropped.push({ dropped: `#${dup.id}`, kept: e.title });
      const id = dup.id;
      soups[idx] = { id, surface, truth, title: e.title };
    } else {
      dropped.push({ dropped: e.title, kept: dup.title || `#${dup.id}` });
    }
    continue;
  }
  const id = soups.length + 1;
  const item = { id, surface, truth };
  if (e.title) {
    item.title = e.title;
  } else {
    const hit = UNTITLED_TITLES.find((t) => (surface + truth).includes(t.key));
    if (hit) item.title = hit.title;
  }
  soups.push(item);
}

// ---------- 输出 ----------
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(soups, null, 2), "utf8");

console.log(`输入行数: ${lines.length}`);
console.log(`解析到条目: ${entries.length}`);
console.log(`入库条目: ${soups.length}`);
console.log(`去重丢弃: ${dropped.length}`);
for (const d of dropped) console.log(`  - 丢弃「${d.dropped}」→ 保留「${d.kept}」`);
console.log(`异常条目: ${anomalies.length}`);
for (const a of anomalies) console.log(`  - ${a.title || "(无标题)"}: ${a.reason}`);
console.log(`输出文件: ${OUT}`);
console.log(`--- 条目标题列表 ---`);
console.log(soups.map((s) => (s.title ? s.title : `(无标题#${s.id})`)).join("、"));
