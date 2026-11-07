// ============================================================================
//  AUDIO — fully synthesized (no files): reverb, ambience, spatialised SFX.
// ============================================================================
export const audio = {
  ctx: null, master: null, wet: null, dry: null, enabled: true, ambience: null, listener: { x: 0, z: 0, yaw: 0 },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(comp).connect(c.destination);
    // reverb (synthesised impulse)
    const conv = c.createConvolver(); conv.buffer = this.impulse(2.6, 2.2); this.wet = c.createGain(); this.wet.gain.value = 0.38;
    conv.connect(this.wet).connect(this.master);
    this.conv = conv; this.dry = this.master;
    return c;
  },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.setTargetAtTime(v ? 1 : 0, this.ctx.currentTime, 0.05); },
  impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); }
    return b;
  },
  // route a node: dry + reverb, with stereo pan by world position (optional)
  out(node, { pos, vol = 1, reverb = 1 } = {}) {
    const c = this.ctx; const g = c.createGain(); g.gain.value = vol;
    let last = node;
    if (pos) {
      const dx = pos.x - this.listener.x, dz = pos.z - this.listener.z; const dist = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, -dz) - this.listener.yaw; // relative bearing
      const pan = c.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, Math.sin(ang)));
      g.gain.value = vol / (1 + dist * dist * 0.08);
      last.connect(pan); last = pan;
    }
    last.connect(g); g.connect(this.dry); if (reverb > 0) { const w = c.createGain(); w.gain.value = reverb; g.connect(w).connect(this.conv); }
    return g;
  },
  tone(f, t, { type = 'sine', vol = 0.2, slide = 0, pos, reverb = 0.6, attack = 0.005 } = {}) {
    const c = this.init(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), c.currentTime + t);
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(vol, c.currentTime + attack); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t);
    o.connect(g); this.out(g, { pos, reverb }); o.start(); o.stop(c.currentTime + t + 0.05);
  },
  noise(t, { vol = 0.3, fq = 400, q = 0.7, type = 'lowpass', pos, reverb = 0.6, attack = 0.005 } = {}) {
    const c = this.init(); if (!c) return;
    const n = Math.floor(c.sampleRate * t), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = type; f.frequency.value = fq; f.Q.value = q; s.buffer = b;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
    s.connect(f).connect(g); this.out(g, { pos, reverb }); s.start();
  },

  // ---- SFX ----
  step(i = 0) { const c = this.init(); if (!c) return; this.noise(0.12, { vol: 0.22, fq: 700 + Math.random() * 300, reverb: 0.9 }); this.tone(70 + Math.random() * 20, 0.12, { vol: 0.25, slide: -30, reverb: 0.5 }); },
  tap() { this.tone(640, 0.04, { type: 'triangle', vol: 0.07, reverb: 0.1 }); },
  tick() { this.tone(1500 + Math.random() * 400, 0.015, { type: 'square', vol: 0.012, reverb: 0 }); },
  ring(pos) { const c = this.init(); if (!c) return; for (let k = 0; k < 2; k++) [0, 0.2, 0.4].forEach(d => setTimeout(() => { this.tone(880, 0.13, { type: 'square', vol: 0.06, pos, reverb: 0.8 }); this.tone(1175, 0.13, { type: 'square', vol: 0.045, pos, reverb: 0.8 }); }, (d + k * 1.3) * 1000)); },
  wrong() { this.tone(80, 1.2, { type: 'sawtooth', vol: 0.45, slide: -55 }); this.noise(1.0, { vol: 0.5, fq: 250 }); this.tone(55, 1.6, { vol: 0.5 }); },
  right() { this.tone(330, 0.25, { type: 'triangle', vol: 0.1 }); setTimeout(() => this.tone(440, 0.35, { type: 'triangle', vol: 0.1 }), 130); },
  thunder() { this.noise(2.4, { vol: 0.7, fq: 180 }); this.tone(42, 2.2, { vol: 0.5 }); setTimeout(() => this.noise(1.6, { vol: 0.35, fq: 120 }), 500); },
  heartbeat() { this.tone(58, 0.14, { vol: 0.55, reverb: 0.1 }); setTimeout(() => this.tone(52, 0.16, { vol: 0.45, reverb: 0.1 }), 170); },
  win() { [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, { type: 'triangle', vol: 0.18 }), i * 140)); },
  laugh(pos) { [300, 250, 200, 170, 150].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, { type: 'sawtooth', vol: 0.14, slide: -40, pos, reverb: 1 }), i * 150)); },
  creak(pos) { const c = this.init(); if (!c) return; const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, c.currentTime); o.frequency.linearRampToValueAtTime(140, c.currentTime + 1.4); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 6; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.6); o.connect(f).connect(g); this.out(g, { pos, reverb: 1 }); o.start(); o.stop(c.currentTime + 1.7); },
  whisper(pos) { const c = this.init(); if (!c) return; for (let i = 0; i < 5; i++) setTimeout(() => this.noise(0.25 + Math.random() * 0.3, { vol: 0.08, fq: 1200 + Math.random() * 1800, q: 8, type: 'bandpass', pos, reverb: 1.2 }), i * 260); },
  drip(pos) { this.tone(1800, 0.06, { vol: 0.05, slide: -900, pos, reverb: 1 }); },
  shutter(pos) { this.noise(0.5, { vol: 0.3, fq: 500, pos, reverb: 1 }); this.tone(120, 0.5, { type: 'square', vol: 0.08, pos }); },
  fanWhine(on) { const c = this.init(); if (!c) return; if (this.whine) { try { this.whine.o.stop(); } catch (e) {} this.whine = null; } if (!on) return; const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 180; o.frequency.linearRampToValueAtTime(420, c.currentTime + 4); g.gain.value = 0.03; o.connect(g); this.out(g, { reverb: 0.4 }); o.start(); this.whine = { o, g }; },

  // ---- ambience: tube hum + AC rumble + rain ----
  startAmbience(level = 0) {
    const c = this.init(); if (!c) return; this.stopAmbience();
    const nodes = [];
    const hum = c.createOscillator(), hum2 = c.createOscillator(), hg = c.createGain(); hum.frequency.value = 100; hum2.frequency.value = 200; hum.type = 'sine'; hum2.type = 'triangle'; hg.gain.value = 0.012 + level * 0.004;
    hum.connect(hg); hum2.connect(hg); this.out(hg, { reverb: 0.3 }); hum.start(); hum2.start(); nodes.push(hum, hum2);
    const drone = c.createOscillator(), d2 = c.createOscillator(), dg = c.createGain(), df = c.createBiquadFilter(); drone.type = 'sawtooth'; drone.frequency.value = 34 + level * 3; d2.type = 'sine'; d2.frequency.value = 34.5 + level * 3; df.type = 'lowpass'; df.frequency.value = 140; dg.gain.value = 0.05 + level * 0.015;
    drone.connect(df); d2.connect(df); df.connect(dg); this.out(dg, { reverb: 0.2 }); drone.start(); d2.start(); nodes.push(drone, d2);
    // rain: looped filtered noise
    const n = c.sampleRate * 4, b = c.createBuffer(2, n, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const rain = c.createBufferSource(); rain.buffer = b; rain.loop = true; const rf = c.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 2500; rf.Q.value = 0.5; const rg = c.createGain(); rg.gain.value = 0.035;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.012; lfo.connect(lg).connect(rg.gain); lfo.start();
    rain.connect(rf).connect(rg); this.out(rg, { reverb: 0.2 }); rain.start(); nodes.push(rain, lfo);
    this.ambience = { nodes, hg, dg, rg };
  },
  stopAmbience() { if (!this.ambience) return; this.ambience.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); this.ambience = null; this.fanWhine(false); },
  dip(amount, sec) { if (!this.ambience) return; const t = this.ctx.currentTime; const g = this.ambience.hg.gain; const v = g.value; g.setTargetAtTime(v * (1 - amount), t, 0.05); g.setTargetAtTime(v, t + sec, 0.2); },
  say(text, lang = 'en-IN') { if (!('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, '')); u.lang = lang; u.rate = 0.95; u.pitch = 0.75; speechSynthesis.speak(u); } catch (e) {} },
  hush() { try { speechSynthesis.cancel(); } catch (e) {} },
};
