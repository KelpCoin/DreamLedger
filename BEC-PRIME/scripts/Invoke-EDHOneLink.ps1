param([Parameter(Mandatory=$true)][string]$Url,[string[]]$CompareIds=@())
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$node=Join-Path $repo 'BEC-PRIME\edh\InvokeEDHOneLink.js'
$args=@($node,"--url=$Url")
if($CompareIds.Count -gt 5){throw 'Maximum five comparison IDs are allowed.'}
if($CompareIds.Count -gt 0){$args += "--compare=$($CompareIds -join ',')"}
& node @args
if($LASTEXITCODE -ne 0){throw "EDH pipeline failed with exit code $LASTEXITCODE"}
$proofRoot='D:\BrownEyeCortex\EDHOneLink\proofs'
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
Get-ChildItem (Join-Path $repo 'BEC-PRIME\data\mtg\edh-jobs') -Directory -ErrorAction SilentlyContinue | ForEach-Object { $p=Join-Path $_.FullName 'PROOF.json'; if(Test-Path $p){Copy-Item $p (Join-Path $proofRoot ($_.Name+'.json')) -Force} }
Write-Host 'EDH_ONE_LINK: PASS'
Write-Host 'Proofs: D:\BrownEyeCortex\EDHOneLink\proofs'
Write-Host 'Verifier: node BEC-PRIME\edh\Verify-EDHOneLinkPipeline.js'
