            // ==================== 精英波次 & 宝箱 ====================
            const WAVE_INTERVAL = 100;
            const WAVE_INTERVAL_AFTER = 50;
            const WAVE_ELITE_COUNT = 12;
            const WAVE_NOTICE_TIME = 10;

            // ===== 世界内环形采样：以玩家为中心、固定距离生成（与屏幕大小无关，大小屏难度一致） =====
            function pickWorldSpot(minR, maxR) {
                const p = game.player;
                if (!p) return { x: WORLD_W / 2, y: WORLD_H / 2 };
                for (let i = 0; i < 12; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const r = minR + Math.random() * (maxR - minR);
                    const x = clamp(p.x + Math.cos(ang) * r, 40, WORLD_W - 40);
                    const y = clamp(p.y + Math.sin(ang) * r, 40, WORLD_H - 40);
                    if (Math.hypot(x - p.x, y - p.y) >= minR * 0.5) return { x, y };
                }
                // 重采样不足（玩家贴世界角落）：朝世界中心方向取保底距离点
                const dx = WORLD_W / 2 - p.x, dy = WORLD_H / 2 - p.y;
                const dd = Math.hypot(dx, dy) || 1;
                return {
                    x: clamp(p.x + dx / dd * minR * 0.6, 40, WORLD_W - 40),
                    y: clamp(p.y + dy / dd * minR * 0.6, 40, WORLD_H - 40)
                };
            }

            function startEliteWave() {
                game.waveState = 'warning';
                game.waveTimer = WAVE_NOTICE_TIME;
                game.waveNoticeTimer = WAVE_NOTICE_TIME;
                sound.play('bossWarn');
                triggerShake(6, 0.4);
            }

            function spawnWaveElites() {
                game.waveState = 'active';
                game.waveEliteLeft = WAVE_ELITE_COUNT;
                const spawnBatch = () => {
                    if (game.waveState !== 'active' || game.waveEliteLeft <= 0) return;
                    if (game.enemies.length >= MAX_ENEMIES) {
                        // 场上满怪：稍后重试，避免波次卡死
                        setTimeout(spawnBatch, 500);
                        return;
                    }
                    const count = Math.min(4, game.waveEliteLeft);
                    for (let i = 0; i < count; i++) {
                        // 精英从玩家周围环形带空降（远离视口边缘，避免小屏贴脸）
                        const spot = pickWorldSpot(650, 850);
                        let x = spot.x, y = spot.y;
                        // 精英：较高血量/伤害/速度的变体（随机类型），强化属性 + 自愈
                        const types = ['zombie', 'runner', 'brute', 'wraith', 'pyromancer'];
                        const typeKey = types[randInt(0, types.length - 1)];
                        const e = new Enemy(x, y, typeKey, game.difficultyLevel + 1);
                        e.hp = Math.floor(e.hp * 2.2); e.maxHp = e.hp;
                        e.damage = Math.floor(e.damage * 1.8);
                        // 突袭者（疾行者）限速：精英速度加成从 1.25 降为 1.05
                        e.speed = e.speed * (typeKey === 'runner' ? 1.05 : 1.25);
                        e.size = e.size * 1.3;
                        e.isElite = true;
                        e.eliteRegen = 0.005;
                        game.enemies.push(e);
                        game.waveEliteLeft--;
                    }
                    // 分批生成（0.4s 一批）
                    if (game.waveEliteLeft > 0) setTimeout(spawnBatch, 400);
                };
                spawnBatch();
            }

            function spawnChest() {
                // 宝箱空投在玩家附近（可及范围）
                const spot = pickWorldSpot(380, 600);
                const cx = spot.x, cy = spot.y;
                game.chests.push({ x: cx, y: cy, life: 30, bob: rand(0, Math.PI * 2) });
                game.waveState = 'reward';
                game.warningText = '精英波次已清除！宝箱已空投';
                game.warningTimer = 2.0;
                spawnParticles(cx, cy, 30, '#ffd700', 120, 0.7, 5);
                sound.play('levelup');
            }

            function openChest(chest) {
                const p = game.player;
                const roll = randInt(0, 3);
                if (roll === 0) {
                    p.hp = p.maxHp;
                    p.maxHp += 20;
                    p.hp = p.maxHp;
                    game.warningText = '宝箱：生命全满并提升上限！';
                    spawnParticles(p.x, p.y, 25, '#55ff88', 90, 0.6, 5);
                } else if (roll === 1) {
                    // 宝箱灵魂护盾：40 点护盾量，15 秒自动恢复；已有护盾则叠加
                    if (!p.soulShield) {
                        p.soulShield = true;
                        p.soulShieldMax = 40;
                        p.soulShieldRegenTime = 15;
                        p.soulShieldAmount = 40;
                    } else {
                        p.soulShieldMax = (p.soulShieldMax || 40) + 40;
                        p.soulShieldAmount = Math.min(p.soulShieldMax, (p.soulShieldAmount || 0) + 40);
                        if (!p.soulShieldRegenTime) p.soulShieldRegenTime = 15;
                    }
                    game.warningText = '宝箱：获得灵魂护盾（40点）！';
                    spawnParticles(p.x, p.y, 25, '#88ccff', 90, 0.6, 5);
                } else if (roll === 2) {
                    p.burstTimer = 8;
                    game.warningText = '宝箱：攻速/移速爆发（8秒）！';
                    spawnParticles(p.x, p.y, 25, '#ffaa00', 90, 0.6, 5);
                } else {
                    p.addXp(p.xpToNext);
                    game.warningText = '宝箱：经验书！（+一管经验）';
                    spawnParticles(p.x, p.y, 25, '#ffd700', 90, 0.6, 5);
                }
                game.warningTimer = 1.8;
                sound.play('bossDrop');
            }

            // ==================== 祭坛 / 传送门（地图事件） ====================
            function spawnAltar() {
                const types = ['heal', 'risk', 'portal'];
                const type = types[randInt(0, types.length - 1)];
                const spot = pickWorldSpot(380, 600);
                game.altars.push({
                    type: type,
                    x: spot.x,
                    y: spot.y,
                    life: 20,
                    pulse: rand(0, Math.PI * 2)
                });
                game.warningText = '地图事件降临！触碰祭坛触发效果';
                game.warningTimer = 1.6;
                sound.play('bossWarn');
            }

            function activateAltar(a) {
                const p = game.player;
                if (a.type === 'heal') {
                    // 血包：纯增益，回复 50% 生命（无负面作用）
                    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
                    game.warningText = '治疗祭坛：回复 50% 生命！';
                    spawnParticles(p.x, p.y, 30, '#55ff88', 110, 0.6, 5);
                    spawnFx(p.x, p.y, 10, '#ffffff', { shape: 'cross', glow: true, speed: 60, life: 0.5, size: 4, rotSpeed: 4 });
                    sound.play('levelup');
                } else if (a.type === 'risk') {
                    // 风险换输出：生命降低 50%（至少保留 1 点），伤害 +50%（30 秒）
                    p.hp = Math.max(1, Math.floor(p.hp * 0.5));
                    p.riskBuffTimer = 30;
                    game.warningText = '风险祭坛：生命降低 50%！伤害 +50%（30秒）';
                    spawnParticles(p.x, p.y, 30, '#ff2222', 120, 0.6, 5);
                    sound.play('playerHit');
                } else {
                    // 传送门：传送到地图另一侧，原地留下更大减速区域，并获得短暂爆发与无敌
                    const oldX = p.x, oldY = p.y;
                    p.x = clamp(WORLD_W - p.x, p.size, WORLD_W - p.size);
                    p.y = clamp(WORLD_H - p.y, p.size, WORLD_H - p.size);
                    game.fireZones.push({ x: oldX, y: oldY, radius: 120, damage: 0, remaining: 8, tickRate: 0.5, tickTimer: 0, isSlowZone: true });
                    p.burstTimer = Math.max(p.burstTimer || 0, 6);
                    p.invincibleTimer = Math.max(p.invincibleTimer || 0, 2);
                    game.warningText = '传送门：已传送至另一侧！留减速区并获得爆发增益';
                    spawnParticles(oldX, oldY, 25, '#88aaff', 130, 0.6, 5);
                    spawnParticles(p.x, p.y, 25, '#88aaff', 130, 0.6, 5);
                    spawnFx(p.x, p.y, 12, '#ffffff', { shape: 'star', glow: true, speed: 120, life: 0.6, size: 5 });
                    triggerShake(5, 0.25);
                }
                game.warningTimer = 1.8;
            }

            function spawnEnemy() {
                if (game.enemies.length >= MAX_ENEMIES) { game.spawnTimer = 1; return; }
                // 以玩家为中心环形带生成（固定距离，与屏幕大小无关）
                const spot = pickWorldSpot(650, 800);
                let x = spot.x, y = spot.y;
                let typeKey = 'zombie';
                const t = game.time;
                if (t > 20 && Math.random() < 0.25) typeKey = 'runner';
                if (t > 40 && Math.random() < 0.2) typeKey = 'brute';
                if (t > 35 && Math.random() < 0.18) typeKey = 'wraith';
                if (t > 45 && Math.random() < 0.20) typeKey = 'pyromancer';
                if (t > 80 && Math.random() < 0.3) typeKey = 'runner';
                if (t > 100 && Math.random() < 0.15) typeKey = 'brute';
                const diffBonus = game.difficultyLevel - 1;
                const ne = new Enemy(x, y, typeKey, diffBonus);
                // ===== 词缀系统（默认仅不可能模式，普通小怪 25% 概率携带一条；debug 可覆盖概率/难度限制） =====
                const affixAllowed = dbg.affixAnywhere ? true : game.selectedDifficulty === 'impossible';
                const affixChance = (dbg.affixChance !== undefined && dbg.affixChance !== null) ? dbg.affixChance : 0.5;
                if (affixAllowed && !ne.isBoss && Math.random() < affixChance) {
                    const AFFIXES = [
                        { name: '迅捷', color: '#55ddff', apply: (e) => { e.speed *= 1.35; } },
                        { name: '坚韧', color: '#dddddd', apply: (e) => { e.hp = Math.floor(e.hp * 1.6); e.maxHp = e.hp; } },
                        { name: '爆裂', color: '#ff8833', apply: (e) => { e.affixBurst = true; } },
                        { name: '灼热', color: '#ff4444', apply: (e) => { e.affixBurn = true; } },
                        { name: '嗜血', color: '#55cc66', apply: (e) => { e.affixLeech = true; } }
                    ];
                    const af = AFFIXES[randInt(0, AFFIXES.length - 1)];
                    af.apply(ne);
                    ne.affixName = af.name;
                    ne.affixColor = af.color;
                }
                game.enemies.push(ne);
            }

            function spawnBoss() {
                if (game.bossOnField) return;
                if (game.enemies.length >= MAX_ENEMIES) { game.bossTimer = 10; return; }
                // Boss 在更远的环形带降临（预警更充分）
                const spot = pickWorldSpot(750, 900);
                let x = spot.x, y = spot.y;
                game.bossAppearedCount++;
                const diffBonus = game.difficultyLevel - 1;
                // 炼狱/不可能模式特供：熔岩巨兽固定 40% 出场率，其余三 Boss 平分剩余 60%
                const selDiff = DIFFICULTIES[game.selectedDifficulty] ? game.selectedDifficulty : 'normal';
                let bossType;
                if ((selDiff === 'hell' || selDiff === 'impossible') && Math.random() < 0.4) {
                    bossType = 'lavabeast';
                } else {
                    const bossTypes = ['boss', 'broodmother', 'assassin'];
                    bossType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
                }
                const boss = new Enemy(x, y, bossType, diffBonus);
                game.enemies.push(boss);
                game.bossOnField = true;
                game.warningText = ENEMY_TYPES[bossType].name + ' 降临！';
                game.warningTimer = 2.0;
                sound.play('bossWarn');
                triggerShake(8, 0.5);
                spawnParticles(x, y, 30, '#ff0000', 80, 0.8, 5);
                spawnParticles(x, y, 20, '#ffffff', 120, 0.5, 4);
                spawnFx(x, y, 16, '#ff4444', { shape: 'star', glow: true, speed: 150, life: 0.7, size: 6 });
                spawnFx(x, y, 20, '#7a7a7a', { speed: 70, life: 0.9, size: 7, gravity: 140, drag: 1.5 });
                game.flashWhite = 0.28;
                // 熔岩巨兽专属降临特效（熔岩色）
                if (bossType === 'lavabeast') {
                    spawnParticles(x, y, 26, '#ff7722', 130, 0.8, 6);
                    spawnFx(x, y, 18, '#ffaa33', { shape: 'star', glow: true, speed: 160, life: 0.7, size: 6 });
                    game.rings.push({ x: x, y: y, r: 10, maxR: 260, life: 0.5, maxLife: 0.5, color: '#ff8833', width: 7 });
                }
                game.rings.push({ x: x, y: y, r: 12, maxR: 300, life: 0.55, maxLife: 0.55, color: '#ff4444', width: 7 });
                game.rings.push({ x: x, y: y, r: 6, maxR: 220, life: 0.4, maxLife: 0.4, color: '#ffffff', width: 3 });
            }

            // ==================== 超级Boss：暗黑镜像 ====================
            function spawnSuperBoss() {
                if (game.superBossSpawned || game.bossOnField) return;
                game.superBossSpawned = true;
                // 与普通 Boss 同距离环形带降临
                const spot = pickWorldSpot(750, 900);
                let x = spot.x, y = spot.y;
                const diffBonus = game.difficultyLevel - 1;
                const boss = new Enemy(x, y, 'assassin', diffBonus);
                boss.isSuperBoss = true;
                boss.hp = Math.floor(boss.hp * 2.2); boss.maxHp = boss.hp;
                boss.damage = Math.floor(boss.damage * 1.3);
                boss.speed = boss.speed * 0.9;
                game.enemies.push(boss);
                game.bossOnField = true;
                game.warningText = '暗黑镜像 降临！它将复制你的武器！';
                game.warningTimer = 2.5;
                sound.play('bossWarn');
                triggerShake(12, 0.7);
                spawnParticles(x, y, 40, '#ff00ff', 100, 0.8, 6);
                spawnFx(x, y, 20, '#ff55ff', { shape: 'star', glow: true, speed: 170, life: 0.8, size: 7 });
                spawnFx(x, y, 24, '#5a2a7a', { speed: 80, life: 1.0, size: 8, gravity: 150, drag: 1.4 });
                game.flashWhite = 0.32;
                game.rings.push({ x: x, y: y, r: 14, maxR: 340, life: 0.6, maxLife: 0.6, color: '#ff55ff', width: 8 });
                game.rings.push({ x: x, y: y, r: 8, maxR: 250, life: 0.45, maxLife: 0.45, color: '#ffffff', width: 3 });
            }
