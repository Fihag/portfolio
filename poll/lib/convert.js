'use strict';

const now = () => Math.floor(Date.now() / 1000);

// ============================================================
// OpenAI -> Anthropic
// ============================================================
function openaiContentToAnthropic(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      if (part.type === 'image_url') {
        const u = part.image_url && part.image_url.url;
        if (!u) return null;
        if (/^data:image\/(\w+);base64,/.test(u)) {
          const m = u.match(/^data:image\/(\w+);base64,(.*)$/);
          return { type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } };
        }
        return { type: 'image', source: { type: 'url', url: u } };
      }
      return null;
    }).filter(Boolean);
  }
  return String(content || '');
}

function openaiToAnthropic(body) {
  const system = [];
  const messages = [];
  for (const m of (body.messages || [])) {
    if (m.role === 'system') {
      system.push(typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''));
      continue;
    }
    if (m.role === 'tool') {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
      });
      continue;
    }
    if (m.role === 'assistant') {
      const out = { role: 'assistant', content: openaiContentToAnthropic(m.content) || '' };
      if (m.tool_calls && m.tool_calls.length) {
        out.content = Array.isArray(out.content) ? out.content : [out.content].filter(Boolean);
        for (const tc of m.tool_calls) {
          out.content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: safeJSON(tc.function.arguments) });
        }
      }
      messages.push(out);
      continue;
    }
    messages.push({ role: 'user', content: openaiContentToAnthropic(m.content) });
  }
  const out = {
    model: body.model,
    max_tokens: body.max_tokens || 4096,
    messages,
    stream: !!body.stream
  };
  if (system.length) out.system = system.join('\n\n');
  if (body.temperature !== undefined) out.temperature = body.temperature;
  if (body.top_p !== undefined) out.top_p = body.top_p;
  if (body.stop !== undefined) out.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (body.tools && body.tools.length) {
    out.tools = body.tools
      .map(t => ({
        name: t.function.name,
        description: t.function.description || '',
        input_schema: t.function.parameters || { type: 'object', properties: {} }
      }))
      .filter(t => t.name);
    if (body.tool_choice && body.tool_choice.type === 'function') {
      out.tool_choice = { type: 'tool', name: body.tool_choice.function.name };
    }
  }
  if (body.extra_body) Object.assign(out, body.extra_body);
  return out;
}

function anthropicToOpenAI(parsed, fallbackModel) {
  const content = [];
  for (const b of (parsed.content || [])) {
    if (b.type === 'text') content.push(b.text);
    else if (b.type === 'tool_use') {
      // handled below
    }
  }
  const toolCalls = (parsed.content || []).filter(b => b.type === 'tool_use').map((b, i) => ({
    id: b.id || ('call_' + i),
    type: 'function',
    function: { name: b.name, arguments: JSON.stringify(b.input || {}) }
  }));
  const stopMap = { end_turn: 'stop', max_tokens: 'length', stop_sequence: 'stop', tool_use: 'tool_calls' };
  return {
    id: parsed.id || 'chatcmpl-' + now(),
    object: 'chat.completion',
    created: now(),
    model: parsed.model || fallbackModel || '',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content.join(''),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {})
      },
      finish_reason: stopMap[parsed.stop_reason] || (toolCalls.length ? 'tool_calls' : 'stop')
    }],
    usage: {
      prompt_tokens: (parsed.usage && parsed.usage.input_tokens) || 0,
      completion_tokens: (parsed.usage && parsed.usage.output_tokens) || 0,
      total_tokens: ((parsed.usage && (parsed.usage.input_tokens + parsed.usage.output_tokens)) || 0)
    }
  };
}

// Anthropic SSE -> OpenAI SSE
function anthropicSSETransformer() {
  let id = 'chatcmpl-' + now();
  let model = '';
  let started = false;
  let stopSent = false;
  const flushRole = (res) => {
    if (!started) {
      started = true;
      res.write('data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', created: now(), model,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
      }) + '\n\n');
    }
  };
  return {
    writeHead(res) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    },
    onLine(res, line) {
      if (!line.startsWith('data:')) return;
      let data;
      try { data = JSON.parse(line.slice(5).trim()); } catch { return; }
      if (data.type === 'message_start') {
        if (data.message) { id = data.message.id || id; model = data.message.model || model; }
        flushRole(res);
      } else if (data.type === 'content_block_delta' && data.delta) {
        if (data.delta.type === 'text_delta') {
          flushRole(res);
          res.write('data: ' + JSON.stringify({
            id, object: 'chat.completion.chunk', created: now(), model,
            choices: [{ index: data.index || 0, delta: { content: data.delta.text }, finish_reason: null }]
          }) + '\n\n');
        }
      } else if (data.type === 'message_delta' && data.delta) {
        if (!stopSent) {
          stopSent = true;
          const stopMap = { end_turn: 'stop', max_tokens: 'length', stop_sequence: 'stop', tool_use: 'tool_calls' };
          flushRole(res);
          res.write('data: ' + JSON.stringify({
            id, object: 'chat.completion.chunk', created: now(), model,
            choices: [{ index: 0, delta: {}, finish_reason: stopMap[data.delta.stop_reason] || 'stop' }]
          }) + '\n\n');
        }
      } else if (data.type === 'message_stop') {
        stopSent = true;
        res.write('data: [DONE]\n\n');
      }
    },
    end(res) {
      if (!stopSent) { stopSent = true; res.write('data: [DONE]\n\n'); }
    }
  };
}

