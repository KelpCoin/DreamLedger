/**
 * DreamLedger portable avatar identity
 * Follows the user across website surfaces and into Phinhaven.
 * Cosmetics carry dual effects: web (visual) + game (buff).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'dreamledger_avatar_identity_v1';
  var UNLOCKS_KEY = 'dreammeez_unlocks_v1';
  var STREAK_KEY = 'dreammeez_streak_v1';

  var ALLOWED_SURFACES = ['web', 'phinhaven', 'dreammeez'];

  /** Catalog: impulse tier NZ$2–5. Dual surface metadata. */
  var COSMETIC_CATALOG = [
    {
      id: 'neon-shades',
      name: 'Neon Shades',
      price_nzd: 2,
      slot: 'face',
      tier: 'impulse',
      web: { className: 'cos-shades', color: '#39ff14' },
      phinhaven: { buff: 'perception', magnitude: 1, label: '+1 Perception in Shallows' }
    },
    {
      id: 'ember-scarf',
      name: 'Ember Scarf',
      price_nzd: 3,
      slot: 'neck',
      tier: 'impulse',
      web: { className: 'cos-scarf', color: '#e85d04' },
      phinhaven: { buff: 'warmth', magnitude: 1, label: 'Resist chill on Floor 1' }
    },
    {
      id: 'kelp-hoodie',
      name: 'Kelp Hoodie',
      price_nzd: 4,
      slot: 'body',
      tier: 'impulse',
      web: { className: 'cos-hoodie', color: '#1b4332' },
      phinhaven: { buff: 'carry', magnitude: 1, label: '+1 inventory slot (cosmetic tier)' }
    },
    {
      id: 'star-bun',
      name: 'Star Bun',
      price_nzd: 3,
      slot: 'hair',
      tier: 'impulse',
      web: { className: 'hair-bun', color: '#c9a227' },
      phinhaven: { buff: 'luck', magnitude: 1, label: '+1 rare drop luck (display)' }
    },
    {
      id: 'violet-fringe',
      name: 'Violet Fringe',
      price_nzd: 3,
      slot: 'hair',
      tier: 'impulse',
      web: { className: 'hair-fringe', color: '#7b2cbf' },
      phinhaven: { buff: 'focus', magnitude: 1, label: '+1 focus on puzzles' }
    },
    {
      id: 'chrome-boots',
      name: 'Chrome Boots',
      price_nzd: 5,
      slot: 'feet',
      tier: 'impulse',
      web: { className: 'cos-boots', color: '#c0c0c0' },
      phinhaven: { buff: 'speed', magnitude: 1, label: '+1 move speed (cosmetic)' }
    },
    {
      id: 'founder-cloak',
      name: 'Founder Cloak',
      price_nzd: 5,
      slot: 'back',
      tier: 'impulse',
      web: { className: 'cos-cloak', color: '#c9a04a' },
      phinhaven: { buff: 'presence', magnitude: 1, label: 'Nameplate glow in Phinhaven' }
    },
    {
      id: 'dragon-mark',
      name: 'Dragon Mark',
      price_nzd: 4,
      slot: 'face',
      tier: 'impulse',
      web: { className: 'cos-mark', color: '#e63946' },
      phinhaven: { buff: 'threat', magnitude: 1, label: 'Cosmetic threat aura' }
    }
  ];

  function defaultState() {
    return {
      schema: 'dreamledger-avatar-identity-v1',
      display_name: '',
      height: 5,
      build: 4,
      shape: 1,
      skin: 3,
      style: 'medium',
      hair: 0,
      equipped: { face: null, neck: null, body: null, hair: null, feet: null, back: null },
      owned: [],
      updated_at: null
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      var d = defaultState();
      Object.keys(d).forEach(function (k) {
        if (s[k] !== undefined) d[k] = s[k];
      });
      if (!d.equipped || typeof d.equipped !== 'object') d.equipped = defaultState().equipped;
      if (!Array.isArray(d.owned)) d.owned = [];
      return d;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    state = state || load();
    state.updated_at = new Date().toISOString();
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try {
      global.dispatchEvent(new CustomEvent('dreamledger:avatar-updated', { detail: state }));
    } catch (e) {}
    return state;
  }

  function getCosmetic(id) {
    for (var i = 0; i < COSMETIC_CATALOG.length; i++) {
      if (COSMETIC_CATALOG[i].id === id) return COSMETIC_CATALOG[i];
    }
    return null;
  }

  function own(id) {
    var s = load();
    if (s.owned.indexOf(id) === -1) s.owned.push(id);
    return save(s);
  }

  function equip(id) {
    var item = getCosmetic(id);
    if (!item) return load();
    var s = load();
    if (s.owned.indexOf(id) === -1) return s;
    s.equipped[item.slot] = id;
    // hair cosmetics also set style/color when equipped
    if (item.slot === 'hair' && item.web) {
      if (item.web.className && item.web.className.indexOf('hair-') === 0) {
        s.style = item.web.className.replace('hair-', '');
      }
    }
    return save(s);
  }

  function unequip(slot) {
    var s = load();
    if (s.equipped && slot in s.equipped) s.equipped[slot] = null;
    return save(s);
  }

  /** Payload for Phinhaven / other surfaces */
  function exportForSurface(surface) {
    surface = surface || 'web';
    var s = load();
    var equipped = [];
    var buffs = [];
    Object.keys(s.equipped || {}).forEach(function (slot) {
      var id = s.equipped[slot];
      if (!id) return;
      var item = getCosmetic(id);
      if (!item) return;
      equipped.push({
        id: item.id,
        slot: item.slot,
        name: item.name,
        web: item.web,
        phinhaven: null,
        preview_only: true,
        entitlement_verified: false
      });
      // No trusted server-side ownership receipt exists in localStorage. Never promote cosmetic previews into gameplay buffs.
    });
    return {
      schema: 'dreamledger-avatar-surface-v1',
      surface: surface,
      display_name: s.display_name || 'Traveler',
      body: {
        height: s.height,
        build: s.build,
        shape: s.shape,
        skin: s.skin,
        style: s.style,
        hair: s.hair
      },
      equipped: equipped,
      buffs: buffs,
      owned: [],
      local_previews: s.owned.slice(),
      entitlements_verified: false,
      updated_at: s.updated_at
    };
  }

  /** Adapter: map web cosmetic ids into Phinhaven loadout rows */
  function toPhinhavenLoadout() {
    var payload = exportForSurface('phinhaven');
    return {
      avatar_link: {
        name: payload.display_name,
        source: 'dreamledger_avatar_identity_v1'
      },
      cosmetics: payload.equipped.map(function (e) {
        return {
          sku: e.id,
          slot: e.slot,
          visual: e.web,
          buff: null,
          entitlement_verified: false,
          preview_only: true
        };
      }),
      active_buffs: [],
      entitlement_verified: false,
      preview_only: true,
      body: payload.body
    };
  }

  global.DreamLedgerAvatar = {
    STORAGE_KEY: STORAGE_KEY,
    COSMETIC_CATALOG: COSMETIC_CATALOG,
    load: load,
    save: save,
    own: own,
    equip: equip,
    unequip: unequip,
    getCosmetic: getCosmetic,
    exportForSurface: exportForSurface,
    toPhinhavenLoadout: toPhinhavenLoadout,
    ALLOWED_SURFACES: ALLOWED_SURFACES
  };
})(typeof window !== 'undefined' ? window : globalThis);
