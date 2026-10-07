[CmdletBinding()] param([int]$Port=8787,[switch]$Smoke,[switch]$OpenBrowser)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir=Join-Path $Root 'ops\\marketplace\\logs'; New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'; $log=Join-Path $LogDir "trade-marketplace-$stamp.log"
function Log($m){"$(Get-Date -Format o) $m" | Tee-Object -FilePath $log -Append}
Log "START DreamLedger Trade Marketplace local surface"
if(-not (Get-Command node -ErrorAction SilentlyContinue)){throw 'Node.js is required'}
Log "Running repository verifier"
& npm run verify:b2b-marketplace 2>&1 | Tee-Object -FilePath $log -Append
if($LASTEXITCODE -ne 0){Log "Verifier failed"; exit $LASTEXITCODE}
Log "Serving public surface on http://127.0.0.1:$Port"
$listener=New-Object Net.HttpListener; $listener.Prefixes.Add("http://127.0.0.1:$Port/"); $listener.Start()
Log "READY $($listener.Prefixes | Select-Object -First 1)"
if($OpenBrowser){Start-Process "http://127.0.0.1:$Port/marketplace.html"}
try{while($listener.IsListening){$ctx=$listener.GetContext();$path=$ctx.Request.Url.AbsolutePath.TrimStart('/');if([string]::IsNullOrWhiteSpace($path)){$path='marketplace.html'};$file=Join-Path $Root ('public\\'+$path.Replace('/','\\'));if(Test-Path $file -PathType Leaf){$bytes=[IO.File]::ReadAllBytes($file);$ctx.Response.ContentType=if($file.EndsWith('.json')){'application/json'}elseif($file.EndsWith('.html')){'text/html'}else{'application/octet-stream'};$ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)}else{$ctx.Response.StatusCode=404};$ctx.Response.Close();if($Smoke -and $path -eq 'marketplace.html'){break}}}finally{$listener.Stop();Log 'STOP'}
