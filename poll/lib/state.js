'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadConfig, normalizeAccount } = require('./config');

function createState(configFile) {
  const config = loadConfig(configFile);
  const accounts = config.accounts.map(normalizeAccount);
  delete config.accounts;

  const state = {
    configFile,
    config,
    accounts,
    adminTokens: new Set(),
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
  };

  state.newAdminToken = function () {
    const t = crypto.randomBytes(24).toString('hex');
    state.adminTokens.add(t);
    return t;
  };

  state.verifyAdmin = function (token) {
    return token && state.adminTokens.has(token);
  };

  return state;
}

function stripRuntime(a) {
  const { id, name, type, baseURL, apiKey, weight, models, enabled, note, balance, balanceCheckedAt } = a;
  return { id, name, type, baseURL, apiKey, weight, models, enabled, note, balance, balanceCheckedAt };
}

module.exports = { createState, stripRuntime };
