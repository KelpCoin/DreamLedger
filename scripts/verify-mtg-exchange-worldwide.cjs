'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const home=read('public/mtg/index.html'),exchange=read('public/mtg/exchange.html'),community=read('public/mtg/community.html'),diagnostic=read('public/mtg/diagnostic/index.html');
const catalog=JSON.parse(read('public/data/mtg-catalog.json')),global=JSON.parse(read('public/catalog.json')),
decks=JSON.parse(read('public/data/mtg-owner-decks.json')),singles=JSON.parse(read('public/data/mtg-owner-singles.json')),
policy=JSON.parse(read('docs/BECK-SILO-FEE-POLICY.json')),terms=JSON.parse(read('docs/MTG-COMMERCIAL-TERMS-LOCK.json'));
const byId=new Map(global.products.map(p=>[p.id,p]));
const conflicts=[];
for(const p of catalog.products.filter(p=>p.status==='published')){
 const x=byId.get(p.id);
 if(!x||Number(x.price)!==Number(p.price)||String(x.currency).toUpperCase()!==String(p.currency||catalog.currency).toUpperCase()||Boolean(x.checkout_available)!==Boolean(p.checkout_available))conflicts.push(p.id);
}
const edh=catalog.products.find(p=>p.id==='EDH_0001');
const checks={
homepage_routes:home.includes('href="/mtg/community.html"')&&home.includes('href="/mtg/exchange.html"')&&home.includes('href="/mtg/diagnostic/"'),
home_owner_card_carousel:home.includes('id="deckRail"')&&home.includes('id="singleRail"'),
home_catalogue_reads:home.includes('/data/mtg-catalog.json')&&home.includes('/catalog.json')&&home.includes('/data/mtg-owner-decks.json')&&home.includes('/data/mtg-owner-singles.json'),
gallery_search_and_filter:exchange.includes('id="find"')&&exchange.includes('id="sort"')&&exchange.includes('data-kind="deck"')&&exchange.includes('id="deckGrid"'),
gallery_first_party_only:exchange.includes('OUR OWN STOCK')&&/enquire/i.test(exchange)&&!exchange.includes('buy.stripe.com'),
community_copy_only:community.includes('id="compose"')&&community.includes('navigator.clipboard.writeText')&&community.includes('Nothing has been submitted'),
discord_handoff:home.includes('https://discord.gg/tKxJkhJhCp')&&exchange.includes('https://discord.gg/tKxJkhJhCp')&&community.includes('https://discord.gg/tKxJkhJhCp'),
ledger_not_live:/not live|No live peer|in development/i.test(home)&&community.includes('not live yet'),
diagnostic_nzd29:diagnostic.includes('NZ$29')&&diagnostic.includes('checkout held')&&diagnostic.includes('integration held'),
paid_patron_tiers:terms.commander_diagnostic.patreon_benefit.entry_tier.included_reports_per_month===1&&terms.commander_diagnostic.patreon_benefit.higher_tiers.included_reports_per_month_max===5,
physical_checkout_held:catalog.products.every(p=>p.checkout_available===false)&&edh.price===400&&edh.inventory===0,
owned_singles_empty_truth:Array.isArray(singles.singles)&&singles.singles.length===0,
owned_deck_list_empty_truth:Array.isArray(decks.decks)&&decks.decks.length===0,
catalogue_prices_reconciled:conflicts.length===0,
zero_peer_commission:policy.rules['dreamledger-mtg'].platform_fee_bps===0,
preserved_silo_isolation:home.includes('data-silo="mtg"')&&!home.includes('amplissa.com')
};
for(const [name,ok] of Object.entries(checks))assert.equal(ok,true,name);
const engine=require('../public/mtg/diagnostic/engine.js');
const fake=(lands,mv,spirit)=>{const names=Array.from({length:100},(_,i)=>'Card'+i);return {deck:{id:'SYNTHETIC_TEST_ONLY',name:'Synthetic deck',commander:'Card0',boards:{commander:[names[0]],main:names.slice(1)}},
cards:names.map((name,i)=>({name,type_line:i<lands?'Basic Land':'Creature',cmc:i<lands?0:mv,oracle_text:i>=lands&&i<lands+spirit?'Spirit returns from the graveyard':''}))}};
const pass=fake(36,2,16),fail=fake(22,5,0);
const fixture_tests={synthetic_pass:engine.evaluate(pass.deck,pass.cards).verdict==='PASS',synthetic_fail:engine.evaluate(fail.deck,fail.cards).verdict==='FAIL',uncertainty_quarantine:engine.evaluate(pass.deck,[]).verdict==='QUARANTINE'};
for(const [name,ok] of Object.entries(fixture_tests))assert.equal(ok,true,name);
const files=['public/mtg/index.html','public/mtg/exchange.html','public/mtg/community.html','public/mtg/diagnostic/index.html','public/assets/dreamledger-mtg-theme.css','docs/MTG-COMMERCIAL-TERMS-LOCK.json'];
const proof={schema:'dreamledger/mtg-redesign-static-proof/v2',generated_at:new Date().toISOString(),silo:'mtg',result:'STATIC_TEST_PASS',release:'HOLD',public_production_checked:false,real_trades_completed:0,paid_deliveries_verified:false,patreon_entitlements_live:false,peer_ledger_live:false,inventory_verified:false,checks,fixture_tests,conflicts,file_sha256:Object.fromEntries(files.map(p=>[p,hash(p)]))};
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/mtg-exchange-proof.json'),JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({result:proof.result,release:proof.release,proof:'artifacts/mtg-exchange-proof.json',static_checks:Object.keys(checks).length,fixtures:fixture_tests},null,2));
