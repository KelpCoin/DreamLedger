/* DreamLedger shared state + commercial loop */
(function () {
  const KEY_LISTINGS = 'dl_listings';
  const KEY_STREAK = 'dl_streak';

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.DL = {
    todayKey,

    getListings() {
      try { return JSON.parse(localStorage.getItem(KEY_LISTINGS) || '[]'); }
      catch { return []; }
    },

    saveListing(listing) {
      const all = this.getListings();
      all.unshift(listing);
      localStorage.setItem(KEY_LISTINGS, JSON.stringify(all));
      return listing;
    },

    getStreakState() {
      try { return JSON.parse(localStorage.getItem(KEY_STREAK) || '{}'); }
      catch { return {}; }
    },

    saveStreakState(s) {
      localStorage.setItem(KEY_STREAK, JSON.stringify(s));
    },

    ensureSeedListings() {
      const existing = this.getListings();
      if (existing.length > 0) return existing;
      const seed = [
        {
          id: 'SEED1',
          title: 'Icebreaker merino hoodie · M',
          category: 'clothing',
          price: 89,
          condition: 'good',
          location: 'Wellington',
          description: 'Soft, no holes. Worn two seasons. Smoke-free home.',
          photos: 0,
          fee: 0,
          status: 'live',
          createdAt: new Date().toISOString(),
          seed: true,
        },
        {
          id: 'SEED2',
          title: 'DeWalt 18V drill + 2 batteries',
          category: 'electronics',
          price: 120,
          condition: 'good',
          location: 'Auckland',
          description: 'Works perfectly. Includes charger and case.',
          photos: 0,
          fee: 0,
          status: 'live',
          createdAt: new Date().toISOString(),
          seed: true,
        },
        {
          id: 'SEED3',
          title: 'Commander precon · upgraded',
          category: 'mtg',
          price: 75,
          condition: 'like-new',
          location: 'Christchurch',
          description: 'Light upgrades, sleeved. List available on request.',
          photos: 0,
          fee: 0,
          status: 'live',
          createdAt: new Date().toISOString(),
          seed: true,
        },
      ];
      localStorage.setItem(KEY_LISTINGS, JSON.stringify(seed));
      return seed;
    },

    formatPrice(n) {
      return 'NZ$' + Number(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
    },

    conditionLabel(c) {
      return ({ new: 'New', 'like-new': 'Like new', good: 'Good', fair: 'Fair', parts: 'For parts' })[c] || c;
    },
  };
})();
