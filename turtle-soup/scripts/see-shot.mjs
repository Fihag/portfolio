// 用视觉模型分析移动端截图,确认 UI 问题
// key 从环境变量读取,不提交到 git:
//   AI_KEY=sk-xxx [AI_MODEL=mimo-v2.5] node scripts/see-shot.mjs <截图路径>
import { readFileSync } from "node:fs";

const imgPath = process.argv[2] || "D:/Aphotos/屏幕截图/3b6505a96ccd4017ded82ea41c7270c2.jpg";
const img = readFileSync(imgPath);
const b64 = img.toString("base64");

const KEY = process.env.AI_KEY || "";
if (!KEY) {
  console.error("缺少 AI_KEY 环境变量。示例: AI_KEY=sk-xxx node scripts/see-shot.mjs <截图路径>");
  process.exit(1);
}
const MODEL = process.env.AI_MODEL || "mimo-v2.5";

const res = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + KEY,
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "这是一张手机端网页截图。请详细描述:1) 页面上有哪些元素、文案内容是什么(尽量逐字读出可见文字);2) 有没有内容被裁切、偏移、看不清的情况,具体是哪个区域、文字被截断在哪;3) 整体布局是否正常。" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
        ],
      },
    ],
    max_tokens: 1024,
    reasoning_effort: "low",
  }),
});
const d = await res.json();
console.log("status:", res.status);
console.log(d.choices?.[0]?.message?.content || JSON.stringify(d).slice(0, 500));
