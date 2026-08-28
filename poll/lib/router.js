'use strict';

function supportsModel(account, model) {
  if (!account.enabled) return false;
  if (account.cooldownUntil && account.cooldownUntil > Date.now()) return false;
  if (!account.models || account.models.length === 0) return true;
  return account.models.includes(model) || account.models.includes('*');
}

function candidatesFor(state, model, excluded) {
  return state.accounts.filter(a => {
    if (!supportsModel(a, model)) return false;
    if (excluded && excluded.has(a.id)) return false;
    return true;
  });
}

function pickAccount(state, model, excluded) {
  const cands = candidatesFor(state, model, excluded);
  if (!cands.length) return null;
  let total = 0;
  let best = null;
  for (const c of cands) {
    const w = Math.max(1, c.weight || 1);
    total += w;
    c.cur = (c.cur || 0) + w;
    if (!best || c.cur > best.cur) best = c;
  }
  if (best) best.cur -= total;
  return best;
}

function markSuccess(state, account) {
  account.failures = 0;
  account.cooldownUntil = 0;
  account.lastError = '';
  account.stats.successes++;
  account.stats.requests++;
  state.total.successes++;
  state.total.requests++;
}

function markFailure(state, account, info) {
  account.failures = (account.failures || 0) + 1;
  const base = state.config.cooldownSeconds || 30;
  const max = state.config.cooldownMaxSeconds || 300;
  const backoff = Math.min(max, base * Math.pow(2, account.failures - 1));
  account.cooldownUntil = Date.now() + backoff * 1000;
  account.lastError = info;
  account.stats.failures++;
  account.stats.requests++;
  state.total.failures++;
  state.total.requests++;
  if (state.log) state.log(`账户 "${account.name}" 失败(${account.failures}次) -> ${info}，冷却 ${backoff}s`);
}

function addTokens(state, account, prompt, completion) {
  prompt = prompt || 0;
  completion = completion || 0;
  account.stats.promptTokens += prompt;
  account.stats.completionTokens += completion;
  state.total.promptTokens += prompt;
  state.total.completionTokens += completion;
}

module.exports = { supportsModel, candidatesFor, pickAccount, markSuccess, markFailure, addTokens };
