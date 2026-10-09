/* DreamLedger shared state + commercial loop.
   Public listings are user-submitted only. Never seed fictional goods, sellers,
   locations, prices, condition claims, or inventory into a public surface. */
(function () {
  const KEY_LISTINGS = 'dl_listings';
  const KEY_STREAK = 'dl_streak';
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isFictionalSeed(listing) {
    return Boolean(listing && (listing.seed === true || /^SEED\d+$/i.test(String(listing.id || ''))));
  }
  window.DL = {
    todayKey,
    getListings() {
      try {
        const stored = JSON.parse(localStorage.getItem(KEY_LISTINGS) || '[]');
        const all = Array.isArray(stored) ? stored : [];
        const verifiedUserSubmitted = all.filter(item => !isFictionalSeed(item));
        if (verifiedUserSubmitted.length !== all.length) {
          localStorage.setItem(KEY_LISTINGS, JSON.stringify(verifiedUserSubmitted));
        }
        return verifiedUserSubmitted;
      } catch {
        return [];
      }
    },
    saveListing(listing) {
      if (!listing || typeof listing !== 'object' || isFictionalSeed(listing)) {
        throw new Error('A listing must be a genuine user submission. Demo inventory is not allowed.');
      }
      const all = this.getListings();
      all.unshift({ ...listing, seed: false });
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
    // Legacy page compatibility: this now returns only genuine user-submitted
    // records and deliberately creates no demo listings.
    ensureSeedListings() {
      return this.getListings();
    },
    formatPrice(n) {
      return 'NZ$' + Number(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
    },
    conditionLabel(c) {
      return ({ new: 'New', 'like-new': 'Like new', good: 'Good', fair: 'Fair', parts: 'For parts' })[c] || c;
    }
  };
})();
