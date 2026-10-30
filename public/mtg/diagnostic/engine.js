'use strict';
/* Pure, deterministic rule engine. Not a tournament, legality or price service. */
(function(root,factory){
 const exports=factory();
 if(typeof module==='object'&&module.exports) module.exports=exports;
 if(root) root.MTGFreeDiagnostic=exports;
})(typeof window!=='undefined'?window:null,function(){
 function evaluate(deck,cards){
   if(!deck||!deck.boards||!Array.isArray(deck.boards.main)||!Array.isArray(deck.boards.commander))throw Error('Invalid deck input');
   const names=deck.boards.main.concat(deck.boards.commander);
   const index=new Map((cards||[]).filter(Boolean).map(x=>[String(x.name||'').toLowerCase(),x]));
   const counts=new Map();names.forEach(n=>{const key=String(n||'').toLowerCase();counts.set(key,(counts.get(key)||0)+1)});
   let resolved=0,lands=0,mana=0,nonlands=0,spirit=0,graveyard=0,low=0,high=0;
   for(const [name,count] of counts){
     const c=index.get(name);if(!c)continue;
     resolved+=count;
     const type=String(c.type_line||''),oracle=String(c.oracle_text||''),cmc=Number(c.cmc);
     if(/\bLand\b/i.test(type)){lands+=count;continue}
     if(Number.isFinite(cmc)){mana+=cmc*count;nonlands+=count;if(cmc<=2)low+=count;if(cmc>=5)high+=count}
     if(/\bspirit\b/i.test(type+' '+oracle))spirit+=count;
     if(/\bgraveyard\b|\bflashback\b|\bescape\b|\bunearth\b|\bdisturb\b/i.test(oracle))graveyard+=count;
   }
   const total=names.length,missing=total-resolved;
   const curve=nonlands?Math.round((mana/nonlands)*100)/100:null;
   const scores=[
     {name:'Land count',value:resolved===total?lands+' / '+total:'Uncertain ('+lands+' observed)',status:missing>0?'QUARANTINE':lands<28||lands>44?'FAIL':lands>=33&&lands<=40?'PASS':'QUARANTINE',note:'Informal Commander reference range: 33-40 lands; not a rule of legality.'},
     {name:'Mana curve',value:curve===null?'Unresolved':curve.toFixed(2)+' average mana value',status:missing>0||curve===null?'QUARANTINE':curve>4.4?'FAIL':curve<=3.5?'PASS':'QUARANTINE',note:'Average mana value of identifiable nonlands; low-value cards '+low+', 5+ mana value cards '+high+'.'},
     {name:'Visible Spirit / graveyard indicators',value:'Spirit indicators '+spirit+'; graveyard indicators '+graveyard,status:missing>0?'QUARANTINE':spirit+graveyard>=12?'PASS':spirit+graveyard<4?'QUARANTINE':'QUARANTINE',note:'Informational keyword proxy only; lack of these themes does not mean other Commander archetypes fail. No gameplay simulation or expert judgment.'}
   ];
   const status=missing>0?'QUARANTINE':scores.some(x=>x.status==='FAIL')?'FAIL':scores.every(x=>x.status==='PASS')?'PASS':'QUARANTINE';
   return {schema:'dreamledger/mtg-free-diagnostic/v1',deck_id:deck.id,deck_name:deck.name||deck.commander,commander:deck.commander,verdict:status,deck_cards:total,matched_cards:resolved,unresolved:missing,land_count:lands,average_nonland_mana_value:curve,indicators:{spirit,graveyard},checks:scores,disclaimer:'Informal analysis only. No card-legality, price or tournament-performance evaluation. No full playtesting.'};
 }
 return {evaluate};
});