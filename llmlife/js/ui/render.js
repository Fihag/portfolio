/* ================================================================
   LLMLife · 渲染层 (ui/render.js)
   状态变化后全量重渲：头部芯片 / 生活页 / 伙伴页 / 背包页 / 数据页
   ================================================================ */
import { ACTIONS, MODELS, MMAP, RARITY, LIFE, POOLS, MILESTONES, ENDINGS, ITEMS, PITY_MAX, endingScore, CHAPTER_TITLES, CAREERS, DUO_STAMINA, DUO_SLOTS, HOUSES, HOUSE_EQUITY, MARKET, STOCK_SLOTS, assetsOf, houseOf, livingCost } from "../config.js";
import { S, $, fmt, dayLog } from "../state.js";
import { holdingsValue } from "../market.js";
import { examRate, workSuccessRate } from "../economy.js";
import { iconImg } from "../fx.js";
import { validateResult } from "../validate.js";
import { slotBoosts, favorNext, effectOf, bestPartner, staminaCeiling } from "../partners.js";
import { itemOf } from "../items.js";
import { canDo, chapterIndex, CHAPTER_TOTAL, duoCards, daySlots } from "../life.js";
import { careerOf, reqText } from "../careers.js";
import { goalOf, goalProg, rewardText } from "../goals.js";
import { bannerCountdownText } from "../banner.js";

let lastMoney = null;

/* ---------- 头部芯片 ---------- */
function renderHeader(){
  const mEl = $('h-money');
  const m = Math.round(S.money);
  if(mEl){
    mEl.textContent = fmt(m);
    if(lastMoney != null && m !== lastMoney){
      mEl.classList.remove('flash-up','flash-down');
      void mEl.offsetWidth;
      mEl.classList.add(m > lastMoney ? 'flash-up' : 'flash-down');
    }
  }
  lastMoney = m;
  const stEl = $('h-stamina');
  if(stEl) stEl.textContent = `${Math.round(S.life.attrs.stamina)}/${Math.round(staminaCeiling())}`;
  const dEl = $('h-day'); if(dEl) dEl.textContent = S.life.day;
  const aEl = $('h-age'); if(aEl) aEl.textContent = S.life.age;
}

