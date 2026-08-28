            // ==================== 灵魂碎片结算（死亡或返回主菜单时调用） ====================
            function settleShards() {
                // 击杀数不足 50 不结算碎片
                if (game.kills < 50) { game.soulShards = 0; return 0; }
                let shardMult = (DIFFICULTIES[game.selectedDifficulty] || DIFFICULTIES.normal).shardMult || 1;
                // 财富之心（需穿戴生效）：每局结算碎片 ×1.2
                if (isRelicActive('relic_shard_boost')) shardMult *= 1.2;
                game.soulShards = Math.floor(Math.max(0, Math.floor(game.kills / 3) * shardMult));
                if (game.soulShards > 0) {
                    metaData.shards = (metaData.shards || 0) + game.soulShards;
                    metaData.earned = (metaData.earned || 0) + game.soulShards;
                    saveMeta();
                }
                return game.soulShards;
            }

            // ==================== 玩家类 ====================
            class Player {
                constructor() {
                    this.x = WORLD_W / 2; this.y = WORLD_H / 2; this.size = 14;
                    this.speed = 260; this.speedMultiplier = 1;
                    this.hp = 100; this.maxHp = 100;
                    this.hpRegenPercent = 0.017;
                    this.damageReduction = 0; this.flatArmor = 0;
                    this.globalDamageMultiplier = 1;
                    this.globalCooldownMultiplier = 1;
                    this.damageTakenMultiplier = 1; this.killExplode = false; this.killSpeed = false; this.killSpeedStacks = 0; this.killSpeedTimer = 0; this.synergyBladeSpeed = false;
                    this.extraChoices = 0; this.buffTimers = []; this.expMultiplier = 1;
                    this.pickupRange = 70; this.pickupRangeMultiplier = 1;
                    this.level = 1; this.xp = 0; this.xpToNext = 90;
                    this.invincibleTimer = 0; this.flashTimer = 0; this.shieldFlash = 0;
                    this.oneShotShield = false; this.burstTimer = 0;
                    this.revengeTimer = 0;
                    this.relicDodgeChance = 0;
                    this.relicLastStandRate = 0;
                    this.slowTimer = 0; this.slowAmount = 0;
                    this.dotEffects = [];
                    this.weapons = [
                        { type: 'magic_missile', level: 1, cooldown: 0, cooldownTime: 0.85, cooldownMultiplier: 1,
                            damage: 21, damageMultiplier: 1, projectileSpeed: 350, extraProjectiles: 0,
                            splashRadius: 28, splashDamagePercent: 0.35 }
                    ];
                }
                getEffectivePickupRange() { return this.pickupRange * this.pickupRangeMultiplier; }
                // 风险祭坛增益：剩余时间 >0 时伤害 ×1.5
                getRiskMult() { return this.riskBuffTimer > 0 ? 1.5 : 1; }
                // 背水一战圣物：生命越低伤害越高（每损失 1% 生命 +rate%，rate 开局按圣物等级缓存）
                getLowHpMult() {
                    const rate = this.relicLastStandRate || 0;
                    if (rate <= 0 || this.maxHp <= 0) return 1;
                    return 1 + clamp((this.maxHp - this.hp) / this.maxHp, 0, 1) * rate;
                }
                getEffectiveSpeed() { return this.speed * this.speedMultiplier * (this.slowTimer > 0 ? (1 - this.slowAmount) : 1) * (this.burstTimer > 0 ? 1.4 : 1); }
                getEffectiveCooldownMult() { return (this.globalCooldownMultiplier || 1) * (this.burstTimer > 0 ? 0.6 : 1); }

                takeDamage(amount, sourceType = 'default', ignoreInvincible = false) {
                    if (this.invincibleTimer > 0 && !ignoreInvincible) return;
                    // 幻影步圣物：概率完全闪避（持续伤害真伤不可闪避）
                    if (!ignoreInvincible && this.relicDodgeChance > 0 && Math.random() < this.relicDodgeChance) {
                        spawnDamageNumber(this.x, this.y - 15, '闪避', '#88ffcc');
                        spawnParticles(this.x, this.y, 10, '#aaffdd', 90, 0.4, 3);
                        sound.play('shield');
                        this.invincibleTimer = 0.4;
                        this.flashTimer = 0.2;
                        return;
                    }
                    // 宝箱一次性护盾：抵挡一次伤害
                    if (this.oneShotShield && amount > 0) {
                        this.oneShotShield = false;
                        this.invincibleTimer = 0.5;
                        this.flashTimer = 0.3;
                        spawnParticles(this.x, this.y, 20, '#88ccff', 110, 0.5, 4);
                        sound.play('shield');
                        spawnDamageNumber(this.x, this.y - 15, amount, '#88aaff');
                        return;
                    }
                    // 灵魂护盾按护盾量吸收伤害
                    if (this.soulShield && this.soulShieldAmount > 0) {
                        const absorbed = Math.min(this.soulShieldAmount, amount);
                        amount -= absorbed;
                        this.soulShieldAmount -= absorbed;
                        if (absorbed > 0) {
                            spawnDamageNumber(this.x, this.y - 15, absorbed, '#88aaff');
                            sound.play('shield');
                            this.shieldFlash = 0.35;
                            spawnParticles(this.x, this.y, 16, '#88aaff', 130, 0.45, 3);
                        }
                        if (amount <= 0) {
                            if (!ignoreInvincible) this.invincibleTimer = 0.15;
                            this.flashTimer = 0.15;
                            return;
                        }
                    }
                    // 影侍守卫：受击时60%概率使周围敌人眩晕0.8秒并减速40%（1.5秒）
                    if ((this.relicGuard || this.relicClone) && !ignoreInvincible && Math.random() < 0.60) {
                        let stunned = 0;
                        for (const e of game.enemies) {
                            if (!e.alive) continue;
                            if (Math.hypot(e.x - this.x, e.y - this.y) < 90 + e.size) {
                                e.stunTimer = Math.max(e.stunTimer || 0, 0.8);
                                e.freezeTimer = Math.max(e.freezeTimer || 0, 0.8);
                                e.applySlow(0.40, 1.5);
                                stunned++;
                            }
                        }
                        if (stunned > 0) {
                            spawnParticles(this.x, this.y, 10, '#b06cff', 90, 0.4, 3);
                            game.rings.push({ x: this.x, y: this.y, r: 12, maxR: 90, life: 0.35, maxLife: 0.35, color: '#b06cff', width: 4 });
                            sound.play('shield');
                        }
                    }
                    let dmg = amount * (1 - this.damageReduction) * (this.damageTakenMultiplier || 1);
                    dmg = Math.max(1, Math.round(dmg) - this.flatArmor);
                    this.hp -= dmg;
                    if (!ignoreInvincible) this.invincibleTimer = 0.4;
                    this.flashTimer = 0.25;
                    this.revengeTimer = 0.5;
                    spawnDamageNumber(this.x, this.y - 15, dmg, '#ff4444');
                    if (!ignoreInvincible) sound.play('playerHit');
                    if (!ignoreInvincible) triggerShake(5, 0.2);
                    if (this.hp <= 0) {
                        // 凤凰之羽：死亡时复活一次（50% 血量 + 短暂无敌 + 清屏震波）
                        if (this.reviveLeft > 0) {
                            this.reviveLeft = 0;
                            this.hp = Math.floor(this.maxHp * 0.5);
                            this.invincibleTimer = 2;
                            this.flashTimer = 0.5;
                            spawnParticles(this.x, this.y, 40, '#ffaa00', 160, 0.7, 5);
                            triggerShake(8, 0.5);
                            sound.play('levelup');
                            game.warningText = '凤凰之羽！复活（50%生命）';
                            game.warningTimer = 2.0;
                            return;
                        }
                        this.hp = 0; game.state = 'gameover';
                        gameoverOverlay.style.display = 'flex';
                        goTime.textContent = Math.floor(game.time);
                        goKills.textContent = game.kills;
                        goLevel.textContent = this.level;
                        goDamage.textContent = Math.floor(game.totalDamageDealt);
                        // 最佳记录（按难度分档存 localStorage）
                        let bestT = 0, bestK = 0, isNew = false;
                        try {
                            const dk = game.selectedDifficulty || 'normal';
                            bestT = parseInt(localStorage.getItem('rogue_best_time_' + dk) || '0', 10) || 0;
                            bestK = parseInt(localStorage.getItem('rogue_best_kills_' + dk) || '0', 10) || 0;
                            const t = Math.floor(game.time);
                            if (t > bestT) { localStorage.setItem('rogue_best_time_' + dk, t); isNew = true; }
                            if (game.kills > bestK) { localStorage.setItem('rogue_best_kills_' + dk, game.kills); isNew = true; }
                            // 灵魂碎片结算
                            game.soulShards = settleShards();
                            goShards.textContent = game.soulShards;
                        } catch(e) {}
                        goBestTime.textContent = Math.max(bestT, Math.floor(game.time));
                        goBestKills.textContent = Math.max(bestK, game.kills);
                        goNewRecord.style.display = isNew ? 'block' : 'none';
                        levelupPanel.style.display = 'none';
                        bossdropPanel.style.display = 'none';
                    }
                }

                addDot(damagePerSecond, duration) {
                    this.dotEffects.push({ amount: damagePerSecond, remaining: duration });
                }

                addXp(amount) {
                    this.xp += amount;
                    while (this.xp >= this.xpToNext && game.state === 'playing' && this.level < MAX_LEVEL) {
                        this.xp -= this.xpToNext;
                        this.level++;
                        if (this.level >= MAX_LEVEL) {
                            this.xpToNext = 999999999;
                        } else if (this.level <= 20) {
                            this.xpToNext = Math.floor(this.xpToNext * 1.14 + 3);
                        } else if (this.level <= 40) {
                            this.xpToNext = Math.floor(this.xpToNext * 1.05);
                        } else if (this.level <= 59) {
                            this.xpToNext = Math.floor(this.xpToNext * 1.10 + 2);
                        } else {
                            this.xpToNext = Math.floor(this.xpToNext + 700);
                        }
                        game.state = 'levelup';
                        game.upgradeCount++;
                        game.levelFlash = 0.35;
                        game.rings.push({ x: this.x, y: this.y, r: 10, maxR: 90, life: 0.45, maxLife: 0.45, color: '#ffd700', width: 4 });
                        try {
                            game.currentChoices = generateUpgradeChoices(this);
                            if (!game.currentChoices.length) {
                                game.state = 'playing';
                            } else {
                                sound.play('levelup');
                                showLevelupPanel(game.currentChoices);
                            }
                        } catch(e) {
                            console.warn('Levelup error:', e);
                            game.state = 'playing';
                        }
                        this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.1));
                    }
                }

                update(dt) {
                    let mx = 0, my = 0;
                    if (useTouchControl && joystick.active) {
                        // 虚拟摇杆：方向 = 偏移向量，幅度控制速度比例
                        const mag = Math.hypot(joystick.dx, joystick.dy);
                        if (mag > 8) {
                            mx = joystick.dx / mag;
                            my = joystick.dy / mag;
                            const spdScale = Math.min(1, mag / JOYSTICK_R);
                            mx *= Math.max(0.35, spdScale);
                            my *= Math.max(0.35, spdScale);
                        }
                    } else {
                        if (keys['w'] || keys['arrowup']) my -= 1;
                        if (keys['s'] || keys['arrowdown']) my += 1;
                        if (keys['a'] || keys['arrowleft']) mx -= 1;
                        if (keys['d'] || keys['arrowright']) mx += 1;
                    }
                    if (mx !== 0 || my !== 0) { const mag = Math.hypot(mx, my); mx /= mag; my /= mag; }
                    const spd = this.getEffectiveSpeed();
                    this.x += mx * spd * dt; this.y += my * spd * dt;
                    this.x = clamp(this.x, this.size, WORLD_W - this.size);
                    this.y = clamp(this.y, this.size, WORLD_H - this.size);
                    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
                    if (this.flashTimer > 0) this.flashTimer -= dt;
                    if (this.riskBuffTimer > 0) this.riskBuffTimer -= dt;
                    if (this.slowTimer > 0) this.slowTimer -= dt;
                    if (this.revengeTimer > 0) this.revengeTimer -= dt;
                    if (this.burstTimer > 0) this.burstTimer -= dt;
                    if (this.shieldFlash > 0) this.shieldFlash -= dt;
                    if (this.soulShield && this.soulShieldAmount < this.soulShieldMax) {
                        this.soulShieldAmount = Math.min(this.soulShieldMax, this.soulShieldAmount + (this.soulShieldMax / this.soulShieldRegenTime) * dt);
                    }
                    if (this.killSpeedTimer > 0) { this.killSpeedTimer -= dt; if (this.killSpeedTimer <= 0) { this.speedMultiplier = (this.speedMultiplier || 1) - 0.15 * this.killSpeedStacks; this.killSpeedStacks = 0; } }
                    updateBuffTimers(this, dt);
                    if (this.hpRegenPercent > 0 && this.hp < this.maxHp) {
                        this.hp = Math.min(this.maxHp, this.hp + this.hpRegenPercent * this.maxHp * dt);
                    }
                    for (let i = this.dotEffects.length - 1; i >= 0; i--) {
                        const dot = this.dotEffects[i];
                        dot.remaining -= dt;
                        // 整数 tick 累积：满 1 点才结算，避免微量伤害被 max(1) 放大
                        dot.acc = (dot.acc || 0) + dot.amount * dt;
                        while (dot.acc >= 1) {
                            dot.acc -= 1;
                            this.takeDamage(1, 'dot', true);
                        }
                        if (dot.remaining <= 0) this.dotEffects.splice(i, 1);
                    }
                    for (const w of this.weapons) {
                        if (w.cooldown !== undefined && w.cooldown > 0) w.cooldown -= dt;
                        if (w.type === 'orbit_blade' && w.angle !== undefined) w.angle += w.rotationSpeed * dt;
                    }
                }

                getNearestEnemy() {
                    let nearest = null, minDist = Infinity;
                    for (const enemy of game.enemies) { if (!enemy.alive || enemy.deathMarked || enemy.dying) continue; const d = dist(this, enemy); if (d < minDist) { minDist = d; nearest = enemy; } }
                    return nearest;
                }

                draw(ctx) {
                    const glowAlpha = 0.5 + Math.sin(game.time * 4) * 0.2;
                    const grad = ctx.createRadialGradient(this.x, this.y, this.size * 0.5, this.x, this.y, this.size * 2.2);
                    grad.addColorStop(0, 'rgba(100,200,255,0.9)'); grad.addColorStop(0.5, 'rgba(60,140,220,0.4)'); grad.addColorStop(1, 'rgba(20,60,180,0)');
                    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2); ctx.fill();
                    const flashOn = this.flashTimer > 0 && Math.floor(this.flashTimer * 30) % 2 === 0;
                    ctx.fillStyle = flashOn ? '#ffffff' : '#88ddff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#ddeeff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.45, 0, Math.PI * 2); ctx.fill();
                    const pr = this.getEffectivePickupRange();
                    // 拾取圈仅在拥有磁力吸引(multiplier>1)时显示（虚线），避免与寒霜光环视觉重叠
                    if (this.pickupRangeMultiplier > 1) {
                        ctx.strokeStyle = 'rgba(255,215,100,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
                        ctx.beginPath(); ctx.arc(this.x, this.y, pr, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.setLineDash([]); ctx.lineWidth = 1;
                    if (this.soulShield) {
                        if (this.soulShieldAmount >= this.soulShieldMax - 0.01) {
                            const pulse = 0.78 + Math.sin(game.time * 6) * 0.14;
                            const rReady = this.size + 8 + pulse * 2;
                            const g = ctx.createRadialGradient(this.x, this.y, this.size, this.x, this.y, rReady);
                            g.addColorStop(0, 'rgba(136,170,255,0)');
                            g.addColorStop(0.82, 'rgba(136,170,255,0.22)');
                            g.addColorStop(1, 'rgba(136,170,255,0)');
                            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, rReady, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = 'rgba(136,170,255,0.9)'; ctx.lineWidth = 2.5;
                            ctx.beginPath(); ctx.arc(this.x, this.y, rReady, 0, Math.PI * 2); ctx.stroke();
                        } else {
                            const prog = this.soulShieldAmount / this.soulShieldMax;
                            const rC = this.size + 11;
                            ctx.strokeStyle = 'rgba(136,170,255,0.4)'; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.arc(this.x, this.y, rC, 0, Math.PI * 2); ctx.stroke();
                            ctx.strokeStyle = 'rgba(136,170,255,0.85)'; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(this.x, this.y, rC, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
                        }
                    }
                    if (this.shieldFlash > 0) {
                        const fa = Math.min(1, this.shieldFlash / 0.35);
                        ctx.strokeStyle = `rgba(160,195,255,${fa})`; ctx.lineWidth = 3 * fa + 1;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 9 + (1 - fa) * 16, 0, Math.PI * 2); ctx.stroke();
                    }
                }
            }
