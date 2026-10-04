# Figure Eight Integrity Check
# PowerShell 5.1 compatible. ASCII only. Read-only by default.
# Purpose: inspect local Cortex health, cloud public health, and optional authenticated bridge health.
# It does not deploy, mutate production state, charge Stripe, or repair anything.

[CmdletBinding()]
param(
    [string]$DreamLedgerBase = 'https://dreamledger.org',
    [string]$SupabaseProjectRef = 'wbwgroygjeyukkspnqiy',
    [string]$ProofRoot = 'D:\BrownEyeCortex\Proof\figure_eight',
    [int]$TimeoutSec = 12
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Result {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Detail
    )
    $script:Results += [pscustomobject]@{
        name = $Name
        status = $Status
        detail = $Detail
    }
    $tag = $Status.ToUpperInvariant().PadRight(7)
    Write-Host ("[{0}] {1}: {2}" -f $tag, $Name, $Detail)
}

function Test-TcpPort {
    param([string]$Name, [string]$HostName, [int]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(($TimeoutSec * 1000), $false)
        if ($ok -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            Write-Result $Name 'PASS' ("TCP {0}:{1} reachable" -f $HostName, $Port)
        } else {
            $client.Close()
            Write-Result $Name 'FAIL' ("TCP {0}:{1} not reachable" -f $HostName, $Port)
        }
    } catch {
        Write-Result $Name 'FAIL' ($_.Exception.Message)
    }
}

function Test-Http {
    param(
        [string]$Name,
        [string]$Uri,
        [hashtable]$Headers = @{}
    )
    try {
        $response = Invoke-WebRequest -Uri $Uri -Method Get -Headers $Headers -TimeoutSec $TimeoutSec -UseBasicParsing
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
            $detail = "HTTP {0} {1}" -f $response.StatusCode, $response.StatusDescription
            Write-Result $Name 'PASS' $detail
            return $response
        }
        Write-Result $Name 'FAIL' ("HTTP {0}" -f $response.StatusCode)
    } catch {
        $status = $null
        try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
        if ($status) {
            Write-Result $Name 'FAIL' ("HTTP {0}" -f $status)
        } else {
            Write-Result $Name 'FAIL' $_.Exception.Message
        }
    }
    return $null
}

function Test-JsonEndpoint {
    param(
        [string]$Name,
        [string]$Uri,
        [hashtable]$Headers = @{}
    )
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method Get -Headers $Headers -TimeoutSec $TimeoutSec
        $json = $response | ConvertTo-Json -Depth 8 -Compress
        Write-Result $Name 'PASS' ("JSON response {0} bytes" -f $json.Length)
        return $response
    } catch {
        $status = $null
        try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
        if ($status -eq 401 -or $status -eq 403) {
            Write-Result $Name 'PROTECTED' ("HTTP {0}; endpoint reachable but access is protected" -f $status)
        } elseif ($status) {
            Write-Result $Name 'FAIL' ("HTTP {0}" -f $status)
        } else {
            Write-Result $Name 'FAIL' $_.Exception.Message
        }
    }
    return $null
}

$script:Results = @()
$started = Get-Date

Write-Host ''
Write-Host 'FIGURE EIGHT INTEGRITY CHECK'
Write-Host '============================='
Write-Host ("Started: {0}" -f $started.ToString('o'))
Write-Host ''

# LOCAL: BrownEye services and model endpoints.
Test-TcpPort 'Control Room' '127.0.0.1' 17901
Test-TcpPort 'Front Door' '127.0.0.1' 8765
Test-TcpPort 'VoiceBus' '127.0.0.1' 8000
Test-TcpPort 'Ollama' '127.0.0.1' 11434
Test-TcpPort 'LM Studio 1234' '127.0.0.1' 1234
Test-TcpPort 'LM Studio 1235' '127.0.0.1' 1235

# LOCAL: common health surfaces. A missing optional endpoint is recorded, not repaired.
Test-Http 'Ollama API' 'http://127.0.0.1:11434/api/tags' | Out-Null
Test-Http 'LM Studio 1234 API' 'http://127.0.0.1:1234/v1/models' | Out-Null
Test-Http 'LM Studio 1235 API' 'http://127.0.0.1:1235/v1/models' | Out-Null

# CLOUD: public DreamLedger surface. Render remains the production application host.
Test-Http 'DreamLedger root' ($DreamLedgerBase.TrimEnd('/')) | Out-Null
Test-Http 'DreamLedger billboard' (($DreamLedgerBase.TrimEnd('/')) + '/billboard') | Out-Null
Test-Http 'DreamLedger catalog' (($DreamLedgerBase.TrimEnd('/')) + '/catalog.json') | Out-Null
Test-Http 'DreamLedger offers API' (($DreamLedgerBase.TrimEnd('/')) + '/api/offers') | Out-Null

