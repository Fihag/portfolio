/* ================================================================
   LLMLife · 限定池轮换 (banner.js)
   三赛季自动轮换 · 100 抽大保底出当期神话 · 赛季倒计时
   ================================================================ */
import { POOLS, BANNER_SEASONS, BANNER_DUR, BANNER_EPOCH, LIMITED_IDS, LIMITED_ALL } from "./config.js";
import { S, save } from "./state.js";

// 当前赛季槽位: 从 BANNER_EPOCH 起每 BANNER_DUR 轮换一个赛季
export function bannerSlot(now){
  now = now ?? Date.now();
  const i = Math.max(0, Math.floor((now - BANNER_EPOCH) / BANNER_DUR));
  const idx = i % BANNER_SEASONS.length;
  return { season: BANNER_SEASONS[idx], start: BANNER_EPOCH + i*BANNER_DUR, end: BANNER_EPOCH + (i+1)*BANNER_DUR, i };
}

// 同步 POOLS.banner 到当前赛季; 赛季切换时重置该池保底
// 返回 true 表示发生了切换(调用方据此重渲染)
export function syncBanner(){
  const slot = bannerSlot();
  const p = POOLS.banner;
  let switched = false;
  if(p._seasonId !== slot.season.id || p._end !== slot.end){
    Object.assign(p, slot.season);
    p._seasonId = slot.season.id;
    p._end = slot.end;
    switched = true;
  }
  // 当前赛季限定卡集合
  const cur = [...LIMITED_IDS].slice().sort().join(',');
  const want = slot.season.limited.slice().sort().join(',');
  if(cur !== want){
    LIMITED_IDS.clear();
    slot.season.limited.forEach(id => LIMITED_IDS.add(id));
    slot.season.limited.forEach(id => LIMITED_ALL.add(id));
    switched = true;
  }
  if(switched && S.bannerSeason !== slot.season.id){
    S.pity.banner = 0;
    S.bannerSeason = slot.season.id;
    save();
  }
  return switched;
}

export function bannerCountdownText(){
  const p = POOLS.banner;
  if(!p || !p._end) return '';
  const ms = p._end - Date.now();
  if(ms <= 0) return '轮换中…';
  const d = Math.floor(ms/86400000), h = Math.floor(ms%86400000/3600000), m = Math.floor(ms%3600000/60000);
  return d > 0 ? `${p.name} 剩余 ${d}天${h}小时` : `${p.name} 剩余 ${h}小时${m}分`;
}
