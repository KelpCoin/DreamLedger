'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const music=read('runtime/cube/silo-manifests/music-media.json');
const tcg=read('public/data/tcg-swarm.json');
const args=process.argv.slice(2),manifestArg=args.indexOf('--manifest');
const requested=read(manifestArg>=0?args[manifestArg+1]:'runtime/cube/silo-manifests/music-media.json');
function compile(checkOnly=false){
 const rp='docs/BECK-EMPIRE-SILO-REGISTRY.json',fp='docs/BECK-SILO-FEE-POLICY.json';
 const registry=read(rp),policy=read(fp);
 function upsert(key,id,slug,fee,status,priority,terms=[]){
  if(registry.silos[key]&&registry.silos[key].id!==id)throw Error('Duplicate silo key '+key);
  const collision=Object.entries(registry.silos).find(([k,v])=>k!==key&&v.id===id);
  if(collision)throw Error('Duplicate silo id '+id);
  registry.silos[key]={id,public_domains:['dreamledger.org'],public_prefixes:['/'+slug],platform_fee_bps:fee,status,first_dollar_priority:priority,cross_silo_forbidden_domains:['amplissa.com'],cross_silo_forbidden_terms:terms};
  policy.rules[id]={silo:key,domain:'dreamledger.org/'+slug,platform_fee_bps:fee,label:fee===0?'0% forever':'5% flat'};
 }
 for(const m of [music,requested]){if(m.silo_key==='MTG'?m.platform_fee_bps!==0:m.platform_fee_bps!==500)throw Error('MTG must be 0 bps and non-MTG must be 500 bps');upsert(m.silo_key,m.silo_id,m.slug,m.platform_fee_bps,m.status,m.first_dollar_priority,m.cross_silo_forbidden_terms||[]);}
 for(const s of tcg.silos||[]){
  if(s.slug==='mtg'||s.status!=='clone')continue;
  upsert('TCG_'+s.slug.toUpperCase(),'dreamledger-'+s.slug,s.slug,500,'build',99,[]);
 }
 if(Number(registry.silos.MTG.platform_fee_bps)!==0)throw Error('MTG fee invariant broken');
 for(const [k,v] of Object.entries(registry.silos))if(k!=='MTG'&&Number(v.platform_fee_bps)!==500)throw Error('Non-MTG fee invariant broken: '+k);
 for(const [k,v] of Object.entries(policy.rules))if(k!=='dreamledger-mtg'&&Number(v.platform_fee_bps)!==500)throw Error('Fee policy invariant broken: '+k);
 const names={MTG:'Magic: The Gathering',MUSIC_MEDIA:music.name,AMPLISSA:'Amplissa',BBW_SSBBW:'Creator Marketplace',DREAMMEEZ:'DreamMeez',OTHER:'Other'};
 for(const s of tcg.silos||[])names['TCG_'+String(s.slug).toUpperCase()]=s.name;
 const directory={schema:'dreamledger/silo-directory/v1',updated:'2026-10-14',silos:Object.entries(registry.silos).filter(([k,v])=>v.status==='active'&&Array.isArray(v.public_prefixes)&&v.public_prefixes.length).map(([k,v])=>({key:k,name:names[k]||k,route:v.public_prefixes[0].endsWith('/')?v.public_prefixes[0]:v.public_prefixes[0]+'/',status:v.status}))};
 const outputs={[rp]:JSON.stringify(registry,null,2)+'\n',[fp]:JSON.stringify(policy,null,2)+'\n','data/silo-directory.json':JSON.stringify(directory,null,2)+'\n','public/data/silo-directory.json':JSON.stringify(directory,null,2)+'\n'};
 const drift=[];
 for(const [rel,body] of Object.entries(outputs)){
  const dest=path.join(root,rel);
  if(checkOnly){if(fs.readFileSync(dest,'utf8')!==body)drift.push(rel);}
  else fs.writeFileSync(dest,body,'utf8');
 }
 const proof={schema:'DREAMLEDGER/SILO-REGISTRY-COMPILER/v1',status:drift.length?'FAIL':checkOnly?'PASS':'GENERATED',registered_silos:Object.keys(registry.silos).length,generated_files:Object.keys(outputs),drift,tcg_clone_count:(tcg.silos||[]).filter(s=>s.status==='clone').length};
 console.log(JSON.stringify(proof,null,2));if(drift.length)process.exitCode=1;
}
if(require.main===module)compile(args.includes('--check'));
module.exports={compile};
