/* ================================================================
   LLMLife · 回合引擎 (life.js)
   行动执行 / 日切 / 周结算 / 随机事件 / 年龄与结局判定 / 成就
   纯逻辑层：只改 S 与存档，不触 UI（渲染/音效由调用方处理）
   ================================================================ */
import { ACTIONS, EVENTS, LIFE, PROBS, MILESTONES, ENDINGS, ENDING_BROKE, ENDING_CHOSEN, endingScore, CLIENT_REQS, WORK_TXT, CHAPTER_TITLES, CAREERS, CHOICE_EVENTS, PARTNER_EVENTS, DUO_FX, DUO_STAMINA, DUO_SLOTS, DUO_EFFECT_MIN, DUO_STAR_PCT, MMAP, houseOf, CERT_PCT, livingCost, DEBT_INTEREST } from "./config.js";
import { tickMarket, shockMarket } from "./market.js";
import { S, save, addLedger, fmt, setState, defaultState, logToday, pick, bumpWeekStat } from "./state.js";
import { slotBoosts, favorAll, staminaCeiling, activePartners, effectOf } from "./partners.js";
import { sampleWorkPay, examRate } from "./economy.js";
import { addAttrs, clampAttrs } from "./items.js";
import { incomeMult } from "./careers.js";
import { ensureWeek, checkGoals, goalOf } from "./goals.js";

const ACTION_MAP = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
const CHOICE_MAP = Object.fromEntries(CHOICE_EVENTS.map(e => [e.id, e]));
/* 全事件 id 索引（普通 + 选择 + chainOnly 后续）：后果链按 id 到期解析 */
const EVENT_IDX = Object.fromEntries([...EVENTS, ...CHOICE_EVENTS].map(e => [e.id, e]));
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
/* 收益展示：保留 1 位小数并去掉尾随 .0 */
const trimNum = n => String(Math.round(n * 10) / 10);

export const actionOf = id => ACTION_MAP[id];

/* ---------- 章节工具（一章 = LIFE.CHAPTER_DAYS 天 = 1 游戏年） ---------- */
/** 当前处于第几章（0 起） */
export function chapterIndex(day = S.life.day){ return Math.floor((day - 1) / LIFE.CHAPTER_DAYS); }
/** 本局总章数 */
export const CHAPTER_TOTAL = LIFE.RETIRE_AGE - LIFE.START_AGE;

/** 今天的时间格预算（病倒半休，其他情况满格；UI 与日切共用同一单源） */
export function daySlots(){
  return S.life.sick ? Math.round(LIFE.SLOTS_PER_DAY * LIFE.SICK_SLOT_MUL) : LIFE.SLOTS_PER_DAY;
}

/**
 * 满好感同行卡：随行槽中好感 ≥ DUO_EFFECT_MIN 的伙伴各一张动态行动卡，
 * 效果按厂商通道基础值 ×（1 + 星级×8%），每人每日一次。
 */
export function duoCards(){
  const out = [];
  for(const p of activePartners()){
    if(p.favor < DUO_EFFECT_MIN) continue;
    const m = MMAP[p.m];
    const fx = DUO_FX[effectOf(m)] || {};
    const mul = 1 + (p.stars || 0) * DUO_STAR_PCT;
    const lo = v => Array.isArray(v) ? v[0] : v;
    const hi = v => Array.isArray(v) ? v[1] : v;
    const rng = (v, f = trimNum) => `${f(lo(v) * mul)}~${f(hi(v) * mul)}`;
    const parts = [];
    if(fx.money) parts.push(`¥${rng(fx.money, v => Math.round(v))}`);
    if(fx.skill) parts.push(`技术+${rng(fx.skill)}`);
    if(fx.charm) parts.push(`魅力+${rng(fx.charm)}`);
    if(fx.mood) parts.push(`心情+${rng(fx.mood)}`);
    if(fx.stamina) parts.push(`体力+${rng(fx.stamina, v => Math.round(v))}`);
    out.push({
      uid: p.uid, id: `duo:${p.uid}`, name: `与${m.name}同行`, icon: '🫂',
      desc: `${parts.join(' ')} · 每日一次${p.stars ? ` · ★${p.stars}` : ''}`,
    });
  }
  return out;
}

