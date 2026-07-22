param([Parameter(Mandatory)] [string]$DispatchId)
. 'C:\BrownEyeCortex\modules\Foundation\bin\Foundation.Common.ps1'
$r = Get-RootMap
$pending = Join-Path $r.module_data_root 'DistributionLayer\approvals\pending'
$approved = Join-Path $r.module_data_root 'DistributionLayer\approvals\done'
$file = Get-ChildItem -Path $pending -Filter "dispatch_$DispatchId.json" | Select-Object -First 1
if ($null -eq $file) { Write-Host "Dispatch not found in pending."; exit 1 }
$dispatch = Read-JsonFile -Path $file.FullName
$dispatch.approved = $true
Write-JsonFile -Path (Join-Path $approved $file.Name) -InputObject $dispatch
Remove-Item -LiteralPath $file.FullName -Force
Write-Host "Dispatch $DispatchId approved and moved to done."