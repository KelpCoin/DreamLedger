# DreamLedger Discord webhook bootstrap for Windows PowerShell 5.1
[CmdletBinding()]
param(
  [switch]$TestOnly
)

$ErrorActionPreference = "Stop"
$root = Join-Path $env:LOCALAPPDATA "DreamLedger"
$configPath = Join-Path $root "discord-webhooks.json"

function Save-Secret([string]$name, [string]$value) {
  $secure = ConvertTo-SecureString -String $value -AsPlainText -Force
  return ($secure | ConvertFrom-SecureString)
}

function Read-Secret([string]$name, [string]$encrypted) {
  $secure = $encrypted | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Test-Webhook([string]$name, [string]$url) {
  if ($url -notmatch '^https://(discord(?:app)?\.com)/api/webhooks/') {
    throw "$name webhook URL is not a Discord webhook URL."
  }
  $body = @{ content = "DreamLedger Discord bridge test: $name $(Get-Date -Format s)" } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body | Out-Null
  Write-Host "OK: $name webhook accepted the test."
}

New-Item -ItemType Directory -Force -Path $root | Out-Null

if (-not (Test-Path $configPath)) {
  Write-Host "DreamLedger Discord setup"
  Write-Host "Paste the two Discord webhook URLs. They are stored with Windows user-level DPAPI."
  $critical = Read-Host "CRITICAL webhook URL"
  $digest = Read-Host "DIGEST webhook URL"
  $config = @{
    critical = Save-Secret "critical" $critical
    digest = Save-Secret "digest" $digest
    created_at = (Get-Date).ToString("o")
  } | ConvertTo-Json
  Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8
  Write-Host "Saved: $configPath"
} elseif (-not $TestOnly) {
  Write-Host "Existing Discord webhook configuration found."
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$criticalUrl = Read-Secret "critical" $config.critical
$digestUrl = Read-Secret "digest" $config.digest

Test-Webhook "critical" $criticalUrl
Test-Webhook "digest" $digestUrl

$startup = @{
  username = "DreamLedger"
  content = "Discord bridge online. Revenue truth remains NZ$0.00 until independent settlement + attribution + fulfillment + proof. Success spikes are now Discord-loggable."
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $digestUrl -ContentType "application/json" -Body $startup | Out-Null
Write-Host "Discord bridge is ready."
Write-Host "Next: use Send-DiscordSpike.ps1 for each spike/event."
