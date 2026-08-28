/* ============================================================
 * 数字航海 - Vanilla JS port
 * Originally a React + TypeScript + Vite + Tailwind app.
 * Faithfully rewritten as plain HTML / CSS / JS (no build step).
 * ============================================================ */

'use strict';

/* ============================================================
 * 1. CONSTANTS  (ported from src/types.ts)
 * ============================================================ */

const SAVE_KEY = 'number_adventure_react_save';
const SAVE_MIGRATE_KEY = 'number_adventure_react_migrated';

const SAVE_PREFIX_V1 = 'NA1:';
const SAVE_PREFIX_V2 = 'NA2:';

const _k1 = atob('TkFfU0VBXzE3Mzch');
const _k2 = atob('U0tZXzI1MjA/');

function _keyByte(i, salt) {
  const m = _k1.charCodeAt(i % _k1.length);
  const n = _k2.charCodeAt((i + 3) % _k2.length);
  return (salt + i * 7 + i * i * 3 + m * 11 + n * 5) & 0xff;
}

function _encryptBody(plain, salt, keyFn) {
  let body = '';
  for (let i = 0; i < plain.length; i++) {
    let c = plain.charCodeAt(i) ^ keyFn(i, salt);
    c = ((c << 3) | (c >>> 5)) & 0xff;
    body += String.fromCharCode(c);
  }
  return body;
}

function _decryptBody(body, salt, keyFn) {
  let plain = '';
  for (let i = 0; i < body.length; i++) {
    let c = body.charCodeAt(i);
    c = ((c >>> 3) | (c << 5)) & 0xff;
    plain += String.fromCharCode(c ^ keyFn(i, salt));
  }
  return plain;
}

function encryptSaveData(obj) {
  const salt = Math.floor(Math.random() * 0xffff);
  const plain = JSON.stringify(obj);
  return SAVE_PREFIX_V2 + salt.toString(16).padStart(4, '0') + _encryptBody(plain, salt, _keyByte);
}

function decryptSaveData(raw) {
  if (typeof raw !== 'string') return null;
  let prefix = SAVE_PREFIX_V2;
  let keyFn = _keyByte;
  if (raw.indexOf(SAVE_PREFIX_V1) === 0) {
    prefix = SAVE_PREFIX_V1;
    keyFn = function (i, salt) { return (salt + i * 7 + i * i * 3) & 0xff; };
  } else if (raw.indexOf(SAVE_PREFIX_V2) !== 0) {
    return null;
  }
  const salt = parseInt(raw.substr(prefix.length, 4), 16);
  const body = raw.substr(prefix.length + 4);
  return JSON.parse(_decryptBody(body, salt, keyFn));
}

function _saveFingerprint(data) {
  const keys = Object.keys(data).filter(function (k) { return k !== 'save_checksum' && k !== 'debug_enabled' && k !== 'save_ts'; }).sort();
  const parts = [];
  for (let i = 0; i < keys.length; i++) parts.push(keys[i] + '=' + JSON.stringify(data[keys[i]]));
  const text = parts.join('|');
  const keyText = _k1 + '~' + _k2;
  let h = 0x811c9dc5;
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    if ((i & 15) === 0) {
      h ^= keyText.charCodeAt(j % keyText.length);
      j++;
    }
  }
  h ^= keyText.charCodeAt(j % keyText.length) * 0x45d9f3b;
  return (h >>> 0).toString(16);
}

const DEFAULT_SAVE_DATA = {
  coins: 0,
  diamonds: 0,
  inventory: {},
  completed_stages: [],
  easter_eggs: [],
  total_wins: 0,
  first_completions: {},
  tutorial_done: false,
  debug_enabled: false,
  music_enabled: true,
  easy_mode: false,
  infinite_mode: false,
  suspicious_fails: 0,
  first_suspicious_comp: 0,
  double_coins_next: false,
  consecutive_fails: 0,
  save_ts: 0,
};

const GOLD_ITEMS = {
  hint_stone: { id: 'hint_stone', name: '线索石', desc: '免费获取一次高级提示', price: 24, max: 5 },
  chance_star: { id: 'chance_star', name: '机会星', desc: '增加当前关卡 1 次猜数机会', price: 60, max: 3 },
  protect_amulet: { id: 'protect_amulet', name: '守护符', desc: '下一次猜错时，不消耗猜测机会', price: 90, max: 2 },
  prophecy_scroll: { id: 'prophecy_scroll', name: '预言之卷', desc: '直接揭示目标数字的十位数', price: 130, max: 1 },
  golden_compass: { id: 'golden_compass', name: '黄金罗盘', desc: '直接将目标搜索范围缩小一半', price: 170, max: 1 },
  time_freeze: { id: 'time_freeze', name: '时光沙漏', desc: '卧底/闪电模式中增加 2 次机会或 15 秒时间', price: 70, max: 3 },
};

const DIAMOND_ITEMS = {
  diamond_star: { id: 'diamond_star', name: '钻石星', desc: '当前关卡直接增加 3 次机会', price: 18, max: 2, isDiamond: true },
  shield_dome: { id: 'shield_dome', name: '穹顶护盾', desc: '获得 3 次猜错不消耗机会的护盾', price: 24, max: 1, isDiamond: true },
  super_compass: { id: 'super_compass', name: '超级罗盘', desc: '直接将目标搜索范围缩小至 1/4', price: 30, max: 1, isDiamond: true },
  oracle_eye: { id: 'oracle_eye', name: '先知之眼', desc: '显示目标数字的 ±3 范围', price: 38, max: 1, isDiamond: true },
  revival_talisman: { id: 'revival_talisman', name: '复活符', desc: '在猜数失败时，可选择恢复一半机会复活', price: 50, max: 1, isDiamond: true },
  double_coins: { id: 'double_coins', name: '金币加倍', desc: '激活后下一场通关获得金币奖励 ×2', price: 20, max: 3, isDiamond: true },
};

const ALL_ITEMS = Object.assign({}, GOLD_ITEMS, DIAMOND_ITEMS);

/* 道具买入价: 金币道具牌价 8 折, 钻石道具原价 */
function buyPriceOf(item) {
  return item.isDiamond ? item.price : Math.floor(item.price * 0.8);
}

const ITEM_CONTEXTS = {
  hint_stone: ['stage', 'arithmetic'],
  chance_star: ['stage', 'mist', 'twin', 'arithmetic', 'mastermind'],
  protect_amulet: ['stage'],
  prophecy_scroll: ['stage'],
  golden_compass: ['stage'],
  time_freeze: ['blitz', 'arithmetic_storm'],
  diamond_star: ['stage', 'mist', 'twin', 'arithmetic', 'mastermind'],
  shield_dome: ['stage'],
  super_compass: ['stage'],
  oracle_eye: ['stage', 'twin', 'blitz', 'arithmetic'],
  revival_talisman: ['stage'],
  double_coins: ['stage', 'mist', 'twin', 'blitz', 'arithmetic', 'mastermind', 'arithmetic_storm'],
};

const EASTER_EGGS = {
  first_try: '✨ 一击入魂 (第一猜即中)',
  number_42: '42 终极答案 (猜测 42)',
  secret_fish: '🐟 银色信使 (暗号: fish/鱼)',
  inferno_master: '🔥 炼狱之主 (通关炼狱模式)',
  full_clear: '🏆 航海传说 (通关剧情模式)',
  hidden_song: '🎵 远古回响 (猜测 520/1314/777)',
  mastermind_king: '🔐 密码大师 (通关密码破译)',
  storm_master: '🌀 算术风暴之王 (通关算术风暴)',
  ultimate: '💎 万物归一 (解锁全部彩蛋)',
};

/* ============================================================
 * 平衡性配置 - 所有产出/定价/难度的单一调整入口
 * ============================================================ */
const BALANCE = {
  story_attempts: { 100: 6, 200: 7, 500: 8 },
  inferno_attempts: { 100: 5, 200: 6, 500: 7 },
  twin_attempts: 9,
  twin_attempts_easy: 12,
  mist_attempts: 8,
  arithmetic_attempts: 8,

  story_base_coins: { 100: 16, 200: 24, 500: 42 },
  inferno_base_coins: { 100: 25, 200: 35, 500: 60 },
  mist_base_coins: 34,
  arithmetic_base_coins: 38,
  twin_base_coins: 40,
  twin_lose_comp: 10,
  lose_comp_divisor: 35,
  lose_comp_min: 5,
  inferno_lose_comp_divisor: 22,
  inferno_lose_comp_min: 8,

  blitz_base_time: 60,
  blitz_easy_time_bonus: 20,
  blitz_correct_coins: 12,
  blitz_time_bonus_rate: 15,
  blitz_max_total_time: 120,
  blitz_combo_coin_cap: 30,
  blitz_diamond_chance: 0.2,
  blitz_diamond_cap_per_run: 6,

  diamond_min_ratio: 0.2,
  diamond_stage_base: { 100: 1, 200: 1, 500: 2 },
  diamond_ratio_bonus_threshold: 0.5,
  diamond_cap: 4,
  twin_diamond_chance: 0.35,
  mist_diamond_chance: 0.30,
  arithmetic_diamond_chance: 0.40,

  /* 密码破译 (Mastermind) */
  mastermind_attempts: 8,
  mastermind_base_coins: 48,
  mastermind_lose_comp: 10,
  mastermind_diamond_chance: 0.35,
  mastermind_hint_max: 2,
  mastermind_hint_costs: [1, 2],

  /* 算术风暴 (24 点限时) */
  storm_base_time: 60,
  storm_easy_time_bonus: 20,
  storm_correct_time_bonus: 10,
  storm_correct_coins: 10,
  storm_time_bonus_rate: 10,
  storm_max_total_time: 120,
  storm_combo_coin_cap: 20,
  storm_diamond_chance: 0.30,
  storm_diamond_cap_per_run: 6,
  storm_lose_comp: 5,
  storm_skip_max: 2,
  storm_skip_max_easy: 3,
  storm_level_step: 2,

  item_penalty_cap: 20,
};

const STORY_STAGES = [
  { id: 'story_100', name: '浅海海域', max_number: 100, attempts: BALANCE.story_attempts[100] },
  { id: 'story_200', name: '深海浅滩', max_number: 200, attempts: BALANCE.story_attempts[200] },
  { id: 'story_500', name: '远洋深渊', max_number: 500, attempts: BALANCE.story_attempts[500] },
];

const INFERNO_STAGES = [
  { id: 'inferno_100', name: '烈焰浅滩 (1-100)', max_number: 100, attempts: BALANCE.inferno_attempts[100] },
  { id: 'inferno_200', name: '熔岩深海 (1-200)', max_number: 200, attempts: BALANCE.inferno_attempts[200] },
  { id: 'inferno_500', name: '地狱远洋 (1-500)', max_number: 500, attempts: BALANCE.inferno_attempts[500] },
];

const FREE_STAGES = [
  { id: 'free_100', name: '浅海试炼 (1-100)', max_number: 100, attempts: BALANCE.story_attempts[100] },
  { id: 'free_200', name: '深海探险 (1-200)', max_number: 200, attempts: BALANCE.story_attempts[200] },
  { id: 'free_500', name: '远洋试炼 (1-500)', max_number: 500, attempts: BALANCE.story_attempts[500] },
];

const INFERNO_FREE_STAGES = [
  { id: 'free_inferno_100', name: '烈焰浅滩试炼', max_number: 100, attempts: BALANCE.inferno_attempts[100] },
  { id: 'free_inferno_200', name: '熔岩深海探险', max_number: 200, attempts: BALANCE.inferno_attempts[200] },
  { id: 'free_inferno_500', name: '地狱远洋试炼', max_number: 500, attempts: BALANCE.inferno_attempts[500] },
];

const ALL_STAGE_NAMES = [
  '浅海海域', '深海浅滩', '远洋深渊', '剧情模式-通关', '炼狱模式-通关',
  '双生谜题', '闪电挑战', '迷雾海域', '卧底猜数', '密码破译', '算术风暴',
];

/* ============================================================
 * 2. AUDIO MODULE  (ported from src/hooks/useGameAudio.ts)
 * ============================================================ */

function createGameAudio() {
  let audioCtx = null;
  let isMuted = false;

  function initAudio() {
    if (!audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported', e);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function setMuted(muted) { isMuted = muted; }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* 不支持振动时静默忽略 */ }
    }
  }

  function playNote(freq, durationMs) {
    if (isMuted) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Error playing note:', e);
    }
  }

  function playMelody(notes) {
    if (isMuted) return;
    let timeOffset = 0;
    notes.forEach(function (pair) {
      const freq = pair[0], dur = pair[1];
      setTimeout(function () { playNote(freq, dur); }, timeOffset);
      timeOffset += dur;
    });
  }

  function playClick() { playNote(600, 40); }
  function playWin() { vibrate(30); playMelody([[523, 80], [523, 80], [523, 80], [659, 150], [523, 150], [784, 350]]); }
  function playFail() { vibrate([30, 50, 30]); playMelody([[392, 150], [349, 150], [330, 150], [262, 350]]); }
  function playEggUnlocks() { vibrate([20, 40, 20]); playMelody([[784, 80], [784, 80], [988, 80], [988, 80], [1175, 200]]); }
  function playRandomMelody() {
    const MELODIES = [
      [[523, 100], [659, 100], [784, 100], [1047, 150], [784, 100], [659, 100], [523, 200]],
      [[262, 150], [330, 120], [392, 120], [523, 200], [392, 120], [330, 120], [262, 250]],
      [[392, 120], [440, 120], [494, 120], [523, 150], [440, 120], [392, 180]],
      [[523, 80], [587, 80], [659, 80], [698, 80], [784, 150], [659, 80], [784, 250]],
      [[262, 150], [294, 150], [330, 150], [349, 150], [392, 200], [523, 350]],
    ];
    const chosen = MELODIES[Math.floor(Math.random() * MELODIES.length)];
    playMelody(chosen);
  }

  return { initAudio, setMuted, playClick, playWin, playFail, playEggUnlocks, playRandomMelody, playNote, playMelody };
}

/* ============================================================
 * 3. ARITHMETIC ENGINE  (24 点算式求值器 + 出题求解器)
 * ============================================================ */

/* 校验并求值一个含括号的四则算式。
 * 规则: 只允许数字与 + - * / ( )，数字必须恰好等于给定牌组(每张牌用一次，禁止拼数)。
 * 返回 { ok, value, used } 或 { ok:false, reason }。
 * 暴露 evaluate24 / solve24 供单元测试与调试面板使用。 */
function evaluate24(expr, cards) {
  const text = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/x/g, '*').replace(/X/g, '*').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (/[^0-9+\-*/(\)\s]/.test(text)) return { ok: false, reason: 'illegal-chars' };

  const tokens = [];
  const re = /(\d+|[+\-*/(\)])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[1]);
  }
  if (tokens.length === 0) return { ok: false, reason: 'empty' };

  /* token 序列必须是: 数字 运算符 数字 运算符 ... (括号穿插) 的合法中缀 */
  let depth = 0;
  let expectNum = true;
  let numCount = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '(') {
      if (!expectNum) return { ok: false, reason: 'syntax' };
      depth++;
      continue;
    }
    if (t === ')') {
      depth--;
      if (depth < 0) return { ok: false, reason: 'paren' };
      expectNum = false;
      continue;
    }
    if (t === '+' || t === '-' || t === '*' || t === '/') {
      if (expectNum && t !== '-') return { ok: false, reason: 'syntax' };
      if (!expectNum) expectNum = true;
      continue;
    }
    /* 数字 */
    if (!expectNum) return { ok: false, reason: 'syntax' };
    const n = parseInt(t, 10);
    if (n < 1 || n > 99) return { ok: false, reason: 'range' };
    tokens[i] = n;
    numCount++;
    expectNum = false;
  }
  if (depth !== 0) return { ok: false, reason: 'paren' };
  if (expectNum) return { ok: false, reason: 'syntax' };

  /* 数字集合必须与牌组完全一致 (排序后逐项相等) */
  const used = tokens.filter(function (t) { return typeof t === 'number'; });
  const sortedUsed = used.slice().sort(function (a, b) { return a - b; });
  const sortedCards = cards.slice().sort(function (a, b) { return a - b; });
  if (sortedUsed.length !== sortedCards.length) return { ok: false, reason: 'card-count' };
  for (let i = 0; i < sortedUsed.length; i++) {
    if (sortedUsed[i] !== sortedCards[i]) return { ok: false, reason: 'card-mismatch' };
  }

  /* 递归下降求值: 表达式 -> 项 -> 因子 (处理负号/括号) */
  let pos = 0;
  const T = tokens.filter(function (t) { return t !== ' '; });
  function peek() { return T[pos]; }
  function next() { return T[pos++]; }
  function parseExpr() {
    let v = parseTerm();
    while (pos < T.length && (peek() === '+' || peek() === '-')) {
      const op = next();
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (pos < T.length && (peek() === '*' || peek() === '/')) {
      const op = next();
      const r = parseFactor();
      if (op === '*') v = v * r;
      else {
        if (Math.abs(r) < 1e-12) { throw new Error('div-zero'); }
        v = v / r;
      }
    }
    return v;
  }
  function parseFactor() {
    const t = peek();
    if (t === '(') { next(); const v = parseExpr(); if (peek() !== ')') throw new Error('paren'); next(); return v; }
    if (t === '-') { next(); return -parseFactor(); }
    if (typeof t === 'number') { next(); return t; }
    throw new Error('syntax');
  }

  let value;
  try {
    value = parseExpr();
    if (pos !== T.length) return { ok: false, reason: 'syntax' };
  } catch (e) {
    return { ok: false, reason: e.message === 'div-zero' ? 'div-zero' : 'syntax' };
  }
  return { ok: true, value: value, used: used };
}

/* 求解: 给定 4 张牌, 是否存在一种四则运算组合得到目标值 (默认 24)。
 * ops 可选: 限定可用运算符子集 (如 ['+','-','*'] 判断是否无需除法即可解)。
 * 枚举: 4! 数字排列 x ops^3 运算符 x 5 种括号结构。返回一个解算式或 null。 */
function solve24(cards, target, ops) {
  target = target === undefined ? 24 : target;
  ops = ops || ['+', '-', '*', '/'];
  const nums = cards.slice();
  function perms(arr) {
    if (arr.length <= 1) return [arr];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      perms(rest).forEach(function (p) { out.push([arr[i]].concat(p)); });
    }
    return out;
  }
  const PATTERNS = [
    function (a, b, c, d, o1, o2, o3) { return '((' + a + o1 + b + ')' + o2 + c + ')' + o3 + d; },
    function (a, b, c, d, o1, o2, o3) { return '(' + a + o1 + '(' + b + o2 + c + '))' + o3 + d; },
    function (a, b, c, d, o1, o2, o3) { return a + o1 + '(' + b + o2 + '(' + c + o3 + d + '))'; },
    function (a, b, c, d, o1, o2, o3) { return a + o1 + '((' + b + o2 + c + ')' + o3 + d + ')'; },
    function (a, b, c, d, o1, o2, o3) { return '(' + a + o1 + b + ')' + o2 + '(' + c + o3 + d + ')'; },
  ];
  const allPerms = perms(nums);
  for (let p = 0; p < allPerms.length; p++) {
    const A = allPerms[p];
    for (let o1 = 0; o1 < ops.length; o1++) {
      for (let o2 = 0; o2 < ops.length; o2++) {
        for (let o3 = 0; o3 < ops.length; o3++) {
          for (let pat = 0; pat < PATTERNS.length; pat++) {
            const expr = PATTERNS[pat](A[0], A[1], A[2], A[3], ops[o1], ops[o2], ops[o3]);
            const r = evaluate24(expr, nums);
            if (r.ok && Math.abs(r.value - target) < 1e-9) return expr;
          }
        }
      }
    }
  }
  return null;
}

/* 按难度等级生成一题必有解的 4 张牌:
 * level 0: 牌面 1~6, 只用 + - * 即可解 (简单)
 * level 1: 牌面 1~9, 只用 + - * 即可解 (简单)
 * level 2: 牌面 1~9, 任意四则运算 (中等)
 * level 3: 牌面 1~9, 必须用到除法 (困难) */
function generate24Puzzle(level) {
  level = level === undefined ? 2 : level;
  const opsAll = ['+', '-', '*', '/'];
  const opsNoDiv = ['+', '-', '*'];
  for (let tries = 0; tries < 300; tries++) {
    const cards = [];
    const maxCard = level <= 0 ? 6 : 9;
    for (let i = 0; i < 4; i++) cards.push(Math.floor(Math.random() * maxCard) + 1);
    let sol = null;
    if (level <= 1) {
      sol = solve24(cards, 24, opsNoDiv);
    } else if (level === 2) {
      sol = solve24(cards, 24, opsAll);
    } else {
      sol = solve24(cards, 24, opsAll);
      if (sol && solve24(cards, 24, opsNoDiv)) sol = null;
    }
    if (sol) return { cards: cards, solution: sol, level: level };
  }
  return { cards: [1, 2, 3, 4], solution: '1*2*3*4', level: level };
}

/* ============================================================
 * 3. APP STATE + SHARED SERVICES  (ported from src/App.tsx)
 * ============================================================ */

const audio = createGameAudio();
let saveData = loadSaveData();
let currentGameMode = saveData.tutorial_done ? 'menu' : 'tutorial';
let toasts = [];
let activeAnimation = null;
let currentSecretValue = null;
let currentViewUnmount = null;

const CLOUD_PID_KEY = 'na_cloud_pid';
const CLOUD_SECRET_KEY = 'na_cloud_secret';
let cloudMode = false;
let cloudOffline = false;
let verdictMode = false;
let cloudPushTimer = null;

const LEDGER_KEYS = ['coins', 'diamonds', 'inventory', 'first_completions', 'double_coins_next', 'suspicious_fails', 'first_suspicious_comp', 'consecutive_fails', 'easy_mode', 'infinite_mode'];

function applyLedger(ledger) {
  if (!ledger || typeof ledger !== 'object') return;
  const next = Object.assign({}, saveData);
  LEDGER_KEYS.forEach(function (k) { next[k] = ledger[k]; });
  saveData = next;
  writeLocalCacheOnly(next);
}

function verdictApi(path, body) {
  const pid = localStorage.getItem(CLOUD_PID_KEY);
  const secret = localStorage.getItem(CLOUD_SECRET_KEY);
  if (!pid || !secret) return Promise.resolve({ status: 401, json: { error: 'no identity' } });
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ pid: pid, secret: secret }, body)),
  }).then(function (r) {
    return r.json().then(function (j) { return { status: r.status, json: j }; });
  }).catch(function () { return { status: 0, json: { error: 'network' } }; });
}
function verdictStart(mode, stage) { return verdictApi('/api/game/start', { mode: mode, stage: stage }); }
function verdictGuess(gameId, value) { return verdictApi('/api/game/guess', { gameId: gameId, value: value }); }
function verdictHint(gameId) { return verdictApi('/api/game/hint', { gameId: gameId }); }
function verdictItem(gameId, itemId) { return verdictApi('/api/game/item', { gameId: gameId, itemId: itemId }); }
function verdictVideo(gameId) { return verdictApi('/api/game/video', { gameId: gameId }); }
function verdictFinish(gameId, reason) { return verdictApi('/api/game/finish', { gameId: gameId, reason: reason }); }

function mirrorGame(v, g) {
  if (!g) return;
  v._gameId = g.gameId;
  v._attempts = g.attempts;
  v._maxAttempts = g.maxAttempts;
  v._kmin = g.kmin;
  v._kmax = g.kmax;
  v._message = g.message;
  v._guesses = g.guesses;
  v._ended = g.ended;
  v._won = g.won;
  v._lost = g.lost;
  v._canRevive = g.canRevive;
  v._canVideo = g.canVideo;
  v._currentStage = v._currentStage || {};
  v._currentStage.max_number = g.maxNumber;
  v._currentStage.name = g.stageName;
  v._s1 = 0;
  v._s2 = 0;
}

function mirrorBlitz(v, g) {
  v._gameId = g.gameId;
  v._timeLeft = g.timeLeft;
  v._maxTime = g.timeLeft;
  v._correctCount = g.correctCount;
  v._totalRounds = g.totalRounds;
  v._difficultyLvl = g.difficultyLvl;
  v._lowBound = g.lowBound;
  v._highBound = g.highBound;
  v._chancesLeft = g.chancesLeft;
  v._message = g.message;
  v._clue = g.clue;
  v._combo = g.combo;
  v._blitzDiamonds = g.blitzDiamonds;
  v._hintsUsedThisRound = g.hintsUsedThisRound || 0;
  v._ended = g.ended;
}

function mirrorStorm(v, g) {
  v._gameId = g.gameId;
  v._timeLeft = g.timeLeft;
  v._maxTime = g.timeLeft;
  v._correctCount = g.correctCount;
  v._cards = g.cards;
  v._skipsLeft = g.skipsLeft;
  v._combo = g.combo;
  v._stormDiamonds = g.stormDiamonds;
  v._puzzleLevel = g.puzzleLevel;
  v._message = g.message;
  v._ended = g.ended;
}

function mirrorMastermind(v, g) {
  v._gameId = g.gameId;
  v._attempts = g.attempts;
  v._currentMax = g.maxAttempts;
  v._guesses = g.guesses;
  v._revealedDigits = g.revealedDigits || [];
  v._message = g.message;
  v._ended = g.ended;
  v._isWon = g.won;
}

function verdictTimer(v, onZero) {
  if (v._verdictTimer) clearInterval(v._verdictTimer);
  v._verdictTimer = setInterval(function () {
    if (v._endSignal || v._ended) { clearInterval(v._verdictTimer); v._verdictTimer = null; return; }
    if (saveData.infinite_mode) return;
    v._timeLeft = v._timeLeft - 1;
    if (v._timeLeft <= 0) {
      clearInterval(v._verdictTimer); v._verdictTimer = null;
      v._timeLeft = 0;
      if (onZero) onZero();
      return;
    }
    const el = document.getElementById('blitz-timer') || document.getElementById('storm-timer');
    if (el) {
      const min = Math.floor(v._timeLeft / 60).toString().padStart(2, '0');
      const sec = (v._timeLeft % 60).toString().padStart(2, '0');
      el.textContent = min + ':' + sec;
    }
  }, 1000);
}

function mirrorProfile(profile) {
  if (!profile || typeof profile !== 'object') return;
  const next = Object.assign({}, saveData, {
    tutorial_done: !!profile.tutorial_done,
    music_enabled: profile.music_enabled !== undefined ? profile.music_enabled : saveData.music_enabled,
    completed_stages: profile.completed_stages || saveData.completed_stages,
    easter_eggs: profile.easter_eggs || saveData.easter_eggs,
    total_wins: profile.total_wins !== undefined ? profile.total_wins : saveData.total_wins,
  });
  saveData = next;
  writeLocalCacheOnly(next);
}

function verdictFinishAlert(result, opts) {
  opts = opts || {};
  const rd = result.reward;
  const targetText = result.mastermindSecret || (result.twinTargets ? result.twinTargets.join(' 和 ') : result.target);
  if (result.won) {
    let breakdown = '💰 获得金币: 🪙 +' + rd.coins;
    if (rd.diamonds > 0) breakdown += '\n💎 获得钻石: 💎 +' + rd.diamonds;
    if (result.eggs.length > 0) breakdown += '\n🏅 彩蛋: ' + result.eggs.join(', ');
    if (result.firstTry) breakdown += '\n✨ 首猜即中！';
    showGameAlert({
      title: opts.winTitle || '🎉 破解成功！',
      tone: 'success',
      body: opts.winBody ? opts.winBody(targetText) : ('目标正为: ' + targetText + '！\n\n' + breakdown),
      buttonText: opts.buttonText || '继续 ⛵',
      onClose: opts.onClose || function () { navigate('menu'); setSecret(null); },
    });
  } else {
    showGameAlert({
      title: opts.loseTitle || '💀 挑战失败',
      tone: 'danger',
      body: (opts.loseBody ? opts.loseBody(targetText) : ('答案正为: [ ' + targetText + ' ]')) + (rd.coins > 0 ? '\n🪙 保障局发回援助物资补给：🪙 +' + rd.coins : '\n本次未能获得援助。'),
      onClose: opts.onClose || function () { navigate('menu'); setSecret(null); },
    });
  }
}

