# Fihag · 作品集站点

Claude/Anthropic 官网风格（暖纸感编辑风）的作品集导航站，纯 HTML/CSS/JS，零构建零依赖。

**线上**：https://fihag-portfolio.pages.dev

## 仓库结构 = 站点结构

本仓库根目录即 Cloudflare Pages 部署根，目录名就是线上 URL 路径：

```
/                    ← 作品集首页（导航 + 8 个项目卡片）
/hanghai/            ← 数字航海（猜数冒险，玻璃拟态）
/pigeon/debug.html   ← 魔法幸存者·Debug（F1 调试面板）
/pinbei/             ← 拼豆库存统计（手绘风管理工具）
/web-terminal/       ← WebTerminal（浏览器终端模拟器）
```

已单独上线的项目走外链，不在本仓库内：

- 魔法幸存者正式版：https://rougelike-13h.pages.dev（源码 [Fihag/rougelike](https://github.com/Fihag/rougelike)）
- TokenGacha：https://tokengacha.pages.dev（源码 [Fihag/TokenGacha-Enhanced](https://github.com/Fihag/TokenGacha-Enhanced)）

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

- **Git 集成（推荐）**：Cloudflare Pages 连接本仓库，构建命令留空，输出目录填 `/`（根目录），push 即部署
- **CLI 直传**：`npx wrangler pages deploy . --project-name fihag-portfolio`

## 本地预览

```bash
npx serve .        # 在本仓库根目录起服务
# 或直接双击 index.html
```
