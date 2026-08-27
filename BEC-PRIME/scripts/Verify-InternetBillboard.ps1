$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Html = Join-Path $Root 'compiled\website\billboard.html'
$Compiler = Join-Path $Root 'compiler\BillboardCompiler.js'
$Activate = Join-Path $Root 'scripts\Activate-BillboardScarcity.js'
$Submit = Join-Path $Root '..\api\billboard\submit.ts'
$Checkout = Join-Path $Root '..\api\molt-beach-checkout.ts'
$Webhook = Join-Path $Root '..\api\molt-beach-webhook.ts'
$Proof = Join-Path $Root 'PROOF\2026-08-27-INTERNET-BILLBOARD-DOOH-PRELAUNCH.json'
$Failures = @()
foreach($p in @($Html,$Compiler,$Activate,$Submit,$Checkout,$Webhook,$Proof)){ if(-not (Test-Path $p)){ $Failures += "MISSING:$p" } }
if(Test-Path $Html){ $h = Get-Content -Raw $Html; foreach($m in @('BUY A PIECE','LEAVE IT UNTIL 3000','1,000,000','NZ$50','/api/molt-beach-inventory','/api/billboard/submit','PAID_PENDING_REVIEW','Image Placement + human approval')){ if($h -notlike "*$m*"){ $Failures += "HTML_MARKER_MISSING:$m" } } }
if(Test-Path $Compiler){ $c = Get-Content -Raw $Compiler; if($c -like '*fs.writeFileSync(compiled*'){ $Failures += 'ACTIVATION_COMPILER_MUST_NOT_OVERWRITE_CANONICAL_SURFACE' } }
if(Test-Path $Activate){ $a = Get-Content -Raw $Activate; if($a -like '*fs.writeFileSync(compiled*'){ $Failures += 'ACTIVATION_SCRIPT_MUST_NOT_OVERWRITE_CANONICAL_SURFACE' }; if($a -notlike '*human_review:true*'){ $Failures += 'HUMAN_REVIEW_GUARD_MISSING' } }
if(Test-Path $Submit){ $s = Get-Content -Raw $Submit; if($s -notlike '*image_requested*'){ $Failures += 'IMAGE_ADDON_FLAG_MISSING' } }
if(Test-Path $Checkout){ $x = Get-Content -Raw $Checkout; foreach($m in @('IMAGE_ADDON','image_requested','January 1, 3000')){ if($x -notlike "*$m*"){ $Failures += "CHECKOUT_MARKER_MISSING:$m" } } }
if(Test-Path $Webhook){ $w = Get-Content -Raw $Webhook; foreach($m in @('PAID_PENDING_REVIEW','refunds','molt_beach_campaigns')){ if($w -notlike "*$m*"){ $Failures += "WEBHOOK_MARKER_MISSING:$m" } } }
$ProofObj = $null
if(Test-Path $Proof){ $ProofObj = Get-Content -Raw $Proof | ConvertFrom-Json; if($ProofObj.offer.standard_price_nzd -ne 50){ $Failures += 'PROOF_PRICE_NOT_50_NZD' }; if($ProofObj.offer.retention_until -ne '3000-01-01'){ $Failures += 'PROOF_RETENTION_NOT_3000' }; if(-not $ProofObj.offer.image_requires_human_approval){ $Failures += 'PROOF_IMAGE_REVIEW_FALSE' } }
$Result = [pscustomobject]@{ status = $(if($Failures.Count -eq 0){'PASS'}else{'FAIL'}); checked_utc = (Get-Date).ToUniversalTime().ToString('o'); failures = $Failures; root = $Root }
$Out = Join-Path $Root 'PROOF\VERIFY-InternetBillboard-latest.json'
$Result | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $Out
$Result | ConvertTo-Json -Depth 6
if($Failures.Count -gt 0){ exit 1 }
exit 0
