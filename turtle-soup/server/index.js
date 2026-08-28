// 海龟汤在线游戏 - 后端入口
// 单端口 3000:API + Socket.IO + 生产模式静态托管前端构建产物
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { getSoups, getSoup, createSoup, updateSoup, deleteSoup, CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from "./data.js";
import { registerRoomHandlers, listRooms, listRoomsAdmin, closeRoomAdmin, banRoom, listBans, removeBan } from "./rooms.js";
import { generateSoup, classifySoup } from "./ai.js";
import { registerUser, loginUser, logoutUser, verifyToken, getFavorites, saveFavorites, listUsers, setUserStatus, deleteUser, resetPassword, revokeUserTokens, bumpAiCount, verifyUserPassword, banIp, unbanIp, listIpBans, isIpBanned, ipBannedAt, regIpCount, TOKEN_TTL as USER_TOKEN_TTL } from "./users.js";
import { submitAppeal, listAppeals, reviewAppeal, latestAccountAppeal, listAccountAppeals, removeAppeal } from "./appeals.js";
import { loadJson, persistJson } from "./data-io.js";
import { addSubmission, listSubmissions, setSubmissionStatus, deleteSubmission } from "./submissions.js";
import { addFeedback, listFeedbacks, approveFeedback, resolveFeedback, rejectFeedback, deleteFeedback } from "./feedback.js";
import { addUserMessage, syncUserMessage, removeUserMessage, removeUserMessages, listUserMessages } from "./user-messages.js";
import { backupData } from "./backup.js";

// ---------- 进程级错误兜底(import 之后、其它代码之前)----------
// 未捕获的 Promise 拒绝:打印堆栈但不退出(多为连接中断等可恢复错误,避免"后端又没了")
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason instanceof Error ? reason.stack || reason.message : reason);
});
// 未捕获异常:打印堆栈后退出(进程可能处于坏状态,交给重启机制拉起)
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err && err.stack ? err.stack : err);
  process.exit(1);
});
// 可选请求日志开关:LOG_REQUESTS 环境变量值非空即开启(中间件见 app.use(cors()) 之后)
const LOG_REQUESTS = !!process.env.LOG_REQUESTS;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
// 题库管理密码:仅从环境变量读取,不提供默认值;未设置时管理功能不可用
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
// 管理令牌:登录成功后签发,写操作凭令牌(令牌仅在服务端内存,前端不保存密码)
const adminTokens = new Map(); // token -> 过期时间(ms)
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 小时

// 恒定时间字符串比较(防计时侧信道,用于管理密码校验)
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// 定期清理过期的管理令牌,防止 Map 无限增长
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of adminTokens) {
    if (exp < now) adminTokens.delete(t);
  }
}, 60 * 60 * 1000).unref?.();

/** 签发管理令牌(密码只在登录瞬间从浏览器发出,之后用令牌) */
function issueToken() {
  const token = crypto.randomBytes(24).toString("hex");
  adminTokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}

/** 题库写操作权限校验:需要有效的管理令牌(x-admin-token) */
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: "未配置管理密码,请通过环境变量 ADMIN_PASSWORD 设置后重启" });
  }
  const token = req.headers["x-admin-token"];
  const expires = token && adminTokens.get(token);
  if (!expires || expires < Date.now()) {
    if (token) adminTokens.delete(token);
    return res.status(401).json({ error: "登录已失效,请重新输入管理密码" });
  }
  next();
}

const app = express();
// 信任本机回环代理(ngrok 在本机转发),拿到真实客户端 IP 用于封禁/注册计数;
// 不信任外部来源的 X-Forwarded-For,防止伪造 IP 绕过封禁
app.set("trust proxy", "loopback");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// 可选请求日志:LOG_REQUESTS 值非空时,在 app.use(cors()) 之后挂载中间件,
// 输出 method path status 耗时;WebSocket 升级请求走 http upgrade 事件(Socket.IO 注册),
// 不经过 express 中间件,因此不受影响
if (LOG_REQUESTS) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

// ---------- IP 封禁理由(管理员封禁 IP 时填写,玩家可见)----------
const IPBAN_NOTES_FILE = resolve(__dirname, "data", "ipban-notes.json");
const ipBanNotes = new Map(); // ip -> reason
function loadIpBanNotes() {
  const rows = loadJson(IPBAN_NOTES_FILE, {});
  for (const [ip, reason] of Object.entries(rows)) {
    if (reason) ipBanNotes.set(ip, String(reason));
  }
}
function persistIpBanNotes() {
  persistJson(IPBAN_NOTES_FILE, Object.fromEntries(ipBanNotes));
}
loadIpBanNotes();

// 简单 IP 限流:同一 IP 在窗口内最多 max 次,防暴力破解/批量注册
// key 按「接口+IP」区分,避免一个接口的失败尝试挤兑其他接口的额度
const ipRate = new Map(); // "label|ip" -> 时间戳数组
function rateLimitIp(max, windowMs, label) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "?";
    const key = label + "|" + ip;
    const now = Date.now();
    const stamps = (ipRate.get(key) || []).filter((t) => now - t < windowMs);
    if (stamps.length >= max) {
      ipRate.set(key, stamps);
      return res.status(429).json({ error: `${label}尝试过于频繁,请稍后再试` });
    }
    stamps.push(now);
    ipRate.set(key, stamps);
    next();
  };
}

