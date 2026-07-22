Set-StrictMode -Version 2.0; $ErrorActionPreference = 'Stop'
$SupabaseUrl = $env:SUPABASE_URL; $SupabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY
$Headers = @{ apikey=$SupabaseKey; Authorization="Bearer $SupabaseKey"; 'Content-Type'='application/json' }
$LockFile = 'D:\dreamledger\daemon\brain.lock'
if (Test-Path $LockFile) { if (((Get-Date)-(Get-Item $LockFile).LastWriteTime).TotalSeconds -lt 20) { exit 0 } }
New-Item $LockFile -Force | Out-Null
while ($true) {
    try {
        $cards = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/cards?status=eq.available&select=inventory_key,price_nzd,created_at" -Headers $Headers
        foreach ($c in $cards) {
            $age = if ($c.created_at) { ((Get-Date)-[datetime]$c.created_at).Days } else { 0 }
            $oldPrice = [int]$c.price_nzd
            $convProb = [math]::Max(0.01, 0.15 - ($age * 0.01))
            $expectedValue = $convProb * $oldPrice
            $threshold = $oldPrice * 0.08
            $newPrice = $oldPrice; $action = 'HOLD'
            if ($expectedValue -lt $threshold) {
                $newPrice = [int]($oldPrice * 0.92); $action = 'price.changed'
            } elseif ($convProb -gt 0.20 -and $oldPrice -lt 2000) {
                $newPrice = [int]($oldPrice * 1.05); $action = 'price.changed'
            } elseif ($age -gt 10 -and $oldPrice -lt 1500) {
                $action = 'card.bundled'
            }
            if ($action -ne 'HOLD') {
                $evtId = "$action-$($c.inventory_key)-$(Get-Date -Format 'yyyyMMddHHmmss')-$(Get-Random)"
                $body = @{ event_id=$evtId; event_type=$action; inventory_key=$c.inventory_key; payload=@{ old_price=$oldPrice; new_price=$newPrice; reason='v3_expected_value' } } | ConvertTo-Json -Compress
                try { Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/liquidation_events" -Method Post -Headers $Headers -Body $body } catch {}
            }
        }
    } catch {}
    Start-Sleep -Seconds 15
}
