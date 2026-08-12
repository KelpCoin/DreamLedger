#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$AssetPath = '',
    [string]$ApprovedDir = '',
    [string]$WaitingDir = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-Humaniser {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [string]$Approved = '',
        [string]$Waiting = ''
    )
    if (-not (Test-Path -LiteralPath $Path)) { throw "Asset not found: $Path" }
    $asset = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $signatures = @($asset.human_signatures | Where-Object {
        -not [string]::IsNullOrWhiteSpace([string]$_.reviewer_role) -and
        -not [string]::IsNullOrWhiteSpace([string]$_.timestamp_utc) -and
        -not [string]::IsNullOrWhiteSpace([string]$_.change_summary)
    })
    if ($signatures.Count -lt 2) {
        if ($Waiting) {
            New-Item -ItemType Directory -Force -Path $Waiting | Out-Null
            $target = Join-Path $Waiting ([IO.Path]::GetFileName($Path))
            if ($Path -ne $target) { Move-Item -LiteralPath $Path -Destination $target -Force }
        }
        return [pscustomobject]@{ status='WAITING'; human_signatures=$signatures.Count; required=2; reason='Needs two substantive human footprints' }
    }
    if ($Approved) {
        New-Item -ItemType Directory -Force -Path $Approved | Out-Null
        $target = Join-Path $Approved ([IO.Path]::GetFileName($Path))
        if ($Path -ne $target) { Move-Item -LiteralPath $Path -Destination $target -Force }
    }
    return [pscustomobject]@{ status='PASS'; human_signatures=$signatures.Count; required=2; reason='Two substantive human footprints recorded' }
}

if (-not [string]::IsNullOrWhiteSpace($AssetPath)) {
    Test-Humaniser -Path $AssetPath -Approved $ApprovedDir -Waiting $WaitingDir | ConvertTo-Json -Depth 10
}
