/* ================================================================
   LLMLife · 数据层 (config.js)
   稀有度依据 Artificial Analysis Intelligence Index v4.3 分段重标
   （v4.3 相对 v4.1.1 非均匀压缩 ×0.64~0.80，tokengacha 旧分段作废）
   图标: @lobehub/icons (unpkg + npmmirror 双 CDN 兜底)
   ================================================================ */

/**
 * @typedef {'N'|'R'|'SR'|'SSR'|'UR'|'UTR'|'NB'} Rarity
 * @typedef {Object} Model
 * @property {string} id - 唯一标识（= AA slug）
 * @property {string} name - 显示名
 * @property {string} vendor - 厂商（= AA creatorName 原文）
 * @property {string|null} icon - @lobehub/icons slug（null = 首字母方块兜底）
 * @property {number} idx - 智能指数（v4.3 真实分）
 * @property {Rarity} r - 稀有度（由分数落档）
 * @property {boolean} [bannerOnly] - 仅限定池可出
 * @property {string} cost - 卡面标价（$/M 输出 token，开源卡标"开源"）
 * @property {number} spd - 出字速度 tok/s
 * @property {string} quote - 趣味文案
 * @typedef {Record<Rarity, {name:string,label:string,hex:string,min:number,max:number}>} RarityMap
 * @typedef {Record<string, {name:string,sub:string,color:string,price:number,tenPrice:number,pityMax?:number,rates:Partial<Record<Rarity,number>>,banner?:boolean,note:string,featured:string[],limited?:string[]}>} PoolMap
 */

