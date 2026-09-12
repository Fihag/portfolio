/* ================================================================
   LLMLife · 回合引擎 (life.js)
   行动执行 / 日切 / 周结算 / 随机事件 / 年龄与结局判定 / 成就
   纯逻辑层：只改 S 与存档，不触 UI（渲染/音效由调用方处理）
   ================================================================ */
import { ACTIONS, EVENTS, LIFE, PROBS, MILESTONES, ENDINGS, ENDING_BROKE, ENDING_CHOSEN, endingScore, CLIENT_REQS, WORK_TXT } from "./config.js";
import { S, save, addLedger, fmt, setState, defaultState, logToday, pick } from "./state.js";
import { slotBoosts, favorAll, staminaCeiling } from "./partners.js";
import { sampleWorkPay } from "./economy.js";
import { addAttrs } from "./items.js";

const ACTION_MAP = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
/* 收益展示：保留 1 位小数并去掉尾随 .0 */
const trimNum = n => String(Math.round(n * 10) / 10);

export const actionOf = id => ACTION_MAP[id];

/* ---------- 行动守卫 ---------- */
export function canDo(actionId){
  if(S.ending) return {ok:false, reason:'本局已结束，开个新周目再战'};
  const a = ACTION_MAP[actionId];
  if(!a) return {ok:false, reason:'未知行动'};
  if(actionId === 'rest' && S.life.restUsed >= LIFE.REST_PER_DAY)
    return {ok:false, reason:'今天已经躺平过了，再用道具回体力或结束今天'};
  if(a.stamina > S.life.attrs.stamina) return {ok:false, reason:'体力不够了，先躺平休息'};
  if(a.money > S.money) return {ok:false, reason:'钱包不够了，先去打工'};
  return {ok:true};
}

/** 还有没有任何可执行的行动（供"体力见底"提示与禁用态汇总） */
export function anyActionAvailable(){
  return ACTIONS.some(a => canDo(a.id).ok);
}

/**
 * 执行一次行动（无行动点上限，只受体力/钱包/限次约束；日切由「结束今天」显式触发）
 * @returns {{ok:boolean, line?:string, lines?:string[]}}
 */
export function doAction(actionId){
  const guard = canDo(actionId);
  if(!guard.ok) return {ok:false, line:guard.reason};
  const a = ACTION_MAP[actionId];
  const boosts = slotBoosts();
  const attr = S.life.attrs;
  const applied = [];

  if(a.stamina) attr.stamina -= a.stamina;
  if(a.money){ S.money -= a.money; addLedger(a.name, -a.money); }
  if(actionId === 'rest') S.life.restUsed++;

  let line;
  if(actionId === 'work'){
    const pay = sampleWorkPay(attr.skill, attr.mood, boosts.work);
    S.money += pay.amt;
    addLedger('打工收入', pay.amt);
    S.stats.workDays++;
    if(pay.amt >= 0) S.stats.earned += pay.amt; else S.stats.spent += -pay.amt;
    if(pay.evt === 'great') S.stats.greats++;
    if(pay.evt === 'disaster') S.stats.disasters++;
    line = `${pick(CLIENT_REQS)} ${pick(WORK_TXT[pay.evt])}（${fmt(pay.amt)}）`;
  } else {
    const moodSlow = attr.mood < LIFE.MOOD_LOW;
    if(a.skill){
      // 保留小数：伙伴加成在低基础收益上也要真实体现（渲染时四舍五入）
      const gain = Math.max(.5, rand(a.skill[0], a.skill[1]) * (1 + boosts.learn) * (moodSlow ? .5 : 1));
      attr.skill = Math.min(100, attr.skill + gain);
      applied.push(`技术+${trimNum(gain)}${moodSlow ? '（心情低落，效率减半）' : ''}`);
    }
    if(a.recover){
      const before = attr.stamina;
      attr.stamina = Math.min(staminaCeiling(), attr.stamina + a.recover);
      applied.push(`体力+${trimNum(attr.stamina - before)}`);
    }
    if(a.mood){
      const g = a.mood * (1 + boosts.mood);
      attr.mood = Math.min(100, Math.max(0, attr.mood + g));
      applied.push(`心情${g >= 0 ? '+' : ''}${trimNum(g)}`);
    }
    if(a.charm){
      const g = a.charm * (1 + boosts.charm);
      attr.charm = Math.min(100, attr.charm + g);
      applied.push(`魅力+${trimNum(g)}`);
    }
    if(a.staminaMax){
      // 体力上限软帽：到 LIFE.STAMINA_CAP 后不再成长，魅力照涨
      const room = Math.max(0, LIFE.STAMINA_CAP - S.life.staminaMax);
      const add = Math.min(a.staminaMax, room);
      S.life.staminaMax += add;
      applied.push(add > 0 ? `体力上限+${trimNum(add)}` : `身体到极限了（${LIFE.STAMINA_CAP}），这次只涨了魅力`);
    }
    if(a.favor){ favorAll(a.favor); applied.push(`随行好感+${a.favor}`); }
    line = `${a.icon} ${a.name}${applied.length ? '：' + applied.join('，') : ''}`;
  }

  const lines = [line];
  logToday(line);
  const msNew = checkMilestones();
  for(const m of msNew) lines.push(`🏅 成就达成「${m.title}」${m.tag}`);
  if(!anyActionAvailable()) lines.push('💤 体力见底，躺平/道具回血或结束今天');
  save();
  return {ok:true, line, lines};
}

