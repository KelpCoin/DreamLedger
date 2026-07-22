$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:9090/stripe/")
$listener.Start()
Write-Host "Listening on port 9090..."

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $body = (New-Object System.IO.StreamReader $ctx.Request.InputStream).ReadToEnd()
    $event = $body | ConvertFrom-Json
    if ($event.type -eq 'checkout.session.completed') {
        $session = $event.data.object
        $sku = $session.metadata.sku_id
        $amount = $session.amount_total
        $entry = [ordered]@{
            timestamp = (Get-Date -Format o)
            sku = $sku
            amount_nzd = $amount / 100.0
            payment_intent = $session.payment_intent
            status = 'completed'
        } | ConvertTo-Json -Compress
        Add-Content -Path "C:\BrownEyeCortex\ledger\verified_sales.jsonl" -Value $entry
        Write-Host "SALE CONFIRMED: $sku  NZD $($amount/100.0)" -ForegroundColor Green
    }
    $ctx.Response.StatusCode = 200
    $ctx.Response.Close()
}
