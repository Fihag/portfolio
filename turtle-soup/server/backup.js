// 数据自动备份模块
// 把 server/data/ 下所有 *.json 复制到 server/data/backup/<YYYYMMDD-HHmmss>/ 子目录,
// 并按目录名排序只保留最近 20 份备份(删除最旧的)。
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data");
const BACKUP_DIR = resolve(DATA_DIR, "backup");
const KEEP_BACKUPS = 20;

function formatStamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/**
 * 执行一次备份。返回复制的文件数;data 目录不存在或无 *.json 时返回 0。
 * 备份目录(backup)自身不会被递归复制。
 */
export function backupData() {
  if (!existsSync(DATA_DIR)) return 0;
  const files = readdirSync(DATA_DIR).filter(
    (f) => f !== "backup" && f.endsWith(".json"),
  );
  if (!files.length) return 0;

  mkdirSync(BACKUP_DIR, { recursive: true });
  const target = resolve(BACKUP_DIR, formatStamp(new Date()));
  mkdirSync(target, { recursive: true });
  for (const f of files) {
    copyFileSync(resolve(DATA_DIR, f), resolve(target, f));
  }

  // 只保留最近 KEEP_BACKUPS 份(目录名按时间戳排序,删除最旧的)
  const dirs = readdirSync(BACKUP_DIR)
    .filter((d) => {
      try {
        return statSync(resolve(BACKUP_DIR, d)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
  while (dirs.length > KEEP_BACKUPS) {
    const oldest = dirs.shift();
    rmSync(resolve(BACKUP_DIR, oldest), { recursive: true, force: true });
  }

  return files.length;
}
