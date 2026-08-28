// 用户消息模块:每个玩家独立的消息记录(通知中心用)
// 与业务数据(题库申请/反馈)隔离:用户可删除自己的消息,不影响管理端数据;
// 管理端删除业务记录也不影响用户端消息。
// 数据存 server/data/user-messages.json,实时读写
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson, persistJson } from "./data-io.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const DATA_FILE = resolve(DATA_DIR, "user-messages.json");

function loadAll() {
  return loadJson(DATA_FILE, {});
}

function persist(map) {
  persistJson(DATA_FILE, map);
}

// 消息 id 全局递增;启动时从已有消息恢复基数,防止重启后与旧 id 撞车
let seq = (() => {
  let max = 0;
  const map = loadAll();
  for (const list of Object.values(map)) {
    for (const m of list) {
      if (typeof m.id === "number" && m.id > max) max = m.id;
    }
  }
  return Math.max(max, Date.now() % 100000000);
})();
function nextMsgId() {
  seq += 1;
  return seq;
}

/** 给某用户新增一条消息。返回消息条目 */
export function addUserMessage(username, msg) {
  const map = loadAll();
  const list = map[username] || (map[username] = []);
  const item = {
    id: nextMsgId(),
    type: msg.type, // "submission" | "feedback" | "appeal" | ...
    refId: msg.refId,
    title: String(msg.title || "").slice(0, 60),
    body: msg.body ? String(msg.body).slice(0, 500) : null,
    status: msg.status || "pending",
    resolution: msg.resolution || null,
    note: msg.note || null,
    createdAt: msg.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  list.push(item);
  persist(map);
  return item;
}

/** 按 type+refId 同步更新某用户的消息状态(管理端审核后调用) */
export function syncUserMessage(username, type, refId, patch) {
  const map = loadAll();
  const list = map[username];
  if (!list) return null;
  const item = list.find((m) => m.type === type && m.refId === refId);
  if (!item) return null;
  if (patch.status !== undefined) item.status = patch.status;
  if (patch.resolution !== undefined) item.resolution = patch.resolution;
  if (patch.note !== undefined) item.note = patch.note;
  item.updatedAt = Date.now();
  persist(map);
  return item;
}

/** 删除某用户的一条消息(仅用户端,不影响管理端数据) */
export function removeUserMessage(username, msgId) {
  const map = loadAll();
  const list = map[username];
  if (!list) return false;
  const idx = list.findIndex((m) => m.id === Number(msgId));
  if (idx === -1) return false;
  list.splice(idx, 1);
  persist(map);
  return true;
}

/** 某用户的全部消息(按更新时间倒序) */
export function listUserMessages(username) {
  const map = loadAll();
  return (map[username] || []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 删除某用户的全部消息(账号删除时联动清理) */
export function removeUserMessages(username) {
  const map = loadAll();
  if (!map[username]) return false;
  delete map[username];
  persist(map);
  return true;
}