/* ---------- 模型数据（标记区由 tools/build-roster.mjs 生成） ---------- */
/** @type {Model[]} */
export const MODELS = [
/* ==== MODELS:BEGIN (tools/build-roster.mjs 生成 — 勿手改)
   数据源: aa_intelligence_index.json · indexVersion v4.3 · fetchedAt 2026-09-12T15:31:04.845Z
   生成 54 张: UTR×6 UR×6 SSR×9 SR×8 R×10 N×15 + NB 彩蛋(手写)
   名单/文案人工源: 本文件 CURATED 表；榜单更新后重跑 node tools/build-roster.mjs ==== */
  {id:"claude-fable-5-1", name:"Claude Fable 5.1", vendor:"Anthropic", icon:"claude-color", idx:53.37, r:"UTR", bannerOnly:true, cost:"$50.00/M出", spd:103, quote:"限定·v4.3 重标后 53.4 分全场登基。写作 Fable，读作「每月自发更新」"},
  {id:"gpt-6-astra", name:"GPT-6 Astra", vendor:"OpenAI", icon:"openai", idx:52.81, r:"UTR", bannerOnly:true, cost:"$50.00/M出", spd:55, quote:"限定·52.8 分的星空旗舰，Astra 是星，价格也是天文数字"},
  {id:"claude-opus-5", name:"Claude Opus 5", vendor:"Anthropic", icon:"claude-color", idx:50.7, r:"UTR", cost:"$25.00/M出", spd:81, quote:"63 分时代的榜一，重定标后依然前十——瘦死的骆驼比马大"},
  {id:"claude-fable-5", name:"Claude Fable 5", vendor:"Anthropic", icon:"claude-color", idx:49.7, r:"UTR", cost:"$50.00/M出", spd:107, quote:"上一代传奇，自带 Opus 4.8 备胎上场，家族内卷第一名"},
  {id:"muse-spark-1-3", name:"Muse Spark 1.3", vendor:"Meta", icon:"meta-color", idx:48.17, r:"UTR", bannerOnly:true, cost:"$4.25/M出", spd:223, quote:"限定·48.2 分还能跑 223 tok/s，4.25 刀/M，性价比神话"},
  {id:"gpt-5-6-sol", name:"GPT-5.6 Sol", vendor:"OpenAI", icon:"openai", idx:47.06, r:"UTR", cost:"$20.00/M出", spd:60, quote:"Sol 是太阳，照到哪里哪里亮，就是账单也亮"},
  {id:"glm-5-3", name:"GLM-5.3", vendor:"Z AI", icon:"zai", idx:44.86, r:"UR", cost:"$4.40/M出", spd:76, quote:"后训练仙人正统续作，44.9 分开源天花板，4.4 刀/M 比良心还便宜"},
  {id:"grok-4-6-xhigh", name:"Grok 4.6", vendor:"SpaceXAI", icon:"grok", idx:44.27, r:"UR", cost:"$6.00/M出", spd:53, quote:"马斯克：这次真的是地表最强（xhigh 档），下次一定还是这句"},
  {id:"kimi-k3", name:"Kimi K3", vendor:"Kimi", icon:"moonshot", idx:43.78, r:"UR", cost:"$15.00/M出", spd:42, quote:"月之暗面杀进 UR，国产之光 +1，就是 42 tok/s 有点慢性子"},
  {id:"gpt-5-6-terra", name:"GPT-5.6 Terra", vendor:"OpenAI", icon:"openai", idx:42.25, r:"UR", cost:"$12.00/M出", spd:93, quote:"Terra 是大地，稳重输出型选手，速度智商两开花"},
  {id:"claude-opus-4-8", name:"Claude Opus 4.8", vendor:"Anthropic", icon:"claude-color", idx:41.99, r:"UR", cost:"$25.00/M出", spd:89, quote:"Fable 5 的御用备胎，戏份不多但每场都在"},
  {id:"glm-5-3-flash", name:"GLM-5.3-Flash", vendor:"Z AI", icon:"zai", idx:41.91, r:"UR", cost:"$0.50/M出", spd:120, quote:"0.5 刀/M 的闪电仙人，120 tok/s，白嫖党与生产环境共同的挚爱"},
  {id:"gemini-3-8-flash", name:"Gemini 3.8 Flash", vendor:"Google", icon:"gemini-color", idx:41.19, r:"SSR", cost:"$3.75/M出", spd:278, quote:"278 tok/s 的谷歌闪电侠，3.75 刀/M，闪得你看不清扣费明细"},
  {id:"claude-opus-4-7", name:"Claude Opus 4.7", vendor:"Anthropic", icon:"claude-color", idx:40.69, r:"SSR", cost:"$25.00/M出", spd:76, quote:"4.8 的哥哥，5 的叔叔，Claude 家族族谱最忙碌的一支"},
  {id:"qwen3-8-max", name:"Qwen3.8 Max", vendor:"Alibaba", icon:"qwen-color", idx:40.3, r:"SSR", cost:"$6.00/M出", spd:46, quote:"通义顶配 Max，阿里含泪开源的排面担当"},
  {id:"qwen3-8-2-4t-a95b", name:"Qwen3.8 2.4T A95B", vendor:"Alibaba", icon:"qwen-color", idx:40.04, r:"SSR", cost:"$6.00/M出", spd:46, quote:"2.4 万亿参数 95B 激活，名字比卡面还长"},
  {id:"qwen3-8-flash-next", name:"Qwen3.8-Flash-Next", vendor:"Alibaba", icon:"qwen-color", idx:39.91, r:"SSR", cost:"$0.47/M出", spd:61, quote:"0.47 刀/M 的下一代 Flash，性价比卷到没有对手"},
  {id:"muse-spark-1-2", name:"Muse Spark 1.2", vendor:"Meta", icon:"meta-color", idx:39.8, r:"SSR", cost:"$4.25/M出", spd:185, quote:"上一代缪斯，1.3 出来后主动让出 C 位"},
  {id:"deepseek-v4-1-flash", name:"DeepSeek V4.1 Flash", vendor:"DeepSeek", icon:"deepseek-color", idx:39.55, r:"SSR", cost:"$1.20/M出", spd:285, quote:"0910 刚发布的新秀，1.2 刀/M 跑 285 tok/s，性价比正统"},
  {id:"gemini-3-7-flash", name:"Gemini 3.7 Flash", vendor:"Google", icon:"gemini-color", idx:39.43, r:"SSR", cost:"$3.75/M出", spd:289, quote:"3.6 → 3.7 → 3.8，谷歌把 Flash 系列做成了连续剧"},
  {id:"grok-4-5", name:"Grok 4.5", vendor:"SpaceXAI", icon:"grok", idx:39.08, r:"SSR", cost:"$6.00/M出", spd:54, quote:"4.6 的前传，马斯克：地表最强（上一代）"},
  {id:"gpt-5-4", name:"GPT-5.4", vendor:"OpenAI", icon:"openai", idx:38.98, r:"SR", cost:"$15.00/M出", spd:135, quote:"5.5 的哥哥，重定标受害者联盟荣誉会员"},
  {id:"gpt-5-5", name:"GPT-5.5", vendor:"OpenAI", icon:"openai", idx:38.63, r:"SR", cost:"$30.00/M出", spd:80, quote:"发布时 56 分的 UR，重定标后 38.6 分守 SR——分数没变，是天变了"},
  {id:"claude-sonnet-5", name:"Claude Sonnet 5", vendor:"Anthropic", icon:"claude-color", idx:38.36, r:"SR", cost:"$10.00/M出", spd:122, quote:"打工人标配，Opus 太贵时的体面选择"},
  {id:"gpt-5-6-luna", name:"GPT-5.6 Luna", vendor:"OpenAI", icon:"openai", idx:37.5, r:"SR", cost:"$1.20/M出", spd:113, quote:"Luna 是月亮，1.2 刀/M 静静发光，价格也温柔"},
  {id:"deepseek-v4-pro", name:"DeepSeek V4 Pro 0813", vendor:"DeepSeek", icon:"deepseek-color", idx:36.28, r:"SR", cost:"$3.96/M出", spd:87, quote:"开源上桌的中坚力量，定价是门艺术"},
  {id:"agnes-3-0-flash", name:"Agnes 3.0 Flash", vendor:"Sapiens AI", icon:null, idx:35.5, r:"SR", cost:"$0.15/M出", spd:307, quote:"0.15 刀/M 全场最便宜一档，Agnes 家族的黑马"},
  {id:"agnes-2-5-pro-beta", name:"Agnes 2.5 Pro", vendor:"Sapiens AI", icon:null, idx:35.24, r:"SR", cost:"$0.30/M出", spd:0, quote:"Beta 还在跑，3.0 已经发布——家族内卷 ×2"},
  {id:"deepseek-v4-flash-vision", name:"DeepSeek V4 Flash Vision", vendor:"DeepSeek", icon:"deepseek-color", idx:35.01, r:"SR", cost:"$1.32/M出", spd:263, quote:"带眼睛的 Flash，多模态白菜价"},
  {id:"deepseek-v4-flash", name:"DeepSeek V4 Flash 0731", vendor:"DeepSeek", icon:"deepseek-color", idx:34.53, r:"R", cost:"$1.32/M出", spd:276, quote:"0731 老兵，v4.1.1 时代 52 分 SSR，重定标后跌进 R 档——见证历史"},
  {id:"gemini-3-6-flash", name:"Gemini 3.6 Flash", vendor:"Google", icon:"gemini-color", idx:34.34, r:"R", cost:"$3.75/M出", spd:210, quote:"Flash 连续剧第三季，剧情开始重复"},
  {id:"muse-spark-1-1", name:"Muse Spark 1.1", vendor:"Meta", icon:"meta-color", idx:34.27, r:"R", cost:"$4.25/M出", spd:0, quote:"缪斯初代目，粉丝口中「最有力的一版」"},
  {id:"glm-5-2", name:"GLM-5.2", vendor:"Z AI", icon:"zai", idx:34.01, r:"R", cost:"$4.40/M出", spd:80, quote:"仙人前传的前传，53 分时代是 SSR，如今在 R 档发光发热"},
  {id:"qwen3-8-27b", name:"Qwen3.8 27B", vendor:"Alibaba", icon:"qwen-color", idx:33.9, r:"R", cost:"$3.00/M出", spd:51, quote:"27B 开源小钢炮，本地部署党的无限火力"},
  {id:"motif-3", name:"Motif 3", vendor:"Motif Technologies", icon:null, idx:33.57, r:"R", cost:"开源", spd:0, quote:"匿名研究室的神秘作品，榜上有名但查无此人"},
  {id:"gemini-3-5-flash", name:"Gemini 3.5 Flash", vendor:"Google", icon:"gemini-color", idx:32.98, r:"R", cost:"$9.00/M出", spd:221, quote:"Flash 连续剧第二季，已经没人记得第一季"},
  {id:"gpt-5-3-codex", name:"GPT-5.3 Codex", vendor:"OpenAI", icon:"openai", idx:32.5, r:"R", cost:"$14.00/M出", spd:124, quote:"专精写代码的分支，改 bug 依旧靠运气"},
  {id:"kimi-k2-6", name:"Kimi K2.6", vendor:"Kimi", icon:"moonshot", idx:31.32, r:"R", cost:"$4.00/M出", spd:43, quote:"K3 的弟弟，重定标后和哥哥隔了一个宇宙"},
  {id:"muse-spark", name:"Muse Spark", vendor:"Meta", icon:"meta-color", idx:31.3, r:"R", cost:"开源", spd:0, quote:"缪斯零代目，收藏价值大于实用价值"},
  {id:"deepseek-v4-pro-0424", name:"DeepSeek V4 Pro 0424", vendor:"DeepSeek", icon:"deepseek-color", idx:30.87, r:"N", cost:"$0.87/M出", spd:80, quote:"0424 老版本，API 下架前最后的高光"},
  {id:"k2-horizon-375b-a23b", name:"K2 Horizon 375B", vendor:"MBZUAI Institute of Foundation Models", icon:null, idx:30.7, r:"N", cost:"开源", spd:0, quote:"375B 参数 23B 激活，名字长到卡面放不下"},
  {id:"claude-sonnet-4-6-adaptive", name:"Claude Sonnet 4.6", vendor:"Anthropic", icon:"claude-color", idx:30.45, r:"N", cost:"$15.00/M出", spd:66, quote:"Adaptive 变形金刚版，聪明是聪明，就是辈分有点乱"},
  {id:"gpt-5-2", name:"GPT-5.2", vendor:"OpenAI", icon:"openai", idx:30.45, r:"N", cost:"$14.00/M出", spd:71, quote:"曾经的旗舰，如今在 N 档教新模型做人"},
  {id:"apodex-1-1", name:"Apodex 1.1", vendor:"Apodex", icon:null, idx:30.37, r:"N", cost:"$3.00/M出", spd:0, quote:"又一家新厂商，行业门槛：起个没人听过的名字"},
  {id:"gemini-3-1-pro-preview", name:"Gemini 3.1 Pro", vendor:"Google", icon:"gemini-color", idx:30.36, r:"N", cost:"$12.00/M出", spd:111, quote:"Preview 了一辈子，也没等来正式版"},
  {id:"qwen3-7-max", name:"Qwen3.7 Max", vendor:"Alibaba", icon:"qwen-color", idx:29.87, r:"N", cost:"$7.50/M出", spd:169, quote:"上一代通义顶配，退休返聘中"},
  {id:"minimax-m3", name:"MiniMax-M3", vendor:"MiniMax", icon:"minimax-color", idx:29.61, r:"N", cost:"$1.20/M出", spd:93, quote:"海螺家的 M3，名字很 Mini，参数可不 Mini"},
  {id:"claude-opus-4-5-thinking", name:"Claude Opus 4.5", vendor:"Anthropic", icon:"claude-color", idx:29.1, r:"N", cost:"$25.00/M出", spd:58, quote:"2025 年的 45 分神话，2026 年的 N 档化石"},
  {id:"mimo-v2-pro", name:"MiMo-V2-Pro", vendor:"Xiaomi", icon:"xiaomimimo", idx:28.64, r:"N", cost:"开源", spd:0, quote:"雷军家的 Pro，为发烧而生"},
  {id:"qwen3-6-max", name:"Qwen3.6 Max Preview", vendor:"Alibaba", icon:"qwen-color", idx:28.37, r:"N", cost:"$7.80/M出", spd:67, quote:"Preview 家族再添一员"},
  {id:"gemini-3-pro", name:"Gemini 3 Pro", vendor:"Google", icon:"gemini-color", idx:27.96, r:"N", cost:"$12.00/M出", spd:0, quote:"27.9 分的前顶配，Preview 之名贯彻始终"},
  {id:"glm-5", name:"GLM-5", vendor:"Z AI", icon:"zai", idx:27.91, r:"N", cost:"$3.20/M出", spd:75, quote:"仙人出道作，如今在 N 档带新人"},
  {id:"gpt-5-1", name:"GPT-5.1", vendor:"OpenAI", icon:"openai", idx:24.74, r:"N", cost:"$10.00/M出", spd:103, quote:"v4.1.1 时代 37.5 分，重定标后 24.7 分——跌得最惨的一集"},
  {id:"gpt-5", name:"GPT-5", vendor:"OpenAI", icon:"openai", idx:22.98, r:"N", cost:"$10.00/M出", spd:83, quote:"2025 年的皇帝，博物馆新馆长"},
/* ==== MODELS:END ==== */
  // NB —— 作者自研, 全池 0.01% 隐藏神卡 (手写区, 不随榜单重生成)
  {id:'fihagv1', name:'Fihag V1', vendor:'作者自研', icon:'fihagv1', idx:100, r:'NB', cost:'$0/M出', spd:999, quote:'作者亲自下场，全站唯一 NB 级存在，抽到就是天选之卡'},
];
export const MMAP = Object.fromEntries(MODELS.map(m=>[m.id,m]));

