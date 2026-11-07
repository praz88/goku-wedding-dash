// ============================================================================
//  PROCEDURAL TEXTURES — albedo / roughness / normal maps drawn on canvases.
// ============================================================================
import * as THREE from 'three';

// ---------- noise ----------
function valueNoise(w, h, cell, seed = 1) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2; const grid = new Float32Array(gw * gh);
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { const gy = y / cell, y0 = gy | 0, fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < w; x++) { const gx = x / cell, x0 = gx | 0, fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
      const a = grid[y0 * gw + x0], b = grid[y0 * gw + x0 + 1], c = grid[(y0 + 1) * gw + x0], d = grid[(y0 + 1) * gw + x0 + 1];
      out[y * w + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy; } }
  return out;
}
export function fbm(w, h, { octaves = 4, base = 64, seed = 1, gain = 0.5 } = {}) {
  const out = new Float32Array(w * h); let amp = 1, tot = 0, cell = base;
  for (let o = 0; o < octaves; o++) { const n = valueNoise(w, h, cell, seed + o * 17); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= gain; cell = Math.max(2, cell / 2); }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t;
}
// height (Float32 0..1) -> normal map canvas
export function normalFromHeight(hm, w, h, strength = 2) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const l = hm[y * w + ((xx - 1 + w) % w)], r = hm[y * w + ((xx + 1) % w)], u = hm[((y - 1 + h) % h) * w + xx], dn = hm[((y + 1) % h) * w + xx];
    let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + xx) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255; }
  x.putImageData(img, 0, 0); return c;
}
function grayCanvas(arr, w, h, lo = 0, hi = 1) { const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data; for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, (lo + (hi - lo) * arr[i]) * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } x.putImageData(img, 0, 0); return c; }
function grimeOverlay(x, w, h, n, alpha, seed = 3) { const f = fbm(w, h, { octaves: 3, base: w / 3, seed }); const img = x.getImageData(0, 0, w, h), d = img.data; for (let i = 0; i < w * h; i++) { const g = Math.max(0, f[i] - 0.45) * alpha * 2; d[i * 4] *= 1 - g; d[i * 4 + 1] *= 1 - g * 1.05; d[i * 4 + 2] *= 1 - g * 1.15; } x.putImageData(img, 0, 0); for (let i = 0; i < n; i++) { x.fillStyle = `rgba(30,22,14,${Math.random() * 0.12})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 30 + 4, 0, 7); x.fill(); } }

// ---------- FLOOR: vitrified tiles ----------
export function floorSet(size = 1024, tilesPer = 2) {
  const c = canvas(size, size), x = c.getContext('2d'); const ts = size / tilesPer, grout = size * 0.006;
  const veins = fbm(size, size, { octaves: 5, base: 160, seed: 7 });
  const img = x.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
    const i = y * size + xx; const inGrout = (xx % ts) < grout || (y % ts) < grout;
    const v = veins[i]; let r, g, b;
    if (inGrout) { r = 92; g = 88; b = 80; } else { const base = 214 + (v - 0.5) * 40; r = base + 6; g = base + 2; b = base - 10; const vein = Math.pow(Math.abs(Math.sin(v * 40 + xx * 0.01)), 30) * 25; r -= vein; g -= vein; b -= vein; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); grimeOverlay(x, size, size, 60, 0.35, 11);
  // roughness: polished (low) but dirt is rough
  const rf = fbm(size, size, { octaves: 3, base: 200, seed: 21 }); const rough = new Float32Array(size * size);
  for (let i = 0; i < rough.length; i++) { const xx = i % size, y = (i / size) | 0; const inGrout = (xx % ts) < grout || (y % ts) < grout; rough[i] = inGrout ? 0.95 : 0.18 + Math.max(0, rf[i] - 0.5) * 0.9; }
  // height: grout grooves + micro bumps
  const hm = new Float32Array(size * size); const micro = fbm(size, size, { octaves: 2, base: 6, seed: 5 });
  for (let i = 0; i < hm.length; i++) { const xx = i % size, y = (i / size) | 0; const inGrout = (xx % ts) < grout || (y % ts) < grout; hm[i] = (inGrout ? 0.0 : 0.5) + micro[i] * 0.03; }
  return { map: tex(c, { repeat: [1, 1] }), roughnessMap: tex(grayCanvas(rough, size, size), { srgb: false }), normalMap: tex(normalFromHeight(hm, size, size, 3), { srgb: false }) };
}
// ---------- WALL: paint + dado + grime ----------
export function wallSet(w = 1024, h = 1024, hMeters = 3.3) {
  const c = canvas(w, h), x = c.getContext('2d'); const dadoY = h * (1 - 1.15 / hMeters), railH = h * 0.012, skirt = h * (0.12 / hMeters);
  const n = fbm(w, h, { octaves: 4, base: 120, seed: 3 }); const img = x.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const i = y * w + xx; let r, g, b; const v = (n[i] - 0.5) * 18;
    if (y > h - skirt) { r = 40 + v; g = 36 + v; b = 32 + v; } else if (y > dadoY + railH) { r = 78 + v; g = 110 + v; b = 96 + v; } else if (y > dadoY) { r = 60; g = 50; b = 38; } else { r = 222 + v; g = 212 + v; b = 186 + v; }
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); grimeOverlay(x, w, h, 120, 0.4, 9);
  // scuffs along the dado + hand-level grime
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(30,25,20,${Math.random() * 0.25})`; x.lineWidth = Math.random() * 3; x.beginPath(); const sx = Math.random() * w, sy = dadoY + Math.random() * (h - dadoY); x.moveTo(sx, sy); x.lineTo(sx + Math.random() * 80 - 40, sy + Math.random() * 20 - 10); x.stroke(); }
  // cracks
  for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(60,50,40,.5)'; x.lineWidth = 1.2; x.beginPath(); let cx = Math.random() * w, cy = Math.random() * dadoY * 0.8; x.moveTo(cx, cy); for (let k = 0; k < 12; k++) { cx += Math.random() * 30 - 15; cy += Math.random() * 40; x.lineTo(cx, cy); } x.stroke(); }
  const rough = new Float32Array(w * h); for (let i = 0; i < rough.length; i++) { const y = (i / w) | 0; rough[i] = y > dadoY + railH && y < h - skirt ? 0.35 + n[i] * 0.2 : 0.85 + n[i] * 0.1; }
  const hm = new Float32Array(w * h); const plaster = fbm(w, h, { octaves: 3, base: 10, seed: 13 }); for (let i = 0; i < hm.length; i++) { const y = (i / w) | 0; hm[i] = plaster[i] * 0.06 + (y > dadoY && y < dadoY + railH ? 0.35 : 0) + (y > h - skirt ? 0.25 : 0); }
  return { map: tex(c), roughnessMap: tex(grayCanvas(rough, w, h), { srgb: false }), normalMap: tex(normalFromHeight(hm, w, h, 2.2), { srgb: false }) };
}
// ---------- CEILING: panels ----------
export function ceilingSet(size = 512) {
  const c = canvas(size, size), x = c.getContext('2d'); x.fillStyle = '#d7d3c6'; x.fillRect(0, 0, size, size);
  const n = fbm(size, size, { octaves: 3, base: 8, seed: 31 }); const img = x.getImageData(0, 0, size, size), d = img.data; for (let i = 0; i < size * size; i++) { const v = (n[i] - 0.5) * 30; d[i * 4] += v; d[i * 4 + 1] += v; d[i * 4 + 2] += v; } x.putImageData(img, 0, 0);
  x.strokeStyle = '#7f7b70'; x.lineWidth = 6; x.strokeRect(0, 0, size, size); x.strokeRect(size / 2, 0, 0.1, size); x.strokeRect(0, size / 2, size, 0.1);
  for (let i = 0; i < 25; i++) { x.fillStyle = `rgba(120,90,40,${Math.random() * 0.15})`; x.beginPath(); x.arc(Math.random() * size, Math.random() * size, Math.random() * 40, 0, 7); x.fill(); } // water stains
  const hm = new Float32Array(size * size); for (let i = 0; i < hm.length; i++) { const xx = i % size, y = (i / size) | 0; const edge = xx < 4 || y < 4 || Math.abs(xx - size / 2) < 2 || Math.abs(y - size / 2) < 2; hm[i] = edge ? 0 : 0.5 + n[i] * 0.05; }
  return { map: tex(c, { repeat: [1, 1] }), normalMap: tex(normalFromHeight(hm, size, size, 2), { srgb: false }) };
}
// ---------- frosted glass alpha ----------
export function frostTex(size = 256) { const n = fbm(size, size, { octaves: 4, base: 32, seed: 41 }); return tex(grayCanvas(n, size, size, 0.35, 0.75), { srgb: false, repeat: [2, 2] }); }
// ---------- perforated steel (alpha) ----------
export function perfTex(size = 256) { const c = canvas(size, size), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000'; const st = size / 8; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(i * st + st / 2, j * st + st / 2, st * 0.28, 0, 7); x.fill(); } return tex(c, { srgb: false, repeat: [6, 2] }); }

// ---------- signs / boards ----------
export function sign(text, { w = 512, h = 128, bg = '#111', fg = '#fff', font = 'bold 64px sans-serif', sub, subFont = '20px sans-serif' } = {}) {
  const c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) { x.font = subFont; x.fillText(sub, w / 2, h * 0.78); } return tex(c);
}
export function nameplate(text) { const c = canvas(512, 96), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#e2c062'); g.addColorStop(0.5, '#b8902c'); g.addColorStop(1, '#d9b652'); x.fillStyle = g; x.fillRect(0, 0, 512, 96); x.strokeStyle = '#6b4e10'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 84); x.fillStyle = '#2a1a05'; x.font = 'bold 40px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50); return tex(c); }
export function clockFace(x, w, h, ang, nine) {
  x.clearRect(0, 0, w, h); x.fillStyle = '#f3f0e6'; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 6, 0, 7); x.fill(); x.strokeStyle = '#1a1a1a'; x.lineWidth = 10; x.stroke();
  x.fillStyle = '#1a1a1a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px sans-serif';
  for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; x.fillText(i, w / 2 + Math.cos(a) * (w / 2 - 44), h / 2 + Math.sin(a) * (h / 2 - 44)); }
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; x.fillRect(w / 2 + Math.cos(a) * (w / 2 - 20) - 1.5, h / 2 + Math.sin(a) * (h / 2 - 20) - 1.5, i % 5 ? 3 : 5, i % 5 ? 3 : 5); }
  const hh = nine ? (9 / 12) * Math.PI * 2 - Math.PI / 2 : ang / 12 - Math.PI / 2, mm = nine ? -Math.PI / 2 : ang - Math.PI / 2;
  x.lineCap = 'round'; x.lineWidth = 12; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.cos(hh) * w * 0.25, h / 2 + Math.sin(hh) * w * 0.25); x.stroke();
  x.lineWidth = 8; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.cos(mm) * w * 0.38, h / 2 + Math.sin(mm) * w * 0.38); x.stroke();
  x.strokeStyle = '#b3121a'; x.lineWidth = 3; const ss = ang * 60 - Math.PI / 2; x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 + Math.cos(ss) * w * 0.42, h / 2 + Math.sin(ss) * w * 0.42); x.stroke();
  x.fillStyle = '#8a1515'; x.font = 'bold 20px sans-serif'; x.fillText('AJANTA', w / 2, h * 0.7); x.font = '14px sans-serif'; x.fillText('QUARTZ', w / 2, h * 0.76);
}
export function calendar(working) { const w = 512, h = 640, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#fbf7ee'; x.fillRect(0, 0, w, h); x.fillStyle = '#b3121a'; x.fillRect(0, 0, w, 120);
  x.fillStyle = '#fff'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('NOVEMBER', w / 2, 52); x.font = '22px sans-serif'; x.fillText('SURAKSHA LIFE · "we are with you, always"', w / 2, 96);
  x.fillStyle = '#333'; x.font = 'bold 24px sans-serif'; ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach((d, i) => { x.fillStyle = i === 0 ? '#b3121a' : '#333'; x.fillText(d, 50 + i * 68, 160); });
  x.font = '30px sans-serif'; for (let i = 0; i < 30; i++) { const col = (i + 6) % 7, row = Math.floor((i + 6) / 7); x.fillStyle = col === 0 ? '#b3121a' : '#222'; x.fillText(i + 1, 50 + col * 68, 215 + row * 70); }
  const sunCol = 0, sunRow = 1; const cx = 50 + sunCol * 68, cy = 215 + sunRow * 70; // Nov 8 is a Sunday here
  if (working) { x.strokeStyle = '#1a1a1a'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 22, cy - 22); x.lineTo(cx + 22, cy + 22); x.moveTo(cx + 22, cy - 22); x.lineTo(cx - 22, cy + 22); x.stroke(); x.fillStyle = '#1a1a1a'; x.font = 'italic bold 34px "Special Elite", serif'; x.fillText('SUN — WORKING', w / 2, h - 60); x.font = '20px "Special Elite", serif'; x.fillText('— R.M.', w / 2 + 160, h - 28); }
  else { x.strokeStyle = '#b3121a'; x.lineWidth = 5; x.beginPath(); x.ellipse(cx, cy, 30, 24, 0.1, 0, 7); x.stroke(); x.beginPath(); x.ellipse(cx + 2, cy - 1, 33, 26, -0.1, 0, 7); x.stroke(); x.fillStyle = '#b3121a'; x.font = 'bold 30px "Special Elite", serif'; x.fillText('MUHURTHA 6:30 !!', w / 2, h - 50); }
  return tex(c); }
