// Packs binary assets (.glb, .hdr) into assets/pack.js as data URIs, for hosts that can't serve those extensions.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const out = {};
const walk = (d) => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(glb|hdr)$/.test(f)) out[path.relative(root, p).replace(/\\/g, '/')] = 'data:application/octet-stream;base64,' + fs.readFileSync(p).toString('base64'); });
walk(path.join(root, 'assets'));
fs.writeFileSync(path.join(root, 'assets/pack.js'), 'window.__ASSETS=' + JSON.stringify(out) + ';');
console.log('packed', Object.keys(out).length, 'files →', (fs.statSync(path.join(root, 'assets/pack.js')).size / 1e6).toFixed(1), 'MB');
