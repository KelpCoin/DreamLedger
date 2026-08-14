'use strict';
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const port = Number(process.env.SMOKE_FRONT_DOOR_PORT || 38766);
const base = `http://127.0.0.1:${port}`;
const email = `frontdoor-${crypto.randomUUID()}@example.test`;
const password = 'DreamLedgerFrontDoor!2026';
const root = `/tmp/dreamledger-front-door-${process.pid}`;
let child;
let cookie;
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
async function req(path, options={}, allow=false){const r=await fetch(base+path,options);const text=await r.text();let body;try{body=JSON.parse(text)}catch{body=text}if(!r.ok&&!allow)throw new Error(`${options.method||'GET'} ${path} -> ${r.status}: ${text}`);return{r,body}}
function assert(x,m){if(!x)throw new Error(m)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function start(){child=spawn(process.execPath,['-r','./lib/publicShellPreload.js','-r','./lib/m2mPreload.js','-r','./lib/qrPreload.js','start.js'],{cwd:__dirname+'/..',env:{...process.env,PORT:String(port),DREAMIEZ_DATA_DIR:root,DREAMIEZ_SMOKE:'true',LEDGER_DATA_DIR:root+'/transactions',PROOF_DATA_DIR:root+'/proofs',DEMAND_RADAR_DATA_DIR:root+'/demand',DIGITAL_PROXY_LM_ENABLED:'false'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>process.stdout.write(`[runtime] ${d}`));child.stderr.on('data',d=>process.stderr.write(`[runtime] ${d}`))}
async function main(){fs.rmSync(root,{recursive:true,force:true});start();for(let i=0;i<60;i++){try{const h=await req('/healthz');if(h.body.status==='ok')break}catch{}await sleep(200)}
 const created=await req('/api/dreamiez/account/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,name:'Front Door Seller'})});assert(created.body.verification_required===true,'verification was not required');cookie=created.r.headers.get('set-cookie');const users=JSON.parse(fs.readFileSync(root+'/users.json','utf8'));const u=users.find(x=>x.email===email);assert(u&&u.email_verification_token,'verification token missing');
 const verified=await req('/api/dreamiez/account/verify?token='+encodeURIComponent(u.email_verification_token));assert(verified.body.account.email_verified===true,'verification failed');cookie=verified.r.headers.get('set-cookie')||cookie;
 const profile=await req('/api/account/update',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({name:'Front Door Seller',seller_display_name:'Front Door Motors',location:'Auckland',bio:'Real seller'})});assert(profile.body.account.seller.enabled===true,'seller profile was not enabled');
 const media=await req('/api/marketplace/media',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({mime:'image/png',data:pixel})});assert(media.body.id,'listing photo upload failed');
 const listing=await req('/api/marketplace/listings',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({title:'2018 Test Corolla',description:'Real marketplace smoke listing.',category:'Cars',price:12000,condition:'Used',location:'Auckland',photos:[media.body.id],car:{make:'Toyota',model:'Corolla',year:2018,kilometres:85000,wof_expiry:'2026-12-01',rego_expiry:'2026-11-01',transmission:'Automatic',fuel_type:'Petrol',body_type:'Hatchback',service_history:'Recorded',accident_history:'None reported',vin_private:'TEST-PRIVATE'}})});assert(listing.body.item.status==='APPROVED'&&listing.body.item.checkout_available===true,'verified seller listing did not go live');
 const catalog=await req('/api/marketplace/listings?category=Cars');assert(catalog.body.items.some(x=>x.id===listing.body.item.id),'live car listing not browseable');const detail=await req('/api/marketplace/listings/'+listing.body.item.id);assert(detail.body.item.car.make==='Toyota'&&detail.body.item.car.vin_private===undefined,'private VIN leaked to public listing');
 const guest=await req('/api/marketplace/listings/'+listing.body.item.id+'/checkout',{method:'POST'},true);assert([200,502].includes(guest.r.status),'guest checkout route was not reachable');
 const reset=await req('/api/account/password-reset/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});assert(reset.body.ok===true,'password reset request failed');
 console.log(JSON.stringify({smoke_test:'PASS',account_created:true,email_verification:true,seller_enabled:true,profile_saved:true,photo_upload:true,car_listing_live:true,marketplace_browse:true,private_vin_hidden:true,guest_checkout_route:true,password_recovery_request:true},null,2));}
main().catch(e=>{console.error(JSON.stringify({smoke_test:'FAIL',error:e.message},null,2));process.exitCode=1}).finally(()=>{if(child)child.kill('SIGTERM')});
