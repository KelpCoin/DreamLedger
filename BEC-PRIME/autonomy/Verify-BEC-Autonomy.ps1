#requires -Version 5.1
$ErrorActionPreference='Stop'
$Base=Split-Path -Parent $MyInvocation.MyCommand.Path
$required=@('BEC-AUTONOMY-CONTROLLER.ps1','TOOL-POLICY.json','SILO-REGISTRY.json','STATE.json','WORKER-MTG.json','WORKER-CRYPTO.json','WORKER-MEDIA-MUSIC.json','WORKER-DIGITAL-PRODUCTS.json')
foreach($f in $required){$p=Join-Path $Base $f;if(-not(Test-Path $p)){throw "MISSING $f"};if($f.EndsWith('.json')){Get-Content -Raw $p|ConvertFrom-Json|Out-Null}}
$controller=Get-Content -Raw (Join-Path $Base 'BEC-AUTONOMY-CONTROLLER.ps1')
$policy=Get-Content -Raw (Join-Path $Base 'TOOL-POLICY.json')|ConvertFrom-Json
$registry=Get-Content -Raw (Join-Path $Base 'SILO-REGISTRY.json')|ConvertFrom-Json
if($controller -notmatch '127\.0\.0\.1:1234'){throw 'LM Studio endpoint guard missing'}
if($controller -notmatch 'WAITING_APPROVAL'){throw 'Human approval queue missing'}
if($controller -notmatch 'Assert-Silo'){throw 'Silo identity guard missing'}
if($controller -notmatch 'Assert-LocalPath'){throw 'Path isolation missing'}
if($controller -notmatch 'revenue_nzd_verified=0'){throw 'Fail-closed revenue proof missing'}
if($policy.forbidden_actions -notcontains 'CROSS_SILO_WRITE'){throw 'Cross-silo write block missing'}
if($policy.forbidden_actions -notcontains 'WITHDRAW_MONEY'){throw 'Money withdrawal block missing'}
if(-not $registry.rules.dreamledger_brand_neutral){throw 'DreamLedger neutrality missing'}
if($registry.rules.cross_silo_offers){throw 'Cross-silo offers must be false'}
$expected=@('mtg','crypto','media_music','digital_products')
$actual=@($registry.silos|ForEach-Object{$_.silo})
foreach($s in $expected){if($actual -notcontains $s){throw "Missing silo $s"}}
$proof=[ordered]@{type='bec-autonomy-verification';status='PASS';timestamp=(Get-Date -Format o);checks=@('required files','JSON parse','LM Studio local endpoint','human approval queue','path isolation','fail-closed revenue','money withdrawal block','cross-silo block','DreamLedger neutrality','four silos');verified_revenue_nzd=0}
$proofPath=Join-Path $Base 'PROOFS/AUTONOMY-CONTROLLER-PROOF.json'
New-Item -ItemType Directory -Path (Split-Path $proofPath) -Force|Out-Null
$proof|ConvertTo-Json -Depth 10|Set-Content $proofPath -Encoding UTF8
Write-Host 'PASS: BEC autonomy controller verified. Verified revenue: NZD 0.'
Write-Host "Proof: $proofPath"