/** 执行一次同行（体力/限次已由 canDo 把关） */
function doDuo(actionId){
  const uid = Number(actionId.slice(4));
  const p = S.partners.find(x => x.uid === uid);
  const m = MMAP[p.m];
  const fx = DUO_FX[effectOf(m)] || {};
  const mul = 1 + (p.stars || 0) * DUO_STAR_PCT;
  S.life.attrs.stamina -= DUO_STAMINA;
  S.life.timeLeft -= DUO_SLOTS;
  // 奖励逐项在区间内取一次（星级倍率乘在取到的值上，展示与实际同步）
  const roll = {};
  for(const k of ['money', 'skill', 'charm', 'mood', 'stamina']) if(fx[k] != null) roll[k] = fxVal(fx[k]) * mul;
  const applied = [];
  if(roll.money){
    const amt = Math.round(roll.money);
    S.money += amt; addLedger(`与${m.name}同行`, amt); S.stats.earned += amt;
    applied.push(`收入¥${amt}`);
  }
  if(roll.skill || roll.charm || roll.mood || roll.stamina){
    addAttrs({
      skill:roll.skill || 0, charm:roll.charm || 0,
      mood:roll.mood || 0, stamina:roll.stamina || 0,
    });
    if(roll.skill) applied.push(`技术+${trimNum(roll.skill)}`);
    if(roll.charm) applied.push(`魅力+${trimNum(roll.charm)}`);
    if(roll.mood) applied.push(`心情+${trimNum(roll.mood)}`);
    if(roll.stamina) applied.push(`体力+${Math.round(roll.stamina)}`);
  }
  if(!S.life.duoUsed) S.life.duoUsed = {};
  S.life.duoUsed[uid] = S.life.day;
  bumpWeekStat('duo');
  return `🫂 与${m.name}同行：${applied.join('，')}`;
}

/* ---------- 行动守卫 ---------- */
export function canDo(actionId){
  if(S.ending) return {ok:false, reason:'本局已结束，开个新周目再战'};
  if(typeof actionId === 'string' && actionId.startsWith('duo:')){
    const uid = Number(actionId.slice(4));
    const p = S.partners.find(x => x.uid === uid);
    const inSlot = p && S.slots.includes(uid);
    if(!p || !inSlot || p.favor < DUO_EFFECT_MIN) return {ok:false, reason:'同行卡需要该伙伴随行且好感满级（90）'};
    if((S.life.duoUsed || {})[uid] === S.life.day) return {ok:false, reason:'今天就同行过一次了，来日方长'};
    if(DUO_SLOTS > S.life.timeLeft) return {ok:false, reason:'今天的时间格不够了，收工歇着吧'};
    if(DUO_STAMINA > S.life.attrs.stamina) return {ok:false, reason:'体力不够了，先躺平休息'};
    return {ok:true};
  }
  const a = ACTION_MAP[actionId];
  if(!a) return {ok:false, reason:'未知行动'};
  if((a.tier||0) > S.life.tier) return {ok:false, reason:`职级不足：晋升「${CAREERS[a.tier].name}」后解锁`};
  if(actionId === 'rest' && S.life.restUsed >= LIFE.REST_PER_DAY)
    return {ok:false, reason:'今天已经躺平过了，再用道具回体力或提前收工'};
  if((a.slots || 1) > S.life.timeLeft) return {ok:false, reason:'今天的时间格不够了，收工歇着吧'};
  if(a.needsCert && (S.life.certs || 0) < a.needsCert) return {ok:false, reason:`需要先考过前 ${a.needsCert} 张证`};
  if(a.stamina > S.life.attrs.stamina) return {ok:false, reason:'体力不够了，先躺平休息'};
  if(a.money > S.money) return {ok:false, reason:'钱包不够了，先去打工'};
  return {ok:true};
}

/** 还有没有任何可执行的行动（供"体力见底"提示与禁用态汇总） */
export function anyActionAvailable(){
  if(ACTIONS.some(a => canDo(a.id).ok)) return true;
  return duoCards().some(c => canDo(c.id).ok);
}

/**
 * 执行一次行动（无行动点上限，只受体力/钱包/限次约束；日切由「结束今天」显式触发）
 * @returns {{ok:boolean, line?:string, lines?:string[]}}
 */
