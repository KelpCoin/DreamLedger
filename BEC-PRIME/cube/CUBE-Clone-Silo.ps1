param(
    [Parameter(Mandatory=$true)][ValidateSet('mtg','crypto','media_music','digital_products')][string]$SiloName,
    [Parameter(Mandatory=$true)][string]$ProductName,
    [Parameter(Mandatory=$true)][ValidateRange(1,1000000)][decimal]$PriceNZD,
    [Parameter(Mandatory=$true)][string]$StripeProductId,
    [Parameter(Mandatory=$true)][string]$TargetRepo,
    [string]$SourceRepo = 'KelpCoin/DreamLedger',
    [string]$TargetRoot = 'D:\BrownEyeCortex\CUBE-Clones',
    [switch]$CreateRemote,
    [switch]$Push
)
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $TargetRoot $SiloName
$proofDir = Join-Path $work 'proofs'
$proof = Join-Path $proofDir "CUBE-CLONE-$SiloName-$stamp.json"
New-Item -ItemType Directory -Force -Path $work,$proofDir | Out-Null

function Need([string]$cmd) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Required command missing: $cmd" } }
Need 'git'
Need 'gh'

if ($TargetRepo -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'TargetRepo must be owner/name' }
if ($SiloName -eq 'dreamledger') { throw 'DreamLedger is neutral and cannot be cloned as a silo' }

$sourceDir = Join-Path $work '_source'
if (Test-Path $sourceDir) { Remove-Item -Recurse -Force $sourceDir }
git clone --depth 1 "https://github.com/$SourceRepo.git" $sourceDir | Out-Null

$forbidden = @('.env','.env.*','BEC-PRIME/catalog/ip-capabilities.json','secrets','private','proofs/private')
foreach ($rel in $forbidden) {
    $matches = Get-ChildItem -Path $sourceDir -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.FullName.Substring($sourceDir.Length).TrimStart('\') -like $rel }
    if ($matches) { throw "Forbidden source material detected: $rel" }
}

$keep = @('package.json','package-lock.json','render.yaml','index.html','public','web','server.js','BEC-PRIME/surface','BEC-PRIME/compiler','BEC-PRIME/lib','BEC-PRIME/start.js')
$targetFiles = @()
foreach ($rel in $keep) {
    $src = Join-Path $sourceDir $rel
    if (Test-Path $src) {
        $dest = Join-Path $work $rel
        New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
        Copy-Item -Recurse -Force $src $dest
        $targetFiles += $rel
    }
}

$configDir = Join-Path $work 'silo'
New-Item -ItemType Directory -Force $configDir | Out-Null
$config = [ordered]@{
    schema_version='CUBE-SILO-CONFIG-1.0'
    silo_id=$SiloName
    product_name=$ProductName
    price_nzd=[double]$PriceNZD
    stripe_product_id=$StripeProductId
    source_engine=$SourceRepo
    neutral_host='DreamLedger'
    isolation=@{catalog=$true; checkout=$true; analytics=$true; customer_data=$true; content=$true; promotion=$true; credentials=$true}
    status='generated_not_deployed'
}
$config | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $configDir 'silo.json')

$readme = @"
# CUBE silo: $SiloName

Product: $ProductName
Price NZD: $PriceNZD
Stripe product: $StripeProductId

This clone is silo-scoped. Do not import another silo's catalog, customer data, credentials, content, analytics, or promotion.
DreamLedger remains the neutral shared substrate.

Generated: $(Get-Date -Format o)
"@
$readme | Set-Content -Encoding UTF8 (Join-Path $work 'README.md')

if ($CreateRemote) {
    gh repo create $TargetRepo --private --source $work --remote origin --push | Out-Null
} else {
    Push-Location $work
    try {
        git init -b main | Out-Null
        git remote remove origin 2>$null
        git remote add origin "https://github.com/$TargetRepo.git"
        git add .
        git commit -m "CUBE: initialize $SiloName silo" | Out-Null
        if ($Push) { git push -u origin main | Out-Null }
    } finally { Pop-Location }
}

$proofObj = [ordered]@{schema_version='CUBE-CLONE-PROOF-1.0'; status='PASS'; generated_utc=(Get-Date).ToUniversalTime().ToString('o'); silo=$SiloName; target_repo=$TargetRepo; product=$ProductName; price_nzd=[double]$PriceNZD; stripe_product_id=$StripeProductId; source_repo=$SourceRepo; forbidden_paths_checked=$forbidden; copied_paths=$targetFiles; remote_created=[bool]$CreateRemote; pushed=[bool]$Push; public_activation='NOT_CLAIMED'}
$proofObj | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $proof
Remove-Item -Recurse -Force $sourceDir
Write-Host "[PASS] CUBE clone generated: $work"
Write-Host "[PROOF] $proof"