# CLOUD: Supabase control-plane reachability.
$SupabaseBase = "https://$SupabaseProjectRef.supabase.co"
Test-Http 'Supabase auth health' ($SupabaseBase + '/auth/v1/health') | Out-Null

$SupabaseHeaders = @{}
if ($env:SUPABASE_PUBLISHABLE_KEY) {
    $SupabaseHeaders['apikey'] = $env:SUPABASE_PUBLISHABLE_KEY
}

if ($SupabaseHeaders.Count -gt 0) {
    Test-JsonEndpoint 'Supabase REST root' ($SupabaseBase + '/rest/v1/') $SupabaseHeaders | Out-Null
} else {
    Write-Result 'Supabase REST root' 'SKIP' 'Set SUPABASE_PUBLISHABLE_KEY for REST verification'
}

# CLOUD: optional authenticated Agent Bridge probe.
# Set BEC_AGENT_BRIDGE_URL and BEC_AGENT_BRIDGE_TOKEN locally. The token is never written to proof.
if ($env:BEC_AGENT_BRIDGE_URL -and $env:BEC_AGENT_BRIDGE_TOKEN) {
    $BridgeHeaders = @{ Authorization = ('Bearer ' + $env:BEC_AGENT_BRIDGE_TOKEN) }
    Test-Http 'Agent Bridge' $env:BEC_AGENT_BRIDGE_URL $BridgeHeaders | Out-Null
} else {
    Write-Result 'Agent Bridge' 'SKIP' 'Set BEC_AGENT_BRIDGE_URL and BEC_AGENT_BRIDGE_TOKEN for authenticated probe'
}

# Optional local git state. This is observational only.
try {
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    if (Test-Path (Join-Path $repoRoot '.git')) {
        Push-Location $repoRoot
        $branch = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
        $sha = (& git rev-parse HEAD 2>$null).Trim()
        $dirty = (& git status --porcelain 2>$null)
        Pop-Location
        $dirtyCount = @($dirty).Count
        Write-Result 'Git working tree' ($(if ($dirtyCount -eq 0) { 'PASS' } else { 'WARN' })) ("branch={0}; sha={1}; dirty_files={2}" -f $branch, $sha, $dirtyCount)
    } else {
        Write-Result 'Git working tree' 'SKIP' 'Script is not running from a Git checkout'
    }
} catch {
    try { Pop-Location } catch {}
    Write-Result 'Git working tree' 'WARN' $_.Exception.Message
}

$ended = Get-Date
$pass = @($Results | Where-Object { $_.status -eq 'PASS' }).Count
$fail = @($Results | Where-Object { $_.status -eq 'FAIL' }).Count
$protected = @($Results | Where-Object { $_.status -eq 'PROTECTED' }).Count
$skip = @($Results | Where-Object { $_.status -eq 'SKIP' }).Count
$warn = @($Results | Where-Object { $_.status -eq 'WARN' }).Count

# The integrity result deliberately does not equate infrastructure health with economic proof.
$infraHealthy = ($fail -eq 0)
$economicProof = 'NOT_YET_PROVEN'

if (-not (Test-Path $ProofRoot)) {
    New-Item -ItemType Directory -Path $ProofRoot -Force | Out-Null
}

$stamp = $ended.ToString('yyyyMMdd_HHmmss')
$proofPath = Join-Path $ProofRoot ("figure_eight_integrity_{0}.json" -f $stamp)

$proof = [ordered]@{
    schema = 'figure_eight_integrity.v1'
    generated_at = $ended.ToString('o')
    started_at = $started.ToString('o')
    local = [ordered]@{
        machine = $env:COMPUTERNAME
        user = $env:USERNAME
    }
    cloud = [ordered]@{
        application_host = 'Render'
        dreamledger_base = $DreamLedgerBase
        supabase_project_ref = $SupabaseProjectRef
    }
    counts = [ordered]@{
        pass = $pass
        fail = $fail
        protected = $protected
        warn = $warn
        skip = $skip
    }
    results = $Results
    figure_eight = [ordered]@{
        local_cloud_coherence = $(if ($infraHealthy) { 'PASS' } else { 'FAIL' })
        economic_proof = $economicProof
    }
    trust_rule = 'Infrastructure health does not imply verified revenue.'
}

$proof | ConvertTo-Json -Depth 12 | Set-Content -Path $proofPath -Encoding ASCII

Write-Host ''
Write-Host 'SUMMARY'
Write-Host '-------'
Write-Host ("PASS={0} FAIL={1} PROTECTED={2} WARN={3} SKIP={4}" -f $pass, $fail, $protected, $warn, $skip)
Write-Host ("LOCAL_CLOUD_COHERENCE={0}" -f $(if ($infraHealthy) { 'PASS' } else { 'FAIL' }))
Write-Host ("ECONOMIC_PROOF={0}" -f $economicProof)
Write-Host ("PROOF={0}" -f $proofPath)
Write-Host ''

if ($fail -gt 0) {
    exit 2
}
exit 0
