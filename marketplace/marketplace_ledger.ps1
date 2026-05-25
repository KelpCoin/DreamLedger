# marketplace_ledger.ps1
param($Root = "C:\BrownEyeCortex")
$catalogPath = "$Root\marketplace\catalog.json"
$ledgerPath = "$Root\marketplace\ledger.jsonl"
if (!(Test-Path $catalogPath)) { @{ cartridges = @() } | ConvertTo-Json | Set-Content $catalogPath }
function Get-Catalog {
    return Get-Content $catalogPath -Raw | ConvertFrom-Json
}
function Save-Catalog($data) {
    $data | ConvertTo-Json -Depth 10 | Set-Content $catalogPath -Encoding UTF8
}
function Log-Event($type, $payload) {
    $entry = @{ ts = (Get-Date).ToString("o"); type = $type; payload = $payload }
    Add-Content $ledgerPath ($entry | ConvertTo-Json -Depth 10)
}
function Add-Cartridge {
    param($id, $name, $price_nzd, $owner = "SYSTEM", $royalty_rate = 0.1)
    $cat = Get-Catalog
    $cartridge = @{
        id = $id
        name = $name
        price_nzd = $price_nzd
        owner = $owner
        royalty_rate = $royalty_rate
        status = "LISTED"
        created = (Get-Date).ToString("o")
    }
    $cat.cartridges += $cartridge
    Save-Catalog $cat
    Log-Event "CARTRIDGE_LISTED" $cartridge
    return $cartridge
}
function Buy-Cartridge {
    param($buyer, $cartridge_id)
    $cat = Get-Catalog
    $c = $cat.cartridges | Where-Object { $_.id -eq $cartridge_id -and $_.status -eq "LISTED" }
    if (-not $c) { throw "Cartridge not found or not listed" }
    $price = $c.price_nzd
    $royalty = [math]::Round($price * $c.royalty_rate, 2)
    $seller_cut = $price - $royalty
    $sale = @{
        cartridge_id = $cartridge_id
        buyer = $buyer
        seller = $c.owner
        price = $price
        royalty = $royalty
        seller_cut = $seller_cut
        ts = (Get-Date).ToString("o")
    }
    $c.owner = $buyer
    $c.status = "SOLD"
    Save-Catalog $cat
    Log-Event "CARD_SOLD" $sale
    $globalEvent = @{
        ts = (Get-Date).ToString("o")
        type = "ECONOMIC_EVENT"
        data = @{ event_type = "CARD_SOLD"; buyer = $buyer; seller = $c.owner; price = $price; royalty = $royalty }
    }
    Add-Content "$Root\ledger\events.jsonl" ($globalEvent | ConvertTo-Json -Depth 10)
    $feed = @{
        ts = (Get-Date).ToString("o")
        type = "SOCIAL_FEED"
        data = @{ message = "$buyer purchased $($c.name) from $($c.owner)"; user_id = $buyer }
    }
    Add-Content "$Root\ledger\events.jsonl" ($feed | ConvertTo-Json -Depth 10)
    return $sale
}