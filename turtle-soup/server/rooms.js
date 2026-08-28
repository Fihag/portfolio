// 游戏房间核心逻辑:Socket.IO 事件协议 + 房间状态机
// 状态:waiting → playing → revealed →(再来一局)→ playing
import { getSoup } from "./data.js";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANS_FILE = resolve(__dirname, "data", "bans.json");

const rooms = new Map();
// 管理员封禁记录(按房主计数警告 1/2/3 次):持久化到 data/bans.json
// 每条: { id, username(房主), code(房间码), at(时间), count(该房主累计次数) }
const bans = [];
function loadBans() {
  if (!existsSync(BANS_FILE)) return;
  try {
    for (const b of JSON.parse(readFileSync(BANS_FILE, "utf8"))) {
      if (b && b.id && b.username) bans.push(b);
    }
  } catch {
    /* 忽略损坏文件 */
  }
}
function persistBans() {
  mkdirSync(dirname(BANS_FILE), { recursive: true });
  const tmp = BANS_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(bans, null, 2), "utf8");
  renameSync(tmp, BANS_FILE);
}
loadBans();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除易混淆 I O 0 1
let seq = 0;

// 房间清理策略(可用环境变量覆盖,便于测试):
// - WAITING_TTL:建房后等待开始的最长时间,超时自动解散(默认 30 分钟)
// - HOST_OFFLINE_TTL:房主断线后等待重连的最长时间,超时解散(默认 5 分钟)
// - ALL_OFFLINE_TTL:房间内所有玩家离线后的宽限,超时解散(默认 30 秒,给断线重连留窗口)
// - SWEEP_INTERVAL:全局兜底扫描间隔(默认 30 秒)
const WAITING_TTL = Number(process.env.ROOM_WAITING_TTL) || 30 * 60 * 1000;
const HOST_OFFLINE_TTL = Number(process.env.ROOM_HOST_TTL) || 5 * 60 * 1000;
const ALL_OFFLINE_TTL = Number(process.env.ROOM_ALL_OFFLINE_TTL) || 30 * 1000;
const SWEEP_INTERVAL = Number(process.env.ROOM_SWEEP_INTERVAL) || 30 * 1000;
// 房间人数上限(房主 + 玩家,默认 6 人,环境变量可覆盖)
const MAX_PLAYERS = Number(process.env.ROOM_MAX_PLAYERS) || 6;
// 提问/猜底/提示等操作的冷却时间,防刷屏(默认 2 秒)
const ACTION_COOLDOWN = Number(process.env.ROOM_ACTION_COOLDOWN) || 2000;

/** 频率限制:同一 socket 的同一类操作在冷却时间内只能执行一次 */
function rateLimited(socket, key) {
  const now = Date.now();
  if (now - (socket.data[key] || 0) < ACTION_COOLDOWN) return true;
  socket.data[key] = now;
  return false;
}

/** 解散房间:清广播 room_closed 并从内存移除 */
function closeRoom(io, code, message) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("room_closed", { message });
  rooms.delete(code);
  // 房间从列表移除后,实时推送最新房间列表
  io.emit("rooms_updated", listRooms());
}

let sweepTimer = null;

/** 全局兜底清扫:全员离线宽限后解散;房主离线超时解散;等待超时解散 */
function startSweeper(io) {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (!room.players.some((p) => p.online)) {
        // 全员离线:记录起始时刻,超过宽限期仍未有人回来才解散
        if (!room.allOfflineAt) room.allOfflineAt = now;
        else if (now - room.allOfflineAt > ALL_OFFLINE_TTL) {
          closeRoom(io, code, "房间内所有玩家已离线,房间解散");
        }
        continue;
      }
      room.allOfflineAt = null; // 有人在线,重置全员离线计时
      const host = room.players.find((p) => p.sid === room.hostId);
      if (host && !host.online && room.hostOfflineAt && now - room.hostOfflineAt > HOST_OFFLINE_TTL) {
        closeRoom(io, code, "房主长时间离线,房间已解散");
        continue;
      }
      if (room.status === "waiting" && now - room.createdAt > WAITING_TTL) {
        closeRoom(io, code, "房间等待超时,已自动解散");
      }
    }
  }, SWEEP_INTERVAL);
  sweepTimer.unref?.();
}

function genCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

