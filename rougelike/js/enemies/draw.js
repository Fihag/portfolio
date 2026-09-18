            // ==================== 敌人绘制 ====================

            Enemy.prototype.draw = function(ctx) {
                    const flashOn = this.flashTimer > 0;
                    if (this.isBoss) {
                        // 光环/狂暴渐变缓存：同色同径共用 CanvasGradient，translate 放置（半径整数量化，≤0.5px 偏差）
                        const ar = Math.ceil(this.size * 2), ar0 = Math.ceil(this.size * 1.2);
                        ctx.save(); ctx.translate(this.x, this.y);
                        ctx.fillStyle = cachedRadial('aura' + this.auraColor, ar0, ar, [[0, this.auraColor], [1, 'rgba(80,0,80,0)']]);
                        ctx.beginPath(); ctx.arc(0, 0, ar, 0, Math.PI * 2); ctx.fill();
                        ctx.restore();
                        if (this.typeKey === 'boss' && this.hp / this.maxHp < 0.5) {
                            const rr = Math.ceil(this.size * 2.2), rr0 = Math.ceil(this.size * 1.2);
                            const pulse = (0.35 + Math.sin(game.time * 8) * 0.15) / 0.5;   // 中心 α 以 0.5 烘焙，globalAlpha 还原脉动
                            ctx.save(); ctx.translate(this.x, this.y); ctx.globalAlpha = pulse;
                            ctx.fillStyle = cachedRadial('rage', rr0, rr, [[0, 'rgba(255,40,20,0.5)'], [1, 'rgba(255,40,20,0)']]);
                            ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
                            ctx.restore();
                        }
                        if (this.invincible && this.shieldHp > 0) {
                            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2); ctx.stroke();
                            const barW = this.size * 2.2;
                            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, this.y - this.size - 18, barW, 6);
                            ctx.fillStyle = '#ff00ff'; ctx.fillRect(this.x - barW / 2, this.y - this.size - 18, barW * (this.shieldHp / this.shieldMax), 6);
                        }
                    }
                    const moonHidden = this.typeKey === 'moonwitch' && !this.dying
                        && (this.moonAirborne || (this.moonSlamWarn !== undefined && this.moonSlamWarn > 0)
                            || this.moonIntro === 'descend' || this.moonIntro === 'revive');
                    ctx.fillStyle = flashOn ? '#ffffff' : (moonHidden ? 'rgba(0,0,0,0)' : this.color);
                    ctx.strokeStyle = flashOn ? '#fff' : (moonHidden ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.4)'); ctx.lineWidth = this.isBoss ? 3 : 1.5;
                    ctx.beginPath();
                    if (this.shape === 'circle') ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    else if (this.shape === 'triangle') { const s = this.size; ctx.moveTo(this.x, this.y - s); ctx.lineTo(this.x + s * 0.87, this.y + s * 0.5); ctx.lineTo(this.x - s * 0.87, this.y + s * 0.5); ctx.closePath(); }
                    else if (this.shape === 'square') ctx.rect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
                    ctx.fill(); ctx.stroke();
                    if (this.isElite) {
                        const pulse = 0.5 + Math.sin(game.time * 6) * 0.3;
                        ctx.strokeStyle = `rgba(255,215,0,${pulse + 0.3})`;
                        ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2); ctx.stroke();
                    }
                    // 词缀光环（不可能模式）
                    if (this.affixColor) {
                        ctx.strokeStyle = this.affixColor; ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.stroke();
                    }
                    // ===== 天罚炮台专属视觉 =====
                    if (this.typeKey === 'turret') {
                        const aim = this.turretAim || 0;
                        // 石制基座铆钉
                        ctx.strokeStyle = 'rgba(255,220,150,0.4)'; ctx.lineWidth = 1.5;
                        for (let i = 0; i < 4; i++) {
                            const ca = (Math.PI / 2) * i + Math.PI / 4;
                            ctx.beginPath(); ctx.arc(this.x + Math.cos(ca) * this.size * 0.75, this.y + Math.sin(ca) * this.size * 0.75, 3, 0, Math.PI * 2); ctx.stroke();
                        }
                        // 炮管（指向玩家）
                        ctx.save();
                        ctx.translate(this.x, this.y); ctx.rotate(aim);
                        ctx.fillStyle = '#3a3020'; ctx.strokeStyle = '#ccaa66'; ctx.lineWidth = 2;
                        ctx.fillRect(this.size * 0.4, -6, this.size * 1.1, 12);
                        ctx.strokeRect(this.size * 0.4, -6, this.size * 1.1, 12);
                        ctx.restore();
                        // 核心辉光：蓄力红色脉冲 / 发射炽红 / 平时金色
                        const charging = this.turretLaserState === 'charging';
                        const firing = this.turretLaserState === 'firing';
                        const cp = charging ? 0.6 + Math.sin(game.time * 25) * 0.4 : 0.5 + Math.sin(game.time * 4) * 0.2;
                        const coreG = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.size * 0.75);
                        coreG.addColorStop(0, firing ? 'rgba(255,80,60,0.85)' : charging ? `rgba(255,60,40,${cp})` : `rgba(255,215,120,${cp})`);
                        coreG.addColorStop(1, 'rgba(120,90,30,0)');
                        ctx.fillStyle = coreG; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.75, 0, Math.PI * 2); ctx.fill();
                        // 扫射激光：预警虚线 / 发射光柱
                        if (charging) {
                            ctx.strokeStyle = `rgba(255,60,40,${0.35 + cp * 0.4})`; ctx.lineWidth = 2;
                            ctx.setLineDash([8, 10]);
                            ctx.beginPath(); ctx.moveTo(this.x, this.y);
                            ctx.lineTo(this.x + Math.cos(this.turretLaserAngle) * 1200, this.y + Math.sin(this.turretLaserAngle) * 1200);
                            ctx.stroke(); ctx.setLineDash([]);
                        } else if (firing) {
                            ctx.save();
                            ctx.translate(this.x, this.y); ctx.rotate(this.turretLaserAngle);
                            const fade = clamp(this.turretLaserT / 0.5, 0, 1);
                            ctx.fillStyle = `rgba(255,90,60,${0.35 * fade})`;
                            ctx.fillRect(0, -18, 1200, 36);
                            ctx.fillStyle = `rgba(255,220,200,${0.9 * fade})`;
                            ctx.fillRect(0, -4, 1200, 8);
                            ctx.restore();
                        }
                    }
                    // ===== 幽月魔女专属视觉 =====
                    if (this.typeKey === 'moonwitch') {
                        const p2c = this.moonPhase2;
                        // 降临 / 复活动画：月之魔法阵（旋转双虚线环 + 符文节点）
                        if (this.moonIntro === 'descend' || this.moonIntro === 'revive') {
                            const t0 = clamp(this.moonIntroT / (this.moonIntro === 'revive' ? 2.2 : 2.5), 0, 1);
                            ctx.save();
                            ctx.strokeStyle = `rgba(176,144,255,${0.4 + 0.35 * (1 - t0)})`; ctx.lineWidth = 3;
                            ctx.setLineDash([16, 10]); ctx.lineDashOffset = -game.time * 60;
                            ctx.beginPath(); ctx.arc(this.x, this.y, 120, 0, Math.PI * 2); ctx.stroke();
                            ctx.setLineDash([6, 8]); ctx.lineDashOffset = game.time * 40;
                            ctx.beginPath(); ctx.arc(this.x, this.y, 90, 0, Math.PI * 2); ctx.stroke();
                            ctx.setLineDash([]); ctx.lineDashOffset = 0;
                            for (let i = 0; i < 8; i++) {
                                const ra = game.time * 1.2 + Math.PI / 4 * i;
                                ctx.fillStyle = `rgba(220,205,255,${0.5 + 0.4 * (1 - t0)})`;
                                ctx.beginPath(); ctx.arc(this.x + Math.cos(ra) * 105, this.y + Math.sin(ra) * 105, 3.5, 0, Math.PI * 2); ctx.fill();
                            }
                            ctx.restore();
                            if (this.moonIntro === 'revive') {
                                // 复活：镜片聚拢的重组收缩环
                                const rr = 150 * t0 + 30;
                                ctx.strokeStyle = `rgba(216,228,255,${0.5 + Math.sin(game.time * 10) * 0.2})`; ctx.lineWidth = 2;
                                ctx.beginPath(); ctx.arc(this.x, this.y, rr, 0, Math.PI * 2); ctx.stroke();
                            } else if (t0 < 0.18) {
                                // 降临最后阶段：光柱
                                const pillarA = (0.18 - t0) / 0.18;
                                const pg = ctx.createLinearGradient(this.x, this.y - 480, this.x, this.y);
                                pg.addColorStop(0, 'rgba(176,144,255,0)');
                                pg.addColorStop(1, `rgba(230,215,255,${0.75 * pillarA})`);
                                ctx.fillStyle = pg;
                                ctx.fillRect(this.x - 26, this.y - 480, 52, 480);
                            }
                        }
                        // 拽入演出：传送门环 + 三条月光锁链（含链上流光）
                        if (this.moonIntro === 'pull') {
                            const gateY = this.y - 40;
                            const gp = 0.6 + Math.sin(game.time * 8) * 0.3;
                            ctx.strokeStyle = `rgba(200,180,255,${gp})`; ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.ellipse(this.x, gateY, 60 + Math.sin(game.time * 5) * 8, 20, 0, 0, Math.PI * 2); ctx.stroke();
                            ctx.strokeStyle = `rgba(255,255,255,${gp * 0.6})`; ctx.lineWidth = 1.5;
                            ctx.beginPath(); ctx.ellipse(this.x, gateY, 44, 14, game.time, 0, Math.PI * 2); ctx.stroke();
                            if (game.player && (this.moonIntroState === 'chain' || this.moonIntroState === 'drag')) {
                                const p0 = game.player;
                                for (let k = -1; k <= 1; k++) {
                                    const mx0 = (this.x + p0.x) / 2 + k * 34;
                                    const my0 = (gateY + p0.y) / 2 + 18;
                                    ctx.strokeStyle = `rgba(216,200,255,${0.55 + Math.sin(game.time * 12 + k) * 0.25})`;
                                    ctx.lineWidth = 2.5;
                                    ctx.beginPath();
                                    ctx.moveTo(this.x, gateY);
                                    ctx.quadraticCurveTo(mx0, my0, p0.x, p0.y);
                                    ctx.stroke();
                                    const tt = (game.time * 2 + k * 0.3) % 1;
                                    const qx = (1 - tt) * (1 - tt) * this.x + 2 * (1 - tt) * tt * mx0 + tt * tt * p0.x;
                                    const qy = (1 - tt) * (1 - tt) * gateY + 2 * (1 - tt) * tt * my0 + tt * tt * p0.y;
                                    ctx.fillStyle = '#ffffff';
                                    ctx.beginPath(); ctx.arc(qx, qy, 2.5, 0, Math.PI * 2); ctx.fill();
                                }
                            }
                        }
                        // 升空：地面阴影 + 砸落预警圈 + 月影悬空 + 天际激光
                        if (this.moonAirborne || (this.moonSlamWarn !== undefined && this.moonSlamWarn > 0)) {
                            ctx.fillStyle = 'rgba(20,10,50,0.45)';
                            ctx.beginPath(); ctx.ellipse(this.x, this.y, this.size * (0.9 + Math.sin(game.time * 3) * 0.05), this.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
                            if (this.moonSlamWarn !== undefined && this.moonSlamWarn > 0) {
                                const sw = 0.4 + Math.abs(Math.sin(game.time * 10)) * 0.4;
                                ctx.strokeStyle = `rgba(201,176,255,${sw})`; ctx.lineWidth = 3;
                                ctx.setLineDash([10, 8]);
                                ctx.beginPath(); ctx.arc(this.moonSlamX, this.moonSlamY, 120, 0, Math.PI * 2); ctx.stroke();
                                ctx.setLineDash([]);
                            }
                            if (this.moonAirborne) {
                                const ay = this.y - 110;
                                ctx.save();
                                ctx.globalAlpha = 0.92;
                                ctx.fillStyle = p2c ? '#6a2f86' : '#4a3a8e';
                                ctx.beginPath(); ctx.arc(this.x, ay, this.size * 1.05, 0, Math.PI * 2); ctx.fill();
                                ctx.strokeStyle = 'rgba(230,220,255,0.85)'; ctx.lineWidth = 2.5;
                                ctx.beginPath(); ctx.arc(this.x, ay, this.size * 1.05, 0, Math.PI * 2); ctx.stroke();
                                ctx.restore();
                                if (this.moonLaserState === 'charging') {
                                    ctx.strokeStyle = `rgba(255,70,180,${0.35 + Math.abs(Math.sin(game.time * 14)) * 0.35})`;
                                    ctx.lineWidth = 2;
                                    ctx.setLineDash([8, 10]);
                                    ctx.beginPath(); ctx.moveTo(this.x, ay);
                                    ctx.lineTo(this.x + Math.cos(this.moonLaserAngle) * 900, ay + Math.sin(this.moonLaserAngle) * 900);
                                    ctx.stroke(); ctx.setLineDash([]);
                                } else if (this.moonLaserState === 'firing') {
                                    const fade = clamp(this.moonLaserT / 1.2, 0, 1);
                                    ctx.save();
                                    ctx.translate(this.x, ay); ctx.rotate(this.moonLaserAngle);
                                    ctx.fillStyle = `rgba(230,120,220,${0.32 * fade})`;
                                    ctx.fillRect(0, -14, 900, 28);
                                    ctx.fillStyle = `rgba(255,235,255,${0.85 * fade})`;
                                    ctx.fillRect(0, -3.5, 900, 7);
                                    ctx.restore();
                                }
                            }
                        }
                        // 穿梭：原位镜面残影 + 对称连线
                        if (this.moonBlinkT > 0 && this.moonBlinkFrom) {
                            const bt = clamp(this.moonBlinkT / 0.4, 0, 1);
                            ctx.strokeStyle = `rgba(207,224,255,${bt * 0.7})`; ctx.lineWidth = 2;
                            ctx.setLineDash([6, 6]);
                            ctx.beginPath(); ctx.moveTo(this.moonBlinkFrom.x, this.moonBlinkFrom.y); ctx.lineTo(this.x, this.y); ctx.stroke();
                            ctx.setLineDash([]);
                            ctx.fillStyle = `rgba(207,224,255,${bt * 0.5})`;
                            ctx.beginPath(); ctx.arc(this.moonBlinkFrom.x, this.moonBlinkFrom.y, this.size * 0.8, 0, Math.PI * 2); ctx.fill();
                        }
                        // 月光洗礼预警圈
                        if (this.moonStrikes) {
                            for (const st of this.moonStrikes) {
                                if (st.done) continue;
                                const blink = 0.3 + Math.abs(Math.sin(game.time * 10)) * 0.4;
                                ctx.strokeStyle = `rgba(201,166,255,${blink})`; ctx.lineWidth = 2.5;
                                ctx.setLineDash([8, 8]);
                                ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.stroke();
                                ctx.setLineDash([]);
                                ctx.fillStyle = 'rgba(201,166,255,0.10)';
                                ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
                            }
                        }
                        // 月盾（无敌循环 / 变身 / 穿梭）：月白色或二阶段品红护环
                        if (this.moonShielded && !this.moonIntro) {
                            const shieldR = this.size + 12;
                            ctx.strokeStyle = p2c ? 'rgba(255,140,215,0.9)' : 'rgba(207,224,255,0.9)'; ctx.lineWidth = 3.5;
                            ctx.beginPath(); ctx.arc(this.x, this.y, shieldR, 0, Math.PI * 2); ctx.stroke();
                            ctx.strokeStyle = `rgba(255,255,255,${0.25 + Math.sin(game.time * 5) * 0.15})`; ctx.lineWidth = 1.2;
                            ctx.beginPath(); ctx.arc(this.x, this.y, shieldR + 5, 0, Math.PI * 2); ctx.stroke();
                        }
                        // 破绽期：白色呼吸圈提示可输出
                        if (this.moonPhase2 && !this.moonShielded && !this.moonIntro) {
                            const vp = 0.35 + Math.sin(game.time * 9) * 0.25;
                            ctx.strokeStyle = `rgba(255,255,255,${vp})`; ctx.lineWidth = 2;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 7, 0, Math.PI * 2); ctx.stroke();
                        }
                        // 濒死镜碎：本体裂纹闪烁
                        if (this.dying) {
                            const da = Math.max(0, 0.3 + Math.sin(game.time * 20) * 0.3);
                            ctx.strokeStyle = `rgba(235,240,255,${da})`; ctx.lineWidth = 2;
                            for (let i = 0; i < 6; i++) {
                                const ca = Math.PI / 3 * i + game.time * 0.5;
                                ctx.beginPath();
                                ctx.moveTo(this.x, this.y);
                                ctx.lineTo(this.x + Math.cos(ca) * this.size * 1.3, this.y + Math.sin(ca) * this.size * 1.3);
                                ctx.stroke();
                            }
                        }
                        // 本体月牙纹章 + 环绕小月晶（常态）
                        if (!this.moonAirborne && !this.moonIntro) {
                            const ma = game.time * 0.8;
                            ctx.fillStyle = 'rgba(230,220,255,0.85)';
                            ctx.beginPath();
                            ctx.arc(this.x + Math.cos(ma) * this.size * 0.28, this.y + Math.sin(ma) * this.size * 0.28, this.size * 0.55, 0, Math.PI * 2);
                            ctx.arc(this.x, this.y, this.size * 0.72, 0, Math.PI * 2, true);
                            ctx.fill();
                            for (let i = 0; i < 3; i++) {
                                const oa2 = game.time * 1.6 + Math.PI * 2 / 3 * i;
                                ctx.fillStyle = 'rgba(200,190,255,0.9)';
                                ctx.beginPath(); ctx.arc(this.x + Math.cos(oa2) * (this.size + 9), this.y + Math.sin(oa2) * (this.size + 9), 3, 0, Math.PI * 2); ctx.fill();
                            }
                        }
                    }
                    // ===== 镜月分身视觉：半透明月镜 =====
                    if (this.typeKey === 'moonshade') {
                        ctx.globalAlpha = 0.62;
                        ctx.fillStyle = '#8a7ad0';
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
                        ctx.globalAlpha = 0.9;
                        ctx.strokeStyle = 'rgba(216,228,255,0.9)'; ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.stroke();
                        ctx.fillStyle = 'rgba(235,230,255,0.9)';
                        ctx.beginPath();
                        ctx.arc(this.x + this.size * 0.2, this.y - this.size * 0.2, this.size * 0.4, 0, Math.PI * 2);
                        ctx.arc(this.x, this.y, this.size * 0.55, 0, Math.PI * 2, true);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                    // ===== 自爆虫：引爆倒计时高频闪烁 =====
                    if (this.typeKey === 'bomber' && this.bomberFuse !== undefined) {
                        const fp = Math.abs(Math.sin(game.time * 35));
                        ctx.strokeStyle = `rgba(255,120,60,${fp + 0.2})`; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.stroke();
                        ctx.fillStyle = `rgba(255,200,120,${fp})`;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2); ctx.fill();
                    }
                    // ===== 精英自爆虫（炮台投放）：亮红光环 =====
                    if (this.eliteBomber) {
                        ctx.strokeStyle = 'rgba(255,60,40,0.8)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    // ===== 咒术师：法力辉光 =====
                    if (this.typeKey === 'warlock') {
                        const wp = 0.5 + Math.sin(game.time * 3) * 0.3;
                        ctx.strokeStyle = `rgba(140,80,220,${wp})`; ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 6, 0, Math.PI * 2); ctx.stroke();
                    }
                    // ===== 熔岩巨兽专属视觉 =====
                    if (this.typeKey === 'lavabeast') {
                        const lp = 0.5 + Math.sin(game.time * 5) * 0.3;
                        // 岩浆裂纹（旋转辐射线）
                        ctx.strokeStyle = `rgba(255,140,40,${0.45 + lp * 0.5})`; ctx.lineWidth = 2;
                        for (let i = 0; i < 5; i++) {
                            const ca = (Math.PI * 2 / 5) * i + game.time * 0.6;
                            ctx.beginPath();
                            ctx.moveTo(this.x, this.y);
                            ctx.lineTo(this.x + Math.cos(ca) * this.size * 0.85, this.y + Math.sin(ca) * this.size * 0.85);
                            ctx.stroke();
                        }
                        // 熔核辉光
                        const coreG = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.size * 0.7);
                        coreG.addColorStop(0, `rgba(255,200,80,${0.5 + lp * 0.4})`);
                        coreG.addColorStop(1, 'rgba(255,120,30,0)');
                        ctx.fillStyle = coreG; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2); ctx.fill();
                        // 熔火硬化石壳
                        if (this.hardened > 0) {
                            ctx.strokeStyle = 'rgba(165,165,175,0.95)'; ctx.lineWidth = 5;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 2, 0, Math.PI * 2); ctx.stroke();
                        }
                        // 濒死爆燃闪烁
                        if (this.dying) {
                            const da = Math.max(0, 0.35 + Math.sin(game.time * 22) * 0.3);
                            ctx.fillStyle = `rgba(255,240,180,${da})`;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (1.2 + Math.sin(game.time * 14) * 0.12), 0, Math.PI * 2); ctx.fill();
                        }
                        // 炽热冲锋：预警方向线 / 冲撞高亮
                        if (this.lavaChargeState === 'warn') {
                            const cw = 0.5 + Math.sin(game.time * 16) * 0.35;
                            ctx.strokeStyle = `rgba(255,60,30,${cw + 0.3})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.moveTo(this.x, this.y);
                            ctx.lineTo(this.x + this.lavaChargeDx * 420, this.y + this.lavaChargeDy * 420); ctx.stroke();
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2); ctx.stroke();
                        }
                        if (this.lavaChargeState === 'dash') {
                            ctx.globalAlpha = 0.45;
                            ctx.fillStyle = '#ffcc66';
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 1.15, 0, Math.PI * 2); ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                        // 震地跃击：滞空半透明+落点预警圈
                        if (this.leaping) {
                            const lw = 0.5 + Math.sin(game.time * 14) * 0.3;
                            ctx.strokeStyle = `rgba(255,100,40,${lw + 0.25})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(this.leapWarnX, this.leapWarnY, 95, 0, Math.PI * 2); ctx.stroke();
                            ctx.globalAlpha = 0.55;
                            ctx.fillStyle = this.color;
                            ctx.beginPath(); ctx.arc(this.x, this.y - 14, this.size, 0, Math.PI * 2); ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                    }
                    if (this.isGhost) { ctx.fillStyle = 'rgba(200,200,255,0.3)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.fill(); }
                    if (this.slowTimer > 0) { ctx.fillStyle = 'rgba(150,200,255,0.5)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2); ctx.fill(); }
                    if (this.freezeTimer > 0) {
                        ctx.fillStyle = 'rgba(130,220,255,0.5)';
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        for (let i = 0; i < 4; i++) {
                            const fx = this.x + Math.cos(i * Math.PI / 2 + game.time * 3) * (this.size + 2);
                            const fy = this.y + Math.sin(i * Math.PI / 2 + game.time * 3) * (this.size + 2);
                            ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
                        }
                    }
                    if (this.typeKey === 'broodmother') {
                        ctx.strokeStyle = 'rgba(150,220,120,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                        for (let i = 0; i < 4; i++) {
                            const ea = game.time * 0.8 + i * Math.PI / 2;
                            const ex = this.x + Math.cos(ea) * (this.size + 6);
                            const ey = this.y + Math.sin(ea) * (this.size + 6);
                            ctx.fillStyle = 'rgba(230,255,220,0.9)';
                            ctx.beginPath(); ctx.ellipse(ex, ey, 3, 4.5, ea, 0, Math.PI * 2); ctx.fill();
                        }
                        if (this.summonType && this.summonTimer < 0.5 && !this.invincible) {
                            const pulse = 0.5 + Math.sin(game.time * 18) * 0.5;
                            ctx.strokeStyle = `rgba(160,255,120,${0.4 + pulse * 0.5})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 12 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
                        }
                    }
                    if (this.typeKey === 'assassin') {
                        // 角色特征：旋转暗影刀锋环 + 暗影波动
                        const spin = game.time * 2.2;
                        const pr2 = this.size + 16 + Math.sin(game.time * 5) * 2;
                        for (let k = 0; k < 3; k++) {
                            const ba = spin + k * Math.PI * 2 / 3;
                            const bx = this.x + Math.cos(ba) * pr2;
                            const by = this.y + Math.sin(ba) * pr2;
                            ctx.save();
                            ctx.translate(bx, by);
                            ctx.rotate(ba + Math.PI / 2);
                            ctx.fillStyle = 'rgba(200,160,255,0.85)';
                            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(3, 6); ctx.lineTo(-3, 6); ctx.closePath();
                            ctx.fill(); ctx.stroke();
                            ctx.restore();
                        }
                        const wv = 0.4 + Math.sin(game.time * 4) * 0.2;
                        ctx.strokeStyle = `rgba(120,60,190,${wv})`; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 22 + Math.sin(game.time * 3) * 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    if (this.typeKey === 'assassin' && this.teleporting) {
                        const progress = this.teleportProgress / this.teleportCharge;
                        const pulse = 0.6 + Math.sin(game.time * 20) * 0.4;
                        ctx.strokeStyle = `rgba(176,106,255,${0.5 + progress * 0.5})`; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 12 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
                        // 降落方位警示标记（落点圈 + 朝下箭头 + 外扩环）
                        if (this.teleportTX !== undefined && this.teleportTY !== undefined) {
                            const tx = this.teleportTX, ty = this.teleportTY;
                            const pp = 0.5 + Math.sin(game.time * 16) * 0.3;
                            ctx.strokeStyle = `rgba(255,70,255,${0.30 + progress * 0.5})`;
                            ctx.lineWidth = 2 + progress * 1.5;
                            ctx.setLineDash([5, 5]);
                            ctx.beginPath(); ctx.arc(tx, ty, 20, 0, Math.PI * 2); ctx.stroke();
                            ctx.setLineDash([]);
                            ctx.fillStyle = `rgba(255,120,255,${0.6 + pp * 0.4})`;
                            ctx.beginPath(); ctx.moveTo(tx, ty - 10); ctx.lineTo(tx + 9, ty + 6); ctx.lineTo(tx - 9, ty + 6); ctx.closePath(); ctx.fill();
                            ctx.fillStyle = 'rgba(255,255,255,0.9)';
                            ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = `rgba(255,120,255,${0.25 * (1 - progress)})`;
                            ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(tx, ty, 24 + progress * 10, 0, Math.PI * 2); ctx.stroke();
                        }
                    }
                    if (this.isBoss && this.charging) {
                        const progress = this.chargeProgress / this.chargeTime;
                        ctx.strokeStyle = `rgba(255,0,0,${0.5+progress*0.5})`; ctx.lineWidth = 3;
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 12, -Math.PI/2, -Math.PI/2 + Math.PI*2*progress); ctx.stroke();
                    }
                    // 冲击波绘制
                    if (this.isBoss && this.shockwaveActive) {
                        const r = this.shockwaveRadius;
                        const alpha = 1 - r / this.shockwaveMaxRadius;
                        ctx.strokeStyle = `rgba(255, 80, 0, ${alpha * 0.8})`; ctx.lineWidth = 6;
                        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
                        ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.4})`; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
                        // 内圈安全区标记
                        ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.3})`; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.shockwaveInnerSafe, 0, Math.PI * 2); ctx.stroke();
                        ctx.setLineDash([]);
                    }
                    if ((this.isBoss || this.typeKey === 'brute') && !moonHidden) {
                        const barW = this.size * 2, barH = 4, barY = this.y - this.size - 10;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, barY, barW, barH);
                        ctx.fillStyle = '#ff4466'; ctx.fillRect(this.x - barW / 2, barY, barW * (this.hp / this.maxHp), barH);
                    }
                }
