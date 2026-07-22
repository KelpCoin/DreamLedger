Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY; $StripeKey=$env:STRIPE_SECRET_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
$cards=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/cards?status=eq.available&stripe_checkout_url=is.null" -Headers $Headers
foreach($c in $cards){
    try {
        $prod=Invoke-RestMethod -Method Post -Uri 'https://api.stripe.com/v1/products' -Headers @{Authorization="Bearer $StripeKey"} -Body "name=$([uri]::EscapeDataString($c.name))&metadata[inventory_key]=$($c.inventory_key)" -ContentType 'application/x-www-form-urlencoded'
        $price=Invoke-RestMethod -Method Post -Uri 'https://api.stripe.com/v1/prices' -Headers @{Authorization="Bearer $StripeKey"} -Body "unit_amount=$($c.price_nzd)&currency=nzd&product=$($prod.id)" -ContentType 'application/x-www-form-urlencoded'
        $session=Invoke-RestMethod -Method Post -Uri 'https://api.stripe.com/v1/checkout/sessions' -Headers @{Authorization="Bearer $StripeKey"} -Body "mode=payment&line_items[0][price]=$($price.id)&line_items[0][quantity]=1&metadata[inventory_key]=$($c.inventory_key)" -ContentType 'application/x-www-form-urlencoded'
        Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/cards?inventory_key=eq.$($c.inventory_key)" -Headers $Headers -Body "{""stripe_checkout_url"":""$($session.url)""}"
    } catch {}
}
