            // ==================== 敌人绘制 ====================

            Enemy.prototype.draw = function(ctx) {
                    const flashOn = this.flashTimer > 0;
                    if (this.isBoss) {
                        const auraGrad = ctx.createRadialGradient(this.x, this.y, this.size * 1.2, this.x, this.y, this.size * 2);
                        auraGrad.addColorStop(0, this.auraColor); auraGrad.addColorStop(1, 'rgba(80,0,80,0)');
                        ctx.fillStyle = auraGrad; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2); ctx.fill();
                        if (this.typeKey === 'boss' && this.hp / this.maxHp < 0.5) {
                            const rageAura = ctx.createRadialGradient(this.x, this.y, this.size * 1.2, this.x, this.y, this.size * 2.2);
                            rageAura.addColorStop(0, `rgba(255,40,20,${0.35 + Math.sin(game.time * 8) * 0.15})`);
                            rageAura.addColorStop(1, 'rgba(255,40,20,0)');
                            ctx.fillStyle = rageAura; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2); ctx.fill();
                        }
                        if (this.invincible && this.shieldHp > 0) {
                            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2); ctx.stroke();
                            const barW = this.size * 2.2;
                            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, this.y - this.size - 18, barW, 6);
                            ctx.fillStyle = '#ff00ff'; ctx.fillRect(this.x - barW / 2, this.y - this.size - 18, barW * (this.shieldHp / this.shieldMax), 6);
                        }
                    }
                    ctx.fillStyle = flashOn ? '#ffffff' : this.color;
                    ctx.strokeStyle = flashOn ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = this.isBoss ? 3 : 1.5;
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
                    if (this.isBoss || this.typeKey === 'brute') {
                        const barW = this.size * 2, barH = 4, barY = this.y - this.size - 10;
                        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - barW / 2, barY, barW, barH);
                        ctx.fillStyle = '#ff4466'; ctx.fillRect(this.x - barW / 2, barY, barW * (this.hp / this.maxHp), barH);
                    }
                }