/* ---------- 生活页 ---------- */
function renderLife(){
  const a = S.life.attrs;
  const ceil = staminaCeiling();
  const set = (id, v) => { const el = $(id); if(el) el.textContent = v; };
  set('a-stamina', Math.round(a.stamina)); set('a-staminamax', Math.round(ceil));
  set('a-mood', Math.round(a.mood)); set('a-skill', Math.round(a.skill)); set('a-charm', Math.round(a.charm));
  set('a-satiety', Math.round(a.satiety)); set('a-health', Math.round(a.health));
  const bar = (id, pct) => { const el = $(id); if(el) el.style.width = Math.max(0, Math.min(100, pct)) + '%'; };
  bar('bar-stamina', a.stamina / ceil * 100);
  bar('bar-mood', a.mood);
  bar('bar-skill', a.skill);
  bar('bar-charm', a.charm);
  bar('bar-satiety', a.satiety);
  bar('bar-health', a.health);
  const moodCard = $('attr-mood-card'); if(moodCard) moodCard.classList.toggle('low', a.mood < LIFE.MOOD_LOW);
  const stCard = $('attr-stamina-card'); if(stCard) stCard.classList.toggle('low', a.stamina < 25);
  const satCard = $('attr-satiety-card'); if(satCard) satCard.classList.toggle('low', a.satiety < LIFE.SATIETY_LOW);
  const hpCard = $('attr-health-card'); if(hpCard) hpCard.classList.toggle('low', a.health < LIFE.HEALTH_LOW);
  // 时间格点阵（今日剩余）：格尽即自动收工，玩家一眼看到还剩多少事能做
  const track = $('slot-track');
  if(track){
    const total = daySlots();
    const left = Math.max(0, Math.min(total, S.life.timeLeft || 0));
    track.innerHTML = Array.from({length: total}, (_, i) =>
      `<i class="${i < left ? 'on' : ''}"></i>`).join('');
    const stxt = $('slot-txt'); if(stxt) stxt.textContent = `${left}/${total} 格${S.life.sick ? '（病假半休）' : ''}`;
  }

  // 行动按钮：按职级 + 满好感同行卡重建（此后只刷禁用态）
  const barEl = $('act-bar');
  const duo = duoCards();
  const builtKey = `${S.life.tier}|${duo.map(c => c.uid).join(',')}|${S.life.day}`;
  if(barEl && barEl.dataset.built !== builtKey){
    barEl.dataset.built = builtKey;
    const unlocked = ACTIONS.filter(x => (x.tier||0) <= S.life.tier);
    const previews = S.life.tier < CAREERS.length - 1
      ? ACTIONS.filter(x => x.tier === S.life.tier + 1) : [];
    barEl.innerHTML = [
      ...unlocked.map(x => `
      <button class="act-btn" data-actbtn="${x.id}" title="${x.desc}">
        <div class="ic">${x.icon}</div>
        <div class="nm">${x.name}</div>
        <div class="cost">${costText(x)}</div>
        <div class="odds">${oddsOf(x) || ''}</div>
        <div class="desc">${x.desc}</div>
      </button>`),
      ...duo.map(c => `
      <button class="act-btn duo" data-actbtn="${c.id}" title="${c.desc}">
        <div class="ic">${c.icon}</div>
        <div class="nm">${c.name}</div>
        <div class="cost">🕒${DUO_SLOTS}格 ⚡-${DUO_STAMINA}</div>
        <div class="desc">${c.desc}</div>
      </button>`),
      ...previews.map(x => `
      <button class="act-btn locked" data-actbtn="${x.id}" disabled title="晋升「${CAREERS[x.tier].name}」后解锁">
        <div class="ic">🔒</div>
        <div class="nm">${x.name}</div>
        <div class="cost">晋升解锁</div>
        <div class="desc">${CAREERS[x.tier].icon} ${CAREERS[x.tier].name}</div>
      </button>`),
    ].join('');
    barEl.querySelectorAll('[data-actbtn]').forEach(b => b.onclick = () => onActionClick(b.dataset.actbtn));
  }
  barEl && barEl.querySelectorAll('[data-actbtn]').forEach(b => {
    if(b.closest('.locked')) return;
    b.disabled = !canDo(b.dataset.actbtn).ok;
    const oEl = b.querySelector('.odds');
    if(oEl){
      const x = ACTIONS.find(v => v.id === b.dataset.actbtn);
      oEl.textContent = x ? (oddsOf(x) || '') : '';
    }
  });
  const restHint = $('rest-hint');
  if(restHint) restHint.textContent = S.ending ? '本局已结束'
    : S.life.restUsed >= LIFE.REST_PER_DAY ? '今日已躺平'
    : `已躺平 ${S.life.restUsed}/${LIFE.REST_PER_DAY} 次`;

  renderSlotRow($('slot-row'), true);
  const chips = $('boost-chips');
  if(chips){
    const b = slotBoosts();
    const items = [];
    if(b.work) items.push(`💰 收入 +${Math.round(b.work*100)}%`);
    if(b.learn) items.push(`📖 学习 +${Math.round(b.learn*100)}%`);
    if(b.mood) items.push(`🎮 娱乐 +${Math.round(b.mood*100)}%`);
    if(b.charm) items.push(`✨ 魅力 +${Math.round(b.charm*100)}%`);
    if(b.staminaMax) items.push(`🔋 体力上限 +${Math.round(b.staminaMax)}`);
    chips.innerHTML = items.length ? items.map(t=>`<span class="boost-chip">${t}</span>`).join('')
      : '<span style="font-size:11px;color:var(--faint)">暂无随行伙伴加成</span>';
  }

  // 职业芯片：当前职级 + 晋升进度
  const cEl = $('career-txt');
  if(cEl){
    const cur = careerOf();
    const next = CAREERS[S.life.tier + 1];
    cEl.innerHTML = `${cur.icon} <b>${cur.name}</b> · 工作收入 ×${cur.mult}` +
      (next ? ` <span style="color:var(--faint)">→ ${next.icon}${next.name}（${reqText(S.life.tier + 1)}）</span>`
            : ` <span style="color:var(--gold)">已是行业顶点</span>`);
  }

  // 本周目标面板
  const gWrap = $('goals-list');
  if(gWrap){
    const gs = (S.life.goals && S.life.goals.items) || [];
    gWrap.innerHTML = gs.length ? gs.map(gi=>{
      const g = goalOf(gi.id); if(!g) return '';
      const cur = (S.life.weekStats || {})[g.stat] || 0;
      const pct = Math.round(goalProg(gi) * 100);
      return `<div class="goal-row${gi.done ? ' done' : ''}">
        <div class="goal-top"><span>${g.icon} ${g.label}</span><b>${Math.min(cur, g.target)}/${g.target}</b></div>
        <div class="goal-bar"><i style="width:${pct}%"></i></div>
        <div class="goal-rw">${gi.done ? '✓ 已达成' : '奖励：' + rewardText(g.reward)}</div>
      </div>`;
    }).join('') : '<div class="day-log-empty">本周暂无目标</div>';
  }

  // 日志流
  const log = $('day-log');
  if(log){
    const entries = dayLog();
    log.innerHTML = entries.length ? entries.map(e=>{
      const cls = (e.line.startsWith('🎲') || e.line.startsWith('⚖️') || e.line.startsWith('💞') || e.line.startsWith('🧭')) ? 'ev' : (e.line.startsWith('🏅') || e.line.startsWith('🎯') || e.line.startsWith('📆')) ? 'ms' : e.line.startsWith('🏁') ? 'end' : '';
      return `<div class="row ${cls}">${e.line}</div>`;
    }).join('') : '<div class="day-log-empty">新的一天，选个行动开始吧。</div>';
  }

  // 章节进度（一章 = 一年 = CHAPTER_DAYS 天）
  const ch = chapterIndex();
  const dayInChapter = (S.life.day - 1) % LIFE.CHAPTER_DAYS + 1;
  const totalDays = CHAPTER_TOTAL * LIFE.CHAPTER_DAYS;
  const pbar = $('life-progress-bar');
  if(pbar) pbar.style.width = Math.min(100, (S.life.day - 1) / totalDays * 100) + '%';
  const ptxt = $('life-progress-txt');
  if(ptxt) ptxt.textContent = S.ending ? `已结算：${S.ending.title}`
    : `第 ${ch + 1}/${CHAPTER_TOTAL} 章《${CHAPTER_TITLES[ch] || ''}》· 本年第 ${dayInChapter}/${LIFE.CHAPTER_DAYS} 天`;
  const atxt = $('life-age-txt');
  if(atxt) atxt.textContent = `${S.life.age} / ${LIFE.RETIRE_AGE} 岁${S.ng > 0 ? ` · NG+${S.ng > 1 ? S.ng : ''}` : ''}`;
  const wc = $('week-cost'); if(wc) wc.textContent = fmt(houseOf(S).rent + livingCost(S));
  const gw = $('grace-weeks'); if(gw) gw.textContent = LIFE.GRACE_WEEKS;
}

