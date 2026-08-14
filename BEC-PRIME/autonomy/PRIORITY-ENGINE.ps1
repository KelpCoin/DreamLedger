param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$Autonomy = $PSScriptRoot
$Queue = Join-Path $Autonomy 'QUEUE/PLANNED'
$Proof = Join-Path $Autonomy 'PROOFS'
New-Item -ItemType Directory -Force -Path $Queue,$Proof | Out-Null
function ReadJ($p){Get-Content -Raw -LiteralPath $p | ConvertFrom-Json}
function WriteJ($p,$o){$o | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $p -Encoding UTF8}
$reg = ReadJ (Join-Path $Autonomy 'SILO-REGISTRY.json')
$state = ReadJ (Join-Path $Autonomy 'STATE.json')
$now = Get-Date
$jobs = @()
foreach($s in @($reg.silos)) {
  $base = [int]$s.priority * 10
  $revenue = [int]$s.price_nzd
  $active = if($s.status -eq 'active'){20}else{-100}
  $paymentGap = if([int]$state.revenue_nzd_verified -eq 0){25}else{0}
  $score = $base + [Math]::Min($revenue,100) + $active + $paymentGap
  $jobs += [ordered]@{
    id = ('MISSION-{0}-{1}' -f $now.ToUniversalTime().ToString('yyyyMMddHHmmss'),$s.id)
    silo = $s.silo
    priority = $score
    objective = 'Advance the highest-value revenue-safe work without crossing silo boundaries.'
    needs = @(
      [ordered]@{type='ACCOUNT';action='CHECK_DEPLOYMENT';reason='Production account journey must be proven.'},
      [ordered]@{type='COMMERCE';action='CHECK_PAYMENT';reason='Revenue must be verified from authoritative evidence.'},
      [ordered]@{type='ASSET';action='ASSET_REQUEST';reason='Create missing hero media only when a silo surface needs it.'},
      [ordered]@{type='TOOL';action='TOOL_REQUEST';reason='Create or repair the smallest tool that removes the current blocker.'}
    )
    constraints = [ordered]@{human_approval_required=$true;public_actions_require_approval=$true;cross_silo=false;revenue_requires_verified_payment=$true}
  }
}
$jobs = @($jobs | Sort-Object priority -Descending)
$i=0
foreach($j in $jobs){$i++; $j.rank=$i; WriteJ (Join-Path $Queue ("{0:D2}-{1}.json" -f $i,$j.silo)) $j}
$manifest=[ordered]@{schema_version='BEC-PRIME-MISSION-1.0';timestamp=$now.ToUniversalTime().ToString('o');status='PLANNED';verified_revenue_nzd=[int]$state.revenue_nzd_verified;mission_count=$jobs.Count;missions=$jobs}
$manifestPath=Join-Path $Proof ('MISSION-PLAN-{0}.json' -f $now.ToUniversalTime().ToString('yyyyMMddHHmmss'))
WriteJ $manifestPath $manifest
WriteJ (Join-Path $Autonomy 'MISSION-STATE.json') ([ordered]@{schema_version='BEC-PRIME-MISSION-STATE-1.0';status='armed';last_plan=$manifestPath;top_silo=$jobs[0].silo;top_priority=$jobs[0].priority;human_approval_required=$true})
Write-Output $manifestPath