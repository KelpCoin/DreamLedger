"use strict";
const fs=require("fs");
const path=require("path");
const file=path.join(__dirname,"..","index.html");
const html=fs.readFileSync(file,"utf8");
const failures=[];
const required=[
  "scroll-snap-type:x mandatory",
  "class=\"peek billboard\"",
  "id=\"dreammee\"",
  "id=\"productRail\"",
  "/api/products",
  "/api/offer-checkout/create",
  "localStorage",
  "swipe sideways"
];
for(const x of required) if(!html.includes(x)) failures.push("missing:"+x);
const forbidden=/\b(BECK|Gauntlet|Economic Court|Truth Oracle|ELOHIM|BrownEye Cortex|BEC-PRIME|Amplissa|CollectorsCoast|DreamMeez)\b/i;
if(forbidden.test(html)) failures.push("forbidden-internal-language");
if(/\b(VISA|MASTERCARD|AMEX|STRIPE)\b/i.test(html)) failures.push("payment-logo-language");
if(!html.includes("peek billboard")) failures.push("billboard-not-top-strip");
if(!html.includes("dreammee")) failures.push("dreammee-not-top-strip");
const result={schema:"dreamledger/public-surface-verification/v1",verdict:failures.length?"FAIL":"PASS",checked_file:file,failures,checks:required.length+3};
console.log(JSON.stringify(result,null,2));
process.exitCode=failures.length?1:0;
