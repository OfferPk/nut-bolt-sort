/*
 * AdGate: the single place that decides whether an interstitial may be shown.
 * Pure logic (no DOM, no SDK) so it runs in Node tests as well.
 *
 * Rules:
 *  - never before the player has completed INTERSTITIAL_MIN_LEVEL levels
 *    AND accumulated INTERSTITIAL_MIN_PLAY_MS of play time
 *  - afterwards at most one every INTERSTITIAL_EVERY_N_LEVELS completed levels
 *  - and at most one per INTERSTITIAL_MIN_INTERVAL_MS
 *  - it is only ever asked at the Level Complete -> Next transition (see game.js),
 *    never on launch, exit or back press.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AdGate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DEFAULTS = {
    INTERSTITIAL_MIN_LEVEL: 5,
    INTERSTITIAL_MIN_PLAY_MS: 180000,
    INTERSTITIAL_EVERY_N_LEVELS: 3,
    INTERSTITIAL_MIN_INTERVAL_MS: 90000
  };

  function create(cfg, state) {
    var c = {};
    Object.keys(DEFAULTS).forEach(function (k) { c[k] = (cfg && cfg[k] != null) ? cfg[k] : DEFAULTS[k]; });
    var s = state || {};
    if (typeof s.levelsSince !== 'number') s.levelsSince = 0;
    if (typeof s.lastTs !== 'number') s.lastTs = 0;
    if (typeof s.playMs !== 'number') s.playMs = 0;
    if (typeof s.maxCompleted !== 'number') s.maxCompleted = 0;

    return {
      state: s,
      config: c,
      addPlayTime: function (ms) { if (ms > 0 && ms < 60000) s.playMs += ms; },
      levelCompleted: function (level) {
        s.levelsSince++;
        if (level > s.maxCompleted) s.maxCompleted = level;
      },
      /** May an interstitial be shown right now (called only between levels)? */
      canShow: function (now) {
        if (s.maxCompleted < c.INTERSTITIAL_MIN_LEVEL) return false;
        if (s.playMs < c.INTERSTITIAL_MIN_PLAY_MS) return false;
        if (s.levelsSince < c.INTERSTITIAL_EVERY_N_LEVELS) return false;
        if (s.lastTs > now) s.lastTs = now; // clock moved backwards: restart the interval
        if (s.lastTs && now - s.lastTs < c.INTERSTITIAL_MIN_INTERVAL_MS) return false;
        return true;
      },
      shown: function (now) { s.levelsSince = 0; s.lastTs = now; }
    };
  }
  return { create: create, DEFAULTS: DEFAULTS };
});
