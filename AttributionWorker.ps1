Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
while($true){
    $sales=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_type=eq.card.sold&attribution_done=is.false&order=event_sequence.asc&limit=10" -Headers $Headers
    foreach($sale in $sales){
        $saleTime = [datetime]$sale.created_at
        $window = $saleTime.AddHours(-24)
        $exposures = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/offer_exposures?inventory_key=eq.$($sale.inventory_key)&created_at=gte.$($window.ToString('yyyy-MM-dd HH:mm:ss'))&order=created_at.desc" -Headers $Headers
        if ($exposures -and $exposures.Count -gt 0) {
            $top = $exposures[0]
            $attEvt = @{event_id="attribution.$($sale.event_id)";event_type='attribution.assigned';inventory_key=$sale.inventory_key;payload=@{sale_event_id=$sale.event_id;exposure_id=$top.exposure_id;credit=1.0}}|ConvertTo-Json -Compress
            try { Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/liquidation_events" -Headers $Headers -Body $attEvt } catch {}
        }
        Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_id=eq.$($sale.event_id)" -Headers $Headers -Body '{"attribution_done":true}'
    }
    Start-Sleep -Seconds 120
}
