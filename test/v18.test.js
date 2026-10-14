const assert = require('assert'), fs = require('fs'), dir = __dirname + '/../www/';
const A = require('../www/js/a11y.js');
// defaults: reduce motion unset = follow the OS live; explicit choice wins either way
assert.deepStrictEqual(A.defaults({}), { largeText: false, contrast: false });
assert.strictEqual(A.effective(undefined, true), true); assert.strictEqual(A.effective(undefined, false), false);
assert.strictEqual(A.effective(false, true), false, 'explicit off beats OS'); assert.strictEqual(A.effective(true, false), true, 'explicit on');
A.apply({ reduceMotion: true }); assert.strictEqual(A.reduced(), true); assert.strictEqual(A.ms(400), 40);
A.apply({ reduceMotion: false }); assert.strictEqual(A.ms(400), 400);
const html = fs.readFileSync(dir + 'index.html', 'utf8'), css = fs.readFileSync(dir + 'css/style.css', 'utf8'), game = fs.readFileSync(dir + 'js/game.js', 'utf8');
['set-motion', 'set-large', 'set-contrast'].forEach(id => assert(html.includes('id="' + id + '"'), id));
assert(html.indexOf('js/a11y.js') > 0 && html.indexOf('js/a11y.js') < html.indexOf('js/game.js'), 'a11y.js before game.js');
['html.a11y-reduce', 'html.a11y-large', 'html.a11y-contrast'].forEach(s => assert(css.includes(s), s));
assert(/A11y\.apply\(save\.settings\)/.test(game) && /A11y\.bind\(/.test(game));
const colourGame = /block-puzzle|hexa-sort|nut-bolt-sort/.test(fs.realpathSync(__dirname));
if (colourGame) { assert(html.includes('id="set-marks"'), 'colour-blind toggle'); assert((html.match(/id="set-marks"/g) || []).length === 1); }
const juice = fs.readFileSync(dir + 'js/juice.js', 'utf8'); assert(/A11y/.test(juice), 'confetti honours reduce motion');
console.log('v1.8 a11y tests ok');
