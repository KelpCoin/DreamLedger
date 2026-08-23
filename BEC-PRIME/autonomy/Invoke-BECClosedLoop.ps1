#requires -Version 5.1
<##
.SYNOPSIS
    Idempotent BEC revenue loop for approved offers.

.DESCRIPTION
    Evaluates catalog products against constitution rules, creates at most one
    checkout session per product/policy version, and publishes at most once per
    offer to Discord. Public commercial actions require explicit approval via
    BEC_PUBLIC_ACTION_APPROVED=YES. State is persisted locally so restarts do
    not create duplicate Stripe sessions or duplicate Discord posts.

    PowerShell 5.1 compatible. No PowerShell 7 operators are used.

.OUTPUTS
    BEC-PRIME/autonomy/OFFERS_STATE.json
    BEC-PRIME/autonomy/PROOF-CLOSED-LOOP.json
    BEC-PRIME/autonomy/closed-loop.log
#>

[CmdletBinding()]
param(
    [int]$LoopIntervalSeconds = 60,
    [string]$DiscordWebhookUrl = $env:DISCORD_WEBHOOK_URL
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConstitutionPath = Join-Path $Root "constitution.json"
$ProductsPath = Join-Path $Root "data\products.json"
if (-not (Test-Path -LiteralPath $ProductsPath)) {
    $ProductsPath = Join-Path $Root "products.json"
}
$StatePath = Join-Path $Root "OFFERS_STATE.json"
$ProofPath = Join-Path $Root "PROOF-CLOSED-LOOP.json"
$LogPath = Join-Path $Root "closed-loop.log"
$LedgerPath = Join-Path $Root "EVENTS.jsonl"
$CheckoutEndpoint = "https://dreamledger.org/api/checkout/create"

function Write-Log {
    param([string]$Message)
    $line = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK') $Message"
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    Write-Host $Message
}

function Fail-Closed {
    param([string]$Reason)
    Write-Log "FAIL CLOSED: $Reason"
    exit 1
}

function Get-FileSha256 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Load-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing file: $Path"
    }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Empty JSON file: $Path"
    }
    return ($raw | ConvertFrom-Json)
}

