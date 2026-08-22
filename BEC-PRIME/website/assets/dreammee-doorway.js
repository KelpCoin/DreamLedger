(function(){
'use strict';
if(document.getElementById('dreammee-doorway')) return;
var host=document.createElement('aside');
host.id='dreammee-doorway';
host.setAttribute('aria-label','DreamMee doorway');
host.innerHTML='<div class="dl-door"><a class="dl-brand" href="https://dreamledger.org/">DreamLedger</a><a class="dl-cta" href="/dreammeez">Make your free DreamMee</a><a class="dl-qr-link" href="https://dreamledger.org/" aria-label="Open DreamLedger"><img class="dl-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Fdreamledger.org%2F" alt="Canonical DreamLedger QR code"></a><span class="dl-note">One canonical doorway: dreamledger.org</span></div>';
var style=document.createElement('style');
style.textContent='#dreammee-doorway{position:fixed;right:14px;bottom:14px;z-index:2147483000;font-family:system-ui,sans-serif}.dl-door{width:210px;padding:12px;background:rgba(12,14,18,.96);border:1px solid rgba(216,181,107,.45);border-radius:16px;box-shadow:0 14px 45px rgba(0,0,0,.35);text-align:center}.dl-brand{display:block;color:#d8b56b;text-decoration:none;font-weight:900;letter-spacing:.08em;font-size:11px;text-transform:uppercase}.dl-cta{display:block;margin:7px 0 10px;color:#fff;text-decoration:none;font-weight:900;font-size:14px}.dl-qr-link{display:block}.dl-qr{display:block;width:120px;height:120px;margin:0 auto;background:#fff;border-radius:8px}.dl-note{display:block;margin-top:8px;color:#9ca7b2;font-size:9px;line-height:1.3}@media(max-width:560px){#dreammee-doorway{right:8px;bottom:8px}.dl-door{width:170px;padding:9px}.dl-qr{width:92px;height:92px}.dl-cta{font-size:12px}}';
document.head.appendChild(style);
document.body.appendChild(host);
})();
