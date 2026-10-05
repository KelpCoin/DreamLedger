'[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet("critical","digest")][string]$Channel,
  [Parameter(Mandatory=$true)][string]$SpikeId,
  [Parameter(Mandatory=$true)][string]$Message
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $env:LOCALAPPDATA "DreamLedger\discord-webhooks.json"
if (-not (Test-Path $configPath)) { throw "Run Bootstrap-Discord.ps1 first." }

function Read-Secret([string]$encrypted) {
  $secure = $encrypted | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$url = Read-Secret $config.$Channel
$payload = @{
  username = "DreamLedger"
  embeds = @(@{
    title = "Success Spike $SpikeId"
    description = $Message
    footer = @{ text = "DreamLedger substrate-derived spike log" }
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
  })
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $payload | Out-Null
Write-Host "Sent $SpikeId to $Channel."
'