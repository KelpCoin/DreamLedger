# TenantContext.psm1
$script:CurrentTenant = '00000000-0000-0000-0000-000000000000'
function Set-TenantContext { param($TenantId) $script:CurrentTenant = $TenantId; $env:TENANT_ID = $TenantId }
function Get-TenantContext { return $script:CurrentTenant }
function Get-GovernorPolicy {
    param($TenantId = (Get-TenantContext))
    $secrets = Get-Content "$env:USERPROFILE\Desktop\Secrets.json" | ConvertFrom-Json
    $url = $secrets.supabase_url; $key = $secrets.supabase_service_role_key
    $headers = @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }
    try {
        $uri = "$url/rest/v1/governor_policy?active=eq.true&limit=1"
        $response = Invoke-RestMethod -Uri $uri -Headers $headers -ErrorAction Stop
        if ($response -and $response.Count -gt 0 -and $response[0].operational_tuning) { return $response[0].operational_tuning }
        else { Write-Warning "No active policy; using default."; return (Get-Content "C:\BrownEyeCortex\DreamLedger\default_policy.json" | ConvertFrom-Json) }
    } catch { Write-Warning "Policy fetch failed: $_ ; using default."; return (Get-Content "C:\BrownEyeCortex\DreamLedger\default_policy.json" | ConvertFrom-Json) }
}
Export-ModuleMember -Function Set-TenantContext, Get-TenantContext, Get-GovernorPolicy
