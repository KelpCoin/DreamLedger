#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)][string]$ServiceId = '',
    [Parameter(Mandatory=$false)][string]$ApiKey = '',
    [Parameter(Mandatory=$false)][string]$CommitSha = '',
    [Parameter(Mandatory=$false)][string]$RepositoryPath = (Get-Location).Path,
    [switch]$ClearCache,
    [switch]$WaitForProduction,
    [switch]$VerifyMoneyPath,
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
$modulePath = Join-Path $PSScriptRoot '..\ops\RenderDeploy.psm1'
Import-Module $modulePath -Force

if ([string]::IsNullOrWhiteSpace($ServiceId)) {
    if (-not [string]::IsNullOrWhiteSpace($env:RENDER_SERVICE_ID)) {
        $ServiceId = $env:RENDER_SERVICE_ID
    } else {
        $ServiceId = Read-Host 'Render service ID (srv-...)'
    }
}

if ([string]::IsNullOrWhiteSpace($CommitSha)) {
    $CommitSha = Get-GitCommitSha -RepositoryPath $RepositoryPath
}

if ($VerifyOnly) {
    Test-RenderProduction -ExpectedCommit $CommitSha -VerifyMoneyPath:$VerifyMoneyPath
    exit 0
}

Invoke-RenderDeploy -ServiceId $ServiceId -ApiKey $ApiKey -RepositoryPath $RepositoryPath -CommitSha $CommitSha -ClearCache:$ClearCache -WaitForProduction:$WaitForProduction -VerifyMoneyPath:$VerifyMoneyPath
