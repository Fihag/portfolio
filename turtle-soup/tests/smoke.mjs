// 冒烟测试:核心接口链路(健康检查/注册/登录态/题库/房间)
// 用法:TEST_BASE=http://127.0.0.1:3100 node tests/smoke.mjs(默认 http://127.0.0.1:3100)
// 依赖 Node 22 原生 fetch,无第三方依赖
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3100";

let failed = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " " + extra}`);
  if (!cond) failed++;
}
const json = (r) => r.json();

try {
  // 等后端就绪(最多约 6 秒)
  let reachable = false;
  for (let i = 0; i < 12; i++) {
    try {
      const h = await fetch(`${BASE}/api/health`).then(json);
      if (h && h.ok === true) { reachable = true; break; }
    } catch {
      /* 后端尚未就绪,稍后重试 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  ok("后端可达", reachable, BASE);

  if (!reachable) {
    console.log("SMOKE FAIL: 无法连接 " + BASE);
    process.exitCode = 1;
  } else {
    // 1. 健康检查
    const h = await fetch(`${BASE}/api/health`).then(json);
    ok("GET /api/health 返回 ok:true", h.ok === true, JSON.stringify(h).slice(0, 120));

    // 2. 注册随机用户并拿 token(用户名 = smoke + 时间戳36进制;带随机 X-Forwarded-For 避开同一 IP 注册上限)
    const username = "smoke" + Date.now().toString(36);
    const fakeIp = `10.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": fakeIp },
      body: JSON.stringify({ username, password: "1234" }),
    }).then(json);
    ok("POST /api/auth/register 返回 token", !!reg.token, JSON.stringify(reg).slice(0, 120));

    // 3. 验证登录态:后端无 /api/auth/me,改用受保护接口 /api/favorites(requirePlayer)
    const me = await fetch(`${BASE}/api/favorites`, {
      headers: { Authorization: `Bearer ${reg.token}` },
    });
    const meBody = me.ok ? await me.json() : null;
    ok("token 登录态有效(/api/favorites 200)", me.status === 200 && meBody && Array.isArray(meBody.ids), `HTTP ${me.status}`);

    // 4. 题库列表(公开接口剥离汤底)
    const soups = await fetch(`${BASE}/api/soups`).then((r) => (r.ok ? r.json() : null));
    ok("GET /api/soups 为数组且长度>0", Array.isArray(soups) && soups.length > 0, `len=${Array.isArray(soups) ? soups.length : "n/a"}`);

    // 5. 房间列表
    const rooms = await fetch(`${BASE}/api/rooms`).then((r) => (r.ok ? r.json() : null));
    ok("GET /api/rooms 为数组", Array.isArray(rooms), `len=${Array.isArray(rooms) ? rooms.length : "n/a"}`);
  }
} catch (e) {
  console.log("✗ 脚本异常:", e && e.message ? e.message : String(e));
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  if (failed === 0) {
    console.log("SMOKE OK");
  } else {
    console.log(`SMOKE FAIL: ${failed} 项失败,详情见上方 ✗ 行`);
    process.exitCode = 1;
  }
}
