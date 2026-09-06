'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { createState } = require('./lib/state');
const router = require('./lib/router');
const providers = require('./lib/providers');
const balance = require('./lib/balance');
const catalog = require('./lib/catalog');

const ROOT = __dirname;
const UI_DIR = path.join(ROOT, 'ui');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { configFile: path.join(ROOT, 'config.json'), port: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config') out.configFile = path.resolve(args[i + 1]);
    if (args[i] === '--port') out.port = parseInt(args[i + 1], 10);
  }
  return out;
}

const args = parseArgs();
const state = createState(args.configFile);

// ---------- 进程级错误兜底 ----------
process.on('unhandledRejection', (reason) => {
  log('未捕获的 Promise 拒绝: ' + (reason instanceof Error ? (reason.stack || reason.message) : reason));
});
process.on('uncaughtException', (err) => {
  log('未捕获异常, 进程退出: ' + (err && err.stack ? err.stack : err));
  try { state.save(); } catch {}
  process.exit(1);
});

// ---- 简单内存日志 ----
state.logs = [];
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  state.logs.unshift(line);
  if (state.logs.length > 300) state.logs.pop();
  console.log(line);
}
state.log = log;

// ---- 工具 ----
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > (limit || 64 * 1024 * 1024)) { req.destroy(); reject(new Error('请求体过大')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readStreamLines(stream, onLine) {
  return new Promise(resolve => {
    let buffer = '';
    stream.setEncoding('utf8');
    const flush = line => {
      if (line) onLine(line);
    };
    stream.on('data', chunk => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        flush(buffer.slice(0, idx).replace(/\r$/, ''));
        buffer = buffer.slice(idx + 1);
      }
    });
    stream.on('end', () => { flush(buffer); resolve(); });
    stream.on('error', () => resolve());
    stream.on('close', () => resolve());
  });
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function errJson(res, status, message) {
  json(res, status, { error: { message, type: 'poll_api_error' } });
}

// 恒定时间字符串比较(防计时侧信道,用于管理登录校验)
function safeEqual(a, b) {
  const sa = String(a === undefined || a === null ? '' : a);
  const sb = String(b === undefined || b === null ? '' : b);
  const ba = Buffer.from(sa);
  const bb = Buffer.from(sb);
  if (ba.length !== bb.length) return false;
  return require('crypto').timingSafeEqual(ba, bb);
}

// 安全解析管理 API 的 JSON 请求体:非法 JSON 返回 400 而不是抛到外层 500
function parseJsonBody(bodyBuf, res) {
  const text = (bodyBuf || Buffer.alloc(0)).toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    errJson(res, 400, '请求体不是合法 JSON');
    return null;
  }
}

function detectDownstreamType(pathname) {
  if (pathname === '/v1/messages' || pathname.startsWith('/v1/messages/')) return 'anthropic';
  return 'openai';
}

function extractModel(pathname, parsed) {
  if (parsed && parsed.model) return String(parsed.model);
  const m = String(pathname).match(/models\/([^:?]+):/);
  return m ? m[1] : '';
}

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 10) return k.slice(0, 2) + '***';
  return k.slice(0, 6) + '...' + k.slice(-4);
}

// ---- 下游鉴权 ----
function downstreamAuthed(req) {
  const keys = state.config.downstreamKeys || [];
  if (!keys.length) return true;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return keys.includes(h.slice(7));
  const x = req.headers['x-api-key'];
  if (x) return keys.includes(x);
  return false;
}

