(function(){
  if(document.getElementById('dreamledger-canonical-qr')) return;
  var box=document.createElement('div');
  box.id='dreamledger-canonical-qr';
  box.title='Canonical BrownEye QR';
  box.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99999;width:72px;height:72px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#000;box-shadow:0 8px 30px rgba(0,0,0,.4);overflow:hidden';
  var img=document.createElement('img');
  img.alt='BrownEye canonical QR';
  img.width=72;img.height=72;
  img.style.cssText='width:100%;height:100%;object-fit:contain;display:block';
  box.appendChild(img);
  document.body.appendChild(box);
  Promise.all([0,1,2].map(function(i){return fetch('/assets/canonical-qr-part-'+i+'.b64.txt').then(function(r){return r.text()})}))
    .then(function(parts){img.src='data:image/jpeg;base64,'+parts.map(function(p){return p.trim()}).join('');})
    .catch(function(){});
})();