function updateCloudBadge() {
  const el = document.getElementById('cloud-badge');
  if (!el) return;
  if (!cloudMode) {
    el.textContent = '💾 本地存档';
    el.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border border-slate-500/30 bg-slate-500/10 text-slate-400';
  } else if (cloudOffline) {
    el.textContent = '📡 离线·本地缓存';
    el.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border border-amber-500/30 bg-amber-500/10 text-amber-400';
  } else {
    el.textContent = '☁️ 云端同步中';
    el.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  }
}

function writeLocalCacheOnly(data) {
  try { localStorage.setItem(SAVE_KEY, encryptSaveData(data)); } catch (e) {
    console.warn('Failed to write local cache:', e);
  }
}

async function pushCloudSave() {
  cloudPushTimer = null;
  if (!cloudMode) return;
  const pid = localStorage.getItem(CLOUD_PID_KEY);
  const secret = localStorage.getItem(CLOUD_SECRET_KEY);
  if (!pid || !secret) return;
  try {
    const body = JSON.stringify({ pid: pid, secret: secret, data: localStorage.getItem(SAVE_KEY), ts: saveData.save_ts || 0 });
    const res = await fetch('/api/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
    });
    if (!res.ok) throw new Error('PUT ' + res.status);
    cloudOffline = false;
  } catch (e) {
    cloudOffline = true;
    console.warn('Cloud push failed:', e);
  }
  updateCloudBadge();
}

function scheduleCloudPush() {
  if (!cloudMode) return;
  if (cloudPushTimer) clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(pushCloudSave, 500);
}

async function initCloudSync() {
  let healthy = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 2500);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    healthy = res.ok;
  } catch (e) { healthy = false; }
  if (!healthy) return;

  cloudMode = true;
  try {
    let pid = localStorage.getItem(CLOUD_PID_KEY);
    let secret = localStorage.getItem(CLOUD_SECRET_KEY);
    if (!pid || !secret) {
      const reg = await fetch('/api/register', { method: 'POST' });
      if (!reg.ok) throw new Error('register ' + reg.status);
      const info = await reg.json();
      pid = info.pid;
      secret = info.secret;
      localStorage.setItem(CLOUD_PID_KEY, pid);
      localStorage.setItem(CLOUD_SECRET_KEY, secret);
    }

    const got = await fetch('/api/save?pid=' + encodeURIComponent(pid) + '&secret=' + encodeURIComponent(secret));
    if (got.status === 401 || got.status === 403) {
      localStorage.removeItem(CLOUD_PID_KEY);
      localStorage.removeItem(CLOUD_SECRET_KEY);
      throw new Error('auth failed');
    }
    if (!got.ok) throw new Error('GET ' + got.status);
    const remote = await got.json();

    const localTs = saveData.save_ts || 0;
    const remoteTs = (remote && remote.data) ? (decryptSaveData(remote.data) || {}).save_ts || 0 : 0;

    if (remote && remote.data && remoteTs > localTs) {
      const parsed = decryptSaveData(remote.data);
      if (parsed && typeof parsed === 'object') {
        const merged = Object.assign({}, DEFAULT_SAVE_DATA, parsed);
        saveData = merged;
        writeLocalCacheOnly(merged);
        const nextMode = merged.tutorial_done ? 'menu' : 'tutorial';
        if (nextMode !== currentGameMode) {
          navigate(nextMode);
        } else if (document.getElementById('main-content').innerHTML) {
          navigate(currentGameMode);
        }
      }
    } else {
      scheduleCloudPush();
    }

    const leg = await fetch('/api/ledger?pid=' + encodeURIComponent(pid) + '&secret=' + encodeURIComponent(secret));
    if (leg.ok) {
      const led = await leg.json();
      verdictMode = true;
      applyLedger(led.ledger);
      if (currentGameMode === 'menu' || currentGameMode === 'tutorial') {
        navigate(currentGameMode);
      }
    }
    cloudOffline = false;
  } catch (e) {
    cloudOffline = true;
    console.warn('Cloud init failed, falling back to local cache:', e);
  }
  updateCloudBadge();
}

function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      let parsed = decryptSaveData(raw);
      if (parsed === null) parsed = JSON.parse(raw);
      const merged = Object.assign({}, DEFAULT_SAVE_DATA, parsed);
      if (merged.save_checksum) {
        const check = _saveFingerprint(merged);
        if (check !== merged.save_checksum) {
          console.warn('Anti-tamper: save checksum mismatch, resetting to defaults');
          window.setTimeout(function () { showToast('⚠️ 检测到存档数据被外部篡改，已重置为初始状态！', 'danger'); }, 0);
          updateSaveData(Object.assign({}, DEFAULT_SAVE_DATA));
          return Object.assign({}, DEFAULT_SAVE_DATA);
        }
        localStorage.setItem(SAVE_MIGRATE_KEY, '1');
        return merged;
      }
      if (localStorage.getItem(SAVE_MIGRATE_KEY)) {
        console.warn('Anti-tamper: save checksum removed, resetting to defaults');
        window.setTimeout(function () { showToast('⚠️ 检测到存档数据被外部篡改，已重置为初始状态！', 'danger'); }, 0);
        updateSaveData(Object.assign({}, DEFAULT_SAVE_DATA));
        return Object.assign({}, DEFAULT_SAVE_DATA);
      }
      localStorage.setItem(SAVE_MIGRATE_KEY, '1');
      updateSaveData(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load save data from localStorage:', e);
  }
  return Object.assign({}, DEFAULT_SAVE_DATA);
}

function updateSaveData(nextData) {
  const signed = Object.assign({}, nextData, { save_ts: Date.now(), save_checksum: _saveFingerprint(nextData) });
  saveData = signed;
  writeLocalCacheOnly(signed);
  scheduleCloudPush();
}

function showToast(msg, type) {
  type = type || 'info';
  const id = Math.random().toString();
  toasts.push({ id: id, msg: msg, type: type });
  renderToasts();
  setTimeout(function () {
    toasts = toasts.filter(function (t) { return t.id !== id; });
    renderToasts();
  }, 3200);
}

function renderToasts() {
  const container = document.getElementById('toast-container');
  if (!container) return;
  let html = '';
  toasts.forEach(function (t) {
    const cls =
      t.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/45 text-emerald-200'
      : t.type === 'gold' ? 'bg-amber-950/80 border-amber-500/45 text-amber-300'
      : t.type === 'danger' ? 'bg-red-950/80 border-red-500/45 text-red-200'
      : 'bg-slate-950/80 border-cyan-500/45 text-cyan-200';
    html += '<div class="p-3 px-5 rounded-2xl border text-center text-xs md:text-sm font-semibold shadow-lg backdrop-blur-md animate-view-in select-none ' + cls + '">' + escapeHtml(t.msg) + '</div>';
  });
  container.innerHTML = html;
}

function setSecret(val) {
  currentSecretValue = val;
  window.__current_secret__ = val;
}

/* ----- 游戏内弹窗系统 (替代原生 alert / confirm) ----- */
const uiModalStack = [];

function mountGameModal(opts) {
  const entry = {};
  const modal = document.createElement('div');
  const toneCls =
    opts.tone === 'success' ? 'text-emerald-300'
    : opts.tone === 'gold' ? 'text-amber-300'
    : opts.tone === 'danger' ? 'text-red-300'
    : 'text-cyan-300';
  const titleHtml = '<span class="' + toneCls + '">' + escapeHtml(opts.title) + '</span>';
  const closeBtn = opts.alert
    ? '<button data-ui-close class="p-1 rounded-lg border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button>'
    : '';
  const buttonsHtml = (opts.buttons || []).map(function (b, i) {
    return '<button data-ui-btn="' + i + '" class="w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ' + b.cls + '">' + b.label + '</button>';
  }).join('');

  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex justify-center items-center p-4 animate-fade-in';
  modal.innerHTML =
    '<div class="relative w-full max-w-sm bg-[#0d2438]/95 border border-cyan-500/30 rounded-3xl shadow-2xl p-5 flex flex-col gap-4 animate-modal-pop">' +
      '<div class="flex items-center justify-between gap-2 border-b border-white/5 pb-2">' + titleHtml + closeBtn + '</div>' +
      '<div class="text-xs md:text-sm text-slate-300 leading-relaxed text-left whitespace-pre-wrap max-h-[42vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">' + escapeHtml(opts.body).replace(/\n/g, '<br/>') + '</div>' +
      '<div class="flex flex-col gap-2">' + buttonsHtml + '</div>' +
    '</div>';

  function dismiss() {
    modal.remove();
    const idx = uiModalStack.indexOf(entry);
    if (idx !== -1) uiModalStack.splice(idx, 1);
  }
  function handleEscape() {
    dismiss();
    if (opts.alert) { if (opts.onClose) opts.onClose(); }
    else if (opts.onCancel) opts.onCancel();
  }
  entry.dismissRef = handleEscape;

  uiModalStack.push(entry);
  document.getElementById('main-content').appendChild(modal);
  refreshIcons();

  modal.querySelector('[data-ui-close]')?.addEventListener('click', handleEscape);
  modal.querySelectorAll('[data-ui-btn]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const b = opts.buttons[parseInt(btn.getAttribute('data-ui-btn'), 10)];
      dismiss();
      if (b.onClick) b.onClick();
    });
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) handleEscape();
  });
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && uiModalStack.length > 0) {
    uiModalStack[uiModalStack.length - 1].dismissRef();
  }
});

function showGameAlert(opts) {
  mountGameModal({
    title: opts.title,
    body: opts.body,
    tone: opts.tone || 'info',
    alert: true,
    buttons: [{ label: opts.buttonText || '确认', cls: 'bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10', onClick: function () { if (opts.onClose) opts.onClose(); } }],
    onClose: opts.onClose,
  });
}

function showGameConfirm(opts) {
  mountGameModal({
    title: opts.title,
    body: opts.body,
    tone: opts.tone || 'info',
    alert: false,
    buttons: [
      { label: opts.cancelText || '取消', cls: 'border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300', onClick: function () { if (opts.onCancel) opts.onCancel(); } },
      { label: opts.confirmText || '确认', cls: 'bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10', onClick: function () { if (opts.onConfirm) opts.onConfirm(); } },
    ],
    onCancel: opts.onCancel,
  });
}

/* ----- 银色信使彩蛋 (暗号: fish / 鱼) ----- */
function trySecretFish(input, onHit) {
  const t = String(input).trim().toLowerCase();
  if (t !== 'fish' && t !== '鱼') return false;
  triggerEgg('secret_fish');
  if (onHit) onHit();
  return true;
}

function triggerEgg(eggId) {
  if (saveData.easter_eggs.indexOf(eggId) !== -1) return;
  const nextEggs = saveData.easter_eggs.slice();
  nextEggs.push(eggId);
  audio.playEggUnlocks();
  const eggName = EASTER_EGGS[eggId] || eggId;
  showToast('🎉 解锁传奇航路彩蛋：' + eggName + '！', 'gold');
  const standardEggs = ['first_try', 'number_42', 'secret_fish', 'inferno_master', 'full_clear', 'hidden_song'];
  const hasAllOthers = standardEggs.every(function (k) { return nextEggs.indexOf(k) !== -1; });
  if (hasAllOthers && nextEggs.indexOf('ultimate') === -1) {
    nextEggs.push('ultimate');
    setTimeout(function () {
      audio.playEggUnlocks();
      showToast('💎 终极至尊彩蛋解锁：万物归一！你是真正的数字航海之王！', 'gold');
    }, 1000);
  }
  updateSaveData(Object.assign({}, saveData, { easter_eggs: nextEggs }));
}

function triggerAnimation(type, onDone) {
  activeAnimation = { type: type, callback: onDone };
  renderAnimation();
}

/* ----- small helpers ----- */
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
function updateAudioIcon() {
  const on = document.getElementById('audio-icon-on');
  const off = document.getElementById('audio-icon-off');
  if (!on || !off) return;
  if (saveData.music_enabled) { on.classList.remove('hidden'); off.classList.add('hidden'); }
  else { on.classList.add('hidden'); off.classList.remove('hidden'); }
}

/* ============================================================
 * 4. CANVAS ANIMATION  (ported from src/components/CanvasAnimation.tsx)
 * ============================================================ */

function renderAnimation() {
  const mount = document.getElementById('animation-overlay');
  if (!mount) return;
  if (!activeAnimation) { mount.innerHTML = ''; return; }
  const type = activeAnimation.type;
  const durationSec = 3.5;
  const onComplete = activeAnimation.callback;

  mount.innerHTML =
    '<div class="fixed inset-0 bg-[#061320]/96 z-[300] flex flex-col justify-center items-center">' +
      '<div class="relative border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl max-w-full p-2 bg-[#0d2438]/50 backdrop-blur-md">' +
        '<canvas id="anim-canvas" width="500" height="220" class="max-w-full h-auto rounded-xl block"></canvas>' +
      '</div>' +
      '<p class="text-cyan-400 mt-5 text-sm md:text-base font-mono tracking-wider animate-pulse text-shadow-glow">⚓ 命运之风正在指引航向... ⚓</p>' +
    '</div>';

  audio.playRandomMelody();

  const canvas = document.getElementById('anim-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const startTime = performance.now();
  const stars = [];
  for (let i = 0; i < 28; i++) {
    stars.push({ x: Math.random() * w, y: Math.random() * h, char: ['.', '*', '+'][Math.floor(Math.random() * 3)], speed: 0.8 + Math.random() * 1.4 });
  }
  let animId = null, completed = false;
  function finish() {
    if (completed) return; completed = true;
    cancelAnimationFrame(animId);
    activeAnimation = null; mount.innerHTML = '';
    onComplete();
  }
  function frame(now) {
    const elapsed = (now - startTime) / 1000;
    if (elapsed >= durationSec) { finish(); return; }
    ctx.clearRect(0, 0, w, h);
    if (type === 1) {
      ctx.fillStyle = '#061320'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4ecdc4'; ctx.font = '14px monospace';
      stars.forEach(function (s) {
        s.x -= s.speed;
        if (s.x < 0) { s.x = w; s.y = Math.random() * h; }
        if (Math.random() < 0.02) s.char = ['.', '*', '+'][Math.floor(Math.random() * 3)];
        ctx.fillText(s.char, s.x, s.y);
      });
    } else if (type === 2) {
      ctx.fillStyle = '#0a1d2e'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#4ecdc4'; ctx.lineWidth = 2;
      for (let y = 25; y < h; y += 35) {
        ctx.beginPath();
        for (let x = 0; x < w; x += 5) {
          const v = Math.sin(x / 25 + elapsed * 3 + y / 20);
          const yy = y + v * 10;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (type === 3) {
      ctx.fillStyle = '#061320'; ctx.fillRect(0, 0, w, h);
      ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        const x = (i * 110 + Math.sin(elapsed * 3 + i) * 40 + w) % w;
        const y = 35 + i * 40;
        ctx.fillStyle = '#ffd166'; ctx.fillText('🏮', x, y);
      }
    } else if (type === 4) {
      ctx.fillStyle = '#061320'; ctx.fillRect(0, 0, w, h);
      for (let a = 0; a < Math.PI * 2; a += 0.25) {
        const r = 20 + 25 * (1 + Math.sin(elapsed * 3 + a));
        const x = w / 2 + Math.cos(a + elapsed) * r;
        const y = h / 2 + Math.sin(a + elapsed * 0.7) * r * 0.6;
        ctx.fillStyle = 'hsl(' + ((a * 40 + elapsed * 30) % 360) + ', 80%, 70%)';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#061320'; ctx.fillRect(0, 0, w, h);
      const px = w / 2 + Math.sin(elapsed * 2) * (w / 3);
      ctx.fillStyle = '#22d3ee'; ctx.font = '16px monospace';
      for (let i = 0; i < 10; i++) ctx.fillText('*', px + i * 12, h / 2 + Math.sin(px / 25) * 15);
    }
    animId = requestAnimationFrame(frame);
  }
  animId = requestAnimationFrame(frame);
}

/* ============================================================
 * 5. BACKPACK MODAL  (ported from src/components/BackpackModal.tsx)
 * ============================================================ */

function openBackpack(context, onUseItem) {
  const inventory = saveData.inventory || {};
  const items = Object.keys(inventory).filter(function (id) { return id in ALL_ITEMS && inventory[id] > 0; });

  let itemsHtml = '';
  if (items.length === 0) {
    itemsHtml = '<div class="text-center py-8 flex flex-col items-center gap-2"><i data-lucide="ban" class="w-8 h-8 text-slate-500"></i><p class="text-xs text-slate-400">目前仓库中没有可使用的装备道具，请在金币商店购买。</p></div>';
  } else {
    itemsHtml = '<div class="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">';
    items.forEach(function (itemId) {
      const item = ALL_ITEMS[itemId];
      const count = inventory[itemId];
      const allowed = (ITEM_CONTEXTS[itemId] || []).indexOf(context) !== -1;
      const cardCls = allowed
        ? (item.isDiamond ? 'bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40 text-yellow-300' : 'bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border-cyan-500/20 hover:border-cyan-500/40 text-cyan-300')
        : 'bg-slate-900/50 border-slate-800/40 opacity-40 cursor-not-allowed';
      itemsHtml += '<button data-item="' + itemId + '" ' + (allowed ? '' : 'disabled') + ' class="p-3 rounded-2xl text-left border flex flex-col gap-1.5 transition-all text-xs select-none ' + cardCls + '">' +
        '<div class="font-bold flex items-center justify-between w-full"><span>' + escapeHtml(item.name) + '</span><span class="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-300 font-mono">×' + count + '</span></div>' +
        '<p class="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">' + escapeHtml(item.desc) + '</p>' +
        '<div class="text-[9px] font-bold uppercase tracking-wider mt-auto pt-1 border-t border-white/5 flex items-center justify-between"><span>' + (item.isDiamond ? '💎 钻石道具' : '🪙 金币道具') + '</span>' + (allowed ? '' : '<span class="text-red-400">🚫 雾/电失效</span>') + '</div>' +
      '</button>';
    });
    itemsHtml += '</div>';
  }

  const modal = document.createElement('div');
  modal.id = 'backpack-modal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex justify-center items-center p-4 animate-fade-in';
  modal.innerHTML =
    '<div class="relative bg-[#0d2438]/90 border border-cyan-500/30 rounded-3xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl p-5 flex flex-col gap-4 animate-modal-pop">' +
      '<div class="flex items-center justify-between border-b border-white/5 pb-2"><div class="flex items-center gap-2 text-cyan-400 font-bold text-base md:text-lg"><i data-lucide="backpack" class="w-5 h-5 shrink-0"></i> 🎒 船舱仓库</div>' +
      '<button id="bp-close" class="p-1 rounded-lg border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"><i data-lucide="x" class="w-4 h-4"></i></button></div>' +
      itemsHtml +
      '<div class="text-[10px] text-slate-500 text-center leading-relaxed font-mono">- 道具将在本次使用的猜数结算成功时计入微量负荷系数 -</div>' +
    '</div>';

  document.getElementById('main-content').appendChild(modal);
  refreshIcons();
  function closeBp() {
    modal.remove();
    document.removeEventListener('keydown', escHandler);
  }
  const escHandler = function (e) { if (e.key === 'Escape') closeBp(); };
  document.addEventListener('keydown', escHandler);
  modal.querySelector('#bp-close').addEventListener('click', closeBp);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeBp(); });
  items.forEach(function (itemId) {
    const btn = modal.querySelector('[data-item="' + itemId + '"]');
    if (!btn) return;
    const allowed = (ITEM_CONTEXTS[itemId] || []).indexOf(context) !== -1;
    if (!allowed) return;
    btn.addEventListener('click', function () { closeBp(); onUseItem(itemId); });
  });
}

/* ============================================================
 * 6. VIEWS
 * ============================================================ */

function mainEl() { return document.getElementById('main-content'); }

/* ----- 6.1 TutorialView ----- */
const TutorialView = {
  _secret: 0, _attempts: 5, _currentMax: 5, _input: '', _message: '',
  _history: [], _animUsed: false, _ended: false, _animPlayed: false,

  mount() {
    const v = this;
    if (verdictMode) {
      v._message = '⏳ 正在向裁决中枢申请新手海域...';
      v._history = []; v._ended = false; v._animPlayed = false;
      v._render();
      verdictStart('tutorial', undefined).then(function (r) {
        if (r.status === 200 && r.json.ok) {
          mirrorGame(v, r.json.game);
          v._history = v._guesses.map(function (g) { return '第 ' + (g.idx + 1) + ' 猜: ' + g.guess; });
          v._render();
        } else {
          showToast('❌ 裁决中枢连接失败', 'danger');
          navigate('menu');
        }
      });
      return;
    }
    v._secret = Math.floor(Math.random() * 10) + 1;
    v._attempts = 5; v._currentMax = 5; v._input = '';
    v._message = '⚓ 小海龟已经想好了一个 1 到 10 之间的秘密数字。你有 5 次机会，输入数字试试看吧！';
    v._history = []; v._animUsed = false; v._ended = false; v._animPlayed = false;
    setSecret(v._secret);
    v._render();
  },
  unmount() { setSecret(null); },

  _render() {
    const v = this;
    const remainingPercent = (v._attempts / v._currentMax) * 100;
    const attemptsCls = v._attempts <= 1 ? 'text-red-400 animate-pulse' : 'text-cyan-400';
    const barCls = v._attempts <= 1 ? 'bg-gradient-to-r from-red-500 to-rose-400 shadow-glow shadow-red-500/30' : 'bg-gradient-to-r from-cyan-500 to-teal-400';

    let historyHtml = '';
    if (v._history.length === 0) {
      historyHtml = '<div class="text-slate-500 text-center py-4">等待新手探测输入并反馈数据...</div>';
    } else {
      v._history.forEach(function (item) {
        historyHtml += '<div class="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-300 animate-slide-in text-center">' + escapeHtml(item) + '</div>';
      });
    }

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4' + (v._animPlayed ? '' : ' animate-view-in') + '">' +
        '<div class="flex items-center justify-between">' +
          '<h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent flex items-center gap-1.5"><i data-lucide="sparkles" class="w-5 h-5 text-cyan-400 animate-pulse"></i> 🌱 新手探险教程</h2>' +
          '<button id="tut-skip" class="text-xs py-1.5 px-3 rounded-full border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-semibold transition-all">跳过教程</button>' +
        '</div>' +
        '<div class="p-4 rounded-2xl bg-white/[0.03] border border-cyan-500/20 text-center text-xs md:text-sm text-slate-300 leading-relaxed min-h-[64px] flex items-center justify-center backdrop-blur-md" id="tut-message">' + escapeHtml(v._message) + '</div>' +
        '<div class="flex flex-col sm:flex-row items-center justify-center gap-2 self-center">' +
          '<div class="py-1.5 px-4 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold font-mono">🎯 探测目标限域：1 ~ 10</div>' +
          (saveData.debug_enabled ? '<div class="py-1.5 px-3 rounded-full border border-yellow-500/30 bg-yellow-500/15 text-yellow-300 text-xs font-extrabold font-mono animate-pulse">🔧 [DEBUG: ' + v._secret + ']</div>' : '') +
        '</div>' +
        '<div class="space-y-1">' +
          '<div class="flex justify-between items-center text-xs"><span class="text-slate-400 font-semibold">探测仓量子稳定度</span><span class="font-bold font-mono ' + attemptsCls + '" id="tut-attempts">' + v._attempts + ' / ' + v._currentMax + '</span></div>' +
          '<div class="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5 p-[1px]"><div class="h-full rounded-full transition-all duration-300 ' + barCls + '" style="width:' + remainingPercent + '%"></div></div>' +
        '</div>' +
        '<div class="flex items-center gap-2 mt-1">' +
          '<input id="tut-input" type="text" value="' + escapeHtml(v._input) + '" ' + (v._ended ? 'disabled' : '') + ' placeholder="' + (v._ended ? '教程已结束' : '输入 1-10 之间的数字...') + '" class="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:shadow-glow shadow-cyan-400/5 transition-all min-w-0" inputmode="numeric" pattern="[0-9]*" />' +
          '<button id="tut-submit" ' + (v._ended || !v._input.trim() ? 'disabled' : '') + ' class="p-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"><i data-lucide="send" class="w-5 h-5"></i></button>' +
          '<button id="tut-hint" ' + (v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-cyan-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer font-bold text-xs" title="新手线索">提示</button>' +
        '</div>' +
        '<div class="flex flex-col gap-2 mt-1">' +
          '<span class="text-xs text-slate-400 font-semibold tracking-wider uppercase">新手交叉定位反馈</span>' +
          '<div class="p-3 rounded-2xl bg-white/5 border border-white/10 max-h-[140px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 font-mono text-xs" id="tut-history">' + historyHtml + '</div>' +
        '</div>' +
      '</div>';

    refreshIcons();
    this._bind();
    v._animPlayed = true;
    const tutHist = document.getElementById('tut-history');
    if (tutHist) tutHist.scrollTop = tutHist.scrollHeight;
    const input = document.getElementById('tut-input');
    if (input && !v._ended) input.focus();
  },

  _bind() {
    const v = this;
    document.getElementById('tut-skip').addEventListener('click', function () { v._skip(); });
    const input = document.getElementById('tut-input');
    input.addEventListener('input', function (e) {
      v._input = e.target.value;
      const sb = document.getElementById('tut-submit');
      if (sb) sb.disabled = v._ended || !v._input.trim();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v._submit(); });
    document.getElementById('tut-submit').addEventListener('click', function () { v._submit(); });
    document.getElementById('tut-hint').addEventListener('click', function () { v._hint(); });
  },

  _submit() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (verdictMode) {
      const val = parseInt(v._input.trim(), 10);
      if (isNaN(val) || val < 1 || val > 10) { showToast('❌ 请输入 1 到 10 之间的有效数字', 'danger'); return; }
      v._input = '';
      verdictGuess(v._gameId, val).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '提交失败'), 'danger'); return; }
        mirrorGame(v, r.json.game);
        v._history = v._guesses.map(function (g) { return '第 ' + (g.idx + 1) + ' 猜: ' + g.guess; });
        if (r.json.game.won) {
          verdictFinish(v._gameId, 'win').then(function (fr) {
            if (fr.status === 200 && fr.json.ok) {
              applyLedger(fr.json.result.ledger);
              mirrorProfile(fr.json.profile);
              v._gameId = null;
              v._ended = true;
              const rd = fr.json.result.reward;
              showGameAlert({
                title: '🎉 恭喜！',
                tone: 'success',
                body: '你成功猜中了秘密数字！\n\n获得新手起航金币奖励: 🪙 +' + rd.coins,
                onClose: function () { navigate('menu'); setSecret(null); showToast('🎉 新手起航教程已圆满完成！', 'success'); },
              });
            }
          });
          return;
        }
        if (r.json.game.lost) { v._tutorialVideoFlow(); return; }
        v._render();
      });
      return;
    }
    const val = parseInt(v._input.trim(), 10);
    if (isNaN(val) || val < 1 || val > 10) { showToast('❌ 请输入 1 到 10 之间的有效数字', 'danger'); return; }
    const nextAttempts = v._attempts - 1;
    v._attempts = nextAttempts;
    const tryIndex = v._currentMax - nextAttempts;
    v._history.push('第 ' + tryIndex + ' 猜: ' + val);
    v._input = '';

    if (val === v._secret) {
      v._ended = true;
      audio.playWin();
      const baseVal = 8;
      const bonus = Math.max(1, 5 - tryIndex);
      const reward = baseVal + bonus * 3;
      setTimeout(function () {
        showGameAlert({
          title: '🎉 恭喜！',
          tone: 'success',
          body: '你成功猜中了数字 [ ' + v._secret + ' ]！\n\n获得新手起航金币奖励: 🪙 +' + reward,
          onClose: function () {
            updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + reward, tutorial_done: true }));
            navigate('menu'); setSecret(null);
            showToast('🎉 新手起航教程已圆满完成！', 'success');
          },
        });
      }, 200);
    } else {
      if (nextAttempts <= 0) {
        if (!v._animUsed) {
          showGameConfirm({
            title: '💡 机会耗尽',
            tone: 'info',
            body: '探测机会已耗尽！是否观看一次航海气泡动画，以额外获得 2 次新手复活机会？',
            confirmText: '观看动画 (+2 机会)',
            onConfirm: function () {
              v._animUsed = true;
              const randomType = Math.floor(Math.random() * 5) + 1;
              triggerAnimation(randomType, function () {
                v._attempts = 2; v._currentMax = v._currentMax + 2;
                v._message = '✨ 海鸥送来了气泡指针：额外机会 +2！';
                showToast('✨ 新手额外机会 +2！', 'success');
                v._render();
              });
            },
            onCancel: function () { v._endTutorialFailed(); },
          });
          return;
        }
        v._endTutorialFailed();
        return;
      } else {
        const clueText = val < v._secret ? '太小了！' : '太大了！';
        v._message = '❌ 数字 [ ' + val + ' ] ' + clueText + ' 船长，请继续微调参数。(剩余 ' + nextAttempts + ' 次机会)';
        showToast(clueText, 'danger');
      }
    }
    v._render();
  },

  _hint() {
    const v = this;
    audio.playClick();
    if (verdictMode) {
      verdictHint(v._gameId).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ 提示失败', 'danger'); return; }
        mirrorGame(v, r.json.game);
        v._render();
      });
      return;
    }
    if (v._attempts <= 1) { showToast('❌ 次数不足以兑换提示。', 'danger'); return; }
    v._attempts = v._attempts - 1;
    const isEven = v._secret % 2 === 0;
    v._message = '💡 小海龟偷偷泄密提示：目标数字是一个' + (isEven ? '偶数' : '奇数') + '！(消耗1次，剩余 ' + (v._attempts) + ' 次机会)';
    showToast('💡 获取到新手线索！', 'info');
    v._render();
  },

  _tutorialVideoFlow() {
    const v = this;
    if (v._canVideo) {
      showGameConfirm({
        title: '💡 机会耗尽',
        tone: 'info',
        body: '探测机会已耗尽！是否观看一次航海气泡动画，以获得 1 ~ 3 次新手复活机会？',
        confirmText: '观看动画',
        onConfirm: function () {
          verdictVideo(v._gameId).then(function (r) {
            if (r.status === 200) {
              mirrorGame(v, r.json.game);
              triggerAnimation(Math.floor(Math.random() * 5) + 1, function () { v._render(); });
              return;
            }
            v._endTutorialFailed();
          });
        },
        onCancel: function () { v._endTutorialFailed(); },
      });
      return;
    }
    v._endTutorialFailed();
  },

  _endTutorialFailed() {
    const v = this;
    v._ended = true;
    audio.playFail();
    if (verdictMode && v._gameId) {
      verdictFinish(v._gameId, 'lose').then(function (r) {
        if (r.status === 200 && r.json.ok) {
          applyLedger(r.json.result.ledger);
          mirrorProfile(r.json.profile);
        }
        v._gameId = null;
        showGameAlert({
          title: '💀 教程结束',
          tone: 'danger',
          body: '新手教程结束啦！\n\n别气馁，正式航行中多重装备道具会助你一臂之力！',
          onClose: function () { navigate('menu'); setSecret(null); showToast('⛵ 已跳过教程，正式进入数字自由贸易港口！', 'info'); },
        });
      });
      return;
    }
    showGameAlert({
      title: '💀 教程结束',
      tone: 'danger',
      body: '新手教程结束啦！\n\n秘密数字正为: [ ' + v._secret + ' ]。别气馁，正式航行中多重装备道具会助你一臂之力！',
      onClose: function () {
        updateSaveData(Object.assign({}, saveData, { tutorial_done: true }));
        navigate('menu'); setSecret(null);
        showToast('⛵ 已跳过教程，正式进入数字自由贸易港口！', 'info');
      },
    });
  },

  _skip() {
    updateSaveData(Object.assign({}, saveData, { tutorial_done: true }));
    if (verdictMode) {
      const pid = localStorage.getItem(CLOUD_PID_KEY);
      const secret = localStorage.getItem(CLOUD_SECRET_KEY);
      if (pid && secret) {
        fetch('/api/profile/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pid: pid, secret: secret, changes: { tutorial_done: true } }),
        }).catch(function () {});
      }
    }
    navigate('menu'); setSecret(null);
    showToast('⛵ 已跳过教程，正式进入数字自由贸易港口！', 'info');
  },
};

