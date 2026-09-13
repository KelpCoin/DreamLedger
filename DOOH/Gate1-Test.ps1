# DOOH Gate 1 test. Public discovery and proof-key checks only.
# No live purchase. No live media buy. No fabricated cryptographic proof.
[CmdletBinding()]
param(
    [string]$Endpoint = 'https://api.trillboards.com/mcp/',
    [string]$ProofKeyEndpoint = 'https://api.trillboards.com/v1/advertiser/proof/.well-known/public-key',
    [string]$ProofVerifyEndpoint = 'https://api.trillboards.com/v1/advertiser/proof/verify-proof',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$script:Results = New-Object System.Collections.Generic.List[object]
$started = (Get-Date).ToUniversalTime().ToString('o')

function Add-Result {
    param([string]$Gate, [bool]$Pass, [string]$Status, [string]$Detail)
    $script:Results.Add([PSCustomObject]@{
        gate = $Gate
        pass = $Pass
        status = $Status
        detail = $Detail
    })
}

function Invoke-McpJsonRpc {
    param([string]$Method, [object]$Params, [hashtable]$Headers = @{})
    $body = @{ jsonrpc = '2.0'; id = 1; method = $Method; params = $Params } | ConvertTo-Json -Depth 30 -Compress
    $h = @{ Accept = 'application/json, text/event-stream'; 'Content-Type' = 'application/json' }
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    $raw = Invoke-WebRequest -Uri $Endpoint -Method Post -Headers $h -Body $body -UseBasicParsing
    $text = [string]$raw.Content
    try { return ($text | ConvertFrom-Json) } catch {}
    $dataLines = @($text -split "`n" | Where-Object { $_ -match '^data:\s*' } | ForEach-Object { $_ -replace '^data:\s*','' } | Where-Object { $_.Trim() })
    foreach ($line in $dataLines) {
        try { return ($line | ConvertFrom-Json) } catch {}
    }
    throw 'MCP response was neither JSON nor parseable SSE data.'
}

$discovery = $null
try {
    $discovery = Invoke-McpJsonRpc -Method 'tools/list' -Params @{}
    if (-not $discovery.result.tools) { throw 'tools/list returned no result.tools.' }
    $count = @($discovery.result.tools).Count
    $schemaDir = Split-Path -Parent $OutputPath
    if ($OutputPath -and -not (Test-Path $schemaDir)) { New-Item -ItemType Directory -Path $schemaDir -Force | Out-Null }
    if ($OutputPath) { $discovery.result.tools | ConvertTo-Json -Depth 30 | Set-Content -Path $OutputPath -Encoding UTF8 }
    Add-Result 'GATE_1A_MCP_REACHABLE' ($count -gt 0) 'PASS' ("tools=$count")
    Add-Result 'GATE_1A_TOOL_COUNT' ($count -eq 74) ($(if ($count -eq 74) { '74 tools observed' } else { "Expected 74, observed $count" }))
    Add-Result 'GATE_1A_SCHEMA_PERSISTED' ([bool]$OutputPath -and (Test-Path $OutputPath)) 'PASS' ($(if ($OutputPath) { $OutputPath } else { 'No schema output path supplied' }))
} catch {
    Add-Result 'GATE_1A_MCP_REACHABLE' $false 'BLOCKED' $_.Exception.Message
    Add-Result 'GATE_1A_TOOL_COUNT' $false 'BLOCKED' 'tools/list unavailable.'
    Add-Result 'GATE_1A_SCHEMA_PERSISTED' $false 'BLOCKED' 'Schema cannot be persisted without discovery.'
}

try {
    $pk = Invoke-RestMethod -Uri $ProofKeyEndpoint -Method Get
    $keyValue = if ($pk.publicKey) { [string]$pk.publicKey } elseif ($pk.public_key) { [string]$pk.public_key } else { '' }
    Add-Result 'GATE_1A_PUBLIC_KEY_REACHABLE' (-not [string]::IsNullOrWhiteSpace($keyValue)) 'PASS' 'Public Ed25519 key endpoint reachable.'
    Add-Result 'GATE_1A_PUBLIC_KEY_FORMAT' ($keyValue -match '^[0-9a-fA-F]{64}$') 'PASS' ($(if ($keyValue -match '^[0-9a-fA-F]{64}$') { '64 hex characters' } else { 'Unexpected public-key format' }))
} catch {
    Add-Result 'GATE_1A_PUBLIC_KEY_REACHABLE' $false 'BLOCKED' $_.Exception.Message
    Add-Result 'GATE_1A_PUBLIC_KEY_FORMAT' $false 'BLOCKED' 'Public key unavailable.'
}

# Gate 1C deliberately fails closed until a real proof exists.
Add-Result 'GATE_1C_REAL_PROOF_VERIFIED' $false 'NOT_RUN' 'Requires a real proof from Gate 2. No illustrative signature is accepted.'
Add-Result 'GATE_1C_TAMPER_REJECTION_VERIFIED' $false 'NOT_RUN' 'Requires a real proof from Gate 2 and a mutation test.'

# Gate 1B is intentionally not executed here. A live credential/sandbox mutation is outside public discovery.
$hasKey = -not [string]::IsNullOrWhiteSpace($env:TRILLBOARDS_API_KEY)
if ($hasKey) {
    Add-Result 'GATE_1B_AUTH_PRESENT' $true 'READY' 'TRILLBOARDS_API_KEY is present in the runtime environment.'
} else {
    Add-Result 'GATE_1B_AUTH_PRESENT' $false 'BLOCKED' 'TRILLBOARDS_API_KEY is not configured. No credential is requested or logged.'
}
Add-Result 'GATE_1B_SANDBOX_EXECUTION' $false 'NOT_RUN' 'Sandbox execution requires authenticated runtime authorization and is not part of public discovery.'

$proof = [ordered]@{
    schema_version = 'DOOH-GATE1-PROOF/1.0'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    experiment = 'DOOH_CUBE_001'
    gate = 'GATE_1'
    live_purchase = $false
    live_booking = $false
    revenue = [ordered]@{ verified_nzd = 0; status = 'UNMATCHED' }
    mcp = [ordered]@{ endpoint = $Endpoint; transport = 'streamable-http'; protocol_version = '2025-11-25'; observed_tool_count = if ($discovery) { @($discovery.result.tools).Count } else { 0 }; schema_path = $OutputPath }
    proof = [ordered]@{ algorithm = 'Ed25519'; version = 'v2'; real_proof_verified = $false; tamper_rejection_verified = $false; public_key_endpoint = $ProofKeyEndpoint; verify_endpoint = $ProofVerifyEndpoint }
    cube = [ordered]@{ defined = $true; contracted = $true; instantiated = $false; contract_path = 'DOOH/DOOH-CUBE-001.json' }
    results = @($script:Results)
    next_gate = 'GATE_2_LIVE_BOOKING'
}

if (-not $OutputPath) { $OutputPath = Join-Path (Get-Location) 'DOOH-Gate1-schema.json' }
$proofPath = Join-Path (Split-Path -Parent $OutputPath) ('DOOH-Gate1-proof-' + (Get-Date -Format 'yyyyMMddHHmmss') + '.json')
$proof | ConvertTo-Json -Depth 30 | Set-Content -Path $proofPath -Encoding UTF8

$blocking = @($script:Results | Where-Object { $_.status -eq 'BLOCKED' })
$publicPass = @($script:Results | Where-Object { $_.gate -like 'GATE_1A*' -and $_.pass -eq $true }).Count -ge 4
$status = if ($publicPass -and $blocking.Count -eq 0) { 'PASS_PUBLIC_DISCOVERY_ONLY' } elseif ($publicPass) { 'PASS_PUBLIC_DISCOVERY_AUTH_REQUIRED' } else { 'BLOCKED' }

[PSCustomObject]@{ status = $status; proof_path = $proofPath; schema_path = $OutputPath; results = @($script:Results) } | ConvertTo-Json -Depth 30
if ($status -eq 'BLOCKED') { exit 1 }
exit 0
