[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$Message) { throw $Message }
function Ensure-Dir([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null } }
function Write-Utf8([string]$Path,[string]$Text) { Ensure-Dir (Split-Path -Parent $Path); [System.IO.File]::WriteAllText($Path,$Text,(New-Object System.Text.UTF8Encoding($false))) }
function Hash-File([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Fail 'Run this bootstrap from an elevated PowerShell prompt.' }

$base = if (Test-Path 'D:\') { 'D:\BrownEyeCortex' } else { 'C:\BrownEyeCortex' }
$root = Join-Path $base 'BECKPrime'
$security = Join-Path $root 'security'
$gateway = Join-Path $security 'gateway.js'
$launcher = Join-Path $security 'Launch-MCPGateway.js'
$manifest = Join-Path $security 'mcp-gateway-manifest.json'
$policy = Join-Path $security 'mcp-gateway-policy.json'
$lock = Join-Path $security 'mcp-launch.lock.json'
$configDir = Join-Path $env:USERPROFILE '.lmstudio'
$config = Join-Path $configDir 'mcp.json'
$proofDir = Join-Path $root 'data\proofs'
$proof = Join-Path $proofDir 'MCP-BOOTSTRAP-LATEST.json'

Ensure-Dir $security
Ensure-Dir $proofDir

$node = (Get-Command node -ErrorAction Stop).Source
if (-not [System.IO.Path]::IsPathRooted($node)) { Fail 'Node executable path is not absolute.' }
if (-not (Test-Path -LiteralPath $gateway)) { Fail "Missing gateway: $gateway" }
if (-not (Test-Path -LiteralPath $launcher)) { Fail "Missing launcher: $launcher" }
if (-not (Test-Path -LiteralPath $manifest)) { Fail "Missing manifest: $manifest" }
if (-not (Test-Path -LiteralPath $policy)) { Fail "Missing policy: $policy" }

$gatewayHash = Hash-File $gateway
$launcherHash = Hash-File $launcher
$manifestHash = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).manifest_hash

$lockObject = [ordered]@{
  schema_version = 'BECKPRIME-MCP-LAUNCH-LOCK-1.2'
  gateway_path = $gateway
  gateway_sha256 = $gatewayHash
  launcher_sha256 = $launcherHash
  manifest_sha256 = $manifestHash
  node_path = $node
  mode = 'LOCAL_STDIO_PINNED'
  approved_utc = (Get-Date).ToUniversalTime().ToString('o')
}
Write-Utf8 $lock ($lockObject | ConvertTo-Json -Depth 8)

$existing = @{}
if (Test-Path -LiteralPath $config) {
  try { $existing = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json -AsHashtable } catch { if (-not $Force) { Fail 'Existing mcp.json is invalid. Use -Force to replace it after backup.' }; Copy-Item $config ($config + '.invalid-backup') -Force; $existing = @{} }
}
if (-not $existing.ContainsKey('mcpServers')) { $existing['mcpServers'] = @{} }
$existing['mcpServers']['dreamledger-gateway'] = [ordered]@{
  command = $node
  args = @($launcher)
  env = @{ BECKPRIME_ROOT = $root }
  description = 'BECKPrime pinned local stdio gateway; six allowlisted tools; proposal-only; Gauntlet + Truth Oracle + Court gated.'
}
Ensure-Dir $configDir
if (Test-Path -LiteralPath $config) { Copy-Item $config ($config + '.backup-' + (Get-Date -Format 'yyyyMMddHHmmss')) -Force }
Write-Utf8 $config ($existing | ConvertTo-Json -Depth 20)

$acl = Get-Acl -LiteralPath $security
$acl.SetAccessRuleProtection($true,$false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
$adminSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')
$systemSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($entry in @(
  (New-Object System.Security.AccessControl.FileSystemAccessRule($adminSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')),
  (New-Object System.Security.AccessControl.FileSystemAccessRule($systemSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')),
  (New-Object System.Security.AccessControl.FileSystemAccessRule($userSid,'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow'))
)) { $acl.AddAccessRule($entry) }
Set-Acl -LiteralPath $security -AclObject $acl

$result = [ordered]@{
  schema_version = 'BECKPRIME-MCP-BOOTSTRAP-1.2'
  status = 'BOOTSTRAPPED'
  verified = $false
  root = $root
  gateway = $gateway
  launcher = $launcher
  node = $node
  mcp_config = $config
  gateway_sha256 = $gatewayHash
  launcher_sha256 = $launcherHash
  manifest_sha256 = $manifestHash
  acl = 'Administrators/System FullControl; current user ReadAndExecute'
  note = 'Run npm run verify:mcp and verify:mcp-security before enabling the LM Studio server.'
  timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
}
Write-Utf8 $proof ($result | ConvertTo-Json -Depth 10)
Write-Host ('MCP bootstrap complete: ' + $config)
Write-Host ('Proof: ' + $proof)
Write-Host ('Verify: Set-Location ' + $root + '; node scripts\verify-mcp-security.js; node scripts\verify-mcp-gateway.js')
