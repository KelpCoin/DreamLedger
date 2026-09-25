'use strict';

const endpoint=String(process.env.DREAMLEDGER_COMMERCIAL_URL||'https://dreamledger.org/api/commercial/reconcile').replace(/\/$/,'');
const token=String(process.env.DREAMLEDGER_RECONCILE_TOKEN||'');
if(!token) throw new Error('DREAMLEDGER_RECONCILE_TOKEN is required');
const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-dreamledger-reconcile-token':token},body:'{}'});
const body=await response.text();
if(!response.ok) throw new Error('commercial reconcile HTTP '+response.status+': '+body);
console.log(body);