export function doAction(actionId){
  const guard = canDo(actionId);
  if(!guard.ok) return {ok:false, line:guard.reason};
  if(typeof actionId === 'string' && actionId.startsWith('duo:')){
    const line = doDuo(actionId);
    const lines = [line];
    logToday(line);
    for(const m of checkMilestones()) lines.push(`🏅 成就达成「${m.title}」${m.tag}`);
    for(const gl of checkGoals()){ lines.push(gl); logToday(gl); }
    const dayEnded = S.life.timeLeft <= 0;
    if(dayEnded) lines.push('🌙 今天的格数用完了，收工');
    save();
    return {ok:true, line, lines, dayEnded};
  }
  const a = ACTION_MAP[actionId];
  const boosts = slotBoosts();
  const attr = S.life.attrs;
  const applied = [];

  if(a.stamina) attr.stamina -= a.stamina;
  if(a.slots) S.life.timeLeft -= a.slots;
  // 需求条与健康：吃饭/下馆子回饱食，高压行动扣健康（效果行统一在 fxNotes 里展示）
  const fxNotes = [];
  if(a.health){
    const h = Math.round(fxVal(a.health));
    attr.health += h;
    fxNotes.push(`健康${h > 0 ? '+' : ''}${h}`);
  }
  if(a.satiety){
    const s = Math.round(fxVal(a.satiety));
    attr.satiety += s;
    fxNotes.push(`饱食+${s}`);
  }
  if(fxNotes.length) clampAttrs();
  const hungry = attr.satiety < LIFE.SATIETY_LOW;
  const satMul = hungry ? .75 : 1;
  if(a.money){ S.money -= a.money; addLedger(a.name, -a.money); }
  if(actionId === 'rest') S.life.restUsed++;
  bumpWeekStat(actionId);

  let line;
  if(a.exam){
    // 考证：技能定通过率，挂了只是重来（时间与报名费打水漂）
    const rate = examRate(attr.skill, attr.mood);
    if(Math.random() < rate){
      S.life.certs = (S.life.certs || 0) + 1;
      const gk = fxVal(a.skill), gm = fxVal(a.mood);
      addAttrs({ skill: gk, mood: gm });
      line = `${a.icon} ${a.name}：通过！证书 ${S.life.certs} 张（工作收入 +${Math.round(S.life.certs * CERT_PCT * 100)}%），技术 +${trimNum(gk)}、心情 +${trimNum(gm)}`;
    } else {
      attr.mood = Math.max(0, attr.mood - 6);
      line = `${a.icon} ${a.name}：差几分没过（通过率 ${Math.round(rate * 100)}%），报名费打水漂、心情 -6，下季再战`;
    }
  } else if(actionId === 'work' || a.workMult){
    // 工作类：职级倍率 × 行动倍率走同一 payout 事件流（期望与抽样同源）
    const pay = sampleWorkPay(attr.skill, attr.mood, boosts.work,
      { mult: incomeMult() * (a.workMult || 1) * satMul, riskMul: a.riskMul || 1 });
    S.money += pay.amt;
    addLedger(a.name || '打工收入', pay.amt);
    S.stats.workDays++;
    if(pay.amt >= 0) S.stats.earned += pay.amt; else S.stats.spent += -pay.amt;
    if(pay.evt === 'great') S.stats.greats++;
    if(pay.evt === 'disaster') S.stats.disasters++;
    const moodRoll = a.mood ? fxVal(a.mood) : 0;
    if(moodRoll) attr.mood = Math.max(0, Math.min(100, attr.mood + moodRoll));
    line = `${a.icon} ${pick(CLIENT_REQS)} ${pick(WORK_TXT[pay.evt])}（${fmt(pay.amt)}）${moodRoll ? `，心情${moodRoll}` : ''}${fxNotes.length ? '，' + fxNotes.join('，') : ''}${hungry ? '，饿着肚子效率打折' : ''}`;
  } else {
    const moodSlow = attr.mood < LIFE.MOOD_LOW;
    if(a.skill){
      // 保留小数：伙伴加成在低基础收益上也要真实体现（渲染时四舍五入）
      const gain = Math.max(.5, rand(a.skill[0], a.skill[1]) * (1 + boosts.learn) * (moodSlow ? .5 : 1) * satMul);
      attr.skill = Math.min(100, attr.skill + gain);
      applied.push(`技术+${trimNum(gain)}${moodSlow ? '（心情低落，效率减半）' : ''}${hungry ? '（饿着肚子，效率打折）' : ''}`);
    }
    if(a.fee){
      // 出场费类：随魅力水涨船高
      const amt = Math.round(rand(a.fee[0], a.fee[1]) * (0.75 + attr.charm/200));
      S.money += amt; addLedger(`${a.name}·出场费`, amt); S.stats.earned += amt;
      applied.push(`出场费¥${amt.toLocaleString('zh-CN')}`);
    }
    if(a.recover){
      const before = attr.stamina;
      attr.stamina = Math.min(staminaCeiling(), attr.stamina + fxVal(a.recover));
      if(attr.stamina > before) applied.push(`体力+${trimNum(attr.stamina - before)}`);
    }
    if(a.mood){
      const g = fxVal(a.mood) * (1 + boosts.mood);
      attr.mood = Math.min(100, Math.max(0, attr.mood + g));
      applied.push(`心情${g >= 0 ? '+' : ''}${trimNum(g)}`);
    }
    if(a.charm){
      const g = fxVal(a.charm) * (1 + boosts.charm);
      attr.charm = Math.min(100, attr.charm + g);
      applied.push(`魅力+${trimNum(g)}`);
    }
    if(a.staminaMax){
      // 体力上限软帽：到 LIFE.STAMINA_CAP 后不再成长，魅力照涨（上限成长取整）
      const room = Math.max(0, LIFE.STAMINA_CAP - S.life.staminaMax);
      const add = Math.min(Math.round(fxVal(a.staminaMax)), room);
      S.life.staminaMax += add;
      applied.push(add > 0 ? `体力上限+${trimNum(add)}` : `身体到极限了（${LIFE.STAMINA_CAP}），这次只涨了魅力`);
    }
    if(a.favor){ const f = Math.round(fxVal(a.favor)); favorAll(f); applied.push(`随行好感+${f}`); }
    applied.push(...fxNotes);
    line = `${a.icon} ${a.name}${applied.length ? '：' + applied.join('，') : ''}`;
  }

  const lines = [line];
  logToday(line);
  const msNew = checkMilestones();
  for(const m of msNew) lines.push(`🏅 成就达成「${m.title}」${m.tag}`);
  for(const gl of checkGoals()){ lines.push(gl); logToday(gl); }
  const dayEnded = S.life.timeLeft <= 0;
  if(dayEnded) lines.push('🌙 今天的格数用完了，收工');
  else if(!anyActionAvailable()) lines.push('💤 体力见底，躺平/道具回血或提前收工');
  save();
  return {ok:true, line, lines, dayEnded};
}

