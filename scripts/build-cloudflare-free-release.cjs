'use strict';
// Cloudflare Pages free STATIC export. No payment processing, no secret keys,
// no direct user card capture, no paid Workers, and no production publication.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public-release');
cp.execFileSync(process.execPath,[path.join(__dirname,'build-customer-public-release.cjs')],{cwd:root,stdio:'inherit'});
const avatarFile=path.join(out,'avatar.html');
let avatar=fs.readFileSync(avatarFile,'utf8');
const start=avatar.indexOf('        // Direct low-friction cash path for real money validation');
const end=avatar.indexOf('        row.appendChild(real);',start);
if(start<0||end<0)throw Error('CF_AVATAR_PAYMENT_BLOCK_DRIFT');
const disabled=`        // Static preview only: a payment requires verified delivery before activation.
        var notice = document.createElement('span');
        notice.className = 'small';
        notice.textContent = 'Purchases paused until secure delivery is available.';
        row.appendChild(notice);`;
avatar=avatar.slice(0,start)+disabled+avatar.slice(end+'        row.appendChild(real);'.length);
avatar=avatar.replace('Look good. Spend NZ$2–5.','Build a free DreamMeez avatar.').replace('Impulse cosmetics from NZ$2.','Try cosmetics free in the demo; purchases are paused.');
if(avatar.includes('real.href =')||avatar.includes('Pay NZ$3.99'))throw Error('CF_AVATAR_UNVERIFIED_PAYMENT_REMAINS');
fs.writeFileSync(avatarFile,avatar,'utf8');
const redirects=[
 '/billboard /billboard.html 302',
 '/billboard/ /billboard.html 302',
 '/avatar /avatar.html 302',
 '/mtg /mtg/ 302',
 '/ticker /ticker.html 302'
].join('\n')+'\n';
fs.writeFileSync(path.join(out,'_redirects'),redirects,'utf8');
fs.writeFileSync(path.join(out,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
\n`,'utf8');
// Cloudflare treats a missing 404.html as an SPA; do not leak the homepage for unknown URLs.
fs.writeFileSync(path.join(out,'404.html'),'<!doctype html><html lang="en-NZ"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page unavailable | DreamLedger</title><body style="font:18px system-ui;background:#090e12;color:#f3f8f9;padding:35px"><h1>Page unavailable</h1><p>This part of DreamLedger is not open yet.</p><p><a style="color:#32db89" href="/">Return to DreamLedger</a></p></body></html>','utf8');
let count=0,max=0;
function visit(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,ent.name);if(ent.isDirectory())visit(full);else if(ent.isFile()){count++;max=Math.max(max,fs.statSync(full).size);}}}
visit(out);
if(count>20000)throw Error('CF_FREE_SITE_TOO_MANY_FILES:'+count);
if(max>25*1024*1024)throw Error('CF_FREE_ASSET_TOO_LARGE:'+max);
const proof={schema:'beck/cloudflare-free-static-release/v1',verdict:'STATIC_BUILD_PASS',production_deployed:false,financial_action:'NONE',paid_plan_required:false,payment_actions:'DISABLED',origin:'existing BECK MTG public-release builder',output_dir:'public-release',file_count:count,largest_file_bytes:max,run_time:new Date().toISOString(),known_blockers:['not a production deployment','no dynamic login or Stripe fulfillment on this static export','Cloudflare account/GitHub integration not connected']};
const proofs=path.join(root,'artifacts');fs.mkdirSync(proofs,{recursive:true});
fs.writeFileSync(path.join(proofs,'cloudflare-free-static-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