/* ---------- 稀有度分段 (v4.3 重标定; 分档边界与 tools/build-roster.mjs BANDS 同步) ---------- */
export const RARITY = {
  N:  {name:'N',  label:'路人', hex:'#94a3b8', min:0,   max:31},
  R:  {name:'R',  label:'普通', hex:'#3b82f6', min:31,  max:35},
  SR: {name:'SR', label:'精锐', hex:'#9333ea', min:35,  max:39},
  SSR:{name:'SSR',label:'史诗', hex:'#f59e0b', min:39,  max:41.8},
  UR: {name:'UR', label:'传说', hex:'#ec4899', min:41.8,max:47},
  UTR:{name:'UTR',label:'神话', hex:'#ff2d55', min:47,  max:55},
  NB: {name:'NB', label:'神迹', hex:'#ff6ec7', min:64,  max:100},
};
export const RORDER = ['N','R','SR','SSR','UR','UTR','NB'];
export const RORDER_DESC = ['NB','UTR','UR','SSR','SR','R','N']; // 抽卡概率累加用(高→低)

/* ---------- 集中常量 ---------- */
export const PROBS = {
  NEWBIE: 0.015,     // deepseek-v4-1-flash 新秀独立爆率（0910 新卡联名）
  FIHAG: 0.0001,     // Fihag V1 全池隐藏
  HALLUC: 0.002,     // 幻觉假 UR 彩蛋
  SKIN_DROP: 0.015,  // 皮肤掉落
  EVENT: 1,          // 日切必发 1 个随机事件
  EVENT_EXTRA: 0.3,  // 30% 概率追加第 2 个
};
export const PITY_MAX = 60;        // 伙伴池保底
export const ITEM_PITY_MAX = 30;   // 道具池保底
export const PAY_BOOST = 1.3;
export const START_MONEY = 800;
export const SITE_URL = 'https://llmlife.pages.dev';
/* Cloudflare Web Analytics 站点 token：留空 = 纯控制台埋点（零网络请求） */
export const LL_CF_TOKEN = '';

