/* ================================================================
   LLMLife · 统一入口 (main.js)
   初始化序列：埋点 → 校验 → 路由 → 交互绑定 → 启动渲染
   ================================================================ */
import { initTrack } from "./track.js";
import "./validate.js"; // 启动自检（失败仅 console.error）
import { initRouter } from "./ui/router.js";
import { initLiving } from "./ui/living.js";
import { bindUI, boot } from "./ui/boot.js";

initTrack();
initRouter();
initLiving();
bindUI();
boot();
