// 玩家账号模块:注册 / 登录 / token 校验 / 账号与 IP 管理
// 密码使用 scrypt + 随机盐哈希存储(不保存明文),数据存 server/data/users.json
import crypto from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson, persistJson } from "./data-io.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const USERS_FILE = resolve(DATA_DIR, "users.json");
const TOKENS_FILE = resolve(DATA_DIR, "tokens.json");
const IPBANS_FILE = resolve(DATA_DIR, "ipbans.json");

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 玩家 token 7 天有效
// 同一 IP 最多注册的账号数(防批量注册)
const MAX_ACCOUNTS_PER_IP = Number(process.env.MAX_ACCOUNTS_PER_IP) || 5;

const userTokens = new Map(); // token -> { username, expiresAt }

// token 验证缓存:避免每次连接/请求都全量读 users.json。
// 缓存的是 { username, status } 快照;所有写路径(登录/注册/状态变更/删除/重置/撤销/aiCount/收藏)
// 都会显式 invalidateUserCache,保证封禁/冻结即时生效,无旁路。
const tokenUserCache = new Map(); // token -> { username, status }
function invalidateUserCache(username) {
  for (const [token, v] of tokenUserCache) {
    if (v.username === username) tokenUserCache.delete(token);
  }
}

export const USERNAME_RE = /^[\w\u4e00-\u9fa5]{2,20}$/; // 2~20 位中文/字母/数字/下划线
// 账号状态:normal 正常 / frozen 冻结(临时)/ banned 封禁(永久)
const STATUSES = ["normal", "frozen", "banned"];

// ---------- 工具(loadJson/persistJson 已抽到 data-io.js)----------

// ---------- tokens ----------
function loadTokens() {
  const rows = loadJson(TOKENS_FILE, []);
  for (const row of rows) {
    if (row.token && row.expiresAt > Date.now()) {
      userTokens.set(row.token, { username: row.username, expiresAt: row.expiresAt });
    }
  }
}
loadTokens();

function persistTokens() {
  const rows = [...userTokens.entries()].map(([token, v]) => ({
    token,
    username: v.username,
    expiresAt: v.expiresAt,
  }));
  persistJson(TOKENS_FILE, rows);
}

// ---------- users ----------
function loadUsers() {
  return loadJson(USERS_FILE, []);
}

function persist(users) {
  persistJson(USERS_FILE, users);
}

// ---------- IP 封禁(带时间戳:申诉按"每次封禁一次"计数) ----------
// ipbans.json 兼容两种格式:旧版字符串数组 ["ip"],新版 [{ ip, at }]
function loadIpBans() {
  const raw = loadJson(IPBANS_FILE, []);
  const m = new Map();
  for (const item of raw) {
    if (typeof item === "string") m.set(item, 0); // 旧格式:无时间戳
    else if (item && typeof item === "object" && item.ip) m.set(String(item.ip), Number(item.at) || 0);
  }
  return m;
}
let ipBans = loadIpBans(); // Map ip -> 封禁时间戳(ms)

function persistIpBans() {
  persistJson(IPBANS_FILE, [...ipBans].map(([ip, at]) => ({ ip, at })));
}

/** 判断 IP 是否被封禁 */
export function isIpBanned(ip) {
  return !!ip && ipBans.has(String(ip));
}

/** 该 IP 当前封禁的时间戳(ms,旧数据无时间戳返回 0) */
export function ipBannedAt(ip) {
  return ipBans.get(String(ip)) || 0;
}

/** 封禁一个 IP(已存在则忽略,保持原封禁时间),返回是否为新封禁 */
export function banIp(ip) {
  const key = String(ip || "").trim();
  if (!key) return false;
  if (ipBans.has(key)) return false;
  ipBans.set(key, Date.now());
  persistIpBans();
  return true;
}

/** 解封一个 IP,返回是否成功 */
export function unbanIp(ip) {
  const key = String(ip || "").trim();
  if (!key || !ipBans.delete(key)) return false;
  persistIpBans();
  return true;
}

/** 全部封禁 IP */
export function listIpBans() {
  return [...ipBans.keys()];
}

/** 某 IP 已注册的账号数 */
export function regIpCount(ip) {
  const key = String(ip || "");
  if (!key) return 0;
  return loadUsers().filter((u) => u.regIp === key).length;
}

