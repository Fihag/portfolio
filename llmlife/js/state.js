/* ================================================================
   LLMLife · 状态层 (state.js)
   存档 (ver 1) / 工具函数
   S 为 ESM live binding，换档唯一入口 setState()（重开/新周目）
   ================================================================ */
import { START_MONEY, LIFE, SLOT_COUNT } from "./config.js";

/* ---------- 状态 ---------- */
export let S = null;
export function defaultState(){
  return { ver:1, money:START_MONEY, uid:1,
    life:{ day:1, ap:LIFE.AP_PER_DAY, age:LIFE.START_AGE,
      attrs:{stamina:LIFE.STAMINA_MAX, mood:70, skill:5, charm:10},
      staminaMax:LIFE.STAMINA_MAX },
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
// 换档唯一入口 (重开新周目)：保证 S 的 live binding 同步到所有 import 方
export function setState(next){ S = next; }
export function save(){ try{ localStorage.setItem('llmlife_v1', JSON.stringify(S, (k,v)=> k.startsWith('_')?undefined:v)); }catch(e){} }
export function load(){
  try{
    const raw = localStorage.getItem('llmlife_v1');
    const s = JSON.parse(raw);
    if(!(s && typeof s.money==='number')) return null;
    // 字段级兜底（v1 起步；未来 ver 升级在此追加迁移段）
    if(!s.life || typeof s.life!=='object') s.life = defaultState().life;
    if(!s.life.attrs) s.life.attrs = {stamina:100,mood:70,skill:5,charm:10};
    for(const k of ['day','ap','age','staminaMax']) if(s.life[k]==null) s.life[k] = defaultState().life[k];
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
    if(!s.flags || typeof s.flags!=='object') s.flags=defaultState().flags;
    if(!s.flags.ms) s.flags.ms={};
    if(!s.skin) s.skin='classic';
    if(!Array.isArray(s.skinsOwned)) s.skinsOwned=['classic'];
    if(s.skinTickets==null) s.skinTickets=0;
    if(s.debtWeeks==null) s.debtWeeks=0;
    s.ver=1;
    return s;
  }catch(e){ return null; }
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