/* ----- 6.2 MainMenuView ----- */
const MainMenuView = {
  mount() {
    const modeBtn = function (mode, icon, iconSpin, title, desc, extra, accentCls) {
      const isRed = accentCls === 'red';
      const iconCls = isRed ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400';
      const hoverBorder = isRed ? 'hover:border-red-400/30 hover:bg-red-400/5' : 'hover:border-cyan-400/30 hover:bg-cyan-400/5';
      const titleHover = isRed ? 'group-hover:text-red-300' : 'group-hover:text-cyan-300';
      return '<button data-mode="' + mode + '" class="p-3.5 rounded-2xl border border-white/10 bg-white/5 ' + hoverBorder + ' transition-all text-left flex flex-col gap-2 relative group cursor-pointer">' +
        '<div class="p-2.5 rounded-xl ' + iconCls + ' group-hover:scale-105 transition-all self-start"><i data-lucide="' + icon + '" class="w-5 h-5 ' + (iconSpin ? 'animate-spin-slow' : '') + '"></i></div>' +
        '<div><div class="font-bold text-sm text-white ' + titleHover + ' transition-all flex items-center gap-1">' + title + (extra || '') + '</div>' +
        '<div class="text-[10px] text-slate-400 mt-0.5 leading-relaxed">' + desc + '</div></div>' +
      '</button>';
    };
    const auxBtn = function (mode, icon, label, rotate) {
      return '<button data-mode="' + mode + '" class="p-2.5 rounded-2xl border border-white/10 bg-white/5 hover:border-cyan-400/20 hover:bg-cyan-400/5 transition-all flex flex-col items-center gap-1 cursor-pointer group text-center">' +
        '<i data-lucide="' + icon + '" class="w-5 h-5 text-cyan-400 group-hover:scale-110 ' + (rotate ? 'group-hover:rotate-45' : '') + ' transition-all"></i>' +
        '<span class="text-[11px] font-bold text-slate-300">' + label + '</span>' +
      '</button>';
    };

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4 animate-view-in">' +
        '<div class="text-center space-y-1 py-1">' +
          '<h1 class="text-3xl md:text-4xl font-extrabold tracking-widest text-shadow-glow flex items-center justify-center gap-2 bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent select-none animate-float">🌊 数字航海</h1>' +
          '<p class="text-[10px] md:text-xs text-cyan-400/80 font-mono tracking-widest font-bold uppercase select-none">- Digital Navigation Adventure -</p>' +
        '</div>' +
        '<div class="h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent w-full"></div>' +
        '<div class="flex justify-center gap-3">' +
          '<div class="flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold font-mono text-sm md:text-base shadow-glow shadow-amber-500/5 animate-bump"><i data-lucide="coins" class="w-4 h-4 text-amber-400"></i>' + saveData.coins + '</div>' +
          '<div class="flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-bold font-mono text-sm md:text-base shadow-glow shadow-cyan-500/5 animate-bump"><i data-lucide="gem" class="w-4 h-4 text-cyan-400"></i>' + saveData.diamonds + '</div>' +
        '</div>' +
        '<div class="flex justify-center"><span id="cloud-badge" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border border-slate-500/30 bg-slate-500/10 text-slate-400">💾 本地存档</span></div>' +
        '<div class="space-y-1.5 mt-1">' +
          '<div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">🧭 扬帆探索</div>' +
          '<div class="grid grid-cols-2 gap-2.5">' +
            modeBtn('story', 'anchor', false, '剧情模式', '跟随老水手搜寻三大海域数字秘宝', '<i data-lucide="sparkle" class="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0"></i>', 'cyan') +
            modeBtn('free', 'compass', true, '自由海域', '自定义难度等级进行探测拉网演练', '', 'cyan') +
            modeBtn('inferno_campaign', 'flame', false, '炼狱征途', '绝无任何探测指引的严峻炼狱级考核', '<span class="text-[9px] bg-red-500/20 text-red-400 border border-red-500/20 px-1 py-0.25 rounded uppercase font-extrabold font-mono">极限</span>', 'red') +
            modeBtn('inferno_single', 'flame-kindling', false, '单关炼狱', '挑战单个无引导限制性高阶地核海域', '', 'red') +
            modeBtn('twin', 'sparkles', false, '双生谜题', '双向纬度同时定位，考验算法统筹', '', 'cyan') +
            modeBtn('blitz', 'timer', false, '闪电挑战', '时间竞速！在倒计时中连续高密度破解', '<span class="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 px-1 py-0.25 rounded uppercase font-extrabold font-mono">计时</span>', 'cyan') +
            modeBtn('mist', 'cloud-rain', false, '迷雾试炼', '界限动态飘摇，指南与常规雷达失效', '', 'cyan') +
            modeBtn('arithmetic', 'eye-off', false, '卧底猜数', '真假双数谜案，获取虚实交替探测信号', '', 'cyan') +
          '</div>' +
        '</div>' +
        '<div class="space-y-1.5 mt-1">' +
          '<div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">🧩 新航路玩法</div>' +
          '<div class="grid grid-cols-2 gap-2.5">' +
            modeBtn('mastermind', 'key', false, '密码破译', '组合推理破解 4 位海盗宝箱密码', '<span class="text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-1 py-0.25 rounded uppercase font-extrabold font-mono">推理</span>', 'cyan') +
            modeBtn('arithmetic_storm', 'sigma', false, '算术风暴', '限时四则运算凑 24 点，考验心算', '<span class="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 px-1 py-0.25 rounded uppercase font-extrabold font-mono">计时</span>', 'cyan') +
          '</div>' +
        '</div>' +
        '<div class="space-y-1.5 mt-1">' +
          '<div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">🎒 物资配给与日志</div>' +
          '<div class="grid grid-cols-3 gap-2.5">' +
            auxBtn('stats', 'bar-chart-2', '航海日志', false) +
            auxBtn('shop', 'shopping-cart', '淘金商店', false) +
            auxBtn('settings', 'settings', '航海配舱', true) +
          '</div>' +
        '</div>' +
      '</div>';

    refreshIcons();
    updateCloudBadge();
    mainEl().querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () { audio.playClick(); navigate(btn.getAttribute('data-mode')); });
    });
  },
};

/* ----- 6.3 ShopView ----- */
const ShopView = {
  _activeTab: 'buy', _shelfType: 'gold', _sellQuantities: {},

  mount() { this._activeTab = 'buy'; this._shelfType = 'gold'; this._sellQuantities = {}; this._render(); },

  _render() {
    const v = this;
    let body = '';
    if (v._activeTab === 'buy') {
      body =
        '<div class="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/5 max-w-[280px] mx-auto">' +
          '<button id="shelf-gold" class="py-1.5 px-2.5 rounded-lg text-xs font-bold font-mono transition-all ' + (v._shelfType === 'gold' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400') + '">🪙 金币商品</button>' +
          '<button id="shelf-diamond" class="py-1.5 px-2.5 rounded-lg text-xs font-bold font-mono transition-all ' + (v._shelfType === 'diamond' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400') + '">💎 钻石商品</button>' +
        '</div>' +
        '<div class="max-h-[46vh] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-white/10" id="shop-list"></div>';
    } else {
      body = v._renderSellPanel();
    }

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4 animate-view-in">' +
        '<div class="flex items-center justify-between">' +
          '<div class="flex items-center gap-3"><button id="shop-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400" title="返回菜单"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>' +
          '<h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">🏪 淘金商店</h2></div>' +
          '<div class="flex gap-2 text-xs md:text-sm">' +
            '<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold font-mono"><i data-lucide="coins" class="w-4 h-4"></i>' + saveData.coins + '</div>' +
            '<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-bold font-mono"><i data-lucide="gem" class="w-4 h-4"></i>' + saveData.diamonds + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/5">' +
          '<button id="tab-buy" class="py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ' + (v._activeTab === 'buy' ? 'bg-cyan-500 text-[#06241f] shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white') + '"><i data-lucide="shopping-cart" class="w-4 h-4"></i> 道具采买</button>' +
          '<button id="tab-sell" class="py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ' + (v._activeTab === 'sell' ? 'bg-cyan-500 text-[#06241f] shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white') + '"><i data-lucide="refresh-cw" class="w-4 h-4"></i> 物资回收</button>' +
        '</div>' +
        body +
      '</div>';

    refreshIcons();
    this._bind();
    if (v._activeTab === 'buy') this._renderBuyList();
  },

  _renderBuyList() {
    const v = this;
    const list = document.getElementById('shop-list');
    if (!list) return;
    const shelf = v._shelfType === 'gold' ? GOLD_ITEMS : DIAMOND_ITEMS;
    let html = '';
    Object.keys(shelf).forEach(function (id) {
      const item = shelf[id];
      const owned = saveData.inventory[item.id] || 0;
      const maxed = item.max > 0 && owned >= item.max;
      const finalPrice = buyPriceOf(item);
      const poor = item.isDiamond ? saveData.diamonds < finalPrice : saveData.coins < finalPrice;
      const btnCls = maxed ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
        : poor ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
        : item.isDiamond ? 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-[#06241f] border border-white/20 shadow-glow shadow-cyan-400/10'
        : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#3a2600] border border-white/20 shadow-glow shadow-amber-400/10';
      const label = maxed ? '满配' : (item.isDiamond ? '💎 ' : '🪙 ') + finalPrice + ' 购入';
      html += '<div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition-all shadow-inner-soft">' +
        '<div class="space-y-1"><div class="flex items-center gap-2"><span class="font-bold text-sm md:text-base text-white">' + escapeHtml(item.name) + '</span><span class="text-[10px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-mono">持有: ' + owned + '/' + (item.max > 0 ? item.max : '∞') + '</span></div>' +
        '<p class="text-xs text-slate-400 max-w-xs">' + escapeHtml(item.desc) + '</p></div>' +
        '<button data-buy="' + item.id + '" ' + (maxed || poor ? 'disabled' : '') + ' class="sm:self-center py-2 px-4 rounded-xl text-xs font-bold font-mono transition-all active:scale-95 ' + btnCls + '">' + label + '</button>' +
      '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('[data-buy]').forEach(function (btn) {
      btn.addEventListener('click', function () { v._buy(ALL_ITEMS[btn.getAttribute('data-buy')]); });
    });
  },

  _buy(item) {
    const v = this;
    audio.playClick();
    const currentOwned = saveData.inventory[item.id] || 0;
    if (item.max > 0 && currentOwned >= item.max) { showToast('❌ 道具 "' + item.name + '" 已达到最大仓储限制 (' + item.max + ')', 'danger'); return; }
    const price = buyPriceOf(item);
    if (item.isDiamond) { if (saveData.diamonds < price) { showToast('❌ 钻石不足，无法购买！', 'danger'); return; } }
    else { if (saveData.coins < price) { showToast('❌ 金币不足，无法购买！', 'danger'); return; } }
    const priceText = (item.isDiamond ? '💎' : '🪙') + ' ' + price;
      showGameConfirm({
        title: '🛒 确认购买',
        tone: 'info',
        body: '确认购买 "' + item.name + '" 吗？\n价格: ' + priceText,
        confirmText: priceText + ' 购入',
        onConfirm: function () {
          if (verdictMode) {
            const pid = localStorage.getItem(CLOUD_PID_KEY);
            const secret = localStorage.getItem(CLOUD_SECRET_KEY);
            if (!pid || !secret) { showToast('❌ 云端身份缺失，无法购买！', 'danger'); return; }
            fetch('/api/shop/buy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pid: pid, secret: secret, itemId: item.id }),
            }).then(function (res) { return res.json().then(function (j) { return { status: res.status, j: j }; }); })
              .then(function (r) {
                if (r.status === 200 && r.j.ok) {
                  applyLedger(r.j.ledger);
                  audio.playWin();
                  showToast('🎉 成功购买 "' + item.name + '"！', item.isDiamond ? 'gold' : 'success');
                  v._render();
                } else {
                  showToast('❌ ' + (r.j && r.j.error ? '购买失败：' + r.j.error : '购买失败，请稍后重试'), 'danger');
                }
              })
              .catch(function () { showToast('❌ 网络异常，购买失败！', 'danger'); });
            return;
          }
          const nextInv = Object.assign({}, saveData.inventory);
          nextInv[item.id] = currentOwned + 1;
          const nextCoins = item.isDiamond ? saveData.coins : saveData.coins - price;
          const nextDiamonds = item.isDiamond ? saveData.diamonds - price : saveData.diamonds;
          updateSaveData(Object.assign({}, saveData, { coins: nextCoins, diamonds: nextDiamonds, inventory: nextInv }));
          audio.playWin();
          showToast('🎉 成功购买 "' + item.name + '"！', item.isDiamond ? 'gold' : 'success');
          v._render();
        },
        onCancel: function () { showToast('🚫 已取消购买。', 'info'); },
      });
  },

  _renderSellPanel() {
    const v = this;
    const sellableItems = Object.keys(saveData.inventory).filter(function (id) { return id in ALL_ITEMS && saveData.inventory[id] > 0; });
    let listHtml = '';
    if (sellableItems.length === 0) {
      listHtml = '<div class="text-sm text-slate-500 text-center py-8">您的仓库中没有任何可以回收的物资</div>';
    } else {
      sellableItems.forEach(function (id) {
        const item = ALL_ITEMS[id];
        const count = saveData.inventory[id];
        const recyclePrice = Math.floor(buyPriceOf(item) * 0.5);
        const currentVal = v._sellQuantities[id] || 0;
        listHtml += '<div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 hover:border-white/15 transition-all shadow-inner-soft">' +
          '<div class="flex items-center justify-between text-xs font-semibold text-slate-300"><span class="flex items-center gap-1">' + (item.isDiamond ? '💎 ' : '🪙 ') + escapeHtml(item.name) + '<b class="text-[10px] text-slate-400 font-mono">(库存: ' + count + ')</b></span><span class="text-cyan-400">回收单价: ' + recyclePrice + ' ' + (item.isDiamond ? '💎' : '🪙') + '</span></div>' +
          '<div class="flex items-center gap-4"><input type="range" min="0" max="' + count + '" value="' + currentVal + '" data-sell="' + id + '" class="flex-1 accent-cyan-400 bg-white/10 rounded-lg appearance-none h-1.5 cursor-pointer" /><span class="w-8 text-center font-bold font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded text-xs" data-sellval="' + id + '">' + currentVal + '</span></div>' +
        '</div>';
      });
    }
    return '<div class="space-y-4">' +
      '<div class="p-3.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10 flex gap-2.5 text-xs text-cyan-200"><i data-lucide="alert-circle" class="w-5 h-5 shrink-0 text-cyan-400"></i><span>船长，回收部门以买入价的 <b>50%</b> 回收您的航海装备物资。回收所得款项直接结算到您的钱包中。</span></div>' +
      '<div class="max-h-[38vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10">' + listHtml + '</div>' +
      (sellableItems.length > 0 ? '<button id="sell-execute" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 font-bold text-[#06241f] shadow-glow shadow-emerald-500/15 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5"><i data-lucide="refresh-cw" class="w-4 h-4 animate-spin-slow"></i> 立即完成物资变现</button>' : '') +
    '</div>';
  },

  _bind() {
    const v = this;
    document.getElementById('shop-back').addEventListener('click', function () { audio.playClick(); navigate('menu'); });
    document.getElementById('tab-buy').addEventListener('click', function () { audio.playClick(); v._activeTab = 'buy'; v._render(); });
    document.getElementById('tab-sell').addEventListener('click', function () { audio.playClick(); v._activeTab = 'sell'; v._render(); });
    if (v._activeTab === 'buy') {
      document.getElementById('shelf-gold').addEventListener('click', function () { audio.playClick(); v._shelfType = 'gold'; v._render(); });
      document.getElementById('shelf-diamond').addEventListener('click', function () { audio.playClick(); v._shelfType = 'diamond'; v._render(); });
    } else {
      mainEl().querySelectorAll('[data-sell]').forEach(function (range) {
        range.addEventListener('input', function (e) {
          const id = range.getAttribute('data-sell');
          const val = parseInt(e.target.value) || 0;
          v._sellQuantities[id] = val;
          const valSpan = mainEl().querySelector('[data-sellval="' + id + '"]');
          if (valSpan) valSpan.textContent = val;
        });
      });
      const exec = document.getElementById('sell-execute');
      if (exec) exec.addEventListener('click', function () { v._executeSell(); });
    }
  },

  _executeSell() {
    const v = this;
    audio.playClick();
    let coinRefund = 0, diamondRefund = 0;
    const nextInv = Object.assign({}, saveData.inventory);
    let itemsProcessed = false;
    const sellReq = {};
    Object.keys(v._sellQuantities).forEach(function (id) {
      const qty = v._sellQuantities[id];
      if (qty <= 0) return;
      const item = ALL_ITEMS[id];
      if (!item) return;
      sellReq[id] = qty;
      const owned = Number(nextInv[id] || 0);
      const actualQty = Math.min(owned, qty);
      if (actualQty <= 0) return;
      itemsProcessed = true;
      const refundUnit = Math.floor(buyPriceOf(item) * 0.5);
      if (item.isDiamond) diamondRefund += refundUnit * actualQty;
      else coinRefund += refundUnit * actualQty;
      nextInv[id] = owned - actualQty;
      if (nextInv[id] <= 0) delete nextInv[id];
    });
    if (!itemsProcessed) { showToast('⚠️ 未选择回收数量。', 'info'); return; }
    if (verdictMode) {
      const pid = localStorage.getItem(CLOUD_PID_KEY);
      const secret = localStorage.getItem(CLOUD_SECRET_KEY);
      if (!pid || !secret) { showToast('❌ 云端身份缺失，无法回收！', 'danger'); return; }
      fetch('/api/shop/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: pid, secret: secret, items: sellReq }),
      }).then(function (res) { return res.json().then(function (j) { return { status: res.status, j: j }; }); })
        .then(function (r) {
          if (r.status === 200 && r.j.ok) {
            applyLedger(r.j.ledger);
            v._sellQuantities = {};
            audio.playWin();
            showToast('♻️ 成功回收物资！获得 🪙+' + r.j.coinRefund + ' 💎+' + r.j.diamondRefund, 'gold');
            v._render();
          } else {
            showToast('❌ ' + (r.j && r.j.error ? '回收失败：' + r.j.error : '回收失败，请稍后重试'), 'danger');
          }
        })
        .catch(function () { showToast('❌ 网络异常，回收失败！', 'danger'); });
      return;
    }
    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + coinRefund, diamonds: saveData.diamonds + diamondRefund, inventory: nextInv }));
    v._sellQuantities = {};
    audio.playWin();
    showToast('♻️ 成功回收物资！获得 🪙+' + coinRefund + ' 💎+' + diamondRefund, 'gold');
    v._render();
  },
};

/* ----- 6.4 StatsView ----- */
const StatsView = {
  mount() {
    const completedStages = saveData.completed_stages || [];
    const firstCompletions = Object.keys(saveData.first_completions || {}).filter(function (k) { return saveData.first_completions[k]; });
    const easterEggs = saveData.easter_eggs || [];
    const inventory = saveData.inventory || {};
    const totalEggs = Object.keys(EASTER_EGGS).length;
    const eggPercent = Math.round((easterEggs.length / totalEggs) * 100);

    let stagesHtml = completedStages.length === 0
      ? '<div class="text-xs text-slate-500 text-center py-2">暂无征服记录，快去扬帆起航吧！</div>'
      : '<div class="flex flex-wrap gap-2">' + completedStages.map(function (s) { return '<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm">✅ ' + escapeHtml(s) + '</span>'; }).join('') + '</div>';

    let firstHtml = firstCompletions.length === 0
      ? '<div class="text-xs text-slate-500 text-center py-2">尚未获得任何关卡的"首通荣耀"</div>'
      : '<div class="flex flex-wrap gap-2">' + firstCompletions.map(function (s) { return '<span class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-sm">🥇 ' + escapeHtml(s) + '</span>'; }).join('') + '</div>';

    let invHtml = Object.keys(inventory).length === 0
      ? '<div class="text-xs text-slate-500 text-center py-2">物资仓库空空如也，请在淘金商店选购</div>'
      : '<div class="grid grid-cols-2 gap-2">' + Object.keys(inventory).map(function (itemId) {
          const item = ALL_ITEMS[itemId]; if (!item) return '';
          return '<div class="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"><span class="font-semibold text-slate-200">' + (item.isDiamond ? '💎 ' : '🪙 ') + escapeHtml(item.name) + '</span><span class="font-bold text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">×' + inventory[itemId] + '</span></div>';
        }).join('') + '</div>';

    let eggsHtml = easterEggs.length === 0
      ? '<div class="text-xs text-slate-500 text-center py-1">尚未解锁任何传奇彩蛋，探索航路以发现惊喜！</div>'
      : '<div class="flex flex-col gap-2">' + easterEggs.map(function (eggId) {
          const name = EASTER_EGGS[eggId] || eggId;
          return '<div class="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-2 text-xs"><i data-lucide="award" class="w-4 h-4 text-amber-400 shrink-0"></i><span class="font-bold text-amber-300">' + escapeHtml(name) + '</span></div>';
        }).join('') + '</div>';

    mainEl().innerHTML =
      '<div class="flex flex-col gap-5 animate-view-in">' +
        '<div class="flex items-center gap-3"><button id="stats-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400" title="返回菜单"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">📊 航海日志</h2></div>' +
        '<div class="grid grid-cols-2 gap-3">' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1 shadow-inner-soft"><div class="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider"><i data-lucide="coins" class="w-4 h-4 text-amber-400"></i> 金币存量</div><span class="text-xl font-bold text-amber-300 font-mono">' + saveData.coins + '</span></div>' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1 shadow-inner-soft"><div class="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider"><i data-lucide="gem" class="w-4 h-4 text-cyan-400"></i> 钻石存量</div><span class="text-xl font-bold text-cyan-300 font-mono">' + saveData.diamonds + '</span></div>' +
        '</div>' +
        '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 shadow-inner-soft"><div class="flex items-center gap-3"><div class="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><i data-lucide="trophy" class="w-5 h-5"></i></div><div><div class="text-sm font-bold text-white">探险成就</div><div class="text-xs text-slate-400">数字宝藏搜寻历史</div></div></div><span class="text-lg font-black font-mono text-cyan-400">' + saveData.total_wins + ' 次通关</span></div>' +
        '<div class="max-h-[50vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10">' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 shadow-inner-soft"><div class="flex items-center gap-2 font-bold text-sm text-cyan-300 border-b border-white/5 pb-2"><i data-lucide="map" class="w-4 h-4"></i> ⛵ 征服的海域 (' + completedStages.length + ')</div>' + stagesHtml + '</div>' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 shadow-inner-soft"><div class="flex items-center gap-2 font-bold text-sm text-cyan-300 border-b border-white/5 pb-2"><i data-lucide="history" class="w-4 h-4"></i> 🥇 首次通关记录 (' + firstCompletions.length + ')</div>' + firstHtml + '</div>' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 shadow-inner-soft"><div class="flex items-center gap-2 font-bold text-sm text-cyan-300 border-b border-white/5 pb-2"><i data-lucide="backpack" class="w-4 h-4"></i> 🎒 船舱仓储</div>' + invHtml + '</div>' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 shadow-inner-soft"><div class="flex items-center justify-between border-b border-white/5 pb-2"><div class="flex items-center gap-2 font-bold text-sm text-cyan-300"><i data-lucide="sparkles" class="w-4 h-4"></i> 🥚 隐藏航路 (彩蛋 ' + easterEggs.length + '/' + totalEggs + ')</div><span class="text-xs font-mono font-bold text-cyan-400">' + eggPercent + '%</span></div><div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden"><div class="bg-gradient-to-r from-cyan-500 to-teal-400 h-1.5 rounded-full shadow-inner" style="width:' + eggPercent + '%"></div></div>' + eggsHtml + '</div>' +
        '</div>' +
      '</div>';

    refreshIcons();
    document.getElementById('stats-back').addEventListener('click', function () { audio.playClick(); navigate('menu'); });
  },
};

