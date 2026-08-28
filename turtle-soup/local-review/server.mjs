// 本地审核前端服务:仅本机访问(不经过 ngrok,不上公网)
// 用法:node local-review/server.mjs  然后浏览器打开 http://127.0.0.1:3001
// 页面通过 API 与游戏后端(127.0.0.1:3000)交互,审核通过直接写入本机题库,公网立即生效
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.REVIEW_PORT) || 3001;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = resolve(__dirname, "." + pathname);
  // 只允许读取 local-review 目录内的文件,防止路径穿越
  if (!file.startsWith(__dirname)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (!existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
    return;
  }
  const data = readFileSync(file);
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(data);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[本地审核前端] http://127.0.0.1:${PORT}  (仅本机可访问,未暴露公网)`);
});
