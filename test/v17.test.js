const assert = require('assert'), fs = require('fs');
const W = require('../www/js/weekly.js');
// history: rolling to a new week archives last week's result; crests kept; capped
let s = W.fresh('2026-W41'); s.got = { 0: 1, 1: 1 }; s.p = { x: 3 };
let n = W.normalize(JSON.parse(JSON.stringify(s)), '2026-W42');
assert.deepStrictEqual(n.hist, [{ wk: '2026-W41', n: 2, all: 0 }]);
assert.deepStrictEqual(n.p, {});
n = W.normalize(JSON.parse(JSON.stringify(n)), '2026-W42'); assert.strictEqual(n.hist.length, 1, 'no duplicate archive on reload');
const untouched = W.normalize({ wk: '2026-W40', p: {}, got: {} }, '2026-W41'); assert.strictEqual(untouched.hist.length, 0, 'untouched weeks not archived');
let big = { wk: '2026-W01', hist: [] }; for (let i = 1; i <= 20; i++) big.hist.push({ wk: '2025-W' + String(i).padStart(2, '0'), n: 3, all: 1 });
assert.strictEqual(W.normalize(big, '2026-W02').hist.length, W.HIST_MAX);
assert.strictEqual(W.normalize({ wk: '2026-W01', hist: [{ wk: 'zz', n: 9 }, { wk: '2025-W50', n: 99 }] }, '2026-W02').hist[0].n, 3, 'hist sanitised');
// reminder dot: only Thu-Sun, only while goals open, only until the panel is opened today
const thu = new Date(2026, 9, 15), mon = new Date(2026, 9, 12);
s = W.fresh('2026-W42');
assert.strictEqual(W.remind(s, mon), false, 'no nag early in week');
assert.strictEqual(W.remind(s, thu), true);
s.seen = '2026-10-15'; assert.strictEqual(W.remind(s, thu), false, 'seen today');
s.seen = null; s.all = 1; assert.strictEqual(W.remind(s, thu), false, 'done for the week');
// wiring present
const daily = fs.readFileSync(__dirname + '/../www/js/daily.js', 'utf8'), ach = fs.readFileSync(__dirname + '/../www/js/achievements.js', 'utf8');
assert(/setExtraDot/.test(daily) && /addTab/.test(ach));
const snd = fs.readFileSync(__dirname + '/../www/js/sound.js', 'utf8');
assert(/createDynamicsCompressor/.test(snd) && /crest:/.test(snd) && /goal:/.test(snd) && /visibilitychange/.test(snd));
const game = fs.readFileSync(__dirname + '/../www/js/game.js', 'utf8');
assert(/nowH - \(haptic\.last/.test(game), 'haptic throttle');
console.log('v1.7 tests ok');
