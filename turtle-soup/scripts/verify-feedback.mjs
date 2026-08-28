// 反馈流程 + 用户消息隔离测试(连测试实例)
// 1) 反馈提交/未登录401/限流 2) 审核流(采纳→处理状态/拒绝需原因) 3) 消息同步
// 4) 用户删消息不影响管理端 5) 管理端删业务不影响用户消息 6) submissions 消息同步
import { io } from "socket.io-client";

const URL = "http://127.0.0.1:3100";
const ADMIN_PWD = "y1hURonWfC0nv_tg";
let passed = 0;
let failed = 0;
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
  const r = await fetch(`${URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "pass1234" }),
  });
  if (!r.ok) {
    const lr = await fetch(`${URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "pass1234" }),
    });
    return lr.json();
  }
  return r.json();
}

async function main() {
  const suffix = Date.now().toString().slice(-6);
  const uname = `反馈员${suffix}`;
  const auth = await registerLogin(uname);
  ok("注册/登录", !!auth.token);
  const token = auth.token;

  // 管理登录
  const adm = await fetch(`${URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PWD }),
  });
  const admData = await adm.json();
  ok("管理员登录", !!admData.token);
  const adminH = { "X-Admin-Token": admData.token, "Content-Type": "application/json" };

  // 1. 反馈提交
  const noauth = await fetch(`${URL}/api/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "t", content: "c" }) });
  ok("未登录提交反馈 401", noauth.status === 401);
  const fb = await fetch(`${URL}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: "希望能加计分", content: "想要一个计分功能" }),
  });
  const fbItem = await fb.json();
  ok("登录提交反馈成功", fb.status === 201 && fbItem.id, JSON.stringify(fbItem));
  ok("反馈初始为 pending", fbItem.status === "pending");

  // 2. 用户消息:反馈消息存在
  const msgs1 = await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const fbMsg = msgs1.find((m) => m.type === "feedback" && m.refId === fbItem.id);
  ok("反馈消息已生成(pending)", !!fbMsg && fbMsg.status === "pending", JSON.stringify(fbMsg));

  // 3. 拒绝需原因
  const rjNo = await fetch(`${URL}/api/feedback/${fbItem.id}/reject`, { method: "POST", headers: adminH, body: JSON.stringify({}) });
  ok("拒绝不填原因 400", rjNo.status === 400);

  // 4. 采纳
  const ap = await fetch(`${URL}/api/feedback/${fbItem.id}/approve`, { method: "POST", headers: adminH, body: JSON.stringify({ note: "已采纳,感谢建议" }) });
  const apData = await ap.json();
  ok("采纳反馈成功", ap.ok && apData.feedback.status === "adopted", JSON.stringify(apData));
  const msgs2 = await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const fbMsg2 = msgs2.find((m) => m.refId === fbItem.id);
  ok("用户消息同步为已采纳", fbMsg2.status === "adopted" && fbMsg2.note === "已采纳,感谢建议", JSON.stringify(fbMsg2));

  // 5. 处理状态:已修复(新增独立消息,不覆盖采纳说明)
  const rs = await fetch(`${URL}/api/feedback/${fbItem.id}/resolve`, { method: "POST", headers: adminH, body: JSON.stringify({ resolution: "fixed", note: "计分功能已完成" }) });
  const rsData = await rs.json();
  ok("设置处理状态 fixed", rs.ok && rsData.feedback.resolution === "fixed", JSON.stringify(rsData));
  const msgs3 = await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const fbMsgs = msgs3.filter((m) => m.refId === fbItem.id && m.type === "feedback");
  ok("处理结果生成新消息(未读提示)", fbMsgs.some((m) => m.resolution === "fixed" && m.note === "计分功能已完成"), JSON.stringify(fbMsgs));
  ok("采纳消息仍在且说明未被覆盖", fbMsgs.some((m) => m.status === "adopted" && m.resolution === null && m.note === "已采纳,感谢建议"), JSON.stringify(fbMsgs));

  // 6. 用户删除消息:管理端数据仍在(删除处理结果消息)
  const resolveMsg = fbMsgs.find((m) => m.resolution === "fixed");
  const delMsg = await fetch(`${URL}/api/messages/${resolveMsg.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  ok("用户删除消息成功", delMsg.ok);
  const msgs4 = await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  ok("用户端消息已删除", !msgs4.some((m) => m.id === resolveMsg.id));
  const fbList1 = await fetch(`${URL}/api/feedback`, { headers: adminH }).then((r) => r.json());
  ok("管理端反馈仍存在(隔离)", fbList1.some((f) => f.id === fbItem.id));

  // 7. 管理端删除反馈:用户消息不受影响(重建一条验证)
  const fb2 = await fetch(`${URL}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: "第二反馈", content: "内容二" }),
  }).then((r) => r.json());
  const delFb = await fetch(`${URL}/api/feedback/${fb2.id}`, { method: "DELETE", headers: adminH });
  ok("管理端删除反馈成功", delFb.ok);
  const msgs5 = await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  ok("管理端删除后用户消息仍在(隔离)", msgs5.some((m) => m.refId === fb2.id && m.type === "feedback"));

  // 8. submissions 消息同步
  const sub = await fetch(`${URL}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: "测试题", surface: "表面", truth: "真相" }),
  }).then((r) => r.json());
  const subMsg = (await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())).find((m) => m.type === "submission" && m.refId === sub.id);
  ok("题库申请消息已生成(pending)", !!subMsg && subMsg.status === "pending", JSON.stringify(subMsg));
  const rjSub = await fetch(`${URL}/api/submissions/${sub.id}/reject`, { method: "POST", headers: adminH, body: JSON.stringify({ note: "不符合要求" }) });
  ok("拒绝申请成功", rjSub.ok);
  const subMsg2 = (await fetch(`${URL}/api/messages/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())).find((m) => m.refId === sub.id);
  ok("申请消息同步为已拒绝+原因", subMsg2.status === "rejected" && subMsg2.note === "不符合要求", JSON.stringify(subMsg2));

  // 9. 反馈限流(1 分钟 3 条)
  let limited = false;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: `t${i}`, content: `c${i}` }),
    });
    if (r.status === 429) limited = true;
  }
  ok("反馈限流生效(第4条 429)", limited);

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
