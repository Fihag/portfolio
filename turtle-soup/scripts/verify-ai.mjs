// 验证 /api/ai/generate 端点
const base = "http://127.0.0.1:3000";

// 空题材 → 400
let r = await fetch(base + "/api/ai/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ topic: "" }),
});
console.log("空题材:", r.status, JSON.stringify(await r.json()));

// 正常生成
r = await fetch(base + "/api/ai/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ topic: "深夜" }),
});
const data = await r.json();
console.log("生成:", r.status, data.error ? `错误: ${data.error}` : `成功: title=${data.title} surface=${data.surface.slice(0, 20)}... truth=${data.truth.slice(0, 20)}...`);
