            // ==================== 幽月魔女专属音频（真实采样） ====================
            // 与 sound 共用同一个 AudioContext 与 masterGain；素材缺失 / 解码失败时静默回退到合成音效，
            // 不阻塞游戏、不抛错。素材授权见 README「音频素材与授权」。
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

                const buffers = {};   // 采样：'s:名字' → AudioBuffer
                const musicBuf = {};  // 音乐：'prelude' / 'theme' → AudioBuffer
                const failed = {};    // 失败标记，避免反复重试
                let loading = false;

                let cur = null;        // 当前音乐实例
                let layerName = null;  // 期望层（静音/未加载时也保留，便于恢复）

                function engine() { return (typeof sound !== 'undefined' && sound._engine) ? sound._engine : null; }
                function bus() {
                    const e = engine(); if (!e) return null;
                    const c = e.getCtx(); const master = e.getGain();
                    if (!c || !master) return null;
                    return { c: c, master: master, e: e };
                }
                function layerVol(layer) { return layer.gain * MUSIC_VOL; }

                function fetchBuffer(key, url) {
                    const e = engine(); if (!e) return Promise.reject(new Error('no engine'));
                    const c = e.ensureCtx(); if (!c) return Promise.reject(new Error('no ctx'));
                    return fetch(url)
                        .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
                        .then(ab => new Promise((res, rej) => {
                            const p = c.decodeAudioData(ab, res, rej); // 兼容回调式实现
                            if (p && p.then) p.then(res, rej);
                        }))
                        .then(buf => { buffers[key] = buf; return buf; });
                }

                // 预载全部素材；音乐优先。任何失败只标记，不抛错。
                function preload() {
                    if (loading) return; loading = true;
                    const jobs = [];
                    for (const k in MUSIC) {
                        if (musicBuf[k] || failed['m:' + k]) continue;
                        jobs.push(fetchBuffer(k, MUSIC[k])
                            .then(buf => { musicBuf[k] = buf; })
                            .catch(() => { failed['m:' + k] = true; musicBuf[k] = null; }));
                    }
                    for (const name in SAMPLES) {
                        if (buffers['s:' + name] || failed['s:' + name]) continue;
                        const urls = SAMPLES[name].slice();
                        const tryNext = () => {
                            if (!urls.length) { failed['s:' + name] = true; buffers['s:' + name] = null; return Promise.resolve(null); }
                            return fetchBuffer('s:' + name, urls.shift()).catch(tryNext);
                        };
                        jobs.push(tryNext());
                    }
                    Promise.all(jobs).then(syncLayer).catch(() => { loading = false; });
                }

                // 播放一次采样；不可用返回 false，由调用方回退到合成音效
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

                // 音效入口：有采样用采样，否则回退合成
                function play(name) {
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
                    const b = bus(); if (!b) return;
                    if (!layerName || cur) return;
                    if (b.e.isMuted()) return;
                    if (!musicBuf[LAYERS[layerName].track]) return;
                    cur = startLayer(LAYERS[layerName], 1.5);
                }

                // 切换音乐层：同层不重启（避免接缝），异层交叉淡化
                function setLayer(name, fade) {
                    if (!LAYERS[name] || layerName === name) return;
                    layerName = name;
                    const b = bus(); if (!b || b.e.isMuted()) return;   // 无音频环境只记状态
                    const f = (fade === undefined) ? XFADE : fade;
                    const next = startLayer(LAYERS[name], f);
                    if (!next) { preload(); return; }   // 音乐未就绪：预载完成后 syncLayer 补播
                    const prev = cur; cur = next;
                    if (prev) fadeOutLayer(prev, f);
                }

                // 强度升级：同曲只抬增益，不换素材、不变调
                function boost(name) {
                    const L = LAYERS[name]; if (!L) return;
                    layerName = name;
                    if (!cur) { syncLayer(); return; }
                    const b = bus(); if (!b || b.e.isMuted()) return;
                    try { cur.gain.gain.linearRampToValueAtTime(layerVol(L), b.c.currentTime + 1.5); } catch(e) {}
                }

                function stop(fade) {
                    const f = (fade === undefined) ? 1.2 : fade;
                    layerName = null;
                    if (!cur) return;
                    const inst = cur; cur = null;
                    fadeOutLayer(inst, f);
                }

                // 静音联动：静音立即压低，取消静音按期望层恢复
                function setMuted(m) {
                    if (m) {
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
                    _state: () => ({ layer: layerName, playing: !!cur, samplesLoaded: Object.keys(buffers).length, musicLoaded: Object.keys(musicBuf).filter(k => !!musicBuf[k]).length }),
                    _samples: SAMPLES,
                    _layers: LAYERS,
                    _musicVol: MUSIC_VOL
                };
            })();
            // 静音按钮同时管住魔女音乐
            if (typeof sound !== 'undefined' && sound._engine && sound._engine.onMute) {
                sound._engine.onMute(moonAudio.setMuted);
            }
