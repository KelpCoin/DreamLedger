#requires -version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-FigureEightRepoRoot {
    $candidate = (Resolve-Path $PSScriptRoot).Path
    while ($candidate -and (Split-Path $candidate -Parent) -ne $candidate) {
        if (Test-Path (Join-Path $candidate "supabase\migrations")) { return $candidate }
        $candidate = Split-Path $candidate -Parent
    }
    throw "Figure Eight repository root was not found above $PSScriptRoot."
}

$script:FigureEightRoot = Get-FigureEightRepoRoot
$script:LogRoot = Join-Path $script:FigureEightRoot "proof\figure-eight\logs"
New-Item -ItemType Directory -Force -Path $script:LogRoot | Out-Null

function Write-StructuredLog {
    param(
        [Parameter(Mandatory=$true)][string]$Worker,
        [Parameter(Mandatory=$true)][string]$Message,
        [ValidateSet("INFO","WARN","ERROR")][string]$Level = "INFO",
        [hashtable]$Context = @{}
    )
    $entry = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        worker = $Worker
        level = $Level
        message = $Message
        context = $Context
    }
    $path = Join-Path $script:LogRoot ($Worker + ".jsonl")
    ($entry | ConvertTo-Json -Compress -Depth 20) | Add-Content -Path $path -Encoding UTF8
    Write-Host ($entry | ConvertTo-Json -Compress -Depth 20)
}

function Get-FigureEightConfig {
    $url = [string]$env:SUPABASE_URL
    $key = [string]$env:SUPABASE_SERVICE_ROLE_KEY
    if ([string]::IsNullOrWhiteSpace($key)) { $key = [string]$env:SUPABASE_SERVICE_KEY }
    if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($key)) {
        throw "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    }
    return [ordered]@{ url=$url.TrimEnd("/"); key=$key }
}

function Invoke-SupabaseRest {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [ValidateSet("GET","POST","PATCH","PUT","DELETE")][string]$Method = "GET",
        [object]$Body = $null
    )
    $cfg = Get-FigureEightConfig
    $headers = @{
        apikey = $cfg.key
        Authorization = "Bearer $($cfg.key)"
        "Content-Type" = "application/json"
        Prefer = "return=representation"
    }
    $uri = $cfg.url + "/rest/v1/" + $Path.TrimStart("/")
    if ($null -eq $Body) { return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers }
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body ($Body | ConvertTo-Json -Depth 30)
}

function Invoke-FigureEightRpc {
    param(
        [Parameter(Mandatory=$true)][string]$Worker,
        [Parameter(Mandatory=$true)][string]$Operation,
        [hashtable]$Payload = @{}
    )
    return Invoke-SupabaseRest -Path "rpc/figure_eight_worker_api" -Method POST -Body @{
        p_worker=$Worker
        p_operation=$Operation
        p_payload=$Payload
    }
}

function Get-Sha256Text {
    param([Parameter(Mandatory=$true)][AllowEmptyString()][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))).Replace("-","").ToLowerInvariant()) }
    finally { $sha.Dispose() }
}

function Get-StripeConfig {
    $key = [string]$env:STRIPE_SECRET_KEY
    if ([string]::IsNullOrWhiteSpace($key)) { throw "STRIPE_SECRET_KEY is required for Stripe workers." }
    return [ordered]@{ key=$key; live=$key.StartsWith("sk_live_", [System.StringComparison]::Ordinal) }
}

function Invoke-StripeGet {
    param([Parameter(Mandatory=$true)][string]$Path)
    $cfg = Get-StripeConfig
    return Invoke-RestMethod -Uri ("https://api.stripe.com/v1/" + $Path.TrimStart("/")) -Method GET -Headers @{ Authorization = "Bearer $($cfg.key)" }
}

function Invoke-StripePost {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][hashtable]$Form,
        [Parameter(Mandatory=$true)][string]$IdempotencyKey
    )
    $cfg = Get-StripeConfig
    $pairs = New-Object System.Collections.Generic.List[string]
    foreach ($key in $Form.Keys) {
        $value = $Form[$key]
        if ($null -eq $value) { continue }
        $pairs.Add(([uri]::EscapeDataString([string]$key) + "=" + [uri]::EscapeDataString([string]$value)))
    }
    $body = [string]::Join("&",$pairs)
    return Invoke-RestMethod -Uri ("https://api.stripe.com/v1/" + $Path.TrimStart("/")) -Method POST -Headers @{
        Authorization = "Bearer $($cfg.key)"
        "Idempotency-Key" = $IdempotencyKey
    } -ContentType "application/x-www-form-urlencoded" -Body $body
}

function Set-WorkerHeartbeat {
    param([string]$Worker,[string]$Status,[string]$Error = "")
    try {
        if ($Status -eq "RUNNING") {
            Invoke-FigureEightRpc -Worker $Worker -Operation "HEARTBEAT" -Payload @{} | Out-Null
        } else {
            Invoke-FigureEightRpc -Worker $Worker -Operation "FINISH_HEARTBEAT" -Payload @{status=$Status;error=$Error} | Out-Null
        }
    } catch {
        Write-StructuredLog -Worker $Worker -Level WARN -Message "Heartbeat update failed" -Context @{error=$_.Exception.Message}
    }
}
