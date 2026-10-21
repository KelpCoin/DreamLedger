#requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$Once,
    [int]$IntervalSeconds = 300,
    [int]$CycleTimeoutSeconds = 900
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$RunDir = if (Test-Path "D:\") { "D:\BrownEyeCortex\LAKE\FIGURE8\logs\NORTH-STAR-SUPERVISOR" } else { Join-Path $RepoRoot "runtime\lm_studio\runs" }
$ProofDir = if (Test-Path "D:\") { "D:\BrownEyeCortex\LAKE\FIGURE8\proof\NORTH-STAR-SUPERVISOR" } else { Join-Path $RepoRoot "runtime\lm_studio\runs" }
New-Item -ItemType Directory -Force -Path $RunDir,$ProofDir | Out-Null

$LmsPath = $null
$cmd = Get-Command lms.exe -ErrorAction SilentlyContinue
if ($cmd) { $LmsPath = $cmd.Source }
if (-not $LmsPath) {
    $cmd = Get-Command lms -ErrorAction SilentlyContinue
    if ($cmd) { $LmsPath = $cmd.Source }
}
if (-not $LmsPath) {
    foreach ($candidate in @(
        (Join-Path $env:USERPROFILE ".lmstudio\bin\lms.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\LM Studio\resources\app\.webpack\lms.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\LM Studio\resources\app\.webpack\bin\lms.exe")
    )) {
        if (Test-Path -LiteralPath $candidate) { $LmsPath = $candidate; break }
    }
}
if (-not $LmsPath) { throw "LM Studio CLI 'lms' not found. Install LM Studio and make its CLI available first." }

$PythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
$PythonPath = if ($PythonCommand) { $PythonCommand.Source } else { $null }
if (-not $PythonPath -and (Test-Path "C:\Python314\python.exe")) { $PythonPath = "C:\Python314\python.exe" }
if (-not $PythonPath) { $PythonCommand = Get-Command python -ErrorAction SilentlyContinue; if ($PythonCommand) { $PythonPath = $PythonCommand.Source } }
if (-not $PythonPath) { throw "Python was not found. No models, packages, or runtimes were downloaded." }

$Controller = Join-Path $RepoRoot "runtime\lm_studio\economic_swarm_controller.py"
$Supervisor = Join-Path $RepoRoot "runtime\lm_studio\north_star_supervisor.py"
$Audit = Join-Path $RepoRoot "runtime\lm_studio\north_star_priority_audit.py"
foreach ($required in @($Controller,$Supervisor,$Audit)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required local runtime file missing: $required" }
}
if ($IntervalSeconds -lt 30 -or $CycleTimeoutSeconds -lt 60) { throw "Interval must be >= 30 and cycle timeout >= 60 seconds." }

function Invoke-Lms {
    param([string[]]$Arguments)
    $output = & $script:LmsPath @Arguments 2>&1
    $code = $LASTEXITCODE
    $text = (($output | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)
    if ($code -ne 0) { throw ("lms exit {0}: {1}" -f $code,$text.Substring(0,[Math]::Min(800,$text.Length))) }
    return $text.Trim()
}
function Get-LmsJson {
    param([string[]]$Arguments)
    $raw = Invoke-Lms -Arguments $Arguments
    try { return ($raw | ConvertFrom-Json) } catch { throw ("Invalid JSON from lms {0}" -f ($Arguments -join " ")) }
}
function Normalize-Items {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [System.Array]) { return @($Value) }
    foreach ($name in @("models","data","items")) {
        $property = $Value.PSObject.Properties[$name]
        if ($property) { return @($property.Value) }
    }
    return @($Value)
}
function Get-Field {
    param($Object,[string[]]$Names)
    foreach ($name in $Names) {
        $property = $Object.PSObject.Properties[$name]
        if ($property -and $null -ne $property.Value) {
            $value = [string]$property.Value
            if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
        }
    }
    return ""
}
function Get-VisibleModelIds {
    try {
        $result = Invoke-RestMethod -Uri "http://127.0.0.1:1234/v1/models" -TimeoutSec 12
        return @($result.data | ForEach-Object { [string]$_.id } | Where-Object { $_ })
    } catch { return @() }
}
function Ensure-LocalServer {
    $ids = Get-VisibleModelIds
    if ($null -ne $ids) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:1234/v1/models" -TimeoutSec 5 -UseBasicParsing
            if ([int]$response.StatusCode -eq 200) { return }
        } catch {}
    }
    $serverStatus = $null
    try { $serverStatus = Get-LmsJson @("server","status","--json","--quiet") } catch {}
    $serverRunning = (Get-Field $serverStatus @("running")) -eq "true"
    $serverPort = Get-Field $serverStatus @("port")
    if ($serverStatus -and $serverRunning -and $serverPort -and [int]$serverPort -ne 1234) {
        throw ("LM Studio is already serving on port {0}. Refusing to start a second server or guess a replacement port." -f $serverPort)
    }
    $null = Invoke-Lms -Arguments @("server","start","--port","1234")
    for ($n=0; $n -lt 60; $n++) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:1234/v1/models" -TimeoutSec 5 -UseBasicParsing
            if ([int]$response.StatusCode -eq 200) { return }
        } catch {}
    }
    throw "LM Studio did not expose the local-only API on 127.0.0.1:1234 within 60 seconds."
}

