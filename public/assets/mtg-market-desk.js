(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MTGMarketDesk=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function spread(buy,sell,quantity,fees){
 if(![buy,sell,quantity,fees].every(Number.isFinite)||buy<0||sell<0||fees<0||!Number.isInteger(quantity)||quantity<1||quantity>1000||Math.max(buy,sell,fees)>100000)throw Error('Enter valid non-negative quotes and costs, and a whole quantity from 1 to 1000.');
 const cost=buy*quantity+fees,proceeds=sell*quantity,net=proceeds-cost;
 return {cost,proceeds,net,breakEven:cost/quantity,roi:cost>0?net/cost*100:null};
}
if(typeof document!=='undefined'){
 const f=document.getElementById('spread-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();if(!f.reportValidity())return;const d=Object.fromEntries(new FormData(f));const out=document.getElementById('spread-result');try{const r=spread(Number(d.buy),Number(d.sell),Number(d.quantity),Number(d.fees));out.textContent=d.card.trim()+': '+(r.net<0?'Net loss ':r.net>0?'Net spread ':'Break-even ')+Math.abs(r.net).toFixed(3)+' tix. Total cost '+r.cost.toFixed(3)+' tix; sale proceeds '+r.proceeds.toFixed(3)+' tix. Break-even sell quote '+r.breakEven.toFixed(3)+' tix per card.';}catch(err){out.textContent=err.message;}});
}
return {spread};
});
