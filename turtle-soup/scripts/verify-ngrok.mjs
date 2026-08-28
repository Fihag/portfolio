// 端到端验证:ngrok 公网地址可达性
import { writeFileSync } from "node:fs";
const t = await fetch("http://127.0.0.1:4040/api/tunnels").then((r) => r.json());
const https = t.tunnels.find((x) => x.proto === "https");
if (!https) {
  console.log("无 https 隧道");
  process.exit(1);
}
const pub = https.public_url;
console.log("公网地址:", pub);
writeFileSync("scripts/.ngrok-url", pub, "utf8");

let r = await fetch(pub + "/");
const html = await r.text();
console.log("公网 GET /:", r.status, "| 含root:", html.includes('id="root"'));

r = await fetch(pub + "/api/health");
console.log("公网 GET /api/health:", r.status, JSON.stringify(await r.json()));

r = await fetch(pub + "/game/ABCDEF");
console.log("公网 GET /game/ABCDEF:", r.status, "| SPA:", (await r.text()).includes('id="root"'));
