'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beck-mtg-paidlink-'));
process.env.MTG_DIAGNOSTIC_DATA_DIR = root;
process.env.STRIPE_SECRET_KEY = 'synthetic_test_key';
process.env.STRIPE_WEBHOOK_SECRET = 'synthetic_webhook_secret';
process.env.SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic_db_key';
const diagnostic = require('../lib/mtgDiagnosticFulfillment');
const route = require('../routes/mtgDiagnostic');
const commercial = require('../routes/commercialCell');

const makeSession = () => ({
  id: 'cs_live_synthetic123', status: 'complete', livemode: true, payment_status: 'paid',
  payment_link: 'plink_1URUN1EGgEAnUFF9qPz94dqS',
  currency: 'nzd', amount_total: 2900, payment_intent: 'pi_synthetic123',
  metadata: { product_id: 'COMMANDER-DECK-DIAGNOSTIC-001', silo: 'mtg',
    sku:'COMMANDER-DECK-DIAGNOSTIC-001', offer_id:'OFFER-CMD-DIAG-29-NZD',
    marketplace_listing_id:'listing_synthetic' },
  customer_details: { email: 'buyer@example.test' },
  custom_fields: [{key:'decklisturl',type:'text',text:{value:'https://www.moxfield.com/decks/abc123'}}]
});
const originalFetch = global.fetch;
global.fetch = async function(url) {
  const s = String(url);
  if (s.includes('/payment_intents/pi_synthetic123')) return {
    ok: true, text: async () => JSON.stringify({
      id:'pi_synthetic123', livemode:true, status:'succeeded', amount:2900, currency:'nzd'
    })
  };
  if (s.includes('/rpc/resolve_economic_offer_id')) return {
    ok:true,json:async()=> 'offer_synthetic'
  };
  if (s.includes('/rpc/record_economic_outcome')) return {
    ok:true,json:async()=> 'outcome_synthetic'
  };
  if (s.includes('/rest/v1/economic_events')) return {
    ok:true, text:async()=>'[]'
  };
  if (s.includes('/rpc/marketplace_settle_stripe_payment')) return {
    ok:true, text:async()=>JSON.stringify([{order_id:'order_synthetic',fulfillment_id:'fulfill_synthetic'}])
  };
  if (s.includes('/rest/v1/control_evidence')) return {
    ok:true, text:async()=>'[]'
  };
  throw new Error('UNEXPECTED_EXTERNAL_REQUEST');
};

async function check() {
  const session = makeSession();
  assert.equal(diagnostic.parsePaymentLinkIntake(session).decklist_url, 'https://www.moxfield.com/decks/abc123');
  const wrongPrice = {...session,amount_total:4900};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(wrongPrice),/PRICE_CURRENCY_MISMATCH/);
  const wrongSilo = {...session,metadata:{...session.metadata,silo:'adult'}};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(wrongSilo),/SILO_PRODUCT_MISMATCH/);
  const unpaid = {...session,payment_status:'unpaid'};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(unpaid),/PAID_LIVE_SESSION_REQUIRED/);
  const badLink = {...session,custom_fields:[{key:'decklisturl',type:'text',text:{value:'https://evil.example/decks/abc123'}}]};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(badLink),/DECKLIST_URL_UNSUPPORTED/);
  const unsafe = {...session,custom_fields:[{key:'decklisturl',type:'text',text:{value:'https://www.moxfield.com.evil.test/decks/abc123'}}]};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(unsafe),/DECKLIST_URL_UNSUPPORTED/);
  const missing = {...session,custom_fields:[]};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(missing),/DECKLIST_URL_MISSING/);
  const wrongPaymentLink = {...session,payment_link:'plink_wrong'};
  assert.throws(()=>diagnostic.parsePaymentLinkIntake(wrongPaymentLink),/UNKNOWN_PAYMENT_LINK/);
  const first = await diagnostic.capturePaidLinkOrder(session);
  assert.equal(first.status,'PAID_AWAITING_MANUAL_DELIVERY');
  assert.equal(first.is_delivered,false);
  assert.equal(first.counts_as_verified_external_revenue,false);
  assert.equal(first.already_recorded,false);
  const second = await diagnostic.capturePaidLinkOrder(session);
  assert.equal(second.already_recorded,true);
  assert.equal(fs.readdirSync(path.join(root,'intakes')).length,1);

  // Signed synthetic webhook must acknowledge PAID, not FULFILLED.
  const event={id:'evt_synthetic',livemode:true,type:'checkout.session.completed',data:{object:session}};
  const body=JSON.stringify(event);
  const timestamp=String(Math.floor(Date.now()/1000));
  const sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET)
    .update(timestamp+'.'+body).digest('hex');
  const req=Readable.from([body]);
  req.headers={'stripe-signature':'t='+timestamp+',v1='+sig};
  const response={status:null,headers:null,body:null,writableEnded:false,
    writeHead(status,headers){this.status=status;this.headers=headers;},
    end(value){this.body=String(value);this.writableEnded=true;}};
  await route.handleWebhook(req,response);
  assert.equal(response.status,200);
  const receipt=JSON.parse(response.body);
  assert.equal(receipt.fulfilled,false);
  assert.equal(receipt.verified_external_revenue,false);
  assert.equal(receipt.status,'PAID_AWAITING_MANUAL_DELIVERY');
  assert.equal(response.body.includes('buyer@example.test'),false);
  assert.equal(response.body.includes('www.moxfield'),false);

  // The actual live Render entrypoint routes /api/webhooks/stripe through
  // commercialCell, NOT the legacy /webhook handler above.
  const req2=Readable.from([body]);
  req2.method='POST';
  req2.headers={'stripe-signature':'t='+timestamp+',v1='+sig};
  const res2={status:null,body:null,writableEnded:false,
    writeHead(status){this.status=status;},
    end(value){this.body=String(value);this.writableEnded=true;}};
  await commercial.handle(req2,res2,'/api/webhooks/stripe');
  assert.equal(res2.status,200);
  const canonical=JSON.parse(res2.body);
  assert.equal(canonical.handled,true);
  assert.equal(canonical.fulfilled,false);
  assert.equal(canonical.verified_external_revenue,false);
  assert.equal(canonical.mtg_order_state,'PAID_AWAITING_MANUAL_DELIVERY');
  assert.equal(res2.body.includes('buyer@example.test'),false);
  assert.equal(fs.readdirSync(path.join(root,'intakes')).length,1);

  console.log(JSON.stringify({test:'mtg_paid_link_handoff',status:'PASS',
    cases:12,payment_mutations:0,actual_sales:0,
    order_status:'PAID_AWAITING_MANUAL_DELIVERY',
    verified_revenue_claim:false},null,2));
}
check().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  global.fetch=originalFetch;
  fs.rmSync(root,{recursive:true,force:true});
});