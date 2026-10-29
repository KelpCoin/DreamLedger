#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\BrownEyeCortex"
$Ops = Join-Path $Root "ops\batch14"
$Proof = Join-Path $Root "proof\batch14"
New-Item -ItemType Directory -Force -Path $Ops,$Proof | Out-Null

function Write-AsciiFile([string]$Path,[string]$Text) {
  $enc = New-Object System.Text.ASCIIEncoding
  [System.IO.File]::WriteAllText($Path,$Text,$enc)
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$lm = @'
# LM Studio Batch 14 bootstrap
$Lms = "$env:USERPROFILE\.lmstudio\bin\lms.exe"
if (-not (Test-Path $Lms)) { $Lms = "$env:USERPROFILE\.lmstudio\bin\lms.cmd" }
if (-not (Test-Path $Lms)) { throw "LM Studio lms CLI not found." }

& $Lms --version
& $Lms server start --port 1234
& $Lms load qwen2.5-7b-instruct --identifier BECK_Resona --gpu max --context-length 8192
& $Lms ps
'@

$cf = @'
# Cloudflare named tunnel template
# Fill TUNNEL_ID after: cloudflared tunnel create dreamledger-mcp
tunnel: TUNNEL_ID
credentials-file: C:\Users\YOUR_USER\.cloudflared\TUNNEL_ID.json
ingress:
  - hostname: mcp.dreamledger.org
    service: http://127.0.0.1:4022
  - service: http_status:404
'@

$manifest = @'
BATCH14 STATUS
================
Parcel branch: KILLED
n8n branch: EXCLUDED
GPU rental: DEFERRED
MCP tollbooth: ACTIVE BUILD
RLS: REQUIRED
LM Studio: REQUIRED LOCAL GATE
Public listing: HUMAN GATE
External payment: HUMAN/EXTERNAL TRUTH GATE

Economic truth remains:
VERIFIED_EXTERNAL_REVENUE=0.00
SETTLED_EXTERNAL_PAYMENTS=0
INDEPENDENT_EXTERNAL_BUYERS=0

Required economic proof:
external caller -> payment required -> real settlement -> tool execution -> useful result -> receipt -> reconciliation
'@

Write-AsciiFile (Join-Path $Ops "LMStudio-Bootstrap.ps1") $lm
Write-AsciiFile (Join-Path $Ops "cloudflared-config.yml") $cf
Write-AsciiFile (Join-Path $Proof "BATCH14-STATE.txt") $manifest

$checks = [ordered]@{}
$checks.PowerShell = $PSVersionTable.PSVersion.ToString()
$checks.LmsPresent = [bool](Get-Command lms.exe -ErrorAction SilentlyContinue)
$checks.CloudflaredPresent = [bool](Get-Command cloudflared.exe -ErrorAction SilentlyContinue)
$checks.NodePresent = [bool](Get-Command node.exe -ErrorAction SilentlyContinue)
$checks.SupabasePresent = [bool](Get-Command supabase.exe -ErrorAction SilentlyContinue)
$checks.Local4022 = [bool](Get-NetTCPConnection -LocalPort 4022 -State Listen -ErrorAction SilentlyContinue)
$checks.Local1234 = [bool](Get-NetTCPConnection -LocalPort 1234 -State Listen -ErrorAction SilentlyContinue)
$checks.Timestamp = $stamp

$checks | ConvertTo-Json | Write-AsciiFile (Join-Path $Proof "BATCH14-PREFLIGHT.json")

Write-Host "BATCH14 BUILD-ALL prepared."
Write-Host "Artifacts: $Ops"
Write-Host "Proof:     $Proof"
Write-Host "No public listing, claim submission, outreach, or payment was simulated."
