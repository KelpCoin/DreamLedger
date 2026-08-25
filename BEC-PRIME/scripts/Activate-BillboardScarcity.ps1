#requires -Version 5.1
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Copy-Item (Join-Path $root 'routes\billboard-v2.js') (Join-Path $root 'routes\billboard.js') -Force
$compiled=Join-Path $root 'compiled\website\billboard.html'
$html=Get-Content $compiled -Raw
$html=$html.Replace("/api/molt-beach-inventory?market=", "/api/billboard/inventory/")
$html=$html.Replace("const MARKETS={global:'GLOBAL',nz:'NZ',au:'AU',za:'ZA',americas:'AMERICAS',europe:'EUROPE'};", "const MARKETS={global:'GLOBAL',nz:'NZ',au:'AU',za:'ZA',americas:'AMERICAS',europe:'EUROPE'};")
$html=$html.Replace("/api/billboard/submit'", "/api/billboard/submit/'+state.market")
$html=$html.Replace('input id="image_url" type="url" maxlength="1000" required placeholder="https://example.com/image.png"','input id="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required')
$html=$html.Replace('Image URL','Image file')
$old="async function load(){try{const r=await fetch('/api/billboard/inventory/'+encodeURIComponent(state.market));const d=await r.json();"
if($html -notmatch 'founding_positions_remaining'){$html=$html.Replace("$('#live').textContent=d.campaigns.length;$('#pixels').textContent=((used/1000000)*100).toFixed(2)+'%'", "$('#live').textContent=d.ads.length;$('#pixels').textContent=d.founding_positions_remaining+' / 100';document.title='DreamLedger Billboard - '+d.market_name+' - '+d.founding_positions_remaining+' Founding Positions Left'")}
$stamp='<div id="scarcity" class="notice"></div>'
$html=$html.Replace('<div class="section"><div class="eyebrow">Live canvas</div>', '<div class="section"><div class="eyebrow">Live canvas</div>'+ $stamp)
$html=$html.Replace("$('#pixels').textContent=((used/1000000)*100).toFixed(2)+'%'", "$('#pixels').textContent=d.founding_positions_remaining+' / 100';$('#scarcity').textContent=d.founding_positions_remaining===0?'SOLD OUT IN THIS MARKET':d.founding_positions_remaining+' of 100 founding positions remain in '+d.market_name+'. Genuine fixed inventory, not an artificial countdown.'")
$scriptEnd='render();load();claimAfterReturn()})();'
$replacement="render();load();claimAfterReturn()})();"
$html=$html.Replace($scriptEnd,$replacement)
Set-Content $compiled $html -Encoding UTF8
Write-Host 'PASS: billboard scarcity runtime activated'
