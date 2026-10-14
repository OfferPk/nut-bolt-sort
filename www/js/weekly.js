/*
 * Weekly Challenge: 3 goals per week, identical for every player (seeded from the
 * ISO week + game salt), fully offline. Rewards are cosmetic: coins + a weekly crest
 * badge (collectible, no gameplay effect). No ads, no betting, no loot boxes.
 *
 *   WeeklyLogic.*           pure helpers (node-testable)
 *   Weekly.create(opts)     adds a "Weekly challenge" section to the Daily overlay and
 *                           tracks progress by observing Achievements.bump(stat, n)
 */
(function (root) {
  'use strict';
  var GOAL_COINS = 40, ALL_BONUS = 120, N_GOALS = 3;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** ISO-8601 week id of a local date, e.g. "2026-W42". */
  function weekKey(d) {
    d = d || new Date();
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dow = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dow);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-W' + pad(Math.ceil(((t - y0) / 86400000 + 1) / 7));
  }
  /** days left until the week rolls over (1..7, counting today) */
  function daysLeft(d) { d = d || new Date(); return 8 - (d.getDay() || 7); }
  function hash(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** pool: [{stat, text:'Win {n} levels', targets:[a,b,c]}] -> 3 goals, same for everyone this week */
  function goalsFor(wk, pool, salt) {
    var r = rng(hash(wk + '|weekly|' + (salt || ''))), idx = pool.map(function (_, i) { return i; }), out = [];
    for (var i = idx.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = idx[i]; idx[i] = idx[j]; idx[j] = x; }
    idx.slice(0, Math.min(N_GOALS, pool.length)).forEach(function (k) {
      var p = pool[k], n = p.targets[Math.floor(r() * p.targets.length)];
      out.push({ stat: p.stat, target: n, text: p.text.replace('{n}', n) });
    });
    return out;
  }
  function fresh(wk) { return { wk: wk, p: {}, got: {}, all: 0, crests: [] }; }
  function normalize(s, wk) {
    var d = fresh(wk);
    if (s && typeof s === 'object') {
      if (Array.isArray(s.crests)) d.crests = s.crests.filter(function (c) { return /^\d{4}-W\d\d$/.test(c); }).slice(-104);
      if (s.wk === wk) {
        if (s.p && typeof s.p === 'object') Object.keys(s.p).forEach(function (k) { var v = +s.p[k]; if (isFinite(v) && v > 0) d.p[k] = v; });
        if (s.got && typeof s.got === 'object') Object.keys(s.got).forEach(function (k) { if (s.got[k]) d.got[k] = 1; });
        d.all = s.all ? 1 : 0;
      }
    }
    return d;
  }
  /** record n of stat; returns list of newly-completed rewards [{coins, goal|all}] */
  function track(s, goals, stat, n) {
    if (!(n > 0)) return [];
    var used = goals.some(function (g) { return g.stat === stat; });
    if (!used) return [];
    s.p[stat] = (s.p[stat] || 0) + n;
    var out = [];
    goals.forEach(function (g, i) { if (!s.got[i] && (s.p[g.stat] || 0) >= g.target) { s.got[i] = 1; out.push({ coins: GOAL_COINS, goal: g }); } });
    if (!s.all && goals.every(function (_, i) { return s.got[i]; })) {
      s.all = 1; if (s.crests.indexOf(s.wk) < 0) s.crests.push(s.wk); out.push({ coins: ALL_BONUS, all: true });
    }
    return out;
  }
  var Logic = { GOAL_COINS: GOAL_COINS, ALL_BONUS: ALL_BONUS, weekKey: weekKey, daysLeft: daysLeft, goalsFor: goalsFor, fresh: fresh, normalize: normalize, track: track };
  root.WeeklyLogic = Logic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  if (typeof document === 'undefined') return;

  function create(o) {
    var KEY = o.key, s, goals, toast = o.toast || function () {}, sfx = o.sfx || function () {};
    function load() {
      var wk = weekKey();
      try { s = normalize(JSON.parse(localStorage.getItem(KEY) || 'null'), wk); } catch (e) { s = fresh(wk); }
      goals = goalsFor(wk, o.pool, o.salt);
    }
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
    load();
    var box = document.createElement('div');
    box.className = 'weekly';
    box.innerHTML = '<p class="daily-sub weekly-sub">Weekly challenge <span class="weekly-left"></span></p>' +
      '<div class="weekly-goals"></div><div class="weekly-foot"><span class="weekly-crest" aria-hidden="true">🏅</span><span class="weekly-crests"></span></div>';
    var panel = document.querySelector('#daily .daily-panel'), note = panel && panel.querySelector('.daily-note');
    if (panel) panel.insertBefore(box, note || null);
    function render() {
      if (s.wk !== weekKey()) load();
      var dl = daysLeft();
      box.querySelector('.weekly-left').textContent = '· ' + (dl === 1 ? 'last day' : dl + ' days left');
      var g = box.querySelector('.weekly-goals'); g.innerHTML = '';
      goals.forEach(function (goal, i) {
        var have = Math.min(goal.target, s.p[goal.stat] || 0), done = !!s.got[i];
        var row = document.createElement('div'); row.className = 'weekly-goal' + (done ? ' done' : '');
        row.innerHTML = '<div class="weekly-row"><span class="weekly-t"></span><b class="weekly-n"></b></div><div class="weekly-bar"><i></i></div>';
        row.querySelector('.weekly-t').textContent = (done ? '✓ ' : '') + goal.text;
        row.querySelector('.weekly-n').textContent = done ? '+' + GOAL_COINS : have + ' / ' + goal.target;
        row.querySelector('i').style.width = Math.round(100 * have / goal.target) + '%';
        g.appendChild(row);
      });
      box.querySelector('.weekly-crests').textContent = s.all
        ? 'Crest ' + s.wk + ' earned! Crests collected: ' + s.crests.length
        : 'Finish all 3 for +' + ALL_BONUS + ' coins and this week\'s crest · collected: ' + s.crests.length;
    }
    if (o.ach && typeof o.ach.bump === 'function') {
      var orig = o.ach.bump;
      o.ach.bump = function (k, n) { api.track(k, n == null ? 1 : n); return orig.apply(this, arguments); };
    }
    var api = {
      track: function (stat, n) {
        if (s.wk !== weekKey()) { load(); }
        var got = track(s, goals, stat, n);
        if (!got.length && goals.some(function (g) { return g.stat === stat; })) persist();
        if (!got.length) return 0;
        persist(); var c = 0; got.forEach(function (x) { c += x.coins; });
        o.addCoins(c);
        got.forEach(function (x, i) {
          setTimeout(function () { sfx('coin'); toast(x.all ? '🏅 Weekly crest ' + s.wk + '! +' + x.coins + ' coins' : 'Weekly goal done: ' + x.goal.text + ' · +' + x.coins + ' coins', 2600); }, 600 + i * 2800);
        });
        render(); return c;
      },
      refresh: render, goals: function () { return goals; }, state: function () { return s; }
    };
    render();
    var dailyBtn = document.getElementById('btn-daily');
    if (dailyBtn) dailyBtn.addEventListener('click', render);
    return api;
  }
  root.Weekly = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
