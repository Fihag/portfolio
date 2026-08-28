// 生产模式 SPA 托管验证
const base = "http://127.0.0.1:3000";
const r = await fetch(base + "/");
const html = await r.text();
console.log("GET / :", r.status, "| 含root:", html.includes('id="root"'), "| 标题:", html.match(/<title>(.*?)<\/title>/)?.[1]);

const r2 = await fetch(base + "/game/ABC123");
console.log("GET /game/ABC123(SPA fallback):", r2.status, "| 返回index:", (await r2.text()).includes('id="root"'));

const r3 = await fetch(base + "/soups");
console.log("GET /soups(SPA fallback):", r3.status);

const r4 = await fetch(base + "/api/health");
console.log("GET /api/health 仍为 JSON:", (await r4.json()).ok === true);
