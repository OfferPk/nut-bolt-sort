const assert = require('assert'), fs = require('fs'), dir = __dirname + '/../www/';
const SR = require('../www/js/sr.js');
assert.strictEqual(SR.assistive({ type: 'click', detail: 0 }), true, 'keyboard/TalkBack click');
assert.strictEqual(SR.assistive({ type: 'click', detail: 1 }), false, 'real tap is not assistive');
assert.strictEqual(SR.assistive({ type: 'pointerdown', detail: 0 }), false);
const A = require('../www/js/a11y.js');
assert.strictEqual(typeof A.previewBar, 'function');
assert.strictEqual(A.marksOn({ marks: true }), true); A.preview.marks = false; assert.strictEqual(A.marksOn({ marks: true }), false, 'preview overrides'); A.preview.marks = null;
const html = fs.readFileSync(dir + 'index.html', 'utf8'), game = fs.readFileSync(dir + 'js/game.js', 'utf8'), css = fs.readFileSync(dir + 'css/style.css', 'utf8');
assert(html.indexOf('js/sr.js') > 0 && html.indexOf('js/sr.js') < html.indexOf('js/game.js'));
assert(/previewBar\(/.test(game) && css.includes('.sr-only') && css.includes('.a11y-preview'));
const name = fs.realpathSync(__dirname);
if (/hexa-sort/.test(name)) assert(/function srSync/.test(game) && /cv\.setAttribute\('aria-hidden'/.test(game), 'hexa canvas has an accessible overlay');
if (/block-puzzle/.test(name)) assert(/srSlotActivate/.test(game) && /'Piece ' \+ \(i \+ 1\)/.test(game), 'block tray pieces are labelled + activatable');
if (/sudoku/.test(name)) { assert(/'Row ' \+ \(L\.ROW\[i\] \+ 1\)/.test(game), 'sudoku cells labelled'); assert(!/b\.daily::before/.test(css), 'top bar no longer prefixes Daily'); }
console.log('v1.9 tests ok');
