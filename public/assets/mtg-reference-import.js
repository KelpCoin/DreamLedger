'use strict';
/* MTG master: private client-side reuse of listing text and external references.
   No scraping, no publishing, no fetching third-party pages, no score inflation. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root==='object')root.MTGImport=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  function plain(value,max){return String(value==null?'':value).trim().slice(0,max);}
  function safeUrl(input){
    const raw=plain(input,2048);
    if(!/^https:\/\//i.test(raw))throw new Error('Use a public HTTPS link.');
    let url;
    try{url=new URL(raw);}catch{throw new Error('Invalid link.');}
    const host=url.hostname.toLowerCase();
    if(!host||host==='localhost'||host.endsWith('.local')||
       host.endsWith('.internal')||host.endsWith('.test')||
       /^(10|127|0|169\.254|192\.168)\./.test(host)||
       /^172\.(1[6-9]|2\d|3[01])\./.test(host)||
       /^\[?(::1|fc|fd|fe80)/i.test(host)||
       !host.includes('.')||host.length>253||url.username||url.password||
       (url.port&&url.port!=='443')){
      throw new Error('Use a normal public HTTPS profile or listing URL.');
    }
    for(const key of [...url.searchParams.keys()]){
      if(/^(utm_|fbclid$|gclid$|igshid$|mc_)/i.test(key))url.searchParams.delete(key);
    }
    url.hash='';
    return url.toString().slice(0,1500);
  }
  function previewReference(data){
    const url=safeUrl(data.url);
    const note=plain(data.note,350);
    const claimedHandle=plain(data.handle,80);
    if(/[<>\x00-\x1f]/.test(note+claimedHandle))
      throw new Error('Reference note contains unsupported characters.');
    return {
      url,source_host:new URL(url).hostname,claimed_handle:claimedHandle,
      note,verification:'SELF_SUBMITTED_UNVERIFIED',
      verified_sales:0,reputation_credit:0,public_visibility:'PRIVATE_DRAFT',
      permissions:'USER_SUBMITTED_LINK_ONLY',
      imported_content:'NONE',
    };
  }
  function previewListing(input){
    const text=plain(input,6000);
    if(text.length<4)throw new Error('Paste an existing card listing or its description.');
    let obj=null;
    if(text.startsWith('{')){
      try{obj=JSON.parse(text);}catch{}
    }
    const title=(obj&&plain(obj.title||obj.card||obj.name,160))||
      plain(text.split(/\r?\n/).map(x=>x.trim()).find(x=>x&&!/^https?:\/\//.test(x))||'',160);
    const priceRaw=obj&&obj.price_nzd!==undefined?String(obj.price_nzd):
      ((text.match(/\bNZ\$\s*([\d,]+(?:\.\d{1,2})?)/i)||[])[1]||'');
    const n=Number(priceRaw.replace(/,/g,''));
    const price=n>0&&Number.isFinite(n)&&n<=100000?Math.round(n*100)/100:null;
    const match=text.match(/\b(near mint|lightly played|moderately played|heavily played|damaged|NM|LP|MP|HP|DMG)\b/i);
    const condition=(obj&&plain(obj.condition,40))||(match?match[1]:'');
    if(!title)throw new Error('Card title missing.');
    return {
      title,price_nzd:price,condition,notes:text.slice(0,1500),
      import_status:'UNVERIFIED_PRIVATE_DRAFT',
      requires_seller_confirmation:true,published:false
    };
  }
  return Object.freeze({safeUrl,previewReference,previewListing});
});
