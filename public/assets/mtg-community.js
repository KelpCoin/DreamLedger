(function(){
'use strict';const $=id=>document.getElementById(id),W=window.MTGWorkbench;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;}
function link(text,href,cls){const a=node('a',text,cls);a.href=href;return a;}
function table(headers,rows){const t=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');headers.forEach(h=>{const c=node('th',h);c.scope='col';hr.append(c)});head.append(hr);rows.forEach(row=>{const tr=node('tr');row.forEach(v=>tr.append(node('td',v)));body.append(tr)});t.append(head,body);return t;}
let products=[];
function render(){
 const items=W.filter(products,{query:$('search').value,kind:$('kind').value,maxPrice:$('max-price').value,sort:$('sort').value});
 $('catalog-status').textContent=items.length+' listing'+(items.length===1?'':'s')+' shown · NZD · ask seller to confirm stock';
 $('catalog').replaceChildren();
 if(!items.length){const box=node('div',undefined,'empty');box.append(node('h3','No matching listings'),node('p','Try another name or price, or take your wanted list to the community.'));const reset=node('button','Clear filters');reset.type='button';reset.onclick=()=>{$('search').value='';$('kind').value='all';$('max-price').value='';render();$('search').focus()};box.append(reset,document.createTextNode(' '),link('Open community','#community'));$('catalog').append(box);return;}
 for(const p of items){
  const card=node('article',undefined,'deck');card.append(node('span',p.category==='single'?'SINGLE':'COMMANDER DECK','badge'),node('h3',p.name),node('p',p.availability==='review_required'?'Ask the seller for the current decklist, asking price and availability.':p.description),node('div',p.price_verified?'NZ$'+Number(p.price).toFixed(2):'Price on enquiry','price'),node('p',p.condition||'Ask the seller for condition and actual-card photos.'));
  const actions=node('div',undefined,'actions');
  if(typeof p.detail_url==='string'&&/^\/mtg\/[a-z0-9-]+\.html$/i.test(p.detail_url))actions.append(link('View deck details',p.detail_url,'btn'));
  else {const d=node('details'),s=node('summary','Listing details');d.append(s,node('p','Seller confirmation is required for the current decklist, stock and asking price. There is no online checkout for this listing.'));card.append(d);}
  actions.append(link('Ask about this deck','mailto:hello@dreamledger.org?subject='+encodeURIComponent('MTG enquiry: '+p.name),'btn'));card.append(actions);$('catalog').append(card);
 }
}
async function load(){
 try{const paths=[document.body.dataset.catalog,'/catalog.json'];const data=await Promise.all(paths.map(async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('unavailable');return r.json()}));
  if(data[0].silo!=='mtg'||!Array.isArray(data[0].products)||!Array.isArray(data[1].products))throw Error('invalid catalogue');
  const master=new Map(data[1].products.map(p=>[p.id,p]));products=data[0].products.map(p=>({...p,price_verified:master.has(p.id)&&Number(master.get(p.id).price)===Number(p.price)&&p.availability!=='review_required'&&Number(p.price)>0}));render();
 }catch{ $('catalog-status').textContent='The catalogue could not load. Your deck tools still work.';const box=node('div',undefined,'empty');const retry=node('button','Try loading again');retry.type='button';retry.onclick=()=>{$('catalog-status').textContent='Loading…';load()};box.append(node('p','Please retry before relying on prices or availability.'),retry);$('catalog').replaceChildren(box);}
}
['search','kind','sort','max-price'].forEach(id=>$(id).addEventListener(id==='search'||id==='max-price'?'input':'change',render));
$('example-button').onclick=()=>{$('wanted').value='1 Sol Ring\n1 Arcane Signet\n36 Forest';$('owned').value='1 Sol Ring\n20 Forest';$('compare-button').click()};
$('clear-button').onclick=()=>{$('wanted').value='';$('owned').value='';$('comparison').replaceChildren();$('compare-status').textContent='Lists cleared.';$('missing-label').hidden=true;$('missing').value='';$('wanted').focus()};
$('compare-button').onclick=()=>{const want=W.parse($('wanted').value),own=W.parse($('owned').value);$('comparison').replaceChildren();$('missing-label').hidden=true;
 if(want.errors.length||own.errors.length){$('compare-status').textContent=[...want.errors.map(x=>'Deck: '+x),...own.errors.map(x=>'Collection: '+x)].join(' ');return;}
 if(!want.cards.length){$('compare-status').textContent='Paste at least one card in the deck list first.';$('wanted').focus();return;}
 const rows=W.compare(want.cards,own.cards),missing=rows.filter(c=>c.missing);$('compare-status').textContent=rows.reduce((n,c)=>n+c.quantity,0)+' cards in your list. '+missing.reduce((n,c)=>n+c.missing,0)+' cards still needed across '+missing.length+' names.';
 $('comparison').append(table(['Card','Needed','Have','Missing'],rows.map(c=>[c.name,c.quantity,c.owned,c.missing])));if(missing.length){$('missing').value=missing.map(c=>c.missing+' '+c.name).join('\n');$('missing-label').hidden=false;}
};
$('odds-button').onclick=()=>{try{const size=Number($('deck-size').value),lands=Number($('land-count').value),draw=Number($('hand-size').value);if(size>250||draw>20)throw Error('Use a library of at most 250 and draw at most 20 cards.');const odds=W.openingChance(size,lands,draw);$('odds-status').textContent='Chance of 2–4 lands: '+(100*odds.filter(x=>x.lands>=2&&x.lands<=4).reduce((s,x)=>s+x.probability,0)).toFixed(1)+'%. Before mulligans; mana sources other than lands are not counted.';$('odds').replaceChildren(table(['Lands drawn','Chance'],odds.map(x=>[x.lands,(x.probability*100).toFixed(1)+'%'])));}catch(e){$('odds-status').textContent=e.message;$('odds').replaceChildren();}};
load();
})();
