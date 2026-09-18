/* ================================================================
   LLMLife · 弹窗层 (ui/modals.js)
   通用弹窗 / 结局结算 / 欢迎 / 玩法 / 概率公示 / 图鉴 / 皮肤
   ================================================================ */
import { MODELS, RARITY, POOLS, SKINS, LIFE, ENDINGS } from "../config.js";
import { S, $, save, fmt } from "../state.js";
import { iconImg, SFX, burst, toast } from "../fx.js";
import { applySkin } from "../skins.js";
import { restart, newGamePlus, CHAPTER_TOTAL } from "../life.js";
import { renderAll } from "./render.js";

/* ---------- 通用弹窗 ---------- */
export function showModal(html, lock=false){
  const b=$('modal-box'); b.innerHTML=html;
  if(lock) b.dataset.locked='1'; else delete b.dataset.locked;
  $('modal-mask').classList.add('show');
}
export function closeModal(){ $('modal-mask').classList.remove('show'); }
const _modalMask=$('modal-mask');
if(_modalMask) _modalMask.addEventListener('click', e=>{
  if(e.target.id==='modal-mask' && !$('modal-box').dataset.locked) $('modal-mask').classList.remove('show');
});
window.closeModal = closeModal;
export function goldFlash(){ const g=$('goldflash'); if(!g) return; g.classList.remove('go'); void g.offsetWidth; g.classList.add('go'); }

/* ---------- 结局结算 ---------- */
export function endingHTML(end){
  const s = S;
  const favorSum = s.partners.reduce((a,p)=>a+p.favor,0);
  const seen = Object.keys(s.endingsSeen||{}).length;
  const totalEndings = ENDINGS.length + 2; // 5 档 + 破产 + NB 彩蛋
  return `<h3>🏁 人生结算<button class="x" onclick="closeModal()">×</button></h3>
  <div class="end-title">${end.title}</div>
  <div class="end-sub">综合评分 <b style="color:var(--gold)">${end.score}</b> · 走完 ${s.life.day} 天（${CHAPTER_TOTAL} 章）<br />${end.desc}</div>
  <div class="end-stats">
    <div class="cell"><span class="lb">最终存款</span><b>${fmt(s.money)}</b></div>
    <div class="cell"><span class="lb">技术 / 魅力</span><b>${Math.round(s.life.attrs.skill)} / ${Math.round(s.life.attrs.charm)}</b></div>
    <div class="cell"><span class="lb">伙伴 / 总好感</span><b>${s.partners.length} 位 / ${favorSum}</b></div>
    <div class="cell"><span class="lb">累计打工</span><b>${s.stats.workDays} 次</b></div>
    <div class="cell"><span class="lb">结局收集</span><b style="color:var(--cyan)">${seen}/${totalEndings}</b></div>
    <div class="cell"><span class="lb">周目</span><b>${s.ng>0?`NG+${s.ng>1?s.ng:''}`:'一周目'}</b></div>
  </div>
  <button class="big-btn" data-act="ng-plus">🔁 新周目+（保留图鉴/皮肤/成就 · 起步资金奖励）</button>
  <button class="big-btn ghost" data-act="restart">💥 全部清零重开</button>
  <button class="big-btn ghost" onclick="closeModal()">再看看这个世界 →</button>`;
}
export function showEnding(end){
  SFX.win();
  burst(innerWidth/2, innerHeight/3, ['#f59e0b','#2f6bff','#ff5f6d','#fff'], 260, 12);
  showModal(endingHTML(end), true);
}

/* ---------- 欢迎 / 玩法 ---------- */
export function welcomeHTML(){
  return `<h3>🧑‍💻 欢迎来到 LLMLife<button class="x" onclick="closeModal()">×</button></h3>
  <p>你是 2026 年毕业的程序员，兜里揣着 <b>¥800</b>。<b>22 岁到 30 岁，一局 8 章</b>——一章一年，一年 24 天：</p>
  <p>📅 <b>章节</b>——一天 <b>12 格时间</b>（1 格≈2 小时），行动既吃格也吃体力，<b>格尽自动收工日切</b>；日切必发随机事件；<b>年末触发年度结算</b>：盘点收支、解锁下一章。</p>
  <p>💼 <b>职业</b>——实习生 → 正式员工 → 骨干 → 主管 → 自立门户，每一档晋升都会<b>解锁新行动卡</b>。</p>
  <p>🎯 <b>目标</b>——每周刷新周目标，完成拿抽卡券/现金/体力上限奖励，不用再盯着屏幕想「现在干嘛」。</p>
  <p>🤝 <b>伙伴</b>——抽 AI 伙伴随行：数值加成、好感满级解锁<b>专属行动卡</b>、重复卡升星。抽卡是次要玩法（大概）。</p>
  <p>🏠 <b>账单</b>——每周房租伙食雷打不动，欠租 2 周破产流浪；中后期还有<b>住房升级与行情投资</b>等烧钱大事。</p>
  <p>🏁 <b>结算</b>——30 岁按综合分定档结局，结算后可 <b>NG+ 新周目</b>：图鉴皮肤成就全保留。</p>
  <button class="big-btn" data-act="start">22 岁，入行 →</button>`;
}

