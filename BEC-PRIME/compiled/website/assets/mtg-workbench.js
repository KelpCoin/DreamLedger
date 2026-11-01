/* Shared, dependency-free card-list tools. Never publishes or invents trade history. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MTGWorkbench=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function parse(text){
 const cards=new Map(),errors=[];
 if(String(text).length>100000)return {cards:[],errors:['Use at most 100,000 characters.']};
 String(text).split(/\r?\n/).forEach((line,i)=>{
  line=line.trim();if(!line||line.startsWith('//')||/^(commander|deck|mainboard|sideboard|maybeboard):?$/i.test(line))return;
  const m=line.match(/^(?:(\d+)\s*x?\s+)?(.+?)(?:\s+\([A-Za-z0-9]+\)\s+\S+)?(?:\s+\*F\*)?$/);
  const qty=m&&m[1]?Number(m[1]):1,name=m?m[2].trim():'';
  if(!name||name.length>180||!Number.isSafeInteger(qty)||qty<1||qty>999){errors.push('Line '+(i+1)+': use a quantity from 1 to 999 and a card name.');return;}
  const key=name.normalize('NFKC').toLocaleLowerCase('en');
  const prev=cards.get(key);if(prev)prev.quantity+=qty;else cards.set(key,{name,quantity:qty,key});
 });
 return {cards:[...cards.values()],errors};
}
function compare(wanted,owned){const have=new Map(owned.map(c=>[c.key,c.quantity]));return wanted.map(c=>({...c,owned:Math.min(c.quantity,have.get(c.key)||0),missing:Math.max(0,c.quantity-(have.get(c.key)||0))}));}
function openingChance(size,lands,draw){
 if(![size,lands,draw].every(Number.isInteger)||size<1||lands<0||lands>size||draw<1||draw>size)throw Error('Check deck, land and hand sizes.');
 const choose=(n,k)=>{if(k<0||k>n)return 0;let r=1;for(let i=1;i<=Math.min(k,n-k);i++)r=r*(n-i+1)/i;return r;};
 return Array.from({length:draw+1},(_,k)=>({lands:k,probability:choose(lands,k)*choose(size-lands,draw-k)/choose(size,draw)}));
}
function filter(products,{query='',kind='all',sort='name',maxPrice=''}={}){
 const q=query.trim().toLocaleLowerCase('en');
 const result=products.filter(p=>p.status==='published'&&(kind==='all'||p.category===kind)&&(!q||[p.name,p.commander,p.description,p.condition].join(' ').toLocaleLowerCase('en').includes(q))&&(maxPrice===''||(Number.isFinite(Number(p.price))&&Number(p.price)<=Number(maxPrice))));
 return result.sort((a,b)=>sort==='low'?Number(a.price)-Number(b.price):sort==='high'?Number(b.price)-Number(a.price):String(a.name).localeCompare(String(b.name)));
}
return {parse,compare,openingChance,filter};
});
