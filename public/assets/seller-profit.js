(function(root){
'use strict';
const fields=['sale','buyerShipping','cost','platform','payment','fixedfee','shipping','packaging'];
function calculate(input){
  const v={};
  for(const key of fields){
    const raw=input[key];
    if((typeof raw!=='number'&&typeof raw!=='string')||String(raw).trim()===''||!Number.isFinite(Number(raw))||Number(raw)<0) throw new Error('Enter a non-negative number in every amount field.');
    v[key]=Number(raw);
  }
  if(!['item','total'].includes(input.feeBase)) throw new Error('Choose a fee base.');
  if(v.platform>100||v.payment>100) throw new Error('Each percentage must be between 0 and 100.');
  const revenue=v.sale+v.buyerShipping,base=input.feeBase==='total'?revenue:v.sale;
  const platformFee=base*v.platform/100,paymentFee=base*v.payment/100;
  const sellingCosts=platformFee+paymentFee+v.fixedfee+v.shipping+v.packaging;
  const cashRetained=revenue-sellingCosts,profit=cashRetained-v.cost;
  const result={revenue,platformFee,paymentFee,sellingCosts,cashRetained,profit,margin:revenue?profit/revenue*100:null,roi:v.cost?profit/v.cost*100:null};
  if(Object.values(result).some(x=>x!==null&&!Number.isFinite(x))) throw new Error('Amounts are too large to calculate.');
  return result;
}
if(typeof module!=='undefined'&&module.exports) module.exports={calculate};
if(!root.document) return;
const q=id=>root.document.getElementById(id),money=n=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(n);
const outputs={profit:'profit',pf:'platformFee',pay:'paymentFee',fees:'sellingCosts',keep:'cashRetained'};
function read(){return Object.fromEntries([...fields,'feeBase'].map(k=>[k,q(k).value]));}
function render(){
 try{
  const result=calculate(read());
  for(const [id,key] of Object.entries(outputs)) q(id).textContent=money(result[key]);
  for(const id of ['margin','roi']) q(id).textContent=result[id]===null?'N/A':result[id].toFixed(1)+'%';
  q('profit').className='big '+(result.profit>=0?'good':'bad');q('validation').textContent='';q('download').disabled=false;
  return result;
 }catch(e){
  for(const id of [...Object.keys(outputs),'margin','roi']) q(id).textContent='Unavailable';
  q('validation').textContent=e.message;q('download').disabled=true;return null;
 }
}
for(const key of [...fields,'feeBase']) q(key).addEventListener('input',()=>{q('downloadStatus').textContent='';render();});
q('download').addEventListener('click',()=>{
 const result=render();if(!result)return;
 const record={tool:'DreamLedger Seller Profit Calculator',version:1,currency:'NZD',inputs:read(),estimates:result,limitations:'User-entered rates; excludes taxes, refunds and unlisted costs. Not verified revenue.'};
 const url=root.URL.createObjectURL(new root.Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
 const a=root.document.createElement('a');a.href=url;a.download='dreamledger-seller-breakdown.json';root.document.body.appendChild(a);a.click();a.remove();
 root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);q('downloadStatus').textContent='Download requested. Check your browser downloads. Nothing was uploaded.';
});
render();
})(typeof window==='undefined'?globalThis:window);