// ============================================================
// OpenAI -> Gemini
// ============================================================
function openaiToGemini(body) {
  const systemParts = [];
  const contents = [];
  for (const m of (body.messages || [])) {
    const parts = [];
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p.type === 'text') parts.push({ text: p.text });
        else if (p.type === 'image_url') {
          const u = p.image_url && p.image_url.url;
          if (/^data:image\/(\w+);base64,/.test(u || '')) {
            const mm = u.match(/^data:image\/(\w+);base64,(.*)$/);
            parts.push({ inline_data: { mime_type: 'image/' + mm[1], data: mm[2] } });
          }
        }
      }
    }
    if (m.role === 'system') {
      systemParts.push({ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '') });
      continue;
    }
    if (m.role === 'tool') {
      contents.push({ role: 'user', parts: [{ text: '工具返回: ' + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)) }] });
      continue;
    }
    if (m.tool_calls && m.tool_calls.length) {
      for (const tc of m.tool_calls) {
        parts.push({ functionCall: { name: tc.function.name, args: safeJSON(tc.function.arguments) } });
      }
    }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
  }
  const out = { contents };
  if (systemParts.length) out.systemInstruction = { parts: systemParts };
  const gen = {};
  if (body.temperature !== undefined) gen.temperature = body.temperature;
  if (body.top_p !== undefined) gen.topP = body.top_p;
  if (body.max_tokens !== undefined) gen.maxOutputTokens = body.max_tokens;
  if (body.stop !== undefined) gen.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (Object.keys(gen).length) out.generationConfig = gen;
  if (body.tools && body.tools.length) {
    out.tools = [{ functionDeclarations: body.tools.map(t => ({
      name: t.function.name,
      description: t.function.description || '',
      parameters: t.function.parameters || { type: 'object', properties: {} }
    })).filter(t => t.name) }];
  }
  return out;
}

function geminiToOpenAI(parsed, fallbackModel) {
  const cand = (parsed.candidates || [])[0] || {};
  const text = (cand.content && cand.content.parts || []).map(p => p.text || '').join('');
  const funcs = (cand.content && cand.content.parts || []).filter(p => p.functionCall).map((p, i) => ({
    id: 'call_' + i,
    type: 'function',
    function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) }
  }));
  const stopMap = { STOP: 'stop', MAX_TOKENS: 'length', SAFETY: 'content_filter', RECITATION: 'content_filter', MALFORMED_FUNCTION_CALL: 'tool_calls' };
  const um = parsed.usageMetadata || {};
  return {
    id: 'chatcmpl-' + now(),
    object: 'chat.completion',
    created: now(),
    model: fallbackModel || '',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text, ...(funcs.length ? { tool_calls: funcs } : {}) },
      finish_reason: stopMap[cand.finishReason] || 'stop'
    }],
    usage: {
      prompt_tokens: um.promptTokenCount || 0,
      completion_tokens: um.candidatesTokenCount || 0,
      total_tokens: um.totalTokenCount || 0
    }
  };
}

// Gemini SSE -> OpenAI SSE
function geminiSSETransformer(fallbackModel) {
  let started = false;
  let done = false;
  let id = 'chatcmpl-' + now();
  const flushRole = (res) => {
    if (!started) {
      started = true;
      res.write('data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', created: now(), model: fallbackModel || '',
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
      }) + '\n\n');
    }
  };
  const finish = (res, reason) => {
    if (done) return;
    done = true;
    flushRole(res);
    res.write('data: ' + JSON.stringify({
      id, object: 'chat.completion.chunk', created: now(), model: fallbackModel || '',
      choices: [{ index: 0, delta: {}, finish_reason: reason || 'stop' }]
    }) + '\n\n');
    res.write('data: [DONE]\n\n');
  };
  return {
    writeHead(res) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    },
    onLine(res, line) {
      if (!line.startsWith('data:')) return;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') { done = true; res.write('data: [DONE]\n\n'); return; }
      let data;
      try { data = JSON.parse(raw); } catch { return; }
      const cand = (data.candidates || [])[0];
      if (!cand || !cand.content) return;
      const text = (cand.content.parts || []).map(p => p.text || '').join('');
      if (text) {
        flushRole(res);
        res.write('data: ' + JSON.stringify({
          id, object: 'chat.completion.chunk', created: now(), model: fallbackModel || '',
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
        }) + '\n\n');
      }
      if (cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') {
        finish(res, 'content_filter');
      }
    },
    end(res) {
      if (!done) finish(res, 'stop');
    }
  };
}

