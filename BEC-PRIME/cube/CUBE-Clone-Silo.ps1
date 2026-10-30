param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z][a-z0-9_-]{1,48}$')][string]$SiloName,
  [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$ProductName,
  [Parameter(Mandatory=$true)][ValidateRange(1,1000000)][decimal]$PriceNZD,
  [string]$StripeProductId = '',
  [string]$TargetRepo = '',
  [string]$SourceRepo = 'KelpCoin/DreamLedger',
  [string]$TargetRoot = 'D:\BrownEyeCortex\CUBE-Clones',
  [switch]$CreateRemote,
  [switch]$Push
)
$ErrorActionPreference = 'Stop'
# CUBE assembles an inert candidate. Gauntlet and owner authorize later operations.
if ($CreateRemote -or $Push) { throw 'PUBLIC_ACTIVATION_HELD: clone generation cannot create/push repositories or trigger deployment' }
if ($SiloName -in @('mtg','dreamledger')) { throw 'Reserved master or neutral host slug' }
if ($SourceRepo -ne 'KelpCoin/DreamLedger') { throw 'Only canonical source repo is permitted' }
if ($TargetRepo -and $TargetRepo -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Invalid TargetRepo' }
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cssSource = Join-Path $repoRoot 'public\assets\silo-master.css'
if (!(Test-Path -LiteralPath $cssSource)) { throw 'Missing approved master stylesheet' }
$target = Join-Path $TargetRoot $SiloName
if (Test-Path -LiteralPath $target) { throw "Target already exists; refusing overwrite: $target" }
$publicRoot = Join-Path $target 'public'
$pageDir = Join-Path $publicRoot $SiloName
$dataDir = Join-Path $publicRoot 'data'
$manifestDir = Join-Path $publicRoot "silos\$SiloName"
$assetDir = Join-Path $publicRoot 'assets'
$proofDir = Join-Path $target 'proofs'
@($pageDir,$dataDir,$manifestDir,$assetDir,$proofDir) | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
Copy-Item -LiteralPath $cssSource -Destination (Join-Path $assetDir 'silo-master.css')
$manifest = [ordered]@{
  schema='BEC-PRIME/CUBE-CLONE-MANIFEST/v1'
  source_contract='BEC-PRIME/cube/CUBE-CLONE-CONTRACT.json'
  factory_contract='BEC-PRIME/cube/CUBE-SILO-FACTORY-CONTRACT.json'
  source_master='mtg'
  slug=$SiloName
  name=$ProductName
  route="/$SiloName/"
  manifest_path="/silos/$SiloName/silo.json"
  catalog="/data/$SiloName-catalog.json"
  inventory_policy='empty_until_verified_supply'
  status='synthetic_private'
  currency='NZD'
  checkout_available=$false
  payment_destination=$null
  credentials=$null
  capabilities_by_ref=@('catalog','gauntlet','commerce-spine')
  isolation=[ordered]@{catalog=$true;checkout=$true;analytics=$true;customer_data=$true;content=$true;promotion=$true;credentials=$true}
  gauntlet=[ordered]@{result='NOT_RUN';public_activation='HOLD';checkout='HOLD';live_payments=$false}
}
$catalog = [ordered]@{
  schema='dreamledger/silo-catalogue/v1'
  silo=$SiloName
  currency='NZD'
  products=@()
  updated=$null
  note='Synthetic private clone. No real inventory, orders, buyers or payment destinations.'
}
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $manifestDir 'silo.json') -Encoding utf8
$catalog | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $dataDir "$SiloName-catalog.json") -Encoding utf8
$safeTitle = [System.Net.WebUtility]::HtmlEncode($ProductName)
$page = @"
<!doctype html>
<html lang="en-NZ" data-silo="$SiloName"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$safeTitle | Private CUBE candidate</title>
<link rel="stylesheet" href="../assets/silo-master.css"></head>
<body class="silo-body"><main class="silo-wrap">
<h1>$safeTitle</h1><p>Private synthetic candidate for the BECK CUBE Gauntlet.</p>
<p>No inventory, no customers, no checkout, no payment destination and no public activation.</p>
<p>Listed starting price (draft, not a public offer): NZD $PriceNZD</p>
<p>Catalog is empty until independently verified supply is approved.</p>
</main></body></html>
"@
$page | Set-Content -LiteralPath (Join-Path $pageDir 'index.html') -Encoding utf8
$copied = @("public/assets/silo-master.css","public/$SiloName/index.html","public/data/$SiloName-catalog.json","public/silos/$SiloName/silo.json")
$proof = [ordered]@{
  schema='BECK/CUBE-PRIVATE-CLONE-PROOF/v2'
  status='SYNTHETIC_PRIVATE_ONLY'
  silo=$SiloName
  candidate_price_nzd=[decimal]$PriceNZD
  stripe_product_id='NOT_COPIED_OR_ACTIVATED'
  target_repo=$TargetRepo
  files=$copied
  source_master='mtg'
  inherited_inventory=0
  inherited_customers=0
  inherited_credentials=0
  checkout_enabled=$false
  remote_created=$false
  pushed=$false
  gauntlet_status='NOT_RUN'
  public_activation='HOLD'
  hashes=@($copied | ForEach-Object {
    $relative=($_ -replace '/', [IO.Path]::DirectorySeparatorChar)
    $full=Join-Path $target $relative
    [ordered]@{path=$_;sha256=(Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()}
  })
}
$proof | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $proofDir 'clone-proof.json') -Encoding utf8
Write-Output "PRIVATE CUBE clone generated: $target"
Write-Output 'Proof: proofs/clone-proof.json | Checkout: HELD | Publication: HELD'
