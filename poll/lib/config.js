'use strict';
const fs = require('fs');

const DEFAULTS = {
  port: 7891,
  host: '0.0.0.0',
  downstreamKeys: [],
  adminUser: 'admin',
  adminPass: 'admin123',
  strategy: 'weighted-round-robin',
  retryOnFail: true,
  maxRetries: 2,
  cooldownSeconds: 30,
  cooldownMaxSeconds: 300,
  balanceInterval: 3600,
  testModel: '',
  accounts: []
};

const ACCOUNT_TYPES = ['openai-compatible', 'anthropic', 'gemini'];

function loadConfig(file) {
  const cfg = JSON.parse(JSON.stringify(DEFAULTS));
  if (fs.existsSync(file)) {
    let raw = {};
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      console.error('[config] 解析失败:', e.message);
      process.exit(1);
    }
    for (const k of Object.keys(DEFAULTS)) {
      if (raw[k] !== undefined) cfg[k] = raw[k];
    }
    if (Array.isArray(raw.accounts)) cfg.accounts = raw.accounts;
  }
  return cfg;
}

function slugify(s) {
  return String(s || 'acc')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'acc';
}

// 清理 baseURL: 去掉结尾的完整端点路径, 只保留基础地址
function cleanBase(url) {
  return String(url || '')
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1\/messages$/i, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/+$/, '');
}

function normalizeAccount(a, index) {
  const name = a.name || ('账户' + (index + 1));
  return {
    id: String(a.id !== undefined && a.id !== '' ? a.id : slugify(name) + '-' + index),
    name: name,
    type: ACCOUNT_TYPES.includes(a.type) ? a.type : 'openai-compatible',
    baseURL: cleanBase(a.baseURL),
    apiKey: a.apiKey || '',
    weight: Math.max(1, parseInt(a.weight, 10) || 1),
    models: Array.isArray(a.models) ? a.models.filter(Boolean) : [],
    enabled: a.enabled !== false,
    note: a.note || '',
    balance: a.balance ?? null,
    balanceCheckedAt: a.balanceCheckedAt || 0,
    cur: 0,
    failures: 0,
    cooldownUntil: 0,
    lastError: '',
    stats: {
      requests: 0,
      successes: 0,
      failures: 0,
      promptTokens: 0,
      completionTokens: 0
    }
  };
}

module.exports = { DEFAULTS, ACCOUNT_TYPES, loadConfig, normalizeAccount };
