#!/usr/bin/env node
'use strict';
// Rapid owner-inventory importer. It never invents a deck, commander, price, condition or checkout.
// Input CSV columns: name,commander,price_nzd. Optional: sku,inventory,notes.
// Output is inquiry-only until a separate verified checkout is explicitly attached.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function csvRows(text){
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];
  if(q){if(ch==='"'&&n==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}
  else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell='';}
  else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=ch;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
function slug(v){return String(v).normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').toUpperCase().slice(0,54);}
function main(){
 const input=process.argv[2];if(!input)throw Error('Usage: node scripts/import-mtg-rapid-decks.cjs <decks.csv>');
 const rows=csvRows(fs.readFileSync(input,'utf8'));if(rows.length<2)throw Error('NO_DECK_ROWS');
 const headers=rows.shift().map(x=>x.trim().toLowerCase());
 for(const key of ['name','commander','price_nzd'])if(!headers.includes(key))throw Error('MISSING_COLUMN_'+key.toUpperCase());
 const at=k=>headers.indexOf(k), seen=new Set(), incoming=[];
 rows.forEach((r,i)=>{
  const name=String(r[at('name')]||'').trim(),commander=String(r[at('commander')]||'').trim();
  const price=Number(String(r[at('price_nzd')]||'').replace(/[$,\s]/g,''));
  if(!name)throw Error('ROW_'+(i+2)+'_MISSING_NAME');
  if(!commander)throw Error('ROW_'+(i+2)+'_MISSING_COMMANDER');
  if(!Number.isFinite(price)||price<=0)throw Error('ROW_'+(i+2)+'_INVALID_PRICE');
  const explicit=at('sku')>=0?String(r[at('sku')]||'').trim():'';
  const id=explicit||('EDH-RAPID-'+slug(commander)+'-'+String(i+1).padStart(3,'0'));
  if(seen.has(id))throw Error('DUPLICATE_SKU_'+id);seen.add(id);
  const inv=at('inventory')>=0?Number(r[at('inventory')]||1):1;if(!Number.isInteger(inv)||inv<1)throw Error('ROW_'+(i+2)+'_INVALID_INVENTORY');
  const notes=at('notes')>=0?String(r[at('notes')]||'').trim():'';
  incoming.push({id,sku:id,name,commander,description:notes||'Physical Commander deck from Happy Homarid inventory. Full decklist and exact listing details can be supplied on request.',price,currency:'NZD',status:'published',inventory:inv,silo:'mtg',category:'commander-deck',sale_mode:'claim_by_message',checkout_available:false,listing_completeness:'rapid_inventory_stub',decklist_status:'available_on_request',claim_url:'mailto:Dreamledger.org@gmail.com?subject='+encodeURIComponent('Happy Homarid deck inquiry: '+name)});
 });
 const target=path.resolve(__dirname,'../public/catalog.json'),catalog=JSON.parse(fs.readFileSync(target,'utf8'));
 if(!Array.isArray(catalog.products))throw Error('INVALID_CATALOG');
 const existing=new Set(catalog.products.map(x=>x.id));
 for(const p of incoming)if(existing.has(p.id))throw Error('CATALOG_ID_ALREADY_EXISTS_'+p.id);
 catalog.products.push(...incoming);
 fs.writeFileSync(target,JSON.stringify(catalog,null,2)+'\n');
 const digest=crypto.createHash('sha256').update(JSON.stringify(incoming)).digest('hex');
 console.log(JSON.stringify({status:'PASS',imported:incoming.length,mode:'inquiry_only',checkout_created:false,decklists_required:false,input_sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),records_sha256:digest},null,2));
}
if(require.main===module)main();
module.exports={csvRows,slug};