/* ---------- 厂商 → 伙伴效果 ---------- */
export const EFFECTS = {
  work:    {label:'接单收入', icon:'💰'},
  learn:   {label:'学习效率', icon:'📖'},
  mood:    {label:'娱乐心情', icon:'🎮'},
  stamina: {label:'体力上限', icon:'🔋'},
  charm:   {label:'社交魅力', icon:'✨'},
  dual:    {label:'全能',     icon:'🌟'},
};
export const VENDOR_EFFECTS = {
  Anthropic:'work', DeepSeek:'learn', Alibaba:'learn', Google:'stamina',
  Meta:'mood', OpenAI:'charm', 'Z AI':'dual',
};
export const DEFAULT_EFFECT = 'charm';
export const VENDOR_NAMES = {
  'Z AI':'智谱', Alibaba:'阿里通义', DeepSeek:'深度求索', SpaceXAI:'xAI',
  Kimi:'月之暗面', Xiaomi:'小米', 'Motif Technologies':'Motif',
  'MBZUAI Institute of Foundation Models':'MBZUAI', 'Sapiens AI':'Sapiens AI',
};
/* 稀有度 → 效果强度（dual 按六折折算进两项；温和加强档） */
export const RBOOST = {N:.04, R:.08, SR:.18, SSR:.30, UR:.50, UTR:.75, NB:1.00};
/* 好感等级: 阈值数组 + 效果系数（随行行动每次 +2~4 好感, 重复卡 +10） */
export const FAVOR_LEVELS = [0, 30, 90];
export const FAVOR_MULT = [1, 1.15, 1.3];
export const DUPE_FAVOR = 10;
export const SLOT_COUNT = 3; // 随行槽

/* ---------- 人生常量 ---------- */
export const LIFE = {
  START_AGE: 22, RETIRE_AGE: 60,
  REST_PER_DAY: 1,         // 躺平休息每天限次（道具回体力不受限）
  STAMINA_MAX: 100,
  STAMINA_CAP: 200,        // 体力上限软帽：健身/道具推到 200 后不再成长
  MOOD_DECAY: 8,           // 日切心情自然衰减
  MOOD_LOW: 25,            // 低心情阈值（事件惩罚放大）
  RENT: 1200,              // 周结算房租
  LIVING: 400,             // 周结算伙食水电
  GRACE_WEEKS: 2,          // 连续欠租 N 周 → 破产结局
  WORK_BASE: 260,          // 接单基础价
};
/* 技术收入系数: skill 0→0.5, 50→1.5, 100→2.5 */
export const skillMult = s => 0.5 + s/50;
/* 心情效率系数: mood 0→0.8, 50→1.0, 100→1.2 */
export const moodMult = m => 0.8 + m/250;

