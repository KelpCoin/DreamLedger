#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = 'C:\BrownEyeCortex\Silos\FIGHTEDGE'
$Proof = 'D:\BrownEyeCortex\FIGHTEDGE\Proof'
$Log = 'D:\BrownEyeCortex\FIGHTEDGE\Logs'
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
@($Root,$Proof,$Log,"$Root\Config","$Root\Registry","$Root\Evidence","$Root\Punditry","$Root\Market","$Root\Thesis","$Root\Outcome","$Root\Oracle","$Root\Gauntlet","$Root\Products") | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
$config = @{ module='FIGHTEDGE'; version='1.0'; auto_wager=$false; public_release_requires_approval=$true; live_financial_action_requires_approval=$true; evidence_first=$true; source_truth='Truth Oracle'; challenge_layer='Gauntlet'; contract_kernel='CUBE' } | ConvertTo-Json -Depth 5
$config | Set-Content -Path "$Root\Config\module.json" -Encoding ASCII
$proof = @{ proof_id="FIGHTEDGE-BOOT-$Stamp"; module='FIGHTEDGE'; created_utc=$Stamp; root=$Root; proof_dir=$Proof; log_dir=$Log; status='BOOTSTRAP_READY'; auto_wager=$false; note='Local scaffold only. No wager or public release performed.' } | ConvertTo-Json -Depth 5
$proofPath = "$Proof\$($proof.proof_id).json"
$proof | Set-Content -Path $proofPath -Encoding ASCII
"[$Stamp] FIGHTEDGE bootstrap complete: $proofPath" | Add-Content -Path "$Log\bootstrap.log" -Encoding ASCII
Write-Host 'FIGHTEDGE READY'
Write-Host "Proof: $proofPath"
Write-Host "Verify: Get-Content '$proofPath' | ConvertFrom-Json | Format-List"