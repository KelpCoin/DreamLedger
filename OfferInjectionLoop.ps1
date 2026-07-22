Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY; $DiscordHook=$env:DISCORD_WEBHOOK_URL
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
while($true){
    $cards=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/cards?status=eq.available&select=inventory_key,name,price_nzd,stripe_checkout_url,created_at&order=created_at.asc&limit=3" -Headers $Headers
    foreach($c in $cards){
        $age=((Get-Date)-[datetime]$c.created_at).Days
        $msg=" $age days listed: *$($c.name)* dropped to $($c.price_nzd/100) NZD  $($c.stripe_checkout_url)"
        if($DiscordHook){ Invoke-RestMethod -Method Post -Uri $DiscordHook -Body (@{content=$msg}|ConvertTo-Json) -ContentType 'application/json' }
        try {
            $evtId = "injection.$($c.inventory_key)-$(Get-Date -Format 'yyyyMMddHHmmss')"
            Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/offer_exposures" -Headers $Headers -Body (@{inventory_key=$c.inventory_key;channel='discord';estimated_price_nzd=$c.price_nzd;session_id=$evtId}|ConvertTo-Json)
        } catch {}
    }
    Start-Sleep -Seconds 7200
}
