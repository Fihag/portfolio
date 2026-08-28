// 健壮性回归:账号维度登录限流 + 消息 id 重启不撞
// 用法:node tests/robustness.mjs <baseURL>
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const B = process.argv[2] || "http://127.0.0.1:3100";
const __dirname = dirname(fileURLToPath(import.meta.url));
const MSG_FILE = resolve(__dirname, "..", "server", "data", "user-messages.json");
let failed = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "✅" : "✗"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
}
const randIp = () => `10.9.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
const sfx = Date.now().toString(36);
const u = "rbs" + sfx;
const pwd = "1234";
for (let i = 0; i < 12; i++) {
  try { const h = await fetch(`${B}/api/health`).then((r) => r.json()); if (h.ok) break; } catch { /* 未就绪 */ }
  await new Promise((r) => setTimeout(r, 500));
}
// 注册
const reg = await fetch(`${B}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randIp() }, body: JSON.stringify({ username: u, password: pwd }) });
ok("注册", reg.status === 201, reg.status + " " + (await reg.text()).slice(0, 80));
// 账号维度限流:前 10 次错误 401,第 11 次 429
let lastStatus = 0;
for (let i = 0; i < 11; i++) {
  const r = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randIp() }, body: JSON.stringify({ username: u, password: "wrong" }) });
  lastStatus = r.status;
}
ok("第 11 次错误密码被账号限流(429)", lastStatus === 429, "实际 " + lastStatus);
// 正确密码立即解锁(计数清零,成功放行)
const lgR = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randIp() }, body: JSON.stringify({ username: u, password: pwd }) });
const lgJ = await lgR.json();
ok("正确密码立即解锁(200)", lgR.status === 200, lgR.status + " " + JSON.stringify(lgJ).slice(0, 80));
const token = lgJ.token;
// 清零后再错误 1 次:应 401(不是 429)
const bad = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randIp() }, body: JSON.stringify({ username: u, password: "wrong" }) });
ok("清零后错误 1 次回到 401", bad.status === 401, "实际 " + bad.status);
// 消息 id:提交申请产生新消息,id 必须大于历史最大 id(重启不撞)
let maxBefore = 0;
try {
  const map = JSON.parse(readFileSync(MSG_FILE, "utf8"));
  for (const list of Object.values(map)) {
    for (const m of list) if (typeof m.id === "number" && m.id > maxBefore) maxBefore = m.id;
  }
} catch { /* 文件不存在视为 0 */ }
const sub = await fetch(`${B}/api/submissions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: "测试谜题" + sfx, surface: "测试表面", truth: "测试汤底" }) });
ok("提交申请", sub.status === 201, sub.status + " " + (await sub.text()).slice(0, 80));
const map = JSON.parse(readFileSync(MSG_FILE, "utf8"));
const newId = (map[u] || []).find((m) => m.type === "submission")?.id || 0;
ok(`新消息 id(${newId}) > 历史最大 id(${maxBefore})(重启不撞)`, newId > maxBefore);
console.log(failed === 0 ? "\n全部通过 ✅" : `\n${failed} 项失败 ✗`);
process.exit(failed === 0 ? 0 : 1);
