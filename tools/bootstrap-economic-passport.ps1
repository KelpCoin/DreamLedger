[CmdletBinding()]
param(
    [string]$RepoUrl = 'https://github.com/KelpCoin/DreamLedger.git',
    [string]$Branch = 'feat/economic-passport-bootstrap',
    [string]$RepoPath = 'C:\DreamLedger_Actual',
    [string]$DataRoot = 'D:\BrownEyeCortex\EconomicPassport',
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Log([string]$Message) {
    $stamp = (Get-Date).ToString('s')
    Write-Host ('[' + $stamp + '] ' + $Message)
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw ('Required command not found: ' + $Name)
    }
}

Require-Command 'git'
Require-Command 'node'
Require-Command 'npm'

$logDir = Join-Path $DataRoot 'logs'
$proofDir = Join-Path $DataRoot 'proof'
$queueDir = 'D:\BrownEyeCortex\Supervisor\inbox'
New-Item -ItemType Directory -Force -Path $DataRoot, $logDir, $proofDir, $queueDir | Out-Null
$logPath = Join-Path $logDir ('bootstrap-' + (Get-Date).ToString('yyyyMMdd-HHmmss') + '.log')

try {
    Start-Transcript -Path $logPath -Force | Out-Null

    Write-Log 'BEC Economic Passport local bootstrap starting.'
    Write-Log ('Repository: ' + $RepoUrl)
    Write-Log ('Branch: ' + $Branch)
    Write-Log ('Local repo: ' + $RepoPath)
    Write-Log ('Durable data: ' + $DataRoot)

    if (-not (Test-Path (Join-Path $RepoPath '.git'))) {
        if (Test-Path $RepoPath) {
            $items = Get-ChildItem -Force $RepoPath
            if ($items.Count -gt 0) {
                throw ('Target exists and is not an empty Git repository: ' + $RepoPath)
            }
        } else {
            New-Item -ItemType Directory -Force -Path $RepoPath | Out-Null
        }
        Write-Log 'Cloning repository.'
        git clone --branch $Branch $RepoUrl $RepoPath
        if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
    } else {
        Push-Location $RepoPath
        try {
            $status = git status --porcelain
            if ($status) {
                throw 'Local repository has uncommitted changes. Refusing to overwrite them.'
            }
            git fetch origin
            if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
            git checkout $Branch
            if ($LASTEXITCODE -ne 0) { throw 'git checkout failed.' }
            git pull --ff-only origin $Branch
            if ($LASTEXITCODE -ne 0) { throw 'git pull failed.' }
        } finally {
            Pop-Location
        }
    }

    Push-Location $RepoPath
    try {
        if (-not $SkipNpmInstall) {
            Write-Log 'Installing Node dependencies.'
            if (Test-Path 'package-lock.json') {
                npm ci
            } else {
                npm install
            }
            if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed.' }
        }

        Write-Log 'Running Economic Passport verifier.'
        npm run verify:economic-passport
        $verifyExit = $LASTEXITCODE
        if ($verifyExit -ne 0) { throw 'Economic Passport verification failed.' }

        $sourceProof = Join-Path $RepoPath 'BEC-PRIME\economic-passport\proof\EP-SPREADSHEET-RESCUE-001.verification.json'
        if (-not (Test-Path $sourceProof)) { throw 'Expected proof artifact was not produced.' }
        Copy-Item $sourceProof (Join-Path $proofDir 'EP-SPREADSHEET-RESCUE-001.verification.json') -Force

        $commit = (git rev-parse HEAD).Trim()
        $proof = [ordered]@{
            proof_version = '1.0.0'
            generated_at = (Get-Date).ToUniversalTime().ToString('o')
            operation = 'LOCAL_ECONOMIC_PASSPORT_BOOTSTRAP'
            repository = $RepoUrl
            branch = $Branch
            commit = $commit
            local_repo = $RepoPath
            durable_root = $DataRoot
            verifier = 'npm run verify:economic-passport'
            result = 'PASS'
            rules = [ordered]@{
                public_release = 'NOT_PERFORMED'
                revenue_claim = 'NOT_PERFORMED'
                external_sale = 'NOT_PERFORMED'
                destructive_sync = 'NOT_PERFORMED'
            }
        }
        $bootstrapProof = Join-Path $proofDir 'bootstrap-proof.json'
        $proof | ConvertTo-Json -Depth 8 | Set-Content -Encoding ASCII -Path $bootstrapProof

        $jobId = 'BUILD-ECONOMIC-PASSPORT-001'
        $jobPath = Join-Path $queueDir ($jobId + '.json')
        $job = [ordered]@{
            job_id = $jobId
            created_at = (Get-Date).ToUniversalTime().ToString('o')
            request = 'Build and verify Economic Passport primitive.'
            objective = 'Validate one real commercial SKU through passport, resale interpretation, fulfilment, evidence and verification.'
            silo = 'BEC-ECONOMIC-PASSPORT'
            priority = 'P0'
            required_tools = @('git','node','npm')
            approval_required = $false
            execution_status = 'READY'
            expected_output = 'Verified schema, example passport, traversal proof and local workspace.'
            proof_path = $bootstrapProof
            verifier = 'cd C:\DreamLedger_Actual; npm run verify:economic-passport'
        }
        $job | ConvertTo-Json -Depth 8 | Set-Content -Encoding ASCII -Path $jobPath

        Write-Log 'Bootstrap completed successfully.'
        Write-Log ('Proof: ' + $bootstrapProof)
        Write-Log ('Supervisor job: ' + $jobPath)
        Write-Log 'Verifier: cd C:\DreamLedger_Actual; npm run verify:economic-passport'
    } finally {
        Pop-Location
    }
}
catch {
    Write-Log ('BOOTSTRAP FAILED: ' + $_.Exception.Message)
    throw
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
}
