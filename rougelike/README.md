# 魔法幸存者

一款基于 Canvas 的轻量 Roguelite 生存小游戏：单机、零构建可双击，`npx serve` 开发，`npm test/lint` 护航。

## 在线游玩

🌐 **[立即开始游戏](https://rougelike-13h.pages.dev)** （`web/rougelike` 正式版，`debug.html` 仅本地 `?debug`）

手机端建议右下角全屏；桌面端方向键 + 数字键 + 空格暂停。

## 快速开始

```bash
# 零构建：双击 index.html 即可（file://）
# 或
npx serve web/rougelike -l 8123   # http
npx vite --open                   # ESM 热更新（可选，经典脚本直加载）
# 开发校验
npm install
npm test        # vitest 15 用例（冒烟 + 运行时帧模拟）
npm run lint    # eslint
```

## 游戏玩法

- **目标**：在密集浪潮中存活，获取经验强化武器
- **武器**：魔法弹、飞刃、冰霜、闪电链、陨石、暗影精灵，可组合进化（飞刃风暴 +3）
- **难度**：简单 / 普通 / 困难 / 地狱 / **不可能**（`DIFFICULTIES` 单源 `js/config.js`）；不可能小怪 50% 词缀、10% 减伤、20% 减速免疫，Boss 减速 40%（不可能 50%，刺客免疫）
- **精英波次**：每 60 秒一波，预警期间普通怪照常刷新，不清场
- **Boss**：死神骑士、虫巢母皇、暗影刺客（弹速 +30）、**熔岩巨兽**地狱/不可能 40% 出场，3200血，全弹速 +40，死亡 256 发新星
- **地图事件**：治疗祭坛 / 风险祭坛 / 传送门 + 屏外箭头
- **灵魂宝库**：天赋 + 圣物（11 种：`影侍守卫` 已重做为 60% 受击眩晕 0.8s + 10s 双影袭，不可升级）/ 成就 / 死神之指（手动世界坐标修复，刺客 60 半径自适应）
- **存档**：最佳记录按难度分档，`rogue_best_time_<难度>`

## 文件结构（单仓，file:// 直开保留）

```
web/rougelike/
├── index.html              正式版入口（19 脚本按序，file:// 可双击）
├── debug.html              调试版入口（+ debug.js/panel，仅本地）
├── css/
│   ├── tokens.css        设计 token（P4）
│   ├── base.css
│   ├── hud.css
│   ├── panels.css
│   └── debug.css
└── js/
    ├── 00-const.js         DOM/ICONS/game/cam
    ├── 01-input.js         键盘/鼠标/摇杆（死神手动已转世界坐标）
    ├── 02-utils.js         工具/音效/粒子
    ├── config.js           平衡单源 DIFFICULTIES（P2 抽离）
    ├── 03-skills.js        武器/进化（e.g. evo_orbit +3）
    ├── 04-meta.js          宝库/圣物（影侍守卫）/成就
    ├── enemies/            05-enemies 拆分（P3）
    │   ├── types.js        ENEMY_TYPES / BOSS_DROP
    │   ├── core.js         Enemy 构造/减伤/护盾
    │   ├── update.js       Enemy.update + Boss 技能行为（濒死爆燃/剑气/闪现/影刃）
    │   └── draw.js         Enemy.draw + 特效绘制
    ├── 06-player.js        玩家（影侍守卫受击 60% 触发）
    ├── 07-projectiles.js   弹道（8s/120px）
    ├── upgrades/           08-upgrades 拆分（P4）
    │   ├── choices.js      升级选项
    │   ├── init.js         initGame
    │   └── weapons.js      武器更新/绘制
    ├── 09-deathmark.js     死神之指（60 半径）
    ├── 10-events.js        波次/祭坛/刷怪（精英不清场）
    ├── game/               11-game 拆分（P2）
    │   ├── update.js       主循环 update
    │   ├── render.js       draw / drawOffscreenArrows
    │   └── ui.js           updateHud / gameLoop / renderMenu/Meta
    └── debug.js            调试面板（P1 合并，仅 debug.html 加载）
vite.config.js              Vite 双轨（P4，dev:vite 热更新；经典脚本不可打包，勿部署 dist）
tests/                      vitest 15 用例（helpers.js 按新顺序加载）
```

- **单仓**：`Pigeon` 已归档为 `debug.html`，`Pages` 部署 `web/rougelike` 根即为正式版（`npx wrangler pages deploy web/rougelike --project-name rougelike-13h`）
- **双轨**：`file://` 11 脚本直开 + `npx serve` http + `npm test/lint` ESM 工具链

## 开发说明

- 顶层共享作用域，按 `index.html` 顺序加载，新增文件保持依赖顺序（`00` → `game/ui`）
- 快捷键：`P/Esc` 暂停，`M` 静音，`F1` 调试面板
- 存档签名 `META_SALT`，篡改自动清除
