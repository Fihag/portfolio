/* ================================================================
   LLMLife · 道具层 (items.js)
   背包存取 / 效果结算（含刮刮乐、免费抽卡券等特殊道具）
   ================================================================ */
import { ITEMS, ITEM_RARITY } from "./config.js";
import { S, save } from "./state.js";
import { favorAll, staminaCeiling } from "./partners.js";

const IMAP = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const itemOf = id => IMAP[id];

export function itemCount(id){
  const it = S.items.find(x => x.id === id);
  return it ? it.qty : 0;
}
export function addItem(id, qty=1){
  const row = S.items.find(x => x.id === id);
  if(row) row.qty += qty;
  else S.items.push({id, qty});
}
/** 按稀有度随机一个道具 id（道具池出货用） */
export function randomItemByRarity(r){
  const pool = ITEM_RARITY[r];
  if(!pool || !pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

/* ---------- 属性结算工具（钳制规则集中在此；体力上限含随行加成） ---------- */
export function clampAttrs(){
  const a = S.life.attrs;
  a.mood = Math.min(100, Math.max(0, a.mood));
  a.stamina = Math.min(staminaCeiling(), Math.max(0, a.stamina));
  a.skill = Math.min(100, Math.max(0, a.skill));
  a.charm = Math.min(100, Math.max(0, a.charm));
}
export function addAttrs({stamina=0, staminaMax=0, mood=0, skill=0, charm=0}){
  S.life.staminaMax += staminaMax;
  S.life.attrs.stamina += stamina;
  S.life.attrs.mood += mood;
  S.life.attrs.skill += skill;
  S.life.attrs.charm += charm;
  clampAttrs();
}

/** 刮刮乐抽奖分布（期望约 +105，靠运气） */
export function rollLottery(){
  const r = Math.random();
  if(r < .60) return {amt:0, text:'「谢谢惠顾」——刮开只有空气'};
  if(r < .90) return {amt:100, text:'中了 ¥100，奶茶自由一天'};
  if(r < .99) return {amt:500, text:'中了 ¥500！今天加个鸡腿'};
  return {amt:5000, text:'头奖 ¥5000！！！全楼都听见你尖叫了'};
}

/**
 * 使用一个道具
 * @returns {{ok:boolean, line:string, extra?:object}}
 */
export function useItem(id){
  const it = IMAP[id];
  const row = S.items.find(x => x.id === id);
  if(!it || !row || row.qty <= 0) return {ok:false, line:'没有这个道具'};
  row.qty--;
  if(row.qty <= 0) S.items = S.items.filter(x => x.id !== id);

  // 特殊道具
  if(it.special === 'lottery'){
    const res = rollLottery();
    S.money += res.amt;
    return {ok:true, line:`${it.icon} ${res.text}`, extra:{money:res.amt}};
  }
  if(it.special === 'pull'){
    S.freePulls++;
    return {ok:true, line:`${it.icon} 伙伴池免费单抽 +1，去卡池页用掉`, extra:{freePull:1}};
  }
  if(it.special === 'pity+10'){
    S.pity.partner += 10;
    return {ok:true, line:`${it.icon} 保底计数 +10，离出货更近一步`, extra:{pity:10}};
  }
  if(it.special === 'fullstamina+8'){
    S.life.staminaMax += 8;
    S.life.attrs.stamina = staminaCeiling();
    return {ok:true, line:`${it.icon} 体力回满，上限 +8`, extra:{}};
  }

  // 常规数值道具
  const e = it.effect || {};
  if(e.favor) favorAll(e.favor);
  addAttrs({
    stamina:e.stamina||0, staminaMax:e.staminaMax||0,
    mood:e.mood||0, skill:e.skill||0, charm:e.charm||0,
  });
  const parts = [];
  if(e.stamina) parts.push(`体力+${e.stamina}`);
  if(e.staminaMax) parts.push(`体力上限+${e.staminaMax}`);
  if(e.mood) parts.push(`心情${e.mood>0?'+':''}${e.mood}`);
  if(e.skill) parts.push(`技术+${e.skill}`);
  if(e.charm) parts.push(`魅力+${e.charm}`);
  if(e.favor) parts.push(`随行好感+${e.favor}`);
  save();
  return {ok:true, line:`${it.icon} ${it.name}：${parts.join('，')}`, extra:{}};
}
