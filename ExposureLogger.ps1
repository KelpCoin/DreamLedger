Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
while($true){
    $events=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_type=in.(offer.shown,injection)&exposure_logged=is.false&order=event_sequence.asc&limit=20" -Headers $Headers
    foreach($e in $events){
        try {
            Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/offer_exposures" -Headers $Headers -Body (@{inventory_key=$e.inventory_key;channel='discord';estimated_price_nzd=$e.payload.price_nzd ?? 0;session_id=$e.event_id}|ConvertTo-Json)
            Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_id=eq.$($e.event_id)" -Headers $Headers -Body '{"exposure_logged":true}'
        } catch {}
    }
    Start-Sleep -Seconds 30
}
