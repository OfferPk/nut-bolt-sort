/* Synthesized metallic SFX with WebAudio (no audio files). */
(function () {
  'use strict';
  var ctx = null, master = null, enabled = true;
  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  var noiseBuf = null;
  function noise(c) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // short filtered noise burst = thread "tick"
  function tick(t, freq, vol, dur) {
    var c = ctx, src = c.createBufferSource(); src.buffer = noise(c);
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 8;
    var g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.02);
  }
  // inharmonic partials = metal "ting"
  function ting(t, base, vol, dur) {
    var c = ctx, ratios = [1, 2.76, 5.4, 8.93];
    ratios.forEach(function (r, i) {
      var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base * r;
      var g = c.createGain(); var v = vol / (i + 1.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i * 0.6));
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function thud(t, vol) {
    var c = ctx, o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    var g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
  }
  var S = {
    setEnabled: function (v) { enabled = !!v; },
    unlock: function () { if (enabled) ac(); },
    lift: function (n) {
      if (!enabled || !ac()) return; var t = ctx.currentTime;
      for (var i = 0; i < 4 + (n || 1); i++) tick(t + i * 0.035, 2600 + i * 180, 0.35, 0.03);
    },
    screw: function (n) {
      if (!enabled || !ac()) return; var t = ctx.currentTime;
      for (var i = 0; i < 5; i++) tick(t + i * 0.04, 2200 - i * 150, 0.3, 0.03);
      ting(t + 0.22, 1250, 0.18, 0.25);
    },
    cancel: function () { if (!enabled || !ac()) return; var t = ctx.currentTime; tick(t, 1800, 0.3, 0.05); tick(t + 0.05, 1500, 0.25, 0.05); },
    error: function () { if (!enabled || !ac()) return; thud(ctx.currentTime, 0.5); },
    complete: function () {
      if (!enabled || !ac()) return; var t = ctx.currentTime;
      ting(t, 880, 0.35, 0.9); ting(t + 0.09, 1320, 0.25, 0.9);
    },
    win: function () {
      if (!enabled || !ac()) return; var t = ctx.currentTime;
      [523, 659, 784, 1046, 1318].forEach(function (f, i) { ting(t + i * 0.09, f, 0.3, 1.2); });
    },
    click: function () { if (!enabled || !ac()) return; tick(ctx.currentTime, 3200, 0.25, 0.025); },
    coin: function () { if (!enabled || !ac()) return; var t = ctx.currentTime; ting(t, 1760, 0.2, 0.3); ting(t + 0.07, 2350, 0.18, 0.35); }
  };
  window.SFX = S;
})();
