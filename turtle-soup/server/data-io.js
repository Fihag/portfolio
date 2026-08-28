// 共享 JSON 读写工具:原子写(tmp+rename),文件缺失/损坏时返回兜底值
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function persistJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, file);
}
