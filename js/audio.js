// ============================================================================
//  AUDIO — recorded/baked samples (assets/sfx, see CREDITS.md) with synth fallbacks,
//  convolution reverb, stereo panning by world position, layered ambience.
// ============================================================================
const SFX = ['rain_loop', 'wind_loop', 'drone_loop', 'music_loop', 'thunder_1', 'thunder_2', 'thunder_3', 'creak_door', 'creak_vault', 'creak_floor_1', 'creak_floor_2', 'creak_floor_3',
  'step_1', 'step_2', 'step_3', 'step_4', 'heartbeat', 'sting_1', 'sting_2', 'sting_3', 'riser', 'whisper_1', 'whisper_2', 'whisper_3', 'breath', 'laugh', 'ring_landline', 'ring_mobile', 'slam', 'shutter', 'drip', 'horn'];

export const audio = {
  ctx: null, master: null, enabled: true, buffers: {}, loops: {}, listener: { x: 0, z: 0, yaw: 0 }, level: 0, stepI: 0,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.knee.value = 12;
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 1 : 0; this.master.connect(comp).connect(c.destination);
    const conv = c.createConvolver(); conv.buffer = this.impulse(2.6, 2.2); const wet = c.createGain(); wet.gain.value = 0.4; conv.connect(wet).connect(this.master); this.conv = conv;
    return c;
  },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.setTargetAtTime(v ? 1 : 0, this.ctx.currentTime, 0.05); },
  // ---- sample loading (data-URI fallback via window.__ASSETS, see tools/pack-assets.js) ----
  async load(onProgress) {
    const c = this.init(); if (!c) return; let done = 0;
    await Promise.all(SFX.map(async (n) => { try { const u = 'assets/sfx/' + n + '.mp3'; const r = await fetch((window.__ASSETS && window.__ASSETS[u]) || u); const ab = await r.arrayBuffer(); this.buffers[n] = await new Promise((res, rej) => c.decodeAudioData(ab, res, rej)); } catch (e) { console.warn('sfx missing', n); } done++; onProgress && onProgress(done / SFX.length); }));
  },
  impulse(sec, decay) { const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); } return b; },
  // route: pan by position, dry + reverb send
  out(node, { pos, vol = 1, reverb = 0.5 } = {}) {
    const c = this.ctx; const g = c.createGain(); g.gain.value = vol; let last = node;
    if (pos) { const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z; const dist = Math.hypot(dx, dz); const ang = Math.atan2(dx, -dz) - this.listener.yaw; const pan = c.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, Math.sin(ang) * 0.9)); g.gain.value = vol / (1 + dist * dist * 0.06); last.connect(pan); last = pan; }
    last.connect(g); g.connect(this.master); if (reverb > 0) { const w = c.createGain(); w.gain.value = reverb; g.connect(w).connect(this.conv); } return g;
  },
  play(name, { pos, vol = 1, rate = 1, reverb = 0.5, loop = false, fadeIn = 0 } = {}) {
    const c = this.init(); if (!c) return null; const b = this.buffers[name]; if (!b) return null;
    const s = c.createBufferSource(); s.buffer = b; s.loop = loop; s.playbackRate.value = rate; const g = this.out(s, { pos, vol, reverb });
    if (fadeIn) { const v = g.gain.value; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), c.currentTime + fadeIn); }
    s.start(); return { src: s, gain: g, stop: (t = 0.3) => { try { g.gain.setTargetAtTime(0.0001, c.currentTime, t / 3); s.stop(c.currentTime + t + 0.1); } catch (e) {} } };
  },
  pick(prefix, n) { return prefix + '_' + (1 + Math.floor(Math.random() * n)); },
  // ---- synth fallbacks ----
  tone(f, t, { type = 'sine', vol = 0.2, slide = 0, pos, reverb = 0.5, attack = 0.005 } = {}) { const c = this.init(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, c.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), c.currentTime + t); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(vol, c.currentTime + attack); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t); o.connect(g); this.out(g, { pos, reverb }); o.start(); o.stop(c.currentTime + t + 0.05); },
  noise(t, { vol = 0.3, fq = 400, pos, reverb = 0.5 } = {}) { const c = this.init(); if (!c) return; const n = Math.floor(c.sampleRate * t), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = fq; s.buffer = b; g.gain.value = vol; s.connect(f).connect(g); this.out(g, { pos, reverb }); s.start(); },

  // ---- game sounds ----
  step() { this.stepI = (this.stepI + 1) % 4; if (!this.play('step_' + (this.stepI + 1), { vol: 0.5, rate: 0.95 + Math.random() * 0.1, reverb: 0.7 })) { this.noise(0.1, { vol: 0.2, fq: 900 }); this.tone(75, 0.12, { vol: 0.25, slide: -30 }); } },
  tap() { this.tone(640, 0.04, { type: 'triangle', vol: 0.06, reverb: 0.1 }); },
  tick() { this.tone(1500 + Math.random() * 400, 0.015, { type: 'square', vol: 0.01, reverb: 0 }); },
  ring(pos, mobile = true) { if (!this.play(mobile ? 'ring_mobile' : 'ring_landline', { pos, vol: 0.6, reverb: 0.8 })) this.tone(880, 0.3, { type: 'square', vol: 0.06, pos }); },
  wrong() { if (!this.play('slam', { vol: 1 })) { this.tone(80, 1.2, { type: 'sawtooth', vol: 0.45, slide: -55 }); } this.play(this.pick('sting', 3), { vol: 0.9, rate: 0.9 }); },
  right() { this.tone(330, 0.25, { type: 'triangle', vol: 0.08 }); setTimeout(() => this.tone(440, 0.35, { type: 'triangle', vol: 0.08 }), 130); },
  thunder() { if (!this.play(this.pick('thunder', 3), { vol: 0.8, reverb: 0.2 })) { this.noise(2.4, { vol: 0.7, fq: 180 }); } },
  heartbeat() { if (!this.play('heartbeat', { vol: 0.9, reverb: 0.05 })) { this.tone(58, 0.14, { vol: 0.5 }); } },
  sting(pos) { if (!this.play(this.pick('sting', 3), { vol: 1.0, reverb: 0.6 })) { this.tone(90, 1.2, { type: 'sawtooth', vol: 0.5, slide: -60 }); this.noise(1, { vol: 0.5, fq: 300 }); } },
  riser() { return this.play('riser', { vol: 0.7, reverb: 0.4 }); },
  whisper(pos) { if (!this.play(this.pick('whisper', 3), { pos, vol: 0.8, reverb: 1.2 })) this.noise(0.4, { vol: 0.08, fq: 1800, pos }); },
  breath(pos) { this.play('breath', { pos, vol: 0.7, reverb: 0.3 }); },
  laugh(pos) { if (!this.play('laugh', { pos, vol: 0.9, reverb: 1 })) [300, 250, 200].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, { type: 'sawtooth', vol: 0.14, pos }), i * 150)); },
  creak(pos) { if (!this.play('creak_door', { pos, vol: 0.9, reverb: 1 })) this.tone(120, 1.4, { type: 'sawtooth', vol: 0.1, pos }); },
  vault(pos) { if (!this.play('creak_vault', { pos, vol: 0.9, reverb: 1 })) this.tone(90, 1.4, { type: 'sawtooth', vol: 0.1, pos }); },
  floorCreak(pos) { if (!this.play(this.pick('creak_floor', 3), { pos, vol: 0.8, reverb: 0.8 })) this.tone(140, 0.8, { type: 'sawtooth', vol: 0.06, pos }); },
  drip(pos) { if (!this.play('drip', { pos, vol: 0.4, reverb: 1 })) this.tone(1800, 0.06, { vol: 0.05, slide: -900, pos }); },
  shutter(pos) { if (!this.play('shutter', { pos, vol: 0.8, reverb: 1 })) this.noise(0.5, { vol: 0.3, fq: 500, pos }); },
  horn(pos) { if (!this.play('horn', { pos, vol: 0.45, reverb: 1.2 })) [330, 415].forEach(f => this.tone(f, 0.25, { type: 'square', vol: 0.05, pos })); },
  win() { [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, { type: 'triangle', vol: 0.16 }), i * 140)); },
  fanWhine(on) { const c = this.init(); if (!c) return; if (this.whine) { try { this.whine.o.stop(); } catch (e) {} this.whine = null; } if (!on) return; const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 180; o.frequency.linearRampToValueAtTime(420, c.currentTime + 4); g.gain.value = 0.025; o.connect(g); this.out(g, { reverb: 0.4 }); o.start(); this.whine = { o, g }; },

  // ---- ambience layers: drone + wind + rain + music; `level` 0..2 raises the dread with the nights ----
  startAmbience(level = 0) {
    const c = this.init(); if (!c) return; this.stopAmbience(); this.level = level;
    this.loops.drone = this.play('drone_loop', { loop: true, vol: 0.55 + level * 0.12, reverb: 0.15, fadeIn: 3 });
    this.loops.wind = this.play('wind_loop', { loop: true, vol: 0.28 + level * 0.08, reverb: 0.1, fadeIn: 4 });
    this.loops.rain = this.play('rain_loop', { loop: true, vol: 0.22, reverb: 0.05, fadeIn: 4 });
    this.loops.music = this.play('music_loop', { loop: true, vol: 0.3, reverb: 0.2, fadeIn: 8 });
    if (!this.loops.drone) { // synth fallback hum
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 36; o2.type = 'sine'; o2.frequency.value = 36.6; f.type = 'lowpass'; f.frequency.value = 140; g.gain.value = 0.05; o.connect(f); o2.connect(f); f.connect(g); this.out(g, { reverb: 0.2 }); o.start(); o2.start(); this.loops.synth = { stop: () => { try { o.stop(); o2.stop(); } catch (e) {} } };
    }
  },
  stopAmbience() { Object.values(this.loops).forEach(l => l && l.stop && l.stop(1.2)); this.loops = {}; this.fanWhine(false); },
  setDread(v) { // 0..1: music ducks, drone swells, wind rises
    const c = this.ctx; if (!c) return; const t = c.currentTime; if (this.loops.music) this.loops.music.gain.gain.setTargetAtTime(0.3 * (1 - v * 0.8), t, 0.6); if (this.loops.drone) this.loops.drone.gain.gain.setTargetAtTime(0.55 + v * 0.35, t, 0.6); if (this.loops.wind) this.loops.wind.gain.gain.setTargetAtTime(0.28 + v * 0.3, t, 0.6);
  },
  dip(amount, sec) { if (!this.loops.drone) return; const g = this.loops.drone.gain.gain, t = this.ctx.currentTime, v = g.value; g.setTargetAtTime(v * (1 - amount), t, 0.05); g.setTargetAtTime(v, t + sec, 0.2); },
  hush() { try { speechSynthesis.cancel(); } catch (e) {} },
  say() {},
};
