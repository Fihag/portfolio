'use strict';
// 模拟上游服务器, 通过环境变量 PORT / MODE 配置
// MODE: openai | openai-fail | openai-stream | anthropic | gemini
const http = require('http');

const PORT = parseInt(process.env.PORT || '9100', 10);
const MODE = process.env.MODE || 'openai';
const counter = { requests: 0, stream: 0 };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  counter.requests++;

  const bodyChunks = [];
  req.on('data', c => bodyChunks.push(c));
  req.on('end', () => {
    let body = null;
    try { body = JSON.parse(Buffer.concat(bodyChunks).toString('utf8') || '{}'); } catch {}

    if (p.includes('/dashboard/billing/credit_grants')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ total_available: 12.34, total_granted: 20, total_used: 7.66, hard_limit_usd: 100 }));
    }

    if (p === '/v1/models' || p === '/v1beta/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-model', object: 'model' }] }));
    }

    // ---- openai 系列 ----
    if (MODE.startsWith('openai')) {
      if (MODE === 'openai-fail') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Rate limit exceeded (mock)', type: 'rate_limit_error' } }));
      }
      const model = body && body.model || 'mock-model';
      const isStream = MODE === 'openai-stream' || (body && body.stream);
      const text = `[${MODE}#${counter.requests}] 你好, 我是 ${MODULE_NAME()} 上游, 模型 ${model}`;
      if (isStream) {
        counter.stream++;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const id = 'chatcmpl-mock';
        const send = (d) => res.write('data: ' + JSON.stringify(d) + '\n\n');
        send({ id, object: 'chat.completion.chunk', created: 0, model, choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] });
        let i = 0;
        const timer = setInterval(() => {
          if (i < text.length) {
            send({ id, object: 'chat.completion.chunk', created: 0, model, choices: [{ index: 0, delta: { content: text[i] }, finish_reason: null }] });
            i++;
          } else {
            clearInterval(timer);
            send({ id, object: 'chat.completion.chunk', created: 0, model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
            res.write('data: [DONE]\n\n');
            res.end();
          }
        }, 40);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: 'chatcmpl-mock-' + counter.requests, object: 'chat.completion', created: 0, model,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }));
    }

    // ---- anthropic 上游 ----
    if (MODE === 'anthropic' && p === '/v1/messages') {
      const isStream = body && body.stream;
      const text = `[anthropic#${counter.requests}] Anthropic 上游回复, 模型 ${body.model}`;
      if (isStream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const ev = (e, d) => { res.write('event: ' + e + '\n'); res.write('data: ' + JSON.stringify(d) + '\n\n'); };
        ev('message_start', { type: 'message_start', message: { id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
        ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
        for (const ch of text) ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ch } });
        ev('content_block_stop', { type: 'content_block_stop', index: 0 });
        ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } });
        ev('message_stop', { type: 'message_stop' });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: 'msg_mock', type: 'message', role: 'assistant', model: body.model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 }
      }));
    }

    // ---- gemini 上游 ----
    if (MODE === 'gemini' && (p.includes(':streamGenerateContent') || p.endsWith(':generateContent'))) {
      const text = `[gemini#${counter.requests}] Gemini 上游回复`;
      if (p.includes(':streamGenerateContent')) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const send = d => res.write('data: ' + JSON.stringify(d) + '\n\n');
        send({ candidates: [{ content: { parts: [{ text }] } }] });
        send({ candidates: [{ content: { parts: [{ text: ' (流式)' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
      }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'mock 404' } }));
  });
});

function MODULE_NAME() { return MODE; }

server.listen(PORT, () => console.log(`mock upstream [${MODE}] on :${PORT}`));
