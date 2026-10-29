const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const mk = async () => { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message)); return p; };
  const [A, B, C] = [await mk(), await mk(), await mk()];
  await A.goto(BASE); await A.waitForSelector('#cName');
  await A.type('#cName', 'Randy'); await A.type('#cGroup', 'Lunch Crew'); await A.waitForSelector('#createBtn').then(() => A.$eval('#createBtn', e => e.click()));
  await A.waitForFunction(() => location.pathname.startsWith('/g/'));
  const link = await A.evaluate(() => location.href); console.log('A created group, URL', link);
  await A.waitForSelector('[data-tab="invite"]').then(() => A.$eval('[data-tab="invite"]', e => e.click())); await A.waitForSelector('#linkBox');
  await A.type('#phone', '(555) 123-4567');
  console.log('invite link shown:', await A.$eval('#linkBox', e => e.textContent), '| sms href:', (await A.$eval('#smsBtn', e => e.getAttribute('href'))).slice(0, 60) + '…');
  for (const [p, n] of [[B, 'Priya'], [C, 'Marcus']]) { await p.goto(link); await p.waitForSelector('#jName'); await p.click('#jName', { clickCount: 3 }); await p.type('#jName', n); await p.click('#joinBtn'); await p.waitForSelector('#topCard'); }
  await A.waitForSelector('[data-tab="swipe"]').then(() => A.$eval('[data-tab="swipe"]', e => e.click()));
  await A.waitForFunction(() => document.body.innerText.includes('Marcus') && document.body.innerText.includes('Priya'));
  console.log('A sees Priya and Marcus join live');
  // B sets two-thirds from Rules tab
  await B.waitForSelector('[data-tab="rules"]').then(() => B.$eval('[data-tab="rules"]', e => e.click())); await B.waitForSelector('[data-rule="twoThirds"]').then(() => B.$eval('[data-rule="twoThirds"]', e => e.click()));
  await A.waitForFunction(() => document.body.innerText.includes('Two-thirds (66.7%)'));
  await C.waitForFunction(() => document.body.innerText.includes('Two-thirds (66.7%)'));
  console.log('Two-thirds rule set by Priya shows on Randy + Marcus');
  await B.waitForSelector('[data-tab="swipe"]').then(() => B.$eval('[data-tab="swipe"]', e => e.click())); await B.waitForSelector('#topCard');
  // Option 1 Taco: A yes (button), B yes (keyboard), C no (drag)
  await A.waitForSelector('#yesBtn').then(() => A.$eval('#yesBtn', e => e.click())); await sleep(400);
  await B.keyboard.press('ArrowRight'); await sleep(400);
  // C first: drag left = no on taco... but 2/3 already reached after B's yes -> match should show
  await A.waitForFunction(() => document.body.innerText.includes("IT'S A MATCH"), { timeout: 5000 });
  await C.waitForFunction(() => document.body.innerText.includes("IT'S A MATCH"), { timeout: 5000 });
  const txt = await C.evaluate(() => document.querySelector('.match').innerText);
  console.log('MATCH on all screens after 2 of 3 yes. Marcus sees:\n  ' + txt.split('\n').filter(Boolean).slice(0, 12).join(' | '));
  // Change to unanimous -> match disappears for everyone; C drags taco yes -> match again
  await A.waitForSelector('[data-tab="rules"]').then(() => A.$eval('[data-tab="rules"]', e => e.click())); await A.waitForSelector('[data-rule="unanimous"]').then(() => A.$eval('[data-rule="unanimous"]', e => e.click()));
  await C.waitForFunction(() => !document.body.innerText.includes("IT'S A MATCH") && document.getElementById('topCard'));
  console.log('Unanimous: match withdrawn on Marcus\'s screen, back to swiping');
  const b2 = await C.$eval('#topCard', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await C.mouse.move(b2.x, b2.y); await C.mouse.down(); for (let i = 1; i <= 10; i++) { await C.mouse.move(b2.x + i * 20, b2.y); await sleep(15); } await C.mouse.up();
  await B.waitForFunction(() => document.body.innerText.includes('Everyone agreed on Taco Loco'), { timeout: 5000 });
  await A.waitForFunction(() => document.body.innerText.includes('Everyone agreed on Taco Loco'), { timeout: 5000 });
  console.log('Marcus drag-swiped right -> "Everyone agreed on Taco Loco" on all 3');
  await A.screenshot({ path: 'shot-match.png' });
  // new round from B
  B.on('dialog', d => d.accept()); await B.waitForSelector('#newRound').then(() => B.$eval('#newRound', e => e.click()));
  await A.waitForFunction(() => !document.body.innerText.includes("IT'S A MATCH"));
  console.log('New round by Priya clears match for Randy');
  await A.waitForSelector('[data-tab="invite"]').then(() => A.$eval('[data-tab="invite"]', e => e.click())); await A.screenshot({ path: 'shot-invite.png' });
  await C.waitForSelector('[data-tab="swipe"]').then(() => C.$eval('[data-tab="swipe"]', e => e.click())); await C.screenshot({ path: 'shot-swipe.png' });
  console.log(errors.length ? 'PAGE ERRORS: ' + errors.join('; ') : 'no page JS errors'); await browser.close();
  console.log('BROWSER TEST PASSED');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
