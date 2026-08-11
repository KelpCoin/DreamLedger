(function () {
  'use strict';
  const esc = value => String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const money = (value, currency) => `${String(currency || 'NZD').toUpperCase()} ${Number(value || 0).toFixed(2)}`;
  const root = document.getElementById('public-products');
  const status = document.getElementById('public-status');
  const activation = document.getElementById('activation-status');

  function offerCard(offer) {
    const locked = offer.approval_required || !offer.checkout_available;
    const tier = offer.pricing_tier || offer.offer_type || 'offer';
    return `<article class="offer"><div class="tier">${esc(offer.silo)} / ${esc(tier)}</div><h3>${esc(offer.name)}</h3><p>${esc(offer.output || offer.problem)}</p><div class="price">${money(offer.price, offer.currency)}</div><button type="button" data-offer="${esc(offer.offer_id)}" ${locked ? 'disabled' : ''}>${locked ? 'Approval required' : 'Checkout'}</button></article>`;
  }

  async function createCheckout(button, offer) {
    button.disabled = true;
    button.textContent = 'Creating checkout...';
    try {
      const response = await fetch('/api/offer-checkout/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offer_id: offer.offer_id, silo: offer.silo })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Checkout unavailable');
      window.location.href = result.checkout_url;
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Checkout';
      status.textContent = error.message;
    }
  }

  async function load() {
    try {
      const response = await fetch('/api/offers', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Offer catalog unavailable');
      const offers = Array.isArray(data.offers) ? data.offers : [];
      root.innerHTML = offers.length
        ? offers.map(offerCard).join('')
        : '<p class="muted">No compiled offers are currently available.</p>';
      root.querySelectorAll('[data-offer]').forEach(button => {
        const offer = offers.find(item => item.offer_id === button.dataset.offer);
        if (offer && !offer.approval_required && offer.checkout_available) {
          button.addEventListener('click', () => createCheckout(button, offer));
        }
      });
      const live = offers.filter(o => o.checkout_available && !o.approval_required).length;
      status.textContent = `${offers.length} canonical offers compiled. ${live} currently activated for checkout.`;
      if (activation) activation.textContent = live > 0
        ? `${live} offer(s) are commercially activated.`
        : 'Checkout activation remains governed by the approval gate.';
    } catch (error) {
      root.innerHTML = '<p class="muted">The commercial catalog is temporarily unavailable.</p>';
      status.textContent = error.message;
    }
  }

  load();
}());
