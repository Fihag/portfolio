// 账号/IP 申诉模块:
// - 账号申诉(type=account):被封禁/冻结的玩家凭 用户名+密码 验证后提交;按"每次处罚一次"计数,新处罚可再申诉
// - IP 封禁申诉(type=ip):IP 被封禁的用户提交;按"每次封禁一次"计数,新封禁可再申诉
// 数据存 server/data/appeals.json
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson, persistJson } from "./data-io.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPEALS_FILE = resolve(__dirname, "data", "appeals.json");

/** 全部申诉(新在前) */
export function listAppeals() {
  return loadJson(APPEALS_FILE, []).sort((a, b) => b.at - a.at);
}

/** 某用户最新一条申诉(账号申诉) */
export function latestAccountAppeal(username) {
  return loadJson(APPEALS_FILE, [])
    .filter((a) => a.type === "account" && a.username === String(username || "").trim())
    .sort((a, b) => b.at - a.at)[0] || null;
}

/** 某用户的全部申诉记录(按时间倒序,状态查询展示申诉历史用) */
export function listAccountAppeals(username) {
  return loadJson(APPEALS_FILE, [])
    .filter((a) => a.type === "account" && a.username === String(username || "").trim())
    .sort((a, b) => b.at - a.at)
    .map((a) => ({
      status: a.status,
      label: a.status === "pending" ? "申诉审核中" : a.status === "approved" ? "申诉已通过" : "申诉未通过",
      at: a.at,
      reply: a.reply,
      content: a.content,
    }));
}

/**
 * 提交申诉。
 * - type=account:username 须已被封禁/冻结(路由校验);按"每次处罚一次"计数——当前处罚(penaltyAt)之后已提交过申诉则拒绝
 * - type=ip:ip 须已被封禁(路由校验);按"每次封禁一次"计数——当前封禁(bannedAt)之后已提交过申诉则拒绝
 * 失败返回 { error }
 */
export function submitAppeal({ type = "account", username = "", ip = "", content = "", penaltyAt = 0, bannedAt = 0 }) {
  const text = String(content || "").trim();
  if (text.length < 5 || text.length > 500) return { error: "申诉内容需 5~500 字" };
  const list = loadJson(APPEALS_FILE, []);
  if (type === "account") {
    const name = String(username || "").trim();
    if (name.length < 2 || name.length > 20) return { error: "用户名格式不正确" };
    // 当前处罚之后已提交过申诉(无论结果)→ 本次处罚只能申诉一次;新的处罚(新 penaltyAt)后可再次申诉
    if (penaltyAt && list.some((a) => a.type === "account" && a.username === name && a.at >= penaltyAt)) {
      return { error: "该账号本次封禁/冻结已提交过申诉,请等待处理结果" };
    }
    const appeal = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: "account",
      username: name,
      content: text,
      at: Date.now(),
      status: "pending", // pending / approved / rejected
      reply: null,
      reviewedAt: null,
    };
    list.push(appeal);
    persistJson(APPEALS_FILE, list);
    return appeal;
  }
  // type=ip
  const ipKey = String(ip || "").trim();
  if (!ipKey || ipKey.length > 64) return { error: "IP 格式不正确" };
  // 当前封禁之后已提交过申诉(无论结果)→ 本次封禁只能申诉一次;解封再封(新 bannedAt)后可再次申诉
  if (bannedAt && list.some((a) => a.type === "ip" && a.ip === ipKey && a.at >= bannedAt)) {
    return { error: "该 IP 本次封禁已提交过申诉,请等待处理结果" };
  }
  if (list.some((a) => a.type === "ip" && a.ip === ipKey && a.status === "pending")) {
    return { error: "该 IP 已有一条待审核的申诉,请耐心等待" };
  }
  const appeal = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: "ip",
    ip: ipKey,
    content: text,
    at: Date.now(),
    status: "pending",
    reply: null,
    reviewedAt: null,
  };
  list.push(appeal);
  persistJson(APPEALS_FILE, list);
  return appeal;
}

/** 审核申诉:action=approve|reject,reply 为管理员回复(可选)。不存在返回 null,已处理返回 { error } */
export function reviewAppeal(id, action, reply) {
  const list = loadJson(APPEALS_FILE, []);
  const a = list.find((x) => String(x.id) === String(id));
  if (!a) return null;
  if (a.status !== "pending") return { error: "该申诉已处理" };
  a.status = action === "approve" ? "approved" : "rejected";
  a.reply = String(reply || "").trim() || null;
  a.reviewedAt = Date.now();
  persistJson(APPEALS_FILE, list);
  return a;
}

/** 删除一条申诉记录(管理端批量清理用)。返回是否删除成功 */
export function removeAppeal(id) {
  const list = loadJson(APPEALS_FILE, []);
  const idx = list.findIndex((x) => String(x.id) === String(id));
  if (idx < 0) return false;
  list.splice(idx, 1);
  persistJson(APPEALS_FILE, list);
  return true;
}
