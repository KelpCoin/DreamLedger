#requires -Version 5.1
Set-StrictMode -Version Latest

function ConvertTo-PlainText {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)][Security.SecureString]$SecureString)
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Get-RenderApiKey {
    [CmdletBinding()]
    param([string]$ApiKey)
    if (-not [string]::IsNullOrWhiteSpace($ApiKey)) { return $ApiKey }
    if (-not [string]::IsNullOrWhiteSpace($env:RENDER_API_KEY)) { return $env:RENDER_API_KEY }
    return ConvertTo-PlainText (Read-Host 'Render API key' -AsSecureString)
}

function Get-GitCommitSha {
    [CmdletBinding()]
    param([string]$RepositoryPath = (Get-Location).Path)
    $sha = (& git -C $RepositoryPath rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($sha)) {
        throw "Unable to determine Git commit SHA at $RepositoryPath"
    }
    return $sha.Trim()
}

function Invoke-RenderApi {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Method,
        [Parameter(Mandatory=$true)][string]$Uri,
        [Parameter(Mandatory=$true)][string]$ApiKey,
        [object]$Body
    )
    $headers = @{
        Authorization = "Bearer $ApiKey"
        Accept = 'application/json'
        'Content-Type' = 'application/json'
    }
    $params = @{
        Method = $Method
        Uri = $Uri
        Headers = $headers
        TimeoutSec = 60
    }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
    return Invoke-RestMethod @params
}

function Invoke-RenderDeploy {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$ServiceId,
        [string]$ApiKey = '',
        [string]$RepositoryPath = (Get-Location).Path,
        [string]$CommitSha = '',
        [switch]$ClearCache,
        [switch]$WaitForProduction,
        [string]$BaseUrl = 'https://dreamledger.org',
        [int]$TimeoutMinutes = 20,
        [string]$ProofDirectory = 'D:\DreamLedger\PROOFS\Render'
    )

    $ErrorActionPreference = 'Stop'
    $ApiKey = Get-RenderApiKey -ApiKey $ApiKey
    if ([string]::IsNullOrWhiteSpace($CommitSha)) { $CommitSha = Get-GitCommitSha -RepositoryPath $RepositoryPath }

    $body = @{
        clearCache = if ($ClearCache) { 'clear' } else { 'do_not_clear' }
        commitId = $CommitSha
    }

    New-Item -ItemType Directory -Force -Path $ProofDirectory | Out-Null
    $started = (Get-Date).ToUniversalTime()
    $deployUri = "https://api.render.com/v1/services/$ServiceId/deploys"

    Write-Host "Render deploy" -ForegroundColor Cyan
    Write-Host "Service : $ServiceId"
    Write-Host "Commit  : $CommitSha"
    Write-Host "Cache   : $(if ($ClearCache) { 'CLEAR' } else { 'KEEP' })"
    Write-Host ""

    $deploy = Invoke-RenderApi -Method Post -Uri $deployUri -ApiKey $ApiKey -Body $body
    Write-Host "DEPLOY_ACCEPTED: $($deploy.id)" -ForegroundColor Green
    Write-Host "STATUS: $($deploy.status)"

    $result = [ordered]@{
        schema = 'dreamledger-render-deploy-proof-v1'
        checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
        service_id = $ServiceId
        requested_commit = $CommitSha
        deploy_id = [string]$deploy.id
        initial_status = [string]$deploy.status
        clear_cache = [bool]$ClearCache
        base_url = $BaseUrl
        production_commit = ''
        production_http = 0
        production_status = ''
        production_converged = $false
        deploy_completed = $false
        pass = $false
        error = ''
    }

    if ($WaitForProduction) {
        $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
        do {
            Start-Sleep -Seconds 10
            try {
                $versionResponse = Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl.TrimEnd('/') + '/version') -TimeoutSec 20
                $result.production_http = [int]$versionResponse.StatusCode
                $version = $versionResponse.Content | ConvertFrom-Json
                $result.production_commit = [string]$version.commit
                $result.production_status = [string]$version.status
                Write-Host "VERSION: HTTP $($result.production_http) commit=$($result.production_commit)" -ForegroundColor Yellow
                if ($result.production_commit -eq $CommitSha) {
                    $result.production_converged = $true
                    $result.deploy_completed = $true
                    $result.pass = $true
                    break
                }
            } catch {
                Write-Host "VERSION_CHECK_PENDING: $($_.Exception.Message)" -ForegroundColor DarkYellow
            }
        } while ((Get-Date) -lt $deadline)

        if (-not $result.pass) {
            $result.error = 'Production did not converge to the requested commit within the timeout.'
        }
    }

    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $path = Join-Path $ProofDirectory "RenderDeploy-$stamp.json"
    $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
    $result | ConvertTo-Json -Depth 10
    Write-Host "PROOF: $path" -ForegroundColor Cyan

    if ($WaitForProduction -and -not $result.pass) { throw $result.error }
    return [pscustomobject]$result
}

function Test-RenderProduction {
    [CmdletBinding()]
    param(
        [string]$BaseUrl = 'https://dreamledger.org',
        [Parameter(Mandatory=$true)][string]$ExpectedCommit,
        [string]$ProofDirectory = 'D:\DreamLedger\PROOFS\Render'
    )

    $ErrorActionPreference = 'Stop'
    New-Item -ItemType Directory -Force -Path $ProofDirectory | Out-Null
    $checks = @()
    $failures = New-Object System.Collections.Generic.List[string]

    foreach ($path in @('/healthz','/version','/api/mtg/configurator/decks')) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl.TrimEnd('/') + $path) -TimeoutSec 20
            $ok = ([int]$r.StatusCode -eq 200)
            $checks += [pscustomobject]@{ path=$path; status=[int]$r.StatusCode; pass=$ok }
            if (-not $ok) { $failures.Add($path) }
        } catch {
            $checks += [pscustomobject]@{ path=$path; status=0; pass=$false; error=$_.Exception.Message }
            $failures.Add($path)
        }
    }

    $version = $null
    try { $version = Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/') + '/version') -TimeoutSec 20 } catch {}
    $deployedCommit = if ($version) { [string]$version.commit } else { '' }
    $shaMatch = $deployedCommit -eq $ExpectedCommit
    if (-not $shaMatch) { $failures.Add('version.commit') }

    $pass = ($failures.Count -eq 0)
    $proof = [ordered]@{
        schema='dreamledger-render-production-proof-v1'
        checked_at_utc=(Get-Date).ToUniversalTime().ToString('o')
        base_url=$BaseUrl
        expected_commit=$ExpectedCommit
        deployed_commit=$deployedCommit
        sha_match=$shaMatch
        checks=$checks
        failures=@($failures)
        pass=$pass
    }
    $path = Join-Path $ProofDirectory ("RenderTruth-{0}.json" -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
    $proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $path -Encoding UTF8
    $proof | ConvertTo-Json -Depth 10
    Write-Host "PROOF: $path" -ForegroundColor Cyan
    if (-not $pass) { throw 'Render production verification failed.' }
    return [pscustomobject]$proof
}

Export-ModuleMember -Function Invoke-RenderDeploy, Test-RenderProduction, Get-GitCommitSha
