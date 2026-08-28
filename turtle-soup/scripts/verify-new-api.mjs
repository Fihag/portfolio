// 验证收藏 API + rooms_updated 实时广播 + 备份目录(3100 测试实例)
import { io } from "socket.io-client";

const URL = process.argv[2] || "http://127.0.0.1:3000";
let passed = 0, failed = 0;
const ok = (n, c, x = "") => (c ? passed++ : failed++, console.log(`  ${c ? "✓" : "✗"} ${n} ${x}`));

const suffix = Date.now().toString().slice(-6);
const name = `收藏${suffix}`;
// 模拟独立 IP,避免撞 MAX_ACCOUNTS_PER_IP 上限
const ip = `10.9.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
const ipH = { "Content-Type": "application/json", "X-Forwarded-For": ip };
let r = await fetch(`${URL}/api/auth/register`, {
  method: "POST",
  headers: ipH,
  body: JSON.stringify({ username: name, password: "pass1234" }),
});
if (!r.ok) {
  r = await fetch(`${URL}/api/auth/login`, {
    method: "POST",
    headers: ipH,
    body: JSON.stringify({ username: name, password: "pass1234" }),
  });
}
const auth = await r.json();
const authH = { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` };
ok("注册/登录", !!auth.token);

// ---------- 收藏 API ----------
let d = await fetch(`${URL}/api/favorites`, { headers: authH }).then((r) => r.json());
ok("初始收藏为空", Array.isArray(d.ids) && d.ids.length === 0, JSON.stringify(d));
d = await fetch(`${URL}/api/favorites/3`, { method: "PUT", headers: authH }).then((r) => r.json());
ok("添加收藏3", d.ok && d.ids.includes(3), JSON.stringify(d));
d = await fetch(`${URL}/api/favorites/3`, { method: "PUT", headers: authH }).then((r) => r.json());
ok("重复添加去重", d.ok && d.ids.filter((x) => x === 3).length === 1, JSON.stringify(d));
d = await fetch(`${URL}/api/favorites/5`, { method: "PUT", headers: authH }).then((r) => r.json());
ok("添加收藏5", d.ok && d.ids.includes(5) && d.ids.length === 2, JSON.stringify(d));
d = await fetch(`${URL}/api/favorites/3`, { method: "DELETE", headers: authH }).then((r) => r.json());
ok("移除收藏3", d.ok && !d.ids.includes(3) && d.ids.length === 1, JSON.stringify(d));
let bad = await fetch(`${URL}/api/favorites/abc`, { method: "PUT", headers: authH });
ok("非法id被拒", bad.status === 400, "status=" + bad.status);
let unauth = await fetch(`${URL}/api/favorites`);
ok("未登录被拒", unauth.status === 401, "status=" + unauth.status);

// ---------- rooms_updated 广播 ----------
const s = io(URL, { transports: ["websocket"], auth: { token: auth.token }, reconnection: false });
await new Promise((res) => s.on("connect", res));
const got = new Promise((res) => s.once("rooms_updated", res));
await new Promise((res) => s.emit("create_room", { soup: { soupId: 1 } }, res));
const roomsData = await Promise.race([got, new Promise((r) => setTimeout(() => r(null), 2000))]);
ok("建房后收到 rooms_updated 广播", Array.isArray(roomsData), JSON.stringify(roomsData)?.slice(0, 80));
const maxP = roomsData?.find?.((x) => x.hostName === name);
ok("广播列表含 maxPlayers", maxP && maxP.maxPlayers >= 4, JSON.stringify(maxP));
s.disconnect();

// ---------- 备份目录 ----------
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const bk = join(process.cwd(), "server", "data", "backup");
ok("备份目录存在", existsSync(bk));
if (existsSync(bk)) {
  const dirs = readdirSync(bk).filter((x) => !x.startsWith("."));
  ok("至少一份备份", dirs.length >= 1, `数量=${dirs.length}`);
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
