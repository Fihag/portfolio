# LLMLife · LLM 人生模拟器

TokenGacha 精神续作。**主玩法是行动点日程制的人生模拟**，抽卡降级为次要玩法：抽 AI 伙伴随行加成、抽一次性道具救急。

22 岁毕业入行，60 岁结算人生。每周房租雷打不动，连续欠租两周破产流浪——人生没有重开，但游戏有。

## 玩法循环

```
行动不设上限，体力说话（躺平每天 1 次，道具回体力不限）
  ├─ 💻 接单打工   事件流结算（大成功×2.5 / 返工×0.4 / 生产事故倒赔），吃技术×心情×伙伴加成
  ├─ 📚 学习充电   技术上涨（心情 <25 效率减半），伙伴可加成
  ├─ 🎮 娱乐摸鱼   花钱买心情
  ├─ 🏋️ 健身撸铁   体力上限 +1，顺便涨魅力
  ├─ 🍻 社交聚会   魅力与心情，随行伙伴好感 +2
  └─ 🛌 躺平休息   免费 +40 体力（每天 1 次）
       ↓ 点「结束今天」显式日切
  随机事件 1~2 个（每天必发）→ 睡眠恢复（+55 体力 / -8 心情）→ 新的一天结算弹窗
       ↓ 每 7 天
  周结算：房租 ¥1200 + 伙食 ¥400，付不起计欠租，连续 2 周 → 破产结局
       ↓ 每 360 天
  长一岁，60 岁按综合分结算结局（普通码农 → 技术专家 → 财务自由 → 人生赢家 → 神之人生；持 Fihag V1 有彩蛋结局）
```

## 抽卡（次要玩法，大概）

| 卡池 | 单抽 | 十连 | 保底 | 说明 |
|---|---|---|---|---|
| 星海常规池 | ¥288 | ¥2740 | 60 抽 SSR+ | UR 3.3% / UTR 1.2%，重复伙伴折算好感 +10 |
| 限定池（三赛季轮换） | ¥388 | ¥3700 | 100 抽必出当期神话 | S1 Claude Fable 5.1 / S2 GPT-6 Astra / S3 Muse Spark 1.3 |
| 杂物福袋 | ¥88 | ¥840 | 30 抽 SR+ | 21 种一次性道具：咖啡续命、手办涨好感、刮刮乐看命 |

**伙伴加成**：最多 3 位随行。效果类型看厂商，强度看稀有度（N +4% → UTR +75%）与好感等级（×1.0 / 1.15 / 1.3）：

| 厂商 | 效果 |
|---|---|
| Anthropic | 💰 接单收入 |
| DeepSeek / 阿里通义 | 📖 学习效率 |
| Google | 🔋 体力上限 |
| Meta | 🎮 娱乐心情 |
| OpenAI | ✨ 社交魅力 |
| 智谱 Z AI | 🌟 全能（收入+学习各六折） |

**彩蛋**：Fihag V1 全池 0.01%（NB 神迹）、DeepSeek V4.1 Flash 独立爆率 1.5%、幻觉假 UR 0.2%（揭晓变 R 伙伴，随行好感 +10 作精神损失费）。

## 稀有度分段（AA v4.3 重标定）

卡面指数 = Artificial Analysis Intelligence Index **v4.3 真实智能指数**，分档据此重算（v4.3 相对 v4.1.1 非均匀压缩 ×0.64~0.80，tokengacha 旧分段作废）：

| 档位 | 称号 | 指数区间 | 数量 |
|---|---|---|---|
| UTR | 神话 | ≥ 47 | 6 |
| UR | 传说 | 41.8 ~ 47 | 6 |
| SSR | 史诗 | 39 ~ 41.8 | 9 |
| SR | 精锐 | 35 ~ 39 | 8 |
| R | 普通 | 31 ~ 35 | 10 |
| N | 路人 | < 31 | 15 |
| NB | 神迹 | 彩蛋不占分 | 1 |

名单由 `tools/build-roster.mjs` 从 AA 指数 JSON 精选生成（精选表含全部文案），榜单更新后重跑 `npm run roster` 即可刷新。

## 开发

```bash
npm install
npm run dev              # 本地 HTTP 服务（file:// 打不开 ESM 版，用 standalone.html）
npm test                 # vitest，69 条真函数级用例（含 jsdom 整应用冒烟）
npm run lint             # eslint
npm run roster           # 从 AA 指数 JSON 重新生成卡池名单 → config.js
npm run sync:sw          # 发版前同步 sw.js 资产清单
npm run build:standalone # 生成 standalone.html（双击即玩，file:// 可用）
```

技术栈：零依赖 vanilla JS + ESM、无构建、CSS 变量主题（6 套皮肤）、WebAudio 合成音效、canvas 粒子、PWA 离线缓存、localStorage 存档（`llmlife_v1`）。

```
llmlife/
├── index.html            5 页骨架：生活 / 伙伴 / 卡池 / 背包 / 数据
├── css/style.css         视觉体系继承 tokengacha + 人生模拟专属区块
├── js/
│   ├── config.js         ★ 数据单源：MODELS(roster 生成)/RARITY(新分段)/三池/行动/事件/道具/结局
│   ├── state.js          存档 v1 + live binding 换档
│   ├── validate.js       运行时校验（分数-分档一致性等）
│   ├── economy.js        打工事件参数单源（期望与抽样同源）
│   ├── life.js           ★ 回合引擎：行动/日切/周结算/事件/年龄/结局
│   ├── partners.js       伙伴效果/好感/随行槽
│   ├── items.js          道具结算（刮刮乐/抽卡券等特殊道具）
│   ├── pulls.js          ★ 抽卡核心：两阶段执行 + 保底 + 十连补底
│   ├── banner.js         三赛季轮换
│   ├── skins.js / fx.js / track.js / main.js
│   └── ui/               router / render / living / gacha / modals / boot
├── tools/                build-roster / sync-sw / build-standalone（全部零依赖）
└── tests/                config/state/economy/life/partners(items)/pulls/smoke
```

## 相关

- 前作：[TokenGacha-Enhanced](https://github.com/Fihag/TokenGacha-Enhanced)（LLM API 盲盒经营；卡面为 v4.1.1 分数，自成体系）
- 指数数据：[Artificial Analysis](https://artificialanalysis.ai/leaderboards/models)
