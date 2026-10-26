'use strict';
const $=id=>document.getElementById(id);
const money=cents=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(cents/100);
const token=()=>sessionStorage.getItem('dreamledger_pilot_token');
let approved=[],currentBid=null;
function message(id,text,isError=false){const e=$(id);e.textContent=text;e.classList.toggle('error',isError);e.classList.toggle('ok',!isError)}
function showAccount(){const el=$('account');el.hidden=false;el.scrollIntoView({behavior:'smooth'})}
function auth(){if(!token()){showAccount();throw new Error('Please register a pilot account first.')}return token()}
async function api(route,method='GET',data=null,bearer=null){
const headers={};if(data!==null)headers['content-type']='application/json';if(bearer)headers.authorization='Bearer '+bearer;
const response=await fetch(route,{method,headers,body:data===null?undefined:JSON.stringify(data),cache:'no-store'});
let result;try{result=await response.json()}catch{throw new Error('Server did not return JSON')}
if(!response.ok)throw new Error(result.error||'Request failed');
return result;
}
function card(item){
const el=document.createElement('article');el.className='listing-card';
const tag=document.createElement('span');tag.className='pill';tag.textContent=item.kind==='auction'?'Auction':'Buy now';el.append(tag);
const h=document.createElement('h3');h.textContent=item.title;el.append(h);
const cat=document.createElement('div');cat.className='small';cat.textContent=item.category;el.append(cat);
const price=document.createElement('div');price.className='listing-price';price.textContent=money(item.price);el.append(price);
const description=document.createElement('p');description.textContent=item.description;el.append(description);
if(item.kind==='auction'){
const end=document.createElement('p');end.className='small';end.textContent='Ends: '+new Date(item.ends).toLocaleString('en-NZ');el.append(end);
if(item.ends>Date.now()){
const btn=document.createElement('button');btn.className='button secondary';btn.type='button';btn.textContent='Place bid';btn.addEventListener('click',()=>openBid(item));el.append(btn);
}else{const ended=document.createElement('p');ended.textContent='Auction ended';el.append(ended)}
}else{
const notice=document.createElement('p');notice.className='small';notice.textContent='Checkout opening after verification';el.append(notice);
}return el;
}
function draw(){
const term=$('search').value.toLowerCase().trim(),kind=$('kind').value,cat=$('category').value;
const filtered=approved.filter(x=>(kind==='all'||x.kind===kind)&&(cat==='all'||x.category===cat)&&(!term||(x.title+' '+x.description+' '+x.category).toLowerCase().includes(term)));
const root=$('listings');root.replaceChildren();
if(!filtered.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=approved.length?'No matches yet. Try another search.':'No approved listings yet. Be first to submit one.';root.append(empty);return}
for(const item of filtered)root.append(card(item));
}
async function load(){
try{
approved=(await api('/api/listings')).listings;
const cats=Array.from(new Set(approved.map(x=>x.category))).sort();
const select=$('category');select.replaceChildren(new Option('All categories','all'));for(const c of cats)select.add(new Option(c,c));
draw();
}catch(e){$('listings').textContent='Listings unavailable: '+e.message}
try{const data=await api('/api/markets');$('capacity').textContent=data.markets.map(m=>{const taken=(data.occupied.find(o=>o.market===m)||{}).units||0;return m+': '+(data.capacityPerMarket-taken)+' units';}).join(' · ')}catch(e){$('capacity').textContent='Inventory status unavailable'}
}
function openBid(item){currentBid=item;$('bid-title').textContent=item.title+' · minimum '+money(item.price);$('bid-message').textContent='';$('bid-dialog').showModal()}
$('account-toggle').addEventListener('click',showAccount);
$('signout').addEventListener('click',()=>{sessionStorage.removeItem('dreamledger_pilot_token');message('register-message','Signed out on this device.');$('account-toggle').textContent='Join / Sign in'});
$('close-bid').addEventListener('click',()=>$('bid-dialog').close());
$('search').addEventListener('input',draw);$('kind').addEventListener('change',draw);$('category').addEventListener('change',draw);
$('listing-kind').addEventListener('change',()=>{$('auction-end-wrap').hidden=$('listing-kind').value!=='auction'});
$('register-form').addEventListener('submit',async event=>{event.preventDefault();const b=new FormData(event.currentTarget);try{const r=await api('/api/register','POST',{email:b.get('email')});sessionStorage.setItem('dreamledger_pilot_token',r.token);message('register-message','Account created. Your pilot session is active until this tab closes.');$('account-toggle').textContent='Account active'}catch(e){message('register-message',e.message,true)}});
$('listing-form').addEventListener('submit',async event=>{
event.preventDefault();const f=event.currentTarget;const b=new FormData(f);
try{const bearer=auth(),type=b.get('kind'),payload={title:b.get('title'),category:b.get('category'),description:b.get('description'),kind:type,price:Math.round(Number(b.get('price'))*100)};
if(type==='auction'){const date=Date.parse(b.get('ends'));if(!Number.isFinite(date))throw new Error('Please choose a valid auction end');payload.ends=date}
const r=await api('/api/listings','POST',payload,bearer);message('listing-message','Submitted for review. Reference: '+r.id);f.reset();$('auction-end-wrap').hidden=true;
}catch(e){message('listing-message',e.message,true)}});
$('avatar-form').addEventListener('submit',async event=>{event.preventDefault();const b=new FormData(event.currentTarget);try{auth();await api('/api/avatar','PUT',{name:b.get('name'),colour:b.get('colour')},token());message('avatar-message','Avatar identity saved.')}catch(e){message('avatar-message',e.message,true)}});
$('billboard-form').addEventListener('submit',async event=>{event.preventDefault();const b=new FormData(event.currentTarget);try{auth();const r=await api('/api/billboard','POST',{market:b.get('market'),units:Number(b.get('units')),title:b.get('title'),url:b.get('url')},token());message('billboard-message','Request queued for review. Reference: '+r.id);await load()}catch(e){message('billboard-message',e.message,true)}});
$('bid-form').addEventListener('submit',async event=>{event.preventDefault();try{auth();if(!currentBid)throw new Error('Select an auction first');const b=new FormData(event.currentTarget);const r=await api('/api/listings/'+encodeURIComponent(currentBid.id)+'/bid','POST',{amount:Math.round(Number(b.get('amount'))*100)},token());$('bid-message').textContent='Bid accepted, reference '+r.bid+'. No money collected.'}catch(e){$('bid-message').textContent=e.message}});
if(token())$('account-toggle').textContent='Account active';
load();