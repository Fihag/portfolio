            // ==================== DOM 元素 ====================
            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            const wrapper = document.getElementById('game-wrapper');
            const levelupPanel = document.getElementById('levelup-panel');
            const levelupCards = document.getElementById('levelup-cards');
            const skipBtn = document.getElementById('skip-upgrade');
            const skipXpBtn = document.getElementById('skip-xp');
            const gameoverOverlay = document.getElementById('gameover-overlay');
            const bossdropPanel = document.getElementById('bossdrop-panel');
            const bossdropCards = document.getElementById('bossdrop-cards');
            const restartBtn = document.getElementById('restart-btn');
            const goTime = document.getElementById('go-time');
            const goKills = document.getElementById('go-kills');
            const goLevel = document.getElementById('go-level');
            const goDamage = document.getElementById('go-damage');
            const goShards = document.getElementById('go-shards');
            const goBestTime = document.getElementById('go-best-time');
            const goBestKills = document.getElementById('go-best-kills');
            const goNewRecord = document.getElementById('go-newrecord');
            const btnPause = document.getElementById('btn-pause');
            const btnMute = document.getElementById('btn-mute');
            const btnFs = document.getElementById('btn-fs');
            const fsToast = document.getElementById('fs-toast');
            const btnDeathMark = document.getElementById('btn-death-mark');
            const pauseMenuBtn = document.getElementById('pause-menu-btn');
            const pauseRestartBtn = document.getElementById('pause-restart-btn');
            const pauseResumeBtn = document.getElementById('pause-resume-btn');
            const dmBuyModal = document.getElementById('dm-buy-modal');
            const dmBuyCancel = document.getElementById('dm-buy-cancel');
            const dmBuyConfirm = document.getElementById('dm-buy-confirm');
            const hudHpFill = document.getElementById('hud-hp-fill');
            const hudHpText = document.getElementById('hud-hp-text');
            const hudXpFill = document.getElementById('hud-xp-fill');
            const hudXpText = document.getElementById('hud-xp-text');
            const hudTime = document.getElementById('hud-time');
            const hudKills = document.getElementById('hud-kills');
            const hudBoss = document.getElementById('hud-boss');
            const hudBossName = document.getElementById('hud-boss-name');
            const hudBossFill = document.getElementById('hud-boss-fill');
            const hudShield = document.getElementById('hud-shield');
            const hudWeps = document.getElementById('hud-weps');
            const hudWarning = document.getElementById('hud-warning');
            const hudHint = document.getElementById('hud-hint');
            const pauseOverlay = document.getElementById('pause-overlay');
            const menuOverlay = document.getElementById('menu-overlay');
            const menuDiffs = document.getElementById('menu-diffs');
            const menuWeapons = document.getElementById('menu-weapons');
            const menuBest = document.getElementById('menu-best');
            const menuShards = document.getElementById('menu-shards');
            const btnOpenMeta = document.getElementById('btn-open-meta');
            const metaPanel = document.getElementById('meta-panel');
            const metaShardsShow = document.getElementById('meta-shards-show');
            const metaList = document.getElementById('meta-list');
            const metaClose = document.getElementById('meta-close');
            const metaReset = document.getElementById('meta-reset');
            const metaTabTalent = document.getElementById('meta-tab-talent');
            const metaTabRelic = document.getElementById('meta-tab-relic');
            const menuStart = document.getElementById('menu-start');
            const menuBtn = document.getElementById('menu-btn');
            const hudTop = document.getElementById('hud-top');

            // ===== 开源图标 (Lucide, ISC License) =====
            const ICONS = {
            'flame': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-flame\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\" /></svg>',
            'timer': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-timer\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /> <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /> <circle cx=\"12\" cy=\"14\" r=\"8\" /></svg>',
            'sparkles': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-sparkles\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /> <path d=\"M20 2v4\" /> <path d=\"M22 4h-4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" /></svg>',
            'swords': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-swords\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <polyline points=\"14.5 17.5 3 6 3 3 6 3 17.5 14.5\" /> <line x1=\"13\" x2=\"19\" y1=\"19\" y2=\"13\" /> <line x1=\"16\" x2=\"20\" y1=\"16\" y2=\"20\" /> <line x1=\"19\" x2=\"21\" y1=\"21\" y2=\"19\" /> <polyline points=\"14.5 6.5 18 3 21 3 21 6 17.5 9.5\" /> <line x1=\"5\" x2=\"9\" y1=\"14\" y2=\"18\" /> <line x1=\"7\" x2=\"4\" y1=\"17\" y2=\"20\" /> <line x1=\"3\" x2=\"5\" y1=\"19\" y2=\"21\" /></svg>',
            'copy-plus': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-copy-plus\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <line x1=\"15\" x2=\"15\" y1=\"12\" y2=\"18\" /> <line x1=\"12\" x2=\"18\" y1=\"15\" y2=\"15\" /> <rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /> <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" /></svg>',
            'gem': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-gem\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M10.5 3 8 9l4 13 4-13-2.5-6\" /> <path d=\"M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z\" /> <path d=\"M2 9h20\" /></svg>',
            'gauge': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-gauge\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m12 14 4-4\" /> <path d=\"M3.34 19a10 10 0 1 1 17.32 0\" /></svg>',
            'snowflake': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-snowflake\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m10 20-1.25-2.5L6 18\" /> <path d=\"M10 4 8.75 6.5 6 6\" /> <path d=\"m14 20 1.25-2.5L18 18\" /> <path d=\"m14 4 1.25 2.5L18 6\" /> <path d=\"m17 21-3-6h-4\" /> <path d=\"m17 3-3 6 1.5 3\" /> <path d=\"M2 12h6.5L10 9\" /> <path d=\"m20 10-1.5 2 1.5 2\" /> <path d=\"M22 12h-6.5L14 15\" /> <path d=\"m4 10 1.5 2L4 14\" /> <path d=\"m7 21 3-6-1.5-3\" /> <path d=\"m7 3 3 6h4\" /></svg>',
            'waves': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-waves\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M2 12q2.5 2 5 0t5 0 5 0 5 0\" /> <path d=\"M2 19q2.5 2 5 0t5 0 5 0 5 0\" /> <path d=\"M2 5q2.5 2 5 0t5 0 5 0 5 0\" /></svg>',
            'thermometer-snowflake': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-thermometer-snowflake\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m10 20-1.25-2.5L6 18\" /> <path d=\"M10 4 8.75 6.5 6 6\" /> <path d=\"M10.585 15H10\" /> <path d=\"M2 12h6.5L10 9\" /> <path d=\"M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z\" /> <path d=\"m4 10 1.5 2L4 14\" /> <path d=\"m7 21 3-6-1.5-3\" /> <path d=\"m7 3 3 6h2\" /></svg>',
            'crosshair': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-crosshair\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"10\" /> <line x1=\"22\" x2=\"18\" y1=\"12\" y2=\"12\" /> <line x1=\"6\" x2=\"2\" y1=\"12\" y2=\"12\" /> <line x1=\"12\" x2=\"12\" y1=\"6\" y2=\"2\" /> <line x1=\"12\" x2=\"12\" y1=\"22\" y2=\"18\" /></svg>',
            'heart': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-heart\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\" /></svg>',
            'footprints': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-footprints\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\" /> <path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\" /> <path d=\"M16 17h4\" /> <path d=\"M4 13h4\" /></svg>',
            'magnet': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-magnet\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m12 15 4 4\" /> <path d=\"M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z\" /> <path d=\"m5 8 4 4\" /></svg>',
            'heart-pulse': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-heart-pulse\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\" /> <path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\" /></svg>',
            'shield': '<!-- @license lucide-static v1.29.0 - ISC --><svg class=\"lucide lucide-shield\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /></svg>',
            'zap': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-zap\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" /></svg>',
            'link': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-link\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" /> <path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" /></svg>',
            'radio': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-radio\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M16.247 7.761a6 6 0 0 1 0 8.478\" /> <path d=\"M19.075 4.933a10 10 0 0 1 0 14.134\" /> <path d=\"M4.925 19.067a10 10 0 0 1 0-14.134\" /> <path d=\"M7.753 16.239a6 6 0 0 1 0-8.478\" /> <circle cx=\"12\" cy=\"12\" r=\"2\" /></svg>',
            'battery-full': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-battery-full\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M10 10v4\" /> <path d=\"M14 10v4\" /> <path d=\"M22 14v-4\" /> <path d=\"M6 10v4\" /> <rect x=\"2\" y=\"6\" width=\"16\" height=\"12\" rx=\"2\" /></svg>',
            'orbit': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-orbit\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M20.341 6.484A10 10 0 0 1 10.266 21.85\" /> <path d=\"M3.659 17.516A10 10 0 0 1 13.74 2.152\" /> <circle cx=\"12\" cy=\"12\" r=\"3\" /> <circle cx=\"19\" cy=\"5\" r=\"2\" /> <circle cx=\"5\" cy=\"19\" r=\"2\" /></svg>',
            'expand': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-expand\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m15 15 6 6\" /> <path d=\"m15 9 6-6\" /> <path d=\"M21 16v5h-5\" /> <path d=\"M21 8V3h-5\" /> <path d=\"M3 16v5h5\" /> <path d=\"m3 21 6-6\" /> <path d=\"M3 8V3h5\" /> <path d=\"M9 9 3 3\" /></svg>',
            'compress': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-compress\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m8 3 4 4 4-4\" /> <path d=\"M8 21l4-4 4 4\" /> <path d=\"m3 8 4 4-4 4\" /> <path d=\"M21 8l-4 4 4 4\" /></svg>',
            'copy': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-copy\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /> <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" /></svg>',
            'ghost': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-ghost\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M9 10h.01\" /> <path d=\"M15 10h.01\" /> <path d=\"M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z\" /></svg>',
            'users': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-users\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /> <path d=\"M16 3.128a4 4 0 0 1 0 7.744\" /> <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /> <circle cx=\"9\" cy=\"7\" r=\"4\" /></svg>',
            'skull': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-skull\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m12.5 17-.5-1-.5 1h1z\" /> <path d=\"M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z\" /> <circle cx=\"15\" cy=\"12\" r=\"1\" /> <circle cx=\"9\" cy=\"12\" r=\"1\" /></svg>',
            'network': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-network\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /> <rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\" /> <rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1\" /> <path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\" /> <path d=\"M12 12V8\" /></svg>',
            'target': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-target\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"10\" /> <circle cx=\"12\" cy=\"12\" r=\"6\" /> <circle cx=\"12\" cy=\"12\" r=\"2\" /></svg>',
            'cloud-lightning': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-cloud-lightning\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973\" /> <path d=\"m13 12-3 5h4l-3 5\" /></svg>',
            'stars': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-stars\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /> <path d=\"M20 2v4\" /> <path d=\"M22 4h-4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" /></svg>',
            'wind': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-wind\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M12.8 19.6A2 2 0 1 0 14 16H2\" /> <path d=\"M17.5 8a2.5 2.5 0 1 1 2 4H2\" /> <path d=\"M9.8 4.4A2 2 0 1 1 11 8H2\" /></svg>',
            'bomb': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-bomb\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"11\" cy=\"13\" r=\"9\" /> <path d=\"M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95\" /> <path d=\"m22 2-1.5 1.5\" /></svg>',
            'shield-half': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-shield-half\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /> <path d=\"M12 22V2\" /></svg>',
            'clock': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-clock\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 6v6l4 2\" /></svg>',
            'pause': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-pause\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <rect x=\"14\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\" /> <rect x=\"5\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\" /></svg>',
            'play': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-play\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\" /></svg>',
            'volume-2': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-volume-2\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /> <path d=\"M16 9a5 5 0 0 1 0 6\" /> <path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\" /></svg>',
            'volume-x': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-volume-x\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /> <line x1=\"22\" x2=\"16\" y1=\"9\" y2=\"15\" /> <line x1=\"16\" x2=\"22\" y1=\"9\" y2=\"15\" /></svg>',
            'wrench': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-wrench\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\" /></svg>',
            'x': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-x\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" /></svg>',
            'trending-up': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-trending-up\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M16 7h6v6\" /> <path d=\"m22 7-8.5 8.5-5-5L2 17\" /></svg>',
            'gift': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-gift\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M12 7v14\" /> <path d=\"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\" /> <path d=\"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5\" /> <rect x=\"3\" y=\"7\" width=\"18\" height=\"4\" rx=\"1\" /></svg>',
            'rotate-ccw': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-rotate-ccw\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /> <path d=\"M3 3v5h5\" /></svg>',
            'shuffle': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-shuffle\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"m18 14 4 4-4 4\" /> <path d=\"m18 2 4 4-4 4\" /> <path d=\"M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22\" /> <path d=\"M2 6h1.972a4 4 0 0 1 3.6 2.2\" /> <path d=\"M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45\" /></svg>',
            'coins': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-coins\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M13.744 17.736a6 6 0 1 1-7.48-7.48\" /> <path d=\"M15 6h1v4\" /> <path d=\"m6.134 14.768.866-.5 2 3.464\" /> <circle cx=\"16\" cy=\"8\" r=\"6\" /></svg>',
            'trophy': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-trophy\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <path d=\"M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2\" /> <path d=\"M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2\" /> <path d=\"M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3\" /> <path d=\"M4 22h16\" /> <path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\" /> <path d=\"M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3\" /></svg>',
            'gamepad-2': '<!-- @license lucide-static v1.30.0 - ISC --><svg class=\"lucide lucide-gamepad-2\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"> <line x1=\"6\" x2=\"10\" y1=\"11\" y2=\"11\" /> <line x1=\"8\" x2=\"8\" y1=\"9\" y2=\"13\" /> <line x1=\"15\" x2=\"15.01\" y1=\"12\" y2=\"12\" /> <line x1=\"18\" x2=\"18.01\" y1=\"10\" y2=\"10\" /> <path d=\"M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z\" /></svg>',
        };
            function initIcons() {
                document.querySelectorAll('[data-ico]').forEach(el => {
                    const svg = ICONS[el.dataset.ico];
                    if (svg) el.innerHTML = svg;
                });
            }

            let W, H;

            // ===== 世界尺寸与镜头（世界固定大于视口，镜头跟随玩家，大小屏难度一致） =====
            const WORLD_W = 2000, WORLD_H = 1500;
            const cam = { x: 0, y: 0 };
            // 像素缩放（devicePixelRatio，上限 2）：draw 每帧据此重置变换，避免上一帧残余变换导致清屏错位/残影
            let PIXEL_SCALE = 1;

            function resizeCanvas() {
                const rect = wrapper.getBoundingClientRect();
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const nw = rect.width, nh = rect.height;
                PIXEL_SCALE = dpr;
                if (nw === W && nh === H && canvas.width === nw * dpr && canvas.height === nh * dpr) return;
                W = nw;
                H = nh;
                canvas.width = W * dpr;
                canvas.height = H * dpr;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            }
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();


