function Write-ProofArtifact { param($Path,$Content)
    $dir = Split-Path $Path
    New-Item -Force -ItemType Directory -Path $dir | Out-Null
    $Content | Set-Content -Path $Path -Encoding UTF8
    $hash = (Get-FileHash $Path -Algorithm SHA256).Hash
    Write-Host "=== PROOF SEALED ==="
    Write-Host "Path: $Path"
    Write-Host "SHA256: $hash"
}
