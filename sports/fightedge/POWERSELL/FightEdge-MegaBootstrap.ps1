#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = 'C:\BrownEyeCortex\Silos\FIGHTEDGE'
$Proof = 'D:\BrownEyeCortex\FIGHTEDGE\Proof'
$Log = 'D:\BrownEyeCortex\FIGHTEDGE\Logs'
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

$Dirs = @(
  $Root,$Proof,$Log,
  "$Root\Config","$Root\Registry","$Root\Evidence","$Root\Punditry",
  "$Root\Market","$Root\Thesis","$Root\Outcome","$Root\Oracle",
  "$Root\Gauntlet","$Root\Products","$Root\Public","$Root\Private","$Root\Bets"
)
$Dirs | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }

# Clone the proven MTG silo shape only. Do not copy MTG content or buyers.
$masterPattern = @{
  master_silo='MTG'; inheritance='STRUCTURE_ONLY'
  content_inheritance=$false; domain_mixing=$false; public_surface='FIGHTEDGE'
} | ConvertTo-Json -Depth 5
$masterPattern | Set-Content "$Root\Registry\master-pattern.json" -Encoding ASCII

# Internal configuration. Never publish this file.
$config = @{
  module='FIGHTEDGE'; version='1.1'; domain='combat_sports'; initial_focus='UFC'
  expansion=@('boxing','kickboxing','grappling','combat_sports')
  auto_wager=$false; public_release_requires_approval=$true
  live_financial_action_requires_approval=$true; evidence_first=$true
  source_truth='Truth Oracle'; challenge_layer='Gauntlet'; contract_kernel='CUBE'
  public_language_mode='CLEAN'
  public_internal_terms_forbidden=@(
    'CUBE','Cortex','Elohim','Gauntlet','Truth Oracle','DreamLedger',
    'FIGHTEDGE_INTERNAL','commerce_cells','economic_silo_loops','service_role'
  )
} | ConvertTo-Json -Depth 8
$config | Set-Content "$Root\Private\module.json" -Encoding ASCII

# Public identity. Deliberately free of internal architecture language.
$public = @{
  brand='Fight Edge'
  focus='UFC and combat sports'
  description='Evidence-led fight information, analysis, discussion and historical context.'
  sections=@('UFC','Boxing','Fighters','Events','Results','Analysis','Discussion')
  betting_content='Optional research context only. No guarantees.'
  public_release=$true
} | ConvertTo-Json -Depth 8
$public | Set-Content "$Root\Public\identity.json" -Encoding ASCII

# Freeze the actual user-entered wager as an internal test record.
$bet = @{
  bet_id='FE-BET-20260927-LH-SUB-001'
  recorded_utc=$Stamp
  bookmaker='Betcha'
  stake_nzd=20.00
  stake_type='BONUS_CASH'
  selection='Luis Hernandez'
  market='WIN_BY_SUBMISSION'
  expected_return_nzd=32.00
  cash_profit_if_settled_as_expected_nzd=12.00
  status='OPEN'
  note='Real wager entered by user. Do not count as Fight Edge revenue or product performance.'
} | ConvertTo-Json -Depth 8
$bet | Set-Content "$Root\Bets\FE-BET-20260927-LH-SUB-001.json" -Encoding ASCII

# Freeze the reasoning before the result.
$thesis = @{
  thesis_id='FE-THESIS-20260927-LH-SUB-001'
  recorded_utc=$Stamp
  event='UFC Vegas 121: Luis Hernandez vs Sedriques Dumas'
  selection='Luis Hernandez'; method='Submission'
  supporting_points=@(
    'User thesis: 63 percent of Hernandez wins by submission.',
    'Opponent entered on a documented losing or winless skid.',
    'Dumas has documented submission losses.'
  )
  counterpoints=@(
    'Short-notice turnaround for Hernandez.',
    'Dumas has major height and reach advantages.',
    'Dumas has documented knockout power.'
  )
  excluded_evidence=@(
    'Appearance-based judgments',
    'Unverified drug-use speculation',
    'Claims without a source'
  )
  frozen=$true
} | ConvertTo-Json -Depth 8
$thesis | Set-Content "$Root\Thesis\FE-THESIS-20260927-LH-SUB-001.json" -Encoding ASCII

