'use strict';
const $ = id => document.getElementById(id);
let token = localStorage.getItem('poll_token') || '';
let state = null;

function api(path, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  return fetch('/api' + path, opts).then(async r => {
    let j = null;
    try { j = await r.json(); } catch {}
    if (r.status === 401 && j && j.error) { localStorage.removeItem('poll_token'); showLogin(); throw new Error('登录已过期'); }
    if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
    return j;
  });
}

function showLogin() { $('main-view').classList.add('hidden'); $('login-view').classList.remove('hidden'); }
function showMain() { $('login-view').classList.add('hidden'); $('main-view').classList.remove('hidden'); }

async function loadState() {
  state = await api('/state');
  $('endpoint-hint').textContent = '下游入口: /v1/chat/completions · Bearer ' +
    (state.config.downstreamKeys[0] ? state.config.downstreamKeys[0] : '(开放)');
  renderStats();
  renderAccounts();
  renderLogs();
}

function renderStats() {
  const t = state.total;
  const html = [
    ['总请求', t.requests],
    ['成功', t.successes],
    ['失败', t.failures],
    ['输入 Tokens', t.promptTokens],
    ['输出 Tokens', t.completionTokens]
  ].map(([k, v]) => `<div class="stat"><div class="v">${fmt(v)}</div><div class="k">${k}</div></div>`).join('');
  $('stats-row').innerHTML = html;
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function statusBadge(a) {
  if (!a.enabled) return '<span class="badge off">已停用</span>';
  if (a.cooldownUntil > Date.now()) {
    const s = Math.ceil((a.cooldownUntil - Date.now()) / 1000);
    return `<span class="badge cooldown">冷却 ${s}s</span>`;
  }
  return '<span class="badge on">在线</span>';
}

function renderAccounts() {
  const tb = document.querySelector('#acc-table tbody');
  tb.innerHTML = state.accounts.map(a => {
    const models = a.models.length ? a.models.map(m => `<span class="tag">${esc(m)}</span>`).join('') : '<span class="tag">全部</span>';
    const bal = a.balance === null || a.balance === undefined ? '<span class="muted">—</span>' : '$' + Number(a.balance).toFixed(4);
    const lastErr = a.lastError ? `<div class="err" title="${esc(a.lastError)}">${esc(short(a.lastError, 40))}</div>` : '';
    return `<tr>
      <td><b>${esc(a.name)}</b>${a.note ? `<div class="muted" style="font-size:11px">${esc(a.note)}</div>` : ''}</td>
      <td><span class="tag">${esc(a.type)}</span></td>
      <td>${a.weight}</td>
      <td>${models}</td>
      <td>${bal}</td>
      <td>${a.stats.requests} / ${a.stats.successes} / ${a.stats.failures}</td>
      <td>${fmt(a.stats.promptTokens)} / ${fmt(a.stats.completionTokens)}</td>
      <td>${statusBadge(a)}${lastErr}</td>
      <td style="white-space:nowrap">
        <button class="btn sm" onclick="act('${encodeURIComponent(a.id)}','toggle')">${a.enabled ? '停用' : '启用'}</button>
        <button class="btn sm" onclick="act('${encodeURIComponent(a.id)}','test')">测试</button>
        <button class="btn sm" onclick="act('${encodeURIComponent(a.id)}','balance')">查余额</button>
        <button class="btn sm" onclick="editAccount('${encodeURIComponent(a.id)}')">编辑</button>
        <button class="btn sm danger" onclick="act('${encodeURIComponent(a.id)}','delete')">删除</button>
      </td>
    </tr>`;
  }).join('');
}

function renderLogs() {
  const box = $('log-box');
  box.innerHTML = (state.logs || []).map(l =>
    `<div class="${l.includes('失败') || l.includes('出错') ? 'fail' : ''}">${esc(l)}</div>`
  ).join('');
}

function short(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---- 可搜索模型选择器(数据来自 /api/model-catalog, 即模型智能索引) ----
function createCatalogPicker(containerId, multi) {
  const root = document.getElementById(containerId);
  root.classList.add('cat-picker');
  const chips = document.createElement('div');
  chips.className = 'cat-chips';
  const input = document.createElement('input');
  input.className = 'cat-input';
  input.placeholder = multi ? '搜索模型, 点击或回车添加…' : '搜索模型或直接输入模型名…';
  const dd = document.createElement('div');
  dd.className = 'cat-dropdown hidden';
  root.append(chips, input, dd);

  const state = { values: new Set(), timer: null };

  const renderChips = () => {
    chips.innerHTML = '';
    for (const v of state.values) {
      const c = document.createElement('span');
      c.className = 'mchip';
      c.textContent = v;
      const x = document.createElement('i');
      x.textContent = '×';
      x.onclick = e => { e.stopPropagation(); state.values.delete(v); renderChips(); };
      c.appendChild(x);
      chips.appendChild(c);
    }
  };

  const renderDD = (items, q) => {
    if (!items.length) {
      dd.innerHTML = '<div class="cat-empty">没有匹配, 按回车可直接添加「' + esc(q) + '」</div>';
      dd.classList.remove('hidden');
      return;
    }
    dd.innerHTML = items.map(m => {
      const label = m.slug + (m.creator ? ' · ' + m.creator : '') + (m.rank ? ' · #' + m.rank : '') + (m.reasoning ? ' · 推理' : '');
      const sel = state.values.has(m.slug) ? ' sel' : '';
      return `<div class="cat-item${sel}" data-v="${esc(m.slug)}" data-label="${esc(label)}">${esc(label)}</div>`;
    }).join('');
    dd.classList.remove('hidden');
  };

  const doSearch = q => {
    api('/model-catalog?q=' + encodeURIComponent(q) + '&limit=30')
      .then(j => renderDD(j.list || [], q))
      .catch(() => renderDD([], q));
  };

  input.addEventListener('input', () => {
    clearTimeout(state.timer);
    const q = input.value.trim();
    if (!q) { dd.classList.add('hidden'); return; }
    state.timer = setTimeout(() => doSearch(q), 220);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v) { state.values.add(v); input.value = ''; dd.classList.add('hidden'); renderChips(); }
    } else if (e.key === 'Backspace' && !input.value && state.values.size && multi) {
      state.values.delete([...state.values].pop());
      renderChips();
    }
  });

  dd.addEventListener('mousedown', e => {
    const it = e.target.closest('.cat-item');
    if (!it) return;
    e.preventDefault();
    const v = it.dataset.v;
    if (multi) {
      if (state.values.has(v)) state.values.delete(v); else state.values.add(v);
      renderChips();
      const q = input.value.trim();
      if (q) doSearch(q);
    } else {
      state.values = new Set([v]);
      input.value = v;
      dd.classList.add('hidden');
      renderChips();
    }
  });

  document.addEventListener('click', e => {
    if (!root.contains(e.target)) dd.classList.add('hidden');
  });

  return {
    set(arr) { state.values = new Set(arr || []); renderChips(); },
    get() { return multi ? [...state.values] : ([...state.values][0] || ''); }
  };
}

