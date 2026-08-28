/* ============================================================
 * terminal.js — 终端核心
 * 渲染输出、捕获输入(隐藏 textarea 锚点,兼容输入法/移动端)、
 * 命令历史、Tab 补全、ANSI 颜色解析、Ctrl 快捷键
 * ============================================================ */

'use strict';

/* ---------- ANSI -> DOM ---------- */

const ANSI_RE = /\x1b\[([0-9;]*)m/g;

// 把含 ANSI 颜色码的文本追加到 parent(以 span 包裹)
function appendAnsi(parent, text) {
  const classes = new Set();
  let span = null;
  const flush = () => {
    if (span) { parent.appendChild(span); span = null; }
  };
  const ensure = () => {
    if (!span) {
      span = document.createElement('span');
      if (classes.size) span.className = [...classes].join(' ');
    }
  };
  const add = (s) => { ensure(); span.textContent += s; };

  let last = 0;
  let m;
  while ((m = ANSI_RE.exec(text))) {
    if (m.index > last) add(text.slice(last, m.index));
    const codes = m[1] ? m[1].split(';') : ['0'];
    for (const c of codes) {
      if (c === '0') classes.clear();
      else if (c === '1') classes.add('a-1');
      else if (c === '4') classes.add('a-4');
      else if (/^3[0-7]$/.test(c) || /^9[0-7]$/.test(c)) {
        for (const x of [...classes]) if (/^a-[39][0-7]$/.test(x)) classes.delete(x);
        classes.add('a-' + c);
      } else if (c === '39') {
        for (const x of [...classes]) if (/^a-[39][0-7]$/.test(x)) classes.delete(x);
      }
    }
    flush(); // 颜色变化后从新 span 开始
    last = m.index + m[0].length;
  }
  if (last < text.length) add(text.slice(last));
  flush();
}

/* ---------- Terminal ---------- */

class Terminal {
  constructor(container) {
    this.container = container;
    this.vfs = null;            // 由 main.js 注入
    this.cwd = '/';

    this.history = [];
    this.histIndex = 0;
    this.bootTime = Date.now();
    this.lastExit = 0;

    this.inputEl = null;        // 当前输入行 DOM
    this.hiddenInput = null;    // 隐藏 textarea
    this.matrixHandler = null;  // matrix 模式的按键接管
    this.buffer = '';           // 当前输入内容
    this.cursorPos = 0;         // 光标位置
    this.env = {};              // 自定义环境变量(export 设置)
    this.prevCwd = null;        // cd - 用的上次目录
  }

  /* ---------- 生命周期 ---------- */

  attach() {
    this.hiddenInput = document.getElementById('hidden-input');
    this.hiddenInput.addEventListener('input', () => this.syncFromInput());
    this.hiddenInput.addEventListener('keydown', (e) => this.handleKeyDown(e));

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#matrix-layer')) this.focus();
    });
    // 移动端软键盘唤起后保持滚动到底
    window.addEventListener('resize', () => this.scrollToBottom());
    this.focus();
  }

  focus() {
    this.hiddenInput.focus({ preventScroll: true });
  }

  /* ---------- 提示符 ---------- */

  updateToolbar() {
    const title = document.querySelector('#toolbar .title');
    if (title) title.textContent = `user@webterm: ${this.cwd === this.vfs.home ? '~' : this.cwd}`;
  }

  promptStr() {
    const home = this.vfs.home;
    let p = this.cwd;
    if (p === home) p = '~';
    else if (p.startsWith(home + '/')) p = '~' + p.slice(home.length);
    return `\x1b[32muser@webterm\x1b[0m:\x1b[34m${p}\x1b[0m$ `;
  }

  /* ---------- 输出 ---------- */

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  print(text, cls) {
    const line = document.createElement('div');
    line.className = 'out-line' + (cls ? ' ' + cls : '');
    appendAnsi(line, text);
    if (this.inputEl) this.container.insertBefore(line, this.inputEl);
    else this.container.appendChild(line);
    this.scrollToBottom();
  }

  printLine(text, cls) { this.print(text + '\n', cls); }

  // 追加文本到当前最后一个输出行(用于 AI 流式输出);若无输出行则新建
  printAppend(text) {
    const target = this.inputEl ? this.inputEl.previousElementSibling : this.container.lastElementChild;
    if (target && target.classList.contains('out-line')) {
      appendAnsi(target, text);
    } else {
      this.print(text);
    }
    this.scrollToBottom();
  }

  /* ---------- 输入行渲染 ---------- */

  renderInput() {
    if (!this.inputEl || !this.inputEl.parentNode) {
      this.inputEl = document.createElement('div');
      this.inputEl.className = 'in-line';
      this.container.appendChild(this.inputEl);
    }
    this.inputEl.innerHTML = '';

    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    appendAnsi(prompt, this.promptStr());

    const buf = document.createElement('span');
    buf.className = 'input-buffer';
    const before = this.buffer.slice(0, this.cursorPos);
    const after = this.buffer.slice(this.cursorPos);
    if (before) buf.appendChild(document.createTextNode(before));
    const cur = document.createElement('span');
    cur.className = 'cursor';
    buf.appendChild(cur);
    if (after) buf.appendChild(document.createTextNode(after));

    this.inputEl.appendChild(prompt);
    this.inputEl.appendChild(buf);
    this.updateToolbar();
    this.scrollToBottom();
  }

  // 隐藏 textarea -> 显示层同步
  syncFromInput() {
    const H = this.hiddenInput;
    this.buffer = H.value;
    this.cursorPos = (H.selectionStart != null) ? H.selectionStart : H.value.length;
    this.clampCaret();
    this.renderInput();
  }

  // 光标位置钳制在 buffer 范围内(防止 selection 残留导致的错位)
  clampCaret() {
    if (this.cursorPos < 0) this.cursorPos = 0;
    if (this.cursorPos > this.buffer.length) this.cursorPos = this.buffer.length;
  }

  /* ---------- 按键处理 ---------- */

  handleKeyDown(e) {
    if (this.matrixHandler) { e.preventDefault(); this.matrixHandler(e); return; }

    const H = this.hiddenInput;
    const k = e.key;

    // 输入法组合期间:交给 textarea/IME,不手动处理
    if (e.isComposing || e.keyCode === 229) return;

    if (k === 'Enter') {
      e.preventDefault();
      const line = this.buffer;
      this.buffer = '';
      this.cursorPos = 0;
      H.value = '';
      this.commitLine(line);
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      this.complete();
      return;
    }
    // Ctrl 组合键用 e.code 判断,避免输入法/键盘布局下 e.key 失真
    if (e.ctrlKey && e.code === 'KeyL') { e.preventDefault(); this.clear(); return; }
    if (e.ctrlKey && e.code === 'KeyC') { e.preventDefault(); this.cancelLine(); return; }
    if (e.ctrlKey && e.code === 'KeyU') { e.preventDefault(); this.clearLine(); return; }
    if (e.ctrlKey && e.code === 'KeyA') { e.preventDefault(); this.setSel(0); return; }
    if (e.ctrlKey && e.code === 'KeyE') { e.preventDefault(); this.setSel(H.value.length); return; }
    if (k === 'ArrowUp')   { e.preventDefault(); this.hist(-1); return; }
    if (k === 'ArrowDown') { e.preventDefault(); this.hist(1); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); this.moveCursor(-1); return; }
    if (k === 'ArrowRight'){ e.preventDefault(); this.moveCursor(1); return; }
    if (k === 'Home') { e.preventDefault(); this.setSel(0); return; }
    if (k === 'End')  { e.preventDefault(); this.setSel(H.value.length); return; }
    // Backspace / Delete:手动删除,不依赖浏览器默认行为
    if (k === 'Backspace') { e.preventDefault(); this.deleteBefore(); return; }
    if (k === 'Delete')    { e.preventDefault(); this.deleteAfter(); return; }
    // 其它组合键(如 Ctrl+R 刷新)交给浏览器
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // 普通字符:手动插入 buffer
    if (k.length === 1) {
      e.preventDefault();
      this.insertText(k);
      return;
    }
    // 其余(移动端软键盘等)交给 textarea,input 事件兜底同步
  }

  /* ---------- 手动文本编辑(不依赖 textarea 默认行为) ---------- */

  // buffer/光标同步回隐藏 textarea
  syncTextarea() {
    const H = this.hiddenInput;
    H.value = this.buffer;
    this.clampCaret();
    H.setSelectionRange(this.cursorPos, this.cursorPos);
  }

  // 在光标处插入文本(物理键盘字符键与 IME 提交共用)
  insertText(text) {
    this.clampCaret();
    const pos = this.cursorPos;
    this.buffer = this.buffer.slice(0, pos) + text + this.buffer.slice(pos);
    this.cursorPos = pos + text.length;
    this.syncTextarea();
    this.renderInput();
  }

  // 删除光标前一个字符;有选区则删除选区
  deleteBefore() {
    const H = this.hiddenInput;
    const s = H.selectionStart, e = H.selectionEnd;
    if (s !== e) { this.deleteRange(s, e); return; }
    this.clampCaret();
    if (this.cursorPos <= 0) return;
    this.buffer = this.buffer.slice(0, this.cursorPos - 1) + this.buffer.slice(this.cursorPos);
    this.cursorPos--;
    this.syncTextarea();
    this.renderInput();
  }

  // 删除光标后一个字符;有选区则删除选区
  deleteAfter() {
    const H = this.hiddenInput;
    const s = H.selectionStart, e = H.selectionEnd;
    if (s !== e) { this.deleteRange(s, e); return; }
    this.clampCaret();
    if (this.cursorPos >= this.buffer.length) return;
    this.buffer = this.buffer.slice(0, this.cursorPos) + this.buffer.slice(this.cursorPos + 1);
    this.syncTextarea();
    this.renderInput();
  }

  deleteRange(start, end) {
    start = Math.max(0, start);
    end = Math.min(this.buffer.length, Math.max(start, end));
    this.buffer = this.buffer.slice(0, start) + this.buffer.slice(end);
    this.cursorPos = start;
    this.syncTextarea();
    this.renderInput();
  }

  // 清空整行(Ctrl+U)
  clearLine() {
    this.buffer = '';
    this.cursorPos = 0;
    this.syncTextarea();
    this.renderInput();
  }

  setSel(pos) {
    const H = this.hiddenInput;
    H.setSelectionRange(pos, pos);
    this.syncFromInput();
  }

  moveCursor(d) {
    const H = this.hiddenInput;
    let p = ((H.selectionStart != null) ? H.selectionStart : H.value.length) + d;
    if (p < 0) p = 0;
    if (p > H.value.length) p = H.value.length;
    H.setSelectionRange(p, p);
    this.syncFromInput();
  }

  /* ---------- 历史 ---------- */

  hist(dir) {
    const H = this.hiddenInput;
    if (dir < 0) {
      if (this.histIndex > 0) {
        this.histIndex--;
        H.value = this.history[this.histIndex];
      }
    } else {
      if (this.histIndex < this.history.length) {
        this.histIndex++;
        H.value = this.histIndex < this.history.length ? this.history[this.histIndex] : '';
      }
    }
    H.setSelectionRange(H.value.length, H.value.length);
    this.syncFromInput();
  }

  /* ---------- 提交 / 取消 / 清屏 ---------- */

  // 输入行转为历史输出行,执行命令
  async commitLine(line) {
    if (!this.inputEl) this.renderInput();
    const il = this.inputEl;
    il.classList.remove('in-line');
    il.classList.add('out-line');
    const cur = il.querySelector('.cursor');
    if (cur) cur.remove();
    this.inputEl = null;
    this.renderInput();               // 先立新输入行,命令输出插在其前
    await this.runCommand(line);
  }

  cancelLine() {
    if (!this.inputEl) this.renderInput();
    const H = this.hiddenInput;
    const il = this.inputEl;
    il.classList.remove('in-line');
    const cur = il.querySelector('.cursor');
    if (cur) cur.remove();
    const c = document.createElement('span');
    c.className = 'dim';
    c.textContent = '^C';
    il.appendChild(c);
    H.value = '';
    this.buffer = '';
    this.cursorPos = 0;
    this.inputEl = null;
    this.renderInput();
    this.focus();
  }

  clear() {
    this.container.innerHTML = '';
    this.inputEl = null;
    this.renderInput();
  }

  /* ---------- Tab 补全 ---------- */

  complete() {
    const H = this.hiddenInput;
    const text = H.value;
    const pos = (H.selectionStart != null) ? H.selectionStart : text.length;
    const before = text.slice(0, pos);
    const after = text.slice(pos);

    // 光标前的最后一个词
    const m = before.match(/(^|\s)(\S*)$/);
    if (!m) return;
    const token = m[2];
    const start = pos - token.length;
    const isFirstWord = before.slice(0, start).trim() === '';

    let done = false;
    if (isFirstWord) {
      // 命令补全
      const names = Object.keys(COMMANDS).filter(n => n.startsWith(token));
      if (names.length === 1) {
        this.replaceToken(text, pos, start, token, names[0]);
        done = true;
      } else if (names.length > 1) {
        this.print(names.map(n => `\x1b[32m${n}\x1b[0m`).join('  ') + '\n');
        this.renderInput();
        done = true;
      }
    }
    if (done) return;

    // 路径补全:token 为空(如 "cat /tmp/" 后按 Tab)时,回退取最后一个词
    if (token === '') {
      const m2 = before.match(/(^|\s)(\S+)$/);
      if (m2) { token = m2[2]; start = pos - token.length; }
    }

    // 路径补全
    const r = this.completePath(token);
    if (!r) return;
    const { candidates, replaceText } = r;
    if (candidates.length === 1) {
      this.replaceToken(text, pos, start, token, replaceText);
    } else if (candidates.length > 1) {
      this.print(candidates.join('  ') + '\n');
      this.renderInput();
    }
  }

  replaceToken(text, pos, start, token, newToken) {
    const H = this.hiddenInput;
    H.value = text.slice(0, start) + newToken + text.slice(pos);
    H.setSelectionRange(start + newToken.length, start + newToken.length);
    this.syncFromInput();
  }

  // 路径补全。返回 {candidates: 显示列表, replaceText: 用于替换的文本}
  completePath(token) {
    const fs = this.vfs;
    if (token === '') return null;

    // 展开 ~
    let t = token;
    let tilde = '';
    if (t === '~') { t = fs.home; tilde = '~'; }
    else if (t.startsWith('~/')) { t = fs.home + t.slice(1); tilde = '~'; }

    const idx = t.lastIndexOf('/');
    let dirPart, prefix;
    if (idx >= 0) {
      dirPart = t.slice(0, idx + 1);
      prefix = t.slice(idx + 1);
    } else {
      dirPart = '';
      prefix = t;
    }
    // 若输入里有 ~,前缀替换时也要带 ~ 显示
    const dirShow = tilde ? ('~' + dirPart.slice(fs.home.length)) : dirPart;

    let dirPath;
    if (dirPart === '') dirPath = fs.normalize('.');
    else dirPath = fs.normalize(dirPart);

    const dir = fs.get(dirPath);
    if (!dir || !dir.isDir) return null;
    const items = fs.listDir(dirPath);
    const matches = items.filter(i => i.name.startsWith(prefix));

    const display = matches.map(i => {
      const d = i.node.isDir ? '\x1b[34m' + i.name + '/\x1b[0m' : i.name;
      return dirShow + d;
    });
    const replaceText = matches.length === 1
      ? dirShow + matches[0].name + (matches[0].node.isDir ? '/' : '')
      : null;
    return { candidates: display, replaceText };
  }

  /* ---------- 命令执行 ---------- */

  async runCommand(raw) {
    const fs = this.vfs;
    fs.cwd = this.cwd;
    const line = raw.trim();
    if (line) {
      this.history.push(line);
      if (this.history.length > 500) this.history.shift();
    }
    this.histIndex = this.history.length;
    if (!line) return;

    const { command, stdoutFile, append } = parseRedirect(line);
    const { name, args } = parseCommandLine(command);
    const cmd = COMMANDS[name];

    const term = this;
    let out = '';
    const ctx = {
      fs, term,
      cwd: this.cwd,
      args,
      // 追加一行输出(自动换行)
      out: (s) => { out += s + '\n'; },
      // 原样追加(不换行)
      outRaw: (s) => { out += s; },
      // 错误直接上屏(不走重定向)
      error: (s) => term.print(s + '\n', 'error'),
      setCwd: (p) => { term.cwd = p; fs.cwd = p; },
      isRedirected: () => !!stdoutFile,
    };

    if (!cmd) {
      term.print(`bash: ${name}: command not found\n`, 'error');
      return;
    }
    try {
      const exit = await cmd.fn(ctx);
      term.lastExit = (typeof exit === 'number') ? exit : 0;
      if (stdoutFile) {
        const base = (() => {
          const old = fs.get(stdoutFile);
          return (old && old.isFile) ? old.content : '';
        })();
        const write = append ? base + out : out;
        const r = fs.writeFile(stdoutFile, write);
        if (!r.ok) term.print(r.err + '\n', 'error');
      } else if (out) {
        term.print(out);
      }
    } catch (e) {
      term.print(`内部错误: ${e.message}\n`, 'error');
    }
  }
}

// Node 环境导出(浏览器中 module 未定义,自动跳过)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Terminal, appendAnsi, ANSI_RE };
}