/* ---------- 每日行动（cost 为消耗, effect 为固定收益; 打工走 payout 事件流） ---------- */
export const ACTIONS = [
  {id:'work',   name:'接单打工', icon:'💻', stamina:38, money:0,  desc:'接私活赚钱，吃技术、心情与伙伴加成'},
  {id:'learn',  name:'学习充电', icon:'📚', stamina:32, money:0,  skill:[2,4], mood:-4, desc:'提升技术，心情低落时效率打折'},
  {id:'play',   name:'娱乐摸鱼', icon:'🎮', stamina:0,  money:60, mood:18, charm:1, desc:'花点小钱买快乐'},
  {id:'gym',    name:'健身撸铁', icon:'🏋️', stamina:42, money:60, staminaMax:1, charm:2, desc:'最累的一档，但上限成长是真金白银（每天 1 次就够）'},
  {id:'social', name:'社交聚会', icon:'🍻', stamina:24, money:80, charm:3, mood:6, favor:2, desc:'结交朋友，随行伙伴好感 +2'},
  {id:'rest',   name:'躺平休息', icon:'🛌', stamina:0,  money:0,  recover:40, mood:5, desc:'不花钱，原地回血（每天 1 次）'},
];

/* ---------- 日切随机事件表（weight 加权抽取; effect 为固定数值增减） ---------- */
export const EVENTS = [
  {id:'hotfix',    name:'线上事故',   weight:8, money:-200, mood:-10, skill:2,  text:'凌晨两点告警炸响，热修复上线——头发保住了，心情没了'},
  {id:'sick',      name:'生病看病',   weight:5, stamina:-15, money:-300, mood:-8, cond:s=>s.life.attrs.stamina<50, text:'身体亮红灯，挂号输液一条龙'},
  {id:'aiver',     name:'AI 大版本',  weight:6, skill:3, mood:5, text:'常用模型深夜更新，白嫖到新能力'},
  {id:'found',     name:'捡到钱',     weight:4, money:150, text:'路边捡到红包，法律上不算拾金……算了花吧'},
  {id:'oldclient', name:'老客户返场', weight:5, money:400, cond:s=>s.life.attrs.skill>20, text:'老客户带着新需求回来了，信任无价'},
  {id:'opensrc',   name:'开源爆火',   weight:3, charm:4, mood:8, money:200, cond:s=>s.life.attrs.skill>40, text:'你的 repo 上了 GitHub Trending'},
  {id:'bugbonus',  name:'捉虫奖金',   weight:4, money:250, cond:s=>s.life.attrs.skill>15, text:'揪出一个悬赏 bug，赏金到账'},
  {id:'deadline',  name:'甲方催命',   weight:7, mood:-12, stamina:-10, text:'「明天能上线吗」——现在 23:47'},
  {id:'refund',    name:'甲方跑路',   weight:3, money:-500, mood:-15, text:'尾款？不存在的，人已失联'},
  {id:'meetup',    name:'技术沙龙',   weight:4, charm:3, skill:1, text:'线下沙龙认识了几个同行，交换了微信'},
  {id:'overwork',  name:'通宵爆肝',   weight:5, stamina:-20, money:300, text:'赶完这版就睡（并没有）'},
  {id:'priceup',   name:'API 涨价',   weight:4, mood:-5, text:'常用模型又涨价，钱包一紧'},
  {id:'coupon',    name:'平台补贴',   weight:4, money:180, text:'云厂商送券，白嫖真香'},
  {id:'gymad',     name:'健身房推销', weight:3, money:-100, charm:1, text:'办了张年卡，预计去两次'},
  {id:'noise',     name:'邻居装修',   weight:4, mood:-7, stamina:-5, text:'电钻从早八响到晚八'},
  {id:'cat',       name:'楼下流浪猫', weight:3, mood:10, text:'摸了摸猫，工位血槽已满'},
  {id:'hotsearch', name:'早上热搜',   weight:4, mood:6, text:'吃瓜吃到撑，效率反而变高'},
  {id:'headhunt',  name:'猎头挖角',   weight:2, money:800, charm:2, cond:s=>s.life.attrs.skill>60, text:'聊了聊，拿 offer 当备胎'},
  {id:'winter',    name:'行业寒冬',   weight:3, mood:-10, money:-200, cond:s=>s.life.day>300, text:'朋友圈又见毕业帖，焦虑 +1'},
  {id:'giftfan',   name:'粉丝投喂',   weight:3, mood:8, money:120, cond:s=>s.life.attrs.charm>30, text:'有人给你寄了感谢信和小零食'},
];

