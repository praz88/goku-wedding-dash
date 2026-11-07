// Bundles js/main.js + vendored three.js into one classic script (no import maps, no module support needed).
// Usage: node tools/build.js   (esbuild is only needed for building; the runtime has no dependencies)
const path = require('path');
let esbuild; try { esbuild = require('esbuild'); } catch (e) { esbuild = require(path.join(process.env.ESBUILD_DIR || '/tmp/gt', 'node_modules/esbuild')); }
const root = path.join(__dirname, '..');
esbuild.build({
  entryPoints: [path.join(root, 'js/main.js')], bundle: true, format: 'iife', target: ['es2020'], minify: true, sourcemap: false,
  outfile: path.join(root, 'dist/game.js'), logLevel: 'info',
  plugins: [{ name: 'vendor-three', setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: path.join(root, 'vendor/three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: path.join(root, 'vendor/addons', a.path.replace('three/addons/', '')) }));
  } }],
}).then(() => {
  // cache-bust: stamp the bundle's content hash into index.html (index.html itself is served no-cache)
  const fs = require('fs'), crypto = require('crypto');
  const hash = crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'dist/game.js'))).digest('hex').slice(0, 10);
  const idx = path.join(root, 'index.html'); let html = fs.readFileSync(idx, 'utf8');
  html = html.replace(/dist\/game\.js(\?v=[a-z0-9]+)?/, 'dist/game.js?v=' + hash).replace(/assets\/pack\.js(\?v=[a-z0-9]+)?/, 'assets/pack.js?v=' + hash);
  fs.writeFileSync(idx, html); console.log('built dist/game.js  v=' + hash);
}).catch(e => { console.error(e); process.exit(1); });
