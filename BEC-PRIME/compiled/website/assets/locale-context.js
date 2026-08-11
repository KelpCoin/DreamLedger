(function(){
  function node(){
    var n=document.getElementById('locale-context');
    if(n)return n;
    n=document.createElement('div');
    n.id='locale-context';
    n.style.cssText='position:fixed;left:10px;bottom:10px;z-index:9999;background:#10141b;color:#9aa2ad;border:1px solid #2a303a;border-radius:999px;padding:6px 9px;font:11px system-ui,sans-serif;opacity:.92';
    document.body.appendChild(n);
    return n;
  }
  function render(extra){
    var zone='unknown';
    try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';}catch(e){}
    var lang=navigator.language||'en';
    node().textContent='Local context: '+lang+' · '+zone+(extra||'');
  }
  render();
  if(navigator.geolocation&&window.isSecureContext){
    navigator.geolocation.getCurrentPosition(function(){render(' · location permission granted (not stored)')},function(){}, {enableHighAccuracy:false,maximumAge:86400000,timeout:2500});
  }
})();
