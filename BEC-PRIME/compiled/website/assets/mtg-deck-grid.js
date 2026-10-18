(function () {
  const ROOT = 'https://api.scryfall.com';
  const BATCH = 75;
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  async function fetchCards(names) {
    const unique = [...new Set(names.filter(Boolean))];
    const out = new Map();
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      const body = { identifiers: chunk.map((name) => ({ name })) };
      try {
        const r = await fetch(ROOT + '/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) continue;
        const data = await r.json();
        (data.data || []).forEach((c) => {
          const key = (c.name || '').toLowerCase();
          out.set(key, c);
        });
      } catch (e) {}
    }
    return out;
  }
  function cardImg(c) {
    if (!c) return null;
    if (c.image_uris && c.image_uris.normal) return c.image_uris.normal;
    if (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris)
      return c.card_faces[0].image_uris.normal;
    return null;
  }
  async function render(root) {
    const src = root.getAttribute('data-mtg-deck');
    if (!src) return;
    root.innerHTML = '';
    root.appendChild(el('p', 'mtg-grid-status', 'Loading card faces…'));
    let list;
    try {
      const r = await fetch(src, { cache: 'no-store' });
      if (!r.ok) throw new Error('Decklist unavailable');
      list = await r.json();
    } catch (e) {
      root.innerHTML = '';
      root.appendChild(el('p', 'mtg-grid-status', e.message || 'Failed to load decklist'));
      return;
    }
    const sections = list.sections || [{ title: 'Deck', cards: list.cards || [] }];
    const names = [];
    sections.forEach((s) => (s.cards || []).forEach((c) => names.push(c.name || c)));
    const byName = await fetchCards(names);
    root.innerHTML = '';
    sections.forEach((section) => {
      const wrap = el('div', 'mtg-grid-section');
      wrap.appendChild(el('h3', 'mtg-grid-section-title', section.title || 'Cards'));
      const grid = el('div', 'mtg-grid');
      (section.cards || []).forEach((entry) => {
        const name = entry.name || entry;
        const qty = entry.qty || entry.quantity || 1;
        const c = byName.get(String(name).toLowerCase());
        const img = cardImg(c);
        const cell = el('article', 'mtg-grid-card');
        if (img) {
          const image = el('img', 'mtg-grid-img');
          image.loading = 'lazy';
          image.alt = name;
          image.src = img;
          cell.appendChild(image);
        }
        const meta = el('div', 'mtg-grid-meta');
        meta.appendChild(el('div', 'mtg-grid-name', name));
        if (qty > 1) meta.appendChild(el('div', 'mtg-grid-qty', '×' + qty));
        cell.appendChild(meta);
        grid.appendChild(cell);
      });
      wrap.appendChild(grid);
      root.appendChild(wrap);
    });
  }
  function boot() {
    document.querySelectorAll('[data-mtg-deck]').forEach((node) => {
      render(node);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