// 按账号维度的失败限流(与 IP 限流叠加,防定向爆破):
// 5 分钟窗口内同一账号失败 10 次后 429;密码正确清零;账号不存在不计数(响应与密码错误一致,防枚举)
// 登录 / 账号状态查询 / 账号申诉 三个密码校验入口共用同一计数
const accountAttempts = new Map(); // username -> 失败时间戳数组
const ACCOUNT_ATTEMPTS_MAX = 10;
const ACCOUNT_ATTEMPTS_WINDOW = 5 * 60 * 1000;

/** 该账号是否已被限流(命中则 429,不再校验密码) */
function accountRateBlocked(name) {
  const now = Date.now();
  const stamps = (accountAttempts.get(name) || []).filter((t) => now - t < ACCOUNT_ATTEMPTS_WINDOW);
  if (stamps.length >= ACCOUNT_ATTEMPTS_MAX) {
    accountAttempts.set(name, stamps);
    return true;
  }
  return false;
}

/** 记录一次密码校验失败(仅账号存在时调用);返回是否因此触发限流 */
function accountRateFail(name) {
  const now = Date.now();
  const stamps = (accountAttempts.get(name) || []).filter((t) => now - t < ACCOUNT_ATTEMPTS_WINDOW);
  stamps.push(now);
  accountAttempts.set(name, stamps);
  return stamps.length >= ACCOUNT_ATTEMPTS_MAX;
}

/** 密码校验成功:清空该账号失败记录 */
function accountRateClear(name) {
  accountAttempts.delete(name);
}

// 启动时自动备份数据(失败不影响启动)
try {
  const copied = backupData();
  if (copied > 0) console.log(`[备份] 启动备份完成,共 ${copied} 个数据文件`);
} catch (e) {
  console.log(`[备份] 启动备份失败: ${e.message}`);
}

// ---------- REST API ----------
// 玩家注册/登录(密码只在此接口出现,验证后签发 token;IP 限流防批量注册/爆破)
app.post("/api/auth/register", rateLimitIp(20, 5 * 60 * 1000, "注册"), (req, res) => {
  const { username, password } = req.body || {};
  const r = registerUser(username, password, req.ip);
  if (r.error) return res.status(400).json({ error: r.error });
  const login = loginUser(r.username, password, req.ip);
  res.status(201).json({ username: login.username, token: login.token, expiresIn: login.expiresIn });
});

app.post("/api/auth/login", rateLimitIp(20, 5 * 60 * 1000, "登录"), (req, res) => {
  const { username, password } = req.body || {};
  const name = String(username || "").trim();
  const pwd = String(password || "");
  if (accountRateBlocked(name)) {
    // 限流中仍校验密码:密码正确立即清零放行(合法用户不会被锁死 5 分钟);
    // 密码错误或账号不存在维持 429,且不泄露账号是否存在(与账号不存在时的响应一致)
    const user = listUsers().find((u) => u.username === name);
    if (user && verifyUserPassword(name, pwd)) {
      accountRateClear(name);
    } else {
      return res.status(429).json({ error: "登录尝试过于频繁,请稍后再试" });
    }
  }
  const r = loginUser(name, pwd, req.ip);
  if (!r.error) {
    accountRateClear(name); // 登录成功(密码正确):清空该账号失败记录
    return res.json({ username: r.username, token: r.token, expiresIn: r.expiresIn });
  }
  // 仅密码校验失败且账号存在时计入失败;账号不存在不计数,
  // 但响应与密码错误完全一致(loginUser 对两者均返回"用户名或密码错误"),防枚举
  if (listUsers().some((u) => u.username === name) && accountRateFail(name)) {
    return res.status(429).json({ error: "登录尝试过于频繁,请稍后再试" });
  }
  return res.status(401).json({ error: r.error });
});

// 玩家登出:使当前 token 立即失效
app.post("/api/auth/logout", requirePlayer, (req, res) => {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  logoutUser(token);
  res.json({ ok: true });
});

// 管理员登录(独立端点,与玩家账号区分;IP 限流防密码爆破)
app.post("/api/admin/login", rateLimitIp(5, 5 * 60 * 1000, "登录"), (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: "未配置管理密码,请通过环境变量 ADMIN_PASSWORD 设置后重启" });
  }
  const pwd = String(req.body?.password ?? "");
  if (!safeEqual(pwd, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "密码错误" });
  }
  res.json({ token: issueToken(), expiresIn: TOKEN_TTL });
});

app.post("/api/admin/logout", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (token) adminTokens.delete(token);
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), soups: getSoups().length });
});

// 在线房间公开列表(大厅"加入房间"页使用)
app.get("/api/rooms", (_req, res) => {
  res.json(listRooms());
});

app.get("/api/soups", (req, res) => {
  const q = String(req.query.title || "").trim().toLowerCase();
  const cat = String(req.query.category || "").trim();
  const diff = String(req.query.difficulty || "").trim();
  let list = getSoups();
  if (q) {
    list = list.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        s.surface.toLowerCase().includes(q),
    );
  }
  if (cat) list = list.filter((s) => s.category === cat);
  if (diff) list = list.filter((s) => s.difficulty === diff);
  // 公开列表剥离汤底(truth):防止玩家在游戏外直接查到全部答案作弊
  res.json(list.map(({ truth, ...rest }) => rest));
});

// 分类/难度枚举(前端下拉与筛选共用)
app.get("/api/soup-meta", (_req, res) => {
  res.json({ categories: CATEGORIES, categoryLabels: CATEGORY_LABELS, difficulties: DIFFICULTIES, difficultyLabels: DIFFICULTY_LABELS });
});

