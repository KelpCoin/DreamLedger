#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [string]$ProofRoot = 'D:\BrownEyeCortex\DreamLedger\Proof'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$timestamp = (Get-Date).ToUniversalTime().ToString('o')
$checks = [ordered]@{}
function HasText([string]$Path,[string]$Text) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  return (Get-Content -LiteralPath $Path -Raw) -like ('*' + $Text + '*')
}
$ledger = Join-Path $RepoRoot 'BEC-PRIME\routes\ledger.js'
$editor = Join-Path $RepoRoot 'BEC-PRIME\compiled\website\dream-ledger.html'
$account = Join-Path $RepoRoot 'BEC-PRIME\compiled\website\account.html'
$index = Join-Path $RepoRoot 'BEC-PRIME\compiled\website\index.html'
$template = Join-Path $RepoRoot 'BEC-PRIME\surface\index.v2.template.html'
$contract = Join-Path $RepoRoot 'docs\DREAM-LEDGER-3000-CONTRACT.md'
$checks['canonical_route'] = HasText $ledger '/u/'
$checks['free_create_endpoint'] = HasText $ledger "POST' && p === '/api/ledgers'"
$checks['handle_validation'] = HasText $ledger 'validHandle'
$checks['published_only_public_items'] = HasText $ledger 'published=eq.true'
$checks['owner_edit'] = HasText $ledger '/edit'
$checks['item_creation'] = HasText $ledger '/items$'
$checks['discovery'] = HasText $ledger "p === '/discover'"
$checks['sitemap'] = HasText $ledger "p === '/sitemap.xml'"
$checks['editor_exists'] = Test-Path -LiteralPath $editor
$checks['account_links_ledger'] = HasText $account '/dream-ledger.html'
$checks['frontdoor_links_ledger'] = HasText $index '/dream-ledger.html'
$checks['source_template_links_ledger'] = HasText $template '/dream-ledger.html'
$checks['public_contract'] = Test-Path -LiteralPath $contract
$checks['no_internal_term_in_editor'] = -not (HasText $editor 'BrownEye Cortex')
$checks['no_secret_literal_in_editor'] = -not (HasText $editor 'SUPABASE_SERVICE_ROLE_KEY')
$checks['no_internal_term_in_index'] = -not (HasText $index 'BrownEye Cortex')
$checks['all_required'] = (@($checks.GetEnumerator() | Where-Object { -not $_.Value }).Count -eq 0)
New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null
$proof = [ordered]@{
  type = 'dream-ledger-3000-verification'
  timestamp = $timestamp
  repo_root = $RepoRoot
  status = if ($checks['all_required']) { 'PASS' } else { 'FAIL' }
  checks = $checks
  changed_surfaces = @('free Dream Ledger creation','account entry point','front door entry point','public contract','Windows verifier')
}
$path = Join-Path $ProofRoot 'VERIFICATION-LATEST.json'
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
if (-not $checks['all_required']) { throw "Dream Ledger verification failed. Proof: $path" }
Write-Host ('PASS: Dream Ledger 3000 foundation verified. Proof: ' + $path)
