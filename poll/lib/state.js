'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadConfig, normalizeAccount } = require('./config');

// 管理 token 有效期 24h,与 turtle-soup 的 TOKEN_TTL 对齐;过期懒删除 + 定时清理
const ADMIN_TOKEN_TTL = 24 * 60 * 60 * 1000;

function createState(configFile) {
  const config = loadConfig(configFile);
  const accounts = config.accounts.map(normalizeAccount);
  delete config.accounts;
  const state = {
    configFile,
    config,
    accounts,
    adminTokens: new Map(), // token -> 过期时间(ms),24h TTL + 定期清理
    inflight: new Map(),
    startedAt: Date.now(),
    total: { requests: 0, successes: 0, failures: 0, promptTokens: 0, completionTokens: 0 }
  };

  state.save = function () {
    const payload = Object.assign({}, state.config, {
      accounts: state.accounts.map(stripRuntime)
    });
    const tmp = state.configFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, state.configFile);
    try { fs.chmodSync(state.configFile, 0o600); } catch {}
  };

  state.newAdminToken = function () {
    const t = crypto.randomBytes(24).toString('hex');
    state.adminTokens.set(t, Date.now() + ADMIN_TOKEN_TTL);
    return t;
  };

  state.revokeAdminToken = function (token) {
    if (token) state.adminTokens.delete(token);
  };

  state.verifyAdmin = function (token) {
    if (!token) return false;
    const exp = state.adminTokens.get(token);
    if (!exp) return false;
    if (exp < Date.now()) { state.adminTokens.delete(token); return false; }
    return true;
  };

  // 定时清理过期 token,防止 Map 无限增长
  setInterval(() => {
    const now = Date.now();
    for (const [t, exp] of state.adminTokens) {
      if (exp < now) state.adminTokens.delete(t);
    }
  }, 60 * 60 * 1000).unref?.();

  return state;
}

function stripRuntime(a) {
  const { id, name, type, baseURL, apiKey, weight, models, enabled, note, balance, balanceCheckedAt } = a;
  return { id, name, type, baseURL, apiKey, weight, models, enabled, note, balance, balanceCheckedAt };
}

module.exports = { createState, stripRuntime };
