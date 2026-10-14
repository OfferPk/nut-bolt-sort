// Skin shop catalog + 24h trial tests. Usage: node test/shop.test.js
const assert = require('assert');
const S = require('../www/js/shopcore.js');
const D = require('../www/js/daily.js');
const cat = require('./shop-catalog.js'); // { groups: [{ name, items: [{id,name,price}] }] }
const weekly = D.REWARDS.reduce((a, b) => a + b, 0) + 7 * D.CHALLENGE_REWARD;
let themeCount = 0;
cat.groups.forEach(g => {
  const ids = new Set();
  g.items.forEach(it => {
    assert.ok(it.id && it.name, 'item has id/name'); assert.ok(!ids.has(it.id), 'unique id ' + it.id); ids.add(it.id);
    assert.ok(Number.isInteger(it.price) && it.price >= 0, 'price int');
    assert.ok(it.price <= weekly * 4, it.id + ' reachable within ~4 weeks of daily rewards alone (' + it.price + ' <= ' + weekly * 4 + ')');
  });
  assert.ok(g.items.some(it => it.price === 0), g.name + ' has a free default');
  if (g.theme) themeCount += g.items.length;
});
assert.ok(themeCount >= 10 && themeCount <= 14 || cat.multi, 'themes 10-14 (v1.6 added 4) (got ' + themeCount + ')');
assert.ok(S.BACKGROUNDS.length >= 2);
// trial
const now = 1_800_000_000_000, save = { coins: 100, theme: 'a', trial: {} };
assert.strictEqual(S.effective(save, 'theme', 'theme', now), 'a');
S.startTrial(save, 'theme', 'b', now);
assert.strictEqual(S.effective(save, 'theme', 'theme', now + 1000), 'b');
assert.strictEqual(S.effective(save, 'theme', 'theme', now + S.TRIAL_MS + 1), 'a', 'trial expires after 24h');
save.trial.theme.until = now + 10 * S.TRIAL_MS; // tampered/clock skew
assert.strictEqual(S.effective(save, 'theme', 'theme', now), 'a', 'over-long trial ignored');
// buy
const owned = ['a'];
assert.strictEqual(S.buy(save, owned, { id: 'c', price: 500 }).ok, false);
assert.strictEqual(save.coins, 100);
assert.ok(S.buy(save, owned, { id: 'c', price: 60 }).ok); assert.strictEqual(save.coins, 40); assert.ok(owned.includes('c'));
assert.ok(S.buy(save, owned, { id: 'c', price: 60 }).already); assert.strictEqual(save.coins, 40);
// no gambling words in catalog
assert.ok(!/loot|crate|gacha|spin|bet|cash/i.test(JSON.stringify(cat)), 'no loot-box style items');
console.log('shop tests passed (weekly daily coins = ' + weekly + ')');
