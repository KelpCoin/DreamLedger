const http = require('http');
const { URL } = require('url');

const silos = {
  'dreamledger-billboard': {
    title:'DreamLedger Founding Billboard',
    description:'Founding placement on the DreamLedger public billboard surface.',
    status:'READY_FOR_HUMAN_APPROVAL'
  },
  'production-verification': {
    title:'Independent Production Verification',
    description:'Evidence-backed production verification service. Public release remains approval-gated.',
    status:'APPROVAL_REQUIRED'
  },
  'commander-deck-diagnostic': {
    title:'Commander Deck Diagnostic',
    description:'Structured Commander deck analysis and report.',
    status:'READY'
  },
  'hosted-decision-analysis': {
    title:'Hosted Decision Analysis',
    description:'Structured decision analysis delivered through a hosted endpoint.',
    status:'READY'
  },
  'palinchron-liquidation': {
    title:'MTG Liquidation: Palinchron ULG Foil LP',
    description:'Physical Magic: The Gathering collector listing. Listing publication remains human-approved.',
    status:'READY_FOR_HUMAN_APPROVAL'
  },
  'evidence-ledger': {
    title:'Evidence Ledger Access',
    description:'Sourced observations, estimates, uncertainty labels and provenance.',
    status:'APPROVAL_REQUIRED'
  },
  'fight-edge-mma-boxing': {
    title:'Fight Edge - MMA/Boxing',
    description:'Fight information, matchup context, documented records and results.',
    status:'APPROVAL_REQUIRED'
  },
  'gets-opportunity-brief': {
    title:'GETS Opportunity Brief',
    description:'Evidence-backed tender decoding for NZ suppliers considering government work.',
    status:'OFFER_HYPOTHESIS'
  }
};


const audiences=['SME','PROC','TRADE','CONSUMER','PRO','LOCAL','CLUB','CREATOR','COLLECTOR','EDU'];
const angles=['price-comparison','time-saving-processing','decision-ready-shortlist','exception-detection','supplier-buyer-matching','bundle-optimization','replenishment-planning','surplus-liquidation','purchase-preparation','evidence-packet'];
function moneyRoute(id){
  const m=id.match(/^M10K-(\d{3})-(\d{3})$/); if(!m)return null;
  const event=Number(m[1]), variant=Number(m[2]); if(event<1||event>100||variant<1||variant>100)return null;
  const audience=audiences[Math.floor((variant-1)/10)], angle=angles[(variant-1)%10];
  return {id,title:'DreamLedger '+id+' service silo',description:'Candidate commercial route '+id+' generated from the existing DreamLedger economic-event substrate.',status:'CANDIDATE',event,variant,audience,angle};
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}

function page(title, description, status, slug) {
  return '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    esc(title) + ' | DreamLedger</title><meta name="description" content="' + esc(description) +
    '"></head><body style="font-family:system-ui;max-width:920px;margin:0 auto;padding:48px 24px;background:#f5f0e7;color:#171512">' +
    '<p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#9a6d19">DreamLedger public commerce surface</p>' +
    '<h1 style="font-size:clamp(2.4rem,7vw,5rem);line-height:.9">' + esc(title) + '</h1>' +
    '<p style="font-size:20px;line-height:1.5;color:#746f67">' + esc(description) + '</p>' +
    '<p><strong>Status:</strong> ' + esc(status) + '</p>' +
    '<p><a href="/gets-opportunity-brief.html">View the GETS Opportunity Brief</a></p>' +
    '<p><a href="/">Silo index</a></p>' +
    '<hr><p style="font-size:13px;color:#746f67">Silo: ' + esc(slug) + ' · Infrastructure readiness is not revenue.</p></body></html>';
}

const server = http.createServer((req,res)=>{
  const u = new URL(req.url, 'http://localhost');
  const slug = u.pathname.split('/').filter(Boolean)[0] || '';
  if (slug === '' || slug === 'healthz') {
    const body = slug === 'healthz'
      ? JSON.stringify({status:'ok',service:'dreamledger-silo-gateway',silos:Object.keys(silos).length,money_routes:10000})
      : page('DreamLedger Silo Gateway','Public HTTP surfaces for defined silo candidates.','LIVE','index');
    res.writeHead(200, {'content-type': slug === 'healthz' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8','cache-control':'no-store'});
    return res.end(body);
  }
  if (u.pathname === '/gets-opportunity-brief.html') {
    res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    return res.end('<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GETS Opportunity Brief | DreamLedger</title></head><body style="font-family:system-ui;max-width:900px;margin:0 auto;padding:48px 24px;background:#f5f0e7;color:#171512"><a href="/">DreamLedger</a><h1>GETS Opportunity Brief</h1><p>Evidence-backed tender decoding for NZ suppliers.</p><h2>NZ$49 price hypothesis</h2><p>Checkout is not attached until the payment route and fulfillment contract are explicitly approved and verified.</p><h2>Free sample</h2><ul><li>Tender identity and closing date</li><li>Mandatory requirements with source/page references</li><li>Capability fit and visible gaps</li><li>Questions to resolve before submission</li><li>Evidence trail for material claims</li></ul><p>This page is a product demonstration. It does not claim a buyer, payment or revenue.</p></body></html>');
  }
  const route = moneyRoute(slug);
  if (route) {
    res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300'});
    return res.end(page(route.title,route.description,route.status,route.id));
  }
  const silo = silos[slug];
  if (!silo) {
    res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});
    return res.end('Silo not found');
  }
  res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(page(silo.title,silo.description,silo.status,slug));
});

const port = Number(process.env.PORT || 10000);
server.listen(port,'0.0.0.0',()=>console.log('SILO_GATEWAY_READY '+port));
