(function(){
  const host=document.getElementById('silo-directory-links');
  if(!host)return;
  fetch('/data/silo-directory.json',{cache:'no-store'}).then(r=>{
    if(!r.ok)throw new Error('directory unavailable');
    return r.json();
  }).then(data=>{
    host.replaceChildren();
    const entries=(Array.isArray(data.silos)?data.silos:[]).filter(s=>s&&s.status==='active'&&typeof s.route==='string'&&/^\/[a-z0-9-]+\/$/.test(s.route));
    if(!entries.length){host.textContent='No active marketplaces are published yet.';return;}
    for(const silo of entries){
      const link=document.createElement('a');
      link.href=silo.route;
      link.className='btn ghost';
      link.textContent=silo.name||silo.key;
      host.append(link);
    }
  }).catch(()=>{
    host.textContent='Active marketplace directory unavailable.';
  });
})();
