'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let cache = null;

function findIndexFile() {
  const cands = [
    process.env.POLL_MODEL_INDEX,
    path.join(ROOT, 'data', 'model-index.json'),
    path.join(ROOT, '..', '..', 'aa_intelligence_index.json')
  ].filter(Boolean);
  for (const c of cands) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function loadCatalog() {
  if (cache) return cache;
  const file = findIndexFile();
  if (!file) { cache = []; return cache; }
  try {
    const arr = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    cache = Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error('[模型目录] 解析失败:', e.message);
    cache = [];
  }
  return cache;
}

function searchCatalog(q, limit) {
  const all = loadCatalog();
  const kw = String(q || '').trim().toLowerCase();
  let list = all;
  if (kw) {
    list = all.filter(m =>
      String(m.slug || '').toLowerCase().includes(kw) ||
      String(m.name || '').toLowerCase().includes(kw) ||
      String(m.creator || '').toLowerCase().includes(kw)
    );
  }
  return list.slice(0, limit || 50).map(m => ({
    slug: m.slug || '',
    name: m.name || '',
    creator: m.creator || '',
    rank: m.rank,
    reasoning: !!m.reasoning_model,
    open: !!m.open_weights,
    context: m.context_window_tokens || 0
  }));
}

module.exports = { loadCatalog, searchCatalog, findIndexFile };