/* ---------- 加权抽取事件（chainOnly 后续事件不进随机池） ---------- */
function weightedPick(pool){
  const total = pool.reduce((s, e) => s + e.weight, 0);
  if(total <= 0) return null;
  let r = Math.random() * total;
  for(const e of pool){ r -= e.weight; if(r < 0) return e; }
  return null;
}

/* ---------- 事件数值结算：字段支持定值或 [min,max] 随机区间 ---------- */
function fxVal(v){ return Array.isArray(v) ? rand(v[0], v[1]) : v; }
/** 结算一份 fx（money/mood/stamina/skill/charm/favor），返回展示片段与金额 */
function applyFx(fx, label = '事件'){
  const nums = [];
  let money = 0;
  if(fx.money || fx.moneyPct){
    money = fx.money ? fxVal(fx.money) : 0;
    // 按身家比例扣钱（份子钱/消费主义）：收入涨了账单也跟着涨
    if(fx.moneyPct) money += Math.round(Math.max(0, S.money) * fxVal(fx.moneyPct));
    S.money += money;
    addLedger(label, money);
    if(money >= 0) S.stats.earned += money; else S.stats.spent += -money;
    nums.push(`¥${money > 0 ? '+' : ''}${money}`);
  }
  const delta = {
    mood: fx.mood ? fxVal(fx.mood) : 0,
    stamina: fx.stamina ? fxVal(fx.stamina) : 0,
    skill: fx.skill ? fxVal(fx.skill) : 0,
    charm: fx.charm ? fxVal(fx.charm) : 0,
    satiety: fx.satiety ? fxVal(fx.satiety) : 0,
    health: fx.health ? fxVal(fx.health) : 0,
  };
  addAttrs(delta);
  if(delta.mood) nums.push(`心情${delta.mood > 0 ? '+' : ''}${delta.mood}`);
  if(delta.stamina) nums.push(`体力${delta.stamina > 0 ? '+' : ''}${delta.stamina}`);
  if(delta.skill) nums.push(`技术+${delta.skill}`);
  if(delta.charm) nums.push(`魅力${delta.charm > 0 ? '+' : ''}${delta.charm}`);
  if(delta.satiety) nums.push(`饱食${delta.satiety > 0 ? '+' : ''}${Math.round(delta.satiety)}`);
  if(delta.health) nums.push(`健康${delta.health > 0 ? '+' : ''}${Math.round(delta.health)}`);
  if(fx.favor){ favorAll(fx.favor); nums.push(`随行好感+${fx.favor}`); }
  if(fx.market){
    const mul = fxVal(fx.market.mul);
    shockMarket(mul);
    nums.push(`行情×${Math.round(mul*100)/100}`);
  }
  return {nums, money};
}

