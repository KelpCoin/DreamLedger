$ErrorActionPreference = 'Stop'
$Base = 'https://dreamledger.org'
$OutDir = 'D:\BrownEyeCortex\BEC-PRIME\proofs'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Proof = Join-Path $OutDir ("DREAMMEEZ-ACCOUNT-SURFACE-$Stamp.json")
$Checks = @()
function Add-Check($Name,$Ok,$Detail){$script:Checks += [pscustomobject]@{name=$Name;status=if($Ok){'PASS'}else{'FAIL'};detail=$Detail}}
function Get-Text($Url){$r=Invoke-WebRequest -Uri $Url -Method Get -MaximumRedirection 5 -TimeoutSec 30 -UseBasicParsing;return [pscustomobject]@{status=[int]$r.StatusCode;content=[string]$r.Content}}
try{$r=Get-Text "$Base/";Add-Check 'root' ($r.status -eq 200) ("HTTP " + $r.status)}catch{Add-Check 'root' $false $_.Exception.Message}
try{$r=Get-Text "$Base/login.html";Add-Check 'canonical login page' ($r.status -eq 200 -and $r.content -match '/api/account/login' -and $r.content -match '/api/account/me') ("HTTP " + $r.status)}catch{Add-Check 'canonical login page' $false $_.Exception.Message}
try{$r=Get-Text "$Base/register.html";Add-Check 'canonical register page' ($r.status -eq 200 -and $r.content -match '/api/account/register' -and $r.content -match '/api/account/me') ("HTTP " + $r.status)}catch{Add-Check 'canonical register page' $false $_.Exception.Message}
try{$r=Get-Text "$Base/api/account/me";Add-Check 'anonymous account API' ($r.status -eq 200 -and $r.content -match '"authenticated":false') ("HTTP " + $r.status)}catch{Add-Check 'anonymous account API' $false $_.Exception.Message}
try{$r=Get-Text "$Base/healthz";Add-Check 'healthz' ($r.status -eq 200 -and $r.content -match 'status') ("HTTP " + $r.status)}catch{Add-Check 'healthz' $false $_.Exception.Message}
try{$r=Get-Text "$Base/api/offers";$bad=($r.content -match 'SMALL-BUSINESS-AI-COMMERCE-KIT-001');Add-Check 'placeholder absent' ($r.status -eq 200 -and -not $bad) ("HTTP " + $r.status)}catch{Add-Check 'placeholder absent' $false $_.Exception.Message}
$Overall = -not ($Checks | Where-Object {$_.status -eq 'FAIL'})
$result=[pscustomobject]@{type='dreamledger-account-live-verifier';timestamp=(Get-Date).ToUniversalTime().ToString('o');base=$Base;status=if($Overall){'PASS'}else{'FAIL'};checks=$Checks}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Proof -Encoding UTF8
$result | ConvertTo-Json -Depth 6
if(-not $Overall){exit 1}
