#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = 'C:\BrownEyeCortex\DreamLedger',
    [string]$EvidenceRoot = 'D:\BrownEyeCortex\AgenticTrustWedge'
)

$ErrorActionPreference = 'Stop'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogDir = Join-Path $EvidenceRoot 'Logs'
$ProofDir = Join-Path $EvidenceRoot 'Proof'
$StateDir = Join-Path $EvidenceRoot 'State'
$LogFile = Join-Path $LogDir ('TrustWedge-' + $Stamp + '.log')
$ProofFile = Join-Path $ProofDir ('TRUST-WEDGE-BOOTSTRAP-' + $Stamp + '.json')
$Latest = Join-Path $StateDir 'latest.json'

foreach ($d in @($EvidenceRoot,$LogDir,$ProofDir,$StateDir)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

function Log([string]$Message,[string]$Level='INFO') {
    $line = (Get-Date).ToString('o') + ' [' + $Level + '] ' + $Message
    Add-Content -LiteralPath $LogFile -Value $line -Encoding ASCII
    Write-Host $line
}
function Sha256([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Canonical([object]$Value) {
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [string] -or $Value -is [bool] -or $Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal]) { return ($Value | ConvertTo-Json -Compress) }
    if ($Value -is [System.Collections.IDictionary]) {
        $parts = @()
        foreach ($k in ($Value.Keys | Sort-Object)) { $parts += (($k | ConvertTo-Json -Compress) + ':' + (Canonical $Value[$k])) }
        return '{' + ($parts -join ',') + '}'
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        $parts = @(); foreach ($x in $Value) { $parts += (Canonical $x) }
        return '[' + ($parts -join ',') + ']'
    }
    return Canonical (($Value | ConvertTo-Json -Depth 20 | ConvertFrom-Json))
}

Log '=== AGENTIC TRUST WEDGE MEGABOOTSTRAP ==='
Log 'PowerShell version: ' + $PSVersionTable.PSVersion

$checks = @()
function Check([string]$Name,[bool]$Ok,[string]$Detail) {
    $script:checks += [ordered]@{ name=$Name; status=if($Ok){'PASS'}else{'FAIL'}; detail=$Detail }
    Log ($Name + ': ' + $(if($Ok){'PASS'}else{'FAIL'}) + ' - ' + $Detail) $(if($Ok){'INFO'}else{'ERROR'})
}

if (-not (Test-Path $RepoRoot)) {
    throw 'RepoRoot does not exist: ' + $RepoRoot
}

Set-Location $RepoRoot
Check 'GIT_REPO' ((Test-Path (Join-Path $RepoRoot '.git'))) $RepoRoot
Check 'TRUST_CORE' (Test-Path (Join-Path $RepoRoot 'BEC-PRIME\lib\trustAttestation.js')) 'trustAttestation.js present'
Check 'TRUST_ROUTE' (Test-Path (Join-Path $RepoRoot 'BEC-PRIME\routes\trustAttestation.js')) 'trustAttestation.js route present'
Check 'TRUST_VERIFIER' (Test-Path (Join-Path $RepoRoot 'BEC-PRIME\scripts\verify-trust-attestation.js')) 'deterministic verifier present'
Check 'TRUST_MANIFEST' (Test-Path (Join-Path $RepoRoot 'BEC-PRIME\PROOF-TRUST-ATTESTATION.json')) 'evidence manifest present'

$manifestPath = Join-Path $RepoRoot 'BEC-PRIME\PROOF-TRUST-ATTESTATION.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$evidence = [ordered]@{}
foreach ($p in $manifest.evidence.psobject.Properties) { if ($p.Name -ne 'evidence_hash' -and $p.Name -ne 'signature') { $evidence[$p.Name] = $p.Value } }
$canonical = Canonical $evidence
$calculated = Sha256 $canonical
Check 'EVIDENCE_HASH' ($calculated -eq [string]$manifest.evidence.evidence_hash) ('calculated=' + $calculated)

$node = Get-Command node.exe -ErrorAction SilentlyContinue
Check 'NODE' ($null -ne $node) 'Node.js available for deterministic verifier'

$verifyStatus = 'INSUFFICIENT_EVIDENCE'
if ($node) {
    Push-Location $RepoRoot
    try {
        & node.exe 'BEC-PRIME/scripts/verify-trust-attestation.js'
        if ($LASTEXITCODE -eq 0) { $verifyStatus = 'INSUFFICIENT_EVIDENCE' }
        else { $verifyStatus = 'FAIL' }
    } finally { Pop-Location }
}

$overall = if ($checks.status -contains 'FAIL' -or $verifyStatus -eq 'FAIL') { 'FAIL' } elseif ($manifest.status -eq 'PASS') { 'PASS' } else { 'INSUFFICIENT_EVIDENCE' }

$proof = [ordered]@{
    schema = 'BEC-PRIME/agentic-trust-wedge-bootstrap/v1'
    generated_at = (Get-Date).ToUniversalTime().ToString('o')
    status = $overall
    repo_root = $RepoRoot
    manifest_status = [string]$manifest.status
    calculated_evidence_hash = $calculated
    verifier_status = $verifyStatus
    checks = $checks
    economic_gate = 'NO_EXTERNAL_PAYMENT_PROVEN'
    public_actions = 'APPROVAL_GATED'
    note = 'Deployment may be live while economic verification remains insufficient. PASS requires real external payment evidence and valid signature.'
}

$json = $proof | ConvertTo-Json -Depth 20
Set-Content -LiteralPath $ProofFile -Value $json -Encoding UTF8
Set-Content -LiteralPath $Latest -Value $json -Encoding UTF8
Log 'Proof artifact: ' + $ProofFile
Log 'Latest state: ' + $Latest
Log 'FINAL STATUS: ' + $overall
Write-Host ''
Write-Host '60-SECOND VERIFICATION:' -ForegroundColor Cyan
Write-Host ("powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"{0}`" -RepoRoot `"{1}`" -EvidenceRoot `"{2}`"" -f $PSCommandPath,$RepoRoot,$EvidenceRoot)
Write-Host ('Get-Content "' + $Latest + '" | ConvertFrom-Json | Select-Object status,manifest_status,verifier_status,calculated_evidence_hash')
if ($overall -eq 'FAIL') { exit 1 }
exit 0
