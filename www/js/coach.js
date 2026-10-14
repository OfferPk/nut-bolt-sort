/*
 * First-level coach marks (onboarding). Shown once, skippable, re-openable from Settings.
 *   Coach.run(key, steps, opts)  steps: [{ target: '#id' | null, text: '...' }]
 *   CoachLogic.shouldShow(storage, key) / markSeen
 */
(function (root) {
  'use strict';
  function shouldShow(store, key) { try { return store.getItem(key) !== '1'; } catch (e) { return false; } }
  function markSeen(store, key) { try { store.setItem(key, '1'); } catch (e) {} }
  function reset(store, key) { try { store.removeItem(key); } catch (e) {} }
  var Logic = { shouldShow: shouldShow, markSeen: markSeen, reset: reset };
  root.CoachLogic = Logic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  if (typeof document === 'undefined') return;

  var active = null;
  function run(key, steps, o) {
    o = o || {};
    if (active || (!o.force && !shouldShow(localStorage, key))) return false;
    var i = 0, wrap = document.createElement('div');
    wrap.className = 'coach'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = '<div class="coach-ring"></div><div class="coach-tip"><p></p><div class="coach-row"><button class="coach-skip" type="button">Skip</button><span class="coach-dots"></span><button class="coach-next" type="button">Next</button></div></div>';
    (document.getElementById('app') || document.body).appendChild(wrap);
    active = wrap;
    var ring = wrap.querySelector('.coach-ring'), tip = wrap.querySelector('.coach-tip');
    function place() {
      var st = steps[i], el = st.target && document.querySelector(st.target), vh = window.innerHeight, vw = window.innerWidth;
      tip.querySelector('p').textContent = st.text;
      wrap.querySelector('.coach-dots').textContent = (i + 1) + ' / ' + steps.length;
      wrap.querySelector('.coach-next').textContent = i === steps.length - 1 ? 'Got it' : 'Next';
      if (el) {
        var r = el.getBoundingClientRect(), pad = 6;
        ring.style.display = 'block';
        ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px';
        ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
        var below = r.bottom + 14, above = r.top - 14;
        tip.style.left = Math.max(12, Math.min(vw - 12 - Math.min(320, vw - 24), r.left + r.width / 2 - 160)) + 'px';
        if (vh - below > 150) { tip.style.top = below + 'px'; tip.style.bottom = 'auto'; }
        else if (above > 150) { tip.style.top = 'auto'; tip.style.bottom = (vh - above) + 'px'; }
        else { tip.style.top = 'auto'; tip.style.bottom = '24px'; }
      } else {
        ring.style.display = 'none'; tip.style.left = Math.max(12, (vw - Math.min(320, vw - 24)) / 2) + 'px'; tip.style.top = '40%'; tip.style.bottom = 'auto';
      }
      tip.classList.remove('pop'); void tip.offsetWidth; tip.classList.add('pop');
    }
    function done() {
      markSeen(localStorage, key); window.removeEventListener('resize', place);
      wrap.remove(); active = null; if (o.onDone) o.onDone();
    }
    wrap.querySelector('.coach-next').addEventListener('click', function () { if (o.sfx) o.sfx(); if (++i >= steps.length) done(); else place(); });
    wrap.querySelector('.coach-skip').addEventListener('click', function () { if (o.sfx) o.sfx(); done(); });
    window.addEventListener('resize', place);
    setTimeout(place, 30);
    return true;
  }
  root.Coach = { run: run, get active() { return !!active; } };
})(typeof window !== 'undefined' ? window : globalThis);
