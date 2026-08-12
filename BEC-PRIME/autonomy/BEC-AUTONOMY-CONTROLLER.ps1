param(
    [switch]$Loop,
    [int]$IntervalSeconds = 60,
    [string]$LmStudioEndpoint = 'http://127.0.0.1:1234/v1/chat/completions',
    [string]$Model = 'qwen2.5-7b-instruct'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$Base = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent (Split-Path -Parent $Base)
$Queue = Join-Path $Base 'QUEUE'
$Runs = Join-Path $Base 'RUNS'
$Failures = Join-Path $Base 'FAILURES'
$Proofs = Join-Path $Base 'PROOFS'
$Logs = Join-Path $Base 'LOGS'
$Approved = Join-Path $Queue 'APPROVED'
$Waiting = Join-Path $Queue 'WAITING'
foreach ($d in @($Queue,$Runs,$Failures,$Proofs,$Logs,$Approved,$Waiting)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }

function Read-JsonFile([string]$Path) { if (-not (Test-Path $Path)) { throw "Missing JSON: $Path" }; return (Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json) }
function Write-JsonFile([string]$Path,$Object) { $Object | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8 }
function Log([string]$Message) { Add-Content -LiteralPath (Join-Path $Logs 'controller.log') -Value ("{0} {1}" -f (Get-Date -Format o),$Message) }
function Get-Workers { @('MTG','CRYPTO','MEDIA_MUSIC','DIGITAL_PRODUCTS') | ForEach-Object { Read-JsonFile (Join-Path $Base ("WORKER-{0}.json" -f $_)) } }

function Invoke-LmDecision($State,$Registry,$Workers,$Pending) {
    $prompt = @"
You are BEC-PRIME local revenue controller. Choose ONE next action.
Hard rules: DreamLedger is neutral. Never mix silo data, content, credentials, analytics, catalogs or offers. Never claim revenue without verified payment evidence. Never send public outreach, create checkout, deploy, clone, withdraw, transfer, or expose secrets. Those actions become approval work orders only.
Prefer the fastest credible path to money using existing approved work. Do not invent buyers, payments, credentials, URLs, market facts, or test results.
Return ONLY valid JSON with keys: silo, action, reason, priority, args.
Allowed actions: READ_REPO, WRITE_FILE, RUN_TEST, RUN_GAUNTLET, CREATE_WORK_ORDER, CHECK_DEPLOYMENT, CHECK_PAYMENT, WRITE_PROOF.
State:
$($State | ConvertTo-Json -Depth 12)
Registry:
$($Registry | ConvertTo-Json -Depth 12)
Workers:
$($Workers | ConvertTo-Json -Depth 12)
Pending work:
$($Pending | ConvertTo-Json -Depth 12)
"@
    $body = @{ model=$Model; messages=@(@{role='system';content='Output JSON only.'},@{role='user';content=$prompt}); temperature=0.1 } | ConvertTo-Json -Depth 20
    $r = Invoke-RestMethod -Uri $LmStudioEndpoint -Method Post -ContentType 'application/json' -Body $body
    if (-not $r.choices[0].message.content) { throw 'LM Studio returned no content' }
    return ($r.choices[0].message.content | ConvertFrom-Json)
}

function Assert-Silo([string]$Silo,$Registry) {
    if ([string]::IsNullOrWhiteSpace($Silo)) { throw 'Decision has no silo' }
    $found = @($Registry.silos | Where-Object { $_.silo -eq $Silo })
    if ($found.Count -ne 1) { throw "Unknown silo: $Silo" }
    return $found[0]
}
function Assert-LocalPath([string]$Silo,[string]$Path,$Worker) {
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Path required' }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $Path))
    $allowed = @($Worker.allowed_paths | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $Root $_)) })
    $ok = $false
    foreach ($a in $allowed) { if ($full.StartsWith($a,[StringComparison]::OrdinalIgnoreCase)) { $ok=$true; break } }
    if (-not $ok) { throw "Cross-silo or forbidden path: $Path" }
    return $full
}
function New-WorkOrder($Decision,$Worker) {
    $id = "WO-{0}-{1}" -f (Get-Date -Format 'yyyyMMddHHmmssfff'),$Worker.silo
    $order = [ordered]@{schema_version='BEC-WORK-ORDER-1.0';id=$id;silo=$Worker.silo;action=$Decision.action;reason=$Decision.reason;priority=$Decision.priority;args=$Decision.args;requires_human=$true;status='WAITING_APPROVAL';created_at=(Get-Date -Format o)}
    Write-JsonFile (Join-Path $Waiting "$id.json") $order
    return $order
}
function Execute-SafeAction($Decision,$Worker) {
    switch ($Decision.action) {
        'READ_REPO' { $p=Assert-LocalPath $Worker.silo ([string]$Decision.args.path) $Worker; return (Get-Content -Raw -LiteralPath $p) }
        'WRITE_FILE' { $p=Assert-LocalPath $Worker.silo ([string]$Decision.args.path) $Worker; Set-Content -LiteralPath $p -Value ([string]$Decision.args.content) -Encoding UTF8; return 'WRITE_OK' }
        'RUN_TEST' { $name=[string]$Decision.args.script; if ($name -notmatch '^[A-Za-z0-9_.-]+\.(ps1|js)$') { throw 'Invalid test script' }; $p=Assert-LocalPath $Worker.silo ("BEC-PRIME/autonomy/$name") $Worker; if ($p.EndsWith('.ps1')) { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $p } else { & node.exe $p }; if ($LASTEXITCODE -ne 0) { throw "Test failed: $name" }; return 'TEST_PASS' }
        'RUN_GAUNTLET' { return 'GAUNTLET_REQUEST_REQUIRES_IMPLEMENTED_LOCAL_GATE' }
        'CHECK_DEPLOYMENT' { return 'DEPLOYMENT_CHECK_REQUIRES_EXPLICIT_LOCAL_ADAPTER' }
        'CHECK_PAYMENT' { return 'PAYMENT_CHECK_REQUIRES_SERVER_AUTHORITATIVE_EVIDENCE' }
        'WRITE_PROOF' { $id="AUTONOMY-{0}.json" -f (Get-Date -Format 'yyyyMMddHHmmssfff'); $proof=[ordered]@{type='bec-autonomy-cycle';status='PASS';silo=$Worker.silo;action=$Decision.action;verified_payment=$false;revenue_nzd=0;timestamp=(Get-Date -Format o);evidence='No payment claim. Controller cycle evidence only.'}; Write-JsonFile (Join-Path $Proofs $id) $proof; return $id }
        'CREATE_WORK_ORDER' { return (New-WorkOrder $Decision $Worker) }
        default { throw "Action not executable: $($Decision.action)" }
    }
}