/** 公开房间快照;viewerSid 为房主时下发汤底(房主需要汤底才能作答),否则揭晓后所有人可见 */
export function publicRoom(room, viewerSid) {
  const pub = { ...room };
  delete pub._hostTimer;
  delete pub.hostOfflineAt;
  delete pub.allOfflineAt;
  delete pub.password; // 密码不出房间快照
  pub.players = room.players.map((p) => ({ ...p }));
  const isHost = viewerSid === room.hostId;
  pub.soup = room.soup
    ? { id: room.soup.id, title: room.soup.title, surface: room.soup.surface }
    : null;
  if (room.status === "revealed" && room.soup) {
    pub.soup.truth = room.soup.truth;
  } else if (isHost && room.soup) {
    pub.soup.truth = room.soup.truth;
  }
  pub.questions = room.questions.map((q) => ({ ...q }));
  pub.guesses = room.guesses.map((g) => ({ ...g }));
  pub.hints = room.hints.map((h) => ({ ...h }));
  return pub;
}

/** 按玩家身份分别广播(房主拿到含汤底的快照,玩家拿到不含汤底的快照) */
function broadcast(io, room, event = "room_updated") {
  for (const p of room.players) {
    io.to(p.sid).emit(event, publicRoom(room, p.sid));
  }
}

/** 解析选题参数 → soup 对象;无效返回 null */
function resolveSoup(soupArg) {
  if (!soupArg) return null;
  if (typeof soupArg.soupId === "number") {
    const s = getSoup(soupArg.soupId);
    return s ? { id: s.id, title: s.title, surface: s.surface, truth: s.truth } : null;
  }
  if (soupArg.custom && String(soupArg.custom.surface || "").trim() && String(soupArg.custom.truth || "").trim()) {
    return {
      id: null,
      title: String(soupArg.custom.title || "").trim() || undefined,
      surface: String(soupArg.custom.surface).trim(),
      truth: String(soupArg.custom.truth).trim(),
    };
  }
  return null;
}

/** 下一个提问者:按加入顺序轮转,跳过房主;无其他玩家返回 null */
function nextQuestioner(room, afterId) {
  const nonHost = room.players.filter((p) => p.sid !== room.hostId && p.online);
  if (!nonHost.length) return null;
  const idx = nonHost.findIndex((p) => p.sid === afterId);
  return nonHost[(idx + 1) % nonHost.length].sid;
}

/** 在线房间公开列表(不含汤底/密码,供大厅"加入房间"页展示) */
export function listRooms() {
  const list = [];
  for (const room of rooms.values()) {
    list.push({
      code: room.code,
      hostName: room.hostName,
      status: room.status,
      round: room.round,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers || MAX_PLAYERS,
      onlineCount: room.players.filter((p) => p.online).length,
      hasPassword: !!room.password,
      soupTitle: room.soup?.title || null,
      createdAt: room.createdAt,
    });
  }
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

// ---------- 管理端(强制解散 / 封禁房间)----------
/** 全部在线房间明细(管理页用):含玩家名单与选题,不含密码 */
export function listRoomsAdmin() {
  const list = [];
  for (const room of rooms.values()) {
    list.push({
      code: room.code,
      hostName: room.hostName,
      status: room.status,
      round: room.round,
      maxPlayers: room.maxPlayers || MAX_PLAYERS,
      createdAt: room.createdAt,
      soupTitle: room.soup?.title || null,
      hasPassword: !!room.password,
      players: room.players.map((p) => ({ name: p.name, online: p.online, joinedAt: p.joinedAt })),
      questions: room.questions.length,
      guesses: room.guesses.length,
    });
  }
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

/** 强制解散指定房间,reason 为管理员理由(可选,随关闭提示传达)。返回是否解散成功 */
export function closeRoomAdmin(io, code, reason = "") {
  const room = rooms.get(code);
  if (!room) return false;
  closeRoom(io, code, "管理员强制解散了房间" + (reason ? ":" + String(reason).trim().slice(0, 200) : ""));
  return true;
}

/** 生成按次数分级的警告文案:第 1 次 / 第 2 次 / 第 3 次起(最后警告 + 账号冻结)。reason 为管理员理由(可选) */
function warnMessage(code, count, reason = "") {
  const why = reason ? `\n原因:${reason}` : "";
  if (count <= 1) {
    return `你的房间 #${code} 已被管理员封禁,这是第一次警告。\n请遵守游戏规则,注意言行。${why}`;
  }
  if (count === 2) {
    return `你的房间 #${code} 已被管理员封禁,这是第二次警告!\n请立即停止违规行为,否则后果自负。${why}`;
  }
  return `你的房间 #${code} 已被管理员封禁,这是最后一次警告!\n由于多次违规,你的账号已被冻结,可在登录页提交申诉。${why}`;
}

/**
 * 封禁房间:立即解散,并给房主记一次封禁记录、发分级警告(1/2/3+ 次文案不同)。
 * reason 为管理员填写的理由(可选,随警告与关闭提示传达给玩家)。
 * 第 3 次起返回 { frozen: username },由调用方(路由)执行冻结账号 + 踢下线。
 * 返回 { ok, code, count, frozen } 或 false(房间不存在)
 */
export function banRoom(io, code, reason = "") {
  const room = rooms.get(code);
  if (!room) return false;
  const count = bans.filter((b) => b.username === room.hostName).length + 1;
  bans.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    username: room.hostName,
    code,
    at: Date.now(),
    count,
    reason: String(reason || "").trim().slice(0, 200) || null,
  });
  persistBans();
  // 向房主发分级警告(前端手绘弹窗;仅房主收到)
  const msg = warnMessage(code, count, reason);
  for (const s of io.sockets.sockets.values()) {
    if (s.data?.username === room.hostName) {
      try {
        s.emit("admin_warn", { message: msg });
      } catch {
        /* 连接可能已断开,忽略 */
      }
    }
  }
  closeRoom(io, code, "该房间已被管理员封禁" + (reason ? ":" + String(reason).trim().slice(0, 200) : ""));
  return { ok: true, code, count, frozen: count >= 3 ? room.hostName : null };
}

