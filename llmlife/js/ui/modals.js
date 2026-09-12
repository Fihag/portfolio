/* ================================================================
   LLMLife · 弹窗层 (ui/modals.js)
   通用弹窗 / 结局结算 / 欢迎 / 玩法 / 概率公示 / 图鉴 / 皮肤
   ================================================================ */
import { MODELS, RARITY, POOLS, SKINS, LIFE } from "../config.js";
import { S, $, save, fmt } from "../state.js";
import { iconImg, SFX, burst, toast } from "../fx.js";
import { applySkin } from "../skins.js";
import { restart } from "../life.js";
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
  return `<h3>🏁 人生结算<button class="x" onclick="closeModal()">×</button></h3>
  <div class="end-title">${end.title}</div>
  <div class="end-sub">综合评分 <b style="color:var(--gold)">${end.score}</b> · 通关用时 ${s.life.day} 天<br />${end.desc}</div>
  <div class="end-stats">
    <div class="cell"><span class="lb">最终存款</span><b>${fmt(s.money)}</b></div>
    <div class="cell"><span class="lb">技术 / 魅力</span><b>${s.life.attrs.skill} / ${s.life.attrs.charm}</b></div>
    <div class="cell"><span class="lb">伙伴 / 总好感</span><b>${s.partners.length} 位 / ${favorSum}</b></div>
    <div class="cell"><span class="lb">累计打工</span><b>${s.stats.workDays} 次</b></div>
  </div>
  <button class="big-btn" data-act="restart">🔄 开启新周目</button>
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
  <p>你是 2026 年毕业的程序员，兜里揣着 <b>¥800</b>。往后的日子这样过：</p>
  <p>📅 <b>生活</b>——每天 3 点行动力：打工赚钱、学习涨技术、健身社交，或者干脆躺平。</p>
  <p>🤝 <b>伙伴</b>——抽卡抽 AI 伙伴随行：Anthropic 加收入、DeepSeek 加学习、Google 加体力……抽卡是次要玩法（大概）。</p>
  <p>🏠 <b>账单</b>——每周房租 + 伙食雷打不动，连续欠租 2 周就破产流浪。</p>
  <p>🏁 <b>结算</b>——60 岁结算人生，评分看存款、技术、魅力和伙伴羁绊。</p>
  <button class="big-btn" data-act="start">22 岁，入行 →</button>`;
}

export function helpHTML(){
  return `<h3>❓ 玩法说明<button class="x" onclick="closeModal()">×</button></h3>
  <p><b>主循环</b>：生活页每天 3 点行动力，行动 → 日切（随机事件 + 睡眠恢复）→ 周结算（房租+伙食）→ 每 360 天长一岁。</p>
  <p><b>属性</b>：体力限制行动（睡眠恢复）；心情影响打工学习效率（低于 ${LIFE.MOOD_LOW} 打工更容易翻车）；技术决定接单收入；魅力靠社交与健身。</p>
  <p><b>打工</b>：收入 = 基础价 × 技术系数 × 心情系数 × 伙伴加成，结算走大成功 ×2.5 / 返工 ×0.4 / 生产事故倒赔的事件流，概率公示页可查。</p>
  <p><b>伙伴</b>：最多 3 位随行。效果类型看厂商（Anthropic=收入、DeepSeek/阿里=学习、谷歌=体力上限、Meta=娱乐心情、OpenAI=魅力、智谱=全能六折），强度看稀有度（UR +30% 起）与好感等级（×1.0/1.15/1.3）。重复卡折算好感 +10。</p>
  <p><b>道具</b>：福袋开出的一次性道具，咖啡回体力、书籍涨技术、手办涨好感、刮刮乐看命。</p>
  <p><b>结局</b>：60 岁按综合分定档（普通码农 → 神之人生）；连续 ${LIFE.GRACE_WEEKS} 周欠租直接破产；手握 Fihag V1 另有彩蛋结局。</p>
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
  if(act === 'start'){
    S.flags.welcomed = true;
    save();
    closeModal();
    SFX.win();
    toast('🎁 启动资金 ¥800 到账，好好干！');
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
