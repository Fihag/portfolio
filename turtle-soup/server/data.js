// 题库数据模块:读写 server/data/soups.json,每次操作实时读写文件(管理页改动即时生效)
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const DATA_FILE = resolve(DATA_DIR, "soups.json");

// 题目分类 / 难度枚举(前端与 AI 生成共用)
export const CATEGORIES = ["horror", "suspense", "warmth", "mind", "social"];
export const CATEGORY_LABELS = { horror: "恐怖", suspense: "悬疑", warmth: "温情", mind: "脑洞", social: "现实" };
export const DIFFICULTIES = ["easy", "medium", "hard"];
export const DIFFICULTY_LABELS = { easy: "简单", medium: "中等", hard: "困难" };

/** 过滤非法分类/难度:合法返回原值,非法返回 undefined */
function pickTag(value, allowed) {
  const v = String(value ?? "").trim().toLowerCase();
  return allowed.includes(v) ? v : undefined;
}

export function loadSoups() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function persist(soups) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(soups, null, 2), "utf8");
  renameSync(tmp, DATA_FILE);
}

export function getSoups() {
  return loadSoups();
}

export function getSoup(id) {
  return loadSoups().find((s) => s.id === id) || null;
}

function nextId(soups) {
  return soups.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1;
}

/**
 * 新增谜题。返回新增条目;surface/truth 为空返回 null。
 */
export function createSoup({ title, surface, truth, category, difficulty } = {}) {
  const soups = loadSoups();
  const item = { id: nextId(soups) };
  const t = String(title ?? "").trim().slice(0, 60);
  const s = String(surface ?? "").trim().slice(0, 500);
  const tr = String(truth ?? "").trim().slice(0, 3000);
  if (!s || !tr) return null;
  if (t) item.title = t;
  item.surface = s;
  item.truth = tr;
  const cat = pickTag(category, CATEGORIES);
  const diff = pickTag(difficulty, DIFFICULTIES);
  if (cat) item.category = cat;
  if (diff) item.difficulty = diff;
  soups.push(item);
  persist(soups);
  return item;
}

/**
 * 更新谜题。返回更新后的条目;不存在返回 null;校验失败返回 { error }。
 */
export function updateSoup(id, { title, surface, truth, category, difficulty } = {}) {
  const soups = loadSoups();
  const idx = soups.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  if (surface !== undefined) {
    const s = String(surface).trim().slice(0, 500);
    if (!s) return { error: "汤面不能为空" };
    soups[idx].surface = s;
  }
  if (truth !== undefined) {
    const t = String(truth).trim().slice(0, 3000);
    if (!t) return { error: "汤底不能为空" };
    soups[idx].truth = t;
  }
  if (title !== undefined) {
    const t = String(title).trim().slice(0, 60);
    if (t) soups[idx].title = t;
    else delete soups[idx].title;
  }
  if (category !== undefined) {
    const cat = pickTag(category, CATEGORIES);
    if (cat) soups[idx].category = cat;
    else delete soups[idx].category;
  }
  if (difficulty !== undefined) {
    const diff = pickTag(difficulty, DIFFICULTIES);
    if (diff) soups[idx].difficulty = diff;
    else delete soups[idx].difficulty;
  }
  persist(soups);
  return soups[idx];
}

/** 删除谜题。返回是否删除成功。 */
export function deleteSoup(id) {
  const soups = loadSoups();
  const next = soups.filter((s) => s.id !== id);
  if (next.length === soups.length) return false;
  persist(next);
  return true;
}
