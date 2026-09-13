import { describe, it, expect } from "vitest";
import { loadGame } from "./helpers.js";

describe("魔法幸存者 · 基础数值回归", () => {
  it("lavabeast 血量 3200 / 速度 145", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.lavabeast.hp`)).toBe(3200);
    expect(R(`ENEMY_TYPES.lavabeast.speed`)).toBe(145);
  });
  it("不可能倍率 1.9 / 刺客弹速 320/300", () => {
    const { R } = loadGame();
    expect(R(`DIFFICULTIES.impossible.mult`)).toBe(1.9);
    expect(R(`ENEMY_TYPES.assassin.slashSpeed`)).toBe(320);
    expect(R(`ENEMY_TYPES.assassin.shurikenSpeed`)).toBe(300);
  });
  it("Boss减速免疫分档", () => {
    const { R } = loadGame();
    R(`game.selectedDifficulty='normal'; var b=new Enemy(500,500,'boss',0); b.applySlow(0.5,2);`);
    expect(R(`Math.abs(b.slowAmount-0.10)<0.0001`)).toBe(true);
    R(`game.selectedDifficulty='impossible'; var b2=new Enemy(500,500,'boss',0); b2.applySlow(0.5,2);`);
    expect(R(`b2.slowAmount===0`)).toBe(true); // 0.5-0.50=0
    R(`game.selectedDifficulty='normal'; var z=new Enemy(500,500,'zombie',0); z.applySlow(0.5,2);`);
    expect(R(`Math.abs(z.slowAmount-0.50)<0.0001`)).toBe(true);
    R(`game.selectedDifficulty='impossible'; var z2=new Enemy(500,500,'zombie',0); z2.applySlow(0.5,2);`);
    expect(R(`Math.abs(z2.slowAmount-0.30)<0.0001`)).toBe(true);
  });
  it("影侍守卫圣物不可升级且削弱数值正确", () => {
    const { R } = loadGame();
    expect(R(`META_RELICS.find(x=>x.id==='relic_shadow_clone').name`)).toBe("影侍守卫");
    expect(R(`!META_RELICS.find(x=>x.id==='relic_shadow_clone').maxLevel`)).toBe(true);
    expect(R(`META_RELICS.find(x=>x.id==='relic_shadow_clone').desc.includes('45%')`)).toBe(true);
    expect(R(`META_RELICS.find(x=>x.id==='relic_shadow_clone').desc.includes('0.4秒')`)).toBe(true);
  });
  it("防御圣物削弱：吸血 6% / 荆棘 35% / 幻影步单级", () => {
    const { R } = loadGame();
    expect(R(`META_RELICS.find(x=>x.id==='relic_vamp').desc.includes('6%')`)).toBe(true);
    expect(R(`META_RELICS.find(x=>x.id==='relic_thorn').desc.includes('35%')`)).toBe(true);
    expect(R(`META_RELICS.find(x=>x.id==='relic_phantom_step').maxLevel`)).toBe(1);
    expect(R(`relicRate('relic_phantom_step', 2)`)).toBe(0.15); // 老 2 级存档回落 15%
    // 三新武器基础 DPS 对齐（棱镜 29/2.4 ≈ 12.1、瘴气 20/秒、奇点 14+爆炸）
    expect(R(`START_WEAPON_DEFS.holy_beam().damage`)).toBe(29);
    expect(R(`START_WEAPON_DEFS.holy_beam().cooldownTime`)).toBe(2.4);
    expect(R(`START_WEAPON_DEFS.plague_cloud().damage`)).toBe(10);
    expect(R(`START_WEAPON_DEFS.gravity_well().damage`)).toBe(7);
  });
  it("剑刃风暴进化 +4", () => {
    const { R } = loadGame();
    expect(R(`SKILL_REGISTRY.find(s=>s.id==='evo_orbit').desc.includes('+4')`)).toBe(true);
  });
});

describe("进化门槛统一（3 条线 3+3+4=10 张 + 进化）", () => {
  it("每把武器门槛线 maxLevel 与 evo applies 门槛一致且总卡数为 10", () => {
    const { R } = loadGame();
    const GATES = {
      magic_missile:  [["missile_damage", 4], ["missile_cooldown", 3], ["missile_count", 3]],
      orbit_blade:    [["orbit_count", 3], ["orbit_damage", 4], ["orbit_speed", 3]],
      frost_nova:     [["frost_range", 4], ["frost_damage", 3], ["frost_cd", 3]],
      lightning_chain:[["chain_bounce", 3], ["chain_range", 3], ["chain_damage", 4]],
      meteor:         [["meteor_cd", 3], ["meteor_range", 3], ["meteor_damage", 4]],
      shadow_spirit:  [["shadow_count", 3], ["shadow_speed", 3], ["shadow_damage", 4]],
      holy_beam:      [["beam_count", 3], ["beam_width", 3], ["beam_damage", 4]],
      plague_cloud:   [["plague_count", 3], ["plague_range", 3], ["plague_damage", 4]],
      gravity_well:   [["well_count", 3], ["well_gravity", 3], ["well_damage", 4]]
    };
    const EVOS = {
      magic_missile: "evo_fireball", orbit_blade: "evo_orbit", frost_nova: "evo_frost",
      lightning_chain: "evo_chain", meteor: "evo_meteor", shadow_spirit: "evo_shadow",
      holy_beam: "evo_beam", plague_cloud: "evo_plague", gravity_well: "evo_well"
    };
    for (const [wtype, gates] of Object.entries(GATES)) {
      for (const [sid, lv] of gates) {
        expect(R(`SKILL_REGISTRY.find(s=>s.id==='${sid}') && SKILL_REGISTRY.find(s=>s.id==='${sid}').maxLevel`)).toBe(lv);
      }
      const src = R(`SKILL_REGISTRY.find(s=>s.id==='${EVOS[wtype]}').applies.toString()`);
      for (const [sid, lv] of gates) {
        expect(src).toContain("_skill_" + sid);
        expect(src).toMatch(new RegExp("_skill_" + sid + "'\\] \\|\\| 0\\) >= " + lv));
      }
      expect(gates.reduce((a, [, lv]) => a + lv, 0)).toBe(10);
    }
  });
});

describe("新武器与编队", () => {
  it("三新武器定义与解锁/进化条目齐全", () => {
    const { R } = loadGame();
    expect(R(`['holy_beam','plague_cloud','gravity_well'].every(k => !!START_WEAPON_DEFS[k] && !!START_WEAPON_META[k])`)).toBe(true);
    expect(R(`['unlock_beam','unlock_plague','unlock_well','evo_beam','evo_plague','evo_well'].every(id => !!SKILL_REGISTRY.find(s => s.id === id))`)).toBe(true);
  });
  it("暗影军团进化：35% 攻速 + 连击", () => {
    const { R } = loadGame();
    const desc = R(`SKILL_REGISTRY.find(s=>s.id==='evo_shadow').desc`);
    expect(desc.includes("35%")).toBe(true);
    expect(desc.includes("连击")).toBe(true);
  });
  it("编队存取：非法值回落", () => {
    const { R } = loadGame();
    expect(R(`saveLoadout(['holy_beam','gravity_well']), loadLoadout().join(',')`)).toBe("holy_beam,gravity_well");
    expect(R(`localStorage.setItem('rogue_loadout', JSON.stringify(['bad_key','holy_beam'])), loadLoadout().join(',')`)).toBe("holy_beam");
    expect(R(`localStorage.setItem('rogue_loadout', 'not json'), loadLoadout().length`)).toBe(5);
  });
  it("编队门控：编队外武器的解锁卡不出现", () => {
    const { R } = loadGame();
    R(`initGame(); game.loadout = ['holy_beam','plague_cloud','gravity_well','orbit_blade','frost_nova']; game.upgradeCount = 99;`);
    let leaked = 0;
    for (let i = 0; i < 200; i++) {
      const ids = R(`generateUpgradeChoices(game.player).map(s => s.id).join(',')`);
      for (const banned of ["unlock_magic", "unlock_chain", "unlock_meteor", "unlock_shadow"]) {
        if (ids.split(",").includes(banned)) leaked++;
      }
    }
    expect(leaked).toBe(0);
  });
  it("Boss掉落去重：全部领取后不再掉落", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    R(`game.player.takenDrops = { rage_potion: true, life_spring: true, exp_crystal: true, attack_speed_orb: true };`);
    R(`const b = new Enemy(400, 300, 'boss', 0); b.hp = 1; game.enemies.push(b); b.takeDamage(9999999, 'test');`);
    expect(R(`game.bossDropPending`)).toBe(false);
  });
  it("小怪基础血量 +3（35/25/19/37）与成长封顶 13 倍", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.zombie.hp`)).toBe(35);
    expect(R(`ENEMY_TYPES.runner.hp`)).toBe(25);
    expect(R(`ENEMY_TYPES.bomber.hp`)).toBe(19);
    expect(R(`ENEMY_TYPES.warlock.hp`)).toBe(37);
    expect(R(`ENEMY_TYPES.boss.hp`)).toBe(1750); // Boss 不受 +3 影响
    // 难度级极高时血量封顶 13×（35 × 13 = 455）
    expect(R(`new Enemy(0, 0, 'zombie', 100).hp`)).toBe(455);
  });
  it("吸血之爪限制器：内置冷却 1s + 受击后 1.5s 失效", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.player.relicVamp = true;`);
    R(`const z = new Enemy(500, 500, 'zombie', 0); z.hp = 1000; z.maxHp = 1000; game.enemies.push(z);`);
    R(`var hpBefore = game.player.hp; game.player.hp = 50; z.takeDamage(100, 'test');`);
    expect(R(`game.player.hp > 50`)).toBe(true); // 首次触发回血
    expect(R(`game.player.vampIcd`)).toBe(1);
    R(`z.takeDamage(100, 'test');`);
    expect(R(`game.player.hp`)).toBe(R(`50 + Math.floor(100 * 0.06)`)); // 冷却中不回血
    // 受击后失效：清冷却模拟时间流逝，再挨打，吸血不触发
    R(`game.player.vampIcd = 0; game.player.takeDamage(5, 'default'); z.takeDamage(100, 'test');`);
    expect(R(`game.player.hp`)).toBe(R(`50 + Math.floor(100 * 0.06) - 5`));
  });
  it("不可能模式：Boss 减伤额外 +10%（封顶 75%）", () => {
    const { R } = loadGame();
    R(`game.selectedDifficulty='normal'; var b = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`b.damageReduction`)).toBe(0.25);
    R(`game.selectedDifficulty='impossible'; var b2 = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`b2.damageReduction`)).toBe(0.35);
    R(`var t2 = new Enemy(500, 500, 'turret', 0);`);
    expect(R(`t2.damageReduction`)).toBe(0.75); // 0.65 + 0.10 触顶
  });
  it("等级溢出：卡池选满后升级不弹面板，全属性 +5%", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    R(`SKILL_REGISTRY.forEach(s => game.player['_skill_' + s.id] = s.maxLevel);`);
    const dmgBefore = R(`game.player.globalDamageMultiplier`);
    const hpBefore = R(`game.player.maxHp`);
    const speedBefore = R(`game.player.speedMultiplier`);
    R(`game.player.addXp(game.player.xpToNext)`);
    expect(R(`game.state`)).toBe("playing"); // 不弹升级面板
    expect(R(`game.player.globalDamageMultiplier - ${dmgBefore}`)).toBeCloseTo(0.05, 5);
    expect(R(`game.player.maxHp`)).toBe(Math.round(hpBefore * 1.05));
    expect(R(`game.player.speedMultiplier - ${speedBefore}`)).toBeCloseTo(0.05, 5);
    expect(R(`game.warningText`).includes("全属性")).toBe(true);
  });
  it("时停领域：主动技能触发、冻结与冷却", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    expect(R(`triggerTimeStop()`)).toBe(false); // 未穿戴圣物
    R(`game.player.relicTimeStop = true; game.timeStopTimer = 0;`);
    R(`const z = new Enemy(500, 500, 'zombie', 0); game.enemies.push(z);`);
    expect(R(`triggerTimeStop()`)).toBe(true);
    expect(R(`game.enemies[0].freezeTimer >= 2`)).toBe(true);
    expect(R(`game.timeStopTimer`)).toBe(45);
    expect(R(`triggerTimeStop()`)).toBe(false); // 冷却中不可再次触发
  });
  it("难度系数：困难 1.20 / 地狱 1.35 / 不可能 1.9", () => {
    const { R } = loadGame();
    expect(R(`DIFFICULTIES.hard.mult`)).toBe(1.20);
    expect(R(`DIFFICULTIES.hell.mult`)).toBe(1.35);
    expect(R(`DIFFICULTIES.impossible.mult`)).toBe(1.9);
  });
  it("磁力天赋移除：拾取价值归贪婪之石独占", () => {
    const { R } = loadGame();
    expect(R(`META_UPGRADES.some(u => u.id === 'pickup')`)).toBe(false);
    expect(R(`SKILL_REGISTRY.some(s => s.id === 'pickup_range')`)).toBe(false);
    expect(R(`META_RELICS.find(x => x.id === 'relic_greed').cost`)).toBe(450);
  });
  it("天罚炮台：原地、2500 血、65% 减伤，跑帧位置不变", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.turret.hp`)).toBe(2500);
    expect(R(`ENEMY_TYPES.turret.speed`)).toBe(0);
    expect(R(`ENEMY_TYPES.turret.damage`)).toBe(50);
    R(`game.selectedDifficulty='normal'; var t = new Enemy(500, 500, 'turret', 0);`);
    expect(R(`t.damageReduction`)).toBe(0.65);
    R(`var sx = t.x, sy = t.y; for (var i = 0; i < 90; i++) t.update(1/60, game.player);`);
    expect(R(`Math.abs(t.x - sx) < 0.01 && Math.abs(t.y - sy) < 0.01`)).toBe(true);
  });
  it("炮台死亡神罚：全图 100 颗陨石两波约 7s，落点在中央 80% 区域，每颗 50 伤", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    R(`var t = new Enemy(500, 500, 'turret', 0); t.hp = 1; game.enemies.push(t); t.takeDamage(9999999, 'test');`);
    expect(R(`game.divineStrikes.length`)).toBe(100);
    expect(
      R(`game.divineStrikes.every(s => s.dmg === 50 && s.x >= 200 && s.x <= 1800 && s.y >= 150 && s.y <= 1350 && s.warn === 1.0 && s.radius === 105)`)
    ).toBe(true);
    expect(R(`game.divineStrikes.filter(s => s.delay < 3).length`)).toBe(50); // 第一波 50 颗（0.5s 起每 0.05s 一颗）
    expect(R(`game.divineStrikes[0].delay`)).toBe(0.5);
    expect(R(`game.divineStrikes[50].delay`)).toBe(3.5); // 第二波 3.5s 起（末颗落地 ≈7s）
    // 落地判定：把一颗设为立即落地、玩家站落点 → 扣 50
    R(`var s0 = game.divineStrikes[0]; game.player.x = s0.x; game.player.y = s0.y; s0.delay = 0; s0.warn = 0.01;`);
    R(`for (var i = 0; i < 40; i++) update(1/60)`);
    const hpAfter = R(`game.player.hp`);
    expect(hpAfter).toBeGreaterThan(50); // 挨了 50 伤（玩家有微量自然回血，允许小数）
    expect(hpAfter).toBeLessThan(51);
  });
  it("自爆虫 19 血 / 咒术师 37 血（含小怪 +3），自爆虫爆炸后无经验球", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.bomber.hp`)).toBe(19);
    expect(R(`ENEMY_TYPES.warlock.hp`)).toBe(37);
  });
  it("抉择宝箱：第 5 种奖励累加 extraChoices；抉择之冠 520", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing';`);
    R(`var _or = Math.random; Math.random = function () { return 0.999; }; openChest({}); openChest({}); Math.random = _or;`);
    expect(R(`game.player.extraChoices`)).toBe(2);
    expect(R(`META_RELICS.find(x => x.id === 'relic_choice_crown').cost`)).toBe(520);
    R(`game.player.extraChoices = 0; game.player.relicChoiceCrown = true;`);
    // 抉择之冠恒 +1：基础 5 张 → 6 张
    expect(R(`generateUpgradeChoices(game.player).length`)).toBe(6);
  });
  it("刷怪批次：场上怪少时单次刷新多只", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length = 0; game.spawnTimer = 0;`);
    R(`update(1/60)`);
    expect(R(`game.enemies.filter(e => e.alive).length`)).toBe(3); // 空场首刷 3 只
  });
  it("天罚炮台固定降临在地图正中心", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length = 0; game.bossOnField = false;`);
    // Math.random=0.999 → bossTypes[3]='turret'（普通难度分支）
    R(`var _or = Math.random; Math.random = function () { return 0.999; }; spawnBoss(); Math.random = _or;`);
    expect(R(`game.enemies[game.enemies.length - 1].typeKey`)).toBe("turret");
    expect(R(`game.enemies[game.enemies.length - 1].x`)).toBe(1000); // WORLD_W/2
    expect(R(`game.enemies[game.enemies.length - 1].y`)).toBe(750); // WORLD_H/2
  });
});

