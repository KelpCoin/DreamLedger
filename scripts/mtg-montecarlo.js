'use strict';
/* Statistical draw experiment only. Not a rules engine, opponent model, or win-rate estimator. */
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
function flatten(deck){
  const boards=deck.boards||{},commander=boards.commander||[],main=boards.main||[];
  const expand=a=>a.flatMap(x=>{const qty=typeof x==='string'?1:Math.max(1,Math.min(99,Number(x.qty||x.quantity||1)||1));return Array(qty).fill(typeof x==='string'?x:x.name);});
  return {main:expand(main),commander:expand(commander)};
}
function simulate(deck,{seed=20261022,trials=20000,lands=['Mountain','Plains','Accursed Duneyard','Fields of Strife','Hidden Volcano']}={}){
  const d=flatten(deck),all=[...d.main,...d.commander];
  if(all.length!==100||d.commander.length!==1)throw Error('Commander deck must have exactly 100 cards including one commander');
  if(!Number.isInteger(trials)||trials<1000||trials>1000000)throw Error('Invalid trial count');
  const allowed=new Set(lands.map(x=>x.toLowerCase())); const land=n=>allowed.has(String(n).toLowerCase());
  const landCount=d.main.filter(land).length;if(landCount<1)throw Error('No recognized lands. Provide land names before simulation');
  const rand=rng(seed);let opening=0,hit3=0,hit4=0,mulligans=0;
  for(let t=0;t<trials;t++){
    const cards=d.main.slice();
    for(let j=cards.length-1;j>0;j--){const k=Math.floor(rand()*(j+1));[cards[j],cards[k]]=[cards[k],cards[j]];}
    let hand=cards.slice(0,7),start=7,kept=0,offset=7;
    // First mulligan is free in multiplayer Commander. Draw a fresh 7 for each attempt.
    for(let m=0;m<3;m++){
      const n=hand.filter(land).length;
      if(n>=2&&n<=4){kept=1;break;}
      if(m===2)break;
      mulligans++;for(let j=cards.length-1;j>0;j--){const k=Math.floor(rand()*(j+1));[cards[j],cards[k]]=[cards[k],cards[j]];}
      hand=cards.slice(0,7);start=7;
      if(m===1){ // A later mulligan keeps 6; London bottom one nonland if possible.
        const idx=hand.findIndex(x=>!land(x));
        hand.splice(idx===-1?hand.length-1:idx,1);
        start=6;
      }
    }
    const in7=hand.filter(land).length;if(in7>=2&&in7<=4)opening++;
    // Always draw on turn one: Commander multiplayer assumption. This is land-access, not gameplay.
    const third=[...hand,...cards.slice(start,start+3)].filter(land).length;
    const fourth=[...hand,...cards.slice(start,start+4)].filter(land).length;
    if(third>=3)hit3++;if(fourth>=4)hit4++;
  }
  const pct=n=>Math.round(10000*n/trials)/100;
  return {schema:'dreamledger/mtg-statistical-draw-experiment/v1',deck_id:deck.id||null,commander:deck.commander||d.commander[0],source:deck.source||null,source_path:'public/data/decklists/quintorius.json',status:'SIMULATED_NOT_GAMEPLAY_VALIDATED',engine:'seeded Monte Carlo draw sampling',seed,trials,commander_cards:d.commander.length,deck_cards:all.length,identified_lands:landCount,land_identification:'explicit named lands; no live card oracle validation',rules:{format:'multiplayer Commander',draw_first_turn:true,mulligan:'free first, simplified London approximation, target 2–4 land opening',turns:4},metrics:{opening_keepable_pct:pct(opening),three_lands_by_turn_three_pct:pct(hit3),four_lands_by_turn_four_pct:pct(hit4),mean_mulligans:Math.round(100*mulligans/trials)/100},strengths:['Named land base contains '+landCount+' of 99 main-deck cards','All 100 deck cards are represented in this import'],caveats:['A statistical land-draw proxy, not a Forge or Cockatrice gameplay result','No card ability or interaction modeling; cannot predict game win rate','Card printings, ownership, condition and card-type classifications require seller verification'],claim_boundary:'Never claim 4-player win percentage, power level or turn-of-commander from this report.'};
}
module.exports={simulate,flatten};
if(require.main===module){
  const fs=require('fs'),p=require('path');
  const input=process.argv[2],out=process.argv[3];
  if(!input)throw Error('Usage: node scripts/mtg-montecarlo.js path/to/deck.json [report.json]');
  const report=simulate(JSON.parse(fs.readFileSync(input,'utf8')));
  if(out){fs.mkdirSync(p.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
  else process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
