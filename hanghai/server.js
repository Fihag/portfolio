'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SAVE_DIR = path.join(ROOT, 'saves');
const IDS_FILE = path.join(SAVE_DIR, 'ids.json');
const PORT = process.env.PORT || 8080;

fs.mkdirSync(SAVE_DIR, { recursive: true });

/* ============ 物品规则（服务端权威副本） ============ */

const ITEMS = {
  hint_stone: { name: '线索石', price: 24, max: 5, diamond: false },
  chance_star: { name: '机会星', price: 60, max: 3, diamond: false },
  protect_amulet: { name: '守护符', price: 90, max: 2, diamond: false },
  prophecy_scroll: { name: '预言之卷', price: 130, max: 1, diamond: false },
  golden_compass: { name: '黄金罗盘', price: 170, max: 1, diamond: false },
  time_freeze: { name: '时光沙漏', price: 70, max: 3, diamond: false },
  diamond_star: { name: '钻石星', price: 18, max: 2, diamond: true },
  shield_dome: { name: '穹顶护盾', price: 24, max: 1, diamond: true },
  super_compass: { name: '超级罗盘', price: 30, max: 1, diamond: true },
  oracle_eye: { name: '先知之眼', price: 38, max: 1, diamond: true },
  revival_talisman: { name: '复活符', price: 50, max: 1, diamond: true },
  double_coins: { name: '金币加倍', price: 20, max: 3, diamond: true },
};

function buyPriceOf(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return it.diamond ? it.price : Math.floor(it.price * 0.8);
}
function sellPriceOf(id) {
  return Math.floor(buyPriceOf(id) * 0.5);
}

/* ============ 平衡配置（服务端权威副本） ============ */

const BAL = {
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
  mastermind_attempts: 8,
  mastermind_base_coins: 48,
  mastermind_lose_comp: 10,
  mastermind_diamond_chance: 0.35,
  mastermind_hint_max: 2,
  mastermind_hint_costs: [1, 2],
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

const STAGES = {
  story_100: { name: '浅海海域', max_number: 100, attempts: BAL.story_attempts[100], inferno: false, mode: 'story' },
  story_200: { name: '深海浅滩', max_number: 200, attempts: BAL.story_attempts[200], inferno: false, mode: 'story' },
  story_500: { name: '远洋深渊', max_number: 500, attempts: BAL.story_attempts[500], inferno: false, mode: 'story' },
  inferno_100: { name: '烈焰浅滩 (1-100)', max_number: 100, attempts: BAL.inferno_attempts[100], inferno: true, mode: 'inferno' },
  inferno_200: { name: '熔岩深海 (1-200)', max_number: 200, attempts: BAL.inferno_attempts[200], inferno: true, mode: 'inferno' },
  inferno_500: { name: '地狱远洋 (1-500)', max_number: 500, attempts: BAL.inferno_attempts[500], inferno: true, mode: 'inferno' },
  free_100: { name: '浅海试炼 (1-100)', max_number: 100, attempts: BAL.story_attempts[100], inferno: false, mode: 'free' },
  free_200: { name: '深海探险 (1-200)', max_number: 200, attempts: BAL.story_attempts[200], inferno: false, mode: 'free' },
  free_500: { name: '远洋试炼 (1-500)', max_number: 500, attempts: BAL.story_attempts[500], inferno: false, mode: 'free' },
  free_inferno_100: { name: '烈焰浅滩试炼', max_number: 100, attempts: BAL.inferno_attempts[100], inferno: true, mode: 'inferno_single' },
  free_inferno_200: { name: '熔岩深海探险', max_number: 200, attempts: BAL.inferno_attempts[200], inferno: true, mode: 'inferno_single' },
  free_inferno_500: { name: '地狱远洋试炼', max_number: 500, attempts: BAL.inferno_attempts[500], inferno: true, mode: 'inferno_single' },
  mist: { name: '迷雾海域', max_number: 100, attempts: BAL.mist_attempts, inferno: false, mode: 'mist' },
  arithmetic: { name: '卧底猜数', max_number: 100, attempts: BAL.arithmetic_attempts, inferno: false, mode: 'arithmetic' },
};

/* ============ 账本 ============ */

function emptyLedger() {
  return {
    coins: 0,
    diamonds: 0,
    inventory: {},
    first_completions: {},
    double_coins_next: false,
    suspicious_fails: 0,
    first_suspicious_comp: 0,
    consecutive_fails: 0,
    easy_mode: false,
    infinite_mode: false,
  };
}

function emptyProfile() {
  return { music_enabled: true, tutorial_done: false, completed_stages: [], easter_eggs: [], total_wins: 0 };
}

function loadSave(pid) {
  try {
    const rec = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, pid + '.json'), 'utf8'));
    if (rec && rec.v === 2 && rec.ledger) {
      return {
        ledger: Object.assign({}, emptyLedger(), rec.ledger),
        profile: Object.assign({}, emptyProfile(), rec.profile),
        data: rec.data || null,
        ts: rec.ts || 0,
      };
    }
    return { ledger: emptyLedger(), profile: emptyProfile(), data: rec ? rec.data : null, ts: rec ? rec.ts : 0 };
  } catch (e) {
    return { ledger: emptyLedger(), profile: emptyProfile(), data: null, ts: 0 };
  }
}

function storeSave(pid, save) {
  const rec = { v: 2, ledger: save.ledger, profile: save.profile, data: save.data, ts: save.ts };
  fs.writeFileSync(path.join(SAVE_DIR, pid + '.json'), JSON.stringify(rec));
}

function loadIds() {
  try { return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveIds(ids) {
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids));
}
function hashSecret(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/* ============ 玩家独立加密密钥（仅存服务端，永不下发） ============ */

function getPlayerKey(pid) {
  const keyFile = path.join(SAVE_DIR, pid + '.key');
  try { return fs.readFileSync(keyFile, 'utf8'); } catch (e) {
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyFile, key);
    return key;
  }
}

function aesEncrypt(obj, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function aesDecrypt(b64, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 29) throw new Error('too short');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const data = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}

/* ============ 24 点验证（服务端权威副本） ============ */

function evaluate24(expr, cards) {
  const text = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/x/g, '*').replace(/X/g, '*').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (/[^0-9+\-*/(\)\s]/.test(text)) return { ok: false, reason: 'illegal-chars' };

  const tokens = [];
  const re = /(\d+|[+\-*/(\)])/g;
  let m;
  while ((m = re.exec(text)) !== null) tokens.push(m[1]);
  if (tokens.length === 0) return { ok: false, reason: 'empty' };

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
    if (!expectNum) return { ok: false, reason: 'syntax' };
    const n = parseInt(t, 10);
    if (n < 1 || n > 99) return { ok: false, reason: 'range' };
    tokens[i] = n;
    numCount++;
    expectNum = false;
  }
  if (depth !== 0) return { ok: false, reason: 'paren' };
  if (expectNum) return { ok: false, reason: 'syntax' };

  const used = tokens.filter(function (t) { return typeof t === 'number'; });
  const sortedUsed = used.slice().sort(function (a, b) { return a - b; });
  const sortedCards = cards.slice().sort(function (a, b) { return a - b; });
  if (sortedUsed.length !== sortedCards.length) return { ok: false, reason: 'card-count' };
  for (let i = 0; i < sortedUsed.length; i++) {
    if (sortedUsed[i] !== sortedCards[i]) return { ok: false, reason: 'card-mismatch' };
  }

  let pos = 0;
  const T = tokens;
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

