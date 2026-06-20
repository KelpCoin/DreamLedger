#Requires -Version 5.1
<#
.SYNOPSIS
    Stripe webhook listener. Receives checkout.session.completed events,
    verifies HMAC signature, logs sales automatically.
#>
param([int]$Port = 8090)
$ROOT           = 'C:\BrownEyeCortex'
$WEBHOOK_SECRET = $env:STRIPE_WEBHOOK_SECRET

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/webhook/")
$listener.Start()
Write-Host "Stripe webhook listener on port $Port"

while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $body = (New-Object System.IO.StreamReader $ctx.Request.InputStream).ReadToEnd()
    $sig  = $ctx.Request.Headers['Stripe-Signature']

    $verified = $false
    if ($WEBHOOK_SECRET -and $sig) {
        try {
            $parts   = $sig -split ','
            $tsPart  = ($parts | Where-Object { $_ -match '^t=' }) -replace 't=', ''
            $v1Part  = ($parts | Where-Object { $_ -match '^v1=' }) -replace 'v1=', ''
            $payload = "$tsPart.$body"
            $hmac    = New-Object System.Security.Cryptography.HMACSHA256
            $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($WEBHOOK_SECRET)
            $computed = ([BitConverter]::ToString($hmac.ComputeHash(
                [System.Text.Encoding]::UTF8.GetBytes($payload))) -replace '-', '').ToLowerInvariant()
            $age = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - [long]$tsPart
            $verified = ($computed -eq $v1Part.ToLowerInvariant()) -and ($age -lt 300)
        } catch { }
    } elseif (-not $WEBHOOK_SECRET) {
        Write-Warning 'STRIPE_WEBHOOK_SECRET not set. Accepting unverified webhooks.'
        $verified = $true
    }

    if (-not $verified) {
        $ctx.Response.StatusCode = 401
        $ctx.Response.Close()
        continue
    }

    try {
        $event = $body | ConvertFrom-Json -ErrorAction Stop
        if ($event.type -eq 'checkout.session.completed') {
            $session = $event.data.object
            $skuId   = ''
            if ($session.PSObject.Properties['metadata'] -and
                $session.metadata.PSObject.Properties['sku_id']) {
                $skuId = [string]$session.metadata.sku_id
            }
            $amountCents = if ($session.PSObject.Properties['amount_total']) {
                [int]$session.amount_total
            } else { 0 }

            if ($skuId -and $amountCents -gt 0) {
                Write-Host "SALE: $skuId NZD $$([Math]::Round($amountCents/100,2))"
                & powershell.exe -ExecutionPolicy Bypass -File "$ROOT\Log-Sale.ps1" `
                    -sku_id $skuId -amount_nzd_cents $amountCents -source 'stripe_webhook'
            } else {
                $raw = [ordered]@{
                    event_id      = [guid]::NewGuid().ToString()
                    event_type    = 'sale'
                    timestamp_utc = [DateTimeOffset]::UtcNow.ToString('o')
                    source        = 'stripe_webhook_unresolved'
                    entity        = @{ sku_id = 'unknown'; type = 'sku' }
                    metrics       = @{ amount_nzd_cents = $amountCents; quantity = 1 }
                    flags         = @{ ignite = $true; test = $false }
                    stripe_session_id = [string]$session.id
                } | ConvertTo-Json -Compress
                                Write-Host "UNRESOLVED SALE logged. Session: $($session.id)"
            }
        }
    } catch {
        Write-Warning "Webhook processing error: $($_.Exception.Message)"
    }

    $ctx.Response.StatusCode = 200
    $ctx.Response.Close()
}
