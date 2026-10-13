/**
 * DreamLedger free ticker — progressive transparency feed.
 * Loads /data/ticker.json, optional silo filter via data-silo or ?silo=
 * Does not invent status. Payment does not change verdicts.
 */
(function () {
  const SCRIPT = document.currentScript;
  const rootId = (SCRIPT && SCRIPT.getAttribute('data-target')) || 'dl-ticker';
  const siloFilter = (SCRIPT && SCRIPT.getAttribute('data-silo')) ||
    new URLSearchParams(location.search).get('silo') || '';
  const maxItems = parseInt((SCRIPT && SCRIPT.getAttribute('data-max')) || '8', 10) || 8;
  const feedUrl = (SCRIPT && SCRIPT.getAttribute('data-feed')) || '/data/ticker.json';

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function mount() {
    let el = document.getElementById(rootId);
    if (!el) {
      el = document.createElement('div');
      el.id = rootId;
      el.className = 'dl-ticker';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.innerHTML = '<div class="dl-ticker-inner"><span class="dl-ticker-label">TICKER</span><span class="dl-ticker-track">Loading free feed…</span></div>';
    if (!document.getElementById('dl-ticker-style')) {
      const style = document.createElement('style');
      style.id = 'dl-ticker-style';
      style.textContent = `
.dl-ticker{border-bottom:1px solid #2a3b51;background:#0b1522;color:#f4f7fb;font:13px/1.4 system-ui,sans-serif}
.dl-ticker-inner{display:flex;align-items:center;gap:12px;width:min(1100px,calc(100% - 24px));margin:auto;padding:8px 0;overflow:hidden}
.dl-ticker-label{flex:0 0 auto;font-size:10px;font-weight:850;letter-spacing:.12em;color:#a9f2d0}
.dl-ticker-track{flex:1;overflow:hidden;white-space:nowrap;mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
.dl-ticker-track a{color:#9ec9ff;text-decoration:none;margin-right:1.5em}
.dl-ticker-track a:hover{text-decoration:underline}
.dl-ticker-status{font-size:10px;font-weight:750;letter-spacing:.04em;border:1px solid #52647a;border-radius:999px;padding:1px 6px;margin-right:6px;color:#b4c0cf}
.dl-ticker-silo{font-size:10px;color:#b4c0cf;margin-right:4px}
.dl-ticker-static .dl-ticker-track{white-space:normal}
.dl-ticker-list{list-style:none;margin:0;padding:0}
.dl-ticker-list li{padding:10px 0;border-bottom:1px solid #2a3b51}
.dl-ticker-list li:last-child{border-bottom:0}
`;
      document.head.appendChild(style);
    }

    fetch(feedUrl, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('feed ' + r.status); return r.json(); })
      .then(data => {
        let items = Array.isArray(data.items) ? data.items : [];
        if (siloFilter) {
          const s = siloFilter.toLowerCase();
          items = items.filter(it => Array.isArray(it.silos) && it.silos.map(x => String(x).toLowerCase()).includes(s));
        }
        items = items.slice(0, maxItems);
        if (!items.length) {
          el.querySelector('.dl-ticker-track').textContent = siloFilter
            ? 'No ticker items for silo “' + siloFilter + '”.'
            : 'No public ticker items yet.';
          return;
        }
        const mode = el.getAttribute('data-mode') || (SCRIPT && SCRIPT.getAttribute('data-mode')) || 'marquee';
        if (mode === 'list') {
          el.classList.add('dl-ticker-static');
          el.innerHTML = '<ul class="dl-ticker-list">' + items.map(it => {
            const href = typeof it.url === 'string' && /^https?:\/\//i.test(it.url) ? it.url : (it.url || '#');
            const silos = Array.isArray(it.silos) ? it.silos.map(s => '<span class="dl-ticker-silo">' + esc(s) + '</span>').join('') : '';
            return '<li><span class="dl-ticker-status">' + esc(it.status || 'UNVERIFIED') + '</span>' +
              silos +
              '<a href="' + esc(href) + '"' + (href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
              esc(it.headline || 'Untitled') + '</a>' +
              '<div style="color:#b4c0cf;font-size:12px;margin-top:4px">' + esc(it.source || '') +
              (it.observed_at ? ' · ' + esc(it.observed_at) : '') + '</div></li>';
          }).join('') + '</ul>';
          return;
        }
        const html = items.map(it => {
          const href = typeof it.url === 'string' ? it.url : '#';
          return '<span class="dl-ticker-status">' + esc(it.status || 'UNVERIFIED') + '</span>' +
            '<a href="' + esc(href) + '">' + esc(it.headline || 'Untitled') + '</a>';
        }).join(' · ');
        el.querySelector('.dl-ticker-track').innerHTML = html + ' · ' + html;
      })
      .catch(() => {
        const t = el.querySelector('.dl-ticker-track');
        if (t) t.textContent = 'Ticker feed unavailable. No claims inferred from missing data.';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