export function portraitPainting(mgr) { const w = 512, h = 640, c = canvas(w, h), x = c.getContext('2d'); const g = x.createRadialGradient(w / 2, h * 0.4, 40, w / 2, h / 2, w * 0.8); g.addColorStop(0, mgr ? '#3a1414' : '#4a3620'); g.addColorStop(1, '#0d0906'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const n = fbm(w, h, { octaves: 4, base: 40, seed: 77 }); const img = x.getImageData(0, 0, w, h), d = img.data; for (let i = 0; i < w * h; i++) { const v = (n[i] - 0.5) * 24; d[i * 4] += v; d[i * 4 + 1] += v; d[i * 4 + 2] += v; } x.putImageData(img, 0, 0);
  // bust silhouette with painterly strokes
  x.fillStyle = '#1b1510'; x.beginPath(); x.moveTo(w * 0.15, h); x.quadraticCurveTo(w * 0.2, h * 0.6, w * 0.42, h * 0.56); x.lineTo(w * 0.58, h * 0.56); x.quadraticCurveTo(w * 0.8, h * 0.6, w * 0.85, h); x.fill();
  x.fillStyle = '#2b2219'; x.beginPath(); x.ellipse(w / 2, h * 0.4, w * 0.16, h * 0.17, 0, 0, 7); x.fill();
  for (let i = 0; i < 400; i++) { x.strokeStyle = `rgba(${150 + Math.random() * 80},${110 + Math.random() * 60},${70 + Math.random() * 40},${Math.random() * 0.12})`; x.lineWidth = 1 + Math.random() * 4; x.beginPath(); const sx = w * 0.36 + Math.random() * w * 0.28, sy = h * 0.25 + Math.random() * h * 0.3; x.moveTo(sx, sy); x.lineTo(sx + Math.random() * 20 - 10, sy + Math.random() * 20 - 10); x.stroke(); }
  x.fillStyle = 'rgba(255,225,180,.28)'; x.beginPath(); x.ellipse(w * 0.46, h * 0.37, w * 0.05, h * 0.1, 0.4, 0, 7); x.fill();
  if (mgr) { x.fillStyle = '#ff2020'; x.beginPath(); x.arc(w * 0.45, h * 0.39, 7, 0, 7); x.arc(w * 0.55, h * 0.39, 7, 0, 7); x.fill(); }
  x.fillStyle = '#c9a23a'; x.fillRect(w * 0.2, h - 70, w * 0.6, 44); x.fillStyle = '#2a1a05'; x.font = 'bold 24px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(mgr ? '"WHICH WEEKEND?"' : 'SHRI R. K. DESHPANDE · CHAIRMAN', w / 2, h - 48); return tex(c); }
export function noticeBoard(goku) { const w = 1024, h = 640, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#9a6a3a'; x.fillRect(0, 0, w, h); const n = fbm(w, h, { octaves: 3, base: 6, seed: 51 }); const img = x.getImageData(0, 0, w, h), d = img.data; for (let i = 0; i < w * h; i++) { const v = (n[i] - 0.5) * 70; d[i * 4] += v; d[i * 4 + 1] += v * 0.8; d[i * 4 + 2] += v * 0.5; } x.putImageData(img, 0, 0);
  const paper = (px, py, pw, ph, rot, fn, col = '#f7f1dc') => { x.save(); x.translate(px, py); x.rotate(rot); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 8; x.shadowOffsetY = 4; x.fillStyle = col; x.fillRect(0, 0, pw, ph); x.shadowBlur = 0; x.shadowOffsetY = 0; x.fillStyle = '#c1121f'; x.beginPath(); x.arc(pw / 2, 10, 7, 0, 7); x.fill(); fn(pw, ph); x.restore(); };
  paper(60, 60, 420, 300, -0.03, (pw, ph) => { x.fillStyle = '#111'; x.textAlign = 'center'; x.font = 'bold 40px sans-serif'; x.fillText(goku ? 'TARGET:' : 'TARGET', pw / 2, 80); x.fillStyle = goku ? '#c1121f' : '#111'; x.font = 'bold 110px sans-serif'; x.fillText(goku ? 'GOKU' : '110%', pw / 2, 190); x.fillStyle = '#333'; x.font = '26px sans-serif'; x.fillText(goku ? 'before the muhurtha' : 'CASA DRIVE · Q3 · NO EXCUSES', pw / 2, 250); });
  paper(540, 70, 400, 220, 0.05, (pw, ph) => { x.fillStyle = '#333'; x.textAlign = 'center'; x.font = 'bold 30px sans-serif'; x.fillText('SMILE.', pw / 2, 60); x.fillText('YOU ARE THE FACE', pw / 2, 105); x.fillText('OF THE BANK.', pw / 2, 150); x.strokeStyle = '#555'; x.lineWidth = 3; x.beginPath(); x.arc(pw / 2, 190, 14, 0, 7); x.stroke(); x.beginPath(); x.arc(pw / 2, 199, 9, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); x.fillRect(pw / 2 - 6, 185, 3, 3); x.fillRect(pw / 2 + 3, 185, 3, 3); });
  paper(90, 400, 360, 180, 0.02, (pw, ph) => { x.fillStyle = '#333'; x.textAlign = 'left'; x.font = '24px "Special Elite", monospace'; x.fillText('Locker rent due — see BM', 20, 50); x.fillText('AC servicing — pending', 20, 90); x.fillText('Staff picnic — cancelled', 20, 130); x.fillText('(again)', 20, 165); });
  paper(560, 330, 340, 240, -0.06, (pw, ph) => { x.fillStyle = '#8a1515'; x.textAlign = 'center'; x.font = 'bold 28px serif'; if (goku) { x.fillText('WEDDING', pw / 2, 70); x.fillText('INVITATION', pw / 2, 110); x.fillStyle = '#333'; x.font = '20px serif'; x.fillText('Sunday · 6:30 AM · Mantapa', pw / 2, 160); x.strokeStyle = '#c1121f'; x.lineWidth = 6; x.beginPath(); x.moveTo(40, 200); x.lineTo(300, 40); x.stroke(); } else { x.fillStyle = '#1a3a8a'; x.fillText('DIGITAL BANKING', pw / 2, 70); x.fillText('WEEK', pw / 2, 110); x.fillStyle = '#333'; x.font = '20px sans-serif'; x.fillText('Target: 40 app downloads / day', pw / 2, 160); x.fillText('Achieved: 3', pw / 2, 195); } }, goku ? '#fff2e0' : '#eef3ff');
  return tex(c); }
export function npaBoard(goku) { const w = 1024, h = 640, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#f2f2ee'; x.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(120,120,110,${Math.random() * 0.08})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, Math.random() * 60, 0, 7); x.fill(); }
  x.fillStyle = '#111'; x.font = 'bold 56px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText('NPA — OVERDUE', 50, 90); x.strokeStyle = '#111'; x.lineWidth = 5; x.beginPath(); x.moveTo(40, 112); x.lineTo(w - 40, 112); x.stroke();
  const rows = goku ? ['Goku — wedding — 2 days', 'Goku — sleep — 3 years', 'Goku — Sunday — ALWAYS', 'Goku — Goku — Goku'] : ['A/c 2210 — 3 mo — "next month"', 'A/c 1184 — 7 mo — "pakka"', 'A/c 4040 — 11 mo — not reachable', 'A/c 0097 — 2 mo — visited twice'];
  x.font = '46px "Special Elite", monospace'; rows.forEach((r, i) => { x.fillStyle = goku ? '#7a0a0a' : '#b3121a'; x.fillText(r, 50, 200 + i * 96); });
  x.fillStyle = '#1a3a8a'; x.font = '30px sans-serif'; x.fillText(goku ? '— R.M.' : 'Recovery drive: Sat / Sun (compulsory)', 50, h - 40); return tex(c); }
export function poster(kind) { const w = 512, h = 720, c = canvas(w, h), x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
  if (kind === 'fraud') { x.fillStyle = '#0b2a5a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.font = 'bold 64px sans-serif'; x.fillText('BEWARE', w / 2, 120); x.fillText('OF FRAUD', w / 2, 190); x.fillText('CALLS', w / 2, 260); x.fillStyle = '#fff'; x.font = '30px sans-serif'; x.fillText('Never share your OTP.', w / 2, 360); x.fillText('Bank will never call you', w / 2, 410); x.fillText('on a Sunday.', w / 2, 450); x.font = 'italic 22px sans-serif'; x.fillStyle = '#9fc3ff'; x.fillText('(terms & conditions apply)', w / 2, 520); x.font = '110px serif'; x.fillText('☎', w / 2, 630); }
  else if (kind === 'loan') { x.fillStyle = '#fff7e6'; x.fillRect(0, 0, w, h); x.fillStyle = '#b3121a'; x.fillRect(0, 0, w, 150); x.fillStyle = '#fff'; x.font = 'bold 54px sans-serif'; x.fillText('HOME LOAN', w / 2, 75); x.fillStyle = '#b3121a'; x.font = 'bold 150px sans-serif'; x.fillText('8.4%*', w / 2, 300); x.fillStyle = '#333'; x.font = '30px sans-serif'; x.fillText('Build the home.', w / 2, 430); x.fillText('Then live in the branch.', w / 2, 475); x.font = '18px sans-serif'; x.fillText('*rate valid till the manager calls', w / 2, 660); }
  else { x.fillStyle = '#123'; x.fillRect(0, 0, w, h); x.fillStyle = '#7dd3fc'; x.font = 'bold 60px sans-serif'; x.fillText('SENIOR', w / 2, 140); x.fillText('CITIZEN FD', w / 2, 210); x.fillStyle = '#fff'; x.font = 'bold 120px sans-serif'; x.fillText('7.75%', w / 2, 370); x.font = '28px sans-serif'; x.fillText('Because you waited.', w / 2, 480); x.fillText('Everyone here waited.', w / 2, 525); }
  return tex(c); }
export function ledDisplay(text, { w = 1024, h = 256, color = '#ff2a2a' } = {}) { const c = canvas(w, h), x = c.getContext('2d'); const draw = (t) => { x.fillStyle = '#050505'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a0000'; for (let i = 0; i < w; i += 8) for (let j = 0; j < h; j += 8) x.fillRect(i + 2, j + 2, 4, 4); x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 24; x.font = 'bold 96px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, h / 2 + 8); x.shadowBlur = 0; x.fillStyle = 'rgba(0,0,0,.35)'; for (let j = 0; j < h; j += 4) x.fillRect(0, j, w, 2); }; draw(text); const t = tex(c); t.userData.draw = (s) => { draw(s); t.needsUpdate = true; }; return t; }
export function cctvScreen(behind) { const w = 512, h = 384, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#061008'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1f6b2f'; x.lineWidth = 2; for (let i = 0; i < 11; i++) { x.beginPath(); x.moveTo(w / 2 + (i - 5) * 16, h * 0.42); x.lineTo(w / 2 + (i - 5) * 150, h); x.stroke(); } for (let k = 0; k < 6; k++) { const y = h * 0.42 + k * k * 10; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
  x.fillStyle = '#2b8a3e'; for (let i = 0; i < 3; i++) x.fillRect(w * 0.28 + i * w * 0.16, h * 0.55, w * 0.1, h * 0.2); x.fillStyle = '#17542a'; x.fillRect(0, h * 0.3, w * 0.18, h * 0.5);
  if (behind) { x.fillStyle = '#9fd9a8'; x.fillRect(w / 2 - 22, h * 0.48, 44, h * 0.5); x.fillStyle = '#b8e8c0'; x.beginPath(); x.arc(w / 2, h * 0.44, 20, 0, 7); x.fill(); x.fillStyle = '#000'; x.fillRect(w / 2 - 60, h * 0.2, 120, h * 0.8); x.fillStyle = '#e8ffe8'; x.beginPath(); x.arc(w / 2, h * 0.2, 30, 0, 7); x.fill(); x.fillStyle = '#000'; x.fillRect(w / 2 - 12, h * 0.18, 6, 6); x.fillRect(w / 2 + 6, h * 0.18, 6, 6); }
  x.fillStyle = '#7dff9a'; x.font = 'bold 26px monospace'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText('CAM 2 · HALL', 14, 34); x.fillStyle = '#ff4d4d'; x.beginPath(); x.arc(w - 30, 26, 9, 0, 7); x.fill(); x.fillStyle = '#7dff9a'; x.textAlign = 'right'; x.fillText(behind ? 'LIVE · BEHIND YOU' : 'LIVE  23:58:41', w - 50, 34);
  for (let i = 0; i < h; i += 3) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, i, w, 1); } return tex(c); }
