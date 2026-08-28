/* 终端层测试:用极简 DOM stub 加载 terminal.js,验证渲染/补全/命令执行链路。
 * 运行: node tests/terminal-test.js
 */
'use strict';

/* ---------- 极简 DOM stub ---------- */
function makeEl(tag) {
  const e = {
    tagName: tag,
    className: '',
    style: {},
    children: [],
    parentNode: null,
    scrollTop: 0,
    scrollHeight: 0,
    value: '',
    selectionStart: 0,
    appendChild(c) { c.parentNode = e; e.children.push(c); },
    insertBefore(c, ref) {
      c.parentNode = e;
      const i = e.children.indexOf(ref);
      if (i < 0) e.children.push(c); else e.children.splice(i, 0, c);
    },
    remove() {
      if (this.parentNode) {
        const a = this.parentNode.children;
        const i = a.indexOf(this);
        if (i >= 0) a.splice(i, 1);
      }
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    setSelectionRange(s, e2) { this.selectionStart = s; this.selectionEnd = e2; },
    addEventListener() {},
  };
  // classList:基于 className 字符串做 contains(近似真实 DOM)
  e.classList = {
    add() {},
    remove() {},
    contains(cls) { return (e.className || '').split(/\s+/).includes(cls); },
  };
  // 兄弟/末子元素(近似真实 DOM)
  Object.defineProperty(e, 'previousElementSibling', {
    get() {
      if (!this.parentNode) return null;
      const i = this.parentNode.children.indexOf(this);
      return i > 0 ? this.parentNode.children[i - 1] : null;
    },
  });
  Object.defineProperty(e, 'lastElementChild', {
    get() { return this.children.length ? this.children[this.children.length - 1] : null; },
  });
  // textContent:有直接赋值则用,否则聚合子节点
  let _text;
  Object.defineProperty(e, 'textContent', {
    get() { return _text !== undefined ? _text : this.children.map(c => c.textContent || '').join(''); },
    set(v) { _text = v; },
  });
  // innerHTML 赋值时清空子节点(近似真实 DOM)
  Object.defineProperty(e, 'innerHTML', {
    get() { return _text !== undefined ? _text : ''; },
    set() { this.children.length = 0; _text = undefined; },
  });
  return e;
}
global.document = {
  createElement: (t) => makeEl(t),
  createTextNode: (s) => ({ textContent: s, nodeType: 3 }),
  getElementById: () => makeEl('div'),
  querySelector: () => null,
  addEventListener() {},
  body: makeEl('body'),
};
global.window = { innerWidth: 1280, addEventListener() {} };

/* ---------- 加载模块 ---------- */
const { VFS } = require('../js/fs.js');
const cmds = require('../js/commands.js');
const { AI_CONFIG } = require('../js/ai-config.js');
// 模拟浏览器 <script> 全局加载顺序
Object.assign(global, {
  COMMANDS: cmds.COMMANDS,
  parseRedirect: cmds.parseRedirect,
  parseCommandLine: cmds.parseCommandLine,
  splitArgs: cmds.splitArgs,
  expandVars: cmds.expandVars,
  AI_CONFIG,
});
const { Terminal, appendAnsi } = require('../js/terminal.js');

let failures = 0, passed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✔ ' + msg); }
  else { failures++; console.error('  ✘ FAIL: ' + msg); }
}

