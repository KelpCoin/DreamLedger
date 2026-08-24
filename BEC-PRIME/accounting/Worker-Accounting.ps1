# BEC-KINGDOM ACCOUNTING worker
# Safe-by-default orchestration shell. No live payment or tax filing is executed here.
$ErrorActionPreference = 'Stop'
$Silo = 'ACCOUNTING'
$RunId = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$Root = 'D:\BrownEyeCortex'
$ProofDir = Join-Path $Root 'PROOF\ACCOUNTING'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$Result = [ordered]@{
  run_id = $RunId
  silo = $Silo
  status = 'READY'
  capabilities = @('LEDGER_IMPORT','CLASSIFY','RECONCILE','CLOSE','TAX_DRAFT')
  live_payment = 'HUMAN_APPROVAL_REQUIRED'
  tax_filing = 'HUMAN_APPROVAL_REQUIRED'
  public_actions = 'HUMAN_APPROVAL_REQUIRED'
  proof = 'PENDING_LOCAL_EXECUTION'
}
$Json = $Result | ConvertTo-Json -Depth 6
$Path = Join-Path $ProofDir ("accounting-worker-{0}.json" -f $RunId)
$Json | Set-Content -Encoding UTF8 $Path
$Hash = (Get-FileHash -Algorithm SHA256 $Path).Hash
$Result.proof_sha256 = $Hash
$Result | ConvertTo-Json -Depth 6
Write-Output ('ACCOUNTING_WORKER_RUN_ID=' + $RunId)
Write-Output ('PROOF_PATH=' + $Path)
Write-Output ('PROOF_SHA256=' + $Hash)
Write-Output 'STATUS=READY'
