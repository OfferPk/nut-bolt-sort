// Node test for the interstitial pacing rules (www/js/adgate.js).
const AdGate = require('../www/js/adgate.js');
const assert = require('assert');
const cfg = { INTERSTITIAL_MIN_LEVEL: 5, INTERSTITIAL_MIN_PLAY_MS: 180000, INTERSTITIAL_EVERY_N_LEVELS: 3, INTERSTITIAL_MIN_INTERVAL_MS: 90000 };
let n = 0;
function t(name, fn) { fn(); n++; console.log('  ok -', name); }

t('nothing before level 5 even with lots of play time', () => {
  const g = AdGate.create(cfg, {}); let now = 1e9;
  for (let lv = 1; lv <= 4; lv++) { g.addPlayTime(59000); g.addPlayTime(59000); g.levelCompleted(lv); now += 120000; assert(!g.canShow(now), 'level ' + lv); }
});
t('nothing before 3 minutes even after level 5+', () => {
  const g = AdGate.create(cfg, {}); let now = 1e9;
  for (let lv = 1; lv <= 9; lv++) { g.addPlayTime(15000); g.levelCompleted(lv); now += 15000; assert(!g.canShow(now), 'level ' + lv + ' play ' + g.state.playMs); }
});
t('first allowed after level 5 and 3 min, then every 3 levels', () => {
  const g = AdGate.create(cfg, {}); let now = 1e9; const shownAt = [];
  for (let lv = 1; lv <= 20; lv++) {
    g.addPlayTime(50000); now += 100000; g.levelCompleted(lv);
    if (g.canShow(now)) { g.shown(now); shownAt.push(lv); }
  }
  assert.strictEqual(shownAt[0], 5);
  for (let i = 1; i < shownAt.length; i++) assert(shownAt[i] - shownAt[i - 1] >= 3, 'gap ' + shownAt);
  assert.deepStrictEqual(shownAt, [5, 8, 11, 14, 17, 20]);
});
t('respects the 90 s minimum interval between interstitials', () => {
  const g = AdGate.create(cfg, { playMs: 999999, maxCompleted: 10, levelsSince: 3 }); let now = 1e9;
  assert(g.canShow(now)); g.shown(now);
  for (let k = 0; k < 3; k++) g.levelCompleted(11 + k);
  assert(!g.canShow(now + 60000), 'blocked at 60 s');
  assert(!g.canShow(now + 89999), 'blocked at 89.9 s');
  assert(g.canShow(now + 90000), 'allowed at 90 s');
});
t('fast players: 3 quick levels inside 90 s do not trigger', () => {
  const g = AdGate.create(cfg, { playMs: 999999, maxCompleted: 10, levelsSince: 0, lastTs: 1e9 });
  let now = 1e9; for (let k = 0; k < 6; k++) { now += 10000; g.levelCompleted(11 + k); assert(!g.canShow(now)); }
});
t('clock moved backwards does not allow a burst', () => {
  const g = AdGate.create(cfg, { playMs: 999999, maxCompleted: 10, levelsSince: 5, lastTs: 2e9 });
  assert(!g.canShow(1e9));
});
t('state survives serialization (persisted in localStorage)', () => {
  const g = AdGate.create(cfg, {}); g.addPlayTime(30000); g.levelCompleted(1);
  const g2 = AdGate.create(cfg, JSON.parse(JSON.stringify(g.state)));
  assert.strictEqual(g2.state.playMs, 30000); assert.strictEqual(g2.state.levelsSince, 1);
});
t('ignores absurd play-time increments', () => { const g = AdGate.create(cfg, {}); g.addPlayTime(10 * 60000); assert.strictEqual(g.state.playMs, 0); });
t('ads-config.js values match the policy', () => {
  global.window = {}; require('../www/js/ads-config.js'); const c = global.window.ADS_CONFIG;
  assert.strictEqual(c.INTERSTITIAL_MIN_LEVEL, 5); assert(c.INTERSTITIAL_MIN_PLAY_MS >= 180000);
  assert(c.INTERSTITIAL_EVERY_N_LEVELS >= 3); assert(c.INTERSTITIAL_MIN_INTERVAL_MS >= 60000 && c.INTERSTITIAL_MIN_INTERVAL_MS <= 90000);
  assert(/^ca-app-pub-3940256099942544/.test(c.BANNER_ID), 'test IDs in repo');
});
console.log(`ADGATE TESTS PASSED (${n})`);
