import { describe, it, expect } from "vitest";
import { loadGame } from "./helpers.js";

describe("魔法幸存者 · 基础数值回归", () => {
  it("lavabeast 血量 3200 / 速度 145", () => {
    const { R } = loadGame();
    expect(R(`ENEMY_TYPES.lavabeast.hp`)).toBe(3200);
    expect(R(`ENEMY_TYPES.lavabeast.speed`)).toBe(145);
  });
  it("不可能倍率 1.8 / 刺客弹速 320/300", () => {
    const { R } = loadGame();
    expect(R(`DIFFICULTIES.impossible.mult`)).toBe(1.8);
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
  it("影侍守卫圣物不可升级且描述含60%", () => {
    const { R } = loadGame();
    expect(R(`META_RELICS.find(x=>x.id==='relic_shadow_clone').name`)).toBe("影侍守卫");
    expect(R(`!META_RELICS.find(x=>x.id==='relic_shadow_clone').maxLevel`)).toBe(true);
    expect(R(`META_RELICS.find(x=>x.id==='relic_shadow_clone').desc.includes('60%')`)).toBe(true);
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
