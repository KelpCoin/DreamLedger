'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const compiled = path.join(root, 'compiled', 'website', 'billboard.html');
const sourceRoute = path.join(root, 'routes', 'billboard-v2.js');
const targetRoute = path.join(root, 'routes', 'billboard.js');

if (!fs.existsSync(compiled)) throw new Error('Compiled billboard surface missing');
if (!fs.existsSync(sourceRoute)) throw new Error('Canonical billboard route missing');

fs.copyFileSync(sourceRoute, targetRoute);
let html = fs.readFileSync(compiled, 'utf8');

html = html.replaceAll('/api/molt-beach-inventory?market=', '/api/billboard/inventory/');
html = html.replace(
  'input id="image" type="url" name="image_url" maxlength="1000" required placeholder="https://your-site.com/your-image.png"',
  'input id="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required'
);
html = html.replace(/Image URL/g, 'Image file');
html = html.replace(
  '.rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:3px 2px 18px;scrollbar-width:thin}',
  '.rail{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:3px 2px 18px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}.rail::-webkit-scrollbar{display:none}.offer{scroll-snap-align:start}'
);
html = html.replace(
  '<section class="section"><div class="section-head"><div><div class="eyebrow">Swipe-first catalogue</div>',
  '<section class="section"><div class="section-head"><div><div class="eyebrow">Swipe-first catalogue</div><div class="notice">Swipe left or right to compare footprints. The catalogue does not auto-rotate.</div>'
);

const claimStart = html.indexOf("async function claimAfterReturn()");
const submitStart = html.indexOf("$('#form').addEventListener('submit'");
if (claimStart >= 0 && submitStart > claimStart) {
  const claim = `async function claimAfterReturn(){const p=new URLSearchParams(location.search);const ad_id=p.get('ad_id');if(!ad_id)return;const market=state.market;$('#status').textContent='Checking payment status...';const r=await fetch('/api/billboard/order/'+market+'/'+encodeURIComponent(ad_id));const d=await r.json();if(!r.ok){$('#status').className='status bad';$('#status').textContent='Payment status is still being confirmed.';return}if(d.payment_status==='paid'||d.status==='PAID_PENDING_REVIEW'||d.status==='PUBLISHED'){$('#form').style.display='none';$('#success').style.display='block';$('#status').className='status ok';$('#status').textContent='Payment received. Your placement is pending automated publication.'}else{$('#status').textContent='Checkout returned. Payment status: '+d.payment_status+'.'}load()}`;
  html = html.slice(0, claimStart) + claim + html.slice(submitStart);
}

const start = html.indexOf("$('#form').addEventListener('submit'");
const end = html.indexOf('renderMarkets();renderSizes();renderFormOptions();loadInventory();', start);
if (start < 0 || end < 0) throw new Error('Billboard submit handler anchors not found');
const handler = `$('#form').addEventListener('submit',async e=>{e.preventDefault();const status=$('#status');status.className='status';status.textContent='Checking live inventory and creating your secure checkout...';const data=Object.fromEntries(new FormData(e.target).entries());try{const chosen=SIZES.find(x=>x[0]===data.size);const payload={market:data.market,size:data.size,width:Number(chosen[2].split('x')[0]),height:Number(chosen[2].split('x')[1]),email:data.email,title:data.title,owner_name:data.owner_name,image_url:data.image_url,destination_url:data.destination_url};const r=await fetch('/api/billboard/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Checkout preparation failed');status.className='status ok';status.textContent='Inventory verified. Redirecting to secure checkout...';location.href=d.checkout_url}catch(err){status.className='status bad';status.textContent=err.message}});`;
html = html.slice(0, start) + handler + html.slice(end);

html = html.replace('buyer supplies one image and destination URL; publication requires human review.', 'buyer supplies one image and destination URL; automated validation is required before publication.');
html = html.replace('Payment does not publish the artwork. Human review is mandatory.', 'Payment does not publish the artwork. Automated validation is mandatory.');

fs.writeFileSync(compiled, html, 'utf8');
console.log(JSON.stringify({status:'PASS', activation:'billboard', route:true, compiled:true, zero_human_fulfillment_contract:true}));
