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
    $params = @{ Method=$Method; Uri=$Uri; Headers=$headers; TimeoutSec=60 }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
    return Invoke-RestMethod @params
}

function Wait-RenderConvergence {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$ExpectedSha,
        [string]$BaseUrl = 'https://dreamledger.org',
        [int]$MaxAttempts = 30,
        [int]$RetrySeconds = 10
    )
    $url = $BaseUrl.TrimEnd('/') + '/version'
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
            $data = $resp.Content | ConvertFrom-Json
            $sha = [string]$data.commit
            Write-Host "CONVERGENCE $i/$MaxAttempts HTTP=$($resp.StatusCode) SHA=$sha" -ForegroundColor Yellow
            if ($sha -eq $ExpectedSha) {
                return [pscustomobject]@{ converged=$true; sha=$sha; attempts=$i; http_status=[int]$resp.StatusCode; data=$data }
            }
        } catch {
            Write-Host "CONVERGENCE $i/$MaxAttempts PENDING: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
        if ($i -lt $MaxAttempts) { Start-Sleep -Seconds $RetrySeconds }
    }
    return [pscustomobject]@{ converged=$false; sha=''; attempts=$MaxAttempts; http_status=0; data=$null }
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
        [switch]$VerifyMoneyPath,
        [string]$BaseUrl = 'https://dreamledger.org',
        [int]$TimeoutMinutes = 20,
        [int]$RetrySeconds = 10,
        [string]$ProofDirectory = 'D:\DreamLedger\PROOFS\Render'
    )

    $ErrorActionPreference = 'Stop'
    $ApiKey = Get-RenderApiKey -ApiKey $ApiKey
    if ([string]::IsNullOrWhiteSpace($CommitSha)) { $CommitSha = Get-GitCommitSha -RepositoryPath $RepositoryPath }

    $body = @{ clearCache = if ($ClearCache) { 'clear' } else { 'do_not_clear' }; commitId = $CommitSha }
    New-Item -ItemType Directory -Force -Path $ProofDirectory | Out-Null
    $deployUri = "https://api.render.com/v1/services/$ServiceId/deploys"

    Write-Host 'Render deploy' -ForegroundColor Cyan
    Write-Host "Service : $ServiceId"
    Write-Host "Commit  : $CommitSha"
    Write-Host "Cache   : $(if ($ClearCache) { 'CLEAR' } else { 'KEEP' })"

    $deploy = Invoke-RenderApi -Method Post -Uri $deployUri -ApiKey $ApiKey -Body $body
    Write-Host "DEPLOY_ACCEPTED: $($deploy.id)" -ForegroundColor Green

    $result = [ordered]@{
        schema='dreamledger-render-deploy-proof-v2'
        checked_at_utc=(Get-Date).ToUniversalTime().ToString('o')
        service_id=$ServiceId
        requested_commit=$CommitSha
        deploy_id=[string]$deploy.id
        initial_status=[string]$deploy.status
        clear_cache=[bool]$ClearCache
        base_url=$BaseUrl
        production_commit=''
        production_http=0
        production_status=''
        production_converged=$false
        money_path_verified=$false
        deploy_completed=$false
        pass=$false
        error=''
    }

    if ($WaitForProduction) {
        $maxAttempts = [Math]::Max(1, [int][Math]::Ceiling(($TimeoutMinutes * 60) / $RetrySeconds))
        $convergence = Wait-RenderConvergence -ExpectedSha $CommitSha -BaseUrl $BaseUrl -MaxAttempts $maxAttempts -RetrySeconds $RetrySeconds
        $result.production_converged = $convergence.converged
        $result.production_commit = $convergence.sha
        $result.production_http = $convergence.http_status
        if ($convergence.data) { $result.production_status = [string]$convergence.data.status }
        $result.deploy_completed = $convergence.converged
        if (-not $convergence.converged) { $result.error = 'Production did not converge to the requested commit within the timeout.' }
    }

    if ($VerifyMoneyPath -and $result.production_converged) {
        try {
            $money = Test-MTGMoneyPath -BaseUrl $BaseUrl -ExpectedCommit $CommitSha -ProofDirectory $ProofDirectory
            $result.money_path_verified = $money.pass
            if (-not $money.pass) { $result.error = 'MTG money path verification failed.' }
        } catch {
            $result.money_path_verified = $false
            $result.error = $_.Exception.Message
        }
    }

    $result.pass = if ($WaitForProduction) { $result.production_converged -and ((-not $VerifyMoneyPath) -or $result.money_path_verified) } else { $false }
    $stamp=(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $path=Join-Path $ProofDirectory "RenderDeploy-$stamp.json"
    $result | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $path -Encoding UTF8
    $result | ConvertTo-Json -Depth 15
    Write-Host "PROOF: $path" -ForegroundColor Cyan
    if (($WaitForProduction -or $VerifyMoneyPath) -and -not $result.pass) { throw ($result.error) }
    return [pscustomobject]$result
}