/* ---------- 加权抽取事件 ---------- */
function weightedPick(pool){
  const total = pool.reduce((s, e) => s + e.weight, 0);
  if(total <= 0) return null;
  let r = Math.random() * total;
  for(const e of pool){ r -= e.weight; if(r < 0) return e; }
  return null;
}

/* ---------- 日切：事件 1~2 个 → 睡眠 → 周结算 → 年龄 → 结局 ---------- */
function fireEvent(){
  const ev = weightedPick(EVENTS.filter(e => !e.cond || e.cond(S)));
  if(!ev) return null;
  const delta = {mood:ev.mood||0, stamina:ev.stamina||0, skill:ev.skill||0, charm:ev.charm||0};
  addAttrs(delta);
  if(ev.money){ S.money += ev.money; addLedger(`事件·${ev.name}`, ev.money); }
  const nums = [
    ev.money ? `¥${ev.money > 0 ? '+' : ''}${ev.money}` : '',
    delta.mood ? `心情${delta.mood > 0 ? '+' : ''}${delta.mood}` : '',
    delta.stamina ? `体力${delta.stamina}` : '',
    delta.skill ? `技术+${delta.skill}` : '',
    delta.charm ? `魅力+${delta.charm}` : '',
  ].filter(Boolean).join('，');
  return `🎲 ${ev.name}：${ev.text}${nums ? `（${nums}）` : ''}`;
}

export function endDay(){
  const lines = [];
  // 每天必发 1 个事件（PROBS.EVENT=1），概率追加第 2 个
  if(Math.random() < PROBS.EVENT){
    const first = fireEvent();
    if(first) lines.push(first);
    if(Math.random() < PROBS.EVENT_EXTRA){
      const second = fireEvent();
      if(second && second !== first) lines.push(second);
    }
  }
  S.life.day++;
  S.life.restUsed = 0;
  const attr = S.life.attrs;
  attr.stamina = staminaCeiling(); // 睡一觉体力回满（含随行伙伴上限加成）
  attr.mood = Math.max(0, attr.mood - LIFE.MOOD_DECAY);
  if((S.life.day - 1) % 7 === 0) lines.push(weekSettle());
  const newAge = LIFE.START_AGE + Math.floor((S.life.day - 1) / 360);
  if(newAge !== S.life.age){
    S.life.age = newAge;
    lines.push(`🎂 新的一年开始了，你 ${S.life.age} 岁`);
  }
  const end = checkEnd();
  if(end) lines.push(`🏁 人生结算：${end.title}`);
  S._today = []; // 今日日志跨天重置
  save();
  return lines;
}

/* ---------- 周结算：房租 + 伙食，欠租计周 ---------- */
export function weekSettle(){
  const cost = LIFE.RENT + LIFE.LIVING;
  S.money -= cost;
  addLedger('周结算·房租伙食', -cost);
  S.stats.spent += cost;
  if(S.money < 0){
    S.debtWeeks++;
    return `🏠 周结算：房租+伙食 -¥${cost.toLocaleString('zh-CN')}，余额 ${fmt(S.money)}，欠租第 ${S.debtWeeks} 周（${LIFE.GRACE_WEEKS} 周破产）`;
  }
  S.debtWeeks = 0;
  return `🏠 周结算：房租+伙食 -¥${cost.toLocaleString('zh-CN')}，余额 ${fmt(S.money)}`;
}

/* ---------- 结局判定（破产 / 60 岁退休 / Fihag 彩蛋） ---------- */
export function checkEnd(){
  if(S.ending) return S.ending;
  const score = endingScore(S, slotBoosts().staminaMax);
  if(S.debtWeeks >= LIFE.GRACE_WEEKS){
    S.ending = {...ENDING_BROKE, score};
  } else if(S.life.age >= LIFE.RETIRE_AGE){
    if(S.dex.fihagv1 && score >= 150) S.ending = {...ENDING_CHOSEN, score};
    else S.ending = {...(ENDINGS.find(e => score >= e.min) || ENDINGS[ENDINGS.length - 1]), score};
  }
  if(S.ending) save();
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

/* ---------- 新周目 ---------- */
export function restart(){
  setState(defaultState());
  save();
}
