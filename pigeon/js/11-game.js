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
            function drawOffscreenArrows(ctx) {
                if (game.state !== 'playing' || !game.player) return;
                const player = game.player;
                const m = 30; // 屏幕内缩边距：目标进入此范围内视为可见
                const targets = [];
                for (const a of (game.altars || [])) {
                    const kind = a.type === 'heal' ? { color: '#55cc77', label: '祭坛' }
                        : a.type === 'risk' ? { color: '#ff5544', label: '祭坛' }
                        : { color: '#44aaff', label: '传送门' };
                    targets.push({ x: a.x, y: a.y, color: kind.color, label: kind.label });
                }
                for (const c of (game.chests || [])) {
                    targets.push({ x: c.x, y: c.y, color: '#ffd700', label: '宝箱' });
                }
                // Boss（含超级Boss）：紫红箭头，文字用敌人类型名
                for (const e of game.enemies) {
                    if (!e.alive || !e.isBoss) continue;
                    const bd = ENEMY_TYPES[e.typeKey];
                    targets.push({ x: e.x, y: e.y, color: '#ff44dd', label: (bd && bd.name) || 'Boss' });
                }
                if (!targets.length) return;
                // 玩家实际屏幕位置（镜头 clamp 时玩家不居中，以其为射线起点更准确）
                const psx = player.x - cam.x, psy = player.y - cam.y;
                for (const t of targets) {
                    const sx = t.x - cam.x, sy = t.y - cam.y;
                    if (sx > m && sx < W - m && sy > m && sy < H - m) continue; // 屏内可见
                    let dx = sx - psx, dy = sy - psy;
                    if (dx === 0 && dy === 0) continue;
                    // 射线与内缩矩形求交：取到达边界的最小比例
                    const s = Math.min(
                        dx > 0 ? (W - m - psx) / dx : dx < 0 ? (m - psx) / dx : Infinity,
                        dy > 0 ? (H - m - psy) / dy : dy < 0 ? (m - psy) / dy : Infinity
                    );
                    const ex = clamp(psx + dx * s, m, W - m);
                    const ey = clamp(psy + dy * s, m, H - m);
                    const ang = Math.atan2(dy, dx);
                    const pulse = 0.75 + Math.sin(game.time * 5) * 0.25;
                    ctx.save();
                    ctx.translate(ex, ey);
                    ctx.rotate(ang);
                    ctx.globalAlpha = pulse;
                    ctx.fillStyle = t.color;
                    ctx.beginPath();
                    ctx.moveTo(11, 0); ctx.lineTo(-7, -8); ctx.lineTo(-3, 0); ctx.lineTo(-7, 8);
                    ctx.closePath(); ctx.fill();
                    ctx.restore();
                    // 文字标注贴在箭头内侧（朝屏幕中心一侧）
                    const inr = 22; // 内退距离
                    const tx = ex - Math.cos(ang) * inr, ty = ey - Math.sin(ang) * inr;
                    ctx.globalAlpha = Math.min(1, pulse + 0.15);
                    ctx.fillStyle = t.color;
                    ctx.font = 'bold 12px "PingFang SC","Microsoft YaHei",sans-serif';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(t.label, tx, ty);
                    ctx.globalAlpha = 1;
                }
            }

            function draw(ctx) {
                // 每帧从确定的变换开始：重置为像素缩放再清屏/铺底色，避免上一帧残留变换导致清屏错位、顶端出现残影
                ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
                ctx.clearRect(0, 0, W, H);
                ctx.fillStyle = '#2b160c'; ctx.fillRect(0, 0, W, H);
                const shake = getShakeOffset();
                ctx.save(); ctx.translate(shake.x, shake.y);
                // ===== 世界空间：镜头平移后绘制世界底色、网格与世界内全部实体 =====
                ctx.save(); ctx.translate(-cam.x, -cam.y);
                ctx.fillStyle = '#2b160c'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
                ctx.strokeStyle = 'rgba(255,180,120,0.05)'; ctx.lineWidth = 1;
                for (let gx = 40; gx < WORLD_W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, WORLD_H); ctx.stroke(); }
                for (let gy = 40; gy < WORLD_H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WORLD_W, gy); ctx.stroke(); }
                // 世界边界提示线
                ctx.strokeStyle = 'rgba(255,150,80,0.35)'; ctx.lineWidth = 3;
                ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
                for (const orb of game.experienceOrbs) {
                    const floatY = Math.sin(game.time * 3 + orb.floatOffset) * 3;
                    const alpha = orb.life < 3 ? orb.life / 3 : 1;
                    ctx.fillStyle = `rgba(255,215,0,${alpha})`; ctx.beginPath(); ctx.arc(orb.x, orb.y + floatY, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = `rgba(255,255,200,${alpha*0.8})`; ctx.beginPath(); ctx.arc(orb.x, orb.y + floatY, 2.5, 0, Math.PI * 2); ctx.fill();
                }
                // 宝箱绘制：金色宝箱 + 发光 + 脉动
                for (const ch of game.chests) {
                    const by = ch.y + Math.sin(game.time * 3 + ch.bob) * 3;
                    const pulse = 0.6 + Math.sin(game.time * 6) * 0.2;
                    const glow = ctx.createRadialGradient(ch.x, by, 0, ch.x, by, 34);
                    glow.addColorStop(0, `rgba(255,215,0,${0.35 * pulse})`);
                    glow.addColorStop(1, 'rgba(255,215,0,0)');
                    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ch.x, by, 34, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.arc(ch.x, by, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#8a5a00';
                    ctx.fillRect(ch.x - 7, by - 4, 14, 5);
                    ctx.fillStyle = '#fff3b0';
                    ctx.fillRect(ch.x - 1.5, by - 7, 3, 10);
                }
                // 祭坛/传送门绘制
                for (const a of game.altars) {
                    const ay = a.y + Math.sin(game.time * 2 + a.pulse) * 3;
                    const colors = { heal: '#55ff88', risk: '#ff4444', portal: '#88aaff' };
                    const col = colors[a.type] || '#ffffff';
                    const pulse = 0.6 + Math.sin(game.time * 5 + a.pulse) * 0.3;
                    const glow = ctx.createRadialGradient(a.x, ay, 0, a.x, ay, 40);
                    glow.addColorStop(0, col.replace(')', `,${0.35 * pulse})`).replace('rgb', 'rgba'));
                    glow.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(a.x, ay, 40, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(a.x, ay, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    // 图标区分
                    ctx.fillStyle = '#fff';
                    if (a.type === 'heal') { ctx.fillStyle = '#155a2a'; ctx.fillRect(a.x - 7, ay - 2, 14, 4); ctx.fillRect(a.x - 2, ay - 7, 4, 14); }
                    else if (a.type === 'risk') { ctx.fillStyle = '#5a1010'; ctx.beginPath(); ctx.moveTo(a.x, ay - 8); ctx.lineTo(a.x + 8, ay + 5); ctx.lineTo(a.x - 8, ay + 5); ctx.closePath(); ctx.fill(); }
                    else { ctx.fillStyle = '#10305a'; ctx.beginPath(); ctx.arc(a.x, ay, 5, 0, Math.PI * 2); ctx.fill(); }
                }
                for (const proj of game.projectiles) proj.draw(ctx);
                // 熔岩喷发预警圈（脉动橙圈）
                if (game.lavaWarns && game.lavaWarns.length) {
                    for (const w of game.lavaWarns) {
                        const wp = 0.45 + Math.sin(game.time * 12) * 0.3;
                        ctx.fillStyle = `rgba(255,110,40,${0.10 + wp * 0.12})`;
                        ctx.strokeStyle = `rgba(255,110,40,${wp + 0.3})`;
                        ctx.lineWidth = 2.5;
                        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    }
                }
                for (const enemy of game.enemies) enemy.draw(ctx);
                if (game.deathMark.enabled) {
                    for (const enemy of game.enemies) {
                        if (enemy.deathMarked) drawDeathMark(ctx, enemy);
                    }
                }
                // 影侍守卫绘制（盾卫形态，与精灵区分）
                if (game.player && (game.player.relicGuard || game.player.relicClone) && game.cloneX !== undefined) {
                    const bob = Math.sin(game.time * 5) * 2;
                    const cx = game.cloneX, cy = game.cloneY + bob;
                    ctx.globalAlpha = 0.60;
                    ctx.fillStyle = '#2a3a5a';
                    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 0.90;
                    ctx.strokeStyle = '#88aaff'; ctx.lineWidth = 1.8;
                    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = '#cce0ff';
                    ctx.fillRect(cx - 5, cy - 4, 3, 3); ctx.fillRect(cx + 2, cy - 4, 3, 3);
                    // 胸口盾徽
                    ctx.fillStyle = '#88aaff'; ctx.beginPath(); ctx.arc(cx, cy + 3, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                }
                if (game.player) game.player.draw(ctx);
                if (game.player) drawWeaponsVisuals(game.player, ctx);
                for (const p of particles) p.draw(ctx);
                for (const dn of damageNumbers) dn.draw(ctx);
                for (const dt2 of deathTexts) dt2.draw(ctx);
                // 特效冲击环
                if (game.rings) {
                    for (const rg of game.rings) {
                        const a = clamp(rg.life / rg.maxLife, 0, 1);
                        ctx.strokeStyle = rg.color;
                        ctx.globalAlpha = a * 0.9;
                        ctx.lineWidth = rg.width * (0.5 + a * 0.5);
                        ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }
                ctx.restore();
                // 背景漂浮尘埃（屏幕空间：随镜头漂移的空气中尘埃）
                for (const d of dustParticles) {
                    const da = 0.10 + Math.sin(game.time * 1.5 + d.phase) * 0.07;
                    ctx.fillStyle = `rgba(255,220,180,${Math.max(0.02, da)})`;
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
                }
                // 屏外目标指示箭头（祭坛/宝箱）
                drawOffscreenArrows(ctx);
                if (game.state === 'levelup' || game.bossDropChoices) {
                    ctx.fillStyle = 'rgba(43,26,18,0.4)'; ctx.fillRect(0, 0, W, H);
                }
                // 虚拟摇杆绘制
                if (joystick.active) {
                    ctx.globalAlpha = 0.30;
                    ctx.fillStyle = '#fff6e8';
                    ctx.strokeStyle = '#f4761a';
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(joystick.baseX, joystick.baseY, 52, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.globalAlpha = 0.6;
                    ctx.fillStyle = '#ff9f43';
                    ctx.beginPath(); ctx.arc(joystick.baseX + joystick.dx, joystick.baseY + joystick.dy, 26, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                }
                // Boss 出场白闪
                if (game.flashWhite > 0) {
                    ctx.fillStyle = `rgba(255,255,255,${clamp(game.flashWhite / 0.28, 0, 1) * 0.22})`;
                    ctx.fillRect(0, 0, W, H);
                }
                // 升级金色闪光
                if (game.levelFlash > 0) {
                    ctx.fillStyle = `rgba(255,215,0,${clamp(game.levelFlash / 0.35, 0, 1) * 0.16})`;
                    ctx.fillRect(0, 0, W, H);
                }
                // 精英波次预警：屏幕边缘红色脉冲
                if (game.waveState === 'warning') {
                    const pulse = 0.5 + Math.sin(game.time * 6) * 0.3;
                    ctx.strokeStyle = `rgba(255,60,40,${0.16 + pulse * 0.14})`;
                    ctx.lineWidth = 14;
                    ctx.strokeRect(7, 7, W - 14, H - 14);
                }
                // 低血量警告 vignette
                if (game.state === 'playing' && game.player) {
                    const hpRatio = game.player.hp / game.player.maxHp;
                    if (hpRatio < 0.25) {
                        const pulse = 0.5 + Math.sin(game.time * 5) * 0.3;
                        const a = (0.25 - hpRatio) / 0.25 * (0.22 + pulse * 0.12);
                        const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.62);
                        vg.addColorStop(0, 'rgba(255,0,0,0)');
                        vg.addColorStop(1, `rgba(255,0,0,${clamp(a, 0, 0.38)})`);
                        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
                    }
                }
                ctx.restore(); // 平衡开头的 shake 层 save
                // 精英波次提示（屏幕空间：必须在世界层之后绘制，否则被世界底色覆盖）
                if (game.state === 'playing' && game.waveState !== 'idle') {
                    let txt = '';
                    if (game.waveState === 'warning') txt = '精英波次来袭！' + Math.ceil(Math.max(0, game.waveTimer)) + ' 秒后降临';
                    else if (game.waveState === 'active') txt = '精英波次！清除所有精英';
                    else if (game.waveState === 'reward') txt = '宝箱已空投！';
                    ctx.save();
                    ctx.font = 'bold 22px "Impact","Arial Black","PingFang SC",sans-serif';
                    ctx.textAlign = 'center';
                    ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 12;
                    ctx.fillStyle = '#ffcc66';
                    ctx.fillText(txt, W / 2, 70);
                    ctx.shadowBlur = 0;
                    ctx.restore();
                }
                updateHud();
            }

            function updateHud() {
                const inGame = game.state !== 'menu';
                hudTop.style.display = inGame ? 'flex' : 'none';
                hudWeps.style.display = inGame ? 'flex' : 'none';
                hudWarning.style.display = 'none';
                hudHint.style.display = 'none';
                pauseOverlay.style.display = 'none';
                btnPause.style.display = inGame ? '' : 'none';
                if (!inGame) return;
                const player = game.player;
                if (player) {
                    const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
                    hudHpFill.style.width = (hpRatio * 100) + '%';
                    hudHpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
                    const xpRatio = clamp(player.xp / player.xpToNext, 0, 1);
                    hudXpFill.style.width = (xpRatio * 100) + '%';
                    hudXpText.textContent = `Lv.${player.level}`;
                    let weps = '';
                    for (const w of player.weapons) {
                        if (w.type === 'magic_missile') weps += '<span class="chip">' + ICONS.flame + '火球</span>';
                        else if (w.type === 'orbit_blade') weps += '<span class="chip">' + ICONS.swords + '飞刃×' + w.bladeCount + '</span>';
                        else if (w.type === 'frost_nova') weps += '<span class="chip">' + ICONS.snowflake + '冰霜</span>';
                        else if (w.type === 'lightning_chain') weps += '<span class="chip">' + ICONS.zap + '闪电</span>';
                        else if (w.type === 'meteor') weps += '<span class="chip">' + ICONS.orbit + '陨石</span>';
                        else if (w.type === 'shadow_spirit') weps += '<span class="chip">' + ICONS.ghost + '精灵×' + w.spiritCount + '</span>';
                    }
                    hudWeps.innerHTML = weps ? '武器：' + weps : '';
                }
                hudTime.textContent = Math.floor(game.time) + 's';
                hudKills.textContent = game.kills;
                const boss = game.enemies.find(e => e.isBoss && e.alive);
                if (boss) {
                    hudBoss.style.display = 'flex';
                    hudBossName.textContent = ENEMY_TYPES[boss.typeKey].name;
                    hudBossFill.style.width = (clamp(boss.hp / boss.maxHp, 0, 1) * 100) + '%';
                    if (boss.invincible && boss.shieldHp > 0) {
                        hudShield.style.display = 'block';
                        hudShield.style.width = (clamp(boss.shieldHp / boss.shieldMax, 0, 1) * 100) + '%';
                    } else {
                        hudShield.style.display = 'none';
                    }
                } else if (hudBoss.style.display !== 'none') {
                    hudBoss.style.display = 'none';
                }
                if (game.warningTimer > 0) {
                    hudWarning.textContent = game.warningText;
                    hudWarning.style.opacity = (0.9 * Math.min(1, game.warningTimer)).toFixed(2);
                    hudWarning.style.display = 'block';
                } else if (hudWarning.style.display !== 'none') {
                    hudWarning.style.display = 'none';
                }
                if (game.time < 4 && game.state === 'playing') {
                    if (useTouchControl) {
                        hudHint.textContent = game.deathMark.enabled && game.deathMark.mode === 'manual' ? '按住任意位置拖动控制 · 点击敌人标记' : '按住任意位置拖动控制';
                    } else {
                        hudHint.textContent = '键鼠 / 触屏均可操作';
                    }
                    hudHint.style.display = 'block';
                } else if (hudHint.style.display !== 'none') {
                    hudHint.style.display = 'none';
                }
                pauseOverlay.style.display = (dbg.pauseGame && game.state === 'playing') ? 'flex' : 'none';
            }

            let lastTime = performance.now(), accumulator = 0;
            const fixedDt = 1 / 60;
            document.addEventListener('visibilitychange', () => { lastTime = performance.now(); accumulator = 0; });
            function gameLoop(timestamp) {
                let rawDt = (timestamp - lastTime) / 1000; lastTime = timestamp;
                if (rawDt > 0.2) rawDt = 0.2;
                dbg.fps = dbg.fps * 0.9 + (rawDt > 0 ? Math.min(60, 1 / rawDt) : 60) * 0.1;
                const fpsEl = $inp('dbg-fps');
                if (fpsEl) fpsEl.textContent = Math.round(dbg.fps);
                if (!dbg.pauseGame) {
                    accumulator += rawDt * dbg.timeScale;
                    while (accumulator >= fixedDt) { update(fixedDt); accumulator -= fixedDt; }
                }
                resizeCanvas();
                if (game.player) { game.player.x = clamp(game.player.x, game.player.size, WORLD_W - game.player.size); game.player.y = clamp(game.player.y, game.player.size, WORLD_H - game.player.size); }
                // ===== 镜头跟随玩家（世界固定大于视口；视口比世界大时世界居中） =====
                if (game.player) {
                    const cx = WORLD_W - W, cy = WORLD_H - H;
                    cam.x = cx <= 0 ? cx / 2 : clamp(game.player.x - W / 2, 0, cx);
                    cam.y = cy <= 0 ? cy / 2 : clamp(game.player.y - H / 2, 0, cy);
                }
                draw(ctx);
                requestAnimationFrame(gameLoop);
            }

            restartBtn.addEventListener('click', () => { initGame(); lastTime = performance.now(); accumulator = 0; });
            gameoverOverlay.addEventListener('click', (e) => { if (e.target === gameoverOverlay) { initGame(); lastTime = performance.now(); accumulator = 0; } });

            function renderMenu() {
                menuDiffs.innerHTML = '';
                for (const [key, d] of Object.entries(DIFFICULTIES)) {
                    const b = document.createElement('button');
                    b.textContent = d.name;
                    b.classList.toggle('active', game.selectedDifficulty === key);
                    b.addEventListener('click', () => { game.selectedDifficulty = key; renderMenu(); });
                    menuDiffs.appendChild(b);
                }
                menuWeapons.innerHTML = '';
                for (const [key, m] of Object.entries(START_WEAPON_META)) {
                    const b = document.createElement('button');
                    b.innerHTML = `<span class="w-ico">${ICONS[m.icon] || ''}</span>${m.name}`;
                    b.classList.toggle('active', game.selectedWeapon === key);
                    b.addEventListener('click', () => { game.selectedWeapon = key; renderMenu(); });
                    menuWeapons.appendChild(b);
                }
                const dk = game.selectedDifficulty || 'normal';
                const bt = parseInt(localStorage.getItem('rogue_best_time_' + dk) || '0', 10);
                const bk = parseInt(localStorage.getItem('rogue_best_kills_' + dk) || '0', 10);
                menuBest.textContent = (bt > 0 || bk > 0) ? `最佳记录（${(DIFFICULTIES[dk] || DIFFICULTIES.normal).name}）：存活 ${bt} 秒 · ${bk} 击杀` : '尚无最佳记录，开启你的第一局吧！';
                menuShards.textContent = `灵魂碎片：${metaData.shards || 0}`;
            }

            // ===== 灵魂宝库面板（分区：talent=天赋 / relic=圣物） =====
            let metaTab = 'talent';
            function renderMetaPanel() {
                metaShardsShow.textContent = `灵魂碎片：${metaData.shards || 0}`;
                // 分区按钮高亮
                const isTalent = metaTab === 'talent';
                metaTabTalent.classList.toggle('active', isTalent);
                metaTabRelic.classList.toggle('active', !isTalent);
                metaList.innerHTML = '';
                if (!isTalent) return renderMetaRelics();
                // 永久升级树
                for (const u of META_UPGRADES) {
                    const lv = metaLevel(u.id);
                    const cost = metaUpgradeCost(u.id);
                    const item = document.createElement('div');
                    item.className = 'meta-item';
                    const info = document.createElement('div');
                    info.className = 'mi-info';
                    const name = document.createElement('div');
                    name.className = 'mi-name';
                    name.innerHTML = `${ICONS[u.icon] || ''} ${u.name}`;
                    const desc = document.createElement('div');
                    desc.className = 'mi-desc';
                    desc.textContent = u.desc(lv);
                    const lvEl = document.createElement('div');
                    lvEl.className = 'mi-lv';
                    lvEl.textContent = `等级 ${lv}/${u.maxLevel}`;
                    info.appendChild(name); info.appendChild(desc); info.appendChild(lvEl);
                    item.appendChild(info);
                    const btn = document.createElement('button');
                    if (cost < 0) {
                        btn.textContent = '已满级';
                        btn.disabled = true;
                    } else {
                        btn.textContent = `${cost} 碎片`;
                        btn.disabled = (metaData.shards || 0) < cost;
                        btn.addEventListener('click', () => {
                            if (buyMetaUpgrade(u.id)) {
                                renderMetaPanel();
                                menuShards.textContent = `灵魂碎片：${metaData.shards || 0}`;
                            }
                        });
                    }
                    item.appendChild(btn);
                    metaList.appendChild(item);
                }
            }

            // 圣物分区渲染（带 maxLevel 的可升级；可自由穿戴/卸下，卸下后效果不生效）
            function renderMetaRelics() {
                metaList.innerHTML = '';
                for (const r of META_RELICS) {
                    const lv = relicLevel(r.id);
                    const maxLv = r.maxLevel || 1;
                    const active = isRelicActive(r.id);
                    const item = document.createElement('div');
                    item.className = 'meta-item relic-card';
                    item.classList.toggle('relic-off', lv > 0 && !active);
                    const info = document.createElement('div');
                    info.className = 'mi-info';
                    const name = document.createElement('div');
                    name.className = 'mi-name';
                    name.innerHTML = `${ICONS[r.icon] || ''} ${r.name}` + (maxLv > 1 && lv > 0 ? ` <span class="mi-lv">Lv.${lv}/${maxLv}</span>` : '') + (lv > 0 && !active ? ' <span class="mi-lv" style="background:#999;">未穿戴</span>' : '');
                    const desc = document.createElement('div');
                    desc.className = 'mi-desc';
                    desc.textContent = typeof r.desc === 'function' ? r.desc(Math.max(1, lv)) : r.desc;
                    info.appendChild(name); info.appendChild(desc);
                    item.appendChild(info);
                    // 按钮行：购买/升级 + 穿戴切换（卡片纵向布局，避免长文案挤压名称）
                    const btnrow = document.createElement('div');
                    btnrow.className = 'meta-btnrow';
                    const btn = document.createElement('button');
                    if (lv >= maxLv) {
                        btn.textContent = maxLv > 1 ? '已满级' : '已拥有';
                        btn.disabled = true;
                    } else {
                        const cost = lv === 0 ? r.cost : (r.upgradeCost || r.cost);
                        btn.textContent = lv === 0 ? `${cost} 碎片` : `升级到 Lv.${lv + 1}（${cost} 碎片）`;
                        btn.disabled = (metaData.shards || 0) < cost;
                        btn.addEventListener('click', () => {
                            // 死神之指：先弹出使用说明确认框，再购买
                            if (r.id === 'relic_deathmark') {
                                dmBuyModal.style.display = 'flex';
                                return;
                            }
                            if (buyRelic(r.id)) {
                                renderMetaPanel();
                                menuShards.textContent = `灵魂碎片：${metaData.shards || 0}`;
                            }
                        });
                    }
                    btnrow.appendChild(btn);
                    // 穿戴/卸下切换（仅已拥有圣物）
                    if (lv > 0) {
                        const tog = document.createElement('button');
                        tog.className = 'meta-toggle';
                        tog.textContent = active ? '卸下' : '穿戴';
                        tog.addEventListener('click', () => {
                            setRelicActive(r.id, !active);
                            renderMetaPanel();
                            syncDeathMarkUI();
                        });
                        btnrow.appendChild(tog);
                    }
                    item.appendChild(btnrow);
                    metaList.appendChild(item);
                }
            }
            btnOpenMeta.addEventListener('click', () => { renderMetaPanel(); menuOverlay.style.display = 'none'; metaPanel.style.display = 'flex'; });
            // 宝库分区切换：左天赋 / 右圣物
            metaTabTalent.addEventListener('click', () => { if (metaTab !== 'talent') { metaTab = 'talent'; renderMetaPanel(); } });
            metaTabRelic.addEventListener('click', () => { if (metaTab !== 'relic') { metaTab = 'relic'; renderMetaPanel(); } });
            metaClose.addEventListener('click', () => { metaPanel.style.display = 'none'; menuOverlay.style.display = 'flex'; renderMenu(); syncDeathMarkUI(); });
            // 清空存档：清除灵魂碎片/永久升级/圣物/成就/最佳记录
            metaReset.addEventListener('click', () => {
                if (!confirm('确定清空所有存档？灵魂碎片、永久升级、圣物、成就与最佳记录都将清除！')) return;
                try {
                    localStorage.removeItem('rogue_meta');
                    localStorage.removeItem('rogue_meta_sig');
                    localStorage.removeItem('rogue_ach');
                    // 最佳记录按难度分档，遍历清除
                    for (const dk of Object.keys(DIFFICULTIES)) {
                        localStorage.removeItem('rogue_best_time_' + dk);
                        localStorage.removeItem('rogue_best_kills_' + dk);
                    }
                    localStorage.removeItem('rogue_best_time');
                    localStorage.removeItem('rogue_best_kills');
                } catch(e) {}
                metaData = loadMeta();
                achievementsDone = loadAchievements();
                renderMetaPanel();
                renderMenu();
            });
            function showMenu() {
                renderMenu();
                dbg.pauseGame = false;
                btnPause.innerHTML = ICONS.pause;
                menuOverlay.style.display = 'flex';
                game.state = 'menu';
                syncDeathMarkUI();
            }
            menuStart.addEventListener('click', () => {
                metaPanel.style.display = 'none';
                menuOverlay.style.display = 'none';
                initGame();
                lastTime = performance.now(); accumulator = 0;
            });
            menuBtn.addEventListener('click', () => {
                gameoverOverlay.style.display = 'none';
                metaPanel.style.display = 'none';
                showMenu();
            });

            initIcons();
            lastTime = performance.now(); requestAnimationFrame(gameLoop);
            showMenu();
            if (typeof dbgInit === 'function') dbgInit();
            console.log('魔法幸存者 已启动');

            // ==================== 顶部按钮与快捷键（两版本共用） ====================
            btnPause.addEventListener('click', () => {
                if (game.state !== 'playing') return;
                dbg.pauseGame = !dbg.pauseGame;
                btnPause.innerHTML = dbg.pauseGame ? ICONS.play : ICONS.pause;
                const dbgPauseEl = $inp('dbg-pause'); if (dbgPauseEl) dbgPauseEl.checked = dbg.pauseGame;
            });
            btnMute.addEventListener('click', () => { btnMute.innerHTML = sound.toggleMute() ? ICONS['volume-x'] : ICONS['volume-2']; });
            // ===== 全屏切换（移动端/桌面通用） =====
            let fsToastTimer = null;
            function showFsToast(msg) {
                fsToast.textContent = msg;
                fsToast.classList.add('show');
                clearTimeout(fsToastTimer);
                fsToastTimer = setTimeout(() => fsToast.classList.remove('show'), 1600);
            }
            function isFullscreen() {
                return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            }
            function enterFullscreen() {
                const el = document.documentElement;
                const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
                if (!req) return Promise.reject(new Error('unsupported'));
                return req.call(el);
            }
            function exitFullscreen() {
                const ex = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
                if (!ex) return Promise.reject(new Error('unsupported'));
                return ex.call(document);
            }
            btnFs.addEventListener('click', () => {
                const goingFs = !isFullscreen();
                const p = goingFs ? enterFullscreen() : exitFullscreen();
                if (p && p.catch) p.catch(() => showFsToast('当前浏览器不支持全屏'));
            });
            function syncFsIcon() {
                const fs = isFullscreen();
                btnFs.innerHTML = fs ? ICONS.compress : ICONS.expand;
                btnFs.title = fs ? '退出全屏' : '全屏';
                document.body.classList.toggle('in-fullscreen', fs);
            }
            document.addEventListener('fullscreenchange', syncFsIcon);
            document.addEventListener('webkitfullscreenchange', syncFsIcon);
            document.addEventListener('mozfullscreenchange', syncFsIcon);
            document.addEventListener('MSFullscreenChange', syncFsIcon);
            syncFsIcon();
            // ===== 死神之指按钮：点击切换模式（需在灵魂宝库购买解锁） =====
            btnDeathMark.addEventListener('click', (e) => {
                if (!game.deathMark.enabled) return;
                game.deathMark.mode = game.deathMark.mode === 'auto' ? 'manual' : 'auto';
                btnDeathMark.classList.toggle('death-auto', game.deathMark.mode === 'auto');
                game.warningText = '死神之指：' + (game.deathMark.mode === 'auto' ? '自动' : '手动') + '模式';
                game.warningTimer = 1.0;
            });
            // ===== 死神之指 UI 同步：正式版需购买并穿戴解锁；Debug 版尊重调试面板开关 =====
            function syncDeathMarkUI() {
                const unlocked = isRelicActive('relic_deathmark');
                let on = unlocked;
                const dbgDM = $inp('dbg-deathmark');
                if (typeof dbgInit === 'function' && dbgDM) on = dbgDM.checked;
                game.deathMark.enabled = on;
                btnDeathMark.style.display = on ? '' : 'none';
                if (on) {
                    game.deathMark.mode = 'auto';
                    btnDeathMark.classList.add('death-auto');
                } else {
                    btnDeathMark.classList.remove('death-auto');
                }
            }
            window.addEventListener('keydown', (e) => {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
                if (e.key === 'p' || e.key === 'P' || e.key === 'Escape' || e.key === ' ') {
                    if (game.state !== 'playing') return;
                    dbg.pauseGame = !dbg.pauseGame;
                    btnPause.innerHTML = dbg.pauseGame ? ICONS.play : ICONS.pause;
                }
                else if (e.key === 'm' || e.key === 'M') { btnMute.innerHTML = sound.toggleMute() ? ICONS['volume-x'] : ICONS['volume-2']; }
            });
            // ===== 暂停面板：继续游戏 =====
            if (pauseResumeBtn) {
                pauseResumeBtn.addEventListener('click', () => {
                    if (game.state !== 'playing') return;
                    dbg.pauseGame = false;
                    btnPause.innerHTML = ICONS.pause;
                    const dbgPauseEl = $inp('dbg-pause'); if (dbgPauseEl) dbgPauseEl.checked = false;
                });
            }
            // ===== 暂停面板：返回主菜单（结算本局碎片） =====
            if (pauseMenuBtn) {
                pauseMenuBtn.addEventListener('click', () => {
                    if (game.state !== 'playing') return;
                    const got = settleShards();
                    dbg.pauseGame = false;
                    btnPause.innerHTML = ICONS.pause;
                    const dbgPauseEl = $inp('dbg-pause'); if (dbgPauseEl) dbgPauseEl.checked = false;
                    showMenu();
                    if (got > 0) {
                        game.warningText = `已结算 ${got} 灵魂碎片`;
                        game.warningTimer = 1.5;
                    }
                });
            }
            // ===== 暂停面板：重新开始本局（结算后直接重开） =====
            if (pauseRestartBtn) {
                pauseRestartBtn.addEventListener('click', () => {
                    if (game.state !== 'playing') return;
                    const got = settleShards();
                    dbg.pauseGame = false;
                    btnPause.innerHTML = ICONS.pause;
                    const dbgPauseEl = $inp('dbg-pause'); if (dbgPauseEl) dbgPauseEl.checked = false;
                    initGame();
                    lastTime = performance.now(); accumulator = 0;
                    if (got > 0) {
                        game.warningText = `已结算 ${got} 灵魂碎片`;
                        game.warningTimer = 1.5;
                    }
                });
            }
            // ===== 死神之指购买弹窗 =====
            if (dmBuyModal) {
                dmBuyCancel.addEventListener('click', () => { dmBuyModal.style.display = 'none'; });
                dmBuyConfirm.addEventListener('click', () => {
                    if (buyRelic('relic_deathmark')) {
                        dmBuyModal.style.display = 'none';
                        renderMetaPanel();
                        menuShards.textContent = `灵魂碎片：${metaData.shards || 0}`;
                        game.warningText = '已解锁死神之指！';
                        game.warningTimer = 1.5;
                        sound.play('levelup');
                    }
                });
            }
