$Root = "C:\BrownEyeCortex\DreamLedger"
$InboxFile = "$Root\Inbox\registry_inbox.jsonl"
$Registry = "$Root\sku\registry.json"
$Log = "D:\BrownEyeCortex_Logs\DreamLedger\merge.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $Log "[$timestamp] Merge started"

$existing = @()
if (Test-Path $Registry) {
    try { $existing = Get-Content $Registry | ConvertFrom-Json } catch { $existing = @() }
}

$newItems = @()

if (Test-Path $InboxFile) {
    $lines = Get-Content $InboxFile | Where-Object { $_.Trim().Length -gt 0 }
    foreach ($line in $lines) {
        try {
            $obj = $line | ConvertFrom-Json
            $newItems += $obj
        } catch {
            Add-Content $Log "Bad JSON line skipped: $line"
        }
    }
}

# IDempotent merge (simple key fallback: id or name)
$merged = $existing + $newItems | Group-Object id,name | ForEach-Object { $_.Group[0] }

$merged | ConvertTo-Json -Depth 20 | Set-Content $Registry -Encoding UTF8

# Clear inbox after merge
Clear-Content $InboxFile

Add-Content $Log "[$timestamp] Merge complete. Items: $($merged.Count)"

