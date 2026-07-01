# Allocator.ps1
Import-Module "C:\BrownEyeCortex\DreamLedger\modules\TenantContext.psm1" -Force
$tenant = Get-TenantContext
$ops = Get-GovernorPolicy -TenantId $tenant
$secrets = Get-Content "$env:USERPROFILE\Desktop\Secrets.json" | ConvertFrom-Json
$url = $secrets.supabase_url
$key = $secrets.supabase_service_role_key
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }

$totalBudget = $ops.allocation.total_daily_impressions
$explorationRatio = $ops.exploration_ratio
$filter = "tenant_id=eq.$tenant&lifecycle_status=in.(review,live)&visibility=in.(normal,featured,limited)"
$offers = Invoke-RestMethod -Uri "$url/rest/v1/offers?$filter" -Headers $headers -ErrorAction SilentlyContinue
if (-not $offers) { exit 0 }

$proven = $offers | Where-Object { $_.confidence_score -gt 0.5 }
$experiments = $offers | Where-Object { $_.confidence_score -le 0.5 }

$provenBudget = $totalBudget * (1 - $explorationRatio)
$provenSum = ($proven | Measure-Object -Property quality_score -Sum).Sum
if ($provenSum -gt 0) {
    foreach ($o in $proven) {
        $alloc = [math]::Floor(($o.quality_score / $provenSum) * $provenBudget)
        $alloc = [math]::Max($ops.allocation.min_exposure_per_offer, [math]::Min($alloc, $ops.allocation.max_exposure_per_offer))
        $update = @{ exposure_budget = $alloc } | ConvertTo-Json
        Invoke-RestMethod -Uri "$url/rest/v1/offers?id=eq.$($o.id)" -Method Patch -Headers $headers -Body $update | Out-Null
    }
}
$exploreBudget = $totalBudget * $explorationRatio
$expCount = $experiments.Count
if ($expCount -gt 0) {
    $per = [math]::Floor($exploreBudget / $expCount)
    $per = [math]::Max($ops.allocation.min_exposure_per_offer, [math]::Min($per, $ops.allocation.max_exposure_per_offer))
    foreach ($o in $experiments) {
        $update = @{ exposure_budget = $per } | ConvertTo-Json
        Invoke-RestMethod -Uri "$url/rest/v1/offers?id=eq.$($o.id)" -Method Patch -Headers $headers -Body $update | Out-Null
    }
}