function fireEvent(){
  const ev = weightedPick(EVENTS.filter(e => !e.chainOnly && (!e.cond || e.cond(S))));
  if(!ev) return null;
  const {nums, money} = applyFx(ev, `事件·${ev.name}`);
  return `🎲 ${ev.name}：${ev.text.replace('{amt}', fmt(Math.abs(money)))}${nums.length ? `（${nums.join('，')}）` : ''}`;
}

/** 当日主事件：35% 换成分支选择事件（挂 pending，选完才翻页） */
function rollDailyEvent(){
  if(!S.life.pendingChoice && Math.random() < PROBS.CHOICE){
    const cands = CHOICE_EVENTS.filter(e => !e.cond || e.cond(S));
    if(cands.length){
      const ev = pick(cands);
      S.life.pendingChoice = {id: ev.id};
      return `⚖️ ${ev.name}：${ev.text}`;
    }
  }
  return fireEvent();
}

/** 在场伙伴小剧场：按随行伙伴效果通道选台本 */
function partnerTalk(){
  if(Math.random() >= PROBS.PARTNER_TALK) return null;
  const act = activePartners();
  if(!act.length) return null;
  const p = pick(act);
  const eff = effectOf(MMAP[p.m]);
  const cands = PARTNER_EVENTS.filter(e => e.via === 'any' || e.via === eff);
  if(!cands.length) return null;
  const e = pick(cands);
  const {nums} = applyFx({mood:e.mood, stamina:e.stamina, skill:e.skill, charm:e.charm, favor:e.favor});
  const name = MMAP[p.m].name;
  const body = (e.text || '').replace(/\{p\}/g, name);
  return `💞 ${name}：${body}${nums.length ? `（${nums.join('，')}）` : ''}`;
}

/** 后果链到期注入（日切后按新日期结算） */
function dueChains(lines){
  const chains = S.life.chains || [];
  if(!chains.length) return;
  const due = chains.filter(c => c.day <= S.life.day);
  if(!due.length) return;
  S.life.chains = chains.filter(c => c.day > S.life.day);
  for(const c of due){
    const ev = EVENT_IDX[c.ev];
    if(!ev) continue;
    if(ev.choices && !S.life.pendingChoice){
      S.life.pendingChoice = {id: ev.id};
      lines.push(`🧭 旧事回响 · ${ev.name}：${ev.text}`);
    } else if(!ev.choices){
      const {nums, money} = applyFx(ev);
      lines.push(`🧭 旧事回响 · ${ev.name}：${ev.text.replace('{amt}', fmt(Math.abs(money)))}${nums.length ? `（${nums.join('，')}）` : ''}`);
    }
  }
}

/* ---------- 分支抉择：读取 / 落子（UI 经 data-act="event-choice" 调用） ---------- */
export function choiceEvent(){
  const pc = S.life.pendingChoice;
  return pc ? (CHOICE_MAP[pc.id] || null) : null;
}
/** 选定第 idx 项：结算 fx、登记 after 链、清 pending。返回结果行 */
export function resolveChoice(idx){
  const ev = choiceEvent();
  if(!ev || !ev.choices[idx]) return null;
  const ch = ev.choices[idx];
  const {nums} = applyFx(ch.fx || {});
  if(ch.after){
    if(!Array.isArray(S.life.chains)) S.life.chains = [];
    S.life.chains.push({day: S.life.day + (ch.after.days || 1), ev: ch.after.ev});
  }
  S.life.pendingChoice = null;
  const line = `⚖️ ${ev.name} → 「${ch.label}」：${ch.text}${nums.length ? `（${nums.join('，')}）` : ''}${ch.after ? `｜${ch.after.days} 天后见分晓` : ''}`;
  logToday(line);
  save();
  return line;
}

