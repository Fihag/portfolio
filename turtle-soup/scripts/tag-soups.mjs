// 给 41 道题批量打上 category/difficulty 标签(id → [分类, 难度])
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "server/data/soups.json";
// 已通读全部 41 题汤面+汤底后的人工归类
const TAGS = {
  1: ["horror", "hard"], 2: ["horror", "medium"], 3: ["suspense", "hard"], 4: ["suspense", "medium"],
  5: ["horror", "medium"], 6: ["suspense", "easy"], 7: ["social", "medium"], 8: ["horror", "hard"],
  9: ["suspense", "medium"], 10: ["social", "hard"], 11: ["suspense", "medium"], 12: ["mind", "medium"],
  13: ["warmth", "medium"], 14: ["mind", "medium"], 15: ["horror", "hard"], 16: ["social", "hard"],
  17: ["horror", "medium"], 18: ["mind", "medium"], 19: ["horror", "hard"], 20: ["horror", "medium"],
  21: ["warmth", "medium"], 22: ["horror", "medium"], 23: ["warmth", "hard"], 24: ["horror", "easy"],
  25: ["horror", "hard"], 26: ["suspense", "medium"], 27: ["horror", "easy"], 28: ["suspense", "easy"],
  29: ["horror", "hard"], 30: ["horror", "medium"], 31: ["suspense", "medium"], 32: ["mind", "easy"],
  33: ["warmth", "medium"], 34: ["horror", "hard"], 35: ["suspense", "hard"], 36: ["horror", "hard"],
  37: ["horror", "hard"], 38: ["suspense", "hard"], 39: ["warmth", "easy"], 40: ["mind", "medium"],
  41: ["mind", "easy"],
};

const soups = JSON.parse(readFileSync(FILE, "utf8"));
let tagged = 0;
for (const s of soups) {
  const t = TAGS[s.id];
  if (t) {
    s.category = t[0];
    s.difficulty = t[1];
    tagged++;
  }
}
writeFileSync(FILE, JSON.stringify(soups, null, 2), "utf8");

console.log(`已打标 ${tagged}/${soups.length} 题`);
const cnt = {};
for (const s of soups) cnt[s.category] = (cnt[s.category] || 0) + 1;
console.log("分类分布:", JSON.stringify(cnt));
const d = {};
for (const s of soups) d[s.difficulty] = (d[s.difficulty] || 0) + 1;
console.log("难度分布:", JSON.stringify(d));
const missing = soups.filter((s) => !s.category || !s.difficulty).map((s) => s.id);
console.log("未打标:", missing.length ? JSON.stringify(missing) : "无");