export function helpHTML(){
  return `<h3>❓ 玩法说明<button class="x" onclick="closeModal()">×</button></h3>
  <p><b>主循环</b>：一天 12 格时间 + 一管体力，两者同时限制行动 → 格尽自动收工日切（也可手动提前收工，剩格不补发）→ 日切（事件 1~2 个，选择型事件当场拍板 + 体力回满，心情 -8）→ 周结算（房租+生活）→ <b>24 天 = 1 年 = 1 章</b>，章末年度结算 + 晋升抉择。</p>
  <p><b>职业</b>：五档职级，年度结算时达门槛即可晋升（或躺平换补偿）。职级提升收入倍率并解锁新行动卡（加班冲刺 / 外包大单 / 带队攻坚 / 公司经营……）。</p>
  <p><b>周目标</b>：每周一随机 2 条目标（打工 N 次 / 攒钱 X / 抽卡 Y 次……），完成自动发奖。</p>
  <p><b>属性</b>：时间格决定一天能做几件事（每个行动占用 1~4 格）；体力是身体底（睡眠恢复）；心情影响打工学习效率（低于 ${LIFE.MOOD_LOW} 打工更容易翻车）；技术决定接单收入；魅力靠社交与健身。</p>
  <p><b>打工</b>：收入 = 基础价 × 职级倍率 × 技术系数 × 心情系数 × 伙伴加成，大成功 ×2.5 / 返工 ×0.4 / 事故倒赔。<b>行动卡上直接公示成功率</b>，加班/大单的风险系数永远生效——高收益不是白送的。</p>
  <p><b>考证</b>：初级/高级/行业三张证，按技术定通过率（30%~95%，低心情打折），通过永久工作收入 +8%/张；落榜只损失报名费与心情，可以重考。</p>
  <p><b>伙伴</b>：最多 3 位随行。效果看厂商（Anthropic=收入、DeepSeek/阿里=学习、谷歌=体力上限、Meta=娱乐心情、OpenAI=魅力、智谱=全能六折），强度看稀有度（UR +50%、UTR +75% 起）与好感（×1.0/1.15/1.3）。<b>好感满 90 解锁该伙伴专属行动卡</b>（每天 1 次）；重复卡折好感 +10，同卡满 3 张升 1 星（每星效果 +8%）。</p>
  <p><b>资产</b>：住房升级链改善周租与睡眠；行情系统低买高卖（波动真实且与事件联动），持仓与房产计入净资产。</p>
  <p><b>结局</b>：30 岁按综合分定档（普通码农 → 神之人生，另有 7 种收集）；欠租 ${LIFE.GRACE_WEEKS} 周直接破产；手握 Fihag V1 有彩蛋结局。结算后 NG+ 保留收集。</p>
  <p class="note">卡面指数为 Artificial Analysis v4.3 真实智能指数，稀有度分段据此重标。本作为 TokenGacha 精神续作，纯属娱乐。</p>
  <button class="big-btn ghost" onclick="closeModal()">明白了 →</button>`;
}