/** 全部封禁记录(新在前) */
export function listBans() {
  return [...bans].sort((a, b) => b.at - a.at);
}

/** 删除一条封禁记录(该房主下次封禁次数按剩余记录重算)。返回是否成功 */
export function removeBan(id) {
  const idx = bans.findIndex((b) => String(b.id) === String(id));
  if (idx < 0) return false;
  bans.splice(idx, 1);
  persistBans();
  return true;
}

export function registerRoomHandlers(io) {
  // 房间状态/列表变化后向所有客户端广播最新房间列表(大厅实时刷新)
  function broadcastRooms() {
    io.emit("rooms_updated", listRooms());
  }

  io.on("connection", (socket) => {
    socket.data.roomCode = null;

    // ---------- 建房 ----------
    socket.on("create_room", ({ soup, password } = {}, ack) => {
      const playerName = socket.data.username; // 账号用户名即游戏昵称(连接时已鉴权)
      if (!playerName) return ack?.({ error: "请先登录" });
      // 一人一房:同一账号同时最多 1 个房间,避免僵尸房堆积
      const existing = [...rooms.values()].find((r) => r.hostName === playerName);
      if (existing) {
        return ack?.({ error: `你已有一个房间 #${existing.code},请先离开它再创建` });
      }
      const soupObj = resolveSoup(soup);
      if (!soupObj) return ack?.({ error: "请选择有效的谜题" });

      const code = genCode();
      const room = {
        code,
        hostId: socket.id,
        hostName: playerName,
        status: "waiting",
        round: 0,
        players: [{ sid: socket.id, name: playerName, online: true, joinedAt: Date.now() }],
        soup: soupObj,
        password: password ? String(password).slice(0, 20) : null,
        maxPlayers: MAX_PLAYERS,
        questions: [],
        guesses: [],
        hints: [],
        currentQuestionerId: null,
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      // 校验全部通过:若之前挂靠其它房间(非房主),先离开旧房,避免留下幻影玩家
      if (socket.data.roomCode) {
        leaveRoom();
      }
      socket.data.roomCode = code;
      socket.join(code);
      broadcastRooms();
      ack?.({ ok: true, room: publicRoom(room, socket.id) });
    });

    // ---------- 加入/重连 ----------
    socket.on("join_room", ({ roomCode, password } = {}, ack) => {
      const code = String(roomCode || "").trim().toUpperCase();
      const playerName = socket.data.username; // 账号用户名即游戏昵称
      const room = rooms.get(code);
      if (!room) return ack?.({ error: "房间不存在" });
      if (!playerName) return ack?.({ error: "请先登录" });

      const existing = room.players.find((p) => p.name === playerName);
      if (existing) {
        // 断线重连恢复(同名玩家),沿用原槽位,免密码
        const isHost = existing.sid === room.hostId;
        const wasQuestioner = room.currentQuestionerId === existing.sid;
        existing.sid = socket.id;
        existing.online = true;
        if (isHost) {
          room.hostId = socket.id;
          room.hostName = playerName;
          if (room._hostTimer) {
            clearTimeout(room._hostTimer);
            room._hostTimer = null;
          }
        }
        if (wasQuestioner) {
          // 重连者原本是当前提问者:提问权跟随新 sid
          room.currentQuestionerId = socket.id;
        } else if (room.status === "playing") {
          // 提问权丢失(为 null)或仍指向已离线/不存在的玩家时,重连后修复
          const cur = room.players.find((p) => p.sid === room.currentQuestionerId);
          if (!cur || !cur.online) {
            room.currentQuestionerId = nextQuestioner(room, room.hostId);
          }
        }
      } else {
        if (room.status !== "waiting") {
          return ack?.({ error: "游戏已开始,无法加入(除非是断线重连)" });
        }
        if (room.players.length >= room.maxPlayers) {
          return ack?.({ error: `房间已满(${room.maxPlayers}人),无法加入` });
        }
        if (room.password) {
          if (!String(password ?? "")) return ack?.({ error: "该房间需要密码" });
          if (String(password) !== room.password) return ack?.({ error: "房间密码错误" });
        }
        room.players.push({ sid: socket.id, name: playerName, online: true, joinedAt: Date.now() });
      }
      socket.data.roomCode = code;
      // 校验全部通过:若之前挂靠其它房间,先离开旧房(被拒场景不破坏原房间)
      if (socket.data.roomCode && socket.data.roomCode !== code) {
        leaveRoom();
      }
      socket.join(code);
      broadcast(io, room);
      broadcastRooms();
      ack?.({ ok: true, room: publicRoom(room, socket.id) });
    });

    // ---------- 离开(房主退出 = 解散房间;玩家退出 = 仅自己离开)----------
    function leaveRoom() {
      const code = socket.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      socket.leave(code);
      socket.data.roomCode = null;
      const wasHost = room.hostId === socket.id;
      room.players = room.players.filter((p) => p.sid !== socket.id);
      if (wasHost) {
        // 房主离开:解散房间(closeRoom 内部已广播房间列表)
        closeRoom(io, code, "房主已离开,房间解散");
      } else if (!room.players.some((p) => p.online)) {
        // 剩余玩家(含离线等待重连的)无人值守:交给清扫器宽限后解散
        room.allOfflineAt = room.allOfflineAt || Date.now();
        broadcastRooms();
      } else {
        if (room.currentQuestionerId === socket.id) {
          room.currentQuestionerId = nextQuestioner(room, socket.id);
        }
        broadcast(io, room);
        broadcastRooms();
      }
    }
    socket.on("leave_room", leaveRoom);

    // ---------- 断开(标记离线,保留重连机会;全员离线宽限后由清扫器解散)----------
    socket.on("disconnect", () => {
      const code = socket.data.roomCode;
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      const p = room.players.find((x) => x.sid === socket.id);
      if (!p) return;
      p.online = false;
      if (room.hostId === socket.id) {
        room.hostOfflineAt = Date.now(); // 记录房主离线时刻,超时由全局清扫解散
      } else if (room.currentQuestionerId === socket.id) {
        // 当前提问者断线:立即把提问权转给下一个在线玩家,避免整局卡死
        room.currentQuestionerId = nextQuestioner(room, socket.id);
      }
      broadcast(io, room);
      broadcastRooms();
    });

    // ---------- 开始游戏 ----------
    socket.on("start_game", (ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (socket.id !== room.hostId) return ack?.({ error: "只有房主可以开始游戏" });
      if (room.status !== "waiting") return ack?.({ error: "游戏已在进行中" });
      if (!room.soup) return ack?.({ error: "尚未选题" });
      const nonHost = room.players.filter((p) => p.sid !== room.hostId && p.online);
      if (!nonHost.length) return ack?.({ error: "至少需要一名玩家加入才能开始" });
      room.status = "playing";
      room.round += 1;
      room.questions = [];
      room.guesses = [];
      room.hints = [];
      room.currentQuestionerId = nonHost[0].sid;
      broadcast(io, room);
      broadcastRooms();
      ack?.({ ok: true });
    });

    // ---------- 提问(轮到当前提问者)----------
    socket.on("ask_question", ({ text } = {}, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (room.status !== "playing") return ack?.({ error: "游戏未在进行中" });
      if (socket.id === room.hostId) return ack?.({ error: "房主是出题人,不参与提问" });
      if (socket.id !== room.currentQuestionerId) return ack?.({ error: "还没轮到你提问" });
      const t = String(text || "").trim();
      if (!t) return ack?.({ error: "问题不能为空" });
      if (rateLimited(socket, "lastAsk")) return ack?.({ error: "操作太频繁,请稍后再试" });
      const player = room.players.find((p) => p.sid === socket.id);
      room.questions.push({
        id: ++seq,
        playerId: socket.id,
        playerName: player?.name || "玩家",
        text: t.slice(0, 200),
        answer: null,
        hint: null,
        time: Date.now(),
      });
      broadcast(io, room);
      ack?.({ ok: true });
    });

    // ---------- 作答(房主)+ 轮转到下一位提问者 ----------
    socket.on("answer_question", ({ questionId, answer, hint } = {}, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (socket.id !== room.hostId) return ack?.({ error: "只有房主可以作答" });
      if (room.status !== "playing") return ack?.({ error: "游戏未在进行中" });
      const q = room.questions.find((x) => x.id === questionId);
      if (!q) return ack?.({ error: "问题不存在" });
      if (q.answer) return ack?.({ error: "该问题已作答" });
      if (!["yes", "no", "irrelevant"].includes(answer)) return ack?.({ error: "无效的回答" });
      q.answer = answer;
      q.hint = String(hint || "").trim().slice(0, 100) || null;
      room.currentQuestionerId = nextQuestioner(room, q.playerId);
      broadcast(io, room);
      broadcastRooms();
      ack?.({ ok: true });
    });

    // ---------- 提交汤底还原(玩家;房主是出题人不能提交)----------
    socket.on("submit_guess", ({ text } = {}, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (room.status !== "playing") return ack?.({ error: "游戏未在进行中" });
      if (socket.id === room.hostId) return ack?.({ error: "房主是出题人,不能提交还原" });
      const t = String(text || "").trim();
      if (!t) return ack?.({ error: "还原内容不能为空" });
      if (rateLimited(socket, "lastGuess")) return ack?.({ error: "操作太频繁,请稍后再试" });
      const player = room.players.find((p) => p.sid === socket.id);
      room.guesses.push({
        id: ++seq,
        playerId: socket.id,
        playerName: player?.name || "玩家",
        text: t.slice(0, 500),
        correct: null,
        time: Date.now(),
      });
      broadcast(io, room);
      ack?.({ ok: true });
    });

    // ---------- 房主判定猜底 ----------
    socket.on("judge_guess", ({ guessId, correct } = {}, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (socket.id !== room.hostId) return ack?.({ error: "只有房主可以判定" });
      const g = room.guesses.find((x) => x.id === guessId);
      if (!g) return ack?.({ error: "猜底不存在" });
      if (g.correct !== null) return ack?.({ error: "该猜底已判定" });
      g.correct = Boolean(correct);
      if (g.correct) room.status = "revealed";
      broadcast(io, room);
      broadcastRooms();
      ack?.({ ok: true });
    });

    // ---------- 房主发送提示(广播给所有玩家)----------
    socket.on("host_hint", ({ text } = {}, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (socket.id !== room.hostId) return ack?.({ error: "只有房主可以发提示" });
      if (room.status !== "playing") return ack?.({ error: "游戏未在进行中" });
      const t = String(text || "").trim();
      if (!t) return ack?.({ error: "提示内容不能为空" });
      if (rateLimited(socket, "lastHint")) return ack?.({ error: "操作太频繁,请稍后再试" });
      room.hints.push({ id: ++seq, text: t.slice(0, 200), time: Date.now() });
      broadcast(io, room);
      broadcastRooms();
      ack?.({ ok: true });
    });

    // ---------- 再来一局(房主,可换题)----------
    socket.on("next_round", ({ soup } = {}, ack) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return ack?.({ error: "房间不存在" });
      if (socket.id !== room.hostId) return ack?.({ error: "只有房主可以开始下一局" });
      if (room.status !== "revealed") return ack?.({ error: "当前回合未结束,不能开始下一局" });
      if (soup) {
        const soupObj = resolveSoup(soup);
        if (!soupObj) return ack?.({ error: "请选择有效的谜题" });
        room.soup = soupObj;
      }
      room.status = "playing";
      room.round += 1;
      room.questions = [];
      room.guesses = [];
      room.hints = [];
      const nonHost = room.players.filter((p) => p.sid !== room.hostId && p.online);
      room.currentQuestionerId = nonHost.length ? nonHost[0].sid : null;
      broadcast(io, room);
      broadcastRooms();
      ack?.({ ok: true });
    });
  });

  // 启动全局房间清扫(房主离线超时 / 等待超时 / 全员离线兜底)
  startSweeper(io);
}
