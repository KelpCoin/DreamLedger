(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money = (n,c='NZD') => `${c} ${Number(n||0).toFixed(2)}`;
  const style = document.createElement('style');
  style.textContent = `
    .live-strip{position:sticky;top:68px;z-index:18;background:#0d0f13;border-bottom:1px solid #292e38;overflow:hidden}
    .live-strip-inner{display:flex;gap:10px;align-items:center;min-height:38px;white-space:nowrap;overflow-x:auto;scrollbar-width:none;padding:0 14px}
    .live-strip-inner::-webkit-scrollbar{display:none}.live-badge{font-size:.58rem;font-weight:950;letter-spacing:.16em;color:#e7a7c5;text-transform:uppercase}
    .ticker-item{font-size:.7rem;color:#c9cdd4}.ticker-source{color:#d8b66b;font-weight:800}.ticker-sep{color:#4c535e}
    .live-catalog{padding:16px 0 8px}.live-card{flex:0 0 min(82vw,310px);min-width:min(82vw,310px);scroll-snap-align:start;background:linear-gradient(180deg,#191c23,#111319);border:1px solid #292e38;border-radius:18px;padding:12px}
    .live-card .auction-status{display:inline-flex;padding:5px 8px;border-radius:999px;background:#20252d;color:#d8b66b;font-size:.58rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
    .live-card h3{margin:9px 0 5px;font-size:1.05rem}.live-card p{margin:0 0 10px;color:#9ea3ad;font-size:.76rem}.auction-price{font-size:1.15rem;font-weight:950}.auction-meta{display:flex;justify-content:space-between;gap:8px;margin-top:8px;color:#9ea3ad;font-size:.68rem}
    .bid-box{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:10px}.bid-box input{min-width:0;background:#0b0c10;color:#f7f5f2;border:1px solid #292e38;border-radius:10px;padding:10px}.bid-box button{border:0;border-radius:10px;background:#d8b66b;color:#111;padding:10px 12px;font-weight:900}.bid-box button:disabled{opacity:.5}
  `;
  document.head.appendChild(style);

  function injectTicker(){
    if(document.querySelector('.live-strip')) return;
    const strip=document.createElement('div'); strip.className='live-strip';
    strip.innerHTML='<div class="live-strip-inner"><span class="live-badge">SILO TICKER</span><span id="siloTicker">Loading market intelligence...</span></div>';
    const header=document.querySelector('.topbar');
    if(header) header.after(strip); else document.body.prepend(strip);
    loadNews();
  }
  async function loadNews(){
    const silo='dreamledger';
    try{
      const r=await fetch('/api/news?silo='+encodeURIComponent(silo)); const data=await r.json();
      const el=document.getElementById('siloTicker'); if(!el)return;
      el.innerHTML=(data.items||[]).map((x,i)=>`<span class="ticker-item">${esc(x.headline)} <span class="ticker-source">${esc(x.source)}</span></span>${i<data.items.length-1?'<span class="ticker-sep">•</span>':''}`).join(' ');
    }catch(e){const el=document.getElementById('siloTicker');if(el)el.textContent='Ticker offline';}
  }
  function injectAuctionRail(){
    if(document.getElementById('auction-live-section')) return;
    const section=document.createElement('section'); section.className='catalog live-catalog'; section.id='auction-live-section';
    section.setAttribute('role','region'); section.setAttribute('aria-roledescription','carousel');
    section.innerHTML='<div class="catalog-head"><div><h2>Live Auctions</h2><p>Silo-specific bidding lane. Server-authoritative.</p></div><div class="controls"><button type="button" id="auctionPrev" aria-label="Previous auctions">←</button><button type="button" id="auctionNext" aria-label="Next auctions">→</button></div></div><div id="auctionRail" class="rail" tabindex="0" aria-label="Live auction carousel"></div>';
    const main=document.querySelector('main'); if(main) main.insertBefore(section,main.firstElementChild?.nextElementSibling||main.firstChild); else document.body.appendChild(section);
    document.getElementById('auctionPrev').onclick=()=>document.getElementById('auctionRail').scrollBy({left:-320,behavior:'smooth'});
    document.getElementById('auctionNext').onclick=()=>document.getElementById('auctionRail').scrollBy({left:320,behavior:'smooth'});
    loadAuctions();
  }
  function auctionCard(a){
    const locked=a.approval_required||!a.checkout_available;
    return `<article class="live-card"><span class="auction-status">${locked?'Gated':'Live'}</span><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p><div class="auction-price">${money(a.current_price,a.currency)}</div><div class="auction-meta"><span>${a.bid_count} bids</span><span>Reserve ${a.reserve_met?'met':'not met'}</span></div><div class="auction-meta"><span>Min +${money(a.minimum_increment,a.currency)}</span><span>${new Date(a.ends_at).getFullYear()>2026?'Long window':'Closing soon'}</span></div><div class="bid-box"><input type="number" min="${Number(a.current_price)+Number(a.minimum_increment)}" step="${a.minimum_increment}" placeholder="Your bid" data-bid-input="${esc(a.auction_id)}" ${locked?'disabled':''}><button data-bid="${esc(a.auction_id)}" ${locked?'disabled':''}>${locked?'Approval required':'Bid'}</button></div></article>`;
  }
  async function loadAuctions(){
    try{const r=await fetch('/api/auctions?silo=dreamledger');const data=await r.json();const rail=document.getElementById('auctionRail');if(!rail)return;rail.innerHTML=(data.auctions||[]).length?data.auctions.map(auctionCard).join(''):'<article class="live-card"><span class="auction-status">No live auctions</span><h3>Next drop loading</h3><p>New auctions appear here when approved.</p></article>';
      rail.querySelectorAll('[data-bid]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.bid;const input=rail.querySelector(`[data-bid-input="${CSS.escape(id)}"]`);btn.disabled=true;try{const r=await fetch(`/api/auctions/${encodeURIComponent(id)}/bid`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bidder_id:localStorage.getItem('dreamiez_bidder_id')||'guest',amount:Number(input.value)})});const x=await r.json();if(!r.ok)throw new Error(x.error||'Bid failed');await loadAuctions();}catch(e){alert(e.message);}finally{btn.disabled=false;}}));
    }catch(e){const rail=document.getElementById('auctionRail');if(rail)rail.innerHTML='<article class="live-card"><span class="auction-status">Offline</span><h3>Auction service unavailable</h3><p>Commerce remains operational.</p></article>';}
  }
  injectTicker(); injectAuctionRail();
})();
