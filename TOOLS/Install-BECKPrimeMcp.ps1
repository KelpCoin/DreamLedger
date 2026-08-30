#requires -version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = $(Split-Path -Parent $PSScriptRoot),
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Gateway = Join-Path $RepoRoot 'BEC-PRIME\mcp\DreamLedgerGatewayV2.js'
$Dockerfile = Join-Path $RepoRoot 'BEC-PRIME\mcp\Dockerfile'
$Security = Join-Path $RepoRoot 'BEC-PRIME\security\mcp-tool-manifest.json'
$Pin = Join-Path $RepoRoot 'BEC-PRIME\security\mcp-tool-manifest.pin.json'
$McpDir = Join-Path $env:USERPROFILE '.lmstudio'
$McpConfig = Join-Path $McpDir 'mcp.json'
$Image = 'dreamledger-mcp:1.1'
$Volume = 'dreamledger-mcp-ledger'

foreach($p in @($Gateway,$Dockerfile,$Security,$Pin)){ if(-not(Test-Path -LiteralPath $p)){ throw "Missing required file: $p" } }
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){ throw 'Docker is required for the hardened MCP sandbox.' }
if(-not(Get-Command node -ErrorAction SilentlyContinue)){ throw 'Node.js is required for local verification.' }

$Repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$Context = Join-Path $Repo 'BEC-PRIME'
Write-Host "Building $Image..."
& docker build -t $Image -f $Dockerfile $Context
if($LASTEXITCODE -ne 0){ throw 'Docker build failed.' }

New-Item -ItemType Directory -Force -Path $McpDir | Out-Null
if((Test-Path -LiteralPath $McpConfig) -and -not $Force){ throw "Existing mcp.json found. Re-run with -Force to replace it." }

$RepoEscaped = $Repo.Replace('\','/')
$Mcp = [ordered]@{
    mcpServers = [ordered]@{
        'dreamledger-gateway' = [ordered]@{
            command = 'docker'
            args = @(
                'run','-i','--rm','--read-only','--network=none','--cap-drop=ALL','--security-opt=no-new-privileges',
                '--mount',"type=bind,source=$RepoEscaped/BEC-PRIME/catalog/products,target=/app/BEC-PRIME/catalog/products,readonly",
                '--mount',"type=bind,source=$RepoEscaped/BEC-PRIME/data/proofs,target=/app/BEC-PRIME/data/proofs,readonly",
                '--mount',"type=volume,source=$Volume,target=/app/BEC-PRIME/data/mcp-ledger",
                $Image
            )
            description = 'DreamLedger MCP. Container sandbox, no network, six read/proposal tools, zero autonomous spend.'
        }
    }
    _security = [ordered]@{
        command_allowlist = @('docker')
        network = 'none'
        filesystem = 'read-only except named audit volume'
        human_approval_required = $true
        zero_autonomous_spend = $true
        tool_manifest_pin = (Get-Content -Raw -LiteralPath $Pin | ConvertFrom-Json).sha256
        env_expansion_forbidden = $true
    }
}
$Mcp | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $McpConfig -Encoding UTF8

$ProofDir = Join-Path $Repo 'BEC-PRIME\data\proofs'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$Proof = [ordered]@{
    schema = 'BEC-MCP-INSTALL-1.1'
    status = 'PASS'
    installed_at = (Get-Date).ToUniversalTime().ToString('o')
    repo_root = $Repo
    mcp_config = $McpConfig
    image = $Image
    volume = $Volume
    network = 'none'
    tool_manifest_sha256 = (Get-Content -Raw -LiteralPath $Pin | ConvertFrom-Json).sha256
    gateway_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Gateway).Hash.ToLowerInvariant()
    no_autonomous_spend = $true
}
$ProofPath = Join-Path $ProofDir 'MCP-INSTALL-LATEST.json'
$Proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ProofPath -Encoding UTF8
Write-Host "PASS: MCP sandbox installed."
Write-Host "Config: $McpConfig"
Write-Host "Proof:  $ProofPath"
Write-Host "Verify: node -e \"const g=require('$Gateway'); console.log(g.TOOLS.length === 6 ? 'PASS' : 'FAIL')\""
