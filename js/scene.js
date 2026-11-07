// ============================================================================
//  THE HALL — geometry, materials, lights, models, particles, anomalies.
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as TX from './textures.js';

export const HALL = { W: 5, H: 3.3, Z0: 3, Z1: -25 }; // x in [-2.5,2.5], z from +3 (entry wall) to -25 (exit wall)

const std = (o) => new THREE.MeshStandardMaterial(o);
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const PL = (w, h) => new THREE.PlaneGeometry(w, h);
const CYL = (r1, r2, h, s = 24) => new THREE.CylinderGeometry(r1, r2, h, s);

export async function buildScene(renderer, opts) {
  const { hq, onProgress, mobile, onStatus } = opts; const TS = mobile ? 512 : 1024; // texture size: lighter generation on phones
  const status = async (txt, frac) => { onStatus && onStatus(txt, frac); await new Promise(r => setTimeout(r, 40)); };
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x05030a, 0.07); scene.add(new THREE.AmbientLight(0x241c2c, 0.5));
  const camera = new THREE.PerspectiveCamera(innerHeight > innerWidth ? 84 : 70, 1, 0.05, 80);

  const hit = [];               // raycast targets
  const hitSet = new Set();
  const reg = (id, ...objs) => objs.forEach(o => o.traverse(m => { if (m.isMesh) { m.userData.id = id; if (!hitSet.has(m)) { hitSet.add(m); hit.push(m); } } }));
  const anim = [];              // per-frame updaters
  const lights = { tubes: [], all: [] };
  const flags = { fanFast: false, clockDir: 1, clockNine: false };

  // ---------------- loaders ----------------
  const manager = new THREE.LoadingManager(); let loaded = 0, total = 12;
  manager.onProgress = (u, l, t) => onProgress && onProgress(l / Math.max(t, total));
  const A = (u) => (window.__ASSETS && window.__ASSETS[u]) || u; // packed data-URI fallback (see tools/pack-assets.js)
  const gltf = new GLTFLoader(manager); gltf.setMeshoptDecoder(MeshoptDecoder);
  const texL = new THREE.TextureLoader(manager);
  const loadTex = (u, srgb = true) => { const t = texL.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };

  // ---------------- environment ----------------
  try { const env = await new RGBELoader(manager).loadAsync(A('assets/tex/env.hdr')); env.mapping = THREE.EquirectangularReflectionMapping; scene.environment = env; scene.environmentIntensity = 0.22; } catch (e) { console.warn('env', e); }

  // ---------------- shell ----------------
  const { W, H, Z0, Z1 } = HALL, L = Z0 - Z1, ZC = (Z0 + Z1) / 2;
  await status('mopping the floor…', 0.12); const F = TX.floorSet(TS, 2); F.map.repeat.set(W / 1.2, L / 1.2); F.roughnessMap.repeat.copy(F.map.repeat); F.normalMap.repeat.copy(F.map.repeat); [F.map, F.roughnessMap, F.normalMap].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const floorMat = std({ map: F.map, roughnessMap: F.roughnessMap, normalMap: F.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0.05, envMapIntensity: 0.9, transparent: hq, opacity: hq ? 0.86 : 1 });
  const floor = new THREE.Mesh(PL(W, L), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, hq ? 0.004 : 0, ZC); floor.receiveShadow = true; scene.add(floor);
  let reflector = null;
  if (hq) {
    reflector = new Reflector(PL(W, L), { clipBias: 0.004, textureWidth: 1024, textureHeight: 1024, color: 0x6a6a72 });
    reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0, ZC); scene.add(reflector);
    const orig = reflector.onBeforeRender.bind(reflector); reflector.onBeforeRender = (r, s, c, g, m, gr) => { floor.visible = false; orig(r, s, c, g, m, gr); floor.visible = true; };
  }
  const C = TX.ceilingSet(mobile ? 256 : 512); C.map.repeat.set(W / 1.2, L / 1.2); C.normalMap.repeat.copy(C.map.repeat); [C.map, C.normalMap].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const ceil = new THREE.Mesh(PL(W, L), std({ map: C.map, normalMap: C.normalMap, roughness: 0.95 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, ZC); scene.add(ceil);
  await status('plastering the walls…', 0.22); const WS = TX.wallSet(TS, TS, H);
  const wallMat = (len, start) => { const m = std({ map: WS.map.clone(), roughnessMap: WS.roughnessMap.clone(), normalMap: WS.normalMap.clone(), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1 }); [m.map, m.roughnessMap, m.normalMap].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 4, 1); t.offset.set(start / 4, 0); t.needsUpdate = true; }); return m; };
  const wallSeg = (x, z0, z1, y0, y1, ry) => { const len = Math.abs(z1 - z0), h = y1 - y0; const m = new THREE.Mesh(PL(len, h), wallMat(len, Math.min(z0, z1))); m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); if (y0 > 0) { m.material.map.offset.y = y0 / H; m.material.map.repeat.y = h / H; [m.material.roughnessMap, m.material.normalMap].forEach(t => { t.offset.y = y0 / H; t.repeat.y = h / H; }); } return m; };
  // left wall with openings for the cabin door (z -4.2..-5.2) and strong room (z -9.8..-11.2)
  wallSeg(-W / 2, Z0, -4.2, 0, H, Math.PI / 2); wallSeg(-W / 2, -4.2, -5.2, 2.15, H, Math.PI / 2); wallSeg(-W / 2, -5.2, -9.8, 0, H, Math.PI / 2); wallSeg(-W / 2, -9.8, -11.2, 2.4, H, Math.PI / 2); wallSeg(-W / 2, -11.2, Z1, 0, H, Math.PI / 2);
  wallSeg(W / 2, Z0, Z1, 0, H, -Math.PI / 2);
  // end walls
  const endWall = (z, ry, holeX, holeW, holeH) => { const m1 = new THREE.Mesh(PL((W - holeW) / 2, H), wallMat((W - holeW) / 2, 0)); m1.position.set(-(holeW / 2 + (W - holeW) / 4), H / 2, z); m1.rotation.y = ry; scene.add(m1); const m2 = m1.clone(); m2.position.x = holeW / 2 + (W - holeW) / 4; scene.add(m2); const m3 = new THREE.Mesh(PL(holeW, H - holeH), wallMat(holeW, 0)); m3.position.set(0, holeH + (H - holeH) / 2, z); m3.rotation.y = ry; scene.add(m3); };
  endWall(Z1, 0, 0, 2.1, 2.3); endWall(Z0, Math.PI, 0, 1.1, 2.2);
  // cornice strip + ceiling grid rails
  const rail = std({ color: 0x9a968a, roughness: 0.8 }); [-W / 2 + 0.03, W / 2 - 0.03].forEach(x => { const r = new THREE.Mesh(BOX(0.06, 0.06, L), rail); r.position.set(x, H - 0.03, ZC); scene.add(r); });

  await status('fixing the tube lights (badly)…', 0.34);
  // ---------------- ceiling: tube lights, fans, dome camera ----------------
  const tubeZ = [-2, -6, -10, -14, -18, -22];
  const tubeMat = std({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 1.6, roughness: 0.3 });
  const housingMat = std({ color: 0xe8e6df, roughness: 0.6, metalness: 0.3 });
  const coneTex = (() => { const c = TX.canvas(4, 128), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); return TX.tex(c, { srgb: false }); })();
  tubeZ.forEach((z, i) => {
    const housing = new THREE.Mesh(BOX(1.4, 0.07, 0.28), housingMat); housing.position.set(0, H - 0.04, z); scene.add(housing);
    const tube = new THREE.Mesh(CYL(0.018, 0.018, 1.25, 12), tubeMat.clone()); tube.rotation.z = Math.PI / 2; tube.position.set(0, H - 0.09, z); scene.add(tube);
    let light;
    if (hq) { light = new THREE.RectAreaLight(0xffe9c8, 9, 1.3, 0.25); light.position.set(0, H - 0.1, z); light.lookAt(0, 0, z); }
    else { light = new THREE.PointLight(0xffe9c8, 4.5, 11, 1.8); light.position.set(0, H - 0.3, z); }
    scene.add(light); const dead = i === 3; if (dead) { light.intensity = 0; tube.material.emissiveIntensity = 0.05; tube.material.color.set(0x8a8a86); } lights.tubes.push({ tube, light, base: light.intensity, flickery: i === 1 || i === 4, dead, phase: Math.random() * 10 });
    if (hq) { const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.5, H - 0.1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe3b0, transparent: true, opacity: 0.018, alphaMap: coneTex, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); cone.position.set(0, (H - 0.1) / 2, z); scene.add(cone); }
  });
  // shadow-casting spots next to the fans
  const fans = [];
  [[-4, -2], [-16, -18]].forEach(([fz, lz]) => {
    const fan = new THREE.Group(); fan.position.set(0, H - 0.02, fz); scene.add(fan);
    const rod = new THREE.Mesh(CYL(0.02, 0.02, 0.45, 10), std({ color: 0x7a5a3a, metalness: 0.6, roughness: 0.4 })); rod.position.y = -0.22; fan.add(rod);
    const motor = new THREE.Mesh(CYL(0.12, 0.12, 0.14, 24), std({ color: 0x6b4a2e, metalness: 0.5, roughness: 0.5 })); motor.position.y = -0.5; fan.add(motor);
    const blades = new THREE.Group(); blades.position.y = -0.52; fan.add(blades);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(BOX(0.62, 0.012, 0.12), std({ color: 0x8a6a48, roughness: 0.6 })); b.position.x = 0.4; b.rotation.z = 0.12; const g = new THREE.Group(); g.rotation.y = k * Math.PI * 2 / 3; g.add(b); b.castShadow = true; blades.add(g); }
    reg('fan', fan);
    const spot = new THREE.SpotLight(0xffe4bf, hq ? 22 : 14, 11, 1.15, 0.6, 1.6); spot.position.set(0, H - 0.12, lz); spot.target.position.set(0, 0, fz); scene.add(spot, spot.target);
    if (hq) { spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.radius = 4; }
    lights.all.push(spot); fans.push({ fan, blades, wob: Math.random() * 10, spot });
  });
  anim.push((dt, t) => { fans.forEach(f => { f.blades.rotation.y += dt * (flags.fanFast ? 42 : 5.5); f.fan.rotation.z = Math.sin(t * 2 + f.wob) * (flags.fanFast ? 0.05 : 0.012); f.fan.rotation.x = Math.cos(t * 1.7 + f.wob) * 0.012; }); });
  // dome camera near the entry
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0x1a1a1a, roughness: 0.1, metalness: 0.6 })); dome.rotation.x = Math.PI; dome.position.set(1.2, H - 0.01, -0.6); scene.add(dome);
  const domeRing = new THREE.Mesh(CYL(0.13, 0.13, 0.03, 24), std({ color: 0xf0f0f0 })); domeRing.position.set(1.2, H - 0.015, -0.6); scene.add(domeRing);

  await status('printing the posters…', 0.44);
  // ---------------- LEFT WALL ----------------
  const X = -W / 2;
  // fire extinguisher + sign
  const ext = new THREE.Group(); ext.position.set(X + 0.1, 1.05, -1.2); scene.add(ext);
  ext.add(Object.assign(new THREE.Mesh(CYL(0.075, 0.075, 0.5, 20), std({ color: 0xb3121a, roughness: 0.35, metalness: 0.5 })), { castShadow: true }));
  const extTop = new THREE.Mesh(CYL(0.03, 0.03, 0.1, 12), std({ color: 0x222, metalness: 0.8, roughness: 0.3 })); extTop.position.y = 0.3; ext.add(extTop);
  const extSign = new THREE.Mesh(PL(0.22, 0.3), std({ map: TX.sign('FIRE', { w: 256, h: 340, bg: '#b3121a', fg: '#fff', font: 'bold 70px sans-serif', sub: 'EXTINGUISHER', subFont: 'bold 26px sans-serif' }) })); extSign.position.set(X + 0.01, 1.75, -1.2); extSign.rotation.y = Math.PI / 2; scene.add(extSign); reg('extinguisher', ext, extSign);
  // ---- RM cabin: window, door with recess room, nameplate ----
  const frost = TX.frostTex();
  const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0xbcd3e0, transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0.1, envMapIntensity: 1.2, side: THREE.DoubleSide });
  const frostMat = () => std({ color: 0xcfe0ea, transparent: true, opacity: 0.9, roughness: 0.9, alphaMap: frost, side: THREE.DoubleSide });
  const alu = std({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.35 });
  const cabinWin = new THREE.Group(); cabinWin.position.set(X + 0.02, 1.65, -3.1); cabinWin.rotation.y = Math.PI / 2; scene.add(cabinWin);
  cabinWin.add(new THREE.Mesh(PL(1.1, 0.9), frostMat())); [[-0.56, 0, 0.04, 0.98], [0.56, 0, 0.04, 0.98], [0, 0.46, 1.16, 0.04], [0, -0.46, 1.16, 0.04]].forEach(([x, y, w, h]) => { const f = new THREE.Mesh(BOX(w, h, 0.05), alu); f.position.set(x, y, 0); cabinWin.add(f); });
  // recess room behind the door
  const room = new THREE.Group(); room.position.set(X, 0, -4.7); scene.add(room);
  const dark = std({ color: 0x15120f, roughness: 1 });
  [[-2.8, 1.65, 0, 0.02, H, 3.2], [-1.4, 1.65, 1.6, 2.8, H, 0.02], [-1.4, 1.65, -1.6, 2.8, H, 0.02], [-1.4, H, 0, 2.8, 0.02, 3.2], [-1.4, 0.005, 0, 2.8, 0.01, 3.2]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(BOX(w, h, d), dark); m.position.set(x, y, z); room.add(m); });
  const rmDesk = new THREE.Mesh(BOX(1.2, 0.75, 0.6), std({ color: 0x2a1c12, roughness: 0.7 })); rmDesk.position.set(-1.8, 0.375, 0.3); room.add(rmDesk);
  const frameMat = std({ color: 0x3a2412, roughness: 0.7 }); const doorFrame = new THREE.Group(); room.add(doorFrame);
  [[0, 1.1, 0.54, 0.14, 2.2, 0.08], [0, 1.1, -0.54, 0.14, 2.2, 0.08], [0, 2.19, 0, 0.14, 0.1, 1.16]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(BOX(w, h, d), frameMat); m.position.set(x, y, z); m.castShadow = true; doorFrame.add(m); });
  const woodT = loadTex('assets/tex/wood_col.jpg'), woodB = loadTex('assets/tex/wood_bump.jpg', false), woodR = loadTex('assets/tex/wood_rgh.jpg', false); [woodT, woodB, woodR].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); });
  const doorPivot = new THREE.Group(); doorPivot.position.set(0.06, 0, 0.5); room.add(doorPivot); // hinge on the +z edge, opens inward (−x)
  const doorLeaf = new THREE.Mesh(BOX(0.05, 2.1, 0.96), std({ map: woodT, color: 0x8a6244, bumpMap: woodB, bumpScale: 0.004, roughnessMap: woodR, roughness: 1 })); doorLeaf.position.set(0, 1.05, -0.5); doorLeaf.castShadow = true; doorPivot.add(doorLeaf);
  const doorGlass = new THREE.Mesh(PL(0.4, 0.6), frostMat()); doorGlass.rotation.y = Math.PI / 2; doorGlass.position.set(0.03, 1.5, -0.5); doorPivot.add(doorGlass);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), std({ color: 0xd4af37, metalness: 1, roughness: 0.25 })); knob.position.set(0.05, 1.0, -0.86); doorPivot.add(knob);
  const plate = new THREE.Mesh(PL(0.5, 0.1), std({ map: TX.nameplate('REGIONAL MANAGER'), metalness: 0.6, roughness: 0.35 })); plate.position.set(X + 0.015, 1.95, -5.55); plate.rotation.y = Math.PI / 2; scene.add(plate);
  reg('cabin', doorFrame, doorPivot, plate, cabinWin);
  const cabinRed = new THREE.PointLight(0xff2a1a, 0, 3, 2); cabinRed.position.set(-0.35, 0.35, 0.1); room.add(cabinRed);
  const shoes = new THREE.Group(); shoes.visible = false; scene.add(shoes); for (let i = 0; i < 7; i++) { const sm = std({ color: 0x0f0b09, roughness: 0.45 }); const a = new THREE.Mesh(BOX(0.1, 0.07, 0.27), sm), b = a.clone(); a.position.set(X + 0.35, 0.035, -4.0 + i * 0.16); b.position.set(X + 0.47, 0.035, -4.0 + i * 0.16 + 0.03); a.rotation.y = b.rotation.y = Math.PI / 2 + (Math.random() - .5) * 0.1; shoes.add(a, b); }
  // switchboard + AC
  const sw = new THREE.Mesh(BOX(0.03, 0.3, 0.24), std({ color: 0xe8e4d8, roughness: 0.6 })); sw.position.set(X + 0.015, 1.4, -7.2); scene.add(sw); for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(BOX(0.02, 0.04, 0.03), std({ color: i === 2 ? 0xb3121a : 0xfafafa })); k.position.set(X + 0.04, 1.42, -7.3 + i * 0.065); scene.add(k); }
  const ac = new THREE.Group(); ac.position.set(X + 0.13, 2.65, -8.6); scene.add(ac); ac.add(new THREE.Mesh(BOX(0.24, 0.3, 0.95), std({ color: 0xf2f2ee, roughness: 0.5 }))); const vent = new THREE.Mesh(BOX(0.02, 0.06, 0.8), std({ color: 0x9a9a95 })); vent.position.set(0.12, -0.1, 0); ac.add(vent); reg('ac', ac);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), std({ color: 0xaad4ff, roughness: 0, metalness: 0.2, transparent: true, opacity: 0.8 })); drop.position.set(X + 0.2, 2.45, -8.6); scene.add(drop); let dropT = 0;
  anim.push((dt) => { dropT += dt; const p = (dropT % 3.5) / 3.5; drop.visible = p > 0.6; drop.position.y = 2.45 - Math.pow((p - 0.6) / 0.4, 2) * 2.4; if (p < 0.6) drop.position.y = 2.45; });
  // ---- strong room: vault door in recess ----
  const vault = new THREE.Group(); vault.position.set(X, 0, -10.5); scene.add(vault);
  const vMat = std({ color: 0x4a4f55, metalness: 0.8, roughness: 0.35 }); const vFrame = new THREE.Group(); vault.add(vFrame);
  [[-0.1, 1.2, 0.72, 0.3, 2.4, 0.12], [-0.1, 1.2, -0.72, 0.3, 2.4, 0.12], [-0.1, 2.34, 0, 0.3, 0.12, 1.56], [-0.1, 0.06, 0, 0.3, 0.12, 1.56], [-0.1, 2.0, 0, 0.3, 0.6, 1.3], [-0.1, 0.35, 0, 0.3, 0.5, 1.3]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(BOX(w, h, d), vMat); m.position.set(x, y, z); m.castShadow = true; vFrame.add(m); });
  const vInner = new THREE.Mesh(BOX(1.6, 2.2, 1.3), std({ color: 0x0b0b0d, side: THREE.BackSide })); vInner.position.set(-1.0, 1.1, 0); vault.add(vInner);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const lk = new THREE.Mesh(BOX(0.3, 0.42, 0.38), std({ color: 0x6a6f75, metalness: 0.7, roughness: 0.4 })); lk.position.set(-1.6, 0.3 + r * 0.46, -0.42 + c * 0.42); vault.add(lk); }
  const vPivot = new THREE.Group(); vPivot.position.set(0.06, 1.2, 0.62); vault.add(vPivot);
  const vDoor = new THREE.Mesh(CYL(0.6, 0.6, 0.22, 40), std({ color: 0x8a9096, metalness: 0.95, roughness: 0.3 })); vDoor.rotation.z = Math.PI / 2; vDoor.position.set(0.11, 0, -0.62); vDoor.castShadow = true; vPivot.add(vDoor);
  const vDial = new THREE.Mesh(CYL(0.18, 0.18, 0.04, 32), std({ map: TX.vaultDial(), metalness: 0.7, roughness: 0.4 })); vDial.rotation.z = Math.PI / 2; vDial.position.set(0.24, 0.1, -0.62); vPivot.add(vDial);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 32), std({ color: 0xc0c4c8, metalness: 1, roughness: 0.25 })); wheel.rotation.y = Math.PI / 2; wheel.position.set(0.3, -0.25, -0.62); vPivot.add(wheel); for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(BOX(0.02, 0.4, 0.02), wheel.material); sp.rotation.x = k * Math.PI / 3; sp.position.copy(wheel.position); vPivot.add(sp); }
  const vSign = new THREE.Mesh(PL(0.9, 0.18), std({ map: TX.sign('STRONG ROOM', { w: 512, h: 100, bg: '#1a1a1a', fg: '#f5c542', font: 'bold 60px sans-serif' }) })); vSign.position.set(X + 0.02, 2.6, -10.5); vSign.rotation.y = Math.PI / 2; scene.add(vSign);
  reg('vault', vault, vSign);
  const vaultLight = new THREE.PointLight(0x4a7aff, 0, 3); vaultLight.position.set(-0.9, 1.0, 0); vault.add(vaultLight);
  // locker cabinet
  const metalT = TX.counterShutter();
  const cab = new THREE.Mesh(BOX(0.45, 1.9, 1.0), std({ color: 0x8a8f94, metalness: 0.6, roughness: 0.5 })); cab.position.set(X + 0.23, 0.95, -12.3); cab.castShadow = true; scene.add(cab); for (let k = 0; k < 2; k++) { const h = new THREE.Mesh(BOX(0.02, 0.1, 0.02), std({ color: 0x222 })); h.position.set(X + 0.47, 1.0, -12.3 + (k ? 0.25 : -0.25)); scene.add(h); }
  // noticeboard
  const notice = new THREE.Mesh(PL(1.6, 1.0), std({ map: TX.noticeBoard(false), roughness: 0.95 })); notice.position.set(X + 0.055, 1.75, -14.2); notice.rotation.y = Math.PI / 2; scene.add(notice);
  const nFrame = new THREE.Mesh(BOX(0.05, 1.1, 1.7), std({ color: 0x3a2412, roughness: 0.7 })); nFrame.position.set(X + 0.01, 1.75, -14.2); scene.add(nFrame); reg('notice', notice, nFrame);
  // posters (framed)
  const framed = (t, x, y, z, ry, w = 0.5, h = 0.7, id = 'poster') => { const f = new THREE.Mesh(BOX(0.03, h + 0.06, w + 0.06), std({ color: 0x1a1a1a, roughness: 0.4 })); f.position.set(x, y, z); f.rotation.y = ry - Math.PI / 2; scene.add(f); const p = new THREE.Mesh(PL(w, h), std({ map: t, roughness: 0.6 })); p.position.set(x + (ry > 0 ? 0.03 : -0.03), y, z); p.rotation.y = ry; scene.add(p); reg(id, f, p); return p; };
  framed(TX.poster('fraud'), X + 0.02, 1.7, -16.4, Math.PI / 2); framed(TX.poster('loan'), X + 0.02, 1.7, -17.4, Math.PI / 2);
  // water cooler
  const cooler = new THREE.Group(); cooler.position.set(X + 0.32, 0, -19.1); scene.add(cooler);
  const cBase = new THREE.Mesh(BOX(0.44, 1.05, 0.44), std({ color: 0xe6e3da, roughness: 0.55 })); cBase.position.y = 0.525; cBase.castShadow = true; cooler.add(cBase);
  const jarMat = new THREE.MeshPhysicalMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0, envMapIntensity: 1.5 });
  const jar = new THREE.Mesh(CYL(0.19, 0.19, 0.55, 28), jarMat); jar.position.y = 1.33; cooler.add(jar); const jarTop = new THREE.Mesh(new THREE.SphereGeometry(0.19, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), jarMat); jarTop.position.y = 1.6; cooler.add(jarTop);
  const water = new THREE.Mesh(CYL(0.175, 0.175, 0.38, 28), std({ color: 0x3aa0ff, transparent: true, opacity: 0.55, roughness: 0.05 })); water.position.y = 1.25; cooler.add(water);
  [[0.1, 0x2a5fbf], [-0.1, 0xbf2a2a]].forEach(([z, col]) => { const t = new THREE.Mesh(BOX(0.06, 0.06, 0.08), std({ color: col })); t.position.set(0.25, 0.9, z); cooler.add(t); });
  const cupStack = new THREE.Mesh(CYL(0.035, 0.028, 0.3, 14), std({ color: 0xfafafa, roughness: 0.8 })); cupStack.position.set(0.3, 1.2, 0.3); cooler.add(cupStack);
  reg('cooler', cooler);
  // ---- counters (ENQUIRY, CASH 1, CASH 2) ----
  const counter = new THREE.Group(); scene.add(counter);
  const ctop = new THREE.Mesh(BOX(0.75, 0.06, 4.2), std({ color: 0x3a2a1c, roughness: 0.4 })); ctop.position.set(X + 0.45, 1.05, -22.4); ctop.castShadow = true; counter.add(ctop);
  const cfront = new THREE.Mesh(BOX(0.06, 1.02, 4.2), std({ map: woodT, color: 0x9a7a5a, roughness: 0.8 })); cfront.position.set(X + 0.8, 0.51, -22.4); counter.add(cfront);
  const cGlass = new THREE.Mesh(PL(4.2, 1.05), glassMat()); cGlass.position.set(X + 0.82, 1.6, -22.4); cGlass.rotation.y = Math.PI / 2; counter.add(cGlass);
  for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(BOX(0.05, 1.1, 0.05), alu); d.position.set(X + 0.82, 1.6, -20.3 - k * 1.4); counter.add(d); }
  const cTopRail = new THREE.Mesh(BOX(0.06, 0.05, 4.2), alu); cTopRail.position.set(X + 0.82, 2.14, -22.4); counter.add(cTopRail);
  const windows = ['ENQUIRY', 'CASH 1', 'CASH 2'].map((name, k) => { const z = -21.0 - k * 1.4; const sh = new THREE.Mesh(PL(1.3, 1.0), std({ map: metalT, metalness: 0.7, roughness: 0.45 })); sh.position.set(X + 0.1, 1.62, z); sh.rotation.y = Math.PI / 2; counter.add(sh); const sg = new THREE.Mesh(PL(0.7, 0.14), std({ map: TX.sign(name, { w: 512, h: 100, bg: '#0b2a5a', fg: '#fff', font: 'bold 62px sans-serif' }) })); sg.position.set(X + 0.84, 2.25, z); sg.rotation.y = Math.PI / 2; counter.add(sg); const slot = new THREE.Mesh(BOX(0.4, 0.02, 0.01), std({ color: 0x111 })); slot.position.set(X + 0.8, 1.08, z); counter.add(slot); return { name, z, shutter: sh }; });
  const counterLight = new THREE.PointLight(0xfff2cc, 0, 3); counterLight.position.set(X + 0.3, 2.0, -22.4); scene.add(counterLight);
  reg('counter', counter);
  // token display
  const tokenTex = TX.ledDisplay('NOW SERVING 0000', { w: 1024, h: 256 });
  const token = new THREE.Mesh(BOX(0.06, 0.3, 1.2), std({ color: 0x111, roughness: 0.5 })); token.position.set(X + 0.08, 2.75, -22.4); scene.add(token);
  const tokenScr = new THREE.Mesh(PL(1.1, 0.26), std({ map: tokenTex, emissive: 0xff3030, emissiveMap: tokenTex, emissiveIntensity: 1.8, roughness: 0.4 })); tokenScr.position.set(X + 0.125, 2.75, -22.4); tokenScr.rotation.y = Math.PI / 2; scene.add(tokenScr); reg('token', token, tokenScr);

  await status('arranging the desk…', 0.56);
  // ---------------- RIGHT WALL ----------------
  const XR = W / 2; const cardTex = TX.weddingCard();
  // security desk + CCTV monitor + plastic chair
  const sec = new THREE.Group(); sec.position.set(XR - 0.45, 0, -1.4); scene.add(sec);
  const sTop = new THREE.Mesh(BOX(0.8, 0.04, 1.0), std({ color: 0x8a6a48, roughness: 0.6 })); sTop.position.y = 0.76; sTop.castShadow = true; sec.add(sTop); [[-0.35, -0.45], [-0.35, 0.45], [0.35, -0.45], [0.35, 0.45]].forEach(([x, z]) => { const l = new THREE.Mesh(BOX(0.04, 0.74, 0.04), std({ color: 0x333, metalness: 0.7, roughness: 0.4 })); l.position.set(x, 0.37, z); sec.add(l); });
  const mon = new THREE.Mesh(BOX(0.5, 0.42, 0.42), std({ color: 0xd8d4c8, roughness: 0.6 })); mon.position.set(0.1, 1.0, 0.1); mon.castShadow = true; sec.add(mon);
  const cctvTexN = TX.cctvScreen(false), cctvTexB = TX.cctvScreen(true);
  const cctvScr = new THREE.Mesh(PL(0.36, 0.28), std({ map: cctvTexN, emissive: 0x33ff77, emissiveMap: cctvTexN, emissiveIntensity: 0.9, roughness: 0.3 })); cctvScr.position.set(-0.16, 1.02, 0.1); cctvScr.rotation.y = -Math.PI / 2; sec.add(cctvScr);
  const cctvLight = new THREE.PointLight(0x33ff77, 1.2, 2.5, 2); cctvLight.position.set(-0.5, 1.0, 0.1); sec.add(cctvLight);
  const register = new THREE.Mesh(BOX(0.3, 0.04, 0.22), std({ color: 0x8a1515, roughness: 0.8 })); register.position.set(-0.1, 0.8, -0.3); sec.add(register);
  const pchair = new THREE.Group(); pchair.position.set(0.1, 0, 0.75); pchair.rotation.y = Math.PI; sec.add(pchair); const pm = std({ color: 0x2a4a8a, roughness: 0.5 }); const ps = new THREE.Mesh(BOX(0.42, 0.04, 0.42), pm); ps.position.y = 0.45; pchair.add(ps); const pb = new THREE.Mesh(BOX(0.42, 0.42, 0.04), pm); pb.position.set(0, 0.68, -0.2); pchair.add(pb); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([x, z]) => { const l = new THREE.Mesh(CYL(0.015, 0.015, 0.45, 8), pm); l.position.set(x, 0.22, z); pchair.add(l); });
  reg('cctv', sec);
  // ATM kiosk
  const atm = new THREE.Group(); atm.position.set(XR - 0.45, 0, -3.9); scene.add(atm);
  const atmBody = new THREE.Mesh(BOX(0.6, 1.75, 0.85), std({ color: 0x1b3a6e, roughness: 0.45, metalness: 0.3 })); atmBody.position.y = 0.875; atmBody.castShadow = true; atm.add(atmBody);
  const atmTex = TX.atmScreen(); const atmScr = new THREE.Mesh(PL(0.45, 0.35), std({ map: atmTex, emissive: 0x4a8cff, emissiveMap: atmTex, emissiveIntensity: 0.9 })); atmScr.position.set(-0.31, 1.3, 0); atmScr.rotation.y = -Math.PI / 2; atmScr.rotation.x = 0; atm.add(atmScr);
  const atmKeys = new THREE.Mesh(BOX(0.02, 0.1, 0.3), std({ color: 0xcfcfcf, metalness: 0.5, roughness: 0.5 })); atmKeys.position.set(-0.31, 0.95, 0); atm.add(atmKeys);
  const atmSlot = new THREE.Mesh(BOX(0.02, 0.025, 0.4), std({ color: 0x080808 })); atmSlot.position.set(-0.31, 0.72, 0); atm.add(atmSlot);
  const atmLight = new THREE.PointLight(0x4a8cff, 1.4, 3, 2); atmLight.position.set(-0.6, 1.4, 0); atm.add(atmLight);
  const atmGlassL = new THREE.Mesh(PL(1.6, 2.4), glassMat()); atmGlassL.position.set(-1.0, 1.2, 0); atmGlassL.rotation.y = -Math.PI / 2; atm.add(atmGlassL); [[-1.0, 0, -0.8], [-1.0, 0, 0.8]].forEach(([x, y, z]) => { const f = new THREE.Mesh(BOX(0.06, 2.4, 0.06), alu); f.position.set(x, 1.2, z); atm.add(f); }); const fTop = new THREE.Mesh(BOX(0.06, 0.06, 1.6), alu); fTop.position.set(-1.0, 2.42, 0); atm.add(fTop);
  const atmSign = new THREE.Mesh(PL(0.9, 0.22), std({ map: TX.sign('24 × 7  ATM', { w: 512, h: 120, bg: '#b3121a', fg: '#fff', font: 'bold 64px sans-serif' }) })); atmSign.position.set(-1.03, 2.2, 0); atmSign.rotation.y = -Math.PI / 2; atm.add(atmSign);
  const cards = new THREE.Group(); cards.visible = false; atm.add(cards);
  for (let i = 0; i < 24; i++) { const c = new THREE.Mesh(PL(0.16, 0.1), std({ map: cardTex, side: THREE.DoubleSide, roughness: 0.9 })); c.position.set(-0.5 - Math.random() * 0.9, 0.003 + i * 0.002, (Math.random() - 0.5) * 1.4); c.rotation.set(-Math.PI / 2, 0, Math.random() * 6); cards.add(c); }
  const fallCards = []; for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(PL(0.16, 0.1), std({ map: cardTex, side: THREE.DoubleSide })); c.userData.t = Math.random() * 3; cards.add(c); fallCards.push(c); }
  anim.push((dt) => { if (!cards.visible) return; fallCards.forEach(c => { c.userData.t = (c.userData.t + dt) % 3; const p = c.userData.t / 3; c.position.set(-0.4 - p * 0.6, 0.75 - p * 0.72, Math.sin(p * 9) * 0.15); c.rotation.set(p * 6, p * 3, 0); }); });
  reg('atm', atm);
  // NPA whiteboard
  const npaTexN = TX.npaBoard(false), npaTexG = TX.npaBoard(true);
  const npa = new THREE.Mesh(PL(1.6, 1.0), std({ map: npaTexN, roughness: 0.5 })); npa.position.set(XR - 0.05, 1.75, -6.4); npa.rotation.y = -Math.PI / 2; scene.add(npa);
  const npaF = new THREE.Mesh(BOX(0.04, 1.08, 1.68), alu); npaF.position.set(XR - 0.015, 1.75, -6.4); scene.add(npaF); const tray = new THREE.Mesh(BOX(0.08, 0.03, 0.6), alu); tray.position.set(XR - 0.06, 1.22, -6.4); scene.add(tray); reg('npa', npa, npaF);
  // ---- Goku's desk ----
  const desk = new THREE.Group(); desk.position.set(XR - 0.95, 0, -9.6); scene.add(desk);
  const deskMat = std({ map: woodT.clone(), color: 0x9a7a5a, bumpMap: woodB, bumpScale: 0.003, roughness: 0.5 }); deskMat.map.repeat.set(2, 2); deskMat.map.needsUpdate = true;
  const dTop = new THREE.Mesh(BOX(0.85, 0.05, 1.9), deskMat); dTop.position.y = 0.76; dTop.castShadow = true; dTop.receiveShadow = true; desk.add(dTop);
  const dFront = new THREE.Mesh(BOX(0.04, 0.72, 1.9), deskMat); dFront.position.set(-0.4, 0.37, 0); desk.add(dFront); [[0.38, -0.9], [0.38, 0.9], [-0.38, -0.9], [-0.38, 0.9]].forEach(([x, z]) => { const l = new THREE.Mesh(BOX(0.05, 0.74, 0.05), deskMat); l.position.set(x, 0.37, z); desk.add(l); });
  const drawer = new THREE.Mesh(BOX(0.7, 0.6, 0.5), deskMat); drawer.position.set(0, 0.42, 0.6); desk.add(drawer); for (let k = 0; k < 3; k++) { const h = new THREE.Mesh(BOX(0.12, 0.02, 0.02), std({ color: 0xd4af37, metalness: 1, roughness: 0.3 })); h.position.set(-0.36, 0.25 + k * 0.17, 0.6); desk.add(h); }
  // monitor (faces -x, toward the hall)
  const monT = TX.monitorScreen(); const monB = new THREE.Mesh(BOX(0.03, 0.36, 0.56), std({ color: 0x111, roughness: 0.4 })); monB.position.set(0.1, 1.03, -0.3); desk.add(monB); const monS = new THREE.Mesh(PL(0.52, 0.32), std({ map: monT, emissive: 0x5a8cff, emissiveMap: monT, emissiveIntensity: 0.75, roughness: 0.2 })); monS.position.set(0.078, 1.03, -0.3); monS.rotation.y = -Math.PI / 2; desk.add(monS); const monStand = new THREE.Mesh(BOX(0.08, 0.2, 0.08), std({ color: 0x111 })); monStand.position.set(0.1, 0.88, -0.3); desk.add(monStand);
  const scrLight = new THREE.PointLight(0x5a8cff, 1.1, 2.2, 2); scrLight.position.set(-0.2, 1.1, -0.3); desk.add(scrLight);
  const kb = new THREE.Mesh(BOX(0.14, 0.02, 0.42), std({ color: 0x1a1a1a, roughness: 0.6 })); kb.position.set(-0.15, 0.795, -0.3); desk.add(kb);
  // banker's lamp
  const lamp = new THREE.Group(); lamp.position.set(0.15, 0.785, 0.45); desk.add(lamp); const brass = std({ color: 0xc9a23a, metalness: 1, roughness: 0.3 }); const lBase = new THREE.Mesh(CYL(0.09, 0.11, 0.02, 20), brass); lamp.add(lBase); const lPole = new THREE.Mesh(CYL(0.012, 0.012, 0.3, 8), brass); lPole.position.y = 0.16; lamp.add(lPole); const lShade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 20, 1, true, 0, Math.PI), std({ color: 0x1f6b3a, emissive: 0x2aff7a, emissiveIntensity: 0.6, roughness: 0.2, side: THREE.DoubleSide })); lShade.position.set(0, 0.34, 0); lShade.rotation.z = Math.PI / 2; lShade.rotation.y = Math.PI / 2; lamp.add(lShade);
  const lampLight = new THREE.PointLight(0xffd9a0, 2.2, 2.6, 2); lampLight.position.set(-0.08, 0.3, 0); lamp.add(lampLight); reg('lamp', lamp);
  // phones, files, cup, nameplate
  const phone = new THREE.Mesh(BOX(0.075, 0.012, 0.15), std({ color: 0x0a0a0a, roughness: 0.25, metalness: 0.6 })); phone.position.set(-0.2, 0.795, 0.2); phone.rotation.y = 0.3; desk.add(phone);
  const phoneScr = new THREE.Mesh(PL(0.065, 0.13), std({ color: 0x000, emissive: 0xff2a2a, emissiveIntensity: 0 })); phoneScr.rotation.x = -Math.PI / 2; phoneScr.rotation.z = -0.3; phoneScr.position.set(-0.2, 0.802, 0.2); desk.add(phoneScr);
  const phoneLight = new THREE.PointLight(0xff2020, 0, 1.6, 2); phoneLight.position.set(-0.2, 0.95, 0.2); desk.add(phoneLight);
  const landline = new THREE.Mesh(BOX(0.18, 0.07, 0.22), std({ color: 0xe8e4d8, roughness: 0.6 })); landline.position.set(0.2, 0.82, 0.1); desk.add(landline); const receiver = new THREE.Mesh(BOX(0.05, 0.04, 0.2), std({ color: 0xe8e4d8 })); receiver.position.set(0.12, 0.88, 0.1); desk.add(receiver);
  const fileT = TX.fileLabel(); const files = new THREE.Group(); desk.add(files); for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(BOX(0.3, 0.035, 0.24), std({ map: fileT, roughness: 0.9 })); f.position.set(0.1, 0.8 + k * 0.037, -0.75); f.rotation.y = (Math.random() - 0.5) * 0.2; files.add(f); }
  const cup = new THREE.Mesh(CYL(0.035, 0.03, 0.08, 16), std({ color: 0xfafafa, roughness: 0.6 })); cup.position.set(-0.25, 0.83, -0.65); desk.add(cup);
  const bmPlate = new THREE.Mesh(PL(0.34, 0.07), std({ map: TX.nameplate('BRANCH MANAGER'), metalness: 0.6, roughness: 0.35 })); bmPlate.position.set(-0.43, 0.6, 0); bmPlate.rotation.y = -Math.PI / 2; desk.add(bmPlate);
  const thaali = new THREE.Group(); thaali.visible = false; thaali.position.set(0.05, 0.8, 0.3); desk.add(thaali); const gold = std({ color: 0xffc83c, metalness: 1, roughness: 0.2, emissive: 0x3a2200, emissiveIntensity: 0.3 }); const tCord = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 8, 40), gold); tCord.rotation.x = Math.PI / 2; thaali.add(tCord); for (let k = 0; k < 2; k++) { const pend = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), gold); pend.position.set(0.02 * (k ? 1 : -1), 0.012, 0.07); thaali.add(pend); } const pendant = new THREE.Mesh(CYL(0.012, 0.016, 0.03, 12), gold); pendant.position.set(0, 0.015, 0.075); thaali.add(pendant);
  const invite = new THREE.Mesh(PL(0.16, 0.1), std({ map: cardTex, roughness: 0.85, side: THREE.DoubleSide })); invite.rotation.x = -Math.PI / 2 + 0.25; invite.rotation.z = -0.4; invite.position.set(-0.22, 0.81, -0.1); desk.add(invite);
  reg('desk', dTop, dFront, drawer, monB, monS, kb, phone, landline, files, bmPlate, thaali); reg('card', invite);
  // executive chair behind the desk, two visitor chairs in front
  const exec = new THREE.Group(); exec.position.set(XR - 0.35, 0, -9.6); exec.rotation.y = -Math.PI / 2; scene.add(exec); const leather = std({ color: 0x1a1612, roughness: 0.5 }); const es = new THREE.Mesh(BOX(0.55, 0.1, 0.55), leather); es.position.y = 0.5; es.castShadow = true; exec.add(es); const eb = new THREE.Mesh(BOX(0.55, 0.7, 0.1), leather); eb.position.set(0, 0.9, -0.25); eb.castShadow = true; exec.add(eb); const ebase = new THREE.Mesh(CYL(0.04, 0.04, 0.45, 10), alu); ebase.position.y = 0.22; exec.add(ebase); for (let k = 0; k < 5; k++) { const leg = new THREE.Mesh(BOX(0.3, 0.03, 0.04), alu); leg.position.set(0, 0.03, 0); leg.rotation.y = k * Math.PI * 2 / 5; leg.translateX(0.15); exec.add(leg); }
  const vchair = (z) => { const g = new THREE.Group(); g.position.set(XR - 1.75, 0, z); g.rotation.y = Math.PI / 2; scene.add(g); const m = std({ color: 0x2d4a6e, roughness: 0.55, metalness: 0.2 }); const s = new THREE.Mesh(BOX(0.46, 0.05, 0.46), m); s.position.y = 0.46; s.castShadow = true; g.add(s); const b = new THREE.Mesh(BOX(0.46, 0.45, 0.04), m); b.position.set(0, 0.72, -0.22); b.castShadow = true; g.add(b); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([x, zz]) => { const l = new THREE.Mesh(CYL(0.014, 0.014, 0.46, 8), alu); l.position.set(x, 0.23, zz); g.add(l); }); return g; };
  vchair(-9.1); vchair(-10.1);
  const bin = new THREE.Mesh(CYL(0.14, 0.11, 0.36, 20), std({ color: 0x2a2a2a, roughness: 0.5 })); bin.position.set(XR - 0.55, 0.18, -11.1); bin.castShadow = true; scene.add(bin); reg('bin', bin);
  // calendar behind the desk
  const calN = TX.calendar(false), calW = TX.calendar(true);
  const cal = new THREE.Mesh(PL(0.45, 0.56), std({ map: calN, roughness: 0.8 })); cal.position.set(XR - 0.025, 1.85, -9.6); cal.rotation.y = -Math.PI / 2; scene.add(cal); reg('calendar', cal);
  // ---- Chairman portrait with picture light ----
  const porFrame = new THREE.Mesh(BOX(0.06, 1.12, 0.92), std({ color: 0x5a3a10, roughness: 0.5, metalness: 0.2 })); porFrame.position.set(XR - 0.04, 2.0, -12.6); scene.add(porFrame);
  const porTexN = TX.portraitPainting(false), porTexM = TX.portraitPainting(true);
  const por = new THREE.Mesh(PL(0.8, 1.0), std({ map: porTexN, roughness: 0.75 })); por.position.set(XR - 0.085, 2.0, -12.6); por.rotation.y = -Math.PI / 2; scene.add(por);
  const picBar = new THREE.Mesh(BOX(0.12, 0.04, 0.6), std({ color: 0xc9a23a, metalness: 1, roughness: 0.3 })); picBar.position.set(XR - 0.12, 2.62, -12.6); scene.add(picBar);
  const porLight = new THREE.SpotLight(0xffe0b0, hq ? 7 : 5, 3.5, 0.6, 0.7, 1.4); porLight.position.set(XR - 0.18, 2.6, -12.6); porLight.target.position.set(XR, 1.9, -12.6); scene.add(porLight, porLight.target);
  reg('portrait', porFrame, por);
  framed(TX.poster('fd'), XR - 0.02, 1.7, -14.8, -Math.PI / 2);
  // ---- waiting bench (perforated steel, faces the counters) ----
  const bench = new THREE.Group(); bench.position.set(1.35, 0, -21.6); bench.rotation.y = Math.PI / 2; scene.add(bench);
  const perf = TX.perfTex(); const benchMat = std({ color: 0x9aa0a8, metalness: 0.85, roughness: 0.35, alphaMap: perf, alphaTest: 0.5, side: THREE.DoubleSide });
  const seat = new THREE.Mesh(BOX(1.65, 0.03, 0.45), benchMat); seat.position.y = 0.46; seat.castShadow = true; bench.add(seat); const back = new THREE.Mesh(BOX(1.65, 0.38, 0.03), benchMat); back.position.set(0, 0.72, -0.22); back.rotation.x = -0.15; back.castShadow = true; bench.add(back);
  [[-0.7], [0.7]].forEach(([x]) => { const leg = new THREE.Mesh(BOX(0.06, 0.46, 0.5), std({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.4 })); leg.position.set(x, 0.23, 0); bench.add(leg); const arm = new THREE.Mesh(BOX(0.04, 0.03, 0.4), alu); arm.position.set(x, 0.66, -0.02); bench.add(arm); });
  for (let k = 0; k < 2; k++) { const div = new THREE.Mesh(BOX(0.02, 0.1, 0.4), alu); div.position.set(-0.27 + k * 0.55, 0.52, 0); bench.add(div); }
  reg('bench', bench);
  // plant
  const plant = new THREE.Group(); plant.position.set(XR - 0.5, 0, -24.3); scene.add(plant);
  const pot = new THREE.Mesh(CYL(0.22, 0.16, 0.5, 18), std({ color: 0x8a4a2a, roughness: 0.85 })); pot.position.y = 0.25; pot.castShadow = true; plant.add(pot); const soil = new THREE.Mesh(CYL(0.2, 0.2, 0.02, 18), std({ color: 0x2a1a0e, roughness: 1 })); soil.position.y = 0.5; plant.add(soil); for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(CYL(0.008, 0.012, 0.9, 6), std({ color: 0x3a6a2a, roughness: 0.8 })); st.position.set((Math.random() - .5) * 0.2, 0.9, (Math.random() - .5) * 0.2); st.rotation.set((Math.random() - .5) * 0.5, 0, (Math.random() - .5) * 0.5); plant.add(st); }
  const leaves = new THREE.Group(); leaves.position.y = 0.55; plant.add(leaves); const leafMat = std({ color: 0x2f7d32, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 28; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), leafMat); const a = Math.random() * 6.28, r = 0.1 + Math.random() * 0.3; l.position.set(Math.cos(a) * r, Math.random() * 0.8, Math.sin(a) * r); l.scale.set(1, 0.35, 1.6); l.rotation.set(Math.random() * 0.8 - 0.4, a, Math.random() * 0.4); l.castShadow = true; leaves.add(l); }
  reg('plant', plant);

  // ---------------- FAR WALL: exit, sign, clock, outside ----------------
  const exitG = new THREE.Group(); exitG.position.set(0, 0, Z1 + 0.02); scene.add(exitG);
  const dFrameMat = std({ color: 0x2a2c31, roughness: 0.5, metalness: 0.6 }); const dFrame = new THREE.Group(); exitG.add(dFrame); [[-1.0, 1.16, 0.1, 2.32], [1.0, 1.16, 0.1, 2.32], [0, 2.27, 2.1, 0.1]].forEach(([x, y, w, h]) => { const m = new THREE.Mesh(BOX(w, h, 0.12), dFrameMat); m.position.set(x, y, 0); m.castShadow = true; dFrame.add(m); });
  const exitGlassM = new THREE.MeshPhysicalMaterial({ color: 0xfff4e6, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, envMapIntensity: 0.5, side: THREE.DoubleSide, emissive: 0xff8a30, emissiveIntensity: 0.06, depthWrite: false });
  const exitLeafMat = std({ color: 0x55585e, metalness: 0.7, roughness: 0.35 });
  [-0.5, 0.5].forEach(x => { [[x, 0.1, 0.96, 0.2], [x, 2.13, 0.96, 0.14], [x - 0.44, 1.1, 0.08, 2.2], [x + 0.44, 1.1, 0.08, 2.2]].forEach(([bx, by, bw, bh]) => { const m = new THREE.Mesh(BOX(bw, bh, 0.05), exitLeafMat); m.position.set(bx, by, 0.07); m.castShadow = true; exitG.add(m); });
    const g = new THREE.Mesh(PL(0.8, 1.86), exitGlassM); g.position.set(x, 1.13, 0.07); exitG.add(g); const bar = new THREE.Mesh(BOX(0.7, 0.04, 0.04), std({ color: 0xd4af37, metalness: 1, roughness: 0.3 })); bar.position.set(x, 1.0, 0.15); exitG.add(bar); const push = new THREE.Mesh(PL(0.18, 0.07), std({ map: TX.sign('PUSH', { w: 256, h: 100, bg: '#ffffff', fg: '#b3121a', font: 'bold 70px sans-serif' }), transparent: true, opacity: 0.9 })); push.position.set(x, 1.45, 0.11); exitG.add(push); });
  const exitTexN = TX.sign('EXIT', { w: 512, h: 220, bg: '#0a1f12', fg: '#43ff7a', font: 'bold 150px sans-serif' }), exitTexE = TX.sign('ENTRY', { w: 512, h: 220, bg: '#1f0a0a', fg: '#ff3b3b', font: 'bold 150px sans-serif' });
  const exitBox = new THREE.Mesh(BOX(0.7, 0.3, 0.1), std({ color: 0x1a1a1a, roughness: 0.4 })); exitBox.position.set(0, 2.62, 0.08); exitG.add(exitBox);
  const exitSign = new THREE.Mesh(PL(0.66, 0.26), std({ map: exitTexN, emissive: 0x43ff7a, emissiveMap: exitTexN, emissiveIntensity: 1.8 })); exitSign.position.set(0, 2.62, 0.14); exitG.add(exitSign);
  const exitLight = new THREE.PointLight(0x43ff7a, 1.6, 4, 2); exitLight.position.set(0, 2.5, 0.6); exitG.add(exitLight);
  reg('exit', dFrame, exitBox, exitSign, ...exitG.children.filter(c => c.isMesh));
  // outside: vestibule with warm light, rain, marigold hint
  const outside = new THREE.Group(); outside.position.set(0, 0, Z1); scene.add(outside);
  const oFloor = new THREE.Mesh(PL(6, 4), std({ color: 0x6a5a48, roughness: 0.9 })); oFloor.rotation.x = -Math.PI / 2; oFloor.position.set(0, 0, -2); outside.add(oFloor);
  const oWall = new THREE.Mesh(PL(6, 4), std({ color: 0x4a3a2a, roughness: 1 })); oWall.position.set(0, 2, -4); outside.add(oWall);
  const mantapaLight = new THREE.PointLight(0xff9a3a, 9, 9, 1.7); mantapaLight.position.set(0.4, 1.6, -2.2); outside.add(mantapaLight);
  const garland = new THREE.Group(); outside.add(garland); for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std({ color: i % 2 ? 0xffa21a : 0xfff0c0, emissive: i % 2 ? 0x662a00 : 0x443300, emissiveIntensity: 0.6, roughness: 0.8 })); const t = i / 39; m.position.set(-1.6 + t * 3.2, 2.3 - Math.sin(t * Math.PI) * 0.5, -1.0); garland.add(m); }
  // the auto, waiting outside with the meter running
  const auto = new THREE.Group(); auto.position.set(1.6, 0, -2.6); auto.rotation.y = -0.6; outside.add(auto);
  const autoBody = std({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }), autoYellow = std({ color: 0xf2c200, roughness: 0.5, metalness: 0.2 });
  const ab = new THREE.Mesh(BOX(1.3, 0.55, 2.3), autoBody); ab.position.y = 0.55; auto.add(ab); const acab = new THREE.Mesh(BOX(1.32, 0.9, 1.9), autoYellow); acab.position.set(0, 1.25, 0.1); auto.add(acab);
  const hood = new THREE.Mesh(BOX(1.0, 0.5, 0.6), autoYellow); hood.position.set(0, 0.75, -1.25); auto.add(hood); const wshield = new THREE.Mesh(PL(1.0, 0.55), glassMat()); wshield.position.set(0, 1.3, -0.86); auto.add(wshield);
  [[-0.6, 0.6], [0.6, 0.6], [0, -1.35]].forEach(([x, z]) => { const wheel = new THREE.Mesh(CYL(0.26, 0.26, 0.16, 18), autoBody); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.26, z); auto.add(wheel); });
  const headlamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), std({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 2 })); headlamp.position.set(0, 0.95, -1.56); auto.add(headlamp); const headLight = new THREE.PointLight(0xfff0c0, 2.5, 6, 2); headLight.position.set(0, 1.0, -1.9); auto.add(headLight);
  const meterBox = new THREE.Mesh(BOX(0.12, 0.1, 0.1), std({ color: 0x222 })); meterBox.position.set(0.45, 1.75, -0.5); auto.add(meterBox); const meterLamp = new THREE.PointLight(0xff3030, 0.6, 1.5); meterLamp.position.set(0.45, 1.8, -0.5); auto.add(meterLamp);
  const autoSign = new THREE.Mesh(PL(0.9, 0.2), std({ map: TX.sign('AUTO · BOSI & KAILU WAITING', { w: 640, h: 120, bg: '#f2c200', fg: '#1a1a1a', font: 'bold 40px sans-serif' }), roughness: 0.6 })); autoSign.position.set(0, 1.72, 1.06); autoSign.rotation.y = Math.PI; auto.add(autoSign);
  reg('auto', auto);
  // rain streaks
  const rainN = hq ? 500 : 220; const rainPos = new Float32Array(rainN * 6); const rainSeed = [];
  for (let i = 0; i < rainN; i++) { const x = (Math.random() - 0.5) * 6, z = -0.4 - Math.random() * 3.4, y = Math.random() * 3.3; rainSeed.push({ x, z, y, s: 3 + Math.random() * 2 }); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3)); const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.35, fog: false })); outside.add(rain);
  anim.push((dt) => { for (let i = 0; i < rainN; i++) { const r = rainSeed[i]; r.y -= r.s * dt; if (r.y < 0) r.y = 3.3; rainPos[i * 6] = r.x; rainPos[i * 6 + 1] = r.y; rainPos[i * 6 + 2] = r.z; rainPos[i * 6 + 3] = r.x + 0.01; rainPos[i * 6 + 4] = r.y + 0.14; rainPos[i * 6 + 5] = r.z; } rainGeo.attributes.position.needsUpdate = true; });
  const lightning = new THREE.DirectionalLight(0xcfe0ff, 0); lightning.position.set(1, 3, Z1 - 3); lightning.target.position.set(0, 1, Z1 + 6); scene.add(lightning, lightning.target);
  // clock
  const clockC = TX.canvas(512, 512); const clockX = clockC.getContext('2d'); TX.clockFace(clockX, 512, 512, 0, false); const clockTex = TX.tex(clockC);
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 40), [std({ color: 0x111 }), std({ map: clockTex, roughness: 0.5 }), std({ color: 0x111 })]); clock.rotation.x = Math.PI / 2; clock.position.set(1.6, 2.6, Z1 + 0.04); scene.add(clock); reg('clock', clock);
  let clockAng = 0, clockAcc = 0; anim.push((dt) => { clockAng += dt * 0.35 * flags.clockDir; clockAcc += dt; if (clockAcc > 0.5) { clockAcc = 0; TX.clockFace(clockX, 512, 512, clockAng, flags.clockNine); clockTex.needsUpdate = true; } });
  // entry door (behind the player)
  const entry = new THREE.Group(); entry.position.set(0, 0, Z0 - 0.02); scene.add(entry);
  const eFrame = new THREE.Mesh(BOX(1.1, 2.22, 0.12), std({ color: 0x3a2412, roughness: 0.7 })); eFrame.position.set(0, 1.11, 0); entry.add(eFrame); const eLeaf = new THREE.Mesh(BOX(0.96, 2.1, 0.05), std({ map: woodT, color: 0x8a6244, bumpMap: woodB, bumpScale: 0.004, roughness: 0.9 })); eLeaf.position.set(0, 1.05, -0.06); entry.add(eLeaf);
  const eSign = new THREE.Mesh(PL(0.6, 0.14), std({ map: TX.sign('STAFF ONLY', { w: 512, h: 120, bg: '#f5f1e6', fg: '#1a1a1a', font: 'bold 64px sans-serif' }) })); eSign.position.set(0, 1.7, -0.09); eSign.rotation.y = Math.PI; entry.add(eSign); reg('entry', entry);

  // ---------------- particles: dust ----------------
  const dustN = hq ? 700 : 300; const dustPos = new Float32Array(dustN * 3); const dustV = [];
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 4.6; dustPos[i * 3 + 1] = 0.2 + Math.random() * 3; dustPos[i * 3 + 2] = Z1 + Math.random() * L; dustV.push({ vx: (Math.random() - .5) * 0.05, vy: (Math.random() - .5) * 0.03, vz: (Math.random() - .5) * 0.05, p: Math.random() * 6 }); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe6c0, size: 0.035, map: loadTex('assets/tex/dust.png', false), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); scene.add(dust);
  anim.push((dt, t) => { for (let i = 0; i < dustN; i++) { const v = dustV[i]; dustPos[i * 3] += (v.vx + Math.sin(t * 0.5 + v.p) * 0.02) * dt; dustPos[i * 3 + 1] += (v.vy + Math.cos(t * 0.3 + v.p) * 0.015) * dt; dustPos[i * 3 + 2] += v.vz * dt; if (dustPos[i * 3 + 1] < 0.1) dustPos[i * 3 + 1] = 3.1; if (dustPos[i * 3 + 1] > 3.2) dustPos[i * 3 + 1] = 0.2; } dustGeo.attributes.position.needsUpdate = true; });
  // moth around the first tube
  const moth = new THREE.Mesh(PL(0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a3028, side: THREE.DoubleSide })); scene.add(moth); let mothT = 0;
  anim.push((dt, t) => { mothT += dt * (1.5 + Math.sin(t * 3)); moth.position.set(Math.sin(mothT * 2.3) * 0.5, H - 0.25 + Math.sin(mothT * 5.1) * 0.12, -2 + Math.cos(mothT * 1.7) * 0.4); moth.rotation.y = mothT * 4; });

  await status('waking the Manager…', 0.68);
  // ---------------- MODELS ----------------
  const ghostify = (root, tint = 0x9ec9ff) => { root.traverse(m => { if (!m.isMesh) return; const mat = new THREE.MeshStandardMaterial({ color: 0xbfd4ff, emissive: tint, emissiveIntensity: 0.7, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.9 }); mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2); gl_FragColor = vec4(outgoingLight * 0.6 + emissive * fres * 1.8, (0.08 + fres * 1.1) * diffuseColor.a);`); }; m.material = mat; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; }); };
  const silhouette = (root, color = 0x0b0a0a) => { root.traverse(m => { if (m.isMesh) { if (m.material && /Joints/i.test(m.material.name)) { m.visible = false; return; } m.material = std({ color, roughness: 0.95, metalness: 0 }); m.castShadow = true; m.frustumCulled = false; } }); };
  const fitHeight = (obj, h, center = false) => { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); const s = h / (b.max.y - b.min.y); obj.scale.multiplyScalar(s); obj.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(obj); const c = b2.getCenter(new THREE.Vector3()); if (center) obj.position.sub(c); else { obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; } };
  const mixers = [];
  const load = (u) => gltf.loadAsync(A(u)).catch(e => { console.warn('model failed', u, e); return null; });
  const [gMich, gXbot, gRpm, gFace, gHead, gMug] = await Promise.all(['assets/models/Michelle.glb', 'assets/models/Xbot.glb', 'assets/models/readyplayer.me.glb', 'assets/models/facecap.glb', 'assets/models/head.glb', 'assets/models/coffeeMug.glb'].map(load));

  // the three who got away (Michelle, slowed samba = eerie sway)
  const ghosts = []; const GHOST_TINT = [0x9ec9ff, 0xc9b0ff, 0xb0ffd0, 0xffe0a0, 0xffb0c0, 0xffb09e];
  if (gMich) for (let i = 0; i < 6; i++) { const root = new THREE.Group(); const m = SkeletonUtils.clone(gMich.scene); fitHeight(m, 1.68); ghostify(m, GHOST_TINT[i]); root.add(m); root.visible = false; scene.add(root); const mx = new THREE.AnimationMixer(m); const clip = gMich.animations.find(a => a.name === 'SambaDance') || gMich.animations[0];
    if (clip) { const a = mx.clipAction(clip); a.play(); // find the calmest frame (hands lowest) and hold it: a ghost stands still
      const lh = m.getObjectByName('mixamorig:LeftHand') || m.getObjectByName('mixamorigLeftHand'), rh = m.getObjectByName('mixamorig:RightHand') || m.getObjectByName('mixamorigRightHand'); let best = 0, bestT = 0;
      if (lh && rh) { const v = new THREE.Vector3(); for (let t = 0; t < clip.duration; t += 0.08) { mx.setTime(t); m.updateMatrixWorld(true); const y1 = lh.getWorldPosition(v).y, y2 = rh.getWorldPosition(v).y; const sc = -(y1 + y2); if (sc > best || t === 0) { best = sc; bestT = t; } } }
      mx.setTime(bestT + i * 0.01); a.timeScale = 0.0; } mixers.push(mx); const light = new THREE.PointLight(GHOST_TINT[i], 0, 3.5, 2); light.position.set(0, 1.3, 0.3); root.add(light); ghosts.push({ root, light, m }); reg('ghost' + i, m); }
  const veil = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 20, 1, true), std({ color: 0xc1121f, emissive: 0x7a0a10, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); veil.position.set(0.3, 1.5, Z1 - 1.5); veil.visible = false; scene.add(veil);
  const jasmine = new THREE.Group(); for (let i = 0; i < 24; i++) { const j = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), std({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0.6 })); const a = i / 24 * Math.PI * 2; j.position.set(Math.cos(a) * 0.2, 1.28 + Math.sin(a * 2) * 0.02, Math.sin(a) * 0.14); jasmine.add(j); } jasmine.position.set(0.3, 0, Z1 - 1.5); veil.add(jasmine); jasmine.position.set(0, -1.5, 0);
  const placeGhost = (i, x, z, ry, propId) => { const g = ghosts[i]; if (!g) return; g.root.position.set(x, 0, z); g.root.rotation.y = ry; g.root.visible = true; g.light.intensity = 1.6; g.m.traverse(mm => { if (mm.isMesh) mm.userData.id = propId; }); };
  // customers (Xbot silhouettes)
  const customers = [];
  if (gXbot) for (let i = 0; i < 4; i++) { const m = SkeletonUtils.clone(gXbot.scene); fitHeight(m, 1.78); silhouette(m, 0x0b0a0a); const root = new THREE.Group(); root.add(m); root.visible = false; scene.add(root); const mx = new THREE.AnimationMixer(m); const names = ['sad_pose', 'sneak_pose', 'idle', 'sad_pose']; const clip = gXbot.animations.find(a => a.name === names[i]) || gXbot.animations[0]; if (clip) { const a = mx.clipAction(clip); a.timeScale = 0.6; a.play(); a.time = i; } mixers.push(mx); customers.push({ root, m }); }
  // Bosi and Kailu: the avatar, posed (arms down), tinted shirts
  const person = (shirt, beard) => { if (!gRpm) return null; const m = SkeletonUtils.clone(gRpm.scene); fitHeight(m, 1.76); m.traverse(mm => { if (!mm.isMesh) return; mm.frustumCulled = false; mm.castShadow = true; const n = (mm.material && mm.material.name) || ''; if (/Beard/i.test(n) && !beard) mm.visible = false; if (/Outfit_Top/i.test(n)) { mm.material = mm.material.clone(); mm.material.color.set(shirt); } }); const L = m.getObjectByName('LeftArm'), R = m.getObjectByName('RightArm'), LF = m.getObjectByName('LeftForeArm'), RF = m.getObjectByName('RightForeArm'); if (L) L.rotation.x = 1.15; if (R) R.rotation.z = -1.15; if (LF) LF.rotation.y = -0.2; if (RF) RF.rotation.y = 0.2; const root = new THREE.Group(); root.add(m); root.visible = false; scene.add(root); return { root, m, L, R, LF, RF, spine: m.getObjectByName('Spine1'), head: m.getObjectByName('Head') }; };
  const bosi = person(0xd81b60, true), kailu = person(0x1e6fd0, false);
  if (bosi) { customers[4] = bosi; if (bosi.R) { bosi.R.rotation.z = -2.6; bosi.R.rotation.x = -0.4; } }
  if (kailu) { customers[5] = kailu; if (kailu.head) kailu.head.rotation.x = 0.45; }
  anim.push((dt, t) => { if (bosi && bosi.root.visible) { if (bosi.RF) bosi.RF.rotation.z = Math.sin(t * 7) * 0.5; if (bosi.spine) bosi.spine.rotation.z = Math.sin(t * 2.3) * 0.08; } if (kailu && kailu.root.visible && kailu.spine) kailu.spine.rotation.x = 0.1 + Math.sin(t * 0.8) * 0.02; });
  // Bosi's garland (marigold) and Kailu's form
  const marigold = new THREE.Group(); for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; const mm = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), std({ color: i % 2 ? 0xffa21a : 0xff6a00, emissive: 0x552000, emissiveIntensity: 0.5, roughness: 0.8 })); mm.position.set(Math.cos(a) * 0.24, 1.25 - Math.abs(Math.sin(a)) * 0.25, Math.sin(a) * 0.16); marigold.add(mm); } marigold.visible = false; scene.add(marigold);
  const leave = new THREE.Mesh(PL(0.21, 0.28), std({ map: TX.leaveForm(), side: THREE.DoubleSide, roughness: 0.9 })); leave.visible = false; scene.add(leave);
  const placeCustomer = (i, x, z, ry, propId) => { const c = customers[i]; if (!c) return; c.root.position.set(x, 0, z); c.root.rotation.y = ry; c.root.visible = true; if (propId) reg(propId, c.m); };
  // faceless uncle (ReadyPlayerMe avatar, skin without features)
  let noface = null, jawMesh = null;
  if (gRpm) { const m = SkeletonUtils.clone(gRpm.scene); fitHeight(m, 1.74); m.traverse(mm => { if (!mm.isMesh) return; const n = (mm.material && mm.material.name) || ''; mm.frustumCulled = false; mm.castShadow = true; if (/Eye|Teeth|Beard|Headwear|Hair/i.test(n)) mm.visible = false; else if (/Skin|Head|Body/i.test(n)) mm.material = std({ color: 0xcdbba8, roughness: 0.95 }); else mm.material = std({ color: 0x23201d, roughness: 0.9 }); if (mm.morphTargetDictionary && 'jawOpen' in mm.morphTargetDictionary) jawMesh = mm; }); noface = new THREE.Group(); noface.add(m); noface.visible = false; noface.position.set(0.85, 0, -21.2); noface.rotation.y = Math.PI * 0.15; scene.add(noface); const fileB = new THREE.Mesh(BOX(0.3, 0.035, 0.24), std({ map: fileT })); fileB.position.set(0.1, 1.05, 0.3); noface.add(fileB); reg('bench', m, fileB); }
  anim.push((dt, t) => { if (jawMesh && noface.visible) jawMesh.morphTargetInfluences[jawMesh.morphTargetDictionary.jawOpen] = Math.max(0, Math.sin(t * 5)) * 0.55; });
  // the Manager's face (scanned head) in the cabin gap
  let head = null;
  if (gHead) { const m = gHead.scene; m.traverse(mm => { if (mm.isMesh) { mm.material = std({ map: loadTex('assets/tex/head_col.jpg'), color: 0x9a8070, normalMap: loadTex('assets/tex/head_nrm.jpg', false), normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.7, metalness: 0 }); mm.castShadow = true; } else if (mm.isCamera || mm.isLight) mm.visible = false; }); fitHeight(m, 0.3, true); head = new THREE.Group(); head.add(m); head.visible = false; head.position.set(-0.18, 1.6, -0.36); head.rotation.y = Math.PI / 2; room.add(head); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 4, 12), std({ color: 0x050405, roughness: 1 })); body.position.set(0, -0.85, 0); head.add(body);
    const eyeMat = std({ color: 0xff2a1a, emissive: 0xff3a20, emissiveIntensity: 6, roughness: 0.2 }); const eyesG = new THREE.Group(); head.add(eyesG); [-0.033, 0.033].forEach(dx => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), eyeMat); e.position.set(dx, 0.035, 0.088); eyesG.add(e); }); const eyeGlow = new THREE.PointLight(0xff2a1a, 0.6, 0.9, 2); eyeGlow.position.set(0, 0.035, 0.13); eyesG.add(eyeGlow); head.userData.eyes = eyesG; head.userData.eyeMat = eyeMat; const shoulders = new THREE.Mesh(BOX(0.52, 0.12, 0.26), std({ color: 0x050405, roughness: 1 })); shoulders.position.set(0, -0.3, 0); head.add(shoulders); reg('cabin', m); const under = new THREE.PointLight(0xff4a2a, 0, 1.4, 2); under.position.set(0, -0.38, 0.16); head.add(under); head.userData.under = under; }
  // the Chairman portrait comes alive (animated face)
  let face = null, faceMixer = null;
  if (gFace) { const m = gFace.scene; m.traverse(mm => { if (mm.isMesh) { mm.frustumCulled = false; if (mm.material) { mm.material.roughness = 0.6; mm.material.color.set(0x8a6a56); } } }); fitHeight(m, 0.52, true); face = new THREE.Group(); face.add(m); face.visible = false; face.position.set(XR - 0.3, 2.02, -12.6); face.rotation.y = -Math.PI / 2; scene.add(face); faceMixer = new THREE.AnimationMixer(m); gFace.animations.forEach(cl => { const a = faceMixer.clipAction(cl); a.play(); }); mixers.push(faceMixer); reg('portrait', m); }
  // coffee mug for ghost #2
  const sweets = new THREE.Mesh(BOX(0.24, 0.09, 0.17), std({ map: TX.sweetsBox(), roughness: 0.8 })); sweets.visible = false; scene.add(sweets);
  let mug = null; if (gMug) { mug = new THREE.Group(); const mm = gMug.scene; fitHeight(mm, 0.11); mug.add(mm); mug.visible = false; scene.add(mug); const steam = new THREE.Sprite(new THREE.SpriteMaterial({ map: loadTex('assets/tex/smoke.png', false), transparent: true, opacity: 0.35, depthWrite: false, color: 0xffffff })); steam.scale.set(0.25, 0.35, 1); steam.position.y = 0.25; mug.add(steam); mug.userData.steam = steam; anim.push((dt, t) => { if (mug.visible) { steam.position.y = 0.2 + (t % 2) * 0.12; steam.material.opacity = 0.35 * (1 - (t % 2) / 2); } }); }

  await status('letting the rain in…', 0.9);
  // ---------------- anomalies ----------------
  const APPLY = {
    clock_back: () => { flags.clockDir = -22; },
    clock_nine: () => { flags.clockNine = true; },
    token_goku: () => { tokenTex.userData.draw('NOW SERVING  GOKU'); },
    cal_working: () => { cal.material.map = calW; cal.material.needsUpdate = true; },
    portrait_mgr: () => { por.material.map = porTexM; por.material.needsUpdate = true; if (face) face.visible = true; porLight.color.set(0xffc0a0); porLight.intensity *= 1.4; },
    notice_goku: () => { notice.material.map = TX.noticeBoard(true); notice.material.needsUpdate = true; },
    npa_goku: () => { npa.material.map = npaTexG; npa.material.needsUpdate = true; },
    cabin_eyes: () => { doorPivot.rotation.y = 0.5; cabinRed.intensity = 1.6; if (head) { head.visible = true; head.userData.under.intensity = 1.2; } },
    cabin_shoes: () => { shoes.visible = true; },
    bench_face: () => { [0, 1, 2].forEach(i => placeCustomer(i, 2.05, -20.5 - i * 1.0, 0, 'bench')); customers[3].root.visible = false; },
    bench_noface: () => { if (noface) noface.visible = true; },
    phone_glow: () => { phoneScr.material.emissiveIntensity = 2.5; phoneLight.intensity = 2.5; },
    desk_thaali: () => { thaali.visible = true; },
    cooler_red: () => { water.material.color.set(0x7a0000); water.material.opacity = 0.95; jarMat.color.set(0xc08a8a); },
    ghost_shravya: () => { placeGhost(0, X + 1.05, -19.1, Math.PI / 2 + 0.6, 'cooler'); },
    ghost_deepika: () => { placeGhost(1, X + 1.5, -21.0, -Math.PI / 2 + 0.3, 'counter'); customers[3] && (customers[3].root.visible = false); if (mug) { mug.visible = true; mug.position.set(X + 0.55, 1.08, -21.1); } },
    ghost_aswathi: () => { placeGhost(2, 0.8, -21.6, Math.PI * 0.35, 'bench'); },
    ghost_aarti: () => { placeGhost(4, XR - 1.0, -3.9, Math.PI / 2 + 0.5, 'atm'); cards.visible = true; },
    bosi_inside: () => { placeCustomer(4, XR - 1.3, -1.3, Math.PI * 0.5, 'cctv'); marigold.visible = true; marigold.position.set(XR - 1.3, 0.3, -1.3); },
    kailu_form: () => { placeCustomer(5, X + 1.5, -21.0, -Math.PI / 2, 'counter'); customers[3] && (customers[3].root.visible = false); leave.visible = true; leave.position.set(X + 0.62, 1.085, -21.0); leave.rotation.set(-Math.PI / 2, 0, 0.3); },
    plant_grow: () => { leaves.scale.set(2.2, 4.6, 2.2); leaves.position.y = 0.3; plant.position.x = XR - 0.6; },
    vault_open: () => { vPivot.rotation.y = -1.4; vaultLight.intensity = 1.2; },
    ghost_laxmi: () => { placeGhost(3, X + 1.1, -11.3, Math.PI / 2 - 0.3, 'vault'); sweets.visible = true; sweets.position.set(X + 1.42, 1.02, -11.05); sweets.rotation.y = 0.4; },
    counter_open: () => { windows[1].shutter.visible = false; counterLight.intensity = 3; counterLight.position.z = windows[1].z; placeCustomer(2, X + 0.3, windows[1].z, Math.PI / 2 - 0.4, 'counter'); customers[2].root.scale.setScalar(0.92); },
    exit_entry: () => { exitSign.material.map = exitTexE; exitSign.material.emissiveMap = exitTexE; exitSign.material.emissive.set(0xff3b3b); exitSign.material.needsUpdate = true; exitLight.color.set(0xff3b3b); },
    exit_dark: () => { mantapaLight.intensity = 0; exitGlassM.emissiveIntensity = 0; exitGlassM.opacity = 0.92; exitGlassM.color.set(0x05050a); rain.visible = false; garland.visible = false; auto.visible = false; },
    bride: () => { placeGhost(5, 0.3, Z1 - 1.5, 0.15, 'exit'); if (ghosts[5]) { ghosts[5].light.color.set(0xff6a3a); ghosts[5].light.intensity = 3; ghosts[5].m.traverse(mm => { if (mm.isMesh) { mm.material.emissiveIntensity = 1.4; mm.material.opacity = 0.6; } }); veil.visible = true; } mantapaLight.intensity = 22; },
    atm_cards: () => { cards.visible = true; },
    cctv_behind: () => { cctvScr.material.map = cctvTexB; cctvScr.material.emissiveMap = cctvTexB; cctvScr.material.needsUpdate = true; },
    fan_fast: () => { flags.fanFast = true; },
  };
  function reset() {
    resetCreep(); if (face) face.position.x = XR - 0.3; if (noface) { noface.position.set(0.85, 0, -21.2); noface.rotation.set(0, Math.PI * 0.15, 0); } counterLight.color.set(0xfff2cc); exitLight.intensity = 1.6; if (head) { head.userData.eyeMat.emissiveIntensity = 6; head.userData.stare = false; }
    flags.clockDir = 1; flags.clockNine = false; flags.fanFast = false; tokenTex.userData.draw('NOW SERVING 0000');
    cal.material.map = calN; cal.material.needsUpdate = true; por.visible = true; por.material.map = porTexN; por.material.needsUpdate = true; if (face) face.visible = false; porLight.color.set(0xffe0b0); porLight.intensity = hq ? 7 : 5;
    notice.material.map = TX.noticeBoard(false); notice.material.needsUpdate = true; npa.material.map = npaTexN; npa.material.needsUpdate = true;
    doorPivot.rotation.y = 0; cabinRed.intensity = 0; if (head) { head.visible = false; head.userData.under.intensity = 0; } shoes.visible = false;
    customers.forEach(c => c.root.visible = false); customers[2] && customers[2].root.scale.setScalar(1); if (noface) noface.visible = false;
    phoneScr.material.emissiveIntensity = 0; phoneLight.intensity = 0; thaali.visible = false; water.material.color.set(0x3aa0ff); water.material.opacity = 0.55; jarMat.color.set(0xa8d8ff);
    ghosts.forEach((g, i) => { g.root.visible = false; g.light.intensity = 0; g.light.color.set(GHOST_TINT[i]); g.m.traverse(mm => { if (mm.isMesh) { mm.material.emissiveIntensity = 0.7; mm.material.opacity = 0.42; } }); }); veil.visible = false; if (mug) mug.visible = false; sweets.visible = false; marigold.visible = false; leave.visible = false; auto.visible = true;
    leaves.scale.set(1, 1, 1); leaves.position.y = 0.55; plant.position.x = XR - 0.5; vPivot.rotation.y = 0; vaultLight.intensity = 0; windows[1].shutter.visible = true; counterLight.intensity = 0;
    exitSign.material.map = exitTexN; exitSign.material.emissiveMap = exitTexN; exitSign.material.emissive.set(0x43ff7a); exitSign.material.needsUpdate = true; exitLight.color.set(0x43ff7a);
    mantapaLight.intensity = 9; exitGlassM.emissiveIntensity = 0.06; exitGlassM.opacity = 0.18; exitGlassM.color.set(0xfff4e6); rain.visible = true; garland.visible = true; cards.visible = false;
    cctvScr.material.map = cctvTexN; cctvScr.material.emissiveMap = cctvTexN; cctvScr.material.needsUpdate = true;
  }

  // ---------------- per-frame ----------------
  let flashT = 0, dipT = 0, dipAmt = 1, nextDip = 12 + Math.random() * 20, nextBolt = 8 + Math.random() * 14, nextHorn = 6 + Math.random() * 10, elapsed = 0, headLook = 0;
  const events = { onThunder: null, onDip: null, onHorn: null };
  const ray = new THREE.Raycaster(); ray.far = 14;
  function update(dt, t, cam) {
    elapsed += dt; anim.forEach(f => f(dt, t)); mixers.forEach(m => m.update(dt));
    // flicker + power dips
    nextDip -= dt; if (nextDip <= 0) { nextDip = 14 + Math.random() * 26; dipT = 0.3 + Math.random() * 0.6; events.onDip && events.onDip(dipT); }
    if (dipT > 0) { dipT -= dt; dipAmt = 0.25 + Math.random() * 0.2; } else dipAmt = 1;
    lights.tubes.forEach(l => { if (l.dead) return; const f = (l.flickery && Math.random() < 0.07) ? 0.05 + Math.random() * 0.5 : 1 - Math.random() * 0.05; l.light.intensity = l.base * f * dipAmt; l.tube.material.emissiveIntensity = 1.6 * f * dipAmt; });
    // lightning
    nextBolt -= dt; if (nextBolt <= 0) { nextBolt = 10 + Math.random() * 22; flashT = 0.5; events.onThunder && events.onThunder(0.8 + Math.random() * 2); }
    nextHorn -= dt; if (nextHorn <= 0) { nextHorn = 18 + Math.random() * 30; if (auto.visible && events.onHorn) events.onHorn(); }
    if (flashT > 0) { flashT -= dt; const k = flashT > 0.35 ? 1 : (flashT > 0.2 ? 0 : (flashT > 0.1 ? 0.6 : 0)); lightning.intensity = k * 2.2; exitGlassM.emissiveIntensity = (mantapaLight.intensity > 0 ? 0.06 : 0) + k * 1.2; } else { lightning.intensity = 0; }
    // the head slowly turns to look at you
    if (head && head.visible && cam) { const target = Math.atan2(cam.position.x - (X - 0.18), cam.position.z + 5.06); headLook += ((target - Math.PI / 2) * (head.userData.stare ? 1 : 0.35) - headLook) * dt * (head.userData.stare ? 2.5 : 0.4); head.rotation.y = Math.PI / 2 + headLook; head.rotation.x = Math.sin(t * 0.4) * 0.02; }
    // ghosts: float + breathe
    ghosts.forEach((g, i) => { if (g.root.visible) { g.root.position.y = 0.01 + Math.sin(t * 0.9 + i) * 0.02; g.light.intensity = 1.4 + Math.sin(t * 2.1 + i) * 0.4; } });
  }
  // escalation when the player has stared at the anomaly long enough
  function react(id, cam) {
    if (id === 'cabin_eyes') { doorPivot.rotation.y = 0.95; cabinRed.intensity = 3.5; if (head) { head.userData.under.intensity = 2.5; head.userData.eyeMat.emissiveIntensity = 10; head.userData.stare = true; } return 'creak'; }
    if (id === 'portrait_mgr') { if (face) face.position.x = XR - 0.5; porLight.intensity *= 2; return 'laugh'; }
    if (id === 'bench_face') { customers.slice(0, 3).forEach(c => { c.root.position.x -= 0.7; }); return 'floor'; }
    if (id === 'bench_noface') { if (noface) { noface.position.z += 0.8; noface.lookAt(cam.position.x, 0, cam.position.z); } return 'breath'; }
    if (id === 'vault_open') { vPivot.rotation.y = -2.4; vaultLight.intensity = 4; return 'vault'; }
    if (id === 'token_goku') { tokenTex.userData.draw('GOKU  GOKU  GOKU'); return null; }
    if (id === 'phone_glow') { phoneLight.intensity = 6; return 'ring'; }
    if (id === 'counter_open') { customers[2] && customers[2].root.lookAt(cam.position.x, 0, cam.position.z); counterLight.intensity = 6; counterLight.color.set(0xff6a4a); return 'shutter'; }
    if (id === 'exit_entry' || id === 'exit_dark') { exitLight.intensity = 6; return null; }
    if (id === 'bosi_inside' && customers[4] && customers[4].root.visible) { customers[4].root.lookAt(cam.position.x, 0, cam.position.z); return 'horn'; }
    const gh = ghosts.find(g => g.root.visible); if (gh) { gh.root.lookAt(cam.position.x, 0, cam.position.z); gh.light.intensity = 4; gh.m.traverse(mm => { if (mm.isMesh) mm.material.emissiveIntensity = 1.6; }); return 'breath'; }
    return null;
  }
  // weeping-angel: a seen ghost creeps closer whenever she is out of view (not the bride behind the glass)
  const creepState = { outT: 0, inT: 0, seen: false, moves: 0 };
  function creep(dt, cam) {
    const gh = ghosts.find((g, i) => g.root.visible && i < 5); if (!gh) return false;
    const dx = gh.root.position.x - cam.position.x, dz = gh.root.position.z - cam.position.z; const dist = Math.hypot(dx, dz);
    const fx = -Math.sin(cam.rotation.y), fz = -Math.cos(cam.rotation.y); const inView = (dx * fx + dz * fz) / (dist + 1e-6) > 0.75;
    if (inView) { creepState.inT += dt; creepState.outT = 0; if (creepState.inT > 0.6) creepState.seen = true; return false; }
    creepState.inT = 0; if (!creepState.seen) return false; creepState.outT += dt;
    if (creepState.outT > 0.9 && creepState.moves < 4 && dist > 2.6) { creepState.outT = 0; creepState.moves++; const step = Math.min(1.3, dist - 2.3); gh.root.position.x -= dx / dist * step; gh.root.position.z -= dz / dist * step; gh.root.position.x = THREE.MathUtils.clamp(gh.root.position.x, X + 0.5, XR - 0.5); gh.root.lookAt(cam.position.x, 0, cam.position.z); return true; }
    return false;
  }
  function resetCreep() { creepState.outT = 0; creepState.inT = 0; creepState.seen = false; creepState.moves = 0; }
  const centre = new THREE.Vector2(0, 0);
  function gazeId(cam) { ray.setFromCamera(centre, cam); const h = ray.intersectObjects(hit, false)[0]; return h ? h.object.userData.id : null; }
  function raycastProp(ndc, cam) { ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(hit, false)[0]; return h ? { id: h.object.userData.id, point: h.point, dist: h.distance } : null; }
  // walking collision: keep inside the hall and out of furniture
  const solids = [ { x: [XR - 1.4, XR], z: [-10.7, -8.4] }, { x: [XR - 1.95, XR], z: [-2.0, -0.8] }, { x: [XR - 1.5, XR], z: [-4.8, -3.0] }, { x: [X, X + 1.0], z: [-24.6, -20.2] }, { x: [0.95, 1.8], z: [-22.6, -20.6] }, { x: [X, X + 0.8], z: [-19.5, -18.7] }, { x: [XR - 0.9, XR], z: [-24.6, -23.9] } ];
  function collide(p) { p.x = THREE.MathUtils.clamp(p.x, X + 0.45, XR - 0.45); p.z = THREE.MathUtils.clamp(p.z, Z1 + 0.6, Z0 - 0.6); for (const s of solids) { if (p.x > s.x[0] && p.x < s.x[1] && p.z > s.z[0] && p.z < s.z[1]) { const dx = Math.min(p.x - s.x[0], s.x[1] - p.x), dz = Math.min(p.z - s.z[0], s.z[1] - p.z); if (dx < dz) p.x = (p.x - s.x[0] < s.x[1] - p.x) ? s.x[0] - 0.01 : s.x[1] + 0.01; else p.z = (p.z - s.z[0] < s.z[1] - p.z) ? s.z[0] - 0.01 : s.z[1] + 0.01; } } return p; }
  const propPos = { cabin: new THREE.Vector3(X, 1.5, -4.7), desk: new THREE.Vector3(XR - 1, 0.9, -9.4), cooler: new THREE.Vector3(X + 0.5, 1, -19), vault: new THREE.Vector3(X + 0.5, 1, -10.5), exit: new THREE.Vector3(0, 1.5, Z1), counter: new THREE.Vector3(X + 0.5, 1.5, -22.3), fan: new THREE.Vector3(0, 3, -4), bench: new THREE.Vector3(1, 1, -21.6), atm: new THREE.Vector3(XR - 1, 1, -3.9), cctv: new THREE.Vector3(XR - 1, 1, -1.3) };

  reset();
  return { scene, camera, update, raycastProp, gazeId, react, creep, collide, APPLY, reset, events, propPos, setToken: (s) => tokenTex.userData.draw(s), reflector, debug: { customers, ghosts, head, face, noface } };
}
