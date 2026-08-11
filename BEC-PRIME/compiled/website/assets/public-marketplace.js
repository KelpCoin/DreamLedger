(function () {
  'use strict';
  const esc = value => String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money = (value, currency) => `${String(currency || 'NZD').toUpperCase()} ${Number(value || 0).toFixed(2)}`;
  const root = document.getElementById('public-products');
  const status = document.getElementById('public-status');
  const activation = document.getElementById('activation-status');
  const auctionRoot = document.getElementById('auctions-grid');
  const newsRoot = document.getElementById('news-grid');
  const liveCount = document.getElementById('live-count');

  function offerCard(offer) {
    const locked = offer.approval_required || !offer.checkout_available;
    const tier = offer.pricing_tier || offer.offer_type || 'offer';
    return `<article class="offer"><div class="tier">${esc(tier)}</div><h3>${esc(offer.name)}</h3><p>${esc(offer.output || offer.problem || '')}</p><div class="price">${money(offer.price, offer.currency)}</div><button class="btn" type="button" data-offer="${esc(offer.offer_id)}" ${locked ? 'disabled' : ''}>${locked ? 'Coming soon' : 'Buy now'}</button></article>`;
  }

  function timeLeft(ms) {
    if (ms <= 0) return 'Ended';
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400), h = Math.floor(total % 86400 / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
    return d ? `${d}d ${h}h left` : `${h}h ${m}m ${s}s left`;
  }

  function auctionCard(a) {
    const left = Number(a.ends_at) - Date.now();
    const canBid = a.checkout_available && a.status !== 'ended' && a.reserve_met;
    return `<article class="auction"><div class="auction-art">${a.silo === 'SILO_MTG' ? '♠' : a.silo === 'dreamiez' ? '✦' : '◆'}</div><div class="auction-body"><span class="tag">Auction</span><h3>${esc(a.title)}</h3><div class="desc">${esc(a.description || 'Limited lot. Bid while the clock is running.')}</div><div class="auction-meta"><div><div class="price">${money(a.current_price, a.currency)}</div><small>${a.bid_count || 0} bids</small></div><div class="ends" data-end="${Number(a.ends_at)}">${timeLeft(left)}</div></div>${canBid ? '<a class="btn hot" style="margin-top:15px;width:100%;text-align:center" href="#" data-bid="'+esc(a.auction_id)+'">View auction</a>' : '<div class="status" style="margin-top:15px">Awaiting approval</div>'}</div></article>`;
  }

  function newsCard(item) {
    return `<article class="news-card"><small>${esc(item.kind || 'update')}</small><h3>${esc(item.headline)}</h3><p>${new Date(item.published_at).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})}</p></article>`;
  }

  async function createCheckout(button, offer) {
    button.disabled = true;
    button.textContent = 'Opening checkout...';
    try {
      const response = await fetch('/api/offer-checkout/create', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({offer_id:offer.offer_id,silo:offer.silo})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Checkout unavailable');
      window.location.href = result.checkout_url;
    } catch (error) { button.disabled = false; button.textContent = 'Buy now'; if (status) status.textContent = error.message; }
  }

  async function loadOffers() {
    if (!root) return;
    try {
      const response = await fetch('/api/offers',{cache:'no-store'}); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Shop unavailable');
      const offers = Array.isArray(data.offers) ? data.offers : [];
      root.innerHTML = offers.length ? offers.map(offerCard).join('') : '<div class="empty">Nothing in the shop yet.</div>';
      root.querySelectorAll('[data-offer]').forEach(button => { const offer=offers.find(x=>x.offer_id===button.dataset.offer); if(offer && !offer.approval_required && offer.checkout_available) button.addEventListener('click',()=>createCheckout(button,offer)); });
      const live=offers.filter(o=>o.checkout_available&&!o.approval_required).length;
      if(status) status.textContent = `${offers.length} products available. ${live} ready to buy.`;
      if(activation) activation.textContent = live ? `${live} item(s) ready to buy.` : 'More products are being prepared.';
    } catch(error) { root.innerHTML='<div class="empty">The shop is temporarily unavailable.</div>'; if(status) status.textContent=error.message; }
  }

  async function loadAuctions() {
    if (!auctionRoot) return;
    try {
      const response=await fetch('/api/auctions',{cache:'no-store'}); const data=await response.json();
      const auctions=Array.isArray(data.auctions)?data.auctions.filter(a=>a.status!=='ended' && Number(a.ends_at)>Date.now()).sort((a,b)=>Number(a.ends_at)-Number(b.ends_at)):[];
      auctionRoot.innerHTML=auctions.length?auctions.slice(0,3).map(auctionCard).join(''):'<div class="empty">No live auctions right now. Check back for the next drop.</div>';
      if(liveCount) liveCount.textContent=`${auctions.length} live auction${auctions.length===1?'':'s'}`;
      setInterval(()=>auctionRoot.querySelectorAll('[data-end]').forEach(el=>{el.textContent=timeLeft(Number(el.dataset.end)-Date.now());}),1000);
    } catch(error) { auctionRoot.innerHTML='<div class="empty">Auction lane is temporarily unavailable.</div>'; }
  }

  async function loadNews() {
    if(!newsRoot) return;
    try {
      const response=await fetch('/api/news?scope=dreamledger',{cache:'no-store'}); const data=await response.json();
      const items=Array.isArray(data.news)?data.news.slice(0,6):[];
      newsRoot.innerHTML=items.length?items.map(newsCard).join(''):'<div class="empty">No news yet.</div>';
    } catch(error) { newsRoot.innerHTML='<div class="empty">News is temporarily unavailable.</div>'; }
  }

  loadOffers(); loadAuctions(); loadNews();
}());
