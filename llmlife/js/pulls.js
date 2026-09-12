/* ================================================================
   LLMLife · 抽卡核心 (pulls.js)
   伙伴池 / 限定池 / 道具池 · 保底 · 十连补底 · 独立爆率彩蛋
   纯逻辑层：只改 S 与存档，不触 UI（演出由 ui/gacha.js 处理）
   两阶段执行：先生成结果序列（含十连补底修正），再统一结算入档
   ================================================================ */
import { POOLS, PITY_MAX, RORDER, RORDER_DESC, MODELS, MMAP, PROBS, LIMITED_IDS } from "./config.js";
import { S, save } from "./state.js";
import { recruit } from "./partners.js";
import { addItem, randomItemByRarity } from "./items.js";
import { rollSkinDrop } from "./skins.js";

const NBIE_ID = 'deepseek-v4-1-flash'; // 新秀独立爆率卡

/* ---------- 单抽稀有度判定 ---------- */
export function drawRarity(poolKey){
  const pool = POOLS[poolKey];
  const pityMax = pool.pityMax || PITY_MAX;
  if(S.pity[poolKey] >= pityMax-1){
    // 保底: 限定池必出 UTR 神话; 伙伴池 20% UR / 80% SSR; 道具池 20% UR / 80% SR
    if(pool.banner) return 'UTR';
    if(pool.isItem) return Math.random()<.2 ? 'UR' : 'SR';
    return Math.random()<.2 ? 'UR' : 'SSR';
  }
  const r = Math.random(); let acc = 0;
  for(const t of RORDER_DESC){ acc += pool.rates[t]||0; if(r < acc) return t; }
  return pool.isItem ? 'N' : 'N';
}

/* ---------- 单抽结果生成（不入档） ---------- */
export function makeResult(poolKey, rarity, forceNewbie){
  if(poolKey === 'item'){
    const id = randomItemByRarity(rarity) || randomItemByRarity('N');
    return {kind:'item', id, rarity};
  }
  let cands;
  if(forceNewbie){
    cands = MODELS.filter(m => m.id === NBIE_ID);
  }else{
    cands = MODELS.filter(m => m.r===rarity && m.id!==NBIE_ID && (!m.bannerOnly || (poolKey==='banner' && LIMITED_IDS.has(m.id))));
    if(!cands.length) cands = MODELS.filter(m => m.r===rarity && !m.bannerOnly); // 兜底
  }
  if(!cands.length) cands = MODELS.filter(m => m.r==='N');
  const m = cands[Math.floor(Math.random()*cands.length)];
  return {kind:'partner', id:m.id, rarity:m.r};
}

/* 幻觉彩蛋: 非神话伙伴 0.2% 伪装成 UR 演出，揭晓后变回 R 伙伴 + 随行好感补偿 */
export function maybeHallucinate(res, poolKey){
  if(poolKey === 'item' || res.kind !== 'partner') return;
  if(res.id === NBIE_ID || res.id === 'fihagv1') return;
  if(RORDER.indexOf(res.rarity) >= RORDER.indexOf('UR')) return;
  if(Math.random() >= PROBS.HALLUC) return;
  const rCands = MODELS.filter(m => m.r==='R' && !m.bannerOnly);
  const uCands = MODELS.filter(m => m.r==='UR' && !m.bannerOnly);
  if(!rCands.length || !uCands.length) return;
  const real = rCands[Math.floor(Math.random()*rCands.length)];
  const fake = uCands[Math.floor(Math.random()*uCands.length)];
  res.id = real.id;
  res.rarity = 'R';
  res._halluc = fake.id; // 揭晓前显示 UR 伪装
}

/* ---------- 保底计数规则（按真实稀有度; 限定池只认当期限定神话或 NB） ---------- */
function pityReset(poolKey, rarity, id){
  const pool = POOLS[poolKey];
  if(pool.banner) return rarity==='NB' || (rarity==='UTR' && LIMITED_IDS.has(id));
  if(pool.isItem) return ['SR','SSR','UR','NB'].includes(rarity);
  return ['SSR','UR','UTR','NB'].includes(rarity);
}

/**
 * 抽卡主入口
 * @returns {Array<{kind:'partner'|'item', id:string, rarity:Rarity, _halluc?:string}>}
 */
export function doPulls(poolKey, count){
  const pool = POOLS[poolKey];
  const pityMax = pool.pityMax || PITY_MAX;
  const results = [];

  /* 阶段一: 生成结果序列（只读 pity） */
  for(let i=0;i<count;i++){
    const atPity = S.pity[poolKey] >= pityMax-1;
    const gotFihag = !pool.isItem && Math.random() < PROBS.FIHAG;
    const forceNewbie = !pool.isItem && !gotFihag && !atPity && Math.random() < PROBS.NEWBIE;
    let res;
    if(gotFihag){
      res = {kind:'partner', id:'fihagv1', rarity:'NB'};
    }else if(atPity && pool.banner){
      res = {kind:'partner', id:LIMITED_IDS.values().next().value, rarity:'UTR'};
    }else{
      res = makeResult(poolKey, drawRarity(poolKey), forceNewbie);
    }
    maybeHallucinate(res, poolKey);
    results.push(res);
  }

  /* 阶段二: 十连补底（伙伴池无 SR+ 时第 10 张强制 SR；跳过幻觉伪装卡） */
  if(count===10 && !pool.isItem && !results.some(r => ['SR','SSR','UR','UTR','NB'].includes(r.rarity))){
    let idx = results.length-1;
    while(idx >= 0 && results[idx]._halluc) idx--;
    if(idx >= 0){
      const cands = MODELS.filter(m => m.r==='SR' && !m.bannerOnly);
      const m = cands[Math.floor(Math.random()*cands.length)];
      results[idx] = {kind:'partner', id:m.id, rarity:'SR', _bottom:true};
    }
  }

  /* 阶段三: 统一结算入档 */
  for(const res of results){
    const realR = res.rarity;
    if(res.kind === 'partner'){
      recruit(res.id);
      S.dex[res.id] = (S.dex[res.id]||0)+1;
    }else{
      addItem(res.id, 1);
    }
    S.stats.pulls++;
    S.stats.byR[realR] = (S.stats.byR[realR]||0)+1;
    maybeBest(res);
    S.hist.push({d:S.life.day, pool:poolKey, id:res.id, r:realR});
    if(S.hist.length > 100) S.hist.splice(0, S.hist.length-100);
    // 保底计数（十连补底实际出货 SR+，视为清零，同 tokengacha 规则）
    S.pity[poolKey] = (res._bottom || pityReset(poolKey, realR, res.id)) ? 0 : S.pity[poolKey]+1;
  }
  rollSkinDrop(results);
  save();
  return results;
}

/* 最佳出货: 先比稀有度, 同档比智能指数 */
export function maybeBest(res){
  const m = MMAP[res.id];
  if(!m) return;
  if(!S.stats.best){ S.stats.best = res.id; return; }
  const b = MMAP[S.stats.best];
  const d = RORDER.indexOf(m.r) - RORDER.indexOf(b.r);
  if(d > 0 || (d === 0 && m.idx > b.idx)) S.stats.best = res.id;
}
