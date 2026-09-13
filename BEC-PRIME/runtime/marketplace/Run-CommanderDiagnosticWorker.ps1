#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$SupabaseUrl=$env:SUPABASE_URL
$ServiceKey=$env:SUPABASE_SERVICE_ROLE_KEY
$Python=$env:PYTHON_EXE
if([string]::IsNullOrWhiteSpace($Python)){$Python='python'}
$LmBase=$env:LM_STUDIO_BASE_URL
if([string]::IsNullOrWhiteSpace($LmBase)){$LmBase='http://127.0.0.1:1234/v1'}
$WorkerId=$env:MARKETPLACE_WORKER_ID
if([string]::IsNullOrWhiteSpace($WorkerId)){$WorkerId='local-commander-diagnostic-01'}
if([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($ServiceKey)){throw 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'}

$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
$Analyzer=Join-Path $Root 'CommanderDiagnosticAnalyzer.py'
$Work=Join-Path $Root 'work'
New-Item -ItemType Directory -Force -Path $Work | Out-Null
$Headers=@{'apikey'=$ServiceKey;'Authorization'="Bearer $ServiceKey";'Content-Type'='application/json'}

function Invoke-Rpc([string]$Name,[hashtable]$Body){
  $uri="$SupabaseUrl/rest/v1/rpc/$Name"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $Headers -Body ($Body|ConvertTo-Json -Depth 20)
}
function Sha256([string]$Path){(Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()}
function Upload-Object([string]$Path,[string]$LocalFile){
  $uri="$SupabaseUrl/storage/v1/object/marketplace-fulfillment/$Path"
  $bytes=[System.IO.File]::ReadAllBytes($LocalFile)
  $h=@{'apikey'=$ServiceKey;'Authorization'="Bearer $ServiceKey";'Content-Type'='text/markdown';'x-upsert'='false'}
  Invoke-RestMethod -Method Post -Uri $uri -Headers $h -Body $bytes | Out-Null
}

$claim=Invoke-Rpc 'marketplace_claim_fulfillment' @{p_worker_id=$WorkerId;p_lease_seconds=900}
if($null -eq $claim){exit 0}
$f=$claim.fulfillment
$item=$claim.order_item
$order=$claim.order
$leaseToken=[string]$f.metadata.lease_token
$fulfillmentId=[string]$f.fulfillment_id
$sku=[string]$item.sku_snapshot
if($sku -ne 'COMMANDER-DECK-DIAGNOSTIC-001'){
  Invoke-Rpc 'marketplace_release_fulfillment' @{p_fulfillment_id=$fulfillmentId;p_worker_id=$WorkerId;p_lease_token=$leaseToken;p_reason="unsupported sku $sku"}|Out-Null
  exit 0
}
$deck=[string]$f.metadata.decklist
if([string]::IsNullOrWhiteSpace($deck)){
  Invoke-Rpc 'marketplace_release_fulfillment' @{p_fulfillment_id=$fulfillmentId;p_worker_id=$WorkerId;p_lease_token=$leaseToken;p_reason='decklist not submitted'}|Out-Null
  exit 0
}

$Job=Join-Path $Work $fulfillmentId
New-Item -ItemType Directory -Force -Path $Job | Out-Null
$DeckFile=Join-Path $Job 'decklist.txt'
$AnalysisFile=Join-Path $Job 'analysis.json'
$ReportFile=Join-Path $Job 'report.md'
[System.IO.File]::WriteAllText($DeckFile,$deck,(New-Object System.Text.UTF8Encoding($false)))
try{
  $env:LM_STUDIO_BASE_URL=$LmBase
  & $Python $Analyzer $DeckFile $AnalysisFile $ReportFile
  if($LASTEXITCODE -ne 0){throw "analyzer exit code $LASTEXITCODE"}
  if(-not(Test-Path -LiteralPath $ReportFile)){throw 'report was not created'}
  $ReportPath="$fulfillmentId/report.md"
  $AnalysisPath="$fulfillmentId/analysis.json"
  Upload-Object $ReportPath $ReportFile
  $h=@{'apikey'=$ServiceKey;'Authorization'="Bearer $ServiceKey";'Content-Type'='application/octet-stream'}
  $analysisUri="$SupabaseUrl/storage/v1/object/marketplace-fulfillment/$AnalysisPath"
  $analysisBytes=[System.IO.File]::ReadAllBytes($AnalysisFile)
  Invoke-RestMethod -Method Post -Uri $analysisUri -Headers $h -Body $analysisBytes | Out-Null
  $sha=Sha256 $ReportFile
  $delivery="$SupabaseUrl/functions/v1/marketplace-diagnostic-delivery?session_id=$([uri]::EscapeDataString([string]$f.metadata.stripe_checkout_session_id))"
  $verifyBody=@{fulfillment_id=$fulfillmentId;worker_id=$WorkerId;lease_token=$leaseToken;storage_path=$ReportPath;sha256=$sha;mime_type='text/markdown';delivery_url=$delivery}
  Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/functions/v1/marketplace-diagnostic-verify" -Headers $Headers -Body ($verifyBody|ConvertTo-Json -Depth 10) | Out-Null
}catch{
  $reason=$_.Exception.Message
  try{Invoke-Rpc 'marketplace_release_fulfillment' @{p_fulfillment_id=$fulfillmentId;p_worker_id=$WorkerId;p_lease_token=$leaseToken;p_reason=$reason}|Out-Null}catch{}
  throw
}