async function main() {
  const fs = new VFS();
  for (const d of ['/etc', '/home', '/home/user', '/tmp']) fs.mkdir(d);
  fs.writeFile('/tmp/hello.txt', 'hi\n');

  const container = makeEl('div');
  const term = new Terminal(container);
  term.vfs = fs;
  term.attach();

  console.log('== 命令执行链路 ==');
  await term.commitLine('pwd');
  assert(container.children.length >= 2, 'commitLine 后容器有输出行');
  const outText = () => container.children.map(c => c.textContent || '').join('');
  assert(outText().includes('/'), 'pwd 输出渲染到容器');

  await term.commitLine('cd /tmp');
  assert(term.cwd === '/tmp', 'cd 更新 term.cwd');
  await term.commitLine('ls');
  assert(outText().includes('hello.txt'), 'ls 输出包含文件');

  await term.commitLine('cat hello.txt');
  assert(outText().includes('hi'), 'cat 输出文件内容');
  assert(term.history.length === 4, '历史记录 4 条命令');

  console.log('== ANSI 解析 ==');
  const spanHost = makeEl('span');
  appendAnsi(spanHost, '\x1b[32muser\x1b[0m@\x1b[34mwebterm\x1b[0m');
  const spans = spanHost.children;
  assert(spans.length >= 3, 'appendAnsi 生成彩色 span');
  assert(spans[0].className.includes('a-32'), '第一个 span 有绿色类');
  assert(spans[0].textContent === 'user', 'span 内容正确');
  assert(spans[2].className.includes('a-34'), '第三段为蓝色');
  const plain = makeEl('span');
  appendAnsi(plain, 'no escape here');
  assert(plain.children.length === 1 && plain.textContent === 'no escape here', '无 ANSI 时保持原文');

  console.log('== Tab 补全(命令) ==');
  const H = term.hiddenInput;
  H.value = 'ech';
  H.selectionStart = 3;
  term.complete();
  assert(H.value === 'echo', '命令补全 echo');
  assert(H.selectionStart === 4, '补全后光标在末尾');

  console.log('== Tab 补全(路径) ==');
  H.value = 'cat /tmp/he';
  H.selectionStart = H.value.length;
  term.complete();
  assert(H.value === 'cat /tmp/hello.txt', '路径补全完整文件');

  H.value = 'cd /e';
  H.selectionStart = H.value.length;
  term.complete();
  assert(H.value === 'cd /etc/', '目录补全带尾斜杠');

  console.log('== Tab 补全(空 token 唯一候选) ==');
  H.value = 'cat /tmp/';
  H.selectionStart = H.value.length;
  term.complete();
  assert(H.value === 'cat /tmp/hello.txt', '空 token 唯一候选自动补全');

  console.log('== 多候选不破坏输入 ==');
  await term.commitLine('mkdir /tmp/aa');
  await term.commitLine('mkdir /tmp/ab');
  H.value = 'cat /tmp/a';
  H.selectionStart = H.value.length;
  term.complete();
  assert(H.value === 'cat /tmp/a', '多候选时不修改输入');
  const multi = container.children.map(c => c.textContent || '').join('');
  assert(multi.includes('aa/') && multi.includes('ab/'), '多候选打印列表');

  console.log('== 按键编辑(手动 buffer 管理) ==');
  const key = (k, opts = {}) => {
    const e = {
      key: k, code: opts.code || '', ctrlKey: !!opts.ctrl, altKey: false, metaKey: false,
      isComposing: !!opts.composing, keyCode: opts.keyCode || 0,
      preventDefault() { e.defaultPrevented = true; },
    };
    term.handleKeyDown(e);
  };
  H.value = '';
  term.syncFromInput();
  for (const ch of ['h', 'e', 'l', 'l', 'o']) key(ch, { code: 'Key' + ch.toUpperCase() });
  assert(H.value === 'hello' && term.buffer === 'hello', '字符键逐个插入 hello');
  key('Backspace', { code: 'Backspace' });
  assert(H.value === 'hell' && term.buffer === 'hell', 'Backspace 删除末尾字符');
  term.setSel(0);
  key('Backspace', { code: 'Backspace' });
  assert(H.value === 'hell', '行首 Backspace 无操作(不误删)');
  term.setSel(2);
  key('Backspace', { code: 'Backspace' });
  assert(H.value === 'hll', '行中 Backspace 删除光标前字符');
  term.setSel(3);
  key('a', { code: 'KeyA', ctrl: true });
  assert(H.value === 'hll' && H.selectionStart === 0, 'Ctrl+A 光标到行首且文字保留');
  key('e', { code: 'KeyE', ctrl: true });
  assert(H.selectionStart === 3, 'Ctrl+E 光标到行尾');
  key('z', { code: 'KeyZ', composing: true });
  assert(H.value === 'hll', 'IME 组合期间不手动插入');
  term.setSel(0);
  key('Delete', { code: 'Delete' });
  assert(H.value === 'll', 'Delete 删除光标后字符');
  H.setSelectionRange(0, 2);
  key('Backspace', { code: 'Backspace' });
  assert(H.value === '', 'Backspace 删除选区');
  key('x', { code: 'KeyX' });
  key('y', { code: 'KeyY' });
  assert(H.value === 'xy', '继续插入 xy');
  key('u', { code: 'KeyU', ctrl: true });
  assert(H.value === '' && term.cursorPos === 0, 'Ctrl+U 清空整行');

  console.log('== ai 命令(mock fetch) ==');
  const aiCalls = [];
  const encoder = new TextEncoder();
  const sseBody = 'data: {"choices":[{"delta":{"content":"**你**"}}]}\n\ndata: {"choices":[{"delta":{"content":"```好"}}]}\n\ndata: [DONE]\n\n';
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    aiCalls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    if (opts && opts.body) return { ok: true, status: 200, json: async () => ({}), body: { getReader: () => new ReadableStream({ start(c) { c.enqueue(encoder.encode(sseBody)); c.close(); } }).getReader() } };
    return { ok: true, status: 200, json: async () => ({ data: [{ id: AI_CONFIG.model }] }), body: null };
  };
  try {
    await term.commitLine('ai');
    assert(container.children.map(c => c.textContent || '').join('').includes('ai <问题'), 'ai 无参数显示帮助');

    await term.commitLine('ai 你好');
    assert(aiCalls.length === 1, '提问发起一次请求');
    assert(aiCalls[0].url.includes('/v1/chat/completions'), '请求指向 chat/completions');
    assert(aiCalls[0].body.model === AI_CONFIG.model, '请求使用配置的模型名');
    assert(aiCalls[0].body.stream === true, '请求开启流式');
    assert(aiCalls[0].headers.Authorization.includes(AI_CONFIG.key), '请求携带 API Key');
    const sysPrompt = aiCalls[0].body.messages[0].content;
    assert(sysPrompt.includes('WebTerminal'), 'system prompt 介绍终端');
    assert(sysPrompt.includes('ls') && sysPrompt.includes('cat'), 'system prompt 含常用命令');
    assert(sysPrompt.includes('Ctrl+L'), 'system prompt 含快捷键说明');
    assert(sysPrompt.includes('/home/user/README.md'), 'system prompt 含预置文件指引');
    assert(sysPrompt.includes('能力边界') && sysPrompt.includes('管道'), 'system prompt 说明能力边界');
    assert(sysPrompt.includes('严格输出规则'), 'system prompt 含输出规则');
    const aiOut = container.children.map(c => c.textContent || '').join('');
    assert(aiOut.includes('AI: 你好'), '流式回复渲染为 AI: 你好(清理 Markdown 后)');
    assert(!aiOut.includes('```') && !aiOut.includes('**'), '输出已清理代码围栏与加粗');

    await term.commitLine('ai 第二个问题');
    assert(aiCalls.length === 2, '再次提问发起第二次请求');
    assert(aiCalls[1].body.messages.length === 4, '上下文累积(system+2轮问答)');
    assert(aiCalls[1].body.messages[3].role === 'user' && aiCalls[1].body.messages[3].content === '第二个问题', '新问题入上下文');

    await term.commitLine('ai -r');
    await term.commitLine('ai 重置后的问题');
    assert(aiCalls[2].body.messages.length === 2, 'ai -r 重置后上下文仅 system+新问题');

    // 失败场景:HTTP 错误回滚上下文
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'boom' } }), body: null });
    await term.commitLine('ai 这句会失败');
    assert(container.children.map(c => c.textContent || '').join('').includes('AI 请求失败: boom'), 'HTTP 错误提示');
    global.fetch = async (url, opts) => {
      aiCalls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
      return { ok: true, status: 200, json: async () => ({}), body: { getReader: () => new ReadableStream({ start(c) { c.enqueue(encoder.encode(sseBody)); c.close(); } }).getReader() } };
    };
    await term.commitLine('ai 失败后的新问题');
    assert(aiCalls[3].body.messages.length === 4, '失败提问已从上下文回滚(仍 4 条)');
  } finally {
    global.fetch = origFetch;
  }

  console.log('== Ctrl+C 取消 ==');
  const histLen = term.history.length;
  H.value = 'rm -rf /';
  H.selectionStart = H.value.length;
  term.cancelLine();
  assert(H.value === '', '取消后输入清空');
  assert(term.history.length === histLen, '被取消的命令不入历史');

  console.log('== clear ==');
  const before = container.children.length;
  term.clear();
  assert(container.children.length <= before, 'clear 后容器元素减少');

  console.log('');
  console.log(`结果: ${passed} 通过, ${failures} 失败`);
  if (failures) { console.error('✘ 有失败项'); process.exit(1); }
  console.log('✔ 全部通过');
}

main().catch(e => { console.error('测试崩溃:', e); process.exit(1); });
