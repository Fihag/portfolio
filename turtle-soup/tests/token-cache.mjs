// token 缓存回归测试:连续验证(命中缓存)+ 各写路径立即失效
// 用法:node tests/token-cache.mjs <baseURL> <adminPassword>
// 要求后端已启动(测试环境建议 3100);requirePlayer 读 Authorization: Bearer
const B = process.argv[2] || "http://127.0.0.1:3100";
const ADMIN_PWD = process.argv[3] || "y1hURonWfC0nv_tg";
let failed = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "✅" : "✗"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
}
async function checkToken(token) {
  const r = await fetch(`${B}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 200) return { ok: true };
  if (r.status === 401) return { ok: false };
  return { ok: false, status: r.status, text: (await r.text()).slice(0, 80) };
}
const randIp = () => `10.9.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
for (let i = 0; i < 12; i++) {
  try { const h = await fetch(`${B}/api/health`).then((r) => r.json()); if (h.ok) break; } catch { /* 未就绪 */ }
  await new Promise((r) => setTimeout(r, 500));
}
const admin = await fetch(`${B}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: ADMIN_PWD }) }).then((r) => r.json());
ok("admin 登录", !!admin.token, JSON.stringify(admin));
if (!admin.token) process.exit(1);
const AH = { "Content-Type": "application/json", "X-Admin-Token": admin.token };
const sfx = Date.now().toString(36);
const u1 = "c1" + sfx, u2 = "c2" + sfx;
const reg = (u) => fetch(`${B}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randIp() }, body: JSON.stringify({ username: u, password: "1234" }) });
let rr = await reg(u1); ok("注册 u1", rr.status === 201, rr.status + " " + (await rr.text()).slice(0, 80));
rr = await reg(u2); ok("注册 u2", rr.status === 201, rr.status + " " + (await rr.text()).slice(0, 80));
const lg = (u) => fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": randIp() }, body: JSON.stringify({ username: u, password: "1234" }) }).then((r) => r.json());
const t1 = (await lg(u1)).token;
const t2 = (await lg(u2)).token;
ok("登录签发 token", !!t1 && !!t2);
const v1 = await checkToken(t1);
const v2 = await checkToken(t1);
ok("连续验证两次成功(第二次命中缓存)", v1.ok && v2.ok, JSON.stringify(v1));
await fetch(`${B}/api/admin/users/${u1}/status`, { method: "POST", headers: AH, body: JSON.stringify({ status: "frozen" }) });
ok("冻结后立即失效", !(await checkToken(t1)).ok);
await fetch(`${B}/api/admin/users/${u1}/status`, { method: "POST", headers: AH, body: JSON.stringify({ status: "normal" }) });
const t3 = (await lg(u1)).token;
ok("恢复后重新登录可用", (await checkToken(t3)).ok);
await fetch(`${B}/api/admin/users/${u2}`, { method: "DELETE", headers: AH });
ok("删除用户后 token 失效", !(await checkToken(t2)).ok);
await fetch(`${B}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${t3}` } });
ok("登出后 token 失效", !(await checkToken(t3)).ok);
console.log(failed === 0 ? "\n全部通过 ✅" : `\n${failed} 项失败 ✗`);
process.exit(failed === 0 ? 0 : 1);
