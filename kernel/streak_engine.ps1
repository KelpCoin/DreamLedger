# streak_engine.ps1
param($Root = "C:\BrownEyeCortex")
$LedgerPath = "$Root\ledger\events.jsonl"
function Get-LedgerEvents {
    if (!(Test-Path $LedgerPath)) { return @() }
    return Get-Content $LedgerPath | ForEach-Object { try { $_ | ConvertFrom-Json } catch { $null } } | Where-Object { $_ -ne $null }
}
function Get-Streak($user_id) {
    $events = Get-LedgerEvents | Where-Object { $_.data.user_id -eq $user_id -and $_.type -eq "STREAK_UPDATE" } | Sort-Object ts
    if ($events.Count -eq 0) { return 0 }
    $days = $events | ForEach-Object { ([datetime]$_.ts).Date } | Sort-Object -Unique
    $streak = 1
    for ($i = $days.Count - 1; $i -gt 0; $i--) {
        if (($days[$i] - $days[$i-1]).TotalDays -eq 1) { $streak++ } else { break }
    }
    return $streak
}
function Get-PressureTier($streak) {
    if ($streak -ge 100) { return "LEGENDARY_COMMITMENT" }
    if ($streak -ge 90)  { return "FINAL_ASCENT" }
    if ($streak -ge 75)  { return "HIGH_STABILITY" }
    if ($streak -ge 50)  { return "ESTABLISHED" }
    if ($streak -ge 30)  { return "FORMING_HABIT" }
    if ($streak -ge 14)  { return "EARLY_STABILITY" }
    if ($streak -ge 7)   { return "INITIAL_CHAIN" }
    return "START"
}
function Emit-Ledger($type, $data) {
    $entry = @{ ts = (Get-Date).ToString("o"); type = $type; data = $data }
    Add-Content "$Root\ledger\events.jsonl" ($entry | ConvertTo-Json -Depth 10)
}
function Invoke-StreakObservation($user_id) {
    $streak = Get-Streak $user_id
    $tier = Get-PressureTier $streak
    Emit-Ledger "STREAK_OBSERVED" @{ user_id = $user_id; streak = $streak; tier = $tier }
    Emit-Ledger "SOCIAL_FEED" @{ message = "$user_id streak observed: $streak days ($tier)"; user_id = $user_id }
    return @{ user_id = $user_id; streak = $streak; tier = $tier }
}