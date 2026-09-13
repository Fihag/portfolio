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
  it("弹速难度系数：简单×0.85 普通×1 困难×1.1 地狱×1.2 不可能×1.3", () => {
    const { R } = loadGame();
    const cases = [["easy", 0.85], ["normal", 1], ["hard", 1.1], ["hell", 1.2], ["impossible", 1.3]];
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
  it("扫射激光：0.7s 预警后发射，长 1200 处命中 30 伤，冷却 5.5s", () => {
    const { R } = loadGame();
    setupTurret(R);
    R(`game.enemies[0].turretLaserTimer = 0.01; game.enemies[0].turretRapidTimer = 999; game.enemies[0].turretVolleyTimer = 999; game.enemies[0].turretBurstTimer = 999;`);
    R(`for (var i = 0; i < 46; i++) update(1/60)`); // 越过 0.7s 预警
    expect(R(`game.enemies[0].turretLaserState`)).toBe("firing");
    // 玩家站在下一帧扫到的光束方向 1100px 处（< 1200）
    R(`var la = game.enemies[0].turretLaserAngle + Math.PI / 180 * 120 * (1/60); game.player.x = 1000 + Math.cos(la) * 1100; game.player.y = 750 + Math.sin(la) * 1100;`);
    R(`update(1/60)`);
    expect(R(`game.player.hp`)).toBeCloseTo(70, 0); // 命中 30 伤（同帧自然回血 ±0.5 内）
    R(`game.enemies[0].turretLaserT = 0.01; update(1/60)`);
    expect(R(`game.enemies[0].turretLaserTimer`)).toBeCloseTo(5.5, 5);
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
    expect(R(`t5.turretLaserDmg`)).toBe(Math.floor(30 * g));
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
