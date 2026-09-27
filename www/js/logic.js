/*
 * Nut & Bolt Sort - pure game logic (no DOM). Works in the browser (window.NBLogic)
 * and in Node (module.exports). Everything here is deterministic.
 *
 * A board is an array of bolts; a bolt is an array of color ids (0..11),
 * index 0 = bottom nut. All bolts share the same capacity.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NBLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_COLORS = 12;

  // ---------- seeded RNG (mulberry32) ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- rules ----------
  function top(b) { return b.length ? b[b.length - 1] : -1; }
  function topRun(b) {
    if (!b.length) return 0;
    var c = b[b.length - 1], n = 0;
    for (var i = b.length - 1; i >= 0 && b[i] === c; i--) n++;
    return n;
  }
  function isUniform(b) { return b.length > 0 && topRun(b) === b.length; }
  function isComplete(b, cap) { return b.length === cap && isUniform(b); }

  /** Number of nuts that would move from bolt `from` to bolt `to` (0 = illegal). */
  function moveCount(board, from, to, cap) {
    if (from === to) return 0;
    var s = board[from], d = board[to];
    if (!s || !d || !s.length || d.length >= cap) return 0;
    if (d.length && top(d) !== top(s)) return 0;
    return Math.min(topRun(s), cap - d.length);
  }
  function canMove(board, from, to, cap) { return moveCount(board, from, to, cap) > 0; }

  /** Returns a NEW board with the move applied (or null if illegal). */
  function applyMove(board, from, to, cap) {
    var n = moveCount(board, from, to, cap);
    if (!n) return null;
    var nb = board.map(function (b) { return b.slice(); });
    for (var k = 0; k < n; k++) nb[to].push(nb[from].pop());
    return nb;
  }

  function isSolved(board, cap) {
    for (var i = 0; i < board.length; i++) {
      var b = board[i];
      if (b.length && !isComplete(b, cap)) return false;
    }
    return true;
  }

  /** All legal moves [from,to] that could matter (used for "stuck" detection). */
  function legalMoves(board, cap) {
    var out = [];
    for (var i = 0; i < board.length; i++) for (var j = 0; j < board.length; j++) {
      if (moveCount(board, i, j, cap)) out.push([i, j]);
    }
    return out;
  }
  /** True if there is at least one move that is not pure shuffling of a uniform bolt into an empty one. */
  function hasUsefulMove(board, cap) {
    for (var i = 0; i < board.length; i++) {
      var s = board[i];
      if (!s.length || isComplete(s, cap)) continue;
      for (var j = 0; j < board.length; j++) {
        if (!moveCount(board, i, j, cap)) continue;
        if (!board[j].length && isUniform(s)) continue;
        return true;
      }
    }
    return false;
  }

  // ---------- solver (weighted A* with canonical hashing, DFS fallback) ----------
  function key(board) {
    var parts = new Array(board.length);
    for (var i = 0; i < board.length; i++) parts[i] = board[i].join(',');
    parts.sort();
    return parts.join('|');
  }

  // Lower-bound-ish estimate of the moves still needed.
  function heuristic(board, cap) {
    var h = 0, baseSeen = {};
    for (var i = 0; i < board.length; i++) {
      var b = board[i];
      if (!b.length) continue;
      var j = 1;
      while (j < b.length && b[j] === b[0]) j++;
      // every color change above the bottom run needs at least one move
      for (var k = j; k < b.length; k++) if (k === j || b[k] !== b[k - 1]) h++;
      if (baseSeen[b[0]]) h++; else baseSeen[b[0]] = 1;
    }
    return h;
  }

  function successors(board, cap) {
    var out = [], emptyUsed = false, firstEmpty = -1;
    for (var e = 0; e < board.length; e++) if (!board[e].length) { firstEmpty = e; break; }
    for (var i = 0; i < board.length; i++) {
      var s = board[i];
      if (!s.length || isComplete(s, cap)) continue;
      var c = s[s.length - 1], run = topRun(s), uni = run === s.length;
      for (var j = 0; j < board.length; j++) {
        if (i === j) continue;
        var d = board[j];
        if (!d.length) {
          if (uni || j !== firstEmpty) continue; // symmetric / pointless
        } else if (d.length >= cap || d[d.length - 1] !== c) continue;
        out.push([i, j]);
      }
    }
    return out;
  }

  // Binary heap keyed on f
  function Heap() { this.a = []; }
  Heap.prototype.push = function (x) {
    var a = this.a; a.push(x); var i = a.length - 1;
    while (i > 0) { var p = (i - 1) >> 1; if (a[p].f <= x.f) break; a[i] = a[p]; i = p; }
    a[i] = x;
  };
  Heap.prototype.pop = function () {
    var a = this.a, r = a[0], last = a.pop();
    if (a.length) {
      var i = 0, n = a.length;
      for (;;) {
        var l = 2 * i + 1, m = l + 1, s = i, sf = last.f;
        if (l < n && a[l].f < sf) { s = l; sf = a[l].f; }
        if (m < n && a[m].f < sf) { s = m; }
        if (s === i) break;
        a[i] = a[s]; i = s;
      }
      a[i] = last;
    }
    return r;
  };
  Heap.prototype.size = function () { return this.a.length; };

  /**
   * Solve a board. Returns an array of moves [[from,to],...] (empty if already solved)
   * or null if no solution was found within the node limit.
   */
  function solve(board, cap, opts) {
    opts = opts || {};
    var limit = opts.nodeLimit || 200000;
    var w = opts.weight || 2;
    if (isSolved(board, cap)) return [];
    var start = board.map(function (b) { return b.slice(); });
    var seen = new Map();
    var heap = new Heap(), seq = 0;
    var root = { b: start, g: 0, f: w * heuristic(start, cap), p: null, m: null, s: seq++ };
    heap.push(root);
    seen.set(key(start), 0);
    var expanded = 0;
    while (heap.size()) {
      var node = heap.pop();
      if (++expanded > limit) break;
      var moves = successors(node.b, cap);
      for (var k = 0; k < moves.length; k++) {
        var nb = applyMove(node.b, moves[k][0], moves[k][1], cap);
        var kk = key(nb), g = node.g + 1;
        var prev = seen.get(kk);
        if (prev !== undefined && prev <= g) continue;
        seen.set(kk, g);
        var child = { b: nb, g: g, f: g + w * heuristic(nb, cap), p: node, m: moves[k] };
        if (isSolved(nb, cap)) {
          var path = [];
          for (var n = child; n.p; n = n.p) path.push(n.m);
          return path.reverse();
        }
        heap.push(child);
      }
    }
    if (opts.noFallback) return null;
    return solveDFS(start, cap, opts.dfsLimit || 400000);
  }

  function solveDFS(board, cap, limit) {
    var seen = new Set(), path = [], nodes = 0, found = false;
    function rec(b) {
      if (isSolved(b, cap)) { found = true; return true; }
      if (++nodes > limit) return false;
      var k = key(b);
      if (seen.has(k)) return false;
      seen.add(k);
      var moves = successors(b, cap);
      // try moves that build on a uniform stack first
      moves.sort(function (x, y) { return score(b, y) - score(b, x); });
      for (var i = 0; i < moves.length; i++) {
        var nb = applyMove(b, moves[i][0], moves[i][1], cap);
        path.push(moves[i]);
        if (rec(nb)) return true;
        path.pop();
        if (nodes > limit) return false;
      }
      return false;
    }
    function score(b, m) {
      var d = b[m[1]], s = b[m[0]];
      var v = 0;
      if (d.length && isUniform(d)) v += 10 + d.length;
      if (topRun(s) === s.length) v -= 5;
      return v;
    }
    rec(board);
    return found ? path : null;
  }

  /** Next move from the current board (for hints) or null. */
  function hint(board, cap, opts) {
    var sol = solve(board, cap, opts);
    return sol && sol.length ? sol[0] : null;
  }

  // ---------- level generation ----------
  /** Difficulty parameters for a level number (1-based). */
  function levelParams(level) {
    level = Math.max(1, level | 0);
    var colors = Math.min(MAX_COLORS, 3 + Math.floor((level - 1) / 4));
    // a gentler "breather" level every 10 levels after the ramp starts
    if (level > 10 && level % 10 === 5) colors = Math.max(4, colors - 2);
    var capacity = 4;
    if (level >= 60 && level % 3 === 0) { capacity = 5; colors = Math.min(colors, 10); }
    var empty = 2;
    // from level 25, every 4th level has only one empty bolt (the "+1 bolt" booster shines here)
    if (level >= 25 && level % 4 === 0 && capacity === 4) { empty = 1; colors = Math.min(colors, 7); }
    // max number of vertically adjacent same-color pairs allowed (lower = more mixed)
    var maxPairs = level <= 2 ? 6 : level <= 10 ? 3 : level <= 30 ? 2 : 1;
    return { level: level, colors: colors, capacity: capacity, empty: empty, maxPairs: maxPairs };
  }

  function countPairs(board) {
    var n = 0;
    board.forEach(function (b) { for (var i = 1; i < b.length; i++) if (b[i] === b[i - 1]) n++; });
    return n;
  }

  // Deterministic color order per level so palettes vary between levels.
  function paletteFor(level, colors) {
    var ids = []; for (var i = 0; i < MAX_COLORS; i++) ids.push(i);
    var r = rng(level * 2654435761 + 17);
    for (var j = ids.length - 1; j > 0; j--) { var k = Math.floor(r() * (j + 1)); var t = ids[j]; ids[j] = ids[k]; ids[k] = t; }
    return ids.slice(0, colors);
  }

  /**
   * Generate level `level`. Returns { level, capacity, colors, bolts, solution, attempts }.
   * The result is verified solvable (solution replays to a solved board).
   */
  function generateLevel(level, opts) {
    opts = opts || {};
    var p = levelParams(level);
    var C = p.capacity, K = p.colors;
    var pal = paletteFor(p.level, K);
    var minMoves = Math.floor(K * 1.2);
    for (var attempt = 0; attempt < 400; attempt++) {
      var r = rng((p.level * 7919 + attempt * 104729) ^ 0x5bd1e995);
      var nuts = [];
      for (var c = 0; c < K; c++) for (var q = 0; q < C; q++) nuts.push(pal[c]);
      for (var i = nuts.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = nuts[i]; nuts[i] = nuts[j]; nuts[j] = t; }
      var bolts = [];
      for (var b = 0; b < K; b++) bolts.push(nuts.slice(b * C, b * C + C));
      for (var e = 0; e < p.empty; e++) bolts.push([]);
      if (bolts.some(function (x) { return isComplete(x, C); })) continue;
      var relax = attempt >= 250 ? 2 : attempt >= 120 ? 1 : 0;
      if (countPairs(bolts) > p.maxPairs + relax) continue;
      var sol = solve(bolts, C, { nodeLimit: opts.nodeLimit || 60000, noFallback: true });
      if (!sol) continue;
      if (sol.length < minMoves && attempt < 300) continue;
      return { level: p.level, capacity: C, colors: K, bolts: bolts, solution: sol, attempts: attempt + 1 };
    }
    throw new Error('could not generate level ' + level);
  }

  /** Replays a move list; returns true if it ends solved with all moves legal. */
  function verifySolution(board, cap, moves) {
    var b = board;
    for (var i = 0; i < moves.length; i++) {
      b = applyMove(b, moves[i][0], moves[i][1], cap);
      if (!b) return false;
    }
    return isSolved(b, cap);
  }

  function dailySeed(date) {
    var d = date || new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  return {
    MAX_COLORS: MAX_COLORS, rng: rng, top: top, topRun: topRun, isUniform: isUniform, isComplete: isComplete,
    moveCount: moveCount, canMove: canMove, applyMove: applyMove, isSolved: isSolved, legalMoves: legalMoves,
    hasUsefulMove: hasUsefulMove, key: key, heuristic: heuristic, solve: solve, solveDFS: solveDFS, hint: hint,
    levelParams: levelParams, generateLevel: generateLevel, verifySolution: verifySolution, countPairs: countPairs,
    dailySeed: dailySeed
  };
});