app.get("/api/soups/:id", (req, res) => {
  const s = getSoup(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "未找到该谜题" });
  const { truth, ...rest } = s;
  res.json(rest); // 公开接口不返回汤底
});

// 管理端完整题库(含汤底,编辑/审核需要;必须管理令牌)
app.get("/api/admin/soups", requireAdmin, (_req, res) => {
  res.json(getSoups());
});

// ---------- 谜题上传申请 ----------
// 玩家鉴权:Authorization: Bearer <玩家token>
function requirePlayer(req, res, next) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const username = token && verifyToken(token);
  if (!username) return res.status(401).json({ error: "请先登录" });
  req.playerName = username;
  next();
}

// ---------- 谜题收藏 ----------
// 获取当前玩家的收藏谜题 ID 列表
app.get("/api/favorites", requirePlayer, (req, res) => {
  res.json({ ids: getFavorites(req.playerName) });
});

// 收藏一个谜题(去重;soupId 必须是正整数)
app.put("/api/favorites/:soupId", requirePlayer, (req, res) => {
  const soupId = Number(req.params.soupId);
  if (!Number.isInteger(soupId) || soupId <= 0) {
    return res.status(400).json({ error: "无效的谜题 ID" });
  }
  const ids = getFavorites(req.playerName);
  if (!ids.includes(soupId)) ids.push(soupId);
  saveFavorites(req.playerName, ids);
  res.json({ ok: true, ids });
});

// 取消收藏一个谜题
app.delete("/api/favorites/:soupId", requirePlayer, (req, res) => {
  const soupId = Number(req.params.soupId);
  if (!Number.isInteger(soupId) || soupId <= 0) {
    return res.status(400).json({ error: "无效的谜题 ID" });
  }
  const ids = getFavorites(req.playerName).filter((n) => n !== soupId);
  saveFavorites(req.playerName, ids);
  res.json({ ok: true, ids });
});

// 简单限流:同一用户 1 分钟内最多 3 条申请
const submitRate = new Map(); // username -> 时间戳数组
app.post("/api/submissions", requirePlayer, (req, res) => {
  const { title, surface, truth } = req.body || {};
  const now = Date.now();
  const stamps = (submitRate.get(req.playerName) || []).filter((t) => now - t < 60_000);
  if (stamps.length >= 3) {
    submitRate.set(req.playerName, stamps);
    return res.status(429).json({ error: "提交太频繁,请 1 分钟后再试" });
  }
  stamps.push(now);
  submitRate.set(req.playerName, stamps);
  const item = addSubmission({ title, surface, truth, submitter: req.playerName });
  if (item.error) return res.status(400).json({ error: item.error });
  // 同步生成用户消息(独立于业务数据,用户可自行删除)
  addUserMessage(req.playerName, {
    type: "submission",
    refId: item.id,
    title: item.title || "我的谜题",
    status: "pending",
  });
  res.status(201).json(item);
});

// 玩家查看自己的申请记录(用于右上角通知:审核通过/未通过)
app.get("/api/submissions/mine", requirePlayer, (req, res) => {
  const mine = listSubmissions()
    .filter((s) => s.submitter === req.playerName)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(mine);
});

// 审核记录导出 CSV(管理员下载)
app.get("/api/submissions/export", requireAdmin, (_req, res) => {
  const csvField = (value) => {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["ID", "标题", "汤面", "汤底", "提交人", "状态", "提交时间", "审核时间", "备注"];
  const rows = listSubmissions().map((s) =>
    [
      s.id,
      s.title,
      s.surface,
      s.truth,
      s.submitter,
      s.status,
      s.createdAt ? new Date(s.createdAt).toISOString() : "",
      s.reviewedAt ? new Date(s.reviewedAt).toISOString() : "",
      s.note,
    ]
      .map(csvField)
      .join(","),
  );
  const csv = "\uFEFF" + [header.map(csvField).join(","), ...rows].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="submissions.csv"');
  res.send(csv);
});

// 审核接口:需要管理令牌(管理员密码登录后签发,普通玩家无法访问)
app.get("/api/submissions", requireAdmin, (req, res) => {
  const status = String(req.query.status || "").trim();
  let list = listSubmissions();
  if (status) list = list.filter((s) => s.status === status);
  res.json(list);
});

app.post("/api/submissions/:id/approve", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const cur = listSubmissions().find((s) => s.id === id);
  if (!cur) return res.status(404).json({ error: "申请不存在" });
  if (cur.status !== "pending") return res.status(409).json({ error: "该申请已处理过" });
  const { category, difficulty } = req.body || {};
  const item = setSubmissionStatus(id, "approved");
  const created = createSoup({
    title: item.title,
    surface: item.surface,
    truth: item.truth,
    category,
    difficulty,
  });
  if (!created) return res.status(400).json({ error: "谜题内容无效,无法入库" });
  // 同步用户消息(管理端删除业务记录不影响用户消息)
  syncUserMessage(cur.submitter, "submission", id, { status: "approved", note: null });
  pushNotify(cur.submitter, { type: "submission", title: `题库申请《${cur.title}》已审核通过` });
  res.json({ ok: true, soup: created, submission: item });
});