/** 章末年度结算：与 S.chStart 快照做同比差，明细存 S._settle 供 UI 弹窗（不落盘） */
function settleChapter(){
  const cs = S.chStart || defaultState().chStart;
  const no = chapterIndex(S.life.day) - 1; // 刚完成章的下标（0 起）
  const attr = S.life.attrs;
  const settle = {
    no, ageFrom: LIFE.START_AGE + no, ageTo: LIFE.START_AGE + no + 1,
    title: CHAPTER_TITLES[no] || `第 ${no + 1} 章`,
    nextTitle: CHAPTER_TITLES[no + 1] || null,
    net: S.money - cs.money,
    earned: S.stats.earned - (cs.earned||0),
    spent: S.stats.spent - (cs.spent||0),
    workDays: S.stats.workDays - (cs.workDays||0),
    pulls: S.stats.pulls - (cs.pulls||0),
    skill: Math.round(attr.skill), charm: Math.round(attr.charm), mood: Math.round(attr.mood),
    staminaMax: S.life.staminaMax, partners: S.partners.length,
    score: endingScore(S, slotBoosts().staminaMax),
  };
  S._settle = settle;
  S.chStart = { day:S.life.day, money:S.money, earned:S.stats.earned, spent:S.stats.spent, workDays:S.stats.workDays, pulls:S.stats.pulls };
  return `📆 年度结算《${settle.title}》：本年净收支 ${fmt(settle.net)}`;
}

export function endDay(){
  const lines = [];
  // 每天必发 1 个事件（PROBS.EVENT=1，其中 35% 换成分支抉择），概率追加第 2 个
  if(Math.random() < PROBS.EVENT){
    const first = rollDailyEvent();
    if(first) lines.push(first);
    if(Math.random() < PROBS.EVENT_EXTRA){
      const second = rollDailyEvent();
      if(second && second !== first) lines.push(second);
    }
  }
  S.life.day++;
  S.life.restUsed = 0;
  tickMarket(); // 行情逐日随机游走
  dueChains(lines); // 旧决定的下文：到期注入（负面效果也照常结算）
  const attr = S.life.attrs;
  // 需求结算：饱食衰减 → 健康自然恢复 / 饿肚子扣健康 → 病倒判定
  attr.satiety = Math.max(0, attr.satiety - LIFE.SATIETY_DECAY);
  if(!S.life.sick) attr.health = Math.min(LIFE.HEALTH_MAX, attr.health + LIFE.HEALTH_REGEN);
  else attr.health = Math.min(LIFE.HEALTH_MAX, attr.health + 12); // 病倒强制躺一天，恢复一些
  if(attr.satiety <= 0) attr.health = Math.max(0, attr.health - LIFE.SATIETY_HUNGRY_HP);
  S.life.sick = attr.health < LIFE.SICK_AT;
  if(S.life.sick){
    S.money -= LIFE.SICK_COST;
    addLedger('病倒·医药费', -LIFE.SICK_COST);
    S.stats.spent += LIFE.SICK_COST;
    lines.push(`🤒 病倒了：医药费 -¥${LIFE.SICK_COST}，明天只有 ${daySlots()} 格可用（强制半休）`);
  }
  // 新的一天：格数（病倒打折）+ 体力回满（饿肚子/病倒打折，含随行伙伴与住房上限加成）
  S.life.timeLeft = daySlots();
  const refillMul = (attr.satiety < LIFE.SATIETY_LOW ? .8 : 1) * (S.life.sick ? LIFE.SICK_REFILL_MUL : 1);
  attr.stamina = Math.round(staminaCeiling() * refillMul);
  if(refillMul < 1 && !S.life.sick) lines.push('🍚 饿着肚子睡觉，没睡踏实（体力只回了八成）');
  attr.mood = Math.max(0, Math.min(100, attr.mood - LIFE.MOOD_DECAY + houseOf(S).mood)); // 好房子睡得更香
  const talk = partnerTalk(); // 在场伙伴小剧场（收益落在回满/衰减之后，不被睡眠吞）
  if(talk) lines.push(talk);
  if((S.life.day - 1) % LIFE.WEEK_DAYS === 0){
    lines.push(weekSettle());
    if(ensureWeek()){
      const gs = (S.life.goals?.items || [])
        .map(gi => goalOf(gi.id)).filter(Boolean)
        .map(g => `${g.icon} ${g.label}`);
      if(gs.length) lines.push(`📌 本周目标：${gs.join('；')}`);
    }
  }
  const newAge = LIFE.START_AGE + Math.floor((S.life.day - 1) / LIFE.CHAPTER_DAYS);
  if(newAge !== S.life.age){
    S.life.age = newAge;
    // 一章恰好一年：生日与章末重合，年度结算行即庆生行
    lines.push(settleChapter());
  }
  const end = checkEnd();
  if(end) lines.push(`🏁 人生结算：${end.title}`);
  S._today = []; // 今日日志跨天重置
  save();
  return lines;
}

