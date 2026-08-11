(function () {
  'use strict';
  const esc = value => String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const money = (value, currency) => `${String(currency || 'NZD').toUpperCase()} ${Number(value || 0).toFixed(2)}`;
  const root = document.getElementById('public-products');
  const status = document.getElementById('public-status');
  async function load() {
    try {
      const response = await fetch('/api/products', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Catalog unavailable');
      const products = Array.isArray(data.products) ? data.products : [];
      root.innerHTML = products.map(product => {
        const locked = product.approval_required || !product.checkout_available;
        return `<article class="product"><div class="eyebrow">${esc(product.silo)}</div><h3>${esc(product.name)}</h3><p>${esc(product.description)}</p><strong>${money(product.price / 100, product.currency)}</strong><button type="button" data-buy="${esc(product.id)}" ${locked ? 'disabled' : ''}>${locked ? 'Approval required' : 'Checkout'}</button></article>`;
      }).join('') || '<p class="muted">No published products are currently available.</p>';
      root.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Creating checkout...';
        try {
          const product = products.find(item => item.id === button.dataset.buy);
          const checkout = await fetch('/api/checkout/create', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ product_id:product.id, silo:product.silo }) });
          const result = await checkout.json();
          if (!checkout.ok) throw new Error(result.error || 'Checkout unavailable');
          window.location.href = result.checkout_url;
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Checkout';
          status.textContent = error.message;
        }
      }));
      status.textContent = 'Canonical product catalog loaded from the commerce engine.';
    } catch (error) {
      root.innerHTML = '<p class="muted">The commerce catalog is temporarily unavailable.</p>';
      status.textContent = error.message;
    }
  }
  load();
}());
