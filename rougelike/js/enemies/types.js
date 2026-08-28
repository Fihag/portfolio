            // ==================== 敌人类型 ====================
            const ENEMY_TYPES = {
                zombie:   { name: '小僵尸', hp: 30, speed: 60, size: 12, color: '#44cc66', xpValue: 12, damage: 7,  shape: 'circle' },
                runner:   { name: '疾行者', hp: 20, speed: 150, size: 9, color: '#ff5544', xpValue: 18, damage: 9,  shape: 'triangle' },
                brute:    { name: '巨兽',   hp: 85, speed: 40, size: 22, color: '#bb44ee', xpValue: 36, damage: 12, shape: 'square' },
                wraith:   { name: '怨灵',   hp: 28, speed: 55, size: 11, color: 'rgba(200,200,255,0.7)', xpValue: 17, damage: 0, shape: 'circle', isGhost: true, slowAmount: 0.35, slowDuration: 2, dotDamage: 1.5, dotDuration: 2 },
                pyromancer: { name: '炎术士', hp: 26, speed: 48, size: 9, color: '#ff6633', xpValue: 24, damage: 0, shape: 'triangle', isRanged: true, attackRange: 150, fireballDamage: 10, fireballSpeed: 180, fireballCooldown: 2.6 },
                boss:     { name: '死神骑士', hp: 1750, speed: 62, size: 26, color: '#4a0044', xpValue: 200, damage: 32, shape: 'square', isBoss: true, shieldBase: 850, slashDamage: 18, slashSpeed: 210, slashCooldown: 6, chargeTime: 0.9, shockwaveDamage: 18, scale: { hpRate: 0.35, shieldRate: 0.30, contactRate: 0.06, slashRate: 0.20, shockwaveRate: 0.15, speedRate: 0.40, speedCap: 3 } },
                hatchling:  { name: '巢穴幼体', hp: 25, speed: 135, size: 8, color: '#a8e063', xpValue: 12, damage: 9, shape: 'circle' },
                broodmother: { name: '虫巢母皇', hp: 2300, speed: 52, size: 30, color: '#7cbf4d', xpValue: 200, damage: 30, shape: 'circle', isBoss: true, shieldBase: 850, slashDamage: 0, slashSpeed: 0, slashCooldown: 6, chargeTime: 0.9, summonType: 'hatchling', summonInterval: 3.5, summonCount: 3, auraColor: 'rgba(120,200,80,0.6)', scale: { hpRate: 0.30, shieldRate: 0.25, shieldRate3: 0.30, contactRate: 0.06, acidRate: 0.20, speedRate: 0.40, speedCap: 3 } },
                assassin:  { name: '暗影刺客', hp: 1300, speed: 145, size: 20, color: '#5a2a7a', xpValue: 200, damage: 30, shape: 'triangle', isBoss: true, shieldBase: 1050, slashDamage: 30, slashSpeed: 320, slashCooldown: 3.5, chargeTime: 0.9, shurikenDamage: 20, shurikenSpeed: 300, shurikenCount: 6, shurikenInterval: 7, auraColor: 'rgba(120,60,190,0.6)', scale: { hpRate: 0.20, shieldRate: 0.25, slashRate: 0.25, speedRate: 0.35, speedCap: 3 } },
                lavabeast: { name: '熔岩巨兽', hp: 3200, speed: 145, size: 34, color: '#8a2b08', xpValue: 240, damage: 34, shape: 'circle', isBoss: true, shieldBase: 1300, slashDamage: 26, slashSpeed: 280, slashCooldown: 5.5, chargeTime: 0.9, summonType: 'lavaling', summonInterval: 8, summonCount: 3, auraColor: 'rgba(255,90,20,0.65)', scale: { hpRate: 0.32, shieldRate: 0.28, contactRate: 0.06, slashRate: 0.22, speedRate: 0.35, speedCap: 3 } },
                lavaling:  { name: '熔岩幼体', hp: 18, speed: 95, size: 9, color: '#ff6622', xpValue: 10, damage: 6, shape: 'circle', isGhost: true, slowAmount: 0.35, slowDuration: 1.5, dotDamage: 2, dotDuration: 2 }
            };

            
            // ==================== Boss掉落道具 ====================
            const BOSS_DROP_ITEMS = [
                { id: 'rage_potion', name: '怒火药剂', icon: 'flame', desc: '伤害 +15%', apply: (p) => { p.globalDamageMultiplier = (p.globalDamageMultiplier || 1) + 0.15; } },
                { id: 'life_spring', name: '生命之泉', icon: 'heart-pulse', desc: '最大生命+15%并回满', apply: (p) => { p.maxHp = Math.floor(p.maxHp * 1.15); p.hp = p.maxHp; spawnParticles(p.x, p.y, 20, '#55ff88', 60, 0.5, 4); } },
                { id: 'exp_crystal', name: '经验结晶', icon: 'gem', desc: '经验获取 +10%', apply: (p) => { p.expMultiplier = (p.expMultiplier || 1) + 0.10; } },
                { id: 'attack_speed_orb', name: '攻速宝珠', icon: 'zap', desc: '所有武器冷却 -10%', apply: (p) => { p.globalCooldownMultiplier = (p.globalCooldownMultiplier || 1) * 0.90; } }
            ];

