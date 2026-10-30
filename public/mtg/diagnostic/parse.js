'use strict';
/* Scryfall-style text decklist parser. Never uploads text to DreamLedger. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MTGDeckParser=api;
})(typeof window!=='undefined'?window:null,function(){
  function parse(raw,commander){
    if(typeof raw!=='string'||raw.length>30000)throw Error('Decklist must be 30,000 characters or less.');
    if(typeof commander!=='string'||!commander.trim()||commander.length>180)throw Error('Enter the commander name.');
    const counts=new Map(),ignored=[],bad=[];let section='main';
    const lines=raw.replace(/\r/g,'').split('\n');
    if(lines.length>400)throw Error('Too many lines. Limit 400.');
    for(let i=0;i<lines.length;i++){
      const l=lines[i].trim();
      if(!l||l.startsWith('//')||l.startsWith('#'))continue;
      if(/^(commander|commanders|deck|mainboard|main deck)\s*:?$/i.test(l)){section=/^commander/i.test(l)?'commander':'main';continue}
      if(/^(sideboard|maybeboard|considering|tokens)\s*:?$/i.test(l)){section='excluded';continue}
      if(section==='excluded'){ignored.push(l);continue}
      let match=l.match(/^(\d{1,3})\s*x?\s+(.+)$/i);
      if(!match)match=l.match(/^x(\d{1,3})\s+(.+)$/i);
      const qty=match?Number(match[1]):1;
      let name=(match?match[2]:l).replace(/\s+\*F\*$/i,'').replace(/\s+\([A-Za-z0-9]{2,8}\)\s+\w{1,10}\s*$/,'').trim();
      if(!name||name.length>180||qty<1||qty>100||/[<>]/.test(name)){bad.push({line:i+1,text:l.slice(0,120)});continue}
      const key=name.toLocaleLowerCase('en');
      const item=counts.get(key)||{name,quantity:0,section};
      item.quantity+=qty;
      counts.set(key,item);
    }
    const target=commander.trim().toLocaleLowerCase('en');
    let commanderQty=counts.get(target)?.quantity||0;
    let main=[];
    for(const [key,x] of counts){let q=x.quantity;if(key===target){q-=1;commanderQty=1}for(let i=0;i<q;i++)main.push(x.name)}
    const total=main.length+commanderQty;
    const warnings=[];
    if(total!==100)warnings.push('Commander deck requires exactly 100 cards including the commander. Parsed '+total+'.');
    if(!commanderQty)warnings.push('Commander name not found in the supplied decklist.');
    if(bad.length)warnings.push('Some lines could not be parsed.');
    if(main.length>125)warnings.push('Unexpected deck size.');
    return {schema:'dreamledger/mtg-deck-import/v1',commander:commander.trim(),total,cards:[...counts.values()].map(x=>({name:x.name,quantity:x.quantity})),deck:{id:'USER_LOCAL_DECK',name:commander.trim()+' Commander',commander:commander.trim(),boards:{commander:commanderQty?[commander.trim()]:[],main}},ignored:ignored.length,invalid_lines:bad,warnings,valid:warnings.length===0};
  }
  return {parse};
});
