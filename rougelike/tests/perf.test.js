// 性能优化面回归：渐变缓存工具、HUD 脏检查（值未变不写 DOM、换局强制刷新）、
// 武器 chip 签名重建、月领域/弹幕/低血量等缓存绘制路径的 draw 冒烟。
import { describe, it, expect } from "vitest";
import { loadGame } from "./helpers.js";

describe("渲染性能缓存", () => {
  it("cachedRadial/cachedLinear：同 key 复用条目、异 key 新增、超容量整体清空", () => {
    const { R } = loadGame();
    const s0 = R("_gradCache.size");
    R(`cachedRadial('kx', 0, 5, [[0,'#fff'],[1,'#000']])`);
    R(`cachedRadial('kx', 0, 5, [[0,'#fff'],[1,'#000']])`);
    expect(R("_gradCache.size")).toBe(s0 + 1); // 第二次命中缓存，不再新增
    R(`cachedRadial('ky', 0, 5, [[0,'#fff'],[1,'#000']])`);
    expect(R("_gradCache.size")).toBe(s0 + 2);
    R(`cachedLinear('l1', 0, 0, 0, 100, [[0,'#fff'],[1,'#000']])`);
    expect(R("_gradCache.size")).toBe(s0 + 3);
    // 超 512 条整体清空：插入 600 个异 key 后规模回落到上限附近，且末位仍在
    for (let i = 0; i < 600; i++) R(`cachedRadial('flood-${i}', 0, 5, [[0,'#fff'],[1,'#000']])`);
    expect(R("_gradCache.size")).toBeLessThan(520);
    expect(R(`_gradCache.has('r|flood-599|0|5')`)).toBe(true);
  });

  it("hudSet：同值同局不写 DOM，值变写、换局强制重写", () => {
    const { R } = loadGame();
    R(`(function () {
      let n = 0;
      Object.defineProperty(hudTime, 'textContent', { configurable: true, get() { return ''; }, set() { n++; } });
      window.__timeWrites = () => n;
    })()`);
    R("updateHud()");
    expect(R("__timeWrites()")).toBe(1); // 首帧写入
    R("updateHud()");
    expect(R("__timeWrites()")).toBe(1); // 值未变：零写入
    R("game.time = 1.2; updateHud()");
    expect(R("__timeWrites()")).toBe(2); // 值变：写入
    R("game.runId++; updateHud()");
    expect(R("__timeWrites()")).toBe(3); // 换局：同值也强制重写
    R("updateHud(); updateHud(); updateHud()");
    expect(R("__timeWrites()")).toBe(3); // 同局同值恢复跳过
  });

  it("hudWeps：仅武器构成签名变化才重建 innerHTML", () => {
    const { R } = loadGame();
    R(`(function () {
      let n = 0;
      const d = Object.getOwnPropertyDescriptor(hudWeps, 'innerHTML');
      Object.defineProperty(hudWeps, 'innerHTML', { configurable: true, get() { return d.get.call(hudWeps); }, set(v) { n++; d.set.call(hudWeps, v); } });
      window.__wepsSets = () => n;
    })()`);
    R("updateHud()");
    expect(R("__wepsSets()")).toBe(1); // '' → 实际构成，重建
    R("updateHud()");
    expect(R("__wepsSets()")).toBe(1); // 同构成：不重建
    expect(R("hudWeps.innerHTML.indexOf('火球')")).toBeGreaterThan(0);
    R("game.player.weapons.push(START_WEAPON_DEFS.orbit_blade()); updateHud()");
    expect(R("__wepsSets()")).toBe(2); // 新增飞刃：签名变，重建
    expect(R("hudWeps.innerHTML.indexOf('飞刃×' + game.player.weapons[1].bladeCount)")).toBeGreaterThan(0);
    R("game.runId++; updateHud()");
    expect(R("__wepsSets()")).toBe(2); // 换局但构成相同：DOM 内容本就一致，不重建
  });

  it("月领域 / 弹幕 / Boss 狂暴光环 / 低血量 vignette 全走缓存路径，draw 无异常且缓存有界", () => {
    const { R } = loadGame();
    R(`(function () {
      // 低血量 → vignette；Boss 半血以下 → 狂暴脉冲光环
      game.player.maxHp = 100; game.player.hp = 10;
      const b = new Enemy(700, 300, 'boss', 0);
      b.hp = b.maxHp * 0.4; b.invincible = true; b.shieldHp = 500;
      game.enemies.push(b);
      // 玩家弹 + 敌方酸液弹
      const pl = new Projectile(650, 300, 100, 0, 5, 0, 0, '#ff9933', 4.5);
      const ac = new Projectile(600, 320, -80, 0, 5, 0, 0, '#88ff44', 5, true);
      ac.acid = true;
      game.projectiles.push(pl, ac);
      // 月领域（一阶段 + 二阶段）各推 3 帧
      game.moonDomain = { x: MOON_DOMAIN.x, y: MOON_DOMAIN.y, r: MOON_DOMAIN.r, active: true, phase2: false };
      for (let i = 0; i < 3; i++) draw(ctx);
      game.moonDomain.phase2 = true;
      for (let i = 0; i < 3; i++) draw(ctx);
      game.moonDomain = null;
      draw(ctx);
    })()`);
    expect(R("_gradCache.size")).toBeLessThan(520);
  });

  it("HUD 更新后关键数值确实反映到 DOM（脏检查不吞变更）", () => {
    const { R } = loadGame();
    expect(R("updateHud(), hudKills.textContent")).toBe("0");
    R("game.kills = 7; game.runId++; updateHud()");
    expect(R("hudKills.textContent")).toBe("7");
    R("game.player.hp = 66; game.player.maxHp = 100; game.runId++; updateHud()");
    expect(R("hudHpText.textContent")).toBe("66 / 100");
    expect(R("hudHpFill.style.width")).toBe("66%");
    R("game.warningText = '测试警告'; game.warningTimer = 1.0; game.runId++; updateHud()");
    expect(R("hudWarning.style.display")).toBe("block");
    expect(R("hudWarning.textContent")).toBe("测试警告");
  });
});
