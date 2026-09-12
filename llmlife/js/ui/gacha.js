/* ================================================================
   LLMLife · 抽卡演出 (ui/gacha.js)
   支付守卫 → pulls.js 出货 → 翻牌演出（跳过/自动）→ 幻觉揭晓
   ================================================================ */
import { POOLS, RARITY, RORDER, MMAP, ITEMS } from "../config.js";
import { S, $, save, fmt, addLedger } from "../state.js";
import { SFX, burst, shake, iconImg, toast } from "../fx.js";
import { doPulls } from "../pulls.js";
import { favorAll } from "../partners.js";
import { showModal, closeModal, goldFlash } from "./modals.js";
import { renderAll } from "./render.js";
import { bannerCountdownText } from "../banner.js";

export let pulling = false;
let gachaResults = [], gachaEls = [], pendingHalluc = [];

/* ---------- 支付与入口 ---------- */
export function tryPull(poolKey, count){
  if(pulling) return;
  const p = POOLS[poolKey];
  if(!p) return;
  const useFree = poolKey === 'partner' && count === 1 && S.freePulls > 0;
  const cost = count === 10 ? p.tenPrice : p.price;
  if(!useFree && S.money < cost){ toast('💸 余额不足！先去「生活」打工赚钱'); SFX.bad(); return; }
  if(useFree){ S.freePulls--; addLedger('免费抽卡券 · 伙伴池单抽', 0); }
  else { S.money -= cost; S.stats.spent += cost; addLedger(`购买${p.name} ×${count}`, -cost); }
  SFX.pull();
  if(window.llTrack) window.llTrack('pull', {pool:poolKey, count, cost: useFree?0:cost});
  const results = doPulls(poolKey, count);
  save(); renderAll();
  showGacha(results, p);
}

/* ---------- 翻牌演出 ---------- */
const dispOf = r => r._halluc ? MMAP[r._halluc] : MMAP[r.id];

function showGacha(results, pool){
  pulling = true;
  gachaResults = results;
  const ov = $('overlay'), row = $('gacha-row');
  $('overlay-title').textContent = results.length > 1 ? `✨ ${pool.name} · 十连 ✨` : `✨ ${pool.name} · 单抽 ✨`;
  $('gacha-summary').classList.remove('show');
  $('close-overlay').classList.remove('show');
  row.innerHTML = ''; ov.classList.add('show');
  let skipped = false, flippedCount = 0;

  const els = results.map((res, i)=>{
    const isItem = res.kind === 'item';
    const m = isItem ? null : dispOf(res);          // 幻觉卡整体伪装（含稀有度），揭晓后重绑
    const r = RARITY[isItem ? res.rarity : m.r];
    const d = document.createElement('div');
    d.className = 'gcard' + (r.name==='NB' ? ' nb' : (r.name==='UR'||r.name==='UTR' ? ' ur' : ''));
    d.style.setProperty('--rc', r.hex);
    const face = isItem
      ? `<div class="rr">${r.name} · 道具</div>
         <div class="ic" style="font-size:clamp(24px,4vw,42px);line-height:1;margin:8px 0 6px">${itemIcon(res.id)}</div>
         <div class="nm">${itemName(res.id)}</div>
         <div class="vd">一次性道具</div>
         <div class="idx">杂物福袋</div>
         <div class="tk">🎁 开出即用</div>`
      : `<div class="rr">${r.name} · ${r.label}</div>
         <div class="ic"></div>
         <div class="nm">${m.name}</div>
         <div class="vd">${m.vendor}</div>
         <div class="idx">智能指数 ${m.idx}</div>
         <div class="tk">${m.cost} · ${m.spd} tok/s</div>`;
    d.innerHTML = `<div class="inner">
      <div class="face back"><div class="q">?</div><small>${pool.isItem ? '杂物福袋' : 'LLM 盲盒'}</small></div>
      <div class="face front">${face}</div>
    </div>`;
    if(!isItem){
      const icEl = d.querySelector('.ic');
      if(res.id === 'fihagv1'){ icEl.textContent = '🌈'; icEl.style.cssText = 'font-size:clamp(24px,4vw,42px);line-height:1;margin:8px 0 6px'; }
      else icEl.appendChild(iconImg(m.icon));
    }
    d.onclick = ()=>flipOne(i);
    row.appendChild(d);
    return d;
  });
  gachaEls = els;

  // 仅最佳音效一次
  let bestR = null, bestIsNB = false;
  for(const res of results){
    const rr = res.rarity;
    if(RORDER.indexOf(rr) > RORDER.indexOf(bestR || 'N')){ bestR = rr; bestIsNB = rr === 'NB'; }
  }
  let bestSfxPlayed = false;
  function playBestSfx(){
    if(bestSfxPlayed) return;
    bestSfxPlayed = true;
    if(bestIsNB) SFX.nb();
    else if(bestR==='SSR'||bestR==='UR'||bestR==='UTR') SFX.rarity(bestR);
  }

  function flipOne(i){
    try{
      const el = els[i];
      if(el.classList.contains('flipped')) return;
      el.classList.add('flipped','pop');
      flippedCount++;
      const res = results[i];
      const rr = res.kind === 'item' ? res.rarity : dispOf(res).r; // 演出按伪装档位走
      SFX.flip(i);
      if(rr==='NB'){
        setTimeout(()=>{
          goldFlash();
          const rect = el.getBoundingClientRect();
          burst(rect.left+rect.width/2, rect.top+rect.height/2, ['#ff2d55','#ffd700','#41d9ff','#7c3aed','#22c55e','#ff6ec7','#fff'], 220, 13);
          shake();
        }, 250);
      }else if(rr==='SSR'||rr==='UR'||rr==='UTR'){
        setTimeout(()=>{
          if(results[i]._halluc) goldFlash();
          const rect = el.getBoundingClientRect();
          burst(rect.left+rect.width/2, rect.top+rect.height/2,
            rr==='UTR' ? ['#ff2d55','#f59e0b','#2f6bff','#fff'] : (rr==='UR' ? ['#ff5f6d','#f59e0b','#2f6bff','#fff'] : ['#f59e0b','#fde68a','#fff']),
            rr==='UTR' ? 160 : (rr==='UR' ? 120 : 70), rr==='UTR' ? 11 : (rr==='UR' ? 9 : 7));
          if(rr==='UR'||rr==='UTR') shake();
        }, 250);
      }
      if(flippedCount >= results.length){
        setTimeout(playBestSfx, 260);
        finish();
      }
    }catch(err){
      console.error('[gacha] flip error', err);
      finish(); // 单卡演出异常也不能困住玩家
    }
  }

  if(S.flags.autoSkip){
    skipped = true;
    els.forEach((_, i)=>flipOne(i));
  }else{
    results.forEach((_, i)=>setTimeout(()=>{ if(!skipped) flipOne(i); }, 450 + i*380));
  }
  $('skip-btn').onclick = ()=>{ skipped = true; els.forEach((e, i)=>{ if(!e.classList.contains('flipped')) setTimeout(()=>flipOne(i), i*40); }); };

  function finish(){
    try{
      $('gacha-summary').innerHTML = summaryHTML(results);
    }catch(err){
      console.error('[gacha] summary error', err);
      $('gacha-summary').innerHTML = `共获得 <b>${results.length}</b> 个结果`;
    }
    $('gacha-summary').classList.add('show');
    $('close-overlay').classList.add('show');
    setTimeout(showHalluc, skipped ? 2400 : 650);
  }
  $('close-overlay').onclick = ()=>{ ov.classList.remove('show'); pulling = false; };
}

