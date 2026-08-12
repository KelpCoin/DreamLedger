param(
    [string]$Repository = "KelpCoin/DreamLedger",
    [string]$RegistryPath = "BEC-PRIME/BACKUPS/BACKUP-REGISTRY-2026-08-12.json"
)

$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$localRoot = "D:\BrownEyeCortex\BEC-PRIME"
$proofDir = Join-Path $localRoot "Proof\Backups"
New-Item -ItemType Directory -Path $proofDir -Force | Out-Null
$proofPath = Join-Path $proofDir "BACKUP-VERIFY-$stamp.json"

$api = "https://api.github.com/repos/$Repository/contents/$RegistryPath"
$headers = @{ "Accept" = "application/vnd.github+json"; "User-Agent" = "BEC-PRIME-BackupVerifier" }

$result = [ordered]@{
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    repository = $Repository
    registry = $RegistryPath
    status = "FAIL"
    checks = @()
}

try {
    $r = Invoke-RestMethod -Uri $api -Headers $headers -Method Get -TimeoutSec 15
    $content = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(($r.content -replace "\s", "")))
    $registry = $content | ConvertFrom-Json

    foreach ($snapshot in $registry.snapshots) {
        $refApi = "https://api.github.com/repos/$Repository/branches/$([uri]::EscapeDataString($snapshot.branch))"
        try {
            $branch = Invoke-RestMethod -Uri $refApi -Headers $headers -Method Get -TimeoutSec 15
            $ok = ($branch.commit.sha -eq $snapshot.commit)
            $result.checks += [ordered]@{
                branch = $snapshot.branch
                expected = $snapshot.commit
                observed = $branch.commit.sha
                status = if ($ok) { "PASS" } else { "FAIL" }
            }
        } catch {
            $result.checks += [ordered]@{
                branch = $snapshot.branch
                expected = $snapshot.commit
                observed = $null
                status = "FAIL"
                error = $_.Exception.Message
            }
        }
    }

    $result.status = if (($result.checks | Where-Object { $_.status -ne "PASS" }).Count -eq 0) { "PASS" } else { "FAIL" }
} catch {
    $result.status = "FAIL"
    $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 12 | Set-Content -Path $proofPath -Encoding UTF8
Write-Host "Backup verification: $($result.status)"
Write-Host "Proof: $proofPath"
if ($result.status -ne "PASS") { exit 1 }
exit 0
