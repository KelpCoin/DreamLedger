param($Root = "C:\BrownEyeCortex", $Port = 8080)
. "$Root\kernel\api_gate.ps1"
. "$Root\marketplace\marketplace_ledger.ps1"

Add-Type -AssemblyName System.Web
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

$www = "$Root\runtime\www"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = $req.Url.AbsolutePath

    # Static files (including carousel.html, seller.html)
    if ($path -match "\.(html|css|js|png|jpg|svg)$") {
        $file = Join-Path $www ($path -replace '^/', '')
        if (Test-Path $file) {
            $ext = [IO.Path]::GetExtension($file)
            $mime = switch ($ext) {
                '.html' { 'text/html' }
                '.css'  { 'text/css' }
                '.js'   { 'application/javascript' }
                '.png'  { 'image/png' }
                '.jpg'  { 'image/jpeg' }
                '.svg'  { 'image/svg+xml' }
                default { 'application/octet-stream' }
            }
            $bytes = [IO.File]::ReadAllBytes($file)
            $res.ContentType = $mime
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else { $res.StatusCode = 404 }
        $res.Close()
        continue
    }

    # API routing
    $body = $null
    if ($req.HttpMethod -eq "POST" -and $req.ContentLength64 -gt 0) {
        $reader = New-Object IO.StreamReader($req.InputStream)
        $raw = $reader.ReadToEnd()
        $reader.Close()
        $body = $raw | ConvertFrom-Json
        $ht = @{}
        if ($body) { $body.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value } }
        $body = $ht
    }

    $result = $null
    try {
        switch ($path) {
            "/market/list" {
                $result = Add-Cartridge -id $body.cartridge_id -name $body.name -price_nzd $body.price_nzd -owner $body.seller_id -royalty_rate $body.royalty_percent
            }
            "/market/get"  { $result = Get-Catalog }
            "/market/buy"  { $result = Buy-Cartridge -buyer $body.buyer_id -cartridge_id $body.card_id }
            "/state"       { $result = Invoke-CortexGate -action "GET_STATE" }
            "/feed"        {
                $tail = Get-Content "$Root\ledger\events.jsonl" -Tail 500
                $result = @($tail | ForEach-Object { try { $_ | ConvertFrom-Json } catch {} } | Where-Object { $_.type -eq "SOCIAL_FEED" } | Select-Object -Last 50)
            }
            default        { $result = @{ error = "Not found" } }
        }
    } catch {
        $result = @{ error = $_.Exception.Message }
        $res.StatusCode = 500
    }

    $json = $result | ConvertTo-Json -Depth 10
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $res.ContentType = "application/json"
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
}
