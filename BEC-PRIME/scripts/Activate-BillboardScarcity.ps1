#requires -Version 5.1
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Copy-Item (Join-Path $root 'routes\billboard-v2.js') (Join-Path $root 'routes\billboard.js') -Force
$compiled=Join-Path $root 'compiled\website\billboard.html'
$html=Get-Content $compiled -Raw
$html=$html.Replace("/api/molt-beach-inventory?market=", "/api/billboard/inventory/")
$html=$html.Replace('input id="image_url" type="url" maxlength="1000" required placeholder="https://example.com/image.png"','input id="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required')
$html=$html.Replace('Image URL','Image file')
$html=$html.Replace('.rail{display:flex;gap:12px;overflow:auto;padding:3px 2px 15px}', '.rail{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:3px 2px 15px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}.rail::-webkit-scrollbar{display:none}.offer{scroll-snap-align:start}')
$html=$html.Replace('<div class="section"><div class="eyebrow">Placement catalog</div>', '<div class="section"><div class="eyebrow">Placement catalog</div><div class="notice">Swipe left or right to compare footprints. The catalogue does not auto-rotate.</div>')
$start=$html.IndexOf("$('#form').addEventListener('submit'")
$end=$html.IndexOf('render();load();claimAfterReturn()})();',$start)
if($start -lt 0 -or $end -lt 0){throw 'Billboard submit handler anchors not found'}
$handler=@'
$('#form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData();f.append('size',state.size);f.append('market',state.market);f.append('title',$('#title').value.trim());f.append('name','');f.append('email',$('#email').value.trim());f.append('link',$('#destination_url').value.trim());const image=$('#image').files[0];if(!image){$('#status').className='status bad';$('#status').textContent='Choose an image.';return}f.append('image',image);$('#status').textContent='Creating secure Stripe Checkout...';const r=await fetch('/api/billboard/submit/'+state.market,{method:'POST',body:f});const d=await r.json();if(!r.ok){$('#status').className='status bad';$('#status').textContent=d.error||'Checkout creation failed';return}location.href=d.checkout_url});
'@
$html=$html.Substring(0,$start)+$handler+$html.Substring($end)
$html=$html.Replace("$('#live').textContent=d.campaigns.length;$('#pixels').textContent=((used/1000000)*100).toFixed(2)+'%'", "$('#live').textContent=d.ads.length;$('#pixels').textContent=d.founding_positions_remaining+' / 100';$('#scarcity').textContent=d.founding_positions_remaining===0?'SOLD OUT IN THIS MARKET':d.founding_positions_remaining+' of 100 founding positions remain in '+d.market_name+'. Genuine fixed inventory.'")
$html=$html.Replace('<div class="section"><div class="eyebrow">Live canvas</div>', '<div class="section"><div class="eyebrow">Live canvas</div><div id="scarcity" class="notice">Loading genuine inventory...</div>')
Set-Content $compiled $html -Encoding UTF8
Write-Host 'PASS: billboard scarcity, swipe-first catalogue and real upload checkout activated'