/** 行动卡概率公示（工作类=成功率；考证=通过率；其余行动确定性收益不显示） */
function oddsOf(x){
  const a = S.life.attrs;
  if(x.exam) return `通过率 ${Math.round(examRate(a.skill, a.mood) * 100)}%`;
  if(x.id === 'work' || x.workMult) return `成功率 ${Math.round(workSuccessRate(a.skill, a.mood, x.riskMul || 1) * 100)}%`;
  return null;
}

/* 数值展示：定值与 [min,max] 区间统一成文本（区间用 ~ 连接） */
const rng = v => Array.isArray(v) ? `${v[0]}~${v[1]}` : `${v}`;

function costText(x){
  const parts = [];
  if(x.slots) parts.push(`🕒${x.slots}格`);
  if(x.stamina) parts.push(`⚡-${x.stamina}`);
  if(x.money) parts.push(`¥-${x.money}`);
  if(x.recover) parts.push(`⚡+${rng(x.recover)}`);
  if(x.skill) parts.push(`🧠+${rng(x.skill)}`);
  if(x.fee) parts.push(`💰${rng(x.fee)}`);
  if(x.mood && (Array.isArray(x.mood) ? x.mood[1] > 0 : x.mood > 0)) parts.push(`🌤+${rng(x.mood)}`);
  if(x.charm) parts.push(`✨+${rng(x.charm)}`);
  if(x.satiety) parts.push(`🍚+${rng(x.satiety)}`);
  if(x.health) parts.push(`❤️${rng(x.health)}`);
  return parts.join(' ') || '免费';
}

/* ---------- 随行槽（生活页 + 伙伴页共用） ---------- */
export function renderSlotRow(el, compact){
  if(!el) return;
  el.innerHTML = S.slots.map((uid, i)=>{
    const p = S.partners.find(x => x.uid === uid);
    if(!p) return `<div class="slot-box" data-slot-open="${i}"><div class="empty">空槽位<br /><small>点击去编排</small></div></div>`;
    const m = MMAP[p.m];
    const r = RARITY[m.r];
    return `<div class="slot-box" data-slot-open="${i}" style="border-style:solid;border-color:${r.hex}">
      <span class="p-rr" style="color:${r.hex}">${m.r}</span>
      <div style="text-align:center"><div class="p-nm">${m.name}</div></div>
      <span class="p-fv">💖${p.favor}</span>
    </div>`;
  }).join('');
}