$roleSpecs = @(
    [pscustomobject]@{ Role="scout"; EnvironmentName="DREAMLEDGER_SCOUT_MODEL"; Identifier="phi-3-mini-4k-instruct"; Match="phi-3-mini-4k-instruct"; Context=4096 },
    [pscustomobject]@{ Role="critic"; EnvironmentName="DREAMLEDGER_CRITIC_MODEL"; Identifier="qwen2.5-7b-instruct"; Match="qwen2.5-7b-instruct"; Context=8192 },
    [pscustomobject]@{ Role="synthesis"; EnvironmentName="DREAMLEDGER_SYNTHESIS_MODEL"; Identifier="qwen_qwen2.5-vl-7b-instruct"; Match="qwen2.5-vl-7b-instruct"; Context=8192 }
)

# These cycles operate locally unless a human separately opts into remote reads.
$env:DREAMLEDGER_LOCAL_ONLY = "1"
$env:DREAMLEDGER_ALLOW_REMOTE_READS = "0"
$env:LM_STUDIO_BASE_URL = "http://127.0.0.1:1234"
$env:DREAMLEDGER_ROOT = $RepoRoot
if (Test-Path "D:\") { $env:BROWNEYE_ROOT = "D:\BrownEyeCortex" }

& $PythonPath $Supervisor --self-test
if ($LASTEXITCODE -ne 0) { throw "North Star supervisor offline self-test failed." }
& $PythonPath $Audit --self-test
if ($LASTEXITCODE -ne 0) { throw "North Star priority audit offline self-test failed." }

Ensure-LocalServer
$inventory = Normalize-Items (Get-LmsJson @("ls","--llm","--json"))
if ($inventory.Count -eq 0) { throw "LM Studio has no local LLMs installed. No download was attempted." }

$visibleIds = @(Get-VisibleModelIds)
$resolved = @()
foreach ($spec in $roleSpecs) {
    $desired = [string]$spec.Identifier
    $existingVisible = $visibleIds | Where-Object { $_ -eq $desired } | Select-Object -First 1
    if ($existingVisible) {
        $resolved += [pscustomobject]@{ Role=$spec.Role; Identifier=[string]$existingVisible; LoadedBeforeStart=$true; Context=$spec.Context }
        continue
    }

    $matchingVisible = $visibleIds | Where-Object { $_.ToLowerInvariant().Contains(([string]$spec.Match).ToLowerInvariant()) } | Select-Object -First 1
    if ($matchingVisible) {
        $resolved += [pscustomobject]@{ Role=$spec.Role; Identifier=[string]$matchingVisible; LoadedBeforeStart=$true; Context=$spec.Context }
        continue
    }

    $model = $inventory | Where-Object {
        $key = Get-Field $_ @("modelKey","model_key","key","id","model")
        $path = Get-Field $_ @("path","modelPath","model_path")
        (($key + " " + $path).ToLowerInvariant()).Contains(([string]$spec.Match).ToLowerInvariant())
    } | Select-Object -First 1
    if (-not $model) {
        throw ("Missing local model for role {0}. Expected an installed model containing '{1}'. No model download was attempted." -f $spec.Role,$spec.Match)
    }
    $key = Get-Field $model @("modelKey","model_key","key","id","model")
    if (-not $key) { throw ("Installed model record has no usable model key for role {0}." -f $spec.Role) }

    Write-Host ("LOADING_LOCAL_MODEL role={0} model={1} context={2}" -f $spec.Role,$spec.Identifier,$spec.Context)
    $null = Invoke-Lms -Arguments @("load",$key,"--identifier",$desired,"--context-length",[string]$spec.Context,"-y")
    $deadline = [DateTime]::UtcNow.AddMinutes(10)
    do {
        Start-Sleep -Seconds 2
        $visibleIds = @(Get-VisibleModelIds)
        $match = $visibleIds | Where-Object { $_ -eq $desired } | Select-Object -First 1
        if (-not $match) { $match = $visibleIds | Where-Object { $_.ToLowerInvariant().Contains(([string]$spec.Match).ToLowerInvariant()) } | Select-Object -First 1 }
    } while (-not $match -and [DateTime]::UtcNow -lt $deadline)
    if (-not $match) { throw ("Model load did not produce an API-visible model for role {0}. Check memory and LM Studio logs." -f $spec.Role) }
    $visibleIds = @(Get-VisibleModelIds)
    $resolved += [pscustomobject]@{ Role=$spec.Role; Identifier=[string]$match; LoadedBeforeStart=$false; Context=$spec.Context }
}

if ($resolved.Count -ne 3 -or (@($resolved.Identifier | Select-Object -Unique)).Count -ne 3) {
    throw "Three distinct API-visible model IDs are required. No North Star cycle was started."
}
$env:DREAMLEDGER_SCOUT_MODEL = [string]($resolved | Where-Object Role -eq "scout" | Select-Object -ExpandProperty Identifier)
$env:DREAMLEDGER_CRITIC_MODEL = [string]($resolved | Where-Object Role -eq "critic" | Select-Object -ExpandProperty Identifier)
$env:DREAMLEDGER_SYNTHESIS_MODEL = [string]($resolved | Where-Object Role -eq "synthesis" | Select-Object -ExpandProperty Identifier)

$proof = [ordered]@{
    schema = "DREAMLEDGER/LOCAL-NORTH-STAR-BOOT/v1"
    generated_at_utc = [DateTime]::UtcNow.ToString("o")
    status = "MODELS_READY"
    repository = $RepoRoot
    api_base = $env:LM_STUDIO_BASE_URL
    external_actions_enabled = $false
    remote_reads_enabled = $false
    economic_truth = [ordered]@{ verified_external_revenue_nzd = 0; settled_external_payments = 0; independent_external_buyers = 0; paid_fulfilled_orders = 0 }
    roles = @($resolved | ForEach-Object { [ordered]@{ role=$_.Role; model_id=$_.Identifier; context_length=$_.Context; loaded_before_start=$_.LoadedBeforeStart } })
}
$proofPath = Join-Path $ProofDir "LOCAL-NORTH-STAR-BOOT-LATEST.json"
$tmpPath = $proofPath + ".tmp"
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $tmpPath -Encoding ASCII
Move-Item -LiteralPath $tmpPath -Destination $proofPath -Force
Write-Host ("LOCAL_NORTH_STAR_MODELS_READY=3")
Write-Host ("LOCAL_ONLY=TRUE")
Write-Host ("BOOT_PROOF=" + $proofPath)

if ($Once) {
    & $PythonPath -u $Controller --once
    exit $LASTEXITCODE
}
& $PythonPath -u $Supervisor --interval-seconds $IntervalSeconds --cycle-timeout-seconds $CycleTimeoutSeconds
exit $LASTEXITCODE
