Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey";'Content-Type'='application/json'}
$stateFile = 'D:\dreamledger\daemon\throttle_state.json'
$throttle = if (Test-Path $stateFile) { Get-Content $stateFile -Raw | ConvertFrom-Json } else { @{ last_hour_exposures=0; throttle_active=$false } }
while($true){
    $oneHourAgo = (Get-Date).AddHours(-1).ToString('yyyy-MM-dd HH:mm:ss')
    $recent = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/offer_exposures?created_at=gte.$oneHourAgo&select=count" -Headers $Headers
    $count = $recent[0].count
    $throttle.last_hour_exposures = $count
    if ($count -gt 50) {
        $throttle.throttle_active = $true
        $evt = @{event_id="throttle.$(Get-Date -Format yyyyMMddHHmmss)";event_type='system.throttle';inventory_key='global';payload=@{reason="exposure_cap";count=$count}}|ConvertTo-Json -Compress
        try { Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/liquidation_events" -Headers $Headers -Body $evt } catch {}
    } else { $throttle.throttle_active = $false }
    $throttle | ConvertTo-Json | Set-Content $stateFile -Force
    Start-Sleep -Seconds 300
}
