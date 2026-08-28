const URL = "http://127.0.0.1:3000";
const ADMIN_PWD = "y1hURonWfC0nv_tg";

(async () => {
  const u = "申请测试" + Date.now().toString().slice(-4);
  // 1. 注册玩家
  let r = await fetch(URL + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: "pass1234" }),
  });
  const me = await r.json();
  console.log("1. 注册玩家:", r.status, u);
  const auth = (t) => ({ "Content-Type": "application/json", Authorization: "Bearer " + t });

  // 2. 未登录提交申请 → 401
  r = await fetch(URL + "/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "无登录申请", surface: "汤面", truth: "汤底" }),
  });
  console.log("2. 未登录提交被拒:", r.status === 401 ? "OK 401" : "FAIL " + r.status);

  // 3. 玩家提交申请 → 201
  r = await fetch(URL + "/api/submissions", {
    method: "POST",
    headers: auth(me.token),
    body: JSON.stringify({ title: "深夜图书馆", surface: "深夜图书馆里,管理员听到翻书声却找不到人。", truth: "一只猫踩在翻页机上" }),
  });
  const sub1 = await r.json();
  console.log("3. 玩家提交申请:", r.status === 201 ? "OK 201 id=" + sub1.id : "FAIL " + r.status + " " + JSON.stringify(sub1));

  // 4. mine 接口看到 pending
  r = await fetch(URL + "/api/submissions/mine", { headers: auth(me.token) });
  const mine1 = await r.json();
  console.log("4. mine 查询 pending:", mine1.length === 1 && mine1[0].status === "pending" ? "OK" : "FAIL " + JSON.stringify(mine1));

  // 5. 管理员登录,看到待审核申请含玩家名字
  r = await fetch(URL + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PWD }),
  });
  const admin = await r.json();
  r = await fetch(URL + "/api/submissions?status=pending", { headers: { "X-Admin-Token": admin.token } });
  const pend = await r.json();
  const found = pend.find((s) => s.id === sub1.id);
  console.log("5. 审核后台看到申请+玩家名:", found && found.submitter === u ? "OK submitter=" + found.submitter : "FAIL " + JSON.stringify(pend.slice(-1)));

  // 6. 批准 → 玩家 mine 看到 approved
  r = await fetch(URL + `/api/submissions/${sub1.id}/approve`, { method: "POST", headers: { "X-Admin-Token": admin.token } });
  const ap = await r.json();
  r = await fetch(URL + "/api/submissions/mine", { headers: auth(me.token) });
  const mine2 = await r.json();
  const soupsBefore = await fetch(URL + "/api/soups").then((x) => x.json());
  console.log("6. 批准后 mine=approved:", ap.ok && mine2[0].status === "approved" ? "OK" : "FAIL " + JSON.stringify(ap), "| 题库现有:", soupsBefore.length, "题");

  // 7. 拒绝(带备注)→ mine 看到 rejected + note
  r = await fetch(URL + "/api/submissions", {
    method: "POST",
    headers: auth(me.token),
    body: JSON.stringify({ title: "空汤", surface: "什么也没有", truth: "什么也没有" }),
  });
  const sub2 = await r.json();
  r = await fetch(URL + `/api/submissions/${sub2.id}/reject`, {
    method: "POST",
    headers: { "X-Admin-Token": admin.token, "Content-Type": "application/json" },
    body: JSON.stringify({ note: "汤面汤底不完整" }),
  });
  r = await fetch(URL + "/api/submissions/mine", { headers: auth(me.token) });
  const mine3 = await r.json();
  const rej = mine3.find((s) => s.id === sub2.id);
  console.log("7. 拒绝后 mine=rejected+note:", rej.status === "rejected" && rej.note === "汤面汤底不完整" ? "OK note=" + rej.note : "FAIL " + JSON.stringify(rej));

  // 8. 清理:删除测试入库的题(保持题库干净)
  r = await fetch(URL + "/api/soups?title=深夜图书馆");
  const list = await r.json();
  for (const s of list) {
    await fetch(URL + "/api/soups/" + s.id, { method: "DELETE", headers: { "X-Admin-Token": admin.token } });
  }
  console.log("8. 已清理测试入库谜题");
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