/* ----- 6.5 SettingsView ----- */
const SettingsView = {
  _showDebug: false, _currentView: 'settings', _debugOutput: '',

  mount() { this._showDebug = saveData.debug_enabled; this._currentView = 'settings'; this._debugOutput = ''; this._render(); },

  _render() {
    const v = this;
    if (v._currentView === 'settings') {
      mainEl().innerHTML =
        '<div class="flex flex-col gap-4 animate-view-in">' +
          '<div class="flex items-center gap-3"><button id="set-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400" title="返回菜单"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">⚙️ 航海配置</h2></div>' +
          '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3 shadow-inner-soft mt-1"><div class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">常规选项</div>' +
            '<button id="set-music" class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"><div class="flex items-center gap-3"><div class="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-all"><i data-lucide="' + (saveData.music_enabled ? 'volume-2' : 'volume-x') + '" class="w-5 h-5"></i></div><div><div class="text-sm font-semibold text-white">游戏音效</div><div class="text-xs text-slate-400">切换合成器音乐及触控音效</div></div></div><span class="px-2.5 py-1 text-xs font-bold rounded-lg ' + (saveData.music_enabled ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-slate-400') + '">' + (saveData.music_enabled ? '已开启' : '已静音') + '</span></button>' +
            '<button id="set-easy" class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"><div class="flex items-center gap-3"><div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-all"><i data-lucide="user" class="w-5 h-5"></i></div><div><div class="text-sm font-semibold text-white">菜鸡模式</div><div class="text-xs text-slate-400">所有关卡猜测机会+3，但结算收益降低35%</div></div></div><span class="px-2.5 py-1 text-xs font-bold rounded-lg ' + (saveData.easy_mode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400') + '">' + (saveData.easy_mode ? '已激活' : '已关闭') + '</span></button>' +
            '<button id="set-export" class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"><div class="flex items-center gap-3"><div class="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-all"><i data-lucide="download" class="w-5 h-5"></i></div><div><div class="text-sm font-semibold text-white">导出存档</div><div class="text-xs text-slate-400">将航海进度加密下载为 .dat 备份文件</div></div></div></button>' +
            '<button id="set-import" class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"><div class="flex items-center gap-3"><div class="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:scale-105 transition-all"><i data-lucide="upload" class="w-5 h-5"></i></div><div><div class="text-sm font-semibold text-white">导入存档</div><div class="text-xs text-slate-400">从 .dat 备份文件恢复航海进度（覆盖当前存档）</div></div></div></button>' +
            '<button id="set-reset" class="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/20 transition-all text-left group"><div class="flex items-center gap-3"><div class="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:scale-105 transition-all"><i data-lucide="trash-2" class="w-5 h-5"></i></div><div><div class="text-sm font-semibold text-red-400">抹除航海日志</div><div class="text-xs text-red-400/60">彻底清空金币、关卡及彩蛋进度</div></div></div></button>' +
          '</div>' +
          '<div class="flex justify-center mt-2"><span id="cloud-badge" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border border-slate-500/30 bg-slate-500/10 text-slate-400">💾 本地存档</span></div>' +
          '<div class="text-center mt-2"><span id="set-secret-trigger" class="text-[10px] text-slate-600 font-mono select-none cursor-pointer hover:text-cyan-500 transition-all">- Tap x4 to Authorize Dev Commands -</span></div>' +
          (v._showDebug ? '<button id="set-open-debug" class="mt-2 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 font-bold hover:bg-yellow-500/20 active:scale-[0.98] transition-all text-sm"><i data-lucide="wrench" class="w-4 h-4"></i> 🔧 打开开发者/调试控制面板</button>' : '') +
        '</div>';
      refreshIcons();
      updateCloudBadge();
      document.getElementById('set-back').addEventListener('click', function () { audio.playClick(); navigate('menu'); });
      document.getElementById('set-music').addEventListener('click', function () { v._toggleMusic(); });
      document.getElementById('set-easy').addEventListener('click', function () { v._toggleEasy(); });
      document.getElementById('set-export').addEventListener('click', function () { audio.playClick(); v._exportSave(); });
      document.getElementById('set-import').addEventListener('click', function () { audio.playClick(); v._importSave(); });
      document.getElementById('set-reset').addEventListener('click', function () { v._handleReset(); });
      let _secretTaps = 0;
      let _secretTapTimer = null;
      document.getElementById('set-secret-trigger').addEventListener('click', function () {
        _secretTaps++;
        if (_secretTapTimer) clearTimeout(_secretTapTimer);
        _secretTapTimer = setTimeout(function () { _secretTaps = 0; }, 1500);
        if (_secretTaps >= 4) {
          _secretTaps = 0;
          if (_secretTapTimer) clearTimeout(_secretTapTimer);
          v._forceDebugOn();
        }
      });
      const openDbg = document.getElementById('set-open-debug');
      if (openDbg) openDbg.addEventListener('click', function () { audio.playClick(); v._currentView = 'debug'; v._render(); });
    } else {
      mainEl().innerHTML =
        '<div class="flex flex-col gap-4 animate-view-in">' +
          '<div class="flex items-center gap-3"><button id="dbg-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400" title="返回常规设置"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold text-yellow-300 font-mono">🔧 开发者配置面板</h2></div>' +
          '<div class="p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-yellow-200 min-h-[48px] flex items-center justify-center text-center" id="dbg-output">' + (v._debugOutput || '💡 点击下方工具选项以执行热插拔操作') + '</div>' +
          '<div class="grid grid-cols-2 gap-2 mt-1">' +
            '<button id="dbg-answer" class="py-2 px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 active:scale-[0.97] text-cyan-300 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all"><i data-lucide="eye" class="w-3.5 h-3.5"></i> 查看当前答案</button>' +
            '<button id="dbg-infinite" class="py-2 px-3 rounded-xl border text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all ' + (saveData.infinite_mode ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300') + '"><i data-lucide="infinity" class="w-3.5 h-3.5"></i> 无限猜测: ' + (saveData.infinite_mode ? '开' : '关') + '</button>' +
            '<button id="dbg-coins" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">🪙 +500金币</button>' +
            '<button id="dbg-diamonds" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">💎 +50钻石</button>' +
            '<button id="dbg-items" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">🎒 全道具 x99</button>' +
            '<button id="dbg-eggs" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">🎉 解锁全彩蛋</button>' +
            '<button id="dbg-stages" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">🗺️ 解锁全关卡</button>' +
            '<button id="dbg-first" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">🥇 重置首通状态</button>' +
            '<button id="dbg-clearinv" class="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.97] text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all">🧹 倒空背包</button>' +
            '<button id="dbg-wipe" class="py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.97] text-red-300 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all col-span-2"><i data-lucide="database" class="w-3.5 h-3.5"></i> 一键擦除整档</button>' +
          '</div>' +
        '</div>';
      refreshIcons();
      document.getElementById('dbg-back').addEventListener('click', function () { audio.playClick(); v._currentView = 'settings'; v._render(); });
      document.getElementById('dbg-answer').addEventListener('click', function () { v._getAnswer(); });
      document.getElementById('dbg-infinite').addEventListener('click', function () { v._toggleInfinite(); });
      document.getElementById('dbg-coins').addEventListener('click', function () { v._addCoins(); });
      document.getElementById('dbg-diamonds').addEventListener('click', function () { v._addDiamonds(); });
      document.getElementById('dbg-items').addEventListener('click', function () { v._fullItems99(); });
      document.getElementById('dbg-eggs').addEventListener('click', function () { v._unlockAllEggs(); });
      document.getElementById('dbg-stages').addEventListener('click', function () { v._unlockAllStages(); });
      document.getElementById('dbg-first').addEventListener('click', function () { v._resetFirstCompletions(); });
      document.getElementById('dbg-clearinv').addEventListener('click', function () { v._clearInventory(); });
      document.getElementById('dbg-wipe').addEventListener('click', function () {
        audio.playClick();
        showGameConfirm({
          title: '💾 一键擦除整档',
          tone: 'danger',
          body: '一键格式化：将完全擦除本游所有本地存档！',
          confirmText: '确认擦除',
          onConfirm: function () { v._doReset('💾 存档已彻底重置为初始状态！'); },
        });
      });
    }
  },

  _setDebugOutput(msg) { this._debugOutput = msg; if (this._currentView === 'debug') this._render(); },
  _exportSave() {
    if (verdictMode) {
      const pid = localStorage.getItem(CLOUD_PID_KEY);
      const secret = localStorage.getItem(CLOUD_SECRET_KEY);
      if (!pid || !secret) { showToast('❌ 云端身份缺失，无法导出！', 'danger'); return; }
      fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: pid, secret: secret }),
      }).then(function (res) { return res.json().then(function (j) { return { status: res.status, json: j }; }); })
        .then(function (r) {
          if (r.status !== 200 || !r.json.ok) { showToast('❌ 导出失败：' + ((r.json && r.json.error) || '网络异常'), 'danger'); return; }
          try {
            const bin = atob(r.json.data);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '数字航海-存档.dat';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            showToast('💾 存档已由裁决中枢加密导出（密钥仅存服务器）！', 'success');
          } catch (e) {
            showToast('❌ 导出失败：' + e.message, 'danger');
          }
        })
        .catch(function () { showToast('❌ 网络异常，导出失败！', 'danger'); });
      return;
    }
    try {
      const blob = new Blob([encryptSaveData(saveData)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '数字航海-存档.dat';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showToast('💾 存档已加密导出（.dat 文件）！', 'success');
    } catch (e) {
      showToast('❌ 导出失败：' + e.message, 'danger');
    }
  },
  _importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dat,application/octet-stream';
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        if (verdictMode) {
          const pid = localStorage.getItem(CLOUD_PID_KEY);
          const secret = localStorage.getItem(CLOUD_SECRET_KEY);
          if (!pid || !secret) { showToast('❌ 云端身份缺失，无法导入！', 'danger'); return; }
          try {
            const bytes = new Uint8Array(reader.result);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            const b64 = btoa(bin);
            fetch('/api/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pid: pid, secret: secret, data: b64 }),
            }).then(function (res) { return res.json().then(function (j) { return { status: res.status, json: j }; }); })
              .then(function (r) {
                if (r.status === 200 && r.json.ok) {
                  applyLedger(r.json.ledger);
                  mirrorProfile(r.json.profile);
                  audio.setMuted(!saveData.music_enabled);
                  updateAudioIcon();
                  navigate('menu');
                  showToast('📦 存档导入成功！', 'success');
                } else {
                  showToast('❌ 存档文件无效或已损坏，导入失败！', 'danger');
                }
              })
              .catch(function () { showToast('❌ 网络异常，导入失败！', 'danger'); });
          } catch (e) {
            showToast('❌ 存档文件格式无效，导入失败！', 'danger');
          }
          return;
        }
        try {
          let text;
          if (reader.result instanceof ArrayBuffer) {
            const bytes = new Uint8Array(reader.result);
            let s = '';
            for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
            text = s;
          } else {
            text = reader.result;
          }
          const parsed = decryptSaveData(text);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bad format');
          const merged = Object.assign({}, DEFAULT_SAVE_DATA, parsed);
          updateSaveData(merged);
          audio.setMuted(!merged.music_enabled);
          updateAudioIcon();
          navigate('menu');
          showToast('📦 存档导入成功！', 'success');
        } catch (e) {
          showToast('❌ 存档文件格式无效，导入失败！', 'danger');
        }
      };
      reader.readAsArrayBuffer(file);
    });
    input.click();
  },
  _toggleMusic() {
    audio.playClick();
    const next = !saveData.music_enabled;
    if (verdictMode) {
      const pid = localStorage.getItem(CLOUD_PID_KEY);
      const secret = localStorage.getItem(CLOUD_SECRET_KEY);
      if (pid && secret) {
        fetch('/api/profile/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pid: pid, secret: secret, changes: { music_enabled: next } }),
        }).then(function (res) { return res.json().then(function (j) { return { status: res.status, j: j }; }); })
          .then(function (r) {
            if (r.status === 200 && r.j.ok) {
              saveData.music_enabled = next;
              audio.setMuted(!next);
              updateAudioIcon();
              writeLocalCacheOnly(saveData);
              this._render();
            }
          }.bind(this)).catch(function () {});
      }
      return;
    }
    updateSaveData(Object.assign({}, saveData, { music_enabled: next }));
    this._render();
  },
  _toggleEasy() {
    audio.playClick();
    const next = !saveData.easy_mode;
    if (verdictMode) {
      const pid = localStorage.getItem(CLOUD_PID_KEY);
      const secret = localStorage.getItem(CLOUD_SECRET_KEY);
      if (pid && secret) {
        fetch('/api/profile/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pid: pid, secret: secret, changes: { easy_mode: next } }),
        }).then(function (res) { return res.json().then(function (j) { return { status: res.status, j: j }; }); })
          .then(function (r) {
            if (r.status === 200 && r.j.ok) {
              applyLedger(r.j.ledger);
              this._render();
            } else {
              showToast('❌ 菜鸡模式切换失败：' + (r.j && r.j.error ? r.j.error : '网络异常'), 'danger');
            }
          }.bind(this)).catch(function () { showToast('❌ 网络异常，设置未保存！', 'danger'); });
      }
      return;
    }
    updateSaveData(Object.assign({}, saveData, { easy_mode: next }));
    this._render();
  },
  _handleReset() {
    audio.playClick();
    showGameConfirm({
      title: '⚠️ 抹除航海日志',
      tone: 'danger',
      body: '危险操作：确认要清除所有数字航海的存档进度吗？该操作无法恢复！',
      confirmText: '确认清除',
      onConfirm: function () { this._doReset('💾 航海日志及物资进度已彻底重塑初始化！'); }.bind(this),
    });
  },
  _doReset(toastMsg) {
    updateSaveData(Object.assign({}, DEFAULT_SAVE_DATA));
    currentGameMode = 'tutorial';
    this._showDebug = false;
    navigate('tutorial');
    showToast(toastMsg, 'danger');
  },
  _forceDebugOn() {
    if (verdictMode) {
      showToast('🔒 裁决模式下开发者工具已锁定，请使用本地模式调试。', 'danger');
      return;
    }
    updateSaveData(Object.assign({}, saveData, { debug_enabled: true }));
    this._showDebug = true;
    this._setDebugOutput('🔧 开发者调试面板已启用。');
    this._render();
  },
  _addCoins() { audio.playClick(); updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + 500 })); this._setDebugOutput('🪙 增加 500 金币成功！'); },
  _addDiamonds() { audio.playClick(); updateSaveData(Object.assign({}, saveData, { diamonds: saveData.diamonds + 50 })); this._setDebugOutput('💎 增加 50 钻石成功！'); },
  _unlockAllEggs() { audio.playClick(); updateSaveData(Object.assign({}, saveData, { easter_eggs: ['first_try', 'number_42', 'secret_fish', 'inferno_master', 'full_clear', 'hidden_song', 'ultimate'] })); this._setDebugOutput('🎉 解锁全彩蛋成功！'); },
  _resetFirstCompletions() { audio.playClick(); updateSaveData(Object.assign({}, saveData, { first_completions: {} })); this._setDebugOutput('🥇 重置首次通关标记成功！'); },
  _clearInventory() { audio.playClick(); updateSaveData(Object.assign({}, saveData, { inventory: {} })); this._setDebugOutput('🎒 已清空背包！'); },
  _unlockAllStages() { audio.playClick(); updateSaveData(Object.assign({}, saveData, { completed_stages: ALL_STAGE_NAMES.slice() })); this._setDebugOutput('🗺️ 成功解锁全关卡列表！'); },
  _fullItems99() {
    audio.playClick();
    updateSaveData(Object.assign({}, saveData, { inventory: { hint_stone: 99, chance_star: 99, protect_amulet: 99, prophecy_scroll: 99, golden_compass: 99, time_freeze: 99, diamond_star: 99, shield_dome: 99, super_compass: 99, oracle_eye: 99, revival_talisman: 99, double_coins: 99 } }));
    this._setDebugOutput('🎒 背包道具一键拉满 x99！');
  },
  _getAnswer() {
    audio.playClick();
    if (currentSecretValue !== null) this._setDebugOutput('🎯 当前关卡秘密答案：[ ' + currentSecretValue + ' ]');
    else this._setDebugOutput('❌ 当前没有进行中的关卡或谜题。');
  },
  _toggleInfinite() { audio.playClick(); const nextInf = !saveData.infinite_mode; updateSaveData(Object.assign({}, saveData, { infinite_mode: nextInf })); this._setDebugOutput('∞ 无限机会已' + (nextInf ? '开启' : '关闭') + '！'); },
};

/* ----- 6.6 TwinPuzzleView ----- */
const TwinPuzzleView = {
  _s1: 0, _s2: 0, _attempts: 9, _currentMax: 9, _input: '', _guesses: [],
  _ended: false, _isWon: false, _usedItems: [], _animPlayed: false,

  mount() {
    const v = this;
    if (verdictMode) {
      v._input = ''; v._guesses = []; v._ended = false; v._isWon = false; v._usedItems = [];
      v._animPlayed = false; v._message = '⏳ 正在向裁决中枢申请双生谜题...';
      v._render();
      verdictStart('twin', undefined).then(function (r) {
        if (r.status === 200 && r.json.ok) {
          mirrorGame(v, r.json.game);
          v._currentMax = v._maxAttempts;
          v._render();
        } else {
          showToast('❌ 裁决中枢连接失败', 'danger');
          navigate('menu');
        }
      });
      return;
    }
    const isEasy = saveData.easy_mode;
    v._s1 = Math.floor(Math.random() * 50) + 1;
    v._s2 = Math.floor(Math.random() * 50) + 51;
    const maxAttempts = saveData.infinite_mode ? Infinity : (isEasy ? BALANCE.twin_attempts_easy : BALANCE.twin_attempts);
    v._attempts = maxAttempts; v._currentMax = maxAttempts;
    v._input = ''; v._guesses = []; v._ended = false; v._isWon = false; v._usedItems = [];
    v._animPlayed = false;
    setSecret('双生密码: [ ' + v._s1 + ', ' + v._s2 + ' ]');
    v._render();
  },
  unmount() { setSecret(null); },

  _render() {
    const v = this;
    const inf = saveData.infinite_mode;
    const attemptsDisplay = inf ? '∞' : (v._attempts + ' / ' + v._currentMax);
    const attemptsCls = (v._attempts <= 2 && !inf) ? 'text-red-400 animate-pulse' : 'text-cyan-400';
    const remainingPercent = inf ? 100 : (v._attempts / v._currentMax) * 100;
    const barCls = (v._attempts <= 2 && !inf) ? 'bg-gradient-to-r from-red-500 to-rose-400 shadow-glow shadow-red-500/30' : 'bg-gradient-to-r from-cyan-500 to-teal-400';

    let guessesHtml = '';
    if (v._guesses.length === 0) {
      guessesHtml = '<div class="text-slate-500 text-center py-4">等待探测输入...</div>';
    } else {
      v._guesses.forEach(function (g) {
        const c1cls = g.g1 === v._s1 ? 'text-emerald-400 font-bold' : 'text-amber-400';
        const c2cls = g.g2 === v._s2 ? 'text-emerald-400 font-bold' : 'text-amber-400';
        guessesHtml += '<div class="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-slate-300 animate-slide-in"><span>探测 #' + (g.idx + 1) + ' 结果:</span><span class="flex items-center gap-3"><span class="text-slate-200">(' + g.g1 + ', ' + g.g2 + ')</span><span class="flex items-center gap-2"><span class="' + c1cls + '">' + g.c1 + '</span><span class="text-slate-600">|</span><span class="' + c2cls + '">' + g.c2 + '</span></span></span></div>';
      });
    }

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4' + (v._animPlayed ? '' : ' animate-view-in') + '">' +
        '<div class="flex items-center gap-3"><button id="twin-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">🕹️ 双生谜题</h2></div>' +
        '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2 shadow-inner-soft text-slate-300 text-xs md:text-sm leading-relaxed"><div class="flex justify-between items-center"><div class="font-bold text-cyan-300 flex items-center gap-1"><i data-lucide="sparkles" class="w-4 h-4"></i> 双维度密码搜寻</div>' + (saveData.debug_enabled ? '<div class="py-1 px-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-[10px] font-extrabold font-mono animate-pulse">🔧 [DEBUG: ' + v._s1 + ', ' + v._s2 + ']</div>' : '') + '</div>同时破解两个隐秘数字：<ul class="list-disc pl-4 space-y-0.5 text-slate-400"><li>第一个在 <b class="text-cyan-400">1 ~ 50</b> 范围之间</li><li>第二个在 <b class="text-cyan-400">51 ~ 100</b> 范围之间</li></ul>请用英文逗号分隔输入，如：<b class="font-mono text-cyan-400 bg-white/5 px-1.5 py-0.5 rounded">25, 75</b></div>' +
        '<div class="space-y-1 mt-1"><div class="flex justify-between items-center text-xs"><span class="text-slate-400 font-semibold">量子罗盘稳定度</span><span class="font-bold font-mono ' + attemptsCls + '">' + attemptsDisplay + '</span></div><div class="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5 p-[1px]"><div class="h-full rounded-full transition-all duration-300 ' + barCls + '" style="width:' + remainingPercent + '%"></div></div></div>' +
        '<div class="flex items-center gap-2 mt-1">' +
          '<input id="twin-input" type="text" value="' + escapeHtml(v._input) + '" ' + (v._ended ? 'disabled' : '') + ' placeholder="' + (v._ended ? '本局游戏已结束' : '例: 25, 75') + '" class="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:shadow-glow shadow-cyan-400/5 transition-all min-w-0" />' +
          '<button id="twin-submit" ' + (v._ended || !v._input.trim() ? 'disabled' : '') + ' class="p-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"><i data-lucide="send" class="w-5 h-5"></i></button>' +
          '<button id="twin-backpack" ' + (v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-cyan-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer" title="使用道具"><i data-lucide="backpack" class="w-5 h-5"></i></button>' +
        '</div>' +
        '<div class="flex flex-col gap-2 mt-1"><span class="text-xs text-slate-400 font-semibold tracking-wider uppercase">密码交叉定位反馈</span><div id="twin-history" class="p-3 rounded-2xl bg-white/5 border border-white/10 max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 font-mono text-xs">' + guessesHtml + '</div></div>' +
      '</div>';

    refreshIcons();
    v._animPlayed = true;
    const twinHist = document.getElementById('twin-history');
    if (twinHist) twinHist.scrollTop = twinHist.scrollHeight;
    const v2 = this;
    document.getElementById('twin-back').addEventListener('click', function () { audio.playClick(); navigate('menu'); setSecret(null); });
    const input = document.getElementById('twin-input');
    input.addEventListener('input', function (e) {
      v2._input = e.target.value;
      const sb = document.getElementById('twin-submit');
      if (sb) sb.disabled = v2._ended || !v2._input.trim();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v2._submit(); });
    document.getElementById('twin-submit').addEventListener('click', function () { v2._submit(); });
    document.getElementById('twin-backpack').addEventListener('click', function () { audio.playClick(); openBackpack('twin', function (id) { v2._useItem(id); }); });
    if (!v2._ended) input.focus();
  },

  _submit() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (verdictMode) {
      const rawInput = v._input.replace(/，/g, ',').trim();
      if (trySecretFish(rawInput, function () { v._input = ''; v._render(); })) return;
      const parts = rawInput.split(',').map(function (p) { return p.trim(); });
      if (parts.length !== 2) { showToast('❌ 格式错误！请输入用逗号分隔的两个数，例如 25, 75', 'danger'); return; }
      const g1 = parseInt(parts[0], 10);
      const g2 = parseInt(parts[1], 10);
      if (isNaN(g1) || isNaN(g2) || g1 < 1 || g1 > 50 || g2 < 51 || g2 > 100) { showToast('❌ 数值范围错误！第一个数须在 1~50，第二个数须在 51~100 之间', 'danger'); return; }
      v._input = '';
      verdictGuess(v._gameId, rawInput).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '提交失败'), 'danger'); v._render(); return; }
        mirrorGame(v, r.json.game);
        v._currentMax = v._maxAttempts;
        if (r.json.game.won) {
          verdictFinish(v._gameId, 'win').then(function (fr) {
            if (fr.status === 200 && fr.json.ok) {
              applyLedger(fr.json.result.ledger);
              mirrorProfile(fr.json.profile);
              v._gameId = null; v._ended = true;
              verdictFinishAlert(fr.json.result, { winTitle: '🎉 破解成功！', winBody: function (t) { return '双生数字：' + t + '！\n\n💰 获得金币: 🪙 +' + fr.json.result.reward.coins; } });
            }
          });
          return;
        }
        if (r.json.game.lost) {
          verdictFinish(v._gameId, 'lose').then(function (fr) {
            if (fr.status === 200 && fr.json.ok) {
              applyLedger(fr.json.result.ledger);
              v._gameId = null; v._ended = true;
              verdictFinishAlert(fr.json.result, { loseTitle: '💀 机会耗尽', loseBody: function (t) { return '双生谜题答案是：' + t + '。'; } });
            }
          });
          return;
        }
        v._render();
      });
      return;
    }
    const rawInput = v._input.replace(/，/g, ',').trim();
    if (trySecretFish(rawInput, function () {
      v._input = '';
      showToast('🐟 银色信使跃出水面，暗号已被收录！', 'gold');
      v._render();
    })) return;
    const parts = rawInput.split(',').map(function (p) { return p.trim(); });
    if (parts.length !== 2) { showToast('❌ 格式错误！请输入用逗号分隔的两个数，例如 25, 75', 'danger'); return; }
    const g1 = parseInt(parts[0], 10);
    const g2 = parseInt(parts[1], 10);
    if (isNaN(g1) || isNaN(g2)) { showToast('❌ 格式错误！输入包含非数字字符', 'danger'); return; }
    if (g1 < 1 || g1 > 50 || g2 < 51 || g2 > 100) { showToast('❌ 数值范围错误！第一个数须在 1~50，第二个数须在 51~100 之间', 'danger'); return; }
    if (g1 === 42 || g2 === 42) triggerEgg('number_42');
    if ([520, 1314, 777].indexOf(g1) !== -1 || [520, 1314, 777].indexOf(g2) !== -1) triggerEgg('hidden_song');

    const c1 = g1 === v._s1 ? '✅' : (g1 < v._s1 ? '⬆ 大一点' : '⬇ 小一点');
    const c2 = g2 === v._s2 ? '✅' : (g2 < v._s2 ? '⬆ 大一点' : '⬇ 小一点');
    v._guesses.push({ idx: v._guesses.length, g1: g1, g2: g2, c1: c1, c2: c2 });
    v._input = '';
    const isMatch = g1 === v._s1 && g2 === v._s2;

    if (isMatch) {
      v._isWon = true; v._ended = true;
      audio.playWin();
      v._handleWin(v._guesses.length);
    } else {
      if (!saveData.infinite_mode) {
        v._attempts = v._attempts - 1;
        if (v._attempts <= 0) { v._ended = true; audio.playFail(); v._handleLose(); }
        else { showToast('❌ 猜错啦！剩余 ' + v._attempts + ' 次机会', 'danger'); }
      } else {
        showToast('❌ 猜错啦！继续在无限神殿中猜测吧！', 'info');
      }
    }
    v._render();
  },

  _handleWin(totalGuesses) {
    const v = this;
    const isEasy = saveData.easy_mode;
    const baseVal = BALANCE.twin_base_coins;
    const isFirstTime = !saveData.first_completions['twin_puzzle'];
    let coins = baseVal;
    if (isFirstTime) coins *= 2;
    const remaining = v._currentMax - totalGuesses;
    let bonusPercent = 0;
    if (totalGuesses === 1) { bonusPercent = 250; triggerEgg('first_try'); }
    else if (remaining > 0) bonusPercent = Math.min(40, 15 + (remaining - 2) * 5);
    if (bonusPercent > 0) coins = Math.round(coins * (1 + bonusPercent / 100));
    const wasDouble = saveData.double_coins_next;
    if (wasDouble) coins *= 2;

    const counts = {};
    v._usedItems.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    let itemPenaltyPercent = 0;
    Object.keys(counts).forEach(function (id) {
      let total = 0;
      for (let i = 0; i < counts[id]; i++) total += (id === 'chance_star' ? 3 : id === 'diamond_star' ? 5 : 0) * Math.max(0.3, 1 - i * 0.25);
      itemPenaltyPercent += total;
    });
    itemPenaltyPercent = Math.min(BALANCE.item_penalty_cap, Math.round(itemPenaltyPercent));
    if (itemPenaltyPercent > 0) coins = Math.round(coins * (1 - itemPenaltyPercent / 100));
    if (isEasy) coins = Math.floor(coins * 0.65);

    let diamonds = 0;
    if (!saveData.infinite_mode && Math.random() < BALANCE.twin_diamond_chance) {
      diamonds = 1 + (Math.random() < 0.5 ? 1 : 0);
      if (itemPenaltyPercent > 0) diamonds = Math.round(diamonds * (1 - itemPenaltyPercent / 100));
      if (isEasy) diamonds = Math.floor(diamonds * 0.65);
    }

    const nextCompleted = saveData.completed_stages.slice();
    if (nextCompleted.indexOf('双生谜题') === -1) nextCompleted.push('双生谜题');
    const nextFirstCompletions = Object.assign({}, saveData.first_completions);
    if (isFirstTime) nextFirstCompletions['twin_puzzle'] = true;

    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + coins, diamonds: saveData.diamonds + diamonds, total_wins: saveData.total_wins + 1, completed_stages: nextCompleted, first_completions: nextFirstCompletions, double_coins_next: false }));

    const msg = '双生数字：' + v._s1 + ' 和 ' + v._s2 + '！\n\n获得金币: 🪙 +' + coins + (isFirstTime ? ' (首通红利!)' : '') + (wasDouble ? ' (金币倍增卡生效!)' : '') + (diamonds > 0 ? '\n💎 获得钻石: 💎 +' + diamonds : '') + (isEasy ? '\n⚠️ 菜鸡模式加乘：-35%' : '') + (itemPenaltyPercent > 0 ? '\n⚠️ 道具承重负荷：-' + itemPenaltyPercent + '%' : '');
    setTimeout(function () {
      showGameAlert({
        title: '🎉 破解成功！',
        tone: 'success',
        body: '双生谜题破解成功！\n\n' + msg,
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },

  _handleLose() {
    const v = this;
    const isEasy = saveData.easy_mode;
    const compBase = BALANCE.twin_lose_comp;
    const finalComp = isEasy ? Math.floor(compBase * 0.65) : compBase;
    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + finalComp }));
    setTimeout(function () {
      showGameAlert({
        title: '💀 机会耗尽',
        tone: 'danger',
        body: '双生谜题答案是：' + v._s1 + ' 和 ' + v._s2 + '。\n为您提供安慰保障：🪙 +' + finalComp + ' 金币',
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },

  _useItem(itemId) {
    const v = this;
    audio.playClick();
    if (verdictMode) {
      verdictItem(v._gameId, itemId).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '道具使用失败'), 'danger'); return; }
        mirrorGame(v, r.json.game);
        v._currentMax = v._maxAttempts;
        if (r.json.ledger) applyLedger(r.json.ledger);
        v._render();
      });
      return;
    }
    const nextInv = Object.assign({}, saveData.inventory);
    nextInv[itemId] = (nextInv[itemId] || 1) - 1;
    if (nextInv[itemId] <= 0) delete nextInv[itemId];
    v._usedItems.push(itemId);
    updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));

    if (itemId === 'chance_star') {
      if (!saveData.infinite_mode) { v._attempts += 2; v._currentMax += 2; }
      showToast('⭐ 机会星：已额外恢复 2 次极限制动猜测机会！', 'success');
    } else if (itemId === 'diamond_star') {
      if (!saveData.infinite_mode) { v._attempts += 3; v._currentMax += 3; }
      showToast('💎 钻石星：一键充能！额外恢复 3 次猜测机会！', 'gold');
    } else if (itemId === 'double_coins') {
      updateSaveData(Object.assign({}, saveData, { double_coins_next: true, inventory: nextInv }));
      showToast('💰 双倍卡：本局结算获得之金币已加倍锁定！', 'gold');
    }
    v._render();
  },
};

