            function update(dt) {
                if (game.state === 'gameover') return;
                const cappedDt = Math.min(dt, 0.1);
                if (game.state === 'playing') {
                    const player = game.player;
                    player.update(cappedDt);
                    updateWeapons(player, cappedDt);
                    // 更新火焰区域
                    if (game.fireZones) {
                        for (let i = game.fireZones.length - 1; i >= 0; i--) {
                            const zone = game.fireZones[i];
                            zone.remaining -= cappedDt;
                            if (zone.remaining <= 0) {
                                game.fireZones.splice(i, 1);
                                continue;
                            }
                            zone.tickTimer = (zone.tickTimer || 0) + cappedDt;
                            if (zone.tickTimer >= (zone.tickRate || 0.5)) {
                                zone.tickTimer -= (zone.tickRate || 0.5);
                                if (dist(player, zone) < zone.radius + player.size) {
                                    player.takeDamage(zone.damage);
                                }
                            }
                            // 传送门减速区域：减速敌人
                            if (zone.isSlowZone) {
                                for (const e of game.enemies) {
                                    if (!e.alive) continue;
                                    if (Math.hypot(e.x - zone.x, e.y - zone.y) < zone.radius) {
                                        e.applySlow(0.6, 0.6);
                                    }
                                }
                            }
                        }
                    }
                    // 更新星落燃烧区域
                    if (game.burningZones) {
                        for (let i = game.burningZones.length - 1; i >= 0; i--) {
                            const zone = game.burningZones[i];
                            zone.remaining -= cappedDt;
                            if (zone.remaining <= 0) { game.burningZones.splice(i, 1); continue; }
                            zone.tickTimer = (zone.tickTimer || 0) + cappedDt;
                            const tickRate = zone.tickRate || 0.5;
                            if (zone.tickTimer >= tickRate) {
                                zone.tickTimer -= tickRate;
                                for (const e of game.enemies) {
                                    if (!e.alive) continue;
                                    if (Math.hypot(e.x - zone.x, e.y - zone.y) < zone.radius) {
                                        e.takeDamage(zone.damage, 'fire');
                                    }
                                }
                            }
                        }
                    }
                    // 更新暗影刺客残影：减速区域 + 回音剑气
                    if (game.shadowZones) {
                        for (let i = game.shadowZones.length - 1; i >= 0; i--) {
                            const sz = game.shadowZones[i];
                            sz.remaining -= cappedDt;
                            if (sz.remaining <= 0) { game.shadowZones.splice(i, 1); continue; }
                            // 回音剑气：0.3s 后朝玩家发射一次扇形三连（30%伤害），只发射一次
                            if (!sz.echoFired) {
                                sz.echoTimer -= cappedDt;
                                if (sz.echoTimer <= 0) {
                                    sz.echoFired = true;
                                    const base = Math.atan2(player.y - sz.y, player.x - sz.x);
                                    const spread = 0.25;
                                    for (let k = -1; k <= 1; k++) {
                                        const a = base + spread * k;
                                        const pj = new Projectile(sz.x, sz.y, Math.cos(a) * sz.echoSpeed, Math.sin(a) * sz.echoSpeed, sz.echoDamage, 0, 0, '#b06aff', 12, true);
                                        pj.ignoreIFrame = true;
                                        game.projectiles.push(pj);
                                    }
                                }
                            }
                            // 减速区域：玩家进入减速 30%
                            if (Math.hypot(player.x - sz.x, player.y - sz.y) < 90 + player.size) {
                                player.slowTimer = 0.15;
                                player.slowAmount = 0.3;
                            }
                        }
                    }
                    // 更新暗影刺客瞬移拖影
                    if (game.shadowTrails) {
                        for (let i = game.shadowTrails.length - 1; i >= 0; i--) {
                            const tr = game.shadowTrails[i];
                            tr.life -= cappedDt;
                            if (tr.life <= 0) game.shadowTrails.splice(i, 1);
                        }
                    }
                    // ===== 死神之指 状态机 =====
                    if (game.deathMark.enabled) {
                        updateDeathMark(cappedDt);
                    }
                    // 更新陨石下落动画
                    if (game.meteorVisuals) {
                        for (let i = game.meteorVisuals.length - 1; i >= 0; i--) {
                            const m = game.meteorVisuals[i];
                            if (!m.landed) {
                                m.y += m.fallSpeed * cappedDt;
                                if (m.y >= m.targetY) {
                                    m.y = m.targetY;
                                    m.landed = true;
                                    m.landedLife = 0.4;
                                    sound.play('meteor');
                                    for (const e of game.enemies) {
                                        if (!e.alive) continue;
                                        if (Math.hypot(e.x - m.x, e.y - m.y) < m.radius) {
                                            e.takeDamage(m.damage, 'meteor');
                                        }
                                    }
                                    spawnParticles(m.x, m.y, 20, '#ff6600', 80, 0.6, 5);
                                    spawnParticles(m.x, m.y, 14, '#ffcc44', 140, 0.5, 4);
                                    spawnFx(m.x, m.y, 12, '#ff8c00', { shape: 'star', glow: true, speed: 130, life: 0.5, size: 5 });
                                    spawnFx(m.x, m.y, 16, '#8a8a8a', { speed: 60, life: 0.8, size: 6, gravity: 160, drag: 1.5 });
                                    game.rings.push({ x: m.x, y: m.y, r: 8, maxR: m.radius * 0.9, life: 0.4, maxLife: 0.4, color: '#ff8833', width: 5 });
                                    triggerShake(4, 0.2);
                                    if (m.leaveBurning) {
                                        game.burningZones.push({ 
                                            x: m.x, y: m.y, radius: m.radius * 0.6, 
                                            damage: m.damage * m.burningDamagePercent, 
                                            remaining: m.burningDuration,
                                            tickRate: m.burningTickRate,
                                            tickTimer: 0
                                        });
                                    }
                                }
                            } else {
                                m.landedLife -= cappedDt;
                                if (m.landedLife <= 0) game.meteorVisuals.splice(i, 1);
                            }
                        }
                    }
                    // 更新闪电链视觉效果
                    if (game.chainLightningVisuals) {
                        for (let i = game.chainLightningVisuals.length - 1; i >= 0; i--) {
                            game.chainLightningVisuals[i].life -= cappedDt;
                            if (game.chainLightningVisuals[i].life <= 0) game.chainLightningVisuals.splice(i, 1);
                        }
                    }
                    // 熔岩喷发预警圈：倒计时内持续向玩家漂移追踪，结束后爆燃成火区并造成一次触伤
                    if (game.lavaWarns && game.lavaWarns.length) {
                        for (let i = game.lavaWarns.length - 1; i >= 0; i--) {
                            const w = game.lavaWarns[i];
                            w.t -= cappedDt;
                            if (w.t > 0) {
                                // 追踪：以 260px/s 向玩家当前位置漂移（追平玩家移速）
                                const dx = player.x - w.x, dy = player.y - w.y, d = Math.hypot(dx, dy) || 1;
                                if (d > w.r * 0.5) {
                                    w.x = clamp(w.x + dx / d * 260 * cappedDt, 30, WORLD_W - 30);
                                    w.y = clamp(w.y + dy / d * 260 * cappedDt, 30, WORLD_H - 30);
                                }
                                continue;
                            }
                            game.lavaWarns.splice(i, 1);
                            game.fireZones.push({ x: w.x, y: w.y, radius: w.r * 0.92, damage: w.poolDmg, remaining: 2.6, tickRate: 0.5, tickTimer: 0, rgb: '255,120,40' });
                            if (dist(player, w) < w.r + player.size) player.takeDamage(w.dmg);
                            spawnParticles(w.x, w.y, 12, '#ff8833', 110, 0.45, 4);
                            sound.play('explosion');
                        }
                    }
                    for (const proj of game.projectiles) {
                        proj.update(cappedDt);
                        // 酸弹落地：生成毒池
                        if (!proj.alive && proj.acid && !proj.acidPooled) {
                            proj.acidPooled = true;
                            spawnParticles(proj.x, proj.y, 8, '#66ff44', 60, 0.4, 3);
                            if (game.fireZones.length >= 40) game.fireZones.shift();
                            game.fireZones.push({ x: proj.x, y: proj.y, radius: proj.poolRadius || 75, damage: proj.poolDamage || 10, remaining: 4, tickRate: 0.4, tickTimer: 0, rgb: '120,255,80' });
                        }
                        if (!proj.alive) continue;
                        if (proj.isEnemy) {
                            if (dist(proj, player) < proj.size + player.size) {
                                player.takeDamage(proj.damage, 'default', proj.ignoreIFrame === true);
                                proj.alive = false;
                                spawnParticles(proj.x, proj.y, 4, '#ff0000', 40, 0.2, 3);
                            }
                        } else {
                            for (const enemy of game.enemies) {
                                if (!enemy.alive) continue;
                                if (dist(proj, enemy) < proj.size + enemy.size) {
                                    enemy.takeDamage(proj.damage, 'projectile');
                                    sound.play('hit');
                                    if (proj.knockback) {
                                        const kd = Math.hypot(enemy.x - proj.x, enemy.y - proj.y) || 1;
                                        enemy.x = clamp(enemy.x + (enemy.x - proj.x) / kd * proj.knockback, enemy.size, WORLD_W - enemy.size);
                                        enemy.y = clamp(enemy.y + (enemy.y - proj.y) / kd * proj.knockback, enemy.size, WORLD_H - enemy.size);
                                    }
                                    if (proj.shadowSlow && proj.slowChance > 0 && Math.random() < proj.slowChance) {
                                        enemy.applySlow(proj.slowAmount, proj.slowDuration);
                                    }
                                    if (proj.splashRadius > 0) {
                                        const splashDmg = proj.damage * proj.splashDamagePercent;
                                        for (const other of game.enemies) {
                                            if (!other.alive || other === enemy) continue;
                                            if (dist(proj, other) < proj.splashRadius) other.takeDamage(splashDmg, 'projectile');
                                        }
                                    }
                                    proj.alive = false;
                                    spawnParticles(proj.x, proj.y, 4, proj.color, 50, 0.2, 2.5);
                                    spawnFx(proj.x, proj.y, 5, '#ffffff', { shape: 'star', glow: true, speed: 80, life: 0.2, size: 4 });
                                    break;
                                }
                            }
                        }
                    }
                    game.projectiles = game.projectiles.filter(p => p.alive);
                    for (const enemy of game.enemies) if (enemy.alive) enemy.update(cappedDt, player);
                    game.enemies = game.enemies.filter(e => e.alive);
                    // 贪婪之石：经验球自动飞向玩家（全图吸引）
                    const pickupR = player.relicGreed ? Math.max(WORLD_W, WORLD_H) * 2 : player.getEffectivePickupRange();
                    for (const orb of game.experienceOrbs) {
                        if (dist(player, orb) < pickupR) {
                            const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
                            orb.x += Math.cos(angle) * 400 * cappedDt;
                            orb.y += Math.sin(angle) * 400 * cappedDt;
                        }
                        if (dist(player, orb) < player.size + 6) { orb.collected = true; player.addXp(Math.floor(orb.value * (player.expMultiplier || 1))); spawnParticles(orb.x, orb.y, 3, '#ffd700', 30, 0.25, 2); }
                    }
                    game.experienceOrbs = game.experienceOrbs.filter(o => !o.collected && o.life > 0);
                    for (const orb of game.experienceOrbs) orb.life -= cappedDt;
                    game.spawnTimer -= cappedDt;
                    // ===== 精英波次驱动（Boss 在场或预警期间不启动，延后重试） =====
                    if (game.waveState === 'idle') {
                        game.waveTimer -= cappedDt;
                        if (game.waveTimer <= 0) {
                            if (game.bossOnField || game.bossWarnTimer > 0) {
                                game.waveTimer = 3;
                            } else {
                                startEliteWave();
                            }
                        }
                    } else if (game.waveState === 'warning') {
                        game.waveTimer -= cappedDt;
                        game.waveNoticeTimer -= cappedDt;
                        if (game.waveTimer <= 0) {
                            spawnWaveElites();
                        }
                    } else if (game.waveState === 'active') {
                        // 精英全部清除后空投宝箱
                        const eliteLeft = game.enemies.filter(e => e.alive && e.isElite).length;
                        if (eliteLeft <= 0) {
                            spawnChest();
                        }
                    } else if (game.waveState === 'reward') {
                        // 宝箱被拾取或超时后回到下一轮（后续波次 50 秒一轮）
                        if (game.chests.length === 0) {
                            game.waveState = 'idle';
                            game.waveTimer = WAVE_INTERVAL_AFTER;
                        }
                    }
                    // 普通刷怪：精英预警期间照常刷（精英落地时才清场普通小怪）
                    if (!dbg.pauseSpawn) {
                        if (game.spawnTimer <= 0) { game.spawnTimer = game.spawnInterval; spawnEnemy(); }
                    }
                    // 宝箱更新：倒计时 + 拾取
                    for (let i = game.chests.length - 1; i >= 0; i--) {
                        const ch = game.chests[i];
                        ch.life -= cappedDt;
                        if (ch.life <= 0) { game.chests.splice(i, 1); continue; }
                        if (Math.hypot(player.x - ch.x, player.y - ch.y) < 40 + player.size) {
                            openChest(ch);
                            game.chests.splice(i, 1);
                        }
                    }
                    // 定时炸弹：每 10 秒在玩家位置爆炸（伤害随等级提升）
                    if (player.relicBomb) {
                        game.bombTimer -= cappedDt;
                        if (game.bombTimer <= 0) {
                            game.bombTimer = 10;
                            const bombDmg = 20 + game.player.level * 4;
                            const radius = 110;
                            sound.play('explosion');
                            triggerShake(4, 0.2);
                            spawnParticles(player.x, player.y, 30, '#ff8833', 180, 0.5, 5);
                            spawnParticles(player.x, player.y, 12, '#ffcc44', 140, 0.4, 4);
                            for (const e of game.enemies) {
                                if (!e.alive) continue;
                                if (Math.hypot(e.x - player.x, e.y - player.y) < radius + e.size) {
                                    e.takeDamage(bombDmg, 'explosion');
                                }
                            }
                        }
                    }
                    // 影侍守卫：跟随玩家，每10秒向最近2个敌人释放影袭
                    if (player.relicGuard || player.relicClone) {
                        game.cloneAngle = (game.cloneAngle || 0) + cappedDt * 0.9;
                        const cr = player.size + 34;
                        game.cloneX = player.x + Math.cos(game.cloneAngle) * cr;
                        game.cloneY = player.y + Math.sin(game.cloneAngle) * cr;
                        game.cloneTimer = (game.cloneTimer === undefined ? 10 : game.cloneTimer) - cappedDt;
                        if (game.cloneTimer <= 0) {
                            const alive = game.enemies.filter(e => e.alive && !e.deathMarked && !e.dying);
                            if (alive.length > 0) {
                                game.cloneTimer = 10;
                                alive.sort((a, b) => Math.hypot(a.x - game.cloneX, a.y - game.cloneY) - Math.hypot(b.x - game.cloneX, b.y - game.cloneY));
                                const targets = alive.slice(0, 2);
                                for (const target of targets) {
                                    const ang = Math.atan2(target.y - game.cloneY, target.x - game.cloneX);
                                    const spd = 340;
                                    const dmg = (30 + player.level * 2) * (player.globalDamageMultiplier || 1) * player.getRiskMult() * player.getLowHpMult();
                                    game.projectiles.push(new Projectile(game.cloneX, game.cloneY, Math.cos(ang) * spd, Math.sin(ang) * spd, dmg, 0, 0, '#7a3aff', 5));
                                }
                                sound.play('shoot');
                                spawnParticles(game.cloneX, game.cloneY, 8, '#7a3aff', 70, 0.35, 3);
                            } else {
                                game.cloneTimer = 0;
                            }
                        }
                    }
                    // 时停领域：周期冻结全场敌人（含 Boss）2 秒
                    if (player.relicTimeStop) {
                        game.timeStopTimer -= cappedDt;
                        if (game.timeStopTimer <= 0) {
                            game.timeStopTimer = relicRate('relic_time_stop') || 45;
                            let frozen = 0;
                            for (const e of game.enemies) {
                                if (!e.alive || e.deathMarked) continue;
                                e.freezeTimer = Math.max(e.freezeTimer || 0, 2);
                                e.flashTimer = Math.max(e.flashTimer || 0, 0.25); // 冻结瞬间闪白，强化时停反馈
                                frozen++;
                            }
                            if (frozen > 0) {
                                game.warningText = '时停领域！全场敌人冻结 2 秒';
                                game.warningTimer = 1.5;
                                triggerShake(3, 0.25);
                                sound.play('shield');
                                game.rings.push({ x: player.x, y: player.y, r: 20, maxR: Math.max(WORLD_W, WORLD_H), life: 0.6, maxLife: 0.6, color: '#88ddff', width: 6 });
                            }
                        }
                    }
                    // 祭坛/传送门：45 秒刷新一次，触碰触发
                    game.altarTimer -= cappedDt;
                    if (game.altarTimer <= 0 && game.altars.length === 0) {
                        game.altarTimer = 45;
                        spawnAltar();
                    }
                    for (let i = game.altars.length - 1; i >= 0; i--) {
                        const a = game.altars[i];
                        a.life -= cappedDt;
                        if (a.life <= 0) { game.altars.splice(i, 1); continue; }
                        if (Math.hypot(player.x - a.x, player.y - a.y) < 34 + player.size) {
                            activateAltar(a);
                            game.altars.splice(i, 1);
                        }
                    }
                    // 成就检查（每 0.5 秒）
                    game.achCheckTimer = (game.achCheckTimer || 0) - cappedDt;
                    if (game.achCheckTimer <= 0) {
                        game.achCheckTimer = 0.5;
                        checkAchievements();
                    }
                    // ===== Boss 生成（含 5 秒预警；与精英波次互斥） =====
                    if (game.superBossDelay > 0) game.superBossDelay -= cappedDt;
                    if (game.bossWarnTimer > 0) {
                        game.bossWarnTimer -= cappedDt;
                        if (game.bossWarnTimer <= 0) {
                            game.bossWarnTimer = 0;
                            if (game.waveState === 'idle') {
                                if (game.pendingSuperBoss) spawnSuperBoss();
                                else spawnBoss();
                                game.pendingSuperBoss = false;
                                game.bossTimer = (DIFFICULTIES[game.selectedDifficulty] || DIFFICULTIES.normal).bossRespawn;
                            }
                        }
                    }
                    if (!game.bossOnField && !dbg.pauseSpawn && game.bossWarnTimer <= 0) {
                        // 超级Boss：击杀 3 个 Boss 或存活 10 分钟后召唤（死亡后延迟 20 秒才可触发）
                        if (!game.superBossSpawned && game.superBossDelay <= 0 && (game.bossKilledCount >= 3 || game.time >= 600)) {
                            if (game.waveState === 'idle') {
                                game.pendingSuperBoss = true;
                                game.bossWarnTimer = 5;
                                game.warningText = '强敌即将降临！';
                                game.warningTimer = 2.0;
                                sound.play('bossWarn');
                            }
                        } else {
                            game.bossTimer -= cappedDt;
                            if (game.bossTimer <= 0) {
                                if (game.waveState !== 'idle') {
                                    // 精英波次期间不生成 Boss，延后重试
                                    game.bossTimer = 5;
                                } else {
                                    game.pendingSuperBoss = false;
                                    game.bossWarnTimer = 5;
                                    game.warningText = 'Boss 即将来袭！';
                                    game.warningTimer = 2.0;
                                    sound.play('bossWarn');
                                }
                            }
                        }
                    }
                    if (game.warningTimer > 0) game.warningTimer -= cappedDt;
                    const newDiff = Math.floor(game.time / 25) + 1;
                    if (newDiff > game.difficultyLevel) {
                        game.difficultyLevel = newDiff;
                        // 出怪频率：按难度预设的初始间隔 / 每级降低量 / 下限收紧
                        const diffNow = DIFFICULTIES[game.selectedDifficulty] || DIFFICULTIES.normal;
                        game.spawnInterval = Math.max(diffNow.spawnMin, diffNow.spawnInterval - (newDiff - diffNow.diffStart) * diffNow.spawnStep);
                    }
                    for (const p of particles) p.update(cappedDt); particles = particles.filter(p => p.alive);
                    for (const dn of damageNumbers) dn.update(cappedDt); damageNumbers = damageNumbers.filter(dn => dn.alive);
                    for (const dt2 of deathTexts) dt2.update(cappedDt); deathTexts = deathTexts.filter(dt2 => dt2.alive);
                    // 特效环扩散
                    if (game.rings) {
                        for (let i = game.rings.length - 1; i >= 0; i--) {
                            const rg = game.rings[i];
                            rg.life -= cappedDt;
                            if (rg.life <= 0) { game.rings.splice(i, 1); continue; }
                            const t = 1 - rg.life / rg.maxLife;
                            rg.r = rg.maxR * (1 - Math.pow(1 - t, 3));
                        }
                    }
                    if (game.levelFlash > 0) game.levelFlash -= cappedDt;
                    if (game.flashWhite > 0) game.flashWhite -= cappedDt;
                    updateDust(cappedDt);
                    if (screenShake.elapsed < screenShake.duration) screenShake.elapsed += cappedDt;
                    game.time += cappedDt;
                } else if (game.state === 'levelup' || game.state === 'bossdrop') {
                    // 升级点击保护倒计时（1.5 秒内防误触）
                    if (game.levelupLock > 0) {
                        game.levelupLock -= cappedDt;
                        if (game.levelupLock <= 0) {
                            game.levelupLock = 0;
                            levelupPanel.classList.remove('locked');
                            const lockHint = $inp('levelup-lock-hint');
                            if (lockHint) lockHint.textContent = '';
                        } else {
                            const lockHint = $inp('levelup-lock-hint');
                            if (lockHint) lockHint.textContent = Math.ceil(game.levelupLock) + ' 秒后可选择';
                        }
                    }
                    for (const p of particles) p.update(cappedDt); particles = particles.filter(p => p.alive);
                    for (const dn of damageNumbers) dn.update(cappedDt); damageNumbers = damageNumbers.filter(dn => dn.alive);
                    for (const dt2 of deathTexts) dt2.update(cappedDt); deathTexts = deathTexts.filter(dt2 => dt2.alive);
                    if (game.rings) {
                        for (let i = game.rings.length - 1; i >= 0; i--) {
                            const rg = game.rings[i];
                            rg.life -= cappedDt;
                            if (rg.life <= 0) { game.rings.splice(i, 1); continue; }
                            const t = 1 - rg.life / rg.maxLife;
                            rg.r = rg.maxR * (1 - Math.pow(1 - t, 3));
                        }
                    }
                    if (game.levelFlash > 0) game.levelFlash -= cappedDt;
                    if (game.flashWhite > 0) game.flashWhite -= cappedDt;
                    updateDust(cappedDt);
                    if (screenShake.elapsed < screenShake.duration) screenShake.elapsed += cappedDt;
                }
            }

            // ==================== 屏外目标指示箭头（祭坛/宝箱；屏幕空间绘制） ====================