const modelsPicker = createCatalogPicker('f-models-picker', true);
const testModelPicker = createCatalogPicker('s-testmodel-picker', false);

async function act(id, action) {
  if (action === 'delete' && !confirm('确认删除该账户?')) return;
  try {
    if (action === 'toggle' || action === 'test' || action === 'balance' || action === 'reset') {
      await api(`/accounts/${id}/${action}`, { method: 'POST', body: '{}' });
    } else if (action === 'delete') {
      await api(`/accounts/${id}`, { method: 'DELETE' });
    }
    await loadState();
  } catch (e) { alert('操作失败: ' + e.message); }
}

function openAccModal(acc) {
  $('acc-modal-title').textContent = acc ? '编辑账户' : '添加账户';
  $('f-name').value = acc ? acc.name : '';
  $('f-type').value = acc ? acc.type : 'openai-compatible';
  $('f-baseurl').value = acc ? acc.baseURL : '';
  $('f-apikey').value = acc ? '' : '';
  $('f-apikey').placeholder = acc && acc.hasApiKey ? '已保存(留空保持不变)' : 'sk-...';
  $('f-weight').value = acc ? acc.weight : 1;
  $('f-enabled').value = acc ? (acc.enabled ? 1 : 0) : 1;
  modelsPicker.set(acc ? (acc.models || []) : []);
  $('f-note').value = acc ? (acc.note || '') : '';
  $('acc-err').textContent = '';
  $('acc-modal').classList.remove('hidden');
  window._editingId = acc ? acc.id : null;
}
function editAccount(id) {
  const a = state.accounts.find(x => x.id === decodeURIComponent(id));
  if (a) openAccModal(a);
}

