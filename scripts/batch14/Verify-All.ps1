#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\BrownEyeCortex"
$Proof = Join-Path $Root "proof\batch14"
New-Item -ItemType Directory -Force -Path $Proof | Out-Null

function Result([string]$Name,[bool]$Ok,[string]$Detail) {
  [pscustomobject]@{
    check = $Name
    status = $(if ($Ok) { "PASS" } else { "FAIL" })
    detail = $Detail
  }
}

$out = @()
$out += Result "PowerShell" ($PSVersionTable.PSVersion.Major -ge 5) $PSVersionTable.PSVersion.ToString()

$lms = Get-Command lms.exe -ErrorAction SilentlyContinue
$out += Result "LMStudio CLI" ([bool]$lms) $(if ($lms) { $lms.Source } else { "not found" })

$cloud = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
$out += Result "Cloudflared" ([bool]$cloud) $(if ($cloud) { $cloud.Source } else { "not found" })

$node = Get-Command node.exe -ErrorAction SilentlyContinue
$out += Result "Node" ([bool]$node) $(if ($node) { $node.Source } else { "not found" })

$p1234 = Get-NetTCPConnection -LocalPort 1234 -State Listen -ErrorAction SilentlyContinue
$out += Result "LMStudio port 1234" ([bool]$p1234) $(if ($p1234) { "listening" } else { "not listening" })

$p4022 = Get-NetTCPConnection -LocalPort 4022 -State Listen -ErrorAction SilentlyContinue
$out += Result "MCP port 4022" ([bool]$p4022) $(if ($p4022) { "listening" } else { "not listening" })

$out | ConvertTo-Json -Depth 4 | Set-Content -Encoding ASCII (Join-Path $Proof "VERIFY-ALL.json")
$out | Format-Table -AutoSize
Write-Host ""
Write-Host "Economic truth is unchanged until an independent settled payment is observed."
