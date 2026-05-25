# api_gate.ps1
param($Root = "C:\BrownEyeCortex")
$StatePath = "$Root\State\kernel_state.json"
$LedgerPath = "$Root\ledger\events.jsonl"
$LockFile = "$Root\State\gate.lock"

function Acquire-Lock {
    $timeout = 5000
    $start = Get-Date
    while (Test-Path $LockFile) {
        if (((Get-Date) - $start).TotalMilliseconds -gt $timeout) {
            Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
            break
        }
        Start-Sleep -Milliseconds 30
    }
    New-Item -ItemType File -Path $LockFile -Force | Out-Null
}
function Release-Lock { Remove-Item $LockFile -Force -ErrorAction SilentlyContinue }
function Write-Ledger($type, $data) {
    $event = @{ ts = (Get-Date).ToString("o"); type = $type; data = $data }
    Add-Content $LedgerPath ($event | ConvertTo-Json -Depth 10)
}
function Get-State {
    if (!(Test-Path $StatePath)) {
        return @{ land = @{}; kelpcoins = @{}; streaks = @{} }
    }
    $raw = Get-Content $StatePath -Raw | ConvertFrom-Json
    return $raw | ConvertTo-Json -Depth 20 | ConvertFrom-Json
}
function Save-State($state) {
    $state | ConvertTo-Json -Depth 20 | Set-Content $StatePath -Encoding UTF8
}
function Invoke-CortexGate {
    param($action, $body = @{})
    Acquire-Lock
    try {
        $state = Get-State
        if (-not $state.kelpcoins -or $state.kelpcoins -isnot [hashtable]) { $state.kelpcoins = @{} }
        $result = $null
        switch ($action) {
            "GET_STATE" { $result = $state }
            "BUY_LAND" {
                $plot = "$($body.plot_id)"
                $exists = $state.land.PSObject.Properties.Name -contains $plot
                if ($exists) { $result = @{ error = "PLOT_TAKEN" } }
                else {
                    $state.land | Add-Member -NotePropertyName $plot -NotePropertyValue @{
                        owner = $body.user_id; price = $body.price; ts = (Get-Date).ToString("o")
                    }
                    Write-Ledger "LAND_PURCHASE" $body
                    $result = @{ ok = $true }
                }
            }
            "BOSS_DEFEAT" {
                $user = $body.user_id
                if (-not $state.kelpcoins.ContainsKey($user)) { $state.kelpcoins[$user] = 0 }
                $state.kelpcoins[$user] += 500
                Write-Ledger "BOSS_DEFEATED" $body
                $result = @{ reward = 500 }
            }
            "TRANSFER_KELPCOIN" {
                $from = $body.from; $to = $body.to; $amt = [int]$body.amount
                if (-not $state.kelpcoins.ContainsKey($from)) { $state.kelpcoins[$from] = 0 }
                if (-not $state.kelpcoins.ContainsKey($to)) { $state.kelpcoins[$to] = 0 }
                if ($state.kelpcoins[$from] -lt $amt) { $result = @{ error = "INSUFFICIENT_FUNDS" } }
                else {
                    $state.kelpcoins[$from] -= $amt
                    $state.kelpcoins[$to] += $amt
                    Write-Ledger "TRANSFER" $body
                    $result = @{ ok = $true }
                }
            }
            default { $result = @{ error = "UNKNOWN_ACTION" } }
        }
        Save-State $state
        return $result
    } finally { Release-Lock }
}