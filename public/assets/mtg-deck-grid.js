(function () {
  const ROOT = 'https://api.scryfall.com';
  const BATCH = 75;
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  async function fetchCollection(names) {
    const unique = [...new Set(names.filter(Boolean))];
    const map = new Map();
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      const body = {
        identifiers: chunk.map((name) => ({ name: name.replace(/\s*\/\/.*$/, '').trim() })),
      };
      const r = await fetch(ROOT + '/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Scryfall collection ' + r.status);
      const data = await r.json();
      (data.data || []).forEach((c) => {
        const key = (c.name || '').split(' // ')[0].toLowerCase();
        map.set(key, c);
        map.set((c.name || '').toLowerCase(), c);
      });
      await new Promise((res) => setTimeout(res, 120));
    }
    return map;
  }
  function cardImg(card) {
    if (!card) return null;
    if (card.image_uris) return card.image_uris.normal || card.image_uris.small;
    if (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris) {
      return card.card_faces[0].image_uris.normal || card.card_faces[0].image_uris.small;
    }
    return null;
  }
  function countList(list) {
    const counts = new Map();
    list.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
    return [...counts.entries()];
  }
  async function renderHost(host) {
    const src = host.getAttribute('data-mtg-deck');
    if (!src) return;
    host.innerHTML = '<p class="mtg-grid-status">Loading card images…</p>';
    try {
      const deck = await (await fetch(src, { cache: 'no-store' })).json();
      const boards = deck.boards || {};
      const commander = boards.commander || [];
      const main = boards.main || [];
      const side = boards.sideboard || [];
      const allNames = [...commander, ...main, ...side];
      const map = await fetchCollection(allNames);
      host.innerHTML = '';
      const head = el('div', 'mtg-grid-head');
      head.appendChild(el('h2', null, 'Cards in this deck'));
      const meta = el('p', 'mtg-grid-meta');
      meta.textContent =
        (commander.length ? 'Commander + ' : '') +
        main.length +
        ' main' +
        (side.length ? ' · ' + side.length + ' sideboard' : '') +
        ' · images via Scryfall';
      head.appendChild(meta);
      if (deck.source) {
        const a = el('a', 'mtg-grid-source');
        a.href = deck.source;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = deck.source_label || 'Open external decklist';
        head.appendChild(a);
      }
      host.appendChild(head);
      function section(title, names) {
        if (!names.length) return;
        const sec = el('section', 'mtg-grid-section');
        sec.appendChild(el('h3', null, title + ' (' + names.length + ')'));
        const grid = el('div', 'mtg-card-grid');
        countList(names).forEach(([name, qty]) => {
          const key = name.replace(/\s*\/\/.*$/, '').trim().toLowerCase();
          const card = map.get(key) || map.get(name.toLowerCase());
          const fig = el('figure', 'mtg-card');
          const imgUrl = cardImg(card);
          if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = name;
            img.loading = 'lazy';
            img.width = 146;
            img.height = 204;
            fig.appendChild(img);
          } else {
            fig.appendChild(el('div', 'mtg-card-ph', name));
          }
          fig.appendChild(el('figcaption', null, (qty > 1 ? qty + '× ' : '') + name));
          grid.appendChild(fig);
        });
        sec.appendChild(grid);
        host.appendChild(sec);
      }
      section('Commander', commander);
      section('Main deck', main);
      section('Sideboard', side);
      const note = el('p', 'mtg-grid-note');
      note.textContent =
        'Card images © Wizards of the Coast. Data via Scryfall. Listing photos of the physical sleeves may differ from printings shown.';
      host.appendChild(note);
    } catch (e) {
      host.innerHTML = '';
      const p = el('p', 'mtg-grid-status error');
      p.textContent = 'Could not load card grid: ' + (e.message || 'error');
      host.appendChild(p);
    }
  }
  document.querySelectorAll('[data-mtg-deck]').forEach(renderHost);
})();
