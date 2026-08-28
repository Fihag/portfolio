// 反馈数据模块:玩家提交的建议/反馈等待管理员审批
// 数据存 server/data/feedback.json,实时读写
// 状态机:pending(待审批)→ adopted(已采纳)可再设 resolution(fixed 已修复 / improved 已改进);
//                    → rejected(拒绝采纳,note 为原因)
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson, persistJson } from "./data-io.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const DATA_FILE = resolve(DATA_DIR, "feedback.json");

function loadAll() {
  return loadJson(DATA_FILE, []);
}

function persist(list) {
  persistJson(DATA_FILE, list);
}

function nextId(list) {
  return list.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1;
}

/** 提交反馈。校验失败返回 { error };成功返回新条目 */
export function addFeedback({ title, content, submitter } = {}) {
  const c = String(content ?? "").trim();
  if (!c) return { error: "反馈内容不能为空" };
  const list = loadAll();
  const item = {
    id: nextId(list),
    title: String(title ?? "").trim().slice(0, 40) || "建议/反馈",
    content: c.slice(0, 500),
    submitter: String(submitter || "匿名"),
    status: "pending",
    resolution: null,
    note: null,
    createdAt: Date.now(),
    reviewedAt: null,
  };
  list.push(item);
  persist(list);
  return item;
}

export function listFeedbacks() {
  return loadAll();
}

/** 采纳反馈(可带说明)。返回更新条目;不存在返回 null */
export function approveFeedback(id, note = "") {
  const list = loadAll();
  const item = list.find((x) => x.id === id);
  if (!item) return null;
  item.status = "adopted";
  item.reviewedAt = Date.now();
  item.note = String(note || "").trim().slice(0, 200) || null;
  persist(list);
  return item;
}

/** 反馈采纳后的处理状态(fixed 已修复 / improved 已改进,可带说明) */
export function resolveFeedback(id, resolution, note = "") {
  const list = loadAll();
  const item = list.find((x) => x.id === id);
  if (!item) return null;
  if (!["fixed", "improved"].includes(resolution)) return { error: "无效的处理状态" };
  item.resolution = resolution;
  item.note = String(note || "").trim().slice(0, 200) || null;
  persist(list);
  return item;
}

/** 拒绝采纳反馈(原因必填)。返回更新条目;不存在返回 null */
export function rejectFeedback(id, note = "") {
  const list = loadAll();
  const item = list.find((x) => x.id === id);
  if (!item) return null;
  item.status = "rejected";
  item.reviewedAt = Date.now();
  item.note = String(note || "").trim().slice(0, 200) || null;
  persist(list);
  return item;
}

/** 删除反馈记录,返回被删除条目;不存在返回 null */
export function deleteFeedback(id) {
  const list = loadAll();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  persist(list);
  return removed;
}
