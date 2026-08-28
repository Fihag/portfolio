import { io } from "socket.io-client";
const URL = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, e, p) =>
  new Promise((res) => (p === undefined ? s.emit(e, (x) => res(x)) : s.emit(e, p, (x) => res(x))));

const host = io(URL, { transports: ["websocket"], reconnection: false });
const player = io(URL, { transports: ["websocket"], reconnection: false });
let n = 0;
const log = (who, d) => {
  n++;
  console.log(
    `[${n}] ${who} room_updated: status=${d.status} round=${d.round} q=${d.questions.length} g=${d.guesses.length} cur=${d.currentQuestionerId}`,
  );
};
host.on("room_updated", (d) => log("host", d));
player.on("room_updated", (d) => log("player", d));

const created = await ack(host, "create_room", { name: "房主", soup: { soupId: 2 } });
const code = created.room.code;
await ack(player, "join_room", { roomCode: code, name: "玩家" });
await sleep(200);
console.log("== start ==");
await ack(host, "start_game");
await sleep(200);
console.log("== ask#1 ==");
await ack(player, "ask_question", { text: "问题1" });
await sleep(200);
console.log("== ask#2(again) ==");
await ack(player, "ask_question", { text: "问题2" });
await sleep(200);
console.log("== answer(q1) ==");
const qid = (await ack(host, "start_game")).error ? null : null; // noop
// 拿 qid:直接请求当前状态
console.log("== submit ==");
const sres = await ack(player, "submit_guess", { text: "猜底1" });
console.log("submit ack:", JSON.stringify(sres));
await sleep(500);
console.log("== done ==");
host.close();
player.close();
process.exit(0);
