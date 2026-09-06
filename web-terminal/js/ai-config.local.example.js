/* 本地覆盖模板:复制为 ai-config.local.js 后填写真实地址/key(该文件不进 git)
 * index.html 会在 ai-config.js 之后加载它,直接覆盖 window.AI_CONFIG。
 * 注意:不要把真实 key 提交到 git。 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  window.AI_CONFIG = Object.assign({}, window.AI_CONFIG, {
    base: 'http://127.0.0.1:1234',
    key: 'sk-换成你的key',
    // model: 'ornith-1.0-9b',
  });
})();