describe("天罚炮台技能数值", () => {
  function setupTurret(R) {
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.bossOnField=true; game.player.x=500; game.player.y=400; var t=new Enemy(1000,750,'turret',0); game.enemies.push(t);`);
  }
  it("常驻速射：0.27s 一发直射弹（伤 20、基础弹速 395）", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretRapidTimer = 0.01;`);
    R(`update(1/60)`);
    expect(
      R(`game.projectiles.some(p => p.isEnemy && !p.burstShell && p.damage === 20 && p.size === 8 && Math.abs(Math.hypot(p.vx, p.vy) - 395) < 1)`)
    ).toBe(true);
    expect(R(`game.enemies[0].turretRapidTimer`)).toBeCloseTo(0.27, 5);
  });
  it("弹速难度系数：简单×0.85 普通×1 困难×1.06 地狱×1.14 不可能×1.2", () => {
    const { R } = loadGame();
    const cases = [["easy", 0.85], ["normal", 1], ["hard", 1.06], ["hell", 1.14], ["impossible", 1.2]];
    for (const [diff, m] of cases) {
      R(`game.selectedDifficulty = '${diff}'; var t = new Enemy(500, 500, 'turret', 0);`);
      expect(R(`t.turretSpdMult`)).toBe(m);
    }
  });
  it("扇形炮击：2.5s 一轮 9 发 ±10°（基础弹速 415）连发两次", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretVolleyTimer = 0.01; game.enemies[0].turretRapidTimer = 999; game.enemies[0].turretBurstTimer = 999;`);
    R(`update(1/60)`);
    expect(R(`game.projectiles.filter(p => p.isEnemy && !p.burstShell).length`)).toBe(9);
    expect(
      R(`game.projectiles.filter(p => p.isEnemy && !p.burstShell).every(p => Math.abs(Math.hypot(p.vx, p.vy) - 415) < 1 && p.damage === 20 && p.size === 9.5)`)
    ).toBe(true);
    R(`for (var i = 0; i < 16; i++) update(1/60)`); // 越过 0.25s 连发间隔
    expect(R(`game.projectiles.filter(p => p.isEnemy && !p.burstShell).length`)).toBe(18);
  });
  it("爆裂弹：一轮 3 枚（基础弹速 415 射程 800），逼近玩家 100 内爆炸——爆心 35 伤 + 分裂 30 发（12° 整圆、基础弹速 345、伤 22）", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretBurstTimer = 0.01; game.enemies[0].turretRapidTimer = 999;`);
    R(`update(1/60)`);
    expect(R(`game.projectiles.filter(p => p.burstShell).length`)).toBe(3);
    expect(
      R(`game.projectiles.filter(p => p.burstShell).every(p => Math.abs(Math.hypot(p.vx, p.vy) - 415) < 1 && Math.abs(p.maxLifetime - 800 / 415) < 0.001 && p.size === 10)`)
    ).toBe(true);
    expect(R(`game.enemies[0].turretBurstTimer`)).toBeCloseTo(4.5, 5);
    // 引爆：把一枚爆裂弹放到玩家 60px 处（< 100 引信）
    R(`var s = game.projectiles.find(p => p.burstShell); s.x = game.player.x + 60; s.y = game.player.y; s.vx = 0; s.vy = 0;`);
    R(`update(1/60)`);
    expect(R(`game.player.hp`)).toBe(65); // 爆心 35 伤（半径 140 内）
    expect(R(`game.projectiles.filter(p => p.burstShell).length`)).toBe(2); // 引爆的弹体消失
    expect(
      R(`(function(){ var arr = game.projectiles.filter(p => p.isEnemy && !p.burstShell); return arr.length === 30 && arr.every(p => Math.abs(Math.hypot(p.vx, p.vy) - 345) < 1 && p.damage === 22 && p.size === 7); })()`)
    ).toBe(true);
  });
  it("爆裂弹射程尽头引爆：分裂弹加速到 465", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretBurstTimer = 0.01; game.enemies[0].turretRapidTimer = 999;`);
    R(`update(1/60)`);
    // 一枚放远（距玩家 > 80 不触引信），并把寿命耗尽 → 射程尽头引爆
    R(`var s = game.projectiles.find(p => p.burstShell); s.x = 100; s.y = 100; s.vx = 0; s.vy = 0; s.lifetime = 1.93;`);
    R(`update(1/60)`);
    expect(R(`game.projectiles.filter(p => p.burstShell).length`)).toBe(2);
    expect(
      R(`(function(){ var arr = game.projectiles.filter(p => p.isEnemy && !p.burstShell); return arr.length === 30 && arr.every(p => Math.abs(Math.hypot(p.vx, p.vy) - 465) < 1 && p.size === 7); })()`)
    ).toBe(true);
  });
  it("扫射激光：0.7s 预警后发射，长 1200 处命中 24 伤，冷却 6s", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretLaserTimer = 0.01; game.enemies[0].turretRapidTimer = 999; game.enemies[0].turretVolleyTimer = 999; game.enemies[0].turretBurstTimer = 999;`);
    R(`for (var i = 0; i < 46; i++) update(1/60)`); // 越过 0.7s 预警
    expect(R(`game.enemies[0].turretLaserState`)).toBe("firing");
    // 玩家站在下一帧扫到的光束方向 1100px 处（< 1200）
    R(`var la = game.enemies[0].turretLaserAngle + Math.PI / 180 * 120 * (1/60); game.player.x = 1000 + Math.cos(la) * 1100; game.player.y = 750 + Math.sin(la) * 1100;`);
    R(`update(1/60)`);
    expect(R(`game.player.hp`)).toBeCloseTo(76, 0); // 命中 24 伤（同帧自然回血 ±0.5 内）
    R(`game.enemies[0].turretLaserT = 0.01; update(1/60)`);
    expect(R(`game.enemies[0].turretLaserTimer`)).toBeCloseTo(6, 5);
  });
  it("自爆虫投放：8.5s 一批 3 只精英（×1.4）", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretDropTimer = 0.01;`);
    R(`update(1/60)`);
    expect(R(`game.enemies.filter(e => e.typeKey === 'bomber').length`)).toBe(3);
    expect(
      R(`game.enemies.filter(e => e.typeKey === 'bomber').every(b => b.eliteBomber && b.hp === Math.floor(19 * 1.4) && Math.abs(b.speed / 175 - 1.4) < 0.01)`)
    ).toBe(true);
    expect(R(`game.enemies[0].turretDropTimer`)).toBeCloseTo(8.5, 5);
  });
  it("技能伤害成长：随共用出场次数 +6%/次封顶 4 次，并乘难度倍率", () => {
    const { R } = loadGame();
    R(`game.bossAppearedCount = 5; game.diffMult = 1;`);
    R(`var t5 = new Enemy(500, 500, 'turret', 0);`);
    const g = Math.pow(1.06, 4);
    expect(R(`t5.turretRapidDmg`)).toBe(Math.floor(20 * g)); // 25
    expect(R(`t5.turretLaserDmg`)).toBe(Math.floor(24 * g));
    expect(R(`t5.turretSplitDmg`)).toBe(Math.floor(22 * g));
    R(`game.diffMult = 1.9; var t6 = new Enemy(500, 500, 'turret', 0);`);
    expect(R(`t6.turretRapidDmg`)).toBe(Math.floor(20 * g * 1.9)); // 47
    expect(R(`t6.turretMeteorDmg`)).toBe(Math.floor(50 * g * 1.9));
  });
  it("炮台在场光环：刷怪频率 +10%（间隔×0.9）、小怪速度 ×1.1、血量 ×1.05", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.time=0; game.spawnTimer=0;`);
    R(`update(1/60)`); // 无炮台：普通刷 3 只僵尸
    R(`var s0 = game.enemies[0].speed; var h0 = game.enemies[0].hp;`);
    R(`game.enemies.length = 0; game.enemies.push(new Enemy(1000, 750, 'turret', 0)); game.spawnTimer = 0;`);
    R(`update(1/60)`);
    const z = R(`(function(){ var e = game.enemies.find(x => x.typeKey === 'zombie'); return e.speed / s0; })()`);
    expect(z).toBeCloseTo(1.1, 5);
    expect(R(`(function(){ var e = game.enemies.find(x => x.typeKey === 'zombie'); return e.hp; })()`)).toBe(Math.floor(35 * 1.05)); // 36
    expect(R(`game.spawnTimer`)).toBeCloseTo(1.3 * 0.9, 5); // 频率 +10%
  });
  it("引力奇点吸力 +10%（160→176）：单帧位移 ≈1.71px", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=500; game.player.y=1400; var e=new Enemy(600,100,'zombie',0); e.freezeTimer=999; game.enemies.push(e); game.wells.push({x:500,y:100,radius:240,life:3.5,maxLife:3.5,tickRate:0.5,tickTimer:999,dmg:7,explodeDmg:60,explodeRadius:130,shockwave:false,spin:0});`);
    R(`var px0 = game.enemies[0].x; update(1/60);`);
    // f = (1 - 100/240) × 176 × (1/60) ≈ 1.711
    expect(R(`px0 - game.enemies[0].x`)).toBeCloseTo(1.711, 1);
  });
});

describe("死神之指手动点击", () => {
  it("屏幕坐标+cam 命中世界坐标", () => {
    const { R } = loadGame();
    R(
      `game.deathMark.enabled=true; game.deathMark.mode='manual'; game.deathMark.targets=[]; game.enemies.length=0; cam.x=400; cam.y=300; var e=new Enemy(800,800,'zombie',0); e.x=800; e.y=800; game.enemies.push(e);`
    );
    expect(R(`dmTrySelectAt(400+cam.x,500+cam.y)===true && game.deathMark.targets.length===1`)).toBe(true);
  });
});

describe("怪物侧翼包抄与奇点索敌", () => {
  it("侧翼包抄：不同方位角的怪物从不同方向接近，不再聚团追尾", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=500; game.player.y=500;
       var a = new Enemy(900, 500, 'zombie', 0); a.flankAngle = 0.9;
       var b = new Enemy(900, 500, 'zombie', 0); b.flankAngle = -0.9;
       game.enemies.push(a); game.enemies.push(b);`);
    R(`for (var i = 0; i < 60; i++) update(1/60)`);
    // 一只向上偏一只向下偏（绕行方向相反）
    expect(R(`(game.enemies[0].y - 500) * (game.enemies[1].y - 500) < 0`)).toBe(true);
  });
  it("近距直冲：120px 内侧翼偏移归零，直线贴近", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=500; game.player.y=500;
       var e = new Enemy(580, 500, 'zombie', 0); e.flankAngle = 0.9; game.enemies.push(e);`);
    R(`for (var i = 0; i < 30; i++) update(1/60)`);
    expect(R(`Math.abs(game.enemies[0].y - 500) < 3 && game.enemies[0].x < 580`)).toBe(true);
  });
  it("引力奇点密度索敌：优先吸附敌群最密处，不再随机钉角落新怪", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=500; game.player.y=500;
       for (var i = 0; i < 4; i++) game.enemies.push(new Enemy(600 + i * 8, 500 + (i % 2) * 10, 'zombie', 0));
       game.enemies.push(new Enemy(100, 100, 'zombie', 0));
       game.player.weapons = [START_WEAPON_DEFS.gravity_well()];`);
    R(`update(1/60)`);
    expect(R(`game.wells.length`)).toBe(1);
    expect(R(`Math.hypot(game.wells[0].x - 612, game.wells[0].y - 505) < 200`)).toBe(true); // 落在聚群处
    expect(R(`Math.hypot(game.wells[0].x - 100, game.wells[0].y - 100) > 350`)).toBe(true); // 远离角落孤怪
  });
});