// ---- 下游代理 ----
async function doForward(res, account, pathname, bodyBuf, parsed, downstreamType) {
  const up = providers.buildUpstream(account, pathname, parsed, bodyBuf, downstreamType);
  if (!up) {
    return { kind: 'fail', status: 400, body: JSON.stringify({ error: { message: '该账户类型(' + account.type + ')不支持此接口/格式' } }) };
  }
  let upRes;
  try {
    upRes = await providers.sendUpstream(up);
  } catch (e) {
    return { kind: 'fail', status: 502, body: JSON.stringify({ error: { message: '上游连接失败: ' + e.message } }) };
  }
  // 登记进行中的上游请求, 停用/删除账户时立即掐断
  const infl = state.inflight.get(account.id) || new Set();
  if (upRes._req) { infl.add(upRes._req); state.inflight.set(account.id, infl); }
  const release = () => { if (infl.delete(upRes._req)) { if (!infl.size) state.inflight.delete(account.id); } };
  upRes.on('end', release);
  upRes.on('close', release);
  upRes.on('error', release);
  if (upRes.statusCode < 200 || upRes.statusCode >= 300) {
    const buf = await providers.readStream(upRes);
    return { kind: 'fail', status: upRes.statusCode, body: buf };
  }
  // 成功
  if (up.transform === null) {
    const h = providers.filterHeaders(upRes.headers);
    if (!h['content-type']) h['content-type'] = 'application/json';
    res.writeHead(upRes.statusCode, h);
    upRes.pipe(res);
    await new Promise(r => { upRes.on('end', r); upRes.on('close', r); upRes.on('error', r); });
    if (!res.writableEnded) res.end();
    return { kind: 'ok' };
  }
  if (typeof up.transform === 'function') {
    const buf = await providers.readStream(upRes);
    let parsedRes;
    try { parsedRes = JSON.parse(buf.toString('utf8')); } catch { return { kind: 'fail', status: 502, body: JSON.stringify({ error: { message: '上游返回了非 JSON 响应' } }) }; }
    const out = up.transform(parsedRes, parsed && parsed.model);
    json(res, 200, out);
    const u = out.usage || {};
    return { kind: 'ok', tokens: { prompt: u.prompt_tokens || 0, completion: u.completion_tokens || 0 } };
  }
  // SSE 转换
  up.transform.writeHead(res);
  await readStreamLines(upRes, line => up.transform.onLine(res, line));
  if (up.transform.end) up.transform.end(res);
  res.end();
  return { kind: 'ok' };
}

