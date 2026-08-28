            // ==================== Debug 模式 ====================
            const dbgToggleBtn = document.getElementById('dbg-toggle');
            const debugPanel = document.getElementById('debug-panel');
            const dbgNum = (id, def = 0) => { const v = parseFloat($inp(id).value); return isFinite(v) ? v : def; };
            const DBG_ENEMY_SPAWNABLE = ['zombie', 'runner', 'brute', 'wraith', 'pyromancer', 'hatchling', 'lavaling'];
            const DBG_BOSS_TYPES = ['boss', 'broodmother', 'assassin', 'lavabeast'];
            const DBG_WEAPON_DEFS = {
                magic_missile:  () => ({ type: 'magic_missile', level: 1, cooldown: 0, cooldownTime: 0.85, cooldownMultiplier: 1, damage: 21, damageMultiplier: 1, projectileSpeed: 350, extraProjectiles: 0, splashRadius: 28, splashDamagePercent: 0.35 }),
                orbit_blade:    () => ({ type: 'orbit_blade', level: 1, bladeCount: 3, radius: 60, rotationSpeed: 3.0, damage: 26, damageMultiplier: 1, angle: 0, hitCooldowns: new Map(), hitCdTime: 0.28 }),
                frost_nova:     () => ({ type: 'frost_nova', level: 1, cooldown: 0, cooldownTime: 2.2, radius: 130, damage: 26, damageMultiplier: 1, slowAmount: 0.50, slowDuration: 2.2 }),
                lightning_chain:() => ({ type: 'lightning_chain', level: 1, cooldown: 0, cooldownTime: 1.0, damage: 20, damageMultiplier: 1, bounceCount: 1, bounceRange: 120, damageFalloff: 0.3, hitCooldowns: new Map(), hitCdTime: 0.3 }),
                meteor:         () => ({ type: 'meteor', level: 1, cooldown: 0, cooldownTime: 5.5, damage: 100, damageMultiplier: 1, radius: 100, doubleChance: 0 }),
                shadow_spirit:  () => ({ type: 'shadow_spirit', level: 1, spiritCount: 2, damage: 15, damageMultiplier: 1, attackSpeed: 1.2625, attackSpeedMultiplier: 1, slowChance: 0, slowAmount: 0.3, slowDuration: 1.5, attackTimer: 0, lockReduction: 0 })
            };
            const DBG_WEAPON_NAMES = { magic_missile: '魔法飞弹', orbit_blade: '环绕飞刃', frost_nova: '冰霜新星', lightning_chain: '闪电链', meteor: '陨石', shadow_spirit: '暗影精灵' };

            function dbgSpawnEnemy(typeKey, count) {
                if (!game.player) return;
                count = Math.min(count, Math.max(0, MAX_ENEMIES - game.enemies.length));
                for (let i = 0; i < count; i++) {
                    const side = randInt(0, 3); let x, y; const margin = 30;
                    if (side === 0) { x = rand(-margin, W + margin); y = -margin; }
                    else if (side === 1) { x = W + margin; y = rand(-margin, H + margin); }
                    else if (side === 2) { x = rand(-margin, W + margin); y = H + margin; }
                    else { x = -margin; y = rand(-margin, H + margin); }
                    game.enemies.push(new Enemy(x, y, typeKey, game.difficultyLevel - 1));
                }
            }
            function dbgSpawnBoss(typeKey) {
                if (!game.player) return;
                if (game.bossOnField) {
                    game.warningText = '场上已有Boss！'; game.warningTimer = 1.2;
                    return;
                }
                const bx = clamp(W / 2 + rand(-100, 100), 60, W - 60);
                const by = 90;
                game.bossAppearedCount++;
                const boss = new Enemy(bx, by, typeKey, game.difficultyLevel - 1);
                game.enemies.push(boss); game.bossOnField = true;
                game.warningText = '[DEBUG] ' + ENEMY_TYPES[typeKey].name + ' 降临！';
                game.warningTimer = 2.0;
                sound.play('bossWarn'); triggerShake(8, 0.5);
                spawnParticles(bx, by, 30, '#ff0000', 80, 0.8, 5);
            }
            function dbgKillAll() {
                if (!game.player) return;
                game.noBossDrop = true;
                for (const e of [...game.enemies]) if (e.alive) e.takeDamage(9999999, 'debug');
                game.noBossDrop = false;
            }
            function dbgClearField() {
                if (!game.player) return;
                for (const e of game.enemies) e.alive = false;
                game.enemies = game.enemies.filter(e => e.alive);
                game.bossOnField = false;
                game.projectiles = [];
                game.fireZones = [];
                game.burningZones = [];
                game.meteorVisuals = [];
                game.chainLightningVisuals = [];
                game.warningText = '[DEBUG] 已清空场上怪物'; game.warningTimer = 1.2;
            }
            function dbgSyncInputs() {
                $inp('dbg-timescale').value = dbg.timeScale;
                $inp('dbg-pause').checked = dbg.pauseGame;
                $inp('dbg-pausespawn').checked = dbg.pauseSpawn;
                $inp('dbg-ehpmult').value = dbg.enemyHpMult;
                $inp('dbg-edmgmult').value = dbg.enemyDmgMult;
                $inp('dbg-espeedmult').value = dbg.enemySpeedMult;
                $inp('dbg-spawninterval').value = game.spawnInterval;
                $inp('dbg-difficulty').value = game.difficultyLevel;
                const p = game.player;
                if (p) {
                    $inp('dbg-level').value = p.level;
                    $inp('dbg-hp').value = Math.floor(p.hp);
                    $inp('dbg-maxhp').value = p.maxHp;
                    $inp('dbg-speed').value = p.speed;
                    $inp('dbg-dmgmult').value = p.globalDamageMultiplier || 1;
                }
                dbgSyncShards();
                dbgRelicPopulate();
                $inp('dbg-affixchance').value = dbg.affixChance !== undefined && dbg.affixChance !== null ? Math.round(dbg.affixChance * 100) : 50;
                $inp('dbg-affixanywhere').checked = !!dbg.affixAnywhere;
                dbgRenderWeapons();
            }
            function dbgApplyPlayer() {
                const p = game.player; if (!p) return;
                if (dbgNum('dbg-level', 1) >= 1) p.level = Math.floor(dbgNum('dbg-level', 1));
                if (dbgNum('dbg-maxhp') > 0) p.maxHp = Math.floor(dbgNum('dbg-maxhp'));
                if (dbgNum('dbg-hp') >= 0) p.hp = Math.min(dbgNum('dbg-hp'), p.maxHp);
                if (dbgNum('dbg-speed') > 0) p.speed = dbgNum('dbg-speed');
                if (dbgNum('dbg-dmgmult') > 0) p.globalDamageMultiplier = dbgNum('dbg-dmgmult');
                game.warningText = '[DEBUG] 玩家属性已更新'; game.warningTimer = 1.2;
            }
            function dbgApplyEnemyMults() {
                dbg.enemyHpMult = Math.max(0.01, dbgNum('dbg-ehpmult', 1));
                dbg.enemyDmgMult = Math.max(0, dbgNum('dbg-edmgmult', 1));
                dbg.enemySpeedMult = Math.max(0, dbgNum('dbg-espeedmult', 1));
                if (dbgNum('dbg-difficulty', 1) >= 1) game.difficultyLevel = Math.floor(dbgNum('dbg-difficulty', 1));
                game.warningText = '[DEBUG] 怪物参数已更新'; game.warningTimer = 1.2;
            }
            const DBG_WEAPON_SKILLS = {
                magic_missile:   ['missile_damage', 'missile_cooldown', 'missile_count'],
                orbit_blade:     ['orbit_count', 'orbit_damage', 'orbit_speed'],
                frost_nova:      ['frost_range', 'frost_damage'],
                lightning_chain: ['chain_bounce', 'chain_range', 'chain_falloff', 'chain_damage'],
                meteor:          ['meteor_cd', 'meteor_range', 'meteor_damage', 'meteor_double'],
                shadow_spirit:   ['shadow_count', 'shadow_speed', 'shadow_damage', 'shadow_slow', 'shadow_lock']
            };
            const DBG_WEAPON_EVO = {
                magic_missile: 'evo_fireball', orbit_blade: 'evo_orbit', frost_nova: 'evo_frost',
                lightning_chain: 'evo_chain', meteor: 'evo_meteor', shadow_spirit: 'evo_shadow'
            };
            function dbgGiveBossDrop() {
                if (!game.player) return;
                                const pool = BOSS_DROP_ITEMS.filter(it => !(it.id === 'soul_shield' && (game.player.soulShieldLevel || 0) >= 2));
                const shuffled = [...pool].sort(() => Math.random() - 0.5);
                game.bossDropChoices = shuffled.slice(0, 3);
                showBossDropPanel(game.bossDropChoices);
            }
            // ===== 碎片调试 =====
            function dbgShardAmt() { return Math.max(0, Math.floor(dbgNum('dbg-shardamt', 0))); }
            function dbgSyncShards() {
                const el = $inp('dbg-shards-now');
                if (el) el.textContent = metaData.shards || 0;
                const m = $inp('menu-shards');
                if (m) m.textContent = `灵魂碎片：${metaData.shards || 0}`;
                const ms = $inp('meta-shards-show');
                if (ms) ms.textContent = `灵魂碎片：${metaData.shards || 0}`;
            }
            function dbgAddShards(n) {
                metaData.shards = Math.max(0, (metaData.shards || 0) + n);
                saveMeta(); dbgSyncShards();
                game.warningText = '[DEBUG] 碎片 +' + n + '（当前 ' + metaData.shards + '）'; game.warningTimer = 1.2;
            }
            function dbgSetShards(n) {
                metaData.shards = Math.max(0, Math.floor(n));
                saveMeta(); dbgSyncShards();
                game.warningText = '[DEBUG] 碎片已设为 ' + metaData.shards; game.warningTimer = 1.2;
            }
            // ===== 圣物调试 =====
            function dbgRelicSel() { return $inp('dbg-relicsel') ? $inp('dbg-relicsel').value : ''; }
            function dbgRelicApply(lv) {
                const id = dbgRelicSel(); const r = META_RELICS.find(x => x.id === id);
                if (!r) return;
                if (!metaData.relics) metaData.relics = {};
                if (!metaData.activeRelics) metaData.activeRelics = {};
                if (lv > 0) { metaData.relics[id] = lv; metaData.activeRelics[id] = true; }
                else { delete metaData.relics[id]; delete metaData.activeRelics[id]; }
                saveMeta(); syncDeathMarkUI(); dbgSyncShards();
                game.warningText = '[DEBUG] ' + r.name + (lv > 0 ? ' 设为 Lv' + lv : ' 已移除'); game.warningTimer = 1.2;
                if (game.state === 'playing' && game.player) {
                    game.warningText += '（下一局生效）'; game.warningTimer = 2.0;
                }
            }
            function dbgRelicPopulate() {
                const sel = $inp('dbg-relicsel'); if (!sel) return;
                sel.innerHTML = '';
                for (const r of META_RELICS) {
                    const opt = document.createElement('option');
                    opt.value = r.id; opt.textContent = r.name + '（Lv' + relicLevel(r.id) + '/' + (r.maxLevel || 1) + '）';
                    sel.appendChild(opt);
                }
            }
            // ===== 词缀调试 =====
            function dbgAffixApply() {
                const v = Math.max(0, Math.min(100, dbgNum('dbg-affixchance', 25)));
                dbg.affixChance = v / 100;
                $inp('dbg-affixchance').value = v;
                game.warningText = '[DEBUG] 词缀概率 ' + v + '%（' + (dbg.affixAnywhere ? '全难度' : '仅不可能模式') + '）'; game.warningTimer = 1.4;
            }
            function dbgTeleport() {
                const p = game.player; if (!p) return;
                p.x = WORLD_W / 2; p.y = WORLD_H / 2;
                game.warningText = '[DEBUG] 已传送到中心'; game.warningTimer = 1.0;
            }
            function dbgAddWeapon(wType) {
                const p = game.player; if (!p) return;
                if (p.weapons.some(w => w.type === wType)) {
                    game.warningText = '已拥有 ' + DBG_WEAPON_NAMES[wType]; game.warningTimer = 1.0; return;
                }
                p.weapons.push(DBG_WEAPON_DEFS[wType]());
                game.warningText = '获得 ' + DBG_WEAPON_NAMES[wType]; game.warningTimer = 1.2;
                dbgRenderWeapons();
            }
            function dbgRemoveWeapon(wType) {
                const p = game.player; if (!p) return;
                const idx = p.weapons.findIndex(w => w.type === wType);
                if (idx < 0) {
                    game.warningText = '没有 ' + DBG_WEAPON_NAMES[wType]; game.warningTimer = 1.0; return;
                }
                p.weapons.splice(idx, 1);
                game.warningText = '移除 ' + DBG_WEAPON_NAMES[wType]; game.warningTimer = 1.0;
                dbgRenderWeapons();
            }
            function dbgMaxEvolveWeapon(wType) {
                const p = game.player; if (!p) return;
                let w = p.weapons.find(w => w.type === wType);
                if (!w) { p.weapons.push(DBG_WEAPON_DEFS[wType]()); w = p.weapons[p.weapons.length - 1]; }
                // 把该武器的全部技能拉到满级（含非进化前置，如导电强化/双重陨石/暗影束缚）
                for (const sid of DBG_WEAPON_SKILLS[wType] || []) {
                    const skill = SKILL_REGISTRY.find(s => s.id === sid);
                    if (!skill) continue;
                    const have = p['_skill_' + sid] || 0;
                    const need = Math.max(skill.maxLevel, have);
                    for (let i = 0; i < need - have; i++) {
                        try { skill.apply(p); } catch (e) { console.warn('dbg skill apply error:', e); }
                    }
                    p['_skill_' + sid] = need;
                }
                // 进化
                const evoId = DBG_WEAPON_EVO[wType];
                if (evoId && !p['_skill_' + evoId]) {
                    const evo = SKILL_REGISTRY.find(s => s.id === evoId);
                    p['_skill_' + evoId] = 1;
                    if (evo) { try { evo.apply(p); } catch (e) { console.warn('dbg evo apply error:', e); } }
                }
                game.warningText = DBG_WEAPON_NAMES[wType] + ' 已满级进化'; game.warningTimer = 1.2;
                dbgRenderWeapons();
            }
            function dbgRenderWeapons() {
                const box = $inp('dbg-weapons'); if (!box) return;
                box.innerHTML = '';
                const p = game.player;
                for (const k of Object.keys(DBG_WEAPON_DEFS)) {
                    const w = p && p.weapons.find(w => w.type === k);
                    const row = document.createElement('div');
                    row.className = 'dbg-row';
                    const name = document.createElement('span');
                    name.className = 'dbg-name';
                    let status = '未拥有';
                    if (w) status = 'Lv' + (w.level || 1) + (w.evolved ? ' 已进化' : '');
                    name.textContent = DBG_WEAPON_NAMES[k] + ' ' + status;
                    row.appendChild(name);
                    const btnAdd = document.createElement('button');
                    btnAdd.textContent = w ? '－' : '＋';
                    btnAdd.title = w ? '移除' : '添加';
                    btnAdd.addEventListener('click', () => w ? dbgRemoveWeapon(k) : dbgAddWeapon(k));
                    row.appendChild(btnAdd);
                    const btnMax = document.createElement('button');
                    btnMax.textContent = '满级进化';
                    btnMax.addEventListener('click', () => dbgMaxEvolveWeapon(k));
                    row.appendChild(btnMax);
                    box.appendChild(row);
                }
            }
            function dbgToggle() {
                dbg.active = !dbg.active;
                debugPanel.style.display = dbg.active ? 'block' : 'none';
                dbgToggleBtn.innerHTML = dbg.active ? ICONS.x : ICONS.wrench;
                if (dbg.active) dbgSyncInputs();
            }
            function dbgInit() {
                for (const k of DBG_ENEMY_SPAWNABLE) {
                    const opt = document.createElement('option');
                    opt.value = k; opt.textContent = ENEMY_TYPES[k].name;
                    $inp('dbg-enemytype').appendChild(opt);
                }
                for (const k of DBG_BOSS_TYPES) {
                    const opt = document.createElement('option');
                    opt.value = k; opt.textContent = ENEMY_TYPES[k].name;
                    $inp('dbg-bosstype').appendChild(opt);
                }
                dbgRenderWeapons();
                $inp('dbg-timescale').addEventListener('input', () => { dbg.timeScale = Math.max(0, dbgNum('dbg-timescale', 1)); });
                $inp('dbg-pause').addEventListener('change', (e) => { dbg.pauseGame = e.target.checked; });
                $inp('dbg-pausespawn').addEventListener('change', (e) => { dbg.pauseSpawn = e.target.checked; });
                $inp('dbg-deathmark').addEventListener('change', (e) => {
                    const on = e.target.checked;
                    game.deathMark.enabled = on;
                    btnDeathMark.style.display = on ? '' : 'none';
                    if (!on) {
                        for (const t of game.deathMark.targets) t.deathMarked = false;
                        game.deathMark.targets = [];
                    } else {
                        game.deathMark.mode = 'auto';
                        btnDeathMark.classList.add('death-auto');
                    }
                    if (game.player) {
                        game.warningText = on ? '[DEBUG] 死神之指已开启' : '[DEBUG] 死神之指已关闭';
                        game.warningTimer = 1.2;
                    }
                });
                $inp('dbg-spawn').addEventListener('click', () => {
                    dbgSpawnEnemy($inp('dbg-enemytype').value, Math.max(1, Math.floor(dbgNum('dbg-enemycount', 1))));
                });
                $inp('dbg-spawnboss').addEventListener('click', () => { dbgSpawnBoss($inp('dbg-bosstype').value); });
                $inp('dbg-setinterval').addEventListener('click', () => {
                    game.spawnInterval = Math.max(0.05, dbgNum('dbg-spawninterval', 1.2));
                    $inp('dbg-spawninterval').value = game.spawnInterval;
                });
                $inp('dbg-applyplayer').addEventListener('click', dbgApplyPlayer);
                $inp('dbg-heal').addEventListener('click', () => { const p = game.player; if (p) p.hp = p.maxHp; });
                $inp('dbg-levelup').addEventListener('click', () => {
                    const p = game.player;
                    if (p && game.state === 'playing') p.addXp(p.xpToNext);
                });
                $inp('dbg-addxp').addEventListener('click', () => {
                    const p = game.player; if (p) p.addXp(Math.max(1, Math.floor(dbgNum('dbg-xpamt', 100))));
                });
                $inp('dbg-applyenemy').addEventListener('click', dbgApplyEnemyMults);
                $inp('dbg-killall').addEventListener('click', dbgKillAll);
                $inp('dbg-clear').addEventListener('click', dbgClearField);
                $inp('dbg-bossdrop').addEventListener('click', dbgGiveBossDrop);
                $inp('dbg-teleport').addEventListener('click', dbgTeleport);
                // 碎片
                $inp('dbg-shard-add').addEventListener('click', () => dbgAddShards(dbgShardAmt()));
                $inp('dbg-shard-set').addEventListener('click', () => dbgSetShards(dbgShardAmt()));
                $inp('dbg-shard-p100').addEventListener('click', () => dbgAddShards(100));
                $inp('dbg-shard-p1000').addEventListener('click', () => dbgAddShards(1000));
                $inp('dbg-shard-zero').addEventListener('click', () => dbgSetShards(0));
                // 圣物
                dbgRelicPopulate();
                $inp('dbg-relic-grant').addEventListener('click', () => dbgRelicApply(1));
                $inp('dbg-relic-up').addEventListener('click', () => {
                    const r = META_RELICS.find(x => x.id === dbgRelicSel()); if (!r) return;
                    dbgRelicApply(Math.min((r.maxLevel || 1), relicLevel(r.id) + 1));
                });
                $inp('dbg-relic-max').addEventListener('click', () => {
                    const r = META_RELICS.find(x => x.id === dbgRelicSel()); if (!r) return;
                    dbgRelicApply(Math.max(1, r.maxLevel || 1));
                });
                $inp('dbg-relic-toggle').addEventListener('click', () => {
                    const id = dbgRelicSel(); const r = META_RELICS.find(x => x.id === id);
                    if (!r || !hasRelic(id)) return;
                    setRelicActive(id, !isRelicActive(id));
                    saveMeta(); syncDeathMarkUI(); dbgRelicPopulate();
                    game.warningText = '[DEBUG] ' + r.name + ' 已' + (isRelicActive(id) ? '穿戴' : '卸下'); game.warningTimer = 1.2;
                });
                $inp('dbg-relic-remove').addEventListener('click', () => dbgRelicApply(0));
                // 词缀
                $inp('dbg-affix-set').addEventListener('click', dbgAffixApply);
                $inp('dbg-affixanywhere').addEventListener('change', (e) => { dbg.affixAnywhere = e.target.checked; });
                dbgToggleBtn.addEventListener('click', dbgToggle);
                $inp('dbg-close').addEventListener('click', dbgToggle);
                window.addEventListener('keydown', (e) => {
                    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
                    if (e.key === 'F1') { e.preventDefault(); dbgToggle(); }
                });
            }