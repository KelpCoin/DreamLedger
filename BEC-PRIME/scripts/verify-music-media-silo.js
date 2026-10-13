'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),json=p=>JSON.parse(read(p));
const checks=[];const check=(name,ok)=>checks.push({name,ok:!!ok});
for(const p of ['music-media/index.html','public/music-media/index.html','data/music-media-catalog.json','public/data/music-media-catalog.json','music-media.html','public/music-media.html','silos/music-media/silo.json','docs/BECK-EMPIRE-SILO-REGISTRY.json','docs/BECK-SILO-FEE-POLICY.json'])check('required file: '+p,fs.existsSync(path.join(ROOT,p)));
const m=json('silos/music-media/silo.json'),c=json('data/music-media-catalog.json'),reg=json('docs/BECK-EMPIRE-SILO-REGISTRY.json'),fees=json('docs/BECK-SILO-FEE-POLICY.json');
check('Music & Media manifest follows canonical clone schema',m.$schema==='dreamledger/silo-clone/v1'&&m.identity.slug==='music-media');
check('Music & Media catalogue is isolated and empty',c.silo==='music-media'&&Array.isArray(c.products)&&c.products.length===0&&c.status==='BUILD_NO_PUBLISHED_LISTINGS');
check('root/public shell copies match',read('music-media/index.html')===read('public/music-media/index.html'));
check('root/public catalogue copies match',read('data/music-media-catalog.json')===read('public/data/music-media-catalog.json'));
check('root/public legacy aliases match',read('music-media.html')===read('public/music-media.html'));
check('generated page differs from master only by slug',read('public/music-media/index.html')===read('public/mtg/index.html').replace('data-silo="mtg"','data-silo="music-media"'));
check('public manifest mirrors canonical Music & Media manifest',read('public/silos/music-media/silo.json')===JSON.stringify(m,null,2)+'\\n');
check('registry declares Music & Media build-only at 500 bps',reg.silos.MUSIC_MEDIA?.id==='dreamledger-music-media'&&reg.silos.MUSIC_MEDIA?.status==='build'&&reg.silos.MUSIC_MEDIA?.platform_fee_bps===500);
check('fee policy declares Music & Media at 500 bps',fees.rules['dreamledger-music-media']?.platform_fee_bps===500);
check('build-gated catalogue has no published inventory',m.status==='active'||!c.products.some(p=>p.status==='published'));
check('every listing remains isolated to Music & Media',c.products.every(p=>p.silo==='music-media'));
for(const p of c.products){if(p.checkout_available===true)check('checkout requires verified rights and delivery: '+(p.id||p.title||'listing'),p.rights_status==='verified'&&p.delivery_status==='verified'&&/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(p.checkout_url||''));}
const failed=checks.filter(c=>!c.ok);console.log(JSON.stringify({schema:'DREAMLEDGER/MUSIC-MEDIA-GAUNTLET/v1',verdict:failed.length?'FAIL':'PASS_WITH_HOLDS',checks,failed_checks:failed.length,holds:[{code:'CAPABILITY_READINESS',detail:'The shell and empty catalogue can be cloned, but unresolved payment/fulfilment/community capabilities still block activation.'}]},null,2));if(failed.length)process.exit(1);
