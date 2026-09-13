# DOOH Gate 1B. Provision a Trillboards agent sandbox and inspect the authenticated MCP contract.
# This does not buy media, attach billing, or create a live booking.
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://api.trillboards.com',
    [string]$McpEndpoint = 'https://api.trillboards.com/mcp/',
    [string]$OutputDir = 'DOOH/GATE1B'
)

$ErrorActionPreference = 'Stop'
$started = (Get-Date).ToUniversalTime().ToString('o')
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

function Invoke-Mcp {
    param(
        [string]$Method,
        [object]$Params,
        [string]$Bearer = ''
    )
    $headers = @{
        Accept = 'application/json, text/event-stream'
        'Content-Type' = 'application/json'
    }
    if ($Bearer) { $headers.Authorization = 'Bearer ' + $Bearer }
    $body = @{ jsonrpc = '2.0'; id = 1; method = $Method; params = $Params } | ConvertTo-Json -Depth 50 -Compress
    $response = Invoke-WebRequest -Uri $McpEndpoint -Method Post -Headers $headers -Body $body -UseBasicParsing
    $text = [string]$response.Content
    try { return ($text | ConvertFrom-Json) } catch {}
    foreach ($line in @($text -split "`n")) {
        if ($line -match '^data:\s*(.+)$') {
            try { return ($Matches[1] | ConvertFrom-Json) } catch {}
        }
    }
    throw 'MCP response was not JSON or parseable SSE.'
}

function Find-FirstValue {
    param([object]$Object, [string[]]$Names)
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        foreach ($name in $Names) {
            foreach ($key in $Object.Keys) {
                if ([string]$key -ieq $name) { return $Object[$key] }
            }
        }
        foreach ($key in $Object.Keys) {
            $found = Find-FirstValue -Object $Object[$key] -Names $Names
            if ($null -ne $found) { return $found }
        }
    } elseif ($Object -is [System.Collections.IEnumerable] -and -not ($Object -is [string])) {
        foreach ($item in $Object) {
            $found = Find-FirstValue -Object $item -Names $Names
            if ($null -ne $found) { return $found }
        }
    } else {
        foreach ($name in $Names) {
            $prop = $Object.PSObject.Properties | Where-Object { $_.Name -ieq $name } | Select-Object -First 1
            if ($prop) { return $prop.Value }
        }
        foreach ($prop in $Object.PSObject.Properties) {
            $found = Find-FirstValue -Object $prop.Value -Names $Names
            if ($null -ne $found) { return $found }
        }
    }
    return $null
}

$results = New-Object System.Collections.Generic.List[object]

# Public discovery. This is also a guard against silently relying on a stale tool list.
$public = Invoke-Mcp -Method 'tools/list' -Params @{}
$publicTools = @($public.result.tools)
if ($publicTools.Count -lt 1) { throw 'Public tools/list returned no tools.' }
$publicTools | ConvertTo-Json -Depth 50 | Set-Content -Path (Join-Path $OutputDir 'mcp-tools-public.json') -Encoding UTF8
$results.Add([pscustomobject]@{ gate='GATE_1A'; check='PUBLIC_TOOLS'; pass=($publicTools.Count -gt 0); observed=$publicTools.Count })

# Locate the registration contract from the live schema instead of hardcoding a tool name beyond its documented identity.
$registerTool = @($publicTools | Where-Object { [string]$_.name -match '(?i)agent.?register|register.?partner' } | Select-Object -First 1)
if (-not $registerTool) { throw 'No agent registration tool was exposed by the live MCP schema.' }

$registration = Invoke-Mcp -Method 'tools/call' -Params @{ name = [string]$registerTool.name; arguments = @{} }
$registration | ConvertTo-Json -Depth 50 | Set-Content -Path (Join-Path $OutputDir 'registration-response.json') -Encoding UTF8

$apiKey = Find-FirstValue -Object $registration -Names @('api_key','apiKey','token')
if ([string]::IsNullOrWhiteSpace([string]$apiKey)) {
    throw 'Agent registration completed without an API key in the response. Inspect registration-response.json.'
}
$apiKey = [string]$apiKey
Write-Output ('::add-mask::' + $apiKey)
$env:TRILLBOARDS_API_KEY = $apiKey

$registrationRedacted = [string]($registration | ConvertTo-Json -Depth 50)
$registrationRedacted = $registrationRedacted.Replace($apiKey, '[REDACTED]')
$registrationRedacted | Set-Content -Path (Join-Path $OutputDir 'registration-response-redacted.json') -Encoding UTF8

