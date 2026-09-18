/* ================================================================
   LLMLife · 状态层 (state.js)
   存档 (ver 2 · llmlife_v2) / v1 旧档迁移 / 工具函数
   S 为 ESM live binding，换档唯一入口 setState()（重开/新周目）
   ================================================================ */
import { START_MONEY, LIFE, SLOT_COUNT, WEEK_STAT_KEYS, MARKET } from "./config.js";

const KEY_V2 = 'llmlife_v2';
const KEY_V1 = 'llmlife_v1';

/* 行情初始态：各标的按发行基准价挂牌、持仓清零（state 持有默认值，market.js 只负责推进与交易） */
export function freshMarket(){
  const price = {}, hold = {};
  for(const t of MARKET){ price[t.id] = t.base; hold[t.id] = 0; }
  return { price, hold, prev:{...price} };
}

/* 周行动计数：WEEK_STAT_KEYS 单源，新增行动/统计项自动出现在这里 */
export function freshWeekStats(){
  const o = {};
  for(const k of WEEK_STAT_KEYS) o[k] = 0;
  return o;
}

/* ---------- 状态 ---------- */
export let S = null;
export function defaultState(){
  return { ver:2, money:START_MONEY, uid:1,
    ng:0, endingsSeen:{},
    /* 本章起点快照（年度结算做同比差用），随章节推进滚动更新 */
    chStart:{ day:1, money:START_MONEY, earned:0, spent:0, workDays:0, pulls:0 },
    life:{ day:1, restUsed:0, age:LIFE.START_AGE, tier:0, house:0, timeLeft:LIFE.SLOTS_PER_DAY, sick:false, certs:0,
      attrs:{stamina:LIFE.STAMINA_MAX, mood:70, skill:5, charm:10, satiety:80, health:LIFE.HEALTH_MAX},
      staminaMax:LIFE.STAMINA_MAX,
      weekStats:freshWeekStats(), goals:null,
      pendingChoice:null, chains:[], duoUsed:{} },
    market:freshMarket(),
    partners:[], items:[], slots:new Array(SLOT_COUNT).fill(null),
    pity:{partner:0,banner:0,item:0},
    freePulls:0,
    ledger:[], hist:[],
    stats:{pulls:0,workDays:0,earned:0,spent:0,greats:0,disasters:0,best:'',
      byR:{N:0,R:0,SR:0,SSR:0,UR:0,UTR:0,NB:0}},
    dex:{},
    flags:{welcomed:false,ms:{},muted:false,cheated:false,autoSkip:false},
    skin:'classic', skinsOwned:['classic'], skinTickets:0,
    debtWeeks:0, ending:null };
}
/** 周行动计数 +1（life/pulls/items 统一入口；键必须在 WEEK_STAT_KEYS 内） */
export function bumpWeekStat(key, n = 1){
  if(!S.life.weekStats) S.life.weekStats = freshWeekStats();
  if(key in S.life.weekStats) S.life.weekStats[key] += n;
}