# Hard public-surface contamination check.
$publicText = Get-Content "$Root\Public\identity.json" -Raw
$forbidden=@(
  'CUBE','Cortex','Elohim','Gauntlet','Truth Oracle','DreamLedger',
  'FIGHTEDGE_INTERNAL','commerce_cells','economic_silo_loops','service_role'
)
$hits=@($forbidden | Where-Object { $publicText -match [regex]::Escape($_) })
if($hits.Count -gt 0){ throw "PUBLIC_SURFACE_CONTAMINATED: $($hits -join ',')" }

# Optional binding to one existing unused commerce cell.
# The service-role key is read only from an environment variable and is never printed or stored.
$remoteStatus='NOT_ATTEMPTED'
$cellId=$null
$supabaseUrl=$env:FIGHTEDGE_SUPABASE_URL
$supabaseKey=$env:FIGHTEDGE_SUPABASE_SERVICE_ROLE_KEY

if($supabaseUrl -and $supabaseKey){
  try {
    $headers=@{
      apikey=$supabaseKey
      Authorization="Bearer $supabaseKey"
      'Content-Type'='application/json'
    }

    $uri="$supabaseUrl/rest/v1/commerce_cells?select=cell_id,silo,name,state&or=(silo.is.null,silo.eq.)&limit=1"
    $rows=@(Invoke-RestMethod -Method Get -Uri $uri -Headers $headers)

    if($rows.Count -gt 0){
      $cellId=$rows[0].cell_id
      $patch=@{
        silo='FIGHTEDGE'; name='Fight Edge'; state='ACTIVE'; acquisition_state='RESEARCH'
        approval_required=$true; verified_checkout=$false
        verified_fulfillment=$false; verified_webhook=$false
        metadata=@{
          public_brand='Fight Edge'; domain='combat_sports'
          initial_focus='UFC'; public_language_mode='CLEAN'
        }
      } | ConvertTo-Json -Depth 8
      $patchUri="$supabaseUrl/rest/v1/commerce_cells?cell_id=eq.$cellId"
      Invoke-RestMethod -Method Patch -Uri $patchUri -Headers $headers -Body $patch | Out-Null
      $remoteStatus='CELL_BOUND'
    } else {
      $remoteStatus='NO_UNUSED_CELL_FOUND'
    }
  } catch {
    $remoteStatus="REMOTE_BIND_ERROR: $($_.Exception.Message)"
  }
}

$proof=@{
  proof_id="FIGHTEDGE-BOOT-$Stamp"; module='FIGHTEDGE'; created_utc=$Stamp
  root=$Root; proof_dir=$Proof; log_dir=$Log; status='BOOTSTRAP_READY'
  master_pattern='MTG_STRUCTURE_ONLY'; public_surface='CLEAN'
  remote_cell_status=$remoteStatus; remote_cell_id=$cellId
  wager_recorded=$true; auto_wager=$false
  public_release_requires_approval=$true
  note='Local scaffold and pre-event wager record only. This script does not place wagers.'
}

$proofPath="$Proof\$($proof.proof_id).json"
$proofJson=$proof | ConvertTo-Json -Depth 8
$proofJson | Set-Content $proofPath -Encoding ASCII
"[$Stamp] FIGHTEDGE bootstrap complete: $proofPath" | Add-Content "$Log\bootstrap.log" -Encoding ASCII

Write-Host 'FIGHTEDGE READY'
Write-Host "Proof: $proofPath"
Write-Host "Remote cell: $remoteStatus"
Write-Host "Verify: Get-Content '$proofPath' | ConvertFrom-Json | Format-List"
