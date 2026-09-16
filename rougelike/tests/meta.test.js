import { describe, expect, it } from "vitest";
import { loadGame } from "./helpers.js";

// 局外系统（灵魂宝库商店 / 圣物 / 成就 / 存档签名与旧档迁移）的数值与行为回归。
// 约定：直接摆好 metaData 与 achievementsDone 再断言，不依赖随机数、不依赖真实 localStorage 持久化（沙箱内为内存桩）。

describe("灵魂宝库：商店与圣物", () => {
  it("永久升级价格表：逐级价格与满级 -1", () => {
    const { R } = loadGame();
    const COSTS = {
      hp: [120, 200, 320],
      dmg: [120, 200, 320, 480, 700],
      xp: [90, 150, 240],
      revive: [720],
    };
    for (const [id, costs] of Object.entries(COSTS)) {
      costs.forEach((cost, i) => {
        R(`metaData.upgrades['${id}'] = ${i};`);
        expect(R(`metaUpgradeCost('${id}')`)).toBe(cost);
      });
      R(`metaData.upgrades['${id}'] = ${costs.length};`);
      expect(R(`metaUpgradeCost('${id}')`)).toBe(-1);
    }
    expect(R(`META_UPGRADES.find((u) => u.id === 'dmg').maxLevel`)).toBe(5);
    expect(R(`META_UPGRADES.find((u) => u.id === 'revive').maxLevel`)).toBe(1);
  });

  it("购买永久升级：扣费与升级，碎片不足或满级不生效", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 500, upgrades: {}, relics: {}, earned: 0 };`);
    expect(R(`buyMetaUpgrade('hp')`)).toBe(true);   // 120
    expect(R(`metaData.shards`)).toBe(380);
    expect(R(`metaLevel('hp')`)).toBe(1);
    expect(R(`buyMetaUpgrade('hp')`)).toBe(true);   // 200
    expect(R(`metaData.shards`)).toBe(180);
    expect(R(`buyMetaUpgrade('hp')`)).toBe(false);  // 320 > 180，碎片不足
    expect(R(`metaLevel('hp')`)).toBe(2);
    expect(R(`metaData.shards`)).toBe(180);
    R(`metaData.upgrades.hp = 3;`);                 // 满级：价格 -1
    expect(R(`buyMetaUpgrade('hp')`)).toBe(false);
    expect(R(`metaLevel('hp')`)).toBe(3);
  });

  it("永久升级在开局落地：生命 +20/级、伤害 +10%/级、经验 +15%/级、凤凰复活一次", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 0, upgrades: {}, relics: {}, earned: 0 }; initGame();`);
    const baseHp = R(`game.player.maxHp`);
    const baseDmg = R(`game.player.globalDamageMultiplier`);
    const baseXp = R(`game.player.expMultiplier`);
    expect(R(`game.player.reviveLeft || 0`)).toBe(0);
    R(`metaData.upgrades = { hp: 2, dmg: 3, xp: 1, revive: 1 }; initGame();`);
    expect(R(`game.player.maxHp - ${baseHp}`)).toBe(40);   // 20 × 2 级
    expect(R(`game.player.globalDamageMultiplier - ${baseDmg}`)).toBeCloseTo(0.30, 10); // 10% × 3 级
    expect(R(`game.player.expMultiplier - ${baseXp}`)).toBeCloseTo(0.15, 10);           // 15% × 1 级
    expect(R(`game.player.reviveLeft`)).toBe(1);
  });

  it("圣物：首购自动穿戴、升级价、满级封顶、可卸下（效果随穿戴状态生效）", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 5000, upgrades: {}, relics: {}, earned: 0 };`);
    expect(R(`isRelicActive('relic_vamp')`)).toBe(false);      // 未拥有
    expect(R(`buyRelic('relic_last_stand')`)).toBe(true);
    expect(R(`metaData.shards`)).toBe(4700);                   // 首购 300
    expect(R(`relicLevel('relic_last_stand')`)).toBe(1);
    expect(R(`isRelicActive('relic_last_stand')`)).toBe(true); // 首购自动穿戴
    expect(R(`relicRate('relic_last_stand')`)).toBe(0.25);
    expect(R(`buyRelic('relic_last_stand')`)).toBe(true);      // 升级 400
    expect(R(`metaData.shards`)).toBe(4300);
    expect(R(`relicRate('relic_last_stand')`)).toBe(0.35);
    expect(R(`buyRelic('relic_last_stand')`)).toBe(true);
    expect(R(`relicRate('relic_last_stand')`)).toBe(0.45);
    expect(R(`buyRelic('relic_last_stand')`)).toBe(false);     // 满 3 级
    expect(R(`relicLevel('relic_last_stand')`)).toBe(3);
    // 时停领域：三档冷却 45 / 35 / 25
    R(`buyRelic('relic_time_stop');`);                         // 520
    expect(R(`relicRate('relic_time_stop')`)).toBe(45);
    R(`buyRelic('relic_time_stop');`);                         // 640
    expect(R(`relicRate('relic_time_stop')`)).toBe(35);
    R(`buyRelic('relic_time_stop');`);                         // 640
    expect(R(`relicRate('relic_time_stop')`)).toBe(25);
    expect(R(`metaData.shards`)).toBe(2100);                   // 5000 - 1100 - 1800
    // 卸下后效果不生效，重新穿戴恢复
    expect(R(`setRelicActive('relic_last_stand', false)`)).toBe(true);
    expect(R(`isRelicActive('relic_last_stand')`)).toBe(false);
    expect(R(`setRelicActive('relic_last_stand', true)`)).toBe(true);
    expect(R(`isRelicActive('relic_last_stand')`)).toBe(true);
    // 未拥有的圣物无法穿戴
    expect(R(`setRelicActive('relic_vamp', true)`)).toBe(false);
  });

  it("圣物效果在开局落地：护盾量/恢复、闪避概率、背水增伤系数", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 0, upgrades: {}, relics: { relic_shield_start: 2, relic_phantom_step: true, relic_last_stand: 2 }, activeRelics: {}, earned: 0 };
       metaData.activeRelics = { relic_shield_start: true, relic_phantom_step: true, relic_last_stand: true };
       initGame();`);
    expect(R(`game.player.soulShieldMax`)).toBe(80);            // 50 + 30×(2-1)
    expect(R(`game.player.soulShieldRegenTime`)).toBe(12);      // max(4, 15-3)
    expect(R(`game.player.relicDodgeChance`)).toBe(0.15);       // 幻影步固定 15%，不可升级
    expect(R(`game.player.relicLastStandRate`)).toBe(0.35);     // 2 级档
    // 卸下即不生效
    R(`setRelicActive('relic_shield_start', false); setRelicActive('relic_last_stand', false); initGame();`);
    expect(R(`game.player.soulShield || false`)).toBe(false);
    expect(R(`game.player.relicLastStandRate`)).toBe(0);
  });

  it("成就：幂等发放，奖励同时计入碎片与累计", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 0, upgrades: {}, relics: {}, earned: 0 }; achievementsDone = {};`);
    R(`awardAchievement('speedster');`);
    expect(R(`metaData.shards`)).toBe(50);
    expect(R(`metaData.earned`)).toBe(50);
    expect(R(`achievementsDone.speedster`)).toBe(true);
    R(`awardAchievement('speedster');`);                        // 重复不叠加
    expect(R(`metaData.shards`)).toBe(50);
    // checkAchievements：累计 1000 碎片触发大富翁（+100）
    R(`metaData.earned = 1000; game.kills = 200; game.time = 30; checkAchievements();`);
    expect(R(`achievementsDone.rich_shards`)).toBe(true);
    expect(R(`metaData.shards`)).toBe(150);
    expect(R(`metaData.earned`)).toBe(1100);
    expect(R(`ACHIEVEMENTS.length`)).toBe(8);
    expect(R(`ACHIEVEMENTS.find((a) => a.id === 'all_evolved').reward`)).toBe(120);
  });
});

describe("存档签名与旧档迁移", () => {
  it("读写往返：签名自洽、字段完整", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 123, upgrades: { hp: 1 }, relics: { relic_vamp: true }, earned: 456 }; saveMeta();`);
    expect(R(`metaSign(JSON.parse(localStorage.getItem('rogue_meta'))) === localStorage.getItem('rogue_meta_sig')`)).toBe(true);
    R(`metaData = loadMeta();`);
    expect(R(`metaData.shards === 123 && metaData.earned === 456 && metaLevel('hp') === 1`)).toBe(true);
    expect(R(`isRelicActive('relic_vamp')`)).toBe(true);
  });

  it("旧档迁移：无签名补签并回填 earned；有签名但缺 earned 时回填重签", () => {
    const { R } = loadGame();
    // 旧版存档（完全没有签名）：信任一次并补签
    R(`localStorage.removeItem('rogue_meta_sig');
       localStorage.setItem('rogue_meta', JSON.stringify({ shards: 77, upgrades: {}, relics: { relic_vamp: true } }));
       metaData = loadMeta();`);
    expect(R(`metaData.shards`)).toBe(77);
    expect(R(`metaData.earned`)).toBe(77);                      // 用 shards 回填累计
    expect(R(`metaSign(JSON.parse(localStorage.getItem('rogue_meta'))) === localStorage.getItem('rogue_meta_sig')`)).toBe(true);
    // 旧版本写下的存档（有签名、无 earned）：回填后重新签名
    R(`localStorage.setItem('rogue_meta', JSON.stringify({ shards: 200, upgrades: {}, relics: {} }));
       localStorage.setItem('rogue_meta_sig', metaSign({ shards: 200, upgrades: {}, relics: {} }));
       metaData = loadMeta();`);
    expect(R(`metaData.earned`)).toBe(200);
    expect(R(`metaSign(JSON.parse(localStorage.getItem('rogue_meta'))) === localStorage.getItem('rogue_meta_sig')`)).toBe(true);
  });

  it("篡改存档：签名不匹配即清除并回默认值", () => {
    const { R } = loadGame();
    R(`metaData = { shards: 10, upgrades: {}, relics: {}, earned: 10 }; saveMeta();
       localStorage.setItem('rogue_meta', JSON.stringify({ shards: 999999, upgrades: {}, relics: {}, earned: 999999 }));
       metaData = loadMeta();`);
    expect(R(`metaData.shards`)).toBe(0);
    expect(R(`localStorage.getItem('rogue_meta')`)).toBe(null);
    expect(R(`localStorage.getItem('rogue_meta_sig')`)).toBe(null);
  });

  it("旧档无 activeRelics 字段：已购圣物默认全部穿戴", () => {
    const { R } = loadGame();
    R(`localStorage.setItem('rogue_meta', JSON.stringify({ shards: 0, upgrades: {}, relics: { relic_vamp: true, relic_greed: true }, earned: 0 }));
       localStorage.setItem('rogue_meta_sig', metaSign(JSON.parse(localStorage.getItem('rogue_meta'))));
       metaData = loadMeta();`);
    expect(R(`metaData.activeRelics === undefined`)).toBe(true);
    expect(R(`isRelicActive('relic_vamp')`)).toBe(true);
    expect(R(`isRelicActive('relic_greed')`)).toBe(true);
    expect(R(`isRelicActive('relic_thorn')`)).toBe(false);      // 未拥有
    // 显式卸下后写入 activeRelics，只影响该圣物
    R(`setRelicActive('relic_vamp', false);`);
    expect(R(`isRelicActive('relic_vamp')`)).toBe(false);
    expect(R(`isRelicActive('relic_greed')`)).toBe(true);
    expect(R(`metaSign(JSON.parse(localStorage.getItem('rogue_meta'))) === localStorage.getItem('rogue_meta_sig')`)).toBe(true);
  });
});