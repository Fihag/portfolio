            // ==================== 敌人类 ====================
            class Enemy {
                constructor(x, y, typeKey, difficultyBonus = 0) {
                    const def = ENEMY_TYPES[typeKey];
                    this.x = x; this.y = y; this.typeKey = typeKey;
                    const isBoss = def.isBoss || false;
                    // Boss 按共用出场次数成长（复利，封顶7次，第7次全属性+15%血量再+20%），小怪按时间难度成长
                    const N = Math.max(1, game.bossAppearedCount);
                    const k = Math.min(N - 1, 7);
                    const sc = def.scale || null;
                    const step7 = k >= 7 ? 1.15 : 1;
                    const grow = (rate, capK = 6) => rate ? Math.pow(1 + rate, Math.min(k, capK)) * step7 : 1;
                    if (isBoss && sc) {
                        this.hp = Math.floor(def.hp * grow(sc.hpRate) * (k >= 7 ? 1.2 : 1));
                        this.speed = Math.min(def.speed * grow(sc.speedRate, sc.speedCap || 6), def.speed * 1.5);
                        // 熔岩巨兽：移速成长上限 1.8 倍（100→180）
                        if (this.typeKey === 'lavabeast') this.speed = Math.min(def.speed * grow(sc.speedRate, sc.speedCap || 6), def.speed * 1.8);
                        this.damage = Math.floor(def.damage * grow(sc.contactRate));
                    } else {
                        const hpBonus = 1 + difficultyBonus * 0.15;
                        this.hp = Math.floor(def.hp * hpBonus);
                        this.hp = Math.min(this.hp, Math.floor(def.hp * 11));
                        let rawSpeed = def.speed * (1 + difficultyBonus * 0.15);
                        this.speed = Math.min(rawSpeed, def.speed * 1.8);
                        const dmgBonus = 1 + difficultyBonus * 0.10;
                        this.damage = Math.floor(def.damage * dmgBonus);
                        this.damage = Math.min(this.damage, Math.floor(def.damage * 2.3));
                    }
                    this.maxHp = this.hp;
                    this.size = def.size; this.color = def.color;
                    this.xpValue = Math.floor(def.xpValue * (1 + difficultyBonus * 0.15));
                    this.shape = def.shape;
                    this.hp = Math.floor(this.hp * dbg.enemyHpMult);
                    this.maxHp = this.hp;
                    this.damage = Math.floor(this.damage * dbg.enemyDmgMult);
                    this.speed = this.speed * dbg.enemySpeedMult;
                    this.slowAmount = 0; this.slowTimer = 0; this.flashTimer = 0;
                    this.alive = true; this.orbitHitCd = 0; this.freezeTimer = 0;
                    this.isRanged = def.isRanged || false;
                    this.isGhost = def.isGhost || false;
                    this.isBoss = isBoss;
                    this.fireballTimer = this.isRanged ? rand(0, def.fireballCooldown) : 0;
                    this.fireballCooldown = def.fireballCooldown || 0;
                    this.fireballDamage = def.fireballDamage || 0;
                    this.fireballSpeed = def.fireballSpeed || 0;
                    this.attackRange = def.attackRange || 0;
                    this.dotDamage = def.dotDamage || 0;
                    this.dotDuration = def.dotDuration || 0;
                    if (this.isBoss) {
                        this.slashCooldown = def.slashCooldown;
                        this.slashTimer = this.slashCooldown;
                        this.slashDamage = Math.floor(def.slashDamage * grow(sc.slashRate));
                        this.slashSpeed = def.slashSpeed;
                        this.chargeTime = def.chargeTime;
                        this.charging = false;
                        this.chargeProgress = 0;
                        this.shieldBase = def.shieldBase || 0;
                        this.shieldHp = 0;
                        this.shieldMax = 0;
                        this.shieldTimer = 0;
                        this.shieldActivated = false;
                        this.shieldThresholds = [0.5, 0.25];
                        this.shieldRecharge = 0;
                        this.stunTimer = 0;
                        this.invincible = false;
                        // ===== Boss 百分比减伤（死神骑士成长型 / 母皇固定，出场3次后+5%） =====
                        if (this.typeKey === 'boss') {
                            this.damageReduction = Math.min(0.50, 0.25 + 0.04 * (game.bossAppearedCount - 1));
                        } else if (this.typeKey === 'broodmother') {
                            this.damageReduction = game.bossAppearedCount >= 3 ? 0.20 : 0.15;
                        } else if (this.typeKey === 'assassin') {
                            this.damageReduction = 0.35;
                        } else if (this.typeKey === 'lavabeast') {
                            this.damageReduction = 0.40;
                        } else {
                            this.damageReduction = 0;
                        }
                        this.auraColor = def.auraColor || 'rgba(80,0,80,0.6)';
                        // ===== 召唤技能（虫巢母皇，无数量上限） =====
                        this.summonType = def.summonType || null;
                        this.summonInterval = def.summonInterval || 0;
                        this.summonCount = def.summonCount || 0;
                        this.summonTimer = this.summonType ? 2 : 0;
                        // ===== 毒液喷射（虫巢母皇，伤害随出场次数成长） =====
                        this.acidCooldown = 4;
                        this.acidTimer = rand(1, 2.5);
                        this.acidDamage = Math.floor(14 * grow(sc.acidRate));
                        this.acidSpeed = 180;
                        this.acidRange = 320;
                        // ===== 冲击波技能 =====
                        this.shockwaveTimer = 5;
                        this.shockwaveInterval = 8;
                        this.shockwaveActive = false;
                        this.shockwaveRadius = 0;
                        this.shockwaveMaxRadius = 200;
                        this.shockwaveSpeed = 260;
                        this.shockwaveInnerSafe = 40;
                        this.shockwaveDamage = Math.floor((def.shockwaveDamage || 18) * grow(sc.shockwaveRate));
                        this.shockwaveHit = false;
                        // ===== 瞬影突进（暗影刺客） =====
                        // 预警间隔：初始 4s 减 0.8s；狂暴阶段 [6, 4.5, 3.5] 各减 0.8s
                        this.teleportTimer = 3.2;
                        this.teleportInterval = 4;
                        this.teleporting = false;
                        this.teleportProgress = 0;
                        // 闪现引导（落点预警）时间：0.9s 减 0.5s
                        this.teleportCharge = 0.4;
                        // ===== 影刃回旋（暗影刺客） =====
                        this.shurikenDamage = Math.floor((def.shurikenDamage || 16) * grow(sc.slashRate));
                        this.shurikenSpeed = def.shurikenSpeed || 240;
                        this.shurikenCount = def.shurikenCount || 6;
                        this.shurikenInterval = def.shurikenInterval || 7;
                        this.shurikenTimer = 3;
                        // ===== 熔岩巨兽技能组（伤害中低、频率高；全部吃 grow/diffMult 成长） =====
                        if (this.typeKey === 'lavabeast') {
                            this.lavaBarrageTimer = 4;      // 熔岩弹幕
                            this.lavaBarrageInterval = 5.5;
                            this.lavaEruptTimer = 6;        // 熔岩喷发
                            this.lavaEruptInterval = 6.5;
                            this.lavaLeapTimer = 8;         // 震地跃击
                            this.lavaLeapInterval = 9;
                            this.lavaHardenTimer = 10;      // 熔火硬化
                            this.lavaHardenInterval = 10;
                            this.lavaAimTimer = 4.5;        // 瞄准弹幕
                            this.lavaAimInterval = 4.5;
                            this.lavaAimWave = 0;           // 瞄准弹幕剩余波次
                            this.lavaAimWaveTimer = 0;      // 波间隔 0.15s
                            this.lavaChargeTimer = 6;       // 炽热冲锋
                            this.lavaChargeState = 'idle';  // idle / warn / dash
                            this.lavaChargeT = 0;
                            this.lavaChargeDx = 0; this.lavaChargeDy = 0;
                            this.lavaChargeHit = false;
                            this.lavaHarrassTimer = 0.45;   // 熔岩连射（常驻压制）
                            this.hardened = 0;              // 硬化剩余时间（石化停驻）
                            this.leaping = false;           // 滞空免伤中
                            this.leapWarnX = 0; this.leapWarnY = 0;
                            this.enraged = false;           // 狂暴(<50%)
                            this.trailTimer = 0;            // 火焰足迹节流
                            this.dying = false;             // 两段式死亡演出中
                            this.deathTimer = 0; this.deathBurstTimer = 0;
                            this.lavaDmg = Math.floor(14 * grow(sc.slashRate));       // 弹幕单发
                            this.lavaPoolDmg = Math.floor(10 * grow(sc.slashRate));   // 火区每跳
                            this.lavaEruptDmg = Math.floor(20 * grow(sc.slashRate));  // 喷发触伤
                            this.lavaLeapDmg = Math.floor(22 * grow(sc.slashRate));   // 落地震伤
                        }
                    }
                    // 不可能模式：小怪/精英 10% 减伤（Boss 不受影响）
                    if (game.selectedDifficulty === 'impossible' && !this.isBoss) this.damageReduction = 0.10;
                    // ===== 难度倍率 =====
                    const dm = game.diffMult || 1;
                    this.hp = Math.floor(this.hp * dm);
                    this.maxHp = this.hp;
                    this.damage = Math.floor(this.damage * dm);
                    if (this.fireballDamage) this.fireballDamage = Math.floor(this.fireballDamage * dm);
                    if (this.slashDamage) this.slashDamage = Math.floor(this.slashDamage * dm);
                    if (this.acidDamage) this.acidDamage = Math.floor(this.acidDamage * dm);
                    if (this.shockwaveDamage) this.shockwaveDamage = Math.floor(this.shockwaveDamage * dm);
                    if (this.shieldBase) this.shieldBase = Math.floor(this.shieldBase * dm);
                    // 不可能模式：怪物速度额外 ×1.15
                    if (game.selectedDifficulty === 'impossible') this.speed *= 1.15;
                }

                getEffectiveSpeed() { return this.slowTimer > 0 ? this.speed * (1 - this.slowAmount) : this.speed; }

                takeDamage(amount, sourceType = 'default', trueDamage = false, noNumber = false) {
                    // ===== 死亡标记锁定：无法造成伤害 =====
                    if (this.deathMarked && !trueDamage) return;
                    // ===== 熔岩巨兽濒死演出中：完全免伤（演出结束的终结调用走真伤通道） =====
                    if (this.dying && !trueDamage) return;
                    // ===== 震地跃击滞空：免伤 =====
                    if (this.leaping && !trueDamage) return;
                    // ===== 护盾吸收（真伤无视） =====
                    if (this.isBoss && this.invincible && !trueDamage) {
                        if (this.shieldHp > 0) {
                            const absorbed = Math.min(this.shieldHp, amount);
                            this.shieldHp -= absorbed;
                            amount -= absorbed;
                            spawnDamageNumber(this.x, this.y - this.size, absorbed, '#ffaa00');
                        }
                        if (amount <= 0) return;
                    }

                    // ===== Boss 百分比减伤（真伤无视） =====
                    if (this.isBoss && this.damageReduction && !trueDamage) {
                        amount = amount * (1 - this.damageReduction);
                        amount = Math.max(1, Math.floor(amount));
                    }

                    // ===== 扣血 =====
                    this.hp -= amount;
                    this.flashTimer = 0.08;
                    game.totalDamageDealt += amount;
                    // 吸血之爪：造成伤害的 10% 回复生命
                    if (game.player && game.player.relicVamp && amount > 0 && this.alive) {
                        const heal = Math.max(1, Math.floor(amount * 0.10));
                        if (game.player.hp < game.player.maxHp) {
                            game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
                            spawnParticles(game.player.x, game.player.y, 3, '#ff5577', 40, 0.3, 2);
                        }
                    }
                    if (!noNumber) spawnDamageNumber(this.x, this.y - this.size, amount, sourceType === 'frost' ? '#aaddff' : '#ffffff');
                    if (this.hp <= 0) {
                        // 熔岩巨兽两段式死亡：首次致死先进入濒死爆燃演出（期间免伤），演出结束才真正死亡并掉落奖励
                        if (this.typeKey === 'lavabeast' && !this.dying) { this.enterLavaDeath(); return; }
                        this.alive = false; game.kills++; game.score += this.xpValue;
                        // 熔岩巨兽专属：死亡新星 360° 大量弹幕同时迸发（四环 256 发）
                        if (this.typeKey === 'lavabeast') {
                            const novaColors = ['#ff9944', '#ffcc55', '#ff7722', '#ffcc66'];
                            for (let ring = 0; ring < 4; ring++) {
                                const n = 64, spd = 200 + ring * 70;
                                for (let i = 0; i < n; i++) {
                                    const na = (Math.PI * 2 / n) * i + ring * (Math.PI / n) + rand(0, 0.1);
                                    game.projectiles.push(new Projectile(this.x, this.y, Math.cos(na) * spd, Math.sin(na) * spd, this.lavaDmg, 0, 0, novaColors[ring], 7, true));
                                }
                            }
                            triggerShake(6, 0.3);
                        }
                        // Boss 击杀计数（用于超级Boss召唤）
                        if (this.isBoss && !this.isSuperBoss) game.bossKilledCount++;
                        // 灵魂碎片改为结算时按整体击杀数计算（见死亡结算处），此处不再累加
                        sound.play(this.isBoss ? 'bossDie' : 'enemyDie');
                        // 怨灵死亡：清除其 DoT 效果
                        if (this.isGhost && game.player) {
                            game.player.dotEffects = game.player.dotEffects.filter(d => d.source !== this);
                        }
                        // 击杀加速
                        if (game.player && game.player.killSpeed) {
                            if ((game.player.killSpeedStacks || 0) < 2) {
                                game.player.killSpeedStacks = (game.player.killSpeedStacks || 0) + 1;
                                game.player.speedMultiplier = (game.player.speedMultiplier || 1) + 0.15;
                            }
                            game.player.killSpeedTimer = 2;
                        }
                        // 击杀爆炸
                        if (game.player && game.player.killExplode) {
                            const explodeDmg = this.maxHp * 0.15;
                            sound.play('explosion');
                            const explodeRadius = 60;
                            for (const e of game.enemies) {
                                if (!e.alive || e === this) continue;
                                if (Math.hypot(e.x - this.x, e.y - this.y) < explodeRadius) {
                                    e.takeDamage(explodeDmg, 'explosion');
                                }
                            }
                            spawnParticles(this.x, this.y, 15, '#ff8844', 80, 0.4, 4);
                        }
                        // 爆裂词缀（不可能模式）：死亡时波及玩家
                        if (this.affixBurst && game.player && game.player.hp > 0) {
                            const pd = Math.hypot(game.player.x - this.x, game.player.y - this.y);
                            if (pd < 70 + game.player.size) game.player.takeDamage(Math.max(6, Math.floor(this.damage * 1.2)));
                            sound.play('explosion');
                            spawnParticles(this.x, this.y, 14, '#ff8833', 110, 0.45, 4);
                        }
                        // 经验球价值随难度增长（每级 +5%，上限 +100%），缓解后期升级停滞
                        const expBonus = 1 + 0.05 * Math.min(Math.max(0, game.difficultyLevel - 1), 20);
                        const orbCount = this.isBoss ? 3 : (this.typeKey === 'brute' ? 4 : (this.typeKey === 'runner' ? 2 : 1));
                        for (let i = 0; i < orbCount; i++) {
                            const value = Math.floor((this.isBoss ? 80 : Math.floor(this.xpValue / orbCount)) * expBonus);
                            game.experienceOrbs.push({ x: this.x + rand(-8, 8), y: this.y + rand(-8, 8), value: value, life: 30, floatOffset: rand(0, Math.PI * 2) });
                        }
                        if (this.isBoss && game.player) {
                            game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.maxHp * 0.3);
                            spawnParticles(game.player.x, game.player.y, 20, '#ffd700', 80, 0.6, 6);
                            game.bossOnField = false;
                            // 成就「不死鸟」判定锚点：击杀 Boss 时的时间戳（低血窗口内击杀才达成）
                            game.lastBossKillTime = game.time;
                            // 重置生成计时：避免 Boss 死亡瞬间（bossTimer 已走完）立刻再刷下一只
                            game.bossTimer = (DIFFICULTIES[game.selectedDifficulty] || DIFFICULTIES.normal).bossRespawn;
                            // 暗黑镜像延迟 20 秒后才可召唤，避免 Boss 死亡后立即刷出（曾表现为"刺客重新刷新"）
                            game.superBossDelay = 20;
                            // 母皇死亡：巢穴崩塌，清除其幼体
                            if (this.typeKey === 'broodmother') {
                                for (const e of game.enemies) if (e.bossMinion === this) e.alive = false;
                            }
                            // 触发Boss掉落（已拥有的唯一道具不再出现，延迟1.5秒让死亡特效完整展示；
                            // 若期间玩家升级，则等升级面板关闭后再弹出，避免被选项卡掉）
                            if (!game.noBossDrop && !game.bossDropPending) {
                                game.bossDropPending = true;
                                const runId = game.runId;
                                const pool = BOSS_DROP_ITEMS;
                                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                                const choices = shuffled.slice(0, 3);
                                const showDropWhenReady = () => {
                                    if (!game.bossDropPending || game.runId !== runId) return;
                                    if (!game.player || game.player.hp <= 0) { game.bossDropPending = false; return; }
                                    if (game.state === 'levelup') {
                                        setTimeout(showDropWhenReady, 250);
                                        return;
                                    }
                                    game.bossDropPending = false;
                                    if (game.state === 'playing' || game.state === 'bossdrop') {
                                        game.bossDropChoices = choices;
                                        showBossDropPanel(choices);
                                    }
                                };
                                setTimeout(showDropWhenReady, 1500);
                            }
                        }
                        // 炎术士死亡火焰区域
                        if (this.typeKey === 'pyromancer') {
                            game.fireZones.push({ x: this.x, y: this.y, radius: 55, damage: 4, remaining: 2, tickRate: 0.5, tickTimer: 0 });
                        }
                        spawnParticles(this.x, this.y, this.isBoss ? 35 : (this.typeKey === 'brute' ? 18 : 8), this.color, 100, 0.5, this.isBoss ? 7 : 4);
                        if (this.isBoss || this.typeKey === 'brute') triggerShake(5, 0.25);
                    } else {
                        spawnParticles(this.x, this.y, 2, '#ffffff', 30, 0.15, 1.5);
                    }
                    if (this.isBoss && !this.invincible && this.shieldRecharge <= 0 && this.shieldThresholds.length && this.hp <= this.maxHp * this.shieldThresholds[0]) {
                        const threshold = this.shieldThresholds[0];
                        this.shieldThresholds.shift();
                        const isPhase3Shield = this.typeKey === 'broodmother' && threshold <= 0.3;
                        const sc3 = ENEMY_TYPES[this.typeKey].scale || null;
                        this.activateShield(isPhase3Shield ? 300 : 0, isPhase3Shield && sc3 ? sc3.shieldRate3 : null);
                    }
                }

                applySlow(amount, duration) {
                    if (this.typeKey === 'assassin') return;
                    let slowReduce = 0;
                    if (this.isBoss) slowReduce = 0.40 + (game.selectedDifficulty === 'impossible' ? 0.10 : 0);
                    else if (game.selectedDifficulty === 'impossible') slowReduce = 0.20;
                    if (slowReduce > 0) amount = Math.max(0, amount - slowReduce);
                    if (amount > this.slowAmount || this.slowTimer <= 0) this.slowAmount = amount;
                    this.slowTimer = Math.max(this.slowTimer, duration);
                }

                activateShield(extraBase = 0, rate = null) {
                    const base = (this.shieldBase || ENEMY_TYPES[this.typeKey].shieldBase) + extraBase;
                    const sc = ENEMY_TYPES[this.typeKey].scale || null;
                    const N = Math.max(1, game.bossAppearedCount);
                    const nk = Math.min(N - 1, 7);
                    const r = rate !== null ? rate : (sc ? sc.shieldRate : 0.25);
                    const shieldMult = sc ? Math.pow(1 + r, Math.min(nk, 6)) * (nk >= 7 ? 1.15 : 1) : 1;
                    this.shieldMax = Math.floor(base * shieldMult);
                    this.shieldHp = this.shieldMax;
                    this.invincible = true;
                    // 护盾无持续时间限制，只能被击破
                    this.shieldActivated = true;
                    spawnParticles(this.x, this.y, 20, '#aa00ff', 60, 0.5, 5);
                }

            }
