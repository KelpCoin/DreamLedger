#!/usr/bin/env node
// Deterministic adapter for the EXISTING /quote-comparison/ browser JSON export.
// Draft only. No payment validation, customer communication, API or database access.
import {readFile,mkdir,writeFile,rename,stat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
function sha(v){return createHash('sha256').update(v).digest('hex')}
function arg(name){const i=process.argv.indexOf(name);return i<0?'':process.argv[i+1]||''}
function clean(v){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim()}
function csvCell(v){
 let s=clean(v);
 if(/^[\s]*[=+@]/.test(s)||/^[\s]*-[^0-9]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function money(v,name){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e10)throw Error('INVALID_NONNEGATIVE_NUMBER:'+name);
 return Math.round(v*100)/100;
}
function qnumber(v){return v===null?'UNKNOWN':v.toFixed(2)}
const input=arg('--input');
const output=arg('--output');
if(!input||!output)throw Error('USAGE: node scripts/quote-compare-49-from-worksheet.mjs --input worksheet.json --output private-folder');
const raw=await readFile(resolve(input));
if(raw.length>1024*1024)throw Error('WORKSHEET_TOO_LARGE');
let body;try{body=JSON.parse(raw)}catch{throw Error('WORKSHEET_NOT_JSON')}
if(!Array.isArray(body.quotes)||body.quotes.length<2||body.quotes.length>5)throw Error('REQUIRE_2_TO_5_QUOTATIONS');
if(body.truth_status!=='USER_ENTERED_COMPARISON_NOT_INDEPENDENTLY_VERIFIED')throw Error('UNRECOGNISED_WORKSHEET_SOURCE');
const currency=clean(body.currency||'NZD').toUpperCase();
if(!/^[A-Z]{3}$/.test(currency))throw Error('INVALID_CURRENCY');
const requirements=clean(body.requirements),unknowns=[];
if(!requirements)unknowns.push('Purchase requirements were not specified');
const rows=body.quotes.map((q,i)=>{
 if(!q||typeof q!=='object'||Array.isArray(q))throw Error('INVALID_QUOTATION_ROW');
 const supplier=clean(q.supplier),price=money(q.price,'price'),delivery=money(q.delivery,'delivery');
 if(!supplier||price===null)throw Error('SUPPLIER_AND_PRICE_REQUIRED:'+String(i+1));
 if(delivery===null)unknowns.push('Supplier '+String(i+1)+' delivery price is unknown (not assumed free)');
 for(const key of ['lead_time','moq','terms'])if(!clean(q[key]))unknowns.push('Supplier '+String(i+1)+' '+key+' is unknown');
 return {supplier,price,delivery,known_subtotal:Math.round((price+(delivery||0))*100)/100,
  delivery_unknown:delivery===null?'YES':'NO',lead_time:clean(q.lead_time)||'UNKNOWN',
  moq:clean(q.moq)||'UNKNOWN',terms:clean(q.terms)||'UNKNOWN',notes:clean(q.notes)||'UNKNOWN'};
});
const header=['supplier','price','delivery','known_subtotal','delivery_unknown','lead_time','moq','terms','notes'];
const csv=header.join(',')+'\n'+rows.map(r=>header.map(k=>csvCell(r[k]===null?'UNKNOWN':r[k])).join(',')).join('\n')+'\n';
const summary=[
 '# Supplier comparison - OPERATOR DRAFT',
 '',
 'STATUS: DRAFT_NOT_PAID_OR_DELIVERED',
 'SOURCE: Customer-entered browser worksheet; quotations not independently verified.',
 'CURRENCY: '+currency,
 'REQUIREMENTS: '+(requirements||'UNKNOWN'),
 '',
 '## Compared known amounts only',
 ...rows.map((r,i)=>String(i+1)+'. '+r.supplier+': entered price '+qnumber(r.price)+
   ', separately entered delivery '+qnumber(r.delivery)+', known subtotal '+qnumber(r.known_subtotal)+
   (r.delivery_unknown==='YES'?' (delivery unknown; not fully comparable)':'')),
 '',
 '## Missing information',
 ...(unknowns.length?unknowns.map(x=>'- '+x):['- No missing fields detected in worksheet; original documents still require review']),
 '',
 '## Scope and safety',
 '- No supplier is independently verified here.',
 '- No tax, discounts, quantity normalization or undisclosed charges are inferred.',
 '- Do not claim the lowest final total unless all relevant landed costs and terms are verified.',
 '- Check original quote documents and customer requirements manually.',
 '- VERIFY Stripe paid event and buyer identity separately before any customer delivery.',
 '- Human approval required: this script never sends, posts, pays, or changes a live system.',
 ''
].join('\n');
const sourceHash=sha(raw),folder=join(resolve(output),'QUOTE-'+sourceHash.slice(0,16));
const manifest={
 schema:'dreamledger/quote-compare-draft/v1',
 status:'DRAFT_NOT_PAID_OR_DELIVERED',silo:'truth_oracle',source_format:'quote-comparison-v1',
 source_sha256:sourceHash,source_filename:basename(input),row_count:rows.length,
 currency,has_unknown_delivery:rows.some(x=>x.delivery_unknown==='YES'),
 expected_price_nzd:49,
 artifacts:{'comparison.csv':sha(csv),'summary.md':sha(summary)},
 payment_checked:false,human_approved:false,customer_delivery_confirmed:false,
 privacy:'PRIVATE_LOCAL_ONLY'
};
await mkdir(folder,{recursive:true});
async function atomic(name,content){const path=join(folder,name),tmp=path+'.tmp-'+process.pid;await writeFile(tmp,content,{mode:0o600});await rename(tmp,path)}
await atomic('comparison.csv',csv);
await atomic('summary.md',summary);
await atomic('receipt.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:manifest.status,folder,source_sha256:sourceHash,receipt_sha256:sha(JSON.stringify(manifest,null,2)+'\n'),row_count:rows.length}));
