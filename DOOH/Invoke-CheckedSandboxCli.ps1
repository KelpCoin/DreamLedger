function Invoke-CheckedSandboxCli {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)][string]$Command,
          [Parameter(Mandatory=$true)][ValidateSet('create','status')][string]$Action)
    # Capture the native exit code before another command can overwrite it.
    # Never persist arbitrary CLI output: it can contain credentials.
    $global:LASTEXITCODE = $null
    $raw = & $Command --yes @trillboards/cli sandbox $Action --format json 2>&1 | Out-String
    $code = $LASTEXITCODE
    if ($null -eq $code -or $code -ne 0) { throw "SANDBOX_CLI_FAILED action=$Action" }
    try { $parsed = $raw | ConvertFrom-Json -ErrorAction Stop } catch { throw "SANDBOX_CLI_INVALID_JSON action=$Action" }
    if ($null -eq $parsed -or $parsed -isnot [pscustomobject] -or
        @($parsed.PSObject.Properties).Count -eq 0 -or $parsed.error -or
        $parsed.isError -eq $true -or $parsed.success -eq $false -or
        [string]$parsed.status -match '^(error|failed|failure)$') {
        throw "SANDBOX_CLI_REJECTED action=$Action"
    }
    [pscustomobject]@{action=$Action; exit_code=0; json_response_valid=$true; provisioning_verified=$false}
}