/* ---------- 伙伴页 ---------- */
function renderPartners(){
  const grid = $('partner-grid');
  const empty = $('partner-empty');
  if(!grid) return;
  if(empty) empty.hidden = S.partners.length > 0;
  const total = $('partner-total');
  if(total){
    const best = bestPartner();
    total.textContent = `${S.partners.length} 位伙伴${best ? ` · 最强：${MMAP[best.m].name}` : ''}`;
  }
  const hint2 = $('slot2-hint');
  if(hint2) hint2.textContent = `${S.slots.filter(Boolean).length}/3`;
  renderSlotRow($('slot-row-2'));
  grid.innerHTML = S.partners.map(p=>{
    const m = MMAP[p.m];
    const r = RARITY[m.r];
    const eff = effectOf(m);
    const effLabel = ({work:'💰 接单收入', learn:'📖 学习效率', mood:'🎮 娱乐心情', stamina:'🔋 体力上限', charm:'✨ 社交魅力', dual:'🌟 全能'})[eff] || eff;
    const slotIdx = S.slots.indexOf(p.uid);
    const next = favorNext(p);
    const fvMax = 90;
    return `<div class="pcard${slotIdx >= 0 ? ' inslot' : ''}${p.stars ? ' starred' : ''}" style="--rc:${r.hex}">
      ${slotIdx >= 0 ? `<span class="slot-tag">随行 ×${slotIdx + 1}</span>` : ''}
      ${p.stars ? `<span class="star-tag">★${p.stars}</span>` : ''}
      <div id="p-icon-${p.uid}"></div>
      <div class="nm">${m.name}</div>
      <div class="vd">${m.vendor} · ${m.cost}</div>
      <div class="idx">指数 ${m.idx} · ${m.spd} tok/s</div>
      <div class="eff">${effLabel}</div>
      <div class="fv-bar"><i style="width:${Math.min(100, p.favor / fvMax * 100)}%"></i></div>
      <div class="fv-txt">好感 ${p.favor}${next != null ? ` · 下一级 ${next}` : ' · 满级'}</div>
      <div class="act-row">
        ${[0,1,2].map(i=>`<button class="mini-btn${S.slots[i] === p.uid ? ' on' : ''}" data-act="slot" data-slot="${i}" data-uid="${p.uid}">${i + 1} 号位</button>`).join('')}
      </div>
    </div>`;
  }).join('');
  // 图标异步加载
  for(const p of S.partners){
    const holder = $('p-icon-' + p.uid);
    if(holder) holder.appendChild(iconImg(MMAP[p.m].icon, 'p-ic'));
  }
}

/* ---------- 背包页 ---------- */
function renderBag(){
  const grid = $('item-grid');
  if(!grid) return;
  const empty = $('item-empty');
  if(empty) empty.hidden = S.items.length > 0;
  const total = $('bag-total');
  if(total) total.textContent = `${S.items.reduce((s,x)=>s+x.qty,0)} 件道具`;
  grid.innerHTML = S.items.map(x=>{
    const it = itemOf(x.id);
    const r = RARITY[it.r];
    return `<div class="item-card" style="--rc:${r.hex}">
      <span class="rt">${it.r}</span>
      <span class="qty">×${x.qty}</span>
      <div class="ic">${it.icon}</div>
      <div class="nm">${it.name}</div>
      <div class="desc">${it.desc}</div>
      <button class="use-btn" data-act="use-item" data-item="${it.id}">使用</button>
    </div>`;
  }).join('');
}

