'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const checks=[],holds=[];
const check=(name,ok)=>checks.push({name,ok:!!ok});
const hold=(code,detail)=>holds.push({code,detail});
const data=json('public/data/tcg-swarm.json'),registry=json('docs/BECK-EMPIRE-SILO-REGISTRY.json'),policy=json('docs/BECK-SILO-FEE-POLICY.json');
const clones=['pokemon','onepiece','yugioh','lorcana','riftbound','gundam','digimon'];
check('MTG is the declared master',data.master==='mtg');
check('TCG slugs are unique',new Set(data.silos.map(x=>x.slug)).size===data.silos.length);
check('Shared intake route exists',fs.existsSync(path.join(root,'public/tcg-list.html')));
for(const slug of clones){
 const s=data.silos.find(x=>x.slug===slug),p=read('public/'+slug+'/index.html');
 check(slug+' exists in swarm manifest',!!s&&s.status==='clone');
 check(slug+' page declares its silo',p.includes('data-silo="'+slug+'"')&&p.includes('data-tcg-swarm="1"'));
 check(slug+' uses shared listing intake',p.includes('/tcg-list?game='+slug));
 check(slug+' has no direct Stripe checkout',!p.includes('buy.stripe.com')&&!p.includes('checkout_available'));
 check(slug+' fee policy is 500 bps',registry.silos['TCG_'+slug.toUpperCase()]?.platform_fee_bps===500&&policy.rules['dreamledger-'+slug]?.platform_fee_bps===500);
 check(slug+' remains build-gated',registry.silos['TCG_'+slug.toUpperCase()]?.status==='build');
}
const hub=read('public/tcg/index.html');
check('TCG hub references canonical swarm data',hub.includes('tcg-swarm.json'));
hold('NO_VERIFIED_TCG_TRANSACTIONS','These are discovery/intake clones, not proof of inventory, settlement, fulfilment, or delivered outcomes.');
const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({schema:'DREAMLEDGER/TCG-SWARM-GAUNTLET/v1',verdict:failed.length?'FAIL':'PASS_WITH_HOLDS',launch_ready:false,clone_count:clones.length,checks,holds,failed_checks:failed.length,truth:{verified_external_revenue_nzd:0,settled_external_payments:0,independent_external_buyers:0,paid_fulfilled_orders:0,verified_outcomes:0}},null,2));
if(failed.length)process.exitCode=1;