function Invoke-Cycle {
    $state=Read-JsonFile (Join-Path $Base 'STATE.json'); $registry=Read-JsonFile (Join-Path $Base 'SILO-REGISTRY.json'); $workers=Get-Workers
    $pending=@(Get-ChildItem -LiteralPath $Waiting -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object { Read-JsonFile $_.FullName })
    $decision=Invoke-LmDecision $state $registry $workers $pending
    $worker=@($workers | Where-Object {$_.silo -eq $decision.silo})[0]
    if ($null -eq $worker) { throw "No worker for silo $($decision.silo)" }
    if ($decision.action -in @('CREATE_CHECKOUT','PUBLIC_POST','SEND_OUTREACH','CREATE_GITHUB_COMMIT','CLONE_SILO','DEPLOY')) { $result=New-WorkOrder $decision $worker } else { $result=Execute-SafeAction $decision $worker }
    $run=[ordered]@{schema_version='BEC-AUTONOMY-RUN-1.0';timestamp=(Get-Date -Format o);silo=$worker.silo;action=$decision.action;reason=$decision.reason;result=if($result -is [string]){$result}else{'WORK_ORDER_CREATED'};revenue_nzd_verified=0}
    $runPath=Join-Path $Runs ("RUN-{0}.json" -f (Get-Date -Format 'yyyyMMddHHmmssfff')); Write-JsonFile $runPath $run
    $state.cycles=[int]$state.cycles+1; $state.last_action=$decision; $state.last_silo=$worker.silo; $state.timestamp=(Get-Date -Format o); Write-JsonFile (Join-Path $Base 'STATE.json') $state
    Log ("cycle=$($state.cycles) silo=$($worker.silo) action=$($decision.action) revenue_verified=0")
    return $run
}

while ($true) {
    try { Invoke-Cycle | Out-Null; Log 'cycle PASS' } catch { $f=Join-Path $Failures ("FAIL-{0}.json" -f (Get-Date -Format 'yyyyMMddHHmmssfff')); Write-JsonFile $f ([ordered]@{timestamp=(Get-Date -Format o);error=$_.Exception.Message}); Log ("cycle FAIL: $($_.Exception.Message)") }
    if (-not $Loop) { break }
    Start-Sleep -Seconds $IntervalSeconds
}
