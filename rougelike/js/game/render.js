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

