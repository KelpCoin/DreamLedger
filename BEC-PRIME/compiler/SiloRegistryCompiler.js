'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const DEFAULT='silos/music-media/silo.json';
const MASTER='silos/mtg/silo.json';
const TCG='public/data/tcg-swarm.json';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const args=process.argv.slice(2),mi=args.indexOf('--manifest');
const requestedPath=mi>=0?args[mi+1]:DEFAULT;
function compile(checkOnly=false){
 const tcg=read(TCG);
 const manifestDir=path.join(ROOT,'silos');
 const manifestPaths=fs.readdirSync(manifestDir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>'silos/'+d.name+'/silo.json').filter(p=>fs.existsSync(path.join(ROOT,p))).sort();
 if(!manifestPaths.includes(MASTER)||!manifestPaths.includes(requestedPath))throw Error('Requested manifest must be a canonical silo contract');
 const manifests=manifestPaths.map(read);
 const slugs=manifests.map(m=>m.identity&&m.identity.slug),keys=manifests.map(m=>m.silo_key||(m.identity.slug==='mtg'?'MTG':String(m.identity.slug).toUpperCase())),routes=manifests.map(m=>m.identity&&m.identity.canonical_path);
 if(new Set(slugs).size!==slugs.length||new Set(keys).size!==keys.length||new Set(routes).size!==routes.length)throw Error('Duplicate silo slug, key, or route');
 const registry=read('docs/BECK-EMPIRE-SILO-REGISTRY.json');
 const policy=read('docs/BECK-SILO-FEE-POLICY.json');
 registry.silos=registry.silos||{};policy.rules=policy.rules||{};
 function upsert(m){
  const i=m.identity||{},slug=i.slug,key=m.silo_key||(slug==='mtg'?'MTG':String(slug).toUpperCase());
  if(!slug||!i.canonical_path||i.catalog_path!=='/data/'+slug+'-catalog.json')throw Error('Invalid silo identity/catalogue '+slug);
  const fee=key==='MTG'?0:500;
  if(m.platform_fee_bps!==fee)throw Error('MTG=0 bps; every non-MTG silo=500 bps');
  const id='dreamledger-'+slug,route=i.canonical_path.endsWith('/')?i.canonical_path.slice(0,-1):i.canonical_path;
  const previous=registry.silos[key];
  if(previous&&previous.id!==id)throw Error('Silo key collision '+key);
  registry.silos[key]={...(previous||{}),id,public_domains:['dreamledger.org'],public_prefixes:[route],platform_fee_bps:fee,status:key==='MTG'?'active':(m.status||'build'),first_dollar_priority:key==='MTG'?1:(m.first_dollar_priority||99),cross_silo_forbidden_domains:m.cross_silo_forbidden_domains||['amplissa.com'],cross_silo_forbidden_terms:m.cross_silo_forbidden_terms||[]};
  policy.rules[id]={...(policy.rules[id]||{}),silo:key,domain:'dreamledger.org'+route,platform_fee_bps:fee,label:fee===0?'0% forever':'5% flat'};
 }
 for(const manifest of manifests)upsert(manifest);
 const clones=(tcg.silos||[]).filter(s=>s.status==='clone'&&s.slug!=='mtg');
 const previousTcgIds=Object.entries(registry.silos).filter(([key])=>key.startsWith('TCG_')).map(([,value])=>value.id);
 const cloneKeys=new Set(clones.map(s=>'TCG_'+s.slug.toUpperCase()));
 for(const key of Object.keys(registry.silos))if(key.startsWith('TCG_')&&!cloneKeys.has(key))delete registry.silos[key];
 const cloneIds=new Set(clones.map(s=>'dreamledger-'+s.slug));
 for(const id of previousTcgIds)if(id&&!cloneIds.has(id))delete policy.rules[id];
 for(const s of clones){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug)||s.route!=='/'+s.slug+'/')throw Error('Invalid TCG route '+s.slug);
  const key='TCG_'+s.slug.toUpperCase(),id='dreamledger-'+s.slug,route='/'+s.slug;
  registry.silos[key]={...(registry.silos[key]||{}),id,public_domains:['dreamledger.org'],public_prefixes:[route],platform_fee_bps:500,status:'build',first_dollar_priority:99,cross_silo_forbidden_domains:['amplissa.com'],cross_silo_forbidden_terms:['MTG','Magic: The Gathering','Commander','adult content','18+ content']};
  policy.rules[id]={...(policy.rules[id]||{}),silo:key,domain:'dreamledger.org'+route,platform_fee_bps:500,label:'5% flat'};
 }
 for(const [key,value] of Object.entries(registry.silos)){const fee=Number(value.platform_fee_bps);if(key==='MTG'?fee!==0:fee!==500)throw Error('Registry fee invariant violation '+key);}
 for(const [key,value] of Object.entries(policy.rules)){const fee=Number(value.platform_fee_bps);if(key==='dreamledger-mtg'?fee!==0:fee!==500)throw Error('Policy fee invariant violation '+key);}
 const names={};
 for(const manifest of manifests)names[manifest.silo_key||(manifest.identity.slug==='mtg'?'MTG':manifest.identity.slug.toUpperCase())]=manifest.identity.display_name;
 for(const s of tcg.silos||[])names['TCG_'+s.slug.toUpperCase()]=s.name;
 const directory={schema:'dreamledger/silo-directory/v1',updated:'2026-10-14',silos:Object.entries(registry.silos).filter(([k,v])=>v.status==='active'&&Array.isArray(v.public_prefixes)&&v.public_prefixes.length).map(([k,v])=>({key:k,name:names[k]||k,route:v.public_prefixes[0].endsWith('/')?v.public_prefixes[0]:v.public_prefixes[0]+'/',status:v.status}))};
 const outputs={'docs/BECK-EMPIRE-SILO-REGISTRY.json':JSON.stringify(registry,null,2)+'\n','docs/BECK-SILO-FEE-POLICY.json':JSON.stringify(policy,null,2)+'\n','data/silo-directory.json':JSON.stringify(directory,null,2)+'\n','public/data/silo-directory.json':JSON.stringify(directory,null,2)+'\n'};
 const drift=[];
 for(const [rel,body] of Object.entries(outputs)){const dest=path.join(ROOT,rel);if(checkOnly){if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==body)drift.push(rel);}else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body,'utf8');}}
 const proof={schema:'DREAMLEDGER/CUBE-SILO-REGISTRY/v1',status:drift.length?'FAIL':checkOnly?'PASS':'GENERATED',manifests:[...manifestPaths,TCG],tcg_clones:clones.map(s=>s.slug),files:Object.keys(outputs),drift};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;return proof;
}
if(require.main===module)compile(args.includes('--check'));
module.exports={compile};
