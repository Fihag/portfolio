import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/* 整应用冒烟：把真实 index.html 注入 jsdom，再加载 main.js 走完整启动链路 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "index.html"), "utf8");
const body = html
  .replace(/[\s\S]*<body>/, "<body>")
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<\/body>[\s\S]*/, "");
document.body.innerHTML = body;

/* 注意: 动态 import 后解构 let S 只会拿到快照, 必须走命名空间读取 live binding */
const NS = await import("../js/state.js");
const CFG = await import("../js/config.js");
await import("../js/main.js");
const UI = await import("../js/ui/render.js");

const renderAll = UI.renderAll;
const $ = NS.$;
const S = new Proxy({}, { get: (_, k) => NS.S[k], set: (_, k, v) => (NS.S[k] = v), has: (_, k) => k in NS.S });
const PROBS = CFG.PROBS;
PROBS.EVENT = 0;

describe("整应用冒烟（main.js + 真实 index.html）", () => {
  beforeAll(() => {
    localStorage.clear();
    NS.setState(NS.defaultState());
    renderAll();
  });

  it("启动后默认落在生活页", () => {
    expect($("page-life").classList.contains("active")).toBe(true);
    expect($("page-life").getAttribute("aria-hidden")).toBe("false");
  });

  it("头部芯片渲染余额/体力/天数", () => {
    expect($("h-money").textContent).toContain("800");
    expect($("h-stamina").textContent).toBe("100/100");
    expect($("h-day").textContent).toBe("1");
    expect($("h-age").textContent).toBe("22");
  });

  it("行动栏渲染 6 个行动且禁用态正确", () => {
    const btns = [...document.querySelectorAll("[data-actbtn]")];
    expect(btns.length).toBe(6);
    const work = btns.find(b => b.dataset.actbtn === "work");
    expect(work.disabled).toBe(false);
    const play = btns.find(b => b.dataset.actbtn === "play");
    expect(play.disabled).toBe(false);
    const rest = btns.find(b => b.dataset.actbtn === "rest");
    expect(rest.disabled).toBe(false);
  });

  it("点击打工后余额/体力/日志联动刷新", async () => {
    const before = NS.S.money;
    const btn = document.querySelector('[data-actbtn="work"]');
    btn.click();
    expect(NS.S.money).not.toBe(before);
    expect($("h-stamina").textContent).toBe("62/100");
    expect($("day-log").textContent.length).toBeGreaterThan(5);
  });

  it("伙伴页与背包页空态渲染", async () => {
    document.querySelector('[data-page="partners"]').click();
    expect($("page-partners").classList.contains("active")).toBe(true);
    expect($("partner-empty").hidden).toBe(false);
    document.querySelector('[data-page="bag"]').click();
    expect($("page-bag").classList.contains("active")).toBe(true);
    expect($("item-empty").hidden).toBe(false);
  });

  it("数据页渲染成就墙与统计", () => {
    document.querySelector('[data-page="data"]').click();
    expect(document.querySelectorAll("#achieve-grid .achieve-card").length).toBeGreaterThan(5);
    expect($("stat-grid").textContent).toContain("累计收入");
  });

  it("卡池页渲染三池并完成一次单抽闭环", () => {
    document.querySelector('[data-page="gacha"]').click();
    expect($("page-gacha").classList.contains("active")).toBe(true);
    expect(document.querySelectorAll("#pool-cards .pool-card").length).toBe(3);
    NS.S.flags.autoSkip = true; // 跳过翻牌动画，直接走 finish
    NS.S.money = 10000;
    document.querySelector('[data-pull="partner"][data-n="1"]').click();
    expect(document.getElementById("overlay").classList.contains("show")).toBe(true);
    expect(document.querySelectorAll("#gacha-row .gcard").length).toBe(1);
    expect(document.querySelector("#gacha-summary").classList.contains("show")).toBe(true);
    expect(NS.S.stats.pulls).toBe(1);
    document.getElementById("close-overlay").click();
    expect(document.getElementById("overlay").classList.contains("show")).toBe(false);
  });

  it("抽杂物福袋后确定按钮可见可点（卡死回归）", () => {
    NS.S.flags.autoSkip = true;
    NS.S.money = 10000;
    document.querySelector('[data-page="gacha"]').click();
    document.querySelector('[data-pull="item"][data-n="1"]').click();
    const close = document.getElementById("close-overlay");
    expect(close.classList.contains("show")).toBe(true);
    close.click();
    expect(document.getElementById("overlay").classList.contains("show")).toBe(false);
  });

  it("结束今天 → 新的一天弹窗 → 日期推进", () => {
    PROBS.EVENT = 0;
    const day = NS.S.life.day;
    document.getElementById("btn-end-day").click();
    expect($("modal-mask").classList.contains("show")).toBe(true);
    document.querySelector('[data-act="confirm-end-day"]').click();
    expect(NS.S.life.day).toBe(day + 1);
    expect($("modal-mask").classList.contains("show")).toBe(true); // 新的一天弹窗
    document.querySelector("#modal-box .big-btn").click();
    expect($("modal-mask").classList.contains("show")).toBe(false);
  });

  it("header 重开按钮 → 确认 → 进度清空", () => {
    NS.S.money = 5000;
    NS.S.life.day = 40;
    document.getElementById("btn-restart").click();
    expect($("modal-mask").classList.contains("show")).toBe(true);
    document.querySelector('[data-act="confirm-reset"]').click();
    expect(NS.S.money).toBe(800);
    expect(NS.S.life.day).toBe(1);
    expect(NS.S.ending).toBeNull();
  });

  it("欢迎弹窗 → 开始按钮闭环", async () => {
    NS.S.flags.welcomed = false;
    const { showModal, welcomeHTML } = await import("../js/ui/modals.js");
    showModal(welcomeHTML(), true);
    expect($("modal-mask").classList.contains("show")).toBe(true);
    const start = document.querySelector('[data-act="start"]');
    expect(start).not.toBeNull();
    start.click();
    expect(NS.S.flags.welcomed).toBe(true);
    expect($("modal-mask").classList.contains("show")).toBe(false);
  });
});