/* ----- 6.7 BlitzChallengeView ----- */
const BlitzChallengeView = {
  _maxTime: 60, _timeLeft: 60, _correctCount: 0, _totalRounds: 0, _difficultyLvl: 0,
  _lowBound: 0, _highBound: 0, _secret: 0, _chancesLeft: 2, _input: '', _message: '',
  _clue: '', _combo: 0, _maxCombo: 0, _comboBonusCoins: 0, _blitzDiamonds: 0,
  _ended: false, _usedItems: [], _hintsUsedThisRound: 0, _timer: null, _endSignal: false, _animPlayed: false,

  mount() {
    const v = this;
    if (verdictMode) {
      v._ended = false; v._usedItems = []; v._endSignal = false; v._animPlayed = false;
      v._message = '⏳ 正在向裁决中枢申请闪电航速波段...';
      v._render();
      verdictStart('blitz', undefined).then(function (r) {
        if (r.status === 200 && r.json.ok) {
          mirrorBlitz(v, r.json.game);
          v._render();
          verdictTimer(v, function () { v._handleGameOver(); });
        }
        else { showToast('❌ 裁决中枢连接失败', 'danger'); navigate('menu'); }
      });
      return;
    }
    const isEasy = saveData.easy_mode;
    v._maxTime = BALANCE.blitz_base_time + (isEasy ? BALANCE.blitz_easy_time_bonus : 0);
    v._timeLeft = v._maxTime;
    v._correctCount = 0; v._totalRounds = 0; v._difficultyLvl = 0;
    v._combo = 0; v._maxCombo = 0; v._comboBonusCoins = 0; v._blitzDiamonds = 0;
    v._ended = false; v._usedItems = []; v._endSignal = false; v._animPlayed = false;
    v._generateNewSecret(0);
    v._render();
    v._timer = setInterval(function () {
      if (v._endSignal) return;
      if (saveData.infinite_mode) return;
      v._timeLeft = v._timeLeft - 1;
      if (v._timeLeft <= 0) { clearInterval(v._timer); v._timer = null; v._timeLeft = 0; v._handleGameOver(); return; }
      v._updateTimer();
    }, 1000);
  },
  unmount() { this._endSignal = true; if (this._timer) { clearInterval(this._timer); this._timer = null; } setSecret(null); },

  _getRangeSize(lvl) { const base = 40 + lvl * 5; return Math.min(180, base + Math.floor(Math.random() * 21)); },

  _generateNewSecret(lvl) {
    const v = this;
    const rangeSize = v._getRangeSize(lvl);
    const rangeStart = Math.floor(Math.random() * (1000 - rangeSize)) + 1;
    const rangeEnd = rangeStart + rangeSize;
    const currentSecret = Math.floor(Math.random() * (rangeEnd - rangeStart + 1)) + rangeStart;
    v._lowBound = rangeStart; v._highBound = rangeEnd; v._secret = currentSecret;
    setSecret('闪电关卡[ 第 ' + (lvl + 1) + ' 关 ]: ' + currentSecret);
    v._chancesLeft = saveData.infinite_mode ? Infinity : 2;
    v._clue = ''; v._input = ''; v._hintsUsedThisRound = 0;
    v._message = '猜测介于 ' + rangeStart + ' ~ ' + rangeEnd + ' 之间的秘密数字';
  },

  _render() {
    const v = this;
    const inf = saveData.infinite_mode;
    const minutes = Math.floor(v._timeLeft / 60).toString().padStart(2, '0');
    const seconds = (v._timeLeft % 60).toString().padStart(2, '0');
    const isUrgent = v._timeLeft <= 10 && !inf;
    const isEasy = saveData.easy_mode;

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4' + (v._animPlayed ? '' : ' animate-view-in') + '">' +
        '<div class="flex items-center justify-between"><div class="flex items-center gap-3"><button id="blitz-quit" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-red-400" title="强制撤离退出"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">⏱️ 闪电挑战</h2></div>' + (v._blitzDiamonds > 0 ? '<span class="text-xs bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">💎 +' + v._blitzDiamonds + ' 钻石</span>' : '') + '</div>' +
        '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 shadow-inner-soft mt-1"><div class="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider"><i data-lucide="clock" class="w-4 h-4 ' + (isUrgent ? 'text-red-400 animate-spin-slow' : 'text-cyan-400') + '"></i> 量子剩余时间</div><div class="text-4xl md:text-5xl font-black font-mono tracking-widest ' + (isUrgent ? 'text-red-400 animate-pulse text-shadow-glow' : 'text-cyan-400') + '" id="blitz-timer">' + (inf ? '∞' : (minutes + ':' + seconds)) + '</div><div class="flex justify-between w-full text-xs text-slate-400 font-semibold border-t border-white/5 pt-2 px-1"><span>已破解 / 探测轮数: <b class="text-cyan-400 font-mono" id="blitz-correct">' + v._correctCount + '</b> / <span id="blitz-total">' + v._totalRounds + '</span></span>' + (v._combo >= 2 ? '<span class="text-amber-400 font-bold" id="blitz-combo">🔥 连击数: ' + v._combo + '</span>' : '') + '</div></div>' +
        '<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-cyan-500/20 flex flex-col items-center gap-1 text-center min-h-[72px] justify-center relative"><div class="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1"><i data-lucide="award" class="w-3.5 h-3.5"></i> 第 ' + (v._difficultyLvl + 1) + ' 航速波段</div><div class="text-base md:text-lg font-black font-mono text-white tracking-wide" id="blitz-range">' + v._lowBound + ' ~ ' + v._highBound + '</div>' + (saveData.debug_enabled ? '<div class="absolute top-2 right-2 py-0.5 px-2 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-[9px] font-extrabold font-mono animate-pulse">[DEBUG: ' + v._secret + ']</div>' : '') + '<div class="text-[11px] text-slate-400 leading-relaxed max-w-xs" id="blitz-message">' + escapeHtml(v._message) + '</div></div>' +
        (v._clue ? '<div class="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-xs text-cyan-300 font-mono flex items-center gap-2 animate-pop"><i data-lucide="sparkles" class="w-4 h-4 shrink-0"></i><span id="blitz-clue">' + escapeHtml(v._clue) + '</span></div>' : '') +
        '<div class="flex items-center gap-2 mt-1">' +
          '<input id="blitz-input" type="text" value="' + escapeHtml(v._input) + '" ' + (v._ended ? 'disabled' : '') + ' placeholder="' + (v._ended ? '闪电时间结束' : '输入范围内的数...') + '" class="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:shadow-glow shadow-cyan-400/5 transition-all min-w-0" />' +
          '<button id="blitz-submit" ' + (v._ended || !v._input.trim() ? 'disabled' : '') + ' class="p-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"><i data-lucide="send" class="w-5 h-5"></i></button>' +
          '<button id="blitz-backpack" ' + (v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-cyan-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer" title="使用道具"><i data-lucide="backpack" class="w-5 h-5"></i></button>' +
        '</div>' +
        (isEasy ? '<button id="blitz-hint" ' + (v._hintsUsedThisRound >= 1 || v._ended ? 'disabled' : '') + ' class="w-full py-2.5 px-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 font-semibold active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all text-xs flex items-center justify-center gap-1"><i data-lucide="shield-alert" class="w-4 h-4"></i> ' + (v._hintsUsedThisRound >= 1 ? '💡 菜鸡航标已发回一次修正定位' : '💡 获取菜鸡紧急定位线索 (本局限一次)') + '</button>' : '') +
        '<div class="flex justify-between items-center text-xs text-slate-500 mt-2 font-mono"><span id="blitz-chances">当前题机会: ' + (v._chancesLeft === Infinity ? '∞' : v._chancesLeft) + '次</span><span>每答对一题获得 +10秒时间奖励</span></div>' +
      '</div>';

    refreshIcons();
    v._animPlayed = true;
    const v2 = this;
    document.getElementById('blitz-quit').addEventListener('click', function () { v2._handleManualQuit(); });
    const input = document.getElementById('blitz-input');
    input.addEventListener('input', function (e) {
      v2._input = e.target.value;
      const sb = document.getElementById('blitz-submit');
      if (sb) sb.disabled = v2._ended || !v2._input.trim();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v2._submit(); });
    document.getElementById('blitz-submit').addEventListener('click', function () { v2._submit(); });
    document.getElementById('blitz-backpack').addEventListener('click', function () { audio.playClick(); openBackpack('blitz', function (id) { v2._useItem(id); }); });
    const hintBtn = document.getElementById('blitz-hint');
    if (hintBtn) hintBtn.addEventListener('click', function () { v2._handleEasyModeHint(); });
    if (!v2._ended) input.focus();
  },

  _updateTimer() {
    const inf = saveData.infinite_mode;
    const el = document.getElementById('blitz-timer');
    if (!el) { this._render(); return; }
    if (inf) { el.textContent = '∞'; return; }
    const minutes = Math.floor(this._timeLeft / 60).toString().padStart(2, '0');
    const seconds = (this._timeLeft % 60).toString().padStart(2, '0');
    el.textContent = minutes + ':' + seconds;
    const isUrgent = this._timeLeft <= 10 && !inf;
    el.className = 'text-4xl md:text-5xl font-black font-mono tracking-widest ' + (isUrgent ? 'text-red-400 animate-pulse text-shadow-glow' : 'text-cyan-400');
  },

  _submit() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (verdictMode) {
      const trimmedInput = v._input.trim();
      if (trySecretFish(trimmedInput, function () { v._input = ''; v._render(); })) return;
      const val = parseInt(trimmedInput, 10);
      if (isNaN(val) || val < v._lowBound || val > v._highBound) { showToast('❌ 请输入 ' + v._lowBound + ' 到 ' + v._highBound + ' 之间的合法数字', 'danger'); return; }
      v._input = '';
      verdictGuess(v._gameId, val).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '提交失败'), 'danger'); v._render(); return; }
        mirrorBlitz(v, r.json.game);
        v._render();
      });
      return;
    }
    const trimmedInput = v._input.trim();
    if (trySecretFish(trimmedInput, function () {
      v._input = '';
      showToast('🐟 银色信使跃出水面，暗号已被收录！', 'gold');
      v._render();
    })) return;
    const val = parseInt(trimmedInput, 10);
    if (isNaN(val) || val < v._lowBound || val > v._highBound) { showToast('❌ 请输入 ' + v._lowBound + ' 到 ' + v._highBound + ' 之间的合法数字', 'danger'); return; }
    v._totalRounds = v._totalRounds + 1;

    if (val === v._secret) {
      audio.playWin();
      v._correctCount = v._correctCount + 1;
      v._timeLeft = Math.min(BALANCE.blitz_max_total_time, v._timeLeft + 10);
      v._combo = v._combo + 1;
      if (v._combo > v._maxCombo) v._maxCombo = v._combo;
      let bonusText = '';
      if (v._combo >= 3) {
        const addedBonus = Math.ceil(v._combo * 2 * 1.1);
        const newTotal = Math.min(BALANCE.blitz_combo_coin_cap, v._comboBonusCoins + addedBonus);
        const actualAdded = newTotal - v._comboBonusCoins;
        v._comboBonusCoins = newTotal;
        if (actualAdded > 0) bonusText = ' 🔥连击 x' + v._combo + '! (+' + actualAdded + ' 金币)';
      }
      showToast('✅ 正确！+10秒时间奖励！' + bonusText, 'success');
      if (!saveData.infinite_mode && v._blitzDiamonds < BALANCE.blitz_diamond_cap_per_run && Math.random() < BALANCE.blitz_diamond_chance) {
        const diamondQty = 1 + (Math.random() < 0.5 ? 1 : 0);
        v._blitzDiamonds = Math.min(BALANCE.blitz_diamond_cap_per_run, v._blitzDiamonds + diamondQty);
        showToast('💎 探得隐藏钻石矿脉：+' + diamondQty + ' 钻石！', 'gold');
      }
      if (val === 42) triggerEgg('number_42');
      v._difficultyLvl = v._difficultyLvl + 1;
      v._generateNewSecret(v._difficultyLvl);
      v._render();
    } else {
      v._combo = 0;
      const diff = Math.abs(val - v._secret);
      const size = v._highBound - v._lowBound;
      let relativeHint = val < v._secret ? '⬆ 太小了' : '⬇ 太大了';
      if (diff <= Math.max(1, size * 0.08)) relativeHint += ' 🔥极近！';
      else if (diff <= Math.max(1, size * 0.2)) relativeHint += ' 🔥很近';
      else if (diff <= Math.max(1, size * 0.4)) relativeHint += ' 👍方向对';
      else relativeHint += ' 🌊较远';

      if (!saveData.infinite_mode) {
        v._chancesLeft = v._chancesLeft - 1;
        if (v._chancesLeft <= 0) {
          showToast('❌ 猜错！机会耗尽，本题答案是 ' + v._secret + '。自动跳转下一题！', 'danger');
          v._generateNewSecret(v._difficultyLvl);
          v._render();
        } else {
          v._message = relativeHint + '！剩余 ' + v._chancesLeft + ' 次猜测机会';
          v._render();
        }
      } else {
        v._message = relativeHint + '！';
        v._render();
      }
    }
  },

  _handleEasyModeHint() {
    const v = this;
    audio.playClick();
    if (verdictMode) {
      verdictHint(v._gameId).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ 提示失败', 'danger'); return; }
        mirrorBlitz(v, r.json.game);
        v._render();
      });
      return;
    }
    if (!saveData.easy_mode) return;
    if (v._hintsUsedThisRound >= 1) { showToast('❌ 本题中仅可获取 1 次菜鸡引导线索！', 'danger'); return; }
    v._hintsUsedThisRound = v._hintsUsedThisRound + 1;
    const isEven = v._secret % 2 === 0;
    const diff = v._highBound - v._lowBound;
    let textHint = '';
    if (diff <= 20) {
      textHint = '💡 个位数是 ' + (v._secret % 10) + '，且是一个' + (isEven ? '偶数' : '奇数');
    } else {
      const segmentSize = Math.floor(diff / 4);
      let lowerHintBound = v._lowBound, upperHintBound = v._highBound;
      if (v._secret <= v._lowBound + segmentSize) upperHintBound = v._lowBound + segmentSize;
      else if (v._secret <= v._lowBound + segmentSize * 2) { lowerHintBound = v._lowBound + segmentSize + 1; upperHintBound = v._lowBound + segmentSize * 2; }
      else if (v._secret <= v._lowBound + segmentSize * 3) { lowerHintBound = v._lowBound + segmentSize * 2 + 1; upperHintBound = v._lowBound + segmentSize * 3; }
      else lowerHintBound = v._lowBound + segmentSize * 3 + 1;
      textHint = '💡 在 ' + lowerHintBound + '~' + upperHintBound + ' 范围内，且是一个' + (isEven ? '偶数' : '奇数');
    }
    v._clue = textHint;
    showToast('💡 菜鸡罗盘发回修正信号！', 'success');
    v._render();
  },

  _useItem(itemId) {
    const v = this;
    audio.playClick();
    if (verdictMode) {
      verdictItem(v._gameId, itemId).then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '道具使用失败'), 'danger'); return; }
        mirrorBlitz(v, r.json.game);
        if (r.json.ledger) applyLedger(r.json.ledger);
        v._render();
      });
      return;
    }
    const nextInv = Object.assign({}, saveData.inventory);
    nextInv[itemId] = (nextInv[itemId] || 1) - 1;
    if (nextInv[itemId] <= 0) delete nextInv[itemId];
    v._usedItems.push(itemId);
    updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));

    if (itemId === 'time_freeze') { v._timeLeft += 15; showToast('⏱️ 时光沙漏：已额外向沙漏注入 15 秒紧急挑战时间！', 'success'); }
    else if (itemId === 'diamond_star') { v._timeLeft += 20; showToast('💎 钻石星：核心重塑，时间注入 20 秒！', 'gold'); }
    else if (itemId === 'oracle_eye') { v._clue = '👁️ 先知之眼：极密情报，秘密数字在 [' + Math.max(v._lowBound, v._secret - 3) + ' ~ ' + Math.min(v._highBound, v._secret + 3) + '] 之间！'; showToast('👁️ 先知之眼已展开全息窥探！', 'gold'); }
    else if (itemId === 'double_coins') { updateSaveData(Object.assign({}, saveData, { double_coins_next: true, inventory: nextInv })); showToast('💰 双倍结算倍增器已启动并待命！', 'gold'); }
    v._render();
  },

  _handleManualQuit() {
    const v = this;
    showGameConfirm({
      title: '⏱️ 强制撤离',
      tone: 'danger',
      body: '确认现在退出闪电挑战吗？已有成果将进行部分折算结算。',
      confirmText: '确认撤离',
      onConfirm: function () { v._handleGameOver(); },
    });
  },

  _handleGameOver() {
    const v = this;
    if (v._endSignal) return;
    v._endSignal = true;
    if (v._timer) { clearInterval(v._timer); v._timer = null; }
    if (v._verdictTimer) { clearInterval(v._verdictTimer); v._verdictTimer = null; }
    v._ended = true;
    if (verdictMode) {
      if (!v._gameId) { navigate('menu'); setSecret(null); return; }
      const gid = v._gameId;
      v._gameId = null;
      verdictFinish(gid, 'quit').then(function (r) {
        if (r.status !== 200 || !r.json.ok) { showToast('❌ 结算失败：' + ((r.json && r.json.error) || '网络异常'), 'danger'); navigate('menu'); return; }
        applyLedger(r.json.result.ledger);
        mirrorProfile(r.json.profile);
        const rd = r.json.result.reward;
        if (rd.coins <= 0 && rd.diamonds <= 0) {
          showGameAlert({ title: '⏱️ 时间到', tone: 'danger', body: '本次闪电征途结算完成，无探险奖励。', onClose: function () { navigate('menu'); setSecret(null); } });
          return;
        }
        showGameAlert({ title: '⏱️ 时间到！', tone: 'success', body: '闪电时间到！探险舱关闭！\n\n结算物资:\n🪙 +' + rd.coins + ' 金币' + (rd.diamonds > 0 ? '\n💎 +' + rd.diamonds + ' 钻石' : ''), onClose: function () { navigate('menu'); setSecret(null); } });
      });
      return;
    }
    const isEasy = saveData.easy_mode;

    if (v._correctCount === 0) {
      audio.playFail();
      showGameAlert({
        title: '⏱️ 时间到',
        tone: 'danger',
        body: '您在本次闪电征途中没有答对题目，无探险奖励。',
        onClose: function () { navigate('menu'); setSecret(null); },
      });
      return;
    }

    const isFirstTime = !saveData.first_completions['blitz'];
    let baseAward = v._correctCount * BALANCE.blitz_correct_coins + Math.floor(v._timeLeft / 60 * BALANCE.blitz_time_bonus_rate) + v._comboBonusCoins;
    if (saveData.double_coins_next) baseAward *= 2;
    let finalCoins = isFirstTime ? baseAward : Math.max(8, Math.floor(baseAward / 3));

    const counts = {};
    v._usedItems.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    let itemPenaltyPercent = 0;
    Object.keys(counts).forEach(function (id) {
      let total = 0;
      for (let i = 0; i < counts[id]; i++) total += (id === 'time_freeze' ? 2 : id === 'diamond_star' ? 5 : id === 'oracle_eye' ? 5 : 0) * Math.max(0.3, 1 - i * 0.25);
      itemPenaltyPercent += total;
    });
    itemPenaltyPercent = Math.min(BALANCE.item_penalty_cap, Math.round(itemPenaltyPercent));
    if (itemPenaltyPercent > 0) finalCoins = Math.round(finalCoins * (1 - itemPenaltyPercent / 100));
    if (isEasy) finalCoins = Math.floor(finalCoins * 0.65);

    const finalWins = saveData.total_wins + v._correctCount;
    const nextCompleted = saveData.completed_stages.slice();
    if (nextCompleted.indexOf('闪电挑战') === -1) nextCompleted.push('闪电挑战');
    const nextFirstCompletions = Object.assign({}, saveData.first_completions);
    if (isFirstTime) nextFirstCompletions['blitz'] = true;

    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + finalCoins, diamonds: saveData.diamonds + v._blitzDiamonds, total_wins: finalWins, completed_stages: nextCompleted, first_completions: nextFirstCompletions, double_coins_next: false }));
    audio.playWin();

    const accuracy = v._totalRounds > 0 ? Math.round((v._correctCount / v._totalRounds) * 100) : 0;
    const msg = '答对题数: ' + v._correctCount + ' / ' + v._totalRounds + ' (' + accuracy + '%)\n最高连击: 🔥 ' + v._maxCombo + '\n\n结算物资:\n🪙 +' + finalCoins + ' 金币 ' + (isFirstTime ? '(首通加成!)' : '') + (v._blitzDiamonds > 0 ? '\n💎 +' + v._blitzDiamonds + ' 钻石' : '') + (isEasy ? '\n⚠️ 菜鸡模式加乘：-35%' : '') + (itemPenaltyPercent > 0 ? '\n⚠️ 道具承重负荷：-' + itemPenaltyPercent + '%' : '');
    setTimeout(function () {
      showGameAlert({
        title: '⏱️ 时间到！',
        tone: 'success',
        body: '闪电时间到！探险舱关闭！\n\n' + msg,
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },
};

/* ----- 6.8 GamePlayView (story / free / inferno_* / mist / arithmetic) ----- */
const GamePlayView = {
  _playType: 'story', _stages: [], _currentStageIndex: 0, _stageSelectionOpen: false, _isInferno: false,
  _narrationTitle: '', _narrationText: '', _narrationCallback: null,
  _currentStage: null, _s1: 0, _s2: 0, _attempts: 0, _maxAttempts: 0, _kmin: 1, _kmax: 100,
  _input: '', _message: '', _guesses: [], _ended: false, _usedItems: [],
  _protectActive: false, _shieldTries: 0, _hasWatchedVideoChance: false,
  _stageStartTime: 0, _guessTimestamps: [], _initDone: false, _animPlayed: false, _revivalModalOpen: false,

  mount(playType) {
    const v = this;
    v._playType = playType;
    v._initDone = false;
    v._stages = []; v._currentStageIndex = 0; v._stageSelectionOpen = false; v._isInferno = false;
    v._narrationTitle = ''; v._narrationText = ''; v._narrationCallback = null;
    v._currentStage = null; v._guesses = []; v._ended = false; v._usedItems = [];
    v._protectActive = false; v._shieldTries = 0; v._hasWatchedVideoChance = false;
    v._guessTimestamps = []; v._animPlayed = false;

    if (playType === 'story') {
      v._isInferno = false; v._stages = STORY_STAGES; v._currentStageIndex = 0;
      v._showStoryNarration('📖 启航',
        '你站在码头边，海风裹着盐味扑面而来。一位老水手递给你一张泛黄的羊皮纸："年轻人，这三片海域藏着传说中的数字宝藏。只有真正的数字航海家才能将它们全部找到。"你接过羊皮纸，踏上帆船，准备启航。',
        function () { v._loadStageByIndex(0, STORY_STAGES); });
    } else if (playType === 'inferno_campaign') {
      v._isInferno = true; v._stages = INFERNO_STAGES; v._currentStageIndex = 0;
      v._showStoryNarration('🔥 炼狱启航',
        '黑色的海水在咆哮，炙热的水汽扑面而来。老水手脸色严峻："炼狱之征……在这里，你将没有任何提示指南，海浪会将一切掩埋。你是否有足够的勇气面对这场极速迷局？"',
        function () { v._loadStageByIndex(0, INFERNO_STAGES); });
    } else if (playType === 'free') {
      v._isInferno = false; v._stages = FREE_STAGES; v._stageSelectionOpen = true;
      v._render();
    } else if (playType === 'inferno_single') {
      v._isInferno = true; v._stages = INFERNO_FREE_STAGES; v._stageSelectionOpen = true;
      v._render();
    } else if (playType === 'mist') {
      v._isInferno = false; v._loadCustomMistStage(); v._render();
    } else if (playType === 'arithmetic') {
      v._isInferno = false; v._loadCustomArithmeticStage(); v._render();
    }
  },
  unmount() { setSecret(null); },

  _showStoryNarration(title, text, onContinue) {
    this._narrationTitle = title;
    this._narrationText = text;
    this._narrationCallback = onContinue;
    this._render();
  },

  _handleNarrationContinue() {
    const v = this;
    audio.playClick();
    const cb = v._narrationCallback;
    v._narrationTitle = ''; v._narrationText = ''; v._narrationCallback = null;
    if (cb) cb();
    else v._render();
  },

  _verdictBegin(stage) {
    const v = this;
    v._ended = false; v._guesses = []; v._message = '⏳ 正在向裁决中枢申请海域坐标...';
    v._currentStage = stage;
    v._render();
    verdictStart(v._playType, stage ? stage.id : undefined).then(function (r) {
      if (r.status === 200 && r.json.ok) {
        mirrorGame(v, r.json.game);
        if (saveData.double_coins_next) showToast('💰 激活：通关金币双倍已装载！', 'gold');
        v._render();
      } else {
        showToast('❌ 裁决中枢连接失败：' + ((r.json && r.json.error) || '网络异常'), 'danger');
        navigate('menu');
      }
    });
  },

  _verdictSubmission() {
    const v = this;
    if (v._ended || !v._gameId) return;
    const trimmed = v._input.trim();
    if (trySecretFish(trimmed, function () { v._input = ''; v._render(); })) return;
    if (trimmed.toLowerCase() === 'h') { v._verdictHint(); return; }
    const maxNum = v._currentStage ? v._currentStage.max_number : 100;
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 1 || val > maxNum) {
      showToast('❌ 请输入 1 到 ' + maxNum + ' 之间的有效正整数', 'danger');
      return;
    }
    v._input = '';
    verdictGuess(v._gameId, val).then(function (r) {
      if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '提交失败'), 'danger'); v._render(); return; }
      mirrorGame(v, r.json.game);
      if (r.json.game.won) { v._verdictFinish('win'); return; }
      if (r.json.game.lost) { v._verdictLoseFlow(); return; }
      v._render();
    });
  },

  _verdictHint() {
    const v = this;
    if (!v._gameId) return;
    const p = (saveData.inventory.hint_stone || 0) > 0 ? verdictItem(v._gameId, 'hint_stone') : verdictHint(v._gameId);
    p.then(function (r) {
      if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '提示失败'), 'danger'); return; }
      mirrorGame(v, r.json.game);
      if (r.json.ledger) applyLedger(r.json.ledger);
      v._render();
    });
  },

  _verdictUseItem(itemId) {
    const v = this;
    if (!v._gameId) return;
    verdictItem(v._gameId, itemId).then(function (r) {
      if (r.status !== 200 || !r.json.ok) { showToast('❌ ' + ((r.json && r.json.error) || '道具使用失败'), 'danger'); return; }
      mirrorGame(v, r.json.game);
      if (r.json.ledger) applyLedger(r.json.ledger);
      v._render();
    });
  },

  _verdictLoseFlow() {
    const v = this;
    if (v._canRevive) {
      const hasTalisman = (saveData.inventory.revival_talisman || 0) > 0;
      showGameConfirm({
        title: '💀 生命危急',
        tone: 'gold',
        body: hasTalisman ? '是否消耗复活符恢复一半机会继续挑战？' : '复活符已无库存。',
        confirmText: hasTalisman ? '使用复活符' : '放弃挑战',
        onConfirm: function () {
          if (hasTalisman) {
            verdictItem(v._gameId, 'revival_talisman').then(function (r) {
              if (r.status === 200) { mirrorGame(v, r.json.game); if (r.json.ledger) applyLedger(r.json.ledger); v._render(); return; }
              v._verdictLoseFlow();
            });
          } else { v._verdictVideoOrEnd(); }
        },
        onCancel: function () { v._verdictVideoOrEnd(); },
      });
      return;
    }
    v._verdictVideoOrEnd();
  },

  _verdictVideoOrEnd() {
    const v = this;
    if (v._canVideo) {
      showGameConfirm({
        title: '💡 机会耗尽',
        tone: 'info',
        body: '是否观看一次航海气泡动画以获得 1 ~ 3 次额外机会？',
        confirmText: '观看动画',
        onConfirm: function () {
          verdictVideo(v._gameId).then(function (r) {
            if (r.status === 200) {
              mirrorGame(v, r.json.game);
              triggerAnimation(Math.floor(Math.random() * 5) + 1, function () { v._render(); });
              return;
            }
            v._verdictFinish('lose');
          });
        },
        onCancel: function () { v._verdictFinish('lose'); },
      });
      return;
    }
    v._verdictFinish('lose');
  },

  _verdictFinish(reason) {
    const v = this;
    if (!v._gameId) return;
    verdictFinish(v._gameId, reason).then(function (r) {
      if (r.status !== 200 || !r.json.ok) { showToast('❌ 结算失败：' + ((r.json && r.json.error) || '网络异常'), 'danger'); navigate('menu'); return; }
      const result = r.json.result;
      applyLedger(result.ledger);
      v._gameId = null;
      const rd = result.reward;
      const targetText = result.twinTargets ? result.twinTargets.join(' 和 ') : (result.mastermindSecret || result.target);
      if (result.won) {
        let breakdown = '💰 获得金币: 🪙 +' + rd.coins;
        if (rd.diamonds > 0) breakdown += '\n💎 获得钻石: 💎 +' + rd.diamonds;
        if (result.eggs.length > 0) breakdown += '\n🏅 彩蛋: ' + result.eggs.join(', ');
        if (result.firstTry) breakdown += '\n✨ 首猜即中！';
        showGameAlert({
          title: '🎉 通关成功！',
          tone: 'success',
          body: '探索坐标秘密答案正为: ' + targetText + '\n\n' + breakdown,
          buttonText: '继续 ⛵',
          onClose: function () { navigate('menu'); setSecret(null); },
        });
      } else {
        showGameAlert({
          title: '💀 挑战触礁失败！',
          tone: 'danger',
          body: '坐标答案是: [ ' + targetText + ' ]' + (rd.coins > 0 ? '\n🪙 保障局发回援助物资补给：🪙 +' + rd.coins : '\n本次未能获得援助。'),
          onClose: function () { navigate('menu'); setSecret(null); },
        });
      }
    });
  },

  _loadStageByIndex(idx, stageList) {
    const v = this;
    if (verdictMode) { v._verdictBegin(stageList[idx]); return; }
    const stage = stageList[idx];
    if (!stage) return;
    v._currentStage = stage;
    v._currentStageIndex = idx;
    const secret = Math.floor(Math.random() * stage.max_number) + 1;
    v._s1 = secret;
    setSecret(secret);
    const baseAttempts = stage.attempts + (saveData.easy_mode ? 3 : 0);
    v._attempts = baseAttempts; v._maxAttempts = baseAttempts;
    v._kmin = 1; v._kmax = stage.max_number;
    v._input = ''; v._guesses = []; v._usedItems = [];
    v._protectActive = false; v._shieldTries = 0; v._hasWatchedVideoChance = false;
    v._ended = false; v._stageStartTime = performance.now(); v._guessTimestamps = [];
    v._message = v._isInferno
      ? '🔥 炼狱之火在燃烧，罗盘将不提供范围和大小提示。祝你好运。'
      : '输入数字开始猜测。输入"H"消耗 1 次机会获取提示指南，🎒 可以调出备用道具舱。';
    if (saveData.double_coins_next) showToast('💰 激活：通关金币双倍已装载！', 'gold');
    v._animPlayed = false;
    v._render();
  },

  _loadCustomMistStage() {
    const v = this;
    if (verdictMode) { v._verdictBegin({ id: 'mist', name: '迷雾海域', max_number: 100, attempts: BALANCE.mist_attempts }); return; }
    v._currentStage = { id: 'mist', name: '迷雾海域', max_number: 100, attempts: BALANCE.mist_attempts };
    const secret = Math.floor(Math.random() * 100) + 1;
    v._s1 = secret; setSecret(secret);
    const baseAttempts = BALANCE.mist_attempts + (saveData.easy_mode ? 3 : 0);
    v._attempts = baseAttempts; v._maxAttempts = baseAttempts;
    v._kmin = 1; v._kmax = 100;
    v._input = ''; v._guesses = []; v._usedItems = [];
    v._hasWatchedVideoChance = false; v._ended = false;
    v._stageStartTime = performance.now(); v._guessTimestamps = [];
    v._message = '🌫️ 迷雾笼罩着这片海域，提示指南和大部分定向缩减道具无法在迷雾中工作。';
    v._animPlayed = false;
  },

  _loadCustomArithmeticStage() {
    const v = this;
    if (verdictMode) { v._verdictBegin({ id: 'arithmetic', name: '卧底猜数', max_number: 100, attempts: BALANCE.arithmetic_attempts }); return; }
    v._currentStage = { id: 'arithmetic', name: '卧底猜数', max_number: 100, attempts: BALANCE.arithmetic_attempts };
    const secret = Math.floor(Math.random() * 100) + 1;
    let decoy = Math.floor(Math.random() * 100) + 1;
    while (decoy === secret) decoy = Math.floor(Math.random() * 100) + 1;
    v._s1 = secret; v._s2 = decoy;
    setSecret('真实目标: ' + secret + ' (虚假干扰: ' + decoy + ')');
    const baseAttempts = BALANCE.arithmetic_attempts + (saveData.easy_mode ? 3 : 0);
    v._attempts = baseAttempts; v._maxAttempts = baseAttempts;
    v._kmin = 1; v._kmax = 100;
    v._input = ''; v._guesses = []; v._usedItems = [];
    v._hasWatchedVideoChance = false; v._ended = false;
    v._stageStartTime = performance.now(); v._guessTimestamps = [];
    v._message = '🕵️ 虚实数字迷局。系统锁定了两个目标数，其中一个为真，另一个为诱饵。你的猜测将反馈两个数中随机一者的状态！';
    v._animPlayed = false;
  },

  _handleStageSelect(stage) {
    const v = this;
    if (verdictMode) { v._verdictBegin(stage); return; }
    v._stageSelectionOpen = false;
    v._currentStage = stage;
    const secret = Math.floor(Math.random() * stage.max_number) + 1;
    v._s1 = secret; setSecret(secret);
    const baseAttempts = stage.attempts + (saveData.easy_mode ? 3 : 0);
    v._attempts = baseAttempts; v._maxAttempts = baseAttempts;
    v._kmin = 1; v._kmax = stage.max_number;
    v._input = ''; v._guesses = []; v._usedItems = [];
    v._hasWatchedVideoChance = false; v._ended = false;
    v._stageStartTime = performance.now(); v._guessTimestamps = [];
    v._message = v._isInferno
      ? '🔥 炼狱难度激活。数字范围无向导罗盘定位，请全凭对直觉判断。'
      : '探索指南罗盘已开启。输入你的数字开始探测，H 获取线索。';
    v._animPlayed = false;
    v._render();
  },

  _render() {
    const v = this;
    let html = '<div class="relative">';

    // 1. Narration overlay
    if (v._narrationText) {
      html += '<div class="fixed inset-0 bg-[#0A0502]/95 backdrop-blur-lg z-[250] flex justify-center items-center p-5 animate-fade-in">' +
        '<div class="max-w-md w-full bg-white/[0.03] backdrop-blur-xl border border-cyan-500/30 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 text-center animate-modal-pop">' +
          '<h3 class="text-xl font-bold text-cyan-400 font-mono tracking-wider">' + escapeHtml(v._narrationTitle) + '</h3>' +
          '<p class="text-sm md:text-base text-slate-300 leading-relaxed text-left whitespace-pre-wrap">' + escapeHtml(v._narrationText) + '</p>' +
          '<button id="gp-narration-continue" class="mt-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#0a0502] font-bold shadow-glow shadow-cyan-400/20 active:scale-[0.98] transition-all text-sm cursor-pointer">起航 / 继续 ⛵</button>' +
        '</div>' +
      '</div>';
    }

    // 2. Stage selection overlay
    if (v._stageSelectionOpen) {
      let stageListHtml = '';
      v._stages.forEach(function (stage, idx) {
        const starsCount = idx + 1;
        const coinsReward = v._isInferno ? [BALANCE.inferno_base_coins[100], BALANCE.inferno_base_coins[200], BALANCE.inferno_base_coins[500]][idx] : [BALANCE.story_base_coins[100], BALANCE.story_base_coins[200], BALANCE.story_base_coins[500]][idx];
        const icon = v._isInferno ? '🌋' : (idx === 0 ? '🌊' : idx === 1 ? '🌀' : '🌌');
        stageListHtml += '<button data-stage="' + idx + '" class="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-cyan-500/5 hover:border-cyan-500/20 text-left flex items-center gap-3 transition-all cursor-pointer group">' +
          '<div class="p-3 rounded-xl bg-white/5 border border-white/5 text-xl group-hover:scale-105 transition-all">' + icon + '</div>' +
          '<div class="flex-1 space-y-1"><div class="font-bold text-sm text-white group-hover:text-cyan-300 transition-all">' + escapeHtml(stage.name) + '</div>' +
          '<div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400"><span class="font-semibold text-cyan-400 font-mono">🎯 1 ~ ' + stage.max_number + '</span><span class="font-semibold text-teal-400 font-mono">🎲 ' + stage.attempts + '次</span><span class="text-amber-400 font-bold font-mono">首通: 🪙+' + coinsReward + '</span></div>' +
          '<div class="text-amber-400/80 text-[10px] tracking-wide">' + '★'.repeat(starsCount) + '☆'.repeat(3 - starsCount) + '</div></div>' +
        '</button>';
      });
      html += '<div class="fixed inset-0 bg-black/60 backdrop-blur-md z-[180] flex justify-center items-center p-4 animate-fade-in">' +
        '<div class="bg-[#0A0502]/95 border border-cyan-500/20 backdrop-blur-xl rounded-3xl w-full max-w-md p-5 flex flex-col gap-4 animate-modal-pop">' +
          '<div><h3 class="text-lg md:text-xl font-bold text-white text-center">' + (v._isInferno ? '🔥 选择炼狱海域' : '🗺️ 选择航海海域') + '</h3>' +
          '<p class="text-xs text-slate-400 text-center mt-1">' + (v._isInferno ? '炼狱模式下无任何方向提示。机会稀少，但获胜报酬极高！' : '选择一个已知海域下网探测。') + '</p></div>' +
          '<div class="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">' + stageListHtml + '</div>' +
          '<button id="gp-stage-cancel" class="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 font-semibold active:scale-95 transition-all text-xs">取消并返回</button>' +
        '</div>' +
      '</div>';
    }

    // 3. Main game screen
    if (v._currentStage) {
      const inf = saveData.infinite_mode;
      const isEasy = saveData.easy_mode;
      const remainingPercent = inf ? 100 : (v._attempts / v._maxAttempts) * 100;
      const showAttemptsLeft = v._attempts <= 2 && !inf;
      const attemptsCls = showAttemptsLeft ? 'text-red-400 animate-pulse' : 'text-cyan-400';
      const barCls = showAttemptsLeft ? 'bg-gradient-to-r from-red-500 to-rose-400 shadow-glow shadow-red-500/30' : 'bg-gradient-to-r from-cyan-500 to-teal-400';

      let guessesHtml = '';
      if (v._guesses.length === 0) {
        guessesHtml = '<div class="text-slate-500 text-center py-4">等待探测输入并回传定位...</div>';
      } else {
        v._guesses.forEach(function (g) {
          guessesHtml += '<div class="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 text-slate-300 animate-slide-in"><span class="text-[10px] bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 font-bold">#' + (g.idx + 1) + ' 探测</span><span class="font-bold text-white shrink-0 font-mono">' + g.guess + '</span><span class="text-slate-500">➜</span><span class="text-slate-200 truncate">' + escapeHtml(g.text) + '</span></div>';
        });
      }

      html += '<div class="flex flex-col gap-4' + (v._animPlayed ? '' : ' animate-view-in') + '">' +
        '<div class="flex items-center gap-3"><button id="gp-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>' +
        '<h2 class="text-lg md:text-xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent truncate max-w-xs">' + (v._isInferno ? '🔥 ' : '⚓ ') + escapeHtml(v._currentStage.name) + (isEasy ? '<span class="ml-2 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase">菜鸡</span>' : '') + (inf ? '<span class="ml-2 text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded-full uppercase">无限</span>' : '') + '</h2></div>' +
        '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-1.5 shadow-inner-soft text-slate-300 text-xs md:text-sm min-h-[64px] justify-center text-center" id="gp-message">' + escapeHtml(v._message) + '</div>' +
        ((!v._isInferno && v._playType !== 'arithmetic') ? '<div class="self-center flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold font-mono shadow-inner shadow-cyan-500/20 animate-pop"><i data-lucide="compass" class="w-4 h-4 text-cyan-400 animate-spin-slow"></i>航行搜索限域：<span id="gp-kmin">' + v._kmin + '</span> ~ <span id="gp-kmax">' + v._kmax + '</span></div>' : '') +
        (saveData.debug_enabled ? '<div class="self-center py-1 px-3 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-xs font-extrabold font-mono animate-pulse shadow-sm shadow-yellow-500/15">🔧 [DEBUG答案: ' + (v._playType === 'arithmetic' ? '真实=' + v._s1 + ', 虚假=' + v._s2 : v._s1) + ']</div>' : '') +
        '<div class="space-y-1"><div class="flex justify-between items-center text-xs"><span class="text-slate-400 font-semibold">探测仓量子稳定度</span><span class="font-bold font-mono ' + attemptsCls + '" id="gp-attempts">' + (inf ? '∞' : v._attempts + ' / ' + v._maxAttempts) + '</span></div><div class="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5 p-[1px]"><div class="h-full rounded-full transition-all duration-300 ' + barCls + '" id="gp-progress" style="width:' + remainingPercent + '%"></div></div></div>' +
        '<div class="flex items-center gap-2 mt-1">' +
          '<input id="gp-input" type="text" value="' + escapeHtml(v._input) + '" ' + (v._ended ? 'disabled' : '') + ' placeholder="' + (v._ended ? '本局游戏已结束' : '输入 1 ~ ' + v._currentStage.max_number + ' 猜数 / H') + '" class="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:shadow-glow shadow-cyan-400/5 transition-all min-w-0" inputmode="numeric" pattern="[0-9]*" />' +
          '<button id="gp-submit" ' + (v._ended || !v._input.trim() ? 'disabled' : '') + ' class="p-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"><i data-lucide="send" class="w-5 h-5"></i></button>' +
          '<button id="gp-hint" ' + (v._isInferno || v._playType === 'mist' || v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-cyan-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer" title="索取方向提示指南"><i data-lucide="help-circle" class="w-5 h-5"></i></button>' +
          '<button id="gp-backpack" ' + (v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-cyan-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer" title="展开备用道具货仓"><i data-lucide="backpack" class="w-5 h-5"></i></button>' +
        '</div>' +
        '<div class="flex flex-col gap-2 mt-1"><span class="text-xs text-slate-400 font-semibold tracking-wider uppercase">已知密码交叉定位回传</span><div class="p-3 rounded-2xl bg-white/5 border border-white/10 max-h-[180px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 font-mono text-xs" id="gp-history">' + guessesHtml + '</div></div>' +
      '</div>';
    }

    html += '</div>';
    mainEl().innerHTML = html;
    refreshIcons();
    v._animPlayed = true;
    this._bind();
    const gpHist = document.getElementById('gp-history');
    if (gpHist) gpHist.scrollTop = gpHist.scrollHeight;
    if (v._currentStage && !v._ended) {
      const input = document.getElementById('gp-input');
      if (input) input.focus();
    }
  },

  _bind() {
    const v = this;
    const narrationBtn = document.getElementById('gp-narration-continue');
    if (narrationBtn) narrationBtn.addEventListener('click', function () { v._handleNarrationContinue(); });
    const cancelBtn = document.getElementById('gp-stage-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { audio.playClick(); navigate('menu'); setSecret(null); });
    mainEl().querySelectorAll('[data-stage]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-stage'), 10);
        audio.playClick();
        v._handleStageSelect(v._stages[idx]);
      });
    });
    const backBtn = document.getElementById('gp-back');
    if (backBtn) backBtn.addEventListener('click', function () { audio.playClick(); navigate('menu'); setSecret(null); });
    const input = document.getElementById('gp-input');
    if (input) {
      input.addEventListener('input', function (e) {
        v._input = e.target.value;
        const sb = document.getElementById('gp-submit');
        if (sb) sb.disabled = v._ended || !v._input.trim();
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v._handleSubmission(); });
    }
    const submitBtn = document.getElementById('gp-submit');
    if (submitBtn) submitBtn.addEventListener('click', function () { v._handleSubmission(); });
    const hintBtn = document.getElementById('gp-hint');
    if (hintBtn) hintBtn.addEventListener('click', function () { v._triggerHint(); });
    const backpackBtn = document.getElementById('gp-backpack');
    if (backpackBtn) backpackBtn.addEventListener('click', function () { audio.playClick(); openBackpack(v._playType === 'mist' ? 'mist' : v._playType === 'arithmetic' ? 'arithmetic' : 'stage', function (id) { v._handleUseItemFromBackpack(id); }); });
  },

  _handleSubmission() {
    const v = this;
    audio.playClick();
    if (v._ended || !v._currentStage) return;
    if (verdictMode) { v._verdictSubmission(); return; }
    const trimmed = v._input.trim();
    if (trySecretFish(trimmed, function () {
      v._input = '';
      v._message = '🐟 一条银色信使跃出水面，在阳光下划出神秘的字母轨迹！(暗号已收录)';
      showToast('🐟 银色信使彩蛋已解锁！', 'gold');
      v._render();
    })) return;
    if (trimmed.toLowerCase() === 'h') { v._triggerHint(); return; }
    const val = parseInt(trimmed, 10);
    if (isNaN(val) || val < 1 || val > v._currentStage.max_number) {
      showToast('❌ 请输入 1 到 ' + v._currentStage.max_number + ' 之间的有效正整数', 'danger');
      return;
    }

    const now = performance.now();
    v._guessTimestamps.push(now);
    if (val === 42) triggerEgg('number_42');
    if ([520, 1314, 777].indexOf(val) !== -1) triggerEgg('hidden_song');

    let spendChance = true;
    if (v._protectActive) { spendChance = false; v._protectActive = false; showToast('🛡️ 守护符生效！本次失误不消耗次数！', 'success'); }
    else if (v._shieldTries > 0) { spendChance = false; v._shieldTries = v._shieldTries - 1; showToast('🛡️ 穹顶护盾生效！剩余 ' + v._shieldTries + ' 次减免次数', 'success'); }

    let nextAttempts = v._attempts;
    if (spendChance && !saveData.infinite_mode) { nextAttempts = v._attempts - 1; v._attempts = nextAttempts; }

    if (val === v._s1) {
      v._ended = true;
      audio.playWin();
      v._handleWinProcess(v._maxAttempts - nextAttempts);
    } else {
      if (v._playType === 'arithmetic') {
        const target = Math.random() < 0.5 ? v._s1 : v._s2;
        const clueText = val === v._s2 ? '🤔 这只是一个诱饵，它并不是真正通航的正确数字！' : (target > val ? '某个数字大于 ' + val : '某个数字小于 ' + val);
        v._guesses.push({ idx: v._guesses.length, guess: val, icon: '🕵️', text: clueText });
        v._message = clueText;
        if (nextAttempts <= 0 && !saveData.infinite_mode) v._triggerRevivalOrVideo();
      } else if (v._playType === 'mist') {
        let nextMin = v._kmin, nextMax = v._kmax;
        if (val < v._s1) nextMin = Math.max(v._kmin, val + 1); else nextMax = Math.min(v._kmax, val - 1);
        if (Math.random() < 0.3) nextMin = Math.min(nextMax - 2, nextMin + 1);
        if (Math.random() < 0.3) nextMax = Math.max(nextMin + 2, nextMax - 1);
        v._kmin = nextMin; v._kmax = nextMax;
        const clueText = val < v._s1 ? '⬆ ' + val + ' 偏小（在迷雾中范围可能发生了微移）' : '⬇ ' + val + ' 偏大（在迷雾中范围可能发生了微移）';
        v._guesses.push({ idx: v._guesses.length, guess: val, icon: '🌫️', text: clueText });
        v._message = clueText;
        if (nextAttempts <= 0 && !saveData.infinite_mode) v._triggerRevivalOrVideo();
      } else if (v._isInferno) {
        v._guesses.push({ idx: v._guesses.length, guess: val, icon: '🔥', text: '水汽升腾，坐标已掩埋' });
        v._message = '坐标已掩埋...继续探索';
        if (nextAttempts <= 0 && !saveData.infinite_mode) v._triggerRevivalOrVideo();
      } else {
        let nextMin = v._kmin, nextMax = v._kmax;
        if (val < v._s1 && val > v._kmin) nextMin = val;
        if (val > v._s1 && val < v._kmax) nextMax = val;
        v._kmin = nextMin; v._kmax = nextMax;
        const dist = Math.abs(val - v._s1);
        const totalRange = v._currentStage.max_number;
        let scaleText = val < v._s1 ? '⬆ ' + val + ' 偏小' : '⬇ ' + val + ' 偏大';
        if (dist <= Math.max(1, totalRange * 0.05)) scaleText += ' 🔥极近！';
        else if (dist <= Math.max(1, totalRange * 0.12)) scaleText += ' 🔥很近';
        else if (dist <= Math.max(1, totalRange * 0.25)) scaleText += ' 👍方向对';
        else scaleText += ' 🌊较远';
        v._guesses.push({ idx: v._guesses.length, guess: val, icon: '⚓', text: scaleText });
        v._message = scaleText;
        if (nextAttempts <= 0 && !saveData.infinite_mode) v._triggerRevivalOrVideo();
      }
    }
    v._input = '';
    if (v._revivalModalOpen) { v._revivalModalOpen = false; return; }
    v._render();
  },

  _triggerHint() {
    const v = this;
    if (verdictMode) { v._verdictHint(); return; }
    if (v._isInferno) { showToast('❌ 炼狱海域中，罗盘及高级向导提示无法提供服务。', 'danger'); return; }
    if (v._playType === 'mist') { showToast('❌ 浓浓迷雾屏蔽了提示信号。', 'danger'); return; }
    if (saveData.inventory['hint_stone'] && saveData.inventory['hint_stone'] > 0) {
      const nextInv = Object.assign({}, saveData.inventory);
      nextInv['hint_stone']--;
      if (nextInv['hint_stone'] <= 0) delete nextInv['hint_stone'];
      updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));
      v._usedItems.push('hint_stone');
      const promptText = v._getHintText(v._s1, v._currentStage ? v._currentStage.max_number : 100);
      v._message = '💡 [线索石] ' + promptText;
      showToast('💡 成功使用线索石，获取高阶提示线索！', 'success');
      v._render();
      return;
    }
    if (!saveData.infinite_mode && v._attempts <= 1) { showToast('❌ 猜测次数不足以消耗用作提示获取！', 'danger'); return; }
    if (!saveData.infinite_mode) { v._attempts = v._attempts - 1; }
    const promptText = v._getHintWeakText(v._s1, v._currentStage ? v._currentStage.max_number : 100);
    v._message = '💡 [普通线索] ' + promptText;
    showToast('💡 罗盘发回引导线索，消耗 1 次猜测机会！', 'info');
    v._render();
  },

  _getHintText(secret, max) {
    const isEven = secret % 2 === 0;
    const tips = [
      '这个数字是一个' + (isEven ? '偶数' : '奇数') + '。',
      '目标处于区间 ' + (secret <= max / 2 ? '1 ~ ' + Math.floor(max / 2) : (Math.floor(max / 2) + 1) + ' ~ ' + max) + ' 之中。',
      '个位数数字是 ' + (secret % 10) + '。',
      max >= 100 ? '数字的十位数是 ' + (Math.floor(secret / 10) % 10) + '，百位数是 ' + (Math.floor(secret / 100) % 10) + '。' : '数字的十位数是 ' + (Math.floor(secret / 10) % 10) + '。',
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  },

  _getHintWeakText(secret, max) {
    const isEven = secret % 2 === 0;
    const tips = [
      '似乎是一个' + (isEven ? '偶' : '奇') + '数……',
      '目标似乎比 ' + Math.floor(max / 2) + ' 要' + (secret <= max / 2 ? '小' : '大') + '一些。',
      '个位数字大致在 ' + Math.max(0, (secret % 10) - 2) + ' ~ ' + Math.min(9, (secret % 10) + 2) + ' 范围附近。',
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  },

  _triggerRevivalOrVideo() {
    const v = this;
    if (verdictMode) { v._verdictLoseFlow(); return; }
    const hasRevival = saveData.inventory['revival_talisman'] && saveData.inventory['revival_talisman'] > 0;
    if (hasRevival) {
      showGameConfirm({
        title: '💀 生命危急',
        tone: 'gold',
        body: '检测到船舱存有【复活符】，是否消耗使用以恢复一半机会继续挑战？',
        confirmText: '使用复活符',
        onConfirm: function () {
          const nextInv = Object.assign({}, saveData.inventory);
          nextInv['revival_talisman']--;
          if (nextInv['revival_talisman'] <= 0) delete nextInv['revival_talisman'];
          updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));
          v._usedItems.push('revival_talisman');
          const revivedTries = Math.ceil(v._maxAttempts / 2);
          v._attempts = revivedTries;
          v._message = '💎 复活符已生效！紧急破舱提供 ' + revivedTries + ' 次多维猜想机会！';
          showToast('💎 复活符生效！生命恢复！', 'gold');
          v._render();
        },
        onCancel: function () { v._tryVideoChance(); },
      });
      v._revivalModalOpen = true;
      return;
    }
    v._tryVideoChance();
  },

  _tryVideoChance() {
    const v = this;
    if (!v._hasWatchedVideoChance && !v._isInferno) {
      showGameConfirm({
        title: '💡 机会耗尽',
        tone: 'info',
        body: '是否观看一次航海气泡动画以获得 1 ~ 3 次额外机会？',
        confirmText: '观看动画',
        onConfirm: function () {
          v._hasWatchedVideoChance = true;
          const randomAnimId = Math.floor(Math.random() * 5) + 1;
          triggerAnimation(randomAnimId, function () {
            const added = Math.floor(Math.random() * 3) + 1;
            v._attempts = added;
            v._maxAttempts = v._maxAttempts + added;
            v._message = '✨ 海鸥带来气泡指南！猜测机会已增加 ' + added + ' 次！';
            showToast('✨ 获得 ' + added + ' 次额外机会！', 'success');
            v._render();
          });
        },
        onCancel: function () { v._endByLose(); },
      });
      v._revivalModalOpen = true;
      return;
    }
    v._endByLose();
  },

  _endByLose() {
    const v = this;
    v._ended = true;
    audio.playFail();
    v._handleLoseProcess();
  },

  _handleWinProcess(totalUsed) {
    const v = this;
    const stageMaxNum = v._currentStage ? v._currentStage.max_number : 100;
    const stageKey = v._currentStage ? (v._currentStage.id || v._currentStage.name || 'mist') : 'mist';
    const isFirstTime = !saveData.first_completions[stageKey];

    let coinsBase;
    if (v._isInferno) coinsBase = BALANCE.inferno_base_coins[stageMaxNum] || BALANCE.inferno_base_coins[500];
    else if (v._playType === 'mist') coinsBase = BALANCE.mist_base_coins;
    else if (v._playType === 'arithmetic') coinsBase = BALANCE.arithmetic_base_coins;
    else coinsBase = BALANCE.story_base_coins[stageMaxNum] || BALANCE.story_base_coins[500];
    if (isFirstTime) coinsBase *= 2;

    const remaining = v._maxAttempts - totalUsed;
    let bonusPercent = 0;
    if (totalUsed === 1) { bonusPercent = 250; triggerEgg('first_try'); }
    else if (remaining > 0) bonusPercent = Math.min(40, 15 + (remaining - 2) * 5);

    let finalCoins = coinsBase;
    if (bonusPercent > 0) finalCoins = Math.round(finalCoins * (1 + bonusPercent / 100));

    const wasDouble = saveData.double_coins_next;
    let isLucky = false;
    if (Math.random() < 0.08) { finalCoins += 15; isLucky = true; }
    if (wasDouble) finalCoins *= 2;

    const counts = {};
    v._usedItems.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    let itemPenaltyPercent = 0;
    Object.keys(counts).forEach(function (id) {
      let total = 0;
      const cnt = counts[id];
      for (let i = 0; i < cnt; i++) {
        const itemWeight = (id.indexOf('diamond') !== -1 || id === 'shield_dome') ? 5 : 3;
        total += itemWeight * Math.max(0.3, 1 - i * 0.25);
      }
      itemPenaltyPercent += total;
    });
    itemPenaltyPercent = Math.min(BALANCE.item_penalty_cap, Math.round(itemPenaltyPercent));
    if (itemPenaltyPercent > 0) finalCoins = Math.round(finalCoins * (1 - itemPenaltyPercent / 100));
    if (saveData.easy_mode) finalCoins = Math.floor(finalCoins * 0.65);

    let finalDiamonds = 0;
    const ratio = v._maxAttempts > 0 ? remaining / v._maxAttempts : 1;
    if (!saveData.infinite_mode) {
      if (v._playType === 'mist' || v._playType === 'arithmetic') {
        const dropChance = v._playType === 'mist' ? BALANCE.mist_diamond_chance : BALANCE.arithmetic_diamond_chance;
        if (Math.random() < dropChance) finalDiamonds = 1 + (Math.random() < 0.5 ? 1 : 0);
      } else if (ratio >= BALANCE.diamond_min_ratio) {
        let baseDia = BALANCE.diamond_stage_base[stageMaxNum] || 1;
        if (ratio >= BALANCE.diamond_ratio_bonus_threshold) baseDia += 1;
        if (v._isInferno) baseDia += 1;
        finalDiamonds = Math.min(BALANCE.diamond_cap, baseDia);
      }
      if (finalDiamonds > 0) {
        if (itemPenaltyPercent > 0) finalDiamonds = Math.round(finalDiamonds * (1 - itemPenaltyPercent / 100));
        if (saveData.easy_mode) finalDiamonds = Math.floor(finalDiamonds * 0.65);
      }
    }

    const nextCompleted = saveData.completed_stages.slice();
    const stageName = v._currentStage ? v._currentStage.name : '神秘海域';
    if (nextCompleted.indexOf(stageName) === -1) nextCompleted.push(stageName);
    const nextFirstCompletions = Object.assign({}, saveData.first_completions);
    if (isFirstTime) nextFirstCompletions[stageKey] = true;

    updateSaveData(Object.assign({}, saveData, {
      coins: saveData.coins + finalCoins,
      diamonds: saveData.diamonds + finalDiamonds,
      total_wins: saveData.total_wins + 1,
      completed_stages: nextCompleted,
      first_completions: nextFirstCompletions,
      consecutive_fails: 0,
      double_coins_next: false,
    }));

    const rewardBreakdownText = '💰 获得金币: 🪙 +' + finalCoins + (isFirstTime ? ' (首通首刷倍增!)' : '') + (wasDouble ? ' (双倍增效卡加持!)' : '') + (isLucky ? ' (🌟 撞见深海好运之风 +15!)' : '') + (finalDiamonds > 0 ? '\n💎 获得钻石: 💎 +' + finalDiamonds : '') + (saveData.easy_mode ? '\n⚠️ 菜鸡模式限制：-35%' : '') + (itemPenaltyPercent > 0 ? '\n⚠️ 装备承重扣除：-' + itemPenaltyPercent + '%' : '');

    setTimeout(function () {
      showGameAlert({
        title: '🎉 通关成功！',
        tone: 'success',
        body: '探索坐标秘密答案正为: ' + v._s1 + '\n\n' + rewardBreakdownText,
        buttonText: '继续 ⛵',
        onClose: function () {
          if (v._playType === 'story' && v._currentStageIndex < STORY_STAGES.length - 1) {
            const nextIdx = v._currentStageIndex + 1;
            const storyInterlude = [
              '浅海的微风逐渐散去，前方出现了更深邃的海域。船身的木板上刻着一行字："数字的低语在海浪中回荡，倾听它，你将走得更远。"',
              '海水变黑了，巨浪翻涌。老水手的低语随风传来："最后一片海域——远洋试炼。这里的数字比星星还要多，但你的心就是罗盘。"',
            ][v._currentStageIndex];
            v._showStoryNarration('📖 前行 · ' + STORY_STAGES[nextIdx].name, storyInterlude, function () { v._loadStageByIndex(nextIdx, STORY_STAGES); });
          } else if (v._playType === 'story' && v._currentStageIndex === STORY_STAGES.length - 1) {
            const storyEnd = '你站在船头，三片海域都已征服。海面如镜，夕阳熔金。老水手的烟斗亮了一下："我就知道你能行。这不仅仅是宝藏，更是你成为传说的证明。"海鸥掠过天际，你的名字被写进了航海史。';
            v._showStoryNarration('🏆 传奇终章', storyEnd, function () { triggerEgg('full_clear'); navigate('menu'); setSecret(null); });
          } else if (v._playType === 'inferno_campaign' && v._currentStageIndex < INFERNO_STAGES.length - 1) {
            const nextIdx = v._currentStageIndex + 1;
            v._showStoryNarration('🔥 熔岩进发 · ' + INFERNO_STAGES[nextIdx].name, '烈火燃得更烈了，老水手眼神赞许，挥舞罗盘指出下一个更深的地核方位！', function () { v._loadStageByIndex(nextIdx, INFERNO_STAGES); });
          } else if (v._playType === 'inferno_campaign' && v._currentStageIndex === INFERNO_STAGES.length - 1) {
            v._showStoryNarration('🔥 烈焰征途凯旋', '你征服了地狱远洋！炙热的岩浆开始冷却，海水化作纯净的源泉，一块古老的铭牌浮出水面："致至高无上的数字之王"。', function () { triggerEgg('inferno_master'); navigate('menu'); setSecret(null); });
          } else {
            navigate('menu'); setSecret(null);
          }
        },
      });
    }, 200);
  },

  _handleLoseProcess() {
    const v = this;
    const stageMaxNum = v._currentStage ? v._currentStage.max_number : 100;
    const elapsedSecs = (performance.now() - v._stageStartTime) / 1000;
    const isSuspicious = elapsedSecs < 8.0;

    let compBase = v._isInferno ? Math.max(BALANCE.inferno_lose_comp_min, Math.floor(stageMaxNum / BALANCE.inferno_lose_comp_divisor)) : Math.max(BALANCE.lose_comp_min, Math.floor(stageMaxNum / BALANCE.lose_comp_divisor));
    if (saveData.easy_mode) compBase = Math.floor(compBase * 0.65);

    let finalComp = compBase;
    let penaltyMessage = '';
    const consecutiveFails = saveData.consecutive_fails || 0;

    if (isSuspicious) {
      if (saveData.suspicious_fails === 0) {
        updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + finalComp, suspicious_fails: 1, first_suspicious_comp: finalComp }));
        penaltyMessage = '\n⚠️ （首次极速航行失败，提供紧急补给：🪙 +' + finalComp + '）';
      } else {
        const deduct = saveData.first_suspicious_comp || 0;
        const nextCoins = Math.max(0, saveData.coins - deduct);
        updateSaveData(Object.assign({}, saveData, { coins: nextCoins, suspicious_fails: saveData.suspicious_fails + 1, first_suspicious_comp: 0 }));
        penaltyMessage = '\n⚠️ 检测到恶劣操作/挂机刷取保障！\n不仅无补偿，并倒扣上次误领保障款 🪙 -' + deduct;
      }
    } else {
      const nextConsecutive = consecutiveFails + 1;
      let multiplier = 1.0;
      if (nextConsecutive === 2) multiplier = 0.5;
      else if (nextConsecutive === 3) multiplier = 0.25;
      else if (nextConsecutive >= 4) multiplier = 0;
      finalComp = Math.floor(finalComp * multiplier);
      updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + finalComp, consecutive_fails: nextConsecutive }));
      if (multiplier === 0) penaltyMessage = '\n⚠️ 连续航行触礁失败 ' + nextConsecutive + ' 次，紧急援助基金已经耗尽暂无法拨款。';
      else if (multiplier < 1.0) penaltyMessage = '\n🪙 连续航行触礁失败 ' + nextConsecutive + ' 次，援助金折减发放：🪙 +' + finalComp + ' (' + Math.round(multiplier * 100) + '%)';
      else penaltyMessage = '\n🪙 保障局发回援助物资补给：🪙 +' + finalComp;
    }

    setTimeout(function () {
      showGameAlert({
        title: '💀 挑战触礁失败！',
        tone: 'danger',
        body: '坐标答案是: [ ' + v._s1 + ' ]' + (v._playType === 'arithmetic' ? '，假诱饵是 [ ' + v._s2 + ' ]' : '') + '\n' + penaltyMessage,
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },

  _handleUseItemFromBackpack(itemId) {
    const v = this;
    audio.playClick();
    if (verdictMode) { v._verdictUseItem(itemId); return; }
    const nextInv = Object.assign({}, saveData.inventory);
    nextInv[itemId] = (nextInv[itemId] || 1) - 1;
    if (nextInv[itemId] <= 0) delete nextInv[itemId];
    v._usedItems.push(itemId);
    updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));

    if (itemId === 'hint_stone') {
      v._message = '💡 [线索石] ' + v._getHintText(v._s1, v._currentStage ? v._currentStage.max_number : 100);
      showToast('💡 线索石生效！', 'success');
    } else if (itemId === 'chance_star') {
      if (!saveData.infinite_mode) { v._attempts += 1; v._maxAttempts += 1; }
      v._message = '⭐ 获得额外一次机会加乘指南！';
      showToast('⭐ 机会星：猜测次数 +1！', 'success');
    } else if (itemId === 'protect_amulet') {
      v._protectActive = true;
      v._message = '🛡️ 守护符已在上空巡游！下一次失败将无损减免！';
      showToast('🛡️ 守护符已就位！', 'success');
    } else if (itemId === 'prophecy_scroll') {
      const tens = Math.floor(v._s1 / 10) % 10;
      v._message = '🔮 预言之卷卷轴徐徐展开，预测其十位数字是: ' + tens;
      showToast('🔮 预言卷轴成功翻译十位数！', 'success');
    } else if (itemId === 'golden_compass') {
      const mid = Math.floor((v._currentStage ? v._currentStage.max_number : 100) / 2);
      if (v._s1 <= mid) { v._kmax = mid; v._message = '🧭 黄金罗盘指向北方！秘密航标处于 1 ~ ' + mid + ' 之间！'; }
      else { v._kmin = mid + 1; v._message = '🧭 黄金罗盘指向南方！秘密航标处于 ' + (mid + 1) + ' ~ ' + (v._currentStage ? v._currentStage.max_number : 100) + ' 之间！'; }
      showToast('🧭 黄金罗盘指向纠偏锁定！', 'success');
    } else if (itemId === 'diamond_star') {
      if (!saveData.infinite_mode) { v._attempts += 3; v._maxAttempts += 3; }
      v._message = '💎 极高频率共振！获得额外三次猜测机会加乘！';
      showToast('💎 钻石星：机会次数一键 +3！', 'gold');
    } else if (itemId === 'shield_dome') {
      v._shieldTries = 3;
      v._message = '🛡️ 穹顶气泡展开守护！阻挡下三次因判断错误导致的失误磨损！';
      showToast('🛡️ 穹顶护盾生效！拥有 3 次免消耗护盾！', 'gold');
    } else if (itemId === 'super_compass') {
      const maxNum = v._currentStage ? v._currentStage.max_number : 100;
      const q = Math.floor(maxNum / 4);
      const segmentIdx = Math.floor((v._s1 - 1) / q);
      const boundsMin = segmentIdx * q + 1;
      const boundsMax = Math.min(maxNum, (segmentIdx + 1) * q);
      v._kmin = boundsMin; v._kmax = boundsMax;
      v._message = '🧭 超级罗盘全力运转，精确制导秘密区间在 ' + boundsMin + ' ~ ' + boundsMax + '！';
      showToast('🧭 超级罗盘：区间直接锁定 1/4！', 'gold');
    } else if (itemId === 'oracle_eye') {
      const maxNum = v._currentStage ? v._currentStage.max_number : 100;
      const marginMin = Math.max(1, v._s1 - 3);
      const marginMax = Math.min(maxNum, v._s1 + 3);
      v._message = '👁️ 先知之眼张开，其核心位置绝密锁定于: [ ' + marginMin + ' ~ ' + marginMax + ' ] 范围内！';
      showToast('👁️ 先知之眼：显示核心 ±3 邻近区间！', 'gold');
    } else if (itemId === 'double_coins') {
      updateSaveData(Object.assign({}, saveData, { double_coins_next: true, inventory: nextInv }));
      showToast('💰 本局收益加倍倍增器已启动就绪！', 'gold');
    }
    v._render();
  },
};

