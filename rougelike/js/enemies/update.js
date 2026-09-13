            Enemy.prototype.update = function(dt, player) {
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
                    // ===== 两段式死亡演出（熔岩巨兽爆燃 / 幽月魔女镜碎，结束才真正死亡结算） =====
                    if (this.dying) {
                        this.deathTimer -= dt;
                        this.deathBurstTimer -= dt;
                        if (this.deathBurstTimer <= 0) {
                            this.deathBurstTimer = 0.32;
                            if (this.typeKey === 'lavabeast') {
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
                            } else if (this.typeKey === 'moonwitch') {
                                // 镜片迸散
                                spawnParticles(this.x + rand(-16, 16), this.y + rand(-16, 16), 12, '#d8e4ff', 150, 0.6, 4);
                                spawnFx(this.x, this.y, 8, '#ffffff', { shape: 'square', glow: true, speed: 170, life: 0.6, size: 5, rotSpeed: 6 });
                                triggerShake(5, 0.2);
                                sound.play('moonBreak');
                            }
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
                        } else if (this.typeKey === 'turret') {
                            // ===== 天罚炮台：原地要塞，精准打击 + 区域拒止 =====
                            const aim = Math.atan2(player.y - this.y, player.x - this.x);
                            this.turretAim = aim;
                            const rapidDmg = this.turretRapidDmg || 20;
                            const spdM = this.turretSpdMult || 1; // 弹速难度系数（DIFFICULTIES.bulletSpd）
                            // 扇形炮击：2.5s 一轮，9 发 ±10°（2.5° 间隔）连发两次（间隔 0.25s），基础弹速 415
                            this.turretVolleyTimer = (this.turretVolleyTimer === undefined ? 2.0 : this.turretVolleyTimer) - dt;
                            if (this.turretVolleyTimer <= 0) {
                                this.turretVolleyTimer = 2.5;
                                this.turretVolleySecond = 0.25; // 第二轮连发倒计时
                                this.turretVolleyAim = aim;
                                for (let i = 0; i < 9; i++) {
                                    const a = aim - Math.PI / 180 * 10 + Math.PI / 180 * 2.5 * i;
                                    game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 415 * spdM, Math.sin(a) * 415 * spdM, rapidDmg, 0, 0, '#ffcc55', 9.5, true));
                                }
                                sound.play('shoot');
                                spawnParticles(this.x + Math.cos(aim) * this.size, this.y + Math.sin(aim) * this.size, 6, '#ffdd88', 60, 0.3, 3);
                            }
                            if (this.turretVolleySecond !== undefined && this.turretVolleySecond > 0) {
                                this.turretVolleySecond -= dt;
                                if (this.turretVolleySecond <= 0) {
                                    for (let i = 0; i < 9; i++) {
                                        const a = this.turretVolleyAim - Math.PI / 180 * 10 + Math.PI / 180 * 2.5 * i;
                                        game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 415 * spdM, Math.sin(a) * 415 * spdM, rapidDmg, 0, 0, '#ffcc55', 9.5, true));
                                    }
                                    sound.play('shoot');
                                }
                            }
                            // 常驻速射：0.27s 一发直射弹（基础弹速 395）
                            this.turretRapidTimer = (this.turretRapidTimer === undefined ? 1.2 : this.turretRapidTimer) - dt;
                            if (this.turretRapidTimer <= 0) {
                                this.turretRapidTimer = 0.27;
                                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(aim) * 395 * spdM, Math.sin(aim) * 395 * spdM, rapidDmg, 0, 0, '#ffcc55', 8, true));
                                spawnParticles(this.x + Math.cos(aim) * this.size, this.y + Math.sin(aim) * this.size, 2, '#ffdd88', 50, 0.2, 2);
                            }
                            // 爆裂弹：4.5s 一轮 3 枚（基础弹速 415、射程 800），逼近玩家 100 内或射程尽头爆炸——爆心 35 伤（半径 140）+ 分裂 30 发环形弹（12° 整圆，基础弹速 345；尽头引爆 465）
                            this.turretBurstTimer = (this.turretBurstTimer === undefined ? 3.0 : this.turretBurstTimer) - dt;
                            if (this.turretBurstTimer <= 0) {
                                this.turretBurstTimer = 4.5;
                                for (let i = -1; i <= 1; i++) {
                                    const a = aim + i * 0.16;
                                    const shell = new Projectile(this.x, this.y, Math.cos(a) * 415 * spdM, Math.sin(a) * 415 * spdM, rapidDmg, 0, 0, '#ff5544', 10, true);
                                    shell.burstShell = true;
                                    shell.maxLifetime = 800 / (415 * spdM); // 射程恒定 800
                                    shell.burstCoreDmg = this.turretBurstCoreDmg || 35;
                                    shell.burstSplitDmg = this.turretSplitDmg || 22;
                                    shell.burstSplitSpd = 345 * spdM;
                                    shell.burstSplitSpdFar = 465 * spdM;
                                    game.projectiles.push(shell);
                                }
                                sound.play('shoot');
                                spawnParticles(this.x, this.y, 8, '#ff9966', 70, 0.3, 3);
                            }
                            // 扫射激光：锁定(0.7s 预警) → 发射(0.5s，120°/s 扫 60°，长 1200 穿透，线上 24 伤，每束判定一次)，冷却 6s
                            this.turretLaserTimer = (this.turretLaserTimer === undefined ? 5.0 : this.turretLaserTimer) - dt;
                            if (!this.turretLaserState || this.turretLaserState === 'idle') {
                                if (this.turretLaserTimer <= 0) {
                                    this.turretLaserState = 'charging';
                                    this.turretLaserT = 0.7;
                                    this.turretLaserAngle = aim;
                                }
                            } else if (this.turretLaserState === 'charging') {
                                this.turretLaserT -= dt;
                                this.turretLaserAngle = aim; // 预警期间持续锁定
                                if (this.turretLaserT <= 0) {
                                    this.turretLaserState = 'firing';
                                    this.turretLaserT = 0.5;
                                    this.turretLaserHit = false;
                                    sound.play('lightning');
                                }
                            } else if (this.turretLaserState === 'firing') {
                                this.turretLaserT -= dt;
                                this.turretLaserAngle += dt * Math.PI / 180 * 120;
                                if (!this.turretLaserHit) {
                                    const rx = player.x - this.x, ry = player.y - this.y;
                                    const dirX = Math.cos(this.turretLaserAngle), dirY = Math.sin(this.turretLaserAngle);
                                    const along = clamp(rx * dirX + ry * dirY, 0, 1200);
                                    const px = rx - dirX * along, py = ry - dirY * along;
                                    if (px * px + py * py < (18 + player.size) * (18 + player.size)) {
                                        player.takeDamage(this.turretLaserDmg || 24);
                                        this.turretLaserHit = true;
                                    }
                                }
                                if (this.turretLaserT <= 0) {
                                    this.turretLaserState = 'idle';
                                    this.turretLaserTimer = 6;
                                }
                            }
                            // 投放精英自爆虫：8.5s 一批 3 只（属性 ×1.4），场上自爆虫上限 6
                            this.turretDropTimer = (this.turretDropTimer === undefined ? 8.0 : this.turretDropTimer) - dt;
                            if (this.turretDropTimer <= 0) {
                                const bomberCount = game.enemies.filter(e => e.alive && e.typeKey === 'bomber').length;
                                if (bomberCount <= 3) {
                                    this.turretDropTimer = 8.5;
                                    for (let i = 0; i < 3; i++) {
                                        const b = new Enemy(this.x + rand(-40, 40), this.y + rand(-40, 40), 'bomber', game.difficultyLevel - 1);
                                        b.hp = Math.floor(b.hp * 1.4); b.maxHp = b.hp;
                                        b.speed *= 1.4;
                                        b.eliteBomber = true; // 爆炸伤害 ×1.4 + 外观标识
                                        game.enemies.push(b);
                                    }
                                    spawnParticles(this.x, this.y, 10, '#ff8844', 70, 0.4, 3);
                                } else {
                                    this.turretDropTimer = 2; // 场上已满，稍后再投
                                }
                            }
                        } else if (this.typeKey === 'moonwitch') {
                            // ===== 幽月魔女：异空间领域机制怪（走位保持距离 + 六技能 + 二阶段无敌循环 + 穿梭被动） =====
                            const spdM = this.moonSpdMult || 1;
                            // ---- 降临/复活动画/拽入演出状态机（期间免伤、不行动） ----
                            if (this.moonIntro) {
                                this.moonIntroT -= dt;
                                const p0 = game.player;
                                if (this.moonIntro === 'revive') {
                                    // 第二次降临：镜片倒飞重组（外圈碎光不断闪现的近似）
                                    if (Math.random() < 0.7) spawnParticles(this.x + rand(-150, 150), this.y + rand(-150, 150), 1, '#c8b4ff', 40, 0.45, 3);
                                    if (this.moonIntroT <= 0) { this.moonIntro = 'descend'; this.moonIntroT = 2.5; }
                                    return;
                                }
                                if (this.moonIntro === 'descend') {
                                    if (this.moonIntroT <= 0) {
                                        this.moonIntro = 'pull'; this.moonIntroT = 0.9; this.moonIntroState = 'gather';
                                        sound.play('moonDescend');
                                        game.rings.push({ x: this.x, y: this.y, r: 10, maxR: 320, life: 0.55, maxLife: 0.55, color: '#b090ff', width: 8 });
                                        game.rings.push({ x: this.x, y: this.y, r: 6, maxR: 220, life: 0.4, maxLife: 0.4, color: '#ffffff', width: 3 });
                                        triggerShake(9, 0.5); game.flashWhite = 0.28;
                                        spawnParticles(this.x, this.y, 34, '#b090ff', 150, 0.7, 6);
                                        spawnFx(this.x, this.y, 18, '#e0d0ff', { shape: 'star', glow: true, speed: 170, life: 0.7, size: 6 });
                                    }
                                    return;
                                }
                                if (this.moonIntro === 'pull') {
                                    if (this.moonIntroState === 'gather') {
                                        game.moonPullDim = Math.min(0.5, (game.moonPullDim || 0) + dt * 0.6);
                                        if (Math.random() < 0.5) spawnParticles(this.x + rand(-90, 90), this.y + rand(-90, 90), 1, '#c8b4ff', 60, 0.4, 3);
                                        if (this.moonIntroT <= 0) { this.moonIntroState = 'chain'; this.moonIntroT = 0.7; sound.play('moonPull'); }
                                    } else if (this.moonIntroState === 'chain') {
                                        game.moonPullDim = Math.min(0.7, (game.moonPullDim || 0) + dt * 0.4);
                                        p0.slowTimer = 0.1; p0.slowAmount = 0.5; // 锁链缠身：重减速
                                        if (this.moonIntroT <= 0) {
                                            this.moonIntroState = 'drag'; this.moonIntroT = 0.8;
                                            this.moonDragFrom = { x: p0.x, y: p0.y };
                                            game.moonReturnPos = { x: p0.x, y: p0.y };
                                            this.moonDragTo = { x: this.x, y: this.y + 150 };
                                        }
                                    } else if (this.moonIntroState === 'drag') {
                                        game.moonPullDim = Math.min(0.9, (game.moonPullDim || 0) + dt * 0.7);
                                        const k = clamp(1 - this.moonIntroT / 0.8, 0, 1);
                                        const ease = k * k; // 缓入：越拽越快
                                        p0.x = this.moonDragFrom.x + (this.moonDragTo.x - this.moonDragFrom.x) * ease;
                                        p0.y = this.moonDragFrom.y + (this.moonDragTo.y - this.moonDragFrom.y) * ease;
                                        p0.slowTimer = 0.1; p0.slowAmount = 0.9;
                                        if (Math.random() < 0.6) spawnParticles(p0.x + rand(-14, 14), p0.y + rand(-14, 14), 1, '#d0c0ff', 40, 0.3, 2);
                                        if (this.moonIntroT <= 0) {
                                            // 进入异空间领域
                                            game.moonDomain = { active: true, x: MOON_DOMAIN.x, y: MOON_DOMAIN.y, r: MOON_DOMAIN.r, phase2: false };
                                            game.warningText = '已被拽入月之领域！';
                                            game.warningTimer = 2;
                                            moonDomainEnter(p0); // 副作用提示覆盖入场提示（信息优先）
                                            p0.x = game.moonDomain.x; p0.y = game.moonDomain.y + 170;
                                            p0.invincibleTimer = Math.max(p0.invincibleTimer || 0, 1.5);
                                            this.x = game.moonDomain.x; this.y = game.moonDomain.y - 40;
                                            game.moonPullDim = 0;
                                            this.moonIntro = null; this.moonShielded = false;
                                            game.flashWhite = 0.32; triggerShake(8, 0.4);
                                            sound.play('moonShield');
                                            game.rings.push({ x: p0.x, y: p0.y, r: 10, maxR: 300, life: 0.5, maxLife: 0.5, color: '#b090ff', width: 6 });
                                            this.moonApplyBuffs(1); // 领域一阶段加成
                                        }
                                    }
                                    return; // 演出期间 boss 不行动
                                }
                            }
                            // ---- 二阶段触发（60% 血）：领域翻转，数值翻倍 + 变身无敌 2.5s ----
                            if (!this.moonPhase2 && this.hp / this.maxHp <= 0.60) {
                                this.moonPhase2 = true;
                                this.moonTransformT = 2.5;
                                this.moonApplyBuffs(2);
                                if (game.moonDomain) game.moonDomain.r = MOON_DOMAIN.r2;
                                game.warningText = '领域翻转！幽月魔女二阶段！';
                                game.warningTimer = 2;
                                sound.play('moonShield');
                                game.rings.push({ x: this.x, y: this.y, r: 12, maxR: 380, life: 0.6, maxLife: 0.6, color: '#ff70d0', width: 8 });
                                triggerShake(7, 0.4);
                                spawnParticles(this.x, this.y, 26, '#ff9ade', 140, 0.7, 5);
                            }
                            // ---- 月盾状态归集（takeDamage 免伤守卫读此标志；分支末尾再刷新一次，确保触发当帧生效） ----
                            this.moonRefreshShield();
                            if (this.moonTransformT > 0) {
                                this.moonTransformT -= dt;
                                if (this.moonTransformT <= 0) {
                                    this.moonCycleShielded = true; this.moonCycleT = 5;
                                    sound.play('moonShield');
                                }
                                return; // 变身期间定身
                            }
                            // ---- 二阶段无敌循环：无敌 5s → 破绽 8s（升空期间计时暂停） ----
                            if (this.moonPhase2 && !this.moonAirborne) {
                                this.moonCycleT -= dt;
                                if (this.moonCycleT <= 0) {
                                    this.moonCycleShielded = !this.moonCycleShielded;
                                    this.moonCycleT = this.moonCycleShielded ? 5 : 8;
                                    sound.play(this.moonCycleShielded ? 'moonShield' : 'moonBreak');
                                    spawnParticles(this.x, this.y, this.moonCycleShielded ? 14 : 20, this.moonCycleShielded ? '#cfe0ff' : '#ffffff', 110, 0.5, 4);
                                }
                            }
                            // ---- 升月轰炸：空中不可选中阶段（天际激光扫射 + 弹幕雨） ----
                            if (this.moonAirborne) {
                                this.moonAscendT += dt;
                                const aimA = Math.atan2(player.y - this.y, player.x - this.x);
                                if (this.moonLaserState === 'charging') {
                                    this.moonLaserT -= dt; this.moonLaserAngle = aimA;
                                    if (this.moonLaserT <= 0) { this.moonLaserState = 'firing'; this.moonLaserT = 1.2; this.moonLaserHit = false; }
                                } else if (this.moonLaserState === 'firing') {
                                    this.moonLaserT -= dt;
                                    this.moonLaserAngle += dt * Math.PI / 180 * 100;
                                    if (!this.moonLaserHit) {
                                        const rx = player.x - this.x, ry = player.y - this.y;
                                        const dirX = Math.cos(this.moonLaserAngle), dirY = Math.sin(this.moonLaserAngle);
                                        const along = clamp(rx * dirX + ry * dirY, 0, 900);
                                        const px = rx - dirX * along, py = ry - dirY * along;
                                        if (px * px + py * py < (16 + player.size) * (16 + player.size)) {
                                            player.takeDamage(this.moonLaserDmg || 20);
                                            this.moonLaserHit = true;
                                        }
                                    }
                                    if (this.moonLaserT <= 0) this.moonLaserState = 'idle';
                                }
                                this.moonRainTimer -= dt;
                                if (this.moonRainTimer <= 0 && this.moonRainWaves > 0) {
                                    this.moonRainTimer = 0.9;
                                    this.moonRainWaves--;
                                    for (let i = 0; i < 8; i++) {
                                        const ra = aimA + rand(-0.7, 0.7);
                                        game.projectiles.push(new Projectile(this.x, this.y, Math.cos(ra) * 300 * spdM, Math.sin(ra) * 300 * spdM, this.moonRainDmg, 0, 0, '#d8ccff', 7, true));
                                    }
                                    sound.play('shoot');
                                }
                                if (this.moonAscendT >= this.moonAscendDur && this.moonLaserState !== 'firing') {
                                    this.moonAirborne = false;
                                    this.moonSlamWarn = 0.7;
                                    this.moonSlamX = player.x; this.moonSlamY = player.y;
                                }
                                return; // 空中不执行普攻/移动
                            }
                            // 砸落预警（仍在空中，落点圈显示）→ 落地冲击 + 硬直破绽
                            if (this.moonSlamWarn !== undefined && this.moonSlamWarn > 0) {
                                this.moonSlamWarn -= dt;
                                if (this.moonSlamWarn <= 0) {
                                    this.x = this.moonSlamX; this.y = this.moonSlamY;
                                    if (dist(this, player) < 120 + player.size) player.takeDamage(this.moonSlamDmg || 30);
                                    game.rings.push({ x: this.x, y: this.y, r: 10, maxR: 150, life: 0.45, maxLife: 0.45, color: '#c9b0ff', width: 7 });
                                    spawnParticles(this.x, this.y, 24, '#c9b0ff', 150, 0.6, 5);
                                    triggerShake(10, 0.4);
                                    sound.play('moonDescend');
                                    this.moonStunT = 0.8;
                                    this.moonSlamWarn = undefined;
                                    this.moonAscendTimer = 14 * (this.moonCdMult || 1);
                                }
                                return;
                            }
                            if (this.moonStunT > 0) { this.moonStunT -= dt; return; } // 砸落后硬直（可输出窗口）
                            // ---- 被动·穿梭：被逼到领域边界且玩家逼近 → 镜面点对称转移到对侧（CD 30s） ----
                            this.moonBlinkCd = (this.moonBlinkCd === undefined ? 0 : this.moonBlinkCd) - dt;
                            if (this.moonBlinkT > 0) this.moonBlinkT -= dt;
                            if (this.moonBlinkCd <= 0 && game.moonDomain && game.moonDomain.active) {
                                const dxc = this.x - game.moonDomain.x, dyc = this.y - game.moonDomain.y;
                                if (Math.hypot(dxc, dyc) > game.moonDomain.r - 130 && dist(this, player) < 240) {
                                    this.moonBlinkCd = 30;
                                    const fx0 = this.x, fy0 = this.y;
                                    this.x = 2 * game.moonDomain.x - this.x;
                                    this.y = 2 * game.moonDomain.y - this.y;
                                    this.moonBlinkT = 0.4;
                                    this.moonBlinkFrom = { x: fx0, y: fy0 };
                                    game.rings.push({ x: fx0, y: fy0, r: 8, maxR: 90, life: 0.35, maxLife: 0.35, color: '#cfe0ff', width: 5 });
                                    game.rings.push({ x: this.x, y: this.y, r: 8, maxR: 90, life: 0.35, maxLife: 0.35, color: '#cfe0ff', width: 5 });
                                    spawnParticles(fx0, fy0, 14, '#cfe0ff', 110, 0.45, 4);
                                    spawnParticles(this.x, this.y, 14, '#cfe0ff', 110, 0.45, 4);
                                    sound.play('moonPull');
                                }
                            }
                            // ---- 技能1：月刃环（360° 弹幕，触领域边界反弹 1/2 次） ----
                            this.moonBladeTimer = (this.moonBladeTimer === undefined ? 2.5 : this.moonBladeTimer) - dt;
                            if (this.moonBladeTimer <= 0) {
                                this.moonBladeTimer = 4 * this.moonCdMult;
                                const n = this.moonPhase2 ? 18 : 14;
                                const bs = (this.moonPhase2 ? 320 : 280) * spdM;
                                const off = rand(0, Math.PI * 2);
                                for (let i = 0; i < n; i++) {
                                    const a = off + (Math.PI * 2 / n) * i;
                                    const pj = new Projectile(this.x, this.y, Math.cos(a) * bs, Math.sin(a) * bs, this.moonBladeDmg, 0, 0, '#9fb4ff', 8, true);
                                    pj.moonBlade = true;
                                    pj.moonBounce = this.moonPhase2 ? 2 : 1;
                                    game.projectiles.push(pj);
                                }
                                sound.play('shoot');
                            }
                            // ---- 技能2：追月弹（限转向追踪弹） ----
                            this.moonOrbTimer = (this.moonOrbTimer === undefined ? 3.5 : this.moonOrbTimer) - dt;
                            if (this.moonOrbTimer <= 0) {
                                this.moonOrbTimer = 5.5 * this.moonCdMult;
                                const n = this.moonPhase2 ? 5 : 3;
                                for (let i = 0; i < n; i++) {
                                    const a = rand(0, Math.PI * 2);
                                    const pj = new Projectile(this.x, this.y, Math.cos(a) * 160, Math.sin(a) * 160, this.moonOrbDmg, 0, 0, '#c9a6ff', 9, true);
                                    pj.moonHoming = true;
                                    pj.moonSpdM = spdM;
                                    pj.maxLifetime = 4.5;
                                    game.projectiles.push(pj);
                                }
                                sound.play('spirit');
                            }
                            // ---- 技能3：月光洗礼（预警圈 → 落地伤害） ----
                            this.moonBaptTimer = (this.moonBaptTimer === undefined ? 5 : this.moonBaptTimer) - dt;
                            if (this.moonBaptTimer <= 0 && !this.moonStrikes) {
                                this.moonBaptTimer = 7 * this.moonCdMult;
                                const n = this.moonPhase2 ? 5 : 3;
                                this.moonStrikes = [];
                                for (let i = 0; i < n; i++) {
                                    const ox = i === 0 ? 0 : Math.cos(i * 2.4) * 120, oy = i === 0 ? 0 : Math.sin(i * 2.4) * 120;
                                    this.moonStrikes.push({ x: player.x + ox, y: player.y + oy, warn: this.moonPhase2 ? 0.7 : 0.9, r: 90, dmg: this.moonBaptDmg, done: false });
                                }
                                sound.play('bossWarn');
                            }
                            if (this.moonStrikes) {
                                let anyAlive = false;
                                for (const st of this.moonStrikes) {
                                    if (st.done) continue;
                                    anyAlive = true;
                                    st.warn -= dt;
                                    if (st.warn <= 0) {
                                        st.done = true;
                                        if (dist(player, st) < st.r + player.size) player.takeDamage(st.dmg);
                                        game.rings.push({ x: st.x, y: st.y, r: 8, maxR: st.r, life: 0.35, maxLife: 0.35, color: '#c9a6ff', width: 5 });
                                        spawnParticles(st.x, st.y, 14, '#c9a6ff', 120, 0.5, 4);
                                        triggerShake(2, 0.1);
                                        sound.play('meteor');
                                    }
                                }
                                if (!anyAlive) this.moonStrikes = null;
                            }
                            // ---- 技能4：镜月分身（一击碎的镜影） ----
                            this.moonCloneTimer = (this.moonCloneTimer === undefined ? 6 : this.moonCloneTimer) - dt;
                            if (this.moonCloneTimer <= 0) {
                                this.moonCloneTimer = 12 * this.moonCdMult;
                                const n = this.moonPhase2 ? 3 : 2;
                                for (let i = 0; i < n; i++) {
                                    if (game.enemies.length >= MAX_ENEMIES) break;
                                    const ang = rand(0, Math.PI * 2);
                                    const c = new Enemy(this.x + Math.cos(ang) * rand(120, 200), this.y + Math.sin(ang) * rand(120, 200), 'moonshade', game.difficultyLevel - 1);
                                    if ((this.moonStatMult || 1) > 1) {
                                        c.damage = Math.floor(c.damage * this.moonStatMult);
                                        c.hp = Math.floor(c.hp * this.moonStatMult); c.maxHp = c.hp;
                                    }
                                    c.bossMinion = this;
                                    game.enemies.push(c);
                                    spawnParticles(c.x, c.y, 8, '#b9a6ff', 70, 0.4, 3);
                                }
                                sound.play('summon');
                            }
                            // ---- 技能5：满月收缩（边界光环留缺口向圆心碾压） ----
                            this.moonWaveTimer = (this.moonWaveTimer === undefined ? 6 : this.moonWaveTimer) - dt;
                            if (this.moonWaveTimer <= 0) {
                                this.moonWaveTimer = 10 * this.moonCdMult;
                                game.moonWaves.push({
                                    r: (game.moonDomain ? game.moonDomain.r : MOON_DOMAIN.r) - 10,
                                    gap: rand(0, Math.PI * 2),
                                    gapW: this.moonPhase2 ? 40 : 50,
                                    speed: this.moonPhase2 ? 210 : 170,
                                    dmg: this.moonWaveDmg, hit: false, warn: 1.0
                                });
                                sound.play('bossWarn');
                            }
                            // ---- 技能6：升月轰炸（升空不可选中 → 激光+弹幕雨 → 砸落冲击波+硬直） ----
                            this.moonAscendTimer = (this.moonAscendTimer === undefined ? 8 : this.moonAscendTimer) - dt;
                            if (this.moonAscendTimer <= 0) {
                                this.moonAscendTimer = 999; // 砸落结算时重置为 14×CD
                                this.moonAirborne = true;
                                this.moonAscendT = 0;
                                this.moonAscendDur = this.moonPhase2 ? 4.5 : 3.5;
                                this.moonRainWaves = this.moonPhase2 ? 3 : 2;
                                this.moonRainTimer = 1.0;
                                this.moonLaserState = 'charging'; this.moonLaserT = 0.6;
                                sound.play('bossWarn');
                                spawnParticles(this.x, this.y, 16, '#c9b0ff', 90, 0.5, 4);
                            }
                            this.moonRefreshShield(); // 升空/穿梭触发当帧即免伤
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
                    // ===== 自爆虫：冲锋自爆 =====
                    if (this.typeKey === 'bomber') {
                        if (this.bomberFuse === undefined && dist(this, player) < 60 + player.size) {
                            this.bomberFuse = 0.8; // 进入引爆范围：0.8s 倒计时（加速闪烁预警）
                        }
                        if (this.bomberFuse !== undefined) {
                            this.bomberFuse -= dt;
                            if (this.bomberFuse <= 0) {
                                this.alive = false;
                                // 自爆无经验奖励（击杀才有）；精英化炮台投放的个体伤害 ×1.25
                                const boomDmg = Math.floor(14 * (this.eliteBomber ? 1.4 : 1));
                                if (dist(this, player) < 70 + player.size) player.takeDamage(boomDmg);
                                game.rings.push({ x: this.x, y: this.y, r: 8, maxR: 70, life: 0.35, maxLife: 0.35, color: '#ff5533', width: 5 });
                                spawnParticles(this.x, this.y, 18, '#ff5533', 120, 0.5, 5);
                                triggerShake(3, 0.15);
                                sound.play('explosion');
                                return;
                            }
                        }
                    }
                    // ===== 咒术师：治疗脉冲（辅助型，自身不攻击） =====
                    if (this.typeKey === 'warlock') {
                        this.warlockHealTimer = (this.warlockHealTimer === undefined ? 2.5 : this.warlockHealTimer) - dt;
                        if (this.warlockHealTimer <= 0) {
                            let healed = 0;
                            for (const e of game.enemies) {
                                if (e === this || !e.alive || e.isBoss) continue;
                                if (e.hp < e.maxHp && dist(this, e) < 140 + e.size) {
                                    e.hp = Math.min(e.maxHp, e.hp + 8);
                                    healed++;
                                }
                            }
                            if (healed > 0) {
                                game.rings.push({ x: this.x, y: this.y, r: 12, maxR: 140, life: 0.4, maxLife: 0.4, color: '#66dd44', width: 3 });
                                spawnParticles(this.x, this.y, 8, '#88ff66', 70, 0.4, 3);
                            }
                            this.warlockHealTimer = 2.5;
                        }
                    }
                    const dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy) || 0.01;
                    const spd = this.getEffectiveSpeed();
                    let mx = 0, my = 0;
                    if (this.typeKey === 'moonwitch') {
                        // 幽月魔女：与玩家保持 300±40 距离带 + 缓慢环绕侧移（不贴脸追击，走位型机制怪）
                        this.moonStrafeT = (this.moonStrafeT === undefined ? rand(3, 5) : this.moonStrafeT) - dt;
                        if (this.moonStrafeT <= 0) { this.moonStrafeT = rand(3, 5); this.moonStrafeDir = -(this.moonStrafeDir || 1); }
                        let radial = 0;
                        if (d < 260) radial = -1; else if (d > 340) radial = 1;
                        const tx0 = -dy / d, ty0 = dx / d;
                        mx = dx / d * radial * 0.9 + tx0 * (this.moonStrafeDir || 1) * 0.55;
                        my = dy / d * radial * 0.9 + ty0 * (this.moonStrafeDir || 1) * 0.55;
                        const ml = Math.hypot(mx, my) || 1;
                        mx /= ml; my /= ml;
                    } else if (this.isRanged) {
                        const desiredDist = this.attackRange + 50;
                        if (d < desiredDist - 30) { mx = -(dx / d); my = -(dy / d); }
                        else if (d > desiredDist + 30) { mx = dx / d; my = dy / d; }
                        this.fireballTimer -= dt;
                        if (this.fireballTimer <= 0 && d < this.attackRange + 100) {
                            this.fireAtPlayer(player);
                            this.fireballTimer = this.fireballCooldown;
                        }
                    } else if (this.typeKey === 'bomber' || !(this.flankAngle)) {
                        mx = dx / d; my = dy / d; // 自爆虫直线冲锋；无侧翼角（Boss/远程）直追
                    } else {
                        // 侧翼包抄：目标向量按个体方位角旋转，远距离走弧线包抄、120px 内归零直冲（防玩家绕圈聚团）
                        const fw = clamp((d - 120) / 380, 0, 1);
                        const fa = this.flankAngle * fw;
                        const ca = Math.cos(fa), sa = Math.sin(fa);
                        const rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
                        const rd = Math.hypot(rx, ry) || 0.01;
                        mx = rx / rd; my = ry / rd;
                    }
                    let sepX = 0, sepY = 0;
                    for (const other of game.enemies) {
                        if (other === this || !other.alive) continue;
                        const od = dist(this, other), minDist = (this.size + other.size) * 0.9;
                        if (od < minDist && od > 0) { sepX += (this.x - other.x) / od * (minDist - od) * 0.5; sepY += (this.y - other.y) / od * (minDist - od) * 0.5; }
                    }
                    // 天罚炮台固定阵地：完全跳过位置更新（speed 0 + 免分离力）
                    if (this.typeKey !== 'turret') {
                        this.x += mx * spd * dt + sepX * dt * 0.8; this.y += my * spd * dt + sepY * dt * 0.8;
                    }
                    if ((this.typeKey === 'moonwitch' || this.typeKey === 'moonshade') && game.moonDomain && game.moonDomain.active) {
                        // 月之领域内实体：只受领域圆约束（领域位于世界外坐标，禁用世界钳制）
                        const cd0 = Math.hypot(this.x - game.moonDomain.x, this.y - game.moonDomain.y) || 0.01;
                        const maxR0 = game.moonDomain.r - this.size - 6;
                        if (cd0 > maxR0) {
                            this.x = game.moonDomain.x + (this.x - game.moonDomain.x) / cd0 * maxR0;
                            this.y = game.moonDomain.y + (this.y - game.moonDomain.y) / cd0 * maxR0;
                        }
                    } else {
                        this.x = clamp(this.x, this.size, WORLD_W - this.size); this.y = clamp(this.y, this.size, WORLD_H - this.size);
                    }
                    if (dist(this, player) < this.size + player.size) {
                        if (this.isGhost) {
                            if (this.dotDamage > 0) {
                                player.dotEffects = player.dotEffects.filter(e => e.source !== this);
                                player.dotEffects.push({ amount: this.dotDamage, remaining: this.dotDuration, source: this });
                            }
                        } else if (!this.isRanged) {
                            player.takeDamage(this.damage);
                            // 荆棘光环：反弹 35% 近战伤害给攻击者
                            if (player.relicThorn && this.alive) {
                                this.takeDamage(Math.max(1, Math.floor(this.damage * 0.35)), 'thorn');
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

            Enemy.prototype.enterLavaDeath = function() {
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

            Enemy.prototype.enterMoonShatter = function() {
                    // 幽月魔女镜面碎裂演出：裂纹闪现 + 镜片四散 + 白闪，演出毕走真伤重入死亡结算（届时领域崩塌）
                    this.dying = true;
                    this.hp = 0;
                    this.deathTimer = 1.4;
                    this.deathBurstTimer = 0.2;
                    this.moonAirborne = false;
                    this.moonSlamWarn = undefined;
                    game.warningText = '幽月魔女 镜面碎裂！';
                    game.warningTimer = 1.4;
                    sound.play('moonShatter');
                    triggerShake(9, 0.5);
                    game.flashWhite = 0.3;
                    spawnParticles(this.x, this.y, 22, '#d8e4ff', 160, 0.8, 5);
                }

            Enemy.prototype.moonRefreshShield = function() {
                    // 月盾免伤标志归集：升空 / 穿梭 / 二阶段（变身期或无敌循环期）
                    this.moonShielded = !!this.moonAirborne || (this.moonBlinkT || 0) > 0
                        || (this.moonPhase2 && (this.moonTransformT > 0 || this.moonCycleShielded));
                }

            Enemy.prototype.moonApplyBuffs = function(stage) {
                    // 领域加成：一阶段 伤×1.2 速×1.3 CD-20%；二阶段翻倍（按构造基准重算，避免叠乘污染）
                    const cfg = stage === 1 ? { dmg: 1.2, spd: 1.3, cd: 0.8 } : { dmg: 1.4, spd: 1.6, cd: 0.6 };
                    this.damage = Math.floor((this.moonBaseDmg || this.damage) * cfg.dmg);
                    this.speed = (this.moonBaseSpd || this.speed) * cfg.spd;
                    this.moonCdMult = cfg.cd;
                }

            Enemy.prototype.fireAtPlayer = function(player) {
                    // 远程伤害随难度提升（每级 +10%，上限 2 倍）
                    const diffBonus = game.difficultyLevel - 1;
                    const dynamicDamage = Math.min(this.fireballDamage * (1 + diffBonus * 0.10), this.fireballDamage * 2.0);
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const vx = Math.cos(angle) * this.fireballSpeed;
                    const vy = Math.sin(angle) * this.fireballSpeed;
                    game.projectiles.push(new Projectile(this.x, this.y, vx, vy, dynamicDamage, 0, 0, '#ff4422', 4, true));
                }

            Enemy.prototype.fireSlash = function(player) {
                    // 剑气伤害随出场次数成长（构造时已算好）
                    const dynamicDamage = this.slashDamage;
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const vx = Math.cos(angle) * this.slashSpeed;
                    const vy = Math.sin(angle) * this.slashSpeed;
                    game.projectiles.push(new Projectile(this.x, this.y, vx, vy, dynamicDamage, 0, 0, '#ff0000', 15, true));
                    spawnParticles(this.x, this.y, 10, '#ff0000', 40, 0.4, 3);
                }

            Enemy.prototype.fireFanSlash = function(player, dmgScale = 1) {
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

            Enemy.prototype.fireShuriken = function(player) {
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

            Enemy.prototype.computeTeleportTarget = function(player) {
                    // 预计算闪现降落位置：玩家侧后方更远处（140px）
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    const side = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
                    this.teleportTX = clamp(player.x + Math.cos(angle + Math.PI + side) * 140, 40, WORLD_W - 40);
                    this.teleportTY = clamp(player.y + Math.sin(angle + Math.PI + side) * 140, 40, WORLD_H - 40);
                }

            Enemy.prototype.doTeleport = function(player) {
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
