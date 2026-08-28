            // ==================== 灵魂宝库（局外收集与成长） ====================
            const META_UPGRADES = [
                { id: 'hp',    name: '生命之种', desc: (l) => '初始生命 +' + (20 * l) + '（每级+20）', icon: 'heart-pulse', maxLevel: 3, costs: [120, 200, 320] },
                { id: 'dmg',   name: '力量符文', desc: (l) => '初始伤害 +' + (10 * l) + '%（每级+10%）', icon: 'flame', maxLevel: 5, costs: [120, 200, 320, 480, 700] },
                { id: 'pickup',name: '磁力石',   desc: (l) => '拾取范围 +' + (20 * l) + '%（每级+20%）', icon: 'magnet', maxLevel: 3, costs: [90, 150, 240] },
                { id: 'xp',    name: '智慧书',   desc: (l) => '经验加成 +' + (15 * l) + '%（每级+15%）', icon: 'book-open', maxLevel: 3, costs: [90, 150, 240] },
                { id: 'revive',name: '凤凰之羽', desc: (l) => '每局死亡时复活一次（50%血量）', icon: 'flame', maxLevel: 1, costs: [720] }
            ];
            // ===== 圣物商店（局外购买；带 maxLevel 的圣物可升级；可在面板自由穿戴/卸下） =====
            const META_RELICS = [
                { id: 'relic_vamp',  name: '吸血之爪', desc: '造成伤害的 10% 回复生命', icon: 'heart-pulse', cost: 320 },
                { id: 'relic_thorn', name: '荆棘光环', desc: '受到近战伤害时反弹 50% 给攻击者', icon: 'shield-half', cost: 320 },
                { id: 'relic_greed', name: '贪婪之石', desc: '经验球自动飞向玩家（无需靠近）', icon: 'magnet', cost: 240 },
                { id: 'relic_bomb',  name: '定时炸弹', desc: '每 10 秒在玩家位置爆炸（伤害随等级提升）', icon: 'bomb', cost: 360 },
                { id: 'relic_shield_start', name: '开局护盾', icon: 'shield', cost: 300, maxLevel: 3, upgradeCost: 400,
                    desc: (lv) => '开局获得灵魂护盾：护盾量 ' + (50 + 30 * (lv - 1)) + '，' + Math.max(4, 15 - 3 * (lv - 1)) + ' 秒自动恢复（每级：护盾量+30、恢复-3秒）' },
                { id: 'relic_shard_boost', name: '财富之心', desc: '每局结算的灵魂碎片 ×1.2', icon: 'coins', cost: 650 },
                { id: 'relic_last_stand', name: '背水一战', icon: 'trending-up', cost: 300, maxLevel: 3, upgradeCost: 400, rate: [0.25, 0.35, 0.45],
                    desc: (lv) => '生命每损失 1%，伤害 +' + relicRate('relic_last_stand', lv) + '%（满血无加成，血量越低伤害越高；每级+0.10%）' },
                { id: 'relic_phantom_step', name: '幻影步', icon: 'wind', cost: 360, maxLevel: 2, upgradeCost: 480, rate: [0.15, 0.25],
                    desc: (lv) => '受到伤害时有 ' + Math.round(relicRate('relic_phantom_step', lv) * 100) + '% 概率完全闪避（持续伤害不可闪避；每级+10%）' },
                { id: 'relic_shadow_clone', name: '影侍守卫', icon: 'shield-half', cost: 450,
                    desc: '受击时60%概率使周围敌人眩晕0.8秒并减速40%（1.5秒）；每10秒向最近的2个敌人释放影袭，造成30+等级×2伤害' },
                { id: 'relic_time_stop', name: '时停领域', icon: 'clock', cost: 520, maxLevel: 3, upgradeCost: 640, rate: [45, 35, 25],
                    desc: (lv) => '每隔 ' + relicRate('relic_time_stop', lv) + ' 秒冻结全场所有敌人 2 秒（含 Boss；升级缩短触发间隔）' },
                { id: 'relic_deathmark', name: '死神之指', desc: '解锁死神之指：标记目标并抹杀（手动可标记 Boss）', icon: 'skull', cost: 5999 }
            ];
            // ===== 成就系统（局外碎片奖励） =====
            const ACHIEVEMENTS = [
                { id: 'melee_master', name: '近战大师', desc: '只用飞刃/冰霜击杀一个 Boss（本局未用远程武器）', reward: 60 },
                { id: 'speedster',    name: '闪电侠', desc: '60 秒内击杀 200 只怪物', reward: 50 },
                { id: 'phoenix',      name: '不死鸟', desc: '生命低于 10% 时存活并击杀 Boss', reward: 40 },
                { id: 'collector',    name: '收集狂', desc: '一局内集齐 3 种进化武器', reward: 80 },
                { id: 'slayer_500',   name: '千军斩', desc: '单局击杀 500 只怪物', reward: 60 },
                { id: 'boss_hunter',  name: '屠戮者', desc: '单局击杀 3 个 Boss', reward: 80 },
                { id: 'rich_shards',  name: '大富翁', desc: '累计获得 1000 灵魂碎片', reward: 100 }
            ];
            let achievementsDone = loadAchievements();
            function loadAchievements() {
                try {
                    const raw = localStorage.getItem('rogue_ach');
                    if (raw) return JSON.parse(raw);
                } catch(e) {}
                return {};
            }
            function saveAchievements() {
                try { localStorage.setItem('rogue_ach', JSON.stringify(achievementsDone)); } catch(e) {}
            }
            function awardAchievement(id) {
                if (achievementsDone[id]) return;
                const a = ACHIEVEMENTS.find(x => x.id === id);
                if (!a) return;
                achievementsDone[id] = true;
                saveAchievements();
                metaData.shards = (metaData.shards || 0) + a.reward;
                metaData.earned = (metaData.earned || 0) + a.reward;
                saveMeta();
                game.warningText = '成就达成！' + a.name + '（+' + a.reward + '碎片）';
                game.warningTimer = 2.5;
                sound.play('levelup');
                spawnParticles(game.player.x, game.player.y, 30, '#ffd700', 100, 0.6, 5);
            }
            function checkAchievements() {
                if (!game.player) return;
                // 闪电侠：60 秒内击杀 200（简化：按时间与击杀比）
                if (!achievementsDone.speedster && game.kills >= 200 && game.time <= 90) awardAchievement('speedster');
                // 收集狂：集齐 3 种进化武器
                if (!achievementsDone.collector) {
                    const evoCount = game.player.weapons.filter(w => w.evolved).length;
                    if (evoCount >= 3) awardAchievement('collector');
                }
                // 不死鸟：血量低于 10% 时击杀 Boss
                if (!achievementsDone.phoenix && game.player.hp < game.player.maxHp * 0.1 && game.bossKilledCount > 0) awardAchievement('phoenix');
                // 近战大师：仅用飞刃/冰霜击杀 Boss
                if (!achievementsDone.melee_master) {
                    const hasRanged = game.player.weapons.some(w => w.type !== 'orbit_blade' && w.type !== 'frost_nova');
                    if (!hasRanged && game.bossKilledCount > 0) awardAchievement('melee_master');
                }
                // 千军斩：单局击杀 500
                if (!achievementsDone.slayer_500 && game.kills >= 500) awardAchievement('slayer_500');
                // 屠戮者：单局击杀 3 个 Boss
                if (!achievementsDone.boss_hunter && game.bossKilledCount >= 3) awardAchievement('boss_hunter');
                // 大富翁：累计获得 1000 碎片
                if (!achievementsDone.rich_shards && (metaData.earned || 0) >= 1000) awardAchievement('rich_shards');
            }
            // ===== 存档签名（防小白改数值：篡改后签名不匹配，数据视为无效并清除） =====
            const META_SALT = 'r0gue.m3ta!sig#v1';
            function metaSign(obj) {
                const raw = JSON.stringify(obj) + META_SALT;
                let a = 0x811c9dc5, b = 0x01000193;
                for (let i = 0; i < raw.length; i++) {
                    const c = raw.charCodeAt(i);
                    a = ((a ^ c) * 16777619) >>> 0;
                    b = ((b + c) * 2654435761) >>> 0;
                }
                return a.toString(16) + b.toString(16);
            }

            function loadMeta() {
                try {
                    const raw = localStorage.getItem('rogue_meta');
                    if (raw) {
                        const d = JSON.parse(raw);
                        const sig = localStorage.getItem('rogue_meta_sig');
                        if (sig) {
                            if (sig === metaSign(d)) {
                                if (!d.relics) d.relics = {};
                                if (d.earned === undefined) {
                                    // 旧存档迁移：补累计碎片字段并重新签名
                                    d.earned = d.shards || 0;
                                    localStorage.setItem('rogue_meta', JSON.stringify(d));
                                    localStorage.setItem('rogue_meta_sig', metaSign(d));
                                }
                                return d;
                            }
                            // 签名不匹配：视为篡改数据，直接清除
                            localStorage.removeItem('rogue_meta');
                            localStorage.removeItem('rogue_meta_sig');
                        } else {
                            // 旧版存档：一次性补签名（此后篡改即失效）
                            if (!d.relics) d.relics = {};
                            if (d.earned === undefined) d.earned = d.shards || 0;
                            localStorage.setItem('rogue_meta_sig', metaSign(d));
                            return d;
                        }
                    }
                } catch(e) {}
                return { shards: 0, upgrades: {}, relics: {}, earned: 0 };
            }

            let metaData = loadMeta();
            function hasRelic(id) { return !!(metaData.relics && metaData.relics[id]); }
            // 圣物穿戴状态：拥有但未穿戴则圣物效果不生效
            function isRelicActive(id) {
                if (!hasRelic(id)) return false;
                // 旧存档无 activeRelics 字段：默认全部已拥有圣物视为穿戴
                if (!metaData.activeRelics) return true;
                return metaData.activeRelics[id] !== false;
            }
            function setRelicActive(id, on) {
                if (!hasRelic(id)) return false;
                if (!metaData.activeRelics) metaData.activeRelics = {};
                metaData.activeRelics[id] = !!on;
                saveMeta();
                return true;
            }
            // 圣物等级：可升级圣物存数字等级，普通圣物为 true（视为 1 级），未拥有为 0
            function relicLevel(id) {
                const v = metaData.relics && metaData.relics[id];
                if (!v) return 0;
                return typeof v === 'number' ? v : 1;
            }
            // 圣物 rate 取值唯一入口：按当前等级（或指定 lv 预览）返回 rate 值；无 rate 字段返回 null
            function relicRate(id, lv) {
                const def = META_RELICS.find(x => x.id === id);
                if (!def || !def.rate) return null;
                const l = Math.max(1, Math.min(lv || relicLevel(id), def.rate.length));
                return def.rate[l - 1];
            }
            // 购买/升级圣物：首次购买按 cost（自动穿戴），已拥有可升级圣物按 upgradeCost 升一级
            function buyRelic(id) {
                const r = META_RELICS.find(x => x.id === id);
                if (!r) return false;
                const lv = relicLevel(id);
                const maxLv = r.maxLevel || 1;
                if (lv >= maxLv) return false;
                const cost = lv === 0 ? r.cost : (r.upgradeCost || r.cost);
                if (metaData.shards < cost) return false;
                metaData.shards -= cost;
                if (!metaData.relics) metaData.relics = {};
                metaData.relics[id] = lv + 1;
                if (!metaData.activeRelics) metaData.activeRelics = {};
                if (lv === 0) metaData.activeRelics[id] = true; // 新购买自动穿戴
                saveMeta();
                return true;
            }
            function saveMeta() {
                try {
                    localStorage.setItem('rogue_meta', JSON.stringify(metaData));
                    localStorage.setItem('rogue_meta_sig', metaSign(metaData));
                } catch(e) {}
            }
            function metaLevel(id) { return metaData.upgrades[id] || 0; }
            function metaUpgradeCost(id) {
                const u = META_UPGRADES.find(x => x.id === id);
                const l = metaLevel(id);
                if (!u || l >= u.maxLevel) return -1;
                return u.costs[l];
            }
            function buyMetaUpgrade(id) {
                const cost = metaUpgradeCost(id);
                if (cost < 0 || metaData.shards < cost) return false;
                metaData.shards -= cost;
                metaData.upgrades[id] = metaLevel(id) + 1;
                saveMeta();
                return true;
            }
            function metaLevelBonus(id) {
                const u = META_UPGRADES.find(x => x.id === id);
                if (!u || !u.bonus) return 0;
                return u.bonus * metaLevel(id);
            }