function Test-RenderProduction {
    [CmdletBinding()]
    param(
        [string]$BaseUrl='https://dreamledger.org',
        [Parameter(Mandatory=$true)][string]$ExpectedCommit,
        [switch]$VerifyMoneyPath,
        [string]$ProofDirectory='D:\DreamLedger\PROOFS\Render'
    )
    $ErrorActionPreference='Stop'
    New-Item -ItemType Directory -Force -Path $ProofDirectory | Out-Null
    $checks=@(); $failures=New-Object System.Collections.Generic.List[string]
    foreach ($route in @('/','/healthz','/version','/mtg','/api/mtg/configurator/decks','/api/mtg/configurator/decks/EDH_0001')) {
        try {
            $r=Invoke-WebRequest -UseBasicParsing -Uri ($BaseUrl.TrimEnd('/')+$route) -TimeoutSec 20
            $ok=([int]$r.StatusCode -eq 200)
            $checks += [pscustomobject]@{route=$route;method='GET';status=[int]$r.StatusCode;pass=$ok}
            if (-not $ok) { $failures.Add($route) }
        } catch {
            $checks += [pscustomobject]@{route=$route;method='GET';status=0;pass=$false;error=$_.Exception.Message}
            $failures.Add($route)
        }
    }
    try {
        $version=Invoke-RestMethod -Uri ($BaseUrl.TrimEnd('/')+'/version') -TimeoutSec 20
    } catch { $version=$null }
    $deployedCommit=if($version){[string]$version.commit}else{''}
    $shaMatch=($deployedCommit -eq $ExpectedCommit)
    if(-not $shaMatch){$failures.Add('version.commit')}
    $money=$null
    if($VerifyMoneyPath){
        try {$money=Test-MTGMoneyPath -BaseUrl $BaseUrl -ExpectedCommit $ExpectedCommit -ProofDirectory $ProofDirectory; if(-not $money.pass){$failures.Add('mtg.money_path')}}
        catch {$failures.Add('mtg.money_path'); $money=[pscustomobject]@{pass=$false;error=$_.Exception.Message}}
    }
    $pass=($failures.Count -eq 0)
    $proof=[ordered]@{schema='dreamledger-render-production-proof-v2';checked_at_utc=(Get-Date).ToUniversalTime().ToString('o');base_url=$BaseUrl;expected_commit=$ExpectedCommit;deployed_commit=$deployedCommit;sha_match=$shaMatch;checks=$checks;money_path=$money;failures=@($failures);pass=$pass}
    $path=Join-Path $ProofDirectory ('RenderTruth-{0}.json' -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
    $proof|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $path -Encoding UTF8
    $proof|ConvertTo-Json -Depth 20
    Write-Host "PROOF: $path" -ForegroundColor Cyan
    if(-not $pass){throw 'Render production verification failed.'}
    return [pscustomobject]$proof
}

function Test-MTGMoneyPath {
    [CmdletBinding()]
    param(
        [string]$BaseUrl='https://dreamledger.org',
        [Parameter(Mandatory=$true)][string]$ExpectedCommit,
        [string]$DeckId='EDH_0001',
        [string]$ProofDirectory='D:\DreamLedger\PROOFS\Render'
    )
    $ErrorActionPreference='Stop'
    New-Item -ItemType Directory -Force -Path $ProofDirectory | Out-Null
    $base=$BaseUrl.TrimEnd('/'); $checks=@(); $failures=New-Object System.Collections.Generic.List[string]
    foreach($route in @('/healthz','/version','/mtg','/api/mtg/configurator/decks',('/api/mtg/configurator/decks/'+$DeckId))) {
        try{$r=Invoke-WebRequest -UseBasicParsing -Uri ($base+$route) -TimeoutSec 20;$ok=([int]$r.StatusCode -eq 200);$checks += [pscustomobject]@{route=$route;method='GET';status=[int]$r.StatusCode;pass=$ok};if(-not $ok){$failures.Add($route)}}
        catch{$checks += [pscustomobject]@{route=$route;method='GET';status=0;pass=$false;error=$_.Exception.Message};$failures.Add($route)}
    }
    try {
        $decks=Invoke-RestMethod -Uri ($base+'/api/mtg/configurator/decks') -TimeoutSec 20
        $deck=if($decks.decks){@($decks.decks)|Where-Object{$_.deck_id -eq $DeckId}|Select-Object -First 1}else{$null}
        $ok=$null -ne $deck
        $checks += [pscustomobject]@{route='/api/mtg/configurator/decks';method='GET_VALIDATE';status=200;pass=$ok;deck_id=$DeckId;deck_status=if($deck){[string]$deck.testing_status}else{''}}
        if(-not $ok){$failures.Add('deck.list.'+$DeckId)}
    } catch {$checks += [pscustomobject]@{route='/api/mtg/configurator/decks';method='GET_VALIDATE';status=0;pass=$false;error=$_.Exception.Message};$failures.Add('deck.list')}
    try {
        $detail=Invoke-RestMethod -Uri ($base+'/api/mtg/configurator/decks/'+$DeckId) -TimeoutSec 20
        $ok=([string]$detail.deck_id -eq $DeckId -and [int]$detail.base_price_minor -gt 0 -and [string]$detail.currency -eq 'NZD' -and $null -ne $detail.customization)
        $checks += [pscustomobject]@{route='/api/mtg/configurator/decks/'+$DeckId;method='GET_VALIDATE';status=200;pass=$ok;currency=[string]$detail.currency;base_price_minor=[int]$detail.base_price_minor}
        if(-not $ok){$failures.Add('deck.detail.'+$DeckId)}
        $payload=@{land_package=[string]$detail.defaults.land_package;flex_slots=@();premium_upgrades=@()}
        $priceResp=Invoke-WebRequest -UseBasicParsing -Method Post -Uri ($base+'/api/mtg/configurator/decks/'+$DeckId+'/price') -ContentType 'application/json' -Body ($payload|ConvertTo-Json -Depth 10) -TimeoutSec 20
        $priceData=$priceResp.Content|ConvertFrom-Json
        $priceOk=([int]$priceResp.StatusCode -eq 200 -and [int]$priceData.pricing.total_minor -gt 0)
        $checks += [pscustomobject]@{route='/api/mtg/configurator/decks/'+$DeckId+'/price';method='POST';status=[int]$priceResp.StatusCode;pass=$priceOk;total_minor=if($priceData.pricing){[int]$priceData.pricing.total_minor}else{0}}
        if(-not $priceOk){$failures.Add('price.'+$DeckId)}
    } catch {$checks += [pscustomobject]@{route='/api/mtg/configurator/decks/'+$DeckId+'/price';method='POST';status=0;pass=$false;error=$_.Exception.Message};$failures.Add('price.'+$DeckId)}
    $version=$null;try{$version=Invoke-RestMethod -Uri ($base+'/version') -TimeoutSec 20}catch{}
    $sha=if($version){[string]$version.commit}else{''};$shaMatch=($sha -eq $ExpectedCommit);if(-not $shaMatch){$failures.Add('version.commit')}
    $pass=($failures.Count -eq 0)
    $proof=[ordered]@{schema='dreamledger-mtg-money-path-proof-v1';checked_at_utc=(Get-Date).ToUniversalTime().ToString('o');base_url=$BaseUrl;deck_id=$DeckId;expected_commit=$ExpectedCommit;deployed_commit=$sha;sha_match=$shaMatch;checks=$checks;failures=@($failures);pass=$pass;revenue_nzd=0;first_payment='NOT_PROVEN'}
    $path=Join-Path $ProofDirectory ('MTGMoneyPath-{0}.json' -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
    $proof|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $path -Encoding UTF8
    $proof|ConvertTo-Json -Depth 20
    Write-Host "PROOF: $path" -ForegroundColor Cyan
    return [pscustomobject]$proof
}

Export-ModuleMember -Function Invoke-RenderDeploy, Test-RenderProduction, Test-MTGMoneyPath, Wait-RenderConvergence, Get-GitCommitSha
