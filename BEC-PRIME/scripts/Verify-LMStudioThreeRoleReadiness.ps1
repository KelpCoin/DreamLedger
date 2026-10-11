#Requires -Version 5.1
# Verify three distinct LM Studio council models by loading and exercising each.
# No model downloads, cloud calls, payments, or public actions are performed.
[CmdletBinding()]
param([int]$Port = 1234, [string]$ProofPath = "")
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$base = "http://127.0.0.1:$Port"
if ([string]::IsNullOrWhiteSpace($ProofPath)) {
    $root = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { 'C:\BrownEyeCortex\Runtime\proofs' }
    $ProofPath = Join-Path $root 'LMSTUDIO-THREE-ROLE-READINESS.json'
}
function Get-Lms {
    $cmd = Get-Command lms.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $paths = @(
        (Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\LM Studio\resources\app\.webpack\bin\lms.exe')
    )
    foreach ($p in $paths) { if (Test-Path -LiteralPath $p) { return $p } }
    throw 'lms.exe not found. Install/open LM Studio and make its CLI available.'
}
function Invoke-Lms([string[]]$Args) {
    $exe = Get-Lms
    $out = & $exe @Args 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("lms " + ($Args -join ' ') + ' failed: ' + ($out -join ' ')) }
    return ($out -join [Environment]::NewLine)
}
function Get-ApiModels {
    $r = Invoke-RestMethod -Uri "$base/v1/models" -TimeoutSec 15
    return @($r.data | ForEach-Object { [string]$_.id } | Where-Object { $_ })
}
function Test-Role([string]$Role, [string]$ModelKey) {
    Invoke-Lms @('load', $ModelKey, '--gpu', 'auto') | Out-Null
    $apiIds = Get-ApiModels
    $apiId = $apiIds | Where-Object { $_ -eq $ModelKey -or $_ -like "*$ModelKey*" -or $ModelKey -like "*$_*" } | Select-Object -First 1
    if (-not $apiId) { throw "Role '$Role' model '$ModelKey' did not appear in /v1/models after load. Visible: $($apiIds -join ', ')" }
    $expected = $Role + '_ROLE_OK'
    $body = @{
        model = $apiId
        messages = @(
            @{ role = 'system'; content = 'You are a startup verification probe. Follow the exact output instruction.' },
            @{ role = 'user'; content = "Reply with exactly $expected" }
        )
        temperature = 0
        max_tokens = 24
    } | ConvertTo-Json -Depth 6
    $r = Invoke-RestMethod -Uri "$base/v1/chat/completions" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 180
    $answer = [string]$r.choices[0].message.content
    if ($answer -notmatch [regex]::Escape($expected)) { throw "Role '$Role' inference failed expected-token check. Model=$apiId; answer=$answer" }
    return [ordered]@{ role=$Role; model_key=$ModelKey; api_model_id=$apiId; loaded=$true; inference='PASS' }
}
$proof = [ordered]@{
    schema = 'BEC-LMSTUDIO-THREE-ROLE-READINESS-1.0'
    status = 'FAIL'
    readiness = 'NOT_READY'
    verified_at_utc = [DateTime]::UtcNow.ToString('o')
    server = $base
    required_roles = @('proposer','critic','synthesizer')
    roles = @()
    note = 'A successful proof requires three distinct downloaded models and a real inference test for each.'
}
try {
    $modelsRaw = Invoke-Lms @('ls','--llm','--json') | ConvertFrom-Json
    $models = @($modelsRaw)
    if ($models.Count -eq 1 -and $models[0].models) { $models = @($models[0].models) }
    $keys = @($models | ForEach-Object { [string]$_.modelKey } | Where-Object { $_ })
    if ($keys.Count -eq 0) { throw 'No downloaded LLMs found. This check does not download models.' }
    $roles = [ordered]@{}
    $roles.proposer = $keys | Where-Object { $_ -match '(?i)qwen3.*14b|qwen2[._-]?5.*14b.*instruct|qwen.*instruct|qwen' } | Select-Object -First 1
    $roles.critic = $keys | Where-Object { $_ -match '(?i)deepseek.*r1|deepseek' } | Select-Object -First 1
    $roles.synthesizer = $keys | Where-Object { $_ -match '(?i)gpt[-_]?oss.*20b|gpt[-_]?oss|qwen3.*14b|qwen2[._-]?5.*14b|qwen' } | Select-Object -First 1
    $missing = @('proposer','critic','synthesizer') | Where-Object { -not $roles[$_] }
    if ($missing.Count) { throw "Required role model missing: $($missing -join ', '). Download distinct Qwen/instruct, DeepSeek/R1, and gpt-oss/Qwen-synthesis models in LM Studio, then rerun." }
    if (@($roles.Values | Select-Object -Unique).Count -ne 3) {
        $alternatives = $keys | Where-Object { $_ -notin @($roles.proposer,$roles.critic) -and $_ -match '(?i)gpt[-_]?oss|qwen|llama|mistral' } | Select-Object -First 1
        if ($alternatives) { $roles.synthesizer = $alternatives }
    }
    if (@($roles.Values | Select-Object -Unique).Count -ne 3) { throw "Could not assign three distinct model files. Selected: proposer=$($roles.proposer); critic=$($roles.critic); synthesizer=$($roles.synthesizer)" }
    foreach ($role in @('proposer','critic','synthesizer')) {
        $proof.roles += Test-Role -Role $role -ModelKey ([string]$roles[$role])
    }
    $proof.status = 'PASS'
    $proof.readiness = 'THREE_DISTINCT_ROLES_INFERENCE_VERIFIED'
    $proof.note = 'Each role was loaded and passed an inference smoke test during this run. This does not guarantee all three remain simultaneously resident after LM Studio memory management or reboot.'
} catch {
    $proof.status = 'FAIL'
    $proof.readiness = 'NOT_READY'
    $proof.error = $_.Exception.Message
}
$dir = Split-Path -Parent $ProofPath
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ProofPath -Encoding UTF8
$proof | ConvertTo-Json -Depth 10 | Write-Output
if ($proof.status -ne 'PASS') { exit 2 }
exit 0