/* ---------- 概率公示 ---------- */
export function ratesHTML(){
  const rows = Object.entries(POOLS).map(([k,p])=>{
    const rates = ['N','R','SR','SSR','UR','UTR'].map(r=>p.rates[r]?`<td class="rt-${r}">${(p.rates[r]*100).toFixed(1)}%</td>`:'<td>—</td>').join('');
    return `<tr><td><b style="color:${p.color}">${p.name}</b></td><td>¥${p.price}</td><td>¥${p.tenPrice}</td>${rates}<td>${p.pityMax||60}</td></tr>`;
  }).join('');
  const bandRows = Object.entries(RARITY).map(([r,b])=>
    `<tr><td class="rt-${r}">${r}</td><td>${b.label}</td><td>${b.min} ~ ${b.max===100?'100':b.max}</td><td>${MODELS.filter(m=>m.r===r).length} 张</td></tr>`).join('');
  return `<h3>📊 概率公示<button class="x" onclick="closeModal()">×</button></h3>
  <p><b>卡池概率</b>（另有隐藏彩蛋：Fihag V1 全池 0.01%、DeepSeek V4.1 Flash 独立爆率 1.5%、幻觉假 UR 0.2%）：</p>
  <table><tr><th>卡池</th><th>单抽</th><th>十连</th><th>N</th><th>R</th><th>SR</th><th>SSR</th><th>UR</th><th>UTR</th><th>保底</th></tr>${rows}</table>
  <p><b>稀有度分段</b>（按 Artificial Analysis v4.3 真实智能指数划分）：</p>
  <table><tr><th>档位</th><th>称号</th><th>指数区间</th><th>数量</th></tr>${bandRows}</table>
  <p class="note">限定池 100 抽大保底必出当期神话；普通池 60 抽保底 SSR+；道具池 30 抽保底 SR+。十连无 SR+ 时第 10 张强制补底。</p>
  <button class="big-btn ghost" onclick="closeModal()">关闭 →</button>`;
}

/* ---------- 图鉴 ---------- */
export function dexHTML(){
  const grid = MODELS.map(m=>{
    const got = S.dex[m.id] || 0;
    const r = RARITY[m.r];
    const cell = document.createElement('div');
    cell.className = 'dex-cell' + (got ? '' : ' locked');
    cell.style.setProperty('--rc', r.hex);
    cell.appendChild(iconImg(m.icon));
    const nm = document.createElement('div'); nm.className='nm'; nm.textContent = got ? m.name : '？？？';
    const ct = document.createElement('div'); ct.className='ct'; ct.textContent = got ? `×${got}` : `${m.idx} 分`;
    const rr = document.createElement('span'); rr.className='rr'; rr.style.color = r.hex; rr.textContent = m.r;
    cell.append(rr, nm, ct);
    return cell;
  });
  const box = document.createElement('div');
  const h = document.createElement('h3');
  h.innerHTML = `📖 模型图鉴 <span style="font-size:12px;color:var(--faint);font-weight:500">${Object.keys(S.dex).length}/${MODELS.length}</span><button class="x" onclick="closeModal()">×</button>`;
  const wrap = document.createElement('div'); wrap.className='dex-grid';
  grid.forEach(c=>wrap.appendChild(c));
  box.append(h, wrap);
  showModal(box.outerHTML);
}

/* ---------- 皮肤中心 ---------- */
export function skinPickerHTML(){
  const rows = SKINS.map(sk=>{
    const owned = S.skinsOwned.includes(sk.id);
    const using = S.skin === sk.id;
    return `<div class="skin-row${using?' using':''}">
      <span class="sk-ic">${sk.icon}</span>
      <div class="sk-info"><div class="sk-name">${sk.name}</div><div class="sk-desc">${sk.desc}</div></div>
      ${using ? '<button class="mini-btn on">使用中</button>'
        : owned ? `<button class="mini-btn" data-act="use-skin" data-skin="${sk.id}">使用</button>`
        : `<span class="note">抽卡掉落皮肤券兑换</span>`}
    </div>`;
  }).join('');
  showModal(`<h3>🎨 皮肤中心<span style="font-size:12px;color:var(--faint);font-weight:500">🎫 皮肤券 ×${S.skinTickets}</span><button class="x" onclick="closeModal()">×</button></h3>
  <div class="skin-list">${rows}</div>
  <button class="big-btn ghost" onclick="closeModal()">关闭 →</button>`);
}

/* ---------- 弹窗内按钮事件（boot.js 委托调用） ---------- */
export function handleModalAction(el){
  const act = el.dataset.act;
  if(act === 'restart'){
    closeModal();
    restart();
    renderAll();
    toast('🔄 新周目开始，22 岁的你又坐在了出租屋里');
    return true;
  }
  if(act === 'ng-plus'){
    closeModal();
    newGamePlus();
    applySkin(S.skin);
    renderAll();
    toast(`🔁 NG+${S.ng>1?S.ng:''} 开始！图鉴/皮肤/成就已继承，起步资金 ${fmt(S.money)}`, 3600);
    return true;
  }
  if(act === 'start'){
    S.flags.welcomed = true;
    save();
    closeModal();
    SFX.win();
    toast('🎁 启动资金 ¥800 到账，第 1 章开始！');
    renderAll();
    return true;
  }
  if(act === 'use-skin'){
    applySkin(el.dataset.skin);
    save();
    SFX.click();
    skinPickerHTML();
    renderAll();
    return true;
  }
  return false;
}
