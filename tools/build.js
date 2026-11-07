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
}).then(() => console.log('built dist/game.js')).catch(e => { console.error(e); process.exit(1); });
