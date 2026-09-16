import { describe, expect, it } from "vitest";
import { loadGame } from "./helpers.js";

// 常规 Boss（死神骑士 / 虫巢母皇 / 暗影刺客）与六把基础武器的数值回归。
// 约定：只断言常量与显式设置的出场计数；难度统一 normal（diffMult = 1）；
// 不依赖随机数、不推帧断言时间累积量、不依赖 setTimeout（沙箱内为空桩）。

describe("常规 Boss 数值回归", () => {
  it("死神骑士：1750 血 / 62 速 / 32 接触伤 / 25% 减伤", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.boss.hp`)).toBe(1750);
    expect(R(`ENEMY_TYPES.boss.speed`)).toBe(62);
    expect(R(`ENEMY_TYPES.boss.damage`)).toBe(32);
    expect(R(`ENEMY_TYPES.boss.shieldBase`)).toBe(850);
    expect(R(`ENEMY_TYPES.boss.size`)).toBe(26);
    R(`game.selectedDifficulty = 'normal'; var b = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`b.hp`)).toBe(1750);
    expect(R(`b.maxHp`)).toBe(1750);
    expect(R(`b.speed`)).toBe(62);
    expect(R(`b.damage`)).toBe(32);
    expect(R(`b.damageReduction`)).toBe(0.25);
    // 护盾阈值两档（50% / 25%），护盾只能被击破、无持续时间
    expect(R(`b.shieldThresholds.length === 2 && b.shieldThresholds[0] === 0.5 && b.shieldThresholds[1] === 0.25`)).toBe(true);
    // 减伤实算：100 伤 → floor(100 × 0.75) = 75
    R(`b.takeDamage(100, 'default');`);
    expect(R(`b.hp`)).toBe(1675);
  });

  it("虫巢母皇：2300 血 / 52 速 / 15% 减伤（第 3 次出场起 20%）", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.broodmother.hp`)).toBe(2300);
    expect(R(`ENEMY_TYPES.broodmother.speed`)).toBe(52);
    expect(R(`ENEMY_TYPES.broodmother.damage`)).toBe(30);
    expect(R(`ENEMY_TYPES.broodmother.shieldBase`)).toBe(850);
    R(`game.selectedDifficulty = 'normal'; var bm = new Enemy(500, 500, 'broodmother', 0);`);
    expect(R(`bm.damageReduction`)).toBe(0.15);
    expect(R(`bm.hp`)).toBe(2300);
    R(`game.bossAppearedCount = 3; var bm3 = new Enemy(500, 500, 'broodmother', 0);`);
    expect(R(`bm3.damageReduction`)).toBe(0.20);
    // 出场成长复利：(1.30)^2 = 1.69 → floor(2300 × 1.69) = 3887
    expect(R(`bm3.hp`)).toBe(3887);
  });

  it("暗影刺客：1300 血 / 145 速 / 固定 35% 减伤 / 免疫减速", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.assassin.hp`)).toBe(1300);
    expect(R(`ENEMY_TYPES.assassin.speed`)).toBe(145);
    expect(R(`ENEMY_TYPES.assassin.shieldBase`)).toBe(1050);
    R(`game.selectedDifficulty = 'normal'; var a = new Enemy(500, 500, 'assassin', 0);`);
    expect(R(`a.damageReduction`)).toBe(0.35);
    expect(R(`a.speed`)).toBe(145);
    // 减伤实算：100 伤 → 65
    R(`a.takeDamage(100, 'default');`);
    expect(R(`a.hp`)).toBe(1235);
    // 刺客不吃任何减速（applySlow 直接返回），Boss 减速削减 40%
    R(`a.applySlow(0.5, 2); var b = new Enemy(500, 500, 'boss', 0); b.applySlow(0.5, 2);`);
    expect(R(`a.slowAmount`)).toBe(0);
    expect(R(`Math.abs(b.slowAmount - 0.1) < 1e-9`)).toBe(true);
  });

  it("出场成长：第 2 次复利（血 ×1.35 / 伤 ×1.06 / 剑气 ×1.20），速度 1.5× 封顶", () => {
    const { R } = loadGame();
    R(`game.selectedDifficulty = 'normal'; game.bossAppearedCount = 2; var b = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`b.hp`)).toBe(2362);          // floor(1750 × 1.35)
    expect(R(`Math.abs(b.speed - 86.8) < 1e-9`)).toBe(true); // 62 × 1.4
    expect(R(`b.damage`)).toBe(33);        // floor(32 × 1.06)
    expect(R(`b.slashDamage`)).toBe(21);   // floor(18 × 1.20)
    expect(R(`b.shockwaveDamage`)).toBe(20); // floor(18 × 1.15)
    // 速度封顶 = 基础 ×1.5（62 → 93）
    R(`game.bossAppearedCount = 20; var b20 = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`b20.speed`)).toBe(93);
  });

  it("减伤上限：死神骑士封顶 50%，不可能模式全体 +10%（封顶 75%）", () => {
    const { R } = loadGame();
    R(`game.selectedDifficulty = 'normal'; game.bossAppearedCount = 8; var b = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`b.damageReduction`)).toBe(0.50);
    R(`game.selectedDifficulty = 'impossible'; var bImp = new Enemy(500, 500, 'boss', 0);`);
    expect(R(`bImp.damageReduction`)).toBeCloseTo(0.60, 10); // 0.50 + 0.10
    R(`game.bossAppearedCount = 1; var bmImp = new Enemy(500, 500, 'broodmother', 0); var asImp = new Enemy(500, 500, 'assassin', 0);`);
    expect(R(`bmImp.damageReduction`)).toBe(0.25); // 0.15 + 0.10
    expect(R(`asImp.damageReduction`)).toBeCloseTo(0.45, 10); // 0.35 + 0.10
    // 不可能模式：Boss 移速额外 ×1.15
    expect(R(`Math.abs(asImp.speed - 166.75) < 1e-9`)).toBe(true);
  });

  it("护盾：基础量 850/850/1050、按出场次数复利、母皇 25% 档额外 +300 且吃 shieldRate3", () => {
    const { R } = loadGame();
    R(`game.selectedDifficulty = 'normal'; var b = new Enemy(500, 500, 'boss', 0);`);
    R(`b.activateShield();`);
    expect(R(`b.shieldMax`)).toBe(850);
    expect(R(`b.invincible`)).toBe(true);
    // 第 2 次出场：shieldRate 0.30 → floor(850 × 1.30) = 1105
    R(`game.bossAppearedCount = 2; var b2 = new Enemy(500, 500, 'boss', 0); b2.activateShield();`);
    expect(R(`b2.shieldMax`)).toBe(1105);
    // 母皇 25% 档：extraBase 300 + shieldRate3 0.30
    R(`game.bossAppearedCount = 1; var bm = new Enemy(500, 500, 'broodmother', 0);`);
    R(`bm.activateShield(300, ENEMY_TYPES.broodmother.scale.shieldRate3);`);
    expect(R(`bm.shieldMax`)).toBe(1150);
    // 触发路径：掉到 50% 阈值以下自动激活，护盾吸收期间本体不掉血
    R(`var b3 = new Enemy(500, 500, 'boss', 0); b3.hp = b3.maxHp * 0.45; b3.takeDamage(10, 'default');`);
    expect(R(`b3.invincible`)).toBe(true);
    expect(R(`b3.shieldThresholds.length`)).toBe(1);
    const hpBefore = R(`b3.hp`);
    R(`b3.takeDamage(100, 'default');`);
    expect(R(`b3.hp`)).toBe(hpBefore);
    expect(R(`b3.shieldHp`)).toBe(750);
  });

  it("技能常量：剑气 / 冲击波 / 酸液 / 召唤 / 影刃 / 闪现间隔三档", () => {
    const { R } = loadGame();
    R(`game.selectedDifficulty = 'normal';
       var b = new Enemy(500, 500, 'boss', 0);
       var bm = new Enemy(500, 500, 'broodmother', 0);
       var a = new Enemy(500, 500, 'assassin', 0);`);
    // 死神骑士：剑气 18 伤 / 210 弹速 / CD 6 / 充能 0.9；冲击波 5s 首发、8s 间隔、260 速、200 半径、内圈 40
    expect(R(`b.slashDamage === 18 && b.slashSpeed === 210 && b.slashCooldown === 6 && b.chargeTime === 0.9`)).toBe(true);
    expect(R(`b.shockwaveDamage === 18 && b.shockwaveTimer === 5 && b.shockwaveInterval === 8`)).toBe(true);
    expect(R(`b.shockwaveSpeed === 260 && b.shockwaveMaxRadius === 200 && b.shockwaveInnerSafe === 40`)).toBe(true);
    // 虫巢母皇：3.5s 召 3 只幼体（首发 2s），酸液 14 伤 / 180 速 / 320 射程 / CD 4
    expect(R(`bm.summonType === 'hatchling' && bm.summonInterval === 3.5 && bm.summonCount === 3 && bm.summonTimer === 2`)).toBe(true);
    expect(R(`bm.acidDamage === 14 && bm.acidSpeed === 180 && bm.acidRange === 320 && bm.acidCooldown === 4`)).toBe(true);
    // 暗影刺客：剑气 30 伤 / 320 弹速 / CD 3.5，影刃 20 伤 / 300 速 / 6 发 / 7s 间隔
    expect(R(`a.slashDamage === 30 && a.slashSpeed === 320 && a.slashCooldown === 3.5`)).toBe(true);
    expect(R(`a.shurikenDamage === 20 && a.shurikenSpeed === 300 && a.shurikenCount === 6 && a.shurikenInterval === 7`)).toBe(true);
    // 闪现：预警 0.4s，落地后按血量档取间隔（满血 5.2 / 半血 3.7 / 残血 2.7）
    expect(R(`a.teleportCharge === 0.4 && a.teleportTimer === 3.2`)).toBe(true);
    R(`a.teleportTimer = 0; a.update(1 / 60, game.player);`);
    expect(R(`a.teleporting`)).toBe(true);
    R(`a.teleportProgress = 0.5; a.update(1 / 60, game.player);`);
    expect(R(`a.teleportTimer`)).toBe(5.2);
    R(`a.hp = a.maxHp * 0.2; a.teleportTimer = 0; a.update(1 / 60, game.player); a.teleportProgress = 0.5; a.update(1 / 60, game.player);`);
    expect(R(`a.teleportTimer`)).toBe(2.7);
  });
});

describe("六把基础武器数值回归", () => {
  it("基础字段（伤害 / 冷却 / 半径 / 数量 / 溅射）", () => {
    const { R } = loadGame();
    const BASE = {
      magic_missile: { damage: 21, cooldownTime: 0.85, projectileSpeed: 350, splashRadius: 28, splashDamagePercent: 0.35 },
      orbit_blade: { damage: 26, bladeCount: 3, radius: 60, rotationSpeed: 3.0, hitCdTime: 0.28 },
      frost_nova: { damage: 32, cooldownTime: 2.2, radius: 130, slowAmount: 0.50, slowDuration: 2.2 },
      lightning_chain: { damage: 20, cooldownTime: 0.95, bounceCount: 1, bounceRange: 120, damageFalloff: 0.3 },
      meteor: { damage: 110, cooldownTime: 5.0, radius: 100, doubleChance: 0 },
      shadow_spirit: { spiritCount: 2, damage: 13, attackSpeed: 1.2625, slowAmount: 0.3, slowDuration: 1.5 },
    };
    for (const [type, fields] of Object.entries(BASE)) {
      for (const [field, value] of Object.entries(fields)) {
        expect(R(`START_WEAPON_DEFS['${type}']().${field}`)).toBe(value);
      }
    }
  });

  it("升级卡逐级增量：写卡后字段按定义变化", () => {
    const { R } = loadGame();
    R(`var __tp = game.player;
       var __sk = (id) => SKILL_REGISTRY.find((s) => s.id === id);
       var __wp = (t) => __tp.weapons.find((w) => w.type === t);
       for (const t of ['magic_missile', 'orbit_blade', 'frost_nova', 'lightning_chain', 'meteor', 'shadow_spirit']) __tp.weapons.push(START_WEAPON_DEFS[t]());`);
    // 魔法弹：数量 +1 / 伤害 +25% / 全武器冷却 ×0.92
    R(`__sk('missile_count').apply(__tp); __sk('missile_damage').apply(__tp); __sk('missile_cooldown').apply(__tp);`);
    expect(R(`__wp('magic_missile').extraProjectiles`)).toBe(1);
    expect(R(`__wp('magic_missile').damageMultiplier`)).toBe(1.25);
    expect(R(`__tp.globalCooldownMultiplier`)).toBeCloseTo(0.92, 10);
    // 飞刃：数量 +1 / 转速 ×1.15 / 伤害 +20%
    R(`__sk('orbit_count').apply(__tp); __sk('orbit_speed').apply(__tp); __sk('orbit_damage').apply(__tp);`);
    expect(R(`__wp('orbit_blade').bladeCount`)).toBe(4);
    expect(R(`__wp('orbit_blade').rotationSpeed`)).toBeCloseTo(3.45, 10);
    expect(R(`__wp('orbit_blade').damageMultiplier`)).toBeCloseTo(1.2, 10);
    // 冰霜：冷却 -0.35（下限 1.0）/ 范围 ×1.15 / 伤害 +30%
    R(`__sk('frost_cd').apply(__tp); __sk('frost_range').apply(__tp); __sk('frost_damage').apply(__tp);`);
    expect(R(`__wp('frost_nova').cooldownTime`)).toBeCloseTo(1.85, 10);
    expect(R(`__wp('frost_nova').radius`)).toBeCloseTo(149.5, 10);
    expect(R(`__wp('frost_nova').damageMultiplier`)).toBeCloseTo(1.3, 10);
    // 闪电链：弹跳 +1 / 衰减 -0.1（下限 0.05）/ 跳距 ×1.15
    R(`__sk('chain_bounce').apply(__tp); __sk('chain_falloff').apply(__tp); __sk('chain_range').apply(__tp);`);
    expect(R(`__wp('lightning_chain').bounceCount`)).toBe(2);
    expect(R(`__wp('lightning_chain').damageFalloff`)).toBeCloseTo(0.2, 10);
    expect(R(`__wp('lightning_chain').bounceRange`)).toBeCloseTo(138, 10);
    // 陨石：冷却 -0.7 / 双陨石 +20% / 半径 ×1.15
    R(`__sk('meteor_cd').apply(__tp); __sk('meteor_double').apply(__tp); __sk('meteor_range').apply(__tp);`);
    expect(R(`__wp('meteor').cooldownTime`)).toBeCloseTo(4.3, 10);
    expect(R(`__wp('meteor').doubleChance`)).toBeCloseTo(0.2, 10);
    expect(R(`__wp('meteor').radius`)).toBeCloseTo(115, 10);
    // 暗影精灵：数量 +1 / 锁定 -0.4s / 减速概率 +25% / 攻速 ×(1+0.20)
    R(`__sk('shadow_count').apply(__tp); __sk('shadow_lock').apply(__tp); __sk('shadow_slow').apply(__tp); __sk('shadow_speed').apply(__tp);`);
    expect(R(`__wp('shadow_spirit').spiritCount`)).toBe(3);
    expect(R(`__wp('shadow_spirit').lockReduction`)).toBeCloseTo(0.4, 10);
    expect(R(`__wp('shadow_spirit').slowChance`)).toBeCloseTo(0.25, 10);
    expect(R(`__wp('shadow_spirit').attackSpeedMultiplier`)).toBeCloseTo(1.2, 10);
    // 等级 2 的锁定期望：lockReduction 0.4 → 锁定 0.6s（下限 0.1）
    R(`__sk('shadow_lock').apply(__tp);`);
    expect(R(`Math.max(0.1, 1.0 - __wp('shadow_spirit').lockReduction)`)).toBeCloseTo(0.2, 10);
  });

  it("进化卡：门槛判定与进化后数值（六把）", () => {
    const { R } = loadGame();
    R(`var __tp = game.player;
       var __sk = (id) => SKILL_REGISTRY.find((s) => s.id === id);
       var __wp = (t) => __tp.weapons.find((w) => w.type === t);
       for (const t of ['magic_missile', 'orbit_blade', 'frost_nova', 'lightning_chain', 'meteor', 'shadow_spirit']) __tp.weapons.push(START_WEAPON_DEFS[t]());`);
    const GATES = {
      evo_fireball: ["missile_damage", 4], evo_orbit: ["orbit_count", 3], evo_frost: ["frost_range", 4],
      evo_chain: ["chain_bounce", 3], evo_meteor: ["meteor_cd", 3], evo_shadow: ["shadow_count", 3],
    };
    // 未点满门槛线时进化卡不可用
    for (const [evo, [sid]] of Object.entries(GATES)) {
      expect(R(`__sk('${evo}').applies(__tp)`)).toBe(false);
      expect(R(`(__tp['_skill_${sid}'] || 0) >= 1`)).toBe(false);
    }
    // 点满三条门槛线后依次可进化
    R(`__tp['_skill_missile_damage'] = 4; __tp['_skill_missile_cooldown'] = 3; __tp['_skill_missile_count'] = 3;
       __tp['_skill_orbit_count'] = 3; __tp['_skill_orbit_damage'] = 4; __tp['_skill_orbit_speed'] = 3;
       __tp['_skill_frost_range'] = 4; __tp['_skill_frost_damage'] = 3; __tp['_skill_frost_cd'] = 3;
       __tp['_skill_chain_bounce'] = 3; __tp['_skill_chain_range'] = 3; __tp['_skill_chain_damage'] = 4;
       __tp['_skill_meteor_cd'] = 3; __tp['_skill_meteor_range'] = 3; __tp['_skill_meteor_damage'] = 4;
       __tp['_skill_shadow_count'] = 3; __tp['_skill_shadow_speed'] = 3; __tp['_skill_shadow_damage'] = 4;`);
    for (const evo of Object.keys(GATES)) expect(R(`__sk('${evo}').applies(__tp)`)).toBe(true);
    // 炎爆术：伤害 ×1.4、弹速 ×1.30、溅射 ×1.3
    R(`__sk('evo_fireball').apply(__tp);`);
    expect(R(`__wp('magic_missile').evolved`)).toBe("fireball");
    expect(R(`__wp('magic_missile').damageMultiplier`)).toBeCloseTo(1.4, 10);
    expect(R(`__wp('magic_missile').projectileSpeed`)).toBeCloseTo(455, 10);
    expect(R(`__wp('magic_missile').splashRadius`)).toBeCloseTo(36.4, 10);
    // 剑刃风暴：飞刃 +4、半径覆盖为 70、转速 ×1.5、命中间隔 -0.18（落到 0.1 下限）
    R(`__sk('evo_orbit').apply(__tp);`);
    expect(R(`__wp('orbit_blade').bladeCount`)).toBe(7);
    expect(R(`__wp('orbit_blade').radius`)).toBe(70);
    expect(R(`__wp('orbit_blade').rotationSpeed`)).toBeCloseTo(4.5, 10);
    expect(R(`__wp('orbit_blade').hitCdTime`)).toBeCloseTo(0.1, 10);
    // 下限确为 0.1：把当前值压到 0.15 再进化，结果仍不低于 0.1
    R(`__wp('orbit_blade').hitCdTime = 0.15; __sk('evo_orbit').apply(__tp);`);
    expect(R(`__wp('orbit_blade').hitCdTime`)).toBe(0.1);
    // 极寒领域：范围 ×1.3、减速 70%、冻结 0.8s
    R(`__sk('evo_frost').apply(__tp);`);
    expect(R(`__wp('frost_nova').radius`)).toBeCloseTo(169, 10);
    expect(R(`__wp('frost_nova').slowAmount`)).toBe(0.7);
    expect(R(`__wp('frost_nova').freezeDuration`)).toBe(0.8);
    // 雷暴：弹跳 +2、衰减归零、冷却 ×0.7、伤害 +30%、可重复命中
    R(`__sk('evo_chain').apply(__tp);`);
    expect(R(`__wp('lightning_chain').bounceCount`)).toBe(3);
    expect(R(`__wp('lightning_chain').damageFalloff`)).toBe(0);
    expect(R(`__wp('lightning_chain').cooldownTime`)).toBeCloseTo(0.665, 10);
    expect(R(`__wp('lightning_chain').damageMultiplier`)).toBeCloseTo(1.3, 10);
    expect(R(`__wp('lightning_chain').allowRehit`)).toBe(true);
    // 星落：冷却锁定 2.5、伤害 +40%、燃烧区 2s / 0.4s 一跳 / 30% 伤害
    R(`__sk('evo_meteor').apply(__tp);`);
    expect(R(`__wp('meteor').cooldownTime`)).toBe(2.5);
    expect(R(`__wp('meteor').damageMultiplier`)).toBeCloseTo(1.4, 10);
    expect(R(`__wp('meteor').leaveBurning === true && __wp('meteor').burningDuration === 2`)).toBe(true);
    expect(R(`__wp('meteor').burningTickRate === 0.4 && __wp('meteor').burningDamagePercent === 0.30`)).toBe(true);
    // 暗影军团：攻速 ×1.35、10% 连击
    R(`__sk('evo_shadow').apply(__tp);`);
    expect(R(`__wp('shadow_spirit').evolved`)).toBe("shadow_legion");
    expect(R(`__wp('shadow_spirit').attackSpeedMultiplier`)).toBeCloseTo(1.35, 10);
    expect(R(`__wp('shadow_spirit').doubleStrike`)).toBe(0.10);
  });
});