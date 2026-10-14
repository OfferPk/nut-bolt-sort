// Achievements + Stats tests. Usage: node test/achievements.test.js
const assert = require('assert');
const A = require('../www/js/achievements.js');
const game = require('./ach-defs.js'); // { defs: [...] } game-specific
const defs = A.COMMON.concat(game.defs);
assert.ok(defs.length >= 15 && defs.length <= 20, '15-20 achievements (got ' + defs.length + ')');
const ids = new Set();
defs.forEach(d => {
  assert.ok(!ids.has(d.id), 'unique ' + d.id); ids.add(d.id);
  assert.ok(d.name && d.desc && d.metric, d.id + ' has text');
  assert.ok(Number.isInteger(d.reward) && d.reward > 0 && d.reward <= 300, d.id + ' cosmetic coin reward');
  assert.ok(d.goal > 0, d.id + ' goal');
});
assert.ok(!/cash|bet|loot|withdraw/i.test(JSON.stringify(defs)), 'no cash-out / gambling wording');
// engine
let s = A.fresh();
A.bump(s, 'games'); A.bump(s, 'games', 2); assert.strictEqual(A.get(s, 'games'), 3);
A.max(s, 'best', 50); A.max(s, 'best', 20); assert.strictEqual(A.get(s, 'best'), 50);
A.min(s, 'fewest', 30); A.min(s, 'fewest', 40); A.min(s, 'fewest', 0); assert.strictEqual(A.get(s, 'fewest'), 30);
// coins observer: first call is baseline, spending is not "earned"
assert.strictEqual(A.observeCoins(s, 500), 0); A.observeCoins(s, 520); A.observeCoins(s, 300); A.observeCoins(s, 310);
assert.strictEqual(A.get(s, 'coins_earned'), 30);
// play-day streak
A.playDay(s, '2026-10-30'); A.playDay(s, '2026-10-31'); A.playDay(s, '2026-11-01'); A.playDay(s, '2026-11-01');
assert.strictEqual(A.get(s, 'day_streak'), 3); A.playDay(s, '2026-11-03'); assert.strictEqual(A.get(s, 'day_streak'), 1);
assert.strictEqual(A.get(s, 'best_day_streak'), 3); assert.strictEqual(A.get(s, 'days_played'), 4);
// unlock once
s = A.fresh(); const d1 = { id: 'x', metric: 'games', goal: 2, reward: 10 };
assert.strictEqual(A.check(s, [d1]).length, 0); A.bump(s, 'games', 2);
assert.strictEqual(A.check(s, [d1]).length, 1); assert.strictEqual(A.check(s, [d1]).length, 0, 'pays once');
const lo = { id: 'lo', metric: 't', goal: 100, lower: true, reward: 5 };
assert.strictEqual(A.progress(s, lo).pct, 0); A.min(s, 't', 90); assert.strictEqual(A.progress(s, lo).pct, 1);
// every game achievement is reachable by its metric moving the right way
game.defs.forEach(d => { const t = A.fresh(); t.m[d.metric] = d.lower ? d.goal : d.goal; assert.strictEqual(A.progress(t, d).pct, 1, d.id + ' reachable'); });
// tampered save is sanitized
assert.deepStrictEqual(A.normalize({ m: { a: -5, b: 'x', c: 3 } }).m, { c: 3 });
console.log('achievement tests passed (' + defs.length + ' achievements)');
