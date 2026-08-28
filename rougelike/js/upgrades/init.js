            function initGame() {
                game.runId = (game.runId || 0) + 1;
                const diff = DIFFICULTIES[game.selectedDifficulty] || DIFFICULTIES.normal;
                const wpnDef = START_WEAPON_DEFS[game.selectedWeapon] || START_WEAPON_DEFS.magic_missile;
                game.player = new Player();
                game.player.weapons = [wpnDef()];
                // 灵魂宝库永久加成
                game.player.maxHp = diff.playerHp + 20 * metaLevel('hp');
                game.player.hp = game.player.maxHp;
                // 不可能模式：玩家移速 -20
                if (game.selectedDifficulty === 'impossible') game.player.speed -= 20;
                game.player.globalDamageMultiplier = (game.player.globalDamageMultiplier || 1) + 0.10 * metaLevel('dmg');
                game.player.pickupRangeMultiplier = (game.player.pickupRangeMultiplier || 1) + 0.20 * metaLevel('pickup');
                game.player.expMultiplier = (game.player.expMultiplier || 1) + 0.15 * metaLevel('xp');
                if (metaLevel('revive') > 0) { game.player.reviveLeft = 1; }
                // 圣物（仅穿戴的生效）
                game.player.relicVamp = isRelicActive('relic_vamp');
                game.player.relicThorn = isRelicActive('relic_thorn');
                game.player.relicGreed = isRelicActive('relic_greed');
                game.player.relicBomb = isRelicActive('relic_bomb');
                // 幻影步：受击闪避概率随圣物等级
                game.player.relicDodgeChance = isRelicActive('relic_phantom_step') ? (relicRate('relic_phantom_step') || 0.15) : 0;
                // 背水一战：低血增伤系数开局缓存（避免每次伤害计算遍历查找）
                game.player.relicLastStandRate = isRelicActive('relic_last_stand') ? (relicRate('relic_last_stand') || 0.25) : 0;
                // 影侍守卫 / 时停领域（计时状态挂在 game 上）
                game.player.relicGuard = isRelicActive('relic_shadow_clone');
                game.player.relicClone = game.player.relicGuard; // 兼容旧名
                game.player.relicTimeStop = isRelicActive('relic_time_stop');
                // 开局护盾圣物（可升级，仅穿戴生效）：采用灵魂护盾机制，护盾量/恢复时间随等级成长
                const shieldLv = isRelicActive('relic_shield_start') ? relicLevel('relic_shield_start') : 0;
                if (shieldLv > 0) {
                    game.player.soulShield = true;
                    game.player.soulShieldLevel = shieldLv;
                    game.player.soulShieldMax = 50 + 30 * (shieldLv - 1);
                    game.player.soulShieldRegenTime = Math.max(4, 15 - 3 * (shieldLv - 1));
                    game.player.soulShieldAmount = game.player.soulShieldMax;
                }
                game.soulShards = 0;
                game.waveTimer = 100; game.waveState = 'idle'; game.waveEliteLeft = 0; game.waveNoticeTimer = 0;
                game.chests = [];
                game.lavaWarns = [];
                // 定时炸弹：穿戴时首爆固定在开局 10 秒后（此前提前赋值被下方清零覆盖，导致开局瞬间即爆）
                game.bombTimer = game.player.relicBomb ? 10 : 0;
                game.altars = []; game.altarTimer = 45;
                // 影侍守卫/时停领域计时器复位
                game.cloneTimer = 10; game.cloneAngle = 0; game.cloneX = undefined; game.cloneY = undefined;
                if (game.player.relicTimeStop) {
                    game.timeStopTimer = relicRate('relic_time_stop') || 45;
                } else { game.timeStopTimer = 0; }
                game.superBossSpawned = false; game.bossKilledCount = 0;
                game.lastBossKillTime = undefined;
                game.achievements = {};
                game.enemies = []; game.projectiles = []; game.experienceOrbs = [];
                particles = []; damageNumbers = [];
                game.time = 0; game.score = 0; game.kills = 0; game.totalDamageDealt = 0;
                game.spawnTimer = 0; game.spawnInterval = diff.spawnInterval;
                game.difficultyLevel = diff.diffStart; game.diffMult = diff.mult;
                game.state = 'playing'; game.currentChoices = null;
                game.upgradeCount = 0;
                game.bossTimer = diff.bossTimer; game.bossAppearedCount = 0; game.bossOnField = false;
                game.warningText = ''; game.warningTimer = 0;
                game.fireZones = [];
                game.burningZones = []; game.chainLightningVisuals = []; game.bossDropChoices = null; game.meteorVisuals = [];
                game.bossDropPending = false;
                game.shadowZones = [];
                game.shadowTrails = [];
                game.noBossDrop = false;
                game.rings = []; game.levelFlash = 0; game.flashWhite = 0;
                game.bossWarnTimer = 0; game.superBossDelay = 0; game.levelupLock = 0; game.pendingSuperBoss = false;
                game.deathMark.targets = [];
                if (typeof syncDeathMarkUI === 'function') syncDeathMarkUI();
                dbg.pauseGame = false;
                if ($inp('dbg-pause')) $inp('dbg-pause').checked = false;
                btnPause.innerHTML = ICONS.pause;
                screenShake = { intensity: 0, duration: 0, elapsed: 0 };
                levelupPanel.style.display = 'none'; gameoverOverlay.style.display = 'none';
                bossdropPanel.style.display = 'none'; bossdropCards.innerHTML = '';
                levelupCards.innerHTML = '';
                game.rerollUsed = false;
                skipBtn.disabled = false;
                skipBtn.style.opacity = '1';
                skipBtn.style.cursor = 'pointer';
                game.player.x = WORLD_W / 2; game.player.y = WORLD_H / 2;
                resizeCanvas();
            }

