const assert = require('assert');
const W = require('../www/js/weekly.js');
assert.strictEqual(W.weekKey(new Date(2026, 9, 14)), '2026-W42');
assert.strictEqual(W.weekKey(new Date(2026, 0, 1)), '2026-W01');
assert.strictEqual(W.weekKey(new Date(2027, 0, 1)), '2026-W53');
assert.strictEqual(W.weekKey(new Date(2026, 9, 12)), W.weekKey(new Date(2026, 9, 18))); // Mon..Sun same week
assert.notStrictEqual(W.weekKey(new Date(2026, 9, 18)), W.weekKey(new Date(2026, 9, 19)));
assert.strictEqual(W.daysLeft(new Date(2026, 9, 12)), 7); assert.strictEqual(W.daysLeft(new Date(2026, 9, 18)), 1);
const pool = require('../www/js/weekly-goals.js');
assert(pool.length >= 4, 'pool has >=4 goals');
const a = W.goalsFor('2026-W42', pool, 'x'), b = W.goalsFor('2026-W42', pool, 'x');
assert.deepStrictEqual(a, b, 'same goals for everyone in a week');
assert.strictEqual(a.length, 3); assert.strictEqual(new Set(a.map(g => g.stat)).size, 3, 'distinct stats');
let differs = false; for (let w = 1; w <= 20; w++) if (JSON.stringify(W.goalsFor('2026-W' + String(w).padStart(2, '0'), pool, 'x')) !== JSON.stringify(a)) differs = true;
assert(differs, 'goals rotate between weeks');
const s = W.fresh('2026-W42'); let coins = 0;
assert.deepStrictEqual(W.track(s, a, 'nonexistent_stat', 5), []);
a.forEach(g => { W.track(s, a, g.stat, g.target - 1); });
assert.strictEqual(Object.keys(s.got).length, 0);
a.forEach(g => W.track(s, a, g.stat, 1).forEach(r => coins += r.coins));
assert.strictEqual(coins, 3 * W.GOAL_COINS + W.ALL_BONUS);
assert.deepStrictEqual(s.crests, ['2026-W42']);
a.forEach(g => assert.strictEqual(W.track(s, a, g.stat, 50).length, 0, 'no double reward'));
const n = W.normalize(JSON.parse(JSON.stringify(s)), '2026-W43');
assert.deepStrictEqual(n.p, {}); assert.strictEqual(n.all, 0); assert.deepStrictEqual(n.crests, ['2026-W42'], 'crests persist across weeks');
assert.deepStrictEqual(W.normalize({ crests: ['bad', '2026-W01'], p: { x: -3 } }, '2026-W01').crests, ['2026-W01']);
console.log('weekly tests ok');
// v1.6 shop: every theme/skin id unique, priced in coins, and styled in CSS
{
  global.window = global.window || {};
  const fs = require('fs'), css = fs.readFileSync(__dirname + '/../www/css/style.css', 'utf8');
  const T = require('../www/js/' + (fs.existsSync(__dirname + '/../www/js/skins.js') ? 'skins.js' : 'themes.js'));
  const groups = Array.isArray(T) ? { theme: T } : { nut: T.nut, bolt: T.bolt, bg: T.bg };
  let total = 0;
  Object.keys(groups).forEach(k => {
    const ids = groups[k].map(t => t.id); assert.strictEqual(new Set(ids).size, ids.length, k + ' ids unique');
    groups[k].forEach(t => { total++; assert(t.price >= 0 && Number.isInteger(t.price), 'coin price'); assert(css.includes('.' + k + '-' + t.id + ' ') || css.includes('.' + k + '-' + t.id + '{') || (k === 'theme' && /hexa/.test(__dirname) && css.includes('.theme-' + t.id)), 'css for ' + k + '-' + t.id); });
  });
  assert(total >= 12, 'at least 12 cosmetics');
  const cc = fs.readFileSync(__dirname + '/../www/js/cloud-config.js', 'utf8'); assert(cc.includes('nutboltsort.weekly.v1'), 'weekly key in cloud whitelist');
  assert(/ENABLED:\s*false/.test(cc), 'cloud still off');
  console.log('v1.6 shop tests ok (' + total + ' cosmetics)');
}
