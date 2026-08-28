            // ==================== 投射物 ====================
            class Projectile {
                constructor(x, y, vx, vy, damage, splashRadius = 0, splashDamagePercent = 0, color = '#ffaa44', size = 4.5, isEnemy = false) {
                    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.damage = damage;
                    this.splashRadius = splashRadius; this.splashDamagePercent = splashDamagePercent;
                    this.color = color; this.size = size; this.alive = true;
                    this.trailPositions = []; this.lifetime = 0; this.maxLifetime = isEnemy ? 8 : 3;
                    this.isEnemy = isEnemy;
                }
                update(dt) {
                    if (this.acidFuse !== undefined) { this.acidFuse -= dt; if (this.acidFuse <= 0) this.alive = false; }
                    this.lifetime += dt; if (this.lifetime > this.maxLifetime) this.alive = false;
                    if (this.lifetime > 0.02) { this.trailPositions.push({ x: this.x, y: this.y, life: 0.2 }); if (this.trailPositions.length > 12) this.trailPositions.shift(); }
                    for (const tp of this.trailPositions) tp.life -= dt;
                    this.trailPositions = this.trailPositions.filter(tp => tp.life > 0);
                    this.x += this.vx * dt; this.y += this.vy * dt;
                    if (this.x < -120 || this.x > WORLD_W + 120 || this.y < -120 || this.y > WORLD_H + 120) this.alive = false;
                }
                draw(ctx) {
                    if (this.isEnemy) {
                        if (this.acid) {
                            // 毒液拖尾
                            for (let i = 0; i < this.trailPositions.length; i++) {
                                const tp = this.trailPositions[i];
                                ctx.globalAlpha = (tp.life / 0.2) * 0.4;
                                ctx.fillStyle = this.color;
                                ctx.beginPath(); ctx.arc(tp.x, tp.y, this.size * (0.3 + i / this.trailPositions.length * 0.5), 0, Math.PI * 2); ctx.fill();
                            }
                            ctx.globalAlpha = 1;
                            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.2);
                            grad.addColorStop(0, '#ccffcc'); grad.addColorStop(0.4, this.color); grad.addColorStop(1, 'rgba(120,255,80,0)');
                            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = '#eaffea'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.55, 0, Math.PI * 2); ctx.fill();
                        } else {
                            ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
                            ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2); ctx.fill();
                        }
                    } else {
                        for (let i = 0; i < this.trailPositions.length; i++) {
                            const tp = this.trailPositions[i];
                            ctx.globalAlpha = (tp.life / 0.2) * 0.5;
                            ctx.fillStyle = this.color;
                            ctx.beginPath(); ctx.arc(tp.x, tp.y, this.size * (0.4 + i / this.trailPositions.length * 0.6), 0, Math.PI * 2); ctx.fill();
                        }
                        ctx.globalAlpha = 1;
                        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
                        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, this.color); grad.addColorStop(1, 'rgba(255,150,30,0)');
                        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 0.7, 0, Math.PI * 2); ctx.fill();
                    }
                }
            }
