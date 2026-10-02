#Requires -Version 5.1
[CmdletBinding()]
param([string]$Server='http://127.0.0.1:1234',[switch]$SelfTest)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root='D:\\BrownEyeCortex\\ARTIFACTS\\DOMINO-04'
New-Item -ItemType Directory -Force -Path $root | Out-Null
$env:LM_STUDIO_SERVER=$Server
$env:PS_VERSION=$PSVersionTable.PSVersion.ToString()
Push-Location (Join-Path $PSScriptRoot '..')
try {
  if($SelfTest){node .\\autonomy\\council-benchmark\\source-grounded-council.js --self-test}
  else {node .\\autonomy\\council-benchmark\\source-grounded-council.js}
  $exit=$LASTEXITCODE
} finally {Pop-Location}
$proof=Join-Path $root 'PROOF\\DOMINO04-LATEST.json'
Write-Host ('PROOF='+$proof)
if(Test-Path $proof){Get-Content $proof -Raw}
exit $exit
