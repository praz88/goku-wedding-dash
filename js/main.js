// ============================================================================
//  GAME — flow, controls, post-processing, UI.
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildScene, HALL } from './scene.js';
import { audio } from './audio.js';
import { DEFAULT_NAMES, TIMES, STORY, WIN_TEXT, LOSE_TEXT, LORE, ANOMS } from './story.js';

const $ = id => document.getElementById(id);
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const opt = { snd: store.get('gwd_snd', '1') === '1', voice: store.get('gwd_voice', '0') === '1', hq: store.get('gwd_hq', isMobile ? '0' : '1') === '1' };
$('snd').checked = opt.snd; $('voice').checked = opt.voice; $('hq').checked = opt.hq;
$('snd').onchange = e => { opt.snd = e.target.checked; store.set('gwd_snd', opt.snd ? '1' : '0'); audio.setEnabled(opt.snd); };
$('voice').onchange = e => { opt.voice = e.target.checked; store.set('gwd_voice', opt.voice ? '1' : '0'); };
$('hq').onchange = e => { store.set('gwd_hq', e.target.checked ? '1' : '0'); if (built) location.reload(); else opt.hq = e.target.checked; };
audio.enabled = opt.snd;

// ---------------- roast-mode names (local only) ----------------
const G = () => [1, 2, 3].map(i => ($('g' + i).value.trim() || DEFAULT_NAMES[i - 1]));
[1, 2, 3].forEach(i => { $('g' + i).value = store.get('gwd_g' + i, ''); $('g' + i).oninput = () => store.set('gwd_g' + i, $('g' + i).value); });

// ---------------- leaderboard ----------------
const API = location.protocol.startsWith('http') ? '/api/scores' : null; let lastPosted = null;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function loadLB() { if (!API) return null; try { const r = await fetch(API, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function renderLB(el, rows) { if (!rows) { el.innerHTML = ''; return; } if (!rows.length) { el.innerHTML = '<h4>LEADERBOARD</h4><p class="small">Nobody has reached the mantapa yet.</p>'; return; } el.innerHTML = '<h4>LEADERBOARD · TOP 10</h4><table>' + rows.slice(0, 10).map((r, i) => `<tr class="${r.id === lastPosted ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)} ${r.won ? '💍' : '📱'}</td><td>${r.score}</td></tr>`).join('') + '</table>'; }
async function refreshLB() { const rows = await loadLB(); renderLB($('lbStart'), rows); renderLB($('lbOver'), rows); }
async function postScore() { if (!API) return; const name = $('pname').value.trim(); if (!name) { $('pname').focus(); return; } store.set('gwd_name', name); $('send').disabled = true; $('send').textContent = '…'; try { const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, char: 'goku', score: S.score, level: Math.min(2, Math.floor(S.pass / 3)), won: !!S.won }) }); const j = await r.json(); lastPosted = j.id || null; $('submit').classList.add('hidden'); audio.right(); } catch (e) { $('send').textContent = 'Retry'; $('send').disabled = false; return; } refreshLB(); }
$('send').onclick = postScore; $('pname').addEventListener('keydown', e => { if (e.key === 'Enter') postScore(); }); $('pname').value = store.get('gwd_name', ''); refreshLB();