function Save-JsonFile {
    param([string]$Path, [object]$Value)
    $json = $Value | ConvertTo-Json -Depth 20
    $tmp = "$Path.tmp"
    Set-Content -LiteralPath $tmp -Value $json -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Load-State {
    if (-not (Test-Path -LiteralPath $StatePath)) {
        return [pscustomobject]@{
            schema_version = "BEC-CLOSED-LOOP-1.0"
            offers = @()
            updated_at = $null
        }
    }
    return Load-JsonFile -Path $StatePath
}

function Get-StateOffer {
    param([object]$State, [string]$OfferKey)
    if ($null -eq $State.offers) { return $null }
    foreach ($item in @($State.offers)) {
        if ([string]$item.offer_key -eq $OfferKey) { return $item }
    }
    return $null
}

function Add-StateOffer {
    param([object]$State, [object]$Offer)
    $list = @($State.offers)
    $list += $Offer
    $State.offers = $list
    $State.updated_at = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    Save-JsonFile -Path $StatePath -Value $State
}

function Update-StateOffer {
    param([object]$State, [string]$OfferKey, [hashtable]$Changes)
    foreach ($item in @($State.offers)) {
        if ([string]$item.offer_key -eq $OfferKey) {
            foreach ($key in $Changes.Keys) {
                $item | Add-Member -NotePropertyName $key -NotePropertyValue $Changes[$key] -Force
            }
        }
    }
    $State.updated_at = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    Save-JsonFile -Path $StatePath -Value $State
}

function Get-LastLedgerHash {
    if (-not (Test-Path -LiteralPath $LedgerPath)) { return ("0" * 64) }
    $last = Get-Content -LiteralPath $LedgerPath -Encoding UTF8 | Where-Object { $_ -match "\S" } | Select-Object -Last 1
    if ($null -eq $last) { return ("0" * 64) }
    try {
        $obj = $last | ConvertFrom-Json
        if ($obj.PSObject.Properties.Name -contains "hash" -and $obj.hash) {
            return [string]$obj.hash
        }
    } catch { }
    return ("0" * 64)
}

function Write-LedgerEvent {
    param([string]$EventType, [string]$ObjectId, [object]$Payload)
    $prevHash = Get-LastLedgerHash
    $timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $payloadJson = $Payload | ConvertTo-Json -Compress -Depth 20
    $hashInput = $prevHash + $payloadJson + $timestamp + $EventType + $ObjectId
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($hashInput)
        $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
    $event = [ordered]@{
        event_id = "EVT_$(Get-Date -Format 'yyyyMMddHHmmssfff')_$ObjectId"
        timestamp = $timestamp
        event_type = $EventType
        object_id = $ObjectId
        prev_hash = $prevHash
        hash = $hash
        payload = $Payload
    }
    Add-Content -LiteralPath $LedgerPath -Value ($event | ConvertTo-Json -Compress -Depth 20) -Encoding UTF8
}

function Get-FieldValue {
    param([object]$Product, [string]$Field)
    if ($Product.PSObject.Properties.Name -contains $Field) {
        return $Product.$Field
    }
    if ($Field -eq "verification" -and ($Product.PSObject.Properties.Name -contains "verification")) {
        if ($Product.verification -and $Product.verification.PSObject.Properties.Name -contains "status") {
            return $Product.verification.status
        }
    }
    if ($Field -eq "merchant" -and ($Product.PSObject.Properties.Name -contains "merchant")) {
        if ($Product.merchant -and $Product.merchant.PSObject.Properties.Name -contains "name") {
            return $Product.merchant.name
        }
    }
    return $null
}

function Test-Rule {
    param([object]$Product, [object]$Rule)
    $fieldValue = Get-FieldValue -Product $Product -Field ([string]$Rule.field)
    $op = [string]$Rule.operator
    $target = $Rule.value
    $passed = $false
    switch ($op) {
        "lt" { if ($null -ne $fieldValue) { $passed = ([double]$fieldValue -lt [double]$target) } }
        "lte" { if ($null -ne $fieldValue) { $passed = ([double]$fieldValue -le [double]$target) } }
        "gt" { if ($null -ne $fieldValue) { $passed = ([double]$fieldValue -gt [double]$target) } }
        "gte" { if ($null -ne $fieldValue) { $passed = ([double]$fieldValue -ge [double]$target) } }
        "eq" { if ($null -ne $fieldValue) { $passed = ([string]$fieldValue -eq [string]$target) } }
        "ne" { if ($null -ne $fieldValue) { $passed = ([string]$fieldValue -ne [string]$target) } }
        "contains" { if ($null -ne $fieldValue) { $passed = ([string]$fieldValue).IndexOf([string]$target, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } }
        "in" {
            $values = @($Rule.values)
            if ($null -ne $fieldValue) {
                foreach ($candidate in $values) {
                    if ([string]$fieldValue -eq [string]$candidate) { $passed = $true; break }
                }
            }
        }
        default { throw "Unknown constitution operator: $op" }
    }
    return [pscustomobject]@{
        field = [string]$Rule.field
        operator = $op
        value = if ($null -eq $fieldValue) { $null } else { [string]$fieldValue }
        passed = $passed
    }
}

function Evaluate-Product {
    param([object]$Product, [object]$Constitution)
    if ($null -eq $Constitution.rules) {
        throw "constitution.json has no rules array"
    }
    $results = @()
    $approved = $true
    foreach ($rule in @($Constitution.rules)) {
        $result = Test-Rule -Product $Product -Rule $rule
        $results += $result
        if (-not $result.passed) { $approved = $false }
    }
    return [pscustomobject]@{ approved = $approved; rules = $results }
}

function Get-PolicyHash {
    param([object]$Constitution)
    $json = $Constitution | ConvertTo-Json -Compress -Depth 20
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($json)))).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function New-Checkout {
    param([string]$ProductId)
    $body = @{ product_id = $ProductId; quantity = 1 } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Uri $CheckoutEndpoint -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
    if ($null -eq $response.checkout_url -or [string]::IsNullOrWhiteSpace([string]$response.checkout_url)) {
        throw "Checkout endpoint returned no checkout_url for $ProductId"
    }
    return [string]$response.checkout_url
}

function Publish-Discord {
    param([string]$ProductName, [string]$ProductId, [string]$Price, [string]$CheckoutUrl)
    if ([string]::IsNullOrWhiteSpace($DiscordWebhookUrl)) {
        throw "DISCORD_WEBHOOK_URL is not configured"
    }
    $content = "New DreamLedger offer: $ProductName`nPrice: NZD $Price`nBuy: $CheckoutUrl`nProduct: $ProductId"
    $payload = @{ content = $content } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri $DiscordWebhookUrl -Method Post -Body $payload -ContentType "application/json" -TimeoutSec 10 | Out-Null
}

function Write-Proof {
    param([string]$Status, [string]$Reason, [int]$Cycles, [int]$Created, [int]$Published)
    $proof = [ordered]@{
        schema_version = "BEC-CLOSED-LOOP-PROOF-1.0"
        status = $Status
        reason = $Reason
        timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        script_sha256 = Get-FileSha256 -Path $MyInvocation.MyCommand.Path
        constitution_sha256 = Get-FileSha256 -Path $ConstitutionPath
        products_sha256 = Get-FileSha256 -Path $ProductsPath
        state_sha256 = Get-FileSha256 -Path $StatePath
        cycles = $Cycles
        checkout_sessions_created = $Created
        discord_posts = $Published
        public_action_approved = ($env:BEC_PUBLIC_ACTION_APPROVED -eq "YES")
    }
    Save-JsonFile -Path $ProofPath -Value $proof
}

