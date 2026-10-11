[CmdletBinding()]
param(
    [string]$RepoPath = 'D:\BrownEyeCortex\CANONICAL\DreamLedger',
    [int]$InferenceTimeoutSeconds = 90
)

# Unified 20-gate operational acceptance run.
# Read-only: no deployments, public posts, Stripe writes, database writes,
# scheduled-task mutations, or synthetic revenue.
$ErrorActionPreference = 'Stop'
$startedUtc = [DateTime]::UtcNow
$stamp = $startedUtc.ToString('yyyyMMddTHHmmssZ')
$proofRoot = if (Test-Path 'D:\') {
    'D:\BrownEyeCortex\proofs\unified-bootstrap'
} else {
    Join-Path $env:USERPROFILE 'BrownEyeCortex\proofs\unified-bootstrap'
}
New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
$reportPath = Join-Path $proofRoot "unified-bootstrap-$stamp.json"
$logPath = Join-Path $proofRoot "unified-bootstrap-$stamp.log"
$results = New-Object System.Collections.Generic.List[object]
$script:RepoPath = $RepoPath
$script:InferenceTimeoutSeconds = $InferenceTimeoutSeconds

function Add-Gate {
    param([int]$Id, [string]$Name, [string]$Status, [object]$Evidence, [string]$NextAction)
    $item = [pscustomobject]@{
        gate = $Id
        name = $Name
        status = $Status
        evidence = $Evidence
        next_action = $NextAction
    }
    $script:results.Add($item)
    Write-Host ('[{0:D2}/20] {1}: {2}' -f $Id, $Name, $Status)
}

function Invoke-HttpProbe {
    param([string]$Url, [int]$TimeoutSeconds = 15)
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSeconds -UseBasicParsing
        return [pscustomobject]@{
            ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
            status_code = [int]$response.StatusCode
            final_url = [string]$response.BaseResponse.ResponseUri.AbsoluteUri
            content_type = [string]$response.Headers['Content-Type']
            bytes = [int]$response.RawContentLength
            error = $null
        }
    } catch {
        return [pscustomobject]@{
            ok = $false
            status_code = $null
            final_url = $Url
            content_type = $null
            bytes = 0
            error = $_.Exception.Message
        }
    }
}

function Invoke-NpmVerifier {
    param([string]$Name)
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        return [pscustomobject]@{ status = 'BLOCKED'; exit_code = $null; output = 'npm not found' }
    }
    Push-Location $script:RepoPath
    try {
        $output = @(& npm run $Name 2>&1 | ForEach-Object { [string]$_ })
        $code = $LASTEXITCODE
        $tail = @($output | Select-Object -Last 25) -join [Environment]::NewLine
        $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
        return [pscustomobject]@{ status = $status; exit_code = $code; output = $tail }
    } catch {
        return [pscustomobject]@{ status = 'FAIL'; exit_code = 1; output = $_.Exception.Message }
    } finally {
        Pop-Location
    }
}

