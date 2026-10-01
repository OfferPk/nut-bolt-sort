// Headless Chrome play test at phone size. Plays by tapping bolts like a user and checks:
// win detection/dialog keyboard behavior, per-level move records, next level, undo, +1 bolt, hint, reload persistence, reset preferences, no console errors.
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
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });

  const st = () => page.evaluate(() => { const s = window.__nbs.state; return { level: s.level, moves: s.moves, bolts: s.bolts.length, won: s.won, busy: s.busy, sel: s.sel, liftN: s.liftN, extra: s.extraUsed, hist: s.history.length, key: window.__nbs.logic.key(s.bolts), board: s.bolts.map(b => b.slice()), history: s.history.map(h => ({ bolts: h.bolts.map(b => b.slice()), moves: h.moves, from: h.from })), coins: window.__nbs.save.coins, completions: window.__nbs.gate.state.levelsSince }; });
  const winAuditSnapshot = () => page.evaluate(() => {
    const s = window.__nbs.state;
    return JSON.stringify({
      state: { level: s.level, bolts: s.bolts, moves: s.moves, history: s.history, won: s.won },
      save: window.__nbs.save,
      stored: localStorage.getItem('nutboltsort.save.v1')
    });
  });
  async function tap(i) {
    const b = await page.evaluate(i => { const e = document.querySelector(`.bolt[data-index="${i}"] .head`).getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; }, i);
    await page.touchscreen.tap(b.x, b.y);
  }
  const idle = () => page.waitForFunction(() => !window.__nbs.state.busy, { timeout: 8000 });
  async function play(moves, shot) {
    for (let k = 0; k < moves.length; k++) {
      const before = await st();
      await tap(moves[k][0]); await idle();
      if (shot && k === shot.at) { await sleep(120); await page.screenshot({ path: shot.path }); }
      await tap(moves[k][1]); await idle();
      const after = await st();
      assert(after.moves === before.moves + 1 && after.hist === before.hist + 1, 'solver tap ' + (k + 1) + ' applied one legal move (' + JSON.stringify(moves[k]) + '): ' + JSON.stringify({ before: { moves: before.moves, hist: before.hist }, after: { moves: after.moves, hist: after.hist, won: after.won, busy: after.busy, sel: after.sel, liftN: after.liftN }, status: await page.$eval('#game-status', e => e.textContent) }));
    }
  }
  async function solveCurrent(shot, keyboardFinal) {
    const sol = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap); });
    assert(sol && sol.length > 0, 'solver found a solution for the current board (' + (sol || []).length + ' moves)');
    if (keyboardFinal) {
      await play(sol.slice(0, -1), shot);
      const last = sol[sol.length - 1];
      await page.focus(`.bolt[data-index="${last[0]}"]`); await page.keyboard.press('Enter'); await idle();
      await page.focus(`.bolt[data-index="${last[1]}"]`); await page.keyboard.press('Enter'); await idle();
      await page.evaluate(() => { window.__nbs.testWinOpener = document.activeElement; });
    } else await play(sol, shot);
    return sol.length;
  }

  console.log('Testing', URL);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.clear();
    window.__nbs.save.bestMoves = { 1: 99 };
    localStorage.setItem('nutboltsort.save.v1', JSON.stringify(window.__nbs.save));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/nbs-home.png` });
  assert(await page.$eval('#home', e => !e.classList.contains('hidden')), 'home screen shown on launch');
  await page.tap('#btn-play'); await sleep(400);
  assert(await page.$eval('#game', e => !e.classList.contains('hidden')), 'game screen opens from Play');
  let s = await st();
  assert(s.level === 1, 'starts at level 1');
  assert(await page.evaluate(() => window.__nbs.save.bestMoves['1'] === 99), 'synthetic save loads an existing per-level personal best');
  assert(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches), 'browser exposes the OS reduced-motion preference');
  const reducedMotionStyles = await page.evaluate(() => {
    const bolt = document.querySelector('.bolt');
    bolt.classList.add('hint');
    const styles = {
      hint: getComputedStyle(bolt.querySelector('.head')).animationName,
      cap: getComputedStyle(bolt.querySelector('.cap')).transitionProperty,
      panel: getComputedStyle(document.querySelector('#settings .panel')).animationName
    };
    bolt.classList.remove('hint');
    return styles;
  });
  assert(reducedMotionStyles.hint === 'none' && reducedMotionStyles.cap === 'none' && reducedMotionStyles.panel === 'none', 'reduced motion disables hint, cap, and panel CSS effects');
  await page.evaluate(() => {
    window.__nbs.reducedMotionAnimationCalls = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function () {
      window.__nbs.reducedMotionAnimationCalls++;
      return animate.apply(this, arguments);
    };
  });
  await page.screenshot({ path: `${OUT}/nbs-level1.png` });

  // --- keyboard and screen-reader bolt controls ---
  const keyboardBolt = await page.$eval('.bolt[aria-label*="nuts bottom to top"]', e => e.dataset.index);
  const keyboardSelector = `.bolt[data-index="${keyboardBolt}"]`;
  assert(await page.$eval(keyboardSelector, e => e.getAttribute('role') === 'button' && e.tabIndex === 0 && e.getAttribute('aria-label').includes('top ')), 'bolts expose descriptive focusable button labels');
  assert(await page.$eval('#game-instructions', e => e.textContent.includes('arrow keys')), 'game instructions describe arrow-key bolt navigation');
  const arrowNavigation = await page.evaluate(() => {
    const bolts = [...document.querySelectorAll('.bolt')];
    for (let i = 0; i < bolts.length; i++) {
      const source = bolts[i].getBoundingClientRect();
      for (const [key, sign] of [['ArrowRight', 1], ['ArrowLeft', -1]]) {
        const candidates = bolts.map((bolt, index) => ({ bolt, index, rect: bolt.getBoundingClientRect() }))
          .filter(x => Math.abs(x.rect.top - source.top) < 1 && (x.rect.left - source.left) * sign > 1)
          .sort((a, b) => Math.abs(a.rect.left - source.left) - Math.abs(b.rect.left - source.left));
        if (candidates.length) return { from: i, to: candidates[0].index, key };
      }
    }
    return null;
  });
  assert(arrowNavigation, 'board has adjacent bolts for arrow-key navigation');
  const beforeArrowNavigation = await st();
  await page.focus(`.bolt[data-index="${arrowNavigation.from}"]`);
  await page.keyboard.press(arrowNavigation.key);
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), arrowNavigation.to), 'arrow key moves focus to the adjacent bolt');
  const afterArrowNavigation = await st();
  assert(afterArrowNavigation.key === beforeArrowNavigation.key && afterArrowNavigation.moves === beforeArrowNavigation.moves && afterArrowNavigation.sel === beforeArrowNavigation.sel, 'bolt navigation does not change the board, move count, or selection');
  await page.keyboard.press(arrowNavigation.key === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight');
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), arrowNavigation.from), 'opposite arrow returns focus to the source bolt');
  await page.focus(keyboardSelector);
  await page.keyboard.press('Enter'); await idle();
  await page.waitForFunction(() => document.querySelector('#game-status').textContent.includes('selected'));
  assert(await page.$eval(keyboardSelector, e => e.getAttribute('aria-pressed') === 'true' && e.getAttribute('aria-label').includes('selected')) && await page.$eval('#game-status', e => e.textContent.includes('selected')), 'Enter selects a bolt and announces its selected state');
  assert(await page.evaluate(() => window.__nbs.reducedMotionAnimationCalls === 0), 'reduced motion skips JavaScript nut animations');
  await page.keyboard.press('Space'); await idle();
  await page.waitForFunction(() => document.querySelector('#game-status').textContent.includes('cancelled'));
  assert(await page.$eval(keyboardSelector, e => e.getAttribute('aria-pressed') === 'false') && await page.$eval('#game-status', e => e.textContent.includes('cancelled')), 'Space cancels a bolt selection');
  await page.focus(keyboardSelector);
  await page.keyboard.press('Enter'); await idle();
  const escapeTarget = await page.$eval(`.bolt:not([data-index="${keyboardBolt}"])`, e => e.dataset.index);
  await page.focus(`.bolt[data-index="${escapeTarget}"]`);
  const beforeEscape = await st();
  await page.keyboard.press('Escape'); await idle();
  const afterEscape = await st();
  assert(afterEscape.sel === -1 && afterEscape.liftN === 0 && afterEscape.moves === beforeEscape.moves && afterEscape.key === beforeEscape.key, 'Escape returns selected nuts without changing the board or move count');
  await page.waitForFunction(() => document.querySelector('#game-status').textContent.includes('Selection cancelled'));
  assert(await page.$eval('#game-status', e => e.textContent.includes('Selection cancelled')), 'Escape announces that the selection was cancelled');
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), keyboardBolt), 'Escape cancellation restores focus to the bolt where the nuts were returned');

  // --- undo: make one legal move, then undo ---
  const first = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap)[0]; });
  const before = s.key;
  await page.focus(`.bolt[data-index="${first[0]}"]`); await page.keyboard.press('Enter'); await idle();
  await page.focus(`.bolt[data-index="${first[1]}"]`); await page.keyboard.press('Space'); await idle();
  s = await st();
  await page.waitForFunction(() => document.querySelector('#game-status').textContent.includes('Moved'));
  assert(s.moves === 1 && s.key !== before && await page.$eval('#game-status', e => e.textContent.includes('Moved')), 'a keyboard move changed the board and was announced');
  assert(await page.evaluate(() => window.__nbs.reducedMotionAnimationCalls === 0), 'a legal move still applies without starting JavaScript animations');
  await page.tap('#btn-undo'); await sleep(200);
  s = await st();
  assert(s.moves === 0 && s.key === before, 'undo restored the exact previous board');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), first[0]), 'undo restores focus to the move source bolt');
  assert(await page.$eval('#game-status', e => e.textContent.trim() === 'Move undone. 0 moves made.'), 'undo replaces the stale move announcement with the accurate restored move count');

  // --- +1 bolt (rewarded; on web the reward is granted immediately) ---
  const nb = s.bolts;
  await page.tap('#btn-extra'); await sleep(300);
  s = await st();
  assert(s.bolts === nb + 1 && s.extra, '+1 bolt added an empty bolt');
  assert(await page.$eval('#btn-extra', e => e.disabled), '+1 bolt disabled after use (once per level)');

  const moveBeforeRestart = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap)[0]; });
  await tap(moveBeforeRestart[0]); await idle(); await tap(moveBeforeRestart[1]); await idle();
  s = await st();
  assert(s.moves === 1 && s.hist === 1 && s.extra, 'restart regression begins with a saved move, undo history, and spare bolt in use');

  // --- hint ---
  await page.tap('#btn-hint'); await sleep(500);
  assert(await page.$$eval('.bolt.hint', e => e.length) >= 1, 'hint highlights a bolt');
  const hintMove = await page.evaluate(() => window.__nbs.state.lastHint);
  assert(Array.isArray(hintMove), 'hint produced a solver move ' + JSON.stringify(hintMove));

  const restartSnapshot = () => page.evaluate(() => {
    const s = window.__nbs.state;
    return {
      level: s.level, bolts: s.bolts.map(b => b.slice()), moves: s.moves,
      history: s.history.map(h => ({ bolts: h.bolts.map(b => b.slice()), moves: h.moves, from: h.from })),
      extraUsed: s.extraUsed, coins: window.__nbs.save.coins,
      stored: localStorage.getItem('nutboltsort.save.v1')
    };
  });
  const restartBefore = await restartSnapshot();
  const restartPrompt = new Promise(resolve => page.once('dialog', resolve));
  const cancelRestartClick = page.tap('#btn-restart');
  const restartDialog = await restartPrompt;
  assert(restartDialog.message() === 'Restart this level? Your current board and undo history will be lost.', 'restart explains which in-progress state would be discarded');
  await restartDialog.dismiss();
  await cancelRestartClick;
  assert(JSON.stringify(await restartSnapshot()) === JSON.stringify(restartBefore), 'cancelling restart preserves the board, undo history, bonus use, coins, and saved data');

  const confirmRestartPrompt = new Promise(resolve => page.once('dialog', resolve));
  const confirmRestartClick = page.tap('#btn-restart');
  const confirmRestartDialog = await confirmRestartPrompt;
  await confirmRestartDialog.accept();
  await confirmRestartClick;
  await sleep(200);
  s = await st();
  assert(s.moves === 0 && s.hist === 0 && !s.extra, 'restart restores the untouched Level 1 board for the completion regression');
  await page.waitForFunction(() => document.querySelector('#toast').classList.contains('hidden'), { timeout: 5000 });

  // --- final move -> immediate Undo, then re-solve without a second reward ---
  const winSolution = await page.evaluate(() => { const s = window.__nbs.state; return window.__nbs.logic.solve(s.bolts, s.cap); });
  assert(winSolution && winSolution.length === 8, 'solver found the exact 8-move Level 1 completion path');
  await page.evaluate(() => {
    window.__nbs.nextCalls = 0;
    window.__nbs.testWinOpener = null;
    window.__nbs.nextFocusAtDismissal = null;
    const maybeInterstitial = window.Ads.maybeInterstitial;
    window.Ads.maybeInterstitial = function () {
      window.__nbs.nextCalls++;
      const active = document.activeElement;
      window.__nbs.nextFocusAtDismissal = {
        same: active === window.__nbs.testWinOpener,
        connected: active.isConnected,
        boltIndex: active.dataset.index
      };
      return maybeInterstitial.apply(this, arguments);
    };
  });
  await play(winSolution.slice(0, -1));
  const beforeFinal = await st();
  const lastMove = winSolution[winSolution.length - 1];
  assert(beforeFinal.moves === 7 && beforeFinal.hist === 7 && !beforeFinal.won, 'board is at 7/8 moves with 7 history entries (moves=' + beforeFinal.moves + ', history=' + beforeFinal.hist + ', won=' + beforeFinal.won + ')');
  await page.focus(`.bolt[data-index="${lastMove[0]}"]`); await page.keyboard.press('Enter'); await idle();
  await page.focus(`.bolt[data-index="${lastMove[1]}"]`); await page.keyboard.press('Enter'); await idle();
  await page.evaluate(() => { window.__nbs.testWinOpener = document.activeElement; });
  s = await st();
  assert(s.won && s.moves === 8 && s.hist === 8 && s.coins === 11 && s.completions === 1, 'final move creates the solved 8/8 board, pays exactly +11 and records one completion');
  assert(await page.evaluate(() => window.__nbs.save.bestMoves['1'] === 8), 'a faster clear immediately replaces and persists the previous move record');
  assert(await page.$eval('#win', e => e.classList.contains('hidden')), 'completion has not yet advanced to the win panel');
  await page.focus('#btn-undo');
  await page.keyboard.press('Enter');
  await page.waitForFunction(m => { const s = window.__nbs.state; return !s.won && !s.busy && s.moves === m; }, { timeout: 8000 }, beforeFinal.moves);
  s = await st();
  assert(s.level === 1 && !s.won && s.key === beforeFinal.key && s.moves === beforeFinal.moves, 'immediate Undo restores the exact unsolved board and prior move count');
  assert(JSON.stringify(s.board) === JSON.stringify(beforeFinal.board) && JSON.stringify(s.history) === JSON.stringify(beforeFinal.history), 'immediate Undo restores the exact board ordering and prior history');
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), lastMove[0]), 'final-move Undo focuses the move source bolt');
  assert(await page.$eval('#win', e => e.classList.contains('hidden')), 'Undo cancels the pending win panel');
  assert(s.coins === 11 && s.completions === 1 && await page.evaluate(() => window.__nbs.save.level === 1), 'Undo preserves the already-earned reward/completion and keeps the current level');
  assert(await page.evaluate(() => window.__nbs.save.bestMoves['1'] === 8), 'undoing the final move does not erase the completed personal-best record');
  assert(await page.evaluate(() => window.__nbs.nextCalls === 0), 'Undo does not call the Next-level transition');
  await sleep(750);
  assert(await page.$eval('#win', e => e.classList.contains('hidden')), 'cancelled win UI does not reappear after its original delay');

  const n1 = await solveCurrent(null, true);
  await sleep(900);
  s = await st();
  const winShown = await page.$eval('#win', e => !e.classList.contains('hidden'));
  assert(s.won && winShown, `level 1 won by taps again (${n1} moves) and win panel shown`);
  assert(await page.evaluate(() => window.__nbs.save.bestMoves['1'] === 8 && document.getElementById('win-best').textContent === '8' && document.getElementById('win-record-note').classList.contains('hidden')), 'an equal replay keeps the record without announcing another personal best');
  assert(s.coins === 11 && s.completions === 1 && await page.$eval('#win-coins', e => e.textContent === '+0'), 're-solving the completed level neither pays nor records completion twice');
  const winDialog = await page.$eval('#win-dialog', e => ({
    role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'),
    labelledBy: e.getAttribute('aria-labelledby'),
    name: document.getElementById(e.getAttribute('aria-labelledby')).textContent.trim()
  }));
  assert(winDialog.role === 'dialog' && winDialog.modal === 'true' && winDialog.name === 'COMPLETE', 'win panel exposes a named modal dialog');
  assert(await page.evaluate(() => document.activeElement.id === 'btn-next' && document.getElementById('game').inert), 'opening the win dialog focuses Next and makes the game inert');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.id === 'btn-next'), 'Tab remains contained in the win dialog');
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  assert(await page.evaluate(() => document.activeElement.id === 'btn-next'), 'Shift+Tab remains contained in the win dialog');
  const completedSnapshot = await winAuditSnapshot();
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => !document.getElementById('win').classList.contains('hidden') && document.getElementById('win-dialog').contains(document.activeElement)), 'Escape remains unsupported and leaves focus inside the open win dialog');
  assert(await winAuditSnapshot() === completedSnapshot, 'Escape leaves the completed board, move/history, reward, unlocks, settings, and saved data unchanged');
  const backdropPoint = { x: 180, y: 8 };
  assert(await page.evaluate(p => document.elementFromPoint(p.x, p.y) === document.getElementById('win'), backdropPoint), 'pointer regression targets the win-dialog backdrop');
  await page.touchscreen.tap(backdropPoint.x, backdropPoint.y);
  assert(await page.evaluate(() => !document.getElementById('win').classList.contains('hidden') && document.getElementById('win-dialog').contains(document.activeElement)), 'backdrop tap leaves focus inside the open win dialog');
  assert(await winAuditSnapshot() === completedSnapshot, 'backdrop tap leaves the completed board, move/history, reward, unlocks, settings, and saved data unchanged');
  await page.screenshot({ path: `${OUT}/nbs-win.png` });
  const coins = s.coins;

  // --- next level ---
  await page.tap('#btn-next'); await sleep(500);
  s = await st();
  assert(s.level === 2 && !s.won, 'Next goes to level 2');
  const verticalNavigation = await page.evaluate(() => {
    const bolts = [...document.querySelectorAll('.bolt')];
    for (let i = 0; i < bolts.length; i++) {
      const source = bolts[i].getBoundingClientRect();
      for (const [key, sign] of [['ArrowDown', 1], ['ArrowUp', -1]]) {
        const candidates = bolts.map((bolt, index) => ({ index, rect: bolt.getBoundingClientRect() }))
          .filter(x => (x.rect.top - source.top) * sign > 1)
          .sort((a, b) => Math.abs(a.rect.top - source.top) - Math.abs(b.rect.top - source.top) || Math.abs(a.rect.left - source.left) - Math.abs(b.rect.left - source.left));
        if (candidates.length) return { from: i, to: candidates[0].index, key };
      }
    }
    return null;
  });
  assert(verticalNavigation, 'multi-row level has adjacent bolts for vertical arrow navigation');
  const beforeVerticalNavigation = await st();
  await page.focus(`.bolt[data-index="${verticalNavigation.from}"]`);
  await page.keyboard.press(verticalNavigation.key);
  assert(await page.evaluate(i => document.activeElement === document.querySelector(`.bolt[data-index="${i}"]`), verticalNavigation.to), 'vertical arrow key moves focus to the nearest bolt in the next row');
  const afterVerticalNavigation = await st();
  assert(afterVerticalNavigation.key === beforeVerticalNavigation.key && afterVerticalNavigation.moves === beforeVerticalNavigation.moves && afterVerticalNavigation.sel === beforeVerticalNavigation.sel, 'vertical bolt navigation leaves puzzle state unchanged');
  await page.focus(`.bolt[data-index="${lastMove[1]}"]`);
  assert(await page.evaluate(i => {
    const f = window.__nbs.nextFocusAtDismissal;
    return f && f.same && f.connected && Number(f.boltIndex) === i;
  }, lastMove[1]), 'dialog dismissal returns focus to the exact opening bolt before level navigation');
  assert(await page.evaluate(i => document.activeElement.classList.contains('bolt') && Number(document.activeElement.dataset.index) === i && !document.getElementById('game').inert, lastMove[1]), 'closing the win dialog restores focus to the corresponding bolt on the next level');
  assert(await page.evaluate(() => window.__nbs.nextCalls === 1), 'the explicit Next button is the only level transition so far');

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
  assert(await page.evaluate(() => window.__nbs.save.bestMoves['1'] === 8), 'per-level move records persist across reload with the active board');
  const coins2 = await page.evaluate(() => window.__nbs.save.coins);
  assert(coins2 === coins, 'coins persisted across reload');

  // finish level 2 and move on to level 3
  await solveCurrent(); await sleep(900);
  const level2Moves = (await st()).moves;
  assert((await st()).won, 'level 2 won');
  assert(await page.evaluate(moves => window.__nbs.save.bestMoves['2'] === moves && !document.getElementById('win-record-note').classList.contains('hidden'), level2Moves), 'a first-ever clear records and announces a personal best for a new level');
  await page.tap('#btn-next'); await sleep(400);
  assert((await st()).level === 3, 'advanced to level 3');

  const canShow = await page.evaluate(() => window.__nbs.gate.canShow(Date.now()));
  assert(canShow === false, 'ad gate blocks interstitials before level 5 / 3 minutes');

  // --- reset preserves settings for a disposable synthetic save only ---
  await page.evaluate(() => {
    const fixture = {
    level: 9, coins: 77, best: 8,
    owned: { nut: ['anodized', 'neon'], bolt: ['steel'], bg: ['graphite'] },
    skin: { nut: 'anodized', bolt: 'steel', bg: 'graphite' },
    settings: { sound: false, haptics: false, marks: true },
    current: { level: 9, bolts: [], history: [], moves: 2, extraUsed: false }, ad: {}
    };
    localStorage.setItem('nutboltsort.save.v1', JSON.stringify(fixture));
    Object.assign(window.__nbs.save, fixture);
    delete window.__nbs.save.bestMoves;
  });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.tap('#btn-settings-home');
  assert(await page.evaluate(() => JSON.stringify(window.__nbs.save.bestMoves) === '{}'), 'legacy saves without move records load with an empty record map');
  assert(await page.$eval('#set-sound', e => !e.checked) && await page.$eval('#set-haptics', e => !e.checked) && await page.$eval('#set-marks', e => e.checked), 'synthetic fixture loads its saved sound, haptics, and marks preferences');
  const resetConfirm = new Promise(resolve => page.once('dialog', resolve));
  const resetClick = page.tap('#btn-reset');
  const resetDialog = await resetConfirm;
  assert(resetDialog.message() === 'Reset all progress, coins and finishes?', 'reset prompt still accurately describes the cleared data');
  await resetDialog.accept();
  await resetClick;
  await page.waitForFunction(() => document.getElementById('settings').classList.contains('hidden'));
  const resetState = await page.evaluate(() => window.__nbs.save);
  assert(resetState.settings.sound === false && resetState.settings.haptics === false && resetState.settings.marks === true, 'reset preserves sound, haptics, and marks preferences');
  assert(resetState.level === 1 && resetState.coins === 0 && resetState.best === 0 && resetState.current === null, 'reset clears level progress, coins, finishes, and the saved board');
  assert(JSON.stringify(resetState.bestMoves) === '{}', 'reset clears per-level personal-best records');
  assert(JSON.stringify(resetState.owned) === JSON.stringify({ nut: ['anodized'], bolt: ['steel'], bg: ['graphite'] }), 'reset clears owned cosmetic finishes');

  await sleep(300);
  assert(errors.length === 0, 'no console errors / failed requests' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log('BROWSER TEST PASSED');
})().catch(e => { console.error('BROWSER TEST FAILED:', e.message); process.exit(1); });
