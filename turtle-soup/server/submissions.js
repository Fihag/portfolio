// 上传申请数据模块:玩家提交的谜题等待管理员审核
// 数据存 server/data/submissions.json,实时读写
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson, persistJson } from "./data-io.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const DATA_FILE = resolve(DATA_DIR, "submissions.json");

function loadAll() {
  return loadJson(DATA_FILE, []);
}

function persist(list) {
  persistJson(DATA_FILE, list);
}

function nextId(list) {
  return list.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1;
}

/** 提交申请。校验失败返回 { error };成功返回新条目 */
export function addSubmission({ title, surface, truth, submitter } = {}) {
  const s = String(surface ?? "").trim().slice(0, 500);
  const tr = String(truth ?? "").trim().slice(0, 3000);
  const t = String(title ?? "").trim().slice(0, 60);
  if (!s || !tr) return { error: "汤面和汤底不能为空" };
  const list = loadAll();
  const item = { id: nextId(list) };
  if (t) item.title = t;
  item.surface = s;
  item.truth = tr;
  item.submitter = String(submitter || "匿名");
  item.status = "pending";
  item.createdAt = Date.now();
  item.reviewedAt = null;
  item.note = null;
  list.push(item);
  persist(list);
  return item;
}

export function listSubmissions() {
  return loadAll();
}

/** 设置审核状态(approved/rejected),返回更新后的条目;不存在返回 null */
export function setSubmissionStatus(id, status, note = "") {
  const list = loadAll();
  const item = list.find((x) => x.id === id);
  if (!item) return null;
  item.status = status;
  item.reviewedAt = Date.now();
  item.note = String(note || "").trim().slice(0, 200) || null;
  persist(list);
  return item;
}

/** 删除审核记录,返回被删除的条目;不存在返回 null */
export function deleteSubmission(id) {
  const list = loadAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  persist(list);
  return removed;
}
