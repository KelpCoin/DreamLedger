'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'), read=p=>fs.readFileSync(path.join(root,p),'utf8');
const quote=read('public/quote-compare-49.html'),intake=read('supabase/functions/quote-intake/index.ts'),
worker=read('supabase/functions/quote-fulfillment/index.ts'),
freeProfit=read('public/tools/nz-seller-profit/index.html'), audit=read('public/tools/seller-profit-audit/index.html');
assert(quote.includes('https://buy.stripe.com/00wdR93vnbK5eqH3gwdwc3r'),'Quote public link must match verified active payment link');
assert(quote.includes('Manual review') && quote.includes('not independently verified'),'Manual service must not pretend automatic fulfilment');
assert(intake.includes('plink_1USpJeEGgEAnUFF9vNDiM8SS'),'Automated source must not point to inactive Stripe link');
assert(intake.includes('session.metadata?.sku!==SKU'),'Live link has sku metadata');
assert(intake.includes('session.amount_total!==4900') && intake.includes('session.currency!=="nzd"'),'Quote session must bind exact amount and currency');
const dollar=String.fromCharCode(36), expected='quote-inputs/'+dollar+'{fr.id}/', invalid='quote-inputs/'+dollar+'{ctx.order.id}/';
assert(intake.includes(expected),'New signed uploads must use the fulfillment request ID');
assert(!intake.includes(invalid),'Do not write to old order-based path');
assert(worker.includes('quote-inputs/"+id+"/'),'Worker must use same fulfillment request ID');
assert(freeProfit.includes('/tools/seller-profit-audit/?src=free-profit-calculator'),'Free calculator must show existing paid audit');
assert(audit.includes('https://buy.stripe.com/8x2bJ17LD3dzeqH8AQdwc2S'),'Seller audit link must be active one');
assert(audit.includes('Dreamledger.org@gmail.com') && audit.includes('manual PDF delivery within 24 hours'),'Audit must explain intake and fulfillment');
assert(!freeProfit.includes('NZ_Seller_Profit_Pack.xlsx'),'Do not publish unapproved spreadsheet SKU');
console.log('FIRST_DOLLAR_EXISTING_OFFER_CONTRACT=PASS; LIVE_PAYMENT_NOT_TRIGGERED; REVENUE_NOT_PROVEN; DEPLOYMENT_NOT_PROVEN');
