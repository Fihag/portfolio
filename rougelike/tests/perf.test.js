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

  it("粒子对象池：上限回收最旧、复用不改变随机序列", () => {
    const { R } = loadGame();
    R(`(function () {
      _particlePool.length = 0; particles.length = 0;
      let n = 0; const orig = Math.random;
      Math.random = function () { n++; return orig(); };
      spawnParticles(100, 100, 10, '#fff');
      window.__randCount = n;
    })()`);
    // 每个粒子 5 次 rand：angle / speed / life / size / rot
    expect(R("__randCount")).toBe(50);
    expect(R("particles.length")).toBe(10);
    // 全部死亡：原地压缩并回收进池
    R(`particles.forEach(p => { p.life = 0; }); updateParticlesInPlace(0.016);`);
    expect(R("particles.length")).toBe(0);
    expect(R("_particlePool.length")).toBe(10);
    // 再生成 1 个：复用池对象，rand 调用次数仍为 5（随机序列不被池化扰动）
    R(`(function () {
      let n = 0; const orig = Math.random;
      Math.random = function () { n++; return orig(); };
      spawnParticles(0, 0, 1, '#fff');
      window.__randCount2 = n;
    })()`);
    expect(R("__randCount2")).toBe(5);
    expect(R("_particlePool.length")).toBe(9);
    expect(R("particles.length")).toBe(1);
  });

  it("粒子/伤害数字超上限：丢弃最旧、长度有界、无空洞", () => {
    const { R } = loadGame();
    R(`particles.length = 0; _particlePool.length = 0; spawnParticles(0, 0, 260, '#fff');`);
    expect(R("particles.length")).toBe(200);
    expect(R("particles.every(p => p && typeof p.update === 'function')")).toBe(true);
    R(`damageNumbers.length = 0; _damageNumberPool.length = 0; for (let i = 0; i < 120; i++) spawnDamageNumber(i, i, i, '#fff');`);
    expect(R("damageNumbers.length")).toBe(80);
    expect(R("damageNumbers.every(d => d && typeof d.update === 'function')")).toBe(true);
    expect(R("_damageNumberPool.length")).toBeLessThanOrEqual(1); // 回收对象被下一次 spawn 立即复用
    R(`updateDamageNumbersInPlace(0.016)`);
    expect(R("damageNumbers.length")).toBe(80);
    expect(R("damageNumbers.every(d => d && typeof d.update === 'function')")).toBe(true);
  });

  it("分离力空间网格与全遍历数学一致（密集簇 + 越界实体）", () => {
    const { R } = loadGame();
    R(`(function () {
      game.enemies.length = 0;
      for (let i = 0; i < 20; i++) game.enemies.push(new Enemy(500 + (i % 5) * 14, 500 + Math.floor(i / 5) * 14, 'zombie', 0));
      game.enemies.push(new Enemy(1800, 1200, 'brute', 0));
      game.enemies.push(new Enemy(200, 200, 'runner', 0));
      game.enemies.push(new Enemy(WORLD_W / 2, MOON_DOMAIN.y, 'moonwitch', 0));
      game.enemies.push(new Enemy(WORLD_W / 2 + 20, MOON_DOMAIN.y + 10, 'moonshade', 0));
      buildSepGrid(game.enemies, game.time);
      window.__sepDiff = 0;
      for (const e of game.enemies) {
        sepForce(e);
        const gx = _sepOutX, gy = _sepOutY;
        let sx = 0, sy = 0;
        for (const other of game.enemies) {
          if (other === e || !other.alive) continue;
          const od = dist(e, other), minDist = (e.size + other.size) * 0.9;
          if (od < minDist && od > 0) { sx += (e.x - other.x) / od * (minDist - od) * 0.5; sy += (e.y - other.y) / od * (minDist - od) * 0.5; }
        }
        window.__sepDiff = Math.max(window.__sepDiff, Math.abs(gx - sx), Math.abs(gy - sy));
      }
    })()`);
    expect(R("__sepDiff")).toBeLessThan(1e-9);
  });

  it("HUD Boss 扫描：bossOnField=false 时不遍历 enemies", () => {
    const { R } = loadGame();
    R(`(function () {
      initGame(); game.state = 'playing'; game.bossOnField = false;
      window.__findCalls = 0;
      game.enemies = new Proxy([], { get(t, p) { if (p === 'find') window.__findCalls++; return t[p]; } });
      updateHud();
    })()`);
    expect(R("__findCalls")).toBe(0);
    R(`game.bossOnField = true; updateHud();`);
    expect(R("__findCalls")).toBe(1);
  });

  it("满配渲染：毒云/奇点/飞刃/精灵/陨石/护盾/玩家辉光全走缓存且条目有界", () => {
    const { R } = loadGame();
    R(`(function () {
      initGame(); game.state = 'playing';
      Object.keys(START_WEAPON_DEFS).forEach(k => { if (k !== 'magic_missile') game.player.weapons.push(START_WEAPON_DEFS[k]()); });
      const w = game.player.weapons.find(w => w.type === 'plague_cloud'); w.cloudCount = 3;
      game.clouds.push({ x: game.player.x, y: game.player.y, radius: w.radius, life: 2, maxLife: 4 });
      game.wells.push({ x: game.player.x + 80, y: game.player.y, radius: 240, life: 2, maxLife: 3.5, spin: 0, explodeRadius: 130 });
      game.meteorVisuals.push({ x: game.player.x, y: game.player.y, targetY: game.player.y, radius: 100, landed: false, landTimer: 0.5 });
      game.player.soulShield = true; game.player.soulShieldMax = 100; game.player.soulShieldAmount = 100;
      for (let i = 0; i < 12; i++) game.enemies.push(new Enemy(600 + i * 30, 400, 'zombie', 0));
    })()`);
    for (let i = 0; i < 3; i++) R("draw(ctx)");
    expect(R("_gradCache.size")).toBeGreaterThan(5);
    expect(R("_gradCache.size")).toBeLessThan(520);
  });
});