app.post("/api/submissions/:id/reject", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const cur = listSubmissions().find((s) => s.id === id);
  if (!cur) return res.status(404).json({ error: "申请不存在" });
  if (cur.status !== "pending") return res.status(409).json({ error: "该申请已处理过" });
  const note = String(req.body?.note || "");
  const item = setSubmissionStatus(id, "rejected", note);
  if (!item) return res.status(404).json({ error: "申请不存在" });
  // 同步用户消息(拒绝原因)
  syncUserMessage(cur.submitter, "submission", id, { status: "rejected", note: item.note });
  pushNotify(cur.submitter, { type: "submission", title: `题库申请《${cur.title}》未通过审核` });
  res.json({ ok: true, submission: item });
});

// 删除审核记录(任意状态)
app.delete("/api/submissions/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const removed = deleteSubmission(id);
  if (!removed) return res.status(404).json({ error: "申请不存在" });
  res.json({ ok: true });
});

// ---------- 用户反馈 ----------
// 玩家提交反馈(需登录;同一用户 1 分钟内最多 3 条)
const feedbackRate = new Map(); // username -> 时间戳数组
app.post("/api/feedback", requirePlayer, (req, res) => {
  const { title, content } = req.body || {};
  const now = Date.now();
  const stamps = (feedbackRate.get(req.playerName) || []).filter((t) => now - t < 60_000);
  if (stamps.length >= 3) {
    feedbackRate.set(req.playerName, stamps);
    return res.status(429).json({ error: "提交太频繁,请 1 分钟后再试" });
  }
  stamps.push(now);
  feedbackRate.set(req.playerName, stamps);
  const item = addFeedback({ title, content, submitter: req.playerName });
  if (item.error) return res.status(400).json({ error: item.error });
  // 同步生成用户消息
  addUserMessage(req.playerName, {
    type: "feedback",
    refId: item.id,
    title: item.title,
    status: "pending",
  });
  res.status(201).json(item);
});

// 管理员查看全部反馈
app.get("/api/feedback", requireAdmin, (_req, res) => {
  res.json(listFeedbacks());
});

// 管理员采纳反馈(可给用户说明)
app.post("/api/feedback/:id/approve", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const cur = listFeedbacks().find((f) => f.id === id);
  if (!cur) return res.status(404).json({ error: "反馈不存在" });
  if (cur.status !== "pending") return res.status(409).json({ error: "该反馈已处理过" });
  const note = String(req.body?.note || "");
  const item = approveFeedback(id, note);
  syncUserMessage(cur.submitter, "feedback", id, { status: "adopted", note: item.note, resolution: null });
  pushNotify(cur.submitter, { type: "feedback", title: `反馈《${cur.title}》已被采纳` });
  res.json({ ok: true, feedback: item });
});

// 已采纳反馈的处理状态(已修复 / 已改进,可给用户说明)
app.post("/api/feedback/:id/resolve", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const cur = listFeedbacks().find((f) => f.id === id);
  if (!cur) return res.status(404).json({ error: "反馈不存在" });
  if (cur.status !== "adopted") return res.status(409).json({ error: "只有已采纳的反馈可以设置处理状态" });
  const resolution = String(req.body?.resolution || "");
  const note = String(req.body?.note || "");
  const item = resolveFeedback(id, resolution, note);
  if (item?.error) return res.status(400).json(item);
  // 新增一条处理结果消息(不覆盖采纳时的说明,并产生新的未读提示)
  addUserMessage(cur.submitter, {
    type: "feedback",
    refId: id,
    title: item.title,
    status: "adopted",
    resolution,
    note: item.note,
  });
  pushNotify(cur.submitter, {
    type: "feedback",
    title: `反馈《${cur.title}》已标记为${resolution === "fixed" ? "已修复" : "已改进"}`,
  });
  res.json({ ok: true, feedback: item });
});

// 管理员拒绝采纳反馈(原因必填,给用户说明)
app.post("/api/feedback/:id/reject", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const cur = listFeedbacks().find((f) => f.id === id);
  if (!cur) return res.status(404).json({ error: "反馈不存在" });
  if (cur.status !== "pending") return res.status(409).json({ error: "该反馈已处理过" });
  const note = String(req.body?.note || "");
  if (!note.trim()) return res.status(400).json({ error: "请填写拒绝原因" });
  const item = rejectFeedback(id, note);
  syncUserMessage(cur.submitter, "feedback", id, { status: "rejected", note: item.note, resolution: null });
  pushNotify(cur.submitter, { type: "feedback", title: `反馈《${cur.title}》未被采纳` });
  res.json({ ok: true, feedback: item });
});

// 管理员删除反馈(不影响用户消息)
app.delete("/api/feedback/:id", requireAdmin, (req, res) => {
  const ok = deleteFeedback(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "反馈不存在" });
  res.json({ ok: true });
});

