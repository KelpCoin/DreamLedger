#!/usr/bin/env pwsh
# BEC-PRIME first-sale watchdog.
# Detection only. It never writes a sale or proof.

[CmdletBinding()]
param(
    [string]$PaymentLinkId = "plink_1U7F9QEGgEAnUFF9NjRq8gNq",
    [int]$IntervalSeconds = 60,
    [switch]$Once
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY)) { throw "STRIPE_SECRET_KEY is missing." }

function Get-Stripe([string]$Path) {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(($env:STRIPE_SECRET_KEY + ":")))
    Invoke-RestMethod -Method Get -Uri ("https://api.stripe.com/v1/" + $Path) -Headers @{ Authorization = "Basic $auth" } -TimeoutSec 20
}

Write-Host "BEC-PRIME FIRST-SALE WATCHDOG" -ForegroundColor Cyan
Write-Host "Payment Link: $PaymentLinkId"
Write-Host "Interval: $IntervalSeconds seconds"

while ($true) {
    $sessions = Get-Stripe ("checkout/sessions?payment_link=" + [Uri]::EscapeDataString($PaymentLinkId) + "&limit=100")
    $paid = @($sessions.data | Where-Object { $_.payment_status -eq "paid" })

    if ($paid.Count -gt 0) {
        foreach ($session in $paid) {
            Write-Host "FIRST PAYMENT CANDIDATE DETECTED" -ForegroundColor Green
            Write-Host "Checkout Session: $($session.id)"
            Write-Host "Amount: $([int64]$session.amount_total) $($session.currency)"
            Write-Host "Payment Intent: $($session.payment_intent)"
            Write-Host "Detection is not settlement. Run:"
            Write-Host ".\scripts\Verify-FirstEconomicProof.ps1 -CheckoutSessionId $($session.id)"
        }
        exit 0
    }

    Write-Host ("[{0}] No paid session." -f (Get-Date).ToUniversalTime().ToString("o"))
    if ($Once) { exit 0 }
    Start-Sleep -Seconds $IntervalSeconds
}
