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
  }
};

function html(title, description, status, slug) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | DreamLedger</title><meta name="description" content="${description}"></head><body style="font-family:system-ui;max-width:900px;margin:0 auto;padding:48px 24px;background:#fff;color:#111"><p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px">DreamLedger public surface</p><h1>${title}</h1><p style="font-size:20px;line-height:1.5">${description}</p><p><strong>Status:</strong> ${status}</p><p>This page is a real public HTTP surface. Financial activation, public promotion and fulfillment remain separately approval-gated.</p><hr><p><a href="/">Silo index</a></p><footer style="margin-top:64px;font-size:13px">Silo: ${slug} · Infrastructure readiness is not revenue.</footer></body></html>`;
}

const server = http.createServer((req,res)=>{
  const u = new URL(req.url, 'http://localhost');
  const slug = u.pathname.replace(/^\\/+|\\/+$/g,'');
  if (slug === '' || slug === 'healthz') {
    const body = slug === 'healthz' ? JSON.stringify({status:'ok',service:'dreamledger-silo-gateway',silos:Object.keys(silos).length}) : html('DreamLedger Silo Gateway','Public HTTP surfaces for verified silo candidates.','LIVE','index');
    res.writeHead(200, {'content-type': slug === 'healthz' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8','cache-control':'no-store'});
    return res.end(body);
  }
  const silo = silos[slug];
  if (!silo) {
    res.writeHead(404, {'content-type':'text/plain; charset=utf-8'});
    return res.end('Silo not found');
  }
  res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(html(silo.title,silo.description,silo.status,slug));
});

const port = Number(process.env.PORT || 10000);
server.listen(port,'0.0.0.0',()=>console.log('SILO_GATEWAY_READY '+port));