// ---------- 账号/IP 申诉(被封禁/冻结的玩家提交,管理员审核)----------
// 玩家提交申诉:不要求登录(被封禁/冻结后 token 已失效)。
// 账号申诉须 用户名+密码 验证(证明是本人在申诉),每次封禁/冻结可申诉一次(按当前处罚计数);
// IP 封禁申诉须该 IP 确实被封禁,每次封禁可申诉一次(按当前封禁计数)。
// IP 频率限制:同一 IP 5 分钟内最多提交 10 次申诉,防知道被封 IP 者反复刷申诉记录
app.post("/api/appeals", rateLimitIp(10, 5 * 60 * 1000, "申诉"), (req, res) => {
  const type = String(req.body?.type || "account");
  if (type === "ip") {
    const ip = String(req.body?.ip || "").trim();
    if (!isIpBanned(ip)) return res.status(400).json({ error: "该 IP 未被封禁,无需申诉" });
    const r = submitAppeal({ type: "ip", ip, content: String(req.body?.content || ""), bannedAt: ipBannedAt(ip) });
    if (r.error) return res.status(400).json(r);
    return res.status(201).json({ ok: true, id: r.id });
  }
  const name = String(req.body?.username || "").trim();
  const u = listUsers().find((x) => x.username === name);
  if (!u || (u.status !== "banned" && u.status !== "frozen")) {
    // 账号不存在/未被处罚:返回与密码错误一致的 400(防枚举,不泄露账号注册状态)
    return res.status(400).json({ error: "账号或密码验证失败,请确认是本人在申诉" });
  }
  // 账号维度限流(与登录共用计数):命中时校验密码,正确则清零放行,错误继续 429
  const appealPwd = String(req.body?.password || "");
  const appealOk = verifyUserPassword(name, appealPwd);
  if (accountRateBlocked(name)) {
    if (!appealOk) return res.status(429).json({ error: "尝试过于频繁,请 5 分钟后再试" });
    accountRateClear(name);
  } else if (!appealOk) {
    // 密码错误(账号已确认存在):计入失败,可能触发限流
    accountRateFail(name);
    return res.status(400).json({ error: "账号或密码验证失败,请确认是本人在申诉" });
  } else {
    accountRateClear(name);
  }
  const r = submitAppeal({ type: "account", username: name, content: String(req.body?.content || ""), penaltyAt: u.lastPenalty?.at || 0 });
  if (r.error) return res.status(400).json(r);
  res.status(201).json({ ok: true, id: r.id });
});

// 账号状态查询:输入 用户名+密码 查看账号当前状态、封禁理由与申诉结果(无需登录)
app.post("/api/appeals/status", (req, res) => {
  const name = String(req.body?.username || "").trim();
  const u = listUsers().find((x) => x.username === name);
  if (!u) {
    // 账号不存在:返回与密码错误一致的 400(防枚举);不计数(防对任意账号名刷限流)
    return res.status(400).json({ error: "账号或密码验证失败" });
  }
  // 账号维度限流(与登录共用计数):命中时校验密码,正确则清零放行,错误继续 429
  const statusPwd = String(req.body?.password || "");
  const statusOk = verifyUserPassword(name, statusPwd);
  if (accountRateBlocked(name)) {
    if (!statusOk) return res.status(429).json({ error: "尝试过于频繁,请 5 分钟后再试" });
    accountRateClear(name);
  } else if (!statusOk) {
    accountRateFail(name); // 密码错误(账号已确认存在):计入失败
    return res.status(400).json({ error: "账号或密码验证失败" });
  } else {
    accountRateClear(name); // 密码正确:清空失败记录
  }
  const appeal = latestAccountAppeal(name);
  const accountStatus = u.status; // normal / frozen / banned
  res.json({
    username: name,
    accountStatus,
    accountLabel: accountStatus === "normal" ? "正常" : accountStatus === "frozen" ? "已冻结" : "已封禁",
    penaltyReason: u.lastPenalty?.reason || null, // 封禁/冻结理由(管理员填写)
    regIp: u.regIp || null, // 注册 IP(IP 被封禁时告知玩家是哪个 IP)
    ipBanned: isIpBanned(u.regIp),
    ipBanReason: isIpBanned(u.regIp) ? ipBanNotes.get(u.regIp) || null : null,
    appeal: appeal
      ? {
          status: appeal.status, // pending / approved / rejected
          label: appeal.status === "pending" ? "申诉审核中" : appeal.status === "approved" ? "申诉已通过" : "申诉未通过",
          at: appeal.at,
          reply: appeal.reply,
          content: appeal.content,
        }
      : null,
    appeals: listAccountAppeals(name), // 全部申诉历史(区分多次处罚)
  });
});

// 查看当前访问 IP(被封禁 IP 的玩家不知道自己 IP 时使用)
app.get("/api/my-ip", (req, res) => {
  res.json({ ip: req.ip || "未知" });
});

// 管理员:全部申诉(新在前)
app.get("/api/admin/appeals", requireAdmin, (_req, res) => {
  res.json(listAppeals());
});

// 管理员:通过申诉 → 账号申诉=恢复账号并通知;IP 申诉=解封 IP(无账号可通知)
app.post("/api/admin/appeals/:id/approve", requireAdmin, (req, res) => {
  const a = reviewAppeal(req.params.id, "approve", String(req.body?.reply || ""));
  if (a === null) return res.status(404).json({ error: "申诉不存在" });
  if (a.error) return res.status(400).json(a);
  if (a.type === "ip") {
    unbanIp(a.ip); // 解封 IP
    ipBanNotes.delete(a.ip); // 清除封禁理由
    persistIpBanNotes();
    return res.json({ ok: true, appeal: a });
  }
  setUserStatus(a.username, "normal"); // 解封/解冻
  const reply = a.reply ? "\n管理员回复:" + a.reply : "";
  addUserMessage(a.username, { type: "appeal", title: "申诉已通过", body: "你的申诉已通过,账号已恢复使用。" + reply, status: "done" });
  pushNotify(a.username, { type: "appeal", title: "申诉已通过,账号已恢复" });
  res.json({ ok: true, appeal: a });
});

