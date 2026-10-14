const assert = require('assert');
const C = require('../www/js/coach.js');
const mem = {}; const store = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
assert.ok(C.shouldShow(store, 't')); C.markSeen(store, 't'); assert.ok(!C.shouldShow(store, 't'), 'shown once');
C.reset(store, 't'); assert.ok(C.shouldShow(store, 't'), 'replay from settings');
const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
assert.strictEqual(C.shouldShow(broken, 't'), false, 'storage errors never block play');
console.log('coach tests passed');
