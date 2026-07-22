# GenerateMesh.ps1
Import-Module "C:\BrownEyeCortex\DreamLedger\modules\TenantContext.psm1" -Force
$tenant = Get-TenantContext
$secrets = Get-Content "$env:USERPROFILE\Desktop\Secrets.json" | ConvertFrom-Json
$url = $secrets.supabase_url
$key = $secrets.supabase_service_role_key
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }
$filter = "tenant_id=eq.$tenant&lifecycle_status=eq.live&select=id,category"
$offers = Invoke-RestMethod -Uri "$url/rest/v1/offers?$filter" -Headers $headers -ErrorAction SilentlyContinue
if (-not $offers) { exit 0 }
Invoke-RestMethod -Uri "$url/rest/v1/mesh_edges?tenant_id=eq.$tenant" -Method Delete -Headers $headers | Out-Null
foreach ($o in $offers) {
    $candidates = $offers | Where-Object { $_.id -ne $o.id -and $_.category -eq $o.category }
    foreach ($t in $candidates) {
        $edge = @{ source_offer_id = $o.id; target_offer_id = $t.id; weight = 1.0; reason = "same_category"; tenant_id = $tenant } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$url/rest/v1/mesh_edges" -Method Post -Headers $headers -Body $edge | Out-Null
    }
}
