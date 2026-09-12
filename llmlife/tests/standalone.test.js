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
    expect(d.querySelectorAll("[data-actbtn]").length).toBe(6);
    expect(d.getElementById("h-money").textContent).toContain("800");
    expect(d.getElementById("page-life").classList.contains("active")).toBe(true);
    // 卡池页三池渲染（证明 boot 全链路走完）
    dom.window.document.querySelector('[data-page="gacha"]').click();
    expect(d.querySelectorAll("#pool-cards .pool-card").length).toBe(3);
  });
});
