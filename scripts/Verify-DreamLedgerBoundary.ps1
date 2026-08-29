param([string]$BaseUrl='https://dreamledger.org',[string]$ExpectedSha='')
$ErrorActionPreference='Continue'
$ProofRoot='D:\BrownEyeCortex\PROOF'; if(-not(Test-Path $ProofRoot)){New-Item -ItemType Directory -Force -Path $ProofRoot|Out-Null}
$Stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$ProofFile=Join-Path $ProofRoot "DreamLedger-Boundary-$Stamp.json"
$PrivateRoutes=@('/gauntlet','/elohim','/trust-engine','/ip','/portfolio','/BEC-PRIME','/distribution','/compiler','/internal','/admin','/debug')
$Sensitive=@('/.env','/.env.local','/package.json','/package-lock.json','/app.map','/main.map','/bundle.js.map','/app.log','/events.jsonl')
$Commercial=@('/','/billboard')
$Forbidden=@('BEC-PRIME','Economic Court','Trust Engine','QUARANTINED_NO_FULFILLMENT','CONTROL-PLANE','GAUNTLET')
function Get-Http([string]$Path){$u=$BaseUrl.TrimEnd('/')+$Path;try{$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop;return [pscustomobject]@{status=[int]$r.StatusCode;body=[string]$r.Content;error=$null}}catch [System.Net.WebException]{return [pscustomobject]@{status=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0};body='';error=$_.Exception.Message}}catch{return [pscustomobject]@{status=0;body='';error=$_.Exception.Message}}}
function IsBlocked($r){return $r.status -in 403,404}
$R=[ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');base_url=$BaseUrl;expected_sha=$ExpectedSha;private_routes=@{};sensitive_files=@{};commercial_paths=@{};content=@{};deployment_revision=@{};overall='FAIL'}
foreach($p in $PrivateRoutes){$x=Get-Http $p;$ok=IsBlocked $x;$R.private_routes[$p]=@{status=$x.status;blocked=$ok;error=$x.error}}
foreach($p in $Sensitive){$x=Get-Http $p;$ok=IsBlocked $x;$R.sensitive_files[$p]=@{status=$x.status;blocked=$ok;error=$x.error}}
foreach($p in $Commercial){$x=Get-Http $p;$ok=$x.status -eq 200;$R.commercial_paths[$p]=@{status=$x.status;ok=$ok;error=$x.error};if($ok){$hits=@();foreach($t in $Forbidden){if($x.body -match [regex]::Escape($t)){$hits+=$t}};$R.content[$p]=@{clean=($hits.Count -eq 0);forbidden=$hits}}else{$R.content[$p]=@{clean=$false;forbidden=@('PAGE_UNAVAILABLE')}}}
$v=Get-Http '/version';$sha='';$versionOk=$false;if($v.status -eq 200){try{$d=$v.body|ConvertFrom-Json;$sha=[string]$d.commit;$versionOk=($sha -ne '' -and $sha -ne 'unknown' -and ($ExpectedSha -eq '' -or $sha -eq $ExpectedSha))}catch{$versionOk=$false}};$R.deployment_revision=@{status=$v.status;commit=$sha;expected=$ExpectedSha;ok=$versionOk;error=$v.error}
$privateOk=($R.private_routes.Values|Where-Object{-not $_.blocked}).Count -eq 0;$filesOk=($R.sensitive_files.Values|Where-Object{-not $_.blocked}).Count -eq 0;$commerceOk=($R.commercial_paths.Values|Where-Object{-not $_.ok}).Count -eq 0;$contentOk=($R.content.Values|Where-Object{-not $_.clean}).Count -eq 0
if($privateOk -and $filesOk -and $commerceOk -and $contentOk -and $versionOk){$R.overall='PASS'}
$R|ConvertTo-Json -Depth 12|Set-Content -Path $ProofFile -Encoding ASCII;$Hash=(Get-FileHash $ProofFile -Algorithm SHA256).Hash
Write-Host "BOUNDARY_PROOF: $($R.overall)";Write-Host "Proof: $ProofFile";Write-Host "SHA256: $Hash";if($R.overall -ne 'PASS'){exit 1}
