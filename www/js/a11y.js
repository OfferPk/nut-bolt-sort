/*
 * Accessibility settings (v1.8): reduce motion, larger text, high contrast.
 * Applies classes on <html>: a11y-reduce, a11y-large, a11y-contrast.
 * Reduce motion is tri-state: unset = follow the OS "remove animations" preference live;
 * true/false = the player's explicit choice. When reduced, every Web Animations API
 * animation is shortened to ~instant.
 */
(function (root) {
  'use strict';
  var KEYS = ['reduceMotion', 'largeText', 'contrast'];
  function osReduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /** fill missing a11y settings (reduceMotion stays unset = follow the OS) */
  function defaults(settings) {
    settings = settings || {};
    if (typeof settings.reduceMotion !== 'boolean') delete settings.reduceMotion;
    if (typeof settings.largeText !== 'boolean') settings.largeText = false;
    if (typeof settings.contrast !== 'boolean') settings.contrast = false;
    return settings;
  }
  var A = { KEYS: KEYS, defaults: defaults, osReduced: osReduced, _mode: undefined };
  /** effective reduce-motion: explicit choice wins, otherwise the OS preference */
  A.effective = function (mode, os) { return mode === true || (mode !== false && !!os); };
  A.reduced = function () { return A.effective(A._mode, osReduced()); };
  /** scale an animation duration (ms) for reduced motion */
  A.ms = function (ms) { return A.reduced() ? Math.min(ms, 40) : ms; };
  A.apply = function (settings) {
    defaults(settings);
    A._mode = settings.reduceMotion;
    if (typeof document === 'undefined') return settings;
    var cl = document.documentElement.classList;
    cl.toggle('a11y-reduce', A.reduced()); cl.toggle('a11y-large', !!settings.largeText); cl.toggle('a11y-contrast', !!settings.contrast);
    return settings;
  };
  /** wire checkbox ids -> setting keys; onChange(key) after persist */
  A.bind = function (settings, persist, ids, onChange) {
    Object.keys(ids).forEach(function (key) {
      var el = document.getElementById(ids[key]); if (!el) return;
      el.checked = key === 'reduceMotion' ? A.reduced() : !!settings[key];
      el.addEventListener('change', function () { settings[key] = !!el.checked; A.apply(settings); persist(); if (onChange) onChange(key); });
    });
  };
  A.sync = function (settings, ids) { A.apply(settings); Object.keys(ids).forEach(function (k) { var el = document.getElementById(ids[k]); if (el) el.checked = k === 'reduceMotion' ? A.reduced() : !!settings[k]; }); };
  if (typeof Element !== 'undefined' && Element.prototype.animate && !Element.prototype.animate.__a11y) {
    var orig = Element.prototype.animate;
    var wrapped = function (frames, opts) {
      if (A.reduced()) {
        if (typeof opts === 'number') opts = 1;
        else opts = Object.assign({}, opts || {}, { duration: 1, delay: 0, iterations: 1 });
      }
      return orig.call(this, frames, opts);
    };
    wrapped.__a11y = true; Element.prototype.animate = wrapped;
  }
  root.A11y = A;
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
