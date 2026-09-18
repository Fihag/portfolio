/* ================================================================
   LLMLife · 资产层 (market.js)
   行情随机游走（endDay tick）、股票买卖、住房升级链
   净资产口径 assetsOf/houseOf 在 config.js 单源，本模块只做状态推进
   ================================================================ */
import { S, save, addLedger } from "./state.js";
import { MARKET, HOUSES, STOCK_SLOTS } from "./config.js";

/* 日切行情推进：先快照昨价（资产页 Δ% 显示），再固定漂移 + ±vol 随机游走，价格向下有底（≥1，单位价） */
export function tickMarket(){
  if(!S.market) return;
  S.market.prev = { ...S.market.price };
  for(const t of MARKET){
    const p = S.market.price[t.id] || t.base;
    S.market.price[t.id] = Math.max(1, Math.round(p * (1 + t.drift + (Math.random()*2 - 1) * t.vol)));
  }
}

/* 事件行情冲击：对全部持仓标的一次性乘性冲击（fx.market={mul} 或 {mul:[min,max]}） */
export function shockMarket(mul){
  if(!S.market) return;
  for(const t of MARKET){
    const p = S.market.price[t.id] || t.base;
    S.market.price[t.id] = Math.max(1, Math.round(p * mul));
  }
}

/* 持仓总市值（不含现金与房产） */
export function holdingsValue(){
  let v = 0;
  if(S.market) for(const t of MARKET){
    const q = S.market.hold[t.id] || 0;
    if(q > 0) v += q * (S.market.price[t.id] || t.base);
  }
  return v;
}

function tickerOf(id){ return MARKET.find(t=>t.id===id); }

/* 买入 qty 份：现金不足返回 {err}；成功返回 {amt} */
export function buyStock(id, qty){
  const t = tickerOf(id);
  if(!t || !(qty > 0) || !STOCK_SLOTS.includes(qty)) return {err:'无效交易'};
  if(!S.market) S.market = { price:Object.fromEntries(MARKET.map(x=>[x.id,x.base])), hold:{} };
  const amt = qty * (S.market.price[id] || t.base);
  if(S.money < amt) return {err:'现金不足'};
  S.money -= amt;
  S.market.hold[id] = (S.market.hold[id] || 0) + qty;
  addLedger(`买入 ${t.name} ×${qty}`, -amt);
  save();
  return {amt};
}

/* 卖出 qty 份：持仓不足返回 {err}；成功返回到账金额 {amt} */
export function sellStock(id, qty){
  const t = tickerOf(id);
  if(!t || !(qty > 0)) return {err:'无效交易'};
  const held = (S.market && S.market.hold[id]) || 0;
  if(held < qty) return {err:'持仓不足'};
  const amt = qty * (S.market.price[id] || t.base);
  S.market.hold[id] = held - qty;
  S.money += amt;
  addLedger(`卖出 ${t.name} ×${qty}`, amt);
  save();
  return {amt};
}

/* ---------- 住房链：只能逐级升房，买后 rent/心情/体力上限随房走 ---------- */
export function nextHouse(){
  const i = (S.life.house || 0) + 1;
  return i < HOUSES.length ? {idx:i, house:HOUSES[i]} : null;
}

/* 购入下一档住房：现金不足返回 {err}；成功返回 {house} */
export function buyHouse(){
  const nx = nextHouse();
  if(!nx) return {err:'已住进顶配'};
  if(S.money < nx.house.cost) return {err:'现金不足'};
  S.money -= nx.house.cost;
  S.life.house = nx.idx;
  addLedger(`购房 · ${nx.house.name}`, -nx.house.cost);
  save();
  return {house:nx.house};
}
