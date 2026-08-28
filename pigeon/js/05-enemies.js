            // ==================== 敌人类型 ====================
            const ENEMY_TYPES = {
                zombie:   { name: '小僵尸', hp: 30, speed: 60, size: 12, color: '#44cc66', xpValue: 12, damage: 7,  shape: 'circle' },
                runner:   { name: '疾行者', hp: 20, speed: 150, size: 9, color: '#ff5544', xpValue: 18, damage: 9,  shape: 'triangle' },
                brute:    { name: '巨兽',   hp: 85, speed: 40, size: 22, color: '#bb44ee', xpValue: 36, damage: 12, shape: 'square' },
                wraith:   { name: '怨灵',   hp: 28, speed: 55, size: 11, color: 'rgba(200,200,255,0.7)', xpValue: 17, damage: 0, shape: 'circle', isGhost: true, slowAmount: 0.35, slowDuration: 2, dotDamage: 1.5, dotDuration: 2 },
                pyromancer: { name: '炎术士', hp: 26, speed: 48, size: 9, color: '#ff6633', xpValue: 24, damage: 0, shape: 'triangle', isRanged: true, attackRange: 150, fireballDamage: 10, fireballSpeed: 180, fireballCooldown: 2.6 },
                boss:     { name: '死神骑士', hp: 1750, speed: 62, size: 26, color: '#4a0044', xpValue: 200, damage: 32, shape: 'square', isBoss: true, shieldBase: 850, slashDamage: 18, slashSpeed: 210, slashCooldown: 6, chargeTime: 0.9, shockwaveDamage: 18, scale: { hpRate: 0.35, shieldRate: 0.30, contactRate: 0.06, slashRate: 0.20, shockwaveRate: 0.15, speedRate: 0.40, speedCap: 3 } },
                hatchling:  { name: '巢穴幼体', hp: 25, speed: 135, size: 8, color: '#a8e063', xpValue: 12, damage: 9, shape: 'circle' },
                broodmother: { name: '虫巢母皇', hp: 2300, speed: 52, size: 30, color: '#7cbf4d', xpValue: 200, damage: 30, shape: 'circle', isBoss: true, shieldBase: 850, slashDamage: 0, slashSpeed: 0, slashCooldown: 6, chargeTime: 0.9, summonType: 'hatchling', summonInterval: 3.5, summonCount: 3, auraColor: 'rgba(120,200,80,0.6)', scale: { hpRate: 0.30, shieldRate: 0.25, shieldRate3: 0.30, contactRate: 0.06, acidRate: 0.20, speedRate: 0.40, speedCap: 3 } },
                assassin:  { name: '暗影刺客', hp: 1300, speed: 145, size: 20, color: '#5a2a7a', xpValue: 200, damage: 30, shape: 'triangle', isBoss: true, shieldBase: 1050, slashDamage: 30, slashSpeed: 320, slashCooldown: 3.5, chargeTime: 0.9, shurikenDamage: 20, shurikenSpeed: 300, shurikenCount: 6, shurikenInterval: 7, auraColor: 'rgba(120,60,190,0.6)', scale: { hpRate: 0.20, shieldRate: 0.25, slashRate: 0.25, speedRate: 0.35, speedCap: 3 } },
                lavabeast: { name: '熔岩巨兽', hp: 3200, speed: 145, size: 34, color: '#8a2b08', xpValue: 240, damage: 34, shape: 'circle', isBoss: true, shieldBase: 1300, slashDamage: 26, slashSpeed: 280, slashCooldown: 5.5, chargeTime: 0.9, summonType: 'lavaling', summonInterval: 8, summonCount: 3, auraColor: 'rgba(255,90,20,0.65)', scale: { hpRate: 0.32, shieldRate: 0.28, contactRate: 0.06, slashRate: 0.22, speedRate: 0.35, speedCap: 3 } },
                lavaling:  { name: '熔岩幼体', hp: 18, speed: 95, size: 9, color: '#ff6622', xpValue: 10, damage: 6, shape: 'circle', isGhost: true, slowAmount: 0.35, slowDuration: 1.5, dotDamage: 2, dotDuration: 2 }
            };

            
            // ==================== Boss掉落道具 ====================
            const BOSS_DROP_ITEMS = [
                { id: 'rage_potion', name: '怒火药剂', icon: 'flame', desc: '伤害 +15%', apply: (p) => { p.globalDamageMultiplier = (p.globalDamageMultiplier || 1) + 0.15; } },
                { id: 'life_spring', name: '生命之泉', icon: 'heart-pulse', desc: '最大生命+15%并回满', apply: (p) => { p.maxHp = Math.floor(p.maxHp * 1.15); p.hp = p.maxHp; spawnParticles(p.x, p.y, 20, '#55ff88', 60, 0.5, 4); } },
                { id: 'exp_crystal', name: '经验结晶', icon: 'gem', desc: '经验获取 +10%', apply: (p) => { p.expMultiplier = (p.expMultiplier || 1) + 0.10; } },
                { id: 'attack_speed_orb', name: '攻速宝珠', icon: 'zap', desc: '所有武器冷却 -10%', apply: (p) => { p.globalCooldownMultiplier = (p.globalCooldownMultiplier || 1) * 0.90; } }
            ];

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

                update(dt, player) {
                    if (!this.alive) return;
                    if (this.flashTimer > 0) this.flashTimer -= dt;
                    updateBuffTimers(this, dt);
                    if (this.slowTimer > 0) this.slowTimer -= dt;
                    if (this.orbitHitCd > 0) this.orbitHitCd -= dt;
                    // 精英自愈：每秒回 0.5% 最大生命
                    if (this.isElite && this.eliteRegen && this.hp < this.maxHp) {
                        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.eliteRegen * dt);
                    }
                    if (this.deathMarked) { return; }
                    if (this.freezeTimer > 0) { this.freezeTimer -= dt; return; }
                    // ===== 熔岩巨兽：两段式死亡演出（连续爆燃+熔岩池，结束才真正死亡结算） =====
                    if (this.dying) {
                        this.deathTimer -= dt;
                        this.deathBurstTimer -= dt;
                        if (this.deathBurstTimer <= 0) {
                            this.deathBurstTimer = 0.32;
                            // 360° 环形螺旋弹幕（每跳 16 发，随演出旋转）
                            const ringN = 16;
                            for (let i = 0; i < ringN; i++) {
                                const ba = (Math.PI * 2 / ringN) * i + this.deathTimer * 2;
                                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(ba) * rand(180, 280), Math.sin(ba) * rand(180, 280), this.lavaDmg, 0, 0, '#ff7722', 9, true));
                            }
                            if (game.fireZones.length < 40) game.fireZones.push({ x: clamp(this.x + rand(-70, 70), 25, WORLD_W - 25), y: clamp(this.y + rand(-70, 70), 25, WORLD_H - 25), radius: rand(42, 68), damage: this.lavaPoolDmg, remaining: 3, tickRate: 0.5, tickTimer: 0, rgb: '255,120,40' });
                            spawnParticles(this.x + rand(-18, 18), this.y + rand(-18, 18), 10, '#ff8833', 130, 0.5, 5);
                            triggerShake(4, 0.15);
                            sound.play('explosion');
                        }
                        if (this.deathTimer <= 0) {
                            // 演出结束：真伤通道重入死亡结算（经验/掉落/计数）
                            this.takeDamage(9999999, 'lavaDeath', true, true);
                        }
                        return;
                    }
                    // ===== 熔岩巨兽：震地跃击滞空（免伤，落点预警后砸落） =====
                    if (this.leaping) {
                        this.leapT -= dt;
                        if (this.leapT <= 0) {
                            this.leaping = false;
                            this.x = clamp(this.leapWarnX, this.size, WORLD_W - this.size);
                            this.y = clamp(this.leapWarnY, this.size, WORLD_H - this.size);
                            game.rings.push({ x: this.x, y: this.y, r: 14, maxR: 150, life: 0.45, maxLife: 0.45, color: '#ff7722', width: 6 });
                            if (dist(this, player) < 120 + player.size) player.takeDamage(this.lavaLeapDmg);
                            if (game.fireZones.length < 40) game.fireZones.push({ x: this.x, y: this.y, radius: 46, damage: this.lavaPoolDmg, remaining: 2.5, tickRate: 0.5, tickTimer: 0, rgb: '255,120,40' });
                            // 落地追加径向火弹（封堵逃离）
                            for (let i = 0; i < 10; i++) {
                                const ra = (Math.PI * 2 / 10) * i;
                                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(ra) * 270, Math.sin(ra) * 270, this.lavaDmg, 0, 0, '#ff9944', 8, true));
                            }
                            triggerShake(7, 0.35);
                            sound.play('explosion');
                            spawnParticles(this.x, this.y, 24, '#ff6622', 140, 0.55, 5);
                        }
                        return; // 滞空悬停
                    }
                    // ===== 熔岩巨兽：熔火硬化（石化停驻减伤窗口） =====
                    if (this.hardened > 0) {
                        this.hardened -= dt;
                        if (Math.random() < 0.35) spawnParticles(this.x + rand(-this.size, this.size) * 0.7, this.y - rand(0, this.size * 0.6), 1, '#ffa044', 30, 0.5, 2);
                        return; // 石化期间不动不放技能
                    }
                    // ===== 熔岩巨兽：炽热冲锋（预警→直线冲撞，反放风筝核心） =====
                    if (this.lavaChargeState === 'warn') {
                        this.lavaChargeT -= dt;
                        // 预警期间持续瞄准，发射瞬间锁定方向
                        const ca = Math.atan2(player.y - this.y, player.x - this.x);
                        this.lavaChargeDx = Math.cos(ca); this.lavaChargeDy = Math.sin(ca);
                        if (this.lavaChargeT <= 0) {
                            this.lavaChargeState = 'dash';
                            this.lavaChargeT = 0.75;
                            this.lavaChargeHit = false;
                            sound.play('explosion');
                        }
                        return; // 预警停驻
                    }
                    if (this.lavaChargeState === 'dash') {
                        this.lavaChargeT -= dt;
                        const oldX = this.x, oldY = this.y;
                        this.x = clamp(this.x + this.lavaChargeDx * 620 * dt, this.size, WORLD_W - this.size);
                        this.y = clamp(this.y + this.lavaChargeDy * 620 * dt, this.size, WORLD_H - this.size);
                        if (Math.random() < 0.6) spawnParticles(this.x, this.y, 2, '#ff7722', 40, 0.3, 3);
                        // 撞到玩家：剑气伤害 + 击退
                        if (!this.lavaChargeHit && dist(this, player) < this.size + player.size + 4) {
                            this.lavaChargeHit = true;
                            player.takeDamage(this.slashDamage);
                            player.x = clamp(player.x + this.lavaChargeDx * 60, player.size, WORLD_W - player.size);
                            player.y = clamp(player.y + this.lavaChargeDy * 60, player.size, WORLD_H - player.size);
                            triggerShake(6, 0.3);
                        }
                        // 撞墙或冲撞结束（无眩晕，直接恢复行动）
                        const hitWall = (this.x === oldX && Math.abs(this.lavaChargeDx) > 0.01) || (this.y === oldY && Math.abs(this.lavaChargeDy) > 0.01);
                        if (this.lavaChargeT <= 0 || hitWall) {
                            this.lavaChargeState = 'idle';
                            spawnParticles(this.x, this.y, 16, '#ff6622', 110, 0.5, 5);
                            triggerShake(4, 0.2);
                        }
                        return; // 冲撞期间不执行其他行为
                    }
                    if (this.isBoss) {
                        if (this.shieldRecharge > 0) this.shieldRecharge -= dt;
                        if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
                        if (this.invincible) {
                            if (this.shieldHp <= 0) {
                                this.invincible = false;
                                this.shieldHp = 0;
                                this.shieldRecharge = 8;
                                if (this.typeKey !== 'assassin') this.stunTimer = 1.5;
                                spawnParticles(this.x, this.y, 15, '#ffffff', 50, 0.4, 3);
                                return;
                            }
                        }
                        const hpRatio = this.hp / this.maxHp;
                        if (this.typeKey === 'lavabeast') {
                            // 狂暴：<50% 血量，技能间隔×0.5，移动留火焰足迹
                            if (!this.enraged && hpRatio < 0.5) {
                                this.enraged = true;
                                game.warningText = '熔岩巨兽进入狂暴！';
                                game.warningTimer = 1.5;
                                sound.play('bossWarn');
                                triggerShake(6, 0.4);
                            }
                            const rush = this.enraged ? 0.5 : 1;
                            // 常驻压制：熔岩连射（朝玩家单发，带散布）
                            this.lavaHarrassTimer -= dt;
                            if (this.lavaHarrassTimer <= 0) {
                                this.lavaHarrassTimer = this.enraged ? 0.3 : 0.45;
                                const ha = Math.atan2(player.y - this.y, player.x - this.x) + rand(-0.12, 0.12);
                                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(ha) * 340, Math.sin(ha) * 340, Math.max(1, Math.floor(this.lavaDmg * 0.6)), 0, 0, '#ffaa55', 7, true));
                            }
                            // 技能：炽热冲锋（拉近距离，反放风筝）
                            this.lavaChargeTimer -= dt;
                            if (this.lavaChargeTimer <= 0 && this.lavaChargeState === 'idle' && !this.leaping) {
                                this.lavaChargeTimer = this.enraged ? 5 : 7;
                                this.lavaChargeState = 'warn';
                                this.lavaChargeT = 0.4;
                                sound.play('bossWarn');
                            }
                            if (this.enraged) {
                                this.trailTimer -= dt;
                                if (this.trailTimer <= 0) {
                                    this.trailTimer = 0.4;
                                    if (game.fireZones.length < 40) game.fireZones.push({ x: this.x, y: this.y, radius: 34, damage: this.lavaPoolDmg, remaining: 2.2, tickRate: 0.5, tickTimer: 0, rgb: '255,120,40' });
                                }
                            }
                            // 技能：熔岩弹幕（环形火弹齐射）
                            this.lavaBarrageTimer -= dt;
                            if (this.lavaBarrageTimer <= 0) {
                                this.lavaBarrageTimer = this.lavaBarrageInterval * rush;
                                const n = this.enraged ? 24 : 20;
                                for (let i = 0; i < n; i++) {
                                    const a = (Math.PI * 2 / n) * i + rand(0, 0.4);
                                    game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 300, Math.sin(a) * 300, this.lavaDmg, 0, 0, i % 2 ? '#ff7722' : '#ffaa33', 9, true));
                                }
                                spawnParticles(this.x, this.y, 18, '#ff8833', 120, 0.5, 5);
                                sound.play('explosion');
                            }
                            // 技能：瞄准弹幕（朝玩家扇形三波连发）
                            this.lavaAimTimer -= dt;
                            if (this.lavaAimTimer <= 0) {
                                this.lavaAimTimer = this.lavaAimInterval * rush;
                                this.lavaAimWave = 3;
                                this.lavaAimWaveTimer = 0;
                            }
                            if (this.lavaAimWave > 0) {
                                this.lavaAimWaveTimer -= dt;
                                if (this.lavaAimWaveTimer <= 0) {
                                    this.lavaAimWaveTimer = 0.15;
                                    this.lavaAimWave--;
                                    const baseA = Math.atan2(player.y - this.y, player.x - this.x);
                                    const spread = 0.55;
                                    for (let i = 0; i < 6; i++) {
                                        const a = baseA - spread / 2 + (spread / 5) * i;
                                        game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 310, Math.sin(a) * 310, this.lavaDmg, 0, 0, '#ff9944', 8, true));
                                    }
                                }
                            }
                            // 技能：熔岩喷发（玩家附近预警圈→爆燃火区+触伤；预警圈向玩家漂移追踪）
                            this.lavaEruptTimer -= dt;
                            if (this.lavaEruptTimer <= 0) {
                                this.lavaEruptTimer = this.lavaEruptInterval * rush;
                                const warns = this.enraged ? 6 : 4;
                                if (!game.lavaWarns) game.lavaWarns = [];
                                for (let i = 0; i < warns; i++) {
                                    game.lavaWarns.push({ x: clamp(player.x + rand(-70, 70), 30, WORLD_W - 30), y: clamp(player.y + rand(-70, 70), 30, WORLD_H - 30), r: 70, t: 0.6, max: 0.6, dmg: this.lavaEruptDmg, poolDmg: this.lavaPoolDmg });
                                }
                                sound.play('bossWarn');
                            }
                            // 技能：震地跃击
                            this.lavaLeapTimer -= dt;
                            if (this.lavaLeapTimer <= 0 && !this.leaping && this.lavaChargeState === 'idle') {
                                this.lavaLeapTimer = this.lavaLeapInterval * rush;
                                this.leaping = true;
                                this.leapT = 0.35;
                                this.leapWarnX = player.x; this.leapWarnY = player.y;
                                spawnParticles(this.x, this.y, 20, '#ff6622', 90, 0.5, 5);
                            }
                            // 技能：熔火硬化
                            this.lavaHardenTimer -= dt;
                            if (this.lavaHardenTimer <= 0 && this.hardened <= 0 && !this.leaping) {
                                this.lavaHardenTimer = this.lavaHardenInterval * rush;
                                this.hardened = 2.5;
                                spawnParticles(this.x, this.y, 22, '#cccccc', 70, 0.6, 4);
                                sound.play('shield');
                            }
                            // 召唤熔岩幼体
                            this.summonTimer -= dt;
                            if (this.summonTimer <= 0) {
                                this.summonTimer = this.summonInterval * (this.enraged ? 0.7 : 1);
                                for (let i = 0; i < this.summonCount; i++) {
                                    if (game.enemies.length >= MAX_ENEMIES) break;
                                    const ang = rand(0, Math.PI * 2);
                                    const mxp = clamp(this.x + Math.cos(ang) * (this.size + 20), 20, WORLD_W - 20);
                                    const myp = clamp(this.y + Math.sin(ang) * (this.size + 20), 20, WORLD_H - 20);
                                    const minion = new Enemy(mxp, myp, 'lavaling', game.difficultyLevel - 1);
                                    minion.bossMinion = this;
                                    game.enemies.push(minion);
                                    spawnParticles(mxp, myp, 8, '#ff6622', 60, 0.4, 3);
                                }
                                sound.play('summon');
                            }
                        } else if (this.typeKey === 'broodmother') {
                            const phase3 = hpRatio < 0.25;
                            // ===== 母皇：召唤幼体（50%狂暴：2秒×4只；25%三阶段：1.6秒×4只且幼体强化30%） =====
                            let summonInt = this.summonInterval;
                            let summonN = this.summonCount;
                            if (hpRatio < 0.5) { summonInt = 2; summonN = 4; }
                            if (phase3) summonInt = 1.6;
                            this.summonTimer -= dt;
                            if (this.summonTimer <= 0) {
                                this.summonTimer = summonInt;
                                if (game.enemies.length < MAX_ENEMIES) {
                                    for (let i = 0; i < summonN; i++) {
                                        const ang = rand(0, Math.PI * 2);
                                        const mx = clamp(this.x + Math.cos(ang) * (this.size + 18), 20, WORLD_W - 20);
                                        const my = clamp(this.y + Math.sin(ang) * (this.size + 18), 20, WORLD_H - 20);
                                        const minion = new Enemy(mx, my, this.summonType, game.difficultyLevel - 1);
                                        minion.bossMinion = this;
                                        if (phase3) {
                                            minion.hp = Math.floor(minion.hp * 1.3);
                                            minion.maxHp = minion.hp;
                                            minion.damage = Math.floor(minion.damage * 1.3);
                                            minion.speed = minion.speed * 1.3;
                                        }
                                        game.enemies.push(minion);
                                    }
                                    spawnParticles(this.x, this.y, 12, this.color, 60, 0.4, 3);
                                    sound.play('summon');
                                }
                            }
                            // ===== 毒液喷射：周期朝玩家吐酸弹（三阶段：3秒一发，1秒自爆） =====
                            this.acidTimer -= dt;
                            if (this.acidTimer <= 0) {
                                this.acidTimer = phase3 ? 3 : this.acidCooldown;
                                if (dist(this, player) < this.acidRange) {
                                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                                    const pj = new Projectile(this.x, this.y, Math.cos(angle) * this.acidSpeed, Math.sin(angle) * this.acidSpeed, this.acidDamage, 0, 0, '#66ff44', 6, true);
                                    pj.acid = true;
                                    pj.acidPooled = false;
                                    pj.acidFuse = 1;
                                    pj.poolDamage = phase3 ? 15 : 10;
                                    pj.poolRadius = phase3 ? 85 : 75;
                                    game.projectiles.push(pj);
                                    sound.play('acidSpit');
                                    spawnParticles(this.x, this.y, 6, '#66ff44', 50, 0.3, 3);
                                }
                            }
                        } else if (this.typeKey === 'assassin') {
                            // ===== 暗影刺客：瞬影突进 + 残影 + 影刃回旋 =====
                            // 超级Boss：暗黑镜像——复制玩家武器攻击
                            if (this.isSuperBoss && game.player) {
                                this.mirrorTimer = (this.mirrorTimer || 0) - dt;
                                if (this.mirrorTimer <= 0) {
                                    this.mirrorTimer = 1.2;
                                    const p = game.player;
                                    // 朝玩家发射：魔法弹（如果玩家有）
                                    const anyWep = p.weapons.length > 0 ? p.weapons[randInt(0, p.weapons.length - 1)] : null;
                                    if (anyWep) {
                                        const base = Math.atan2(player.y - this.y, player.x - this.x);
                                        const spd = 290;
                                        const dmg = Math.max(10, Math.floor((anyWep.damage || 15) * (anyWep.damageMultiplier || 1) * 0.8));
                                        if (anyWep.type === 'orbit_blade') {
                                            for (let k = -1; k <= 1; k++) {
                                                const a = base + k * 0.22;
                                                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd, dmg, 0, 0, '#cc44ff', 8, true));
                                            }
                                        } else if (anyWep.type === 'frost_nova') {
                                            for (let k = 0; k < 8; k++) {
                                                const a = base + (Math.PI * 2 / 8) * k;
                                                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd, dmg * 0.7, 0, 0, '#88ccff', 6, true));
                                            }
                                        } else if (anyWep.type === 'lightning_chain') {
                                            const nearest = p.getNearestEnemy();
                                            const tgt = nearest && nearest.alive ? nearest : player;
                                            game.projectiles.push(new Projectile(this.x, this.y, Math.cos(base) * spd, Math.sin(base) * spd, dmg * 1.2, 0, 0, '#ffff44', 5, true));
                                        } else if (anyWep.type === 'meteor') {
                                            game.meteorVisuals.push({ x: player.x, y: player.y - 300, targetY: player.y, fallSpeed: 500, damage: dmg * 1.5, radius: 90, landed: false, leaveBurning: false });
                                        } else {
                                            game.projectiles.push(new Projectile(this.x, this.y, Math.cos(base) * spd, Math.sin(base) * spd, dmg, 0, 0, '#cc44ff', 5, true));
                                        }
                                        spawnParticles(this.x, this.y, 8, '#cc44ff', 60, 0.3, 3);
                                    }
                                }
                            }
                            const enraged = hpRatio < 0.25 ? 2 : (hpRatio < 0.5 ? 1 : 0);
                            if (!this.teleporting) {
                                this.teleportTimer -= dt;
                                if (this.teleportTimer <= 0) {
                                    this.teleporting = true;
                                    this.teleportProgress = 0;
                                    // 预计算降落方位（闪现期间在落点显示警示标记）
                                    this.computeTeleportTarget(player);
                                }
                            } else {
                                this.teleportProgress += dt;
                                if (this.teleportProgress >= this.teleportCharge) {
                                    this.doTeleport(player);
                                    this.teleporting = false;
                                    this.teleportTimer = [5.2, 3.7, 2.7][enraged];
                                }
                            }
                            // 影刃回旋：朝玩家方向环形飞刀（狂暴时更快）
                            this.shurikenTimer -= dt;
                            if (this.shurikenTimer <= 0) {
                                this.shurikenTimer = enraged === 2 ? this.shurikenInterval * 0.6 : this.shurikenInterval;
                                this.fireShuriken(player);
                            }
                        } else {
                            // ===== 死神骑士：剑气 + 冲击波 + 狂暴 =====
                            let slashCd = this.slashCooldown;
                            if (hpRatio < 0.5) slashCd = this.slashCooldown * 0.8;
                            if (hpRatio < 0.25) slashCd = this.slashCooldown * 0.6;
                            if (!this.charging) {
                                this.slashTimer -= dt;
                                if (this.slashTimer <= 0) { this.charging = true; this.chargeProgress = 0; }
                            } else {
                                this.chargeProgress += dt;
                                if (this.chargeProgress >= this.chargeTime) {
                                    this.fireSlash(player);
                                    this.charging = false;
                                    this.slashTimer = slashCd;
                                }
                            }
                            // 冲击波技能
                            this.shockwaveTimer -= dt;
                            if (this.shockwaveTimer <= 0 && !this.shockwaveActive) {
                                this.shockwaveActive = true;
                                this.shockwaveRadius = 0;
                                this.shockwaveHit = false;
                                spawnParticles(this.x, this.y, 12, '#ff4400', 50, 0.4, 4);
                            }
                            if (this.shockwaveActive) {
                                this.shockwaveRadius += this.shockwaveSpeed * dt;
                                if (!this.shockwaveHit) {
                                    const playerDist = dist(player, this);
                                    if (playerDist > this.shockwaveInnerSafe && playerDist < this.shockwaveRadius) {
                                        player.takeDamage(this.shockwaveDamage);
                                        this.shockwaveHit = true;
                                        triggerShake(4, 0.2);
                                    }
                                }
                                if (this.shockwaveRadius >= this.shockwaveMaxRadius) {
                                    this.shockwaveActive = false;
                                    let swInt = this.shockwaveInterval;
                                    if (hpRatio < 0.5) swInt = this.shockwaveInterval * 0.8;
                                    this.shockwaveTimer = swInt;
                                }
                            }
                        }
                    }
                    const dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy) || 0.01;
                    const spd = this.getEffectiveSpeed();
                    let mx = 0, my = 0;
                    if (this.isRanged) {
                        const desiredDist = this.attackRange + 50;
                        if (d < desiredDist - 30) { mx = -(dx / d); my = -(dy / d); }
                        else if (d > desiredDist + 30) { mx = dx / d; my = dy / d; }
                        this.fireballTimer -= dt;
                        if (this.fireballTimer <= 0 && d < this.attackRange + 100) {
                            this.fireAtPlayer(player);
                            this.fireballTimer = this.fireballCooldown;
                        }
                    } else { mx = dx / d; my = dy / d; }
                    let sepX = 0, sepY = 0;
                    for (const other of game.enemies) {
                        if (other === this || !other.alive) continue;
                        const od = dist(this, other), minDist = (this.size + other.size) * 0.9;
                        if (od < minDist && od > 0) { sepX += (this.x - other.x) / od * (minDist - od) * 0.5; sepY += (this.y - other.y) / od * (minDist - od) * 0.5; }
                    }
                    this.x += mx * spd * dt + sepX * dt * 0.8; this.y += my * spd * dt + sepY * dt * 0.8;
                    this.x = clamp(this.x, this.size, WORLD_W - this.size); this.y = clamp(this.y, this.size, WORLD_H - this.size);
                    if (dist(this, player) < this.size + player.size) {
                        if (this.isGhost) {
                            if (this.dotDamage > 0) {
                                player.dotEffects = player.dotEffects.filter(e => e.source !== this);
                                player.dotEffects.push({ amount: this.dotDamage, remaining: this.dotDuration, source: this });
                            }
                        } else if (!this.isRanged) {
                            player.takeDamage(this.damage);
                            // 荆棘光环：反弹 50% 近战伤害给攻击者
                            if (player.relicThorn && this.alive) {
                                this.takeDamage(Math.max(1, Math.floor(this.damage * 0.5)), 'thorn');
                                spawnParticles(this.x, this.y, 6, '#88dd55', 60, 0.3, 3);
                            }
                            // 词缀（不可能模式）：灼热=接触附加燃烧 / 嗜血=近战回吸自身
                            if (this.affixBurn) {
                                player.dotEffects = player.dotEffects.filter(d => d.source !== this);
                                player.dotEffects.push({ amount: 2, remaining: 2, source: this });
                            }
                            if (this.affixLeech && this.hp > 0) {
                                const heal = Math.max(1, Math.floor(this.damage * 0.5));
                                if (this.hp < this.maxHp) spawnParticles(this.x, this.y - this.size, 4, '#55cc66', 40, 0.35, 2);
                                this.hp = Math.min(this.maxHp, this.hp + heal);
                            }
                            const pushDx = this.x - player.x, pushDy = this.y - player.y, pushD = Math.hypot(pushDx, pushDy) || 1;
                            this.x = player.x + pushDx / pushD * (this.size + player.size + 2);
                            this.y = player.y + pushDy / pushD * (this.size + player.size + 2);
                        }
                    }
                }

                // 熔岩巨兽：进入濒死爆燃演出（期间免伤锁定，结束才走真正死亡结算奖励）
                enterLavaDeath() {
                    this.dying = true;
                    this.hp = 0;
                    this.hardened = 0;
                    this.leaping = false;
                    this.deathTimer = 2.4;
                    this.deathBurstTimer = 0.15;
                    game.warningText = '熔岩巨兽核心过载！';
                    game.warningTimer = 1.6;
                    sound.play('bossWarn');
                    triggerShake(8, 0.5);
                    spawnParticles(this.x, this.y, 30, '#ff5522', 150, 0.7, 6);
                }

                fireAtPlayer(player) {
                    // 远程伤害随难度提升（每级 +10%，上限 2 倍）
                    const diffBonus = game.difficultyLevel - 1;
                    const dynamicDamage = Math.min(this.fireballDamage * (1 + diffBonus * 0.10), this.fireballDamage * 2.0);
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const vx = Math.cos(angle) * this.fireballSpeed;
                    const vy = Math.sin(angle) * this.fireballSpeed;
                    game.projectiles.push(new Projectile(this.x, this.y, vx, vy, dynamicDamage, 0, 0, '#ff4422', 4, true));
                }

                fireSlash(player) {
                    // 剑气伤害随出场次数成长（构造时已算好）
                    const dynamicDamage = this.slashDamage;
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const vx = Math.cos(angle) * this.slashSpeed;
                    const vy = Math.sin(angle) * this.slashSpeed;
                    game.projectiles.push(new Projectile(this.x, this.y, vx, vy, dynamicDamage, 0, 0, '#ff0000', 15, true));
                    spawnParticles(this.x, this.y, 10, '#ff0000', 40, 0.4, 3);
                }

                fireFanSlash(player, dmgScale = 1) {
                    // 扇形剑气三连发（暗影刺客主体 + 残影），伤害梯度 100%/50%/25%，避免一次贴脸吃满被秒
                    const baseDmg = Math.floor(this.slashDamage * dmgScale);
                    const base = Math.atan2(player.y - this.y, player.x - this.x);
                    const spread = 0.25;
                    const dmgGradient = [0.25, 1.0, 0.5];
                    for (let i = -1; i <= 1; i++) {
                        const a = base + spread * i;
                        const pj = new Projectile(this.x, this.y, Math.cos(a) * this.slashSpeed, Math.sin(a) * this.slashSpeed, Math.floor(baseDmg * dmgGradient[i + 1]), 0, 0, '#b06aff', 12, true);
                        pj.ignoreIFrame = true;
                        game.projectiles.push(pj);
                    }
                    spawnParticles(this.x, this.y, 8, '#b06aff', 50, 0.4, 3);
                }

                fireShuriken(player) {
                    // 影刃回旋：朝玩家方向聚拢扇形飞刀（更集中，非全圈散开）
                    const base = Math.atan2(player.y - this.y, player.x - this.x);
                    const spread = 0.55;
                    for (let i = 0; i < this.shurikenCount; i++) {
                        const t = this.shurikenCount > 1 ? i / (this.shurikenCount - 1) - 0.5 : 0;
                        const a = base + spread * t;
                        game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * this.shurikenSpeed, Math.sin(a) * this.shurikenSpeed, this.shurikenDamage, 0, 0, '#8a4bd8', 6, true));
                    }
                    spawnParticles(this.x, this.y, 10, '#8a4bd8', 60, 0.4, 3);
                }

                computeTeleportTarget(player) {
                    // 预计算闪现降落位置：玩家侧后方更远处（140px）
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const side = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
                    this.teleportTX = clamp(player.x + Math.cos(angle + Math.PI + side) * 140, 40, WORLD_W - 40);
                    this.teleportTY = clamp(player.y + Math.sin(angle + Math.PI + side) * 140, 40, WORLD_H - 40);
                }

                doTeleport(player) {
                    // 瞬影突进：闪现到玩家侧后方，起点留残影（减速区域 + 一次30%剑气），落地扇形三连
                    if (this.teleportTX === undefined || this.teleportTY === undefined) this.computeTeleportTarget(player);
                    const tx = this.teleportTX, ty = this.teleportTY;
                    this.teleportTX = undefined; this.teleportTY = undefined;
                    // 起点残影
                    game.shadowZones.push({ x: this.x, y: this.y, remaining: 1.5, echoTimer: 0.3, echoFired: false, echoDamage: Math.floor(this.slashDamage * 0.3), echoSpeed: this.slashSpeed });
                    spawnParticles(this.x, this.y, 24, '#b06aff', 90, 0.5, 4);
                    spawnParticles(this.x, this.y, 12, '#ffffff', 70, 0.35, 2.5);
                    spawnParticles(this.x, this.y, 10, '#5a2a7a', 60, 0.6, 3);
                    // 瞬移拖影
                    if (!game.shadowTrails) game.shadowTrails = [];
                    for (let k = 1; k <= 7; k++) {
                        const t = k / 8;
                        game.shadowTrails.push({ x: this.x + (tx - this.x) * t + rand(-5, 5), y: this.y + (ty - this.y) * t + rand(-5, 5), life: 0.35 + t * 0.2, maxLife: 0.55, size: 8 + t * 6 });
                    }
                    // 瞬移
                    this.x = tx; this.y = ty;
                    spawnParticles(this.x, this.y, 26, '#b06aff', 100, 0.55, 4.5);
                    spawnParticles(this.x, this.y, 12, '#ffffff', 80, 0.4, 3);
                    triggerShake(4, 0.2);
                    // 落地扇形三连
                    this.fireFanSlash(player);
                }

                draw(ctx) {
                    const flashOn = this.flashTimer > 0;
                    if (this.isBoss) {
                        const auraGrad = ctx.createRadialGradient(this.x, this.y, this.size * 1.2, this.x, this.y, this.size * 2);
                        auraGrad.addColorStop(0, this.auraColor); auraGrad.addColorStop(1, 'rgba(80,0,80,0)');
                        ctx.fillStyle = auraGrad; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2); ctx.fill();
                        if (this.typeKey === 'boss' && this.hp / this.maxHp < 0.5) {
                            const rageAura = ctx.createRadialGradient(this.x, this.y, this.size * 1.2, this.x, this.y, this.size * 2.2);
                            rageAura.addColorStop(0, `rgba(255,40,20,${0.35 + Math.sin(game.time * 8) * 0.15})`);
                            rageAura.addColorStop(1, 'rgba(255,40,20,0)');
                            ctx.fillStyle = rageAura; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2); ctx.fill();
                        }
                        if (this.invincible && this.shieldHp > 0) {
                            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2); ctx.stroke();
                            const barW = this.size * 2.2;
                            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, this.y - this.size - 18, barW, 6);
                            ctx.fillStyle = '#ff00ff'; ctx.fillRect(this.x - barW / 2, this.y - this.size - 18, barW * (this.shieldHp / this.shieldMax), 6);
                        }
                    }
                    ctx.fillStyle = flashOn ? '#ffffff' : this.color;
                    ctx.strokeStyle = flashOn ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = this.isBoss ? 3 : 1.5;
                    ctx.beginPath();
                    if (this.shape === 'circle') ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    else if (this.shape === 'triangle') { const s = this.size; ctx.moveTo(this.x, this.y - s); ctx.lineTo(this.x + s * 0.87, this.y + s * 0.5); ctx.lineTo(this.x - s * 0.87, this.y + s * 0.5); ctx.closePath(); }
                    else if (this.shape === 'square') ctx.rect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
                    ctx.fill(); ctx.stroke();
                    if (this.isElite) {
                        const pulse = 0.5 + Math.sin(game.time * 6) * 0.3;
                        ctx.strokeStyle = `rgba(255,215,0,${pulse + 0.3})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2); ctx.stroke();
                    }
                    // 词缀光环（不可能模式）
                    if (this.affixColor) {
                        ctx.strokeStyle = this.affixColor; ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.stroke();
                    }
                    // ===== 熔岩巨兽专属视觉 =====
                    if (this.typeKey === 'lavabeast') {
                        const lp = 0.5 + Math.sin(game.time * 5) * 0.3;
                        // 岩浆裂纹（旋转辐射线）
                        ctx.strokeStyle = `rgba(255,140,40,${0.45 + lp * 0.5})`; ctx.lineWidth = 2;
                        for (let i = 0; i < 5; i++) {
                            const ca = (Math.PI * 2 / 5) * i + game.time * 0.6;
                            ctx.beginPath();
                            ctx.moveTo(this.x, this.y);
                            ctx.lineTo(this.x + Math.cos(ca) * this.size * 0.85, this.y + Math.sin(ca) * this.size * 0.85);
                            ctx.stroke();
                        }
                        // 熔核辉光
                        const coreG = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.size * 0.7);
                        coreG.addColorStop(0, `rgba(255,200,80,${0.5 + lp * 0.4})`);
                        coreG.addColorStop(1, 'rgba(255,120,30,0)');
                        ctx.fillStyle = coreG; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2); ctx.fill();
                        // 熔火硬化石壳
                        if (this.hardened > 0) {
                            ctx.strokeStyle = 'rgba(165,165,175,0.95)'; ctx.lineWidth = 5;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 2, 0, Math.PI * 2); ctx.stroke();
                        }
                        // 濒死爆燃闪烁
                        if (this.dying) {
                            const da = Math.max(0, 0.35 + Math.sin(game.time * 22) * 0.3);
                            ctx.fillStyle = `rgba(255,240,180,${da})`;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (1.2 + Math.sin(game.time * 14) * 0.12), 0, Math.PI * 2); ctx.fill();
                        }
                        // 炽热冲锋：预警方向线 / 冲撞高亮
                        if (this.lavaChargeState === 'warn') {
                            const cw = 0.5 + Math.sin(game.time * 16) * 0.35;
                            ctx.strokeStyle = `rgba(255,60,30,${cw + 0.3})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.moveTo(this.x, this.y);
                            ctx.lineTo(this.x + this.lavaChargeDx * 420, this.y + this.lavaChargeDy * 420); ctx.stroke();
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2); ctx.stroke();
                        }
                        if (this.lavaChargeState === 'dash') {
                            ctx.globalAlpha = 0.45;
                            ctx.fillStyle = '#ffcc66';
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 1.15, 0, Math.PI * 2); ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                        // 震地跃击：滞空半透明+落点预警圈
                        if (this.leaping) {
                            const lw = 0.5 + Math.sin(game.time * 14) * 0.3;
                            ctx.strokeStyle = `rgba(255,100,40,${lw + 0.25})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(this.leapWarnX, this.leapWarnY, 95, 0, Math.PI * 2); ctx.stroke();
                            ctx.globalAlpha = 0.55;
                            ctx.fillStyle = this.color;
                            ctx.beginPath(); ctx.arc(this.x, this.y - 14, this.size, 0, Math.PI * 2); ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                    }
                    if (this.isGhost) { ctx.fillStyle = 'rgba(200,200,255,0.3)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.fill(); }
                    if (this.slowTimer > 0) { ctx.fillStyle = 'rgba(150,200,255,0.5)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2); ctx.fill(); }
                    if (this.freezeTimer > 0) {
                        ctx.fillStyle = 'rgba(130,220,255,0.5)';
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        for (let i = 0; i < 4; i++) {
                            const fx = this.x + Math.cos(i * Math.PI / 2 + game.time * 3) * (this.size + 2);
                            const fy = this.y + Math.sin(i * Math.PI / 2 + game.time * 3) * (this.size + 2);
                            ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
                        }
                    }
                    if (this.typeKey === 'broodmother') {
                        ctx.strokeStyle = 'rgba(150,220,120,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                        for (let i = 0; i < 4; i++) {
                            const ea = game.time * 0.8 + i * Math.PI / 2;
                            const ex = this.x + Math.cos(ea) * (this.size + 6);
                            const ey = this.y + Math.sin(ea) * (this.size + 6);
                            ctx.fillStyle = 'rgba(230,255,220,0.9)';
                            ctx.beginPath(); ctx.ellipse(ex, ey, 3, 4.5, ea, 0, Math.PI * 2); ctx.fill();
                        }
                        if (this.summonType && this.summonTimer < 0.5 && !this.invincible) {
                            const pulse = 0.5 + Math.sin(game.time * 18) * 0.5;
                            ctx.strokeStyle = `rgba(160,255,120,${0.4 + pulse * 0.5})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 12 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
                        }
                    }
                    if (this.typeKey === 'assassin') {
                        // 角色特征：旋转暗影刀锋环 + 暗影波动
                        const spin = game.time * 2.2;
                        const pr2 = this.size + 16 + Math.sin(game.time * 5) * 2;
                        for (let k = 0; k < 3; k++) {
                            const ba = spin + k * Math.PI * 2 / 3;
                            const bx = this.x + Math.cos(ba) * pr2;
                            const by = this.y + Math.sin(ba) * pr2;
                            ctx.save();
                            ctx.translate(bx, by);
                            ctx.rotate(ba + Math.PI / 2);
                            ctx.fillStyle = 'rgba(200,160,255,0.85)';
                            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(3, 6); ctx.lineTo(-3, 6); ctx.closePath();
                            ctx.fill(); ctx.stroke();
                            ctx.restore();
                        }
                        const wv = 0.4 + Math.sin(game.time * 4) * 0.2;
                        ctx.strokeStyle = `rgba(120,60,190,${wv})`; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 22 + Math.sin(game.time * 3) * 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    if (this.typeKey === 'assassin' && this.teleporting) {
                        const progress = this.teleportProgress / this.teleportCharge;
                        const pulse = 0.6 + Math.sin(game.time * 20) * 0.4;
                        ctx.strokeStyle = `rgba(176,106,255,${0.5 + progress * 0.5})`; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 12 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
                        // 降落方位警示标记（落点圈 + 朝下箭头 + 外扩环）
                        if (this.teleportTX !== undefined && this.teleportTY !== undefined) {
                            const tx = this.teleportTX, ty = this.teleportTY;
                            const pp = 0.5 + Math.sin(game.time * 16) * 0.3;
                            ctx.strokeStyle = `rgba(255,70,255,${0.30 + progress * 0.5})`;
                            ctx.lineWidth = 2 + progress * 1.5;
                            ctx.setLineDash([5, 5]);
                            ctx.beginPath(); ctx.arc(tx, ty, 20, 0, Math.PI * 2); ctx.stroke();
                            ctx.setLineDash([]);
                            ctx.fillStyle = `rgba(255,120,255,${0.6 + pp * 0.4})`;
                            ctx.beginPath(); ctx.moveTo(tx, ty - 10); ctx.lineTo(tx + 9, ty + 6); ctx.lineTo(tx - 9, ty + 6); ctx.closePath(); ctx.fill();
                            ctx.fillStyle = 'rgba(255,255,255,0.9)';
                            ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = `rgba(255,120,255,${0.25 * (1 - progress)})`;
                            ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(tx, ty, 24 + progress * 10, 0, Math.PI * 2); ctx.stroke();
                        }
                    }
                    if (this.isBoss && this.charging) {
                        const progress = this.chargeProgress / this.chargeTime;
                        ctx.strokeStyle = `rgba(255,0,0,${0.5+progress*0.5})`; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 12, -Math.PI/2, -Math.PI/2 + Math.PI*2*progress); ctx.stroke();
                    }
                    // 冲击波绘制
                    if (this.isBoss && this.shockwaveActive) {
                        const r = this.shockwaveRadius;
                        const alpha = 1 - r / this.shockwaveMaxRadius;
                        ctx.strokeStyle = `rgba(255, 80, 0, ${alpha * 0.8})`; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
                        ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.4})`; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
                        // 内圈安全区标记
                        ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.3})`; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.shockwaveInnerSafe, 0, Math.PI * 2); ctx.stroke();
                        ctx.setLineDash([]);
                    }
                    if (this.isBoss || this.typeKey === 'brute') {
                        const barW = this.size * 2, barH = 4, barY = this.y - this.size - 10;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, barY, barW, barH);
                        ctx.fillStyle = '#ff4466'; ctx.fillRect(this.x - barW / 2, barY, barW * (this.hp / this.maxHp), barH);
                    }
                }
            }
