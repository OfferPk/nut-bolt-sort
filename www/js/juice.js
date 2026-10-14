/* v1.4 win juice: lightweight confetti burst (DOM + WAAPI), skipped for reduced motion. */
(function (root) {
  'use strict';
  function reduced() { if (root.A11y) return root.A11y.reduced(); return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var COLORS = ['#ff4d6d', '#ffd34d', '#4be0a0', '#39f6ff', '#9b7bff', '#ff9f43'];
  function burst(x, y, n) {
    if (typeof document === 'undefined' || reduced()) return 0;
    var host = document.getElementById('app') || document.body;
    x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight * 0.38 : y; n = n || 36;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i'); p.className = 'juice-bit';
      p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;background:' + COLORS[i % COLORS.length] + ';' + (i % 3 === 0 ? 'border-radius:50%;' : '');
      host.appendChild(p);
      var a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 170, dx = Math.cos(a) * v, dy = Math.sin(a) * v - 120;
      var anim = p.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + (dy + 260) + 'px)) rotate(' + (Math.random() * 720 - 360) + 'deg)', opacity: 0 }],
        { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
    return n;
  }
  root.Juice = { burst: burst };
})(typeof window !== 'undefined' ? window : globalThis);
