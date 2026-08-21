'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const TEMPLATE=path.join(ROOT,'surface','molt-beach.v1.template.html');
const OUT=path.join(ROOT,'compiled','website','board.html');
const PROOF=path.join(ROOT,'PROOF-MOLT-BEACH-COMPILATION.json');
const forbidden=['amplissa','bbw','adult-only','adult only','stripe_secret_key','stripe_webhook_secret','127.0.0.1','BEC-PRIME'];
const html=fs.readFileSync(TEMPLATE,'utf8');
const lower=html.toLowerCase();
for(const token of forbidden) if(lower.includes(token.toLowerCase())) throw new Error('MOLT_BEACH_PUBLIC_SURFACE_GATE_FAILED: '+token);
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,html,'utf8');
const sizes=[
 {sku:'MOLT-BEACH-100X100',w:100,h:100,price_nzd:29},
 {sku:'MOLT-BEACH-200X100',w:200,h:100,price_nzd:79},
 {sku:'MOLT-BEACH-500X200',w:500,h:200,price_nzd:149},
 {sku:'MOLT-BEACH-500X500',w:500,h:500,price_nzd:349},
 {sku:'MOLT-BEACH-1000X1000',w:1000,h:1000,price_nzd:999}
];
const proof={type:'molt-beach-compilation-proof',status:'PASS',canvas:{width:1000,height:1000,total_pixels:1000000},sizes,source_hash:crypto.createHash('sha256').update(html,'utf8').digest('hex'),output:'compiled/website/board.html',public_surface:'/board',human_review_required:true,agent_inventory_endpoint:'/api/molt-beach-inventory',checkout_endpoint:'/api/molt-beach-checkout',webhook_endpoint:'/api/molt-beach-webhook',compiled_at:new Date().toISOString()};
fs.writeFileSync(PROOF,JSON.stringify(proof,null,2)+'\n','utf8');
console.log(JSON.stringify(proof,null,2));
