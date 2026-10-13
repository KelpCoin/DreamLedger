'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
const checks=[],holds=[];
function check(name,ok,detail=''){checks.push({name,ok:!!ok,detail});}
function hold(code,detail){holds.push({code,detail});}
const rootPage='music-media/index.html',publicPage='public/music-media/index.html';
const rootCatalog='data/music-media-catalog.json',publicCatalog='public/data/music-media-catalog.json';
const rootAlias='music-media.html',publicAlias='public/music-media.html';
for(const p of [rootPage,publicPage,rootCatalog,publicCatalog,rootAlias,publicAlias,'silos/music-media/silo.json','docs/BECK-EMPIRE-SILO-REGISTRY.json','docs/BECK-SILO-FEE-POLICY.json'])check('required file exists: '+p,fs.existsSync(path.join(ROOT,p)));
check('storefront copies match',read(rootPage)===read(publicPage));
check('catalogue copies match',read(rootCatalog)===read(publicCatalog));
check('legacy aliases match',read(rootAlias)===read(publicAlias));
const manifest=json('silos/music-media/silo.json'),catalog=json(rootCatalog),registry=json('docs/BECK-EMPIRE-SILO-REGISTRY.json'),fees=json('docs/BECK-SILO-FEE-POLICY.json'),directory=json('data/silo-directory.json');
const silo=registry.silos&&registry.silos.MUSIC_MEDIA,fee=fees.rules&&fees.rules['dreamledger-music-media'];
check('canonical manifest identity and status',manifest.identity.slug==='music-media'&&manifest.silo_key==='MUSIC_MEDIA'&&manifest.status==='build');
check('non-MTG platform fee is 500 bps',manifest.platform_fee_bps===500&&silo&&silo.platform_fee_bps===500&&fee&&fee.platform_fee_bps===500);
check('catalogue schema and silo identity',catalog.schema==='dreamledger/music-media-catalogue/v1'&&catalog.silo==='music-media');
check('catalogue is empty and checkout remains fail-closed',Array.isArray(catalog.products)&&catalog.products.length===0&&catalog.status==='BUILD_NO_PUBLISHED_LISTINGS');
check('page reads the silo-specific catalogue',read(rootPage).includes('fetch(config.catalogue_path')&&read(rootPage).includes('"catalogue_path":"/data/music-media-catalog.json"'));
check('build-gated Music & Media is hidden from active directory',directory.silos.every(s=>s.status==='active')&&!directory.silos.some(s=>s.key==='MUSIC_MEDIA'));
hold('MEDIA_LISTING_WORKFLOW_NOT_IMPLEMENTED','The catalogue and rights gates exist, but a complete seller listing/upload and fulfilment workflow is not yet verified.');
hold('NO_VERIFIED_MEDIA_TRANSACTIONS','No independent buyer, settled payment, fulfilled order, or delivered media outcome is evidenced.');
const failures=checks.filter(c=>!c.ok);
const proof={schema:'DREAMLEDGER/MUSIC-MEDIA-VERIFICATION/v2',status:failures.length?'FAIL':holds.length?'PASS_WITH_HOLDS':'PASS',launch_ready:failures.length===0&&holds.length===0,checks,holds,failed_checks:failures.length,truth:{verified_external_revenue_nzd:0,settled_external_payments:0,independent_external_buyers:0,paid_fulfilled_orders:0,verified_outcomes:0}};
console.log(JSON.stringify(proof,null,2));
if(failures.length)process.exitCode=1;
