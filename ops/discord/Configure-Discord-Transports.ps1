# DreamLedger Discord transport setup
# Windows PowerShell 5.1+
# One-time credential inventory. Silos do not each need a webhook.
[CmdletBinding()]
param([switch]$SyncGitHub)
$ErrorActionPreference = "Stop"
$root = Join-Path $env:LOCALAPPDATA "DreamLedger"
$configPath = Join-Path $root "discord-transports.json"
function Protect-Value([string]$Value) {
  $secure = ConvertTo-SecureString -String $Value -AsPlainText -Force
  return ($secure | ConvertFrom-SecureString)
}
function Unprotect-Value([string]$Value) {
  $secure = $Value | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Read-Webhook([string]$Role) {
  $v = Read-Host "Webhook for $Role (leave blank to skip)"
  if ([string]::IsNullOrWhiteSpace($v)) { return $null }
  if ($v -notmatch '^https://(discord(?:app)?\.com)/api/webhooks/') { throw "$Role is not a valid Discord webhook URL." }
  return (Protect-Value $v)
}
New-Item -ItemType Directory -Force -Path $root | Out-Null
Write-Host ""
Write-Host "DreamLedger Discord transport setup"
Write-Host "Enter the shared channels once. New silos do not need manual webhook creation."
Write-Host ""
$roles = @("CONTROL_ROOM","ACQUISITION","CRITICAL","DIGEST")
$config = [ordered]@{ version = 1; updated_at = (Get-Date).ToString("o"); webhooks = [ordered]@{} }
foreach ($role in $roles) {
  $secret = Read-Webhook $role
  if ($null -ne $secret) { $config.webhooks[$role] = $secret }
}
$channelId = Read-Host "Discord acquisition channel ID (optional, enables bot fallback)"
if ($channelId) { $config.acquisition_channel_id = $channelId }
$botToken = Read-Host "Discord bot token (optional; leave blank if using webhooks only)"
if ($botToken) { $config.bot_token = (Protect-Value $botToken) }
$config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $configPath -Encoding UTF8
Write-Host ""
Write-Host "Saved encrypted local transport inventory: $configPath"
if ($SyncGitHub) {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI (gh) is not installed." }
  gh auth status | Out-Null
  foreach ($role in $config.webhooks.Keys) {
    $value = Unprotect-Value $config.webhooks[$role]
    $value | gh secret set ("DISCORD_" + $role) --repo KelpCoin/DreamLedger
    Write-Host ("Synced GitHub Actions secret: DISCORD_" + $role)
  }
  if ($config.bot_token) {
    $value = Unprotect-Value $config.bot_token
    $value | gh secret set DISCORD_BOT_TOKEN --repo KelpCoin/DreamLedger
    Write-Host "Synced GitHub Actions secret: DISCORD_BOT_TOKEN"
  }
  if ($config.acquisition_channel_id) {
    gh variable set DISCORD_ACQUISITION_CHANNEL_ID --body $config.acquisition_channel_id --repo KelpCoin/DreamLedger
    Write-Host "Synced GitHub Actions variable: DISCORD_ACQUISITION_CHANNEL_ID"
  }
}
Write-Host ""
Write-Host "DONE. Shared webhook transport and bot fallback are now inventoried."
Write-Host "New silos should use the provisioning rail or bot transport, not demand a new human-created webhook."