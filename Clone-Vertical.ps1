param([Parameter(Mandatory)] [string]$Vertical, [string]$Audience = "$Vertical players", [int]$Price = 25, [string]$Channel = "discord")
$root = "C:\BrownEyeCortex"
$slug = ($Vertical.ToLowerInvariant() -replace '\s+','-')
$stencilPath = "$root\stencils\$slug.json"
$linkPath = "$root\logs\stripe_${slug}_link.txt"
$cardFile = "$root\public\cards_$slug.html"
$cubeDir = "$root\CUBE_ENGINE\instances\$slug"

# Stencil
$stencil = @{
    name = "$Vertical Micro-Audit"
    offer_angle = "5 fixes, 5 upgrades, 1 strategy adjustment"
    price_band = $Price
    cta = "DM to get your $Vertical list"
    landing_page_structure = @{
        headline = "Your $Vertical army is 3 changes from domination"
        subheadline = "We fix inefficiency in under 20 minutes"
        bullets = @("5 cuts that increase synergy","5 upgrades that win matchups","1 tactical correction most players miss")
    }
}
$stencil | ConvertTo-Json -Depth 5 | Set-Content $stencilPath -Encoding UTF8

# Stripe link
if (Test-Path "$root\keys\stripe_secret.key") {
    $apiKey = Get-Content "$root\keys\stripe_secret.key" -Raw
    $currency = "nzd"
    try {
        $headers = @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/x-www-form-urlencoded" }
        $priceObj = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" -Method Post -Headers $headers -Body "unit_amount=$($Price*100)&currency=$currency&product_data[name]=$($stencil.name)"
        $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" -Method Post -Headers $headers -Body "line_items[0][price]=$($priceObj.id)&line_items[0][quantity]=1"
        $link.url | Out-File $linkPath -Encoding utf8
    } catch {
        $currency = "usd"
        $priceObj = Invoke-RestMethod -Uri "https://api.stripe.com/v1/prices" -Method Post -Headers $headers -Body "unit_amount=$($Price*100)&currency=usd&product_data[name]=$($stencil.name)"
        $link = Invoke-RestMethod -Uri "https://api.stripe.com/v1/payment_links" -Method Post -Headers $headers -Body "line_items[0][price]=$($priceObj.id)&line_items[0][quantity]=1"
        $link.url | Out-File $linkPath -Encoding utf8
    }
} else { "#" | Out-File $linkPath }

# Product card
$cardHtml = @"
<div class="card">
  <h3>$Vertical Micro-Audit</h3>
  <div class="price">NZD $$Price</div>
  <p class="desc">5 fixes, 5 upgrades, 1 tactical correction for $Audience.</p>
  <a href="#" data-stripe-link="REPLACE_ME" class="btn">Get Instant Access</a>
</div>
"@
Set-Content $cardFile -Value $cardHtml -Encoding UTF8

# Cube identity
New-Item -ItemType Directory -Force -Path $cubeDir | Out-Null
@"
community_name: "$Vertical Community"
slug: "$slug"
niche: "$Vertical"
audience_type: "$Audience"
channel: "$Channel"
"@ | Out-File "$cubeDir\identity.yaml" -Encoding utf8

# Registry
$entry = @{ vertical=$Vertical; slug=$slug; price=$Price; created=(Get-Date).ToString("o") } | ConvertTo-Json -Compress
Add-Content "$root\data\vertical_registry.jsonl" $entry -Encoding UTF8

Write-Host "VERTICAL '$Vertical' CLONED. Insert card $cardFile into index.html, then run DailyStabilizer."
