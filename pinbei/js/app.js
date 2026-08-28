/* ============================================================
   拼豆库存统计 · 核心逻辑
   数据来源:拼豆消耗统计表.docx(初始库存为 docx 当前库存值)
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'pingdou-stock-v1';
  var WARN_LEVEL = 400;
  var INITIAL_TOTAL = 1000;

  var SERIES = [
    { key: 'A', name: 'A 系列', count: 26 },
    { key: 'B', name: 'B 系列', count: 32 },
    { key: 'C', name: 'C 系列', count: 29 },
    { key: 'D', name: 'D 系列', count: 26 },
    { key: 'E', name: 'E 系列', count: 24 },
    { key: 'F', name: 'F 系列', count: 25 },
    { key: 'G', name: 'G 系列', count: 21 },
    { key: 'H', name: 'H 系列', count: 23 },
    { key: 'M', name: 'M 系列', count: 15 }
  ];

  var CODE_RE = /^([A-M])(\d{2})$/;

  var QUICK_PRESETS = [10, 20, 50, 100, 200, 300];

  var state = { stock: {}, history: [] };
  var currentSeries = 'ALL';
  var toastTimer = null;
  var quickCode = null;
  var quickQty = 0;

  /* ---------- 初始化 ---------- */

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.stock) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('保存失败:' + e.message, 'bad');
    }
  }

  function init() {
    var saved = loadState();
    if (saved) {
      state = saved;
    } else {
      state = { stock: JSON.parse(JSON.stringify(PINGDOU_INITIAL)), history: [] };
      saveState();
    }
    bindEvents();
    renderAll();
  }

  /* ---------- 工具 ---------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function toast(msg, type) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function isCodeValid(code) { return CODE_RE.test(code) && PINGDOU_INITIAL.hasOwnProperty(code); }

  function totalStock() {
    var sum = 0;
    for (var k in state.stock) sum += state.stock[k] || 0;
    return sum;
  }

  function totalConsumed() {
    var sum = 0;
    state.history.forEach(function (h) { if (h.type !== 'restock') sum += h.total || 0; });
    return sum;
  }

  function lowCodes() {
    var out = [];
    for (var k in state.stock) {
      if ((state.stock[k] || 0) < WARN_LEVEL) out.push(k);
    }
    out.sort();
    return out;
  }

  /* ---------- 解析输入 ----------
     支持格式(宽松,不用逐字打斜杠):
       A01/5  A03/12  B07/3       斜杠
       A01 5  A03 12  B07 3       空格
       A01:5  A03:12              冒号
       a01/5(大小写不敏感)
     分隔符:空格 / 逗号 / 中文逗号 / 分号 / 换行 均可,混合也行
     返回 { valid: [{code, qty}], errors: [msg] }
  */
  function parseInput(text) {
    var items = [];
    var errors = [];
    var seen = {};
    var str = String(text).trim();
    if (!str) {
      errors.push('请输入消耗/补货内容');
      return { valid: items, errors: errors };
    }
    // 宽松匹配:色号 1-2 位数字(兼容 A1/F5 之类),分隔符为 / : 空格 或中英文符号
    var re = /([A-Ma-m])(\d{1,2})\s*[/:：]\s*(\d+)|([A-Ma-m])(\d{1,2})\s+(\d+)/g;
    var m, rawParts = [];
    while ((m = re.exec(str)) !== null) {
      var code, qty, raw;
      if (m[1]) { code = m[1].toUpperCase() + pad2(parseInt(m[2], 10)); qty = parseInt(m[3], 10); }
      else { code = m[4].toUpperCase() + pad2(parseInt(m[5], 10)); qty = parseInt(m[6], 10); }
      raw = m[0];
      if (isCodeValid(code)) {
        if (!seen[code]) {
          seen[code] = true;
          items.push({ code: code, qty: qty });
        }
      } else {
        errors.push('色号不存在:「' + raw + '」');
      }
    }
    if (items.length === 0) {
      errors.push('没识别到有效内容,试试 A01/5 A03/12 或 A01 5 A03 12');
      return { valid: items, errors: errors };
    }
    var invalid = items.filter(function (it) { return it.qty <= 0; });
    if (invalid.length > 0) {
      errors.push('数量需为正数');
    }
    items = items.filter(function (it) { return it.qty > 0; });
    return { valid: items, errors: errors };
  }

  /* ---------- 消耗 / 补货 ---------- */

  function doConsume(items) {
    var over = items.filter(function (it) {
      return (state.stock[it.code] || 0) < it.qty;
    });
    if (over.length > 0) {
      toast('库存不足:' + over.map(function (it) { return it.code + ' 只剩' + state.stock[it.code]; }).join(', '), 'bad');
      return false;
    }
    var total = items.reduce(function (s, it) { return s + it.qty; }, 0);
    items.forEach(function (it) { state.stock[it.code] -= it.qty; });
    state.history.unshift({
      time: Date.now(),
      items: items,
      total: total,
      type: 'consume'
    });
    saveState();
    renderAll();
    toast('已扣除 ' + total + ' 颗 ✓', 'good');
    return true;
  }

  function doRestock(items) {
    var total = items.reduce(function (s, it) { return s + it.qty; }, 0);
    items.forEach(function (it) { state.stock[it.code] += it.qty; });
    state.history.unshift({
      time: Date.now(),
      items: items,
      total: total,
      type: 'restock'
    });
    saveState();
    renderAll();
    toast('已补货 ' + total + ' 颗 ✓', 'good');
    return true;
  }

  function undoRecord(ts) {
    var idx = -1;
    for (var i = 0; i < state.history.length; i++) {
      if (state.history[i].time === ts) { idx = i; break; }
    }
    if (idx === -1) return;
    var rec = state.history[idx];
    if (rec.type === 'restock') {
      rec.items.forEach(function (it) { state.stock[it.code] -= it.qty; });
    } else {
      rec.items.forEach(function (it) { state.stock[it.code] += it.qty; });
    }
    state.history.splice(idx, 1);
    saveState();
    renderAll();
    toast('已撤销该次记录 ✓', 'good');
  }

  /* ---------- 渲染 ---------- */

  function renderAll() {
    renderStats();
    renderTabs();
    renderInventory();
    renderHistory();
  }

  function renderStats() {
    var stats = document.getElementById('stats');
    stats.innerHTML = '';
    var low = lowCodes();

    var cards = [
      { label: '总剩余库存', num: totalStock(), cls: '' },
      { label: '已消耗', num: totalConsumed(), cls: '' },
      { label: '预警色号', num: low.length, cls: low.length ? 'warn' : '' },
      { label: '色号总数', num: Object.keys(state.stock).length, cls: '' }
    ];
    cards.forEach(function (c) {
      var card = el('div', 'stat-card ' + c.cls);
      card.appendChild(el('div', 'stat-num', c.num.toLocaleString()));
      card.appendChild(el('div', 'stat-label', c.label));
      stats.appendChild(card);
    });
  }

  function renderTabs() {
    var wrap = document.getElementById('seriesTabs');
    wrap.innerHTML = '';
    var low = lowCodes();

    var defs = [{ key: 'ALL', name: '全部', warn: 0 }].concat(SERIES.map(function (s) {
      var warnCount = 0;
      for (var i = 1; i <= s.count; i++) {
        var code = s.key + pad2(i);
        if ((state.stock[code] || 0) < WARN_LEVEL) warnCount++;
      }
      return { key: s.key, name: s.name, warn: warnCount };
    })).concat([{ key: 'LOW', name: '⚠ 预警', warn: 0 }]);

    defs.forEach(function (d) {
      var btn = el('button', 'tab' + (currentSeries === d.key ? ' active' : '') + (d.warn > 0 ? ' warn-dot' : ''), d.name);
      btn.title = d.warn > 0 ? d.warn + ' 个色号预警' : '';
      btn.addEventListener('click', function () {
        currentSeries = d.key;
        renderTabs();
        renderInventory();
        scrollToInv();
      });
      wrap.appendChild(btn);
    });
  }

  function scrollToInv() {
    var inv = document.getElementById('inventory');
    var r = inv.getBoundingClientRect();
    if (r.top < 0) inv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderInventory() {
    var wrap = document.getElementById('inventory');
    wrap.innerHTML = '';
    var rendered = 0;

    function addCard(code) {
      var stock = state.stock[code] || 0;
      var warn = stock < WARN_LEVEL;
      var card = el('div', 'bead-card' + (warn ? ' low' : ''));
      var head = el('div', 'bead-head');
      head.appendChild(el('span', 'bead-code', code));
      head.appendChild(el('span', 'bead-qty', stock));
      card.appendChild(head);

      var pct = Math.min(100, Math.round(stock / INITIAL_TOTAL * 100));
      var bar = el('div', 'bead-bar');
      var fill = el('div', 'bead-fill' + (pct <= 40 ? ' low-fill' : (pct <= 60 ? ' mid' : '')));
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      card.appendChild(bar);

      card.title = code + ' 库存 ' + stock + ' 颗' + (warn ? '(低于 ' + WARN_LEVEL + ',建议补货)' : '') + ' — 点击快捷调整';
      card.addEventListener('click', function () {
        openQuick(code);
      });
      wrap.appendChild(card);
      rendered++;
    }

    if (currentSeries === 'ALL') {
      SERIES.forEach(function (s) {
        for (var i = 1; i <= s.count; i++) addCard(s.key + pad2(i));
      });
    } else if (currentSeries === 'LOW') {
      var low = lowCodes();
      low.forEach(addCard);
      if (low.length === 0) {
        wrap.appendChild(el('div', 'empty-tip', '🎉 所有色号库存充足,无预警!'));
      }
    } else {
      var def = SERIES.filter(function (s) { return s.key === currentSeries; })[0];
      if (def) {
        for (var j = 1; j <= def.count; j++) addCard(def.key + pad2(j));
      }
    }
  }

  function renderHistory() {
    var wrap = document.getElementById('history');
    wrap.innerHTML = '';
    if (state.history.length === 0) {
      wrap.appendChild(el('div', 'history-empty', '还没有记录,拼完图来记一笔吧~'));
      return;
    }
    var list = el('div', 'history-list');
    state.history.forEach(function (rec) {
      var isRestock = rec.type === 'restock';
      var item = el('div', 'history-item' + (isRestock ? ' restock' : ''));
      var left = el('div', 'history-left');
      left.appendChild(el('div', 'history-time', fmtTime(rec.time) + (isRestock ? ' · 补货' : ' · 消耗')));
      var itemsTxt = rec.items.map(function (it) {
        return it.code + '/' + it.qty;
      }).join('  ');
      left.appendChild(el('div', 'history-items', itemsTxt));
      item.appendChild(left);

      var right = el('div', 'history-right');
      var totalEl = el('span', 'history-total' + (isRestock ? ' restock' : ''), (isRestock ? '+' : '-') + rec.total + ' 颗');
      right.appendChild(totalEl);
      var undoBtn = el('button', 'secondary', '撤销');
      undoBtn.style.fontSize = '13px';
      undoBtn.style.padding = '4px 12px';
      undoBtn.addEventListener('click', function () {
        undoRecord(rec.time);
      });
      right.appendChild(undoBtn);
      item.appendChild(right);
      list.appendChild(item);
    });
    wrap.appendChild(list);
  }

  /* ---------- 快捷调整弹窗 ---------- */

  function openQuick(code) {
    quickCode = code;
    quickQty = 0;
    document.getElementById('quickCode').textContent = code;
    renderQuick();
    document.getElementById('quickMask').hidden = false;
    document.getElementById('quickInput').value = '';
    renderQuickPresets();
  }

  function closeQuick() {
    document.getElementById('quickMask').hidden = true;
    quickCode = null;
    quickQty = 0;
  }

  function renderQuick() {
    if (!quickCode) return;
    document.getElementById('quickStock').textContent = state.stock[quickCode] || 0;
    document.getElementById('quickAmount').textContent = quickQty;
  }

  function renderQuickPresets() {
    var wrap = document.getElementById('quickPresets');
    wrap.innerHTML = '';
    QUICK_PRESETS.forEach(function (v) {
      var btn = el('button', quickQty === v ? 'active' : '', '+' + v);
      btn.addEventListener('click', function () {
        quickQty = v;
        document.getElementById('quickInput').value = '';
        renderQuick();
        renderQuickPresets();
      });
      wrap.appendChild(btn);
    });
  }

  function quickApply(type) {
    if (!quickCode) return;
    if (quickQty <= 0) {
      toast('请先选择或输入数量', 'bad');
      return;
    }
    var items = [{ code: quickCode, qty: quickQty }];
    if (type === 'consume') {
      var stock = state.stock[quickCode] || 0;
      if (stock < quickQty) {
        toast('库存不足:' + quickCode + ' 只剩 ' + stock, 'bad');
        return;
      }
      doConsume(items);
    } else {
      doRestock(items);
    }
    quickQty = 0;
    document.getElementById('quickInput').value = '';
    renderQuick();
    renderQuickPresets();
  }

  /* ---------- 弹窗 ---------- */

  function confirmDlg(title, msg, onOk, okText) {
    var mask = document.getElementById('dlgMask');
    document.getElementById('dlgTitle').textContent = title;
    document.getElementById('dlgMsg').textContent = msg;
    var okBtn = document.getElementById('dlgOk');
    okBtn.textContent = okText || '确认';
    mask.hidden = false;

    function close() {
      mask.hidden = true;
      okBtn.removeEventListener('click', onOk);
      document.getElementById('dlgCancel').removeEventListener('click', close);
      mask.removeEventListener('click', onMask);
    }
    function onMask(e) { if (e.target === mask) close(); }

    okBtn.addEventListener('click', function () { close(); onOk(); });
    document.getElementById('dlgCancel').addEventListener('click', close);
    mask.addEventListener('click', onMask);
  }

  /* ---------- 导入导出 ---------- */

  function exportData() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stock: state.stock,
      history: state.history
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    a.href = url;
    a.download = '拼豆库存备份-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('已导出备份 ✓', 'good');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !data.stock || typeof data.stock !== 'object') throw new Error('不是有效的备份文件');
        var stock = {};
        for (var k in data.stock) {
          if (isCodeValid(k) && typeof data.stock[k] === 'number') stock[k] = data.stock[k];
        }
        if (Object.keys(stock).length === 0) throw new Error('备份中没有有效色号数据');
        var history = Array.isArray(data.history) ? data.history.filter(function (h) {
          return h && Array.isArray(h.items) && typeof h.total === 'number';
        }) : [];
        state = { stock: stock, history: history };
        saveState();
        renderAll();
        toast('导入成功 ✓ 共 ' + Object.keys(stock).length + ' 色号', 'good');
      } catch (e) {
        toast('导入失败:' + e.message, 'bad');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function resetAll() {
    confirmDlg('重置库存?', '将恢复为初始库存(数据源:拼豆消耗统计表.docx)并清空全部记录,此操作不可撤销。', function () {
      state = { stock: JSON.parse(JSON.stringify(PINGDOU_INITIAL)), history: [] };
      saveState();
      renderAll();
      toast('已重置为初始库存 ✓', 'good');
    }, '重置');
  }

  /* ---------- 事件 ---------- */

  function submit(mode) {
    var input = document.getElementById('consumeInput');
    var msg = document.getElementById('recordMsg');
    var result = parseInput(input.value);
    if (result.errors.length > 0) {
      msg.className = 'msg-err';
      msg.textContent = result.errors.join('\n');
      return;
    }
    if (result.valid.length === 0) return;
    msg.className = '';
    msg.textContent = '';
    input.value = '';
    if (mode === 'restock') {
      doRestock(result.valid);
    } else {
      doConsume(result.valid);
    }
  }

  function bindEvents() {
    document.getElementById('consumeBtn').addEventListener('click', function () { submit('consume'); });
    document.getElementById('restockBtn').addEventListener('click', function () { submit('restock'); });

    document.getElementById('consumeInput').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submit('consume');
      }
    });

    document.getElementById('exportBtn').addEventListener('click', exportData);

    document.getElementById('importFile').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });

    document.getElementById('resetBtn').addEventListener('click', resetAll);

    document.getElementById('quickConsume').addEventListener('click', function () { quickApply('consume'); });
    document.getElementById('quickRestock').addEventListener('click', function () { quickApply('restock'); });
    document.getElementById('quickClose').addEventListener('click', closeQuick);

    document.getElementById('quickAddNum').addEventListener('click', function () {
      var input = document.getElementById('quickInput');
      var v = parseInt(input.value, 10);
      if (!isNaN(v) && v > 0) {
        quickQty += v;
        input.value = '';
        renderQuick();
        renderQuickPresets();
      } else {
        toast('请输入有效数量', 'bad');
      }
    });

    document.getElementById('quickInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('quickAddNum').click();
      }
    });

    document.getElementById('quickMask').addEventListener('click', function (e) {
      if (e.target === this) closeQuick();
    });
  }

  /* ---------- 启动 ---------- */

  init();
})();
