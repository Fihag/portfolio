// 串联测试入口:npm test
// 用法:npm test -- <baseURL> <adminPassword>(默认 http://127.0.0.1:3100 + 测试环境密码)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const [base, pwd] = process.argv.slice(2);
const B = base || "http://127.0.0.1:3100";
const P = pwd || "y1hURonWfC0nv_tg";
const suites = ["tests/smoke.mjs", "tests/token-cache.mjs", "tests/robustness.mjs"];
let allOk = true;
for (const s of suites) {
  console.log(`\n===== ${s} =====`);
  const r = spawnSync(process.execPath, [s, B, P], { stdio: "inherit", cwd: fileURLToPath(new URL("..", import.meta.url)) });
  if (r.status !== 0) allOk = false;
}
console.log(allOk ? "\n✅ 全部测试通过" : "\n❌ 存在失败用例");
process.exit(allOk ? 0 : 1);
