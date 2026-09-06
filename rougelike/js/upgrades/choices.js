            // ==================== 升级逻辑 ====================
            // 武器解锁技能 → 武器类型映射（编队卡池门控与前期保底共用）
            const WEAPON_SKILL_MAP = { 'unlock_magic': 'magic_missile', 'unlock_orbit': 'orbit_blade', 'unlock_frost': 'frost_nova', 'unlock_chain': 'lightning_chain', 'unlock_meteor': 'meteor', 'unlock_shadow': 'shadow_spirit', 'unlock_beam': 'holy_beam', 'unlock_plague': 'plague_cloud', 'unlock_well': 'gravity_well' };
            function generateUpgradeChoices(player) {
                const available = [];
                const loadout = game.loadout || null;
                for (const skill of SKILL_REGISTRY) {
                    if (!skill.applies(player)) continue;
                    // 编队门控：未入编队的武器，其解锁卡不进入卡池
                    const mappedType = WEAPON_SKILL_MAP[skill.id];
                    if (mappedType && loadout && !loadout.includes(mappedType)) continue;
                    const currentLevel = getSkillCurrentLevel(player, skill);
                    if (currentLevel >= skill.maxLevel) continue;
                    if (skill.maxLevel === 1 && currentLevel >= 1) continue;
                    available.push(skill);
                }
                const shuffled = [...available].sort(() => Math.random() - 0.5);
                const choiceCount = 5 + (player.extraChoices || 0) + (player.relicChoiceCrown ? 1 : 0);
                let choices = shuffled.slice(0, choiceCount);
                if (player.extraChoices) player.extraChoices = 0;
                if (game.upgradeCount <= 2) {
                    const unlockedWeapons = player.weapons.map(w => w.type);
                    // 保底推新武器也只从编队内挑选
                    const weaponSkills = Object.keys(WEAPON_SKILL_MAP).filter(sid => !loadout || loadout.includes(WEAPON_SKILL_MAP[sid]));
                    const missingWeaponSkill = weaponSkills.find(sid => !unlockedWeapons.includes(WEAPON_SKILL_MAP[sid]));
                    if (missingWeaponSkill && !choices.some(s => s.id === missingWeaponSkill)) {
                        const skill = SKILL_REGISTRY.find(s => s.id === missingWeaponSkill);
                        if (skill && skill.applies(player) && getSkillCurrentLevel(player, skill) < skill.maxLevel) {
                            choices.pop(); choices.unshift(skill);
                        }
                    }
                }
                return choices;
            }

            function getSkillCurrentLevel(player, skill) {
                return player['_skill_' + skill.id] || 0;
            }

            function showLevelupPanel(choices) {
                levelupCards.innerHTML = '';
                choices.forEach((skill, i) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const currentLvl = getSkillCurrentLevel(game.player, skill);
                    card.innerHTML = `<span class="icon">${ICONS[skill.icon] || ''}</span><span class="name">${skill.name}</span><span class="desc">${skill.desc}</span><span class="level-tag">Lv.${currentLvl+1}/${skill.maxLevel}</span>`;
                    card.addEventListener('click', (e) => { e.stopPropagation(); game.applyUpgrade(skill); });
                    card.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); game.applyUpgrade(skill); });
                    levelupCards.appendChild(card);
                });
                levelupPanel.style.display = 'flex';
                // 点击保护：0.8 秒内不可选择，避免移动/误触
                game.levelupLock = 0.8;
                levelupPanel.classList.add('locked');
                const lockHint = $inp('levelup-lock-hint');
                if (lockHint) lockHint.textContent = '1 秒后可选择';
                game.rerollUsed = false;
                skipBtn.disabled = false;
                skipBtn.style.opacity = '1';
                skipBtn.style.cursor = 'pointer';
            }

            
            function showBossDropPanel(choices) {
                bossdropCards.innerHTML = '';
                sound.play('bossDrop');
                choices.forEach((item, i) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const d = typeof item.desc === 'function' ? item.desc(game.player) : item.desc;
                    card.innerHTML = `<span class="icon">${ICONS[item.icon] || ''}</span><span class="name">${item.name}</span><span class="desc">${d}</span>`;
                    card.addEventListener('click', (e) => { e.stopPropagation(); applyBossDrop(item); });
                    card.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); applyBossDrop(item); });
                    bossdropCards.appendChild(card);
                });
                bossdropPanel.style.display = 'flex';
                game.state = 'bossdrop';
            }

            function applyBossDrop(item) {
                if (game.state !== 'bossdrop') return;
                try { item.apply(game.player); } catch(e) { console.warn('Boss drop apply error:', e); }
                // 登记本局已领取的唯一道具：后续 Boss 掉落池过滤该道具（去重）
                if (game.player) { if (!game.player.takenDrops) game.player.takenDrops = {}; game.player.takenDrops[item.id] = true; }
                bossdropPanel.style.display = 'none';
                bossdropCards.innerHTML = '';
                game.bossDropChoices = null;
                game.state = 'playing';
                game.player.invincibleTimer = 0.5;
            }

            game.applyUpgrade = function(skill) {
                if (game.state !== 'levelup') return;
                if (game.levelupLock > 0) return; // 点击保护
                const player = game.player;
                player['_skill_' + skill.id] = (player['_skill_' + skill.id] || 0) + 1;
                try { skill.apply(player); } catch(e) { console.warn('Skill apply error:', e); }
                levelupPanel.style.display = 'none';
                levelupCards.innerHTML = '';
                game.currentChoices = null;
                game.state = 'playing';
                player.invincibleTimer = 0.4;
            };

            skipBtn.addEventListener('click', () => {
                if (game.state !== 'levelup') return;
                if (game.levelupLock > 0) return; // 点击保护
                if (game.rerollUsed) return;
                const player = game.player;
                game.rerollUsed = true;
                game.currentChoices = generateUpgradeChoices(player);
                if (!game.currentChoices.length) {
                    levelupPanel.style.display = 'none';
                    levelupCards.innerHTML = '';
                    game.currentChoices = null;
                    game.state = 'playing';
                    return;
                }
                levelupCards.innerHTML = '';
                game.currentChoices.forEach((skill, i) => {
                    const card = document.createElement('div');
                    card.className = 'card';
                    const currentLvl = getSkillCurrentLevel(player, skill);
                    card.innerHTML = `<span class="icon">${ICONS[skill.icon] || ''}</span><span class="name">${skill.name}</span><span class="desc">${skill.desc}</span><span class="level-tag">Lv.${currentLvl+1}/${skill.maxLevel}</span>`;
                    card.addEventListener('click', (e) => { e.stopPropagation(); game.applyUpgrade(skill); });
                    card.addEventListener('touchend', (e) => { e.stopPropagation(); e.preventDefault(); game.applyUpgrade(skill); });
                    levelupCards.appendChild(card);
                });
                // 换一批后不设点击保护：玩家刚主动点击按钮，可直接选择新选项
                skipBtn.disabled = true;
                skipBtn.style.opacity = '0.4';
                skipBtn.style.cursor = 'not-allowed';
            });

            skipXpBtn.addEventListener('click', () => {
                if (game.state !== 'levelup') return;
                if (game.levelupLock > 0) return; // 点击保护
                const player = game.player;
                const xpGain = Math.floor(player.xpToNext * 0.5);
                levelupPanel.style.display = 'none';
                levelupCards.innerHTML = '';
                game.currentChoices = null;
                game.state = 'playing';
                player.invincibleTimer = 0.4;
                player.addXp(xpGain);
            });

