// 验证:①未登录写操作被拒 ②登录换 token 后写操作放行 ③登出后 token 失效
// 用法: ADMIN_PASSWORD=xxx [URL=http://127.0.0.1:3000] node scripts/verify-admin.mjs
const base = process.env.URL || "http://127.0.0.1:3000";
const PWD = process.env.ADMIN_PASSWORD || "";
if (!PWD) {
  console.error("缺少 ADMIN_PASSWORD 环境变量,不发送请求。");
  process.exit(1);
}

async function json(res) {
  try { return await res.json(); } catch { return {}; }
}

// 1. 错误密码登录 → 401
let l = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "wrong-password" }),
});
console.log("错误密码登录:", l.status, JSON.stringify(await json(l)));

// 2. 无 token 新增 → 401
let r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "无权限测试", surface: "s", truth: "t" }),
});
console.log("无 token 新增:", r.status, JSON.stringify(await json(r)));

// 3. 正确密码登录 → token
l = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: PWD }),
});
const login = await json(l);
console.log("正确密码登录:", l.status, "| 有token:", !!login.token);
const token = login.token;
if (!token) process.exit(1);
const H = { "Content-Type": "application/json", "X-Admin-Token": token };

// 4. 带 token 新增 → 成功
r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: H,
  body: JSON.stringify({ title: "权限验证题", surface: "测试汤面", truth: "测试汤底" }),
});
const created = await json(r);
console.log("带 token 新增:", r.status, "id=" + created.id);

// 5. 无 token 删除 → 401
r = await fetch(base + "/api/soups/" + created.id, { method: "DELETE" });
console.log("无 token 删除:", r.status, JSON.stringify(await json(r)));

// 6. 带 token 删除 → 成功
r = await fetch(base + "/api/soups/" + created.id, {
  method: "DELETE",
  headers: { "X-Admin-Token": token },
});
console.log("带 token 删除:", r.status);

// 7. 登出后 token 失效
await fetch(base + "/api/admin/logout", { method: "POST", headers: { "X-Admin-Token": token } });
r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: H,
  body: JSON.stringify({ title: "x", surface: "s", truth: "t" }),
});
console.log("登出后旧 token 新增:", r.status);

// 8. 题库无残留
const list = await (await fetch(base + "/api/soups")).json();
console.log("最终题库条数:", list.length, list.some((x) => x.title === "权限验证题") ? "(FAIL 残留)" : "(OK 无残留)");
