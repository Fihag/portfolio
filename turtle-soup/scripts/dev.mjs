// 开发模式一键启动:server(3000)+ web vite(5173)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
if (process.platform === "win32") process.chdir(root.replace(/^\/([A-Za-z]:)/, "$1"));
else process.chdir(root);

const procs = [];

function run(name, cmd, args) {
  console.log(`\n[${name}] 启动: ${cmd} ${args.join(" ")}\n`);
  const p = spawn(cmd, args, { stdio: "inherit", shell: true });
  procs.push(p);
  p.on("exit", (code) => {
    console.log(`[${name}] 退出, code=${code}`);
    for (const q of procs) if (q !== p) q.kill();
  });
}

if (!existsSync("server/node_modules")) {
  console.error("缺少依赖,请先运行: npm install");
  process.exit(1);
}

run("server", "node", ["server/index.js"]);
run("web", "npm", ["run", "dev", "--prefix", "web"]);

process.on("SIGINT", () => {
  for (const p of procs) p.kill();
  process.exit(0);
});
