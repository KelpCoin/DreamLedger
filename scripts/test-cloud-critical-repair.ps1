# BECK cloud runtime regression, runs ONLY in GitHub Windows runner.
# Does not use production credentials or external network.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Assert([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }

$bootstrap = Get-Content 'BEC-PRIME/scripts/DreamLedger-Economic-Bootstrap.ps1' -Raw
$cloud = Get-Content 'BEC-PRIME/scripts/Cloud-Orchestrator.ps1' -Raw
foreach ($path in @('BEC-PRIME/scripts/DreamLedger-Economic-Bootstrap.ps1','BEC-PRIME/scripts/Cloud-Orchestrator.ps1')) {
  $tokens=$null; $errors=$null
  [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $path),[ref]$tokens,[ref]$errors) | Out-Null
  Assert ($errors.Count -eq 0) ("PARSE_FAIL: " + $path)
}

foreach ($name in @('SafeGet','SafeJson')) {
  $pattern = '(?ms)^function ' + $name + '\([^\r\n]*\)\s*\{.*?^\}'
  $match = [regex]::Match($bootstrap,$pattern)
  Assert $match.Success ("BOOTSTRAP_FUNCTION_NOT_FOUND: "+$name)
  Invoke-Expression $match.Value
}

function Invoke-WebRequest {
  [CmdletBinding()]
  param([string]$Uri,[string]$Method,[hashtable]$Headers,[int]$TimeoutSec,[switch]$UseBasicParsing)
  return [pscustomobject]@{ StatusCode=200; Content='{"ok":true}' }
}
$got = SafeGet 'https://example.invalid/healthy'
Assert ($got.ok -eq $true) 'SAFEGET_SUCCESS_FALSE'
Assert ($got.ContainsKey('error')) 'SAFEGET_MISSING_ERROR_KEY'
Assert ($null -eq $got.error) 'SAFEGET_UNEXPECTED_ERROR'
$gotJson = SafeJson 'https://example.invalid/healthy'
Assert ($gotJson.ok -eq $true) 'SAFEJSON_SUCCESS_FALSE'
Assert ($gotJson.ContainsKey('error')) 'SAFEJSON_MISSING_ERROR_KEY'
Assert ($null -eq $gotJson.error) 'SAFEJSON_UNEXPECTED_ERROR'
Assert ($gotJson.data.ok -eq $true) 'SAFEJSON_BAD_DATA'

$line = [regex]::Match($cloud,'(?m)^function GetRows\([^\r\n]+$')
Assert $line.Success 'GETROWS_FUNCTION_NOT_FOUND'
Invoke-Expression $line.Value
$base = 'https://example.invalid'
$h = @{}
$script:lastUri = $null
function Invoke-RestMethod {
  [CmdletBinding()]
  param([string]$Uri,[hashtable]$Headers,[string]$Method,[int]$TimeoutSec)
  $script:lastUri = $Uri
  return @([pscustomobject]@{ id=1 })
}
$rows=GetRows 'dreamledger_evidence' 'select=sequence,event_id&limit=1'
Assert ($script:lastUri -eq 'https://example.invalid/rest/v1/dreamledger_evidence?select=sequence,event_id&limit=1') ('BAD_QUERY_URL: ' + $script:lastUri)
$rows=GetRows 'economic_events'
Assert ($script:lastUri -eq 'https://example.invalid/rest/v1/economic_events?select=*') ('BAD_DEFAULT_URL: ' + $script:lastUri)

$urls = @(
  '.github/workflows/ledger-verifier.yml',
  '.github/workflows/orchestrator-tick.yml',
  '.github/workflows/economic-supervisor.yml'
)
foreach ($path in $urls) {
  $content=Get-Content $path -Raw
  Assert ($content.Contains('SUPABASE_URL: https://wbwgroygjeyukkspnqiy.supabase.co')) ('PUBLIC_URL_NOT_BOUND: '+$path)
  Assert (-not $content.Contains('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}')) ('STALE_SECRET_URL: '+$path)
}
Write-Host 'PASS: real Windows PowerShell helper functions, correct query URLs, and public Supabase runner configuration'
