// Tiny zero-dependency server: static files + a JSON leaderboard on a Fly volume.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : ROOT);
const FILE = path.join(DATA_DIR, 'scores.json');
const MAX_SCORE = 20000, MAX_ROWS = 500;
const MIME = { '.hdr': 'application/octet-stream', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let scores = [];
try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { scores = []; }
const save = () => { try { fs.writeFileSync(FILE, JSON.stringify(scores)); } catch (e) { console.error('save failed', e.message); } };
const recent = new Map();
const EVENTS = path.join(DATA_DIR, 'events.jsonl');
function stats() {
  let lines = []; try { lines = fs.readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) {}
  const sessions = {}, players = new Set(), anomSeen = {}, anomMissed = {}, dev = {};
  for (const ev of lines) {
    players.add(ev.pid); const S = sessions[ev.sid] = sessions[ev.sid] || { pid: ev.pid, start: ev.t, best: 0, walks: 0, wrong: 0, won: false, dev: ev.ua, last: ev.t }; S.last = Math.max(S.last, ev.t);
    if (ev.e === 'walk') { S.walks++; S.best = Math.max(S.best, ev.ok ? ev.pass + 1 : ev.pass); if (!ev.ok) S.wrong++; if (ev.anom && ev.anom !== 'normal') { anomSeen[ev.anom] = (anomSeen[ev.anom] || 0) + 1; if (!ev.ok) anomMissed[ev.anom] = (anomMissed[ev.anom] || 0) + 1; } }
    if (ev.e === 'win') { S.won = true; S.best = 8; }
  }
  const list = Object.values(sessions); const byBest = {}; list.forEach(S => { byBest[S.best] = (byBest[S.best] || 0) + 1; dev[S.dev] = (dev[S.dev] || 0) + 1; });
  const miss = Object.keys(anomSeen).map(k => ({ anom: k, shown: anomSeen[k], missed: anomMissed[k] || 0, rate: Math.round(100 * (anomMissed[k] || 0) / anomSeen[k]) })).sort((a, b) => b.rate - a.rate);
  const sinceDays = {}; list.forEach(S => { const d = new Date(S.start).toISOString().slice(0, 10); sinceDays[d] = (sinceDays[d] || 0) + 1; });
  return { players: players.size, sessions: list.length, wins: list.filter(S => S.won).length, walks: list.reduce((a, S) => a + S.walks, 0), wrongTurns: list.reduce((a, S) => a + S.wrong, 0), farthest: Math.max(0, ...list.map(S => S.best)), byBestWalk: byBest, devices: Object.fromEntries(Object.entries(dev).map(([k, v]) => [k, v])), sessionsPerDay: sinceDays, hardestAnomalies: miss.slice(0, 10), easiestAnomalies: miss.slice(-5).reverse(), leaderboardPosts: scores.length, recent: list.sort((a, b) => b.start - a.start).slice(0, 25).map(S => ({ when: new Date(S.start).toISOString().replace('T', ' ').slice(0, 16) + ' UTC', device: S.dev, walks: S.walks, reached: S.best, wrong: S.wrong, won: S.won, minutes: Math.round((S.last - S.start) / 6000) / 10 })) };
}
function statsHtml(s) {
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const row = (k, v) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goku's Wedding Dash — stats</title><style>body{font-family:system-ui,sans-serif;background:#0b0612;color:#fff3d6;padding:16px;max-width:720px;margin:auto}h1{color:#f5c542;font-size:22px}h2{color:#9be7ff;font-size:15px;letter-spacing:2px;margin-top:22px}table{width:100%;border-collapse:collapse;font-size:14px}td{padding:5px 6px;border-bottom:1px solid #2a1a30}td:last-child{text-align:right;color:#9be7ff}small{opacity:.6}</style></head><body><h1>Goku's Wedding Dash — who has walked</h1>
<table>${row('Players (devices)', s.players)}${row('Sessions started', s.sessions)}${row('Reached the mantapa', s.wins)}${row('Walks taken', s.walks)}${row('Wrong turns', s.wrongTurns)}${row('Farthest walk reached', s.farthest + ' / 8')}${row('Leaderboard posts', s.leaderboardPosts)}${row('Devices', Object.entries(s.devices).map(([k, v]) => k + ' ' + v).join(' · '))}</table>
<h2>HOW FAR THEY GOT (sessions by best walk)</h2><table>${Object.entries(s.byBestWalk).sort((a, b) => b[0] - a[0]).map(([k, v]) => row('walk ' + k + (k == 8 ? ' — made it' : ''), v)).join('')}</table>
<h2>HARDEST ANOMALIES (missed %)</h2><table>${s.hardestAnomalies.map(a => row(a.anom + ' (shown ' + a.shown + ')', a.rate + '% missed')).join('') || row('nothing yet', '')}</table>
<h2>RECENT SESSIONS</h2><table>${s.recent.map(r => row(r.when + ' · ' + r.device + ' · ' + r.minutes + ' min', 'reached ' + r.reached + '/8 · ' + r.walks + ' walks · ' + r.wrong + ' wrong' + (r.won ? ' · 💍' : ''))).join('') || row('nothing yet', '')}</table>
<p><small>Anonymous: no names, no IPs stored. JSON at /api/stats.</small></p></body></html>`;
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/scores' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify([...scores].sort((a, b) => b.score - a.score).slice(0, 50)));
  }
  if (url.pathname === '/api/scores' && req.method === 'POST') {
    const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress;
    if (Date.now() - (recent.get(ip) || 0) < 3000) { res.writeHead(429); return res.end('{"error":"slow down"}'); }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2000) req.destroy(); });
    req.on('end', () => {
      try {
        const b = JSON.parse(body);
        const name = String(b.name || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16);
        const score = Math.floor(Number(b.score));
        if (!name || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) throw new Error('bad');
        const row = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, char: String(b.char || '').slice(0, 16), score, level: Math.min(2, Math.max(0, b.level | 0)), won: !!b.won, at: new Date().toISOString() };
        scores.push(row); scores.sort((a, b) => b.score - a.score); scores = scores.slice(0, MAX_ROWS); save();
        recent.set(ip, Date.now());
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, id: row.id }));
      } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"error":"invalid"}'); }
    });
    return;
  }
  // ---- anonymous play telemetry: who started, how far they got, what they missed ----
  if (url.pathname === '/api/events' && req.method === 'POST') {
    let body = ''; req.on('data', c => { body += c; if (body.length > 1000) req.destroy(); });
    req.on('end', () => { try { const b = JSON.parse(body); const ev = { t: Date.now(), pid: String(b.pid || '').slice(0, 24), sid: String(b.sid || '').slice(0, 24), e: String(b.e || '').slice(0, 16), pass: b.pass | 0, anom: String(b.anom || '').slice(0, 24), ok: !!b.ok, stung: !!b.stung, ua: /iPhone|iPad/.test(req.headers['user-agent'] || '') ? 'ios' : /Android/.test(req.headers['user-agent'] || '') ? 'android' : 'desktop' }; if (!ev.e) throw 0; fs.appendFileSync(EVENTS, JSON.stringify(ev) + '\n'); res.writeHead(204); res.end(); } catch (e) { res.writeHead(400); res.end(); } });
    return;
  }
  if (url.pathname === '/api/stats' || url.pathname === '/stats') {
    const st = stats(); if (url.pathname === '/api/stats') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(st)); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(statsHtml(st));
  }
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  // static
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || !/^\/(index\.html|vendor\/|js\/|assets\/|dist\/)/.test(p) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  const st = fs.statSync(file); const lm = st.mtime.toUTCString(); const etag = 'W/"' + st.size + '-' + st.mtimeMs.toString(36) + '"';
  if (req.headers['if-none-match'] === etag || (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(lm))) { res.writeHead(304); return res.end(); }
  const longLived = p.startsWith('/assets/') || /\?v=/.test(req.url); // immutable-ish: media, and anything requested with a version stamp
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': longLived ? 'public, max-age=604800' : 'no-cache', 'Last-Modified': lm, 'ETag': etag, 'Content-Length': st.size });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => console.log('listening on', PORT, 'data at', FILE));
