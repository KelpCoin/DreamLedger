'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const failures = [];
function need(rel, label) {
  if (!fs.existsSync(path.join(ROOT, rel))) failures.push(`MISSING=${label}:${rel}`);
}
need('website/mtg-catalog.html','MTG_SOURCE');
need('compiled/website/mtg/index.html','MTG_COMPILED');
need('compiled/website/cinema.html','CINEMA_COMPILED');
need('item-schema/ITEM-CONTRACT-v1.json','ITEM_CONTRACT');
need('../docs/dreammeez-avatar-game-contract.md','DREAMMEEZ_CONTRACT');
need('supabase/migrations/20260822_dreammeez_cross_game_items.sql','SUPABASE_MIGRATION');
const source=fs.readFileSync(path.join(ROOT,'website/mtg-catalog.html'),'utf8');
const compiled=fs.readFileSync(path.join(ROOT,'compiled/website/mtg/index.html'),'utf8');
const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'item-schema/ITEM-CONTRACT-v1.json'),'utf8'));
if (!source.includes('/api/products')) failures.push('MTG_SOURCE_PRODUCT_API=FAIL');
if (!source.includes('/api/checkout/create')) failures.push('MTG_SOURCE_CHECKOUT=FAIL');
if (!source.includes('/cinema.html')) failures.push('MTG_SOURCE_CINEMA=FAIL');
if (!compiled.includes('/cinema.html')) failures.push('MTG_COMPILED_CINEMA=FAIL');
if (!compiled.includes('major_nzd')) failures.push('MTG_PRICE_UNIT_MARKER=FAIL');
if (contract.id_rules.avatar !== 'DRMZ-AVT-####') failures.push('AVATAR_ID_RULE=FAIL');
if (contract.id_rules.item !== 'DRMZ-ITM-####') failures.push('ITEM_ID_RULE=FAIL');
if (!contract.rules.some(x=>x.includes('same canonical item'))) failures.push('CROSS_GAME_RULE=FAIL');
const result={schema:'BEC-PRIME/MTG-DREAMMEEZ-VERIFICATION/v1',status:failures.length?'FAIL':'PASS',utc:new Date().toISOString(),mtg_catalog:true,cinema:true,dreammeez_item_contract:true,failures};
const out=path.join(ROOT,'PROOF-MTG-DREAMMEEZ-VERIFICATION.json');
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify(result,null,2));
process.exit(failures.length?1:0);
