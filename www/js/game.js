/* Nut & Bolt Sort - UI, animation, persistence. Rules live in logic.js. */
(function () {
  'use strict';
  var L = window.NBLogic, SFX = window.SFX, SK = window.SKINS, COLORS = window.NUT_COLORS;
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = 'nutboltsort.save.v1';
  var native = window.Ads && window.Ads.isNative();
  document.body.classList.add(native ? 'native' : 'web');

  // ---------------- persistence ----------------
  function defaults() {
    return {
      level: 1, coins: 0, best: 0,
      owned: { nut: ['anodized'], bolt: ['steel'], bg: ['graphite'] },
      skin: { nut: 'anodized', bolt: 'steel', bg: 'graphite' },
      settings: { sound: true, haptics: true, marks: false },
      current: null,
      ad: {}
    };
  }
  function load() {
    var d = defaults();
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && typeof s === 'object') {
        Object.keys(d).forEach(function (k) { if (s[k] !== undefined) d[k] = s[k]; });
        d.settings = Object.assign(defaults().settings, s.settings || {});
        d.owned = Object.assign(defaults().owned, s.owned || {});
        d.skin = Object.assign(defaults().skin, s.skin || {});
      }
    } catch (e) {}
    return d;
  }
  var save = load();
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  var gate = window.AdGate.create(window.ADS_CONFIG, save.ad);
  save.ad = gate.state;

  // ---------------- state ----------------
  var S = {
    level: 1, cap: 4, colors: 3, bolts: [], start: null, history: [], moves: 0,
    extraUsed: false, won: false, busy: false, sel: -1, liftN: 0
  };
  var els = [];      // els[b] = array of nut elements (bottom -> top)
  var boltEls = [];
  var G = null;      // geometry
  var board = $('board');

  // ---------------- helpers ----------------
  function clone(b) { return b.map(function (x) { return x.slice(); }); }
  function haptic(kind) {
    if (!save.settings.haptics || !native) return;
    var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (!H) return;
    try {
      if (kind === 'success') H.notification({ type: 'SUCCESS' });
      else if (kind === 'error') H.notification({ type: 'WARNING' });
      else H.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
    } catch (e) {}
  }
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('hidden'); }, ms || 2200);
  }
  function setCoins() {
    Array.prototype.forEach.call(document.querySelectorAll('.coins-val'), function (e) { e.textContent = save.coins; });
  }
  function applySkins() {
    var cl = document.body.classList;
    Array.prototype.slice.call(cl).forEach(function (c) { if (/^(bg|bolt|nut)-/.test(c)) cl.remove(c); });
    cl.add('bg-' + save.skin.bg, 'bolt-' + save.skin.bolt, 'nut-' + save.skin.nut);
    cl.toggle('marks', !!save.settings.marks);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function anim(el, frames, opts) {
    var a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    return a.finished.then(function () {
      var last = frames[frames.length - 1];
      if (last.transform) el.style.transform = last.transform;
      try { a.cancel(); } catch (e) {}
    }, function () {});
  }
  function tr(x, y) { return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }

  var announcementTimer = null;
  function announce(message) {
    var status = $('game-status');
    if (!status) return;
    clearTimeout(announcementTimer);
    status.textContent = '';
    announcementTimer = setTimeout(function () { status.textContent = message; }, 30);
  }
  function colorName(color) { return (COLORS[color] && COLORS[color].name) || ('color ' + (color + 1)); }
  function syncBoltAccessibility() {
    boltEls.forEach(function (be, i) {
      var bolt = S.bolts[i], label = 'Bolt ' + (i + 1);
      if (!bolt.length) label += ', empty';
      else {
        var groups = [];
        bolt.forEach(function (color) {
          var last = groups[groups.length - 1];
          if (last && last.color === color) last.count++;
          else groups.push({ color: color, count: 1 });
        });
        label += ', ' + bolt.length + ' nuts bottom to top: ' + groups.map(function (g) {
          return g.count + ' ' + colorName(g.color);
        }).join(', ');
        var run = L.topRun(bolt), top = colorName(bolt[bolt.length - 1]);
        label += '; top ' + run + ' ' + top + (run === 1 ? ' nut' : ' nuts');
        if (L.isComplete(bolt, S.cap)) label += ', sorted and unavailable';
      }
      if (S.sel === i) label += ', selected';
      else label += ', not selected';
      be.setAttribute('role', 'button');
      be.setAttribute('tabindex', '0');
      be.setAttribute('aria-label', label);
      be.setAttribute('aria-pressed', String(S.sel === i));
    });
  }

  // ---------------- geometry ----------------
  function computeGeometry() {
    var W = board.clientWidth, H = board.clientHeight, n = S.bolts.length, C = S.cap;
    var best = null;
    for (var rows = 1; rows <= 4; rows++) {
      var cols = Math.ceil(n / rows);
      if (cols < 1) continue;
      var nwW = (W - 16) / cols * 0.82;
      var unitsH = C + 0.5 + 0.55 + 1.9; // rod + head + lift zone, in nut heights
      var nwH = (H - 10) / rows / unitsH / 0.36;
      var nw = Math.min(nwW, nwH, 96);
      if (!best || nw > best.nw + 0.5) best = { rows: rows, cols: cols, nw: nw };
    }
    var nw = Math.max(26, best.nw), nh = nw * 0.36;
    var rowH = nh * (C + 0.5 + 0.55 + 1.9);
    var totalH = rowH * best.rows;
    var offY = Math.max(0, (H - totalH) / 2);
    var pos = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / best.cols);
      var inRow = Math.min(best.cols, n - r * best.cols);
      var colW = (W - 16) / best.cols;
      var rowStartX = 8 + (W - 16 - inRow * colW) / 2;
      var c = i - r * best.cols;
      var cx = rowStartX + colW * (c + 0.5);
      var bottom = offY + rowH * (r + 1) - nh * 0.2;
      var headH = nh * 0.55;
      var headTop = bottom - headH;
      var rodH = nh * (C + 0.5);
      pos.push({ cx: cx, bottom: bottom, headTop: headTop, headH: headH, rodTop: headTop - rodH, rodH: rodH, colW: colW, rowTop: offY + rowH * r });
    }
    G = { nw: nw, nh: nh, rw: Math.max(6, nw * 0.2), rowH: rowH, pos: pos, cols: best.cols, rows: best.rows };
    board.style.setProperty('--nw', nw + 'px');
    board.style.setProperty('--nh', nh + 'px');
    board.style.setProperty('--rw', G.rw + 'px');
    board.style.setProperty('--face', (nw * 0.5) + 'px');
  }
  function slotXY(b, slot) {
    var p = G.pos[b];
    return { x: p.cx - G.nw / 2, y: p.headTop - (slot + 1) * G.nh };
  }
  function liftXY(b, k) { // k = index within the lifted group (0 = lowest)
    var p = G.pos[b];
    return { x: p.cx - G.nw / 2, y: p.rodTop - G.nh * 0.45 - (k + 1) * G.nh };
  }

  // ---------------- rendering ----------------
  function makeNut(color) {
    var d = document.createElement('div');
    var info = COLORS[color] || COLORS[0];
    d.className = 'nut';
    d.style.setProperty('--c', info.c);
    var m = document.createElement('b'); m.textContent = info.m;
    if (color === 10) m.style.color = '#1d232a';
    d.appendChild(m);
    d.dataset.color = color;
    return d;
  }
  function render() {
    board.innerHTML = '';
    els = []; boltEls = [];
    computeGeometry();
    S.bolts.forEach(function (bolt, i) {
      var be = document.createElement('div');
      be.className = 'bolt'; be.dataset.index = i;
      be.innerHTML = '<div class="shadow"></div><div class="rod"></div><div class="head"></div><div class="cap"></div>';
      board.appendChild(be); boltEls.push(be);
      els.push([]);
    });
    S.bolts.forEach(function (bolt, i) {
      bolt.forEach(function (c) { var n = makeNut(c); board.appendChild(n); els[i].push(n); });
    });
    layout();
    syncBoltAccessibility();
  }
  function layout() {
    computeGeometry();
    S.bolts.forEach(function (bolt, i) {
      var p = G.pos[i], be = boltEls[i];
      be.style.left = (p.cx - p.colW / 2) + 'px'; be.style.top = p.rowTop + 'px';
      be.style.width = p.colW + 'px'; be.style.height = (p.bottom - p.rowTop + 4) + 'px';
      var ox = p.colW / 2, oy = -p.rowTop;
      var rod = be.children[1], head = be.children[2], cap = be.children[3], sh = be.children[0];
      rod.style.width = G.rw + 'px'; rod.style.height = p.rodH + 'px'; rod.style.top = (p.rodTop + oy) + 'px';
      head.style.width = (G.nw * 1.12) + 'px'; head.style.height = p.headH + 'px'; head.style.top = (p.headTop + oy) + 'px';
      sh.style.width = (G.nw * 1.4) + 'px'; sh.style.height = (G.nh * 0.8) + 'px'; sh.style.top = (p.bottom + oy - G.nh * 0.45) + 'px';
      cap.style.width = (G.rw * 2.2) + 'px'; cap.style.height = (G.rw * 1.5) + 'px';
      var capSlot = S.cap; // sits on top of the full stack
      cap.style.top = (p.headTop - capSlot * G.nh - G.rw * 1.3 + oy) + 'px';
      be.classList.toggle('done', L.isComplete(bolt, S.cap));
      els[i].forEach(function (n, k) {
        var xy = slotXY(i, k);
        if (i === S.sel && k >= bolt.length - S.liftN) xy = liftXY(i, k - (bolt.length - S.liftN));
        n.style.transform = tr(xy.x, xy.y);
        n.classList.toggle('lifted', i === S.sel && k >= bolt.length - S.liftN);
      });
    });
  }

  // ---------------- level flow ----------------
  function paramsText() {
    var p = L.levelParams(S.level);
    var t = S.colors + ' colors · ' + S.cap + ' per bolt';
    if (p.empty === 1) t += ' · tight';
    return t;
  }
  function startLevel(level, restore) {
    S.level = level;
    var g = L.generateLevel(level);
    S.cap = g.capacity; S.colors = g.colors;
    S.start = clone(g.bolts);
    S.sel = -1; S.liftN = 0; S.busy = false; S.won = false;
    var cur = save.current;
    if (restore && cur && cur.level === level && Array.isArray(cur.bolts)) {
      S.bolts = clone(cur.bolts); S.history = (cur.history || []).slice(-100); S.moves = cur.moves || 0; S.extraUsed = !!cur.extraUsed;
    } else {
      S.bolts = clone(g.bolts); S.history = []; S.moves = 0; S.extraUsed = false;
    }
    $('lvl-title').textContent = 'LEVEL ' + level;
    $('lvl-sub').textContent = paramsText();
    $('play-level').textContent = 'Level ' + level;
    $('win').classList.add('hidden'); $('stuck').classList.add('hidden');
    updateButtons();
    render();
    saveCurrent();
    if (native && gate.state.maxCompleted >= gate.config.INTERSTITIAL_MIN_LEVEL - 1) window.Ads.prepareInterstitial();
  }
  function saveCurrent() {
    save.level = S.level;
    save.current = { level: S.level, bolts: S.bolts, history: S.history.slice(-100), moves: S.moves, extraUsed: S.extraUsed };
    persist();
  }
  function updateButtons() {
    $('btn-undo').disabled = !S.history.length;
    $('btn-extra').disabled = S.extraUsed;
    $('stuck-extra').disabled = S.extraUsed;
  }

  // ---------------- interaction ----------------
  async function liftSelection(i) {
    var bolt = S.bolts[i];
    var run = L.topRun(bolt);
    S.sel = i; S.liftN = run;
    syncBoltAccessibility();
    var pickedColor = colorName(bolt[bolt.length - 1]);
    announce(run + ' ' + pickedColor + (run === 1 ? ' nut selected' : ' nuts selected') + ' from bolt ' + (i + 1) + '. Choose another bolt to move them, or select this bolt again to cancel.');
    var group = els[i].slice(bolt.length - run);
    SFX.lift(run); haptic('light');
    await Promise.all(group.map(function (n, k) {
      var from = slotXY(i, bolt.length - run + k), to = liftXY(i, k);
      n.classList.add('lifted', 'spin-rev');
      return anim(n, [{ transform: tr(from.x, from.y) }, { transform: tr(to.x, to.y) }], { duration: 170 + k * 25, easing: 'cubic-bezier(.2,.8,.3,1)' })
        .then(function () { n.classList.remove('spin-rev'); });
    }));
  }
  async function dropSelection(quiet) {
    var i = S.sel; if (i < 0) return;
    var bolt = S.bolts[i], run = S.liftN;
    var returnedColor = colorName(bolt[bolt.length - 1]);
    var group = els[i].slice(bolt.length - run);
    S.sel = -1; S.liftN = 0;
    syncBoltAccessibility();
    if (!quiet) announce('Selection cancelled. ' + run + ' ' + returnedColor + (run === 1 ? ' nut returned' : ' nuts returned') + ' to bolt ' + (i + 1) + '.');
    if (!quiet) SFX.cancel();
    await Promise.all(group.map(function (n, k) {
      var from = liftXY(i, k), to = slotXY(i, bolt.length - run + k);
      n.classList.add('spin');
      return anim(n, [{ transform: tr(from.x, from.y) }, { transform: tr(to.x, to.y) }], { duration: 170, easing: 'cubic-bezier(.4,0,.6,1)' })
        .then(function () { n.classList.remove('spin', 'lifted'); });
    }));
  }
  function shake(i) {
    var be = boltEls[i]; if (!be) return;
    be.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 260 });
    SFX.error(); haptic('error');
  }

  async function onBoltTap(i) {
    if (S.busy || S.won) return;
    SFX.unlock();
    clearHint();
    var bolt = S.bolts[i];
    if (S.sel < 0) {
      if (!bolt.length || L.isComplete(bolt, S.cap)) { shake(i); return; }
      S.busy = true; await liftSelection(i); S.busy = false; return;
    }
    if (S.sel === i) { S.busy = true; await dropSelection(); S.busy = false; return; }
    var n = L.moveCount(S.bolts, S.sel, i, S.cap);
    if (n > 0) { await doMove(S.sel, i, n); return; }
    // not a legal target: switch selection if that bolt can be picked up, else shake
    if (bolt.length && !L.isComplete(bolt, S.cap)) {
      S.busy = true; await dropSelection(true); await liftSelection(i); S.busy = false;
    } else shake(i);
  }

  async function doMove(from, to, n) {
    S.busy = true;
    S.history.push({ bolts: clone(S.bolts), moves: S.moves, from: from });
    var src = S.bolts[from], run = S.liftN;
    var movedColor = colorName(src[src.length - 1]);
    var liftedEls = els[from].slice(src.length - run);
    var moving = liftedEls.slice(run - n);          // top n of the lifted group
    var staying = liftedEls.slice(0, run - n);
    var baseSlot = S.bolts[to].length;
    // update model
    for (var k = 0; k < n; k++) S.bolts[to].push(S.bolts[from].pop());
    els[from].splice(els[from].length - n, n);
    moving.forEach(function (e) { els[to].push(e); });
    S.sel = -1; S.liftN = 0; S.moves++;
    syncBoltAccessibility();
    announce('Moved ' + n + ' ' + movedColor + (n === 1 ? ' nut' : ' nuts') + ' from bolt ' + (from + 1) + ' to bolt ' + (to + 1) + '.');
    // any nuts that did not fit go back down
    var back = staying.map(function (e, k) {
      var a = liftXY(from, k), b = slotXY(from, src.length - staying.length + k);
      e.classList.add('spin');
      return anim(e, [{ transform: tr(a.x, a.y) }, { transform: tr(b.x, b.y) }], { duration: 180 }).then(function () { e.classList.remove('spin', 'lifted'); });
    });
    // fly over, then screw down
    var flights = moving.map(function (e, k) {
      var a = liftXY(from, run - n + k), hover = liftXY(to, k), dst = slotXY(to, baseSlot + k);
      var midX = (a.x + hover.x) / 2, midY = Math.min(a.y, hover.y) - G.nh * 1.2;
      return anim(e, [
        { transform: tr(a.x, a.y), offset: 0 },
        { transform: tr(midX, midY), offset: 0.5 },
        { transform: tr(hover.x, hover.y), offset: 1 }
      ], { duration: 260, easing: 'ease-in-out', delay: k * 30 }).then(function () {
        e.classList.add('spin');
        e.style.setProperty('--spin-dur', '.12s');
        return anim(e, [{ transform: tr(hover.x, hover.y) }, { transform: tr(dst.x, dst.y - 3) }, { transform: tr(dst.x, dst.y) }],
          { duration: 230 + (n - k) * 30, easing: 'cubic-bezier(.5,0,.8,1)' });
      }).then(function () { e.classList.remove('spin', 'lifted'); e.style.removeProperty('--spin-dur'); });
    });
    setTimeout(function () { SFX.screw(n); haptic('light'); }, 280);
    await Promise.all(back.concat(flights));
    var doneNow = L.isComplete(S.bolts[to], S.cap);
    boltEls[to].classList.toggle('done', doneNow);
    boltEls[from].classList.toggle('done', L.isComplete(S.bolts[from], S.cap));
    if (doneNow) { SFX.complete(); haptic('medium'); sparks(to, 14); }
    updateButtons();
    if (L.isSolved(S.bolts, S.cap)) { S.busy = false; return win(); }
    saveCurrent();
    S.busy = false;
    if (!L.hasUsefulMove(S.bolts, S.cap)) setTimeout(function () { if (!S.won && !L.hasUsefulMove(S.bolts, S.cap)) $('stuck').classList.remove('hidden'); }, 450);
  }

  function sparks(b, count) {
    var p = G.pos[b], fx = $('fx'), br = board.getBoundingClientRect(), ar = $('app').getBoundingClientRect();
    var x0 = br.left - ar.left + p.cx, y0 = br.top - ar.top + p.headTop - S.cap * G.nh;
    for (var i = 0; i < count; i++) {
      var s = document.createElement('div'); s.className = 'spark';
      var hue = Math.random() < 0.6 ? '#ffcf5a' : '#ffffff';
      s.style.background = hue; s.style.left = x0 + 'px'; s.style.top = y0 + 'px';
      s.style.boxShadow = '0 0 6px ' + hue;
      fx.appendChild(s);
      var ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 60;
      s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
                 { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist + 30) + 'px) scale(.3)', opacity: 0 }],
        { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(.1,.7,.3,1)' }).finished.then(function (x) { return function () { x.remove(); }; }(s));
    }
  }

  function coinReward(level, colors) { return 10 + Math.floor(colors / 2) + (level % 10 === 0 ? 20 : 0); }

  async function win() {
    S.won = true;
    var reward = coinReward(S.level, S.colors);
    save.coins += reward;
    save.best = Math.max(save.best || 0, S.level);
    gate.levelCompleted(S.level);
    save.level = S.level + 1;
    save.current = null;
    persist();
    setCoins();
    SFX.win(); haptic('success');
    for (var b = 0; b < S.bolts.length; b++) if (S.bolts[b].length) sparks(b, 8);
    await wait(650);
    $('win-level').textContent = S.level;
    $('win-moves').textContent = S.moves;
    $('win-coins').textContent = '+' + reward;
    $('win').classList.remove('hidden');
  }

  async function nextLevel() {
    SFX.click();
    $('btn-next').disabled = true;
    $('win').classList.add('hidden');
    try { await window.Ads.maybeInterstitial(gate); } catch (e) {}
    persist();
    $('btn-next').disabled = false;
    startLevel(save.level, false);
  }

  function undo() {
    if (S.busy || S.won || !S.history.length) return;
    SFX.click(); clearHint();
    var h = S.history.pop();
    var source = Number.isInteger(h.from) ? h.from : S.bolts.findIndex(function (bolt, i) {
      return h.bolts[i] && bolt.length > h.bolts[i].length;
    });
    S.bolts = h.bolts; S.moves = h.moves; S.sel = -1; S.liftN = 0;
    $('stuck').classList.add('hidden');
    render(); updateButtons(); saveCurrent();
    if (boltEls[source]) boltEls[source].focus();
    announce('Move undone. ' + S.moves + (S.moves === 1 ? ' move' : ' moves') + ' made.');
  }
  function restart() {
    if (S.busy || S.won) return;
    SFX.click(); clearHint();
    S.bolts = clone(S.start); S.history = []; S.moves = 0; S.extraUsed = false; S.sel = -1; S.liftN = 0;
    $('stuck').classList.add('hidden');
    render(); updateButtons(); saveCurrent();
  }
  function addBolt() {
    S.bolts.push([]); S.extraUsed = true; S.sel = -1; S.liftN = 0;
    $('stuck').classList.add('hidden');
    render(); updateButtons(); saveCurrent();
    SFX.screw(1); haptic('medium'); sparks(S.bolts.length - 1, 10);
    toast('Spare bolt added');
  }
  function extraBolt() {
    if (S.busy || S.won || S.extraUsed) return;
    SFX.click();
    window.Ads.showRewarded(addBolt, function () { toast('No ad available right now. Try again in a moment.'); });
  }

  var hintTimer = null;
  function clearHint() {
    clearTimeout(hintTimer);
    boltEls.forEach(function (b) { b.classList.remove('hint'); });
  }
  async function hint() {
    if (S.busy || S.won) return;
    SFX.click();
    if (S.sel >= 0) { S.busy = true; await dropSelection(true); S.busy = false; }
    var mv = L.hint(S.bolts, S.cap, { nodeLimit: 150000 });
    if (!mv) { toast('No solution from here. Try Undo, +1 Bolt or Restart.', 2800); return; }
    window.Ads.showRewarded(function () { showHint(mv); }, function () { toast('No ad available right now. Try again in a moment.'); });
  }
  function showHint(mv) {
    clearHint();
    boltEls[mv[0]].classList.add('hint');
    setTimeout(function () { if (boltEls[mv[1]]) boltEls[mv[1]].classList.add('hint'); }, 350);
    toast('Move from the glowing bolt to the next one', 2400);
    hintTimer = setTimeout(clearHint, 3200);
    S.lastHint = mv;
  }

  // ---------------- screens ----------------
  function showHome() {
    $('game').classList.add('hidden'); $('home').classList.remove('hidden');
    $('play-level').textContent = 'Level ' + save.level;
    window.Ads.hideBanner();
  }
  function showGame() {
    $('home').classList.add('hidden'); $('game').classList.remove('hidden');
    if (!S.bolts.length || S.level !== save.level || S.won) startLevel(save.level, true);
    else layout();
    window.Ads.showBanner().then(function () { setTimeout(layout, 50); });
  }

  // ---------------- shop ----------------
  var shopTab = 'nut';
  function renderShop() {
    setCoins();
    var grid = $('shop-grid'); grid.innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.dataset.tab === shopTab); });
    SK[shopTab].forEach(function (it) {
      var owned = save.owned[shopTab].indexOf(it.id) >= 0, sel = save.skin[shopTab] === it.id;
      var d = document.createElement('div'); d.className = 'item' + (sel ? ' selected' : '');
      var prev = document.createElement('div');
      var skinCls = { nut: 'nut-' + (shopTab === 'nut' ? it.id : save.skin.nut), bolt: 'bolt-' + (shopTab === 'bolt' ? it.id : save.skin.bolt), bg: 'bg-' + (shopTab === 'bg' ? it.id : save.skin.bg) };
      prev.className = 'sw-prev ' + skinCls.nut + ' ' + skinCls.bolt + ' ' + skinCls.bg;
      prev.style.setProperty('--nw', '64px'); prev.style.setProperty('--nh', '23px'); prev.style.setProperty('--face', '32px');
      prev.innerHTML = '<div style="position:absolute;left:50%;top:6px;bottom:10px;width:12px;transform:translateX(-50%);border-radius:4px 4px 0 0;background:repeating-linear-gradient(170deg,var(--rod-lo) 0 1.5px,var(--rod-hi) 2.5px,var(--rod) 4.5px,var(--rod-lo) 6px)"></div>' +
        '<div style="position:absolute;left:50%;bottom:2px;width:76px;height:10px;transform:translateX(-50%);border-radius:3px;background:linear-gradient(90deg,var(--rod-lo),var(--head) 15%,var(--rod-hi) 45%,var(--head) 80%,var(--rod-lo))"></div>';
      [[1, 12], [5, 35]].forEach(function (a) {
        var n = makeNut(a[0]); n.style.transform = 'translate(' + 'calc(50% + 0px)' + ',0)';
        n.style.left = 'calc(50% - 32px)'; n.style.top = 'auto'; n.style.bottom = a[1] + 'px'; n.style.transform = 'none';
        prev.appendChild(n);
      });
      d.appendChild(prev);
      var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name; d.appendChild(nm);
      var b = document.createElement('button'); b.className = 'buy';
      if (sel) b.textContent = 'Equipped';
      else if (owned) { b.textContent = 'Equip'; b.classList.add('can'); }
      else { b.innerHTML = '<span class="coin-ico"></span>' + it.price; if (save.coins >= it.price) b.classList.add('can'); }
      b.addEventListener('click', function () {
        if (sel) return;
        if (!owned) {
          if (save.coins < it.price) { SFX.error(); toast('Clear more levels to earn ' + (it.price - save.coins) + ' more coins'); return; }
          save.coins -= it.price; save.owned[shopTab].push(it.id); SFX.coin();
        } else SFX.click();
        save.skin[shopTab] = it.id; persist(); applySkins(); renderShop();
      });
      d.appendChild(b);
      grid.appendChild(d);
    });
  }

  // ---------------- settings ----------------
  function syncSettingsUI() {
    $('set-sound').checked = !!save.settings.sound;
    $('set-haptics').checked = !!save.settings.haptics;
    $('set-marks').checked = !!save.settings.marks;
    $('btn-privacy-options').classList.toggle('hidden', !(native && window.Ads.privacyOptionsRequired()));
  }

  // ---------------- wiring ----------------
  board.addEventListener('click', function (e) {
    var t = e.target.closest('.bolt');
    if (t) { onBoltTap(+t.dataset.index); return; }
    // tapping a nut: find bolt under it by x/y
    if (!G) return;
    var r = board.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (var i = 0; i < G.pos.length; i++) {
      var p = G.pos[i];
      if (Math.abs(x - p.cx) <= p.colW / 2 && y >= p.rowTop - G.nh * 3 && y <= p.bottom + 4) { onBoltTap(i); return; }
    }
  });
  board.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target.closest('.bolt');
    if (!t) return;
    e.preventDefault();
    onBoltTap(+t.dataset.index);
  });
  $('btn-play').addEventListener('click', function () { SFX.unlock(); SFX.click(); showGame(); });
  $('btn-home').addEventListener('click', function () { SFX.click(); if (S.sel >= 0 && !S.busy) { S.sel = -1; S.liftN = 0; layout(); } showHome(); });
  $('btn-restart').addEventListener('click', restart);
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', hint);
  $('btn-extra').addEventListener('click', extraBolt);
  $('btn-next').addEventListener('click', nextLevel);
  $('stuck-undo').addEventListener('click', function () { $('stuck').classList.add('hidden'); undo(); });
  $('stuck-restart').addEventListener('click', function () { $('stuck').classList.add('hidden'); restart(); });
  $('stuck-extra').addEventListener('click', function () { $('stuck').classList.add('hidden'); extraBolt(); });
  $('btn-shop').addEventListener('click', function () { SFX.unlock(); SFX.click(); renderShop(); $('shop').classList.remove('hidden'); });
  $('btn-settings-home').addEventListener('click', function () { SFX.unlock(); SFX.click(); syncSettingsUI(); $('settings').classList.remove('hidden'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () { SFX.click(); $(b.dataset.close).classList.add('hidden'); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { SFX.click(); shopTab = t.dataset.tab; renderShop(); });
  });
  $('set-sound').addEventListener('change', function (e) { save.settings.sound = e.target.checked; SFX.setEnabled(save.settings.sound); persist(); SFX.click(); });
  $('set-haptics').addEventListener('change', function (e) { save.settings.haptics = e.target.checked; persist(); haptic('light'); });
  $('set-marks').addEventListener('change', function (e) { save.settings.marks = e.target.checked; persist(); applySkins(); });
  $('btn-privacy-options').addEventListener('click', function () { window.Ads.showPrivacyOptions(); });
  $('btn-reset').addEventListener('click', function () {
    if (!confirm('Reset all progress, coins and finishes?')) return;
    var ad = save.ad; save = defaults(); save.ad = ad; persist();
    applySkins(); setCoins(); $('settings').classList.add('hidden');
    S.bolts = []; showHome();
  });
  window.addEventListener('resize', function () { if (S.bolts.length && !$('game').classList.contains('hidden')) layout(); });

  // play-time accounting for the ad gate (only while actually playing)
  var tickCount = 0;
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    if ($('game').classList.contains('hidden') || S.won) return;
    gate.addPlayTime(1000);
    if (++tickCount % 10 === 0) persist();
  }, 1000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') persist(); });

  // ---------------- boot ----------------
  SFX.setEnabled(save.settings.sound);
  applySkins(); setCoins();
  $('play-level').textContent = 'Level ' + save.level;
  var qs = new URLSearchParams(location.search);
  var qLevel = parseInt(qs.get('level'), 10);
  if (qLevel > 0) { save.level = qLevel; if (!save.current || save.current.level !== qLevel) save.current = null; persist(); showGame(); }
  // consent + SDK init only: no ad is shown on launch
  if (window.Ads) window.Ads.init().then(syncSettingsUI);

  // test / debug hooks
  window.__nbs = {
    state: S, logic: L, gate: gate, get save() { return save; },
    tap: onBoltTap, startLevel: startLevel, showHint: showHint, addBolt: addBolt, layout: layout
  };
})();
