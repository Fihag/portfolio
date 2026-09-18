import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* standalone.html 产物回归：
   模块拼接后是单个经典脚本，任何顶层重名都会 SyntaxError 整体白屏
   （ESM 分模块作用域时不会暴露），这里真跑产物验证可启动。 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "standalone.html"), "utf8");

describe("standalone.html 单文件离线版", () => {
  it("不含残留 ESM import 语句与 module 入口", () => {
    expect(/^\s*import\s+[^'"]*['"]\.[^'"]+['"]/m.test(html)).toBe(false);
    expect(html.includes('type="module"')).toBe(false);
    expect(html.includes('<script src="js/main.js">')).toBe(false);
  });

  it("经典脚本可独立启动（act-bar 6 按钮 + 默认 ¥800 + 生活页激活）", async () => {
    const dom = new JSDOM(html, {
      url: "http://localhost/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    await new Promise(r => setTimeout(r, 150));
    const d = dom.window.document;
    expect(d.querySelectorAll("[data-actbtn]").length).toBe(10); // 8 解锁 + 2 下一职级锁定预告
    expect(d.getElementById("h-money").textContent).toContain("800");
    expect(d.getElementById("page-life").classList.contains("active")).toBe(true);
    // 卡池页三池渲染（证明 boot 全链路走完）
    dom.window.document.querySelector('[data-page="gacha"]').click();
    expect(d.querySelectorAll("#pool-cards .pool-card").length).toBe(3);
    // 职业芯片 + 周目标面板（boot 的 ensureWeek 生效）
    expect(d.getElementById("career-txt").textContent).toContain("实习生");
    expect(d.querySelectorAll("#goals-list .goal-row").length).toBe(2);
    // 资产页（阶段 4）：6 导航钮，住房链 4 档 + 行情 3 行 + 净资产 4 格
    expect(d.querySelectorAll(".top-nav button").length).toBe(6);
    d.querySelector('[data-page="assets"]').click();
    expect(d.getElementById("page-assets").classList.contains("active")).toBe(true);
    expect(d.querySelectorAll("#house-zone .house-card").length).toBe(4);
    expect(d.querySelectorAll("#market-zone .mkt-row").length).toBe(3);
    expect(d.querySelectorAll("#nw-cells .nw-cell").length).toBe(4);
  });
});
