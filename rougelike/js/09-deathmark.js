            // ==================== 死神之指（隐藏功能） ====================
            const DEATH_FX = {
                skullSize: 12, ringRadius: 18, ringSpeed: 1, ringColor: 'rgba(255,0,0,',
                cageColor: 'rgba(255,40,40,0.5)', cageRadius: 30,
                dieText: 'DIE', dieColor: '#ff1111',
                lockParticles: 28, lockSpeed: 130, lockSize: 6,
                burstParticles: 40, burstSpeed: 180, burstSize: 6,
                bossBurstMult: 2
            };

            function dmPickTarget() {
                // 自动模式：血量最高的非 Boss 存活敌人（含幽灵）
                let best = null, bestHp = -1;
                for (const e of game.enemies) {
                    if (!e.alive || e.deathMarked || e.isBoss) continue;
                    if (e.hp > bestHp) { bestHp = e.hp; best = e; }
                }
                return best;
            }

            function dmLockTarget(e) {
                const dm = game.deathMark;
                dm.targets.push(e);
                e.deathMarked = true;
                e.dmTimer = 0;
                // Boss 百分比伤害档位：每个 Boss 独立计数 —— 该 Boss 第1/2/3次被标记分别 25% / 40% / 直接抹杀
                if (e.isBoss) {
                    e.dmBossHitCount = (e.dmBossHitCount || 0) + 1;
                    e.dmBossTier = e.dmBossHitCount;
                } else {
                    e.dmBossTier = 0;
                }
                // 锁定瞬间：血爆 + 红色冲击环
                spawnParticles(e.x, e.y, DEATH_FX.lockParticles, '#ff2222', DEATH_FX.lockSpeed, 0.5, DEATH_FX.lockSize);
                spawnParticles(e.x, e.y, 10, '#ffffff', DEATH_FX.lockSpeed * 0.8, 0.3, 3);
                triggerShake(3, 0.2);
            }

            function dmResolve(e) {
                const dm = game.deathMark;
                if (!e) return;
                e.deathMarked = false;
                const idx = dm.targets.indexOf(e);
                if (idx >= 0) dm.targets.splice(idx, 1);
                const wasBoss = e.isBoss;
                const mult = wasBoss ? DEATH_FX.bossBurstMult : 1;
                // 抹杀消散：骷髅破碎 + 红白碎片 + 冲击环 + 震屏
                spawnParticles(e.x, e.y, DEATH_FX.burstParticles * mult, '#ff2222', DEATH_FX.burstSpeed * mult, 0.6, DEATH_FX.burstSize);
                spawnParticles(e.x, e.y, Math.floor(DEATH_FX.burstParticles * 0.5 * mult), '#ffffff', DEATH_FX.burstSpeed * 0.9 * mult, 0.5, DEATH_FX.burstSize * 0.8);
                spawnParticles(e.x, e.y, 6 * mult, '#e8e0e0', 140, 0.7, 4);
                triggerShake(wasBoss ? 9 : 5, 0.35);
                if (wasBoss) {
                    // Boss：按本轮标记次数结算 —— 第1次 25% / 第2次 40% / 第3次直接抹杀（均无视减伤）
                    const tier = e.dmBossTier || 1;
                    if (tier >= 3) {
                        e.takeDamage(e.hp + 999999, 'death', true, true);
                    } else {
                        const pct = tier === 1 ? 0.25 : 0.40;
                        e.takeDamage(Math.floor(e.maxHp * pct), 'death', true, true);
                    }
                    spawnDeathText(e.x, e.y - e.size, DEATH_FX.dieText);
                } else {
                    // 非 Boss：HP 直接归零 + DIE 字样，不显示伤害数字
                    spawnDeathText(e.x, e.y - e.size, DEATH_FX.dieText);
                    e.takeDamage(e.hp + 999999, 'death', true, true);
                }
                // 奖励（仅当确已死亡）
                if (!e.alive && game.player) {
                    if (wasBoss) {
                        game.player.maxHp += 30;
                        game.player.hp = Math.min(game.player.hp + 30, game.player.maxHp);
                    } else {
                        game.player.maxHp += 5;
                        game.player.hp = Math.min(game.player.hp + 5, game.player.maxHp);
                    }
                    spawnParticles(game.player.x, game.player.y, 14, '#ff5555', 60, 0.4, 3);
                }
            }

            function updateDeathMark(dt) {
                const dm = game.deathMark;
                // 清理已死亡目标
                for (let i = dm.targets.length - 1; i >= 0; i--) {
                    const t = dm.targets[i];
                    if (!t.alive) {
                        t.deathMarked = false;
                        dm.targets.splice(i, 1);
                    }
                }
                // 各目标抹杀计时（倒序遍历：dmResolve 会从 targets 中 splice，正序会跳过同帧到期的下一个）
                for (let i = dm.targets.length - 1; i >= 0; i--) {
                    const t = dm.targets[i];
                    t.dmTimer += dt;
                    if (t.dmTimer >= dm.markDuration) {
                        dmResolve(t);
                    }
                }
                // 自动模式：无目标即自动锁血量最高非 Boss（无 CD，抹杀后立即寻找下一目标）
                if (dm.mode === 'auto' && dm.targets.length === 0) {
                    const t = dmPickTarget();
                    if (t) dmLockTarget(t);
                }
            }

            function drawDeathMark(ctx, e) {
                if (!e.deathMarked) return;
                const dm = game.deathMark;
                const prog = Math.min(1, (e.dmTimer || 0) / Math.max(0.01, dm.markDuration));
                const tx = e.x, ty = e.y - e.size - DEATH_FX.skullSize - 6;
                const pulse = 0.7 + Math.sin(game.time * 6) * 0.3;
                // 血红读条圈
                ctx.strokeStyle = DEATH_FX.ringColor + (0.35 + pulse * 0.3).toFixed(2) + ')';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(tx, ty, DEATH_FX.ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(120,0,0,0.6)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(tx, ty, DEATH_FX.ringRadius, 0, Math.PI * 2); ctx.stroke();
                // 骷髅头
                ctx.save();
                ctx.translate(tx, ty + Math.sin(game.time * 5) * 2);
                const s = DEATH_FX.skullSize;
                ctx.fillStyle = '#e8e0e0';
                ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(-s * 0.45, 0, s * 0.9, s * 0.55);
                ctx.fillStyle = '#222';
                ctx.beginPath(); ctx.arc(-s * 0.28, -s * 0.08, s * 0.14, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.08, s * 0.14, 0, Math.PI * 2); ctx.fill();
                ctx.fillRect(-s * 0.12, s * 0.3, s * 0.24, s * 0.28);
                ctx.restore();
                // 囚禁锁链光罩
                const cr = DEATH_FX.cageRadius + Math.sin(game.time * 4) * 2;
                ctx.strokeStyle = DEATH_FX.cageColor;
                ctx.lineWidth = 2;
                for (let k = 0; k < 6; k++) {
                    const a = Math.PI * 2 / 6 * k + game.time * 0.8;
                    ctx.beginPath();
                    ctx.moveTo(e.x + Math.cos(a) * cr, e.y + Math.sin(a) * cr);
                    ctx.lineTo(e.x + Math.cos(a) * (cr + 8), e.y + Math.sin(a) * (cr + 8));
                    ctx.stroke();
                }
                ctx.strokeStyle = 'rgba(255,60,60,0.25)';
                ctx.beginPath(); ctx.arc(e.x, e.y, cr, 0, Math.PI * 2); ctx.stroke();
                // 地面血环
                ctx.strokeStyle = 'rgba(255,0,0,0.2)';
                ctx.beginPath(); ctx.ellipse(e.x, e.y, 16, 7, 0, 0, Math.PI * 2); ctx.stroke();
            }

            function dmTrySelectAt(x, y) {
                const dm = game.deathMark;
                // 手动模式：最多同时锁定 3 名敌人（无 CD，抹杀后空出名额可继续标记）
                if (dm.targets.length >= 3) return false;
                let best = null, bestD = Infinity;
                for (const e of game.enemies) {
                    if (!e.alive || e.deathMarked) continue;
                    const d = Math.hypot(e.x - x, e.y - y);
                    const hitR = Math.max(60, e.size + 32);
                    if (d < hitR && d < bestD) { bestD = d; best = e; }
                }
                if (best) {
                    dmLockTarget(best);
                    return true;
                }
                return false;
            }