function summaryHTML(results){
  const partners = results.filter(r=>r.kind==='partner');
  const items = results.filter(r=>r.kind==='item');
  const parts = [`共获得 <b>${results.length}</b> 个结果`];
  if(items.length) parts.push(`道具 ×${items.length}`);
  if(partners.length){
    const best = partners.reduce((a,r)=> RORDER.indexOf(dispOf(r).r) > RORDER.indexOf(dispOf(a).r) ? r : a, partners[0]);
    const m = dispOf(best);
    parts.push(`最佳伙伴: <b style="color:${RARITY[m.r].hex}">${m.name}</b>（${m.r}）`);
    parts.push('重复伙伴自动折算好感');
  }
  return parts.join(' · ');
}

/* ---------- 道具卡面辅助（道具不走 MMAP） ---------- */
const ITEM_MAP = Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const itemName = id => (ITEM_MAP[id]||{}).name || id;
const itemIcon = id => (ITEM_MAP[id]||{}).icon || '🎁';

/* ---------- 幻觉揭晓 ---------- */
function showHalluc(){
  pendingHalluc = gachaResults.map((r, i)=> r._halluc ? {r, el:gachaEls[i]} : null).filter(Boolean);
  if(pendingHalluc.length){
    showModal(hallucHTML(pendingHalluc[0].r._halluc), true);
  }
}
function hallucHTML(fakeId){
  const fake = MMAP[fakeId];
  return `<h3>🤯 检测到模型幻觉<button class="x" onclick="closeModal()">×</button></h3>
  <p>你抽到的「<b>${fake.name}</b>」其实是模型一本正经地胡说八道——<b>纯纯的幻觉</b>。</p>
  <p>经系统鉴定：<b style="color:var(--blue)">实际结果为 R 档伙伴</b>，卡面已强制修正。</p>
  <p style="color:var(--faint)">为表歉意，全体随行伙伴好感 +10。</p>
  <button class="big-btn ghost" data-act="accept-halluc">接受现实 →</button>`;
}
export function acceptHalluc(){
  for(const {r, el} of pendingHalluc) rebindFace(el, r);
  if(pendingHalluc.length){
    favorAll(10);
    save();
    toast('🧠 幻觉已修正：实际为 R 档伙伴，随行全体好感 +10', 3200);
  }
  pendingHalluc = [];
  closeModal();
  renderAll();
}
function rebindFace(el, res){
  const m = MMAP[res.id], r = RARITY[m.r];
  el.classList.toggle('ur', m.r==='UR'||m.r==='UTR');
  el.style.setProperty('--rc', r.hex);
  el.querySelector('.rr').textContent = `${r.name} · ${r.label}`;
  el.querySelector('.nm').textContent = m.name;
  el.querySelector('.vd').textContent = m.vendor;
  el.querySelector('.idx').textContent = `智能指数 ${m.idx}`;
  el.querySelector('.tk').textContent = `${m.cost} · ${m.spd} tok/s`;
  const ic = el.querySelector('.ic'); ic.innerHTML = ''; ic.appendChild(iconImg(m.icon));
  delete res._halluc;
  el.classList.add('pop');
}
