global.window = global.window || {};
const SK = require('../www/js/skins.js');
module.exports = { multi: true, groups: Object.keys(SK).map(k => ({ name: k, items: SK[k] })) };