// ---------- 密码 ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(hash, "hex"));
}

// ---------- 注册 / 登录 ----------
/** 注册。ip 为注册来源 IP(用于封禁与数量限制)。失败返回 { error } */
export function registerUser(username, password, ip = "") {
  const name = String(username || "").trim();
  const pwd = String(password || "");
  if (!USERNAME_RE.test(name)) return { error: "用户名需为 2~20 位中文/字母/数字/下划线" };
  if (pwd.length < 4 || pwd.length > 64) return { error: "密码长度需为 4~64 位" };
  if (isIpBanned(ip)) return { error: `你的 IP(${ip}) 已被封禁,无法注册` };
  if (regIpCount(ip) >= MAX_ACCOUNTS_PER_IP) {
    return { error: `同一 IP 最多注册 ${MAX_ACCOUNTS_PER_IP} 个账号` };
  }
  const users = loadUsers();
  if (users.some((u) => u.username === name)) return { error: "用户名已被注册" };
  const { salt, hash } = hashPassword(pwd);
  users.push({
    username: name,
    salt,
    hash,
    status: "normal",
    regIp: String(ip || ""),
    createdAt: Date.now(),
  });
  persist(users);
  invalidateUserCache(name);
  return { username: name };
}

/** 校验账号密码是否正确(不签发 token,用于申诉身份验证)。返回 true/false;账号不存在返回 false */
export function verifyUserPassword(username, password) {
  const user = loadUsers().find((u) => u.username === String(username || "").trim());
  if (!user) return false;
  try {
    return verifyPassword(String(password || ""), user.salt, user.hash);
  } catch {
    return false;
  }
}

/** 登录。ip 用于封禁校验。成功返回 { username, token };失败返回 { error } */
export function loginUser(username, password, ip = "") {
  const name = String(username || "").trim();
  const pwd = String(password || "");
  const users = loadUsers();
  const user = users.find((u) => u.username === name);
  if (!user || !verifyPassword(pwd, user.salt, user.hash)) {
    return { error: "用户名或密码错误" };
  }
  if (user.status === "banned") return { error: "该账号已被封禁" };
  if (user.status === "frozen") return { error: "该账号已被冻结,请联系管理员" };
  if (isIpBanned(ip)) return { error: `你的 IP(${ip}) 已被封禁,无法登录,可在登录页提交 IP 申诉` };
  const token = crypto.randomBytes(24).toString("hex");
  userTokens.set(token, { username: name, expiresAt: Date.now() + TOKEN_TTL });
  persistTokens();
  // 记录登录信息:最后登录时间/IP、总次数、最近 20 条登录日志(管理端用)
  const now = Date.now();
  user.lastLoginAt = now;
  user.lastLoginIp = String(ip || "");
  user.loginCount = (user.loginCount || 0) + 1;
  const log = Array.isArray(user.loginLog) ? user.loginLog : [];
  log.push({ at: now, ip: String(ip || "") });
  if (log.length > 20) log.splice(0, log.length - 20);
  user.loginLog = log;
  persist(users);
  invalidateUserCache(name);
  return { username: name, token, expiresIn: TOKEN_TTL };
}

/** 校验 token,返回用户名或 null(封禁/冻结即时生效:已签发的 token 立即失效) */
export function verifyToken(token) {
  const t = token && userTokens.get(token);
  if (!t) return null;
  if (t.expiresAt < Date.now()) {
    userTokens.delete(token);
    persistTokens();
    return null;
  }
  // 缓存命中:直接返回(状态快照在校验时已是最新,写路径保证失效)
  const cached = tokenUserCache.get(token);
  if (cached) {
    if (cached.status !== "normal") {
      userTokens.delete(token);
      persistTokens();
      tokenUserCache.delete(token);
      return null;
    }
    return cached.username;
  }
  const user = loadUsers().find((u) => u.username === t.username);
  if (!user || user.status !== "normal") {
    userTokens.delete(token);
    persistTokens();
    return null;
  }
  tokenUserCache.set(token, { username: user.username, status: user.status });
  return t.username;
}

