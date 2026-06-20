Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
while($true){
    $events=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events?or=(event_type.eq.price.changed,event_type.eq.card.bundled)&supabase_synced=is.false&order=event_sequence.asc&limit=20" -Headers $Headers
    foreach($e in $events){
        $update=@{}
        if($e.event_type -eq 'price.changed'){ $update.price_nzd=$e.payload.new_price }
        if($e.event_type -eq 'card.bundled')  { $update.bundle_flag=$true }
        try {
            Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/cards?inventory_key=eq.$($e.inventory_key)" -Headers $Headers -Body ($update|ConvertTo-Json -Compress)
            Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_id=eq.$($e.event_id)" -Headers $Headers -Body '{"supabase_synced":true}'
        } catch {}
    }
    Start-Sleep -Seconds 30
}
