'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.join(__dirname,'..');
const FEATURED=path.join(ROOT,'catalog','featured-offer.json');const PRODUCTS=path.join(ROOT,'catalog','products');const INDEX=path.join(ROOT,'compiled','website','index.html');
const featured=JSON.parse(fs.readFileSync(FEATURED,'utf8'));if(featured.currency!=='NZD')throw Error('FEATURED_OFFER_GATE_FAILED: currency');if(!featured.offer_id||!featured.product_id||!featured.payment_link_url)throw Error('FEATURED_OFFER_GATE_FAILED: incomplete offer');if(featured.payment_link_status!=='ACTIVE_LIVEMODE')throw Error('FEATURED_OFFER_GATE_FAILED: payment link not live');
const productPath=path.join(PRODUCTS,`${featured.product_id}.json`);if(!fs.existsSync(productPath))throw Error('FEATURED_OFFER_GATE_FAILED: product missing');const product=JSON.parse(fs.readFileSync(productPath,'utf8'));if(product.id!==featured.product_id)throw Error('FEATURED_OFFER_GATE_FAILED: identity');if(product.silo!==featured.silo)throw Error('FEATURED_OFFER_GATE_FAILED: silo');if(Number(product.price)!==Number(featured.price))throw Error('FEATURED_OFFER_GATE_FAILED: price');if(product.commercial_truth?.payment_link!==featured.payment_link_url)throw Error('FEATURED_OFFER_GATE_FAILED: payment link mismatch');
if(!fs.existsSync(INDEX))throw Error('FEATURED_OFFER_GATE_FAILED: compiled homepage missing');
let html=fs.readFileSync(INDEX,'utf8');
const productMeta=`<meta name="dreamledger-featured-product" content="${featured.product_id}">`;
const paymentMeta=`<meta name="dreamledger-featured-payment" content="${featured.payment_link_url}">`;
function ensureMeta(input,meta,name){const re=new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`,`i`);if(re.test(input))return input.replace(re,meta);if(/<\\/head>/i.test(input))return input.replace(/<\\/head>/i,`${meta}\\n</head>`);throw Error(`FEATURED_OFFER_GATE_FAILED: <head> missing for ${name}`)}
html=ensureMeta(html,productMeta,'dreamledger-featured-product');
html=ensureMeta(html,paymentMeta,'dreamledger-featured-payment');
fs.writeFileSync(INDEX,html,'utf8');
if(!html.includes(`content="${featured.product_id}"`))throw Error('FEATURED_OFFER_GATE_FAILED: product marker missing');if(!html.includes(`content="${featured.payment_link_url}"`))throw Error('FEATURED_OFFER_GATE_FAILED: payment marker missing');if(!html.toLowerCase().includes('digital goods'))throw Error('FEATURED_OFFER_GATE_FAILED: digital rail missing');if(!html.toLowerCase().includes('magic: the gathering'))throw Error('FEATURED_OFFER_GATE_FAILED: MTG lane missing');
console.log(JSON.stringify({status:'PASS',featured_offer_id:featured.offer_id,product_id:featured.product_id,sku:featured.sku,silo:featured.silo,price_nzd:Number(featured.price),payment_link_status:featured.payment_link_status,placement:'digital-goods-rail + MTG silo',markers_written:true},null,2));