// 管理员:拒绝申诉 → 账号申诉通知玩家;IP 申诉无通知
app.post("/api/admin/appeals/:id/reject", requireAdmin, (req, res) => {
  const a = reviewAppeal(req.params.id, "reject", String(req.body?.reply || ""));
  if (a === null) return res.status(404).json({ error: "申诉不存在" });
  if (a.error) return res.status(400).json(a);
  if (a.type === "ip") {
    return res.json({ ok: true, appeal: a });
  }
  const reply = a.reply ? "\n管理员回复:" + a.reply : "";
  addUserMessage(a.username, { type: "appeal", title: "申诉未通过", body: "很遗憾,你的申诉未通过,账号维持" + (listUsers().find((x) => x.username === a.username)?.status === "frozen" ? "冻结" : "封禁") + "状态。" + reply, status: "done" });
  pushNotify(a.username, { type: "appeal", title: "申诉未通过" });
  res.json({ ok: true, appeal: a });
});

// 管理员:删除一条申诉记录(批量清理用)
app.delete("/api/admin/appeals/:id", requireAdmin, (req, res) => {
  const ok = removeAppeal(req.params.id);
  if (!ok) return res.status(404).json({ error: "该申诉不存在" });
  res.json({ ok: true });
});

// ---------- 账号 / IP / 房间管理(本地管理页)----------
// 全部账号(不含密码哈希;密码只可重置不可查看)
app.get("/api/admin/users", requireAdmin, (_req, res) => {
  res.json(listUsers());
});

// 设置账号状态:normal / frozen / banned(reason 为可选理由,随提示与消息传达给玩家)
app.post("/api/admin/users/:name/status", requireAdmin, (req, res) => {
  const reason = String(req.body?.reason || "").trim().slice(0, 200);
  const r = setUserStatus(req.params.name, String(req.body?.status || ""), reason);
  if (r === null) return res.status(404).json({ error: "账号不存在" });
  if (r.error) return res.status(400).json(r);
  // 封禁/冻结立即踢下线(不刷新也能立刻生效),并推送消息中心通知(含理由)
  if (r.status !== "normal") {
    const why = reason ? `\n原因:${reason}` : "";
    kickUserSockets(req.params.name, (r.status === "banned" ? "账号已被封禁" : "账号已被冻结") + why);
    if (r.status === "banned") {
      addUserMessage(req.params.name, {
        type: "appeal",
        title: "账号已被封禁",
        body: "你的账号已被管理员封禁,无法登录。" + why + "\n如有异议,可在登录页点击「账号申诉」提交申诉。",
        status: "done",
      });
      pushNotify(req.params.name, { type: "appeal", title: "账号已被封禁,可在登录页申诉" });
    } else {
      addUserMessage(req.params.name, {
        type: "appeal",
        title: "账号已被冻结",
        body: "你的账号已被管理员冻结,暂时无法登录。" + why + "\n可在登录页点击「账号申诉」提交申诉。",
        status: "done",
      });
      pushNotify(req.params.name, { type: "appeal", title: "账号已被冻结,可在登录页申诉" });
    }
  }
  res.json(r);
});

// 删除账号(不可恢复):移除账号与其消息记录,已登录的立即失效
app.delete("/api/admin/users/:name", requireAdmin, (req, res) => {
  const ok = deleteUser(req.params.name);
  if (!ok) return res.status(404).json({ error: "账号不存在" });
  removeUserMessages(req.params.name); // 联动清理该用户的消息中心记录
  kickUserSockets(req.params.name, "账号已被删除"); // 立即踢下线
  res.json({ ok: true });
});

// 重置账号密码(密码为哈希存储,无法查看明文)
app.post("/api/admin/users/:name/reset-password", requireAdmin, (req, res) => {
  const r = resetPassword(req.params.name, String(req.body?.password || ""));
  if (r === null) return res.status(404).json({ error: "账号不存在" });
  if (r.error) return res.status(400).json(r);
  kickUserSockets(req.params.name, "密码已被重置,请重新登录"); // 立即踢下线
  res.json(r);
});

// 在线用户列表:遍历当前 socket 连接(含所在房间/上线时间/真实 IP)
app.get("/api/admin/online", requireAdmin, (_req, res) => {
  const titles = new Map(listRoomsAdmin().map((r) => [r.code, r.soupTitle]));
  const list = [];
  for (const s of io.sockets.sockets.values()) {
    if (!s.data?.username) continue;
    const code = s.data.roomCode;
    list.push({
      username: s.data.username,
      ip: socketRealIp(s),
      joinedAt: s.data.joinedAt || null,
      roomCode: code || null,
      roomTitle: code ? titles.get(code) || null : null,
    });
  }
  res.json(list);
});

// 踢下线:撤销该用户全部 token + 断开其全部 socket(不影响账号状态,可重新登录)
app.post("/api/admin/users/:name/kick", requireAdmin, (req, res) => {
  const name = String(req.params.name).trim();
  const users = listUsers();
  if (!users.some((u) => u.username === name)) {
    return res.status(404).json({ error: "账号不存在" });
  }
  revokeUserTokens(name);
  kickUserSockets(name, "你已被管理员踢下线");
  res.json({ ok: true, username: name });
});

// IP 概况:全部出现过注册的 IP(含注册数、是否封禁)+ 单独被封的 IP
app.get("/api/admin/ips", requireAdmin, (_req, res) => {
  const regIps = new Map(); // ip -> count
  for (const u of listUsers()) {
    if (u.regIp) regIps.set(u.regIp, (regIps.get(u.regIp) || 0) + 1);
  }
  const list = [...regIps.entries()].map(([ip, count]) => ({
    ip,
    regCount: count,
    banned: isIpBanned(ip),
    reason: isIpBanned(ip) ? ipBanNotes.get(ip) || null : null,
  }));
  // 补充只被封禁但没有注册记录的 IP
  for (const ip of listIpBans()) {
    if (!regIps.has(ip)) list.push({ ip, regCount: 0, banned: true, reason: ipBanNotes.get(ip) || null });
  }
  res.json(list);
});

