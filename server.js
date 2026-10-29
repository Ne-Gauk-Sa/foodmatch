const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const L = require('./logic');
const PORT = +process.env.PORT || 8787;
const DATA = path.join(__dirname, 'data.json');

const DEMO_OPTIONS = [
  ['Taco Loco','Mexican',1,'Street tacos, al pastor off the spit, and a salsa bar with six heat levels.','🌮',0],
  ['Sakura Sushi Bar','Japanese',3,'Omakase-style nigiri, hand rolls, and a quiet counter for good conversation.','🍣',3],
  ["Nonna's Kitchen",'Italian',2,'Fresh pasta made daily, wood-fired pizza, and a tiramisu worth the walk.','🍝',7],
  ['Pho Real','Vietnamese',1,'Giant steaming bowls of pho, crispy spring rolls, and strong iced coffee.','🍜',4],
  ['Smokehouse 88','BBQ',2,'Low-and-slow brisket, burnt ends, mac and cheese, and picnic tables.','🍖',0],
  ['Green Bowl Co.','Healthy / Salads',2,'Build-your-own grain bowls and salads. Vegan-friendly, quick, light.','🥗',2],
  ['Curry House','Indian',2,'Butter chicken, saag paneer, garlic naan, and a lunch thali deal.','🍛',1],
  ['Seoul Fire BBQ','Korean',3,'Grill-at-your-table Korean BBQ with endless banchan.','🔥',7],
  ['Burger Barn','American',1,'Smash burgers, hand-cut fries, and thick milkshakes.','🍔',1],
  ['Mezze Garden','Mediterranean',2,'Falafel, shawarma plates, hummus flights, and a sunny patio.','🧆',2],
  ['Dragon Dim Sum','Chinese',2,'Rolling carts of dumplings, bao, and egg tarts. Best shared.','🥟',5],
  ['Le Petit Bistro','French',4,'Steak frites, onion soup, and a proper wine list. Date-night energy.','🥖',6],
].map((a, i) => ({ id: 'o' + (i + 1), name: a[0], cuisine: a[1], price: a[2], desc: a[3], emoji: a[4], color: a[5] }));

let groups = {};
try { groups = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (e) {}
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(DATA, JSON.stringify(groups), () => {}), 300); };

const rid = (n = 8) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { let c; do { c = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (groups[c]); return c; };
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);

const sockets = new Map(); // code -> Set(ws)

function publicState(g) {
  const online = new Set(); (sockets.get(g.code) || new Set()).forEach(ws => ws.memberId && online.add(ws.memberId));
  const mids = g.members.map(m => m.id);
  const w = L.winner(g.options.map(o => o.id), mids, g.votes, g.rule);
  return {
    code: g.code, name: g.name, round: g.round, rule: g.rule, options: g.options, votes: g.votes,
    members: g.members.map(m => ({ id: m.id, name: m.name, bot: !!m.bot, online: m.bot || online.has(m.id) })),
    needed: L.yesNeeded(mids.length, g.rule),
    winner: w ? { id: w.id, yes: w.yes, share: w.share } : null,
  };
}
function broadcast(g) {
  const msg = JSON.stringify({ t: 'state', state: publicState(g) });
  (sockets.get(g.code) || []).forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
  save();
}
function attach(ws, g, m) {
  if (ws.code && sockets.get(ws.code)) sockets.get(ws.code).delete(ws);
  ws.code = g.code; ws.memberId = m.id;
  if (!sockets.has(g.code)) sockets.set(g.code, new Set());
  sockets.get(g.code).add(ws);
  ws.send(JSON.stringify({ t: 'joined', code: g.code, memberId: m.id, key: m.key }));
  broadcast(g);
}
function addMember(g, name, bot) { const m = { id: rid(8), key: rid(16), name: clean(name, 30) || 'Guest', bot: !!bot }; g.members.push(m); g.votes[m.id] = {}; g.hist[m.id] = []; return m; }
function botVote(g) {
  const pop = {}; g.options.forEach(o => { pop[o.id] = 0.25 + Math.random() * 0.65; });
  g.members.filter(m => m.bot).forEach(m => g.options.forEach(o => { if (g.votes[m.id][o.id] === undefined) g.votes[m.id][o.id] = Math.random() < pop[o.id]; }));
}
function validRule(r) {
  if (!r || !['majority', 'twoThirds', 'unanimous', 'custom'].includes(r.mode)) return null;
  const pct = Math.max(1, Math.min(100, Math.round(Number(r.pct) || 60)));
  return { mode: r.mode, pct };
}