/** 玩家登出:使指定 token 立即失效 */
export function logoutUser(token) {
  if (!token) return;
  if (userTokens.delete(token)) persistTokens();
  tokenUserCache.delete(token);
}

// ---------- 账号管理(管理员用)----------
/** 全部账号列表(含密码哈希 salt/hash 供本地管理页查看哈希运算结果——哈希单向不可逆,不泄露明文;附收藏数/AI生成次数) */
export function listUsers() {
  return loadUsers().map((u) => ({
    ...u,
    favCount: Array.isArray(u.favorites) ? u.favorites.length : 0,
    aiCount: u.aiCount || 0,
  }));
}

/** 撤销某用户全部已签发 token(踢下线用:立即失效所有会话) */
export function revokeUserTokens(username) {
  let changed = false;
  for (const [token, v] of userTokens) {
    if (v.username === username) {
      userTokens.delete(token);
      changed = true;
    }
  }
  if (changed) persistTokens();
  invalidateUserCache(username);
  return changed;
}

/** AI 生成次数 +1(每次通过冷却的生成请求计入,管理端可见) */
export function bumpAiCount(username) {
  const name = String(username || "").trim();
  if (!name) return;
  const users = loadUsers();
  const user = users.find((u) => u.username === name);
  if (!user) return;
  user.aiCount = (user.aiCount || 0) + 1;
  persist(users);
  invalidateUserCache(name);
}

/** 设置账号状态(normal/frozen/banned),reason 为管理员填写的理由(可选,玩家可见)。不存在返回 null */
export function setUserStatus(username, status, reason = "") {
  if (!STATUSES.includes(status)) return { error: "无效的状态" };
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user) return null;
  user.status = status;
  if (status !== "normal") {
    user.lastPenalty = {
      status,
      reason: String(reason || "").trim().slice(0, 200) || null,
      at: Date.now(),
    };
  } else {
    user.lastPenalty = null;
  }
  persist(users);
  // 封禁/冻结时撤销其全部在线 token,立即生效
  if (status !== "normal") {
    let changed = false;
    for (const [token, v] of userTokens) {
      if (v.username === username) {
        userTokens.delete(token);
        changed = true;
      }
    }
    if (changed) persistTokens();
  }
  invalidateUserCache(username);
  return { username, status };
}

/** 删除账号(不可恢复):移除用户记录并撤销其全部 token。返回是否删除成功 */
export function deleteUser(username) {
  const users = loadUsers();
  const next = users.filter((u) => u.username !== username);
  if (next.length === users.length) return false;
  persist(next);
  let changed = false;
  for (const [token, v] of userTokens) {
    if (v.username === username) {
      userTokens.delete(token);
      changed = true;
    }
  }
  if (changed) persistTokens();
  invalidateUserCache(username);
  return true;
}

/** 管理员重置密码(密码只以哈希保存,无法查看明文,只能重置) */
export function resetPassword(username, newPassword) {  const pwd = String(newPassword || "");
  if (pwd.length < 4 || pwd.length > 64) return { error: "新密码长度需为 4~64 位" };
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user) return null;
  const { salt, hash } = hashPassword(pwd);
  user.salt = salt;
  user.hash = hash;
  persist(users);
  // 重置后强制重新登录
  let changed = false;
  for (const [token, v] of userTokens) {
    if (v.username === username) {
      userTokens.delete(token);
      changed = true;
    }
  }
  if (changed) persistTokens();
  invalidateUserCache(username);
  return { username };
}

// ---------- 收藏 ----------
/** 读取用户收藏的谜题 ID 列表;用户不存在或没有 favorites 字段时返回空数组 */
export function getFavorites(username) {
  const name = String(username || "").trim();
  const user = loadUsers().find((u) => u.username === name);
  if (!user || !Array.isArray(user.favorites)) return [];
  return user.favorites.filter((n) => typeof n === "number");
}

/** 保存用户收藏的谜题 ID 列表到用户记录;用户不存在则忽略 */
export function saveFavorites(username, ids) {
  const name = String(username || "").trim();
  const users = loadUsers();
  const user = users.find((u) => u.username === name);
  if (!user) return;
  user.favorites = (Array.isArray(ids) ? ids : []).filter((n) => Number.isInteger(n));
  persist(users);
  invalidateUserCache(name);
}

export { TOKEN_TTL };