/* ---------- 数据页 ---------- */
function renderData(){
  // 成就墙
  const grid = $('achieve-grid');
  if(grid){
    const got = MILESTONES.filter(m => S.flags.ms[m.id]).length;
    const prog = $('achieve-progress');
    if(prog) prog.textContent = `${got}/${MILESTONES.length}`;
    grid.innerHTML = MILESTONES.map(m=>{
      const on = !!S.flags.ms[m.id];
      let sub = m.tag;
      if(!on && m.check){
        const pct = Math.round(Math.min(1, m.check(S)) * 100);
        sub = `${m.tag} · ${pct}%`;
      }
      return `<div class="achieve-card ${on ? 'unlocked' : 'locked'}">
        <div class="ac-title">${m.title}</div>
        <div class="ac-tag">${sub}</div>
        <div class="ac-hype">${on ? m.hype : '???'} </div>
      </div>`;
    }).join('');
  }
  // 收支
  const ledger = $('ledger-list');
  if(ledger){
    ledger.innerHTML = S.ledger.length ? S.ledger.map(e=>
      `<div class="lrow"><span class="lab"><small>D${e.day}</small>${e.label}</span>
       <span class="amt ${e.amt >= 0 ? 'pos' : 'neg'}">${e.amt >= 0 ? '+' : ''}${fmt(e.amt)}</span></div>`).join('')
      : '<div class="ledger-empty">还没有收支记录</div>';
  }
  // 统计
  const stats = $('stat-grid');
  if(stats){
    const dexCount = Object.keys(S.dex).length;
    const cells = [
      ['累计收入', fmt(S.stats.earned), 'var(--green)'],
      ['累计支出', fmt(S.stats.spent), 'var(--red)'],
      ['打工次数', `${S.stats.workDays} 次`, ''],
      ['抽卡次数', `${S.stats.pulls} 次`, ''],
      ['大成功', `${S.stats.greats} 次`, 'var(--gold)'],
      ['生产事故', `${S.stats.disasters} 次`, 'var(--red)'],
      ['伙伴图鉴', `${dexCount}/${MODELS.length}`, ''],
      ['当前评分', `${ENDINGS.length ? '' : ''}${endingScorePreview()}`, 'var(--cyan)'],
    ];
    stats.innerHTML = cells.map(([lb, vl, c])=>
      `<div class="cell"><div class="lb">${lb}</div><div class="vl" style="${c ? `color:${c}` : ''}">${vl}</div></div>`).join('');
  }
  const vs = $('validate-status');
  if(vs) vs.textContent = validateResult.ok
    ? `✓ config 校验通过 · ${MODELS.length} 张卡 · ${ITEMS.length} 种道具 · 本地存档 llmlife_v2`
    : `✗ config 校验失败: ${validateResult.errors[0] || ''}`;
}

function endingScorePreview(){
  const score = endingScore(S, slotBoosts().staminaMax);
  const tier = [...ENDINGS].reverse().find(e => score >= e.min) || ENDINGS[ENDINGS.length - 1];
  return `${score}（${tier.title.replace(/^\S+\s/, '')}）`;
}

/* ---------- 卡池页 ---------- */
function renderGacha(){
  const wrap = $('pool-cards');
  if(!wrap) return;
  const countdown = bannerCountdownText();
  wrap.innerHTML = Object.entries(POOLS).map(([k,p])=>{
    const isItem = !!p.isItem;
    const rates = ['N','R','SR','SSR','UR','UTR'].filter(r => p.rates[r]);
    const pityMax = p.pityMax || PITY_MAX;
    const pity = S.pity[k] || 0;
    const featured = (p.featured||[]).slice(0,5).map(id=>{
      const name = isItem ? (ITEMS.find(i=>i.id===id)||{}).name || id : (MMAP[id]||{}).name || id;
      return `<span class="featured-chip">${name}</span>`;
    }).join('');
    const freeTag = (k==='partner' && S.freePulls>0) ? `<span class="free-tag">免费券 ×${S.freePulls}</span>` : '';
    return `<div class="pool-card${p.banner ? ' rec' : ''}">
      <div class="accent" style="--pc:${p.color}"></div>
      <div class="pool-body">
        <div class="pool-name">${p.name}</div>
        <div class="pool-sub">${p.sub}</div>
        ${p.banner ? `<div class="pool-sub" style="color:${p.color};font-weight:700">⏳ ${countdown}</div>` : ''}
        <div class="pool-price"><b>¥${p.price}</b><span>/单抽</span><b style="margin-left:10px">¥${p.tenPrice}</b><span>/十连</span></div>
        <div class="featured-row">${featured}<span>池内代表</span></div>
        <div class="rates-bar">${rates.map(r=>`<i style="width:${(p.rates[r]*100).toFixed(1)}%;background:${RARITY[r].hex}"></i>`).join('')}</div>
        <div class="rates-legend">${rates.map(r=>`<span><b style="color:${RARITY[r].hex}">${r}</b> ${(p.rates[r]*100).toFixed(1)}%</span>`).join('')}</div>
        <div class="pity-row"><span>保底</span><div class="pity-bar"><i style="width:${Math.min(100, pity/pityMax*100)}%"></i></div><span>${pity}/${pityMax}</span></div>
        <div class="pool-btns">
          <button class="pull-btn p1" data-pull="${k}" data-n="1">单抽<small>¥${p.price}</small>${freeTag}</button>
          <button class="pull-btn p10" data-pull="${k}" data-n="10">十连<small>¥${p.tenPrice}</small></button>
        </div>
        <div class="pool-note">${p.note}</div>
      </div>
    </div>`;
  }).join('');
}

