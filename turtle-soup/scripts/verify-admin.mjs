// 验证:①汤底按身份下发 ②题库写操作密码保护
const base = "http://127.0.0.1:3000";

// ---------- 管理密码保护 ----------
let r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "无权限测试", surface: "s", truth: "t" }),
});
console.log("无密码新增:", r.status, JSON.stringify(await r.json()));

r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Admin-Password": "wrong" },
  body: JSON.stringify({ title: "错密码测试", surface: "s", truth: "t" }),
});
console.log("错误密码新增:", r.status, JSON.stringify(await r.json()));

r = await fetch(base + "/api/soups", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Admin-Password": "turtle123" },
  body: JSON.stringify({ title: "权限验证题", surface: "测试汤面", truth: "测试汤底" }),
});
const created = await r.json();
console.log("正确密码新增:", r.status, "id=" + created.id);

r = await fetch(base + "/api/soups/" + created.id, { method: "DELETE" });
console.log("无密码删除:", r.status, JSON.stringify(await r.json()));

r = await fetch(base + "/api/soups/" + created.id, {
  method: "DELETE",
  headers: { "X-Admin-Password": "turtle123" },
});
console.log("正确密码删除:", r.status, JSON.stringify(await r.json()));

r = await fetch(base + "/api/soups");
const list = await r.json();
console.log("最终题库条数:", list.length, list.some((x) => x.title === "权限验证题") ? "(FAIL 残留)" : "(OK 无残留)");