async function routeWithRetry(res, pathname, bodyBuf, parsed, downstreamType) {
  const model = extractModel(pathname, parsed);
  const excluded = new Set();
  const maxRetries = state.config.retryOnFail ? Math.max(0, state.config.maxRetries || 0) : 0;
  let last = null;
  for (let i = 0; i <= maxRetries; i++) {
    const account = router.pickAccount(state, model, excluded);
    if (!account) {
      last = { kind: 'fail', status: 503, body: JSON.stringify({ error: { message: '没有可用账户: 模型「' + model + '」无可用账户(可能全部在冷却中)' } }) };
      break;
    }
    excluded.add(account.id);
    const r = await doForward(res, account, pathname, bodyBuf, parsed, downstreamType);
    if (r.kind === 'ok') {
      router.markSuccess(state, account);
      if (r.tokens) router.addTokens(state, account, r.tokens.prompt, r.tokens.completion);
      return;
    }
    let msg = '上游返回 ' + r.status;
    try { const j = JSON.parse(r.body.toString ? r.body.toString('utf8') : r.body); msg = (j.error && (j.error.message || j.error.code)) || msg; } catch { if (r.body && r.body.toString) msg = r.body.toString('utf8').slice(0, 200) || msg; }
    router.markFailure(state, account, msg);
    last = r;
  }
  const status = last ? last.status : 503;
  const body = (last && last.body) ? (Buffer.isBuffer(last.body) ? last.body : Buffer.from(String(last.body))) : Buffer.from(JSON.stringify({ error: { message: '代理错误' } }));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

let modelsCache = { at: 0, data: null };
async function handleModels() {
  const now = Date.now();
  if (modelsCache.data && now - modelsCache.at < 60000) return modelsCache.data;
  const ids = new Map();
  for (const a of state.accounts) {
    if (!a.enabled) continue;
    for (const m of a.models) ids.set(m, { id: m, object: 'model', created: 0, owned_by: a.name });
  }
  await Promise.all(state.accounts.filter(a => a.enabled).map(async a => {
    try {
      const base = String(a.baseURL || '').replace(/\/+$/, '');
      const p = a.type === 'gemini' ? '/v1beta/models' : '/v1/models';
      const h = a.type === 'gemini' ? { 'x-goog-api-key': a.apiKey } : { Authorization: 'Bearer ' + a.apiKey };
      const upRes = await providers.sendUpstream({ url: providers.joinURL(base, p), method: 'GET', headers: h }, 10000);
      const buf = await providers.readStream(upRes);
      const j = JSON.parse(buf.toString('utf8'));
      const list = j.data || (Array.isArray(j) ? j : (j.models || []));
      for (const it of list) {
        const id = it.id || String(it.name || '').replace(/^models\//, '');
        if (id && !ids.has(id)) ids.set(id, { id, object: 'model', created: 0, owned_by: a.name });
      }
    } catch { /* 忽略单个账户失败 */ }
  }));
  const data = { object: 'list', data: [...ids.values()].sort((x, y) => x.id.localeCompare(y.id)) };
  modelsCache = { at: Date.now(), data };
  return data;
}

async function handleDownstream(req, res, pathname) {
  if (!downstreamAuthed(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return errJson(res, 401, '无效的下游 API Key');
  }
  if (pathname === '/v1/models') {
    const data = await handleModels();
    return json(res, 200, data);
  }
  const bodyBuf = await readBody(req);
  let parsed = null;
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('application/json')) {
    try { parsed = JSON.parse(bodyBuf.toString('utf8')); } catch { return errJson(res, 400, '请求体不是合法 JSON'); }
  }
  const dt = detectDownstreamType(pathname);
  await routeWithRetry(res, pathname, bodyBuf, parsed, dt);
}

// ---- 静态 UI ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serveUI(req, res, pathname) {
  let rel = pathname === '/admin' || pathname === '/admin/' || pathname === '/' ? '/index.html' : pathname.replace(/^\/admin/, '');
  const file = path.join(UI_DIR, rel.replace(/^\/+/, ''));
  if (!file.startsWith(UI_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return errJson(res, 404, 'not found');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ---- 简单 IP 限流(防管理登录爆破):同一 IP 窗口内最多 max 次 ----
const loginAttempts = new Map(); // ip -> 时间戳数组
function loginRateLimited(ip) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const stamps = (loginAttempts.get(ip) || []).filter(t => now - t < windowMs);
  if (stamps.length >= 20) { loginAttempts.set(ip, stamps); return true; }
  stamps.push(now);
  loginAttempts.set(ip, stamps);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, stamps] of loginAttempts) {
    const fresh = stamps.filter(t => now - t < 5 * 60 * 1000);
    if (fresh.length) loginAttempts.set(ip, fresh);
    else loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

// ---- 管理 API ----
function isAdmin(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return state.verifyAdmin(token);
}

function accountById(id) {
  let decoded = id;
  try { decoded = decodeURIComponent(id); } catch {}
  return state.accounts.find(a => a.id === decoded);
}

function abortInflight(accountId) {
  const set = state.inflight.get(accountId);
  if (set) {
    for (const req of [...set]) { try { req.destroy(); } catch {} }
    state.inflight.delete(accountId);
  }
}

async function handleAdmin(req, res, pathname, bodyBuf) {
  const u = new URL(req.url, 'http://x');
  const m = pathname.match(/^\/api\/accounts\/([^/]+)\/([a-z-]+)$/);
  const mOne = pathname.match(/^\/api\/accounts\/([^/]+)$/);

  if (pathname === '/api/login' && req.method === 'POST') {
    const ip = req.socket && req.socket.remoteAddress || '?';
    if (loginRateLimited(ip)) return errJson(res, 429, '登录尝试过于频繁,请稍后再试');
    const b = parseJsonBody(bodyBuf, res);
    if (b === null) return;
    if (safeEqual(b.username, state.config.adminUser) && safeEqual(b.password, state.config.adminPass)) {
      const token = state.newAdminToken();
      return json(res, 200, { token });
    }
    return errJson(res, 401, '用户名或密码错误');
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    state.revokeAdminToken(token);
    return json(res, 200, { ok: true });
  }

  if (!isAdmin(req)) return errJson(res, 401, '未授权, 请先登录');

  if (pathname === '/api/model-catalog' && req.method === 'GET') {
    const q = u.searchParams.get('q') || '';
    const limit = parseInt(u.searchParams.get('limit'), 10) || 50;
    return json(res, 200, { total: catalog.loadCatalog().length, list: catalog.searchCatalog(q, limit) });
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    return json(res, 200, {
      startedAt: state.startedAt,
      config: {
        port: state.config.port,
        host: state.config.host,
        hasDownstreamKeys: (state.config.downstreamKeys || []).length > 0,
        adminUser: state.config.adminUser,
        strategy: state.config.strategy,
        retryOnFail: state.config.retryOnFail,
        maxRetries: state.config.maxRetries,
        cooldownSeconds: state.config.cooldownSeconds,
        cooldownMaxSeconds: state.config.cooldownMaxSeconds,
        balanceInterval: state.config.balanceInterval,
        testModel: state.config.testModel
      },
      total: state.total,
      logs: state.logs,
      accounts: state.accounts.map(a => ({
        id: a.id, name: a.name, type: a.type, baseURL: a.baseURL, apiKey: maskKey(a.apiKey),
        hasApiKey: !!a.apiKey, weight: a.weight, models: a.models, enabled: a.enabled, note: a.note,
        balance: a.balance, balanceCheckedAt: a.balanceCheckedAt,
        failures: a.failures, cooldownUntil: a.cooldownUntil, lastError: a.lastError,
        stats: a.stats, cur: a.cur
      }))
    });
  }

  if (pathname === '/api/accounts' && req.method === 'POST') {
    const b = parseJsonBody(bodyBuf, res);
    if (b === null) return;
    if (!b.name || !b.baseURL || !b.apiKey) return errJson(res, 400, 'name/baseURL/apiKey 必填');
    const acc = require('./lib/config').normalizeAccount(Object.assign({ models: [] }, b), state.accounts.length);
    if (state.accounts.some(x => x.id === acc.id)) acc.id = acc.id + '-' + Date.now().toString().slice(-4);
    state.accounts.push(acc);
    state.save();
    log(`新增账户 "${acc.name}" (${acc.type})`);
    return json(res, 200, { id: acc.id });
  }

  if (mOne && req.method === 'PUT') {
    const a = accountById(mOne[1]);
    if (!a) return errJson(res, 404, '账户不存在');
    const b = parseJsonBody(bodyBuf, res);
    if (b === null) return;
    const allowed = ['name', 'type', 'baseURL', 'apiKey', 'weight', 'models', 'enabled', 'note'];
    for (const k of allowed) if (b[k] !== undefined) a[k] = b[k];
    a.weight = Math.max(1, parseInt(a.weight, 10) || 1);
    a.models = Array.isArray(a.models) ? a.models.filter(Boolean) : [];
    state.save();
    log(`更新账户 "${a.name}"`);
    return json(res, 200, { id: a.id });
  }

  if (mOne && req.method === 'DELETE') {
    const idx = state.accounts.findIndex(x => x.id === mOne[1]);
    if (idx < 0) return errJson(res, 404, '账户不存在');
    abortInflight(mOne[1]);
    const removed = state.accounts.splice(idx, 1)[0];
    state.save();
    log(`删除账户 "${removed.name}" (已掐断进行中的请求)`);
    return json(res, 200, { ok: true });
  }

  if (m && req.method === 'POST') {
    const a = accountById(m[1]);
    if (!a) return errJson(res, 404, '账户不存在');
    const action = m[2];
    if (action === 'toggle') {
      a.enabled = !a.enabled;
      a.cooldownUntil = 0;
      a.failures = 0;
      a.lastError = '';
      if (!a.enabled) abortInflight(a.id);
      state.save();
      log(`账户 "${a.name}" ${a.enabled ? '启用' : '停用'}${a.enabled ? '' : ' (已掐断进行中的请求)'}`);
      return json(res, 200, { enabled: a.enabled });
    }
    if (action === 'reset') {
      a.failures = 0; a.cooldownUntil = 0; a.lastError = ''; a.cur = 0;
      a.stats = { requests: 0, successes: 0, failures: 0, promptTokens: 0, completionTokens: 0 };
      return json(res, 200, { ok: true });
    }
    if (action === 'test') {
      const r = await testAccount(a);
      log(`测试账户 "${a.name}": ${r.ok ? 'OK ' + (r.info || '') : '失败 ' + (r.error || '')}`);
      return json(res, 200, r);
    }
    if (action === 'balance') {
      const r = await balance.checkBalance(a);
      if (r.ok) { a.balance = r.value; a.balanceCheckedAt = Date.now(); state.save(); }
      log(`查询余额 "${a.name}": ${r.ok ? '$' + Number(r.value).toFixed(4) : r.error}`);
      return json(res, 200, { ok: r.ok, balance: r.value, error: r.error });
    }
    return errJson(res, 404, '未知操作');
  }

  if (pathname === '/api/settings' && req.method === 'PUT') {
    const b = parseJsonBody(bodyBuf, res);
    if (b === null) return;
    const allowed = ['downstreamKeys', 'adminUser', 'adminPass', 'maxRetries', 'cooldownSeconds', 'cooldownMaxSeconds', 'balanceInterval', 'testModel'];
    for (const k of allowed) if (b[k] !== undefined) state.config[k] = b[k];
    state.save();
    log('更新全局设置');
    return json(res, 200, { ok: true });
  }

  return errJson(res, 404, '未知接口');
}

async function testAccount(a) {
  const testModel = String(state.config.testModel || '').trim();

  // 优先: 用测试模型发一次真实对话, 端到端验证
  if (testModel) {
    try {
      const testBody = {
        model: testModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 16,
        stream: false
      };
      const up = providers.buildUpstream(a, '/v1/chat/completions', testBody, Buffer.from(JSON.stringify(testBody)), 'openai');
      if (!up) return { ok: false, error: '该账户类型不支持对话测试' };
      const upRes = await providers.sendUpstream(up, 20000);
      const buf = await providers.readStream(upRes);
      if (upRes.statusCode >= 200 && upRes.statusCode < 300) {
        let reply = '';
        try {
          if (typeof up.transform === 'function') {
            const out = up.transform(JSON.parse(buf.toString('utf8')), testModel);
            reply = (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content) || '';
          } else {
            const j = JSON.parse(buf.toString('utf8'));
            reply = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
          }
        } catch {}
        return { ok: true, model: testModel, reply: String(reply).slice(0, 60), status: upRes.statusCode };
      }
      return { ok: false, error: 'HTTP ' + upRes.statusCode + ' ' + buf.toString('utf8').slice(0, 160), status: upRes.statusCode };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // 回退: GET 模型列表验证连通性
  const base = String(a.baseURL || '').replace(/\/+$/, '');
  const cands = [];
  if (a.type === 'gemini') {
    cands.push(providers.joinURL(base, '/v1beta/models'), base + '/v1beta/models');
  } else {
    cands.push(providers.joinURL(base, '/v1/models'));
    if (!cands.includes(base)) cands.push(base);
  }
  let lastErr = '无法连接';
  for (const url of cands) {
    try {
      const h = a.type === 'gemini' ? { 'x-goog-api-key': a.apiKey } : { Authorization: 'Bearer ' + a.apiKey };
      const upRes = await providers.sendUpstream({ url, method: 'GET', headers: h }, 15000);
      const buf = await providers.readStream(upRes);
      if (upRes.statusCode >= 200 && upRes.statusCode < 300) {
        let n = '';
        try { const j = JSON.parse(buf.toString('utf8')); n = (j.data || j.models || []).length + ' 个模型'; } catch {}
        return { ok: true, info: n, status: upRes.statusCode };
      }
      lastErr = 'HTTP ' + upRes.statusCode + ' ' + buf.toString('utf8').slice(0, 160);
    } catch (e) {
      lastErr = e.message;
    }
  }
  return { ok: false, error: lastErr };
}

// ---- 主服务器 ----
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const pathname = u.pathname;
  try {
    if (pathname.startsWith('/api/')) {
      const bodyBuf = await readBody(req);
      return await handleAdmin(req, res, pathname, bodyBuf);
    }
    if (pathname === '/' || pathname.startsWith('/admin')) {
      return serveUI(req, res, pathname);
    }
    if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    await handleDownstream(req, res, pathname);
  } catch (e) {
    log('处理请求出错: ' + (e && e.message));
    if (!res.headersSent) errJson(res, 500, '内部错误: ' + e.message);
    else res.end();
  }
});

const port = args.port || state.config.port;
server.listen(port, state.config.host, () => {
  log(`轮询代理已启动: http://${state.config.host}:${port}`);
  log(`下游 API 入口: http://127.0.0.1:${port}/v1/chat/completions (${(state.config.downstreamKeys || []).length ? '已配置 key' : '开放模式'})`);
  log(`管理界面: http://127.0.0.1:${port}/admin`);
  log(`已加载 ${state.accounts.length} 个账户`);
  if (state.config.balanceInterval > 0) {
    setTimeout(() => balance.checkAllBalances(state).catch(() => {}), 3000);
    balance.startBalanceLoop(state);
  }
});

process.on('SIGINT', () => { log('正在保存配置并退出...'); state.save(); process.exit(0); });
process.on('SIGTERM', () => { log('正在保存配置并退出...'); state.save(); process.exit(0); });
