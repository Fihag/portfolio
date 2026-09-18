/* ================================================================
   LLMLife · 资产页交互 (ui/assets.js)
   住房升级 / 行情买卖的按钮处理器（由 boot.js 委托分发）
   ================================================================ */
import { MARKET } from "../config.js";
import { logToday } from "../state.js";
import { toast, SFX } from "../fx.js";
import { buyHouse, buyStock, sellStock } from "../market.js";
import { renderAll } from "./render.js";

export function handleHouseBuy(){
  const r = buyHouse();
  if(r.err){ toast('❌ ' + r.err); return; }
  SFX.win();
  toast(`🏠 乔迁「${r.house.name}」`);
  logToday(`🏠 搬进「${r.house.name}」：睡得更香、体力更足，周支出也水涨船高`);
  renderAll();
}

/** side: 'buy' | 'sell'；qty 步进在 STOCK_SLOTS 内（market.js 校验） */
export function handleStockTrade(side, id, qty){
  const t = MARKET.find(x=>x.id===id);
  const r = side === 'sell' ? sellStock(id, qty) : buyStock(id, qty);
  if(r.err){ toast('❌ ' + r.err); return; }
  SFX.click();
  const name = t ? t.name : id;
  toast(side === 'sell' ? `💰 卖出 ${name} ×${qty}，到账 ${Math.round(r.amt)}` : `📈 买入 ${name} ×${qty}`);
  renderAll();
}
