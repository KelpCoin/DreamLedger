param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)
$ErrorActionPreference = "Stop"
$Runtime = Join-Path $RepoRoot "runtime\lm_studio"
$Python = Get-Command python -ErrorAction Stop
Write-Host "Installing BECK local-only SDK and read-only MCP dependencies..."
& $Python.Source -m pip install -r (Join-Path $Runtime "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "PIP_INSTALL_FAILED" }
& $Python.Source -m unittest discover -s $Runtime -p "test_beck_lmstudio_sdk.py"
if ($LASTEXITCODE -ne 0) { throw "SDK_TESTS_FAILED" }
Write-Host "PASS: dependencies installed and adapter tests passed."
Write-Host "Next: copy runtime\lm_studio\mcp.json.example to the LM Studio mcp.json location only after reviewing it."
Write-Host "No user config was overwritten; no model downloaded; no external action enabled."
