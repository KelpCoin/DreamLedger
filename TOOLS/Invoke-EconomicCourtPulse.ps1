#requires -version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "KelpCoin/DreamLedger"
$Root = "D:\BrownEyeCortex"
$ProofDir = Join-Path $Root "PROOFS\ECONOMIC_COURT"
$Stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$Proof = Join-Path $ProofDir ($Stamp + "-economic-truth.json")
$SupabaseUrl = "https://wbwgroygjeyukkspnqiy.supabase.co"
$SupabaseKey = "sb_publishable_O5JRD67KaU3SA9dFq-JIuQ_Pzs8pedj"

New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

$Headers = @{
    apikey = $SupabaseKey
    Authorization = "Bearer $SupabaseKey"
}
$Uri = "$SupabaseUrl/rest/v1/billboard_placements?select=id,status,x,y,width,height,pixels,title,price_nzd,stripe_checkout_session,stripe_payment_intent&order=id.asc"
$Rows = @(Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers)

$Published = @($Rows | Where-Object { $_.status -eq "PUBLISHED" })
$PaymentLinked = @($Rows | Where-Object {
    $_.stripe_payment_intent -and $_.stripe_checkout_session -and $_.status -ne "REFUNDED"
})
$Pixels = [int64](($Published | Measure-Object -Property pixels -Sum).Sum)
$Value = [decimal](($PaymentLinked | Measure-Object -Property price_nzd -Sum).Sum)

$ProofObject = [ordered]@{
    schema_version = 1
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    product_id = "3000"
    source = "Supabase public allocation state"
    facts = [ordered]@{
        total_rows = $Rows.Count
        published_count = $Published.Count
        payment_linked_count = $PaymentLinked.Count
        payment_linked_value_nzd = $Value
        published_pixels = $Pixels
        published_pixels_remaining = 1000000 - $Pixels
    }
    economic_truth = [ordered]@{
        external_customers_proven = 0
        revenue_nzd_proven = 0
        stripe_settlement_independent_check = "NOT_IMPLEMENTED_IN_PUBLIC_PULSE"
        first_sale_gate = "ONE_REAL_EXTERNAL_PAYMENT"
    }
    decision = [ordered]@{
        status = "BLOCKED_ON_FIRST_SALE"
        reason = "No independently verified settled external payment is proven by this pulse."
    }
}

$Json = $ProofObject | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($Proof, $Json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "ECONOMIC COURT PULSE PASS"
Write-Host "Proof: $Proof"
Write-Host "Rows: $($Rows.Count)"
Write-Host "Published pixels: $Pixels"
Write-Host "Allocation-linked payment evidence: $($PaymentLinked.Count)"
Write-Host "Revenue proven: NZ$0"
Write-Host "First sale gate: ONE_REAL_EXTERNAL_PAYMENT"
