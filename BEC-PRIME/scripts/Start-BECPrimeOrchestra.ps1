# BEC PRIME startup orchestra for Windows 11
# Starts LM Studio daemon/server, keeps one local LLM loaded, then starts the local revenue cycle.
# Public actions remain approval-gated. No payment execution occurs here.

[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$Model = "",
    [switch]$Install
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}
function Write-Json([string]$Path, [object]$Object) {
    Ensure-Dir (Split-Path -Parent $Path)
    $Object | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}
function Find-Lms {
    $cmd = Get-Command lms.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        (Join-Path $env:USERPROFILE ".lmstudio\bin\lms.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\LM Studio\resources\app\.webpack\bin\lms.exe")
    )
    foreach ($p in $candidates) { if (Test-Path -LiteralPath $p) { return $p } }
    throw "LM Studio lms.exe was not found. Open LM Studio once or install llmster first."
}
function Invoke-Lms([string[]]$Args) {
    $lms = Find-Lms
    $out = & $lms @Args 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("lms failed: " + ($Args -join " ") + " " + ($out -join " ")) }
    return ($out -join "`n")
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    if (Test-Path "D:\BrownEyeCortex\BECKPrime") { $RepoRoot = "D:\BrownEyeCortex\BECKPrime" }
    elseif (Test-Path "C:\BrownEyeCortex\BECKPrime") { $RepoRoot = "C:\BrownEyeCortex\BECKPrime" }
    else { throw "BEC PRIME repository not found on D: or C:." }
}
$DataRoot = if (Test-Path "D:\") { "D:\BrownEyeCortex\Runtime" } else { "C:\BrownEyeCortex\Runtime" }
$LogRoot = Join-Path $DataRoot "logs"
$ProofRoot = Join-Path $DataRoot "proofs"
Ensure-Dir $LogRoot
Ensure-Dir $ProofRoot
$log = Join-Path $LogRoot "startup-orchestra.log"
Start-Transcript -LiteralPath $log -Append | Out-Null
try {
    Invoke-Lms @("daemon","up","--json") | Out-Null
    Invoke-Lms @("server","start","--port","1234","--bind","127.0.0.1") | Out-Null
    $selected = $Model
    $config = Join-Path $DataRoot "lmstudio-model.json"
    if ([string]::IsNullOrWhiteSpace($selected) -and (Test-Path -LiteralPath $config)) {
        try { $selected = [string](Get-Content -LiteralPath $config -Raw | ConvertFrom-Json).model_key } catch {}
    }
    $downloaded = Invoke-Lms @("ls","--llm","--json") | ConvertFrom-Json
    $models = @($downloaded)
    if ($models.Count -eq 1 -and $models[0].models) { $models = @($models[0].models) }
    if ([string]::IsNullOrWhiteSpace($selected)) {
        $candidate = $models | Where-Object { $_.modelKey } | Select-Object -First 1
        if (-not $candidate) { throw "No downloaded LLM found. Install one in LM Studio first." }
        $selected = [string]$candidate.modelKey
    }
    $loadedRaw = Invoke-Lms @("ps","--json") | ConvertFrom-Json
    $loaded = @($loadedRaw)
    if ($loaded.Count -eq 1 -and $loaded[0].models) { $loaded = @($loaded[0].models) }
    $already = $loaded | Where-Object { ([string]$_.identifier) -eq $selected -or ([string]$_.modelKey) -eq $selected }
    if (-not $already) { Invoke-Lms @("load",$selected,"--gpu","auto") | Out-Null }
    $verifyRaw = Invoke-Lms @("ps","--json") | ConvertFrom-Json
    $verify = @($verifyRaw)
    if ($verify.Count -eq 1 -and $verify[0].models) { $verify = @($verify[0].models) }
    $loadedNow = $verify | Where-Object { ([string]$_.identifier) -eq $selected -or ([string]$_.modelKey) -eq $selected }
    if (-not $loadedNow) { throw "LM Studio model failed to remain loaded: $selected" }
    Write-Json $config ([ordered]@{schema="BEC-LMSTUDIO-STARTUP-1.0";model_key=$selected;server="http://127.0.0.1:1234";loaded=$true;verified_at_utc=(Get-Date).ToUniversalTime().ToString("o")})
    $cycle = Join-Path $RepoRoot "scripts\Run-AutonomyCycle.ps1"
    $cycleStatus = "NOT_STARTED"
    if (Test-Path -LiteralPath $cycle) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cycle *>&1 | Tee-Object -FilePath (Join-Path $LogRoot "autonomy-cycle.log") | Out-Host
        $cycleStatus = if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }
    }
    $proof = [ordered]@{schema="BEC-PRIME-STARTUP-ORCHESTRA-1.0";status="PASS";lm_studio="RUNNING";model=$selected;model_loaded=$true;server="http://127.0.0.1:1234";autonomous_spend_nzd=0;public_actions="APPROVAL_REQUIRED";autonomy_cycle=$cycleStatus;timestamp_utc=(Get-Date).ToUniversalTime().ToString("o")}
    Write-Json (Join-Path $ProofRoot "STARTUP-ORCHESTRA-LATEST.json") $proof
} catch {
    $proof = [ordered]@{schema="BEC-PRIME-STARTUP-ORCHESTRA-1.0";status="FAIL";error=$_.Exception.Message;timestamp_utc=(Get-Date).ToUniversalTime().ToString("o")}
    Write-Json (Join-Path $ProofRoot "STARTUP-ORCHESTRA-LATEST.json") $proof
    throw
} finally { Stop-Transcript | Out-Null }

if ($Install) {
    $taskName = "BEC-PRIME-Startup-Orchestra"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"" + $PSCommandPath + "`"")
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 2)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}