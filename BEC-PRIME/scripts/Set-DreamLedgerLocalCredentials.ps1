#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Dir = Join-Path $env:LOCALAPPDATA 'DreamLedger'
$Path = Join-Path $Dir 'local-secrets.json'

New-Item -ItemType Directory -Force -Path $Dir | Out-Null

$url = Read-Host 'Supabase URL (for DreamLedger)'
$key = Read-Host 'Supabase service-role key' -AsSecureString

if ([string]::IsNullOrWhiteSpace($url)) { throw 'SUPABASE_URL_EMPTY' }

$doc = [ordered]@{
    schema = 'dreamledger.local-secrets.v1'
    supabase_url = $url.TrimEnd('/')
    supabase_service_role_key_dpapi = (ConvertFrom-SecureString -SecureString $key)
}

$doc | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Path -Encoding UTF8

Write-Host ('STORED=' + $Path)
Write-Host 'PROTECTION=Windows DPAPI current user'
Write-Host 'SECRET_PLAINTEXT=NOT_WRITTEN'
Write-Host 'NEXT=Start-DreamLedgerAutonomous.ps1'
