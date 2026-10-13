'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const json=p=>JSON.parse(read(p));
const DEFAULT='silos/music-media/silo.json';
function compile(manifestPath=DEFAULT,checkOnly=false){
 const master=json('silos/mtg/silo.json'),candidate=json(manifestPath);
 const manifests=[master,candidate],rp='docs/BECK-EMPIRE-SILO-REGISTRY.json',fp='docs/BECK-SILO-FEE-POLICY.json';
 const registry=json(rp),policy=json(fp);
 function upsert(m){
  const i=m.identity||{},slug=i.slug,key=slug==='mtg'?'MTG':String(m.silo_key||slug.toUpperCase().replace(/-/g,'_')),id='dreamledger-'+slug,fee=slug==='mtg'?0:500;
  if(!slug||i.canonical_path!=='/'+slug+'/'||i.catalog_path!=='/data/'+slug+'-catalog.json')throw Error('Invalid manifest identity '+slug);
  if(registry.silos[key]&&registry.silos[key].id!==id)throw Error('Duplicate silo key '+key);
  const collision=Object.entries(registry.silos).find(([k,v])=>k!==key&&v.id===id);if(collision)throw Error('Duplicate silo id '+id);
  registry.silos[key]={...(registry.silos[key]||{}),id,public_domains:['dreamledger.org'],public_prefixes:['/'+slug],platform_fee_bps:fee,status:slug==='mtg'?'active':(m.status||'build'),first_dollar_priority:slug==='mtg'?1:(m.first_dollar_priority||99),cross_silo_forbidden_domains:m.cross_silo_forbidden_domains||[],cross_silo_forbidden_terms:m.cross_silo_forbidden_terms||[]};
  policy.rules[id]={silo:key,domain:'dreamledger.org/'+slug,platform_fee_bps:fee,label:fee===0?'0% forever':'5% flat'};
 }
 for(const m of manifests)upsert(m);
 for(const k of Object.keys(registry.silos))if(k.startsWith('TCG_'))delete registry.silos[k];
 for(const k of Object.keys(policy.rules))if(/^dreamledger-(pokemon|onepiece|yugioh|lorcana|riftbound|gundam|digimon)$/.test(k))delete policy.rules[k];
 if(registry.silos.MTG?.platform_fee_bps!==0)throw Error('MTG must remain 0 bps');
 for(const [k,v] of Object.entries(registry.silos))if(k!=='MTG'&&Number(v.platform_fee_bps)!==500)throw Error('Non-MTG fee invariant failed: '+k);
 for(const [k,v] of Object.entries(policy.rules))if(k!=='dreamledger-mtg'&&Number(v.platform_fee_bps)!==500)throw Error('Fee policy invariant failed: '+k);
 const directory={schema:'dreamledger/silo-directory/v1',updated:'2026-10-14',silos:Object.entries(registry.silos).filter(([k,v])=>v.status==='active'&&Array.isArray(v.public_prefixes)&&v.public_prefixes.length).map(([k,v])=>({key:k,name:k==='MTG'?'Magic: The Gathering':k,route:v.public_prefixes[0].endsWith('/')?v.public_prefixes[0]:v.public_prefixes[0]+'/',status:v.status}))};
 const outputs={[rp]:JSON.stringify(registry,null,2)+'\n',[fp]:JSON.stringify(policy,null,2)+'\n','data/silo-directory.json':JSON.stringify(directory,null,2)+'\n','public/data/silo-directory.json':JSON.stringify(directory,null,2)+'\n'};
 const drift=[];
 for(const [rel,body] of Object.entries(outputs)){if(checkOnly){if(!fs.existsSync(path.join(ROOT,rel))||read(rel)!==body)drift.push(rel);}else{fs.mkdirSync(path.dirname(path.join(ROOT,rel)),{recursive:true});fs.writeFileSync(path.join(ROOT,rel),body,'utf8');}}
 const proof={schema:'DREAMLEDGER/SILO-REGISTRY-COMPILER/v1',status:drift.length?'FAIL':checkOnly?'PASS':'GENERATED',manifests:manifests.map(m=>m.identity.slug),registered_silos:Object.keys(registry.silos).length,active_silos:directory.silos.map(s=>s.key),generated_files:Object.keys(outputs),drift};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;return proof;
}
if(require.main===module){const args=process.argv.slice(2),idx=args.indexOf('--manifest');compile(idx<0?DEFAULT:args[idx+1],args.includes('--check'));}
module.exports={compile};