/* ---------- 道具（一次性使用; favor 生效于全部随行伙伴） ---------- */
export const ITEMS = [
  {id:'coffee',    name:'冰美式',       icon:'☕', r:'N',  effect:{stamina:18},                    desc:'续命水，程序员血液的主要成分'},
  {id:'energy',    name:'功能饮料',     icon:'🥫', r:'N',  effect:{stamina:25, mood:-3},           desc:'心跳加速，但 bug 好像也加速消失'},
  {id:'noodle',    name:'桶装泡面',     icon:'🍜', r:'N',  effect:{stamina:10, mood:3},            desc:'加蛋要另外给钱'},
  {id:'plushie',   name:'工位抱枕',     icon:'🧸', r:'N',  effect:{mood:8},                        desc:'摸起来很解压'},
  {id:'takeout',   name:'快乐外卖',     icon:'🍱', r:'R',  effect:{mood:22},                       desc:'炸鸡奶茶双拼，多巴胺拉满'},
  {id:'milktea',   name:'三分糖奶茶',   icon:'🧋', r:'R',  effect:{mood:15, stamina:8},            desc:'三分糖，七分罪恶'},
  {id:'vitamin',   name:'复合维生素',   icon:'💊', r:'R',  effect:{stamina:12, mood:4},            desc:'安慰剂，但有效'},
  {id:'cinema',    name:'电影票',       icon:'🎬', r:'R',  effect:{mood:18, charm:1},              desc:'一个人看电影也是体面的社交'},
  {id:'oldbook',   name:'绝版旧书',     icon:'📕', r:'R',  effect:{skill:4},                       desc:'泛黄纸页里全是内功'},
  {id:'lottery',   name:'刮刮乐',       icon:'🎟️', r:'R',  special:'lottery',                      desc:'下一张必中（玄学）'},
  {id:'book',      name:'硬核技术书',   icon:'📘', r:'SR', effect:{skill:6},                       desc:'看完等于涨六点技术（大概）'},
  {id:'course',    name:'极客课程',     icon:'🎓', r:'SR', effect:{skill:8, mood:-2},              desc:'干货很多，也很催眠'},
  {id:'figurine',  name:'限定手办',     icon:'🗿', r:'SR', effect:{favor:10, charm:1},             desc:'随行伙伴人手一份，好感 +10'},
  {id:'flowers',   name:'花束',         icon:'💐', r:'SR', effect:{charm:5, favor:6},              desc:'不知道送谁，先放着提升魅力'},
  {id:'keyboard',  name:'客制化键盘',   icon:'⌨️', r:'SR', effect:{mood:12, skill:2},              desc:'麻将音，敲代码像打麻将'},
  {id:'console',   name:'新世代游戏机', icon:'🕹️', r:'SSR',effect:{mood:40},                       desc:'买前生产力，买后瓦罗兰特'},
  {id:'chair',     name:'人体工学椅',   icon:'🪑', r:'SSR',effect:{staminaMax:5, mood:10},         desc:'腰不酸了，坐姿都端正了'},
  {id:'amulet',    name:'欧皇护身符',   icon:'🧿', r:'SSR',special:'pity+10',                      desc:'玄学加成：保底计数 +10'},
  {id:'pulltick',  name:'免费抽卡券',   icon:'🎫', r:'SSR',special:'pull',                         desc:'伙伴池免费单抽 ×1'},
  {id:'monitor',   name:'4K 显示器',    icon:'🖥️', r:'UR', effect:{skill:5, mood:15, staminaMax:3}, desc:'丝都看得清，一行都不会漏'},
  {id:'energyweek',name:'一周能量补剂', icon:'🧪', r:'UR', special:'fullstamina+8',                desc:'一周的量一针打完：体力回满，上限 +8，医生看了摇头'},
];
/* 道具池出货时按稀有度随机抽道具（同稀有度内等权） */
export const ITEM_RARITY = {
  N:['coffee','energy','noodle','plushie'],
  R:['takeout','milktea','vitamin','cinema','oldbook','lottery'],
  SR:['book','course','figurine','flowers','keyboard'],
  SSR:['console','chair','amulet','pulltick'],
  UR:['monitor','energyweek'],
};

/* ---------- 限定池轮换（三赛季, 每季 1 天自动轮换） ---------- */
export const BANNER_SEASONS = [
  { id:'fable', name:'寓言限定池', sub:'限定 UP · Claude Fable 5.1 · 53.4 分新王', color:'#ff2d55', price:388, tenPrice:3700,
    rates:{N:0,R:0,SR:.62,SSR:.295,UR:.075,UTR:.01}, pityMax:100, banner:true,
    note:'⏳ 限定卡池！UTR 神话 Claude Fable 5.1 专属。100 抽大保底必出当期限定，赛季结束自动轮换。',
    featured:['claude-fable-5-1','claude-fable-5'], limited:['claude-fable-5-1'] },
  { id:'astra', name:'星穹限定池', sub:'限定 UP · GPT-6 Astra · 52.8 分星空旗舰', color:'#8b5cf6', price:388, tenPrice:3700,
    rates:{N:0,R:0,SR:.62,SSR:.295,UR:.075,UTR:.01}, pityMax:100, banner:true,
    note:'⏳ 限定卡池！GPT-6 Astra 降临。100 抽大保底必出当期限定，赛季结束自动轮换。',
    featured:['gpt-6-astra','gpt-5-6-sol'], limited:['gpt-6-astra'] },
  { id:'spark', name:'缪斯限定池', sub:'限定 UP · Muse Spark 1.3 · 性价比神话', color:'#22c55e', price:388, tenPrice:3700,
    rates:{N:0,R:0,SR:.62,SSR:.295,UR:.075,UTR:.01}, pityMax:100, banner:true,
    note:'⏳ 限定卡池！Muse Spark 1.3 上演。100 抽大保底必出当期限定，赛季结束自动轮换。',
    featured:['muse-spark-1-3','muse-spark-1-2'], limited:['muse-spark-1-3'] },
];
export const BANNER_DUR = 86400000;
export const BANNER_EPOCH = Date.parse('2026-09-12T00:00:00+08:00');
export const POOLS = {
  partner:{ name:'星海常规池', sub:'伙伴池 · 全档位可出', color:'#3b82f6', price:288, tenPrice:2740,
    rates:{N:.35,R:.33,SR:.195,SSR:.08,UR:.033,UTR:.012},
    note:'主力伙伴池。UR 3.3%、UTR 1.2%，60 抽保底 SSR+。抽到重复伙伴自动折算好感 +10。',
    featured:['glm-5-3','glm-5-3-flash','gemini-3-8-flash','qwen3-8-flash-next','deepseek-v4-1-flash'] },
  banner:Object.assign({}, BANNER_SEASONS[0]),
  item:{ name:'杂物福袋', sub:'道具池 · 开出即用的一次性道具', color:'#f59e0b', price:88, tenPrice:840,
    rates:{N:.5,R:.3,SR:.15,SSR:.045,UR:.005}, pityMax:ITEM_PITY_MAX, isItem:true,
    note:'福袋救急。30 抽保底 SR+ 道具，欧皇护身符与免费抽卡券都在这里。',
    featured:['console','chair','monitor','pulltick'] },
};

