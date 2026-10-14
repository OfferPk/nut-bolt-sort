const assert = require('assert');
const D = require('../www/js/daily.js');
let s = D.fresh();
let st = D.status(s, '2026-10-14'); assert.strictEqual(st.day, 1); assert.strictEqual(st.claimed, false);
let r = D.claim(s, '2026-10-14'); assert.ok(r.ok); assert.strictEqual(r.coins, D.REWARDS[0]);
assert.strictEqual(D.claim(s, '2026-10-14').ok, false, 'once per day');
for (let d = 15; d <= 20; d++) D.claim(s, '2026-10-' + d);
assert.strictEqual(s.streak, 7);
r = D.claim(s, '2026-10-21'); assert.strictEqual(r.day, 1, 'wraps after 7');
D.claim(s, '2026-10-22'); assert.strictEqual(s.streak, 2);
r = D.claim(s, '2026-10-24'); assert.strictEqual(r.day, 1, 'missed day resets');
r = D.claim(s, '2026-10-25'); assert.strictEqual(r.day, 2);
// month boundary
s = D.fresh(); D.claim(s, '2026-10-31'); assert.strictEqual(D.claim(s, '2026-11-01').day, 2);
// challenge
s = D.fresh();
assert.ok(D.completeChallenge(s, '2026-10-14').ok);
assert.ok(!D.completeChallenge(s, '2026-10-14').ok);
D.completeChallenge(s, '2026-10-15'); assert.strictEqual(s.cStreak, 2);
assert.strictEqual(D.challengeStreak(s, '2026-10-17'), 0);
assert.strictEqual(D.seedFor('2026-10-14'), D.seedFor('2026-10-14'));
assert.notStrictEqual(D.seedFor('2026-10-14'), D.seedFor('2026-10-15'));
assert.deepStrictEqual(D.normalize(JSON.parse('{"streak":99}')).streak, 0);
console.log('daily tests passed');