export function monitorScreen() { const w = 512, h = 320, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#0a1f3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#1b3a66'; x.fillRect(0, 0, w, 36); x.fillStyle = '#e8f0ff'; x.font = 'bold 20px monospace'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText('CBS  ›  LOANS  ›  SANCTION', 14, 25);
  ['A/c 4421 · HOME LOAN · ₹ 42,00,000', 'Status ......... PENDING', 'Approver ....... BRANCH MANAGER (you)', 'Pending since .. 11 days', '', '   [ ONE SIGNATURE ]      [ LATER ]'].forEach((l, i) => { x.fillStyle = i === 5 ? '#ffd23f' : '#cfe0ff'; x.fillText(l, 20, 80 + i * 38); });
  x.fillStyle = '#ff6b6b'; x.fillText('⚠ 47 notifications', 300, 25); for (let i = 0; i < h; i += 3) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, i, w, 1); } return tex(c); }
export function atmScreen() { const w = 512, h = 400, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#0a3d7a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OUT OF SERVICE', w / 2, 150); x.font = '26px sans-serif'; x.fillText('please contact branch manager', w / 2, 220); x.font = '20px sans-serif'; x.fillStyle = '#9fc3ff'; x.fillText('(he is in)', w / 2, 270); return tex(c); }
export function weddingCard() { const w = 256, h = 160, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#fff6e0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9a23a'; x.lineWidth = 4; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#8a1515'; x.font = 'bold 22px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('WEDDING INVITATION', w / 2, 50); x.font = '18px serif'; x.fillStyle = '#333'; x.fillText('Sunday · 6:30 AM', w / 2, 90); x.strokeStyle = '#c1121f'; x.lineWidth = 6; x.beginPath(); x.moveTo(40, 110); x.lineTo(216, 70); x.stroke(); return tex(c); }
export function fileLabel() { const w = 256, h = 128, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#d9c58a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(30, 30, 196, 68); x.fillStyle = '#333'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LOAN — A/c 4421', w / 2, 52); x.fillStyle = '#b3121a'; x.font = '18px sans-serif'; x.fillText('ONE SIGNATURE', w / 2, 82); return tex(c); }
export function counterShutter() { const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#8c8f94'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 24) { x.fillStyle = '#6f7378'; x.fillRect(0, y, w, 6); x.fillStyle = '#a3a6ab'; x.fillRect(0, y + 6, w, 4); } for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(60,40,20,${Math.random() * 0.2})`; x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, 3); } return tex(c, { repeat: [1, 1] }); }
export function vaultDial() { const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = '#4a4f55'; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill(); x.strokeStyle = '#c0c4c8'; x.lineWidth = 3; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; x.beginPath(); x.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x.lineTo(128 + Math.cos(a) * (i % 5 ? 112 : 120), 128 + Math.sin(a) * (i % 5 ? 112 : 120)); x.stroke(); } x.fillStyle = '#c0c4c8'; x.beginPath(); x.arc(128, 128, 14, 0, 7); x.fill(); return tex(c); }
