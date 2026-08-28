// 实验4:文本格式 prompt vs JSON prompt(各 2 次)
const BASE = "http://26.245.218.217:1234";
const KEY = "sk-lm-hfQ6CV0F:0WxXZ3MqWllvzTGww058";

const P_JSON = `围绕主题「深夜」创作一道海龟汤,只输出JSON:{"title":"标题","surface":"汤面","truth":"汤底"}`;
const P_TEXT = `围绕主题「深夜」创作一道海龟汤。请严格按以下三行输出,不要输出任何其他文字:
标题:xxx
汤面:xxx
汤底:xxx`;

async function call(prompt) {
  const messages = [
    { role: "system", content: "不要思考过程,直接给出最终答案。" },
    { role: "user", content: prompt },
  ];
  const res = await fetch(BASE + "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
    body: JSON.stringify({ model: "ornith-1.0-9b", messages, max_tokens: 1024, temperature: 0.9 }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await res.json();
  const msg = data?.choices?.[0]?.message || {};
  const content = String(msg.content || "").trim();
  const reasoning = String(msg.reasoning_content || "").trim();
  const usable = /标题[:：]/.test(content) && /汤面[:：]/.test(content) && /汤底[:：]/.test(content);
  return `content=${content.length} reasoning=${reasoning.length} 可提取=${usable} | ${content.slice(0, 60).replace(/\n/g, " ")}`;
}

for (const [name, p] of [["JSON", P_JSON], ["TEXT", P_TEXT]]) {
  for (let i = 0; i < 2; i++) {
    try {
      console.log(`${name}#${i + 1}: ${await call(p)}`);
    } catch (e) {
      console.log(`${name}#${i + 1}: ERR ${e.message}`);
    }
  }
}