// ============================================================
// Anthropic (downstream) -> OpenAI (upstream openai-compatible)
// ============================================================
function anthropicToOpenAIReq(body) {
  const messages = [];
  let system = '';
  if (body.system) system = typeof body.system === 'string' ? body.system : (body.system.map ? body.system.map(s => s.text || '').join('\n\n') : '');
  const tools = (body.tools || []).map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description || '', parameters: t.input_schema || { type: 'object', properties: {} } }
  }));
  for (const m of (body.messages || [])) {
    if (m.role === 'assistant') {
      const content = [];
      const toolCalls = [];
      for (const b of (m.content || [])) {
        if (typeof b === 'string') content.push(b);
        else if (b.type === 'text') content.push(b.text);
        else if (b.type === 'tool_use') {
          const id = 'call_' + toolCalls.length;
          toolCalls.push({ id: b.id || id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } });
        }
      }
      messages.push({ role: 'assistant', content: content.join(''), ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    } else if (m.role === 'user') {
      const textParts = [];
      let toolResults = [];
      for (const b of (Array.isArray(m.content) ? m.content : [m.content])) {
        if (typeof b === 'string') textParts.push(b);
        else if (b.type === 'text') textParts.push(b.text);
        else if (b.type === 'image') {
          textParts.push('[图片]');
        }
        else if (b.type === 'tool_result') {
          toolResults.push({ role: 'tool', tool_call_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
        }
      }
      if (toolResults.length) messages.push(...toolResults);
      if (textParts.length) messages.push({ role: 'user', content: textParts.join('') });
    } else {
      messages.push(m);
    }
  }
  const out = {
    model: body.model,
    messages,
    stream: !!body.stream
  };
  if (system) out.messages = [{ role: 'system', content: system }, ...messages];
  if (body.max_tokens) out.max_tokens = body.max_tokens;
  if (body.temperature !== undefined) out.temperature = body.temperature;
  if (body.top_p !== undefined) out.top_p = body.top_p;
  if (body.stop_sequences) out.stop = body.stop_sequences.length === 1 ? body.stop_sequences[0] : body.stop_sequences;
  if (tools.length) out.tools = tools;
  return out;
}

function openaiToAnthropicResp(parsed) {
  const choice = (parsed.choices || [])[0] || {};
  const msg = choice.message || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: safeJSON(tc.function.arguments) });
    }
  }
  const stopMap = { stop: 'end_turn', length: 'max_tokens', tool_calls: 'tool_use', content_filter: 'max_tokens' };
  return {
    id: parsed.id || 'msg_' + now(),
    type: 'message',
    role: 'assistant',
    model: parsed.model || '',
    content,
    stop_reason: stopMap[choice.finish_reason] || 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: parsed.usage ? parsed.usage.prompt_tokens : 0,
      output_tokens: parsed.usage ? parsed.usage.completion_tokens : 0
    }
  };
}

// OpenAI SSE -> Anthropic SSE (downstream anthropic via openai upstream)
function openaiSSEToAnthropic() {
  let done = false;
  const finish = (res) => {
    if (done) return;
    done = true;
    res.write('event: content_block_stop\n');
    res.write('data: ' + JSON.stringify({ type: 'content_block_stop', index: 0 }) + '\n\n');
    res.write('event: message_delta\n');
    res.write('data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } }) + '\n\n');
    res.write('event: message_stop\n');
    res.write('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
  };
  return {
    writeHead(res) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('event: message_start\n');
      res.write('data: ' + JSON.stringify({ type: 'message_start', message: { id: 'msg_' + now(), type: 'message', role: 'assistant', model: '', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } }) + '\n\n');
      res.write('event: content_block_start\n');
      res.write('data: ' + JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) + '\n\n');
    },
    onLine(res, line) {
      if (!line.startsWith('data:')) return;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') {
        finish(res);
        return;
      }
      let data;
      try { data = JSON.parse(raw); } catch { return; }
      const choice = (data.choices || [])[0] || {};
      const delta = choice.delta || {};
      if (delta.content) {
        res.write('event: content_block_delta\n');
        res.write('data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: delta.content } }) + '\n\n');
      }
    },
    end(res) { finish(res); }
  };
}

function safeJSON(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

module.exports = {
  openaiToAnthropic,
  anthropicToOpenAI,
  anthropicSSETransformer,
  openaiToGemini,
  geminiToOpenAI,
  geminiSSETransformer,
  anthropicToOpenAIReq,
  openaiToAnthropicResp,
  openaiSSEToAnthropic,
  safeJSON
};
