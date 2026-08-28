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
            let menuHintTimer = null;
            function showMenuHint(msg) {
                const mh = $inp('menu-hint');
                if (!mh) return;
                mh.textContent = msg;
                mh.style.color = '#ffd166';
                clearTimeout(menuHintTimer);
                menuHintTimer = setTimeout(() => { mh.textContent = '键鼠 / 触屏均可操作'; mh.style.color = ''; }, 2200);
            }
            if (pauseMenuBtn) {
                pauseMenuBtn.addEventListener('click', () => {
                    if (game.state !== 'playing') return;
                    const got = settleShards();
                    dbg.pauseGame = false;
                    btnPause.innerHTML = ICONS.pause;
                    const dbgPauseEl = $inp('dbg-pause'); if (dbgPauseEl) dbgPauseEl.checked = false;
                    showMenu();
                    // menu 态下 hudWarning 不渲染，结算提示走主菜单 hint 位
                    if (got > 0) showMenuHint('本局已结算 +' + got + ' 灵魂碎片');
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
