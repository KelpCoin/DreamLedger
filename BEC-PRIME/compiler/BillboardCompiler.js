'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'compiled', 'website');
const OUT_FILE = path.join(OUT, 'billboard.html');

const PAYMENT_URL = 'https://buy.stripe.com/28EcN54zraG13M3g3idwc1t';
const OFFER_ID = 'DREAMLEDGER-BILLBOARD-100X100-NZD29';
const SKU = 'DL-BILLBOARD-100X100-001';

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Permanent DreamLedger 100x100 digital billboard block for NZ$29.">
<title>DreamLedger Billboard | NZ$29</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090b0f;color:#f5f7fa;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:860px;margin:auto;padding:56px 20px 80px}.eyebrow{font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#d7b56d}.hero{padding:34px 0 24px}h1{font-size:clamp(2.2rem,7vw,4.8rem);line-height:.98;margin:12px 0 20px;max-width:760px}p{font-size:1.08rem;line-height:1.65;color:#b8c0ca}.card{border:1px solid #303741;background:#12161c;border-radius:18px;padding:28px;margin-top:24px}.price{font-size:2.4rem;font-weight:850;color:#fff}.button{display:inline-block;margin-top:18px;padding:15px 24px;border-radius:10px;background:#d7b56d;color:#17130b;text-decoration:none;font-weight:850}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:20px}.item{padding:16px;border:1px solid #292f38;border-radius:12px;background:#0e1217;color:#dce1e7}.fine{font-size:.88rem;color:#858e99}.cta{margin-top:28px}.cta strong{color:#fff}@media(max-width:600px){.wrap{padding-top:34px}.card{padding:22px}}
</style>
</head>
<body>
<main class="wrap">
<div class="eyebrow">DreamLedger Billboard</div>
<section class="hero">
<h1>Own a permanent 100x100 digital billboard block.</h1>
<p>Put your image and destination link on a permanent DreamLedger billboard placement. One block. One payment. No subscription.</p>
</section>
<section class="card">
<div class="price">NZ$29</div>
<p>Buy one 100x100 block today. After payment, send your image and destination URL for review.</p>
<a class="button" href="${PAYMENT_URL}" target="_blank" rel="noopener noreferrer">Buy the NZ$29 block</a>
<div class="grid">
<div class="item"><strong>One-time</strong><br>No recurring fee.</div>
<div class="item"><strong>Permanent</strong><br>Placement while the billboard operates.</div>
<div class="item"><strong>Review</strong><br>Publication is approval-gated.</div>
</div>
</section>
<section class="card">
<h2>What happens after payment?</h2>
<p>Send your image and destination URL. We review the asset, approve it, and publish it when the submission meets the billboard requirements.</p>
<p class="fine">Payment proves purchase. Publication happens only after asset review and human approval.</p>
</section>
<section class="cta">
<p><strong>Offer:</strong> ${OFFER_ID}<br><strong>SKU:</strong> ${SKU}</p>
</section>
</main>
</body>
</html>
`;

write(OUT_FILE, html);
console.log(JSON.stringify({ status: 'PASS', output: path.relative(ROOT, OUT_FILE), offer_id: OFFER_ID, sku: SKU, price_nzd: 29 }, null, 2));
