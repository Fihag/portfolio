"use strict";
// ==================== 数值平衡配置（抽离自 03-skills / 05-enemies，单源） ====================
const DIFFICULTIES = {
  easy: { name: "简单", diffStart: 1, mult: 0.8, bossTimer: 120, spawnInterval: 1.6, spawnStep: 0.03, spawnMin: 0.4, bossRespawn: 85, playerHp: 150, shardMult: 0.7 },
  normal: { name: "普通", diffStart: 1, mult: 1, bossTimer: 90, spawnInterval: 1.3, spawnStep: 0.04, spawnMin: 0.3, bossRespawn: 70, playerHp: 100, shardMult: 1 },
  hard: { name: "困难", diffStart: 3, mult: 1.15, bossTimer: 75, spawnInterval: 1.2, spawnStep: 0.045, spawnMin: 0.28, bossRespawn: 65, playerHp: 90, shardMult: 1.5 },
  hell: { name: "地狱", diffStart: 5, mult: 1.3, bossTimer: 60, spawnInterval: 1.1, spawnStep: 0.06, spawnMin: 0.25, bossRespawn: 55, playerHp: 85, shardMult: 1.8 },
  impossible: { name: "不可能", diffStart: 8, mult: 1.8, bossTimer: 50, spawnInterval: 1.0, spawnStep: 0.07, spawnMin: 0.2, bossRespawn: 48, playerHp: 75, shardMult: 2.4 },
};
