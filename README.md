# Fihag · 作品集 monorepo

Claude/Anthropic 官网风格（暖纸感编辑风）的作品集导航站 + 全部 8 个项目源码，一个仓库 = 一个站点，纯 HTML/CSS/JS 为主，零构建。

**线上**：https://fihag-portfolio.pages.dev

## 仓库结构 = 站点结构

本仓库根目录即 Cloudflare Pages 部署根，目录名就是线上 URL 路径：

| 路径 | 项目 | 访问方式 |
|---|---|---|
| `/` | 作品集首页（导航 + 8 张卡片） | 直接访问 |
| `/rougelike/` | 魔法幸存者（Canvas 肉鸽生存） | 站内直接玩 |
| `/tokengacha/` | TokenGacha（LLM API 盲盒经营，PWA） | 站内直接玩 |
| `/hanghai/` | 数字航海（玻璃拟态猜数冒险） | 站内直接玩 |
| `/pigeon/debug.html` | 魔法幸存者·Debug（F1 调试面板） | 站内直接玩 |
| `/pinbei/` | 拼豆库存统计（手绘风管理工具） | 站内直接用 |
| `/web-terminal/` | WebTerminal（浏览器终端模拟器） | 站内直接玩 |
| `/turtle-soup/` | 海龟汤在线推理（源码） | 需本地运行 |
| `/poll/` | Poll API（源码） | 需本地运行 |

## 需要本地运行的项目

| 项目 | 本地运行方式 | 说明 |
|---|---|---|
| 海龟汤在线推理 | 进 `turtle-soup/`：`npm install` → `npm start`（一键构建+后端+ngrok），或 `npm run dev` | React + Socket.IO 联机，无法纯静态部署；管理功能需设 `ADMIN_PASSWORD` 环境变量 |
| Poll API | 进 `poll/`：`node server.js`（默认读 config.json，可 `--config my.json --port 8080`） | Node 服务端项目，管理后台在 `/admin`；**注意 `poll/config.json` 含真实上游配置，勿公开分发** |
| 数字航海（云存档） | 进 `hanghai/`：`node server.js`（端口 8080） | 站内可直接玩，但云端存档依赖 server.js 写 `saves/`，纯静态部署下存档功能不可用 |

## 历史仓库

- 历史归档（早期提交记录）：[Fihag/cc-web](https://github.com/Fihag/cc-web)
- 魔法幸存者正式版开发仓（Pigeon 为其副本）：[Fihag/rougelike](https://github.com/Fihag/rougelike)（已冻结，以本仓库为准）
- TokenGacha 开发仓：[Fihag/TokenGacha-Enhanced](https://github.com/Fihag/TokenGacha-Enhanced)（已冻结，以本仓库为准）

## 特效

| 特效 | 触发 | 降级 |
|---|---|---|
| 光标跟随光晕（multiply 混合） | pointermove + rAF lerp | 触屏/reduced-motion 关闭 |
| 卡片 3D 倾斜 + 跟随高光 | rotateX/Y ±5° | 同上 |
| 磁性按钮 | 指针靠近位移 22% | 同上 |
| kicker 打字机 | 逐字 + 光标闪烁 | reduced-motion 直显 |
| 标题逐字浮现 | data-split + 交错延迟 | reduced-motion 直显 |
| 统计数字滚动 | data-count + rAF 缓动 | reduced-motion 直显 |
| 技术栈跑马灯 | CSS 无限滚动，悬停暂停 | reduced-motion 静止 |
| 滚动渐显 | IntersectionObserver | 同上 |

## 设计规范

- 底色 `#f0eee6`（象牙纸）、墨色 `#141413`、陶土橘 `#cc785c`
- 无衬线标题 + 衬线斜体点缀（Georgia/宋体栈，无外部字体请求）
- 卡片：1px 细边框、8px 圆角、无投影，衬线幽灵序号

## 部署

- **Git 集成（当前使用）**：Cloudflare Pages 连接本仓库，构建命令留空，输出目录 `/`，push 即部署
- **CLI 直传**：`npx wrangler pages deploy . --project-name fihag-portfolio`

## 本地预览

```bash
npx serve .        # 在本仓库根目录起服务
# 或直接双击 index.html
```