# Explicit approval is required before any external commercial action.
if ($env:BEC_PUBLIC_ACTION_APPROVED -ne "YES") {
    Write-Log "READY BUT NOT ARMED: set BEC_PUBLIC_ACTION_APPROVED=YES to permit checkout creation and Discord publication."
    Write-Proof -Status "BLOCKED" -Reason "Explicit public action approval missing" -Cycles 0 -Created 0 -Published 0
    exit 0
}

if ($LoopIntervalSeconds -lt 5) {
    Fail-Closed "LoopIntervalSeconds must be at least 5 seconds."
}

$constitution = $null
$state = $null
try {
    $constitution = Load-JsonFile -Path $ConstitutionPath
    $state = Load-State
} catch {
    Fail-Closed $_.Exception.Message
}

$policyHash = Get-PolicyHash -Constitution $constitution
$cycles = 0
$createdCount = 0
$publishedCount = 0

Write-Log "BEC CLOSED LOOP ARMED. Idempotency and approval gate active."

while ($true) {
    $cycles++
    try {
        $catalog = Load-JsonFile -Path $ProductsPath
        $productProperties = @($catalog.PSObject.Properties)

        foreach ($property in $productProperties) {
            $productId = [string]$property.Name
            $product = $property.Value
            if ($null -eq $product) { continue }
            if (-not ($product.PSObject.Properties.Name -contains "price_nzd")) { continue }
            if (-not ($product.PSObject.Properties.Name -contains "name")) { continue }

            $decision = Evaluate-Product -Product $product -Constitution $constitution
            $productJson = $product | ConvertTo-Json -Compress -Depth 20
            $productSha = $null
            $sha = [System.Security.Cryptography.SHA256]::Create()
            try {
                $productSha = ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($productJson)))).Replace("-", "").ToLowerInvariant()
            } finally {
                $sha.Dispose()
            }
            $offerKey = "$productId|$policyHash|$productSha"
            $existing = Get-StateOffer -State $state -OfferKey $offerKey

            Write-LedgerEvent -EventType "CONSTITUTION_DECISION" -ObjectId $productId -Payload @{
                product_id = $productId
                product_name = [string]$product.name
                price_nzd = [double]$product.price_nzd
                approved = [bool]$decision.approved
                policy_hash = $policyHash
                product_hash = $productSha
                rule_results = @($decision.rules)
            }

            if (-not $decision.approved) { continue }
            if ($null -ne $existing -and $existing.checkout_created -eq $true -and $existing.discord_published -eq $true) {
                continue
            }

            if ($null -eq $existing) {
                $existing = [pscustomobject]@{
                    offer_key = $offerKey
                    product_id = $productId
                    product_name = [string]$product.name
                    price_nzd = [double]$product.price_nzd
                    policy_hash = $policyHash
                    product_hash = $productSha
                    offer_id = "OFFER_$productId_$($productSha.Substring(0,12))"
                    checkout_created = $false
                    discord_published = $false
                    checkout_url = $null
                    created_at = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                }
                Add-StateOffer -State $state -Offer $existing
            }

            if ($existing.checkout_created -ne $true) {
                $url = New-Checkout -ProductId $productId
                Update-StateOffer -State $state -OfferKey $offerKey -Changes @{ checkout_created = $true; checkout_url = $url }
                $createdCount++
                Write-LedgerEvent -EventType "CHECKOUT_CREATED" -ObjectId $productId -Payload @{
                    offer_id = $existing.offer_id
                    product_id = $productId
                    checkout_url = $url
                }
                $state = Load-State
                $existing = Get-StateOffer -State $state -OfferKey $offerKey
            }

            if ($existing.discord_published -ne $true) {
                Publish-Discord -ProductName ([string]$product.name) -ProductId $productId -Price ([string]$product.price_nzd) -CheckoutUrl ([string]$existing.checkout_url)
                Update-StateOffer -State $state -OfferKey $offerKey -Changes @{ discord_published = $true; published_at = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }
                $publishedCount++
                Write-LedgerEvent -EventType "OFFER_DISTRIBUTED" -ObjectId $productId -Payload @{
                    offer_id = $existing.offer_id
                    product_id = $productId
                    channel = "discord"
                    checkout_url = $existing.checkout_url
                }
                $state = Load-State
            }
        }

        Write-Proof -Status "PASS" -Reason "Loop healthy" -Cycles $cycles -Created $createdCount -Published $publishedCount
        Start-Sleep -Seconds $LoopIntervalSeconds
    } catch {
        Write-Proof -Status "FAIL" -Reason $_.Exception.Message -Cycles $cycles -Created $createdCount -Published $publishedCount
        Write-Log "LOOP FAILURE: $($_.Exception.Message)"
        Start-Sleep -Seconds $LoopIntervalSeconds
    }
}
