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
