# http_bridge.ps1  Minimal HTTP listener for Cortex (PS 5.1)
param($Root = "C:\BrownEyeCortex", $Port = 8080)

. "$Root\runtime\api_gate.ps1"

function ConvertTo-Hashtable {
    param($obj)
    if ($null -eq $obj) { return @{} }
    if ($obj -is [System.Collections.IDictionary]) { return $obj }
    $hash = @{}
    foreach ($prop in $obj.PSObject.Properties) {
        $value = $prop.Value
        if ($value -is [PSCustomObject]) { $value = ConvertTo-Hashtable $value }
        elseif ($value -is [Array]) {
            $value = @($value | ForEach-Object {
                if ($_ -is [PSCustomObject]) { ConvertTo-Hashtable $_ } else { $_ }
            })
        }
        $hash[$prop.Name] = $value
    }
    return $hash
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")
$listener.Start()
Write-Host "Cortex HTTP bridge running on port $Port"

$wwwRoot = "$Root\runtime\www"
if (!(Test-Path $wwwRoot)) { New-Item -ItemType Directory -Path $wwwRoot -Force | Out-Null }

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.AbsolutePath

    if ($path -eq "/seller.html") {
        $file = Join-Path $wwwRoot "seller.html"
        if (Test-Path $file) {
            $html = Get-Content $file -Raw
            $bytes = [Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentType = "text/html"
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
        continue
    }

    $body = $null
    if ($request.HttpMethod -eq "POST") {
        $reader = New-Object System.IO.StreamReader($request.InputStream)
        $raw = $reader.ReadToEnd()
        $body = $raw | ConvertFrom-Json
        if ($body -is [PSCustomObject]) { $body = ConvertTo-Hashtable $body }
    } elseif ($request.HttpMethod -eq "GET") {
        $body = @{}
        $request.QueryString.AllKeys | ForEach-Object { $body[$_] = $request.QueryString[$_] }
    }

    $actionMap = @{
        "/state"            = "GET_STATE"
        "/land/buy"         = "BUY_LAND"
        "/boss/state"       = "GET_BOSS_STATE"
        "/boss/defeat"      = "BOSS_DEFEAT"
        "/kelpcoin/transfer"= "TRANSFER_KELPCOIN"
        "/market/list"      = "LIST_CARD"
        "/market/get"       = "GET_MARKETPLACE"
        "/market/buy"       = "BUY_CARD"
    }

    if ($path -eq "/feed") {
        $tail = Get-Content "$Root\ledger\events.jsonl" -Tail 2000 -ErrorAction SilentlyContinue
        $feed = $tail | ForEach-Object {
            try { $_ | ConvertFrom-Json } catch { $null }
        } | Where-Object { $_.type -eq "SOCIAL_FEED" } | Select-Object -Last 50
        $json = $feed | ConvertTo-Json
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        $response.ContentType = "application/json"
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
        continue
    }

    $action = $actionMap[$path]
    if ($action) {
        $result = Invoke-CortexGate -action $action -body $body
        $json = $result | ConvertTo-Json
        $bytes = [Text.Encoding]::UTF8.GetBytes($json)
        $response.ContentType = "application/json"
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
