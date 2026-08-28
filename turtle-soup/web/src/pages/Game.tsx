import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconCrown,
  IconEye,
  IconLock,
  IconMessage,
  IconTarget,
  IconBulb,
  IconUser,
} from "@tabler/icons-react";
import { connectSocket, emitAck, getUsername, socket } from "../socket";
import type { AckRes, Question, Room } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

function fmtTime(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const ANSWER_LABEL: Record<string, string> = {
  yes: "是",
  no: "否",
  irrelevant: "无关",
};

// 标记当前用户是否为房主,供底部导航(App.tsx)判断退出确认文案
const HOST_KEY = "turtle-soup-in-room-host";

export default function Game() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const code = (roomCode || "").toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [guessText, setGuessText] = useState("");
  const [hintText, setHintText] = useState("");
  const [hostHintText, setHostHintText] = useState("");
  const [replayOpen, setReplayOpen] = useState(false);
  const [replaySoups, setReplaySoups] = useState<{ id: number; title?: string; surface: string }[]>([]);
  const [replayMode, setReplayMode] = useState<"same" | "library" | "custom">("same");
  const [replaySoupId, setReplaySoupId] = useState<number | null>(null);
  const [replayTitle, setReplayTitle] = useState("");
  const [replaySurface, setReplaySurface] = useState("");
  const [replayTruth, setReplayTruth] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const joinedRef = useRef(false);
  // 手绘风对话框状态:退出确认 / 房间关闭通知
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [closedMsg, setClosedMsg] = useState<string | null>(null);
const [warnMsg, setWarnMsg] = useState<string | null>(null); // 管理员警告(手绘弹窗,警告一次)
const warnShownRef = useRef(false); // 警告是否已显示(踢下线时不打断警告阅读)

  // socket.id 会因断线重连而变化,必须用 state 驱动重渲染
  const [mySid, setMySid] = useState<string | null>(() => socket.id || null);
  const myName = useMemo(() => getUsername(), []);
  const isHost = !!room && mySid === room.hostId;
  const pendingQuestion = useMemo(
    () => room?.questions.find((q) => q.answer === null) || null,
    [room],
  );
  const pendingGuess = useMemo(
    () => room?.guesses.find((g) => g.correct === null) || null,
    [room],
  );

  // 加入房间(幂等:同名刷新槽位,支持刷新/断线重连)
  const join = useCallback(async () => {
    if (!code || !myName) return;
    connectSocket();
    try {
      const res = await emitAck<AckRes>("join_room", { roomCode: code });
      if (res.error) {
        setErr(res.error);
        return;
      }
      if (res.room) setRoom(res.room);
      joinedRef.current = true;
      setJoined(true);
    } catch {
      setErr("连接失败,请检查网络");
    }
  }, [code, myName]);

  useEffect(() => {
    join();
  }, [join]);

  useEffect(() => {
    const onUpdate = (r: Room) => setRoom(r);    const onClosed = (d: { message?: string }) => {
      sessionStorage.removeItem(HOST_KEY);
      setClosedMsg(d.message || "房间已关闭");
    };
    // 管理员封禁房间 → 房主收到警告(手绘弹窗,警告一次)
    const onAdminWarn = (d: { message?: string }) => {
      warnShownRef.current = true;
      setWarnMsg(d.message || "你的房间已被管理员封禁,警告一次");
    };
    const onError = (d: { message?: string }) => setErr(d.message || "操作失败");
    const onReconnect = () => {
      setJoined(false);
      join();
    };
    // 任何连接建立(含 socket.io 自动重连)都同步 sid 并兜底重新入房
    const onConnect = () => {
      setMySid(socket.id || null);
      if (joinedRef.current && code) {
        emitAck<AckRes>("join_room", { roomCode: code }).then((res) => {
          if (res.error) setErr(res.error);
          else if (res.room) setRoom(res.room);
        });
      }
    };
    // 被管理员踢下线(封禁/冻结/删除/重置密码):提示并返回大厅
    const onKicked = ({ reason }: { reason?: string }) => {
      setErr(reason || "账号已被管理员停用");
      // 若管理员警告弹窗正在显示(如第 3 次封禁自动冻结),不自动跳转,
      // 等用户看完警告点掉后,由「房间已关闭」弹窗引导回大厅
      setTimeout(() => {
        if (!warnShownRef.current) navigate("/");
      }, 1800);
    };
    socket.on("kicked", onKicked);
    socket.on("room_updated", onUpdate);
    socket.on("room_closed", onClosed);
    socket.on("admin_warn", onAdminWarn);
    socket.on("error", onError);
    socket.on("reconnect", onReconnect);
    socket.on("connect", onConnect);
    return () => {
      socket.off("kicked", onKicked);
      socket.off("room_updated", onUpdate);
      socket.off("room_closed", onClosed);
      socket.off("admin_warn", onAdminWarn);
      socket.off("error", onError);
      socket.off("reconnect", onReconnect);
      socket.off("connect", onConnect);
    };
  }, [join, navigate, code]);

  // 房主标记同步给底部导航(App.tsx 在游戏页内点链接时判断确认文案)
  useEffect(() => {
    sessionStorage.setItem(HOST_KEY, isHost ? "1" : "0");
  }, [isHost]);

  // 问答区自动滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [room?.questions.length, room?.guesses.length, room?.hints.length, room?.status]);

  async function run(event: string, payload?: unknown) {
    setErr("");
    const res = await emitAck<AckRes>(event, payload);
    if (res.error) setErr(res.error);
    return res;
  }

  // 退出房间:弹出确认对话框(房主解散 / 玩家退出),确认后回大厅
  function leaveGame() {
    setLeaveConfirm(true);
  }

  // 确认退出:通知服务器(无 ack,发后即忘)并立即回大厅
  function confirmLeave() {
    setLeaveConfirm(false);
    sessionStorage.removeItem(HOST_KEY);
    socket.emit("leave_room");
    navigate("/");
  }

  async function ask() {
    if (!questionText.trim()) return;
    const res = await run("ask_question", { text: questionText });
    if (res.ok) setQuestionText("");
  }

  async function answer(q: Question, ans: "yes" | "no" | "irrelevant") {
    await run("answer_question", {
      questionId: q.id,
      answer: ans,
      hint: hintText,
    });
    setHintText("");
  }

  async function sendHint() {
    if (!hostHintText.trim()) return;
    const res = await run("host_hint", { text: hostHintText });
    if (res.ok) setHostHintText("");
  }

  async function guess() {
    if (!guessText.trim()) return;
    const res = await run("submit_guess", { text: guessText });
    if (res.ok) setGuessText("");
  }

  function openReplay() {
    setReplayOpen(true);
    if (!replaySoups.length) {
      fetch("/api/soups")
        .then((r) => r.json())
        .then((list) => {
          setReplaySoups(list);
          if (list.length) setReplaySoupId(list[0].id);
        })
        .catch(() => {});
    }
  }

  async function doReplay() {
    let soup: unknown;
    if (replayMode === "library") {
      if (replaySoupId === null) return setErr("请选择题库谜题");
      soup = { soupId: replaySoupId };
    } else if (replayMode === "custom") {
      if (!replaySurface.trim() || !replayTruth.trim())
        return setErr("自定义谜题需要填写汤面和汤底");
      soup = { custom: { title: replayTitle, surface: replaySurface, truth: replayTruth } };
    }
    const res = await run("next_round", soup ? { soup } : undefined);
    if (res.ok) {
      setReplayOpen(false);
      setReplayMode("same");
      setReplayTitle("");
      setReplaySurface("");
      setReplayTruth("");
    }
  }

  if (!room) {
    return (
      <div className="page">
        <div className="loading">
          {err ? <div className="error">{err}</div> : joined ? "同步房间状态…" : "正在加入房间…"}
          {!myName && <div className="error">未登录,请返回大厅注册/登录</div>}
          <button onClick={() => navigate("/")}>返回大厅</button>
        </div>
      </div>
    );
  }

  const currentQuestioner = room.players.find((p) => p.sid === room.currentQuestionerId);
  const myTurn = !isHost && mySid === room.currentQuestionerId;

  return (
    <div className="game">
      {/* 顶栏 */}
      <header className="game-header">
        <div className="game-meta">
          <span className="room-code">房间 {room.code}</span>
          <span className={`badge status-${room.status}`}>
            {room.status === "waiting" ? "等待开始" : room.status === "playing" ? "进行中" : "已揭晓"}
          </span>
          <span className="round">第 {room.round} 局</span>
        </div>
        <div className="players">
          {room.players.map((p) => (
            <span key={p.sid} className={`player-chip ${p.sid === room.hostId ? "host" : ""} ${!p.online ? "offline" : ""}`}>
              {p.name}
              {p.sid === room.hostId ? <IconCrown size={14} stroke={2.5} className="inline-icon" /> : null}
              {!p.online ? "(离线)" : ""}
            </span>
          ))}
        </div>
        <button className="secondary" onClick={leaveGame} title="退出后房间将解散">
          退出房间
        </button>
      </header>

      {err && <div className="error banner">{err}</div>}

      <div className="game-body">
        {/* 谜题卡片 */}
        {room.soup && (
          <section className="soup-card">
            <h2>{room.soup.title ? `《${room.soup.title}》` : "海龟汤谜题"}</h2>
            <div className="surface-text">{room.soup.surface}</div>
            {room.soup.truth && (
              <div className="truth-block">
                <div className={`truth-label ${room.status === "revealed" ? "" : "private"}`}>
                  {room.status === "revealed" ? <><IconEye size={16} stroke={2.5} className="inline-icon" /> 汤底揭晓</> : <><IconLock size={16} stroke={2.5} className="inline-icon" /> 汤底(仅房主可见,作答参考)</>}
                </div>
                <div className="truth-text">{room.soup.truth}</div>
              </div>
            )}
          </section>
        )}

        {/* 操作区 */}
        <section className="actions">
          {room.status === "waiting" && isHost && (
            <button className="primary big" onClick={() => run("start_game")}>
              开始游戏
            </button>
          )}
          {room.status === "waiting" && !isHost && (
            <div className="hint">等待房主开始游戏…</div>
          )}

          {room.status === "playing" && (
            <>
              <div className="turn-hint">
                {isHost
                  ? pendingQuestion
                    ? "请回答下一位玩家的问题"
                    : "等待玩家提问…"
                  : myTurn
                    ? "轮到你了,请提问"
                    : `等待 ${currentQuestioner?.name || "玩家"} 提问…`}
              </div>
              {myTurn && (
                <div className="ask-box">
                  <input
                    value={questionText}
                    maxLength={200}
                    onChange={(e) => setQuestionText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && ask()}
                    placeholder="输入你的问题(只能问是/否/无关可答的问题)"
                  />
                  <button className="primary" onClick={ask}>
                    提问
                  </button>
                </div>
              )}
              {isHost && pendingQuestion && (
                <div className="answer-panel">
                  <div className="answer-question">
                    <IconMessage size={16} stroke={2.5} className="inline-icon" /> {pendingQuestion.playerName} 问:{pendingQuestion.text}
                  </div>
                  <div className="answer-row">
                    <button onClick={() => answer(pendingQuestion, "yes")}>是</button>
                    <button onClick={() => answer(pendingQuestion, "no")}>否</button>
                    <button onClick={() => answer(pendingQuestion, "irrelevant")}>无关</button>
                    <input
                      value={hintText}
                      maxLength={100}
                      onChange={(e) => setHintText(e.target.value)}
                      placeholder="可选:补充提示"
                    />
                  </div>
                </div>
              )}
              {isHost && (
                <div className="host-hint-box">
                  <input
                    value={hostHintText}
                    maxLength={200}
                    onChange={(e) => setHostHintText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendHint()}
                    placeholder="给玩家提示(将展示在问答记录里)"
                  />
                  <button className="primary" onClick={sendHint}>
                    发提示
                  </button>
                </div>
              )}
              {!isHost && (
                <div className="guess-box">
                  <input
                    value={guessText}
                    maxLength={500}
                    onChange={(e) => setGuessText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guess()}
                    placeholder="想直接还原真相?输入完整故事,提交给房主判定"
                  />
                  <button className="primary" onClick={guess}>
                    提交汤底还原
                  </button>
                </div>
              )}
              {isHost && pendingGuess && (
                <div className="judge-panel">
                  <div className="judge-guess">
                    <IconTarget size={16} stroke={2.5} className="inline-icon" /> {pendingGuess.playerName} 提交还原:{pendingGuess.text}
                  </div>
                  <div className="answer-row">
                    <button className="good" onClick={() => run("judge_guess", { guessId: pendingGuess.id, correct: true })}>
                      ✓ 正确,揭晓汤底
                    </button>
                    <button className="bad" onClick={() => run("judge_guess", { guessId: pendingGuess.id, correct: false })}>
                      ✗ 不对,继续
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {room.status === "revealed" && isHost && (
            <div className="replay-box">
              <button className="primary big" onClick={openReplay}>
                再来一局
              </button>
              {replayOpen && (
                <div className="replay-panel">
                  <div className="mode-row">
                    <label>
                      <input type="radio" checked={replayMode === "same"} onChange={() => setReplayMode("same")} />
                      同一题
                    </label>
                    <label>
                      <input type="radio" checked={replayMode === "library"} onChange={() => setReplayMode("library")} />
                      题库选题
                    </label>
                    <label>
                      <input type="radio" checked={replayMode === "custom"} onChange={() => setReplayMode("custom")} />
                      自定义
                    </label>
                  </div>
                  {replayMode === "library" && (
                    <select value={replaySoupId ?? ""} onChange={(e) => setReplaySoupId(Number(e.target.value))}>
                      {replaySoups.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.title ? `《${s.title}》` : `第 ${s.id} 题`}
                        </option>
                      ))}
                    </select>
                  )}
                  {replayMode === "custom" && (
                    <>
                      <input value={replayTitle} maxLength={30} onChange={(e) => setReplayTitle(e.target.value)} placeholder="标题(可选)" />
                      <textarea value={replaySurface} rows={2} onChange={(e) => setReplaySurface(e.target.value)} placeholder="汤面" />
                      <textarea value={replayTruth} rows={2} onChange={(e) => setReplayTruth(e.target.value)} placeholder="汤底" />
                    </>
                  )}
                  <button className="primary" onClick={doReplay}>
                    开始下一局
                  </button>
                </div>
              )}
            </div>
          )}
          {room.status === "revealed" && !isHost && <div className="hint">等待房主开始下一局…</div>}
        </section>

        {/* 问答流 */}
        <section className="flow" ref={listRef}>
          <h3>问答记录</h3>
          {room.questions.length === 0 && room.guesses.length === 0 && room.hints.length === 0 && (
            <div className="hint empty">还没有问答记录</div>
          )}
          {room.hints.map((h) => (
            <div key={h.id} className="flow-item hint">
              <div className="flow-head">
                <span className="who"><IconBulb size={16} stroke={2.5} className="inline-icon" /> 房主提示</span>
                <span className="time">{fmtTime(h.time)}</span>
              </div>
              <div className="flow-text">{h.text}</div>
            </div>
          ))}
          {room.questions.map((q) => (
            <div key={q.id} className="flow-item question">
              <div className="flow-head">
                <span className="who"><IconUser size={16} stroke={2.5} className="inline-icon" /> {q.playerName}</span>
                <span className="time">{fmtTime(q.time)}</span>
              </div>
              <div className="flow-text">{q.text}</div>
              {q.answer && (
                <div className={`flow-answer ans-${q.answer}`}>
                  房主回答:{ANSWER_LABEL[q.answer]}
                  {q.hint ? `(${q.hint})` : ""}
                </div>
              )}
            </div>
          ))}
          {room.guesses.map((g) => (
            <div key={g.id} className="flow-item guess">
              <div className="flow-head">
                <span className="who"><IconTarget size={16} stroke={2.5} className="inline-icon" /> {g.playerName} 提交了汤底还原</span>
                <span className="time">{fmtTime(g.time)}</span>
              </div>
              <div className="flow-text">{g.text}</div>
              {g.correct !== null && (
                <div className={`flow-answer ${g.correct ? "ans-yes" : "ans-no"}`}>
                  {g.correct ? "房主判定:正确,揭晓汤底!" : "房主判定:不对,继续推理"}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>

      {/* 退出房间确认(房主解散 / 玩家退出) */}
      <ConfirmDialog
        open={leaveConfirm}
        title={isHost ? "退出并解散房间" : "退出房间"}
        message={
          isHost
            ? "退出房间将解散整个房间,所有成员都会被移出。确认退出并解散吗?"
            : "确认退出这个房间吗?"
        }
        confirmText="确认退出"
        danger={isHost}
        onConfirm={confirmLeave}
        onCancel={() => setLeaveConfirm(false)}
      />
      {/* 房间已关闭通知 */}
      <ConfirmDialog
        open={!!closedMsg}
        title="房间已关闭"
        message={closedMsg || ""}
        confirmText="知道了"
        showCancel={false}
        onConfirm={() => {
          setClosedMsg(null);
          navigate("/");
        }}
        onCancel={() => {
          setClosedMsg(null);
          navigate("/");
        }}
      />
      {/* 管理员警告(封禁房间时房主收到,手绘风,警告一次) */}
      <ConfirmDialog
        open={!!warnMsg}
        title="⚠️ 管理员警告"
        message={warnMsg || ""}
        confirmText="我知道了"
        showCancel={false}
        danger
        onConfirm={() => setWarnMsg(null)}
        onCancel={() => setWarnMsg(null)}
      />
    </div>
  );
}