/* ----- 6.9 MastermindView (密码破译) ----- */
const MastermindView = {
  _secret: [], _attempts: 8, _currentMax: 8, _input: '', _guesses: [],
  _ended: false, _isWon: false, _usedItems: [], _revealedDigits: [], _animPlayed: false,

  mount() {
    const v = this;
    if (verdictMode) {
      v._input = ''; v._guesses = []; v._ended = false; v._isWon = false; v._usedItems = []; v._revealedDigits = []; v._animPlayed = false;
      v._message = '⏳ 正在向裁决中枢申请密码破译...';
      v._render();
      verdictStart('mastermind', undefined).then(function (rr) {
        if (rr.status === 200 && rr.json.ok) { mirrorMastermind(v, rr.json.game); v._render(); }
        else { showToast('❌ 裁决中枢连接失败', 'danger'); navigate('menu'); }
      });
      return;
    }
    v._secret = v._generateSecret();
    const maxAttempts = saveData.infinite_mode ? Infinity : (BALANCE.mastermind_attempts + (saveData.easy_mode ? 2 : 0));
    v._attempts = maxAttempts; v._currentMax = maxAttempts;
    v._input = ''; v._guesses = []; v._ended = false; v._isWon = false;
    v._usedItems = []; v._revealedDigits = []; v._animPlayed = false;
    setSecret('密码: ' + v._secret.join(''));
    window.__mastermind_secret__ = v._secret.join('');
    v._render();
  },
  unmount() { setSecret(null); window.__mastermind_secret__ = null; },

  _generateSecret() {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s = [];
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      s.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return s;
  },

  _render() {
    const v = this;
    const inf = saveData.infinite_mode;
    const attemptsDisplay = inf ? '∞' : (v._attempts + ' / ' + v._currentMax);
    const attemptsCls = (v._attempts <= 2 && !inf) ? 'text-red-400 animate-pulse' : 'text-cyan-400';
    const remainingPercent = inf ? 100 : (v._attempts / v._currentMax) * 100;
    const barCls = (v._attempts <= 2 && !inf) ? 'bg-gradient-to-r from-red-500 to-rose-400 shadow-glow shadow-red-500/30' : 'bg-gradient-to-r from-cyan-500 to-teal-400';

    const clueSlots = v._revealedDigits.length === 0
      ? '<span class="text-slate-600">暂无线索</span>'
      : v._revealedDigits.map(function (d) { return '<span class="text-amber-300 font-black mx-0.5">' + d + '</span>'; }).join('') + '<span class="text-slate-600 text-[10px] ml-1">· 剩余 ' + (4 - v._revealedDigits.length) + ' 位未知</span>';
    const nextHintCost = BALANCE.mastermind_hint_costs[v._revealedDigits.length] || 1;

    let guessesHtml = '';
    if (v._guesses.length === 0) {
      guessesHtml = '<div class="text-slate-500 text-center py-4">等待破译信号输入...</div>';
    } else {
      v._guesses.forEach(function (g) {
        const cols = g.guess.split('').map(function (d, i) {
          const icon = g.marks[i] === 'G' ? '<span class="text-emerald-400">✅</span>' : g.marks[i] === 'Y' ? '<span class="text-amber-300">⭕</span>' : '<span class="text-slate-500">⚫</span>';
          return '<div class="flex flex-col items-center gap-0.5"><span class="text-sm font-black text-slate-100 font-mono">' + d + '</span>' + icon + '</div>';
        }).join('');
        guessesHtml += '<div class="p-2 rounded-xl bg-white/5 border border-white/5 animate-slide-in flex items-center justify-between"><div class="flex gap-3">' + cols + '</div><span class="text-[10px] text-slate-500 font-mono shrink-0 ml-1">#' + (g.idx + 1) + '</span></div>';
      });
    }

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4' + (v._animPlayed ? '' : ' animate-view-in') + '">' +
        '<div class="flex items-center gap-3"><button id="mm-back" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-cyan-400"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">🔐 密码破译</h2>' + (saveData.debug_enabled ? '<div class="py-1 px-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-[10px] font-extrabold font-mono animate-pulse">🔧 [DEBUG: ' + v._secret.join('') + ']</div>' : '') + '</div>' +
        '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2 shadow-inner-soft text-slate-300 text-xs md:text-sm leading-relaxed"><div class="font-bold text-cyan-300 flex items-center gap-1"><i data-lucide="key" class="w-4 h-4"></i> 海盗宝箱密码锁</div><ul class="list-disc pl-4 space-y-0.5 text-slate-400"><li>密码由 <b class="text-cyan-400">4 位不重复数字</b>（1~9）组成，猜中 4 个 <b class="text-emerald-300">✅</b> 即开锁</li><li>每次猜测后，每位数字下方给出符号：<b class="text-emerald-300">✅</b> 数字和位置都对 · <b class="text-amber-300">⭕</b> 数字在密码中但位置不对 · <b class="text-slate-500">⚫</b> 不在密码中</li><li>提示最多 <b class="text-amber-300">2 次</b>，每次揭示一个密码数字（不含位置），第 2 次消耗 <b class="text-amber-300">2 点</b>机会</li><li>输入示例：<b class="font-mono text-cyan-400 bg-white/5 px-1.5 py-0.5 rounded">1234</b></li></ul></div>' +
        '<div class="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-center justify-between text-xs font-mono"><span class="text-slate-400">已探知数字</span><span class="tracking-widest text-sm">' + clueSlots + '</span></div>' +
        '<div class="space-y-1 mt-1"><div class="flex justify-between items-center text-xs"><span class="text-slate-400 font-semibold">开锁尝试次数</span><span class="font-bold font-mono ' + attemptsCls + '" id="mm-attempts">' + attemptsDisplay + '</span></div><div class="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5 p-[1px]"><div class="h-full rounded-full transition-all duration-300 ' + barCls + '" style="width:' + remainingPercent + '%"></div></div></div>' +
        '<div class="flex items-center gap-2 mt-1">' +
          '<input id="mm-input" type="text" value="' + escapeHtml(v._input) + '" ' + (v._ended ? 'disabled' : '') + ' maxlength="4" placeholder="' + (v._ended ? '本局破译已结束' : '输入 4 位不重复数字') + '" class="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:shadow-glow shadow-cyan-400/5 transition-all min-w-0" inputmode="numeric" pattern="[0-9]*" />' +
          '<button id="mm-submit" ' + (v._ended || v._input.trim().length !== 4 ? 'disabled' : '') + ' class="p-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"><i data-lucide="send" class="w-5 h-5"></i></button>' +
          '<button id="mm-hint" ' + (v._ended || (v._revealedDigits.length >= BALANCE.mastermind_hint_max) ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-cyan-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer font-bold text-xs" title="' + (v._revealedDigits.length >= BALANCE.mastermind_hint_max ? '本局线索已用尽' : '消耗 ' + nextHintCost + ' 次机会揭示一个密码数字（不含位置）') + '">提示</button>' +
          '<button id="mm-backpack" ' + (v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-cyan-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer" title="使用道具"><i data-lucide="backpack" class="w-5 h-5"></i></button>' +
        '</div>' +
        '<div class="flex flex-col gap-2 mt-1"><span class="text-xs text-slate-400 font-semibold tracking-wider uppercase">破译反馈日志</span><div id="mm-history" class="p-3 rounded-2xl bg-white/5 border border-white/10 max-h-[180px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 font-mono text-xs">' + guessesHtml + '</div></div>' +
      '</div>';

    refreshIcons();
    v._animPlayed = true;
    const mmHist = document.getElementById('mm-history');
    if (mmHist) mmHist.scrollTop = mmHist.scrollHeight;
    this._bind();
    const input = document.getElementById('mm-input');
    if (input && !v._ended) input.focus();
  },

  _bind() {
    const v = this;
    document.getElementById('mm-back').addEventListener('click', function () { audio.playClick(); navigate('menu'); setSecret(null); });
    const input = document.getElementById('mm-input');
    input.addEventListener('input', function (e) {
      v._input = e.target.value.replace(/[^0-9]/g, '');
      const sb = document.getElementById('mm-submit');
      if (sb) sb.disabled = v._ended || v._input.trim().length !== 4;
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v._submit(); });
    document.getElementById('mm-submit').addEventListener('click', function () { v._submit(); });
    document.getElementById('mm-hint').addEventListener('click', function () { v._hint(); });
    document.getElementById('mm-backpack').addEventListener('click', function () { audio.playClick(); openBackpack('mastermind', function (id) { v._useItem(id); }); });
  },

  _submit() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (verdictMode) {
      const raw = v._input.trim();
      if (raw.length !== 4) { showToast('❌ 请输入恰好 4 位数字密码！', 'danger'); return; }
      if (!/^[1-9]$/.test(raw) && !/^[1-9]{4}$/.test(raw)) { showToast('❌ 密码数字范围须为 1~9！', 'danger'); return; }
      v._input = '';
      verdictGuess(v._gameId, raw).then(function (rr) {
        if (rr.status !== 200 || !rr.json.ok) { showToast('❌ ' + ((rr.json && rr.json.error) || '提交失败'), 'danger'); v._render(); return; }
        mirrorMastermind(v, rr.json.game);
        if (rr.json.game.won) {
          verdictFinish(v._gameId, 'win').then(function (fr) {
            if (fr.status === 200 && fr.json.ok) {
              applyLedger(fr.json.result.ledger);
              mirrorProfile(fr.json.profile);
              v._gameId = null; v._ended = true;
              verdictFinishAlert(fr.json.result, { winTitle: '🎉 开锁成功！', winBody: function (t) { return '海盗宝箱密码破解成功！\n\n密码正为: ' + t + '！\n\n💰 获得金币: 🪙 +' + fr.json.result.reward.coins; } });
            }
          });
          return;
        }
        if (rr.json.game.lost) {
          verdictFinish(v._gameId, 'lose').then(function (fr) {
            if (fr.status === 200 && fr.json.ok) {
              applyLedger(fr.json.result.ledger);
              v._gameId = null; v._ended = true;
              verdictFinishAlert(fr.json.result, { loseTitle: '💀 机会耗尽', loseBody: function (t) { return '密码正为: [ ' + t + ' ]。'; } });
            }
          });
          return;
        }
        v._render();
      });
      return;
    }
    const raw = v._input.trim();
    if (raw.length !== 4) { showToast('❌ 请输入恰好 4 位数字密码！', 'danger'); return; }
    const g = raw.split('').map(function (c) { return parseInt(c, 10); });
    if (g.some(function (n) { return n < 1 || n > 9; })) { showToast('❌ 密码数字范围须为 1~9！', 'danger'); return; }
    if (new Set(g).size !== 4) { showToast('❌ 密码中的 4 位数字不能重复！', 'danger'); return; }

    const marks = g.map(function (d, i) {
      if (d === v._secret[i]) return 'G';
      if (v._secret.indexOf(d) !== -1) return 'Y';
      return 'N';
    });
    const exactCount = marks.filter(function (m) { return m === 'G'; }).length;
    v._guesses.push({ idx: v._guesses.length, guess: raw, marks: marks });
    v._input = '';

    if (exactCount === 4) {
      v._isWon = true; v._ended = true;
      audio.playWin();
      v._handleWin(v._guesses.length);
    } else {
      const nearText = exactCount >= 2 ? '，已有 ' + exactCount + ' 个位置正确' : '';
      if (!saveData.infinite_mode) {
        v._attempts = v._attempts - 1;
        if (v._attempts <= 0) { v._ended = true; audio.playFail(); v._handleLose(); }
        else { showToast('❌ 未开锁！' + nearText + '。剩余 ' + v._attempts + ' 次尝试', 'danger'); }
      } else {
        showToast('❌ 未开锁！' + nearText + '。继续破译吧！', 'info');
      }
    }
    v._render();
  },

  _hint() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (verdictMode) {
      verdictHint(v._gameId).then(function (rr) {
        if (rr.status !== 200 || !rr.json.ok) { showToast('❌ ' + ((rr.json && rr.json.error) || '提示失败'), 'danger'); return; }
        mirrorMastermind(v, rr.json.game);
        v._render();
      });
      return;
    }
    if (v._revealedDigits.length >= BALANCE.mastermind_hint_max) { showToast('❌ 本局最多可获取 ' + BALANCE.mastermind_hint_max + ' 条数字线索。', 'danger'); return; }
    const hintCost = BALANCE.mastermind_hint_costs[v._revealedDigits.length] || 1;
    if (!saveData.infinite_mode) {
      if (v._attempts <= hintCost) { showToast('❌ 本次线索需要 ' + hintCost + ' 点机会，次数不足！', 'danger'); return; }
      v._attempts = v._attempts - hintCost;
    }
    const known = {};
    v._revealedDigits.forEach(function (d) { known[d] = true; });
    const candidates = v._secret.filter(function (d) { return !known[d]; });
    const digit = candidates[Math.floor(Math.random() * candidates.length)];
    v._revealedDigits.push(digit);
    showToast('💡 线索：密码中含有数字 ' + digit + '！（消耗 ' + hintCost + ' 点机会）', 'info');
    v._render();
  },

  _useItem(itemId) {
    const v = this;
    audio.playClick();
    if (verdictMode) {
      verdictItem(v._gameId, itemId).then(function (rr) {
        if (rr.status !== 200 || !rr.json.ok) { showToast('❌ ' + ((rr.json && rr.json.error) || '道具使用失败'), 'danger'); return; }
        mirrorMastermind(v, rr.json.game);
        if (rr.json.ledger) applyLedger(rr.json.ledger);
        v._render();
      });
      return;
    }
    const nextInv = Object.assign({}, saveData.inventory);
    nextInv[itemId] = (nextInv[itemId] || 1) - 1;
    if (nextInv[itemId] <= 0) delete nextInv[itemId];
    v._usedItems.push(itemId);
    updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));

    if (itemId === 'chance_star') {
      if (!saveData.infinite_mode) { v._attempts += 2; v._currentMax += 2; }
      showToast('⭐ 机会星：已额外恢复 2 次破译机会！', 'success');
    } else if (itemId === 'diamond_star') {
      if (!saveData.infinite_mode) { v._attempts += 3; v._currentMax += 3; }
      showToast('💎 钻石星：一键充能！额外恢复 3 次破译机会！', 'gold');
    } else if (itemId === 'double_coins') {
      updateSaveData(Object.assign({}, saveData, { double_coins_next: true, inventory: nextInv }));
      showToast('💰 双倍卡：本局结算获得之金币已加倍锁定！', 'gold');
    }
    v._render();
  },

  _handleWin(totalUsed) {
    const v = this;
    const isEasy = saveData.easy_mode;
    const baseVal = BALANCE.mastermind_base_coins;
    const isFirstTime = !saveData.first_completions['mastermind'];
    let coins = baseVal;
    if (isFirstTime) coins *= 2;
    const remaining = v._currentMax - totalUsed;
    let bonusPercent = 0;
    if (totalUsed === 1) { bonusPercent = 250; triggerEgg('first_try'); }
    else if (remaining > 0) bonusPercent = Math.min(40, 15 + (remaining - 2) * 5);
    if (bonusPercent > 0) coins = Math.round(coins * (1 + bonusPercent / 100));
    const wasDouble = saveData.double_coins_next;
    if (wasDouble) coins *= 2;

    const counts = {};
    v._usedItems.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    let itemPenaltyPercent = 0;
    Object.keys(counts).forEach(function (id) {
      let total = 0;
      for (let i = 0; i < counts[id]; i++) total += (id === 'chance_star' ? 3 : id === 'diamond_star' ? 5 : 0) * Math.max(0.3, 1 - i * 0.25);
      itemPenaltyPercent += total;
    });
    itemPenaltyPercent = Math.min(BALANCE.item_penalty_cap, Math.round(itemPenaltyPercent));
    if (itemPenaltyPercent > 0) coins = Math.round(coins * (1 - itemPenaltyPercent / 100));
    if (isEasy) coins = Math.floor(coins * 0.65);

    let diamonds = 0;
    if (!saveData.infinite_mode && Math.random() < BALANCE.mastermind_diamond_chance) {
      diamonds = 1 + (Math.random() < 0.5 ? 1 : 0);
      if (itemPenaltyPercent > 0) diamonds = Math.round(diamonds * (1 - itemPenaltyPercent / 100));
      if (isEasy) diamonds = Math.floor(diamonds * 0.65);
    }

    triggerEgg('mastermind_king');

    const nextCompleted = saveData.completed_stages.slice();
    if (nextCompleted.indexOf('密码破译') === -1) nextCompleted.push('密码破译');
    const nextFirstCompletions = Object.assign({}, saveData.first_completions);
    if (isFirstTime) nextFirstCompletions['mastermind'] = true;

    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + coins, diamonds: saveData.diamonds + diamonds, total_wins: saveData.total_wins + 1, completed_stages: nextCompleted, first_completions: nextFirstCompletions, double_coins_next: false }));

    const msg = '开锁密码：' + v._secret.join('') + '！\n\n获得金币: 🪙 +' + coins + (isFirstTime ? ' (首通红利!)' : '') + (wasDouble ? ' (金币倍增卡生效!)' : '') + (diamonds > 0 ? '\n💎 获得钻石: 💎 +' + diamonds : '') + (isEasy ? '\n⚠️ 菜鸡模式加乘：-35%' : '') + (itemPenaltyPercent > 0 ? '\n⚠️ 道具承重负荷：-' + itemPenaltyPercent + '%' : '');
    setTimeout(function () {
      showGameAlert({
        title: '🔓 开锁成功！',
        tone: 'success',
        body: '密码破译成功！\n\n' + msg,
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },

  _handleLose() {
    const v = this;
    const isEasy = saveData.easy_mode;
    const compBase = BALANCE.mastermind_lose_comp;
    const finalComp = isEasy ? Math.floor(compBase * 0.65) : compBase;
    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + finalComp }));
    setTimeout(function () {
      showGameAlert({
        title: '💀 开锁失败',
        tone: 'danger',
        body: '正确密码是：' + v._secret.join('') + '。\n为您提供安慰保障：🪙 +' + finalComp + ' 金币',
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },
};

/* ----- 6.10 ArithmeticStormView (算术风暴) ----- */
const ArithmeticStormView = {
  _maxTime: 45, _timeLeft: 45, _cards: [], _solution: '', _input: '',
  _correctCount: 0, _totalRounds: 0, _combo: 0, _maxCombo: 0, _comboBonusCoins: 0,
  _stormDiamonds: 0, _ended: false, _usedItems: [], _message: '',
  _timer: null, _endSignal: false, _animPlayed: false,

  mount() {
    const v = this;
    if (verdictMode) {
      v._ended = false; v._usedItems = []; v._endSignal = false; v._animPlayed = false;
      v._message = '⏳ 正在向裁决中枢申请算术风暴...';
      v._render();
      verdictStart('arithmetic_storm', undefined).then(function (rr) {
        if (rr.status === 200 && rr.json.ok) {
          mirrorStorm(v, rr.json.game);
          window.__storm_cards__ = v._cards.slice();
          v._render();
          verdictTimer(v, function () { v._handleGameOver(); });
        } else { showToast('❌ 裁决中枢连接失败', 'danger'); navigate('menu'); }
      });
      return;
    }
    const isEasy = saveData.easy_mode;
    v._maxTime = BALANCE.storm_base_time + (isEasy ? BALANCE.storm_easy_time_bonus : 0);
    v._timeLeft = v._maxTime;
    v._correctCount = 0; v._totalRounds = 0; v._combo = 0; v._maxCombo = 0;
    v._comboBonusCoins = 0; v._stormDiamonds = 0; v._ended = false;
    v._usedItems = []; v._endSignal = false; v._animPlayed = false;
    v._puzzleLevel = 0; v._skipsLeft = isEasy ? BALANCE.storm_skip_max_easy : BALANCE.storm_skip_max;
    v._newPuzzle(true);
    v._render();
    v._timer = setInterval(function () {
      if (v._endSignal) return;
      if (saveData.infinite_mode) return;
      v._timeLeft = v._timeLeft - 1;
      if (v._timeLeft <= 0) { clearInterval(v._timer); v._timer = null; v._timeLeft = 0; v._handleGameOver(); return; }
      v._updateTimer();
    }, 1000);
  },
  unmount() { this._endSignal = true; if (this._timer) { clearInterval(this._timer); this._timer = null; } setSecret(null); window.__storm_cards__ = null; window.__storm_solution__ = null; },

  _newPuzzle(forceFirst) {
    const v = this;
    v._puzzleLevel = Math.min(3, Math.floor(v._correctCount / BALANCE.storm_level_step));
    let p;
    if (forceFirst) {
      p = { cards: [1, 2, 3, 4], solution: '1*2*3*4', level: 0 };
      v._puzzleLevel = 0;
    } else {
      p = generate24Puzzle(v._puzzleLevel);
    }
    v._cards = p.cards.slice();
    v._solution = p.solution;
    setSecret('算术风暴牌面: ' + v._cards.join(',') + ' 解: ' + p.solution);
    window.__storm_cards__ = v._cards.slice();
    window.__storm_solution__ = v._solution;
    v._input = '';
    v._message = '';
  },

  _skipPuzzle() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (v._skipsLeft <= 0) { showToast('❌ 换题次数已用尽。', 'danger'); return; }
    v._skipsLeft = v._skipsLeft - 1;
    v._combo = 0;
    v._newPuzzle(false);
    v._message = '🔄 已换题！剩余换题 ' + v._skipsLeft + ' 次';
    showToast('🔄 换题成功，连击已清零。', 'info');
    v._render();
  },

  _render() {
    const v = this;
    const inf = saveData.infinite_mode;
    const minutes = Math.floor(v._timeLeft / 60).toString().padStart(2, '0');
    const seconds = (v._timeLeft % 60).toString().padStart(2, '0');
    const isUrgent = v._timeLeft <= 10 && !inf;
    const isEasy = saveData.easy_mode;

    const cardHtml = v._cards.map(function (n, i) {
      return '<div class="flex-1 py-4 rounded-2xl bg-gradient-to-b from-cyan-500/15 to-teal-500/5 border border-cyan-500/25 text-center flex flex-col items-center gap-1 select-none"><span class="text-[9px] text-cyan-400/70 font-bold uppercase tracking-widest">牌 ' + (i + 1) + '</span><span class="text-2xl md:text-3xl font-black font-mono text-cyan-200">' + n + '</span></div>';
    }).join('');
    const lvlLabel = v._puzzleLevel >= 3 ? '困难' : v._puzzleLevel >= 2 ? '中等' : '简单';
    const lvlCls = v._puzzleLevel >= 3 ? 'text-red-400 border-red-500/30 bg-red-500/10' : v._puzzleLevel >= 2 ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
    const lvlText = '<span id="storm-level" class="ml-2 py-0.5 px-2 rounded-full border text-[9px] font-extrabold font-mono uppercase ' + lvlCls + '">本题难度: ' + lvlLabel + '</span>';

    mainEl().innerHTML =
      '<div class="flex flex-col gap-4' + (v._animPlayed ? '' : ' animate-view-in') + '">' +
        '<div class="flex items-center justify-between"><div class="flex items-center gap-3"><button id="storm-quit" class="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-red-400" title="强制撤离退出"><i data-lucide="chevron-left" class="w-5 h-5"></i></button><h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">🧮 算术风暴</h2></div>' + (v._stormDiamonds > 0 ? '<span class="text-xs bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">💎 +' + v._stormDiamonds + ' 钻石</span>' : '') + '</div>' +
        '<div class="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 shadow-inner-soft mt-1"><div class="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase tracking-wider"><i data-lucide="clock" class="w-4 h-4 ' + (isUrgent ? 'text-red-400 animate-spin-slow' : 'text-cyan-400') + '"></i> 结界剩余时间</div><div class="text-4xl md:text-5xl font-black font-mono tracking-widest ' + (isUrgent ? 'text-red-400 animate-pulse text-shadow-glow' : 'text-cyan-400') + '" id="storm-timer">' + (inf ? '∞' : (minutes + ':' + seconds)) + '</div><div class="flex justify-between w-full text-xs text-slate-400 font-semibold border-t border-white/5 pt-2 px-1"><span>已破解: <b class="text-cyan-400 font-mono" id="storm-correct">' + v._correctCount + '</b> 题</span>' + (v._combo >= 2 ? '<span class="text-amber-400 font-bold">🔥 连击数: ' + v._combo + '</span>' : '') + '</div></div>' +
        '<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-cyan-500/20 flex flex-col items-center gap-2 text-center relative"><div class="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1"><i data-lucide="calculator" class="w-3.5 h-3.5"></i> 用 + - × ÷ 与括号算出 24' + lvlText + '</div><div class="flex w-full gap-2 justify-center mt-1">' + cardHtml + '</div>' + (saveData.debug_enabled ? '<div class="absolute top-2 right-2 py-0.5 px-2 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-[9px] font-extrabold font-mono animate-pulse">[DEBUG: ' + v._solution + ']</div>' : '') + '<div class="text-[11px] text-slate-400 leading-relaxed max-w-xs min-h-[16px]" id="storm-message">' + escapeHtml(v._message) + '</div></div>' +
        '<div class="flex items-center gap-2 mt-1">' +
          '<input id="storm-input" type="text" value="' + escapeHtml(v._input) + '" ' + (v._ended ? 'disabled' : '') + ' placeholder="' + (v._ended ? '算术结界已关闭' : '例: (8+4)*(3-1)') + '" class="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:shadow-glow shadow-cyan-400/5 transition-all min-w-0" />' +
          '<button id="storm-submit" ' + (v._ended || !v._input.trim() ? 'disabled' : '') + ' class="p-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 text-[#06241f] font-bold shadow-glow shadow-cyan-400/10 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"><i data-lucide="send" class="w-5 h-5"></i></button>' +
          '<button id="storm-skip" ' + (v._ended || v._skipsLeft <= 0 ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer font-bold text-xs" title="换一道同难度新题（不扣时间，连击清零）">🔄</button>' +
          '<button id="storm-backpack" ' + (v._ended ? 'disabled' : '') + ' class="p-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-cyan-300 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer" title="使用道具"><i data-lucide="backpack" class="w-5 h-5"></i></button>' +
        '</div>' +
        '<div class="flex justify-between items-center text-xs text-slate-500 mt-2 font-mono"><span>每答对一题 +' + BALANCE.storm_correct_time_bonus + '秒 · 换题剩余 <b class="text-amber-300" id="storm-skips">' + v._skipsLeft + '</b> 次</span><span>四张牌必须恰好各用一次</span></div>' +
      '</div>';

    refreshIcons();
    v._animPlayed = true;
    const v2 = this;
    document.getElementById('storm-quit').addEventListener('click', function () { v2._handleManualQuit(); });
    const input = document.getElementById('storm-input');
    input.addEventListener('input', function (e) {
      v2._input = e.target.value;
      const sb = document.getElementById('storm-submit');
      if (sb) sb.disabled = v2._ended || !v2._input.trim();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v2._submit(); });
    document.getElementById('storm-submit').addEventListener('click', function () { v2._submit(); });
    document.getElementById('storm-skip').addEventListener('click', function () { v2._skipPuzzle(); });
    document.getElementById('storm-backpack').addEventListener('click', function () { audio.playClick(); openBackpack('arithmetic_storm', function (id) { v2._useItem(id); }); });
    if (!v2._ended) input.focus();
  },

  _updateTimer() {
    const inf = saveData.infinite_mode;
    const el = document.getElementById('storm-timer');
    if (!el) { this._render(); return; }
    if (inf) { el.textContent = '∞'; return; }
    const minutes = Math.floor(this._timeLeft / 60).toString().padStart(2, '0');
    const seconds = (this._timeLeft % 60).toString().padStart(2, '0');
    el.textContent = minutes + ':' + seconds;
    const isUrgent = this._timeLeft <= 10 && !inf;
    el.className = 'text-4xl md:text-5xl font-black font-mono tracking-widest ' + (isUrgent ? 'text-red-400 animate-pulse text-shadow-glow' : 'text-cyan-400');
  },

  _submit() {
    const v = this;
    audio.playClick();
    if (v._ended) return;
    if (verdictMode) {
      const expr = v._input.trim();
      v._input = '';
      verdictGuess(v._gameId, expr).then(function (rr) {
        if (rr.status !== 200 || !rr.json.ok) { showToast('❌ ' + ((rr.json && rr.json.error) || '提交失败'), 'danger'); v._render(); return; }
        mirrorStorm(v, rr.json.game);
        window.__storm_cards__ = v._cards.slice();
        v._render();
      });
      return;
    }
    const result = evaluate24(v._input, v._cards);
    if (!result.ok) {
      v._combo = 0;
      const reasonMap = {
        'empty': '算式为空',
        'illegal-chars': '包含非法字符（仅允许数字与 + - * / 括号）',
        'syntax': '算式语法错误',
        'paren': '括号不匹配',
        'range': '数字超出 1~99 范围',
        'div-zero': '算式出现除以 0',
        'card-count': '必须恰好使用全部 4 张牌各一次',
        'card-mismatch': '使用的数字与牌面不一致，且不能拼数（如 12）',
      };
      v._message = '❌ ' + (reasonMap[result.reason] || '算式无效');
      showToast('❌ ' + (reasonMap[result.reason] || '算式无效'), 'danger');
      v._render();
      return;
    }
    if (Math.abs(result.value - 24) >= 1e-9) {
      v._combo = 0;
      const shown = Math.round(result.value * 100) / 100;
      v._message = '❌ 算式结果为 ' + shown + '，不等于 24！请重新组合。';
      showToast('❌ 结果为 ' + shown + '，不是 24！', 'danger');
      v._render();
      return;
    }
    /* 正确 */
    audio.playWin();
    v._correctCount = v._correctCount + 1;
    v._totalRounds = v._totalRounds + 1;
    v._timeLeft = Math.min(BALANCE.storm_max_total_time, v._timeLeft + BALANCE.storm_correct_time_bonus);
    v._combo = v._combo + 1;
    if (v._combo > v._maxCombo) v._maxCombo = v._combo;
    let bonusText = '';
    if (v._combo >= 3) {
      const addedBonus = Math.ceil(v._combo * 2 * 1.1);
      const newTotal = Math.min(BALANCE.storm_combo_coin_cap, v._comboBonusCoins + addedBonus);
      const actualAdded = newTotal - v._comboBonusCoins;
      v._comboBonusCoins = newTotal;
      if (actualAdded > 0) bonusText = ' 🔥连击 x' + v._combo + '! (+' + actualAdded + ' 金币)';
    }
    if (!saveData.infinite_mode && v._stormDiamonds < BALANCE.storm_diamond_cap_per_run && Math.random() < BALANCE.storm_diamond_chance) {
      const diamondQty = 1 + (Math.random() < 0.5 ? 1 : 0);
      v._stormDiamonds = Math.min(BALANCE.storm_diamond_cap_per_run, v._stormDiamonds + diamondQty);
      showToast('💎 海怪吐出藏宝：+' + diamondQty + ' 钻石！', 'gold');
    }
    showToast('✅ 正确！24 点达成！+8秒' + bonusText, 'success');
    v._newPuzzle(false);
    v._render();
  },

  _useItem(itemId) {
    const v = this;
    audio.playClick();
    const nextInv = Object.assign({}, saveData.inventory);
    nextInv[itemId] = (nextInv[itemId] || 1) - 1;
    if (nextInv[itemId] <= 0) delete nextInv[itemId];
    v._usedItems.push(itemId);
    updateSaveData(Object.assign({}, saveData, { inventory: nextInv }));

    if (itemId === 'time_freeze') { v._timeLeft += 15; showToast('⏱️ 时光沙漏：结界时间 +15 秒！', 'success'); }
    else if (itemId === 'double_coins') { updateSaveData(Object.assign({}, saveData, { double_coins_next: true, inventory: nextInv })); showToast('💰 双倍结算倍增器已启动并待命！', 'gold'); }
    v._render();
  },

  _handleManualQuit() {
    const v = this;
    showGameConfirm({
      title: '🧮 强制撤离',
      tone: 'danger',
      body: '确认现在退出算术风暴吗？已有成果将进行部分折算结算。',
      confirmText: '确认撤离',
      onConfirm: function () { v._handleGameOver(); },
    });
  },

  _handleGameOver() {
    const v = this;
    if (v._endSignal) return;
    v._endSignal = true;
    if (v._timer) { clearInterval(v._timer); v._timer = null; }
    if (v._verdictTimer) { clearInterval(v._verdictTimer); v._verdictTimer = null; }
    v._ended = true;
    if (verdictMode) {
      if (!v._gameId) { navigate('menu'); setSecret(null); return; }
      const gid = v._gameId;
      v._gameId = null;
      verdictFinish(gid, 'quit').then(function (rr) {
        if (rr.status !== 200 || !rr.json.ok) { showToast('❌ 结算失败：' + ((rr.json && rr.json.error) || '网络异常'), 'danger'); navigate('menu'); return; }
        applyLedger(rr.json.result.ledger);
        mirrorProfile(rr.json.profile);
        const rd = rr.json.result.reward;
        if (rd.coins <= 0 && rd.diamonds <= 0) {
          showGameAlert({ title: '🧮 结界关闭', tone: 'danger', body: '本次算术风暴结算完成，无探险奖励。', onClose: function () { navigate('menu'); setSecret(null); } });
          return;
        }
        showGameAlert({ title: '🧮 结界关闭！', tone: 'success', body: '风暴时间到！结算物资:\n🪙 +' + rd.coins + ' 金币' + (rd.diamonds > 0 ? '\n💎 +' + rd.diamonds + ' 钻石' : ''), onClose: function () { navigate('menu'); setSecret(null); } });
      });
      return;
    }
    const isEasy = saveData.easy_mode;

    if (v._correctCount === 0) {
      audio.playFail();
      showGameAlert({
        title: '🧮 结界关闭',
        tone: 'danger',
        body: '您在本次算术风暴中没有解开任何算式，无探险奖励。',
        onClose: function () { navigate('menu'); setSecret(null); },
      });
      return;
    }

    triggerEgg('storm_master');

    const isFirstTime = !saveData.first_completions['arithmetic_storm'];
    let baseAward = v._correctCount * BALANCE.storm_correct_coins + Math.floor(v._timeLeft / 60 * BALANCE.storm_time_bonus_rate) + v._comboBonusCoins;
    if (saveData.double_coins_next) baseAward *= 2;
    let finalCoins = isFirstTime ? baseAward * 2 : Math.max(8, Math.floor(baseAward / 3));

    const counts = {};
    v._usedItems.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    let itemPenaltyPercent = 0;
    Object.keys(counts).forEach(function (id) {
      let total = 0;
      for (let i = 0; i < counts[id]; i++) total += (id === 'time_freeze' ? 2 : 0) * Math.max(0.3, 1 - i * 0.25);
      itemPenaltyPercent += total;
    });
    itemPenaltyPercent = Math.min(BALANCE.item_penalty_cap, Math.round(itemPenaltyPercent));
    if (itemPenaltyPercent > 0) finalCoins = Math.round(finalCoins * (1 - itemPenaltyPercent / 100));
    if (isEasy) finalCoins = Math.floor(finalCoins * 0.65);

    const finalWins = saveData.total_wins + v._correctCount;
    const nextCompleted = saveData.completed_stages.slice();
    if (nextCompleted.indexOf('算术风暴') === -1) nextCompleted.push('算术风暴');
    const nextFirstCompletions = Object.assign({}, saveData.first_completions);
    if (isFirstTime) nextFirstCompletions['arithmetic_storm'] = true;

    updateSaveData(Object.assign({}, saveData, { coins: saveData.coins + finalCoins, diamonds: saveData.diamonds + v._stormDiamonds, total_wins: finalWins, completed_stages: nextCompleted, first_completions: nextFirstCompletions, double_coins_next: false }));
    audio.playWin();

    const msg = '解开算式数: ' + v._correctCount + ' 题\n最高连击: 🔥 ' + v._maxCombo + '\n\n结算物资:\n🪙 +' + finalCoins + ' 金币 ' + (isFirstTime ? '(首通加成!)' : '') + (v._stormDiamonds > 0 ? '\n💎 +' + v._stormDiamonds + ' 钻石' : '') + (isEasy ? '\n⚠️ 菜鸡模式加乘：-35%' : '') + (itemPenaltyPercent > 0 ? '\n⚠️ 道具承重负荷：-' + itemPenaltyPercent + '%' : '');
    setTimeout(function () {
      showGameAlert({
        title: '🧮 结界关闭！',
        tone: 'success',
        body: '算术风暴挑战结束！\n\n' + msg,
        onClose: function () { navigate('menu'); setSecret(null); },
      });
    }, 200);
  },
};

/* ============================================================
 * 7. NAVIGATION + INIT  (ported from src/App.tsx routing)
 * ============================================================ */

const GAMEPLAY_MODES = ['story', 'free', 'inferno_campaign', 'inferno_single', 'mist', 'arithmetic'];

function navigate(mode) {
  currentGameMode = mode;
  if (currentViewUnmount) { try { currentViewUnmount(); } catch (e) { console.warn(e); } currentViewUnmount = null; }
  const el = mainEl();
  if (el) el.innerHTML = '';

  switch (mode) {
    case 'tutorial':
      TutorialView.mount();
      currentViewUnmount = function () { TutorialView.unmount(); };
      break;
    case 'menu':
      MainMenuView.mount();
      break;
    case 'shop':
      ShopView.mount();
      break;
    case 'stats':
      StatsView.mount();
      break;
    case 'settings':
      SettingsView.mount();
      break;
    case 'twin':
      TwinPuzzleView.mount();
      currentViewUnmount = function () { TwinPuzzleView.unmount(); };
      break;
    case 'blitz':
      BlitzChallengeView.mount();
      currentViewUnmount = function () { BlitzChallengeView.unmount(); };
      break;
    case 'mastermind':
      MastermindView.mount();
      currentViewUnmount = function () { MastermindView.unmount(); };
      break;
    case 'arithmetic_storm':
      ArithmeticStormView.mount();
      currentViewUnmount = function () { ArithmeticStormView.unmount(); };
      break;
    default:
      if (GAMEPLAY_MODES.indexOf(mode) !== -1) {
        GamePlayView.mount(mode);
        currentViewUnmount = function () { GamePlayView.unmount(); };
      } else {
        MainMenuView.mount();
      }
  }
}

function init() {
  audio.setMuted(!saveData.music_enabled);

  const audioToggle = document.getElementById('audio-toggle');
  audioToggle.addEventListener('click', function () {
    audio.playClick();
    const nextMusic = !saveData.music_enabled;
    updateSaveData(Object.assign({}, saveData, { music_enabled: nextMusic }));
    audio.setMuted(!nextMusic);
    updateAudioIcon();
  });

  window.addEventListener('pagehide', function () {
    if (cloudPushTimer) clearTimeout(cloudPushTimer);
    if (cloudMode) pushCloudSave();
  });

  refreshIcons();
  updateAudioIcon();
  navigate(currentGameMode);

  initCloudSync();

  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (e) { console.warn('Service Worker 注册失败:', e); });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

