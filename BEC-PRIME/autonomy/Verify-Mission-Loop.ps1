param([string]$Root = (Split-Path -Parent $PSScriptRoot))
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$A = $PSScriptRoot
function ReadJ($p){Get-Content -Raw -LiteralPath $p | ConvertFrom-Json}
$reg=ReadJ (Join-Path $A 'SILO-REGISTRY.json')
$state=ReadJ (Join-Path $A 'MISSION-STATE.json')
if($state.human_approval_required -ne $true){throw 'Human approval boundary missing'}
if($reg.rules.cross_silo_offers -ne $false){throw 'Cross-silo offers are not disabled'}
if($reg.rules.cross_silo_customer_data -ne $false){throw 'Cross-silo customer data is not disabled'}
if($reg.rules.revenue_requires_verified_payment -ne $true){throw 'Revenue evidence gate missing'}
$files=@(Get-ChildItem (Join-Path $A 'QUEUE/PLANNED') -Filter '*.json' -ErrorAction SilentlyContinue)
if($files.Count -lt 1){throw 'No planned mission files'}
$seen=@{}
foreach($f in $files){$j=ReadJ $f.FullName;if($seen.ContainsKey($j.silo)){throw "Duplicate silo mission: $($j.silo)"};$seen[$j.silo]=$true;if($j.constraints.public_actions_require_approval -ne $true){throw "Public approval gate missing: $($j.silo)"}}
$proof=Join-Path $A ('PROOFS/MISSION-VERIFY-{0}.json' -f (Get-Date -Format 'yyyyMMddHHmmssfff'))
[ordered]@{schema_version='BEC-PRIME-MISSION-PROOF-1.0';status='PASS';missions=$files.Count;verified_revenue_nzd=0;human_approval_required=$true;cross_silo=false;timestamp=(Get-Date -Format o)} | ConvertTo-Json -Depth 10 | Set-Content $proof -Encoding UTF8
Write-Output "PASS $proof"