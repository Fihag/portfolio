import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import vm from "vm";
import { loadGame } from "./helpers.js";

describe("魔法幸存者 · 运行时帧模拟（重构回归）", () => {
  it("全难度 initGame → update 300 帧 → draw 不抛错", () => {
    const { R } = loadGame();
    for (const dk of ["easy", "normal", "hard", "hell", "impossible"]) {
      R(`initGame(); game.selectedDifficulty='${dk}';`);
      for (let i = 0; i < 300; i++) {
        expect(() => R(`update(1/60)`)).not.toThrow();
        expect(() => R(`draw(ctx)`)).not.toThrow();
      }
    }
  });

  it("全敌种类 + 词缀 + Boss 在场时运行不抛错", () => {
    const { R } = loadGame();
    R(`initGame(); game.selectedDifficulty='impossible';`);
    R(`
      ['zombie','runner','brute','wraith','pyromancer','hatchling','lavaling'].forEach((tk,i)=>{
        const e = new Enemy(200+i*80, 300, tk, 7);
        e.affixName='迅捷'; e.affixColor='#55ddff';
        game.enemies.push(e);
      });
      ['boss','broodmother','assassin','lavabeast'].forEach((tk,i)=>{
        const e = new Enemy(300+i*120, 500, tk, 7);
        game.enemies.push(e);
      });
      game.bossOnField = true;
      game.spawnTimer = 0; game.bossTimer = 0;
    `);
    for (let i = 0; i < 400; i++) {
      expect(() => R(`update(1/60)`)).not.toThrow();
      expect(() => R(`draw(ctx)`)).not.toThrow();
    }
  });

  it("熔岩巨兽濒死爆燃 / 刺客闪现 / 母皇产卵 / 巨兽冲锋 不抛错", () => {
    const { R } = loadGame();
    R(`initGame();`);
    R(`
      const lb = new Enemy(400, 300, 'lavabeast', 7);
      lb.hp = 1; game.enemies.push(lb);
      const as = new Enemy(600, 300, 'assassin', 7);
      as.teleportTX = 300; as.teleportTY = 500; as.teleportTimer = 0;
      game.enemies.push(as);
      const bm = new Enemy(800, 300, 'broodmother', 7);
      bm.summonTimer = 0; bm.acidTimer = 0;
      game.enemies.push(bm);
      const lv = new Enemy(500, 500, 'lavabeast', 7);
      lv.lavaChargeTimer = 0; lv.lavaEruptTimer = 0;
      game.enemies.push(lv);
    `);
    for (let i = 0; i < 300; i++) {
      expect(() => R(`update(1/60)`)).not.toThrow();
      expect(() => R(`draw(ctx)`)).not.toThrow();
    }
  });

  it("武器全解锁 + 升级 + 进化 + 死神之指手动 不抛错", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    R(`Object.keys(START_WEAPON_DEFS).forEach(k => { game.player.weapons.push(START_WEAPON_DEFS[k]()); });`);
    R(`SKILL_REGISTRY.forEach(s => { if (s.id.startsWith('unlock_')) game.player['_skill_'+s.id] = 1; });`);
    for (let i = 0; i < 200; i++) {
      expect(() => R(`update(1/60)`)).not.toThrow();
      expect(() => R(`draw(ctx)`)).not.toThrow();
    }
    R(`game.deathMark.enabled = true; game.deathMark.mode = 'manual';`);
    R(`const e = new Enemy(500, 400, 'boss', 7); game.enemies.push(e);`);
    R(`dmTrySelectAt(500 + cam.x, 400 + cam.y);`);
    expect(() => R(`update(1/60)`)).not.toThrow();
    R(`if (game.deathMark.targets[0]) dmResolve(game.deathMark.targets[0]);`);
    expect(() => R(`update(1/60)`)).not.toThrow();
  });

  it("受击触发影侍守卫 / 击杀结算 / 存档 / 菜单渲染 不抛错", () => {
    const { R } = loadGame();
    R(`initGame(); metaData.shards = 999; saveMeta();`);
    R(`setRelicActive('relic_shadow_clone', true);`);
    R(`initGame(); game.state='playing';`);
    R(`const e = new Enemy(300, 300, 'zombie', 0); game.enemies.push(e);`);
    for (let i = 0; i < 100; i++) {
      expect(() => R(`update(1/60)`)).not.toThrow();
    }
    expect(() => R(`game.player.takeDamage(50, 'default')`)).not.toThrow();
    expect(() => R(`game.player.takeDamage(99999, 'default', true)`)).not.toThrow();
    expect(() => R(`settleShards()`)).not.toThrow();
    expect(() => R(`renderMenu(ctx)`)).not.toThrow();
    expect(() => R(`renderMetaPanel(ctx)`)).not.toThrow();
    expect(() => R(`updateHud()`)).not.toThrow();
  });

  it("精英波次 + 祭坛 + 宝箱 + 传送门 不抛错", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    R(`startEliteWave();`);
    for (let i = 0; i < 200; i++) {
      expect(() => R(`update(1/60)`)).not.toThrow();
      expect(() => R(`draw(ctx)`)).not.toThrow();
    }
    expect(() => R(`spawnChest(); spawnAltar();`)).not.toThrow();
    for (let i = 0; i < 120; i++) {
      expect(() => R(`update(1/60)`)).not.toThrow();
      expect(() => R(`draw(ctx)`)).not.toThrow();
    }
  });

  it("升级面板 / Boss掉落 / 死神之指购买 不抛错", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    expect(() =>
      R(`
      const ch1 = generateUpgradeChoices(game.player);
      if (!ch1.length) throw new Error('no choices');
      showLevelupPanel(ch1); game.applyUpgrade(ch1[0]);
      game.state='bossdrop';
      showBossDropPanel(BOSS_DROP_ITEMS.slice(0,3)); applyBossDrop(BOSS_DROP_ITEMS[0]);
      metaData.shards = 6000; saveMeta();
      const r = META_RELICS.find(x => x.id === 'relic_deathmark');
      if (!r) throw new Error('relic_deathmark missing');
      if (!buyRelic(r.id)) throw new Error('buyRelic failed with enough shards');
      loadMeta();
    `)
    ).not.toThrow();
    expect(R(`relicLevel("relic_deathmark")`)).toBe(1);
    expect(R(`isRelicActive("relic_deathmark")`)).toBe(true);
  });

  it("debug.js 加载 + dbgInit + 面板操作 不抛错", () => {
    const { sandbox, R } = loadGame();
    const code = readFileSync(join(process.cwd(), "js", "debug.js"), "utf8");
    expect(() => vm.runInContext(code, sandbox, { filename: "debug.js" })).not.toThrow();
    expect(() => R(`dbgInit(); dbgToggle();`)).not.toThrow();
    expect(() => R(`dbgSpawnEnemy('boss', 2); dbgSpawnBoss('lavabeast');`)).not.toThrow();
    expect(() => R(`dbg.pauseGame = true; update(1/60); draw(ctx);`)).not.toThrow();
    if (R(`typeof dbgRelicPopulate`) === "function") {
      expect(() => R(`dbgRelicPopulate()`)).not.toThrow();
    }
  });

  it("存档签名：篡改后自动清除", () => {
    const { R } = loadGame();
    R(`
      loadMeta();
      const meta = JSON.parse(localStorage.getItem('rogue_meta') || '{}');
      meta.shards = 12345;
      localStorage.setItem('rogue_meta', JSON.stringify(meta));
      loadMeta();
    `);
    expect(R(`(loadMeta().shards || 0)`)).toBe(0);
  });
});
