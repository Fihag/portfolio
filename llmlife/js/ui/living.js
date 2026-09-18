/* ================================================================
   LLMLife · 生活页交互 (ui/living.js)
   行动点击 → 引擎结算 → 演出（音效/粒子/飘字）→ 日志呈现 → 结局
   结束今天 → 日切 → 新的一天弹窗；重开确认
   ================================================================ */
import { S, save, fmt } from "../state.js";
import { SFX, burst, bigMoneyPop, toast } from "../fx.js";
import { doAction, endDay, anyActionAvailable, restart, chapterIndex, CHAPTER_TOTAL, actionOf, choiceEvent, resolveChoice, daySlots } from "../life.js";
import { LIFE, CAREERS } from "../config.js";
import { meetsReq, reqText, tryPromote, stayPut } from "../careers.js";
import { useItem } from "../items.js";
import { setSlot, staminaCeiling } from "../partners.js";
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
  const work = id === 'work' || !!(actionOf(id) || {}).workMult;
  if(work){
    if(/🤩/.test(res.line)){ SFX.win(); burst(innerWidth/2, innerHeight/2, ['#f59e0b','#2f6bff','#fff'], 90, 9); goldSmall(); }
    else if(/💥/.test(res.line)){ SFX.bad(); }
    else SFX.coin();
  } else {
    SFX.click();
  }
  // 行动结果行进 toast 突出显示（打工以外的小行动）
  if(!work) toast(res.line, 1800);
  if(work && res.line) bigMoneyFromLine(res.line);
  // 成就 / 周目标
  for(const l of res.lines || []){
    if(l.startsWith('🏅')){
      SFX.win();
      burst(innerWidth/2, innerHeight/3, ['#f59e0b','#2f6bff','#ff5f6d','#fff'], 160, 11);
      toast(l, 3000);
    } else if(l.startsWith('🎯')){
      SFX.win();
      toast(l, 3000);
    }
  }
  renderAll();
  if(S.ending){ setTimeout(()=>showEnding(S.ending), 450); return; }
  if(res.dayEnded){
    // 时间格耗尽：自动进入日切（不需要确认，节奏由时钟驱动）
    toast('🌙 今天的格数用完了，收工', 1600);
    setTimeout(()=>handleConfirmEndDay(), 600);
    return;
  }
  if(!anyActionAvailable()) toast('💤 体力见底：提前收工，或用道具/明天再战', 2600);
}
function goldSmall(){ const g=document.getElementById('goldflash'); if(g){ g.classList.remove('go'); void g.offsetWidth; g.classList.add('go'); } }
function bigMoneyFromLine(line){
  const m = line.match(/（([+-]¥[\d,]+)）/);
  if(!m) return;
  const neg = m[1].startsWith('-');
  const amt = Number(m[1].replace(/[^\d]/g, '')) * (neg ? -1 : 1);
  bigMoneyPop(amt);
}

/** 「提前收工」→ 确认弹窗（时间格没用完也不补发，纯粹提前结束） */
export function handleEndDay(){
  if(S.ending){ toast('本局已结束，开个新周目再战'); return; }
  const left = Math.max(0, S.life.timeLeft || 0);
  showModal(`<h3>🛏 提前收工<button class="x" data-act="close-modal">×</button></h3>
  <p>今天还剩 <b>${left}/${LIFE.SLOTS_PER_DAY} 格</b>没用掉（不补发）。睡觉后：<b>随机事件 1~2 个</b> → <b>体力回满</b>（心情 -8，好房子有加成）${dayHint()}</p>
  <button class="big-btn" data-act="confirm-end-day">天黑了，睡觉 →</button>
  <button class="big-btn ghost" data-act="close-modal">再干一会儿 →</button>`);
}
function dayHint(){
  const nextDay = S.life.day + 1;
  return (nextDay - 1) % LIFE.WEEK_DAYS === 0 ? '<br />⚠️ 明天醒来要交 <b>房租 + 伙食</b>，留意余额！' : '';
}

