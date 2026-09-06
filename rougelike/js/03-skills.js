            // ==================== 技能注册表 ====================
            // DIFFICULTIES 已抽离至 js/config.js（单源，file:// 需保证 config.js 在 03-skills 前加载）
            const MAX_LEVEL = 100;
            const START_WEAPON_DEFS = {
                magic_missile:   () => ({ type: 'magic_missile', level: 1, cooldown: 0, cooldownTime: 0.85, cooldownMultiplier: 1, damage: 21, damageMultiplier: 1, projectileSpeed: 350, extraProjectiles: 0, splashRadius: 28, splashDamagePercent: 0.35 }),
                orbit_blade:     () => ({ type: 'orbit_blade', level: 1, bladeCount: 3, radius: 60, rotationSpeed: 3.0, damage: 26, damageMultiplier: 1, angle: 0, hitCdTime: 0.28 }),
                frost_nova:      () => ({ type: 'frost_nova', level: 1, cooldown: 0, cooldownTime: 2.2, radius: 130, damage: 32, damageMultiplier: 1, slowAmount: 0.50, slowDuration: 2.2 }),
                lightning_chain: () => ({ type: 'lightning_chain', level: 1, cooldown: 0, cooldownTime: 0.95, damage: 20, damageMultiplier: 1, bounceCount: 1, bounceRange: 120, damageFalloff: 0.3, hitCdTime: 0.25 }),
                meteor:          () => ({ type: 'meteor', level: 1, cooldown: 0, cooldownTime: 5.0, damage: 110, damageMultiplier: 1, radius: 100, doubleChance: 0 }),
                shadow_spirit:   () => ({ type: 'shadow_spirit', level: 1, spiritCount: 2, damage: 13, damageMultiplier: 1, attackSpeed: 1.2625, attackSpeedMultiplier: 1, slowChance: 0, slowAmount: 0.3, slowDuration: 1.5, attackTimer: 0, lockReduction: 0 }),
                holy_beam:       () => ({ type: 'holy_beam', level: 1, cooldown: 0, cooldownTime: 2.4, damage: 29, damageMultiplier: 1, beamCount: 1, width: 36, duration: 0.35 }),
                plague_cloud:    () => ({ type: 'plague_cloud', level: 1, cooldown: 0, cooldownTime: 4.5, damage: 10, damageMultiplier: 1, cloudCount: 1, radius: 80, duration: 4, tickRate: 0.5, burstChance: 0.30 }),
                gravity_well:    () => ({ type: 'gravity_well', level: 1, cooldown: 0, cooldownTime: 9.0, damage: 7, damageMultiplier: 1, wellCount: 1, pullRadius: 240, duration: 3.5, tickRate: 0.5, explodeDamage: 60, explodeRadius: 130 })
            };
            const START_WEAPON_META = {
                magic_missile:   { name: '魔法弹', icon: 'flame' },
                orbit_blade:     { name: '飞刃', icon: 'swords' },
                frost_nova:      { name: '冰霜', icon: 'snowflake' },
                lightning_chain: { name: '闪电', icon: 'zap' },
                meteor:          { name: '陨石', icon: 'orbit' },
                shadow_spirit:   { name: '精灵', icon: 'ghost' },
                holy_beam:       { name: '圣光棱镜', icon: 'sparkles' },
                plague_cloud:    { name: '诅咒瘴气', icon: 'waves' },
                gravity_well:    { name: '引力奇点', icon: 'target' }
            };
            const SKILL_REGISTRY = [
                {
                    id: 'missile_damage', name: '魔法弹强化', icon: 'flame', desc: '魔法弹伤害 +25%', maxLevel: 4, color: '#ff8844',
                    applies: (p) => p.weapons.some(w => w.type === 'magic_missile'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'magic_missile'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.25; }
                },
                {
                    id: 'missile_cooldown', name: '冷却缩减', icon: 'timer', desc: '所有武器冷却 -8%', maxLevel: 3, color: '#ffcc44',
                    applies: (p) => true,
                    apply: (p) => { p.globalCooldownMultiplier = (p.globalCooldownMultiplier || 1) * 0.92; }
                },
                {
                    id: 'missile_count', name: '多重射击', icon: 'sparkles', desc: '魔法弹数量 +1', maxLevel: 3, color: '#ffaa33',
                    applies: (p) => p.weapons.some(w => w.type === 'magic_missile'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'magic_missile'); if (w) w.extraProjectiles = (w.extraProjectiles || 0) + 1; }
                },
                {
                    id: 'unlock_magic', name: '魔法弹', icon: 'flame', desc: '获得魔法弹', maxLevel: 1, color: '#ffaa44',
                    applies: (p) => !p.weapons.some(w => w.type === 'magic_missile'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.magic_missile()); }
                },
                {
                    id: 'unlock_orbit', name: '环绕飞刃', icon: 'swords', desc: '获得环绕飞刃', maxLevel: 1, color: '#aaddff',
                    applies: (p) => !p.weapons.some(w => w.type === 'orbit_blade'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.orbit_blade()); }
                },
                {
                    id: 'orbit_count', name: '飞刃增殖', icon: 'copy-plus', desc: '飞刃数量 +1', maxLevel: 3, color: '#88ccff',
                    applies: (p) => p.weapons.some(w => w.type === 'orbit_blade'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'orbit_blade'); if (w) w.bladeCount += 1; }
                },
                {
                    id: 'orbit_damage', name: '飞刃锐化', icon: 'gem', desc: '飞刃伤害 +20%', maxLevel: 4, color: '#6699dd',
                    applies: (p) => p.weapons.some(w => w.type === 'orbit_blade'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'orbit_blade'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.20; }
                },
                {
                    id: 'orbit_speed', name: '飞刃加速', icon: 'gauge', desc: '飞刃转速 +15%', maxLevel: 3, color: '#77aadd',
                    applies: (p) => p.weapons.some(w => w.type === 'orbit_blade'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'orbit_blade'); if (w) w.rotationSpeed *= 1.15; }
                },
                {
                    id: 'unlock_frost', name: '冰霜新星', icon: 'snowflake', desc: '获得冰霜新星', maxLevel: 1, color: '#aaddff',
                    applies: (p) => !p.weapons.some(w => w.type === 'frost_nova'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.frost_nova()); }
                },
                {
                    id: 'frost_cd', name: '凛冬迫近', icon: 'timer', desc: '冷却 -0.35秒', maxLevel: 3, color: '#99ccee',
                    applies: (p) => p.weapons.some(w => w.type === 'frost_nova'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'frost_nova'); if (w) w.cooldownTime = Math.max(1.0, w.cooldownTime - 0.35); }
                },
                {
                    id: 'frost_range', name: '寒潮扩散', icon: 'waves', desc: '范围 +15%', maxLevel: 4, color: '#aaccee',
                    applies: (p) => p.weapons.some(w => w.type === 'frost_nova'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'frost_nova'); if (w) w.radius *= 1.15; }
                },
                {
                    id: 'frost_damage', name: '极寒之力', icon: 'thermometer-snowflake', desc: '伤害 +30%', maxLevel: 3, color: '#bbddff',
                    applies: (p) => p.weapons.some(w => w.type === 'frost_nova'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'frost_nova'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.30; }
                },
                {
                    id: 'global_damage', name: '战斗专注', icon: 'crosshair', desc: '所有伤害 +15%', maxLevel: 3, color: '#ff9966',
                    applies: () => true,
                    apply: (p) => { p.globalDamageMultiplier = (p.globalDamageMultiplier || 1) + 0.15; }
                },
                {
                    id: 'max_hp', name: '生命强化', icon: 'heart', desc: '最大生命 +45', maxLevel: 3, color: '#ff6677',
                    applies: () => true,
                    apply: (p) => { p.maxHp += 45; p.hp = Math.min(p.hp + 45, p.maxHp); }
                },
                {
                    id: 'move_speed', name: '迅捷步伐', icon: 'footprints', desc: '移动速度 +16%', maxLevel: 3, color: '#77dd77',
                    applies: () => true,
                    apply: (p) => { p.speedMultiplier = (p.speedMultiplier || 1) + 0.16; }
                },
                {
                    id: 'hp_regen', name: '生命恢复', icon: 'heart-pulse', desc: '每秒回血 1.5%', maxLevel: 3, color: '#55ee88',
                    applies: () => true,
                    apply: (p) => { p.hpRegenPercent = (p.hpRegenPercent || 0) + 0.015; }
                },
                {
                    id: 'armor', name: '坚韧护甲', icon: 'shield', desc: '减伤 8%，护甲 +2', maxLevel: 3, color: '#cccccc',
                    applies: () => true,
                    apply: (p) => { p.damageReduction = (p.damageReduction || 0) + 0.08; p.flatArmor = (p.flatArmor || 0) + 2; }
                },
                // ===== 新武器解锁：闪电链 =====
                {
                    id: 'unlock_chain', name: '闪电链', icon: 'zap', desc: '获得闪电链', maxLevel: 1, color: '#aaddff',
                    applies: (p) => !p.weapons.some(w => w.type === 'lightning_chain'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.lightning_chain()); }
                },
                {
                    id: 'chain_bounce', name: '连锁弹跳', icon: 'link', desc: '弹跳 +1', maxLevel: 3, color: '#88ccff',
                    applies: (p) => p.weapons.some(w => w.type === 'lightning_chain'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'lightning_chain'); if (w) w.bounceCount += 1; }
                },
                {
                    id: 'chain_range', name: '电弧延伸', icon: 'radio', desc: '弹跳距离 +15%', maxLevel: 3, color: '#66bbdd',
                    applies: (p) => p.weapons.some(w => w.type === 'lightning_chain'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'lightning_chain'); if (w) w.bounceRange *= 1.15; }
                },
                {
                    id: 'chain_falloff', name: '导电强化', icon: 'battery-full', desc: '伤害衰减 -10%', maxLevel: 3, color: '#99ddff',
                    applies: (p) => p.weapons.some(w => w.type === 'lightning_chain'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'lightning_chain'); if (w) w.damageFalloff = Math.max(0.05, w.damageFalloff - 0.1); }
                },
                {
                    id: 'chain_damage', name: '雷电之力', icon: 'zap', desc: '伤害 +15%', maxLevel: 4, color: '#ffcc44',
                    applies: (p) => p.weapons.some(w => w.type === 'lightning_chain'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'lightning_chain'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.15; }
                },
                // ===== 新武器解锁：陨石 =====
                {
                    id: 'unlock_meteor', name: '陨石', icon: 'orbit', desc: '获得陨石', maxLevel: 1, color: '#aaddff',
                    applies: (p) => !p.weapons.some(w => w.type === 'meteor'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.meteor()); }
                },
                {
                    id: 'meteor_cd', name: '天降横祸', icon: 'timer', desc: '冷却 -0.7秒', maxLevel: 3, color: '#ffaa44',
                    applies: (p) => p.weapons.some(w => w.type === 'meteor'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'meteor'); if (w) w.cooldownTime = Math.max(4, w.cooldownTime - 0.7); }
                },
                {
                    id: 'meteor_range', name: '陨石扩散', icon: 'expand', desc: '范围 +15%', maxLevel: 3, color: '#ff8833',
                    applies: (p) => p.weapons.some(w => w.type === 'meteor'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'meteor'); if (w) w.radius *= 1.15; }
                },
                {
                    id: 'meteor_damage', name: '陨石强化', icon: 'flame', desc: '伤害 +25%', maxLevel: 4, color: '#ff6622',
                    applies: (p) => p.weapons.some(w => w.type === 'meteor'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'meteor'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.25; }
                },
                {
                    id: 'meteor_double', name: '双重陨石', icon: 'copy', desc: '20%几率双陨石', maxLevel: 3, color: '#ffdd55',
                    applies: (p) => p.weapons.some(w => w.type === 'meteor'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'meteor'); if (w) w.doubleChance = (w.doubleChance || 0) + 0.20; }
                },
                // ===== 新武器解锁：暗影精灵 =====
                {
                    id: 'unlock_shadow', name: '暗影精灵', icon: 'ghost', desc: '获得暗影精灵', maxLevel: 1, color: '#aaddff',
                    applies: (p) => !p.weapons.some(w => w.type === 'shadow_spirit'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.shadow_spirit()); }
                },
                {
                    id: 'shadow_count', name: '精灵增殖', icon: 'users', desc: '精灵数量 +1', maxLevel: 3, color: '#bb88ff',
                    applies: (p) => p.weapons.some(w => w.type === 'shadow_spirit'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); if (w) w.spiritCount += 1; }
                },
                {
                    id: 'shadow_speed', name: '精灵狂暴', icon: 'gauge', desc: '攻速 +20%', maxLevel: 3, color: '#aa66ee',
                    applies: (p) => p.weapons.some(w => w.type === 'shadow_spirit'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); if (w) w.attackSpeedMultiplier = (w.attackSpeedMultiplier || 1) + 0.20; }
                },
                {
                    id: 'shadow_damage', name: '暗影侵蚀', icon: 'skull', desc: '伤害 +20%', maxLevel: 4, color: '#9955dd',
                    applies: (p) => p.weapons.some(w => w.type === 'shadow_spirit'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.20; }
                },
                {
                    id: 'shadow_slow', name: '暗影束缚', icon: 'network', desc: '命中减速概率 +25%', maxLevel: 3, color: '#cc99ff',
                    applies: (p) => p.weapons.some(w => w.type === 'shadow_spirit'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); if (w) w.slowChance = (w.slowChance || 0) + 0.25; }
                },
                {
                    id: 'shadow_lock', name: '暗影锁定', icon: 'target', desc: '锁定时间 -0.4秒', maxLevel: 2, color: '#bb77ff',
                    applies: (p) => p.weapons.some(w => w.type === 'shadow_spirit'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); if (w) w.lockReduction = (w.lockReduction || 0) + 0.40; }
                },
                // ===== 新武器解锁：圣光棱镜 =====
                {
                    id: 'unlock_beam', name: '圣光棱镜', icon: 'sparkles', desc: '获得圣光棱镜', maxLevel: 1, color: '#ffee99',
                    applies: (p) => !p.weapons.some(w => w.type === 'holy_beam'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.holy_beam()); }
                },
                {
                    id: 'beam_count', name: '棱镜分裂', icon: 'copy', desc: '光束 +1', maxLevel: 3, color: '#ffe680',
                    applies: (p) => p.weapons.some(w => w.type === 'holy_beam'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'holy_beam'); if (w) w.beamCount += 1; }
                },
                {
                    id: 'beam_width', name: '圣光扩束', icon: 'expand', desc: '光束宽度 +20%', maxLevel: 3, color: '#ffdd66',
                    applies: (p) => p.weapons.some(w => w.type === 'holy_beam'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'holy_beam'); if (w) w.width *= 1.2; }
                },
                {
                    id: 'beam_damage', name: '净化之力', icon: 'flame', desc: '光束伤害 +25%', maxLevel: 4, color: '#ffcc44',
                    applies: (p) => p.weapons.some(w => w.type === 'holy_beam'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'holy_beam'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.25; }
                },
                // ===== 新武器解锁：诅咒瘴气 =====
                {
                    id: 'unlock_plague', name: '诅咒瘴气', icon: 'waves', desc: '获得诅咒瘴气', maxLevel: 1, color: '#88dd66',
                    applies: (p) => !p.weapons.some(w => w.type === 'plague_cloud'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.plague_cloud()); }
                },
                {
                    id: 'plague_count', name: '瘴气增殖', icon: 'copy', desc: '毒云 +1', maxLevel: 3, color: '#77cc55',
                    applies: (p) => p.weapons.some(w => w.type === 'plague_cloud'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'plague_cloud'); if (w) w.cloudCount += 1; }
                },
                {
                    id: 'plague_range', name: '疫雾扩散', icon: 'expand', desc: '毒云范围 +15%', maxLevel: 3, color: '#66bb44',
                    applies: (p) => p.weapons.some(w => w.type === 'plague_cloud'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'plague_cloud'); if (w) w.radius *= 1.15; }
                },
                {
                    id: 'plague_damage', name: '瘟疫侵蚀', icon: 'skull', desc: '毒云伤害 +25%', maxLevel: 4, color: '#55aa33',
                    applies: (p) => p.weapons.some(w => w.type === 'plague_cloud'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'plague_cloud'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.25; }
                },
                {
                    id: 'plague_spread', name: '传染强化', icon: 'link', desc: '死亡爆发概率 +15%', maxLevel: 2, color: '#88cc77',
                    applies: (p) => p.weapons.some(w => w.type === 'plague_cloud'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'plague_cloud'); if (w) w.burstChance = Math.min(1, (w.burstChance || 0) + 0.15); }
                },
                // ===== 新武器解锁：引力奇点 =====
                {
                    id: 'unlock_well', name: '引力奇点', icon: 'target', desc: '获得引力奇点', maxLevel: 1, color: '#bb88ff',
                    applies: (p) => !p.weapons.some(w => w.type === 'gravity_well'),
                    apply: (p) => { p.weapons.push(START_WEAPON_DEFS.gravity_well()); }
                },
                {
                    id: 'well_count', name: '奇点增殖', icon: 'copy', desc: '黑洞 +1', maxLevel: 3, color: '#aa77ee',
                    applies: (p) => p.weapons.some(w => w.type === 'gravity_well'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'gravity_well'); if (w) w.wellCount += 1; }
                },
                {
                    id: 'well_gravity', name: '潮汐引力', icon: 'rotate-ccw', desc: '吸附半径 +20%', maxLevel: 3, color: '#9966dd',
                    applies: (p) => p.weapons.some(w => w.type === 'gravity_well'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'gravity_well'); if (w) w.pullRadius *= 1.2; }
                },
                {
                    id: 'well_damage', name: '奇点能量', icon: 'trending-up', desc: '黑洞伤害 +25%', maxLevel: 4, color: '#8855cc',
                    applies: (p) => p.weapons.some(w => w.type === 'gravity_well'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'gravity_well'); if (w) w.damageMultiplier = (w.damageMultiplier || 1) + 0.25; }
                },
                {
                    id: 'well_linger', name: '事件视界', icon: 'clock', desc: '存续时间 +0.8秒', maxLevel: 2, color: '#cc99ff',
                    applies: (p) => p.weapons.some(w => w.type === 'gravity_well'),
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'gravity_well'); if (w) w.duration += 0.8; }
                },
                // ===== 进化融合技能 =====
                {
                    id: 'evo_fireball', name: '炎爆术', icon: 'flame', desc: '伤害+40%，弹速+30%，火球变大', maxLevel: 1, color: '#ff4400',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'magic_missile'); return w && (p['_skill_missile_damage'] || 0) >= 4 && (p['_skill_missile_cooldown'] || 0) >= 3 && (p['_skill_missile_count'] || 0) >= 3 && !p['_skill_evo_fireball']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'magic_missile'); if (w) { w.evolved = 'fireball'; w.damageMultiplier = (w.damageMultiplier || 1) * 1.4; w.projectileSpeed *= 1.30; w.splashRadius = (w.splashRadius || 30) * 1.3; } }
                },
                {
                    id: 'evo_orbit', name: '剑刃风暴', icon: 'swords', desc: '飞刃+4，转速+50%，命中间隔大幅缩短', maxLevel: 1, color: '#44aaff',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'orbit_blade'); return w && (p['_skill_orbit_count'] || 0) >= 3 && (p['_skill_orbit_damage'] || 0) >= 4 && (p['_skill_orbit_speed'] || 0) >= 3 && !p['_skill_evo_orbit']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'orbit_blade'); if (w) { w.evolved = 'blade_storm'; w.bladeCount += 4; w.radius = 70; w.rotationSpeed *= 1.5; w.hitCdTime = Math.max(0.1, (w.hitCdTime || 0.28) - 0.18); } }
                },
                {
                    id: 'evo_frost', name: '极寒领域', icon: 'snowflake', desc: '范围+30%，减速70%，冻结0.8秒', maxLevel: 1, color: '#00ccff',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'frost_nova'); return w && (p['_skill_frost_range'] || 0) >= 4 && (p['_skill_frost_damage'] || 0) >= 3 && (p['_skill_frost_cd'] || 0) >= 3 && !p['_skill_evo_frost']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'frost_nova'); if (w) { w.evolved = 'frozen_domain'; w.radius *= 1.3; w.slowAmount = 0.7; w.freezeDuration = 0.8; } }
                },
                {
                    id: 'evo_chain', name: '雷暴', icon: 'cloud-lightning', desc: '弹跳+2，伤害+30%，冷却-30%，可重复命中', maxLevel: 1, color: '#ffff00',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'lightning_chain'); return w && (p['_skill_chain_bounce'] || 0) >= 3 && (p['_skill_chain_range'] || 0) >= 3 && (p['_skill_chain_damage'] || 0) >= 4 && !p['_skill_evo_chain']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'lightning_chain'); if (w) { w.evolved = 'thunderstorm'; w.bounceCount += 2; w.damageFalloff = 0; w.cooldownTime *= 0.7; w.damageMultiplier = (w.damageMultiplier || 1) + 0.30; w.allowRehit = true; } }
                },
                {
                    id: 'evo_meteor', name: '星落', icon: 'stars', desc: '冷却2.5秒，伤害+40%，留燃烧区', maxLevel: 1, color: '#ff6600',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'meteor'); return w && (p['_skill_meteor_cd'] || 0) >= 3 && (p['_skill_meteor_range'] || 0) >= 3 && (p['_skill_meteor_damage'] || 0) >= 4 && !p['_skill_evo_meteor']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'meteor'); if (w) { w.evolved = 'starfall'; w.cooldownTime = 2.5; w.damageMultiplier = (w.damageMultiplier || 1) + 0.40; w.leaveBurning = true; w.burningDuration = 2; w.burningTickRate = 0.4; w.burningDamagePercent = 0.30; } }
                },
                {
                    id: 'evo_shadow', name: '暗影军团', icon: 'users', desc: '攻速+35%，10% 概率连击', maxLevel: 1, color: '#6600cc',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); return w && (p['_skill_shadow_count'] || 0) >= 3 && (p['_skill_shadow_speed'] || 0) >= 3 && (p['_skill_shadow_damage'] || 0) >= 4 && !p['_skill_evo_shadow']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'shadow_spirit'); if (w) { w.evolved = 'shadow_legion'; w.attackSpeedMultiplier = (w.attackSpeedMultiplier || 1) * 1.35; w.doubleStrike = 0.10; } }
                },
                {
                    id: 'evo_beam', name: '棱镜圣裁', icon: 'sparkles', desc: '光束扇形扫射，伤害+30%', maxLevel: 1, color: '#ffcc00',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'holy_beam'); return w && (p['_skill_beam_count'] || 0) >= 3 && (p['_skill_beam_width'] || 0) >= 3 && (p['_skill_beam_damage'] || 0) >= 4 && !p['_skill_evo_beam']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'holy_beam'); if (w) { w.evolved = 'prism_verdict'; w.damageMultiplier = (w.damageMultiplier || 1) * 1.3; } }
                },
                {
                    id: 'evo_plague', name: '大瘟疫', icon: 'skull', desc: '毒云跟随敌人，死亡爆发必发并减速', maxLevel: 1, color: '#44aa22',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'plague_cloud'); return w && (p['_skill_plague_count'] || 0) >= 3 && (p['_skill_plague_range'] || 0) >= 3 && (p['_skill_plague_damage'] || 0) >= 4 && !p['_skill_evo_plague']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'plague_cloud'); if (w) { w.evolved = 'pandemic'; w.burstChance = 1; } }
                },
                {
                    id: 'evo_well', name: '坍缩宇宙', icon: 'network', desc: '爆炸伤害+40%，分裂 8 发冲击波', maxLevel: 1, color: '#8844cc',
                    applies: (p) => { const w = p.weapons.find(w => w.type === 'gravity_well'); return w && (p['_skill_well_count'] || 0) >= 3 && (p['_skill_well_gravity'] || 0) >= 3 && (p['_skill_well_damage'] || 0) >= 4 && !p['_skill_evo_well']; },
                    apply: (p) => { const w = p.weapons.find(w => w.type === 'gravity_well'); if (w) { w.evolved = 'singularity'; w.explodeDamage = (w.explodeDamage || 60) * 1.4; } }
                },
                // ===== 协同技能 =====
                {
                    id: 'synergy_blade_speed', name: '刃舞风暴', icon: 'wind', desc: '飞刃伤害随移速提升（上限40%）', maxLevel: 1, color: '#aaffaa',
                    applies: (p) => p.weapons.some(w => w.type === 'orbit_blade') && (p.speedMultiplier || 1) > 1,
                    apply: (p) => { p.synergyBladeSpeed = true; }
                },
                // ===== 击杀触发类 =====
                {
                    id: 'kill_explode', name: '击杀爆炸', icon: 'bomb', desc: '击杀造成15%范围爆炸', maxLevel: 1, color: '#ff8844',
                    applies: () => true,
                    apply: (p) => { p.killExplode = true; }
                },
                {
                    id: 'kill_speed', name: '击杀加速', icon: 'zap', desc: '击杀后移速+15%（2秒，可叠2层）', maxLevel: 1, color: '#44ddff',
                    applies: () => true,
                    apply: (p) => { p.killSpeed = true; p.killSpeedStacks = 0; p.killSpeedTimer = 0; }
                },
                // ===== 风险回报类 =====
                {
                    id: 'glass_cannon', name: '玻璃大炮', icon: 'target', desc: '伤害+40%，受击+25%', maxLevel: 1, color: '#ff4444',
                    applies: () => true,
                    apply: (p) => { p.globalDamageMultiplier = (p.globalDamageMultiplier || 1) + 0.40; p.damageTakenMultiplier = (p.damageTakenMultiplier || 1) + 0.25; }
                },
                {
                    id: 'turtle_tactics', name: '龟壳战术', icon: 'shield-half', desc: '减伤+8%，移速-15%', maxLevel: 1, color: '#88aa88',
                    applies: () => true,
                    apply: (p) => { p.damageReduction = (p.damageReduction || 0) + 0.08; p.speedMultiplier = (p.speedMultiplier || 1) - 0.15; }
                }
            ];

            // ==================== 武器编队（战前选择最多 6 把入局；局内解锁卡只出编队内武器） ====================
            const LOADOUT_SIZE = 6;
            const DEFAULT_LOADOUT = ['magic_missile', 'orbit_blade', 'frost_nova', 'lightning_chain', 'meteor'];
            function loadLoadout() {
                try {
                    const raw = JSON.parse(localStorage.getItem('rogue_loadout') || 'null');
                    if (Array.isArray(raw)) {
                        const valid = raw.filter(k => START_WEAPON_DEFS[k]);
                        if (valid.length > 0) return valid;
                    }
                } catch (e) {}
                return [...DEFAULT_LOADOUT];
            }
            function saveLoadout(list) {
                try { localStorage.setItem('rogue_loadout', JSON.stringify(list)); } catch (e) {}
            }
