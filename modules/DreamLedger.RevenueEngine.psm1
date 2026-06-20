# DreamLedger.RevenueEngine.psm1
Set-StrictMode -Off; $ErrorActionPreference = 'Continue'
$script:SKU = @{ id='edh-deck'; name='Commander Deck'; price_nzd=15; currency='NZD' }
function Get-RevBasePath { return if ($env:DREAMLEDGER_BASE) { $env:DREAMLEDGER_BASE } else { 'C:\BrownEyeCortex' } }
function Get-LeadsFile { $dir = Join-Path (Get-RevBasePath) '_revenue'; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }; $f = Join-Path $dir 'leads.csv'; if (-not (Test-Path $f)) { 'timestamp,source,lead_id,channel,problem_summary,paid' | Set-Content $f -Encoding UTF8 }; return $f }
function New-DMMessage($Lead) { return "I've got ready-to-play Commander decks for $15 NZD each. Want one? [Stripe Link]" }
Export-ModuleMember -Function New-DMMessage