/* ---------- 行动点击（living 逻辑内联：渲染层持有按钮绑定） ---------- */
let actionHandler = null;
export function setActionHandler(fn){ actionHandler = fn; }
function onActionClick(id){ if(actionHandler) actionHandler(id); }

/* ---------- 资产页：净资产格 / 住房升级链 / 行情持仓 ---------- */
function renderAssets(){
  const cells = $('nw-cells'); if(!cells) return;
  const house = houseOf(S);
  const holdVal = holdingsValue();
  const houseEq = Math.round(house.cost * HOUSE_EQUITY);
  const net = Math.round(assetsOf(S));
  const nw = $('net-worth-txt'); if(nw) nw.textContent = fmt(net);
  cells.innerHTML =
    `<div class="nw-cell"><i>现金</i><b>${fmt(S.money)}</b></div>` +
    `<div class="nw-cell"><i>持仓市值</i><b>${fmt(holdVal)}</b></div>` +
    `<div class="nw-cell"><i>房产净值</i><b>${fmt(houseEq)}</b></div>` +
    `<div class="nw-cell total"><i>净资产合计</i><b>${fmt(net)}</b></div>`;
  const hz = $('house-zone');
  if(hz){
    const cur = S.life.house || 0;
    hz.innerHTML = HOUSES.map((h,i)=>{
      const owned = i <= cur;
      const isCur = i === cur;
      const isNext = i === cur + 1;
      const afford = isNext && S.money >= h.cost;
      const tag = isCur ? '<span class="h-tag cur">现住</span>' : (owned ? '<span class="h-tag">已置</span>' : '');
      const btn = isNext ? `<button class="mini-btn house-btn" data-act="house-buy" ${afford?'':'disabled'}>${afford?`首付 ${fmt(h.cost)} 升级`:`现金不足 · 需 ${fmt(h.cost)}`}</button>` : '';
      return `<div class="house-card ${isCur?'cur':''} ${owned&&!isCur?'old':''}">
        <div class="h-head">${h.icon} ${h.name}${tag}</div>
        <div class="h-stat">周支出 ${fmt(h.rent + LIFE.LIVING)} · 睡眠心情 +${h.mood} · 体力上限 +${h.sta}</div>
        <div class="h-desc">${h.desc}</div>${btn}</div>`;
    }).join('');
  }
  const mz = $('market-zone');
  if(mz){
    const m = S.market || {price:{}, hold:{}};
    mz.innerHTML = MARKET.map(t=>{
      const p = m.price[t.id] || t.base;
      const prev = (m.prev || {})[t.id];
      let chg = '';
      if(prev && prev !== p){
        const pct = (p - prev) / prev * 100;
        chg = `<span class="mkt-chg ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
      }
      const q = m.hold[t.id] || 0;
      const buys = STOCK_SLOTS.map(k=>`<button class="mini-btn" data-act="stock-buy" data-tid="${t.id}" data-q="${k}" ${S.money < k * p ? 'disabled' : ''}>买${k}</button>`).join('');
      const sells = q > 0 ? STOCK_SLOTS.filter(k=>k<=q).map(k=>`<button class="mini-btn sell" data-act="stock-sell" data-tid="${t.id}" data-q="${k}">卖${k}</button>`).join('') : '';
      return `<div class="mkt-row">
        <div class="mkt-id">${t.icon} <b>${t.name}</b><span class="mkt-desc">${t.desc}</span></div>
        <div class="mkt-px">${fmt(p)}${chg}</div>
        <div class="mkt-hold">持 ${q} 份 · <b>${fmt(q * p)}</b></div>
        <div class="mkt-btns">${buys}${sells}</div>
      </div>`;
    }).join('');
  }
}

/* ---------- 全量重渲 ---------- */
export function renderAll(){
  renderHeader();
  renderLife();
  renderPartners();
  renderBag();
  renderData();
  renderGacha();
  renderAssets();
}