function handle(ws, msg) {
  const err = e => ws.send(JSON.stringify({ t: 'error', error: e }));
  if (msg.t === 'create') {
    const code = newCode();
    const g = { code, name: clean(msg.groupName, 40) || 'Our group', created: Date.now(), round: 1, rule: { mode: 'majority', pct: 60 }, options: JSON.parse(JSON.stringify(DEMO_OPTIONS)), members: [], votes: {}, hist: {} };
    groups[code] = g; return attach(ws, g, addMember(g, msg.name));
  }
  if (msg.t === 'join') {
    const g = groups[clean(msg.code, 10).toUpperCase()];
    if (!g) return err('No group with that code. Check the code or link and try again.');
    let m = msg.memberId && g.members.find(x => x.id === msg.memberId && x.key === msg.key);
    if (!m) { if (g.members.length >= 50) return err('This group is full.'); m = addMember(g, msg.name); }
    return attach(ws, g, m);
  }
  const g = groups[ws.code]; if (!g) return err('Join a group first.');
  const me = g.members.find(m => m.id === ws.memberId); if (!me) return err('You are no longer in this group.');
  switch (msg.t) {
    case 'vote': {
      if (!g.options.some(o => o.id === msg.optionId)) return;
      if (g.votes[me.id][msg.optionId] !== undefined) return;
      g.votes[me.id][msg.optionId] = !!msg.yes; g.hist[me.id].push(msg.optionId); break;
    }
    case 'undo': { const o = g.hist[me.id].pop(); if (o) delete g.votes[me.id][o]; break; }
    case 'rule': { const r = validRule(msg.rule); if (!r) return; g.rule = r; break; }
    case 'addOption': {
      const name = clean(msg.option && msg.option.name, 50); if (!name) return err('Give the option a name.');
      if (g.options.length >= 60) return err('The deck is full.');
      const o = msg.option; g.options.push({ id: 'x' + rid(6), name, cuisine: clean(o.cuisine, 30) || 'Anything', price: Math.max(1, Math.min(4, +o.price || 2)), desc: clean(o.desc, 160) || 'Added by ' + me.name + '.', emoji: clean(o.emoji, 8) || '🍽️', color: g.options.length % 8, by: me.name });
      botVote(g); break;
    }
    case 'removeOption': { g.options = g.options.filter(o => o.id !== msg.optionId); Object.values(g.votes).forEach(v => delete v[msg.optionId]); Object.keys(g.hist).forEach(k => { g.hist[k] = g.hist[k].filter(x => x !== msg.optionId); }); break; }
    case 'renameGroup': { g.name = clean(msg.name, 40) || g.name; break; }
    case 'renameMe': { me.name = clean(msg.name, 30) || me.name; break; }
    case 'removeMember': { const id = msg.memberId; if (!g.members.some(m => m.id === id)) return; g.members = g.members.filter(m => m.id !== id); delete g.votes[id]; delete g.hist[id];
      (sockets.get(g.code) || []).forEach(s => { if (s.memberId === id) s.send(JSON.stringify({ t: 'removed' })); }); break; }
    case 'addBots': { const names = ['Bot Bella', 'Bot Bruno', 'Bot Chip', 'Bot Dot']; let n = Math.max(1, Math.min(4, +msg.count || 2)); for (const nm of names) { if (!n) break; if (!g.members.some(m => m.name === nm)) { addMember(g, nm, true); n--; } } botVote(g); break; }
    case 'newRound': { g.round++; g.members.forEach(m => { g.votes[m.id] = {}; g.hist[m.id] = []; }); botVote(g); break; }
    default: return;
  }
  broadcast(g);
}

const files = { '/': 'index.html', '/logic.js': 'logic.js' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  let f = files[u.pathname]; if (!f && /^\/g\/[A-Za-z0-9]{4,10}\/?$/.test(u.pathname)) f = 'index.html';
  if (!f) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
  fs.createReadStream(path.join(__dirname, f)).pipe(res);
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.on('message', d => { let m; try { m = JSON.parse(d); } catch (e) { return; } if (m && m.t === 'ping') return ws.send('{"t":"pong"}'); try { handle(ws, m); } catch (e) { console.error(e); } });
  ws.on('close', () => { const set = sockets.get(ws.code); if (set) { set.delete(ws); const g = groups[ws.code]; if (g) broadcast(g); } });
});
setInterval(() => wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }), 25000);
server.listen(PORT, '0.0.0.0', () => console.log('FoodMatch live on 0.0.0.0:' + PORT));
