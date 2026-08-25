#requires -Version 5.1
[CmdletBinding()]
param([string]$BaseUrl='https://dreamledger.org')
$ErrorActionPreference='Stop'
$checks=@()
function Check([string]$Name,[bool]$Pass,[string]$Detail){$script:checks += [pscustomobject]@{Name=$Name;Pass=$Pass;Detail=$Detail}}
function Get-Text([string]$Url){(Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20).Content}
try{$x=Get-Text "$BaseUrl/billboard";Check 'GLOBAL_ROUTE' ($x -match 'NZ\$50' -and $x -match 'Founding Tile') 'canonical billboard surface'}catch{Check 'GLOBAL_ROUTE' $false $_.Exception.Message}
foreach($m in @('nz','au','za','americas','europe')){try{$x=Get-Text "$BaseUrl/billboard/$m";Check "ROUTE_$($m.ToUpper())" ($x -match 'Choose the audience' -and $x -match 'Founding Tile') "regional route $m"}catch{Check "ROUTE_$($m.ToUpper())" $false $_.Exception.Message}}
try{$r=Invoke-WebRequest -Uri "$BaseUrl/api/molt-beach-inventory?market=NZ" -UseBasicParsing -TimeoutSec 20;$j=$r.Content|ConvertFrom-Json;Check 'NZ_INVENTORY_API' ($r.StatusCode -eq 200 -and $j.market -eq 'NZ') 'market-scoped inventory API'}catch{Check 'NZ_INVENTORY_API' $false $_.Exception.Message}
try{$r=Invoke-WebRequest -Uri "$BaseUrl/board" -MaximumRedirection 0 -UseBasicParsing -ErrorAction Stop;Check 'LEGACY_BOARD_REDIRECT' $false 'expected redirect, received success'}catch{$code=$_.Exception.Response.StatusCode.value__;Check 'LEGACY_BOARD_REDIRECT' ($code -in 301,308) "status $code"}
$pass=($checks.Pass -notcontains $false)
$out=[ordered]@{status=if($pass){'PASS'}else{'BLOCKED'};checked_at=(Get-Date).ToString('o');base_url=$BaseUrl;checks=$checks}
$out|ConvertTo-Json -Depth 5
if(-not $pass){exit 1}
