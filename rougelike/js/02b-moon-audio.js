            // ==================== 幽月魔女专属音频（真实采样） ====================
            // 与 sound 共用同一个 AudioContext 与 masterGain；素材缺失 / 解码失败时静默回退到合成音效，
            // 不阻塞游戏、不抛错。素材授权见 README「音频素材与授权」。
            //
            // 三种加载/播放通道，按可用性自动降级：
            //   1. fetch + decodeAudioData —— http(s) 下使用，支持循环、低通分层、drone 叠加（部署环境即此路径）
            //   2. XHR   + decodeAudioData —— fetch 被策略拦截时兜底
            //   3. 原生 <audio> 元素播放   —— file:// 直开（双击 index.html）时使用：
            //      浏览器允许媒体元素读取本地文件，但 MediaElementSource 在 file:// 下会被判为跨源而静音，
            //      故此时直接调元素自身的 play/volume，不做 Web Audio 分层（音量随分层档位变化）
            const moonAudio = (function() {
                const DIR = 'audio/moon/';

                // 音乐层：prelude 用于凝视倒计时→降临→拽入，theme 用于异空间 1v1 战斗
                const MUSIC = { prelude: DIR + 'prelude.ogg', theme: DIR + 'theme.mp3' };
                // 音效层：每个名字给出候选素材，按序尝试；全部失败则由 DEFS 同名合成音效兜底
                const SAMPLES = {
                    moonRumble:  [DIR + 'rumble.ogg'],
                    moonDescend: [DIR + 'impact-2.ogg'],
                    moonPull:    [DIR + 'whoosh.ogg'],
                    moonShield:  [DIR + 'glass-2.wav'],
                    moonBreak:   [DIR + 'shard.ogg', DIR + 'glass-3.wav'],
                    moonShatter: [DIR + 'glass-1.wav'],
                    moonBlade:   [DIR + 'whoosh.ogg'],
                    moonOrb:     [DIR + 'glass-3.wav'],
                    moonBapt:    [DIR + 'bell-toll.mp3'],
                    moonBaptHit: [DIR + 'impact-2.ogg'],
                    moonClone:   [DIR + 'glass-2.wav'],
                    moonWave:    [DIR + 'rumble.ogg'],
                    moonAir:     [DIR + 'whoosh.ogg'],
                    moonRain:    [DIR + 'shard.ogg'],
                    moonSlam:    [DIR + 'impact-1.ogg'],
                    moonToll:    [DIR + 'bell-toll.mp3']
                };
                // 音效播放增益：整体压得较低，避免在紧张段落里炸响
                const VOLS = {
                    moonRumble: 0.30, moonDescend: 0.42, moonPull: 0.30, moonShield: 0.26, moonBreak: 0.30,
                    moonShatter: 0.42, moonBlade: 0.20, moonOrb: 0.24, moonBapt: 0.26, moonBaptHit: 0.34,
                    moonClone: 0.24, moonWave: 0.34, moonAir: 0.30, moonRain: 0.20, moonSlam: 0.42, moonToll: 0.32
                };

                // 音乐总音量：所有音乐层最终再乘这个系数，是「整体太大声」时的唯一调节点
                const MUSIC_VOL = 0.20;
                // 音乐分层：低通截止 / 相对增益 / 播放速率。
                // 刻意不做降速失谐与低八度 drone 叠加——那会带来阴森诡异感，强度只靠增益与低通表达。
                const LAYERS = {
                    gaze:     { track: 'prelude', filter: 1400,  gain: 0.55, rate: 1.0 },
                    descend:  { track: 'prelude', filter: 3200,  gain: 0.70, rate: 1.0 },
                    domain:   { track: 'theme',   filter: 20000, gain: 1.00, rate: 1.0 },
                    domainP2: { track: 'theme',   filter: 20000, gain: 1.08, rate: 1.0 },
                    verdict:  { track: 'theme',   filter: 20000, gain: 1.12, rate: 1.0 }
                };
                const XFADE = 2.5;   // 换层交叉淡化秒数

                const buffers = {};   // 's:名字' / 音乐名 → AudioBuffer（通道 1/2）
                const musicBuf = {};  // prelude / theme → AudioBuffer
                const failed = {};    // 失败标记，避免反复重试
                const els = {};       // url → HTMLAudioElement（通道 3）
                let loading = false;
                let mode = null;      // 'buffer' | 'element'，决定播放走哪条通道

                let cur = null;        // 当前音乐实例（buffer 通道）
                let elMusic = null;    // 当前音乐元素与状态（element 通道）
                let layerName = null;  // 期望层（静音/未加载时也保留，便于恢复）

                function engine() { return (typeof sound !== 'undefined' && sound._engine) ? sound._engine : null; }
                function bus() {
                    const e = engine(); if (!e) return null;
                    const c = e.getCtx(); const master = e.getGain();
                    if (!c || !master) return null;
                    return { c: c, master: master, e: e };
                }
                function layerVol(layer) { return layer.gain * MUSIC_VOL; }
                function isMuted() { const e = engine(); return e ? e.isMuted() : false; }

                // http(s) 下才允许 fetch 读文件；file:// 会被安全策略拦截
                function canFetch() {
                    try { const p = window.location && window.location.protocol; return p === 'http:' || p === 'https:' || p === 'blob:'; }
                    catch (e) { return false; }
                }

                function xhrArrayBuffer(url) {
                    return new Promise((resolve, reject) => {
                        try {
                            const xhr = new XMLHttpRequest();
                            xhr.open('GET', url, true);
                            xhr.responseType = 'arraybuffer';
                            xhr.onload = () => {
                                if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) resolve(xhr.response);
                                else reject(new Error('xhr ' + xhr.status));
                            };
                            xhr.onerror = () => reject(new Error('xhr error'));
                            xhr.send();
                        } catch (e) { reject(e); }
                    });
                }

                // 读取素材字节：优先 fetch，失败退回 XHR
                function readArrayBuffer(url) {
                    if (!canFetch()) return xhrArrayBuffer(url);
                    return fetch(url)
                        .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
                        .catch(() => xhrArrayBuffer(url));
                }

                function decodeInto(c, ab) {
                    return new Promise((res, rej) => {
                        const p = c.decodeAudioData(ab, res, rej); // 兼容回调式实现
                        if (p && p.then) p.then(res, rej);
                    });
                }

                function loadBuffer(url) {
                    const e = engine(); if (!e) return Promise.reject(new Error('no engine'));
                    const c = e.ensureCtx(); if (!c) return Promise.reject(new Error('no ctx'));
                    return readArrayBuffer(url).then(ab => decodeInto(c, ab));
                }

                // 通道 3：原生 <audio>。仅做可用性探测与元素缓存，实际播放用元素自身。
                function loadElement(url) {
                    if (els[url] !== undefined) return Promise.resolve(els[url]);
                    return new Promise(resolve => {
                        let el;
                        try { el = new Audio(); } catch (e) { els[url] = null; return resolve(null); }
                        let settled = false;
                        const done = (ok) => {
                            if (settled) return; settled = true;
                            els[url] = ok ? el : null;
                            resolve(els[url]);
                        };
                        el.preload = 'auto';
                        el.addEventListener('canplaythrough', () => done(true), { once: true });
                        el.addEventListener('loadeddata', () => done(true), { once: true });
                        el.addEventListener('error', () => done(false), { once: true });
                        el.src = url;
                        try { el.load(); } catch (e) { done(false); }
                        // 兜底：3 秒内没有任何事件则判定失败
                        setTimeout(() => done(false), 3000);
                    });
                }

                // 预载全部素材；音乐优先。任何失败只标记，不抛错。
                function preload() {
                    if (loading) return; loading = true;
                    const jobs = [];
                    for (const k in MUSIC) {
                        if (musicBuf[k] || failed['m:' + k]) continue;
                        jobs.push(loadBuffer(MUSIC[k])
                            .then(buf => { musicBuf[k] = buf; })
                            .catch(() => { failed['m:' + k] = true; musicBuf[k] = null; }));
                    }
                    for (const name in SAMPLES) {
                        if (buffers['s:' + name] || failed['s:' + name]) continue;
                        const urls = SAMPLES[name].slice();
                        const tryNext = () => {
                            if (!urls.length) { failed['s:' + name] = true; buffers['s:' + name] = null; return Promise.resolve(null); }
                            const url = urls.shift();
                            return loadBuffer(url)
                                .then(buf => { buffers['s:' + name] = buf; })
                                .catch(tryNext);
                        };
                        jobs.push(tryNext());
                    }
                    Promise.all(jobs).then(() => {
                        // 字节通道全军覆没（典型：双击 index.html 的 file://）→ 切原生元素通道
                        if (!musicBuf.prelude && !musicBuf.theme) {
                            mode = 'element';
                            return Promise.all(Object.keys(MUSIC).map(k => loadElement(MUSIC[k])));
                        }
                        mode = 'buffer';
                        return null;
                    }).then(syncLayer).catch(() => {});
                }

                // ===== 通道 3：原生元素播放（file://） =====
                function elLayerVol(layer) { return Math.min(1, layerVol(layer)); }

                function fadeEl(el, target, dur, onDone) {
                    if (!el) return;
                    const from = el.volume, t0 = performance.now();
                    const step = () => {
                        const k = dur <= 0 ? 1 : Math.min(1, (performance.now() - t0) / (dur * 1000));
                        el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
                        if (k < 1) el.__fadeTimer = setTimeout(step, 40);
                        else { el.__fadeTimer = null; if (onDone) onDone(); }
                    };
                    if (el.__fadeTimer) clearTimeout(el.__fadeTimer);
                    step();
                }

                function elStartLayer(layer, fade) {
                    const url = MUSIC[layer.track];
                    const el = els[url];
                    if (!el) return null;
                    el.loop = true;
                    el.volume = 0;
                    try { el.playbackRate = layer.rate; } catch (e) {}
                    const p = el.play();
                    if (p && p.catch) p.catch(() => {});   // 未获手势许可时静默等待
                    fadeEl(el, isMuted() ? 0 : elLayerVol(layer), fade);
                    return el;
                }

                function elStop(el, fade) {
                    if (!el) return;
                    fadeEl(el, 0, fade, () => { try { el.pause(); } catch (e) {} });
                }

                // ===== 通道 1/2：AudioBuffer 播放 =====
                function playSample(name) {
                    const b = bus(); if (!b || b.e.isMuted()) return false;
                    const buf = buffers['s:' + name]; if (!buf) return false;
                    const c = b.c; if (c.state !== 'running') return false;
                    const src = c.createBufferSource();
                    const g = c.createGain();
                    src.buffer = buf;
                    g.gain.value = VOLS[name] || 0.3;
                    src.connect(g); g.connect(b.master);
                    src.start(0);
                    return true;
                }

                // 元素通道的音效：复制节点播放，避免相互打断
                function playSampleEl(name) {
                    if (isMuted()) return false;
                    const urls = SAMPLES[name]; if (!urls || !urls.length) return false;
                    const el = els[urls[0]];
                    if (!el) return false;
                    try {
                        const node = el.cloneNode();
                        node.volume = Math.min(1, (VOLS[name] || 0.3) * 2);  // 元素无 master 增益，补偿一倍
                        const p = node.play();
                        if (p && p.catch) p.catch(() => {});
                        return true;
                    } catch (e) { return false; }
                }

                // 音效入口：优先采样，其次原生元素，最后回退合成音效
                function play(name) {
                    if (mode !== 'element' && playSample(name)) return;
                    if (mode === 'element' && playSampleEl(name)) return;
                    if (playSample(name)) return;
                    if (typeof sound !== 'undefined' && sound.play) sound.play(name);
                }

                function startLayer(layer, fade) {
                    const b = bus(); if (!b) return null;
                    const c = b.c, master = b.master;
                    const buf = musicBuf[layer.track]; if (!buf) return null;
                    const t0 = c.currentTime;
                    const filter = c.createBiquadFilter();
                    filter.type = 'lowpass'; filter.frequency.value = layer.filter;
                    const g = c.createGain();
                    const vol = layerVol(layer);
                    g.gain.setValueAtTime(0.0001, t0);
                    g.gain.linearRampToValueAtTime(vol, t0 + fade);
                    filter.connect(g); g.connect(master);

                    const src = c.createBufferSource();
                    src.buffer = buf; src.loop = true; src.playbackRate.value = layer.rate;
                    src.connect(filter); src.start(t0);
                    return { src: src, gain: g, filter: filter, layer: layer };
                }

                function fadeOutLayer(inst, fade) {
                    if (!inst) return;
                    const b = bus(); if (!b) return;
                    const c = b.c, t0 = c.currentTime;
                    try {
                        inst.gain.gain.cancelScheduledValues(t0);
                        inst.gain.gain.setValueAtTime(Math.max(0.0001, inst.gain.gain.value), t0);
                        inst.gain.gain.linearRampToValueAtTime(0.0001, t0 + fade);
                    } catch(e) {}
                    setTimeout(() => {
                        try { inst.src.stop(); } catch(e) {}
                    }, Math.max(0, (t0 + fade + 0.15) * 1000 - performance.now()));
                }

                // 让实际播放追上期望层（预载完成 / 取消静音后调用）
                function syncLayer() {
                    if (!layerName || isMuted()) return;
                    if (mode === 'element') {
                        const want = MUSIC[LAYERS[layerName].track];
                        if (elMusic && elMusic.url === want && !elMusic.el.paused) return;
                        if (elMusic) elStop(elMusic.el, 1.5);
                        const el = elStartLayer(LAYERS[layerName], 1.5);
                        elMusic = el ? { el: el, url: want } : null;
                        return;
                    }
                    if (cur) return;
                    if (!musicBuf[LAYERS[layerName].track]) return;
                    cur = startLayer(LAYERS[layerName], 1.5);
                }

                // 切换音乐层：同层不重启（避免接缝），异层交叉淡化
                function setLayer(name, fade) {
                    if (!LAYERS[name] || layerName === name) return;
                    layerName = name;
                    if (isMuted()) return;                    // 无音频环境 / 静音：只记状态
                    const f = (fade === undefined) ? XFADE : fade;
                    if (mode === 'element') {
                        const want = MUSIC[LAYERS[name].track];
                        if (!els[want]) { preload(); return; }
                        if (elMusic && elMusic.url === want) {
                            fadeEl(elMusic.el, elLayerVol(LAYERS[name]), f);   // 同曲换档：只调音量
                            return;
                        }
                        if (elMusic) elStop(elMusic.el, f);
                        const el = elStartLayer(LAYERS[name], f);
                        elMusic = el ? { el: el, url: want } : null;
                        return;
                    }
                    const next = startLayer(LAYERS[name], f);
                    if (!next) { preload(); return; }         // 音乐未就绪：预载完成后 syncLayer 补播
                    const prev = cur; cur = next;
                    if (prev) fadeOutLayer(prev, f);
                }

                // 强度升级：同曲只抬增益，不换素材、不变调
                function boost(name) {
                    const L = LAYERS[name]; if (!L) return;
                    layerName = name;
                    if (isMuted()) return;
                    if (mode === 'element') {
                        if (elMusic) fadeEl(elMusic.el, elLayerVol(L), 1.5);
                        else syncLayer();
                        return;
                    }
                    if (!cur) { syncLayer(); return; }
                    const b = bus(); if (!b) return;
                    try { cur.gain.gain.linearRampToValueAtTime(layerVol(L), b.c.currentTime + 1.5); } catch(e) {}
                }

                function stop(fade) {
                    const f = (fade === undefined) ? 1.2 : fade;
                    layerName = null;
                    if (mode === 'element') {
                        if (elMusic) { elStop(elMusic.el, f); elMusic = null; }
                        return;
                    }
                    if (!cur) return;
                    const inst = cur; cur = null;
                    fadeOutLayer(inst, f);
                }

                // 静音联动：静音立即压低，取消静音按期望层恢复
                function setMuted(m) {
                    if (m) {
                        if (mode === 'element') { if (elMusic) fadeEl(elMusic.el, 0, 0.25); return; }
                        if (cur) { const inst = cur; cur = null; fadeOutLayer(inst, 0.25); }
                    } else {
                        syncLayer();
                    }
                }

                return {
                    preload: preload,
                    play: play,
                    setLayer: setLayer,
                    boost: boost,
                    stop: stop,
                    setMuted: setMuted,
                    sting: play,
                    // 调试 / 测试读取
                    _state: () => ({
                        layer: layerName,
                        playing: mode === 'element' ? !!(elMusic && !elMusic.el.paused) : !!cur,
                        mode: mode,
                        samplesLoaded: Object.keys(buffers).length,
                        musicLoaded: Object.keys(musicBuf).filter(k => !!musicBuf[k]).length
                    }),
                    _samples: SAMPLES,
                    _layers: LAYERS,
                    _musicVol: MUSIC_VOL
                };
            })();
            // 静音按钮同时管住魔女音乐
            if (typeof sound !== 'undefined' && sound._engine && sound._engine.onMute) {
                sound._engine.onMute(moonAudio.setMuted);
            }