/* ---------- 里程碑成就（余额型 at + 谓词型 check） ---------- */
export const MILESTONES = [
  {id:'m2k',   at:2000,   title:'🌱 站住脚跟', tag:'余额突破 ¥2,000',   hype:'第一周房租不用愁了。'},
  {id:'m5k',   at:5000,   title:'🎉 小有积蓄', tag:'余额突破 ¥5,000',   hype:'可以放心抽一发十连了（真的吗）。'},
  {id:'m10k',  at:10000,  title:'📈 小有所成', tag:'余额突破 ¥10,000',  hype:'存款五位数，人生模拟器赢在起跑线。'},
  {id:'m30k',  at:30000,  title:'💼 中坚力量', tag:'余额突破 ¥30,000',  hype:'甲方跑路也不怕了，够赔三次。'},
  {id:'m60k',  at:60000,  title:'🏆 财务自由', tag:'余额突破 ¥60,000',  hype:'技术、魅力、存款三线飘红，中转站都想挖你。'},
  {id:'m100k', at:100000, title:'👑 传奇大亨', tag:'余额突破 ¥100,000', hype:'钱对你来说只是数字，伙伴对你来说才是家人。'},
  {id:'m200k', at:200000, title:'🌌 星辰大海', tag:'余额突破 ¥200,000', hype:'下一个目标是把中转站买下来。'},
  // 谓词型成就
  {id:'pFirstUR', title:'⭐ 第一位传说', tag:'获得首位 UR+ 伙伴', check:s=>{const b=((s.stats||{}).byR)||{}; return (b.UR||b.UTR||b.NB)?1:0;}, hype:'UR 门槛之上，队伍正式成型。'},
  {id:'pTen',     title:'🤝 十人成军', tag:'累计招募 10 位伙伴', check:s=>Math.min(1,Object.keys(s.dex||{}).length/10), hype:'AI 朋友圈扩容完成。'},
  {id:'pFavor',   title:'💖 心意相通', tag:'任一伙伴好感达 90', check:s=>((s.partners||[]).some(p=>p.favor>=90))?1:0, hype:'信赖满级，它开始主动帮你改需求。'},
  {id:'pSkill',   title:'🧠 技术大牛', tag:'技术达到 50', check:s=>Math.min(1,(s.life?s.life.attrs.skill:0)/50), hype:'单子越接越贵，甲方开始喊老师。'},
  {id:'pCharm',   title:'✨ 社交之星', tag:'魅力达到 50', check:s=>Math.min(1,(s.life?s.life.attrs.charm:0)/50), hype:'走到哪里都是焦点。'},
  {id:'pFihag',   title:'🔮 天选之人', tag:'抽到 Fihag V1', check:s=>((s.dex||{}).fihagv1?1:0), hype:'0.01% 的命运眷顾，全服公告预定。'},
];

/* ---------- 结局（60 岁结算, 按综合分从高到低取第一个达标档） ---------- */
export const ENDINGS = [
  {min:400, id:'god',    title:'🌈 神之人生', desc:'技术、财富、魅力、羁绊全部拉满——你的人生本身就是一个传奇模型。'},
  {min:250, id:'winner', title:'👑 人生赢家', desc:'事业爱情双丰收，AI 伙伴环绕，存款看一眼都幸福。'},
  {min:150, id:'free',   title:'🚀 财务自由', desc:'钱够了，接下来的日子只为热爱而写代码。'},
  {min:80,  id:'expert', title:'💼 技术专家', desc:'没能暴富，但你的名字在圈子里就是质量保证。'},
  {min:0,   id:'normal', title:'🧑‍💻 普通码农', desc:'平平淡淡也是真，60 岁还在写 if else，但问心无愧。'},
];
export const ENDING_BROKE = {id:'broke', title:'📉 破产流浪', desc:'连续欠租被房东请出家门。代码改得了 bug，改不了账单。'};
/* 彩蛋结局: 手握 Fihag V1 且综合分 ≥150 时覆盖结算 */
export const ENDING_CHOSEN = {id:'chosen', title:'🔮 天选之人', desc:'抽到了全站唯一 NB 级存在，人生直接封神——命运的 0.01% 落在了你头上。'};
/* 综合分公式（单调，供结局与结算预览；bonusStamina 传入随行伙伴的体力上限加成） */
export const endingScore = (s, bonusStamina=0) => Math.round(
  s.money/200 + s.life.attrs.skill*2 + s.life.attrs.charm*2
  + (s.partners||[]).reduce((a,p)=>a+p.favor,0)*0.1 + (s.partners||[]).length*4
  + (s.life.staminaMax - LIFE.STAMINA_MAX) + (bonusStamina||0)
);

/* ---------- 限定集合（当前赛季由 banner.js 的 syncBanner 维护） ---------- */
export const LIMITED_IDS = new Set(BANNER_SEASONS[0].limited);
export const LIMITED_ALL = new Set(BANNER_SEASONS.flatMap(s=>s.limited));

