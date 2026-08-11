(function(){
  function render(){
    var node=document.getElementById('locale-context');
    if(!node)return;
    var zone='unknown';
    try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'unknown';}catch(e){}
    var lang=navigator.language||'en';
    node.textContent='Local context: '+lang+' · '+zone;
  }
  render();
  if(navigator.geolocation&&window.isSecureContext){
    navigator.geolocation.getCurrentPosition(function(){
      var node=document.getElementById('locale-context');
      if(node)node.textContent+=' · location permission granted (not stored)';
    },function(){}, {enableHighAccuracy:false,maximumAge:86400000,timeout:2500});
  }
})();