/** 确认日切 → 结算 → 日流程链：分支抉择 → 章末年度结算 → 新的一天 */
export function handleConfirmEndDay(){
  closeModal();
  const lines = endDay();
  renderAll();
  S._dayLines = lines; // 暂存（_ 前缀不落盘），供链式弹窗依次消费
  showDayFlow();
}
export function showDayFlow(){
  if(S.ending){ setTimeout(()=>showEnding(S.ending), 350); S._settle=null; S._dayLines=null; return; }
  showPendingChoice();
}
/** 有待选抉择时优先弹出锁定弹窗；否则进入结算/新一天 */
export function showPendingChoice(){
  if(S.life.pendingChoice){ showModal(choiceModalHTML(), true); return; }
  if(S._settle){ showModal(chapterSettleHTML(S._settle)); S._settle=null; return; }
  if(S._dayLines){ showModal(newDayHTML(S._dayLines)); S._dayLines=null; }
}
function choiceModalHTML(){
  const ev = choiceEvent();
  if(!ev) return `<h3>⚖️ 抉择失效<button class="x" data-act="close-modal">×</button></h3><p>这件事悄悄过去了。</p><button class="big-btn" data-act="settle-next">继续 →</button>`;
  return `<h3>⚖️ ${ev.name}</h3>
  <p style="line-height:1.85">${ev.text}</p>
  ${ev.choices.map((c, i) => `<button class="big-btn" data-act="event-choice" data-i="${i}">${c.label}</button>`).join('')}`;
}
export function handleEventChoice(i){
  const line = resolveChoice(i);
  SFX.win();
  if(line) toast(line, 3600);
  renderAll();
  showPendingChoice(); // 抉择之后才轮到年度结算/新的一天
}
export function handleSettleNext(){
  closeModal();
  if(S._dayLines){ showModal(newDayHTML(S._dayLines)); S._dayLines=null; }
}
function settleChoiceHTML(){
  const next = CAREERS[S.life.tier + 1];
  if(!next) return '';
  if(meetsReq(S.life.tier + 1)){
    return `<div class="settle-promo">
    <p>🪜 <b>晋升机会来了</b>：这一年的成绩单够到了 ${next.icon}「${next.name}」（工作收入 ×${next.mult}）——<span style="color:var(--faint)">${reqText(S.life.tier + 1)}</span>。往上跳，还是再稳一年？</p>
    <button class="big-btn" data-act="promote">🚀 晋升「${next.name}」</button>
    <button class="big-btn ghost" data-act="stay">🍵 再沉淀一年（技术 +3 · 心情 +10）</button></div>`;
  }
  return `<p style="color:var(--faint)">🔒 下一级 ${next.icon}「${next.name}」的条件还差一点：${reqText(S.life.tier + 1)}。明年此时再来敲门。</p>`;
}
export function handlePromote(){
  closeModal();
  const res = tryPromote();
  SFX.win();
  burst(innerWidth/2, innerHeight/3, ['#f59e0b','#2f6bff','#fff'], 140, 10);
  toast(res.line, 3600);
  renderAll();
  showPendingChoice();
}
export function handleStay(){
  closeModal();
  const res = stayPut();
  SFX.click();
  toast(res.line, 2600);
  renderAll();
  showPendingChoice();
}
function chapterSettleHTML(st){
  const neg = st.net < 0;
  return `<h3>📆 第 ${st.no + 1}/${CHAPTER_TOTAL} 章 ·《${st.title}》<button class="x" data-act="close-modal">×</button></h3>
  <p>🎂 ${st.ageFrom} 岁 → <b>${st.ageTo} 岁</b>。生日与章末是同一件事——这一年过完了：</p>
  <div class="end-stats">
    <div class="cell"><span class="lb">本年净收支</span><b style="color:${neg?'var(--red)':'var(--green)'}">${fmt(st.net)}</b></div>
    <div class="cell"><span class="lb">收入 / 支出</span><b>${fmt(st.earned)} / ${fmt(st.spent)}</b></div>
    <div class="cell"><span class="lb">接单 / 抽卡</span><b>${st.workDays} 次 / ${st.pulls} 抽</b></div>
    <div class="cell"><span class="lb">技术 / 魅力</span><b>${st.skill} / ${st.charm}</b></div>
    <div class="cell"><span class="lb">当前职级</span><b>${CAREERS[S.life.tier].icon} ${CAREERS[S.life.tier].name}</b></div>
    <div class="cell"><span class="lb">当前评分</span><b style="color:var(--cyan)">${st.score}</b></div>
  </div>
  ${settleChoiceHTML()}
  ${st.nextTitle
    ? `<p>下一章预告：<b>《${st.nextTitle}》</b>（${st.ageTo} → ${st.ageTo + 1} 岁 · 剩 ${CHAPTER_TOTAL - st.no - 1} 章）</p>`
    : `<p><b>结算的钟声就在门外。</b>这八年如何，明天见分晓。</p>`}
  ${meetsReq(S.life.tier + 1) ? '' : `<button class="big-btn" data-act="settle-next">翻开第 ${st.no + 2} 章 →</button>`}`;
}
function newDayHTML(lines){
  const a = S.life.attrs;
  const ch = chapterIndex();
  const dayInChapter = (S.life.day - 1) % LIFE.CHAPTER_DAYS + 1;
  const body = lines.length
    ? lines.map(l=>{
              const cls = l.startsWith('🎲') || l.startsWith('⚖️') || l.startsWith('💞') || l.startsWith('🧭') ? 'ev' : l.startsWith('📆') ? 'ms' : '';
        return `<div class="row ${cls}" style="background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:12.5px;line-height:1.6;margin-bottom:6px">${l}</div>`;
      }).join('')
    : '<p style="color:var(--faint)">风平浪静的一天。</p>';
  return `<h3>🌅 第 ${ch + 1}/${CHAPTER_TOTAL} 章 · 第 ${dayInChapter}/${LIFE.CHAPTER_DAYS} 天（星期${(S.life.day - 1) % LIFE.WEEK_DAYS + 1}）<button class="x" data-act="close-modal">×</button></h3>
  ${S.life.sick ? '<div class="sick-banner">🤒 病假半休：今天只有 ' + daySlots() + ' 格时间，别再熬夜了</div>' : ''}
  ${body}
  <div class="end-stats">
    <div class="cell"><span class="lb">体力</span><b>${Math.round(a.stamina)}/${staminaCeiling()}</b></div>
    <div class="cell"><span class="lb">心情</span><b>${Math.round(a.mood)}</b></div>
    <div class="cell"><span class="lb">饱食</span><b>${Math.round(a.satiety)}</b></div>
    <div class="cell"><span class="lb">健康</span><b>${Math.round(a.health)}</b></div>
    <div class="cell"><span class="lb">余额</span><b>${fmt(S.money)}</b></div>
    <div class="cell"><span class="lb">年龄</span><b>${S.life.age} 岁</b></div>
  </div>
  <button class="big-btn" data-act="close-modal">开始新的一天 →</button>`;
}

/** header 重开 → 确认弹窗（给 NG+ 与清档两条路） */
export function handleRestartAsk(){
  showModal(`<h3>🔄 重开新周目<button class="x" data-act="close-modal">×</button></h3>
  <p>当前进度将被清空：<b>第 ${S.life.day} 天 · ${fmt(S.money)} · ${S.partners.length} 位伙伴</b>。</p>
  <p style="color:var(--faint)">人生没有重开，但游戏有。<b>NG+</b> 会保留图鉴/皮肤/成就，数值清零重新 22 岁。</p>
  <button class="big-btn" data-act="ng-plus">🔁 NG+（保留收集）</button>
  <button class="big-btn danger" data-act="confirm-reset">💥 全部清零重开</button>
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
