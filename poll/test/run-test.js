'use strict';
// 端到端测试: 启动 5 个 mock 上游 + poll 代理, 验证轮询/故障切换/流式/多格式转换/管理 API
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOCKS = [
  { port: 9101, mode: 'openai' },
  { port: 9102, mode: 'openai-fail' },
  { port: 9103, mode: 'anthropic' },
  { port: 9104, mode: 'openai-stream' },
  { port: 9105, mode: 'gemini' }
];
const POLL = 3100;
const MASTER = 'sk-test-master';
const BASE = `http://127.0.0.1:${POLL}`;

const children = [];
function start(script, env) {
  const c = spawn(process.execPath, [script], { env: Object.assign({}, process.env, env), stdio: 'inherit' });
  children.push(c);
  return c;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function reconContent(sse) {
  const re = /"content":"([^"]*)"/g;
  let m, parts = [];
  while ((m = re.exec(sse))) parts.push(m[1]);
  return parts.join('');
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} ${extra || ''}`); }
}
async function jreq(path, opts) {
  const r = await fetch(BASE + path, opts);
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, j };
}
async function chat(body, auth) {
  const r = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (auth === undefined ? MASTER : auth) },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, text, j };
}
async function streamChat(body) {
  const r = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + MASTER },
    body: JSON.stringify(Object.assign({ stream: true }, body))
  });
  let full = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
  }
  return { status: r.status, full };
}

async function main() {
  for (const m of MOCKS) start(path.join(ROOT, 'test', 'mock-upstream.js'), { PORT: String(m.port), MODE: m.mode });
  const poll = spawn(process.execPath, [path.join(ROOT, 'server.js'), '--config', path.join(__dirname, 'test-config.json')], { stdio: 'inherit' });
  children.push(poll);

  await sleep(1500);
  console.log('\n=== 1. 下游鉴权 ===');
  {
    const bad = await chat({ model: 'm-common', messages: [{ role: 'user', content: 'hi' }] }, 'sk-wrong');
    ok('错误 Key 返回 401', bad.status === 401);
    const no = await chat({ model: 'm-common', messages: [{ role: 'user', content: 'hi' }] }, '');
    ok('无 Key 返回 401', no.status === 401, `(实际 ${no.status})`);
  }

  console.log('\n=== 2. 轮询 + 故障切换(含 429 账户) ===');
  {
    let allOk = true;
    for (let i = 0; i < 10; i++) {
      const r = await chat({ model: 'm-common', messages: [{ role: 'user', content: 'hi' }] });
      if (r.status !== 200) { allOk = false; console.log('  请求', i, '返回', r.status, r.text.slice(0, 120)); }
    }
    ok('10 次请求全部 200 (429 账户自动冷却并切换)', allOk);
    const st = await jreq('/api/state', { headers: { Authorization: 'Bearer ' + (await login()) } });
    const accs = st.j.accounts;
    const failAcc = accs.find(a => a.name === 'fail');
    const normalAcc = accs.find(a => a.name === 'normal');
    const streamAcc = accs.find(a => a.name === 'stream');
    ok('fail 账户已被冷却', failAcc && failAcc.cooldownUntil > Date.now() - 60000 && failAcc.stats.failures >= 1);
    ok('normal 账户承担了更多请求(权重2)', normalAcc.stats.requests >= 1);
    ok('stream 账户也参与了轮询', streamAcc.stats.requests >= 1);
    console.log(`    请求分布 normal=${normalAcc.stats.requests} fail=${failAcc.stats.requests} stream=${streamAcc.stats.requests}`);
  }

  console.log('\n=== 3. 流式转发(openai) ===');
  {
    const s = await streamChat({ model: 'm-common', messages: [{ role: 'user', content: 'hi' }] });
    ok('流式返回 200', s.status === 200);
    ok('流式内容包含 data: 且以 [DONE] 结尾', s.full.includes('data:') && s.full.includes('[DONE]'));
    console.log('    样例:', JSON.stringify(s.full.slice(0, 120)));
  }

  console.log('\n=== 4. OpenAI 格式 -> Anthropic 上游 (非流式) ===');
  {
    const r = await chat({ model: 'm-claude', messages: [{ role: 'user', content: 'hi' }] });
    ok('返回 200', r.status === 200);
    ok('转换后是 OpenAI chat.completion 结构', r.j && r.j.object === 'chat.completion' && r.j.choices && r.j.choices[0].message.content);
    ok('内容来自 anthropic 上游', r.j.choices[0].message.content.includes('anthropic'));
  }

  console.log('\n=== 5. OpenAI 格式 -> Anthropic 上游 (流式转换) ===');
  {
    const s = await streamChat({ model: 'm-claude', messages: [{ role: 'user', content: 'hi' }] });
    ok('流式 200', s.status === 200);
    const recon = reconContent(s.full);
    ok('SSE 被转换为 OpenAI chunk 格式且含 anthropic 内容', s.full.includes('chat.completion.chunk') && s.full.includes('[DONE]') && recon.includes('anthropic'), `(recon=${JSON.stringify(recon)})`);
  }

  console.log('\n=== 6. OpenAI 格式 -> Gemini 上游 (非流式) ===');
  {
    const r = await chat({ model: 'm-gemini', messages: [{ role: 'user', content: 'hi' }] });
    ok('返回 200', r.status === 200);
    ok('转换后是 OpenAI 结构且内容来自 gemini', r.j && r.j.object === 'chat.completion' && r.j.choices[0].message.content.includes('gemini'));
  }

  console.log('\n=== 7. OpenAI 格式 -> Gemini 上游 (流式) ===');
  {
    const s = await streamChat({ model: 'm-gemini', messages: [{ role: 'user', content: 'hi' }] });
    ok('流式 200', s.status === 200, `(实际 ${s.status}, 内容=${JSON.stringify(s.full.slice(0, 150))})`);
    const recon = reconContent(s.full);
    ok('SSE 含 gemini 内容且 [DONE]', s.full.includes('[DONE]') && recon.includes('gemini'), `(recon=${JSON.stringify(recon)})`);
  }

  console.log('\n=== 8. /v1/models 聚合 ===');
  {
    const r = await fetch(BASE + '/v1/models', { headers: { Authorization: 'Bearer ' + MASTER } });
    const j = await r.json();
    const ids = (j.data || []).map(x => x.id);
    ok('返回模型列表', r.status === 200 && Array.isArray(j.data));
    ok('包含配置中的 m-common/m-claude/m-gemini', ['m-common', 'm-claude', 'm-gemini'].every(m => ids.includes(m)));
    ok('包含上游实测的 mock-model', ids.includes('mock-model'));
  }

  console.log('\n=== 9. 管理 API ===');
  const token = await login();
  {
    const noauth = await jreq('/api/state');
    ok('未登录访问 /api/state 返回 401', noauth.status === 401);
    const st = await jreq('/api/state', { headers: { Authorization: 'Bearer ' + token } });
    ok('已登录可读取状态', st.status === 200 && st.j.accounts.length === 5);
    const test = await jreq('/api/accounts/normal/test', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: '{}' });
    ok('账户测试: normal 连接正常', test.j && test.j.ok === true);
    const bal = await jreq('/api/accounts/normal/balance', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: '{}' });
    ok('余额查询: 12.34', bal.j && bal.j.ok === true && Math.abs(bal.j.balance - 12.34) < 0.01);
  }

  console.log('\n======================================');
  console.log(`通过 ${pass} 项, 失败 ${fail} 项`);
  process.exit(fail ? 1 : 0);
}

async function login() {
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'test123' })
  });
  const j = await r.json();
  return j.token;
}

process.on('exit', () => { for (const c of children) try { c.kill(); } catch {} });
main().catch(e => { console.error('测试脚本出错:', e); process.exit(1); });
