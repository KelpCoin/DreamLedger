Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY; $DiscordHook=$env:DISCORD_WEBHOOK_URL
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
$cards=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/cards?status=eq.available&select=inventory_key,name,price_nzd,stripe_checkout_url&order=created_at.asc&limit=5" -Headers $Headers
foreach($c in $cards){
    $msg=" *$($c.name)*  just $([math]::Round($c.price_nzd/100,2)) NZD`nInstant checkout: $($c.stripe_checkout_url)"
    if($DiscordHook){ Invoke-RestMethod -Method Post -Uri $DiscordHook -Body (@{content=$msg}|ConvertTo-Json) -ContentType 'application/json' }
    try {
        $evtId = "offer.shown-$($c.inventory_key)-$(Get-Date -Format 'yyyyMMddHHmmss')-$(Get-Random)"
        Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/liquidation_events" -Headers $Headers -Body (@{event_id=$evtId;event_type='offer.shown';inventory_key=$c.inventory_key;payload=@{}}|ConvertTo-Json)
        Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/offer_exposures" -Headers $Headers -Body (@{inventory_key=$c.inventory_key;channel='discord';estimated_price_nzd=$c.price_nzd;session_id=$evtId}|ConvertTo-Json)
    } catch {}
}
