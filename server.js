// Tiny zero-dependency server: serves index.html + a JSON leaderboard on a Fly volume.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : __dirname);
const FILE = path.join(DATA_DIR, 'scores.json');
const MAX_SCORE = 20000, MAX_ROWS = 500;
let scores = [];
try { scores = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { scores = []; }
const save = () => { try { fs.writeFileSync(FILE, JSON.stringify(scores)); } catch (e) { console.error('save failed', e.message); } };
const html = () => fs.readFileSync(path.join(__dirname, 'index.html'));
const recent = new Map(); // ip -> last post ms (light rate limit)

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/scores' && req.method === 'GET') {
    const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 50);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(top));
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
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(html());
}).listen(PORT, '0.0.0.0', () => console.log('listening on', PORT, 'data at', FILE));
