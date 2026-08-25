#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\BrownEyeCortex\DreamLedger",
    [string]$ProofRoot = "D:\BrownEyeCortex\Proof\DreamLedger",
    [string]$ExternalPaymentEvidencePath = "",
    [string]$PaymentEventId = "",
    [string]$TransactionId = "",
    [string]$PaymentSourceReference = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-Ascii([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Get-Sha256File([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function ConvertTo-Base64Url([byte[]]$Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function ConvertTo-CanonicalJson($Value) {
    if ($null -eq $Value) { return "null" }
    if ($Value -is [string]) { return ($Value | ConvertTo-Json -Compress) }
    if ($Value -is [bool]) { return ($(if ($Value) { "true" } else { "false" })) }
    if ($Value -is [System.Collections.IDictionary]) {
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($key in ($Value.Keys | ForEach-Object { [string]$_ } | Sort-Object)) {
            $parts.Add((($key | ConvertTo-Json -Compress) + ":" + (ConvertTo-CanonicalJson $Value[$key])))
        }
        return "{" + ($parts -join ",") + "}"
    }
    if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
        $parts = New-Object System.Collections.Generic.List[string]
        foreach ($item in $Value) { $parts.Add((ConvertTo-CanonicalJson $item)) }
        return "[" + ($parts -join ",") + "]"
    }
    return ($Value | ConvertTo-Json -Compress)
}

function New-RsaKeyMaterial([string]$PrivateKeyPath) {
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider(3072)
    $rsa.PersistKeyInCsp = $false
    $privateXml = $rsa.ToXmlString($true)
    Write-Ascii $PrivateKeyPath $privateXml
    $acl = Get-Acl -LiteralPath $PrivateKeyPath
    $acl.SetAccessRuleProtection($true, $false)
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($user,"Read","Allow")
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $PrivateKeyPath -AclObject $acl
    return $rsa
}

function Load-Rsa([string]$PrivateKeyPath) {
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
    $rsa.PersistKeyInCsp = $false
    $rsa.FromXmlString([System.IO.File]::ReadAllText($PrivateKeyPath))
    return $rsa
}

Ensure-Dir $RepoRoot
Ensure-Dir $ProofRoot
Ensure-Dir (Join-Path $RepoRoot "evidence")

$Log = Join-Path $ProofRoot ("MegaBootstrap-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -LiteralPath $Log -Force | Out-Null
try {
    Write-Host "DREAMLEDGER EVIDENCE MEGABOOTSTRAP START"

    $evidenceFiles = @(
        "package.json",
        "render.yaml",
        "BEC-PRIME/scripts/verify-agentic-commerce.js",
        "BEC-PRIME/scripts/verify-trust-attestation.js",
        "BEC-PRIME/PRODUCTION-DEPLOYMENT-REPAIR.md"
    )

    $fileEntries = New-Object System.Collections.Generic.List[object]
    foreach ($rel in $evidenceFiles) {
        $full = Join-Path $RepoRoot $rel
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Missing evidence file: $rel" }
        $fileEntries.Add([ordered]@{
            path = ($rel -replace '\\','/')
            sha256 = Get-Sha256File $full
        })
    }

    $paymentEvidenceHash = ""
    if ($ExternalPaymentEvidencePath) {
        if (-not (Test-Path -LiteralPath $ExternalPaymentEvidencePath -PathType Leaf)) { throw "External payment evidence file not found" }
        $paymentEvidenceHash = Get-Sha256File $ExternalPaymentEvidencePath
    }

    $status = "INSUFFICIENT_EVIDENCE"
    if ($PaymentEventId -and $TransactionId -and $PaymentSourceReference -and $paymentEvidenceHash) {
        $status = "PASS"
    }

    $privateKeyPath = Join-Path $ProofRoot "dreamledger-evidence-signing-key.xml"
    if (Test-Path -LiteralPath $privateKeyPath -PathType Leaf) {
        $rsa = Load-Rsa $privateKeyPath
    } else {
        $rsa = New-RsaKeyMaterial $privateKeyPath
    }

    $pub = $rsa.ExportParameters($false)
    $jwk = [ordered]@{
        kty = "RSA"
        n = ConvertTo-Base64Url $pub.Modulus
        e = ConvertTo-Base64Url $pub.Exponent
        alg = "RS256"
    }

    $manifest = [ordered]@{
        schema = "dreamledger/evidence-manifest/v2"
        version = 2
        generated_at = (Get-Date).ToUniversalTime().ToString("o")
        status = $status
        purpose = "Cryptographic integrity and evidence sufficiency gate. This does not prove external payment unless external payment evidence is supplied."
        files = @($fileEntries)
        external_payment = [ordered]@{
            payment_status = $(if ($PaymentEventId) { "paid" } else { "missing" })
            payment_event_id = $PaymentEventId
            transaction_id = $TransactionId
            source_reference = $PaymentSourceReference
            evidence_file = $(if ($ExternalPaymentEvidencePath) { [System.IO.Path]::GetFullPath($ExternalPaymentEvidencePath) } else { "" })
            evidence_sha256 = $paymentEvidenceHash
        }
        signature = $null
    }

    $manifest.signature = $null
    $manifest.payload_sha256 = ""
    $unsignedCanonical = ConvertTo-CanonicalJson $manifest
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($unsignedCanonical)
    $hashAlg = New-Object System.Security.Cryptography.SHA256Managed
    $manifest.payload_sha256 = ([BitConverter]::ToString($hashAlg.ComputeHash($payloadBytes))).Replace('-','').ToLowerInvariant()

    $unsignedCanonical = ConvertTo-CanonicalJson $manifest
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($unsignedCanonical)
    $signatureBytes = $rsa.SignData($payloadBytes, [System.Security.Cryptography.CryptoConfig]::MapNameToOID("SHA256"))
    $manifest.signature = [ordered]@{
        algorithm = "RSA-SHA256"
        public_key_jwk = $jwk
        value = ConvertTo-Base64Url $signatureBytes
    }

    $manifestPath = Join-Path $RepoRoot "evidence/manifest.json"
    Write-Ascii $manifestPath (($manifest | ConvertTo-Json -Depth 20) + "`r`n")

    $proofPath = Join-Path $ProofRoot "PROOF-EVIDENCE-MANIFEST.json"
    $proof = [ordered]@{
        type = "dreamledger-evidence-manifest-bootstrap"
        version = 2
        status = $status
        manifest = $manifestPath
        manifest_sha256 = Get-Sha256File $manifestPath
        private_key_path = $privateKeyPath
        payment_evidence_hash = $paymentEvidenceHash
        note = "INSUFFICIENT_EVIDENCE is expected until independently obtained external payment evidence is supplied."
    }
    Write-Ascii $proofPath (($proof | ConvertTo-Json -Depth 20) + "`r`n")

    Write-Host "MANIFEST=$manifestPath"
    Write-Host "PROOF=$proofPath"
    Write-Host "LOG=$Log"
    Write-Host "STATUS=$status"
    Write-Host "VERIFY=cd '$RepoRoot'; node BEC-PRIME/scripts/verify-evidence-manifest.js"
    Write-Host "DREAMLEDGER_EVIDENCE_MEGABOOTSTRAP_OK"
} catch {
    Write-Host "DREAMLEDGER_EVIDENCE_MEGABOOTSTRAP_FAIL: $($_.Exception.Message)"
    throw
} finally {
    Stop-Transcript | Out-Null
}
