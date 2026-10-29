/* DreamLedger MTG master silo: public display adapter.
 * Only the server's live Neon projection may establish catalog availability.
 * Static historical decks are reference material, not stock or checkout proof.
 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.DreamLedgerMTGCatalogue=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  var ENDPOINT='/api/cube/marketplace?silo=mtg&limit=100';
  function isSellablePublicItem(item){
    return !!item && item.silo_id==='mtg' && item.status==='published' &&
      /^[a-z0-9-]{1,48}$/.test(String(item.silo_id||'')) &&
      typeof item.sku==='string' && item.sku.length>=2 && item.sku.length<=128 &&
      typeof item.title==='string' && item.title.trim().length>0 &&
      Number.isSafeInteger(Number(item.price_minor)) && Number(item.price_minor)>=0 &&
      Number.isInteger(Number(item.quantity)) && Number(item.quantity)>0 &&
      String(item.currency||'').toLowerCase()==='nzd';
  }
  function publicItem(item){
    if(!isSellablePublicItem(item))return null;
    return {
      id:String(item.id||''),sku:item.sku,title:item.title,
      description:String(item.description||'').slice(0,1200),
      price_minor:Number(item.price_minor),quantity:Number(item.quantity),
      category:String(item.category||'collectible'),
      request_subject:'Availability request: '+item.sku
    };
  }
  function selectItems(response){
    if(!response||response.schema!=='CUBE/B2B-MARKETPLACE/v2'||
       response.source!=='neon'||!Array.isArray(response.items))throw Error('INVALID_CATALOGUE_CONTRACT');
    // A partial/noisy response is a failure, not permission for fallback stock.
    if(response.items.length>100)throw Error('TOO_MANY_LISTINGS');
    var result=[];
    response.items.forEach(function(item){
      if(!isSellablePublicItem(item))throw Error('INVALID_LISTING');
      var clean=publicItem(item);
      if(clean)result.push(clean);
    });
    return result;
  }
  function escapeHtml(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function formatPrice(minor){
    return 'NZ$'+(minor/100).toFixed(2);
  }
  function enquiry(item){
    // No direct payment link without server-owned stock reservation and payment-to-delivery proof.
    var subject='MTG listing availability: '+item.sku;
    var body='Please confirm physical inventory, condition, total delivery charges and the correct checkout before I pay. Listing: '+item.title;
    return 'mailto:hello@dreamledger.org?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  }
  function renderItem(item){
    var name=escapeHtml(item.title);
    var price=escapeHtml(formatPrice(item.price_minor));
    var link=escapeHtml(enquiry(item));
    return '<article class="deck"><div class="kicker">'+escapeHtml(item.category)+
      '</div><h3>'+name+'</h3><p>'+escapeHtml(item.description)+
      '</p><div class="price">'+price+'</div><p>Availability is based on the server catalogue. Confirm condition and shipment before paying.</p>'+
      '<a class="silo-btn silo-btn-ghost" href="'+link+'">Enquire about this item</a></article>';
  }
  async function loadLive(fetcher) {
    var r=await fetcher(ENDPOINT,{credentials:'omit',cache:'no-store'});
    if(!r||!r.ok)throw Error('LIVE_CATALOGUE_UNAVAILABLE');
    return selectItems(await r.json());
  }
  function mount(doc,fetcher){
    var status=doc.getElementById('status'),grid=doc.getElementById('grid');
    if(!status||!grid)throw Error('MISSING_MTG_DOM');
    status.textContent='Checking verified server inventory…';
    grid.innerHTML='';
    return loadLive(fetcher).then(function(items){
      status.textContent=items.length
        ? items.length+' server-listed item(s). Checkout requires separate stock and delivery confirmation.'
        : 'No independently server-listed stock is currently available for purchase. Explore deck references or enquire.';
      grid.innerHTML=items.map(renderItem).join('');
      return {state:items.length?'LISTINGS_VISIBLE':'NO_VERIFIED_STOCK',count:items.length};
    }).catch(function(){
      status.textContent='Live inventory is unavailable. Stock and checkout cannot be verified; no items are offered for purchase.';
      grid.innerHTML='';
      return {state:'INVENTORY_UNVERIFIED',count:0};
    });
  }
  return Object.freeze({ENDPOINT,isSellablePublicItem,publicItem,selectItems,renderItem,loadLive,mount});
});
