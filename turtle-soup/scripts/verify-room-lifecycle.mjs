// 房间生命周期新逻辑测试(针对 3100 测试实例,短 TTL):
// 1) 一人一房限制 2) 全员离线即解散 3) 等待超时解散 4) 房主离线超时解散 5) 房主离线但玩家在线时保留
import { io } from "socket.io-client";

const URL = "http://127.0.0.1:3100";
let passed = 0;
let failed = 0;

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
function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function registerLogin(username) {
  // 每个玩家模拟独立 IP,避免触发 MAX_ACCOUNTS_PER_IP 上限
  const ip = `10.7.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
  const headers = { "Content-Type": "application/json", "X-Forwarded-For": ip };
  const r = await fetch(`${URL}/api/auth/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username, password: "pass1234" }),
  });
  if (!r.ok) {
    const lr = await fetch(`${URL}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password: "pass1234" }),
    });
    return lr.json();
  }
  return r.json();
}

async function listRooms() {
  const r = await fetch(`${URL}/api/rooms`);
  return r.json();
}

async function connectWithToken(token) {
  return io(URL, { transports: ["websocket"], auth: { token }, reconnection: false });
}

async function main() {
  const suffix = Date.now().toString().slice(-6);
  const aName = `房主A${suffix}`;
  const bName = `房主B${suffix}`;
  const pName = `玩家P${suffix}`;

  const aAuth = await registerLogin(aName);
  const bAuth = await registerLogin(bName);
  const pAuth = await registerLogin(pName);
  ok("注册三个账号", aAuth.token && bAuth.token && pAuth.token);

  const soup = { soupId: 1 };

  // ---------- 1. 一人一房 ----------
  const a1 = await connectWithToken(aAuth.token);
  const r1 = await ack(a1, "create_room", { soup });
  ok("A 建房成功", r1.ok, JSON.stringify(r1));
  const codeA = r1.room.code;
  const r2 = await ack(a1, "create_room", { soup });
  ok("A 再建第二个房被拒", !r2.ok && /已有一个房间/.test(r2.error), JSON.stringify(r2));
  ok("拒绝后 A 的原房间仍存在", (await listRooms()).some((r) => r.code === codeA));

  // ---------- 2. 全员离线即解散 ----------
  const p1 = await connectWithToken(pAuth.token);
  const rj = await ack(p1, "join_room", { roomCode: codeA });
  ok("玩家加入 A 房", rj.ok);
  ok("房间在列表(2人)", (await listRooms()).find((r) => r.code === codeA)?.onlineCount === 2);
  // 玩家先断开 → 房主在线,房间保留
  p1.disconnect();
  await sleep(600);
  ok("玩家断开后房间仍保留(房主在线)", (await listRooms()).some((r) => r.code === codeA));
  // 房主也断开 → 全员离线,宽限(1.5s)后解散
  a1.disconnect();
  await sleep(2800);
  ok("全员离线宽限后房间消失", !(await listRooms()).some((r) => r.code === codeA));

  // ---------- 3. 等待超时解散 ----------
  const b1 = await connectWithToken(bAuth.token);
  const rb = await ack(b1, "create_room", { soup });
  ok("B 建房成功", rb.ok, JSON.stringify(rb));
  const codeB = rb.room.code;
  const closed = await onceTimeout(b1, "room_closed", 4000);
  ok("等待超时(2s)后收到 room_closed", !!closed && /等待超时/.test(closed.message), JSON.stringify(closed));
  ok("等待超时后房间从列表消失", !(await listRooms()).some((r) => r.code === codeB));
  b1.disconnect();

  // ---------- 4. 房主离线但玩家在线:房间保留;房主超时(3s)后解散 ----------
  const a2 = await connectWithToken(aAuth.token);
  const ra = await ack(a2, "create_room", { soup });
  ok("A 再次建房成功", ra.ok);
  const codeC = ra.room.code;
  const p2 = await connectWithToken(pAuth.token);
  await ack(p2, "join_room", { roomCode: codeC });
  // 房主断开,玩家在线 → 保留
  a2.disconnect();
  await sleep(800);
  ok("房主离线但玩家在线,房间保留", (await listRooms()).some((r) => r.code === codeC));
  // 房主离线超时(3s)→ 解散,玩家收到 room_closed
  const pClosed = await onceTimeout(p2, "room_closed", 5000);
  ok("房主离线超时后玩家收到 room_closed", !!pClosed, JSON.stringify(pClosed));
  ok("超时后房间从列表消失", !(await listRooms()).some((r) => r.code === codeC));
  p2.disconnect();

  // ---------- 5. 回归:断线重连恢复身份(房主断线后重连,房间不丢) ----------
  const a3 = await connectWithToken(aAuth.token);
  const rd = await ack(a3, "create_room", { soup });
  ok("A 建房成功(重连场景)", rd.ok);
  const codeD = rd.room.code;
  a3.disconnect();
  await sleep(300);
  const a4 = await connectWithToken(aAuth.token);
  const rc = await ack(a4, "join_room", { roomCode: codeD });
  ok("房主重连恢复房间", rc.ok && rc.room.hostName === aName, JSON.stringify(rc));
  ok("重连后房间仍在列表", (await listRooms()).some((r) => r.code === codeD));
  a4.disconnect();
  await sleep(2200); // 等 codeD 全员离线宽限清理,避免一人一房拦截后续建房

  // ---------- 6. 提问者断线 → 提问权转移(卡死 bug 回归) ----------
  const q1Name = `问者1${suffix}`;
  const q2Name = `问者2${suffix}`;
  const q1 = await registerLogin(q1Name);
  const q2 = await registerLogin(q2Name);
  const hs = await connectWithToken(aAuth.token);
  const rh = await ack(hs, "create_room", { soup });
  ok("建房成功(提问权测试)", rh.ok);
  const codeQ = rh.room.code;
  const s1 = await connectWithToken(q1.token);
  const s2 = await connectWithToken(q2.token);
  await ack(s1, "join_room", { roomCode: codeQ });
  await ack(s2, "join_room", { roomCode: codeQ });
  await ack(hs, "start_game");
  // 先注册快照监听(等含问题的新广播),再提问
  const snapP = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    const listener = (d) => {
      if (d.questions.length) {
        clearTimeout(timer);
        hs.off("room_updated", listener);
        resolve(d);
      }
    };
    hs.on("room_updated", listener);
  });
  // 提问权应给第一个加入的玩家 s1
  const rAsk1 = await ack(s1, "ask_question", { text: "问题1" });
  ok("开始后提问权在玩家1", rAsk1.ok, JSON.stringify(rAsk1));
  // 等广播拿到问题 id,房主作答 → 轮转
  const snap1 = await snapP;
  const qid = snap1 && snap1.questions.length ? snap1.questions[snap1.questions.length - 1].id : null;
  const ansRes = await ack(hs, "answer_question", { questionId: qid, answer: "yes" });
  ok("房主作答成功", ansRes.ok, JSON.stringify(ansRes));
  const rAsk2 = await ack(s2, "ask_question", { text: "问题2" });
  ok("轮转后提问权在玩家2", rAsk2.ok, JSON.stringify(rAsk2));
  // 玩家2(当前提问者)断线 → 提问权应转回玩家1
  s2.disconnect();
  await sleep(1200); // 超过限流冷却(800ms),避免 s1 被限流误伤
  const rAsk3 = await ack(s1, "ask_question", { text: "问题3" });
  ok("提问者断线后提问权转移给下一玩家", rAsk3.ok, JSON.stringify(rAsk3));
  s1.disconnect();
  hs.disconnect();
  await sleep(2200); // 等房间清理,释放 A 的建房名额

  // ---------- 7. 房间人数上限(测试实例 MAX=4) ----------
  const c1 = await registerLogin(`满员1${suffix}`);
  const c2 = await registerLogin(`满员2${suffix}`);
  const c3 = await registerLogin(`满员3${suffix}`);
  const c4 = await registerLogin(`满员4${suffix}`);
  const h5 = await connectWithToken(aAuth.token);
  const rf = await ack(h5, "create_room", { soup });
  ok("建房成功(满员测试)", rf.ok);
  const codeF = rf.room.code;
  for (const [i, tok] of [c1, c2, c3].map((x) => x.token).entries()) {
    const cs = await connectWithToken(tok);
    const rr = await ack(cs, "join_room", { roomCode: codeF });
    ok(`第${i + 2}人加入成功`, rr.ok, JSON.stringify(rr));
    cs.disconnect();
  }
  const c4s = await connectWithToken(c4.token);
  const rFull = await ack(c4s, "join_room", { roomCode: codeF });
  ok("第5人加入被拒(满员)", !rFull.ok && /已满/.test(rFull.error), JSON.stringify(rFull));
  c4s.disconnect();
  h5.disconnect();
  await sleep(2200); // 等房间清理,释放 A 的建房名额

  // ---------- 8. 发言限流(冷却期重复操作被拒) ----------
  const r1s = await connectWithToken(aAuth.token);
  const rg = await ack(r1s, "create_room", { soup });
  ok("建房成功(限流测试)", rg.ok);
  const codeG = rg.room.code;
  const sp = await connectWithToken(q1.token);
  await ack(sp, "join_room", { roomCode: codeG });
  await ack(r1s, "start_game");
  const rq1 = await ack(sp, "ask_question", { text: "第一次提问" });
  ok("第一次提问成功", rq1.ok, JSON.stringify(rq1));
  const rq2 = await ack(sp, "ask_question", { text: "紧接着第二次提问" });
  ok("冷却期内重复提问被拒", !rq2.ok && /太频繁/.test(rq2.error), JSON.stringify(rq2));
  sp.disconnect();
  r1s.disconnect();
  await sleep(2200); // 等房间清理,释放 A 的建房名额

  // ---------- 9. playing 中玩家刷新重连:提问权恢复 + 在线状态恢复 ----------
  const h9 = await connectWithToken(aAuth.token);
  const r9 = await ack(h9, "create_room", { soup });
  ok("建房成功(重连提问权测试)", r9.ok, JSON.stringify(r9));
  const code9 = r9.room.code;
  const p9 = await connectWithToken(q1.token);
  await ack(p9, "join_room", { roomCode: code9 });
  await ack(h9, "start_game");
  // 提问权在 p9(唯一玩家)
  const ask9 = await ack(p9, "ask_question", { text: "重连前提问" });
  ok("重连前提问权在玩家", ask9.ok, JSON.stringify(ask9));
  // 玩家断开(模拟刷新):单玩家场景提问权会变成 null
  p9.disconnect();
  await sleep(500);
  // 玩家重连(同名槽位)
  const p9b = await connectWithToken(q1.token);
  const j9 = await ack(p9b, "join_room", { roomCode: code9 });
  ok("重连成功且在线", j9.ok && j9.room.players.find((p) => p.name === q1Name)?.online === true, JSON.stringify(j9));
  ok("重连后提问权指向重连玩家", j9.room.currentQuestionerId === p9b.id, `expect ${p9b.id} got ${j9.room.currentQuestionerId}`);
  // 重连后玩家能提问(提问权恢复,冷却已过)
  await sleep(900);
  const ask9b = await ack(p9b, "ask_question", { text: "重连后提问" });
  ok("重连后提问权恢复可提问", ask9b.ok, JSON.stringify(ask9b));
  p9b.disconnect();
  h9.disconnect();
  await sleep(2200); // 等房间清理,释放 A 的建房名额

  // ---------- 10. 玩家退出不销毁房间;房主退出才解散 ----------
  const h10 = await connectWithToken(aAuth.token);
  const r10 = await ack(h10, "create_room", { soup });
  ok("建房成功(退出销毁测试)", r10.ok, JSON.stringify(r10));
  const code10 = r10.room.code;
  const p10 = await connectWithToken(q2.token);
  await ack(p10, "join_room", { roomCode: code10 });
  // 玩家点"退出房间":房间应保留,房主不应收到 room_closed
  let hostClosed = onceTimeout(h10, "room_closed", 1200);
  p10.emit("leave_room"); // 服务器 leave_room 无 ack,裸 emit
  const hc10 = await hostClosed;
  ok("玩家退出后房主未收到 room_closed", hc10 === null, JSON.stringify(hc10));
  ok("房间仍在列表", (await listRooms()).some((r) => r.code === code10));
  // 房主点"退出房间":房间解散(房主自己收不到 room_closed,属正常——他主动退出)
  h10.emit("leave_room");
  await sleep(600);
  ok("房主退出后房间从在线列表消失", !(await listRooms()).some((r) => r.code === code10));
  p10.disconnect();
  h10.disconnect();

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