$screens = Find-FirstValue -Object $registration -Names @('sandbox_screens','sandboxScreens','screens')
if ($null -eq $screens) { $screens = @() }
@($screens) | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $OutputDir 'registration-sandbox-screens.json') -Encoding UTF8
$results.Add([pscustomobject]@{ gate='GATE_1B'; check='AGENT_REGISTER'; pass=$true; tool=[string]$registerTool.name })
$results.Add([pscustomobject]@{ gate='GATE_1B'; check='SANDBOX_SCREENS_RETURNED'; pass=(@($screens).Count -gt 0); count=@($screens).Count })

# Authenticated discovery. Persist the exact live schemas that determine the next calls.
$auth = Invoke-Mcp -Method 'tools/list' -Params @{} -Bearer $apiKey
$authTools = @($auth.result.tools)
$authTools | ConvertTo-Json -Depth 50 | Set-Content -Path (Join-Path $OutputDir 'mcp-tools-authenticated.json') -Encoding UTF8
$results.Add([pscustomobject]@{ gate='GATE_1B'; check='AUTHENTICATED_TOOLS_LIST'; pass=($authTools.Count -gt 0); observed=$authTools.Count })

$inventory = @($authTools | Where-Object { [string]$_.name -match '(?i)discover.*inventory|inventory.*discover' } | Select-Object -First 1)
$products = @($authTools | Where-Object { [string]$_.name -match '(?i)get.*products|list.*products' } | Select-Object -First 1)
$createBuy = @($authTools | Where-Object { [string]$_.name -match '(?i)create.*media.?buy|media.?buy.*create' } | Select-Object -First 1)
$creative = @($authTools | Where-Object { [string]$_.name -match '(?i)sync.*creative|creative.*sync' } | Select-Object -First 1)
$delivery = @($authTools | Where-Object { [string]$_.name -match '(?i)read.*delivery|get.*delivery|delivery.*read' } | Select-Object -First 1)

$plan = [ordered]@{
    schema_version='DOOH-GATE1B-PLAN/1.0'
    generated_at=(Get-Date).ToUniversalTime().ToString('o')
    experiment='DOOH_CUBE_001'
    registration_tool=[string]$registerTool.name
    inventory_tool=if($inventory){[string]$inventory.name}else{$null}
    products_tool=if($products){[string]$products.name}else{$null}
    create_media_buy_tool=if($createBuy){[string]$createBuy.name}else{$null}
    creative_sync_tool=if($creative){[string]$creative.name}else{$null}
    delivery_tool=if($delivery){[string]$delivery.name}else{$null}
    authority_boundary='No media-buy mutation is executed by this gate. First live booking remains human-authorized.'
}
$plan | ConvertTo-Json -Depth 30 | Set-Content -Path (Join-Path $OutputDir 'gate1b-plan.json') -Encoding UTF8

# Use the verified CLI for sandbox provisioning. The key remains process-local and is never written to git.
$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($npx) {
    $sandboxJson = & npx --yes @trillboards/cli sandbox create --format json 2>&1 | Out-String
    $sandboxJson | Set-Content -Path (Join-Path $OutputDir 'sandbox-create-response.txt') -Encoding UTF8
    $sandboxStatus = & npx --yes @trillboards/cli sandbox status --format json 2>&1 | Out-String
    $sandboxStatus | Set-Content -Path (Join-Path $OutputDir 'sandbox-status-response.txt') -Encoding UTF8
    $results.Add([pscustomobject]@{ gate='GATE_1B'; check='SANDBOX_CREATE'; pass=$true; detail='CLI returned a sandbox-create response; inspect artifact for provider result.' })
} else {
    $results.Add([pscustomobject]@{ gate='GATE_1B'; check='SANDBOX_CREATE'; pass=$false; detail='npx is unavailable in runtime.' })
}

$proof = [ordered]@{
    schema_version='DOOH-GATE1B-PROOF/1.0'
    generated_at=(Get-Date).ToUniversalTime().ToString('o')
    experiment='DOOH_CUBE_001'
    registration=[ordered]@{ completed=$true; api_key_persisted=$false; sandbox_screens=@($screens).Count }
    authenticated_discovery=[ordered]@{ completed=($authTools.Count -gt 0); observed_tool_count=$authTools.Count }
    sandbox=[ordered]@{ create_attempted=($null -ne $npx); live_purchase=$false; live_booking=$false }
    media_buy=[ordered]@{ executed=$false; reason='Human approval boundary and exact runtime tool arguments must be validated before mutation.' }
    cryptographic_proof=[ordered]@{ real_proof_verified=$false; tamper_rejection_verified=$false }
    revenue=[ordered]@{ verified_nzd=0; status='UNMATCHED' }
    next_gate='GATE_1B_MEDIA_BUY_PATH'
    results=@($results)
}
$proof | ConvertTo-Json -Depth 40 | Set-Content -Path (Join-Path $OutputDir 'DOOH-Gate1B-proof.json') -Encoding UTF8
$proof | ConvertTo-Json -Depth 40
