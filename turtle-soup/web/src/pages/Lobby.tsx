import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconSoup,
  IconUser,
  IconBell,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconSparkles,
  IconUsers,
  IconLock,
  IconTrash,
  IconShield,
  IconSearch,
  IconFileText,
  IconGlobe,
} from "@tabler/icons-react";
import {
  clearToken,
  clearUsername,
  connectSocket,
  emitAck,
  getToken,
  getUsername,
  onSocketError,
  setToken,
  setUsername,
  socket,
} from "../socket";
import type { AckRes, RoomListItem, Soup } from "../types";

type SoupMode = "library" | "custom";

interface AuthRes {
  username?: string;
  token?: string;
  error?: string;
}

// 用户消息(通知中心,独立于管理端数据)
interface UserMsg {
  id: number;
  type: "submission" | "feedback" | "appeal";
  refId: number | null;
  title: string;
  body: string | null; // 账户类通知(冻结/封禁/申诉结果)的正文
  status: string; // pending/approved/rejected/adopted/done
  resolution: string | null; // fixed/improved
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

const NOTIF_READ_KEY = "turtle-soup-read-notif";
const NOTIF_POLL_MS = 30000;

function fmtTime(t: number) {
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Lobby() {
  const navigate = useNavigate();
  const [token, setTokenState] = useState(() => getToken());
  const [username, setUsernameState] = useState(() => getUsername());

  // 登录/注册
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authUser, setAuthUser] = useState("");
  const [authPwd, setAuthPwd] = useState("");
  const [authPwd2, setAuthPwd2] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState("");
  // 账号申诉(被封禁/冻结时提交;账号区需密码验证,IP 区独立)
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealUser, setAppealUser] = useState("");
  const [appealPwd, setAppealPwd] = useState("");
  const [appealText, setAppealText] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealMsg, setAppealMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // 账号状态查询
  const [statusUser, setStatusUser] = useState("");
  const [statusPwd, setStatusPwd] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusRes, setStatusRes] = useState<{
    accountLabel: string;
    accountStatus: string;
    ipBanned: boolean;
    regIp: string | null;
    penaltyReason: string | null;
    ipBanReason: string | null;
    appeal: { label: string; reply: string | null; at: number; content: string } | null;
    appeals: { status: string; label: string; at: number; reply: string | null; content: string }[];
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // IP 封禁申诉
  const [ipAppealIp, setIpAppealIp] = useState("");
  const [ipAppealText, setIpAppealText] = useState("");
  const [ipAppealBusy, setIpAppealBusy] = useState(false);
  const [ipAppealMsg, setIpAppealMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState("");

  // 通知中心(题库审核 / 反馈审核 / 账户冻结封禁 / 申诉结果,统一单列表)
  const [myMsgs, setMyMsgs] = useState<UserMsg[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
const [notifFlash, setNotifFlash] = useState(""); // 服务端实时推送的临时提示条
  const [readIds, setReadIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // 建房/加入
  const [tab, setTab] = useState<"create" | "join">("create");
  const [soups, setSoups] = useState<Soup[]>([]);
  const [mode, setMode] = useState<SoupMode>("library");
  const [soupId, setSoupId] = useState<number | null>(null);
  const [soupCatFilter, setSoupCatFilter] = useState("all");
  const [favIds, setFavIds] = useState<number[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [soupMeta, setSoupMeta] = useState<{ categories: string[]; categoryLabels: Record<string, string>; difficulties: string[]; difficultyLabels: Record<string, string> }>({ categories: [], categoryLabels: {}, difficulties: [], difficultyLabels: {} });
  const [customTitle, setCustomTitle] = useState("");
  const [customSurface, setCustomSurface] = useState("");
  const [customTruth, setCustomTruth] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiCategory, setAiCategory] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("");
  const [createPwd, setCreatePwd] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomJoinPwd, setRoomJoinPwd] = useState("");
  const [roomList, setRoomList] = useState<RoomListItem[]>([]);
  const [listPwds, setListPwds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) {
      connectSocket();
      fetch("/api/soups")
        .then((r) => r.json())
        .then((list: Soup[]) => {
          setSoups(list);
          if (list.length && soupId === null) setSoupId(list[0].id);
        })
        .catch(() => setError("题库加载失败,请确认后端已启动"));
      fetch("/api/soup-meta")
        .then((r) => r.json())
        .then((m) => setSoupMeta(m))
        .catch(() => {});
      fetch("/api/favorites", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setFavIds(d.ids || []))
        .catch(() => {});
    }
    const offErr = onSocketError((msg) => {
      setError("连接失败:" + msg + "。若提示未登录,请退出后重新登录");
    });
    return offErr;
  }, [token]);

  // 监听服务端房间列表推送(初始加载一次 + rooms_updated 实时更新)
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/rooms");
        if (r.ok && alive) setRoomList(await r.json());
      } catch {
        /* 网络波动时静默 */
      }
    };
    load();
    const onRooms = (list: RoomListItem[]) => alive && setRoomList(list);
    socket.on("rooms_updated", onRooms);
    return () => {
      alive = false;
      socket.off("rooms_updated", onRooms);
    };
  }, [token]);

  // 被管理员踢下线(封禁/冻结/重置密码/删除账号):立即退出登录并提示
  useEffect(() => {
    if (!token) return;
    const onKicked = ({ reason }: { reason?: string }) => {
      clearToken();
      clearUsername();
      socket.disconnect();
      setTokenState("");
      setUsernameState("");
      setError(reason || "账号已被管理员停用,请重新登录");
      // 回到登录门时也要让用户知道发生了什么(封禁/冻结/删除/重置)
      setAuthErr(
        "⚠️ " + (reason || "账号已被管理员停用") + "。\n可点击下方「账号申诉」查询账号状态或提交申诉。",
      );
    };
    socket.on("kicked", onKicked);
    return () => {
      socket.off("kicked", onKicked);
    };
  }, [token]);

  // 轮询我的消息,检测题库/反馈审核结果(每 30 秒)
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/messages/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok && alive) setMyMsgs(await r.json());
      } catch {
        /* 网络波动时静默,下一轮重试 */
      }
    };
    load();
    const timer = setInterval(load, NOTIF_POLL_MS);
    // 服务端实时推送:审核结果一到立即刷新,免等轮询
    const onNotif = (payload?: { title?: string }) => {
      if (!alive) return;
      if (payload?.title) {
        const t = payload.title;
        setNotifFlash(t);
        window.setTimeout(() => setNotifFlash((f) => (f === t ? "" : f)), 5000);
      }
      load();
    };
    socket.on("notification", onNotif);
    return () => {
      alive = false;
      clearInterval(timer);
      socket.off("notification", onNotif);
    };
  }, [token]);

  const unreadCount = useMemo(
    () => myMsgs.filter((s) => s.status !== "pending" && !readIds.includes(s.id)).length,
    [myMsgs, readIds],
  );

  function openNotif() {
    if (!notifOpen) {
      const reviewed = myMsgs.filter((s) => s.status !== "pending");
      if (reviewed.length) {
        const ids = Array.from(new Set([...readIds, ...reviewed.map((s) => s.id)]));
        setReadIds(ids);
        try {
          localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(ids));
        } catch {
          /* 存储不可用时忽略 */
        }
      }
    }
    setNotifOpen(!notifOpen);
  }

  // 删除我的某条消息(仅用户端,不影响管理端数据)
  async function deleteMsg(id: number) {
    setMyMsgs((list) => list.filter((m) => m.id !== id));
    try {
      await fetch(`/api/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* 网络失败时本地已移除,下次轮询纠正 */
    }
  }

  const selectedSoup = useMemo(
    () => soups.find((s) => s.id === soupId) || null,
    [soups, soupId],
  );

  // 按分类筛选后的题库列表
  const filteredSoups = useMemo(() => {
    let list = soupCatFilter === "all" ? soups : soups.filter((s) => s.category === soupCatFilter);
    if (favOnly) list = list.filter((s) => s.id !== null && favIds.includes(s.id));
    return list;
  }, [soups, soupCatFilter, favOnly, favIds]);

  // 切换收藏(乐观更新)
  async function toggleFav(id: number) {
    const isFav = favIds.includes(id);
    setFavIds(isFav ? favIds.filter((x) => x !== id) : [...favIds, id]);
    try {
      await fetch(`/api/favorites/${id}`, {
        method: isFav ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* 网络失败时保留本地状态,下次刷新纠正 */
    }
  }

  // 题目标签中文文案(无标签显示"未分类")
  function soupTag(s: Soup) {
    const cat = s.category ? soupMeta.categoryLabels[s.category] : "";
    const diff = s.difficulty ? soupMeta.difficultyLabels[s.difficulty] : "";
    return cat || diff ? `[${[cat, diff].filter(Boolean).join("·")}]` : "";
  }

  async function handleAuth() {
    setAuthErr("");
    if (!authUser.trim() || !authPwd) return setAuthErr("请输入用户名和密码");
    if (authTab === "register" && authPwd !== authPwd2)
      return setAuthErr("两次输入的密码不一致");
    setAuthBusy(true);
    try {
      const r = await fetch(`/api/auth/${authTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUser.trim(), password: authPwd }),
      });
      const data: AuthRes = await r.json();
      if (!r.ok) return setAuthErr(data.error || "操作失败");
      setError("");
      setToken(data.token || "");
      setUsername(data.username || "");
      setTokenState(data.token || "");
      setUsernameState(data.username || "");
      setAuthUser("");
      setAuthPwd("");
      setAuthPwd2("");
    } catch {
      setAuthErr("网络错误,请重试");
    } finally {
      setAuthBusy(false);
    }
  }

  // 提交账号申诉(被封禁/冻结时,凭 用户名+密码 验证身份;每次封禁/冻结可申诉一次)
  async function submitAppeal() {
    if (!appealUser.trim()) return setAppealMsg({ ok: false, text: "请填写要申诉的账号名" });
    if (!appealPwd) return setAppealMsg({ ok: false, text: "请输入账号密码以验证身份" });
    if (appealText.trim().length < 5) return setAppealMsg({ ok: false, text: "申诉内容至少 5 个字" });
    setAppealBusy(true);
    setAppealMsg(null);
    try {
      const r = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "account",
          username: appealUser.trim(),
          password: appealPwd,
          content: appealText.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) return setAppealMsg({ ok: false, text: data.error || "提交失败" });
      setAppealMsg({ ok: true, text: "申诉已提交,请等待管理员审核(结果可在上方状态查询中查看)" });
      setAppealText("");
    } catch {
      setAppealMsg({ ok: false, text: "网络错误,请重试" });
    } finally {
      setAppealBusy(false);
    }
  }

  // 账号状态查询:输入 用户名+密码 查看当前状态与申诉结果
  async function queryAccountStatus() {
    if (!statusUser.trim()) return setStatusMsg({ ok: false, text: "请填写账号名" });
    if (!statusPwd) return setStatusMsg({ ok: false, text: "请输入账号密码" });
    setStatusBusy(true);
    setStatusMsg(null);
    setStatusRes(null);
    try {
      const r = await fetch("/api/appeals/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: statusUser.trim(), password: statusPwd }),
      });
      const data = await r.json();
      if (!r.ok) return setStatusMsg({ ok: false, text: data.error || "查询失败" });
      setStatusRes(data);
    } catch {
      setStatusMsg({ ok: false, text: "网络错误,请重试" });
    } finally {
      setStatusBusy(false);
    }
  }

  // 提交 IP 封禁申诉(无需账号,同一 IP 同时最多一条待审核)
  async function submitIpAppeal() {
    if (!ipAppealIp.trim()) return setIpAppealMsg({ ok: false, text: "请填写被封禁的 IP(可点「获取我的 IP」)" });
    if (ipAppealText.trim().length < 5) return setIpAppealMsg({ ok: false, text: "申诉内容至少 5 个字" });
    setIpAppealBusy(true);
    setIpAppealMsg(null);
    try {
      const r = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ip", ip: ipAppealIp.trim(), content: ipAppealText.trim() }),
      });
      const data = await r.json();
      if (!r.ok) return setIpAppealMsg({ ok: false, text: data.error || "提交失败" });
      setIpAppealMsg({ ok: true, text: "IP 申诉已提交,请等待管理员审核" });
      setIpAppealText("");
    } catch {
      setIpAppealMsg({ ok: false, text: "网络错误,请重试" });
    } finally {
      setIpAppealBusy(false);
    }
  }

  // 获取当前访问 IP(不知道自己 IP 时使用)
  async function fetchMyIp() {
    try {
      const r = await fetch("/api/my-ip");
      const d = await r.json();
      setMyIp(d.ip || "未知");
      if (d.ip) setIpAppealIp(d.ip);
    } catch {
      setMyIp("获取失败");
    }
  }

  function handleLogout() {
    // 通知服务端作废当前 token(尽力而为,不阻塞本地登出)
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearToken();
    clearUsername();
    socket.disconnect();
    setTokenState("");
    setUsernameState("");
    setError("");
  }

  function go(room: AckRes["room"]) {
    if (!room) return;
    navigate(`/game/${room.code}`);
  }

  // 申请上传题库(玩家提交,管理员审核通过后入库)
  async function handleSubmitSoup() {
    setError("");
    setSubMsg("");
    if (!customSurface.trim() || !customTruth.trim())
      return setError("申请上传需要填写汤面和汤底");
    setSubBusy(true);
    try {
      const r = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: customTitle,
          surface: customSurface,
          truth: customTruth,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setError(d.error || "提交失败,请稍后再试");
      setSubMsg("已提交申请,等待管理员审核通过后即可进入题库");
    } catch {
      setError("提交失败,请检查网络");
    } finally {
      setSubBusy(false);
    }
  }

  async function handleCreate() {
    setError("");
    let soup: unknown;
    if (mode === "library") {
      if (soupId === null) return setError("请选择谜题");
      soup = { soupId };
    } else {
      if (!customSurface.trim() || !customTruth.trim())
        return setError("自定义谜题需要填写汤面和汤底");
      soup = { custom: { title: customTitle, surface: customSurface, truth: customTruth } };
    }
    setBusy(true);
    try {
      const res = await emitAck<AckRes>("create_room", {
        soup,
        password: createPwd.trim() || undefined,
      });
      if (res.error) return setError(res.error);
      go(res.room);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(code?: string, password?: string) {
    setError("");
    const c = (code || roomCode).trim().toUpperCase();
    if (!code && !/^[A-Z2-9]{6}$/.test(c))
      return setError("房间码应为 6 位(不含 I/O/0/1)");
    setBusy(true);
    try {
      const res = await emitAck<AckRes>("join_room", {
        roomCode: c,
        password: password || undefined,
      });
      if (res.error) return setError(res.error);
      go(res.room);
    } finally {
      setBusy(false);
    }
  }

  async function handleAiGenerate() {
    setError("");
    if (!aiTopic.trim()) return setError("请输入生成题材,如:复仇、校园、深夜");
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          category: aiCategory || undefined,
          difficulty: aiDifficulty || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setCustomTitle(data.title || "");
      setCustomSurface(data.surface);
      setCustomTruth(data.truth);
      setError("");
    } catch (e) {
      setError(`AI 生成失败:${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAiBusy(false);
    }
  }

  // ---------- 未登录:登录/注册门 ----------
  if (!token) {
    return (
      <div className="lobby">
        <h1 className="lobby-title"><IconSoup size={46} stroke={2.4} className="lobby-icon" /> 海龟汤</h1>
        <p className="lobby-sub">在线推理 · 需注册账号后才能建房或加入房间</p>
        <div className="panel">
          <div className="tabs">
            <button className={authTab === "login" ? "tab active" : "tab"} onClick={() => setAuthTab("login")}>
              登录
            </button>
            <button className={authTab === "register" ? "tab active" : "tab"} onClick={() => setAuthTab("register")}>
              注册
            </button>
          </div>
          <label className="field">
            <span>用户名(2~20 位,中文/字母/数字/下划线)</span>
            <input
              value={authUser}
              maxLength={20}
              onChange={(e) => setAuthUser(e.target.value)}
              placeholder="输入用户名"
              autoFocus
            />
          </label>
          <label className="field">
            <span>密码(4~64 位)</span>
            <input
              type="password"
              value={authPwd}
              onChange={(e) => setAuthPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              placeholder="输入密码"
            />
          </label>
          {authTab === "register" && (
            <label className="field">
              <span>确认密码</span>
              <input
                type="password"
                value={authPwd2}
                onChange={(e) => setAuthPwd2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                placeholder="再次输入密码"
              />
            </label>
          )}
          <button className="primary big" disabled={authBusy} onClick={handleAuth}>
            {authBusy ? "处理中…" : authTab === "login" ? "登录" : "注册并登录"}
          </button>
          {authErr && <div className="error">{authErr}</div>}
          <button
            className="secondary"
            style={{ marginTop: 10 }}
            onClick={() => {
              setAppealOpen(true);
              setAppealUser(authUser);
              setAppealText("");
              setAppealMsg(null);
            }}
          >
            <IconLock size={16} style={{ verticalAlign: -2, marginRight: 4 }} /> 账号被封禁/冻结了?点击申诉
          </button>
        </div>

        {/* 账号/IP 申诉弹窗(手绘风,三区块) */}
        {appealOpen && (
          <div className="dlg-mask" onClick={() => !appealBusy && !statusBusy && !ipAppealBusy && setAppealOpen(false)}>
            <div className="dlg-card appeal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="dlg-tape" />
              <h3 className="dlg-title">申诉中心</h3>

              {/* 区 1:账号状态查询 */}
              <div className="appeal-section">
                <div className="appeal-sec-title"><IconSearch size={17} style={{ verticalAlign: -3, marginRight: 5 }} /> 账号状态查询(输入账号密码即可查看)</div>
                <div className="appeal-row">
                  <input
                    value={statusUser}
                    maxLength={20}
                    disabled={statusBusy}
                    onChange={(e) => setStatusUser(e.target.value)}
                    placeholder="账号名"
                  />
                  <input
                    type="password"
                    value={statusPwd}
                    disabled={statusBusy}
                    onChange={(e) => setStatusPwd(e.target.value)}
                    placeholder="密码"
                  />
                  <button className="secondary" disabled={statusBusy} onClick={queryAccountStatus}>
                    {statusBusy ? "查询中…" : "查询状态"}
                  </button>
                </div>
                {statusMsg && (
                  <div className={statusMsg.ok ? "ok-msg" : "error"} style={{ marginTop: 6 }}>
                    {statusMsg.text}
                  </div>
                )}
                {statusRes && (
                  <div className="status-result">
                    <div>账号状态:<b>{statusRes.accountLabel}</b>
                      {statusRes.ipBanned ? (
                        <span style={{ color: "#a33" }}>
                          {" "}(IP 被封禁:<b>{statusRes.regIp || "未知"}</b>)
                        </span>
                      ) : null}
                    </div>
                    {statusRes.penaltyReason && (
                      <div>封禁/冻结理由:<b>{statusRes.penaltyReason}</b></div>
                    )}
                    {statusRes.ipBanned && statusRes.ipBanReason && (
                      <div>IP 封禁理由:<b>{statusRes.ipBanReason}</b></div>
                    )}
                    {statusRes.ipBanned && !statusRes.ipBanReason && (
                      <div style={{ color: "var(--ink-soft)" }}>
                        被封禁的 IP 就是你的注册 IP <b>{statusRes.regIp || "未知"}</b>,如非本人可到下方「IP 封禁申诉」提交申诉
                      </div>
                    )}
                    {statusRes.appeal ? (
                      <div>
                        <div style={{ fontWeight: 700, marginTop: 4 }}>申诉记录(共 {statusRes.appeals.length} 条,新在前):</div>
                        {statusRes.appeals.map((ap, i) => (
                          <div key={i} style={{ paddingLeft: 8, borderLeft: "3px dashed var(--line)", margin: "4px 0" }}>
                            <span>{fmtTime(ap.at)} · <b>{ap.label}</b></span>
                            {ap.reply ? <div style={{ color: "var(--ink-soft)" }}>回复:{ap.reply}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "var(--ink-soft)" }}>该账号尚未提交过申诉</div>
                    )}
                  </div>
                )}
              </div>

              {/* 区 2:账号申诉 */}
              <div className="appeal-section">
                <div className="appeal-sec-title"><IconFileText size={17} style={{ verticalAlign: -3, marginRight: 5 }} /> 账号申诉(封禁/冻结后凭账号密码验证提交,每次处罚可申诉一次)</div>
                <div className="appeal-row">
                  <input
                    value={appealUser}
                    maxLength={20}
                    disabled={appealBusy}
                    onChange={(e) => setAppealUser(e.target.value)}
                    placeholder="账号名"
                  />
                  <input
                    type="password"
                    value={appealPwd}
                    disabled={appealBusy}
                    onChange={(e) => setAppealPwd(e.target.value)}
                    placeholder="密码(验证身份)"
                  />
                </div>
                <textarea
                  value={appealText}
                  maxLength={500}
                  rows={3}
                  disabled={appealBusy}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="申诉内容(5~500 字)…"
                />
                {appealMsg && (
                  <div className={appealMsg.ok ? "ok-msg" : "error"} style={{ marginTop: 6 }}>
                    {appealMsg.text}
                  </div>
                )}
                <button className="primary" disabled={appealBusy} onClick={submitAppeal}>
                  {appealBusy ? "提交中…" : "提交账号申诉"}
                </button>
              </div>

              {/* 区 3:IP 封禁申诉 */}
              <div className="appeal-section">
                <div className="appeal-sec-title"><IconGlobe size={17} style={{ verticalAlign: -3, marginRight: 5 }} /> IP 封禁申诉(你的 IP 被封禁时提交)</div>
                <div className="appeal-row">
                  <input
                    value={ipAppealIp}
                    maxLength={64}
                    disabled={ipAppealBusy}
                    onChange={(e) => setIpAppealIp(e.target.value)}
                    placeholder="被封禁的 IP"
                  />
                  <button className="secondary" disabled={ipAppealBusy} onClick={fetchMyIp}>
                    获取我的 IP
                  </button>
                </div>
                {myIp && (
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                    你的当前 IP:<b>{myIp}</b>(已自动填入,请确认是否为被封的那个)
                  </div>
                )}
                <textarea
                  value={ipAppealText}
                  maxLength={500}
                  rows={3}
                  disabled={ipAppealBusy}
                  onChange={(e) => setIpAppealText(e.target.value)}
                  placeholder="说明情况(5~500 字)…"
                />
                {ipAppealMsg && (
                  <div className={ipAppealMsg.ok ? "ok-msg" : "error"} style={{ marginTop: 6 }}>
                    {ipAppealMsg.text}
                  </div>
                )}
                <button className="primary" disabled={ipAppealBusy} onClick={submitIpAppeal}>
                  {ipAppealBusy ? "提交中…" : "提交 IP 申诉"}
                </button>
              </div>

              <div className="dlg-btns" style={{ marginTop: 10 }}>
                <button className="secondary" disabled={appealBusy || statusBusy || ipAppealBusy} onClick={() => setAppealOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- 已登录 ----------
  return (
    <div className="lobby">
      {notifFlash && (
        <div className="notif-flash">
          <IconBell size={16} stroke={2.5} className="inline-icon" /> {notifFlash}
        </div>
      )}
      <h1 className="lobby-title"><IconSoup size={46} stroke={2.4} className="lobby-icon" /> 海龟汤</h1>
      <p className="lobby-sub">
        你好,<b>{username}</b> · 创建房间或输入房间码加入
      </p>

      <div className="panel">
        <div className="user-bar">
          <span className="user-chip"><IconUser size={16} stroke={2.5} className="inline-icon" /> {username}</span>
          <div className="notif-wrap">
            <button className="notif-btn" onClick={openNotif} title="题库审核通知">
              <IconBell size={20} stroke={2.5} className="inline-icon" />
              {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <>
                {/* 点击面板外任意处关闭 */}
                <div className="notif-mask" onClick={() => setNotifOpen(false)} />
                <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="notif-head">消息通知</div>
                  <div className="hint" style={{ padding: "2px 14px 6px", color: "var(--ink-soft)", fontSize: 12.5 }}>
                    题库审核 · 反馈审核 · 账户冻结/封禁 · 申诉结果
                  </div>
                  {myMsgs.length === 0 && <div className="hint empty">暂无消息</div>}
                  {[...myMsgs]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((s) => (
                      <div key={s.id} className={`notif-item st-${s.status || "done"}`}>
                        <div className="notif-title">
                          {s.type === "submission" ? (
                            s.status === "approved" ? (
                              <><IconCircleCheck size={16} stroke={2.5} className="inline-icon" /> 已通过</>
                            ) : s.status === "rejected" ? (
                              <><IconCircleX size={16} stroke={2.5} className="inline-icon" /> 未通过</>
                            ) : (
                              <><IconClock size={16} stroke={2.5} className="inline-icon" /> 审核中</>
                            )
                          ) : s.type === "feedback" ? (
                            s.status === "adopted" ? (
                              <><IconCircleCheck size={16} stroke={2.5} className="inline-icon" /> 已采纳{s.resolution === "fixed" ? "(已修复)" : s.resolution === "improved" ? "(已改进)" : ""}</>
                            ) : s.status === "rejected" ? (
                              <><IconCircleX size={16} stroke={2.5} className="inline-icon" /> 拒绝采纳</>
                            ) : (
                              <><IconClock size={16} stroke={2.5} className="inline-icon" /> 审核中</>
                            )
                          ) : (
                            <><IconShield size={16} stroke={2.5} className="inline-icon" /> {s.title || "账号通知"}</>
                          )}
                          {s.type !== "appeal" && (s.title ? `《${s.title}》` : "未命名")}
                          <button
                            className="notif-del"
                            title="删除此条消息"
                            onClick={() => deleteMsg(s.id)}
                          >
                            <IconTrash size={14} stroke={2.5} />
                          </button>
                        </div>
                        <div className="notif-time">{fmtTime(s.createdAt)}{s.type === "appeal" ? "" : " 提交"}</div>
                        {s.type === "submission" ? (
                          s.status === "approved" ? (
                            <div className="notif-note">你的谜题已通过审核,已收录进题库,可用来开房间了!</div>
                          ) : s.status === "rejected" ? (
                            <div className="notif-note">
                              {s.note ? `未通过原因:${s.note}` : "未通过审核,可修改后重新提交"}
                            </div>
                          ) : (
                            <div className="notif-note">等待管理员审核中…</div>
                          )
                        ) : s.type === "feedback" ? (
                          s.status === "adopted" ? (
                            <div className="notif-note">
                              你的反馈已被采纳!
                              {s.note ? ` 说明:${s.note}` : ""}
                            </div>
                          ) : s.status === "rejected" ? (
                            <div className="notif-note">
                              {s.note ? `未采纳原因:${s.note}` : "未采纳,感谢你的反馈"}
                            </div>
                          ) : (
                            <div className="notif-note">等待管理员处理中…</div>
                          )
                        ) : (
                          <div className="notif-note">{s.body || s.title || "账号通知"}</div>
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
          <button onClick={handleLogout}>退出登录</button>
        </div>

        <div className="tabs">
          <button className={tab === "create" ? "tab active" : "tab"} onClick={() => setTab("create")}>
            创建房间
          </button>
          <button className={tab === "join" ? "tab active" : "tab"} onClick={() => setTab("join")}>
            加入房间
          </button>
        </div>

        {tab === "create" && (
          <div className="create-form">
            <div className="mode-row">
              <label>
                <input
                  type="radio"
                  checked={mode === "library"}
                  onChange={() => setMode("library")}
                />
                从题库选择
              </label>
              <label>
                <input
                  type="radio"
                  checked={mode === "custom"}
                  onChange={() => setMode("custom")}
                />
                自定义谜题
              </label>
            </div>

            {mode === "library" ? (
              <>
                <div className="filter-row">
                  <select
                    className="filter-select"
                    value={soupCatFilter}
                    onChange={(e) => setSoupCatFilter(e.target.value)}
                  >
                    <option value="all">全部分类</option>
                    {soupMeta.categories.map((c) => (
                      <option key={c} value={c}>
                        {soupMeta.categoryLabels[c] || c}
                      </option>
                    ))}
                  </select>
                  <label className="fav-toggle">
                    <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
                    只看收藏
                  </label>
                </div>
                <label className="field">
                  <span>选择谜题({filteredSoups.length} 题)</span>
                  <select value={soupId === null ? "" : String(soupId)} onChange={(e) => setSoupId(Number(e.target.value))}>
                    {filteredSoups.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.id !== null && favIds.includes(s.id) ? "★ " : ""}
                        {s.title ? `《${s.title}》` : `第 ${s.id} 题`}
                        {soupTag(s) ? ` ${soupTag(s)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedSoup && (
                  <div className="soup-preview">
                    <div className="preview-head">
                      <div className="preview-label">汤面预览</div>
                      {selectedSoup.id !== null && (
                        <button
                          className={`fav-btn ${favIds.includes(selectedSoup.id) ? "active" : ""}`}
                          onClick={() => toggleFav(selectedSoup.id!)}
                        >
                          {favIds.includes(selectedSoup.id) ? "★ 已收藏" : "☆ 收藏"}
                        </button>
                      )}
                    </div>
                    <div className="preview-text">{selectedSoup.surface}</div>
                  </div>
                )}
                <div className="tips">
                  建议使用自定义谜题让 AI 生成谜题,题库中谜题容易被滥用
                </div>
              </>
            ) : (
              <>
                <div className="ai-box">
                  <div className="preview-label"><IconSparkles size={16} stroke={2.5} className="inline-icon" /> AI 生成谜题(deepseek-v4-flash)</div>
                  <div className="ai-row">
                    <input
                      value={aiTopic}
                      maxLength={30}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="输入题材,如:复仇、校园、深夜"
                      onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                    />
                  </div>
                  <div className="ai-row">
                    <select value={aiCategory} onChange={(e) => setAiCategory(e.target.value)}>
                      <option value="">分类:不限</option>
                      {soupMeta.categories.map((c) => (
                        <option key={c} value={c}>
                          {soupMeta.categoryLabels[c] || c}
                        </option>
                      ))}
                    </select>
                    <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)}>
                      <option value="">难度:不限</option>
                      {soupMeta.difficulties.map((d) => (
                        <option key={d} value={d}>
                          {soupMeta.difficultyLabels[d] || d}
                        </option>
                      ))}
                    </select>
                    <button className="primary" disabled={aiBusy} onClick={handleAiGenerate}>
                      {aiBusy ? "生成中…" : "生成"}
                    </button>
                  </div>
                  <div className="ai-hint">可指定分类与难度,生成结果会填入下方表单,可手动修改后使用</div>
                </div>
                <label className="field">
                  <span>标题(可选)</span>
                  <input value={customTitle} maxLength={30} onChange={(e) => setCustomTitle(e.target.value)} placeholder="《我的谜题》" />
                </label>
                <label className="field">
                  <span>汤面</span>
                  <textarea
                    value={customSurface}
                    rows={3}
                    onChange={(e) => setCustomSurface(e.target.value)}
                    placeholder="给出离奇的情景…"
                  />
                </label>
                <label className="field">
                  <span>汤底(房主可见,玩家隐藏)</span>
                  <textarea
                    value={customTruth}
                    rows={3}
                    onChange={(e) => setCustomTruth(e.target.value)}
                    placeholder="完整真相,揭晓时展示…"
                  />
                </label>
                <div className="tips">
                  建议使用自定义谜题让 AI 生成谜题,题库中谜题容易被滥用
                </div>
              </>
            )}

            <label className="field">
              <span>房间密码(可选,留空则无密码)</span>
              <input
                type="password"
                value={createPwd}
                maxLength={20}
                onChange={(e) => setCreatePwd(e.target.value)}
                placeholder="不填则任何人都可通过房间码加入"
              />
            </label>

            <button className="primary big" disabled={busy} onClick={handleCreate}>
              {busy ? "创建中…" : "创建房间"}
            </button>
            {mode === "custom" && (
              <button className="secondary big" disabled={subBusy} onClick={handleSubmitSoup}>
                {subBusy ? "提交中…" : "申请上传题库"}
              </button>
            )}
            {subMsg && <div className="ok">{subMsg}</div>}
          </div>
        )}

        {tab === "join" && (
          <div className="join-form">
            <div className="join-list-head"><IconUsers size={16} stroke={2.5} className="inline-icon" /> 当前在线房间({roomList.length})</div>
            {roomList.length === 0 && (
              <div className="hint empty">暂无在线房间,快去创建一间或喊朋友建房吧</div>
            )}
            {roomList.map((r) => {
              const waiting = r.status === "waiting";
              return (
                <div key={r.code} className={`room-row ${waiting ? "" : "locked"}`}>
                  <div className="room-info">
                    <div className="room-code">
                      #{r.code}
                      {r.hasPassword && <IconLock size={14} stroke={2.5} className="inline-icon" />}
                    </div>
                    <div className="room-meta">
                      {r.hostName} 的房间
                      {r.soupTitle ? ` · 《${r.soupTitle}》` : ""} · {r.onlineCount}/{r.maxPlayers ?? r.playerCount} 人在线 ·{" "}
                      {waiting ? "等待开始" : `第 ${r.round} 局进行中`}
                    </div>
                    {r.hasPassword && (
                      <input
                        type="password"
                        className="room-pwd"
                        value={listPwds[r.code] || ""}
                        maxLength={20}
                        placeholder="输入房间密码"
                        onChange={(e) => setListPwds({ ...listPwds, [r.code]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleJoin(r.code, listPwds[r.code] || undefined)}
                      />
                    )}
                  </div>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => handleJoin(r.code, listPwds[r.code] || undefined)}
                  >
                    {waiting ? "加入" : "游戏中·点击重连"}
                  </button>
                </div>
              );
            })}

            <div className="divider">或输入房间码加入</div>
            <label className="field">
              <span>房间码</span>
              <input
                value={roomCode}
                maxLength={6}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="输入 6 位房间码"
                style={{ textTransform: "uppercase", letterSpacing: "4px", fontWeight: 600 }}
              />
            </label>
            <label className="field">
              <span>房间密码(如该房间设置了密码)</span>
              <input
                type="password"
                value={roomJoinPwd}
                maxLength={20}
                onChange={(e) => setRoomJoinPwd(e.target.value)}
                placeholder="无密码的房间可留空"
              />
            </label>
            <button
              className="primary big"
              disabled={busy}
              onClick={() => handleJoin(undefined, roomJoinPwd || undefined)}
            >
              {busy ? "加入中…" : "加入房间"}
            </button>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