// 换档唯一入口 (重开新周目)：保证 S 的 live binding 同步到所有 import 方
export function setState(next){ S = next; }
export function save(){ try{ localStorage.setItem(KEY_V2, JSON.stringify(S, (k,v)=> k.startsWith('_')?undefined:v)); }catch(e){} }
export function load(){
  try{
    const raw = localStorage.getItem(KEY_V2);
    const s = raw ? JSON.parse(raw) : null;
    if(s && typeof s.money==='number') return normalizeV2(s);
    // v1 旧档（60 岁长局制）→ 章节制不可续档：只携带图鉴/皮肤/成就标记开新周目
    const v1 = localStorage.getItem(KEY_V1);
    const o = v1 ? JSON.parse(v1) : null;
    if(o && typeof o.money==='number') return migrateV1(o);
    return null;
  }catch(e){ return null; }
}
function normalizeV2(s){
  // 字段级兜底（v2 起步；未来 ver 升级在此追加迁移段）
  if(!s.life || typeof s.life!=='object') s.life = defaultState().life;
  if(!s.life.attrs) s.life.attrs = {...defaultState().life.attrs};
  // 逐键回填：新增需求条（饱食/健康）在老档里是 undefined，直接加减会变 NaN
  for(const k of ['stamina','mood','skill','charm','satiety','health'])
    if(s.life.attrs[k]==null) s.life.attrs[k] = defaultState().life.attrs[k];
  for(const k of ['day','age','staminaMax','tier','house','timeLeft','certs']) if(s.life[k]==null) s.life[k] = defaultState().life[k];
  if(s.life.restUsed==null) s.life.restUsed = 0;
  if(s.life.sick==null) s.life.sick = false;
  if(!s.life.weekStats || typeof s.life.weekStats!=='object') s.life.weekStats = freshWeekStats();
  if(s.life.goals != null && (typeof s.life.goals!=='object' || !Array.isArray(s.life.goals.items))) s.life.goals = null;
  if(s.life.pendingChoice != null && (typeof s.life.pendingChoice!=='object' || !s.life.pendingChoice.id)) s.life.pendingChoice = null;
  if(!Array.isArray(s.life.chains)) s.life.chains = [];
  if(!s.life.duoUsed || typeof s.life.duoUsed!=='object') s.life.duoUsed = {};
  if(s.life.ap != null) delete s.life.ap; // 旧版行动点字段废弃
  if(!Array.isArray(s.partners)) s.partners=[];
  for(const p of s.partners){ if(p.favor==null) p.favor=0; if(p.stars==null) p.stars=0; }
  if(!Array.isArray(s.items)) s.items=[];
  if(!Array.isArray(s.slots)) s.slots=new Array(SLOT_COUNT).fill(null);
  if(!s.pity || typeof s.pity!=='object') s.pity={};
  for(const k of ['partner','banner','item']) if(s.pity[k]==null) s.pity[k]=0;
  if(s.freePulls==null) s.freePulls=0;
  if(!Array.isArray(s.ledger)) s.ledger=[];
  if(!Array.isArray(s.hist)) s.hist=[];
  if(!s.stats || typeof s.stats!=='object') s.stats=defaultState().stats;
  if(!s.stats.byR) s.stats.byR={N:0,R:0,SR:0,SSR:0,UR:0,UTR:0,NB:0};
  if(s.stats.best==null) s.stats.best='';
  if(!s.dex) s.dex={};
  if(!s.market || typeof s.market!=='object' || !s.market.price || typeof s.market.price!=='object') s.market = freshMarket();
  else { for(const t of MARKET){ if(s.market.price[t.id]==null) s.market.price[t.id]=t.base; if(s.market.hold[t.id]==null) s.market.hold[t.id]=0; } }
  if(!s.market.prev || typeof s.market.prev!=='object') s.market.prev = {...s.market.price};
  if(!s.flags || typeof s.flags!=='object') s.flags=defaultState().flags;
  if(!s.flags.ms) s.flags.ms={};
  if(!s.skin) s.skin='classic';
  if(!Array.isArray(s.skinsOwned)) s.skinsOwned=['classic'];
  if(s.skinTickets==null) s.skinTickets=0;
  if(s.debtWeeks==null) s.debtWeeks=0;
  if(s.ng==null) s.ng=0;
  if(!s.endingsSeen || typeof s.endingsSeen!=='object') s.endingsSeen={};
  if(!s.chStart || typeof s.chStart!=='object') s.chStart=defaultState().chStart;
  s.ver=2;
  return s;
}
function migrateV1(o){
  const ns = defaultState();
  if(o.dex && typeof o.dex==='object') ns.dex = o.dex;
  if(Array.isArray(o.skinsOwned) && o.skinsOwned.length) ns.skinsOwned = [...new Set(['classic', ...o.skinsOwned])];
  if(o.skin && ns.skinsOwned.includes(o.skin)) ns.skin = o.skin;
  if(o.skinTickets) ns.skinTickets = o.skinTickets;
  if(o.flags){
    if(o.flags.ms && typeof o.flags.ms==='object') ns.flags.ms = o.flags.ms;
    ns.flags.muted = !!o.flags.muted;
    ns.flags.autoSkip = !!o.flags.autoSkip;
  }
  ns.flags.migrated = true; // 启动时弹一次迁移说明
  return ns;
}
S = load() || defaultState();

export const $ = id => document.getElementById(id);
export const fmt = n => '¥' + Math.round(n).toLocaleString('zh-CN');
export const fmt2 = n => '¥' + n.toLocaleString('zh-CN',{maximumFractionDigits:1});
export const pick = arr => arr[Math.floor(Math.random()*arr.length)];
export function addLedger(label, amt){
  S.ledger.unshift({day:S.life.day, label, amt});
  if(S.ledger.length>80) S.ledger.length=80;
}
/* 当天日志（生活页日志流，跨天清空） */
export function dayLog(){
  if(!Array.isArray(S._today)) S._today=[];
  return S._today;
}
export function logToday(line){
  dayLog().unshift({d:S.life.day, line});
  if(dayLog().length>40) dayLog().length=40;
}