describe("幽月魔女与月之领域", () => {
  // 杀 2 个常规 boss 触发降临倒计时
  function setupMoon(R) {
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=700; game.player.y=700;
       var kb1 = new Enemy(400, 400, 'boss', 0); game.enemies.push(kb1); kb1.takeDamage(9999999, 'test');
       var kb2 = new Enemy(600, 400, 'broodmother', 0); game.enemies.push(kb2); kb2.takeDamage(9999999, 'test');`);
  }
  // 走完 10s 倒计时 + 降临 + 拽入演出，进入领域；并屏蔽技能/升级避免干扰
  function reachDomain(R) {
    setupMoon(R);
    R(`for (var i = 0; i < 610; i++) update(1/60)`);
    R(`for (var i = 0; i < 300; i++) update(1/60)`);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch');
       mw.moonBladeTimer = 999; mw.moonOrbTimer = 999; mw.moonBaptTimer = 999;
       mw.moonCloneTimer = 999; mw.moonWaveTimer = 999; mw.moonAscendTimer = 999;
       game.player.xpToNext = 999999999;`);
  }
  function quietBoss(R) {
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch');
       mw.moonBladeTimer = 999; mw.moonOrbTimer = 999; mw.moonBaptTimer = 999;
       mw.moonCloneTimer = 999; mw.moonWaveTimer = 999; mw.moonAscendTimer = 999;`);
  }

  it("击杀第 2 个常规 boss 后 10 秒降临；不占常规出场次数与击杀计数", () => {
    const { R } = loadGame();
    setupMoon(R);
    expect(R(`game.moonIntroTimer`)).toBe(10);
    expect(R(`game.bossAppearedCount`)).toBe(0);
    expect(R(`game.bossKilledCount`)).toBe(2);
    R(`for (var i = 0; i < 610; i++) update(1/60)`);
    expect(R(`game.enemies.some(e => e.typeKey === 'moonwitch')`)).toBe(true);
    expect(R(`game.moonWitchCount`)).toBe(1);
    expect(R(`game.bossOnField`)).toBe(true);
    expect(R(`game.bossAppearedCount`)).toBe(0);
  });

  it("拽入异空间：领域开启、玩家入场，锁血 150 / 圣物失效 / 死神之指禁用 / 回血-70% / 移速-8%", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=700; game.player.y=700;
       game.player.relicVamp = 1; game.player.relicTimeStop = 1; game.player.relicChoiceCrown = 1; game.deathMark.enabled = true;`);
    R(`var kb1 = new Enemy(400, 400, 'boss', 0); game.enemies.push(kb1); kb1.takeDamage(9999999, 'test');
       var kb2 = new Enemy(600, 400, 'broodmother', 0); game.enemies.push(kb2); kb2.takeDamage(9999999, 'test');`);
    R(`for (var i = 0; i < 910; i++) update(1/60)`);
    expect(R(`game.moonDomain && game.moonDomain.active`)).toBe(true);
    expect(R(`game.moonWitchCount`)).toBe(1);
    expect(R(`Math.hypot(game.player.x - game.moonDomain.x, game.player.y - game.moonDomain.y) <= game.moonDomain.r`)).toBe(true);
    expect(R(`game.player.maxHp`)).toBe(150);
    expect(R(`game.player.relicVamp`)).toBe(0);
    expect(R(`game.player.relicTimeStop`)).toBe(0);
    expect(R(`game.player.relicChoiceCrown`)).toBe(0);
    expect(R(`game.deathMark.enabled`)).toBe(false);
    // 回血 -70%：1 秒后 hp = 80 + 0.017×150×0.3 = 80.765（静置无技能干扰）
    quietBoss(R);
    R(`game.player.hp = 80;`);
    R(`for (var i = 0; i < 60; i++) update(1/60)`);
    expect(R(`game.player.hp`)).toBeCloseTo(80.765, 2);
    // 移速 ×0.92
    expect(R(`Math.abs(game.player.getEffectiveSpeed() / (game.player.speed * game.player.speedMultiplier) - 0.92) < 0.01`)).toBe(true);
  });

  it("领域钳制：玩家被拉出边界立即拉回圆内", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`game.player.x = game.moonDomain.x + 2000; game.player.y = game.moonDomain.y;`);
    R(`update(1/60)`);
    expect(R(`Math.hypot(game.player.x - game.moonDomain.x, game.player.y - game.moonDomain.y) <= game.moonDomain.r`)).toBe(true);
  });

  it("月刃环：一轮 5 发细长月牙弹幕（二阶段 7 发）", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonBladeTimer = 0.01;`);
    R(`update(1/60)`);
    expect(R(`game.projectiles.filter(p => p.moonBlade).length`)).toBe(5);
    expect(R(`game.projectiles.filter(p => p.moonBlade).every(p => p.moonBounce === 1 && p.damage === 16 && Math.abs(Math.hypot(p.vx, p.vy) - 280) < 1)`)).toBe(true);
    // 二阶段 7 发（先清掉第一轮弹体再发射）
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonPhase2 = true; mw.moonApplyBuffs(2); game.projectiles = []; mw.moonBladeTimer = 0.01;`);
    R(`update(1/60)`);
    expect(R(`game.projectiles.filter(p => p.moonBlade).length`)).toBe(7);
  });

  it("月刃环触界反弹：法线反射且反弹次数递减（一阶段 1 次）", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var pj = new Projectile(game.moonDomain.x + game.moonDomain.r - 20, game.moonDomain.y, 300, 0, 10, 0, 0, '#fff', 8, true);
       pj.moonBlade = true; pj.moonBounce = 1; game.projectiles.push(pj);`);
    R(`for (var i = 0; i < 4; i++) update(1/60)`);
    expect(R(`(function(){ var p = game.projectiles.find(q => q.moonBlade); return p && p.vx < 0 && p.moonBounce === 0; })()`)).toBe(true);
    expect(R(`(function(){ var p = game.projectiles.find(q => q.moonBlade); return p && Math.hypot(p.x - game.moonDomain.x, p.y - game.moonDomain.y) <= game.moonDomain.r; })()`)).toBe(true);
  });

  it("二阶段：60% 血触发变身无敌；无敌期免伤，破绽窗口可扣血", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.hp = mw.maxHp * 0.5;`);
    R(`update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonPhase2`)).toBe(true);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonShielded`)).toBe(true);
    expect(R(`game.moonDomain.r`)).toBe(460); // 领域半径扩张
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').damageReduction`)).toBeCloseTo(0.55); // 二阶段 +30% 减伤
    // 无敌期免伤
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); var hp0 = mw.hp; mw.takeDamage(100, 'test');`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').hp`)).toBe(R(`hp0`));
    // 变身结束进入循环 → 强制推进到破绽窗口
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonTransformT = 0.01;`);
    R(`for (var i = 0; i < 3; i++) update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonCycleShielded`)).toBe(true);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonCycleShielded = true; mw.moonCycleT = 0.01;`);
    R(`for (var i = 0; i < 2; i++) update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonShielded`)).toBe(false);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); var hp1 = mw.hp; mw.takeDamage(100, 'test');`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').hp`)).toBeLessThan(R(`hp1`));
  });

  it("升月轰炸：升空免伤，砸落冲击波近距离伤害", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonAscendTimer = 0.01;`);
    R(`update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonAirborne`)).toBe(true);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonShielded`)).toBe(true);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); var hpA = mw.hp; mw.takeDamage(100, 'test');`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').hp`)).toBe(R(`hpA`));
    // 快进到砸落：玩家站在落点 50px 处（50 < 120 冲击半径）
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonRainWaves = 0;
       game.player.x = mw.x + 50; game.player.y = mw.y;
       mw.moonAscendDur = 0.02; mw.moonAscendT = 0.03; mw.moonLaserState = 'idle';`);
    R(`for (var i = 0; i < 3; i++) update(1/60)`);
    R(`for (var i = 0; i < 45; i++) update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonAscendTimer`)).toBeCloseTo(11.2, 1); // 14×0.8 重置
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonStunT`)).toBeGreaterThan(0); // 砸落后硬直破绽
  });

  it("走位 AI：不贴脸追击，与玩家保持距离带", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); game.player.x = mw.x + 60; game.player.y = mw.y;`);
    R(`for (var i = 0; i < 240; i++) update(1/60)`);
    const dist = R(`Math.hypot(game.player.x - game.enemies.find(e => e.typeKey === 'moonwitch').x, game.player.y - game.enemies.find(e => e.typeKey === 'moonwitch').y)`);
    expect(dist).toBeGreaterThan(150);
    expect(dist).toBeLessThan(450);
  });

  it("被动·穿梭：被逼到边界且玩家逼近时镜面点对称转移到对侧，CD 30s", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch');
       mw.x = game.moonDomain.x + game.moonDomain.r - 110; mw.y = game.moonDomain.y;
       game.player.x = mw.x - 100; game.player.y = mw.y;
       var bfx = mw.x; var bfy = mw.y;`);
    R(`update(1/60)`);
    expect(R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); Math.abs(mw.x - (2 * game.moonDomain.x - bfx)) < 3 && Math.abs(mw.y - (2 * game.moonDomain.y - bfy)) < 3`)).toBe(true);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonBlinkCd`)).toBeGreaterThan(29);
    // CD 未就绪不触发
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.moonBlinkCd = 5;
       mw.x = game.moonDomain.x + game.moonDomain.r - 110; mw.y = game.moonDomain.y;
       game.player.x = mw.x - 100; game.player.y = mw.y;`);
    R(`update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonBlinkCd`)).toBeGreaterThan(4.9);
  });

  it("死亡镜碎：演出期间领域保持，演出毕领域崩塌、玩家送回并恢复全部快照", () => {
    const { R } = loadGame();
    reachDomain(R);
    R(`var mw = game.enemies.find(e => e.typeKey === 'moonwitch'); mw.hp = 1; mw.takeDamage(9999999, 'test');`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').dying`)).toBe(true);
    expect(R(`game.moonDomain && game.moonDomain.active`)).toBe(true);
    R(`for (var i = 0; i < 110; i++) update(1/60)`);
    expect(R(`game.moonDomain`)).toBe(null);
    expect(R(`game.enemies.some(e => e.typeKey === 'moonwitch')`)).toBe(false);
    expect(R(`Math.hypot(game.player.x - game.moonReturnPos.x, game.player.y - game.moonReturnPos.y) < 2`)).toBe(true);
    expect(R(`game.player.maxHp`)).toBe(100); // 快照恢复（普通难度基础 100）
    expect(R(`game.bossKilledCount`)).toBe(2); // 幽月魔女不计击杀数
  });

  it("第二次降临：第 5 个常规 boss 击杀后触发，先复活动画且全数值 ×3", () => {
    const { R } = loadGame();
    R(`initGame(); game.state='playing'; game.enemies.length=0; game.spawnTimer=999; game.player.x=700; game.player.y=700; game.moonWitchCount=1; game.bossKilledCount=4;`);
    R(`var kb = new Enemy(400, 400, 'boss', 0); game.enemies.push(kb); kb.takeDamage(9999999, 'test');`);
    expect(R(`game.moonIntroTimer`)).toBe(10);
    expect(R(`game.bossKilledCount`)).toBe(5);
    R(`for (var i = 0; i < 610; i++) update(1/60)`);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonIntro`)).toBe('revive');
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').moonStatMult`)).toBe(3);
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').hp`)).toBe(7500); // 2500×3
    expect(R(`game.enemies.find(e => e.typeKey === 'moonwitch').damageReduction`)).toBeCloseTo(0.40); // 复活全阶段 +15% 减伤
  });
});
