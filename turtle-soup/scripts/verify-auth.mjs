// 验证:登录换 token 机制(密码只出现在登录请求,写操作凭 token)
// 用法: ADMIN_PASSWORD=xxx [URL=http://127.0.0.1:3000] node scripts/verify-auth.mjs
const base = process.env.URL || "http://127.0.0.1:3000";
const PWD = process.env.ADMIN_PASSWORD || "";
if (!PWD) {
  console.error("缺少 ADMIN_PASSWORD 环境变量,不发送请求。");
  process.exit(1);
}

// 1. 随便输密码 → 401,进不去
let r = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "随便输的密码" }),
});
console.log("错误密码登录:", r.status, JSON.stringify(await r.json()));

// 2. 正确密码 → 返回 token
r = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: PWD }),
});
const login = await r.json();
console.log("正确密码登录:", r.status, "| 有token:", !!login.token, "| 24h有效:", login.expiresIn === 86400000);

const token = login.token;

// 3. 无 token 写操作 → 401
r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "x", surface: "s", truth: "t" }),
});
console.log("无 token 新增:", r.status, JSON.stringify(await r.json()));

// 4. 旧密码头(x-admin-password)→ 401(旧协议已废弃)
r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Admin-Password": PWD },
  body: JSON.stringify({ title: "x", surface: "s", truth: "t" }),
});
console.log("旧密码头新增:", r.status);

// 5. 带 token 写操作 → 成功
r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Admin-Token": token },
  body: JSON.stringify({ title: "令牌测试", surface: "测试汤面", truth: "测试汤底" }),
});
const created = await r.json();
console.log("带 token 新增:", r.status, "id=" + created.id);

r = await fetch(base + "/api/soups/" + created.id, {
  method: "DELETE",
  headers: { "X-Admin-Token": token },
});
console.log("带 token 删除:", r.status);

// 6. 登出后 token 失效
await fetch(base + "/api/auth/logout", { method: "POST", headers: { "X-Admin-Token": token } });
r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Admin-Token": token },
  body: JSON.stringify({ title: "x", surface: "s", truth: "t" }),
});
console.log("登出后旧 token 新增:", r.status);

// 7. 题库无残留
const list = await (await fetch(base + "/api/soups")).json();
console.log("题库条数:", list.length, list.some((x) => x.title === "令牌测试") ? "(FAIL 残留)" : "(OK 无残留)");
