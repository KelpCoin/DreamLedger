Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY; $DiscordHook=$env:DISCORD_WEBHOOK_URL
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
while($true){
    if($DiscordHook){
        $events=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_type=eq.card.pushed&discord_posted=is.false&order=event_sequence.asc&limit=5" -Headers $Headers
        foreach($e in $events){
            $card=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/cards?inventory_key=eq.$($e.inventory_key)&select=name,price_nzd,stripe_checkout_url" -Headers $Headers
            if($card){
                $msg=" $($card[0].name)  now $($card[0].price_nzd/100) NZD`n$($card[0].stripe_checkout_url)"
                Invoke-RestMethod -Method Post -Uri $DiscordHook -Body (@{content=$msg}|ConvertTo-Json) -ContentType 'application/json'
                Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_id=eq.$($e.event_id)" -Headers $Headers -Body '{"discord_posted":true}'
            }
        }
    }
    Start-Sleep -Seconds 60
}
