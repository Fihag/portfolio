/* ============================================================
 * ai-config.js — 外部 AI 模型配置(ai 命令使用)
 * 修改 base / key / model 即可切换到其他 OpenAI 兼容接口
 *
 * 注意:用 IIFE + window 挂载,避免在全局词法环境声明
 * const AI_CONFIG 与 commands.js 的顶层声明冲突
 * (经典 script 顶层 const 属于全局词法绑定,同名重复声明
 *  会抛 SyntaxError,导致整个 commands.js 加载失败)。
 * ============================================================ */

(function () {
  'use strict';

  const cfg = {
    // OpenAI 兼容接口地址
    base: 'http://26.245.218.217:1234',
    // API Key
    key: 'sk-lm-hfQ6CV0F:0WxXZ3MqWllvzTGww058',
    // 模型名
    model: 'ornith-1.0-9b',
    // 单次请求超时(毫秒)
    timeoutMs: 90000,
  };

  if (typeof module !== 'undefined' && module.exports) {
    // Node 环境
    module.exports = { AI_CONFIG: cfg };
  } else {
    // 浏览器环境:挂到 window(不占用全局词法绑定)
    window.AI_CONFIG = cfg;
  }
})();
