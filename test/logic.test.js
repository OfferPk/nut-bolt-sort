// Node test: rules, solver, and generation of levels 1..1000 (all must be verified solvable).
// Usage: node test/logic.test.js [maxLevel]
const L = require('../www/js/logic.js');
const assert = require('assert');
const MAX = parseInt(process.argv[2], 10) || 1000;
let passed = 0;
function t(name, fn) { fn(); passed++; }

// ---- rules ----
t('topRun', () => { assert.strictEqual(L.topRun([1, 2, 2]), 2); assert.strictEqual(L.topRun([]), 0); assert.strictEqual(L.topRun([3, 3, 3, 3]), 4); });
t('move onto empty', () => { assert.strictEqual(L.moveCount([[1, 2, 2], []], 0, 1, 4), 2); });
t('move onto matching color', () => { assert.strictEqual(L.moveCount([[1, 2], [3, 2]], 0, 1, 4), 1); });
t('no move onto other color', () => { assert.strictEqual(L.moveCount([[1, 2], [3, 1]], 0, 1, 4), 0); });
t('capacity limits partial move', () => { assert.strictEqual(L.moveCount([[1, 2, 2, 2], [2, 2, 2]], 0, 1, 4), 1); });
t('full target refused', () => { assert.strictEqual(L.moveCount([[2], [1, 1, 2, 2]], 0, 1, 4), 0); });
t('same bolt refused', () => { assert.strictEqual(L.moveCount([[2]], 0, 0, 4), 0); });
t('empty source refused', () => { assert.strictEqual(L.moveCount([[], [1]], 0, 1, 4), 0); });
t('applyMove immutability', () => { const b = [[1, 2, 2], []]; const nb = L.applyMove(b, 0, 1, 4); assert.deepStrictEqual(b, [[1, 2, 2], []]); assert.deepStrictEqual(nb, [[1], [2, 2]]); });
t('isSolved', () => { assert(L.isSolved([[1, 1, 1, 1], [], [2, 2, 2, 2]], 4)); assert(!L.isSolved([[1, 1, 1], [1]], 4)); assert(!L.isSolved([[1, 1, 2, 1]], 4)); });
t('solver on tiny board', () => { const b = [[1, 2, 1, 2], [2, 1, 2, 1], [], []]; const s = L.solve(b, 4); assert(s && L.verifySolution(b, 4, s)); });
t('solver reports unsolvable', () => { const b = [[1, 2, 1, 2], [2, 1, 2, 1]]; assert.strictEqual(L.solve(b, 4), null); });
t('hint = first solver move and legal', () => { const b = [[1, 2, 1, 2], [2, 1, 2, 1], [], []]; const h = L.hint(b, 4); assert(h && L.canMove(b, h[0], h[1], 4)); });
t('hasUsefulMove false when stuck', () => { assert(!L.hasUsefulMove([[1, 2, 1, 2], [2, 1, 2, 1]], 4)); });
t('canonical key ignores bolt order', () => { assert.strictEqual(L.key([[1], [2, 3], []]), L.key([[], [2, 3], [1]])); });
t('deterministic generation', () => { for (const lv of [1, 7, 60, 333, 999]) assert.deepStrictEqual(L.generateLevel(lv).bolts, L.generateLevel(lv).bolts); });
t('rng deterministic', () => { const a = L.rng(42), b = L.rng(42); for (let i = 0; i < 5; i++) assert.strictEqual(a(), b()); });

// ---- levels 1..MAX ----
const t0 = Date.now();
let worst = 0, worstLevel = 0, prevColors = 0, cap5 = 0, tight = 0;
for (let lv = 1; lv <= MAX; lv++) {
  const s = Date.now();
  const g = L.generateLevel(lv);
  const p = L.levelParams(lv);
  const C = g.capacity;
  // shape: K colors x C nuts, each color exactly C times, no bolt pre-solved
  const counts = {};
  g.bolts.forEach(b => { assert(b.length <= C); b.forEach(c => { counts[c] = (counts[c] || 0) + 1; }); });
  assert.strictEqual(Object.keys(counts).length, g.colors, 'colors ' + lv);
  Object.values(counts).forEach(n => assert.strictEqual(n, C, 'count ' + lv));
  assert(!g.bolts.some(b => L.isComplete(b, C)), 'pre-solved bolt at level ' + lv);
  assert.strictEqual(g.bolts.filter(b => !b.length).length, p.empty, 'empty bolts ' + lv);
  // independently verify the stored solution AND re-solve from scratch
  assert(L.verifySolution(g.bolts, C, g.solution), 'stored solution invalid at level ' + lv);
  const again = L.solve(g.bolts, C, { nodeLimit: 200000 });
  assert(again && L.verifySolution(g.bolts, C, again), 'solver could not re-solve level ' + lv);
  if (C === 5) cap5++;
  if (p.empty === 1) tight++;
  const d = Date.now() - s;
  if (d > worst) { worst = d; worstLevel = lv; }
}
passed++;
console.log(`rule/solver tests passed: ${passed - 1}`);
console.log(`levels 1..${MAX}: all generated, verified solvable and re-solved in ${Date.now() - t0} ms (worst ${worst} ms at level ${worstLevel}; ${cap5} capacity-5 levels, ${tight} one-spare levels)`);
[1, 5, 10, 25, 40, 60, 100, 500, 1000].filter(x => x <= MAX).forEach(lv => {
  const g = L.generateLevel(lv);
  console.log(`  level ${lv}: ${g.colors} colors, capacity ${g.capacity}, ${g.bolts.length} bolts, solution ${g.solution.length} moves`);
});
console.log('LOGIC TESTS PASSED');
