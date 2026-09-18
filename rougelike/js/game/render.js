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

            // ==================== 月之领域：异空间背景（蓝紫深空 + 黑洞环绕 + 透明地板 + 符文边界） ====================
            function drawBlackHole(ctx, x, y, r, spin, phase2) {
                const col = phase2 ? '255,130,220' : '150,180,255';
                // 吸积盘弧线（三圈椭圆，转速错开）
                for (let k = 0; k < 3; k++) {
                    ctx.strokeStyle = `rgba(${col},${0.5 - k * 0.12})`;
                    ctx.lineWidth = 3 - k * 0.6;
                    ctx.beginPath();
                    ctx.ellipse(x, y, r * (1.35 + k * 0.28), r * (0.5 + k * 0.1), spin * (0.5 + k * 0.3) + k, 0, Math.PI * 2);
                    ctx.stroke();
                }
                // 暗核（黑心 + 相对论辉光边缘）：渐变以 (0,0) 为心缓存，translate 放置
                ctx.save(); ctx.translate(x, y);
                const g = cachedRadial('bh' + (phase2 ? '2' : '1'), 0, r, [
                    [0, '#000006'], [0.62, '#0a0618'],
                    [0.82, phase2 ? 'rgba(190,70,200,0.55)' : 'rgba(90,110,220,0.5)'],
                    [1, 'rgba(60,40,140,0)'],
                ]);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }

            function drawMoonDomain(ctx, dom) {
                const vx0 = cam.x, vy0 = cam.y;
                // 深空底改在 draw() 的 shake 层以屏空间缓存渐变铺满（见 draw 内 moombg），此处只画世界空间内容
                // 星尘（确定性伪随机 + 闪烁）
                for (let i = 0; i < 110; i++) {
                    const sx = vx0 + (((Math.sin(i * 127.1) * 43758.5453) % 1) + 1) % 1 * W;
                    const sy = vy0 + (((Math.sin(i * 311.7) * 12543.853) % 1) + 1) % 1 * H;
                    const tw = 0.3 + Math.abs(Math.sin(game.time * 1.5 + i)) * 0.6;
                    ctx.fillStyle = `rgba(210,220,255,${0.25 * tw})`;
                    ctx.fillRect(sx, sy, 1.6, 1.6);
                }
                // 黑洞：一座悬于领域后方主视觉位，一座绕领域缓行
                const oa = game.time * 0.12;
                drawBlackHole(ctx, dom.x + Math.cos(oa) * (dom.r + 260), dom.y + Math.sin(oa) * (dom.r + 260), 46, game.time * 0.9, dom.phase2);
                drawBlackHole(ctx, dom.x - dom.r * 0.25, dom.y - dom.r * 0.35, 110, game.time * (dom.phase2 ? 1.6 : 1.0), dom.phase2);
                // 透明地板：极淡高光盘（虚空感）——渐变以领域为心缓存，translate 放置
                const fr = Math.ceil(dom.r * 0.98), fr0 = Math.ceil(dom.r * 0.1);
                ctx.save(); ctx.translate(dom.x, dom.y);
                ctx.fillStyle = cachedRadial('moorfloor' + (dom.phase2 ? '2' : '1'), fr0, fr, dom.phase2
                    ? [[0, 'rgba(190,120,255,0.10)'], [0.75, 'rgba(150,80,230,0.05)'], [1, 'rgba(80,60,200,0)']]
                    : [[0, 'rgba(120,140,255,0.08)'], [0.75, 'rgba(90,110,220,0.04)'], [1, 'rgba(80,60,200,0)']]);
                ctx.beginPath(); ctx.arc(0, 0, fr, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
                // 满月收缩环（碾压带 + 安全缺口）
                if (game.moonWaves && game.moonWaves.length) {
                    for (const wv of game.moonWaves) {
                        const wa = wv.warn > 0 ? 0.35 : 0.8;
                        const half = wv.gapW * Math.PI / 180 / 2;
                        ctx.strokeStyle = `rgba(200,190,255,${wa})`; ctx.lineWidth = 26;
                        ctx.beginPath(); ctx.arc(dom.x, dom.y, wv.r, wv.gap + half, wv.gap - half + Math.PI * 2); ctx.stroke();
                        ctx.strokeStyle = `rgba(255,255,255,${wa * 0.5})`; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(dom.x, dom.y, wv.r, wv.gap + half, wv.gap - half + Math.PI * 2); ctx.stroke();
                    }
                }
                // 边界：发光符文双环（外实环 + 旋转虚线环 + 符文节点）
                const bcol = dom.phase2 ? '255,120,210' : '150,170,255';
                ctx.strokeStyle = `rgba(${bcol},0.75)`; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(dom.x, dom.y, dom.r, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = `rgba(${bcol},0.35)`; ctx.lineWidth = 2;
                ctx.setLineDash([14, 10]); ctx.lineDashOffset = -game.time * 30;
                ctx.beginPath(); ctx.arc(dom.x, dom.y, dom.r - 10, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]); ctx.lineDashOffset = 0;
                for (let i = 0; i < 12; i++) {
                    const ra = game.time * 0.2 + Math.PI * 2 / 12 * i;
                    ctx.fillStyle = `rgba(${bcol},0.8)`;
                    ctx.beginPath(); ctx.arc(dom.x + Math.cos(ra) * (dom.r - 20), dom.y + Math.sin(ra) * (dom.r - 20), 3, 0, Math.PI * 2); ctx.fill();
                }
            }

            function draw(ctx) {
                // 每帧从确定的变换开始：重置为像素缩放再清屏/铺底色，避免上一帧残留变换导致清屏错位、顶端出现残影
                ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
                ctx.clearRect(0, 0, W, H);
                ctx.fillStyle = '#2b160c'; ctx.fillRect(0, 0, W, H);
                const shake = getShakeOffset();
                ctx.save(); ctx.translate(shake.x, shake.y);
                // ===== 月之领域深空底：shake 层、镜头平移之前以屏空间铺满（渐变按 H+阶段缓存，每帧零分配） =====
                const moonDom = game.moonDomain;
                if (moonDom && moonDom.active) {
                    const bg = cachedLinear('moombg' + (moonDom.phase2 ? '2' : '1'), 0, 0, 0, Math.ceil(H), moonDom.phase2
                        ? [[0, '#140a2e'], [0.5, '#241040'], [1, '#0d0620']]
                        : [[0, '#0d1233'], [0.5, '#1a1445'], [1, '#0a0825']]);
                    ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
                }
                // ===== 世界空间：镜头平移后绘制世界底色、网格与世界内全部实体（月之领域内整体替换为异空间背景） =====
                ctx.save(); ctx.translate(-cam.x, -cam.y);
                if (moonDom && moonDom.active) {
                    drawMoonDomain(ctx, moonDom);
                } else {
                    ctx.fillStyle = '#2b160c'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
                    ctx.strokeStyle = 'rgba(255,180,120,0.05)'; ctx.lineWidth = 1;
                    // 网格：视口裁剪 + 每方向单次批量 stroke（原为每帧全世界约 87 条独立 stroke）
                    ctx.beginPath();
                    const gx0 = Math.max(40, Math.floor(cam.x / 40) * 40);
                    for (let gx = gx0; gx < WORLD_W && gx <= cam.x + W; gx += 40) { ctx.moveTo(gx, 0); ctx.lineTo(gx, WORLD_H); }
                    const gy0 = Math.max(40, Math.floor(cam.y / 40) * 40);
                    for (let gy = gy0; gy < WORLD_H && gy <= cam.y + H; gy += 40) { ctx.moveTo(0, gy); ctx.lineTo(WORLD_W, gy); }
                    ctx.stroke();
                    // 世界边界提示线
                    ctx.strokeStyle = 'rgba(255,150,80,0.35)'; ctx.lineWidth = 3;
                    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
                }
                for (const orb of game.experienceOrbs) {
                    const floatY = Math.sin(game.time * 3 + orb.floatOffset) * 3;
                    const alpha = orb.life < 3 ? orb.life / 3 : 1;
                    ctx.fillStyle = `rgba(255,215,0,${alpha})`; ctx.beginPath(); ctx.arc(orb.x, orb.y + floatY, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = `rgba(255,255,200,${alpha*0.8})`; ctx.beginPath(); ctx.arc(orb.x, orb.y + floatY, 2.5, 0, Math.PI * 2); ctx.fill();
                }
                // 天罚炮台死亡神罚陨石（预警虚线圈 / 坠落光柱 / 落地火光）
                if (game.divineStrikes && game.divineStrikes.length) {
                    for (const st of game.divineStrikes) {
                        if (st.delay > 0) continue;
                        if (st.phase === 'impact') {
                            const t = clamp(st.impactLife / 0.35, 0, 1);
                            const ir = st.radius * (1.3 - t * 0.3);
                            ctx.fillStyle = `rgba(255,120,40,${t * 0.55})`;
                            ctx.beginPath(); ctx.arc(st.x, st.y, ir, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = `rgba(255,210,90,${t * 0.75})`;
                            ctx.beginPath(); ctx.arc(st.x, st.y, ir * 0.55, 0, Math.PI * 2); ctx.fill();
                        } else if (st.phase === 'fall') {
                            const p = clamp(st.fall / 0.5, 0, 1);
                            const sy = st.y - (1 - p) * 380;
                            ctx.save();
                            ctx.translate(st.x, sy);
                            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
                            grad.addColorStop(0, '#ffff88'); grad.addColorStop(0.4, '#ff6600'); grad.addColorStop(1, 'rgba(255,0,0,0)');
                            ctx.fillStyle = grad;
                            ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
                            ctx.restore();
                            ctx.strokeStyle = 'rgba(255,150,0,0.65)'; ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.moveTo(st.x, sy - 8); ctx.lineTo(st.x, sy - 90); ctx.stroke();
                        } else {
                            const blink = 0.3 + Math.abs(Math.sin(game.time * 12)) * 0.35;
                            ctx.strokeStyle = `rgba(255,90,50,${blink})`; ctx.lineWidth = 2;
                            ctx.setLineDash([6, 6]);
                            ctx.beginPath(); ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2); ctx.stroke();
                            ctx.setLineDash([]);
                        }
                    }
                }
                // 宝箱绘制：金色宝箱 + 发光 + 脉动（辉光渐变缓存，脉动走 globalAlpha）
                for (const ch of game.chests) {
                    const by = ch.y + Math.sin(game.time * 3 + ch.bob) * 3;
                    const pulse = 0.6 + Math.sin(game.time * 6) * 0.2;
                    ctx.save(); ctx.translate(ch.x, by); ctx.globalAlpha = pulse;
                    ctx.fillStyle = cachedRadial('chest', 0, 34, [[0, 'rgba(255,215,0,0.35)'], [1, 'rgba(255,215,0,0)']]);
                    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                    ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.arc(ch.x, by, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#8a5a00';
                    ctx.fillRect(ch.x - 7, by - 4, 14, 5);
                    ctx.fillStyle = '#fff3b0';
                    ctx.fillRect(ch.x - 1.5, by - 7, 3, 10);
                }
                // 祭坛/传送门绘制（辉光渐变按类型色缓存；中心色标保持原实现对不透明色标的解析结果）
                for (const a of game.altars) {
                    const ay = a.y + Math.sin(game.time * 2 + a.pulse) * 3;
                    const colors = { heal: '#55ff88', risk: '#ff4444', portal: '#88aaff' };
                    const col = colors[a.type] || '#ffffff';
                    ctx.save(); ctx.translate(a.x, ay);
                    ctx.fillStyle = cachedRadial('altar' + col, 0, 40, [[0, col], [1, 'rgba(255,255,255,0)']]);
                    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
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
                // 圣光棱镜：贯穿光束（金色辉光柱 + 白芯，随剩余寿命淡出）
                if (game.beams && game.beams.length) {
                    for (const b of game.beams) {
                        const a = clamp(b.life / b.maxLife, 0, 1);
                        ctx.save();
                        ctx.translate(b.x, b.y);
                        ctx.rotate(b.angle);
                        ctx.globalAlpha = 0.14 + a * 0.26;
                        ctx.fillStyle = '#fff3b0';
                        ctx.fillRect(0, -b.width / 2, 1600, b.width);
                        ctx.globalAlpha = 0.5 + a * 0.5;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, -2.2, 1600, 4.4);
                        ctx.restore();
                        ctx.globalAlpha = 1;
                    }
                }
                // 诅咒瘴气：翻涌毒雾团（三团径向渐变旋转 + 呼吸轮廓）
                if (game.clouds && game.clouds.length) {
                    for (const c of game.clouds) {
                        const a = clamp(c.life / c.maxLife, 0, 1);
                        for (let k = 0; k < 3; k++) {
                            const ang = game.time * 2 + (Math.PI * 2 / 3) * k;
                            const ox = Math.cos(ang) * c.radius * 0.25, oy = Math.sin(ang) * c.radius * 0.25;
                            const g = ctx.createRadialGradient(c.x + ox, c.y + oy, 0, c.x + ox, c.y + oy, c.radius * 0.8);
                            g.addColorStop(0, `rgba(90,200,60,${0.16 * a})`);
                            g.addColorStop(1, 'rgba(90,200,60,0)');
                            ctx.fillStyle = g;
                            ctx.beginPath(); ctx.arc(c.x + ox, c.y + oy, c.radius * 0.8, 0, Math.PI * 2); ctx.fill();
                        }
                        ctx.strokeStyle = `rgba(120,220,80,${0.5 * a})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * (0.9 + Math.sin(game.time * 4) * 0.04), 0, Math.PI * 2); ctx.stroke();
                    }
                }
                // 引力奇点：吸附范围淡圈 + 双旋臂吸积环 + 黑核
                if (game.wells && game.wells.length) {
                    for (const wl of game.wells) {
                        const a = clamp(wl.life / wl.maxLife, 0, 1);
                        ctx.fillStyle = `rgba(140,80,220,${0.05 + 0.04 * a})`;
                        ctx.beginPath(); ctx.arc(wl.x, wl.y, wl.radius, 0, Math.PI * 2); ctx.fill();
                        ctx.strokeStyle = `rgba(190,120,255,${0.45 + 0.3 * a})`;
                        ctx.lineWidth = 3;
                        for (let k = 0; k < 2; k++) {
                            ctx.beginPath();
                            ctx.arc(wl.x, wl.y, wl.radius * (0.30 + 0.10 * k), wl.spin + Math.PI * k, wl.spin + Math.PI * k + Math.PI * 1.2);
                            ctx.stroke();
                        }
                        const g = ctx.createRadialGradient(wl.x, wl.y, 0, wl.x, wl.y, 26);
                        g.addColorStop(0, '#0a0410'); g.addColorStop(0.7, '#241038'); g.addColorStop(1, 'rgba(80,40,140,0)');
                        ctx.fillStyle = g;
                        ctx.beginPath(); ctx.arc(wl.x, wl.y, 26, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#e8d5ff';
                        ctx.beginPath(); ctx.arc(wl.x, wl.y, 3, 0, Math.PI * 2); ctx.fill();
                    }
                }
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
                // 拽入演出：屏幕渐暗（坠入月之领域的过程感）
                if (game.moonPullDim > 0) {
                    ctx.fillStyle = `rgba(12,8,34,${clamp(game.moonPullDim, 0, 0.92)})`;
                    ctx.fillRect(0, 0, W, H);
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
                // 低血量警告 vignette（几何按 W/H 缓存，警告强度走 globalAlpha）
                if (game.state === 'playing' && game.player) {
                    const hpRatio = game.player.hp / game.player.maxHp;
                    if (hpRatio < 0.25) {
                        const pulse = 0.5 + Math.sin(game.time * 5) * 0.3;
                        const a = clamp((0.25 - hpRatio) / 0.25 * (0.22 + pulse * 0.12), 0, 0.38);
                        ctx.save(); ctx.translate(W / 2, H / 2); ctx.globalAlpha = a / 0.38;
                        ctx.fillStyle = cachedRadial('vig', Math.round(Math.min(W, H) * 0.32), Math.round(Math.max(W, H) * 0.62),
                            [[0, 'rgba(255,0,0,0)'], [1, 'rgba(255,0,0,0.38)']]);
                        ctx.fillRect(-W / 2, -H / 2, W, H);
                        ctx.restore();
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

