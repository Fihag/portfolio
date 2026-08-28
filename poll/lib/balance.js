'use strict';
const providers = require('./providers');

// 查询 openai-compatible 上游余额 (尝试多个常见路径)
async function checkBalance(account) {
  const base = String(account.baseURL || '').replace(/\/+$/, '');
  const paths = [
    '/v1/dashboard/billing/credit_grants',
    '/dashboard/billing/credit_grants',
    '/v1/dashboard/billing/subscription',
    '/v1/user/balance'
  ];
  for (const p of paths) {
    try {
      const res = await providers.sendUpstream({
        url: providers.joinURL(base, p),
        method: 'GET',
        headers: { Authorization: 'Bearer ' + account.apiKey }
      }, 15000);
      const buf = await providers.readStream(res);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const j = JSON.parse(buf.toString('utf8'));
          const b = extractBalance(j);
          if (b !== null) return { ok: true, value: b, raw: j };
        } catch { /* try next */ }
      }
    } catch { /* try next */ }
  }
  return { ok: false, value: null, error: '无法查询该上游余额' };
}

function extractBalance(j) {
  if (j && typeof j.total_available === 'number') return j.total_available;
  if (j && typeof j.total_available_balance === 'number') return j.total_available_balance;
  if (j && typeof j.total_granted === 'number') return j.total_granted;
  if (j && typeof j.balance === 'number') return j.balance;
  if (j && j.data && typeof j.data.total_available === 'number') return j.data.total_available;
  if (j && j.data && typeof j.data.total_available_balance === 'number') return j.data.total_available_balance;
  if (j && j.data && typeof j.data.total_granted === 'number') return j.data.total_granted;
  if (j && typeof j.amount_total === 'number') return j.amount_total;
  return null;
}

async function checkAllBalances(state) {
  for (const a of state.accounts) {
    if (!a.enabled) continue;
    if (a.type !== 'openai-compatible') { a.balance = null; a.balanceCheckedAt = Date.now(); continue; }
    const r = await checkBalance(a);
    if (r.ok) {
      a.balance = r.value;
      a.balanceCheckedAt = Date.now();
      console.log(`[余额] "${a.name}" -> $${typeof r.value === 'number' ? r.value.toFixed(4) : r.value}`);
    }
  }
  return state.accounts.map(a => ({ id: a.id, balance: a.balance, balanceCheckedAt: a.balanceCheckedAt }));
}

function startBalanceLoop(state) {
  const interval = Math.max(60, (state.config.balanceInterval || 3600)) * 1000;
  const timer = setInterval(() => {
    checkAllBalances(state).catch(e => console.error('[余额] 定时检查失败:', e.message));
  }, interval);
  timer.unref();
  return timer;
}

module.exports = { checkBalance, checkAllBalances, startBalanceLoop };
