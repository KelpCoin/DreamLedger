'use strict';
/* Client of the private opt-in MTG two-party trade passport.
 * No account, no fees, no payment capture. No claims of independent verification.
 */
(function(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  if(!$('tradeLedger'))return;
  const base='/api/mtg/marketplace/trade/';
  async function request(action,payload){
    const r=await fetch(base+action,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      cache:'no-store',
      body:JSON.stringify(payload),
    });
    const text=await r.text();
    let result;
    try{result=JSON.parse(text);}catch{throw new Error('Trade service unavailable or returned invalid data.');}
    if(!r.ok)throw new Error(result.error||'Trade request was not accepted.');
    return result;
  }
  function status(message,error){
    $('tradeStatus').textContent=message;
    $('tradeStatus').className=error?'import-status error':'import-status';
  }
  function fill(id,role,secret){
    $('tradeActionId').value=id;
    $('tradeRole').value=role;
    $('tradeRoleToken').value=secret;
    $('tradeAction').value='view';
    try{sessionStorage.setItem('mtg_trade_last_'+role,JSON.stringify({id,secret}));}catch{}
  }
  function display(result){
    const el=$('tradeResult');
    el.hidden=false;
    const clean={...result};
    delete clean.seller_token;delete clean.buyer_token;delete clean.invitation_token;
    el.textContent=JSON.stringify(clean,null,2);
  }
  function secureInvite(id,secret){
    const url=new URL('/mtg-marketplace/',window.location.origin);
    url.hash='trade_id='+encodeURIComponent(id)+'&invite='+encodeURIComponent(secret);
    return url.href;
  }
  const create=$('tradeCreateForm');
  create.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=create.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      const made=await request('create',{
        seller_handle:$('tradeSeller').value,
        seller_offers:$('tradeOffers').value,
        seller_wants:$('tradeWants').value,
        terms:$('tradeTerms').value,
      });
      fill(made.trade_id,'seller',made.seller_token);
      $('tradePrivateCode').value=secureInvite(made.trade_id,made.invitation_token);
      status('Created privately. Share the invitation link, NOT your seller access code. Keep the seller code in the agreement form safe.',false);
      display({trade_id:made.trade_id,status:made.status,verification:'PEER_ATTESTED_ONLY',reputation_credit:0});
    }catch(err){status(err.message,true);}finally{btn.disabled=false;}
  });
  const join=$('tradeJoinForm');
  join.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=join.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      const made=await request('join',{
        trade_id:$('tradeJoinId').value,invitation_token:$('tradeJoinInvite').value,
        buyer_handle:$('tradeBuyer').value,
      });
      fill(made.trade_id,'buyer',made.buyer_token);
      $('tradePrivateCode').value='Private buyer access code is shown in the action form. Never share it.';
      status('Joined. Review terms with your private code and confirm only if you agree.',false);
      display({trade_id:made.trade_id,status:made.status,verification:'PEER_ATTESTED_ONLY',reputation_credit:0});
      $('tradeJoinInvite').value='';
    }catch(err){status(err.message,true);}finally{btn.disabled=false;}
  });
  const actionForm=$('tradeActionForm');
  actionForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=actionForm.querySelector('button[type="submit"]');btn.disabled=true;
    try{
      const action=$('tradeAction').value;
      const details={trade_id:$('tradeActionId').value,role:$('tradeRole').value,
        token:$('tradeRoleToken').value};
      if(action==='feedback'){
        details.rating=$('tradeRating').value;
        details.comment=$('tradeComment').value;
      }
      const result=await request(action,details);
      const state=action==='view'?result:await request('view',details);
      display(state);
      status(action==='view'?'Agreement shown privately.':
        'Recorded your '+action+' action. This is NOT independent payment or delivery proof.',false);
    }catch(err){status(err.message,true);}finally{btn.disabled=false;}
  });
  // URL fragment is client-only; do not put capabilities in query strings.
  if(window.location.hash.startsWith('#trade_id=')){
    const parts=new URLSearchParams(window.location.hash.slice(1));
    const id=parts.get('trade_id'),secret=parts.get('invite');
    if(/^trade_[a-f0-9]{32}$/.test(id||'')&&/^[a-f0-9]{64}$/.test(secret||'')){
      $('tradeJoinId').value=id;$('tradeJoinInvite').value=secret;
      status('Invitation loaded privately. Enter your trading handle to join.',false);
    }
    window.history.replaceState(null,'',window.location.pathname+window.location.search);
  }
})();
