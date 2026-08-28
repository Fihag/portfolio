/* ============================================================
 * fs.js — 虚拟文件系统
 * 内存中的树形文件系统,支持绝对/相对路径、~、. 与 ..
 * ============================================================ */

'use strict';

class VFSNode {
  constructor(name, type, content = '') {
    this.name = name;
    this.type = type;            // 'dir' | 'file'
    this.content = content;      // 文件内容;目录为空串
    this.mtime = Date.now();     // 最后修改时间
    this.children = {};          // name -> VFSNode(仅目录)
  }

  get isDir() { return this.type === 'dir'; }
  get isFile() { return this.type === 'file'; }

  // 返回格式化后的修改时间,如 "2025-01-12 09:30"
  mtimeStr() {
    const d = new Date(this.mtime);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

class VFS {
  constructor() {
    this.root = new VFSNode('/', 'dir');
    this.cwd = '/';
    this.home = '/home/user';
  }

  /* ---------- 路径工具 ---------- */

  // 把 ~、.、.. 与重复斜杠规范化,返回绝对路径(不以 / 结尾,根为 "/")
  normalize(path) {
    if (typeof path !== 'string' || path === '') path = '.';
    let p = path;
    if (p === '~') p = this.home;
    else if (p.startsWith('~/')) p = this.home + p.slice(1);
    else if (!p.startsWith('/')) p = (this.cwd === '/' ? '/' : this.cwd + '/') + p;

    const parts = [];
    for (const seg of p.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') { parts.pop(); continue; }
      parts.push(seg);
    }
    const out = '/' + parts.join('/');
    return out === '' ? '/' : out;
  }

  // 路径 -> {node, parent, name}。parent/name 用于创建与删除。
  // 若中间环节缺失,返回 null。
  lookup(path) {
    const norm = this.normalize(path);
    if (norm === '/') return { node: this.root, parent: null, name: '' };
    const parts = norm.slice(1).split('/');
    const name = parts[parts.length - 1];
    let node = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      const child = node.children[parts[i]];
      if (!child || !child.isDir) return null;
      node = child;
    }
    return { node: node.children[name] || null, parent: node, name };
  }

  /* ---------- 查询 ---------- */

  exists(path) {
    const r = this.lookup(path);
    return r && r.node !== null;
  }

  isDir(path) {
    const r = this.lookup(path);
    return r && r.node && r.node.isDir;
  }

  isFile(path) {
    const r = this.lookup(path);
    return r && r.node && r.node.isFile;
  }

  get(path) {
    const r = this.lookup(path);
    return r ? r.node : null;
  }

  // 列出目录下条目,返回 {name, node} 列表(排序:目录优先,再按名称)
  listDir(path) {
    const dir = this.get(path);
    if (!dir || !dir.isDir) return null;
    const items = Object.values(dir.children).map(n => ({ name: n.name, node: n }));
    items.sort((a, b) => {
      if (a.node.isDir !== b.node.isDir) return a.node.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });
    return items;
  }

  /* ---------- 修改 ---------- */

  mkdir(path) {
    const r = this.lookup(path);
    if (!r) return { ok: false, err: `mkdir: 无法创建目录 '${path}': 路径中的目录不存在` };
    if (r.node) return { ok: false, err: `mkdir: 无法创建目录 '${path}': 文件已存在` };
    r.parent.children[r.name] = new VFSNode(r.name, 'dir');
    return { ok: true };
  }

  mkdirRecursive(path) {
    // 逐级创建
    const parts = this.normalize(path).slice(1).split('/').filter(Boolean);
    let node = this.root;
    for (const seg of parts) {
      if (!node.children[seg]) node.children[seg] = new VFSNode(seg, 'dir');
      node = node.children[seg];
      if (!node.isDir) return { ok: false, err: `mkdir: 无法创建目录 '${path}': '${seg}' 不是目录` };
    }
    return { ok: true };
  }

  writeFile(path, content = '') {
    const r = this.lookup(path);
    if (!r) return { ok: false, err: `touch: 无法创建 '${path}': 路径中的目录不存在` };
    if (r.node) {
      if (r.node.isDir) return { ok: false, err: `写入失败: '${path}' 是目录` };
      r.node.content = content;
      r.node.mtime = Date.now();
    } else {
      r.parent.children[r.name] = new VFSNode(r.name, 'file', content);
    }
    return { ok: true };
  }

  remove(path) {
    const r = this.lookup(path);
    if (!r || !r.node) return { ok: false, err: `rm: 无法删除 '${path}': 没有那个文件或目录` };
    if (r.parent) delete r.parent.children[r.name];
    else return { ok: false, err: `rm: 无法删除根目录` };
    return { ok: true };
  }

  rename(from, to) {
    const src = this.lookup(from);
    if (!src || !src.node) return { ok: false, err: `mv: 无法重命名 '${from}': 没有那个文件或目录` };
    const dst = this.lookup(to);
    if (dst && dst.node) return { ok: false, err: `mv: 目标 '${to}' 已存在` };
    if (!dst || !dst.parent) return { ok: false, err: `mv: 无法移动 '${from}': 非法目标` };

    const node = src.node;
    delete src.parent.children[src.name];
    dst.parent.children[dst.name] = node;
    node.name = dst.name;
    return { ok: true };
  }
}

// Node 环境导出(浏览器中 module 未定义,自动跳过)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VFS, VFSNode };
}
