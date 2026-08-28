/* ============================================================
 * commands.js — 命令集
 * 注册表 + 导航/文件/系统/娱乐命令;重定向与参数解析
 * ============================================================ */

'use strict';

/* ---------- 注册表与解析工具 ---------- */

// AI 配置:浏览器使用全局 AI_CONFIG(js/ai-config.js 先行加载),Node 环境从模块引入
const AI_CONFIG = (typeof module !== 'undefined' && module.exports)
  ? require('./ai-config.js').AI_CONFIG
  : window.AI_CONFIG;

const COMMANDS = {};

function register(name, fn, help) {
  COMMANDS[name] = { fn, help };
}

// 解析 > 与 >> 重定向(忽略引号内的 >)
function parseRedirect(line) {
  let quote = null;
  let opIdx = -1, opLen = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      opIdx = i;
      opLen = (line[i + 1] === '>') ? 2 : 1;
      break;
    }
  }
  if (opIdx < 0) return { command: line, stdoutFile: null, append: false };
  return {
    command: line.slice(0, opIdx).trim(),
    stdoutFile: line.slice(opIdx + opLen).trim() || null,
    append: opLen === 2,
  };
}

// 分割参数,支持 '...' 与 "..."(引号内空格不分割)
function splitArgs(str) {
  const args = [];
  let cur = '', quote = null, started = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === ' ' || ch === '\t') {
      if (started) { args.push(cur); cur = ''; started = false; }
    } else {
      cur += ch;
      started = true;
    }
  }
  if (started) args.push(cur);
  return args;
}

function parseCommandLine(line) {
  const parts = splitArgs(line);
  return { name: parts[0] || '', args: parts.slice(1) };
}