/* ---------- 皮肤系统 ---------- */
export const SKINS = [
  {id:'classic', name:'经典蓝', icon:'🎐', vars:{}, default:true,
    desc:'出厂默认主题，人生从这间出租屋开始。'},
  {id:'night',   name:'暗夜紫', icon:'🌌',
    vars:{'--bg':'#101225','--panel':'#1a1f3a','--panel2':'#141830','--line':'#2a3158','--line2':'#22284a',
      '--txt':'#e8ecff','--dim':'#9aa3cf','--faint':'#5f6a9c','--blue':'#7c8cff','--blue-d':'#5a6ae0'},
    desc:'深夜爆肝专供，护眼不护发。'},
  {id:'cyber',   name:'赛博霓虹', icon:'🎇',
    vars:{'--bg':'#0b0f1e','--panel':'#121a33','--panel2':'#0e1529','--line':'#1f2b52','--line2':'#182140',
      '--txt':'#e6f7ff','--dim':'#8fb8d9','--faint':'#4d7094','--blue':'#00e5ff','--blue-d':'#00b8d4'},
    desc:'RGB 拉满，人生看起来都会过得更快。'},
  {id:'gold',    name:'金色传说', icon:'👑',
    vars:{'--bg':'#fff8ec','--panel':'#fffdf8','--panel2':'#fff6e2','--line':'#f0e0c0','--line2':'#f7ead2',
      '--txt':'#5a3d1a','--dim':'#9c7b45','--faint':'#c0a678','--blue':'#d97706','--blue-d':'#b45309'},
    desc:'财运主题，玄学加成 +20%（并不）。'},
  {id:'pink',    name:'粉甜梦境', icon:'🍑',
    vars:{'--bg':'#fff0f5','--panel':'#fffafc','--panel2':'#fff0f6','--line':'#ffd6e3','--line2':'#ffe3ec',
      '--txt':'#6b3a52','--dim':'#b57f9b','--faint':'#d3a9bf','--blue':'#f472b6','--blue-d':'#db2777'},
    desc:'恋爱脑模拟器专用主题。'},
  {id:'mint',    name:'薄荷白茶', icon:'🍃',
    vars:{'--bg':'#f0fdf6','--panel':'#ffffff','--panel2':'#f6fef9','--line':'#d1f0de','--line2':'#e6f7ec',
      '--txt':'#1a3d2e','--dim':'#5a8a74','--faint':'#8ab5a0','--blue':'#10b981','--blue-d':'#059669'},
    desc:'早睡早起主题，健康人生从这里开始。'},
];
export const SKIN_DROP_RATE = 0.015;
PROBS.SKIN_DROP = SKIN_DROP_RATE;

/* ---------- 文案库 ---------- */
export const CLIENT_REQS = [
'「做个奶茶店小程序，要赛博朋克风」','「仿个电商首页，预算 500」','「把 20 年前的老系统迁移上云」',
'「帮健身房做个约课系统，顺便卖课」','「宠物殡葬官网，风格要温暖」','「直播带货后台，今晚上线」',
'「给广场舞队做报名系统，要兼容老人机」','「做个 ChatGPT 多少钱？预算 2000」','「抢课系统，不能崩」',
'「Excel 升级成 SaaS」','「医院挂号小程序，出 bug 要赔」','「区块链溯源（其实用不上区块链）」',
'「AI 绘画小程序，接个开源模型」','「夜市摊主联盟点餐系统」','「客户要五彩斑斓的黑」',
'「寺庙功德箱线上化」','「AI 算命，要接八字 API」','「给钓鱼佬做鱼获排行榜」',
'「学校社团招新系统」','「帮房东做房租提醒，逾期自动加滞纳金」','「帮烧烤店做点单，编号用方言语音输入」',
'「电梯广告屏接 AI，广告词按楼层生成」','「客户：logo 放大一点，同时再小一点」',
];
export const WORK_TXT = {
  great:['🤩 客户惊呼这是艺术品，当场加钱！','🤩 一次过！还介绍了两个新单。','🤩 代码优雅得能进教科书，加急费到手！'],
  ok:['✅ 交付验收，尾款到账。','✅ 需求完成，客户没说啥（就是满意）。','✅ 上线顺利，无人在意。'],
  rework:['🔧 「logo 再大一点，颜色再鲜艳一点」……','🔧 需求改了三版，时薪暴跌。','🔧 测试报了一堆 bug，连夜返工。'],
  disaster:['💥 模型幻觉发作，把测试库当生产库清了……倒赔！','💥 force push 覆盖了客户 main 分支……赔钱！','💥 定时任务时区写错，数据全错——赔偿！'],
};
export const NOTICES = [
'📢 公告：本站指数已切换 AA v4.3 标定，卡面分数即真实智能指数，童叟无欺。',
'📢 公告：DeepSeek V4.1 Flash（0910 新秀）上架伙伴池，另有 1.5% 独立爆率，抽到记得晒。',
'🔥 公告：限定池三赛季轮换开启——寓言 / 星穹 / 缪斯，100 抽大保底必出当期神话。',
'📢 公告：重复伙伴自动折算好感 +10，图鉴党狂喜。',
'📢 公告：有玩家问体力能不能用咖啡补——能，道具池常年营业。',
'📢 公告：心情低于 25 时打工容易翻车，请注意劳逸结合。',
'📢 公告：60 岁结算人生，评分不够也不用慌——破产了还能重开，人生没有。',
'🔥 公告：「寓言限定池」已开启！Claude Fable 5.1 镇池，53.4 分新王等您带回家。',
'📢 公告：Qwen3.8-Flash-Next 每单 0.47 刀，学习党的性价比之神。',
'📢 公告：GLM-5.3-Flash 用户已突破百亿 token，智谱：谢谢惠顾。',
];
