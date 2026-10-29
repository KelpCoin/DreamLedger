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
  var VERIFIED_OWNED = [];
  var VERIFIED_LOADED = false;

  /** Catalog: impulse tier NZ$2–5. Dual surface metadata. */
  var COSMETIC_CATALOG = [
    {
      id: 'neon-shades',
      name: 'Neon Shades',
      price_nzd: 2,
      slot: 'face',
      tier: 'impulse',
      web: { className: 'cos-shades', color: '#39ff14' },
    },
    {
      id: 'ember-scarf',
      name: 'Ember Scarf',
      price_nzd: 3,
      slot: 'neck',
      tier: 'impulse',
      web: { className: 'cos-scarf', color: '#e85d04' },
    },
    {
      id: 'kelp-hoodie',
      name: 'Kelp Hoodie',
      price_nzd: 4,
      slot: 'body',
      tier: 'impulse',
      web: { className: 'cos-hoodie', color: '#1b4332' },
    },
    {
      id: 'star-bun',
      name: 'Star Bun',
      price_nzd: 3,
      slot: 'hair',
      tier: 'impulse',
      web: { className: 'hair-bun', color: '#c9a227' },
    },
    {
      id: 'violet-fringe',
      name: 'Violet Fringe',
      price_nzd: 3,
      slot: 'hair',
      tier: 'impulse',
      web: { className: 'hair-fringe', color: '#7b2cbf' },
    },
    {
      id: 'chrome-boots',
      name: 'Chrome Boots',
      price_nzd: 5,
      slot: 'feet',
      tier: 'impulse',
      web: { className: 'cos-boots', color: '#c0c0c0' },
    },
    {
      id: 'founder-cloak',
      name: 'Founder Cloak',
      price_nzd: 5,
      slot: 'back',
      tier: 'impulse',
      web: { className: 'cos-cloak', color: '#c9a04a' },
    },
    {
      id: 'dragon-mark',
      name: 'Dragon Mark',
      price_nzd: 4,
      slot: 'face',
      tier: 'impulse',
      web: { className: 'cos-mark', color: '#e63946' },
    }
  ];

  COSMETIC_CATALOG.forEach(function(item) {
    item.item_id = item.id;
    item.visual = { thumbnail_ref:null };
    item.rarity = 'common';
    item.consuming_systems = { avatar:{
      compatible:true, cosmetic_slot:item.slot, display_priority:0, web:item.web
    } };
  });
  function toAvatarEquip(item) {
    var av = item && item.consuming_systems && item.consuming_systems.avatar;
    if (!av || av.compatible!==true || !av.cosmetic_slot) return null;
    return {id:item.item_id,item_id:item.item_id,name:item.name,slot:av.cosmetic_slot,
      web:av.web||null,visual:item.visual||null,rarity:item.rarity,priority:av.display_priority||0};
  }
  function verified(state) {
    state.owned = VERIFIED_LOADED ? VERIFIED_OWNED.slice() : [];
    if(!state.equipped || typeof state.equipped!=='object')state.equipped={};
    Object.keys(state.equipped).forEach(function(slot) {
      if(VERIFIED_OWNED.indexOf(state.equipped[slot])===-1)state.equipped[slot]=null;
    });
    return state;
  }
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
      if (!raw) return verified(defaultState());
      var s = JSON.parse(raw);
      var d = defaultState();
      Object.keys(d).forEach(function (k) {
        if (s[k] !== undefined) d[k] = s[k];
      });
      if (!d.equipped || typeof d.equipped !== 'object') d.equipped = defaultState().equipped;
      return verified(d);
    } catch (e) {
      return verified(defaultState());
    }
  }

  function save(state) {
    state = state || load();
    state.updated_at = new Date().toISOString();
    var stored = Object.assign({},state,{owned:[]});
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    var current=load();
    try { global.dispatchEvent(new CustomEvent('dreamledger:avatar-updated',{detail:current})); }
    catch(e){}
    return current;
  }

  function getCosmetic(id) {
    for (var i = 0; i < COSMETIC_CATALOG.length; i++) {
      if (COSMETIC_CATALOG[i].id === id) return toAvatarEquip(COSMETIC_CATALOG[i]);
    }
    return null;
  }

  // Deprecated: a browser cannot grant a purchased entitlement.
  function own(id) { return load(); }
  async function refreshEntitlements() {
    VERIFIED_OWNED = []; VERIFIED_LOADED = false;
    try {
      var result=await global.fetch('/api/dreammeez/entitlements',{
        method:'GET',credentials:'same-origin',cache:'no-store'
      });
      if(!result.ok)throw Error('ENTITLEMENTS_NOT_AVAILABLE');
      var payload=await result.json();
      if(!payload || payload.verified_source!=='server' || !Array.isArray(payload.owned))
        throw Error('ENTITLEMENTS_INVALID');
      VERIFIED_OWNED = [...new Set(payload.owned.filter(function(id){
        return typeof id==='string' && !!getCosmetic(id);
      }))];
      VERIFIED_LOADED = true;
    } catch(e) { VERIFIED_OWNED=[]; }
    var current=load();
    try{global.dispatchEvent(new CustomEvent('dreamledger:avatar-updated',{detail:current}));}
    catch(e){}
    return current;
  }

  function equip(id) {
    var item = getCosmetic(id);
    if (!item) return load();
    var s = load();
    if (!VERIFIED_LOADED || VERIFIED_OWNED.indexOf(id) === -1) return s;
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
      // Client payload is a preview, never game entitlement proof.
      if(VERIFIED_LOADED && VERIFIED_OWNED.indexOf(id)!==-1)
        equipped.push({id:item.id,slot:item.slot,name:item.name,web:item.web});
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
      buffs: [],
      owned: VERIFIED_LOADED ? VERIFIED_OWNED.slice() : [],
      gameplay_authoritative: false,
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
          buff: null
        };
      }),
      active_buffs: [],
      gameplay_authoritative: false,
      body: payload.body
    };
  }

  global.DreamLedgerAvatar = {
    STORAGE_KEY: STORAGE_KEY,
    COSMETIC_CATALOG: COSMETIC_CATALOG,
    load: load,
    save: save,
    own: own,
    toAvatarEquip: toAvatarEquip,
    refreshEntitlements: refreshEntitlements,
    equip: equip,
    unequip: unequip,
    getCosmetic: getCosmetic,
    exportForSurface: exportForSurface,
    toPhinhavenLoadout: toPhinhavenLoadout,
    ALLOWED_SURFACES: ALLOWED_SURFACES
  };
})(typeof window !== 'undefined' ? window : globalThis);
