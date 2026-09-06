'use strict';
const http = require('http');
const https = require('https');
const { URL } = require('url');
const conv = require('./convert');

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'content-length'];

function filterHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (HOP_BY_HOP.includes(k.toLowerCase())) continue;
    if (k.toLowerCase() === 'set-cookie') continue;
    out[k] = v;
  }
  return out;
}

function stripOpenAIBase(url) {
  return String(url).replace(/\/+$/, '');
}

// 拼接路径: 若 base 已经以 suffix 结尾则不再重复拼接
function joinURL(base, suffix) {
  base = stripOpenAIBase(base || '');
  if (!suffix) return base;
  if (base.endsWith(suffix)) return base;
  return base + suffix;
}

// 构造上游请求: 返回 { url, method, headers, body, transform } transform 为 null 表示原样转发
function buildUpstream(account, pathname, parsed, rawBody, downstreamType) {
  const t = account.type;
  const base = stripOpenAIBase(account.baseURL || '');
  const method = 'POST';

  if (t === 'anthropic') {
    // 下游 anthropic 格式 -> anthropic 上游: 原样转发
    if (downstreamType === 'anthropic' && pathname === '/v1/messages') {
      return {
        url: joinURL(base, '/v1/messages'),
        method,
        headers: { 'x-api-key': account.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: rawBody,
        transform: null
      };
    }
    if (downstreamType === 'openai') {
      if (pathname === '/v1/chat/completions') {
        const converted = conv.openaiToAnthropic(parsed);
        return {
          url: joinURL(base, '/v1/messages'),
          method,
          headers: { 'x-api-key': account.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify(converted),
          transform: converted.stream ? conv.anthropicSSETransformer() : conv.anthropicToOpenAI
        };
      }
      if (pathname === '/v1/models') {
        return { url: joinURL(base, '/v1/models'), method: 'GET', headers: { 'x-api-key': account.apiKey, 'anthropic-version': '2023-06-01' }, body: null, transform: null };
      }
    }
    return null;
  }

  if (t === 'gemini') {
    if (downstreamType === 'openai') {
      if (pathname === '/v1/chat/completions') {
        const model = (parsed && parsed.model) || '';
        const converted = conv.openaiToGemini(parsed);
        if (parsed && parsed.stream) {
          return {
            url: `${base}/v1beta/models/${model}:streamGenerateContent?alt=sse`,
            method,
            headers: { 'x-goog-api-key': account.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(converted),
            transform: conv.geminiSSETransformer(model)
          };
        }
        return {
          url: `${base}/v1beta/models/${model}:generateContent`,
          method,
          headers: { 'x-goog-api-key': account.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(converted),
          transform: conv.geminiToOpenAI
        };
      }
      if (pathname === '/v1/models') {
        return { url: joinURL(base, '/v1beta/models'), method: 'GET', headers: { 'x-goog-api-key': account.apiKey }, body: null, transform: null };
      }
    }
    return null;
  }

  // openai-compatible: 原样转发
  let url = joinURL(base, pathname);
  let headers = { Authorization: 'Bearer ' + account.apiKey };
  let body = rawBody;
  let transform = null;

  // 下游 anthropic 格式 -> openai-compatible 上游: 转换
  if (downstreamType === 'anthropic' && pathname === '/v1/messages') {
    const converted = conv.anthropicToOpenAIReq(parsed);
    url = joinURL(base, '/v1/chat/completions');
    body = JSON.stringify(converted);
    headers['Content-Type'] = 'application/json';
    transform = converted.stream ? conv.openaiSSEToAnthropic() : conv.openaiToAnthropicResp;
  } else {
    headers['Content-Type'] = 'application/json';
  }
  return { url, method, headers, body, transform };
}

function sendUpstream(up, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(up.url); } catch (e) { return reject(new Error('无效的 baseURL: ' + up.url)); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, {
      method: up.method,
      headers: up.headers,
      timeout: timeoutMs || 120000
    }, (res) => {
      res._req = req;
      resolve(res);
    });
    req.on('timeout', () => { req.destroy(new Error('上游超时')); });
    req.on('error', (e) => reject(e));
    if (up.body && up.body.length) req.write(up.body);
    req.end();
  });
}

function readStream(stream) {
  return new Promise((resolve) => {
    const chunks = [];
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { buildUpstream, sendUpstream, readStream, filterHeaders, joinURL };
