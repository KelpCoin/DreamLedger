# Log-Sale.ps1
function Write-Sale {
    param($ProductId, $ProductName, $Price, $Currency, $Source="stripe")
    $entry = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        product_id = $ProductId
        product_name = $ProductName
        price = $Price
        currency = $Currency
        source = $Source
    }
    $entry | ConvertTo-Json -Compress | Add-Content "C:\BrownEyeCortex\ledger\sales.jsonl" -Encoding UTF8
}
Export-ModuleMember -Function Write-Sale
