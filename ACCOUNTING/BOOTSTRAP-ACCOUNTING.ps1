#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Root = 'D:\BrownEyeCortex',
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
$Silo = 'ACCOUNTING'
$SiloRoot = Join-Path $Root $Silo
$ProofRoot = Join-Path $Root 'PROOF\ACCOUNTING'
$RunId = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$LogRoot = Join-Path $Root 'LOGS\ACCOUNTING'
$LogPath = Join-Path $LogRoot "bootstrap-$RunId.log"
$ProofPath = Join-Path $ProofRoot "BOOTSTRAP-$RunId.json"

New-Item -ItemType Directory -Force -Path $SiloRoot,$ProofRoot,$LogRoot | Out-Null
Start-Transcript -Path $LogPath -Force | Out-Null

try {
    $dirs = @(
        'agent',
        'clients',
        'intake',
        'exceptions',
        'reports',
        'ledger',
        'mcp',
        'config'
    )

    foreach ($d in $dirs) {
        New-Item -ItemType Directory -Force -Path (Join-Path $SiloRoot $d) | Out-Null
    }

    $config = @{
        silo = $Silo
        status = 'READY_TO_PUBLISH'
        approval_required_for = @(
            'live_financial_changes',
            'tax_filings',
            'public_publication',
            'price_changes'
        )
        automate = @(
            'input_validation',
            'normalization',
            'deduplication',
            'deterministic_calculations',
            'known_rule_classification',
            'reconciliation_matching',
            'draft_report_generation',
            'proof_hashing',
            'metrics'
        )
        skip_for_now = @(
            'kubernetes',
            'custom_mcp_server',
            'tax_filing_automation',
            'multi_jurisdiction',
            'full_ocr_coverage',
            'erp_replacement',
            'marketplace_integration',
            'automated_public_posting'
        )
        revenue_ladder = @(
            @{ sku = 'ACCOUNTING-DIAGNOSTIC'; price_nzd = 29 },
            @{ sku = 'APAR-AUTOMATION'; price_nzd = 149 },
            @{ sku = 'AI-BOOKKEEPING-AGENT'; price_nzd_month = 499 }
        )
    } | ConvertTo-Json -Depth 8

    $ConfigPath = Join-Path $SiloRoot 'config\policy.json'
    Set-Content -Path $ConfigPath -Value $config -Encoding UTF8

    $verifyScript = @'
param([string]$Root = ''D:\BrownEyeCortex'')
$ErrorActionPreference = ''Stop''
$paths = @(
    ''ACCOUNTING\agent'',
    ''ACCOUNTING\clients'',
    ''ACCOUNTING\intake'',
    ''ACCOUNTING\exceptions'',
    ''ACCOUNTING\reports'',
    ''ACCOUNTING\ledger'',
    ''ACCOUNTING\mcp'',
    ''ACCOUNTING\config\policy.json'',
    ''PROOF\ACCOUNTING'',
    ''LOGS\ACCOUNTING''
)
$missing = @()
foreach ($p in $paths) {
    if (-not (Test-Path (Join-Path $Root $p))) { $missing += $p }
}
if ($missing.Count -gt 0) {
    Write-Output ''ACCOUNTING_VERIFY=FAIL''
    Write-Output (''MISSING='' + ($missing -join '',''))
    exit 1
}
Write-Output ''ACCOUNTING_VERIFY=PASS''
Write-Output (''ROOT='' + $Root)
Write-Output ''NO_LIVE_PAYMENT_ACTIONS_PERFORMED=TRUE''
'@

    $VerifyPath = Join-Path $SiloRoot 'VERIFY-ACCOUNTING.ps1'
    Set-Content -Path $VerifyPath -Value $verifyScript -Encoding UTF8

    $proof = @{
        run_id = $RunId
        silo = $Silo
        root = $Root
        status = 'BOOTSTRAPPED'
        verify_command = "powershell -ExecutionPolicy Bypass -File `"$VerifyPath`""
        no_live_payment_actions_performed = $true
        generated_utc = (Get-Date).ToUniversalTime().ToString('o')
    } | ConvertTo-Json -Depth 8

    Set-Content -Path $ProofPath -Value $proof -Encoding UTF8

    Write-Output "ACCOUNTING_BOOTSTRAP=PASS"
    Write-Output "SILO=$Silo"
    Write-Output "PROOF=$ProofPath"
    Write-Output "LOG=$LogPath"
    Write-Output "VERIFY=$VerifyPath"
}
finally {
    Stop-Transcript | Out-Null
}
