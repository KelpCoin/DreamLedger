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
  // MTG is intentionally NOT exposed from the DreamLedger gateway.
  // Canonical MTG commerce lives in the separate MTG/HappyHomarid/CollectorsCoast silo.
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

const fs = require('fs');
const path = require('path');

let economicEvents = [];
try {
  const manifestPath = path.resolve(__dirname, '../../BEC-PRIME/economics/CUBE-ECONOMIC-EVENTS-100.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  economicEvents = Array.isArray(manifest.events) ? manifest.events : [];
} catch (error) {
  console.error('M10K_EVENT_MANIFEST_LOAD_FAILED', error.message);
}

const audiences=['SME','PROC','TRADE','CONSUMER','PRO','LOCAL','CLUB','CREATOR','COLLECTOR','EDU'];
const angles=['price-comparison','time-saving-processing','decision-ready-shortlist','exception-detection','supplier-buyer-matching','bundle-optimization','replenishment-planning','surplus-liquidation','purchase-preparation','evidence-packet'];

function moneyRoute(id){
  const m=id.match(/^M10K-(\d{3})-(\d{3})$/); if(!m)return null;
  const event=Number(m[1]), variant=Number(m[2]);
  if(event<1||event>100||variant<1||variant>100)return null;
  const sourceEvent=economicEvents[event-1] || null;
  const audience=audiences[Math.floor((variant-1)/10)];
  const angle=angles[(variant-1)%10];
  return {
    id,
    event,
    variant,
    event_id:sourceEvent ? sourceEvent.id : null,
    silo:sourceEvent ? sourceEvent.silo : 'unresolved',
    event_name:sourceEvent ? sourceEvent.event : 'unresolved',
    buyer:sourceEvent ? sourceEvent.buyer : 'unresolved',
    audience,
    angle
  };
}

function serviceTargets(route){
  const routeId=encodeURIComponent(route.id);
  const procurementAudience=['SME','PROC','TRADE','PRO'].includes(route.audience);
  const collectorAudience=['COLLECTOR','CLUB'].includes(route.audience);
  return [
    procurementAudience ? {
      label:'Supplier Quote Comparison',
      price:'NZ$49 one-time',
      href:'https://dreamledger.org/quote-comparison/?route_id='+routeId,
      description:'Pay, submit 2–5 supplier quotes, and receive the existing automated comparison and evidence packet.'
    } : null,
    collectorAudience ? {
      label:'Commander Deck Diagnostic',
      price:'NZ$29 one-time',
      href:'https://dreamledger.org/mtg/commander-deck-diagnostic?route_id='+routeId,
      description:'Use the existing paid Commander diagnostic workflow for a submitted decklist.'
    } : null,
    {
      label:'DreamLedger Evidence',
      price:'Public service',
      href:'https://dreamledger.org/truth-oracle.html?route_id='+routeId,
      description:'Use the existing evidence surface to inspect observations, provenance, contradictions and unknowns.'
    },
    {
      label:'Supplier Quote Comparison',
      price:'NZ$49 one-time',
      href:'https://dreamledger.org/quote-comparison/?route_id='+routeId,
      description:'Existing paid service wall for buyers who already have supplier quotations.'
    },
    {
      label:'Commander Deck Diagnostic',
      price:'NZ$29 one-time',
      href:'https://dreamledger.org/mtg/commander-deck-diagnostic?route_id='+routeId,
      description:'Existing paid service wall for Commander deck diagnosis.'
    }
  ].filter(Boolean).slice(0,3);
}

function routePage(route){
  const targets=serviceTargets(route);
  const cards=targets.map(function(t){
    return '<div style="border:1px solid #333;background:#111;padding:18px;border-radius:10px"><p style="margin:0 0 6px;color:#d5b45c;font-weight:800">'+esc(t.price)+'</p><h2 style="font-size:22px;margin:0 0 8px">'+esc(t.label)+'</h2><p style="line-height:1.5;color:#746f67">'+esc(t.description)+'</p><p><a href="'+esc(t.href)+'" style="color:#d5b45c;font-weight:800">Open live service →</a></p></div>';
  }).join('');
  return '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(route.event_name)+' · '+esc(route.id)+' | DreamLedger</title><meta name="description" content="'+esc('Live DreamLedger entry surface for '+route.event_name+' serving '+route.buyer+'.')+'"></head><body style="font-family:system-ui;max-width:1000px;margin:0 auto;padding:42px 22px;background:#f5f0e7;color:#171512"><p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#9a6d19">DreamLedger service gateway</p><h1 style="font-size:clamp(2.2rem,6vw,4.5rem);line-height:.95">'+esc(route.event_name)+'</h1><p style="font-size:20px;line-height:1.5;color:#746f67">Route '+esc(route.id)+' is a real entry surface into existing DreamLedger service walls. It is not a claim that this economic event has a buyer, settlement or verified outcome.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:28px 0"><div><b>Source event</b><br>'+esc(route.event_id||'unresolved')+'</div><div><b>Buyer class</b><br>'+esc(route.buyer)+'</div><div><b>Audience</b><br>'+esc(route.audience)+'</div><div><b>Commercial angle</b><br>'+esc(route.angle)+'</div></div><h2>Open a live service</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px">'+cards+'</div><p style="margin-top:28px;font-size:13px;color:#746f67">Route readiness is separate from economic truth. A payment is counted only through the existing authoritative settlement and fulfillment chain.</p><p><a href="/" style="color:#9a6d19">Back to silo gateway</a></p></body></html>';
}

function esc(value) {
  return String(value || '').replace(/[&<>\"]/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}

function securityHeaders(contentType) {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  };
}

function routeJson(route) {
  return {
    route_id: route.id,
    source_event: route.event_id,
    event_name: route.event_name,
    buyer_class: route.buyer,
    audience: route.audience,
    commercial_angle: route.angle,
    status: 'CANDIDATE_PUBLIC_ENTRY',
    economic_truth: 'UNVERIFIED',
    services: serviceTargets(route).map(function(t) {
      return {label:t.label, price:t.price, href:t.href};
    })
  };
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
  if (u.pathname === '/robots.txt') {
    res.writeHead(200, securityHeaders('text/plain; charset=utf-8'));
    return res.end('User-agent: *\\nAllow: /\\nSitemap: https://dreamledger-silo-gateway.onrender.com/sitemap.xml\\n');
  }
  if (u.pathname === '/sitemap.xml') {
    const urls = [];
    for (let event = 1; event <= 100; event++) {
      for (let variant = 1; variant <= 100; variant++) {
        urls.push('https://dreamledger-silo-gateway.onrender.com/M10K-' + String(event).padStart(3,'0') + '-' + String(variant).padStart(3,'0'));
      }
    }
    res.writeHead(200, {'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff'});
    return res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(function(x){ return '<url><loc>'+x+'</loc></url>'; }).join('') + '</urlset>');
  }
  if (u.pathname === '/api/healthz') {
    res.writeHead(200, securityHeaders('application/json; charset=utf-8'));
    return res.end(JSON.stringify({status:'ok',service:'dreamledger-silo-gateway',silos:Object.keys(silos).length,money_routes:10000,economic_truth:'UNVERIFIED'}));
  }
  if (u.pathname === '/api/routes') {
    const sample = [];
    for (let event = 1; event <= 100; event++) {
      for (let variant = 1; variant <= 100; variant++) {
        sample.push(moneyRoute('M10K-' + String(event).padStart(3,'0') + '-' + String(variant).padStart(3,'0')));
      }
    }
    res.writeHead(200, securityHeaders('application/json; charset=utf-8'));
    return res.end(JSON.stringify({count:sample.length,status:'CANDIDATE_PUBLIC_ENTRY',economic_truth:'UNVERIFIED',routes:sample}));
  }
  if (u.pathname === '/api/route') {
    const route = moneyRoute(u.searchParams.get('id') || '');
    if (!route) {
      res.writeHead(404, securityHeaders('application/json; charset=utf-8'));
      return res.end(JSON.stringify({error:'route_not_found'}));
    }
    res.writeHead(200, securityHeaders('application/json; charset=utf-8'));
    return res.end(JSON.stringify(routeJson(route)));
  }
  if (slug === '' || slug === 'healthz') {
    const body = slug === 'healthz'
      ? JSON.stringify({status:'ok',service:'dreamledger-silo-gateway',silos:Object.keys(silos).length,money_routes:10000})
      : page('DreamLedger Silo Gateway','Public HTTP surfaces for defined silo candidates.','LIVE','index');
    res.writeHead(200, securityHeaders(slug === 'healthz' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8'));
    return res.end(body);
  }
  if (u.pathname === '/gets-opportunity-brief.html') {
    res.writeHead(200, securityHeaders('text/html; charset=utf-8'));
    return res.end('<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GETS Opportunity Brief | DreamLedger</title></head><body style="font-family:system-ui;max-width:900px;margin:0 auto;padding:48px 24px;background:#f5f0e7;color:#171512"><a href="/">DreamLedger</a><h1>GETS Opportunity Brief</h1><p>Evidence-backed tender decoding for NZ suppliers.</p><h2>NZ$49 price hypothesis</h2><p>Checkout is not attached until the payment route and fulfillment contract are explicitly approved and verified.</p><h2>Free sample</h2><ul><li>Tender identity and closing date</li><li>Mandatory requirements with source/page references</li><li>Capability fit and visible gaps</li><li>Questions to resolve before submission</li><li>Evidence trail for material claims</li></ul><p>This page is a product demonstration. It does not claim a buyer, payment or revenue.</p></body></html>');
  }
  const route = moneyRoute(slug);
  if (route) {
    res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'});
    return res.end(routePage(route));
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
