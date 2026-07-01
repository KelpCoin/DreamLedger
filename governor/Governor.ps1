# Governor.ps1
Import-Module "C:\BrownEyeCortex\DreamLedger\modules\TenantContext.psm1" -Force
$tenant = Get-TenantContext
$ops = Get-GovernorPolicy -TenantId $tenant
$secrets = Get-Content "$env:USERPROFILE\Desktop\Secrets.json" | ConvertFrom-Json
$url = $secrets.supabase_url
$key = $secrets.supabase_service_role_key
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }

$filter = "tenant_id=eq.$tenant&lifecycle_status=neq.archived"
$offers = Invoke-RestMethod -Uri "$url/rest/v1/offers?$filter" -Headers $headers -ErrorAction SilentlyContinue
if (-not $offers) { Write-Host "No offers to evaluate."; exit 0 }

foreach ($o in $offers) {
    $id = $o.id
    $currentLifecycle = $o.lifecycle_status
    $currentVisibility = $o.visibility
    $dsis = $o.dsis_score
    $metrics = if ($o.raw_metrics) { $o.raw_metrics } else { @{} }
    $impressions = [int]($metrics.impressions -or 0)
    $clicks = [int]($metrics.clicks -or 0)
    $purchases = [int]($metrics.purchases -or 0)
    $refunds = [int]($metrics.refunds -or 0)

    $ctr = if ($impressions -gt 0) { $clicks / $impressions } else { 0 }
    $convRate = if ($clicks -gt 0) { $purchases / $clicks } else { 0 }
    $refundRate = if ($purchases -gt 0) { $refunds / $purchases } else { 0 }

    $quality = (0.30 * $convRate) + (0.25 * ($purchases * 0.01)) + (0.20 * (1 - $refundRate))
    $confidence = if ($impressions -ge $ops.evidence_levels.gold) { 1.0 } elseif ($impressions -ge $ops.evidence_levels.silver) { 0.7 } elseif ($impressions -ge $ops.evidence_levels.bronze) { 0.4 } else { 0.2 }

    $newLifecycle = $currentLifecycle
    $newVisibility = $currentVisibility
    $decision = "none"
    $reason = ""

    if ($currentLifecycle -eq "draft") {
        $commercialScore = 70
        $overall = ($dsis * 0.3) + ($commercialScore * 0.3) + ($o.market_score * 0.4)
        if ($dsis -ge $ops.qualification.min_dsis -and $overall -ge $ops.qualification.min_overall) {
            $newLifecycle = "review"
            $decision = "qualify"
            $reason = "Met qualification thresholds"
        }
    }

    if ($currentLifecycle -in @("review","live") -and $confidence -gt 0.4) {
        if ($impressions -gt $ops.promotion.min_views -and $ctr -gt $ops.promotion.min_ctr -and $convRate -gt $ops.promotion.min_conversion_rate -and $refundRate -lt $ops.promotion.max_refund_rate) {
            $newVisibility = "featured"
            $decision = "promote"
            $reason = "Met promotion criteria"
        } elseif ($impressions -gt $ops.demotion.min_views -and $ctr -lt $ops.demotion.max_ctr -and $purchases -le $ops.demotion.min_conversions) {
            $newVisibility = "limited"
            $decision = "demote"
            $reason = "Poor CTR and no conversions"
        } elseif ($impressions -gt $ops.retirement.min_views -and $ctr -lt $ops.retirement.max_ctr -and $purchases -le $ops.retirement.min_conversions -and ((Get-Date) - [datetime]$o.created_at).TotalDays -gt $ops.retirement.min_age_days) {
            $newLifecycle = "archived"
            $decision = "retire"
            $reason = "Sustained poor performance"
        }
    }

    if ($newLifecycle -ne $currentLifecycle -or $newVisibility -ne $currentVisibility) {
        $updateBody = @{ lifecycle_status = $newLifecycle; visibility = $newVisibility; quality_score = $quality; confidence_score = $confidence } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$url/rest/v1/offers?id=eq.$id" -Method Patch -Headers $headers -Body $updateBody | Out-Null
        Write-Host "Updated offer $id : $decision"
    }
}