// ==================== 全局工具 / 状态（供所有模块顶层引用） ====================
const $inp = (id) => document.getElementById(id);

// ==================== 游戏状态 ====================
            // ==================== 游戏状态 ====================
            const game = {
                state: 'menu', selectedDifficulty: 'normal', selectedWeapon: 'magic_missile', diffMult: 1,
                player: null, enemies: [], projectiles: [], experienceOrbs: [],
                time: 0, score: 0, kills: 0, totalDamageDealt: 0, spawnTimer: 0, spawnInterval: 1.3,
                difficultyLevel: 1, currentChoices: null, waveNoteShown: {}, upgradeCount: 0,
                bossTimer: 90, bossAppearedCount: 0, bossOnField: false,
                bossWarnTimer: 0, superBossDelay: 0, levelupLock: 0, pendingSuperBoss: false,
                warningText: '', warningTimer: 0,
                fireZones: [], // 炎术士死亡火焰区域
                                chainLightningVisuals: [], // 闪电链视觉效果
                burningZones: [], // 星落燃烧区域
                shadowZones: [], // 暗影刺客残影减速区域
                shadowTrails: [], // 暗影刺客瞬移拖影
                bossDropChoices: null,
                bossDropPending: false,
                runId: 0,
                soulShards: 0,
                waveTimer: 60, waveState: 'idle', waveEliteLeft: 0, waveNoticeTimer: 0,
                chests: [],
                bombTimer: 0,
                altars: [], altarTimer: 45,
                superBossSpawned: false, bossKilledCount: 0,
                achievements: {},
                meteorVisuals: [],
                noBossDrop: false,
                deathMark: {
                    enabled: false, mode: 'auto',
                    targets: [], markDuration: 0.5
                },
                rings: [], levelFlash: 0, flashWhite: 0
            };


// ==================== 全局 Debug 状态基础对象（debug.js 面板增强，两版本共用） ====================
const dbg = {
    active: false, timeScale: 1, pauseGame: false, pauseSpawn: false,
    enemyHpMult: 1, enemyDmgMult: 1, enemySpeedMult: 1, fps: 60
};