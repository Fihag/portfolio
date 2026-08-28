'use strict';
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const children = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function start(cmd, args, env) {
  const c = spawn(process.execPath, [cmd, ...(args || [])], { env: Object.assign({}, process.env, env || {}), stdio: 'inherit' });
  children.push(c);
  return c;
}
let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ✔ ' + n); } else { fail++; console.log('  ✘ ' + n + (e ? '  (' + e + ')' : '')); } };

async function main() {
  start(path.join(ROOT, 'test', 'mock-upstream.js'), [], { PORT: '9104', MODE: 'openai-stream' });
  start(path.join(ROOT, 'server.js'), ['--config', path.join(__dirname, 'abort-config.json')]);
  await sleep(1500);

  const BASE = 'http://127.0.0.1:3200';
  const login = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'a', password: 'p' }) });
  const { token } = await login.json();
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  console.log('=== A. 停用账户立即掐断进行中的流式请求 ===');
  const r = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-t' },
    body: JSON.stringify({ model: 'm-common', stream: true, messages: [{ role: 'user', content: 'hi' }] })
  });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let got = '', ended = false, endTime = 0;
  const t0 = Date.now();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        got += dec.decode(value, { stream: true });
      }
    } catch {}
    ended = true;
    endTime = Date.now() - t0;
  })();
  await sleep(600); // 等流开始流动
  ok('流正在输出 (已收到 ' + got.length + ' 字节)', got.length > 50, got.length);
  const togg = await fetch(BASE + '/api/accounts/st/toggle', { method: 'POST', headers: H, body: '{}' });
  ok('发送停用成功', togg.status === 200);
  await sleep(800);
  ok('流在停用后 ~0.8s 内被掐断', ended === true, 'ended=' + ended);
  if (ended) console.log('    掐断耗时 ' + endTime + 'ms, 收到 ' + got.length + ' 字节(未等完整响应)');
  ok('流未完整结束(没有 [DONE])', !got.includes('[DONE]'));

  console.log('=== B. 启用账户立即清空冷却 ===');
  const en = await fetch(BASE + '/api/accounts/st/toggle', { method: 'POST', headers: H, body: '{}' });
  const st = await fetch(BASE + '/api/state', { headers: H }).then(x => x.json());
  ok('启用成功且 cooldownUntil=0', en.status === 200 && st.accounts[0].cooldownUntil === 0, JSON.stringify(st.accounts[0].cooldownUntil));
  const chat = await fetch(BASE + '/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-t' },
    body: JSON.stringify({ model: 'm-common', messages: [{ role: 'user', content: 'hi' }] })
  });
  ok('启用后立即可用 (200)', chat.status === 200, chat.status);

  console.log('\n通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
}
process.on('exit', () => { for (const c of children) try { c.kill(); } catch {} });
main().catch(e => { console.error(e); process.exit(1); });