// echo 的 $VAR 展开(优先自定义环境变量,其次内置)
function expandVars(s, ctx) {
  const env = ctx.term.env || {};
  return s.replace(/\$([A-Za-z_][A-Za-z0-9_]*|\?)/g, (m, v) => {
    if (v === '?') return String(ctx.term.lastExit);
    if (env[v] !== undefined) return env[v];
    switch (v) {
      case 'USER': case 'LOGNAME': return env.USER || 'user';
      case 'HOME': return ctx.fs.home;
      case 'PWD': return ctx.cwd;
      case 'HOSTNAME': return 'webterm';
      case 'SHELL': return '/bin/wtsh';
      default: return '';
    }
  });
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d} day${d > 1 ? 's' : ''}, ${h} hour${h > 1 ? 's' : ''}, ${m} min`;
  if (h) return `${h} hour${h > 1 ? 's' : ''}, ${m} min`;
  return `${m} min`;
}

// 显示宽度(中文等宽字符按 2 计)
function dispWidth(s) {
  let w = 0;
  for (const ch of s) w += (ch.codePointAt(0) > 0xff) ? 2 : 1;
  return w;
}

function padDisp(s, width) {
  const pad = width - dispWidth(s);
  return s + (pad > 0 ? ' '.repeat(pad) : '');
}

// 人类可读大小(1.5K / 2.3M / 120B)
function fmtSize(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + 'M';
  if (n >= 1024) return (n / 1024).toFixed(1) + 'K';
  return n + 'B';
}

function coloredName(node) {
  if (node.isDir) return `\x1b[1;34m${node.name}/\x1b[0m`;
  if (/\.(js|ts|sh|py|go|rs)$/.test(node.name)) return `\x1b[32m${node.name}\x1b[0m`;
  if (/\.(txt|md|json|yaml|yml|toml)$/.test(node.name)) return `\x1b[37m${node.name}\x1b[0m`;
  return `\x1b[37m${node.name}\x1b[0m`;
}

/* ============================================================
 * 导航命令
 * ============================================================ */

register('pwd', (ctx) => { ctx.out(ctx.cwd); },
  'pwd — 显示当前工作目录');

register('cd', (ctx) => {
  if (ctx.args.length > 1) { ctx.error('cd: 参数过多'); return 1; }
  const target = ctx.args[0] || '~';
  if (target === '-') {
    const prev = ctx.term.prevCwd;
    if (!prev) { ctx.error('cd: OLDPWD 未设置(还没有切换过目录)'); return 1; }
    const node = ctx.fs.get(prev);
    if (!node || !node.isDir) { ctx.error(`cd: ${prev}: 没有那个目录`); return 1; }
    ctx.term.prevCwd = ctx.cwd;
    ctx.setCwd(prev);
    ctx.out(prev);
    return 0;
  }
  const p = ctx.fs.normalize(target);
  const node = ctx.fs.get(p);
  if (!node) { ctx.error(`cd: 没有那个目录: ${target}`); return 1; }
  if (!node.isDir) { ctx.error(`cd: 不是目录: ${target}`); return 1; }
  if (p !== ctx.cwd) ctx.term.prevCwd = ctx.cwd;
  ctx.setCwd(p);
  return 0;
}, 'cd [目录] — 切换目录(默认 ~;cd - 返回上次目录)');

register('ls', (ctx) => {
  let showAll = false, long = false, human = false;
  const paths = [];
  for (const a of ctx.args) {
    if (a === '-a' || a === '--all') showAll = true;
    else if (a === '-l') long = true;
    else if (a === '-h') human = true;
    else if (a === '-al' || a === '-la') { showAll = true; long = true; }
    else if (a === '-lh' || a === '-hl') { long = true; human = true; }
    else if (a === '-alh' || a === '-lah' || a === '-ahl') { showAll = true; long = true; human = true; }
    else if (a.startsWith('-')) { ctx.error(`ls: 无效选项 ${a}`); return 1; }
    else paths.push(a);
  }
  const targets = paths.length ? paths : ['.'];
  targets.forEach((t, ti) => {
    const node = ctx.fs.get(t);
    if (!node) { ctx.error(`ls: 无法访问 '${t}': 没有那个文件或目录`); return; }
    if (node.isFile) { ctx.out(node.name); return; }
    let items = ctx.fs.listDir(t);
    if (!showAll) items = items.filter(i => !i.name.startsWith('.'));
    if (long) {
      for (const it of items) {
        const n = it.node;
        const perm = n.isDir ? 'drwxr-xr-x' : '-rw-r--r--';
        const size = n.isDir ? 4096 : n.content.length;
        ctx.out(`${perm}  ${String(human ? fmtSize(size) : size).padStart(6)}  ${n.mtimeStr()}  ${coloredName(n)}`);
      }
    } else {
      ctx.out(items.map(i => coloredName(i.node)).join('  '));
    }
    if (paths.length > 1 && ti < targets.length - 1) ctx.out('');
  });
  return 0;
}, 'ls [-a] [-l] [-h] [路径...] — 列出目录内容(-h 人类可读大小)');

register('tree', (ctx) => {
  let root = '.', maxDepth = 8;
  const showAll = ctx.args.includes('-a');
  for (const a of ctx.args) {
    if (/^-\d+$/.test(a)) maxDepth = parseInt(a.slice(1), 10);
    else if (a === '-L') { maxDepth = parseInt(ctx.args[ctx.args.indexOf(a) + 1], 10) || 8; }
    else if (!a.startsWith('-')) root = a;
  }
  const norm = ctx.fs.normalize(root);
  const node = ctx.fs.get(norm);
  if (!node) { ctx.error(`tree: ${root}: 没有那个文件或目录`); return 1; }
  ctx.out(`\x1b[1;34m${node.name === '/' ? '/' : (root === '.' ? '.' : node.name)}\x1b[0m`);
  const walk = (dir, prefix, depth) => {
    if (depth > maxDepth) return;
    const items = ctx.fs.listDir(dir).filter(i => showAll || !i.name.startsWith('.'));
    items.forEach((it, i) => {
      const last = i === items.length - 1;
      const branch = prefix + (last ? '└── ' : '├── ');
      ctx.out(branch + (it.node.isDir ? `\x1b[1;34m${it.name}\x1b[0m` : it.name));
      if (it.node.isDir) walk(dir + '/' + it.name, prefix + (last ? '    ' : '│   '), depth + 1);
    });
  };
  walk(norm, '', 1);
  return 0;
}, 'tree [路径] [-L 深度] — 以树状显示目录');

register('find', (ctx) => {
  let path = '.', name = null, type = null, size = null;
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i];
    if (a === '-name') name = ctx.args[++i];
    else if (a === '-type') type = ctx.args[++i];
    else if (a === '-size') size = ctx.args[++i];
    else if (!a.startsWith('-')) path = a;
  }
  let re = null;
  if (name) {
    const esc = name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    re = new RegExp('^' + esc + '$');
  }
  // 解析 -size:支持 +100k / -10k / 512c
  let sizeMin = null, sizeMax = null;
  if (size) {
    const m = size.match(/^([+-]?)(\d+)([kMc]?)$/);
    if (m) {
      const mult = m[3] === 'k' ? 1024 : (m[3] === 'M' ? 1024 * 1024 : 1);
      const v = parseInt(m[2], 10) * mult;
      if (m[1] === '+') sizeMin = v;
      else if (m[1] === '-') sizeMax = v;
      else sizeMin = sizeMax = v;
    }
  }
  const norm = ctx.fs.normalize(path);
  const results = [];
  const walk = (dir, prefix) => {
    const items = ctx.fs.listDir(dir);
    for (const it of items) {
      const full = prefix ? prefix + '/' + it.name : it.name;
      const isDir = it.node.isDir;
      if (type && ((type === 'f' && isDir) || (type === 'd' && !isDir))) { if (isDir) walk(dir + '/' + it.name, full); continue; }
      if (sizeMin !== null || sizeMax !== null) {
        const len = isDir ? 0 : it.node.content.length;
        if (sizeMin !== null && len < sizeMin) { if (isDir) walk(dir + '/' + it.name, full); continue; }
        if (sizeMax !== null && len > sizeMax) { if (isDir) walk(dir + '/' + it.name, full); continue; }
      }
      if (!re || re.test(it.name)) results.push(isDir ? full + '/' : full);
      if (isDir) walk(dir + '/' + it.name, full);
    }
  };
  walk(norm, path === '.' ? '' : norm);
  ctx.out(results.length ? results.join('\n') : '');
  return 0;
}, 'find [路径] [-name 模式] [-type f|d] [-size [+-]N[k|M|c]] — 查找文件');

/* ============================================================
 * 文件命令
 * ============================================================ */

register('cat', (ctx) => {
  let showNum = false;
  const files = [];
  for (const a of ctx.args) {
    if (a === '-n') showNum = true;
    else files.push(a);
  }
  if (!files.length) {
    if (ctx.isRedirected()) ctx.error('cat: 虚拟终端不支持从 stdin 读取,请直接提供文件路径');
    else ctx.error('cat: 缺少文件参数');
    return 1;
  }
  for (const f of files) {
    const node = ctx.fs.get(f);
    if (!node) { ctx.error(`cat: ${f}: 没有那个文件或目录`); return 1; }
    if (node.isDir) { ctx.error(`cat: ${f}: 是一个目录`); return 1; }
    if (showNum) {
      const lines = node.content.split('\n');
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      lines.forEach((l, i) => ctx.outRaw(`${String(i + 1).padStart(6)}\t${l}\n`));
    } else {
      ctx.outRaw(node.content);
      if (node.content && !node.content.endsWith('\n')) ctx.outRaw('\n');
    }
  }
  return 0;
}, 'cat [-n] <文件...> — 输出文件内容(-n 带行号)');

register('touch', (ctx) => {
  if (!ctx.args.length) { ctx.error('touch: 缺少文件参数'); return 1; }
  for (const f of ctx.args) {
    const r = ctx.fs.writeFile(f);
    if (!r.ok) ctx.error(r.err);
  }
  return 0;
}, 'touch <文件...> — 创建空文件或更新时间戳');

register('mkdir', (ctx) => {
  let recursive = false;
  const paths = [];
  for (const a of ctx.args) {
    if (a === '-p') recursive = true;
    else if (a.startsWith('-')) { ctx.error(`mkdir: 无效选项 ${a}`); return 1; }
    else paths.push(a);
  }
  if (!paths.length) { ctx.error('mkdir: 缺少目录参数'); return 1; }
  for (const p of paths) {
    const r = recursive ? ctx.fs.mkdirRecursive(p) : ctx.fs.mkdir(p);
    if (!r.ok) ctx.error(r.err);
  }
  return 0;
}, 'mkdir [-p] <目录...> — 创建目录');

register('rm', (ctx) => {
  let recursive = false, force = false;
  const paths = [];
  for (const a of ctx.args) {
    if (a === '-r' || a === '-R') recursive = true;
    else if (a === '-f') force = true;
    else if (a === '-rf' || a === '-fr') { recursive = true; force = true; }
    else if (a.startsWith('-')) { ctx.error(`rm: 无效选项 ${a}`); return 1; }
    else paths.push(a);
  }
  if (!paths.length) { ctx.error('rm: 缺少文件参数'); return 1; }
  // 安全保护:拒绝删除根目录
  if (paths.some(p => ctx.fs.normalize(p) === '/')) {
    ctx.error('rm: 出于安全考虑,拒绝删除根目录 /');
    return 1;
  }
  for (const p of paths) {
    const node = ctx.fs.get(p);
    if (!node) {
      if (!force) ctx.error(`rm: 无法删除 '${p}': 没有那个文件或目录`);
      continue;
    }
    if (node.isDir && !recursive) {
      ctx.error(`rm: 无法删除 '${p}': 是一个目录(加 -r 递归删除)`);
      continue;
    }
    ctx.fs.remove(p);
  }
  return 0;
}, 'rm [-r] [-f] <路径...> — 删除文件或目录');

register('mv', (ctx) => {
  if (ctx.args.length < 2) { ctx.error('mv: 用法 mv <源...> <目标>'); return 1; }
  const srcs = ctx.args.slice(0, -1);
  const dst = ctx.args[ctx.args.length - 1];
  const dstIsDir = ctx.fs.isDir(dst) || dst.endsWith('/');
  if (srcs.length > 1 && !dstIsDir) {
    ctx.error(`mv: 目标 '${dst}' 不是目录,无法移动多个源`);
    return 1;
  }
  for (const s of srcs) {
    const srcNode = ctx.fs.get(s);
    if (!srcNode) { ctx.error(`mv: ${s}: 没有那个文件或目录`); continue; }
    const target = dstIsDir ? dst.replace(/\/+$/, '') + '/' + srcNode.name : dst;
    const r = ctx.fs.rename(s, target);
    if (!r.ok) ctx.error(r.err);
  }
  return 0;
}, 'mv <源...> <目标> — 移动或重命名');

function copyNodeRecursive(fs, srcPath, dstPath) {
  const node = fs.get(srcPath);
  if (!node) return { ok: false, err: `cp: 无法复制 '${srcPath}': 没有那个文件或目录` };
  if (node.isFile) return fs.writeFile(dstPath, node.content);
  const mk = fs.mkdir(dstPath);
  if (!mk.ok) return mk;
  for (const it of fs.listDir(srcPath)) {
    const r = copyNodeRecursive(fs, srcPath + '/' + it.name, dstPath + '/' + it.name);
    if (!r.ok) return r;
  }
  return { ok: true };
}

register('cp', (ctx) => {
  let recursive = false;
  const paths = [];
  for (const a of ctx.args) {
    if (a === '-r' || a === '-R') recursive = true;
    else if (a === '-i' || a === '-v') { /* 虚拟终端无交互确认,忽略 */ }
    else if (a.startsWith('-')) { ctx.error(`cp: 无效选项 ${a}`); return 1; }
    else paths.push(a);
  }
  if (paths.length < 2) { ctx.error('cp: 用法 cp [-r] <源...> <目标>'); return 1; }
  const srcs = paths.slice(0, -1);
  const dst = paths[paths.length - 1];
  const dstIsDir = ctx.fs.isDir(dst) || dst.endsWith('/');
  if (srcs.length > 1 && !dstIsDir) {
    ctx.error(`cp: 目标 '${dst}' 不是目录`);
    return 1;
  }
  for (const s of srcs) {
    const srcNode = ctx.fs.get(s);
    if (!srcNode) { ctx.error(`cp: ${s}: 没有那个文件或目录`); continue; }
    if (srcNode.isDir && !recursive) {
      ctx.error(`cp: 跳过目录 '${s}'(加 -r 递归复制)`);
      continue;
    }
    const target = dstIsDir ? dst.replace(/\/+$/, '') + '/' + srcNode.name : dst;
    const r = copyNodeRecursive(ctx.fs, s, target);
    if (!r.ok) ctx.error(r.err);
  }
  return 0;
}, 'cp [-r] <源...> <目标> — 复制文件或目录');

register('head', (ctx) => headTail(ctx, 'head'),
  'head [-n N] <文件> — 显示文件开头 N 行(默认 10)');

register('tail', (ctx) => headTail(ctx, 'tail'),
  'tail [-n N] <文件> — 显示文件末尾 N 行(默认 10)');

function headTail(ctx, kind) {
  let n = 10, file = null;
  const follow = ctx.args.includes('-f');
  for (let i = 0; i < ctx.args.length; i++) {
    const a = ctx.args[i];
    if (a === '-n') n = parseInt(ctx.args[++i], 10) || 10;
    else if (/^-n\d+$/.test(a)) n = parseInt(a.slice(2), 10) || 10;
    else if (a === '-f') { /* 虚拟终端无实时日志流,忽略 */ }
    else file = a;
  }
  if (follow && kind === 'tail') ctx.error('tail: 虚拟终端没有实时日志流,显示当前末尾(-f 忽略)');
  if (!file) { ctx.error(`${kind}: 用法 ${kind} [-n N] <文件>`); return 1; }
  const node = ctx.fs.get(file);
  if (!node) { ctx.error(`${kind}: ${file}: 没有那个文件或目录`); return 1; }
  if (node.isDir) { ctx.error(`${kind}: ${file}: 是一个目录`); return 1; }
  const lines = node.content.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop(); // 去掉结尾 \n 的空元素
  const out = kind === 'head' ? lines.slice(0, n) : lines.slice(-n);
  ctx.outRaw(out.join('\n') + '\n');
  return 0;
}

register('grep', (ctx) => {
  let invert = false, count = false, lineNo = false, recursive = false;
  let pattern = null;
  const files = [];
  for (const a of ctx.args) {
    if (a === '-v') invert = true;
    else if (a === '-c') count = true;
    else if (a === '-n') lineNo = true;
    else if (a === '-r' || a === '-R') recursive = true;
    else if (pattern === null) pattern = a;
    else files.push(a);
  }
  if (pattern === null || !files.length) { ctx.error('grep: 用法 grep [-v] [-c] [-n] [-r] <模式> <文件或目录...>'); return 1; }
  let re = null;
  try { re = new RegExp(pattern); } catch (e) { re = null; }

  // 收集待搜索的文件列表
  const targets = [];
  const collect = (path) => {
    const node = ctx.fs.get(path);
    if (!node) { ctx.error(`grep: ${path}: 没有那个文件或目录`); return; }
    if (node.isFile) targets.push({ path, node });
    else {
      if (!recursive) { ctx.error(`grep: ${path}: 是一个目录(加 -r 递归搜索)`); return; }
      for (const it of ctx.fs.listDir(path)) {
        collect(path.replace(/\/+$/, '') + '/' + it.name);
      }
    }
  };
  for (const f of files) collect(f);
  if (!targets.length) return 0;

  const showPath = targets.length > 1 || recursive;
  for (const { path, node } of targets) {
    let n = 0;
    const lines = node.content.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.forEach((l, idx) => {
      const match = re ? re.test(l) : l.includes(pattern);
      if (match !== invert) {
        if (count) n++;
        else {
          const prefix = showPath ? `\x1b[35m${path}\x1b[0m:` : '';
          ctx.out(prefix + (lineNo ? `${idx + 1}:` : '') + l);
        }
      }
    });
    if (count) ctx.out(`${path}:${n}`);
  }
  return 0;
}, 'grep [-v] [-c] [-n] [-r] <模式> <文件或目录...> — 搜索文件内容');

register('wc', (ctx) => {
  let doL = false, doW = false, doC = false;
  const files = [];
  for (const a of ctx.args) {
    if (a === '-l') doL = true;
    else if (a === '-w') doW = true;
    else if (a === '-c') doC = true;
    else if (a.startsWith('-')) { ctx.error(`wc: 无效选项 ${a}`); return 1; }
    else files.push(a);
  }
  if (!doL && !doW && !doC) doL = doW = doC = true;
  if (!files.length) { ctx.error('wc: 缺少文件参数'); return 1; }
  for (const f of files) {
    const node = ctx.fs.get(f);
    if (!node) { ctx.error(`wc: ${f}: 没有那个文件或目录`); continue; }
    const s = node.content;
    const lines = s === '' ? 0 : s.split('\n').length - (s.endsWith('\n') ? 1 : 0);
    const words = s.trim() === '' ? 0 : s.trim().split(/\s+/).length;
    const chars = [...s].length;
    let parts = [];
    if (doL) parts.push(String(lines));
    if (doW) parts.push(String(words));
    if (doC) parts.push(String(chars));
    ctx.out(parts.join('  ') + '  ' + f);
  }
  return 0;
}, 'wc [-l] [-w] [-c] <文件...> — 统计行/词/字符数');

register('echo', (ctx) => {
  let newline = true;
  let args = ctx.args;
  if (args[0] === '-n') { newline = false; args = args.slice(1); }
  ctx.outRaw(expandVars(args.join(' '), ctx));
  if (newline) ctx.outRaw('\n');
  return 0;
}, 'echo [-n] <文本...> — 输出文本(支持 $? $USER $HOME $PWD 等变量)');

/* --- 文本处理工具 --- */

register('tac', (ctx) => {
  if (!ctx.args.length) { ctx.error('tac: 缺少文件参数'); return 1; }
  for (const f of ctx.args) {
    const node = ctx.fs.get(f);
    if (!node) { ctx.error(`tac: ${f}: 没有那个文件或目录`); return 1; }
    if (node.isDir) { ctx.error(`tac: ${f}: 是一个目录`); return 1; }
    const lines = node.content.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    ctx.outRaw([...lines].reverse().join('\n') + '\n');
  }
  return 0;
}, 'tac <文件...> — 反向输出文件行(cat 的逆序)');

register('sort', (ctx) => {
  const rev = ctx.args.includes('-r');
  const unique = ctx.args.includes('-u');
  const numeric = ctx.args.includes('-n');
  const files = ctx.args.filter(a => !a.startsWith('-'));
  if (!files.length) { ctx.error('sort: 缺少文件参数'); return 1; }
  let lines = [];
  for (const f of files) {
    const node = ctx.fs.get(f);
    if (!node) { ctx.error(`sort: ${f}: 没有那个文件或目录`); return 1; }
    if (node.isDir) { ctx.error(`sort: ${f}: 是一个目录`); return 1; }
    const ls = node.content.split('\n');
    if (ls.length && ls[ls.length - 1] === '') ls.pop();
    lines.push(...ls);
  }
  if (unique) lines = [...new Set(lines)];
  lines.sort((a, b) => {
    let r;
    if (numeric) r = ((parseFloat(a) || 0) - (parseFloat(b) || 0));
    else r = a.localeCompare(b, 'zh');
    return rev ? -r : r;
  });
  ctx.out(lines.join('\n'));
  return 0;
}, 'sort [-r] [-u] [-n] <文件...> — 排序文件行(-u 去重,-n 数值)');

register('hexdump', (ctx) => {
  const file = ctx.args[0] === '-C' ? ctx.args[1] : ctx.args[0];
  if (!file) { ctx.error('hexdump: 用法 hexdump [-C] <文件>'); return 1; }
  const node = ctx.fs.get(file);
  if (!node) { ctx.error(`hexdump: ${file}: 没有那个文件或目录`); return 1; }
  if (node.isDir) { ctx.error(`hexdump: ${file}: 是一个目录`); return 1; }
  const chars = [...node.content];
  for (let off = 0; off < chars.length; off += 16) {
    const chunk = chars.slice(off, off + 16);
    const hex = chunk.map(c => c.codePointAt(0).toString(16).padStart(2, '0')).join(' ');
    const ascii = chunk.map(c => (c >= ' ' && c <= '~') ? c : '.').join('');
    ctx.out(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  if (!chars.length) ctx.out('00000000');
  return 0;
}, 'hexdump [-C] <文件> — 以十六进制查看文件内容');

/* ============================================================
 * 系统命令
 * ============================================================ */

register('clear', (ctx) => { ctx.term.clear(); return 0; },
  'clear — 清屏(等价于 Ctrl+L)');

register('date', (ctx) => {
  const d = new Date();
  const weeks = ['日', '一', '二', '三', '四', '五', '六'];
  const p = (n) => String(n).padStart(2, '0');
  const arg = ctx.args[0];
  if (arg === '-s') {
    ctx.error('date: 虚拟终端不支持设置日期(-s)');
    return 1;
  }
  if (arg && arg.startsWith('+')) {
    const fmt = {
      '%Y': String(d.getFullYear()),
      '%y': String(d.getFullYear()).slice(2),
      '%m': p(d.getMonth() + 1),
      '%d': p(d.getDate()),
      '%e': String(d.getDate()),
      '%H': p(d.getHours()),
      '%M': p(d.getMinutes()),
      '%S': p(d.getSeconds()),
      '%w': String(d.getDay()),
      '%F': `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      '%T': `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
      '%R': `${p(d.getHours())}:${p(d.getMinutes())}`,
      '%%': '%',
    };
    ctx.out(arg.slice(1).replace(/%[YymdeHMSwFTR%]/g, m => (m in fmt ? fmt[m] : m)));
    return 0;
  }
  ctx.out(`${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weeks[d.getDay()]} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} CST`);
  return 0;
}, 'date [+格式] — 显示日期时间(如 date +%F 输出 2026-01-15)');

register('whoami', (ctx) => { ctx.out('user'); return 0; }, 'whoami — 显示当前用户');

register('hostname', (ctx) => { ctx.out('webterm'); return 0; }, 'hostname — 显示主机名');

register('uname', (ctx) => {
  if (ctx.args.includes('-a')) {
    ctx.out('WebTerminal OS webterm 1.0.0 WebTerminal 1.0.0 x86_64 GNU/Linux');
    return 0;
  }
  const opts = ctx.args.filter(a => a.startsWith('-') && a.length > 1).join('').slice(1).split('');
  if (!opts.length) { ctx.out('WebTerminal'); return 0; }
  const vals = {
    s: 'WebTerminal', n: 'webterm', r: '1.0.0', v: '#1 SMP', m: 'x86_64', o: 'GNU/Linux',
  };
  ctx.out(opts.map(c => vals[c] || '').filter(Boolean).join(' '));
  return 0;
}, 'uname [-a] [-s] [-n] [-r] [-m] — 显示系统信息(-r 内核版本)');

register('uptime', (ctx) => {
  const up = Date.now() - ctx.term.bootTime;
  ctx.out(` ${fmtUptime(up)},  1 user,  load average: 0.00, 0.01, 0.05`);
  return 0;
}, 'uptime — 显示运行时间与负载');

register('cal', (ctx) => {
  const now = new Date();
  let year = now.getFullYear(), month = now.getMonth(); // month 0-based
  const nums = ctx.args.map(a => parseInt(a, 10));
  if (nums.length === 1 && !isNaN(nums[0])) year = nums[0];
  else if (nums.length >= 2 && !isNaN(nums[0]) && !isNaN(nums[1])) { month = nums[0] - 1; year = nums[1]; }
  if (year < 1 || year > 9999 || month < 0 || month > 11) { ctx.error('cal: 无效日期'); return 1; }
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  ctx.out(`\x1b[1m      ${month + 1} 月 ${year}\x1b[0m`);
  ctx.out('日 一 二 三 四 五 六');
  let line = '   '.repeat(first);
  for (let d = 1; d <= days; d++) {
    const isToday = (year === now.getFullYear() && month === now.getMonth() && d === now.getDate());
    line += (isToday ? `\x1b[1;32m${String(d).padStart(2)}\x1b[0m ` : `${String(d).padStart(2)} `);
    if ((first + d) % 7 === 0) { ctx.out(line); line = ''; }
  }
  if (line) ctx.out(line);
  return 0;
}, 'cal [月] [年] — 显示日历(默认当月,绿色高亮今天)');

register('env', (ctx) => {
  const env = ctx.term.env || {};
  const lines = [
    `USER=${env.USER || 'user'}`,
    `HOME=${ctx.fs.home}`,
    `PWD=${ctx.cwd}`,
    'HOSTNAME=webterm',
    'SHELL=/bin/wtsh',
    `LANG=${env.LANG || 'zh_CN.UTF-8'}`,
    'PATH=/usr/local/bin:/usr/bin:/bin',
    'PS1=\\u@\\h:\\w\\$',
  ];
  for (const k of Object.keys(env)) {
    if (!['USER', 'LANG'].includes(k)) lines.push(`${k}=${env[k]}`);
  }
  ctx.out(lines.join('\n'));
  return 0;
}, 'env — 显示环境变量(含 export 自定义)');

register('export', (ctx) => {
  if (!ctx.args.length) return COMMANDS.env.fn(ctx);
  for (const a of ctx.args) {
    const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) { ctx.error(`export: 无效的赋值 '${a}'(用法: export NAME=value)`); continue; }
    ctx.term.env[m[1]] = m[2];
  }
  return 0;
}, 'export NAME=value... — 设置环境变量(echo $NAME 可见;无参数时显示全部)');

register('df', (ctx) => {
  const human = ctx.args.includes('-h');
  let used = 0, files = 0;
  const walk = (dir) => {
    for (const it of ctx.fs.listDir(dir)) {
      if (it.node.isFile) { used += it.node.content.length; files++; }
      else walk(dir + '/' + it.name);
    }
  };
  walk('/');
  const total = 1024 * 1024;
  const pct = Math.round(used / total * 100);
  const fmt = (n) => human ? fmtSize(n) : String(n);
  ctx.out('文件系统       容量      已用      可用    使用率  挂载点');
  ctx.out(`vfs:/      ${fmt(total).padStart(8)} ${fmt(used).padStart(8)} ${fmt(total - used).padStart(8)}  ${String(pct).padStart(4)}%  /`);
  ctx.out(`(虚拟磁盘 1MB,当前 ${files} 个文件,刷新页面即还原)`);
  return 0;
}, 'df [-h] — 查看虚拟磁盘使用情况(-h 人类可读)');

register('du', (ctx) => {
  const human = ctx.args.includes('-h');
  const all = ctx.args.includes('-a');
  const target = ctx.args.filter(a => !a.startsWith('-'))[0] || '.';
  const norm = ctx.fs.normalize(target);
  const node = ctx.fs.get(norm);
  if (!node) { ctx.error(`du: ${target}: 没有那个文件或目录`); return 1; }
  const results = [];
  const walk = (dir, prefix) => {
    let size = 0;
    for (const it of ctx.fs.listDir(dir)) {
      const p = prefix + '/' + it.name;
      if (it.node.isFile) { size += it.node.content.length; if (all) results.push({ p, s: it.node.content.length }); }
      else { const s = walk(dir + '/' + it.name, p); size += s; if (all) results.push({ p, s }); }
    }
    return size;
  };
  if (node.isFile) results.push({ p: target, s: node.content.length });
  else results.push({ p: target, s: walk(norm, target) });
  for (const r of results) {
    ctx.out(`${human ? fmtSize(r.s) : r.s + ' B'}  ${r.p}`);
  }
  return 0;
}, 'du [-h] [-a] [路径] — 统计文件/目录占用字节(-h 人类可读,-a 列出全部)');

register('history', (ctx) => {
  if (ctx.args[0] === '-c') { ctx.term.history.length = 0; return 0; }
  if (ctx.args[0] === '-h') { ctx.error('history — 显示历史命令;history -c 清空历史'); return 1; }
  ctx.term.history.forEach((h, i) => ctx.out(`${String(i + 1).padStart(4)}  ${h}`));
  return 0;
}, 'history [-c] — 显示/清空命令历史');

register('which', (ctx) => {
  if (!ctx.args[0]) { ctx.error('which: 用法 which <命令>'); return 1; }
  const found = [];
  for (const a of ctx.args) {
    if (COMMANDS[a]) found.push(`/usr/bin/${a}`);
    else { ctx.error(`which: 找不到 ${a} 的可执行文件`); }
  }
  if (found.length) ctx.out(found.join('\n'));
  return found.length ? 0 : 1;
}, 'which <命令...> — 查找命令位置');

register('man', (ctx) => {
  if (!ctx.args[0]) { ctx.error('man: 用法 man <命令> 或 man -k <关键词>'); return 1; }
  if (ctx.args[0] === '-k') {
    const kw = ctx.args[1];
    if (!kw) { ctx.error('man: 用法 man -k <关键词>'); return 1; }
    const hits = Object.keys(COMMANDS).filter(n =>
      n.includes(kw) || (COMMANDS[n].help || '').includes(kw));
    if (!hits.length) { ctx.out('(没有匹配的命令)'); return 0; }
    ctx.out(hits.map(n => `\x1b[36m${n}\x1b[0m — ${COMMANDS[n].help || ''}`).join('\n'));
    return 0;
  }
  const c = COMMANDS[ctx.args[0]];
  if (!c) { ctx.error(`没有 ${ctx.args[0]} 的手册页`); return 1; }
  ctx.out(c.help || `${ctx.args[0]} 暂无详细说明`);
  return 0;
}, 'man <命令> 或 man -k <关键词> — 查看/搜索命令帮助');

register('help', (ctx) => {
  if (ctx.args[0]) {
    const c = COMMANDS[ctx.args[0]];
    if (!c) { ctx.error(`help: 没有 ${ctx.args[0]} 的帮助(试试 man ${ctx.args[0]})`); return 1; }
    ctx.out(c.help || `${ctx.args[0]} 暂无详细说明`);
    return 0;
  }
  ctx.out('');
  ctx.out('\x1b[1;36mWebTerminal — 基于 Web 的类终端系统\x1b[0m');
  ctx.out('');
  ctx.out('\x1b[1;32m  导航\x1b[0m    pwd  cd  ls  tree  find');
  ctx.out('\x1b[1;32m  文件\x1b[0m    cat  tac  touch  mkdir  rm  mv  cp  head  tail  wc  grep  sort  echo');
  ctx.out('\x1b[1;32m  查看\x1b[0m    hexdump  du  df');
  ctx.out('\x1b[1;32m  系统\x1b[0m    clear  cal  date  whoami  hostname  uname  uptime  env  export  history  help  man  which  ps  exit');
  ctx.out('\x1b[1;32m  娱乐\x1b[0m    neofetch  banner  cowsay  fortune  matrix  snake  sudo');
  ctx.out('\x1b[1;32m  AI\x1b[0m       ai(外接模型,ai 查看用法)');
  ctx.out('');
  ctx.out('\x1b[1;33m  技巧\x1b[0m    Tab 补全 · ↑/↓ 历史 · Ctrl+L 清屏 · Ctrl+C 取消 · Ctrl+A/E 行首尾');
  ctx.out('        echo 文本 > 文件  写入文件(>> 追加)· 任意命令 | 见 man');
  ctx.out('');
  ctx.out('输入 \x1b[36mman <命令>\x1b[0m 查看用法,试试 \x1b[36mneofetch\x1b[0m 或 \x1b[36mhelp\x1b[0m 以外的 \x1b[36mhelp\x1b[0m 亦可。');
  return 0;
}, 'help — 显示帮助');

register('ps', (ctx) => {
  ctx.out('  PID TTY          TIME CMD');
  ctx.out('    1 ?        00:00:00 init');
  ctx.out('    2 ?        00:00:00 kthreadd');
  ctx.out(`  ${String(100 + Math.floor(Math.random() * 800)).padStart(4)} pts/0    00:00:00 wtsh`);
  ctx.out(`  ${String(200 + Math.floor(Math.random() * 800)).padStart(4)} pts/0    00:00:00 ${ctx.args.length ? 'sh -c ' + ctx.args.join(' ') : 'webterm'}`);
  return 0;
}, 'ps — 显示进程列表');

register('exit', (ctx) => {
  ctx.out('logout');
  window.__showBanner && window.__showBanner();
  return 0;
}, 'exit — 退出并重启会话');

register('reboot', (ctx) => {
  ctx.out('\x1b[33m系统正在重启...\x1b[0m');
  window.__showBanner && window.__showBanner();
  return 0;
}, 'reboot — 重启会话');

register('poweroff', (ctx) => {
  ctx.out('\x1b[33m系统已关机。点击页面任意位置以重新启动...\x1b[0m');
  ctx.term.clear();
  ctx.out('\x1b[31m■ 系统已关机\x1b[0m');
  ctx.out('单击此处重新启动: ');
  return 0;
}, 'poweroff — 关机(点击页面重启)');

register('sudo', (ctx) => {
  ctx.out('[sudo] 密码: ');
  ctx.out(`\x1b[31m${ctx.args[0] || '(无命令)'}: 不在 sudoers 文件中。此事件已被记录并上报。\x1b[0m`);
  return 1;
}, 'sudo <命令> — 假装提权(失败)');

/* ============================================================
 * 娱乐命令
 * ============================================================ */

register('neofetch', (ctx) => {
  const logo = [
    '        ▄▄▄▄▄▄▄▄▄▄▄',
    '     ▄███████████████▄',
    '   ▄█████▀      ▀██████▄',
    '  █████            ██████',
    ' ████▀              ▀█████',
    ' ████                 ████▄',
    ' ████▄                █████',
    '  █████              ██████',
    '   ██████▄        ▄████████',
    '     ▀█████████████████▀',
    '        ▀▀▀▀▀▀▀▀▀▀▀',
  ];
  const up = Date.now() - ctx.term.bootTime;
  const info = [
    '\x1b[1;32muser\x1b[0m@\x1b[1;34mwebterm\x1b[0m',
    '\x1b[36m─────────────\x1b[0m',
    '\x1b[33mOS\x1b[0m: WebTerminal OS 1.0.0 (web)',
    '\x1b[33mHost\x1b[0m: Browser Engine',
    '\x1b[33mKernel\x1b[0m: JavaScript',
    '\x1b[33mShell\x1b[0m: wtsh 1.0.0',
    `\x1b[33mUptime\x1b[0m: ${fmtUptime(up)}`,
    '\x1b[33mTerminal\x1b[0m: web-terminal',
    '\x1b[33mCPU\x1b[0m: Virtual (64-bit)',
    '\x1b[33mMemory\x1b[0m: 128MB / 512MB',
  ];
  logo.forEach((l, i) => {
    const colored = `\x1b[36m${l}\x1b[0m`;
    const infoLine = info[i] ? '\x1b[90m│\x1b[0m ' + info[i] : '';
    ctx.out(colored + padDisp('', 30 - dispWidth(l)) + infoLine);
  });
  return 0;
}, 'neofetch — 显示系统信息(仿)');

/* --- 3x5 点阵字体(banner) --- */

const FONT5 = {
  A: [' ### ','#   #','#####','#   #','#   #'], B: ['#### ','#   #','#### ','#   #','#### '],
  C: [' ####','#    ','#    ','#    ',' ####'], D: ['#### ','#   #','#   #','#   #','#### '],
  E: ['#####','#    ','#### ','#    ','#####'], F: ['#####','#    ','#### ','#    ','#    '],
  G: [' ####','#    ','#  ##','#   #',' ####'], H: ['#   #','#   #','#####','#   #','#   #'],
  I: ['#####','  #  ','  #  ','  #  ','#####'], J: ['  ###','   # ','   # ','   # ','###  '],
  K: ['#   #','#  # ','###  ','#  # ','#   #'], L: ['#    ','#    ','#    ','#    ','#####'],
  M: ['#   #','## ##','# # #','#   #','#   #'], N: ['#   #','##  #','# # #','#  ##','#   #'],
  O: [' ### ','#   #','#   #','#   #',' ### '], P: ['#### ','#   #','#### ','#    ','#    '],
  Q: [' ### ','#   #','# # #','#  # ',' ## #'], R: ['#### ','#   #','#### ','#  # ','#   #'],
  S: [' ####','#    ',' ### ','    #','#### '], T: ['#####','  #  ','  #  ','  #  ','  #  '],
  U: ['#   #','#   #','#   #','#   #',' ### '], V: ['#   #','#   #','#   #',' # # ','  #  '],
  W: ['#   #','#   #','# # #','## ##','#   #'], X: ['#   #',' # # ','  #  ',' # # ','#   #'],
  Y: ['#   #',' # # ','  #  ','  #  ','  #  '], Z: ['#####','   # ','  #  ',' #   ','#####'],
  0: [' ### ','#   #','#   #','#   #',' ### '], 1: ['  #  ',' ##  ','  #  ','  #  ',' ### '],
  2: [' ### ','#   #','  ## ',' #   ','#####'], 3: ['#### ','    #',' ### ','    #','#### '],
  4: ['#  # ','#  # ','#### ','   # ','   # '], 5: ['#####','#    ','#### ','    #','#### '],
  6: [' ### ','#    ','#### ','#   #',' ### '], 7: ['#####','    #','   # ','  #  ','  #  '],
  8: [' ### ','#   #',' ### ','#   #',' ### '], 9: [' ### ','#   #',' ####','    #',' ### '],
  '!': ['  #  ','  #  ','  #  ','     ','  #  '], '?': [' ### ','#   #','  ## ','     ','  #  '],
  ' ': ['     ','     ','     ','     ','     '],
};

register('banner', (ctx) => {
  const text = (ctx.args.join(' ') || 'WEBTERM').toUpperCase();
  const chars = [...text].map(c => FONT5[c] || FONT5['?']);
  let block = '';
  for (let row = 0; row < 5; row++) {
    let line = '';
    for (const ch of chars) line += (ch[row] || '     ') + ' ';
    block += line.replace(/\s+$/, '') + '\n';
  }
  ctx.outRaw('\x1b[1;36m' + block + '\x1b[0m');
  return 0;
}, 'banner [文本] — 大字显示文本(默认 WEBTERM)');

/* --- cowsay --- */

const COW = [
  '        \\   ^__^',
  '         \\  (oo)\\_______',
  '            (__)\\       )\\/\\',
  '                ||----w |',
  '                ||     ||',
].join('\n');

function cowBubble(msg) {
  const lines = msg.split('\n');
  const width = Math.max(1, ...lines.map(dispWidth));
  const top = ' ' + '_'.repeat(width + 2);
  const bottom = ' ' + '-'.repeat(width + 2);
  const body = lines.map((l, i) => {
    const pad = width - dispWidth(l);
    const left = lines.length === 1 ? '<' : (i === 0 ? '/' : (i === lines.length - 1 ? '\\' : '|'));
    const right = lines.length === 1 ? '>' : (i === 0 ? '\\' : (i === lines.length - 1 ? '/' : '|'));
    return left + ' ' + l + ' '.repeat(pad) + ' ' + right;
  }).join('\n');
  return top + '\n' + body + '\n' + bottom + '\n' + COW;
}

register('cowsay', (ctx) => {
  const msg = ctx.args.join(' ') || 'Moo!';
  ctx.outRaw(cowBubble(msg) + '\n');
  return 0;
}, 'cowsay [文本] — 让奶牛说话');

/* --- fortune 随机名言 --- */

const FORTUNES = [
  '熟能生巧。',
  '程序 = 数据结构 + 算法。 — 高德纳',
  '过早优化是万恶之源。 — Donald Knuth',
  'Talk is cheap, show me the code. — Linus Torvalds',
  '任何傻瓜都能写出计算机能理解的代码,优秀程序员写的是人能看懂的代码。 — Martin Fowler',
  '保持简单,保持愚蠢。 — Unix 哲学',
  '计算机科学只有两件难事:缓存失效和命名。 — Phil Karlton',
  '错误应该永远不可能被忽略,除非你显式地忽略它。',
  '第一行代码之前,先想清楚为什么写它。',
  'Ctrl+C 是程序员的撤销键。',
  '你的文件系统只存在于内存,刷新就没有了,记得先 cat 看看。',
  '在 WebTerminal 里,管道( | )是还没实现的梦想。',
  '人生苦短,我用 Python;终端模拟,我用 WebTerminal。',
  'Debug 的难度是写代码时的两倍,如果你写到极限,你就不可能调试它。 — Brian Kernighan',
];

register('fortune', (ctx) => {
  ctx.out(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]);
  return 0;
}, 'fortune — 随机一句名言(内置)');

/* --- matrix --- */

function runMatrix(term) {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.id = 'matrix-layer';
    layer.innerHTML = '<canvas></canvas><div id="matrix-hint">Matrix — 按任意键退出</div>';
    document.body.appendChild(layer);
    const canvas = layer.querySelector('canvas');
    const g = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    const fontSize = 16;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(0).map(() => Math.floor(Math.random() * -80));
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF$#@%';
    let raf;
    const tick = () => {
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#0f0';
      g.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        g.fillText(ch, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const cleanup = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      layer.remove();
    };
    const onKey = (e) => { e.preventDefault(); cleanup(); resolve(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
  });
}

register('matrix', async (ctx) => {
  await runMatrix(ctx.term);
  return 0;
}, 'matrix — 数字雨特效(按任意键退出)');

/* --- snake 贪吃蛇 --- */

function runSnake(term) {
  return new Promise((resolve) => {
    const COLS = 26, ROWS = 16, CELL = 22;
    const layer = document.createElement('div');
    layer.id = 'matrix-layer';
    layer.innerHTML = `<canvas></canvas><div id="matrix-hint">贪吃蛇 — 方向键移动 · Esc/Enter 退出</div>`;
    document.body.appendChild(layer);
    const canvas = layer.querySelector('canvas');
    const g = canvas.getContext('2d');
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    canvas.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)';

    let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    let dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
    let food = null, score = 0, over = false, interval = null;

    const placeFood = () => {
      let p;
      do { p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
      while (snake.some(s => s.x === p.x && s.y === p.y));
      food = p;
    };
    const draw = () => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.strokeStyle = '#0a1f0a';
      g.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, canvas.height); g.stroke(); }
      for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(canvas.width, y * CELL); g.stroke(); }
      g.fillStyle = '#0f0';
      for (const s of snake) g.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      if (food) { g.fillStyle = '#f44'; g.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4); }
      g.fillStyle = '#0f8';
      g.font = '13px monospace';
      g.fillText(`得分: ${score}`, 6, 16);
      if (over) {
        g.fillStyle = '#f44';
        g.font = 'bold 20px monospace';
        g.fillText('GAME OVER', COLS * CELL / 2 - 60, ROWS * CELL / 2);
        g.font = '13px monospace';
        g.fillText('按 Esc 退出', COLS * CELL / 2 - 38, ROWS * CELL / 2 + 24);
      }
    };
    const step = () => {
      if (over) return;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
      const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) { over = true; draw(); return; }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; placeFood(); }
      else snake.pop();
      draw();
    };
    const onKey = (e) => {
      e.preventDefault();
      const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
      const d = map[e.key];
      if (d) {
        if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d;
      } else if (e.key === 'Escape' || e.key === 'Enter') {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearInterval(interval);
      document.removeEventListener('keydown', onKey);
      layer.remove();
    };
    placeFood();
    interval = setInterval(step, 140);
    document.addEventListener('keydown', onKey);
    draw();
  });
}

register('snake', async (ctx) => {
  await runSnake(ctx.term);
  return 0;
}, 'snake — 贪吃蛇小游戏(Esc 退出)');

/* ============================================================
 * AI 命令(外接 OpenAI 兼容模型,配置见 js/ai-config.js)
 * ============================================================ */

let aiHistory = []; // 会话上下文,仅存在于内存

// 系统提示词:让模型了解 WebTerminal 终端本身,能指导用户操作
const AI_SYSTEM_PROMPT = `你是运行在 WebTerminal 终端中的 AI 助手,用户是开发者。请用中文回复,简洁、直接、准确;代码与命令示例用纯文本,不要使用 Markdown 代码块围栏,避免多余客套。

【关于 WebTerminal】
WebTerminal 是一个纯前端实现的类终端系统,完全运行在浏览器中。它的文件系统是虚拟的、只存在于内存,刷新页面即还原为初始状态,任何修改都不会影响真实电脑。

【可用命令】(输入 help 查看全部,man <命令> 查看单个命令用法)
- 导航: pwd、cd、ls [-a] [-l]、tree [-L 深度]、find [路径] -name 模式
- 文件: cat、touch、mkdir [-p]、rm [-r] [-f]、mv、cp [-r]、head/tail [-n N]、wc [-l|-w|-c]、grep [-v|-c]、echo [-n]
- 系统: clear、date、whoami、hostname、uname、uptime、history [-c]、help、man、which、ps、exit、reboot、poweroff
- 娱乐: neofetch、banner、cowsay、matrix、snake、sudo(彩蛋命令,必然失败)
- AI: ai(即本终端的外接模型;ai 查看用法,ai -r 重置上下文)

【路径与文件系统】
- 支持绝对路径(/ 开头)、相对路径,~ 表示用户主目录 /home/user;支持 . 与 ..
- 路径可用 Tab 自动补全;命令输出可用 > 写入文件、>> 追加,如 echo hello > a.txt
- echo 支持变量: $? 上次命令退出码、$USER、$HOME、$PWD、$HOSTNAME
- 预置文件: /welcome.txt(欢迎语)、/home/user/README.md(用户手册)、/home/user/notes.txt(备忘)、/home/user/hello.js(示例脚本)

【快捷键】
Tab 补全 · ↑/↓ 命令历史 · Ctrl+L 清屏 · Ctrl+C 取消当前输入 · Ctrl+A/E 光标到行首/行尾 · Ctrl+U 清空整行

【指导原则】
当用户问"这个终端怎么用""有哪些命令""怎么创建文件"之类的问题时:先给最简单的上手步骤(例如先 ls 查看目录,再 cat /home/user/README.md 阅读手册),再针对具体需求给出可直接粘贴的命令示例,用纯文本逐行展示。

【能力边界(重要)】
本终端是简化模拟,以下功能不存在,不要介绍,用户问到时直接说明"本终端不支持":
- 管道 | 与输入重定向 <(不支持将命令输出传给另一个命令)
- 实时跟踪(tail -f)、cat 从 stdin 读取(cat > file)
- cd 之外的目录栈、权限系统(无 chmod/sudo 提权)、真实网络(ping/curl/ssh)
- 参数差异:date 不能 -s 设置;支持 date +%F 等格式化;uname 支持 -a -s -n -r -v -m -o;find 支持 -name -type f|d -size +Nk/-Nk;grep 支持 -v -c -n -r;sort 支持 -r -u -n;ls 支持 -a -l -h;du 支持 -h -a;df 支持 -h;cat 支持 -n;cp 忽略 -i;hexdump 支持 -C。未列出的参数均不存在。

【严格输出规则(必须遵守)】
- 绝对不要使用 Markdown 符号:禁止代码围栏(\`\`\`)、# 标题、--- 分隔线、** 加粗、列表符号
- 一律用纯文本:先一句话说明命令/概念的用途,然后另起一行给出 1-2 行可直接粘贴的命令示例(命令本身用普通文本即可)
- 回复保持简洁:默认 5-8 行以内;用户要求详细时再展开
- 不要逐条罗列全部命令,除非用户明确要求"全部""所有"`;

register('ai', async (ctx) => {
  const args = ctx.args;

  if (args.length === 0) {
    ctx.out('');
    ctx.out(`\x1b[1;36mai\x1b[0m — 连接外部 AI 模型(\x1b[33m${AI_CONFIG.model}\x1b[0m)`);
    ctx.out('  ai <问题...>   向模型提问(流式回复)');
    ctx.out('  ai -r          重置本次会话上下文');
    ctx.out('  ai -v          查看服务器可用模型');
    ctx.out('  配置位于 js/ai-config.js(base / key / model)');
    ctx.out('');
    return 0;
  }
  if (args[0] === '-r') {
    aiHistory = [];
    ctx.out('AI 上下文已重置。');
    return 0;
  }
  if (args[0] === '-v') {
    try {
      const r = await fetch(AI_CONFIG.base + '/v1/models', {
        headers: { Authorization: 'Bearer ' + AI_CONFIG.key },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const names = (j.data || []).map(m => m.id).join('\n  ');
      ctx.out('可用模型:\n  ' + (names || '(无)'));
    } catch (e) {
      ctx.error('查询失败: ' + e.message);
      return 1;
    }
    return 0;
  }
  if (ctx.isRedirected()) {
    ctx.error('ai: 输出不支持重定向');
    return 1;
  }

  const question = args.join(' ');
  if (!aiHistory.length) {
    aiHistory.push({ role: 'system', content: AI_SYSTEM_PROMPT });
  }
  aiHistory.push({ role: 'user', content: question });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CONFIG.timeoutMs);
  let res;
  try {
    res = await fetch(AI_CONFIG.base + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + AI_CONFIG.key },
      body: JSON.stringify({ model: AI_CONFIG.model, messages: aiHistory, stream: true }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    aiHistory.pop();
    ctx.error('AI 连接失败: ' + e.message);
    return 1;
  }
  clearTimeout(timer);

  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); msg = (j.error && j.error.message) || msg; } catch (e) { /* ignore */ }
    aiHistory.pop();
    ctx.error('AI 请求失败: ' + msg);
    return 1;
  }

  ctx.term.print('AI: ');
  let answer = '';
  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let finished = false;
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while (!finished && (nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { finished = true; break; }
        try {
          const j = JSON.parse(data);
          const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (delta) {
            // 清理 Markdown 残留(代码围栏、加粗),终端里更干净
            const clean = delta.replace(/```/g, '').replace(/\*\*/g, '');
            if (clean) { answer += clean; ctx.term.printAppend(clean); }
          }
        } catch (e) { /* 跳过无法解析的 chunk */ }
      }
    }
    ctx.term.print('\n');
  } catch (e) {
    if (e.name === 'AbortError') {
      ctx.term.print('\n\x1b[31m[已超时中断]\x1b[0m');
    } else {
      ctx.term.print('\n');
      ctx.error('读取回复失败: ' + e.message);
    }
  }
  aiHistory.push({ role: 'assistant', content: answer || '(空回复)' });
  return 0;
}, 'ai <问题...> — 询问外部 AI 模型(ornith-1.0-9b);ai -r 重置上下文 · ai -v 查看模型');

// Node 环境导出(浏览器中 module 未定义,自动跳过)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COMMANDS, parseRedirect, parseCommandLine, splitArgs, expandVars, AI_CONFIG };
}
