Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY; $StripeKey=$env:STRIPE_SECRET_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
while($true){
    $events=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_type=eq.price.changed&stripe_synced=is.false&order=event_sequence.asc&limit=10" -Headers $Headers
    foreach($e in $events){
        try {
            $prod=Invoke-RestMethod -Method Get -Uri "https://api.stripe.com/v1/products?metadata[inventory_key]=$($e.inventory_key)&limit=1" -Headers @{Authorization="Bearer $StripeKey"}
            $price=Invoke-RestMethod -Method Post -Uri "https://api.stripe.com/v1/prices" -Headers @{Authorization="Bearer $StripeKey"} -Body "unit_amount=$($e.payload.new_price)&currency=nzd&product=$($prod.data[0].id)" -ContentType 'application/x-www-form-urlencoded'
            Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_id=eq.$($e.event_id)" -Headers $Headers -Body '{"stripe_synced":true}'
            $cevt=@{event_id="checkout.$($e.inventory_key).$(Get-Date -Format yyyyMMddHHmmss)";inventory_key=$e.inventory_key;event_type='checkout_created';channel='stripe';value_nzd=$e.payload.new_price}|ConvertTo-Json -Compress
            Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/conversion_events" -Headers $Headers -Body $cevt
        } catch {}
    }
    Start-Sleep -Seconds 30
}
