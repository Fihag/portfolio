            // ==================== 输入管理 ====================
            const keys = {};
            let mousePos = { x: W / 2, y: H / 2 };
            let useTouchControl = false;
            // 虚拟摇杆（任意位置触摸激活移动摇杆；手动死神之指改为直接点按敌人标记）
            const joystick = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
            const JOYSTICK_R = 55;

            window.addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return; keys[e.key.toLowerCase()] = true; e.preventDefault(); });
            window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; e.preventDefault(); });
            canvas.addEventListener('mousemove', e => {
                const rect = canvas.getBoundingClientRect();
                mousePos.x = e.clientX - rect.left;
                mousePos.y = e.clientY - rect.top;
            });
            canvas.addEventListener('mousedown', e => {
                if (!game.deathMark.enabled || game.deathMark.mode !== 'manual') return;
                if (game.state !== 'playing') return;
                const rect = canvas.getBoundingClientRect();
                const gx = e.clientX - rect.left + cam.x;
                const gy = e.clientY - rect.top + cam.y;
                if (dmTrySelectAt(gx, gy)) {
                    sound.play('bossWarn');
                    game.warningText = '已标记目标！抹杀倒计时…';
                    game.warningTimer = 1.2;
                }
            });
            canvas.addEventListener('touchstart', e => {
                e.preventDefault();
                useTouchControl = true;
                document.body.classList.add('touch-mode');
                const rect = canvas.getBoundingClientRect();
                for (const t of e.changedTouches) {
                    const tx = t.clientX - rect.left, ty = t.clientY - rect.top;
                    // 升级状态：点按选择升级卡
                    if (game.state === 'levelup') { handleLevelupTouch(e); continue; }
                    // 死神之指手动模式：指头直接落在敌人身上时标记，否则该触点作为摇杆
                    if (game.state === 'playing' && game.deathMark.enabled && game.deathMark.mode === 'manual') {
                        if (dmTrySelectAt(tx + cam.x, ty + cam.y)) {
                            sound.play('bossWarn');
                            game.warningText = '已标记目标！抹杀倒计时…';
                            game.warningTimer = 1.2;
                            continue;
                        }
                    }
                    // 任意位置：激活虚拟摇杆（贴边时收敛，避免摇杆画到屏幕外）
                    if (game.state === 'playing' && !joystick.active) {
                        joystick.active = true;
                        joystick.id = t.identifier;
                        joystick.baseX = clamp(tx, JOYSTICK_R, Math.max(JOYSTICK_R, rect.width - JOYSTICK_R));
                        joystick.baseY = clamp(ty, JOYSTICK_R, Math.max(JOYSTICK_R, rect.height - JOYSTICK_R));
                        joystick.dx = 0; joystick.dy = 0;
                    }
                }
            }, { passive: false });
            canvas.addEventListener('touchmove', e => {
                e.preventDefault();
                if (!joystick.active) return;
                const rect = canvas.getBoundingClientRect();
                for (const t of e.changedTouches) {
                    if (t.identifier !== joystick.id) continue;
                    const tx = t.clientX - rect.left, ty = t.clientY - rect.top;
                    let dx = tx - joystick.baseX, dy = ty - joystick.baseY;
                    const mag = Math.hypot(dx, dy);
                    if (mag > JOYSTICK_R) { dx = dx / mag * JOYSTICK_R; dy = dy / mag * JOYSTICK_R; }
                    joystick.dx = dx; joystick.dy = dy;
                }
            }, { passive: false });
            function joystickRelease(e) {
                e.preventDefault();
                for (const t of e.changedTouches) {
                    if (t.identifier === joystick.id) {
                        joystick.active = false;
                        joystick.id = null;
                        joystick.dx = 0; joystick.dy = 0;
                    }
                }
            }
            canvas.addEventListener('touchend', joystickRelease, { passive: false });
            canvas.addEventListener('touchcancel', joystickRelease, { passive: false });

            window.addEventListener('keydown', function selectHandler(e) {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
                const key = e.key;
                if (game.state === 'levelup') {
                    if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5') {
                        const idx = parseInt(key) - 1;
                        if (game.currentChoices && game.currentChoices[idx] !== undefined) {
                            game.applyUpgrade(game.currentChoices[idx]);
                        }
                    }
                } else if (game.state === 'bossdrop') {
                    if (key === '1' || key === '2' || key === '3') {
                        const idx = parseInt(key) - 1;
                        if (game.bossDropChoices && game.bossDropChoices[idx] !== undefined) {
                            applyBossDrop(game.bossDropChoices[idx]);
                        }
                    }
                }
            });

            function handleLevelupClick(e) {
                if (game.state !== 'levelup') return;
                const rect = canvas.getBoundingClientRect();
                const cx = e.clientX - rect.left;
                const cy = e.clientY - rect.top;
                checkCardHit(cx, cy);
            }

            function handleLevelupTouch(e) {
                if (game.state !== 'levelup') return;
                const t = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                const cx = t.clientX - rect.left;
                const cy = t.clientY - rect.top;
                checkCardHit(cx, cy);
            }

            function checkCardHit(cx, cy) {
                const wrapperRect = wrapper.getBoundingClientRect();
                const cardsEl = levelupCards.children;
                for (let i = 0; i < cardsEl.length; i++) {
                    const cardRect = cardsEl[i].getBoundingClientRect();
                    if (cx >= cardRect.left - wrapperRect.left &&
                        cx <= cardRect.right - wrapperRect.left &&
                        cy >= cardRect.top - wrapperRect.top &&
                        cy <= cardRect.bottom - wrapperRect.top) {
                        if (game.currentChoices && game.currentChoices[i] !== undefined) {
                            game.applyUpgrade(game.currentChoices[i]);
                        }
                        return;
                    }
                }
            }
