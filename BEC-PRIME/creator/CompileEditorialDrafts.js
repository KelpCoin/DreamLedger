'use strict';
// Source-backed ContentOS: draft-only adapter for existing CreatorCommerceFactory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Factory=require('./CreatorCommerceFactory');
const profiles=require('./voice-profiles.json');
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
function compile(b){
 if(!b || b.schema!=='BECK/CREATOR-BRIEF/v1')throw Error('BAD_SCHEMA');
 for(const k of ['silo_id','source_id'])if(!/^[a-z][a-z0-9-]{2,63}$/.test(b[k]||''))throw Error('BAD_ID');
 for(const k of ['brand','audience','title','thesis','body'])
   if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>20000)throw Error('BAD_'+k);
 if(!['owned','licensed'].includes(b.rights))throw Error('RIGHTS_REQUIRED');
 if(b.rights==='licensed'&&!b.license_reference)throw Error('LICENSE_REQUIRED');
 if(!Array.isArray(b.evidence_refs)||!b.evidence_refs.length||!b.evidence_refs.every(x=>typeof x==='string'&&(/^(https:\/\/|repo:)/.test(x))))throw Error('EVIDENCE_REQUIRED');
 if(b.approved_for_publication===true)throw Error('NO_SELF_APPROVAL');
 if(/<script\b|javascript:|sk_live_|whsec_/i.test(JSON.stringify(b)))throw Error('UNSAFE_SOURCE');
 if(b.voice_profile_id&&!profiles.profiles.some(p=>p.id===b.voice_profile_id))throw Error('UNKNOWN_VOICE');
 if(b.product?.rail==='patreon_shop'&&/buy\.stripe\.com|stripe payment link/i.test(JSON.stringify(b)))throw Error('EXTERNAL_PATREON_CHECKOUT');
 if(b.product?.rail==='patreon_shop'&&(!Number.isInteger(b.product.price_nzd)||!b.product.delivery_terms))throw Error('SHOP_TERMS_REQUIRED');
 if(b.product&& !['none','patreon_shop'].includes(b.product.rail))throw Error('UNKNOWN_RAIL');
 const f=Factory.snapshot();
 const profile=profiles.profiles.find(p=>p.id===b.voice_profile_id);
 const lead='# '+b.title+'\n\n'+b.thesis.trim()+'\n\n';
 const article=lead+b.body.trim()+'\n';
 const files={
  'patreon-free-DRAFT.md':article+'\nDRAFT: publication and accuracy approval required.\n',
  'discord-pointer-DRAFT.md':'# '+b.title+'\n\n'+b.thesis.trim()+'\n\nDRAFT: add verified link after post is live. No paid content.\n',
  'owned-web-preview-DRAFT.md':article+'\nDRAFT: not a live offer or approved checkout.\n',
  'editorial-approval-DRAFT.md':'# '+b.silo_id+' review\n\nRights: '+b.rights+
    '\nEvidence: '+b.evidence_refs.join(', ')+
    '\nVoice: '+(profile?profile.name:'unverified')+
    '\nRequire founder review of claims, rights, voice, capacity, legal obligations, publishing permissions and price.\n'
 };
 if(b.members_only){
  if(typeof b.members_only!=='string')throw Error('BAD_MEMBERS');
  files['patreon-members-PRIVATE-DRAFT.md']=lead+b.members_only+'\n\nPRIVATE MEMBER DRAFT: do not redistribute.\n';
 }
 if(b.product?.rail==='patreon_shop'){
  files['patreon-shop-DRAFT.md']=article+
    '\nProposed NZ$'+b.product.price_nzd+' (verify live displayed currency, platform support and price).\n\n'+
    b.product.delivery_terms+'\n\nCustom product is prepared after purchase; immediate unlock is only instructions. No proven Shop one-sale cap. Statutory rights apply.\n';
  files['patreon-instructions-DRAFT.md']='# '+b.title+
    '\n\nMessage the creator through Patreon with an accessible decklist, commander and optional playgroup details.\n\n'+
    b.product.delivery_terms+'\n\nDo not purchase twice. Contact creator about broken or private lists.\n';
 }
 const id=b.silo_id+'-'+hash(JSON.stringify(b)).slice(0,16);
 const manifest={schema:'BECK/CREATOR-DRAFT-PACK/v1',id,silo_id:b.silo_id,source_id:b.source_id,rights:b.rights,
  source_sha256:hash(JSON.stringify(b)),voice_profile:profile?.id||null,
  voice_sources:profile?.source_urls||[],voice_style_review_required:true,
  existing_factory:'BEC-PRIME/creator/CreatorCommerceFactory.js',
  word_bank_schema:f.word_bank.schema_version,stencil_schema:f.stencils.schema_version,
  files_sha256:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)])),
  status:'DRAFT_ONLY',published:false,paid_customer_count:0,verified_revenue_nzd:0,
  publication_approval_required:true,auto_publishing:false};
 files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';
 return {manifest,files};
}
function run(input,out){
 const b=JSON.parse(fs.readFileSync(input,'utf8')),r=compile(b);
 const d=path.resolve(out,r.manifest.id);fs.mkdirSync(d,{recursive:true});
 for(const [name,content] of Object.entries(r.files))fs.writeFileSync(path.join(d,name),content,{mode:0o600});
 return {out:d,id:r.manifest.id,status:r.manifest.status,files:Object.keys(r.files)};
}
if(require.main===module){
 try{const [input,out='operator-proof/creator-drafts']=process.argv.slice(2);
  if(!input)throw Error('USAGE: node CompileEditorialDrafts.js brief.json [output]');
  console.log(JSON.stringify(run(input,out),null,2));
 }catch(e){console.error('BLOCKED:',e.message);process.exitCode=1;}
}
module.exports={compile,run};
