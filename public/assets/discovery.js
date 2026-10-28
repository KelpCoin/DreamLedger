/* Read-only discovery client. Payment authority remains Stripe and BECK's existing fulfilment rails. */
(function(){
 "use strict";
 var host=document.querySelector("[data-bec-catalog]");
 if(!host)return;
 var list=document.getElementById("bec-products"),msg=document.getElementById("bec-results-message");
 var search=document.getElementById("bec-query"),region=document.getElementById("bec-region"),filter=document.getElementById("bec-category");
 if(!list||!msg||!search||!region||!filter)return;
 var params=new URLSearchParams(location.search);
 search.value=(params.get("q")||"").slice(0,100);
 var known=["NZ","AU","GLOBAL"];
 var r=(params.get("region")||"").toUpperCase();
 try{r=r||sessionStorage.getItem("bec_region")||"";}catch(_){}
 region.value=known.includes(r)?r:"NZ";
 var products=[];
 function node(tag,text,klass){var e=document.createElement(tag);if(klass)e.className=klass;if(text)e.textContent=text;return e;}
 function absoluteStripe(url){try{var u=new URL(String(url||""));return u.protocol==="https:"&&(u.hostname==="buy.stripe.com"||u.hostname==="checkout.stripe.com")?u.href:null;}catch(_){return null;}}
 function render(){
  var q=search.value.trim().toLowerCase(),cat=filter.value;
  var visible=products.filter(function(p){
   return(!cat||p.category===cat)&&(!q||(p.name+" "+p.description+" "+p.category).toLowerCase().includes(q));
  });
  list.replaceChildren();
  visible.forEach(function(p){
   var card=node("article",null,"bec-card bec-offer");
   card.append(node("div",p.category.replace(/[-_]/g," ").toUpperCase(),"bec-chip"));
   card.append(node("h3",p.name));
   card.append(node("p",p.description));
   var amount=Number(p.price);
   card.append(node("div",Number.isFinite(amount)?"NZ$"+amount.toFixed(amount%1?2:0):"Price not verified","bec-price"));
   var buyer=node("p",p.delivery_status==="unknown"?"Delivery region / entitlement: confirm before checkout":"Delivery eligibility: see offer terms","bec-muted");
   card.append(buyer);
   var href=absoluteStripe(p.checkout_url);
   var details=typeof p.offer_page==="string"&&/^\/(?!\/)[a-z0-9/_-]+(?:\.html)?$/i.test(p.offer_page)?p.offer_page:null;
   if(details){var detailLink=node("a","View offer and purchase details","bec-btn");detailLink.href=details;card.append(detailLink);}
   if(p.checkout_available&&href){
    var link=node("a","Secure Stripe checkout",details?"bec-btn secondary":"bec-btn");link.href=href;link.rel="nofollow";card.append(link);
   }else{
    var note=node("span","Browse only · checkout not verified","bec-chip");card.append(note);
   }
   list.append(card);
  });
  msg.textContent=visible.length+" listed offer"+(visible.length===1?"":"s")+" match. Availability and fulfilment are subject to each offer's actual contract; no sales are implied.";
  if(!visible.length)list.append(node("p","No matching published offers. Try another category or Browse Everything.","bec-muted"));
  try{sessionStorage.setItem("bec_region",region.value);}catch(_){}
 }
 var form=document.getElementById("bec-search-form");
 if(form)form.addEventListener("submit",function(e){e.preventDefault();render();var url=new URL(location.href);if(search.value.trim())url.searchParams.set("q",search.value.trim());else url.searchParams.delete("q");url.searchParams.set("region",region.value);history.replaceState(null,"",url.pathname+url.search);});
 filter.addEventListener("change",render);region.addEventListener("change",render);search.addEventListener("input",render);
 var clear=document.getElementById("bec-browse-all");if(clear)clear.addEventListener("click",function(){search.value="";filter.value="";render();});
 Promise.all([fetch("/api/discovery/catalog",{cache:"no-store"}).then(function(r){if(!r.ok)throw Error("catalog unavailable");return r.json();}),fetch("/api/discovery/silos",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})]).then(function(res){
  var c=res[0],s=res[1];products=Array.isArray(c.products)?c.products:[];
  var categories=[...new Set(products.map(function(x){return x.category}).filter(Boolean))].sort();
  categories.forEach(function(x){var option=node("option",x.replace(/-/g," "));option.value=x;filter.append(option);});
  if(s&&Array.isArray(s.silos)){var out=document.getElementById("bec-silos");if(out){out.replaceChildren();s.silos.forEach(function(x){var a=node("a",x.label,"bec-card bec-category");a.href=x.route||"/marketplace.html";a.append(node("span","REGISTERED SILO · inventory not implied","bec-chip"));out.append(a);});}}}
  render();
 }).catch(function(){msg.textContent="Catalogue status is unavailable. Do not infer availability or attempt an unverified payment.";list.replaceChildren(node("p","The verified catalogue could not be loaded. Explore existing silo pages from the navigation above.","bec-note"));});
})();