function generateStormCards(level) {
  const opsNoDiv = ['+', '-', '*'];
  const opsAll = ['+', '-', '*', '/'];
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

/* ============ 游戏状态机 ============ */

const games = new Map();
const GAME_TTL = 6 * 60 * 60 * 1000;

function hintStrong(secret, max) {
  const isEven = secret % 2 === 0;
  const tips = [
    '这个数字是一个' + (isEven ? '偶数' : '奇数') + '。',
    '目标处于区间 ' + (secret <= max / 2 ? '1 ~ ' + Math.floor(max / 2) : (Math.floor(max / 2) + 1) + ' ~ ' + max) + ' 之中。',
    '个位数数字是 ' + (secret % 10) + '。',
    max >= 100 ? '数字的十位数是 ' + (Math.floor(secret / 10) % 10) + '，百位数是 ' + (Math.floor(secret / 100) % 10) + '。' : '数字的十位数是 ' + (Math.floor(secret / 10) % 10) + '。',
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function hintWeak(secret, max) {
  const isEven = secret % 2 === 0;
  const tips = [
    '似乎是一个' + (isEven ? '偶' : '奇') + '数……',
    '目标似乎比 ' + Math.floor(max / 2) + ' 要' + (secret <= max / 2 ? '小' : '大') + '一些。',
    '个位数字大致在 ' + Math.max(0, (secret % 10) - 2) + ' ~ ' + Math.min(9, (secret % 10) + 2) + ' 范围附近。',
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function pushUsed(game, id) {
  game.usedItems.push(id);
}

function itemPenalty(game, weightFn) {
  const counts = {};
  game.usedItems.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
  let total = 0;
  Object.keys(counts).forEach(function (id) {
    let t = 0;
    const cnt = counts[id];
    for (let i = 0; i < cnt; i++) {
      t += weightFn(id) * Math.max(0.3, 1 - i * 0.25);
    }
    total += t;
  });
  return Math.min(BAL.item_penalty_cap, Math.round(total));
}

function addEggs(profile, ids) {
  ids.forEach(function (id) {
    if (profile.easter_eggs.indexOf(id) === -1) profile.easter_eggs.push(id);
  });
  const standard = ['first_try', 'number_42', 'secret_fish', 'inferno_master', 'full_clear', 'hidden_song'];
  const hasAll = standard.every(function (k) { return profile.easter_eggs.indexOf(k) !== -1; });
  if (hasAll && profile.easter_eggs.indexOf('ultimate') === -1) profile.easter_eggs.push('ultimate');
}

function startGame(pid, save, mode, stageId) {
  const ledger = save.ledger;
  const easy = ledger.easy_mode;
  const infinite = ledger.infinite_mode;
  const game = {
    id: crypto.randomUUID(),
    pid: pid,
    mode: mode,
    startedAt: Date.now(),
    finishedAt: null,
    finished: false,
    result: null,
    easy: easy,
    infinite: infinite,
    maxAttempts: 0,
    attempts: 0,
    target: 0,
    decoy: 0,
    kmin: 1,
    kmax: 100,
    protectActive: false,
    shieldTries: 0,
    usedItems: [],
    guesses: [],
    message: '',
    won: false,
    lost: false,
    ended: false,
    hasWatchedVideoChance: false,
    stageKey: '',
    stageName: '',
    maxNumber: 100,
    inferno: false,
    mist: false,
    arithmetic: false,
    eggQueue: [],
    totalUsed: 0,
  };

  if (mode === 'tutorial') {
    game.stageKey = 'tutorial';
    game.stageName = '新手教程';
    game.maxNumber = 10;
    game.target = Math.floor(Math.random() * 10) + 1;
    game.maxAttempts = 5;
    game.attempts = 5;
    game.kmin = 1; game.kmax = 10;
    game.message = '🔍 教程海域：输入数字开始猜测。';
  } else if (mode === 'twin') {
    game.stageKey = 'twin_puzzle';
    game.stageName = '双生谜题';
    game.maxNumber = 100;
    game.target = Math.floor(Math.random() * 50) + 1;
    game.decoy = Math.floor(Math.random() * 50) + 51;
    game.maxAttempts = easy ? BAL.twin_attempts_easy : BAL.twin_attempts;
    game.attempts = game.maxAttempts;
    game.kmin = 1; game.kmax = 100;
    game.message = '🔮 双生谜题启动：两个目标数字，需要同时精准定位！';
  } else if (mode === 'blitz') {
    game.stageKey = 'blitz';
    game.stageName = '闪电挑战';
    game.maxAttempts = 0;
    game.attempts = 0;
    game.timeLeft = BAL.blitz_base_time + (easy ? BAL.blitz_easy_time_bonus : 0);
    game.maxTime = game.timeLeft;
    game.correctCount = 0;
    game.totalRounds = 0;
    game.difficultyLvl = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.comboBonusCoins = 0;
    game.blitzDiamonds = 0;
    game.chancesLeft = infinite ? Infinity : 2;
    game.clue = '';
    game.hintsUsedThisRound = 0;
    newBlitzQuestion(game, 0);
  } else if (mode === 'mastermind') {
    game.stageKey = 'mastermind';
    game.stageName = '密码破译';
    game.maxNumber = 9;
    game.maxAttempts = easy ? BAL.mastermind_attempts + 2 : BAL.mastermind_attempts;
    game.attempts = game.maxAttempts;
    game.hintsUsed = 0;
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    game.target = pool.slice(0, 4);
    game.message = '🔐 密码破译启动：4 位互不相同的数字密码（1~9）。';
  } else if (mode === 'arithmetic_storm') {
    game.stageKey = 'arithmetic_storm';
    game.stageName = '算术风暴';
    game.maxNumber = 24;
    game.timeLeft = BAL.storm_base_time + (easy ? BAL.storm_easy_time_bonus : 0);
    game.maxTime = game.timeLeft;
    game.correctCount = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.comboBonusCoins = 0;
    game.stormDiamonds = 0;
    game.puzzleLevel = 0;
    game.skipsLeft = easy ? BAL.storm_skip_max_easy : BAL.storm_skip_max;
    game.cards = [1, 2, 3, 4];
    game.message = '🧮 算术风暴启动：用 + - × ÷ 与括号算出 24。';
  } else {
    let stage;
    if (mode === 'mist') stage = STAGES.mist;
    else if (mode === 'arithmetic') stage = STAGES.arithmetic;
    else stage = STAGES[stageId] || STAGES.story_100;
    game.stageKey = (mode === 'mist' || mode === 'arithmetic') ? mode : (stageId || 'story_100');
    game.stageName = stage.name;
    game.maxNumber = stage.max_number;
    game.inferno = stage.inferno;
    game.mist = mode === 'mist';
    game.arithmetic = mode === 'arithmetic';
    game.target = Math.floor(Math.random() * stage.max_number) + 1;
    if (game.arithmetic) {
      let decoy = Math.floor(Math.random() * 100) + 1;
      while (decoy === game.target) decoy = Math.floor(Math.random() * 100) + 1;
      game.decoy = decoy;
    }
    game.maxAttempts = stage.attempts + (easy ? 3 : 0);
    game.attempts = game.maxAttempts;
    game.kmin = 1;
    game.kmax = stage.max_number;
    game.message = game.inferno
      ? '🔥 炼狱之火在燃烧，罗盘将不提供范围和大小提示。祝你好运。'
      : '输入数字开始猜测。输入"H"消耗 1 次机会获取提示指南，🎒 可以调出备用道具舱。';
    if (game.mist) game.message = '🌫️ 迷雾笼罩着这片海域，提示指南和大部分定向缩减道具无法在迷雾中工作。';
    if (game.arithmetic) game.message = '🕵️ 虚实数字迷局。系统锁定了两个目标数，其中一个为真，另一个为诱饵。';
  }

  games.set(game.id, game);
  games.set('_ttl_' + game.id, Date.now() + GAME_TTL);
  return game;
}

function newBlitzQuestion(game, lvl) {
  const rangeSize = Math.min(180, 40 + lvl * 5 + Math.floor(Math.random() * 21));
  const rangeStart = Math.floor(Math.random() * (1000 - rangeSize)) + 1;
  const rangeEnd = rangeStart + rangeSize;
  game.lowBound = rangeStart;
  game.highBound = rangeEnd;
  game.target = Math.floor(Math.random() * (rangeEnd - rangeStart + 1)) + rangeStart;
  game.chancesLeft = game.infinite ? Infinity : 2;
  game.clue = '';
  game.hintsUsedThisRound = 0;
  game.message = '猜测介于 ' + rangeStart + ' ~ ' + rangeEnd + ' 之间的秘密数字';
}

function gameView(game) {
  const v = {
    gameId: game.id,
    mode: game.mode,
    stageKey: game.stageKey,
    stageName: game.stageName,
    maxNumber: game.maxNumber,
    inferno: !!game.inferno,
    mist: !!game.mist,
    arithmetic: !!game.arithmetic,
    maxAttempts: game.maxAttempts,
    attempts: game.attempts,
    infinite: !!game.infinite,
    easy: !!game.easy,
    kmin: game.kmin,
    kmax: game.kmax,
    message: game.message,
    guesses: game.guesses,
    ended: game.ended,
    won: game.won,
    lost: game.lost,
    canRevive: false,
    canVideo: false,
  };
  if (game.mode === 'twin') {
    v.maxNumber = 100;
    v.message = game.message;
  }
  if (game.mode === 'blitz') {
    v.timeLeft = Math.max(0, Math.ceil(game.timeLeft));
    v.correctCount = game.correctCount;
    v.totalRounds = game.totalRounds;
    v.difficultyLvl = game.difficultyLvl;
    v.lowBound = game.lowBound;
    v.highBound = game.highBound;
    v.chancesLeft = game.chancesLeft;
    v.clue = game.clue || '';
    v.combo = game.combo;
    v.blitzDiamonds = game.blitzDiamonds;
  }
  if (game.mode === 'arithmetic_storm') {
    v.timeLeft = Math.max(0, Math.ceil(game.timeLeft));
    v.correctCount = game.correctCount;
    v.cards = game.cards;
    v.skipsLeft = game.skipsLeft;
    v.combo = game.combo;
    v.stormDiamonds = game.stormDiamonds;
    v.puzzleLevel = game.puzzleLevel;
  }
  if (game.mode === 'mastermind') {
    v.hintsUsed = game.hintsUsed || 0;
    v.revealedDigits = game.revealedDigits || [];
    v.maxNumber = 9;
  }
  if (game.ended && !game.finished) {
    const hasRevival = game.mode !== 'blitz' && game.mode !== 'arithmetic_storm' && game.mode !== 'mastermind';
    if (hasRevival && !game.won) {
      v.canRevive = true;
      v.canVideo = !game.inferno && !game.hasWatchedVideoChance;
    }
  }
  return v;
}

function handleGuess(game, val) {
  if (game.ended || game.finished) return { error: 'game over' };
  const mode = game.mode;

  if (mode === 'arithmetic_storm') {
    return handleStormGuess(game, String(val).trim());
  }
  if (mode === 'blitz') {
    return handleBlitzGuess(game, val);
  }
  if (mode === 'mastermind') {
    return handleMastermindGuess(game, val);
  }
  if (mode === 'twin') {
    return handleTwinGuess(game, val);
  }
  return handleNumberGuess(game, val);
}

function handleNumberGuess(game, val) {
  if (!Number.isInteger(val)) return { error: 'not a number' };
  if (val < 1 || val > game.maxNumber) return { error: 'out of range' };
  if (game.attempts <= 0 && !game.infinite) return { error: 'no attempts' };

  if (val === 42) game.eggQueue.push('number_42');
  if (val === 520 || val === 1314 || val === 777) game.eggQueue.push('hidden_song');

  let spendChance = true;
  if (game.protectActive) { spendChance = false; game.protectActive = false; }
  else if (game.shieldTries > 0) { spendChance = false; game.shieldTries -= 1; }

  let nextAttempts = game.attempts;
  if (spendChance && !game.infinite) { nextAttempts -= 1; game.attempts = nextAttempts; }

  if (val === game.target) {
    game.won = true;
    game.ended = true;
    game.totalUsed = game.maxAttempts - nextAttempts;
    game.message = '🎉 命中！';
    return { ok: true };
  }

  const idx = game.guesses.length;
  if (game.arithmetic) {
    const target = Math.random() < 0.5 ? game.target : game.decoy;
    const clueText = val === game.decoy ? '🤔 这只是一个诱饵，它并不是真正通航的正确数字！' : (target > val ? '某个数字大于 ' + val : '某个数字小于 ' + val);
    game.guesses.push({ idx: idx, guess: val, icon: '🕵️', text: clueText });
    game.message = clueText;
  } else if (game.mist) {
    let nextMin = game.kmin, nextMax = game.kmax;
    if (val < game.target) nextMin = Math.max(game.kmin, val + 1); else nextMax = Math.min(game.kmax, val - 1);
    if (Math.random() < 0.3) nextMin = Math.min(nextMax - 2, nextMin + 1);
    if (Math.random() < 0.3) nextMax = Math.max(nextMin + 2, nextMax - 1);
    game.kmin = nextMin; game.kmax = nextMax;
    const clueText = val < game.target ? '⬆ ' + val + ' 偏小（在迷雾中范围可能发生了微移）' : '⬇ ' + val + ' 偏大（在迷雾中范围可能发生了微移）';
    game.guesses.push({ idx: idx, guess: val, icon: '🌫️', text: clueText });
    game.message = clueText;
  } else if (game.inferno) {
    game.guesses.push({ idx: idx, guess: val, icon: '🔥', text: '水汽升腾，坐标已掩埋' });
    game.message = '坐标已掩埋...继续探索';
  } else {
    let nextMin = game.kmin, nextMax = game.kmax;
    if (val < game.target && val > game.kmin) nextMin = val;
    if (val > game.target && val < game.kmax) nextMax = val;
    game.kmin = nextMin; game.kmax = nextMax;
    const dist = Math.abs(val - game.target);
    const totalRange = game.maxNumber;
    let scaleText = val < game.target ? '⬆ ' + val + ' 偏小' : '⬇ ' + val + ' 偏大';
    if (dist <= Math.max(1, totalRange * 0.05)) scaleText += ' 🔥极近！';
    else if (dist <= Math.max(1, totalRange * 0.12)) scaleText += ' 🔥很近';
    else if (dist <= Math.max(1, totalRange * 0.25)) scaleText += ' 👍方向对';
    else scaleText += ' 🌊较远';
    game.guesses.push({ idx: idx, guess: val, icon: '⚓', text: scaleText });
    game.message = scaleText;
  }

  if (nextAttempts <= 0 && !game.infinite && !game.won) {
    game.ended = true;
    game.lost = true;
  }
  return { ok: true };
}

function handleTwinGuess(game, val) {
  const raw = String(val).replace(/，/g, ',').trim();
  const parts = raw.split(',').map(function (p) { return p.trim(); });
  if (parts.length !== 2) return { error: 'format' };
  const g1 = parseInt(parts[0], 10);
  const g2 = parseInt(parts[1], 10);
  if (isNaN(g1) || isNaN(g2)) return { error: 'format' };
  if (g1 < 1 || g1 > 50 || g2 < 51 || g2 > 100) return { error: 'out of range' };
  if (game.attempts <= 0 && !game.infinite) return { error: 'no attempts' };
  if (game.ended) return { error: 'game over' };

  let spendChance = true;
  if (game.protectActive) { spendChance = false; game.protectActive = false; }
  else if (game.shieldTries > 0) { spendChance = false; game.shieldTries -= 1; }

  let nextAttempts = game.attempts;
  if (spendChance && !game.infinite) { nextAttempts -= 1; game.attempts = nextAttempts; }

  if (g1 === 42 || g2 === 42) game.eggQueue.push('number_42');
  if (g1 === 520 || g1 === 1314 || g1 === 777 || g2 === 520 || g2 === 1314 || g2 === 777) game.eggQueue.push('hidden_song');

  const c1 = g1 === game.target ? '✅' : (g1 < game.target ? '⬆ 大一点' : '⬇ 小一点');
  const c2 = g2 === game.decoy ? '✅' : (g2 < game.decoy ? '⬆ 大一点' : '⬇ 小一点');
  game.guesses.push({ idx: game.guesses.length, g1: g1, g2: g2, c1: c1, c2: c2 });
  game.message = (g1 === game.target && g2 === game.decoy) ? '🎉 双生同频！' : c1 + ' / ' + c2;

  if (g1 === game.target && g2 === game.decoy) {
    game.won = true;
    game.ended = true;
    game.totalUsed = game.maxAttempts - nextAttempts;
  } else if (nextAttempts <= 0 && !game.infinite) {
    game.ended = true;
    game.lost = true;
  }
  return { ok: true };
}

function handleBlitzGuess(game, val) {
  if (!Number.isInteger(val) || val < game.lowBound || val > game.highBound) return { error: 'out of range' };
  if (game.ended) return { error: 'game over' };
  game.totalRounds += 1;
  if (val === 42) game.eggQueue.push('number_42');

  if (val === game.target) {
    game.correctCount += 1;
    game.timeLeft = Math.min(BAL.blitz_max_total_time, game.timeLeft + 10);
    game.combo += 1;
    if (game.combo > game.maxCombo) game.maxCombo = game.combo;
    let bonusText = '';
    if (game.combo >= 3) {
      const addedBonus = Math.ceil(game.combo * 2 * 1.1);
      const newTotal = Math.min(BAL.blitz_combo_coin_cap, game.comboBonusCoins + addedBonus);
      game.comboBonusCoins = newTotal;
    }
    if (!game.infinite && game.blitzDiamonds < BAL.blitz_diamond_cap_per_run && Math.random() < BAL.blitz_diamond_chance) {
      const qty = 1 + (Math.random() < 0.5 ? 1 : 0);
      game.blitzDiamonds = Math.min(BAL.blitz_diamond_cap_per_run, game.blitzDiamonds + qty);
    }
    game.difficultyLvl += 1;
    newBlitzQuestion(game, game.difficultyLvl);
    return { ok: true };
  }

  game.combo = 0;
  const diff = Math.abs(val - game.target);
  const size = game.highBound - game.lowBound;
  let relativeHint = val < game.target ? '⬆ 太小了' : '⬇ 太大了';
  if (diff <= Math.max(1, size * 0.08)) relativeHint += ' 🔥极近！';
  else if (diff <= Math.max(1, size * 0.2)) relativeHint += ' 🔥很近';
  else if (diff <= Math.max(1, size * 0.4)) relativeHint += ' 👍方向对';
  else relativeHint += ' 🌊较远';

  if (!game.infinite) {
    game.chancesLeft -= 1;
    if (game.chancesLeft <= 0) {
      game.message = '❌ 猜错！机会耗尽，本题答案是 ' + game.target + '。自动跳转下一题！';
      newBlitzQuestion(game, game.difficultyLvl);
    } else {
      game.message = relativeHint + '！剩余 ' + game.chancesLeft + ' 次猜测机会';
    }
  } else {
    game.message = relativeHint + '！';
  }
  return { ok: true };
}

function handleMastermindGuess(game, input) {
  const digits = String(input);
  if (!/^\d{4}$/.test(digits)) return { error: 'format' };
  const nums = digits.split('').map(Number);
  if (new Set(nums).size !== 4) return { error: 'duplicate' };
  if (game.attempts <= 0 && !game.infinite) return { error: 'no attempts' };
  if (game.ended) return { error: 'game over' };

  let spendChance = true;
  if (game.protectActive) { spendChance = false; game.protectActive = false; }
  else if (game.shieldTries > 0) { spendChance = false; game.shieldTries -= 1; }

  let nextAttempts = game.attempts;
  if (spendChance && !game.infinite) { nextAttempts -= 1; game.attempts = nextAttempts; }

  let G = 0, Y = 0;
  const targetRemain = [];
  const guessRemain = [];
  for (let i = 0; i < 4; i++) {
    if (nums[i] === game.target[i]) G++;
    else {
      targetRemain.push(game.target[i]);
      guessRemain.push(nums[i]);
    }
  }
  targetRemain.sort();
  guessRemain.sort();
  let i = 0, j = 0;
  while (i < targetRemain.length && j < guessRemain.length) {
    if (targetRemain[i] === guessRemain[j]) { Y++; i++; j++; }
    else if (targetRemain[i] < guessRemain[j]) i++;
    else j++;
  }
  const text = '🔑 ' + digits + ' → ' + 'G'.repeat(G) + (Y > 0 ? 'Y'.repeat(Y) : '') + (G + Y === 0 ? '全部未中' : '') + ' (' + G + ' 位位置正确, ' + Y + ' 位数字正确但位置不对)';
  const marks = nums.map(function (n, i) {
    if (nums[i] === game.target[i]) return 'G';
    if (game.target.indexOf(nums[i]) !== -1) return 'Y';
    return 'N';
  });
  game.guesses.push({ idx: game.guesses.length, guess: digits, marks: marks });
  game.message = text;

  if (G === 4) {
    game.won = true;
    game.ended = true;
    game.totalUsed = game.maxAttempts - nextAttempts;
  } else if (nextAttempts <= 0 && !game.infinite) {
    game.ended = true;
    game.lost = true;
  }
  return { ok: true };
}

function handleStormGuess(game, exprText) {
  if (game.ended) return { error: 'game over' };
  if (exprText === 'SKIP') {
    if (game.skipsLeft <= 0) return { error: 'no skips' };
    game.skipsLeft -= 1;
    game.combo = 0;
    game.puzzleLevel = Math.min(3, Math.floor(game.correctCount / BAL.storm_level_step));
    game.cards = generateStormCards(game.puzzleLevel).cards;
    game.message = '🔄 已换题！剩余换题 ' + game.skipsLeft + ' 次';
    return { ok: true };
  }
  const r = evaluate24(exprText, game.cards);
  if (!r.ok) {
    game.message = '❌ 算式无效：' + r.reason;
    return { ok: true };
  }
  if (Math.abs(r.value - 24) > 1e-9) {
    game.combo = 0;
    game.message = '❌ 结果为 ' + r.value + '，不等于 24。';
    return { ok: true };
  }
  game.correctCount += 1;
  game.timeLeft = Math.min(BAL.storm_max_total_time, game.timeLeft + BAL.storm_correct_time_bonus);
  game.combo += 1;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;
  if (game.combo >= 3) {
    const addedBonus = Math.ceil(game.combo * 2 * 1.1);
    game.comboBonusCoins = Math.min(BAL.storm_combo_coin_cap, game.comboBonusCoins + addedBonus);
  }
  if (!game.infinite && game.stormDiamonds < BAL.storm_diamond_cap_per_run && Math.random() < BAL.storm_diamond_chance) {
    const qty = 1 + (Math.random() < 0.5 ? 1 : 0);
    game.stormDiamonds = Math.min(BAL.storm_diamond_cap_per_run, game.stormDiamonds + qty);
  }
  game.puzzleLevel = Math.min(3, Math.floor(game.correctCount / BAL.storm_level_step));
  game.cards = generateStormCards(game.puzzleLevel).cards;
  game.message = '✅ 正确！下一题难度 ' + ['简单', '简单', '中等', '困难'][game.puzzleLevel] + '。';
  return { ok: true };
}

function handleHint(game) {
  if (game.ended || game.finished) return { error: 'game over' };
  if (game.mode === 'arithmetic_storm' || game.mode === 'blitz' || game.mode === 'mastermind' || game.mode === 'twin') {
    return handleModeHint(game);
  }
  if (game.inferno) return { error: 'no hint in inferno' };
  if (game.mist) return { error: 'no hint in mist' };
  if (!game.infinite && game.attempts <= 1) return { error: 'not enough attempts' };
  if (!game.infinite) game.attempts -= 1;
  game.message = '💡 [普通线索] ' + hintWeak(game.target, game.maxNumber);
  return { ok: true };
}

function handleModeHint(game) {
  if (game.mode === 'blitz') {
    if (!game.easy) return { error: 'not easy mode' };
    if (game.hintsUsedThisRound >= 1) return { error: 'hint used' };
    game.hintsUsedThisRound = 1;
    game.clue = '菜鸡航标: 目标 ' + (game.target % 2 === 0 ? '是偶数' : '是奇数') + '，位于 ' + (game.target > (game.lowBound + game.highBound) / 2 ? '上半区' : '下半区');
    return { ok: true };
  }
  if (game.mode === 'mastermind') {
    if (game.hintsUsed >= BAL.mastermind_hint_max) return { error: 'hint limit' };
    const cost = BAL.mastermind_hint_costs[game.hintsUsed] || 1;
    if (!game.infinite && game.attempts <= cost) return { error: 'not enough attempts' };
    if (!game.infinite) game.attempts -= cost;
    game.hintsUsed += 1;
    if (!game.revealedDigits) game.revealedDigits = [];
    const known = {};
    game.revealedDigits.forEach(function (d) { known[d] = true; });
    const candidates = game.target.filter(function (d) { return !known[d]; });
    const digit = candidates[Math.floor(Math.random() * candidates.length)];
    game.revealedDigits.push(digit);
    game.message = '💡 先知提示：密码中包含数字 ' + digit + '。';
    return { ok: true };
  }
  if (game.mode === 'twin') {
    if (!game.infinite && game.attempts <= 1) return { error: 'not enough attempts' };
    if (!game.infinite) game.attempts -= 1;
    game.message = '💡 [普通线索] ' + (Math.random() < 0.5 ? '较小数' : '较大数') + '在 ' + (Math.random() < 0.5 ? game.target : game.decoy) + ' 附近 ±3';
    return { ok: true };
  }
  return { error: 'no hint' };
}

function handleItem(game, save, itemId) {
  if (game.finished) return { error: 'game over' };
  if (game.ended && !(itemId === 'revival_talisman' && game.lost)) return { error: 'game over' };
  const it = ITEMS[itemId];
  if (!it) return { error: 'unknown item' };
  const owned = save.ledger.inventory[itemId] || 0;
  if (owned <= 0) return { error: 'not owned' };

  const mode = game.mode;
  const ledger = save.ledger;

  if (itemId === 'double_coins') {
    if (!ledger.double_coins_next) {
      ledger.double_coins_next = true;
      storeSave(game.pid, save);
    }
    pushUsed(game, itemId);
    game.message = '💰 双倍卡：本局结算获得之金币已加倍锁定！';
    return { ok: true };
  }

  const consume = function () {
    save.ledger.inventory[itemId] = owned - 1;
    if (save.ledger.inventory[itemId] <= 0) delete save.ledger.inventory[itemId];
    storeSave(game.pid, save);
    pushUsed(game, itemId);
  };

  switch (itemId) {
    case 'hint_stone':
      if (mode === 'arithmetic_storm' || mode === 'mastermind') {
        if (mode === 'mastermind') { game.message = '💡 [线索石] ' + hintStrong(game.target[0], 9); }
        else { game.message = '💡 [线索石] 试试先凑出 ' + (game.cards[0] * game.cards[1]) + ' 这样的中间结果。'; }
      } else if (game.mist || game.inferno) {
        game.message = '💡 [线索石] ' + (game.mist ? '迷雾散去一瞬：' : '地心热能定位：') + hintStrong(game.target, game.maxNumber);
      } else {
        game.message = '💡 [线索石] ' + hintStrong(game.target, game.maxNumber);
      }
      consume();
      return { ok: true };
    case 'chance_star':
      if (mode === 'arithmetic_storm' || mode === 'blitz') return { error: 'not usable here' };
      if (!game.infinite) {
        const gain = (mode === 'twin' || mode === 'mastermind') ? 2 : 1;
        game.attempts += gain;
        if (mode === 'twin' || mode === 'mastermind') { game.maxAttempts += gain; }
      }
      game.message = '⭐ 机会星：已额外恢复 ' + ((mode === 'twin' || mode === 'mastermind') ? 2 : 1) + ' 次猜测机会！';
      consume();
      return { ok: true };
    case 'diamond_star':
      if (mode === 'arithmetic_storm' || mode === 'blitz') {
        if (mode === 'blitz') {
          if (!game.infinite) game.timeLeft += 20;
          game.message = '💎 钻石星：闪电补给 +20 秒！';
        } else {
          if (!game.infinite) game.timeLeft += 15;
          game.message = '💎 钻石星：风暴补给 +15 秒！';
        }
      } else {
        if (!game.infinite) { game.attempts += 3; game.maxAttempts += 3; }
        game.message = '💎 钻石星：一键充能！额外恢复 3 次猜测机会！';
      }
      consume();
      return { ok: true };
    case 'protect_amulet':
      game.protectActive = true;
      game.message = '🛡️ 守护符已装备：下一次失误将不消耗机会。';
      consume();
      return { ok: true };
    case 'shield_dome':
      game.shieldTries = 3;
      game.message = '🛡️ 穹顶护盾启动：接下来 3 次失误不消耗机会。';
      consume();
      return { ok: true };
    case 'prophecy_scroll':
      if (mode === 'blitz' || mode === 'arithmetic_storm') return { error: 'not usable here' };
      if (mode === 'mastermind') {
        game.message = '📜 [预言之卷] 密码中有一个数字是 ' + game.target[0];
      } else if (mode === 'twin') {
        const t = Math.random() < 0.5 ? game.target : game.decoy;
        game.message = '📜 [预言之卷] 其中一个目标的十位数是 ' + (Math.floor(t / 10) % 10) + '。';
      } else {
        game.message = '📜 [预言之卷] 目标数字的十位数是 ' + (Math.floor(game.target / 10) % 10) + '。';
      }
      consume();
      return { ok: true };
    case 'golden_compass':
      if (mode === 'mist' || mode === 'arithmetic' || mode === 'blitz' || mode === 'arithmetic_storm' || mode === 'mastermind' || mode === 'twin') {
        if (mode === 'blitz' || mode === 'arithmetic_storm') return { error: 'not usable here' };
        if (game.kmax - game.kmin > 2) {
          const mid = Math.floor((game.kmin + game.kmax) / 2);
          if (Math.random() < 0.5) { game.kmin = mid; } else { game.kmax = mid; }
        }
        game.message = '🧭 黄金罗盘：目标搜索范围已缩小一半！';
      } else if (game.kmax - game.kmin > 2) {
        const mid = Math.floor((game.kmin + game.kmax) / 2);
        if (Math.random() < 0.5) { game.kmin = mid; } else { game.kmax = mid; }
        game.message = '🧭 黄金罗盘：目标搜索范围已缩小一半！';
      }
      consume();
      return { ok: true };
    case 'super_compass':
      if (mode === 'mist' || mode === 'arithmetic' || mode === 'blitz' || mode === 'arithmetic_storm' || mode === 'mastermind' || mode === 'twin') {
        if (mode === 'blitz' || mode === 'arithmetic_storm') return { error: 'not usable here' };
        if (game.kmax - game.kmin > 4) {
          const span = game.kmax - game.kmin;
          const q = Math.floor(span / 4);
          const direction = Math.random() < 0.5;
          if (direction) game.kmin = game.kmin + q; else game.kmax = game.kmax - q;
        }
        game.message = '🧭 超级罗盘：目标搜索范围已缩小至 1/4！';
      }
      consume();
      return { ok: true };
    case 'oracle_eye':
      if (mode === 'blitz' || mode === 'arithmetic_storm' || mode === 'mist' || mode === 'arithmetic' || mode === 'mastermind') {
        if (mode === 'blitz' || mode === 'arithmetic_storm') {
          if (!game.infinite) game.timeLeft += 15;
          game.message = '👁️ 先知之眼：时间 +15 秒！';
        } else {
          game.message = '👁️ 先知之眼：目标在 ' + Math.max(1, game.target - 3) + ' ~ ' + Math.min(game.maxNumber, game.target + 3) + ' 之间。';
        }
      } else {
        game.message = '👁️ 先知之眼：目标在 ' + Math.max(1, game.target - 3) + ' ~ ' + Math.min(game.maxNumber, game.target + 3) + ' 之间。';
      }
      consume();
      return { ok: true };
    case 'time_freeze':
      if (mode !== 'blitz' && mode !== 'arithmetic_storm') return { error: 'not usable here' };
      if (!game.infinite) game.timeLeft += 15;
      game.message = '⏳ 时光沙漏：时间冻结 +15 秒！';
      consume();
      return { ok: true };
    case 'revival_talisman':
      if (game.lost) {
        game.attempts = Math.ceil(game.maxAttempts / 2);
        game.lost = false;
        game.ended = false;
        game.message = '💎 复活符已生效！紧急破舱提供 ' + game.attempts + ' 次多维猜想机会！';
        consume();
        return { ok: true };
      }
      return { error: 'no need' };
    default:
      return { error: 'unknown item' };
  }
}

function handleVideo(game) {
  if (game.hasWatchedVideoChance || game.inferno) return { error: 'no video' };
  if (!game.lost) return { error: 'no need' };
  game.hasWatchedVideoChance = true;
  const added = Math.floor(Math.random() * 3) + 1;
  game.attempts = added;
  game.maxAttempts = game.maxAttempts + added;
  game.lost = false;
  game.ended = false;
  game.message = '✨ 海鸥带来气泡指南！猜测机会已增加 ' + added + ' 次！';
  return { ok: true };
}

/* ============ 结算（服务端权威公式） ============ */

function finishGame(game, save, reason) {
  if (game.finished && game.result) return { ok: true, result: game.result, replay: true };
  if (game.finished) return { error: 'finished' };

  game.finishedAt = Date.now();
  const elapsed = game.finishedAt - game.startedAt;
  const ledger = save.ledger;
  const profile = save.profile;
  const easy = ledger.easy_mode;
  const infinite = ledger.infinite_mode;
  const isFirstTime = !ledger.first_completions[game.stageKey];
  let reward = { coins: 0, diamonds: 0 };

  if (reason === 'win') {
    if (!game.won) { return { error: 'not won' }; }
    reward = computeWin(game, save);
  } else if (reason === 'lose') {
    if (modeNeedsSettlement(game.mode)) {
      if (!game.ended) return { error: 'not ended' };
      reward = computeTimedEnd(game, save);
    } else {
      if (!game.lost && !game.won) return { error: 'not lost' };
      reward = computeLose(game, save, elapsed);
    }
  } else if (reason === 'quit') {
    reward = computeTimedEnd(game, save);
  } else {
    return { error: 'bad reason' };
  }

  ledger.coins += reward.coins;
  ledger.diamonds += reward.diamonds;
  ledger.double_coins_next = false;
  if (game.mode === 'tutorial') profile.tutorial_done = true;

  if (game.won) {
    ledger.consecutive_fails = 0;
    if (isFirstTime) ledger.first_completions[game.stageKey] = true;
    profile.total_wins += 1;
    if (profile.completed_stages.indexOf(game.stageName) === -1) profile.completed_stages.push(game.stageName);
    if (game.totalUsed === 1) addEggs(profile, ['first_try']);
    if (game.mode === 'tutorial') profile.tutorial_done = true;
    if (game.mode === 'mastermind') addEggs(profile, ['mastermind_king']);
    if (game.mode === 'arithmetic_storm') addEggs(profile, ['storm_master']);
    const allInferno = ['inferno_100', 'inferno_200', 'inferno_500'].every(function (k) { return ledger.first_completions[k]; });
    if (allInferno) addEggs(profile, ['inferno_master']);
    const allStory = ['story_100', 'story_200', 'story_500'].every(function (k) { return ledger.first_completions[k]; });
    if (allStory) addEggs(profile, ['full_clear']);
  }
  if (game.eggQueue.length > 0) addEggs(profile, game.eggQueue);

  storeSave(game.pid, save);
  game.finished = true;
  game.result = {
    reason: reason,
    won: game.won,
    reward: reward,
    eggs: game.eggQueue.slice(),
    firstTry: game.totalUsed === 1 && game.won,
    target: game.target,
    decoy: game.decoy,
    mastermindSecret: game.mode === 'mastermind' ? game.target.join('') : undefined,
    twinTargets: game.mode === 'twin' ? [game.target, game.decoy] : undefined,
    ledger: ledger,
  };
  return { ok: true, result: game.result };
}

function modeNeedsSettlement(mode) {
  return mode === 'blitz' || mode === 'arithmetic_storm';
}

function computeWin(game, save) {
  const ledger = save.ledger;
  const easy = ledger.easy_mode;
  const infinite = ledger.infinite_mode;
  const mode = game.mode;
  const isFirstTime = !ledger.first_completions[game.stageKey];

  if (mode === 'tutorial') {
    const tryIndex = game.totalUsed;
    const coins = 8 + Math.max(1, 5 - tryIndex) * 3;
    return { coins: coins, diamonds: 0 };
  }
  if (mode === 'twin') {
    const remaining = game.maxAttempts - game.totalUsed;
    let bonusPercent = 0;
    if (game.totalUsed === 1) bonusPercent = 250;
    else if (remaining > 0) bonusPercent = Math.min(40, 15 + (remaining - 2) * 5);
    let coins = BAL.twin_base_coins;
    if (isFirstTime) coins *= 2;
    if (bonusPercent > 0) coins = Math.round(coins * (1 + bonusPercent / 100));
    if (ledger.double_coins_next) coins *= 2;
    const penalty = itemPenalty(game, function (id) { return id === 'chance_star' ? 3 : id === 'diamond_star' ? 5 : 0; });
    if (penalty > 0) coins = Math.round(coins * (1 - penalty / 100));
    if (easy) coins = Math.floor(coins * 0.65);
    let diamonds = 0;
    if (!infinite && Math.random() < BAL.twin_diamond_chance) {
      diamonds = 1 + (Math.random() < 0.5 ? 1 : 0);
      if (penalty > 0) diamonds = Math.round(diamonds * (1 - penalty / 100));
      if (easy) diamonds = Math.floor(diamonds * 0.65);
    }
    return { coins: coins, diamonds: diamonds };
  }
  if (mode === 'mastermind') {
    const remaining = game.maxAttempts - game.totalUsed;
    let bonusPercent = 0;
    if (game.totalUsed === 1) bonusPercent = 250;
    else if (remaining > 0) bonusPercent = Math.min(40, 15 + (remaining - 2) * 5);
    let coins = BAL.mastermind_base_coins;
    if (isFirstTime) coins *= 2;
    if (bonusPercent > 0) coins = Math.round(coins * (1 + bonusPercent / 100));
    if (ledger.double_coins_next) coins *= 2;
    const penalty = itemPenalty(game, function (id) { return id === 'chance_star' ? 3 : id === 'diamond_star' ? 5 : 0; });
    if (penalty > 0) coins = Math.round(coins * (1 - penalty / 100));
    if (easy) coins = Math.floor(coins * 0.65);
    let diamonds = 0;
    if (!infinite && Math.random() < BAL.mastermind_diamond_chance) {
      diamonds = 1 + (Math.random() < 0.5 ? 1 : 0);
      if (penalty > 0) diamonds = Math.round(diamonds * (1 - penalty / 100));
      if (easy) diamonds = Math.floor(diamonds * 0.65);
    }
    return { coins: coins, diamonds: diamonds };
  }
  if (mode === 'blitz' || mode === 'arithmetic_storm') {
    return computeTimedEnd(game, save);
  }

  const maxNum = game.maxNumber;
  let coinsBase;
  if (game.inferno) coinsBase = BAL.inferno_base_coins[maxNum] || BAL.inferno_base_coins[500];
  else if (game.mist) coinsBase = BAL.mist_base_coins;
  else if (game.arithmetic) coinsBase = BAL.arithmetic_base_coins;
  else coinsBase = BAL.story_base_coins[maxNum] || BAL.story_base_coins[500];
  if (isFirstTime) coinsBase *= 2;

  const remaining = game.maxAttempts - game.totalUsed;
  let bonusPercent = 0;
  if (game.totalUsed === 1) bonusPercent = 250;
  else if (remaining > 0) bonusPercent = Math.min(40, 15 + (remaining - 2) * 5);

  let finalCoins = coinsBase;
  if (bonusPercent > 0) finalCoins = Math.round(finalCoins * (1 + bonusPercent / 100));

  const wasDouble = ledger.double_coins_next;
  let isLucky = false;
  if (Math.random() < 0.08) { finalCoins += 15; isLucky = true; }
  if (wasDouble) finalCoins *= 2;

  const penalty = itemPenalty(game, function (id) { return (id.indexOf('diamond') !== -1 || id === 'shield_dome') ? 5 : 3; });
  if (penalty > 0) finalCoins = Math.round(finalCoins * (1 - penalty / 100));
  if (easy) finalCoins = Math.floor(finalCoins * 0.65);

  let finalDiamonds = 0;
  const ratio = game.maxAttempts > 0 ? remaining / game.maxAttempts : 1;
  if (!infinite) {
    if (game.mist || game.arithmetic) {
      const dropChance = game.mist ? BAL.mist_diamond_chance : BAL.arithmetic_diamond_chance;
      if (Math.random() < dropChance) finalDiamonds = 1 + (Math.random() < 0.5 ? 1 : 0);
    } else if (ratio >= BAL.diamond_min_ratio) {
      let baseDia = BAL.diamond_stage_base[maxNum] || 1;
      if (ratio >= BAL.diamond_ratio_bonus_threshold) baseDia += 1;
      if (game.inferno) baseDia += 1;
      finalDiamonds = Math.min(BAL.diamond_cap, baseDia);
    }
    if (finalDiamonds > 0) {
      if (penalty > 0) finalDiamonds = Math.round(finalDiamonds * (1 - penalty / 100));
      if (easy) finalDiamonds = Math.floor(finalDiamonds * 0.65);
    }
  }
  return { coins: finalCoins, diamonds: finalDiamonds, lucky: isLucky };
}

function computeTimedEnd(game, save) {
  const ledger = save.ledger;
  const easy = ledger.easy_mode;
  const infinite = ledger.infinite_mode;
  const mode = game.mode;
  const isFirstTime = !ledger.first_completions[game.stageKey];
  if (mode === 'blitz') {
    if (game.correctCount === 0) return { coins: 0, diamonds: 0 };
    let baseAward = game.correctCount * BAL.blitz_correct_coins + Math.floor(Math.max(0, game.timeLeft) / 60 * BAL.blitz_time_bonus_rate) + game.comboBonusCoins;
    if (ledger.double_coins_next) baseAward *= 2;
    let finalCoins = isFirstTime ? baseAward : Math.max(8, Math.floor(baseAward / 3));
    const penalty = itemPenalty(game, function (id) { return id === 'time_freeze' ? 2 : id === 'diamond_star' ? 5 : id === 'oracle_eye' ? 5 : 0; });
    if (penalty > 0) finalCoins = Math.round(finalCoins * (1 - penalty / 100));
    if (easy) finalCoins = Math.floor(finalCoins * 0.65);
    return { coins: finalCoins, diamonds: game.blitzDiamonds || 0 };
  }
  if (mode === 'arithmetic_storm') {
    if (game.correctCount === 0) return { coins: 0, diamonds: 0 };
    let baseAward = game.correctCount * BAL.storm_correct_coins + Math.floor(Math.max(0, game.timeLeft) / 60 * BAL.storm_time_bonus_rate) + game.comboBonusCoins;
    if (ledger.double_coins_next) baseAward *= 2;
    let finalCoins = isFirstTime ? baseAward : Math.max(8, Math.floor(baseAward / 3));
    const penalty = itemPenalty(game, function (id) { return id === 'time_freeze' ? 2 : 0; });
    if (penalty > 0) finalCoins = Math.round(finalCoins * (1 - penalty / 100));
    if (easy) finalCoins = Math.floor(finalCoins * 0.65);
    return { coins: finalCoins, diamonds: game.stormDiamonds || 0 };
  }
  return { coins: 0, diamonds: 0 };
}

function computeLose(game, save, elapsed) {
  const ledger = save.ledger;
  const easy = ledger.easy_mode;
  const infinite = ledger.infinite_mode;
  if (game.mode === 'twin') {
    const comp = easy ? Math.floor(BAL.twin_lose_comp * 0.65) : BAL.twin_lose_comp;
    return { coins: comp, diamonds: 0 };
  }
  if (game.mode === 'mastermind') {
    const comp = easy ? Math.floor(BAL.mastermind_lose_comp * 0.65) : BAL.mastermind_lose_comp;
    return { coins: comp, diamonds: 0 };
  }
  const maxNum = game.maxNumber;
  const compBase = game.inferno
    ? Math.max(BAL.inferno_lose_comp_min, Math.floor(maxNum / BAL.inferno_lose_comp_divisor))
    : Math.max(BAL.lose_comp_min, Math.floor(maxNum / BAL.lose_comp_divisor));
  const base = easy ? Math.floor(compBase * 0.65) : compBase;

  if (elapsed < 8000) {
    if (ledger.suspicious_fails === 0) {
      ledger.suspicious_fails = 1;
      ledger.first_suspicious_comp = base;
      return { coins: base, diamonds: 0 };
    }
    const clawback = ledger.first_suspicious_comp || 0;
    ledger.suspicious_fails += 1;
    ledger.first_suspicious_comp = 0;
    ledger.coins = Math.max(0, ledger.coins - clawback);
    return { coins: base, diamonds: 0 };
  }
  const mult = [1, 0.5, 0.25, 0][Math.min(3, ledger.consecutive_fails || 0)];
  ledger.consecutive_fails += 1;
  return { coins: Math.floor(base * mult), diamonds: 0 };
}

/* ============ HTTP ============ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.dat': 'application/octet-stream',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, cb) {
  let body = '';
  req.on('data', function (chunk) {
    body += chunk;
    if (body.length > 4 * 1024 * 1024) { req.destroy(); }
  });
  req.on('end', function () {
    try { cb(JSON.parse(body)); }
    catch (e) { cb(null); }
  });
}

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.indexOf('/saves/') === 0 || p === '/saves') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const file = path.normalize(path.join(ROOT, p));
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, function (err, data) {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function authorize(ids, pid, sec) {
  if (!pid) return false;
  return ids[pid] === hashSecret(sec);
}

function getAuthGame(req, cb) {
  readBody(req, function (payload) {
    if (!payload) { cb({ error: 'bad body' }); return; }
    const ids = loadIds();
    if (!authorize(ids, payload.pid, payload.secret)) { cb({ error: 'unauthorized' }); return; }
    const game = games.get(payload.gameId);
    if (!game || game.pid !== payload.pid) { cb({ error: 'no such game' }); return; }
    cb({ ok: true, payload: payload, game: game, save: loadSave(payload.pid) });
  });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, version: 3, ts: Date.now() });
    return;
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const pid = crypto.randomUUID();
    const sec = crypto.randomBytes(16).toString('hex');
    const ids = loadIds();
    ids[pid] = hashSecret(sec);
    saveIds(ids);
    sendJson(res, 200, { pid: pid, secret: sec });
    return;
  }

  if (url.pathname === '/api/ledger' && req.method === 'GET') {
    const pid = url.searchParams.get('pid') || '';
    const sec = url.searchParams.get('secret') || '';
    if (!authorize(loadIds(), pid, sec)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
    const save = loadSave(pid);
    sendJson(res, 200, { ledger: save.ledger, profile: save.profile });
    return;
  }

  if (url.pathname === '/api/shop/buy' && req.method === 'POST') {
    readBody(req, function (payload) {
      if (!payload || typeof payload.itemId !== 'string') { sendJson(res, 400, { error: 'bad body' }); return; }
      const ids = loadIds();
      if (!authorize(ids, payload.pid, payload.secret)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const save = loadSave(payload.pid);
      const it = ITEMS[payload.itemId];
      if (!it) { sendJson(res, 400, { error: 'unknown item' }); return; }
      const owned = save.ledger.inventory[payload.itemId] || 0;
      if (it.max > 0 && owned >= it.max) { sendJson(res, 400, { error: 'item limit reached' }); return; }
      const price = buyPriceOf(payload.itemId);
      if (it.diamond ? save.ledger.diamonds < price : save.ledger.coins < price) {
        sendJson(res, 400, { error: 'insufficient funds' });
        return;
      }
      if (it.diamond) save.ledger.diamonds -= price;
      else save.ledger.coins -= price;
      save.ledger.inventory[payload.itemId] = owned + 1;
      storeSave(payload.pid, save);
      sendJson(res, 200, { ok: true, price: price, ledger: save.ledger });
    });
    return;
  }

  if (url.pathname === '/api/shop/sell' && req.method === 'POST') {
    readBody(req, function (payload) {
      if (!payload || typeof payload.items !== 'object') { sendJson(res, 400, { error: 'bad body' }); return; }
      const ids = loadIds();
      if (!authorize(ids, payload.pid, payload.secret)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const save = loadSave(payload.pid);
      let coinRefund = 0, diamondRefund = 0;
      let any = false;
      Object.keys(payload.items).forEach(function (id) {
        const qty = Math.floor(Number(payload.items[id]) || 0);
        if (qty <= 0 || !ITEMS[id]) return;
        const owned = save.ledger.inventory[id] || 0;
        const actual = Math.min(owned, qty);
        if (actual <= 0) return;
        any = true;
        const unit = sellPriceOf(id);
        if (ITEMS[id].diamond) diamondRefund += unit * actual;
        else coinRefund += unit * actual;
        save.ledger.inventory[id] = owned - actual;
        if (save.ledger.inventory[id] <= 0) delete save.ledger.inventory[id];
      });
      if (!any) { sendJson(res, 400, { error: 'nothing to sell' }); return; }
      save.ledger.coins += coinRefund;
      save.ledger.diamonds += diamondRefund;
      storeSave(payload.pid, save);
      sendJson(res, 200, { ok: true, coinRefund: coinRefund, diamondRefund: diamondRefund, ledger: save.ledger });
    });
    return;
  }

  if (url.pathname === '/api/profile/settings' && req.method === 'POST') {
    readBody(req, function (payload) {
      if (!payload || typeof payload.changes !== 'object') { sendJson(res, 400, { error: 'bad body' }); return; }
      const ids = loadIds();
      if (!authorize(ids, payload.pid, payload.secret)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const save = loadSave(payload.pid);
      if (typeof payload.changes.easy_mode === 'boolean') save.ledger.easy_mode = payload.changes.easy_mode;
      if (typeof payload.changes.infinite_mode === 'boolean') save.ledger.infinite_mode = payload.changes.infinite_mode;
      if (typeof payload.changes.music_enabled === 'boolean') save.profile.music_enabled = payload.changes.music_enabled;
      if (typeof payload.changes.tutorial_done === 'boolean') save.profile.tutorial_done = payload.changes.tutorial_done;
      storeSave(payload.pid, save);
      sendJson(res, 200, { ok: true, ledger: save.ledger, profile: save.profile });
    });
    return;
  }

  if (url.pathname === '/api/game/start' && req.method === 'POST') {
    readBody(req, function (payload) {
      if (!payload) { sendJson(res, 400, { error: 'bad body' }); return; }
      const ids = loadIds();
      if (!authorize(ids, payload.pid, payload.secret)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const save = loadSave(payload.pid);
      const mode = String(payload.mode || '');
      if (!['story', 'free', 'inferno_campaign', 'inferno_single', 'mist', 'arithmetic', 'twin', 'blitz', 'mastermind', 'arithmetic_storm', 'tutorial'].indexOf(mode)) {
        if (['story', 'free', 'inferno_campaign', 'inferno_single', 'mist', 'arithmetic', 'twin', 'blitz', 'mastermind', 'arithmetic_storm', 'tutorial'].indexOf(mode) === -1) {
          sendJson(res, 400, { error: 'bad mode' });
          return;
        }
      }
      const game = startGame(payload.pid, save, mode, payload.stage || 'story_100');
      sendJson(res, 200, { ok: true, game: gameView(game) });
    });
    return;
  }

  if (url.pathname === '/api/game/guess' && req.method === 'POST') {
    getAuthGame(req, function (r) {
      if (r.error) { sendJson(res, r.error === 'unauthorized' ? 401 : r.error === 'no such game' ? 404 : 400, { error: r.error }); return; }
      const out = handleGuess(r.game, r.payload.value);
      if (out && out.error) { sendJson(res, 400, { error: out.error }); return; }
      sendJson(res, 200, { ok: true, game: gameView(r.game) });
    });
    return;
  }

  if (url.pathname === '/api/game/hint' && req.method === 'POST') {
    getAuthGame(req, function (r) {
      if (r.error) { sendJson(res, r.error === 'unauthorized' ? 401 : 404, { error: r.error }); return; }
      const out = handleHint(r.game);
      if (out && out.error) { sendJson(res, 400, { error: out.error }); return; }
      sendJson(res, 200, { ok: true, game: gameView(r.game) });
    });
    return;
  }

  if (url.pathname === '/api/game/item' && req.method === 'POST') {
    getAuthGame(req, function (r) {
      if (r.error) { sendJson(res, r.error === 'unauthorized' ? 401 : 404, { error: r.error }); return; }
      const out = handleItem(r.game, r.save, String(r.payload.itemId || ''));
      if (out && out.error) { sendJson(res, 400, { error: out.error }); return; }
      sendJson(res, 200, { ok: true, game: gameView(r.game), ledger: r.save.ledger });
    });
    return;
  }

  if (url.pathname === '/api/game/video' && req.method === 'POST') {
    getAuthGame(req, function (r) {
      if (r.error) { sendJson(res, r.error === 'unauthorized' ? 401 : 404, { error: r.error }); return; }
      const out = handleVideo(r.game);
      if (out && out.error) { sendJson(res, 400, { error: out.error }); return; }
      sendJson(res, 200, { ok: true, game: gameView(r.game) });
    });
    return;
  }

  if (url.pathname === '/api/game/finish' && req.method === 'POST') {
    getAuthGame(req, function (r) {
      if (r.error) { sendJson(res, r.error === 'unauthorized' ? 401 : 404, { error: r.error }); return; }
      const reason = String(r.payload.reason || '');
      if (['win', 'lose', 'quit'].indexOf(reason) === -1) { sendJson(res, 400, { error: 'bad reason' }); return; }
      const out = finishGame(r.game, r.save, reason);
      if (out && out.error) { sendJson(res, 400, { error: out.error }); return; }
      sendJson(res, 200, { ok: true, result: out.result, ledger: r.save.ledger, profile: r.save.profile });
    });
    return;
  }

  if (url.pathname === '/api/export' && req.method === 'POST') {
    readBody(req, function (payload) {
      if (!payload) { sendJson(res, 400, { error: 'bad body' }); return; }
      const ids = loadIds();
      if (!authorize(ids, payload.pid, payload.secret)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const save = loadSave(payload.pid);
      const data = aesEncrypt({ ledger: save.ledger, profile: save.profile }, getPlayerKey(payload.pid));
      sendJson(res, 200, { ok: true, data: data });
    });
    return;
  }

  if (url.pathname === '/api/import' && req.method === 'POST') {
    readBody(req, function (payload) {
      if (!payload || typeof payload.data !== 'string') { sendJson(res, 400, { error: 'bad body' }); return; }
      const ids = loadIds();
      if (!authorize(ids, payload.pid, payload.secret)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      try {
        const obj = aesDecrypt(payload.data, getPlayerKey(payload.pid));
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad format');
        const save = loadSave(payload.pid);
        if (obj.ledger && typeof obj.ledger === 'object') save.ledger = Object.assign({}, emptyLedger(), obj.ledger);
        if (obj.profile && typeof obj.profile === 'object') save.profile = Object.assign({}, emptyProfile(), obj.profile);
        storeSave(payload.pid, save);
        sendJson(res, 200, { ok: true, ledger: save.ledger, profile: save.profile });
      } catch (e) {
        sendJson(res, 400, { error: 'invalid encrypted archive' });
      }
    });
    return;
  }

  if (url.pathname === '/api/save') {
    const ids = loadIds();

    if (req.method === 'GET') {
      const pid = url.searchParams.get('pid') || '';
      const sec = url.searchParams.get('secret') || '';
      if (!authorize(ids, pid, sec)) { sendJson(res, 401, { error: 'unauthorized' }); return; }
      const save = loadSave(pid);
      sendJson(res, 200, { data: save.data, ts: save.ts });
      return;
    }

    if (req.method === 'PUT') {
      readBody(req, function (payload) {
        if (!payload || typeof payload.data !== 'string') {
          sendJson(res, 400, { error: 'bad data' });
          return;
        }
        if (!authorize(ids, payload.pid, payload.secret)) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        const save = loadSave(payload.pid);
        save.data = payload.data;
        save.ts = Number(payload.ts) || Date.now();
        storeSave(payload.pid, save);
        sendJson(res, 200, { ok: true, ts: save.ts });
      });
      return;
    }

    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, function () {
  console.log('数字航海裁决服务器已启动: http://localhost:' + PORT);
  console.log('使用 ngrok 暴露: ngrok http ' + PORT);
});
