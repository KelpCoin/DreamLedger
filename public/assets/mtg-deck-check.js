/* Browser-only subset of the existing MTG diagnostic first-pass rule engine.
   No payment, inventory, account, storage, or network requests. */
(function(root,factory){
  'use strict';
  var engine=factory();
  if(typeof module==='object'&&module.exports)module.exports=engine;
  if(root)root.DreamLedgerMtgDeckCheck=engine;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var CATEGORIES={
    land:/\b(island|swamp|mountain|forest|plains|command tower|path of ancestry|temple|guildgate|land)\b/i,
    ramp:/\b(sol ring|arcane signet|signet|talisman|cultivate|kodama|rampant growth|fellwar stone|mana crypt|mana vault)\b/i,
    draw:/\b(phyrexian arena|rhystic study|mystic remora|sign in blood|harmonize|faithless looting|brainstorm|ponder|preordain|read the bones)\b/i,
    interaction:/\b(swords to plowshares|path to exile|beast within|generous gift|pongify|rapid hybridization|terminate|counterspell|go for the throat|hero's downfall|cyclonic rift|wrath|damnation)\b/i
  };
  function parseDecklist(text) {
    if(typeof text!=='string'||text.length>30000)throw Error('Decklist missing or too long (maximum 30,000 characters).');
    var entries=text.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
    if(entries.length<10)throw Error('Include at least ten card lines for a useful structural check.');
    if(entries.length>200)throw Error('Decklist has too many lines (maximum 200).');
    var cards=[];
    entries.forEach(function(line){
      if(line.length>220)throw Error('One or more card names are too long.');
      var parsed=line.match(/^(\d{1,3})x?\s+(.+)$/i);
      var qty=parsed?Number(parsed[1]):1;
      var name=(parsed?parsed[2]:line)
        .replace(/\s+\([A-Za-z0-9]{2,6}\)\s+\d+[A-Za-z]?\s*$/,'')
        .replace(/\s+\[[A-Za-z0-9]{2,6}\]\s*$/,'').trim();
      if(qty<1||qty>20||!Number.isInteger(qty)||name.length<2||name.length>150)
        throw Error('Check card quantities and card names (each quantity must be 1–20).');
      cards.push({qty:qty,name:name});
    });
    return cards;
  }
  function analyze(text) {
    var cards=parseDecklist(text);
    var byCategory={land:0,ramp:0,draw:0,interaction:0};
    var total=0;
    cards.forEach(function(card){
      total+=card.qty;
      Object.keys(CATEGORIES).forEach(function(key){
        if(CATEGORIES[key].test(card.name))byCategory[key]+=card.qty;
      });
    });
    var issues=[];
    if(total<99)issues.push('Under 99 cards were supplied. A typical Commander deck has 100 cards including its commander.');
    if(total>100)issues.push('Over 100 cards were supplied. Review quantities and whether your commander is included.');
    if(byCategory.land<30)issues.push('Fewer than 30 lands were recognised by this limited card-name heuristic. Many nonbasic lands are not recognised.');
    if(byCategory.ramp<7)issues.push('Fewer than seven familiar ramp cards were recognised. Review your actual mana acceleration.');
    if(byCategory.draw<6)issues.push('Fewer than six familiar draw effects were recognised. Review your card advantage.');
    if(byCategory.interaction<7)issues.push('Fewer than seven familiar interaction pieces were recognised. Check your removal and protection.');
    if(!issues.length)issues.push('No obvious structural issue was detected in the limited names recognised by this first-pass check.');
    return {
      schema:'dreamledger/mtg-free-local-deck-check/v1',
      status:'LOCAL_HEURISTIC_ONLY',
      card_lines:cards.length,declared_card_count:total,
      recognised_by_name:byCategory,
      review_notes:issues,
      caveat:'Name-pattern recognition only: dual lands, most ramp, synergy, mana curve, colour identity, legality, budget, power level and win rates are NOT verified.',
      external_actions:false,network_calls:0,payment_required:false,
      raw_decklist_retained:false
    };
  }
  return {parseDecklist:parseDecklist,analyze:analyze};
});
