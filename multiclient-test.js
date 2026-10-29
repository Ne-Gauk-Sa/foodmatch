const WebSocket = require('ws'); const a = require('assert');
const BASE = process.argv[2] || 'http://localhost:8787';
const WS = BASE.replace(/^http/, 'ws') + '/ws';
function client(name) {
  const c = { name, states: [], ws: new WebSocket(WS) };
  c.ready = new Promise(r => c.ws.on('open', r));
  c.ws.on('message', d => { const m = JSON.parse(d); if (m.t === 'joined') c.me = m; if (m.t === 'state') c.state = m.state; if (m.t === 'error') c.err = m.error; });
  c.send = o => c.ws.send(JSON.stringify(o));
  return c;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, label, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return; await wait(50); } throw new Error('timeout: ' + label); }
(async () => {
  const [A, B, C] = ['Randy', 'Priya', 'Marcus'].map(client);
  await Promise.all([A, B, C].map(c => c.ready));
  A.send({ t: 'create', name: 'Randy', groupName: 'Lunch Crew' });
  await until(() => A.state, 'create');
  const code = A.state.code; console.log('group created', code, 'invite:', BASE + '/g/' + code);
  const page = await fetch(BASE + '/g/' + code); a.equal(page.status, 200); console.log('invite link page loads: HTTP', page.status);
  B.send({ t: 'join', code, name: 'Priya' }); C.send({ t: 'join', code: code.toLowerCase(), name: 'Marcus' });
  await until(() => [A, B, C].every(c => c.state && c.state.members.length === 3 && c.state.members.every(m => m.online)), 'all 3 joined & online');
  console.log('all 3 see 3 members online');
  // bad code
  const D = client('X'); await D.ready; D.send({ t: 'join', code: 'ZZZZZZ', name: 'X' }); await until(() => D.err, 'bad code error'); console.log('bad code ->', D.err); D.ws.close();
  // threshold to unanimous by B, everyone sees it
  B.send({ t: 'rule', rule: { mode: 'unanimous' } });
  await until(() => [A, B, C].every(c => c.state.rule.mode === 'unanimous' && c.state.needed === 3), 'rule sync');
  console.log('unanimous synced, needed = 3');
  // votes: taco o1 yes by A,B; C no. sushi o2 yes A,C
  A.send({ t: 'vote', optionId: 'o1', yes: true }); B.send({ t: 'vote', optionId: 'o1', yes: true }); C.send({ t: 'vote', optionId: 'o1', yes: false });
  A.send({ t: 'vote', optionId: 'o2', yes: true }); C.send({ t: 'vote', optionId: 'o2', yes: true });
  await until(() => [A, B, C].every(c => Object.values(c.state.votes).reduce((n, v) => n + Object.keys(v).length, 0) === 5), 'votes sync');
  a(A.state.winner === null); console.log('5 votes synced; unanimous -> no winner (correct)');
  // undo: C undoes o2 then the duplicate vote guard
  C.send({ t: 'undo' }); await until(() => A.state.votes[C.me.memberId].o2 === undefined, 'undo sync'); console.log('undo synced to others');
  C.send({ t: 'vote', optionId: 'o2', yes: true }); await until(() => B.state.votes[C.me.memberId].o2 === true, 'revote');
  // change to two-thirds -> o1 (2/3) and o2 (2/3) qualify; tie -> o1 first in deck
  A.send({ t: 'rule', rule: { mode: 'twoThirds' } });
  await until(() => [A, B, C].every(c => c.state.winner && c.state.winner.id === 'o1'), 'two-thirds match');
  console.log('two-thirds -> all 3 see winner o1 (tie with o2 broken by deck order), yes', A.state.winner.yes + '/3');
  // custom 70% -> 2/3 = 66.7% fails
  C.send({ t: 'rule', rule: { mode: 'custom', pct: 70 } });
  await until(() => [A, B, C].every(c => c.state.rule.pct === 70 && c.state.winner === null), 'custom 70');
  console.log('custom 70% -> no winner for everyone (2/3 = 66.7% < 70%)');
  // B votes yes on o2 -> 3/3 -> match on o2
  B.send({ t: 'vote', optionId: 'o2', yes: true });
  await until(() => [A, B, C].every(c => c.state.winner && c.state.winner.id === 'o2' && c.state.winner.yes === 3), 'o2 match');
  console.log('B votes yes on Sushi -> all 3 see MATCH on', A.state.options.find(o => o.id === 'o2').name, '3/3');
  // majority + added option
  A.send({ t: 'addOption', option: { name: 'Thai Basil', cuisine: 'Thai', price: 2, emoji: '🍲' } });
  await until(() => [B, C].every(c => c.state.options.some(o => o.name === 'Thai Basil')), 'option sync'); console.log('added option synced');
  // same final state everywhere
  const snap = c => JSON.stringify({ w: c.state.winner, v: c.state.votes, r: c.state.rule, o: c.state.options.length });
  a(snap(A) === snap(B) && snap(B) === snap(C)); console.log('final state identical on all 3 clients');
  // new round clears votes
  B.send({ t: 'newRound' }); await until(() => [A, B, C].every(c => c.state.round === 2 && c.state.winner === null && Object.values(c.state.votes).every(v => !Object.keys(v).length)), 'new round');
  console.log('new round synced: votes cleared');
  // reconnect with stored identity
  const sess = { memberId: C.me.memberId, key: C.me.key }; C.ws.close();
  await until(() => A.state.members.find(m => m.id === sess.memberId).online === false, 'offline seen'); console.log('C disconnect -> others see C offline');
  const C2 = client('Marcus2'); await C2.ready; C2.send({ t: 'join', code, ...sess });
  await until(() => C2.state && A.state.members.length === 3 && A.state.members.find(m => m.id === sess.memberId).online, 'rejoin'); console.log('C rejoined as same member (no duplicate)');
  [A, B, C2].forEach(c => c.ws.close()); console.log('ALL MULTI-CLIENT TESTS PASSED'); process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
