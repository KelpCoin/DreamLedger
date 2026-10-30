'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const page=read('public/mtg/exchange.html'),diag=read('public/mtg/diagnostic/index.html'),master=read('public/mtg/index.html'),engine=require('../public/mtg/diagnostic/engine.js');
const news=JSON.parse(read('public/mtg/exchange-news.json')),deck=JSON.parse(read('public/data/decklists/quintorius.json')),policy=JSON.parse(read('docs/BECK-SILO-FEE-POLICY.json'));
const claims={
 master_parity:['mtg/index.html','BEC-PRIME/compiled/website/mtg/index.html','BEC-PRIME/website/mtg-catalog.html'].every(p=>read(p).includes('/mtg/diagnostic/')&&read(p).includes('/catalog.json')),
 master_entry:master.includes('/mtg/exchange.html')&&master.includes('/mtg/diagnostic/'),
 visual_gallery:page.includes('id="deckGrid"')&&page.includes('gridButton')&&page.includes('listButton'),
 catalogue_consistency:page.includes('/data/mtg-catalog.json')&&page.includes('/catalog.json')&&page.includes('Checkout held'),
 trade_draft_only:page.includes('dl_mtg_trade_notes_v1')&&page.includes('published:false'),
 free_b2b_link:page.includes('/b2b-marketplace.html'),
 auction_bidding_held:page.includes('Bidding remains held'),
 invites_and_patreon:['https://discord.gg/aYdc4h5cpU','https://discord.gg/tKxJkhJhCp','https://www.patreon.com/happyhomarid'].every(u=>page.includes(u)&&master.includes(u)),
 sponsors_not_active:page.includes('No paid ranking is active'),
 source_linked_ticker:Array.isArray(news.items)&&news.items.length>=3&&news.items.every(x=>x.reviewed===true&&x.source&&x.date&&/^https:\/\//.test(x.url)),
 avatar_reuses_existing:page.includes('/assets/avatar-identity.js')&&page.includes('/avatar.html'),
 diagnostic_free:diag.includes('Run free diagnostic')&&diag.includes('/mtg/diagnostic/parse.js')&&diag.includes('MTGFreeDiagnostic.evaluate')&&!diag.includes('NZ$29'),
 no_fake_email:diag.includes('Nothing is submitted to a DreamLedger account')&&diag.includes('No login, email, payment or subscription'),
 mtg_fee_zero:policy.rules['dreamledger-mtg'].platform_fee_bps===0
};
const make=(lands,mv,synergy)=>{const names=Array.from({length:100},(_,i)=>'Card'+i);
return {deck:{id:'SYNTHETIC_TEST_ONLY',name:'Synthetic test deck',commander:'Card0',boards:{commander:[names[0]],main:names.slice(1)}},
 cards:names.map((name,i)=>({name,type_line:i<lands?'Basic Land':'Creature',cmc:i<lands?0:mv,oracle_text:i>=lands&&i<lands+synergy?'Spirit returns from the graveyard':''}))};};
const p=make(36,2,16),f=make(22,5,0),outcomes={
 synthetic_pass:engine.evaluate(p.deck,p.cards).verdict==='PASS',
 synthetic_fail:engine.evaluate(f.deck,f.cards).verdict==='FAIL',
 uncertainty_quarantine:engine.evaluate(deck,[]).verdict==='QUARANTINE',
 real_deck_source:deck.id==='EDH_QUINTORIUS_0002'};
for(const [k,v] of Object.entries({...claims,...outcomes}))assert.equal(v,true,k);
const files=['public/mtg/exchange.html','public/mtg/exchange-news.json','public/mtg/diagnostic/index.html','public/mtg/diagnostic/engine.js'];
const proof={schema:'BECK/MTG-EXCHANGE-STAGE-PROOF/v1',generated_at:new Date().toISOString(),silo:'mtg',stage:'STATIC_IMPLEMENTATION_PASS',production_release:'HOLD',live_email_delivery:'NOT_VERIFIED',live_auction_bids:'NOT_ENABLED',real_payments:'NOT_TESTED',automatic_news_ingestion:'NOT_ENABLED',avatar_sync_across_domains:'NOT_VERIFIED',social_publication:'NOT_AUTHORISED',checks:claims,fixture_tests:outcomes,hashes:Object.fromEntries(files.map(p=>[p,sha(p)]))};
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});const dest=path.join(root,'artifacts/mtg-exchange-proof.json');fs.writeFileSync(dest,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({result:proof.stage,production:proof.production_release,proof:dest,checks:Object.keys(claims).length,fixtures:outcomes},null,2));