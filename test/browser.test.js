// Headless Chrome play test at phone size. Plays by tapping bolts like a user and checks:
// win detection, next level, undo, +1 bolt, hint, reload persistence, no console errors.
// Usage: node test/browser.test.js <url> [outdir]
//   needs puppeteer-core (npm i --no-save puppeteer-core) and Chrome (CHROME=/path, default /usr/bin/google-chrome)
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const URL = (process.argv[2] || 'http://localhost:8765/').replace(/\/?$/, '/');
const OUT = process.argv[3] || '/tmp';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ok -', m); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.emulate({ viewport: { width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Mobile Safari/537.36' });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });

  const st = () => page.evaluate(() => { const s = window.__nbs.state; return { level: s.level, moves: s.moves, bolts: s.bolts.length, won: s.won, extra: s.extraUsed, hist: s.history.length, key: window.__nbs.logic.key(s.bolts) }; });
  async function tap(i) {
    const b = await page.evaluate(i => { const e = document.querySelector(`.bolt[data-index="${i}"] .head`).getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; }, i);
    await page.touchscreen.tap(b.x, b.y);
  }
  const idle = () => page.waitForFunction(() => !window.__nbs.state.busy, { timeout: 8000 });
  async function play(moves, shot) {
    for (let k = 0; k < moves.length; k++) {
      await tap(moves[k][0]); await idle();
      if (shot && k === shot.at) { await sleep(120); await page.screenshot({ path: shot.path }); }
      await tap(moves[k][1]); await idle();
    }
  }
  async function solveCurrent(shot) {
    const sol = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap); });
    assert(sol && sol.length > 0, 'solver found a solution for the current board (' + (sol || []).length + ' moves)');
    await play(sol, shot);
    return sol.length;
  }

  console.log('Testing', URL);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/nbs-home.png` });
  assert(await page.$eval('#home', e => !e.classList.contains('hidden')), 'home screen shown on launch');
  await page.tap('#btn-play'); await sleep(400);
  assert(await page.$eval('#game', e => !e.classList.contains('hidden')), 'game screen opens from Play');
  let s = await st();
  assert(s.level === 1, 'starts at level 1');
  await page.screenshot({ path: `${OUT}/nbs-level1.png` });

  // --- keyboard and screen-reader bolt controls ---
  const keyboardBolt = await page.$eval('.bolt[aria-label*="nuts bottom to top"]', e => e.dataset.index);
  const keyboardSelector = `.bolt[data-index="${keyboardBolt}"]`;
  assert(await page.$eval(keyboardSelector, e => e.getAttribute('role') === 'button' && e.tabIndex === 0 && e.getAttribute('aria-label').includes('top ')), 'bolts expose descriptive focusable button labels');
  await page.focus(keyboardSelector);
  await page.keyboard.press('Enter'); await idle();
  assert(await page.$eval(keyboardSelector, e => e.getAttribute('aria-pressed') === 'true' && e.getAttribute('aria-label').includes('selected')) && await page.$eval('#game-status', e => e.textContent.includes('selected')), 'Enter selects a bolt and announces its selected state');
  await page.keyboard.press('Space'); await idle();
  assert(await page.$eval(keyboardSelector, e => e.getAttribute('aria-pressed') === 'false') && await page.$eval('#game-status', e => e.textContent.includes('cancelled')), 'Space cancels a bolt selection');

  // --- undo: make one legal move, then undo ---
  const first = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap)[0]; });
  const before = s.key;
  await page.focus(`.bolt[data-index="${first[0]}"]`); await page.keyboard.press('Enter'); await idle();
  await page.focus(`.bolt[data-index="${first[1]}"]`); await page.keyboard.press('Space'); await idle();
  s = await st();
  assert(s.moves === 1 && s.key !== before && await page.$eval('#game-status', e => e.textContent.includes('Moved')), 'a keyboard move changed the board and was announced');
  await page.tap('#btn-undo'); await sleep(200);
  s = await st();
  assert(s.moves === 0 && s.key === before, 'undo restored the exact previous board');
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), first[0]), 'undo restores focus to the move source bolt');
  assert(await page.$eval('#game-status', e => e.textContent.trim() === 'Move undone. 0 moves made.'), 'undo replaces the stale move announcement with the accurate restored move count');

  // --- +1 bolt (rewarded; on web the reward is granted immediately) ---
  const nb = s.bolts;
  await page.tap('#btn-extra'); await sleep(300);
  s = await st();
  assert(s.bolts === nb + 1 && s.extra, '+1 bolt added an empty bolt');
  assert(await page.$eval('#btn-extra', e => e.disabled), '+1 bolt disabled after use (once per level)');

  // --- hint ---
  await page.tap('#btn-hint'); await sleep(500);
  assert(await page.$$eval('.bolt.hint', e => e.length) >= 1, 'hint highlights a bolt');
  const hintMove = await page.evaluate(() => window.__nbs.state.lastHint);
  assert(Array.isArray(hintMove), 'hint produced a solver move ' + JSON.stringify(hintMove));

  // --- solve level 1 by taps -> win ---
  const n1 = await solveCurrent();
  await sleep(900);
  s = await st();
  const winShown = await page.$eval('#win', e => !e.classList.contains('hidden'));
  assert(s.won && winShown, `level 1 won by taps (${n1} moves) and win panel shown`);
  await page.screenshot({ path: `${OUT}/nbs-win.png` });
  const coins = await page.evaluate(() => window.__nbs.save.coins);
  assert(coins > 0, 'coins awarded: ' + coins);

  // --- next level ---
  await page.tap('#btn-next'); await sleep(500);
  s = await st();
  assert(s.level === 2 && !s.won, 'Next goes to level 2');

  // --- reload persistence mid-level ---
  const m2 = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap)[0]; });
  await tap(m2[0]); await idle(); await tap(m2[1]); await idle();
  const keyBefore = (await st()).key;
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(300);
  const playLabel = await page.$eval('#play-level', e => e.textContent);
  assert(playLabel === 'Level 2', 'after reload the home screen shows Level 2');
  await page.tap('#btn-play'); await sleep(400);
  s = await st();
  assert(s.level === 2 && s.moves === 1 && s.key === keyBefore, 'after reload the in-progress board, move count and level are restored');
  const coins2 = await page.evaluate(() => window.__nbs.save.coins);
  assert(coins2 === coins, 'coins persisted across reload');

  // finish level 2 and move on to level 3
  await solveCurrent(); await sleep(900);
  assert((await st()).won, 'level 2 won');
  await page.tap('#btn-next'); await sleep(400);
  assert((await st()).level === 3, 'advanced to level 3');

  const canShow = await page.evaluate(() => window.__nbs.gate.canShow(Date.now()));
  assert(canShow === false, 'ad gate blocks interstitials before level 5 / 3 minutes');

  await sleep(300);
  assert(errors.length === 0, 'no console errors / failed requests' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('BROWSER TEST PASSED');
})().catch(e => { console.error('BROWSER TEST FAILED:', e.message); process.exit(1); });