// 封禁 IP(也可只封无注册记录的 IP);reason 为可选理由(玩家申诉时可看到);封禁后在线连接立即断开
app.post("/api/admin/ips/ban", requireAdmin, (req, res) => {
  const ip = String(req.body?.ip || "").trim();
  if (!/^[\w.:%[\]]+$/.test(ip) || ip.length > 64) {
    return res.status(400).json({ error: "无效的 IP" });
  }
  const added = banIp(ip);
  const reason = String(req.body?.reason || "").trim().slice(0, 200);
  if (reason) {
    ipBanNotes.set(ip, reason);
    persistIpBanNotes();
  }
  kickIpSockets(ip, `你的 IP(${ip}) 已被封禁` + (reason ? ":" + reason : "") + ",可在登录页提交 IP 申诉");
  res.json({ ok: true, banned: ip, newly: added });
});

// 解封 IP
app.delete("/api/admin/ips/:ip", requireAdmin, (req, res) => {
  const ok = unbanIp(req.params.ip);
  if (!ok) return res.status(404).json({ error: "该 IP 未被封禁" });
  ipBanNotes.delete(req.params.ip); // 清除封禁理由
  persistIpBanNotes();
  res.json({ ok: true });
});

// 在线房间明细 + 封禁记录(管理页)
app.get("/api/admin/rooms", requireAdmin, (_req, res) => {
  res.json({ rooms: listRoomsAdmin(), bans: listBans() });
});

// 强制解散房间(reason 为可选理由,随关闭提示传达给玩家)
app.post("/api/admin/rooms/:code/close", requireAdmin, (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const ok = closeRoomAdmin(io, code, String(req.body?.reason || ""));
  if (!ok) return res.status(404).json({ error: "房间不存在" });
  res.json({ ok: true, code });
});

// 封禁房间:解散 + 记封禁记录 + 分级警告(1/2/3+ 次文案不同,含理由);第 3 次起自动冻结账号
app.post("/api/admin/rooms/:code/ban", requireAdmin, (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const reason = String(req.body?.reason || "").trim().slice(0, 200);
  const r = banRoom(io, code, reason);
  if (!r) return res.status(404).json({ error: "房间不存在" });
  if (r.frozen) {
    // 多次违规(第 3 次起):冻结账号并立即踢下线
    setUserStatus(r.frozen, "frozen", "多次违规" + (reason ? "(" + reason + ")" : ""));
    kickUserSockets(r.frozen, "多次违规,账号已被冻结,可在登录页提交申诉");
    addUserMessage(r.frozen, { type: "appeal", title: "账号已被冻结", body: "因多次违规,你的账号已被冻结。" + (reason ? "\n原因:" + reason : "") + "\n可在登录页点击「账号申诉」提交申诉。", status: "done" });
    pushNotify(r.frozen, { type: "appeal", title: "账号已被冻结,可在登录页申诉" });
  }
  res.json({ ok: true, code, count: r.count, frozen: r.frozen });
});

// 删除一条封禁记录(撤销该次警告,房主下次封禁次数按剩余记录重算)
app.delete("/api/admin/bans/:id", requireAdmin, (req, res) => {
  const ok = removeBan(req.params.id);
  if (!ok) return res.status(404).json({ error: "该封禁记录不存在" });
  res.json({ ok: true });
});

// ---------- 用户消息(通知中心,与业务数据隔离)----------
app.get("/api/messages/mine", requirePlayer, (req, res) => {
  res.json(listUserMessages(req.playerName));
});

// 删除我的某条消息(仅用户端记录,不影响管理端数据)
app.delete("/api/messages/:id", requirePlayer, (req, res) => {
  const ok = removeUserMessage(req.playerName, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "消息不存在" });
  res.json({ ok: true });
});

app.post("/api/soups", requireAdmin, (req, res) => {
  const item = createSoup(req.body || {});
  if (!item) return res.status(400).json({ error: "汤面和汤底不能为空" });
  res.status(201).json(item);
});

app.put("/api/soups/:id", requireAdmin, (req, res) => {
  const r = updateSoup(Number(req.params.id), req.body || {});
  if (r === null) return res.status(404).json({ error: "未找到该谜题" });
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

app.delete("/api/soups/:id", requireAdmin, (req, res) => {
  const ok = deleteSoup(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: "未找到该谜题" });
  res.json({ ok: true });
});

// ---------- AI 谜题生成 ----------
// 需要登录 + 冷却:每个 IP 每 3 分钟最多生成 1 次(防止刷爆 LLM 额度)
const aiCooldown = new Map(); // ip -> 上次生成时间(ms)
const AI_COOLDOWN_MS = 2 * 60 * 1000; // AI 生成冷却:同一 IP 每 2 分钟一次

// 定期清理全部限流 Map 的过期条目,防止长跑后内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, stamps] of ipRate) {
    const kept = stamps.filter((t) => now - t < 30 * 60 * 1000);
    if (kept.length) ipRate.set(key, kept);
    else ipRate.delete(key);
  }
  for (const [name, stamps] of submitRate) {
    const kept = stamps.filter((t) => now - t < 60_000);
    if (kept.length) submitRate.set(name, kept);
    else submitRate.delete(name);
  }
  for (const [name, stamps] of feedbackRate) {
    const kept = stamps.filter((t) => now - t < 60_000);
    if (kept.length) feedbackRate.set(name, kept);
    else feedbackRate.delete(name);
  }
  for (const [ip, last] of aiCooldown) {
    if (now - last >= AI_COOLDOWN_MS) aiCooldown.delete(ip);
  }
}, 5 * 60 * 1000);

