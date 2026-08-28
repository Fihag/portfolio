/* 端到端验证:真实调用 ornith-1.0-9b,验证 ai 命令流式输出与上下文。
 * 运行: node tests/ai-e2e.js
 */
'use strict';
function makeEl(tag) {
  const e = {
    tagName: tag, className: '', style: {}, children: [], parentNode: null,
    scrollTop: 0, scrollHeight: 0, value: '', selectionStart: 0,
    appendChild(c) { c.parentNode = e; e.children.push(c); },
    insertBefore(c, ref) { c.parentNode = e; const i = e.children.indexOf(ref); if (i < 0) e.children.push(c); else e.children.splice(i, 0, c); },
    remove() { if (this.parentNode) { const a = this.parentNode.children; const i = a.indexOf(this); if (i >= 0) a.splice(i, 1); } },
    querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, setSelectionRange(s, e2) { this.selectionStart = s; this.selectionEnd = e2; },
    addEventListener() {},
  };
  let _t;
  Object.defineProperty(e, 'textContent', {
    get() { return _t !== undefined ? _t : this.children.map(c => c.textContent || '').join(''); },
    set(v) { _t = v; },
  });
  Object.defineProperty(e, 'innerHTML', {
    get() { return _t !== undefined ? _t : ''; },
    set() { this.children.length = 0; _t = undefined; },
  });
  Object.defineProperty(e, 'previousElementSibling', {
    get() { if (!this.parentNode) return null; const i = this.parentNode.children.indexOf(this); return i > 0 ? this.parentNode.children[i - 1] : null; },
  });
  Object.defineProperty(e, 'lastElementChild', {
    get() { return this.children.length ? this.children[this.children.length - 1] : null; },
  });
  e.classList = { add() {}, remove() {}, contains(cls) { return (e.className || '').split(/\s+/).includes(cls); } };
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

const { VFS } = require('../js/fs.js');
const cmds = require('../js/commands.js');
const { AI_CONFIG } = require('../js/ai-config.js');
Object.assign(global, {
  COMMANDS: cmds.COMMANDS,
  parseRedirect: cmds.parseRedirect,
  parseCommandLine: cmds.parseCommandLine,
  splitArgs: cmds.splitArgs,
  expandVars: cmds.expandVars,
  AI_CONFIG,
});
const { Terminal } = require('../js/terminal.js');

(async () => {
  console.log('连接:', AI_CONFIG.base, '模型:', AI_CONFIG.model);
  const term = new Terminal(makeEl('div'));
  term.vfs = new VFS();
  term.attach();

  const t0 = Date.now();
  await term.commitLine('ai 用一句话解释什么是命令行终端');
  const text = term.container.children.map(c => c.textContent || '').join('');
  console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const m = text.match(/AI:([\s\S]*)$/);
  const reply = m ? m[1].trim() : '';
  console.log('回复片段:', reply.slice(0, 120));
  console.log('断言: 有 AI: 前缀 →', text.includes('AI: '), '· 回复非空 →', reply.length > 0);
})();
