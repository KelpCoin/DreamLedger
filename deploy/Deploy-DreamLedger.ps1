param(
    [string]$SecretsPath = "C:\BrownEyeCortex\deploy\secrets.json",
    [string]$ConfigPath  = "C:\BrownEyeCortex\deploy\deploy-config.json"
)

if (!(Test-Path $SecretsPath)) { throw "Missing $SecretsPath" }
$secrets = Get-Content $SecretsPath -Raw | ConvertFrom-Json
if (!(Test-Path $ConfigPath)) {
    @{
        localPaths = @{ apiRoot = "C:\BrownEyeCortex\api"; frontendRoot = "C:\BrownEyeCortex\public" }
        repos      = @{ dreamLedger = "https://github.com/KelpCoin/DreamLedger.git" }
        render     = @{ apiBase = "https://api.render.com/v1"; staticSiteName = "dreamledger-org"; apiServiceName = "homarid-api" }
    } | ConvertTo-Json -Depth 5 | Set-Content $ConfigPath -Encoding UTF8
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

$workDir = Join-Path $env:TEMP "dreamledger_deploy"
Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Set-Location $workDir

git clone $config.repos.dreamLedger repo
Set-Location repo
git checkout main

# Create destination directories
$apiDest = "homarid\api"
$frontDest = "homarid\frontend"
foreach ($d in @($apiDest, $frontDest)) {
    if (!(Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

# Copy files properly
Get-ChildItem $config.localPaths.apiRoot -ErrorAction SilentlyContinue | Copy-Item -Destination $apiDest -Recurse -Force
Get-ChildItem $config.localPaths.frontendRoot -ErrorAction SilentlyContinue | Copy-Item -Destination $frontDest -Recurse -Force

# Inject secrets into frontend HTML
Get-ChildItem $frontDest -Filter *.html -Recurse | ForEach-Object {
    $html = Get-Content $_.FullName -Raw
    $html = $html -replace "YOUR_SUPABASE_URL", $secrets.supabase_url
    $html = $html -replace "YOUR_ANON_KEY", $secrets.supabase_anon_key
    $html = $html -replace "REPLACE_ME", "https://$($config.render.staticSiteName).onrender.com"
    Set-Content $_.FullName $html -Force -Encoding UTF8
}

git add .
git commit -m "Deploy DreamLedger [skip ci]"
git push "https://$($secrets.github_token)@github.com/KelpCoin/DreamLedger.git" main

# Render API  validate key first
$renderHeaders = @{ Authorization = "Bearer $($secrets.render_api_key)"; "Content-Type" = "application/json" }
try {
    $owners = Invoke-RestMethod "$($config.render.apiBase)/owners" -Headers $renderHeaders
    $ownerId = $owners[0].owner.id
    Write-Host "Render API key valid  deploying static site..."
} catch {
    Write-Warning "Render API key invalid or unauthorized. Check your secrets.json. Skipping Render deploy."
    exit 0
}

$staticBody = @{
    name        = $config.render.staticSiteName
    ownerId     = $ownerId
    type        = "static_site"
    repo        = $config.repos.dreamLedger
    branch      = "main"
    publishPath = "homarid/frontend"
} | ConvertTo-Json -Depth 4

$existing = Invoke-RestMethod "$($config.render.apiBase)/services?name=$($config.render.staticSiteName)" -Headers $renderHeaders
if ($existing) {
    Invoke-RestMethod "$($config.render.apiBase)/services/$($existing[0].id)" -Method Put -Headers $renderHeaders -Body $staticBody | Out-Null
    Write-Host "Static site updated."
} else {
    Invoke-RestMethod "$($config.render.apiBase)/services" -Method Post -Headers $renderHeaders -Body $staticBody | Out-Null
    Write-Host "Static site created."
}

Write-Host "`nDEPLOY COMPLETE  https://$($config.render.staticSiteName).onrender.com" -ForegroundColor Green

