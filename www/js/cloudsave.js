/*
 * Play Games cloud save SCAFFOLDING. OFF by default (CLOUD_CONFIG.ENABLED = false).
 * Snapshots the game's own localStorage keys (progress, coins, achievements, purchases, daily state)
 * into one JSON blob. A native bridge is required to talk to Play Games Services Saved Games;
 * see SETUP_PLAY_GAMES.md. Nothing here runs unless the flag is turned on.
 */
(function (root) {
  'use strict';
  var VERSION = 1;
  function collect(keys, store, now) {
    var data = {};
    keys.forEach(function (k) { var v = store.getItem(k); if (v != null) data[k] = v; });
    return { v: VERSION, at: now, data: data };
  }
  function valid(snap) {
    return !!(snap && snap.v === VERSION && typeof snap.at === 'number' && snap.data && typeof snap.data === 'object');
  }
  /** Conflict rule: the newer snapshot wins as a whole (no partial merges that could duplicate coins). */
  function pick(local, remote) {
    if (!valid(remote)) return 'local';
    if (!valid(local)) return 'remote';
    return remote.at > local.at ? 'remote' : 'local';
  }
  function apply(snap, keys, store) {
    if (!valid(snap)) return 0;
    var n = 0;
    keys.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(snap.data, k) && typeof snap.data[k] === 'string') { store.setItem(k, snap.data[k]); n++; }
    });
    return n; // only whitelisted keys are ever written
  }
  var Logic = { VERSION: VERSION, collect: collect, valid: valid, pick: pick, apply: apply };
  root.CloudLogic = Logic;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  if (typeof document === 'undefined') return;

  function cfg() { return root.CLOUD_CONFIG || { ENABLED: false }; }
  function bridge() { return root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins[cfg().PLUGIN_NAME || 'PlayGamesSaves']; }
  function enabled() { return !!cfg().ENABLED && !!bridge(); }
  /** Expected bridge API (to be provided natively, see SETUP_PLAY_GAMES.md):
   *  signIn() -> {signedIn}, save({name, json, description}) -> {}, load({name}) -> {json|null} */
  async function save(keys) {
    if (!enabled()) return { ok: false, reason: 'disabled' };
    var snap = collect(keys, localStorage, Date.now());
    await bridge().signIn();
    await bridge().save({ name: cfg().SNAPSHOT_NAME, json: JSON.stringify(snap), description: 'Progress backup' });
    try { localStorage.setItem(cfg().SNAPSHOT_NAME + '.localAt', String(snap.at)); } catch (e) {}
    return { ok: true, at: snap.at };
  }
  async function restore(keys) {
    if (!enabled()) return { ok: false, reason: 'disabled' };
    await bridge().signIn();
    var res = await bridge().load({ name: cfg().SNAPSHOT_NAME });
    var remote = null; try { remote = res && res.json ? JSON.parse(res.json) : null; } catch (e) {}
    var localAt = +(localStorage.getItem(cfg().SNAPSHOT_NAME + '.localAt') || 0);
    if (pick({ v: VERSION, at: localAt, data: {} }, remote) !== 'remote') return { ok: true, applied: 0 };
    return { ok: true, applied: apply(remote, keys, localStorage) };
  }
  root.CloudSave = { enabled: enabled, save: save, restore: restore };
})(typeof window !== 'undefined' ? window : globalThis);
