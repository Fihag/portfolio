/* ================================================================
   LLMLife · 生活页交互 (ui/living.js)
   行动点击 → 引擎结算 → 演出（音效/粒子/飘字）→ 日志呈现 → 结局
   ================================================================ */
import { S, save } from "../state.js";
import { SFX, burst, bigMoneyPop, toast } from "../fx.js";
import { doAction } from "../life.js";
import { useItem } from "../items.js";
import { setSlot } from "../partners.js";
import { setActionHandler } from "./render.js";
import { renderAll } from "./render.js";
import { showEnding } from "./modals.js";

/** 生活页行动按钮点击 */
export function handleAction(id){
  const res = doAction(id);
  if(!res.ok){
    SFX.bad();
    toast(res.line);
    return;
  }
  if(id === 'work'){
    if(/🤩/.test(res.line)){ SFX.win(); burst(innerWidth/2, innerHeight/2, ['#f59e0b','#2f6bff','#fff'], 90, 9); goldSmall(); }
    else if(/💥/.test(res.line)){ SFX.bad(); }
    else SFX.coin();
  } else {
    SFX.click();
  }
  // 行动结果行进 toast 突出显示（打工/事件以外的小行动）
  if(id !== 'work') toast(res.line, 1800);
  if(id === 'work' && res.line) bigMoneyFromLine(res.line);
  // 成就
  for(const l of res.lines || []){
    if(l.startsWith('🏅')){
      SFX.win();
      burst(innerWidth/2, innerHeight/3, ['#f59e0b','#2f6bff','#ff5f6d','#fff'], 160, 11);
      toast(l, 3000);
    }
  }
  renderAll();
  if(S.ending) setTimeout(()=>showEnding(S.ending), 450);
}
function goldSmall(){ const g=document.getElementById('goldflash'); if(g){ g.classList.remove('go'); void g.offsetWidth; g.classList.add('go'); } }
function bigMoneyFromLine(line){
  const m = line.match(/（([+-]¥[\d,]+)）/);
  if(!m) return;
  const neg = m[1].startsWith('-');
  const amt = Number(m[1].replace(/[^\d]/g, '')) * (neg ? -1 : 1);
  bigMoneyPop(amt);
}

/** 背包使用道具 */
export function handleUseItem(id){
  const res = useItem(id);
  if(!res.ok){ SFX.bad(); toast(res.line); return; }
  SFX.coin();
  toast(res.line, 2400);
  renderAll();
}

/** 伙伴页随行槽编排 */
export function handleSlotAction(slot, uid){
  const ok = setSlot(Number(slot), uid === 'null' || uid == null ? null : Number(uid));
  if(ok){ SFX.click(); save(); renderAll(); }
  else toast('编队失败');
}

/** boot 阶段把处理器挂到渲染层与全局委托 */
export function initLiving(){
  setActionHandler(handleAction);
}
