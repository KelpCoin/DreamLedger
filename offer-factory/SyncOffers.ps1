# SyncOffers.ps1
Import-Module "C:\BrownEyeCortex\DreamLedger\modules\TenantContext.psm1" -Force
$tenant = Get-TenantContext
$secrets = Get-Content "$env:USERPROFILE\Desktop\Secrets.json" | ConvertFrom-Json
$headers = @{ "apikey" = $secrets.supabase_service_role_key; "Authorization" = "Bearer $($secrets.supabase_service_role_key)"; "Content-Type" = "application/json" }
$out = "C:\BrownEyeCortex\DreamLedger\offers\out"
Get-ChildItem $out -Filter *.json | ForEach-Object {
    try {
        $sku = Get-Content $_.FullName | ConvertFrom-Json
        if (-not $sku.title -or -not $sku.description -or $sku.base_price_cents -le 0) {
            Write-Warning "Invalid SKU, skipping: $($_.Name)"
            continue
        }
        $body = @{
            title = $sku.title
            description = $sku.description
            base_price_cents = $sku.base_price_cents
            final_price_cents = $sku.base_price_cents
            dsis_score = $sku.dsis_score
            lifecycle_status = "draft"
            visibility = "hidden"
            currency = "usd"
            tenant_id = $tenant
        } | ConvertTo-Json -Depth 10
        $url = "$($secrets.supabase_url)/rest/v1/offers"
        Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop | Out-Null
        Remove-Item $_.FullName
        Write-Host "Synced offer: $($sku.title)"
    } catch {
        Write-Warning "Sync failed for $($_.Name): $_"
        "$(Get-Date -Format o) :: SYNC_FAIL $($_.Name) $_" | Out-File "C:\BrownEyeCortex\DreamLedger\logs\sync_failures.log" -Append
    }
}
