$Base = "D:\DreamLedger"
$Revenue = "$Base\Daemon\Revenue"
$Out = "$Base\Site\public\data.json"

$items = @()

Get-ChildItem $Revenue -Filter "rev_*.json" -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $j = Get-Content $_.FullName -Raw | ConvertFrom-Json

        $items += @{
            id = $j.event_id
            title = if ($j.title) { $j.title } else { "Signal " + $j.event_id }
            score = $j.score
            price = if ($j.price) { $j.price } else { 5 }
        }
    } catch {}
}

$items | ConvertTo-Json -Depth 5 | Set-Content $Out -Encoding UTF8