/* ---------- 周结算：房租（随住房档位） + 生活水平（随职级/住房上涨），欠租计息-------- */
export function weekSettle(){
  const h = houseOf(S);
  const cost = h.rent + livingCost(S);
  S.money -= cost;
  addLedger(`周结算·房租(${h.name})+生活`, -cost);
  S.stats.spent += cost;
  if(S.money < 0){
    S.debtWeeks++;
    const interest = Math.round(-S.money * DEBT_INTEREST);
    if(interest > 0){
      S.money -= interest;
      addLedger('欠租滞纳金', -interest);
      S.stats.spent += interest;
    }
    return `🏠 周结算：${h.name}房租+生活 -¥${cost.toLocaleString('zh-CN')}，余额 ${fmt(S.money)}，欠租第 ${S.debtWeeks} 周（滞纳金 ¥${interest}，${LIFE.GRACE_WEEKS} 周破产）`;
  }
  S.debtWeeks = 0;
  return `🏠 周结算：${h.name}房租+生活 -¥${cost.toLocaleString('zh-CN')}，余额 ${fmt(S.money)}`;
}

/* ---------- 结局判定（破产 / 30 岁章满结算 / Fihag 彩蛋） ---------- */
export function checkEnd(){
  if(S.ending) return S.ending;
  const score = endingScore(S, slotBoosts().staminaMax);
  if(S.debtWeeks >= LIFE.GRACE_WEEKS){
    S.ending = {...ENDING_BROKE, score};
  } else if(S.life.age >= LIFE.RETIRE_AGE){
    if(S.dex.fihagv1 && score >= 300) S.ending = {...ENDING_CHOSEN, score};
    else S.ending = {...(ENDINGS.find(e => score >= e.min) || ENDINGS[ENDINGS.length - 1]), score};
  }
  if(S.ending){
    if(!S.endingsSeen) S.endingsSeen = {};
    S.endingsSeen[S.ending.id] = true; // 多周目结局收集
    save();
  }
  return S.ending;
}

/* ---------- 成就检查（返回本批新达成） ---------- */
export function checkMilestones(){
  const got = [];
  for(const m of MILESTONES){
    if(S.flags.ms[m.id]) continue;
    const hit = m.at != null ? S.money >= m.at : m.check(S) >= 1;
    if(hit){ S.flags.ms[m.id] = true; got.push(m); }
  }
  return got;
}

/* ---------- 新周目：完全重置（硬重开） ---------- */
export function restart(){
  setState(defaultState());
  ensureWeek(); // 第一周目标即刻生效
  save();
}

/**
 * NG+ 开启新周目：保留收集类进度（图鉴/皮肤/皮肤券/已见结局/成就标记），
 * 数值与伙伴清零重开，按周目数给予起步资金奖励。
 */
export function newGamePlus(){
  const prev = S;
  const ns = defaultState();
  ns.ng = (prev.ng||0) + 1;
  ns.money += Math.min(ns.ng, 8) * 500;         // 周目递增的创业起步金（封顶 8 周目）
  ns.chStart.money = ns.money;
  ns.dex = { ...(prev.dex||{}) };                // 模型图鉴
  ns.skinsOwned = [...new Set(prev.skinsOwned||[])];
  ns.skinTickets = prev.skinTickets||0;
  ns.endingsSeen = { ...(prev.endingsSeen||{}) };// 结局收集
  ns.flags.ms = { ...(prev.flags&&prev.flags.ms||{}) }; // 成就标记
  ns.flags.muted = !!(prev.flags&&prev.flags.muted);
  ns.flags.autoSkip = !!(prev.flags&&prev.flags.autoSkip);
  ns.flags.welcomed = true;
  ns.skin = prev.skin && ns.skinsOwned.includes(prev.skin) ? prev.skin : 'classic';
  setState(ns);
  ensureWeek();
  save();
  return ns;
}