// ---------------- renderer / post ----------------
const canvas = $('c');
if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) { window.__fail && window.__fail('this browser has no WebGL — try Chrome or Safari'); }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opt.hq, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = opt.hq; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
let world = null, composer = null, camera = null, built = false, lensPass = null, bloom = null;
const LensShader = {
  uniforms: { tDiffuse: { value: null }, tDirt: { value: null }, aberration: { value: 0.0022 }, vignette: { value: 0.62 }, dirt: { value: 0.22 }, time: { value: 0 }, pulse: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse, tDirt; uniform float aberration, vignette, dirt, time, pulse; varying vec2 vUv;
    void main(){ vec2 d = vUv - 0.5; float r2 = dot(d,d); vec2 off = d * (aberration + pulse*0.004) * (1.0 + r2*6.0);
      float rr = texture2D(tDiffuse, vUv + off).r; float gg = texture2D(tDiffuse, vUv).g; float bb = texture2D(tDiffuse, vUv - off).b; vec3 col = vec3(rr,gg,bb);
      float vig = smoothstep(0.92, 0.2, length(d) * 1.3); col *= mix(1.0 - vignette - pulse*0.3, 1.0, vig);
      vec3 dd = texture2D(tDirt, vUv).rgb; float lum = dot(col, vec3(0.3,0.59,0.11)); col += dd * dirt * smoothstep(0.35, 1.4, lum);
      col += pulse * vec3(0.35, 0.02, 0.02) * (1.0 - vig); gl_FragColor = vec4(col, 1.0); }`
};
function setupPost() {
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(world.scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), opt.hq ? 0.38 : 0.3, 0.35, 0.92); composer.addPass(bloom);
  lensPass = new ShaderPass(LensShader); lensPass.uniforms.tDirt.value = new THREE.TextureLoader().load('assets/tex/lensdirt.jpg'); composer.addPass(lensPass);
  composer.addPass(new FilmPass(opt.hq ? 0.32 : 0.25, false)); composer.addPass(new OutputPass());
  resize();
}
function resize() { const w = innerWidth, h = innerHeight; const pr = opt.hq ? Math.min(devicePixelRatio, isMobile ? 1.5 : 2) : Math.min(devicePixelRatio, 1.25); renderer.setPixelRatio(pr); renderer.setSize(w, h, false); if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); } if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); } }
addEventListener('resize', resize);

// ---------------- state ----------------
let S = null, g = G(), story = STORY(g), anoms = ANOMS(g);
const cam = { yaw: 0, pitch: 0, x: 0, z: 0.4, bob: 0, walking: false, auto: null, speed: 0 };
function newState() { return { t: 0, pass: 0, anom: null, walks: 0, wrong: 0, score: 0, locked: true, over: true, won: false, seen: new Set(), inspected: new Set(), startT: Date.now(), hinted: false }; }
S = newState();

const QS = new URLSearchParams(location.search); const DEBUG_ANOM = QS.get('anom'); // ?anom=cabin_eyes to preview one (contributors)
const DEBUG_POS = QS.get('pos') ? QS.get('pos').split(',').map(Number) : null; // ?pos=x,z,yaw,pitch
function pickAnomaly() {
  if (DEBUG_ANOM) return anoms.find(a => a.id === DEBUG_ANOM) || null;
  if (S.pass === 0) return null;
  const forced = { 1: 'cabin_eyes', 3: 'cooler_ghost1', 5: 'vault_ghost2', 7: 'mantapa_ghost3' }[S.pass];
  if (forced && !S.seen.has(forced)) return anoms.find(a => a.id === forced);
  if (Math.random() < 0.42) return null;
  const pool = anoms.filter(a => !S.seen.has(a.id)); const src = pool.length ? pool : anoms; return src[Math.floor(Math.random() * src.length)];
}
function setLore(html, hint) { const el = $('lore'); el.innerHTML = html; el.className = hint ? 'hint' : ''; }
function newWalk() {
  world.reset(); S.anom = pickAnomaly(); S.walks++; S.locked = false; S.inspected = new Set();
  cam.yaw = 0; cam.pitch = 0; cam.x = 0; cam.z = 0.4; cam.auto = null; cam.walking = false; if (DEBUG_POS) { cam.x = DEBUG_POS[0]; cam.z = DEBUG_POS[1]; cam.yaw = DEBUG_POS[2] || 0; cam.pitch = DEBUG_POS[3] || 0; }
  if (S.anom) { S.seen.add(S.anom.id); world.APPLY[S.anom.id](); if (S.anom.id === 'phone_glow') setTimeout(() => audio.ring(world.propPos.desk), 1200); if (S.anom.id === 'cabin_eyes') setTimeout(() => audio.creak(world.propPos.cabin), 2500); if (S.anom.id === 'fan_fast') audio.fanWhine(true); if (S.anom.id === 'counter_open') setTimeout(() => audio.shutter(world.propPos.counter), 1800); if (S.anom.ghost !== undefined) setTimeout(() => audio.whisper(world.propPos[S.anom.prop]), 3000); }
  world.setToken('NOW SERVING ' + String(S.pass).padStart(4, '0'));
  $('hudNight').textContent = S.pass < 5 ? 'NIGHT ' + (S.pass < 2 ? 1 : 2) : 'NIGHT 3'; $('hudTime').textContent = TIMES[S.pass]; $('hudPass').textContent = 'walk ' + (S.pass + 1) + '/8';
  setLore(S.pass === 0 ? 'First walk. Nothing is wrong tonight — walk around, tap things, learn the hall. Then walk to the exit.' : 'Look at everything. Then decide.', true);
  $('walkhint').classList.toggle('hidden', S.hinted); fade(false);
}
function fade(on) { $('fade').classList.toggle('on', on); }

// ---------------- controls ----------------
let dragging = false, sx = 0, sy = 0, moved = 0, downT = 0, holdTimer = null, lastTap = 0;
canvas.addEventListener('pointerdown', e => { if (!S || S.over || S.locked) return; dragging = true; sx = e.clientX; sy = e.clientY; moved = 0; downT = performance.now(); canvas.setPointerCapture(e.pointerId); clearTimeout(holdTimer); holdTimer = setTimeout(() => { if (dragging && moved < 14) { cam.walking = true; cam.auto = null; S.hinted = true; $('walkhint').classList.add('hidden'); } }, 230); });
canvas.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = e.clientX; sy = e.clientY; moved += Math.abs(dx) + Math.abs(dy); if (cam.walking && moved < 14) return; cam.yaw -= dx * 0.0042; cam.pitch = THREE.MathUtils.clamp(cam.pitch - dy * 0.0032, -0.6, 0.55); });
const endDrag = e => { if (!dragging) return; dragging = false; clearTimeout(holdTimer); const wasWalking = cam.walking; cam.walking = false; if (!wasWalking && moved < 10 && performance.now() - downT < 400) tap(e); };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
const keys = {}; addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') cam.auto = null; }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
function tap(e) {
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const h = world.raycastProp(ndc, camera); if (!h) return; const id = h.id.startsWith('ghost') ? (S.anom ? S.anom.prop : h.id) : h.id;
  audio.tap(); S.inspected.add(id); S.hinted = true; $('walkhint').classList.add('hidden');
  const isA = S.anom && S.anom.prop === id; const text = isA ? S.anom.lore : (LORE[id] || '…');
  setLore('<b>' + id.toUpperCase() + '</b> — ' + text, false);
  if (isA) { if (S.anom.ghost !== undefined) { audio.whisper(world.propPos[S.anom.prop]); audio.heartbeat(); setTimeout(() => audio.heartbeat(), 900); } else { audio.tone(70, 1.4, { vol: 0.25, slide: -30 }); } if (lensPass) lensPass.uniforms.pulse.value = 1; }
}
$('btnBack').onclick = () => { if (S.over || S.locked) return; cam.auto = { z: HALL.Z0 - 0.5, yaw: Math.PI }; cam.walking = false; S.hinted = true; $('walkhint').classList.add('hidden'); setLore('Walking back…', true); };
$('btnFwd').onclick = () => { if (S.over || S.locked) return; cam.auto = { z: HALL.Z1 + 0.6, yaw: 0 }; cam.walking = false; S.hinted = true; $('walkhint').classList.add('hidden'); setLore('Walking to the exit…', true); };

// ---------------- decisions ----------------
function decide(saidWrong) {
  if (S.over || S.locked) return; S.locked = true; cam.auto = null; cam.walking = false; audio.fanWhine(false); audio.hush();
  const wasWrong = !!S.anom; fade(true);
  if (saidWrong === wasWrong) {
    S.score += 100 + Math.min(5, S.inspected.size) * 15 + (wasWrong ? 50 : 0); audio.right(); S.pass++;
    setTimeout(() => { if (S.pass >= 8) end(true); else storyCard(S.pass + 1, () => newWalk()); }, 700);
  } else {
    S.wrong++; S.score = Math.max(0, S.score - 40); audio.wrong(); $('blood').style.opacity = 1; setTimeout(() => $('blood').style.opacity = 0, 600);
    const msg = wasWrong ? `<b>Wrong.</b> ${S.anom.reveal} You walked straight past it.` : `<b>Wrong.</b> It was a normal night. Turning back from a normal night means the night starts over.`;
    setTimeout(() => { $('cardTag').textContent = 'SENT BACK'; $('cardTitle').textContent = 'Friday, 11:58 PM. Again.'; $('cardText').innerHTML = msg + '\n\nThe hall resets. The phone is in his pocket. The muhurtha is still Sunday.'; $('cardBtn').disabled = false; $('cardBtn').textContent = 'Walk again'; $('cardBtn').onclick = () => { $('card').classList.add('hidden'); S.pass = 0; newWalk(); }; $('card').classList.remove('hidden'); if (opt.voice) audio.say(msg); }, 900);
  }
}
let typer = null;
function typewrite(el, html, done) { if (typer) clearInterval(typer); el.innerHTML = ''; let i = 0; const txt = html; typer = setInterval(() => { if (txt[i] === '<') i = txt.indexOf('>', i) + 1; else i++; el.innerHTML = txt.slice(0, i); if (i % 3 === 0 && txt[i - 1] !== ' ') audio.tick(); if (i >= txt.length) { clearInterval(typer); typer = null; done && done(); } }, 17); el.onclick = () => { if (typer) { clearInterval(typer); typer = null; el.innerHTML = txt; done && done(); } }; }
function storyCard(i, cb) { const s = story[i]; if (!s || !s.text) { cb(); return; } $('cardTag').textContent = s.tag; $('cardTitle').textContent = s.title; $('card').classList.remove('hidden'); $('cardBtn').disabled = true; $('cardBtn').textContent = 'Continue'; typewrite($('cardText'), s.text, () => { $('cardBtn').disabled = false; }); $('cardBtn').onclick = () => { $('card').classList.add('hidden'); audio.hush(); cb(); }; if (opt.voice) audio.say(s.text); }

async function start() {
  $('play').textContent = 'Loading the branch…'; $('play').disabled = true;
  audio.init(); audio.setEnabled(opt.snd); g = G(); story = STORY(g); anoms = ANOMS(g);
  $('start').classList.add('hidden'); $('over').classList.add('hidden');
  if (!built) {
    $('loading').classList.remove('hidden');
    try { world = await buildScene(renderer, { hq: opt.hq, mobile: isMobile, onProgress: p => { $('bar').firstElementChild.style.width = Math.round(p * 100) + '%'; } }); }
    catch (e) { console.error(e); $('loading').classList.add('hidden'); $('start').classList.remove('hidden'); $('play').textContent = 'Begin: Friday, 11:58 PM'; $('play').disabled = false; window.__fail && window.__fail('could not build the 3D hall — ' + (e && e.message)); return; }
    camera = world.camera; setupPost(); built = true; window.__world = world; window.__cam = cam; $('loading').classList.add('hidden');
    world.events.onThunder = (delay) => setTimeout(() => audio.thunder(), delay * 1000); world.events.onDip = (sec) => audio.dip(0.8, sec);
    requestAnimationFrame(loop);
  }
  $('play').textContent = 'Begin: Friday, 11:58 PM'; $('play').disabled = false;
  S = newState(); S.over = false; world.reset(); $('ui').classList.remove('hidden'); fade(true); audio.startAmbience(0);
  storyCard(0, () => storyCard(1, () => newWalk()));
}
function end(won) {
  S.over = true; S.won = won; audio.stopAmbience(); $('ui').classList.add('hidden'); fade(false); const mins = Math.round((Date.now() - S.startT) / 6000) / 10;
  if (won) { audio.win(); S.score += 500 - Math.min(400, S.wrong * 40); $('overTitle').textContent = '6:30 AM. The thaali.'; typewrite($('overText'), WIN_TEXT(g)); }
  else { audio.laugh(); $('overTitle').textContent = 'He picked up.'; typewrite($('overText'), LOSE_TEXT); }
  $('overScore').textContent = `Score ${S.score} · ${S.walks} walks · ${S.wrong} wrong turns · ${mins} min`;
  if (API && S.score > 0) { $('submit').classList.remove('hidden'); $('send').disabled = false; $('send').textContent = 'Post'; }
  $('over').classList.remove('hidden'); refreshLB();
}
$('play').onclick = start; $('again').onclick = () => { $('over').classList.add('hidden'); $('start').classList.remove('hidden'); };

// ---------------- loop ----------------
const clock = new THREE.Clock(); let stepT = 0, stepSide = 0, T = 0;
function loop() {
  requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); T += dt;
  if (!S.over && !S.locked) {
    // keyboard
    const kf = (keys['w'] || keys['arrowup']) ? 1 : (keys['s'] || keys['arrowdown']) ? -1 : 0; if (keys['a'] || keys['arrowleft']) cam.yaw += dt * 1.6; if (keys['d'] || keys['arrowright']) cam.yaw -= dt * 1.6;
    let fwd = 0; if (cam.walking || kf) fwd = kf || 1;
    if (cam.auto) { const dy = ((cam.auto.yaw - cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; cam.yaw += dy * Math.min(1, dt * 3); const dz = cam.auto.z - cam.z; fwd = Math.abs(dz) > 0.05 ? 1 : 0; if (fwd) { cam.z += Math.sign(dz) * Math.min(Math.abs(dz), 2.4 * dt); cam.x += (0 - cam.x) * dt * 2; } }
    else if (fwd) { const sp = 1.7 * dt * fwd; cam.x -= Math.sin(cam.yaw) * sp; cam.z -= Math.cos(cam.yaw) * sp; }
    const p = world.collide(new THREE.Vector3(cam.x, 0, cam.z)); cam.x = p.x; cam.z = p.z;
    cam.speed += ((fwd ? 1 : 0) - cam.speed) * Math.min(1, dt * 8);
    if (cam.speed > 0.3) { stepT += dt * (cam.auto ? 2.3 : 1.9); if (stepT > 1) { stepT = 0; audio.step(stepSide ^= 1); } } else stepT = 0.6;
    if (cam.z < HALL.Z1 + 0.75) decide(false); else if (cam.z > HALL.Z0 - 0.7) decide(true);
  }
  if (camera) {
    const bob = Math.sin(stepT * Math.PI * 2) * 0.035 * cam.speed; const sway = Math.sin(stepT * Math.PI) * 0.012 * cam.speed;
    camera.position.set(cam.x + Math.sin(T * 0.8) * 0.006, 1.64 + bob + Math.sin(T * 1.3) * 0.008, cam.z); camera.rotation.set(cam.pitch, cam.yaw, sway, 'YXZ');
    audio.listener.x = cam.x; audio.listener.z = cam.z; audio.listener.yaw = cam.yaw;
    world.update(dt, T, camera);
    if (lensPass) { lensPass.uniforms.time.value = T; lensPass.uniforms.pulse.value *= Math.pow(0.02, dt); }
    composer.render();
  }
}
