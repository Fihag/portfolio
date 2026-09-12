/* ================================================================
   LLMLife · 生活页交互 (ui/living.js)
   行动点击 → 引擎结算 → 演出（音效/粒子/飘字）→ 日志呈现 → 结局
   结束今天 → 日切 → 新的一天弹窗；重开确认
   ================================================================ */
import { S, save, fmt } from "../state.js";
import { SFX, burst, bigMoneyPop, toast } from "../fx.js";
import { doAction, endDay, anyActionAvailable, restart } from "../life.js";
import { useItem } from "../items.js";
import { setSlot } from "../partners.js";
import { setActionHandler, renderAll } from "./render.js";
import { showEnding, showModal, closeModal } from "./modals.js";

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
  // 行动结果行进 toast 突出显示（打工以外的小行动）
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
  if(S.ending){ setTimeout(()=>showEnding(S.ending), 450); return; }
  if(!anyActionAvailable()) toast('💤 体力见底：结束今天，或用道具/明天再战', 2600);
}
function goldSmall(){ const g=document.getElementById('goldflash'); if(g){ g.classList.remove('go'); void g.offsetWidth; g.classList.add('go'); } }
function bigMoneyFromLine(line){
  const m = line.match(/（([+-]¥[\d,]+)）/);
  if(!m) return;
  const neg = m[1].startsWith('-');
  const amt = Number(m[1].replace(/[^\d]/g, '')) * (neg ? -1 : 1);
  bigMoneyPop(amt);
}

/** 「结束今天」→ 确认弹窗 */
export function handleEndDay(){
  if(S.ending){ toast('本局已结束，开个新周目再战'); return; }
  showModal(`<h3>🛏 结束今天<button class="x" data-act="close-modal">×</button></h3>
  <p>跳过剩余行动进入日切：<b>随机事件 1~2 个</b> → 睡一觉<b>体力回满</b>（心情 -8）${dayHint()}</p>
  <button class="big-btn" data-act="confirm-end-day">天黑了，睡觉 →</button>
  <button class="big-btn ghost" data-act="close-modal">再肝一会儿 →</button>`);
}
function dayHint(){
  const nextDay = S.life.day + 1;
  return (nextDay - 1) % 7 === 0 ? '<br />⚠️ 明天醒来要交 <b>房租 + 伙食</b>，留意余额！' : '';
}

/** 确认日切 → 结算 → 新的一天弹窗 */
export function handleConfirmEndDay(){
  closeModal();
  const lines = endDay();
  renderAll();
  if(S.ending){ setTimeout(()=>showEnding(S.ending), 350); return; }
  showModal(newDayHTML(lines));
}
function newDayHTML(lines){
  const a = S.life.attrs;
  const body = lines.length
    ? lines.map(l=>{
        const cls = l.startsWith('🎲') ? 'ev' : l.startsWith('🎂') ? 'ms' : '';
        return `<div class="row ${cls}" style="background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:12.5px;line-height:1.6;margin-bottom:6px">${l}</div>`;
      }).join('')
    : '<p style="color:var(--faint)">风平浪静的一天。</p>';
  return `<h3>🌅 新的一天 · 第 ${S.life.day} 天（星期${(S.life.day - 1) % 7 + 1}）<button class="x" data-act="close-modal">×</button></h3>
  ${body}
  <div class="end-stats">
    <div class="cell"><span class="lb">体力</span><b>${Math.round(a.stamina)}/${S.life.staminaMax}</b></div>
    <div class="cell"><span class="lb">心情</span><b>${Math.round(a.mood)}</b></div>
    <div class="cell"><span class="lb">余额</span><b>${fmt(S.money)}</b></div>
    <div class="cell"><span class="lb">年龄</span><b>${S.life.age} 岁</b></div>
  </div>
  <button class="big-btn" data-act="close-modal">开始新的一天 →</button>`;
}

/** header 重开 → 确认弹窗 */
export function handleRestartAsk(){
  showModal(`<h3>🔄 重开新周目<button class="x" data-act="close-modal">×</button></h3>
  <p>当前进度将被清空：<b>第 ${S.life.day} 天 · ${fmt(S.money)} · ${S.partners.length} 位伙伴</b>。</p>
  <p style="color:var(--faint)">人生没有重开，但游戏有。想好了吗？</p>
  <button class="big-btn danger" data-act="confirm-reset">确认重开</button>
  <button class="big-btn ghost" data-act="close-modal">手滑了，继续过 →</button>`);
}
export function handleConfirmReset(){
  closeModal();
  restart();
  renderAll();
  toast('🔄 新周目开始，22 岁的你又坐在了出租屋里');
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

/** boot 阶段把处理器挂到渲染层 */
export function initLiving(){
  setActionHandler(handleAction);
}