function Get-ModelIds {
    param([string]$BaseUrl)
    try {
        $response = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/v1/models') -TimeoutSec 5
        return @($response.data | ForEach-Object { [string]$_.id } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    } catch {
        return @()
    }
}

function Invoke-ModelInference {
    param([string]$BaseUrl, [string]$Model)
    $body = @{
        model = $Model
        messages = @(@{ role = 'user'; content = 'Reply with exactly FACTORY_HEARTBEAT_OK' })
        temperature = 0
        max_tokens = 24
    } | ConvertTo-Json -Depth 6
    try {
        $response = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/v1/chat/completions') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec $script:InferenceTimeoutSeconds
        $answer = [string]$response.choices[0].message.content
        $ok = $answer -match 'FACTORY_HEARTBEAT_OK'
        return [pscustomobject]@{
            status = $(if ($ok) { 'PASS' } else { 'FAIL' })
            model = $Model
            response = $answer
            error = $null
        }
    } catch {
        return [pscustomobject]@{
            status = 'FAIL'
            model = $Model
            response = $null
            error = $_.Exception.Message
        }
    }
}

try {
    Start-Transcript -LiteralPath $logPath -Force | Out-Null
    Write-Host 'DREAMLEDGER UNIFIED BOOTSTRAP: 20 EXECUTABLE OPERATIONAL GATES'
    Write-Host 'This run is read-only. Operational PASS is not proof of revenue.'

    # 01: Canonical repository
    $repoExists = Test-Path (Join-Path $RepoPath '.git')
    Add-Gate 1 'Canonical repository path' $(if ($repoExists) { 'PASS' } else { 'FAIL' }) @{ path = $RepoPath; exists = $repoExists } 'Use the existing canonical checkout; do not create a parallel clone.'
    if (-not $repoExists) {
        throw "Canonical Git repository not found: $RepoPath. No clone or overwrite was attempted."
    }

    Push-Location $RepoPath
    try {
        $branch = (& git branch --show-current 2>&1 | Out-String).Trim()
        $gitCode1 = $LASTEXITCODE
        $commit = (& git rev-parse HEAD 2>&1 | Out-String).Trim()
        $gitCode2 = $LASTEXITCODE
        $origin = (& git remote get-url origin 2>&1 | Out-String).Trim()
        $gitCode3 = $LASTEXITCODE
        $dirty = @(& git status --porcelain 2>&1 | ForEach-Object { [string]$_ })
        $gitCode4 = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    # 02: Git identity and reproducibility
    $gitOk = ($gitCode1 -eq 0 -and $gitCode2 -eq 0 -and $gitCode3 -eq 0 -and $gitCode4 -eq 0 -and $commit -match '^[0-9a-f]{40}$' -and $origin -match 'KelpCoin/DreamLedger')
    Add-Gate 2 'Git identity and source provenance' $(if ($gitOk) { 'PASS' } else { 'FAIL' }) @{ branch = $branch; commit = $commit; origin = $origin; dirty_count = $dirty.Count; working_tree = $dirty } 'Resolve source/remote errors; review local changes before any future update.'

    # 03: Node/npm
    $nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) { (& node --version 2>&1 | Out-String).Trim() } else { $null }
    $npmVersion = if (Get-Command npm -ErrorAction SilentlyContinue) { (& npm --version 2>&1 | Out-String).Trim() } else { $null }
    $runtimeOk = (-not [string]::IsNullOrWhiteSpace($nodeVersion) -and -not [string]::IsNullOrWhiteSpace($npmVersion))
    Add-Gate 3 'Node and npm runtime' $(if ($runtimeOk) { 'PASS' } else { 'FAIL' }) @{ node = $nodeVersion; npm = $npmVersion } 'Install or repair Node.js/npm only if this gate fails.'

    # 04: Project manifest and dependencies
    $packageJson = Test-Path (Join-Path $RepoPath 'package.json')
    $nodeModules = Test-Path (Join-Path $RepoPath 'node_modules')
    Add-Gate 4 'Package manifest and dependency directory' $(if ($packageJson -and $nodeModules) { 'PASS' } elseif ($packageJson) { 'BLOCKED' } else { 'FAIL' }) @{ package_json = $packageJson; node_modules = $nodeModules } 'If dependencies are missing, inspect the lockfile and run the repository-approved install command deliberately.'

    # 05: GPU telemetry
    $nvidia = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    $gpuText = 'nvidia-smi not found'
    $gpuOk = $false
    if ($nvidia) {
        $gpuOutput = @(& $nvidia.Source --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader 2>&1 | ForEach-Object { [string]$_ })
        $gpuCode = $LASTEXITCODE
        $gpuText = $gpuOutput -join [Environment]::NewLine
        $gpuOk = ($gpuCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($gpuText))
    }
    Add-Gate 5 'Physical GPU telemetry' $(if ($gpuOk) { 'PASS' } else { 'FAIL' }) @{ available = $gpuOk; telemetry = $gpuText } 'If this fails, repair the NVIDIA driver/CLI before treating GPU work as available.'

    # 06: LM Studio API reachability
    $api = if ($env:LMSTUDIO_BASE_URL) { $env:LMSTUDIO_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:1234' }
    $modelIds = @(Get-ModelIds $api)
    $apiOk = ($modelIds.Count -gt 0)
    Add-Gate 6 'LM Studio OpenAI-compatible API' $(if ($apiOk) { 'PASS' } else { 'FAIL' }) @{ base_url = $api; exposed_model_count = $modelIds.Count; models = $modelIds } 'Start the actual LM Studio server and verify its configured port; the script does not guess another port.'

    # 07: Minimum three API-exposed models
    Add-Gate 7 'Three exposed specialist models' $(if ($modelIds.Count -ge 3) { 'PASS' } elseif ($modelIds.Count -eq 0) { 'BLOCKED' } else { 'FAIL' }) @{ required = 3; actual = $modelIds.Count; models = $modelIds } 'Expose the intended specialist models in LM Studio. A model on disk is not the same as a resident/API-exposed model.'

    # 08-10: Real inference against three distinct API-listed models
    $modelResults = @()
    for ($i = 0; $i -lt 3; $i++) {
        $gateId = 8 + $i
        if ($i -lt $modelIds.Count) {
            $test = Invoke-ModelInference $api $modelIds[$i]
            $modelResults += $test
            Add-Gate $gateId ("Live model inference " + ($i + 1)) $test.status @{ model = $test.model; response = $test.response; error = $test.error } 'Check the model identifier, model residency, server logs, and available memory; rerun this same gate after repair.'
        } else {
            Add-Gate $gateId ("Live model inference " + ($i + 1)) 'BLOCKED' @{ required_distinct_model = $i + 1; exposed_model_count = $modelIds.Count } 'Expose another distinct model before this inference gate can run.'
        }
    }

    # 11: Process inventory
    $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match 'LM Studio|lms|node|python|powershell' -and
        $_.CommandLine -match 'BrownEye|DreamLedger|LM Studio|lmstudio|777|Cortex|heartbeat|factory'
    } | Select-Object ProcessId, Name, ExecutablePath, CommandLine)
    Add-Gate 11 'Worker and supervisor process inventory' 'PASS' @{ matching_processes = $processes; count = $processes.Count; inventory_only = $true } 'Review the inventory and reuse one existing supervisor; this script does not start or kill processes.'

    # 12: Scheduled task inventory
    $tasks = @()
    try {
        $tasks = @(Get-ScheduledTask -ErrorAction Stop | Where-Object {
            $_.TaskName -match 'BrownEye|DreamLedger|Cortex|777|Factory|Heartbeat|Autopilot'
        } | ForEach-Object {
            [pscustomobject]@{ task = $_.TaskName; path = $_.TaskPath; state = [string]$_.State }
        })
        $taskInventoryStatus = 'PASS'
    } catch {
        $taskInventoryStatus = 'BLOCKED'
    }
    Add-Gate 12 'Scheduled supervisor inventory' $taskInventoryStatus @{ matching_tasks = $tasks; count = $tasks.Count; mutation = 'none' } 'If task inventory is blocked by permissions, rerun from an authorized shell; no task is created or changed.'

    # 13-15: Real public GET probes
    $home = Invoke-HttpProbe 'https://dreamledger.org/'
    Add-Gate 13 'Public storefront homepage GET' $(if ($home.ok -and $home.status_code -eq 200) { 'PASS' } else { 'FAIL' }) $home 'Inspect the deployed storefront and host response; this test sends no form or purchase.'
    $door = Invoke-HttpProbe 'https://dreamledger.org/go'
    Add-Gate 14 'Canonical distribution doorway GET' $(if ($door.ok) { 'PASS' } else { 'FAIL' }) $door 'Repair the route/redirect and verify the final destination without creating an order.'
    $manifest = Invoke-HttpProbe 'https://dreamledger-silo-gateway.onrender.com/api/toll/v1/manifest'
    Add-Gate 15 'Toll manifest GET' $(if ($manifest.ok -and $manifest.status_code -eq 200) { 'PASS' } else { 'FAIL' }) $manifest 'Repair the public manifest endpoint; a healthy GET does not prove a toll payment.'

    # 16: Compiled artifact
    $compiledIndex = Join-Path $RepoPath 'BEC-PRIME\compiled\website\index.html'
    $compiledOk = Test-Path $compiledIndex
    $compiledEvidence = if ($compiledOk) {
        $file = Get-Item -LiteralPath $compiledIndex
        @{ path = $compiledIndex; bytes = $file.Length; last_write_utc = $file.LastWriteTimeUtc.ToString('o') }
    } else {
        @{ path = $compiledIndex; exists = $false }
    }
    Add-Gate 16 'Compiled storefront artifact' $(if ($compiledOk) { 'PASS' } else { 'FAIL' }) $compiledEvidence 'Build through the repository-approved compiler; do not copy a stale artifact into place to satisfy this gate.'

    # 17-20: Existing repository verifiers, executed rather than inferred
    $v17 = Invoke-NpmVerifier 'verify:silos'
    Add-Gate 17 'Silo boundary verifier' $v17.status $v17 'Fix the reported silo boundary failures, then rerun the verifier.'
    $v18 = Invoke-NpmVerifier 'verify:evidence-manifest'
    Add-Gate 18 'Evidence manifest verifier' $v18.status $v18 'Repair missing/invalid evidence manifest entries, then rerun the verifier.'
    $v19 = Invoke-NpmVerifier 'verify:b2b-marketplace'
    Add-Gate 19 'B2B marketplace contract verifier' $v19.status $v19 'Fix the B2B contract verifier failures, then rerun the verifier.'
    $v20 = Invoke-NpmVerifier 'verify:a2a-marketplace'
    Add-Gate 20 'A2A marketplace contract verifier' $v20.status $v20 'Fix the A2A contract verifier failures, then rerun the verifier.'

    # Commercial truth is recorded separately from the 20 operational gates.
    # File presence or API reachability never proves a buyer or settled payment.
    $stripeStatus = 'BLOCKED_NO_STRIPE_SECRET_KEY'
    $stripeEvidence = 'No Stripe API request made because STRIPE_SECRET_KEY is not present in this process.'
    if (-not [string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY)) {
        try {
            $stripeResponse = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/prices?limit=3&active=true' -Headers @{ Authorization = "Bearer $env:STRIPE_SECRET_KEY" } -TimeoutSec 15
            $stripeStatus = 'API_REACHABLE_NOT_REVENUE'
            $stripeEvidence = @{ active_prices_returned = @($stripeResponse.data).Count; read_only = $true; settlement_proven = $false }
        } catch {
            $stripeStatus = 'FAIL'
            $stripeEvidence = $_.Exception.Message
        }
    }

    $counts = @{
        pass = @($results | Where-Object { $_.status -eq 'PASS' }).Count
        fail = @($results | Where-Object { $_.status -eq 'FAIL' }).Count
        blocked = @($results | Where-Object { $_.status -eq 'BLOCKED' }).Count
    }
    $summary = [ordered]@{
        schema = 'DREAMLEDGER/UNIFIED-BOOTSTRAP-20/v2'
        started_at_utc = $startedUtc.ToString('o')
        completed_at_utc = [DateTime]::UtcNow.ToString('o')
        repository = $RepoPath
        git_branch = $branch
        git_commit = $commit
        origin = $origin
        gates = $results.ToArray()
        counts = $counts
        commercial_truth = @{
            stripe_api_status = $stripeStatus
            stripe_api_evidence = $stripeEvidence
            verified_external_revenue_nzd = 0
            settled_external_payments = 0
            independent_buyers = 0
            paid_fulfilled_orders = 0
            verified_outcomes = 0
            status = 'NOT_PROVEN_BY_OPERATIONAL_BOOTSTRAP'
        }
        safety = @{
            deployments = 0
            public_posts = 0
            stripe_writes = 0
            database_writes = 0
            scheduled_task_mutations = 0
            purchases_or_charges_created = 0
        }
        interpretation = 'All 20 operational gates are executed. PASS applies only to that specific technical check. A green operational report does not create or prove buyer demand, settled revenue, fulfillment, or delivery.'
    }

    $summary | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ''
    Write-Host "REPORT: $reportPath"
    Write-Host "LOG: $logPath"
    Write-Host ("SUMMARY pass={0}; fail={1}; blocked={2}" -f $counts.pass, $counts.fail, $counts.blocked)
    Write-Host 'Commercial truth remains unchanged unless separately reconciled from authoritative evidence.'
} catch {
    $fatal = $_.Exception.Message
    Write-Error ("UNIFIED BOOTSTRAP FAILED CLOSED: " + $fatal)
    try {
        $failure = [ordered]@{
            schema = 'DREAMLEDGER/UNIFIED-BOOTSTRAP-20/v2'
            started_at_utc = $startedUtc.ToString('o')
            failed_at_utc = [DateTime]::UtcNow.ToString('o')
            repository = $RepoPath
            fatal_error = $fatal
            completed_gate_count = $results.Count
            gates = $results.ToArray()
            commercial_truth = @{ verified_external_revenue_nzd = 0; settled_external_payments = 0; independent_buyers = 0; paid_fulfilled_orders = 0; verified_outcomes = 0; status = 'NOT_PROVEN_BY_OPERATIONAL_BOOTSTRAP' }
        }
        $failure | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding UTF8
        Write-Host "PARTIAL REPORT: $reportPath"
    } catch {}
    exit 1
} finally {
    try { Stop-Transcript | Out-Null } catch {}
}
