// 为题库无标题条目补标题(与 parse-soups.mjs 的映射保持一致)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "..", "server", "data", "soups.json");

const TITLES = [
  { key: "牙齿是绿色", title: "绿牙" },
  { key: "外公去世", title: "纸房子" },
  { key: "女孩醒来总有新伤", title: "新伤" },
  { key: "寻人启事", title: "稻草人" },
  { key: "火车经过一个隧道", title: "隧道" },
  { key: "孤寡老人", title: "流浪猫" },
  { key: "男友帮我喂鱼", title: "食人鱼" },
  { key: "我就只有一半", title: "一半" },
  { key: "新年快到了", title: "面食店" },
];

const soups = JSON.parse(readFileSync(FILE, "utf8"));
let added = 0;
for (const s of soups) {
  if (s.title) continue;
  const text = s.surface + s.truth;
  const hit = TITLES.find((t) => text.includes(t.key));
  if (hit) {
    s.title = hit.title;
    added++;
  }
}
writeFileSync(FILE, JSON.stringify(soups, null, 2), "utf8");
console.log(`已补 ${added} 个标题;当前无标题条目: ${soups.filter((s) => !s.title).length} 个`);