$('add-account-btn').onclick = () => openAccModal(null);
$('acc-cancel').onclick = () => $('acc-modal').classList.add('hidden');
$('acc-save').onclick = async () => {
  const body = {
    name: $('f-name').value.trim(),
    type: $('f-type').value,
    baseURL: $('f-baseurl').value.trim(),
    apiKey: $('f-apikey').value.trim(),
    weight: parseInt($('f-weight').value, 10) || 1,
    enabled: $('f-enabled').value === '1',
    models: modelsPicker.get(),
    note: $('f-note').value.trim()
  };
  if (window._editingId) body.apiKey = body.apiKey || undefined;
  if (!body.name || !body.baseURL || (!window._editingId && !body.apiKey)) { $('acc-err').textContent = '名称/BaseURL/API Key 必填'; return; }
  try {
    if (window._editingId) await api('/accounts/' + encodeURIComponent(window._editingId), { method: 'PUT', body: JSON.stringify(body) });
    else await api('/accounts', { method: 'POST', body: JSON.stringify(body) });
    $('acc-modal').classList.add('hidden');
    await loadState();
  } catch (e) { $('acc-err').textContent = e.message; }
};

$('settings-btn').onclick = async () => {
  await loadState();
  const c = state.config;
  $('s-keys').value = (c.downstreamKeys || []).join(', ');
  $('s-adminuser').value = c.adminUser || '';
  $('s-adminpass').value = c.adminPass || '';
  $('s-maxretries').value = c.maxRetries;
  $('s-cooldown').value = c.cooldownSeconds;
  $('s-cooldownmax').value = c.cooldownMaxSeconds;
  $('s-balinterval').value = c.balanceInterval;
  testModelPicker.set(c.testModel ? [c.testModel] : []);
  $('set-err').textContent = '';
  $('set-modal').classList.remove('hidden');
};
$('set-cancel').onclick = () => $('set-modal').classList.add('hidden');
$('set-save').onclick = async () => {
  const body = {
    downstreamKeys: $('s-keys').value.split(/[,，\s]+/).filter(Boolean),
    adminUser: $('s-adminuser').value.trim(),
    adminPass: $('s-adminpass').value.trim(),
    maxRetries: parseInt($('s-maxretries').value, 10) || 0,
    cooldownSeconds: parseInt($('s-cooldown').value, 10) || 30,
    cooldownMaxSeconds: parseInt($('s-cooldownmax').value, 10) || 300,
    balanceInterval: parseInt($('s-balinterval').value, 10) || 3600,
    testModel: testModelPicker.get()
  };
  try {
    await api('/settings', { method: 'PUT', body: JSON.stringify(body) });
    $('set-modal').classList.add('hidden');
    await loadState();
  } catch (e) { $('set-err').textContent = e.message; }
};

$('refresh-btn').onclick = () => loadState().catch(e => alert(e.message));
$('logout-btn').onclick = () => { localStorage.removeItem('poll_token'); showLogin(); };
$('login-btn').onclick = async () => {
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('login-user').value, password: $('login-pass').value })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error.message || '登录失败');
    token = j.token;
    localStorage.setItem('poll_token', token);
    showMain();
    await loadState();
  } catch (e) { $('login-err').textContent = e.message; }
};
$('login-user').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-pass').focus(); });
$('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-btn').click(); });

(async function init() {
  if (!token) return showLogin();
  try { await loadState(); showMain(); }
  catch { showLogin(); }
  setInterval(() => { if (token && !document.hidden) loadState().catch(() => {}); }, 15000);
})();