app.post("/api/ai/generate", requirePlayer, (req, res, next) => {
  const now = Date.now();
  const last = aiCooldown.get(req.ip) || 0;
  const remainMs = last + AI_COOLDOWN_MS - now;
  if (remainMs > 0) {
    return res.status(429).json({
      error: `AI 生成冷却中,请 ${Math.ceil(remainMs / 1000)} 秒后再试`,
    });
  }
  aiCooldown.set(req.ip, now);
  bumpAiCount(req.playerName); // 管理端统计 AI 生成次数
  next();
}, async (req, res) => {
  const topic = String(req.body?.topic || "").trim();
  if (!topic) return res.status(400).json({ error: "请提供生成题材" });
  try {
    const soup = await generateSoup(topic, {
      category: String(req.body?.category || "").trim() || undefined,
      difficulty: String(req.body?.difficulty || "").trim() || undefined,
    });
    res.json(soup);
  } catch (e) {
    res.status(502).json({ error: e.message || "AI 生成失败,请稍后重试" });
  }
});

// AI 自动分类/难度(管理员用,审核入库前打标;可带自定义 AI 配置)
app.post("/api/ai/tag-soup", requireAdmin, async (req, res) => {
  try {
    const { surface, truth, config } = req.body || {};
    const tag = await classifySoup({ surface, truth, config });
    res.json(tag);
  } catch (e) {
    res.status(502).json({ error: e.message || "AI 分类失败,请稍后重试" });
  }
});

// ---------- Socket.IO ----------
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});
// 连接鉴权:必须携带有效玩家 token(socket.handshake.auth.token);被封禁的 IP 拒绝连接
// 握手按 IP 限流(滑动窗口):同一 IP 60 秒内最多 30 次握手尝试,防无效 token 批量握手 DoS(每次失败握手都要读盘验证)
const handshakeRate = new Map(); // ip -> 时间戳数组
const HANDSHAKE_MAX = 30;
const HANDSHAKE_WINDOW = 60 * 1000;
io.use((socket, next) => {
  const ip = socketRealIp(socket);
  const now = Date.now();
  const stamps = (handshakeRate.get(ip) || []).filter((t) => now - t < HANDSHAKE_WINDOW);
  if (stamps.length >= HANDSHAKE_MAX) {
    handshakeRate.set(ip, stamps);
    return next(new Error("连接过于频繁,请稍后再试"));
  }
  stamps.push(now);
  handshakeRate.set(ip, stamps);
  const token = socket.handshake.auth?.token;
  const username = verifyToken(token);
  if (!username) {
    return next(new Error("未登录或登录已过期"));
  }
  if (isIpBanned(ip)) {
    return next(new Error(`你的 IP(${ip}) 已被封禁,可在登录页提交 IP 申诉`));
  }
  socket.data.username = username;
  socket.data.joinedAt = Date.now(); // 上线时间(管理端在线列表用)
  next();
});
registerRoomHandlers(io);

/** 踢出某用户的全部在线 socket(封禁/冻结/重置密码/删除账号时调用,立即生效) */
function kickUserSockets(username, reason) {
  for (const s of io.sockets.sockets.values()) {
    if (s.data.username === username) {
      try {
        s.emit("kicked", { reason });
        s.disconnect(true);
      } catch {
        /* 连接可能已断开,忽略 */
      }
    }
  }
}

/** 向某用户的全部在线 socket 推送实时通知(消息中心即时刷新,免等 30 秒轮询) */
function pushNotify(username, payload) {
  for (const s of io.sockets.sockets.values()) {
    if (s.data.username === username) {
      try {
        s.emit("notification", payload);
      } catch {
        /* 连接可能已断开,忽略 */
      }
    }
  }
}

/** 取 socket 的真实客户端 IP:仅信任本机代理(ngrok)转发的 XFF,直连一律用 socket 地址,防止伪造 XFF 绕过封禁 */
function socketRealIp(s) {
  const addr = String(s.handshake?.address || "");
  const isLoopback =
    addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  if (isLoopback) {
    const xff = s.handshake?.headers?.["x-forwarded-for"];
    if (xff) return String(xff).split(",")[0].trim();
  }
  return addr;
}

/** 踢出某 IP 的全部在线 socket(封禁 IP 时调用,立即生效) */
function kickIpSockets(ip, reason) {
  const target = String(ip || "").trim();
  if (!target) return;
  for (const s of io.sockets.sockets.values()) {
    if (socketRealIp(s) === target) {
      try {
        s.emit("kicked", { reason });
        s.disconnect(true);
      } catch {
        /* 连接可能已断开,忽略 */
      }
    }
  }
}

// ---------- 生产模式静态托管 ----------
const dist = resolve(__dirname, "../web/dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  // SPA fallback:非 /api、/socket.io 的路径回退到 index.html(react-router)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.sendFile(resolve(dist, "index.html"));
  });
  console.log(`[静态] 托管前端构建产物: ${dist}`);
}

httpServer.listen(PORT, () => {
  console.log(`[server] 海龟汤后端已启动: http://127.0.0.1:${PORT}`);
});
