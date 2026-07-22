# GenerateSEO.ps1
Import-Module "C:\BrownEyeCortex\DreamLedger\modules\TenantContext.psm1" -Force
$tenant = Get-TenantContext
$secrets = Get-Content "$env:USERPROFILE\Desktop\Secrets.json" | ConvertFrom-Json
$url = $secrets.supabase_url
$key = $secrets.supabase_service_role_key
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }
$filter = "tenant_id=eq.$tenant&lifecycle_status=eq.live&visibility=in.(normal,featured)"
$offers = Invoke-RestMethod -Uri "$url/rest/v1/offers?$filter" -Headers $headers -ErrorAction SilentlyContinue
if (-not $offers) { exit 0 }
$out = "C:\BrownEyeCortex\DreamLedger\seo_pages\$tenant"
New-Item -ItemType Directory -Force -Path $out | Out-Null
foreach ($o in $offers) {
    $slug = if ($o.slug) { $o.slug } else { $o.id }
    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>$($o.title)</title>
    <meta name="description" content="$($o.description)">
    <meta property="og:title" content="$($o.title)">
    <meta property="og:price:amount" content="$($o.final_price_cents/100)">
</head>
<body>
    <h1>$($o.title)</h1>
    <p>$($o.description)</p>
    <p><strong>Price:</strong> $($o.final_price_cents/100) USD</p>
    <a href="https://dreamledger.org/checkout?offer=$($o.id)">Buy Now</a>
</body>
</html>
"@
    $html | Out-File "$out\$slug.html" -Encoding utf8
}
