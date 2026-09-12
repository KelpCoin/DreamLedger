[CmdletBinding()]
param(
    [string]$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git',
    [string]$Branch = 'feat/economic-passport-bootstrap',
    [string]$RepoPath = 'C:\DreamLedger_Actual',
    [string]$PassportRoot = 'D:\BrownEyeCortex\EconomicPassport',
    [string]$SupervisorRoot = 'D:\BrownEyeCortex\Supervisor',
    [string]$SupervisorRuntime = 'C:\BrownEyeCortex\Supervisor',
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Log([string]$Message) { Write-Host ('[' + (Get-Date).ToString('s') + '] ' + $Message) }
function Require-Command([string]$Name) { if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw ('Required command not found: ' + $Name) } }
function Ensure-Dir([string]$Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Write-AsciiJson([string]$Path, $Object) { Ensure-Dir (Split-Path -Parent $Path); $Object | ConvertTo-Json -Depth 20 | Set-Content -Encoding ASCII -Path $Path }

Require-Command 'git'
Require-Command 'node'
Require-Command 'npm'
Require-Command 'powershell'

$logDir = Join-Path $PassportRoot 'logs'
$proofDir = Join-Path $PassportRoot 'proof'
$queueDir = Join-Path $SupervisorRoot 'inbox'
$supervisorProofDir = Join-Path $SupervisorRoot 'proofs'
Ensure-Dir $PassportRoot; Ensure-Dir $logDir; Ensure-Dir $proofDir; Ensure-Dir $queueDir; Ensure-Dir $supervisorProofDir; Ensure-Dir $SupervisorRuntime
$logPath = Join-Path $logDir ('bootstrap-' + (Get-Date).ToString('yyyyMMdd-HHmmss') + '.log')

try {
    Start-Transcript -Path $logPath -Force | Out-Null
    Write-Log 'BEC local bootstrap starting.'
    Write-Log ('Repository: ' + $RepoUrl)
    Write-Log ('Branch: ' + $Branch)
    Write-Log ('Repo: ' + $RepoPath)
    Write-Log ('Passport data: ' + $PassportRoot)
    Write-Log ('Supervisor data: ' + $SupervisorRoot)

    if (-not (Test-Path (Join-Path $RepoPath '.git'))) {
        if (Test-Path $RepoPath) {
            $items = @(Get-ChildItem -Force $RepoPath)
            if ($items.Count -gt 0) { throw ('Target exists and is not an empty Git repository: ' + $RepoPath) }
        } else { Ensure-Dir $RepoPath }
        git clone --branch $Branch $RepoUrl $RepoPath
        if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
    } else {
        Push-Location $RepoPath
        try {
            $status = git status --porcelain
            if ($status) { throw 'Local repository has uncommitted changes. Refusing to overwrite them.' }
            git fetch origin
            if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
            git checkout $Branch
            if ($LASTEXITCODE -ne 0) { throw 'git checkout failed.' }
            git pull --ff-only origin $Branch
            if ($LASTEXITCODE -ne 0) { throw 'git pull failed.' }
        } finally { Pop-Location }
    }

    Push-Location $RepoPath
    try {
        if (-not $SkipNpmInstall) {
            if (Test-Path 'package-lock.json') { npm ci } else { npm install }
            if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed.' }
        }
        npm run verify:economic-passport
        if ($LASTEXITCODE -ne 0) { throw 'Economic Passport verification failed.' }

        $sourceProof = Join-Path $RepoPath 'BEC-PRIME\economic-passport\proof\EP-SPREADSHEET-RESCUE-001.verification.json'
        if (-not (Test-Path $sourceProof)) { throw 'Expected Passport proof was not produced.' }
        Copy-Item $sourceProof (Join-Path $proofDir 'EP-SPREADSHEET-RESCUE-001.verification.json') -Force

        $commit = (git rev-parse HEAD).Trim()
        $bootstrapProof = Join-Path $proofDir 'bootstrap-proof.json'
        Write-AsciiJson $bootstrapProof ([ordered]@{
            proof_version='1.0.0'; generated_at=(Get-Date).ToUniversalTime().ToString('o'); operation='LOCAL_BEC_BOOTSTRAP'; repository=$RepoUrl; branch=$Branch; commit=$commit; local_repo=$RepoPath; passport_root=$PassportRoot; supervisor_root=$SupervisorRoot; result='PASS'; public_release='NOT_PERFORMED'; revenue_claim='NOT_PERFORMED'; external_sale='NOT_PERFORMED'
        })

        $supervisorSource = Join-Path $RepoPath 'BEC-PRIME\supervisor\Supervisor.ps1'
        $jobSchemaSource = Join-Path $RepoPath 'BEC-PRIME\supervisor\job.schema.json'
        $proofSchemaSource = Join-Path $RepoPath 'BEC-PRIME\supervisor\proof.schema.json'
        foreach ($p in @($supervisorSource,$jobSchemaSource,$proofSchemaSource)) { if (-not (Test-Path $p)) { throw ('Missing Supervisor component: ' + $p) } }
        Copy-Item $supervisorSource (Join-Path $SupervisorRuntime 'Supervisor.ps1') -Force
        Copy-Item $jobSchemaSource (Join-Path $SupervisorRuntime 'job.schema.json') -Force
        Copy-Item $proofSchemaSource (Join-Path $SupervisorRuntime 'proof.schema.json') -Force

        $jobId = 'BUILD-ECONOMIC-PASSPORT-001'
        $jobPath = Join-Path $queueDir ($jobId + '.json')
        if (-not (Test-Path $jobPath)) {
            Write-AsciiJson $jobPath ([ordered]@{
                job_id=$jobId; created_at=(Get-Date).ToUniversalTime().ToString('o'); request='Build and verify Economic Passport primitive.'; objective='Validate one real commercial SKU through passport, resale interpretation, fulfilment, evidence and verification.'; silo='BEC-ECONOMIC-PASSPORT'; priority='P0'; required_tools=@('git','node','npm'); approval_required=$false; execution_status='READY'; expected_output='Verified schema, example passport, traversal proof and local workspace.'; proof_path=(Join-Path $supervisorProofDir ($jobId + '.json')); verifier='npm run verify:economic-passport'; command='npm run verify:economic-passport'
            })
        }

        $taskName = 'BEC Supervisor'
        $taskCommand = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $SupervisorRuntime 'Supervisor.ps1') + '"'
        schtasks.exe /Create /TN $taskName /TR $taskCommand /SC MINUTE /MO 5 /F | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Could not create BEC Supervisor scheduled task.' }

        Write-Log 'Running one Supervisor tick now.'
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $SupervisorRuntime 'Supervisor.ps1')
        if ($LASTEXITCODE -ne 0) { throw 'Supervisor initial tick failed.' }

        Write-Log 'BOOTSTRAP PASS.'
        Write-Log ('Bootstrap proof: ' + $bootstrapProof)
        Write-Log ('Supervisor card: ' + (Join-Path $SupervisorRoot 'CURRENT_NEXT.txt'))
        Write-Log ('Supervisor task: ' + $taskName + ' every 5 minutes')
        Write-Log 'Verifier: cd C:\DreamLedger_Actual; npm run verify:economic-passport'
    } finally { Pop-Location }
}
catch {
    Write-Log ('BOOTSTRAP FAILED: ' + $_.Exception.Message)
    throw
}
finally { try { Stop-Transcript | Out-Null } catch {} }
