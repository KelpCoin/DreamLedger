[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$contractPath = Join-Path $RepoRoot 'contracts\agent-commerce-receipt-v1.json'
$proofDir = Join-Path $RepoRoot 'data\proofs'
$proofPath = Join-Path $proofDir 'ACR-CONTRACT.json'

if (-not (Test-Path -LiteralPath $contractPath)) {
    throw "FAIL: ACR contract missing: $contractPath"
}

$contract = Get-Content -LiteralPath $contractPath -Raw | ConvertFrom-Json

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

Assert-True ($contract.'$id' -eq 'https://dreamledger.org/contracts/agent-commerce-receipt-v1.json') 'ACR contract has canonical id'
Assert-True ($contract.title -eq 'DreamLedger Agent Commerce Receipt v1') 'ACR contract title is stable'
Assert-True ($contract.schemaVersion -eq $null) 'ACR contract avoids an ungoverned schemaVersion field'
Assert-True ($contract.required -contains 'receipt_id') 'receipt_id is required'
Assert-True ($contract.required -contains 'principal') 'principal is required'
Assert-True ($contract.required -contains 'agent') 'agent is required'
Assert-True ($contract.required -contains 'authorization') 'authorization is required'
Assert-True ($contract.required -contains 'action') 'action is required'
Assert-True ($contract.required -contains 'execution') 'execution is required'
Assert-True ($contract.required -contains 'economic_event') 'economic_event is required'
Assert-True ($contract.required -contains 'provenance') 'provenance is required'
Assert-True ($contract.required -contains 'verification') 'verification is required'
Assert-True ($contract.properties.authorization.properties.decision.enum -contains 'ALLOW') 'authorization supports ALLOW'
Assert-True ($contract.properties.authorization.properties.decision.enum -contains 'DENY') 'authorization supports DENY'
Assert-True ($contract.properties.economic_event.required -contains 'transaction_id') 'transaction_id is required for economic events'
Assert-True ($contract.properties.economic_event.required -contains 'amount_minor') 'amount_minor is required for economic events'
Assert-True ($contract.properties.economic_event.required -contains 'payment_rail') 'payment_rail is required for economic events'
Assert-True ($contract.properties.provenance.required -contains 'intent_hash') 'intent hash is required'
Assert-True ($contract.properties.provenance.required -contains 'input_hash') 'input hash is required'
Assert-True ($contract.properties.provenance.required -contains 'output_hash') 'output hash is required'
Assert-True ($contract.properties.verification.properties.stamp_algorithm.const -eq 'SHA-256') 'stamp algorithm is explicitly SHA-256'
Assert-True ($contract.properties.verification.required -contains 'claims_scope') 'verification claims scope is required'

New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

$proof = [ordered]@{
    type = 'dreamledger-acr-contract'
    status = 'PASS'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    contract = 'contracts/agent-commerce-receipt-v1.json'
    contract_id = $contract.'$id'
    schema = 'dreamledger/acr/v1'
    evidence_authority = 'DreamLedger verification record; not payment settlement authority'
    signature_status = 'SCHEMA-ONLY'
    proof_path = 'data/proofs/ACR-CONTRACT.json'
}

$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding utf8
Write-Host "PROOF: $proofPath"
Write-Host 'PASS: ACR contract verified.'
