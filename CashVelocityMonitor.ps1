Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl=$env:SUPABASE_URL; $SupabaseKey=$env:SUPABASE_SERVICE_ROLE_KEY
$Headers=@{apikey=$SupabaseKey;Authorization="Bearer $SupabaseKey"}
$events=Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events?event_type=eq.card.sold&select=inventory_key,payload,created_at" -Headers $Headers
$revenue=0; $sales=0
foreach($e in $events){ $revenue+=$e.payload.price_nzd ?? 0; $sales++ }
$report=@{ date=(Get-Date -Format 'yyyy-MM-dd'); total_revenue=$revenue; total_sales=$sales; avg_price=if($sales){$revenue/$sales}else{0} }
$report | ConvertTo-Json | Out-File "D:\dreamledger\reports\cash_velocity_$(Get-Date -Format 'yyyyMMdd').json"
