'use strict';
/* Card art: Scryfall collection endpoint. Do not crop, stretch or watermark artwork.
   Cards shown are the declared decklist, not inferred collection ownership. */
(function(){
  const API='https://api.scryfall.com/cards/collection', BATCH=75;
  const pending=new Map();
  const cache=new Map();
  const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
  const normal=n=>String(n||'').trim().toLowerCase();
  function sectionData(list){
    if(Array.isArray(list.sections))return list.sections.map(s=>({title:s.title||'Cards',cards:s.cards||[]}));
    if(list.boards&&typeof list.boards==='object')return ['commander','main','sideboard'].filter(k=>Array.isArray(list.boards[k])&&list.boards[k].length).map(k=>({title:k==='main'?'Main deck':k==='commander'?'Commander':'Sideboard (not included in Commander deck)',cards:list.boards[k]}));
    return Array.isArray(list.cards)?[{title:'Deck',cards:list.cards}]:[];
  }
  function nameOf(x){return typeof x==='string'?x:String(x.name||'');}
  function qtyOf(x){return typeof x==='string'?1:Math.max(1,Math.min(99,Number(x.qty||x.quantity||1)||1));}
  function art(card){return card&&(card.image_uris?.normal||card.image_uris?.small||card.card_faces?.[0]?.image_uris?.normal||card.card_faces?.[0]?.image_uris?.small)||null;}
  async function lookUp(input){
    const names=[...new Set(input.map(nameOf).map(normal).filter(Boolean))].filter(n=>!cache.has(n));
    for(let i=0;i<names.length;i+=BATCH){
      const chunk=names.slice(i,i+BATCH);
      try{
        const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifiers:chunk.map(name=>({name}))})});
        if(!response.ok)throw new Error('Card art provider unavailable');
        const result=await response.json();
        for(const c of result.data||[]) cache.set(normal(c.name),c);
      }catch(_){}
      for(const n of chunk)if(!cache.has(n))cache.set(n,null);
    }
  }
  function renderCards(root,section,compact){
    const block=make('section','mtg-grid-section');
    const label=make('h3','mtg-grid-section-title',section.title+' ('+section.cards.reduce((x,c)=>x+qtyOf(c),0)+')');
    block.appendChild(label);
    const grid=make('div',compact?'mtg-card-grid mtg-card-grid-preview':'mtg-card-grid');
    for(const entry of section.cards){
      const name=nameOf(entry),card=cache.get(normal(name)),src=art(card);
      const cell=make('figure','mtg-card');cell.title=name;
      if(src){const img=make('img');img.loading='lazy';img.decoding='async';img.alt=name;img.src=src;cell.appendChild(img);}
      else cell.appendChild(make('div','mtg-card-ph',name));
      const caption=make('figcaption',null,name+(qtyOf(entry)>1?' ×'+qtyOf(entry):''));cell.appendChild(caption);
      grid.appendChild(cell);
    }
    block.appendChild(grid);root.appendChild(block);
  }
  async function render(node){
    const src=node.getAttribute('data-mtg-deck');if(!src)return;
    node.replaceChildren(make('p','mtg-grid-status','Loading the exact listed cards…'));
    let data;
    try{const r=await fetch(src,{cache:'no-store'});if(!r.ok)throw Error('Decklist unavailable');data=await r.json();}catch(_){node.replaceChildren(make('p','mtg-grid-status error','Full card list has not been verified for this listing.'));return;}
    const sections=sectionData(data),core=sections.filter(s=>!/^sideboard/i.test(s.title)),count=core.reduce((n,s)=>n+s.cards.reduce((x,c)=>x+qtyOf(c),0),0);
    if(!core.length){node.replaceChildren(make('p','mtg-grid-status error','No verified cards in this decklist.'));return;}
    const preview=node.hasAttribute('data-mtg-preview');
    const toShow=preview?core.map(s=>({title:s.title,cards:s.cards.slice(0,12)})):sections;
    const items=toShow.flatMap(s=>s.cards);await lookUp(items);
    node.replaceChildren();
    const summary=make('div','mtg-grid-meta',count+' cards recorded in the listed Commander and main deck'+(count===100?' · 100-card count':' · verify 100-card count before purchase'));
    node.appendChild(summary);
    toShow.forEach(s=>renderCards(node,s,preview));
    if(preview){const link=make('a','mtg-grid-source','See full deck and all cards →');link.href=String(node.getAttribute('data-detail-url')||'/mtg/');node.appendChild(link);}
    node.appendChild(make('p','mtg-grid-note','Card names and counts are from the seller decklist. Artwork via Scryfall. Confirm the exact printings, condition and availability with the seller.'));
  }
  window.DreamLedgerDeckGrid={render,sectionData,lookUp,cardArt:name=>art(cache.get(normal(name)))};
  function boot(){document.querySelectorAll('[data-mtg-deck]').forEach(n=>render(n));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
