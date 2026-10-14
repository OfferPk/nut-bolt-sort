// v1.5 tests: review prompt gating, cloud-save snapshot logic, cloud flag OFF by default.
const assert = require('assert');
const R = require('../www/js/review.js');
const C = require('../www/js/cloudsave.js');
global.window = global.window || {};
require('../www/js/cloud-config.js');
const DAY = 86400000, now = 1_800_000_000_000;
assert.strictEqual(R.shouldAsk({}, 2, now), false, 'not before the 3rd win');
assert.strictEqual(R.shouldAsk({}, 3, now), true, 'from the 3rd win');
assert.strictEqual(R.shouldAsk({ last: now - 29 * DAY }, 10, now), false, 'max once per 30 days');
assert.strictEqual(R.shouldAsk({ last: now - 30 * DAY }, 10, now), true);
assert.strictEqual(R.shouldAsk({ last: now + DAY }, 10, now), true, 'future timestamp is stale');
// cloud config
const cfg = window.CLOUD_CONFIG;
assert.strictEqual(cfg.ENABLED, false, 'cloud save is OFF by default');
assert.ok(/^REPLACE_WITH_/.test(cfg.PLAY_GAMES_APP_ID), 'placeholder app id only (never a real/invented id)');
assert.ok(Array.isArray(cfg.KEYS) && cfg.KEYS.length >= 3, 'whitelisted keys');
// snapshot
const mem = {}; const st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
cfg.KEYS.forEach((k, i) => st.setItem(k, JSON.stringify({ i })));
st.setItem('other.app.key', 'x');
const snap = C.collect(cfg.KEYS, st, now);
assert.ok(C.valid(snap) && Object.keys(snap.data).length === cfg.KEYS.length && !('other.app.key' in snap.data));
assert.strictEqual(C.pick({ v: 1, at: now, data: {} }, { v: 1, at: now + 1, data: {} }), 'remote');
assert.strictEqual(C.pick({ v: 1, at: now, data: {} }, { v: 1, at: now - 1, data: {} }), 'local');
assert.strictEqual(C.pick({ v: 1, at: now, data: {} }, { garbage: true }), 'local');
const mem2 = {}; const st2 = { getItem: k => (k in mem2 ? mem2[k] : null), setItem: (k, v) => { mem2[k] = String(v); } };
const evil = { v: 1, at: now, data: Object.assign({}, snap.data, { 'evil.key': 'x' }) };
assert.strictEqual(C.apply(evil, cfg.KEYS, st2), cfg.KEYS.length); assert.ok(!('evil.key' in mem2), 'only whitelisted keys restored');
console.log('v1.5 tests passed');
