# PAYMENT-MEMBRANE.ps1 (v3.0  Tamperevident, idempotent, Stripesafe)
$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:8090/")
$http.Start()
$ledger = "C:\BrownEyeCortex\ledger\events.jsonl"
$processedFile = "C:\BrownEyeCortex\ledger\processed_events.jsonl"
function Get-LastLedgerHash {
    if (-not (Test-Path $ledger)) { return "GENESIS" }
    $last = Get-Content $ledger -Tail 1 -ErrorAction SilentlyContinue
    if (-not $last) { return "GENESIS" }
    $obj = $last | ConvertFrom-Json
    return $obj.event_hash
}
function Write-Ledger($entry) {
    $prevHash = Get-LastLedgerHash
    $canonical = $entry | ConvertTo-Json -Compress
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical + $prevHash))
    $eventHash = -join ($hashBytes | ForEach-Object { $_.ToString("x2") })
    $entry | Add-Member -NotePropertyName "prev_hash" -NotePropertyValue $prevHash
    $entry | Add-Member -NotePropertyName "event_hash" -NotePropertyValue $eventHash
    $entry | ConvertTo-Json -Compress | Add-Content $ledger -Encoding UTF8
}
function Test-StripeSignature($payload, $sigHeader, $secret) {
    $parts = $sigHeader -split ','
    $t = ($parts | Where-Object { $_ -like "t=*" }) -replace "t=", ""
    $v1 = ($parts | Where-Object { $_ -like "v1=*" }) -replace "v1=", ""
    if ([int](Get-Date -UFormat %s) - [int]$t -gt 300) { return $false }
    $signedPayload = "$t.$payload"
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($signedPayload))
    $computed = ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
    return $computed -eq $v1
}
while ($http.IsListening) {
    $ctx = $http.GetContext()
    $body = (New-Object IO.StreamReader($ctx.Request.InputStream)).ReadToEnd()
    $sig = $ctx.Request.Headers["Stripe-Signature"]
    $eventObj = $body | ConvertFrom-Json
    $eventId = $eventObj.id
    # Idempotency (appendonly processed log)
    $already = Select-String -Path $processedFile -Pattern $eventId -SimpleMatch -Quiet
    if ($already) {
        $ctx.Response.StatusCode = 200; $ctx.Response.Close(); continue
    }
    $valid = Test-StripeSignature $body $sig $env:STRIPE_WEBHOOK_SECRET
    if (-not $valid) {
        Write-Host " Invalid Stripe signature"
        $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue
    }
    if ($eventObj.type -eq "checkout.session.completed") {
        $entry = [PSCustomObject]@{
            event = "ENTITLEMENT_GRANTED"
            source = "MSL"
            eventId = $eventId
            playerId = $eventObj.data.object.metadata.playerId
            productId = $eventObj.data.object.metadata.productId
            timestamp = (Get-Date -Format o)
        }
        Write-Ledger $entry
        Add-Content $processedFile $eventId -Encoding UTF8
        Write-Host " Secure entitlement granted: $eventId"
    }
    $ctx.Response.StatusCode = 200; $ctx.Response.Close()
}
