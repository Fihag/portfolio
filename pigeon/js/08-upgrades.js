            // ==================== 升级逻辑 ====================
            function generateUpgradeChoices(player) {
                const available = [];
                for (const skill of SKILL_REGISTRY) {
                    if (!skill.applies(player)) continue;
                    const currentLevel = getSkillCurrentLevel(player, skill);
                    if (currentLevel >= skill.maxLevel) continue;
                    if (skill.maxLevel === 1 && currentLevel >= 1) continue;
                    available.push(skill);
                }
                const shuffled = [...available].sort(() => Math.random() - 0.5);
                const choiceCount = 5 + (player.extraChoices || 0);
                let choices = shuffled.slice(0, choiceCount);
                if (player.extraChoices) player.extraChoices = 0;
                if (game.upgradeCount <= 2) {
                    const unlockedWeapons = player.weapons.map(w => w.type);
                    const weaponSkillMap = { 'unlock_magic': 'magic_missile', 'unlock_orbit': 'orbit_blade', 'unlock_frost': 'frost_nova', 'unlock_chain': 'lightning_chain', 'unlock_meteor': 'meteor', 'unlock_shadow': 'shadow_spirit' };
                    const weaponSkills = Object.keys(weaponSkillMap);
                    const missingWeaponSkill = weaponSkills.find(sid => !unlockedWeapons.includes(weaponSkillMap[sid]));
                    if (missingWeaponSkill && !choices.some(s => s.id === missingWeaponSkill)) {
                        const skill = SKILL_REGISTRY.find(s => s.id === missingWeaponSkill);
                        if (skill && skill.applies(player) && getSkillCurrentLevel(player, skill) < skill.maxLevel) {
                            choices.pop(); choices.unshift(skill);
                        }
                    }
                }
                return choices;
            }

            function getSkillCurrentLevel(player, skill) {
                return player['_skill_' + skill.id] || 0;
            }

            function showLevelupPanel(choices) {
                levelupCards.innerHTML = '';
                choices.forEach((skill, i) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const currentLvl = getSkillCurrentLevel(game.player, skill);
                    card.innerHTML = `<span class="icon">${ICONS[skill.icon] || ''}</span><span class="name">${skill.name}</span><span class="desc">${skill.desc}</span><span class="level-tag">Lv.${currentLvl+1}/${skill.maxLevel}</span>`;
                    card.addEventListener('click', (e) => { e.stopPropagation(); game.applyUpgrade(skill); });
                    card.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); game.applyUpgrade(skill); });
                    levelupCards.appendChild(card);
                });
                levelupPanel.style.display = 'flex';
                // 点击保护：0.8 秒内不可选择，避免移动/误触
                game.levelupLock = 0.8;
                levelupPanel.classList.add('locked');
                const lockHint = $inp('levelup-lock-hint');
                if (lockHint) lockHint.textContent = '1 秒后可选择';
                game.rerollUsed = false;
                skipBtn.disabled = false;
                skipBtn.style.opacity = '1';
                skipBtn.style.cursor = 'pointer';
            }

            
            function showBossDropPanel(choices) {
                bossdropCards.innerHTML = '';
                sound.play('bossDrop');
                choices.forEach((item, i) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const d = typeof item.desc === 'function' ? item.desc(game.player) : item.desc;
                    card.innerHTML = `<span class="icon">${ICONS[item.icon] || ''}</span><span class="name">${item.name}</span><span class="desc">${d}</span>`;
                    card.addEventListener('click', (e) => { e.stopPropagation(); applyBossDrop(item); });
                    card.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); applyBossDrop(item); });
                    bossdropCards.appendChild(card);
                });
                bossdropPanel.style.display = 'flex';
                game.state = 'bossdrop';
            }

            function applyBossDrop(item) {
                if (game.state !== 'bossdrop') return;
                try { item.apply(game.player); } catch(e) { console.warn('Boss drop apply error:', e); }
                bossdropPanel.style.display = 'none';
                bossdropCards.innerHTML = '';
                game.bossDropChoices = null;
                game.state = 'playing';
                game.player.invincibleTimer = 0.5;
            }

            game.applyUpgrade = function(skill) {
                if (game.state !== 'levelup') return;
                if (game.levelupLock > 0) return; // 点击保护
                const player = game.player;
                player['_skill_' + skill.id] = (player['_skill_' + skill.id] || 0) + 1;
                try { skill.apply(player); } catch(e) { console.warn('Skill apply error:', e); }
                levelupPanel.style.display = 'none';
                levelupCards.innerHTML = '';
                game.currentChoices = null;
                game.state = 'playing';
                player.invincibleTimer = 0.4;
            };

            skipBtn.addEventListener('click', () => {
                if (game.state !== 'levelup') return;
                if (game.levelupLock > 0) return; // 点击保护
                if (game.rerollUsed) return;
                const player = game.player;
                game.rerollUsed = true;
                game.currentChoices = generateUpgradeChoices(player);
                if (!game.currentChoices.length) {
                    levelupPanel.style.display = 'none';
                    levelupCards.innerHTML = '';
                    game.currentChoices = null;
                    game.state = 'playing';
                    return;
                }
                levelupCards.innerHTML = '';
                game.currentChoices.forEach((skill, i) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const currentLvl = getSkillCurrentLevel(player, skill);
                    card.innerHTML = `<span class="icon">${ICONS[skill.icon] || ''}</span><span class="name">${skill.name}</span><span class="desc">${skill.desc}</span><span class="level-tag">Lv.${currentLvl+1}/${skill.maxLevel}</span>`;
                    card.addEventListener('click', (e) => { e.stopPropagation(); game.applyUpgrade(skill); });
                    card.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); game.applyUpgrade(skill); });
                    levelupCards.appendChild(card);
                });
                // 换一批后不设点击保护：玩家刚主动点击按钮，可直接选择新选项
                skipBtn.disabled = true;
                skipBtn.style.opacity = '0.4';
                skipBtn.style.cursor = 'not-allowed';
            });

            skipXpBtn.addEventListener('click', () => {
                if (game.state !== 'levelup') return;
                if (game.levelupLock > 0) return; // 点击保护
                const player = game.player;
                const xpGain = Math.floor(player.xpToNext * 0.5);
                levelupPanel.style.display = 'none';
                levelupCards.innerHTML = '';
                game.currentChoices = null;
                game.state = 'playing';
                player.invincibleTimer = 0.4;
                player.addXp(xpGain);
            });

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

            function updateWeapons(player, dt) {
                for (const w of player.weapons) {
                    if (w.type === 'magic_missile') {
                        const cd = w.cooldownTime * (w.cooldownMultiplier || 1) * player.getEffectiveCooldownMult();
                        if (w.cooldown <= 0) {
                            const nearest = player.getNearestEnemy();
                            if (nearest) {
                                const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
                                const total = 1 + (w.extraProjectiles || 0);
                                const spread = 0.10;
                                for (let i = 0; i < total; i++) {
                                    let a = angle;
                                    if (total > 1) a = angle - spread * (total - 1) / 2 + spread * i;
                                    const vx = Math.cos(a) * w.projectileSpeed, vy = Math.sin(a) * w.projectileSpeed;
                                    const dmg = w.damage * w.damageMultiplier * player.globalDamageMultiplier * player.getRiskMult() * player.getLowHpMult();
                                    const proj = new Projectile(player.x, player.y, vx, vy, dmg, w.splashRadius || 0, w.splashDamagePercent || 0, '#ff9933');
                                    proj.knockback = w.knockback || 0;
                                    game.projectiles.push(proj);
                                    sound.play('shoot');
                                }
                                w.cooldown = cd;
                            }
                        }
                    } else if (w.type === 'orbit_blade') {
                        for (let i = 0; i < w.bladeCount; i++) {
                            const ba = w.angle + (Math.PI * 2 / w.bladeCount) * i;
                            const bx = player.x + Math.cos(ba) * w.radius, by = player.y + Math.sin(ba) * w.radius;
                            for (const enemy of game.enemies) {
                                if (!enemy.alive || enemy.orbitHitCd > 0) continue;
                                if (Math.hypot(bx - enemy.x, by - enemy.y) < w.radius * 0.25 + enemy.size) {
                                    let dmg = w.damage * w.damageMultiplier * player.globalDamageMultiplier * player.getRiskMult() * player.getLowHpMult();
                                    if (player.synergyBladeSpeed) {
                                        const moveBonus = Math.min(0.4, ((player.speedMultiplier || 1) - 1) * 0.5);
                                        dmg *= (1 + moveBonus);
                                    }
                                    enemy.takeDamage(dmg, 'orbit'); enemy.orbitHitCd = w.hitCdTime;
                                    spawnParticles(bx, by, 3, '#aaddff', 40, 0.2, 2);
                                }
                            }
                        }
                    } else if (w.type === 'frost_nova') {
                        if (w.cooldown <= 0) {
                            const dmg = w.damage * w.damageMultiplier * player.globalDamageMultiplier * player.getRiskMult() * player.getLowHpMult();
                            for (const enemy of game.enemies) {
                                if (!enemy.alive) continue;
                                if (dist(player, enemy) < w.radius) {
                                    enemy.takeDamage(dmg, 'frost');
                                    enemy.applySlow(w.slowAmount, w.slowDuration);
                                    if (w.freezeDuration && !enemy.isBoss) enemy.freezeTimer = w.freezeDuration;
                                }
                            }
                            spawnParticles(player.x, player.y, 25, '#aaddff', w.radius * 0.6, 0.5, 5);
                            spawnFx(player.x, player.y, 10, '#e0f6ff', { shape: 'star', glow: true, speed: w.radius * 0.5, life: 0.5, size: 4 });
                            spawnFx(player.x, player.y, 8, '#ffffff', { shape: 'square', glow: true, rotSpeed: 6, speed: w.radius * 0.4, life: 0.4, size: 2.5, drag: 2 });
                            game.rings.push({ x: player.x, y: player.y, r: 6, maxR: w.radius, life: 0.45, maxLife: 0.45, color: '#aaddff', width: 4 });
                            sound.play('frost');
                            triggerShake(2, 0.12);
                            w.cooldown = w.cooldownTime * player.getEffectiveCooldownMult();
                        }
                        // 冰霜光环减速 25%（已加强）
                        const auraRadius = w.radius * 0.6;
                        for (const enemy of game.enemies) {
                            if (!enemy.alive) continue;
                            if (dist(player, enemy) < auraRadius) {
                                enemy.applySlow(0.25, 0.5);
                            }
                        }
                    } else if (w.type === 'lightning_chain') {
                        const cd = w.cooldownTime * player.getEffectiveCooldownMult();
                        if (w.cooldown <= 0) {
                            const nearest = player.getNearestEnemy();
                            if (nearest) {
                                const dmg = w.damage * w.damageMultiplier * player.globalDamageMultiplier * player.getRiskMult() * player.getLowHpMult();
                                const hitEnemies = new Set();
                                let current = nearest;
                                let currentDmg = dmg;
                                hitEnemies.add(current);
                                current.takeDamage(currentDmg, 'lightning');
                                sound.play('lightning');
                                game.chainLightningVisuals.push({ x1: player.x, y1: player.y, x2: current.x, y2: current.y, life: 0.25 });
                                spawnParticles(current.x, current.y, 5, '#ffff44', 60, 0.3, 3);
                                spawnFx(current.x, current.y, 4, '#ffffff', { shape: 'cross', glow: true, speed: 55, life: 0.22, size: 3, rotSpeed: 12 });
                                let prev = current;
                                for (let b = 0; b < w.bounceCount; b++) {
                                    let nextEnemy = null, minDist = w.bounceRange;
                                    for (const e of game.enemies) {
                                        if (!e.alive) continue;
                                        if (w.allowRehit) {
                                            if (Math.hypot(e.x - prev.x, e.y - prev.y) < minDist) {
                                                minDist = Math.hypot(e.x - prev.x, e.y - prev.y);
                                                nextEnemy = e;
                                            }
                                        } else {
                                            if (hitEnemies.has(e)) continue;
                                            if (Math.hypot(e.x - prev.x, e.y - prev.y) < minDist) {
                                                minDist = Math.hypot(e.x - prev.x, e.y - prev.y);
                                                nextEnemy = e;
                                            }
                                        }
                                    }
                                    if (!nextEnemy) break;
                                    currentDmg *= (1 - w.damageFalloff);
                                    hitEnemies.add(nextEnemy);
                                    nextEnemy.takeDamage(currentDmg, 'lightning');
                                    game.chainLightningVisuals.push({ x1: prev.x, y1: prev.y, x2: nextEnemy.x, y2: nextEnemy.y, life: 0.2 });
                                    spawnParticles(nextEnemy.x, nextEnemy.y, 3, '#ffff44', 40, 0.2, 2);
                                    prev = nextEnemy;
                                }
                                w.cooldown = cd;
                            }
                        }
                    } else if (w.type === 'meteor') {
                        const cd = w.cooldownTime * player.getEffectiveCooldownMult();
                        if (w.cooldown <= 0 && game.enemies.length > 0) {
                            const targets = game.enemies.filter(e => e.alive && !e.deathMarked);
                            if (targets.length > 0) {
                                const dropMeteor = (tx, ty) => {
                                    game.meteorVisuals.push({
                                        x: tx, y: ty - 300, targetY: ty,
                                        fallSpeed: 600, damage: w.damage * w.damageMultiplier * player.globalDamageMultiplier * player.getRiskMult() * player.getLowHpMult(),
                                        radius: w.radius, landed: false, leaveBurning: w.leaveBurning || false,
                                        burningDuration: w.burningDuration || 3,
                                        burningTickRate: w.burningTickRate || 0.5,
                                        burningDamagePercent: w.burningDamagePercent || 0.3
                                    });
                                };
                                const t = targets.reduce((a, b) => a.hp > b.hp ? a : b);
                                dropMeteor(t.x, t.y);
                                if (Math.random() < (w.doubleChance || 0)) {
                                    const t2 = targets.reduce((a, b) => a.hp > b.hp ? a : b);
                                    setTimeout(() => { if (game.state === 'playing' && game.player === player) dropMeteor(t2.x, t2.y); }, 200);
                                }
                                w.cooldown = cd;
                            }
                        }
                    } else if (w.type === 'shadow_spirit') {
                        // ===== 精灵锁敌：锁定=前摇(纯时间)，前摇完成按攻速持续攻击 =====
                        const lockTime = Math.max(0.1, 1.0 - (w.lockReduction || 0));
                        const attackInterval = 1 / ((w.attackSpeed || 1.25) * (w.attackSpeedMultiplier || 1));
                        // 精灵状态容器
                        if (!w.spiritStates || w.spiritStates.length !== w.spiritCount) {
                            w.spiritStates = [];
                            for (let s = 0; s < w.spiritCount; s++) {
                                w.spiritStates.push({ x: player.x, y: player.y, target: null, lockTimer: 0, attackTimer: 0 });
                            }
                        }
                        const alive = game.enemies.filter(e => e && e.alive && !e.deathMarked && !e.dying);
                        // A. 独立锁敌：优先分配未被锁定的目标，各精灵锁距自身最近的存活敌人（全图）
                        // 报复机制：玩家刚受击时，精灵强制锁定距玩家最近的敌人
                        const revenge = player.revengeTimer > 0;
                        let revengeTarget = null;
                        if (revenge) {
                            let minD = Infinity;
                            for (const e of alive) {
                                const d = Math.hypot(e.x - player.x, e.y - player.y);
                                if (d < minD) { minD = d; revengeTarget = e; }
                            }
                        }
                        for (let s = 0; s < w.spiritCount; s++) {
                            const st = w.spiritStates[s];
                            if (st.target && (!st.target.alive || st.target.deathMarked)) { st.target = null; st.lockTimer = 0; st.attackTimer = 0; }
                            if (revengeTarget) {
                            if (st.target !== revengeTarget) { st.target = revengeTarget; st.lockTimer = 0; st.attackTimer = 0; }
                            // 复仇特性：受击后精灵零秒锁定，直接进入攻击状态
                            st.lockTimer = Math.max(0.1, 1.0 - (w.lockReduction || 0));
                            continue;
                        }
                            if (st.target) continue;
                            let best = null, bestD = Infinity;
                            // 敌人不足时允许全部精灵堆叠同一目标（集中火力）；敌人充足时分散（每目标1只）
                            const maxPerTarget = alive.length <= w.spiritCount ? w.spiritCount : 1;
                            for (const e of alive) {
                                const taken = w.spiritStates.some(o => o !== st && o.target === e);
                                if (taken && w.spiritStates.filter(o => o.target === e).length >= maxPerTarget) continue;
                                const d = Math.hypot(e.x - st.x, e.y - st.y);
                                if (d < bestD) { bestD = d; best = e; }
                            }
                            if (best) { st.target = best; st.lockTimer = 0; st.attackTimer = 0; }
                        }
                        // 移动 + 前摇 + 攻速攻击
                        for (let s = 0; s < w.spiritCount; s++) {
                            const st = w.spiritStates[s];
                            if (st.target) {
                                const t = st.target;
                                // 瞬移到目标身边环绕（保留原移动方式，不做平滑B）
                                const angle = (Math.PI * 2 / w.spiritCount) * s + game.time * 1.5;
                                const orbitR = (t.size || 10) + 18;
                                st.x = t.x + Math.cos(angle) * orbitR;
                                st.y = t.y + Math.sin(angle) * orbitR;
                                if (st.lockTimer < lockTime) {
                                    // 前摇阶段：纯时间累积（不受攻速影响）
                                    st.lockTimer += dt;
                                } else {
                                    // 前摇完成：按攻速持续攻击同一目标
                                    st.attackTimer -= dt;
                                    if (st.attackTimer <= 0) {
                                        st.attackTimer = attackInterval;
                                        const dmg = w.damage * w.damageMultiplier * player.globalDamageMultiplier * player.getRiskMult() * player.getLowHpMult();
                                        const dx = t.x - st.x, dy = t.y - st.y;
                                        const dd = Math.hypot(dx, dy) || 1;
                                        const spd = 300;
                                        const proj = new Projectile(st.x, st.y, dx / dd * spd, dy / dd * spd, dmg, 0, 0, '#9955ff', 5);
                                        proj.shadowSlow = true;
                                        proj.slowChance = w.slowChance || 0;
                                        proj.slowAmount = w.slowAmount || 0.3;
                                        proj.slowDuration = w.slowDuration || 1.5;
                                        game.projectiles.push(proj);
                                        sound.play('spirit');
                                        spawnParticles(st.x, st.y, 8, '#b06aff', 70, 0.35, 3);
                                        spawnFx(st.x, st.y, 4, '#d8b0ff', { shape: 'star', glow: true, speed: 60, life: 0.3, size: 3 });
                                    }
                                }
                            } else {
                                // 无目标：回玩家身边绕圈
                                const angle = (Math.PI * 2 / w.spiritCount) * s + game.time * 0.5;
                                st.x = player.x + Math.cos(angle) * 50;
                                st.y = player.y + Math.sin(angle) * 50;
                                st.lockTimer = 0;
                                st.attackTimer = 0;
                            }
                        }
                    }
                }
            }

            function drawWeaponsVisuals(player, ctx) {
                for (const w of player.weapons) {
                    if (w.type === 'orbit_blade') {
                        // 旋转光带
                        for (let i = 0; i < w.bladeCount; i++) {
                            const ba = w.angle + (Math.PI * 2 / w.bladeCount) * i;
                            ctx.save();
                            ctx.strokeStyle = 'rgba(140,200,255,0.10)';
                            ctx.lineWidth = 9;
                            ctx.beginPath();
                            ctx.arc(player.x, player.y, w.radius, ba - 0.8, ba + 0.8);
                            ctx.stroke();
                            ctx.strokeStyle = 'rgba(190,225,255,0.16)';
                            ctx.lineWidth = 4;
                            ctx.beginPath();
                            ctx.arc(player.x, player.y, w.radius, ba - 0.45, ba + 0.45);
                            ctx.stroke();
                            ctx.restore();
                        }
                        for (let i = 0; i < w.bladeCount; i++) {
                            const ba = w.angle + (Math.PI * 2 / w.bladeCount) * i;
                            const bx = player.x + Math.cos(ba) * w.radius, by = player.y + Math.sin(ba) * w.radius;
                            const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 10);
                            grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, '#88ccff'); grad.addColorStop(1, 'rgba(100,180,255,0)');
                            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
                            ctx.save(); ctx.translate(bx, by); ctx.rotate(ba + Math.PI / 2);
                            ctx.fillStyle = '#ddeeff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(4, 7); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
                            ctx.restore();
                        }
                    }
                }
                if (player.weapons.some(w => w.type === 'frost_nova')) {
                    const w = player.weapons.find(w => w.type === 'frost_nova');
                    const pulse = 0.8 + Math.sin(game.time * 2) * 0.2;
                    ctx.strokeStyle = `rgba(150, 220, 255, ${0.2 * pulse})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(player.x, player.y, w.radius * 0.6, 0, Math.PI * 2); ctx.stroke();
                }
                // 绘制火焰/毒液区域
                if (game.fireZones) {
                    for (const zone of game.fireZones) {
                        const alpha = Math.min(1, zone.remaining / 2) * 0.5;
                        ctx.fillStyle = `rgba(${zone.rgb || '255, 100, 0'}, ${alpha})`;
                        ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill();
                    }
                }
                if (game.burningZones) {
                    for (const zone of game.burningZones) {
                        const alpha = Math.min(1, zone.remaining / 3) * 0.4;
                        ctx.fillStyle = `rgba(255, 60, 0, ${alpha})`;
                        ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill();
                    }
                }
                if (game.shadowZones) {
                    for (const sz of game.shadowZones) {
                        const alpha = Math.min(1, sz.remaining / 1.5) * 0.35;
                        const grad = ctx.createRadialGradient(sz.x, sz.y, 0, sz.x, sz.y, 90);
                        grad.addColorStop(0, `rgba(176,106,255,${alpha * 0.6})`);
                        grad.addColorStop(1, 'rgba(176,106,255,0)');
                        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sz.x, sz.y, 90, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = `rgba(200,160,255,${alpha * 0.8})`; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
                        ctx.beginPath(); ctx.arc(sz.x, sz.y, 90, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                    }
                }
                if (game.shadowTrails) {
                    for (const tr of game.shadowTrails) {
                        const a = tr.life / tr.maxLife;
                        ctx.fillStyle = `rgba(150,80,220,${a * 0.5})`;
                        ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = `rgba(220,180,255,${a * 0.7})`;
                        ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.size * 0.4 * a, 0, Math.PI * 2); ctx.fill();
                    }
                }
                // 绘制陨石下落动画
                if (game.meteorVisuals) {
                    for (const m of game.meteorVisuals) {
                        if (!m.landed) {
                            // 下落中的陨石
                            ctx.save();
                            ctx.translate(m.x, m.y);
                            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
                            grad.addColorStop(0, '#ffff88');
                            grad.addColorStop(0.4, '#ff6600');
                            grad.addColorStop(1, 'rgba(255,0,0,0)');
                            ctx.fillStyle = grad;
                            ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = '#ffcc44';
                            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
                            // 尾焰
                            ctx.strokeStyle = 'rgba(255, 150, 0, 0.6)';
                            ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -40); ctx.stroke();
                            ctx.strokeStyle = 'rgba(255, 80, 0, 0.4)';
                            ctx.lineWidth = 5;
                            ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -30); ctx.stroke();
                            ctx.restore();
                            // 落点标记
                            ctx.strokeStyle = `rgba(255, 100, 0, ${0.3 + Math.sin(game.time * 10) * 0.15})`;
                            ctx.lineWidth = 2;
                            ctx.setLineDash([4, 4]);
                            ctx.beginPath(); ctx.arc(m.x, m.targetY, m.radius, 0, Math.PI * 2); ctx.stroke();
                            ctx.setLineDash([]);
                        } else {
                            // 落地爆炸效果
                            const t = m.landedLife / 0.4;
                            const r = m.radius * (1.5 - t * 0.5);
                            ctx.fillStyle = `rgba(255, 100, 0, ${t * 0.5})`;
                            ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = `rgba(255, 200, 50, ${t * 0.7})`;
                            ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
                        }
                    }
                }
                for (const w of player.weapons) {
                    if (w.type === 'shadow_spirit') {
                        for (let s = 0; s < w.spiritCount; s++) {
                            const st = w.spiritStates && w.spiritStates[s] ? w.spiritStates[s] : { x: player.x, y: player.y };
                            // 锁定引导线：锁定中由淡渐实
                            if (st.target && st.target.alive) {
                                const prog = Math.min(1, st.lockTimer / Math.max(0.1, 1.0 - (w.lockReduction || 0)));
                                const la = 0.25 + prog * 0.65;
                                ctx.strokeStyle = `rgba(176, 106, 255, ${la})`;
                                ctx.lineWidth = 1.5;
                                ctx.setLineDash(prog >= 1 ? [] : [4, 5]);
                                ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.target.x, st.target.y); ctx.stroke();
                                ctx.setLineDash([]);
                                // 锁定读条环
                                ctx.strokeStyle = `rgba(230, 190, 255, ${0.5 + prog * 0.5})`;
                                ctx.lineWidth = 2;
                                ctx.beginPath(); ctx.arc(st.x, st.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
                            }
                            const glow = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, 12);
                            glow.addColorStop(0, 'rgba(200, 150, 255, 0.9)');
                            glow.addColorStop(0.5, 'rgba(150, 80, 255, 0.5)');
                            glow.addColorStop(1, 'rgba(100, 0, 200, 0)');
                            ctx.fillStyle = glow;
                            ctx.beginPath(); ctx.arc(st.x, st.y, 12, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = '#e0c0ff';
                            ctx.beginPath(); ctx.arc(st.x, st.y, 4, 0, Math.PI * 2); ctx.fill();
                        }
                    }
                }
                if (game.chainLightningVisuals) {
                    for (const v of game.chainLightningVisuals) {
                        const alpha = Math.min(1, v.life / 0.2);
                        ctx.strokeStyle = `rgba(255, 255, 100, ${alpha})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        const dx = v.x2 - v.x1, dy = v.y2 - v.y1;
                        const len = Math.hypot(dx, dy);
                        const segs = Math.max(3, Math.floor(len / 20));
                        ctx.moveTo(v.x1, v.y1);
                        for (let i = 1; i < segs; i++) {
                            const t = i / segs;
                            const mx = v.x1 + dx * t + (Math.random() - 0.5) * 16;
                            const my = v.y1 + dy * t + (Math.random() - 0.5) * 16;
                            ctx.lineTo(mx, my);
                        }
                        ctx.lineTo(v.x2, v.y2);
                        ctx.stroke();
                        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(v.x1, v.y1);
                        for (let i = 1; i < segs; i++) {
                            const t = i / segs;
                            const mx = v.x1 + dx * t + (Math.random() - 0.5) * 8;
                            const my = v.y1 + dy * t + (Math.random() - 0.5) * 8;
                            ctx.lineTo(mx, my);
                        }
                        ctx.lineTo(v.x2, v.y2);
                        ctx.stroke();
                    }
                }
            }
