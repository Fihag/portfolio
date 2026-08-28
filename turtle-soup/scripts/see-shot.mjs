// 用 mimo-v2.5 分析移动端截图,确认 UI 问题
import { readFileSync } from "node:fs";

const img = readFileSync("D:/Aphotos/屏幕截图/3b6505a96ccd4017ded82ea41c7270c2.jpg");
const b64 = img.toString("base64");

const res = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer sk-yFl7KEwyBHSB0sM3ESvPhMjn9VptihQ1Koo4jPpIt2BkCH3ltoHwRzjI8mLL5adL",
  },
  body: JSON.stringify({
    model: "mimo-v2.5",
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
