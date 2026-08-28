// 双客户端模拟验证(注册系统版):注册→登录→token 连接→跑通一局 + 权限/重连/房间码边界
// 用法:node scripts/simulate-game.mjs [serverUrl]
import { io } from "socket.io-client";

const URL = process.argv[2] || "http://127.0.0.1:3000";
let passed = 0;
let failed = 0;

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (socket, event, payload) =>
  new Promise((resolve) => {
    if (payload === undefined) socket.emit(event, (res) => resolve(res));
    else socket.emit(event, payload, (res) => resolve(res));
  });
const onceTimeout = (socket, event, ms) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (d) => {
      clearTimeout(t);
      resolve(d);
    });
  });

/** 先注册 room_updated 监听,再触发事件;快照需通过 verify 校验(过滤旧广播),最多等 2.5s */
async function act(socket, event, payload, verify) {
  const snapPromise = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    const listener = (d) => {
      if (!verify || verify(d)) {
        clearTimeout(timer);
        socket.off("room_updated", listener);
        resolve(d);
      }
    };
    socket.on("room_updated", listener);
  });
  const res = await ack(socket, event, payload);
  const snap = await snapPromise;
  return { res, snap };
}

async function registerLogin(username) {
  // 模拟独立 IP,避免撞 MAX_ACCOUNTS_PER_IP 上限
  const ip = `10.8.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
  const ipH = { "Content-Type": "application/json", "X-Forwarded-For": ip };
  const r = await fetch(`${URL}/api/auth/register`, {
    method: "POST",
    headers: ipH,
    body: JSON.stringify({ username, password: "pass1234" }),
  });
  if (!r.ok) {
    // 已存在则登录
    const lr = await fetch(`${URL}/api/auth/login`, {
      method: "POST",
      headers: ipH,
      body: JSON.stringify({ username, password: "pass1234" }),
    });
    const ld = await lr.json();
    return ld;
  }
  return r.json();
}

async function main() {
  console.log(`连接 ${URL}`);
  const suffix = Date.now().toString().slice(-6);
  const hostName = `房主${suffix}`;
  const playerName = `玩家${suffix}`;

  // ---------- 注册 + 登录 ----------
  const hostAuth = await registerLogin(hostName);
  ok("房主注册/登录成功", !!hostAuth.token, JSON.stringify(hostAuth));
  const playerAuth = await registerLogin(playerName);
  ok("玩家注册/登录成功", !!playerAuth.token, JSON.stringify(playerAuth));

  // 错误密码登录应失败
  const badLogin = await fetch(`${URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: hostName, password: "wrong" }),
  });
  ok("错误密码登录被拒", badLogin.status === 401, `status=${badLogin.status}`);

  // 重复注册应失败
  const dupReg = await fetch(`${URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: hostName, password: "pass1234" }),
  });
  ok("重复注册被拒", dupReg.status === 400, `status=${dupReg.status}`);

  // 未登录的 socket 连接应被拒绝
  const anon = io(URL, { transports: ["websocket"], reconnection: false });
  const anonResult = await new Promise((resolve) => {
    anon.on("connect_error", (e) => resolve("拒绝:" + e.message));
    anon.on("connect", () => resolve("已连接"));
    setTimeout(() => resolve("超时"), 3000);
  });
  ok("无 token 连接被拒绝", anonResult.startsWith("拒绝"), anonResult);
  anon.close();

  // ---------- 带 token 连接 ----------
  const host = io(URL, { transports: ["websocket"], reconnection: false, auth: { token: hostAuth.token } });
  const player = io(URL, { transports: ["websocket"], reconnection: false, auth: { token: playerAuth.token } });
  await new Promise((r) => host.on("connect", r));
  await new Promise((r) => player.on("connect", r));

  // ---------- 建房(带密码)----------
  const created = await ack(host, "create_room", { soup: { soupId: 2 }, password: "1234" });
  ok("建房返回 ok", created?.ok === true, JSON.stringify(created));
  const code = created?.room?.code;
  ok("房间码为 6 位", /^[A-Z2-9]{6}$/.test(code || ""), code);
  ok("房主名=账号用户名", created?.room?.hostName === hostName, created?.room?.hostName);
  ok("房主创建后即可见汤底", !!created?.room?.soup?.truth, JSON.stringify(created?.room?.soup));

  // ---------- 在线房间列表(公开,不含密码)----------
  const roomList = await fetch(`${URL}/api/rooms`).then((r) => r.json());
  const mine = roomList.find((r) => r.code === code);
  ok("房间出现在在线列表", !!mine, JSON.stringify(roomList));
  ok("列表标记有密码", mine?.hasPassword === true);
  ok("列表不含密码字段", !("password" in (mine || {})));

  // ---------- 加入:密码校验 ----------
  const noPwd = await ack(player, "join_room", { roomCode: code });
  ok("无密码加入被拒(提示需密码)", noPwd?.error?.includes("需要密码"), JSON.stringify(noPwd));
  const badPwd = await ack(player, "join_room", { roomCode: code, password: "wrong" });
  ok("错误密码加入被拒", badPwd?.error?.includes("密码错误"), JSON.stringify(badPwd));
  const joined = await ack(player, "join_room", { roomCode: code, password: "1234" });
  ok("正确密码加入返回 ok", joined?.ok === true, JSON.stringify(joined));
  ok("房间 2 名玩家", joined?.room?.players?.length === 2);
  ok("玩家名=账号用户名", joined?.room?.players[1]?.name === playerName);
  ok("玩家加入时看不到汤底", !joined?.room?.soup?.truth, JSON.stringify(joined?.room?.soup));
  ok("玩家快照不泄露密码", !("password" in (joined?.room || {})));

  // ---------- 权限:非房主开始游戏应失败 ----------
  const badStart = await ack(player, "start_game");
  ok("非房主 start_game 被拒", badStart?.error?.includes("房主"), JSON.stringify(badStart));

  // ---------- 开始游戏 ----------
  const { snap: roomUpd } = await act(host, "start_game", undefined, (d) => d?.status === "playing");
  ok("开始后 status=playing", roomUpd?.status === "playing", JSON.stringify(roomUpd));
  ok("round=1", roomUpd?.round === 1);
  ok("当前提问者是玩家", roomUpd?.currentQuestionerId === roomUpd?.players[1]?.sid);
  ok("playing 时房主(host)可见汤底", !!roomUpd?.soup?.truth, JSON.stringify(roomUpd?.soup));

  // ---------- 权限:房主不能提问 ----------
  const hostAsk = await ack(host, "ask_question", { text: "房主提问?" });
  ok("房主提问被拒", hostAsk?.error?.includes("出题人"), JSON.stringify(hostAsk));

  // ---------- 玩家提问 ----------
  const { snap: afterAsk } = await act(
    player,
    "ask_question",
    { text: "凶手是亲人吗?" },
    (d) => d?.questions?.length === 1,
  );
  ok("问题入列且未作答", afterAsk?.questions?.length === 1 && afterAsk.questions[0].answer === null);
  ok("玩家(非房主)仍看不到汤底", !afterAsk?.soup?.truth, JSON.stringify(afterAsk?.soup));
  ok("问题署名=玩家账号", afterAsk?.questions[0]?.playerName === playerName);

  // ---------- 单玩家轮转:提问权回到自己,可继续提问 ----------
  await sleep(2500); // 超过限流冷却(默认2s),避免被误拦
  const again = await ack(player, "ask_question", { text: "再问一次" });
  ok("单玩家轮转回到自己后可继续提问", again?.ok === true, JSON.stringify(again));

  // ---------- 房主作答 ----------
  const qid = afterAsk.questions[0].id;
  const { snap: afterAnswer } = await act(
    host,
    "answer_question",
    { questionId: qid, answer: "no", hint: "与亲人无关" },
    (d) => d?.questions?.[0]?.answer === "no" && d?.questions?.[0]?.hint === "与亲人无关",
  );
  const q = afterAnswer?.questions?.[0];
  ok("答案 no + 提示已记录", q?.answer === "no" && q?.hint === "与亲人无关");
  ok("提问权已回到该玩家", afterAnswer?.currentQuestionerId === player.id);

  // ---------- 房主不能提交汤底还原 ----------
  const hostGuess = await ack(host, "submit_guess", { text: "房主也想还原?" });
  ok("房主 submit_guess 被拒", hostGuess?.error?.includes("出题人"), JSON.stringify(hostGuess));

  // ---------- 房主发提示(host_hint)----------
  const playerHintSnapPromise = onceTimeout(player, "room_updated", 2500);
  const { snap: afterHint } = await act(
    host,
    "host_hint",
    { text: "注意:受害者其实没有死" },
    (d) => d?.hints?.length === 1,
  );
  ok("房主提示已入列", afterHint?.hints?.length === 1 && afterHint.hints[0].text === "注意:受害者其实没有死");
  ok("提示对所有玩家可见", afterHint?.hints?.[0]?.text?.length > 0);
  const playerHintSnap = await playerHintSnapPromise;
  ok("玩家也能收到含提示的快照", playerHintSnap?.hints?.length === 1);
  const badHint = await ack(player, "host_hint", { text: "玩家想冒充房主发提示?" });
  ok("非房主 host_hint 被拒", badHint?.error?.includes("房主"), JSON.stringify(badHint));

  // ---------- 猜底(错→对→揭晓) ----------
  const { snap: s1 } = await act(
    player,
    "submit_guess",
    { text: "凶手是外公?" },
    (d) => d?.guesses?.length === 1,
  );
  const g1 = s1.guesses.at(-1);
  ok("猜底待判定", g1.correct === null);
  const { snap: judged1 } = await act(
    host,
    "judge_guess",
    { guessId: g1.id, correct: false },
    (d) => d?.guesses?.[0]?.correct === false,
  );
  ok("判定错误,游戏继续", judged1?.guesses?.[0]?.correct === false && judged1?.status === "playing");

  await sleep(2500); // 超过限流冷却(默认2s),避免第二次猜底被误拦
  const { snap: s2 } = await act(
    player,
    "submit_guess",
    { text: "姐姐在纸房子里被烧死,妈妈听到我描述后吓昏" },
    (d) => d?.guesses?.length === 2,
  );
  const g2 = s2.guesses.at(-1);
  const { snap: revealed } = await act(
    host,
    "judge_guess",
    { guessId: g2.id, correct: true },
    (d) => d?.status === "revealed",
  );
  ok("判定正确后 status=revealed", revealed?.status === "revealed");
  ok("揭晓后汤底可见", !!revealed?.soup?.truth, JSON.stringify(revealed?.soup));

  // ---------- 再来一局 ----------
  const { res: next, snap: round2 } = await act(
    host,
    "next_round",
    { soup: { soupId: 4 } },
    (d) => d?.round === 2 && d?.status === "playing",
  );
  ok("再来一局成功", next?.ok === true);
  ok("换题后 status=playing round=2", round2?.status === "playing" && round2?.round === 2);
  ok("问答已清空", round2?.questions?.length === 0 && round2?.guesses?.length === 0);
  ok("新题已生效", round2?.soup?.id === 4);

  // ---------- 游戏进行中:新人无法加入 ----------
  const strangerAuth = await registerLogin(`路人${suffix}`);
  const stranger = io(URL, { transports: ["websocket"], reconnection: false, auth: { token: strangerAuth.token } });
  await new Promise((r) => stranger.on("connect", r));
  const strangerJoin = await ack(stranger, "join_room", { roomCode: code, password: "1234" });
  ok("游戏中新人加入被拒", strangerJoin?.error?.includes("已开始"), JSON.stringify(strangerJoin));
  stranger.close();

  // ---------- 断线重连:房主断开,同账号重连恢复房主身份 ----------
  host.disconnect();
  await sleep(300);
  const host2 = io(URL, { transports: ["websocket"], reconnection: false, auth: { token: hostAuth.token } });
  await new Promise((r) => host2.on("connect", r));
  const rejoin = await ack(host2, "join_room", { roomCode: code });
  ok("房主断线重连成功", rejoin?.ok === true, JSON.stringify(rejoin));
  ok("房主身份已恢复", rejoin.room.hostId === host2.id);
  ok("重连后房间未解散", rejoin.room.players.length === 2);

  // ---------- 不存在的房间 ----------
  const ghostJoin = await ack(host2, "join_room", { roomCode: "ZZZZZZ" });
  ok("加入不存在房间被拒", ghostJoin?.error?.includes("不存在"), JSON.stringify(ghostJoin));

  // ---------- 房主离开解散房间 ----------
  host2.emit("leave_room");
  const closed = await onceTimeout(player, "room_closed", 2000);
  ok("房主离开后收到 room_closed", !!closed, JSON.stringify(closed));

  player.close();
  host2.close();

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("脚本异常:", e);
  process.exit(1);
});
