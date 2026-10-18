# Optional local accelerator heartbeat for BECK.
# Requires LOCAL_HEARTBEAT_TOKEN to be set in this shell.
# Does not install software, open ports, enable checkout, or claim revenue.

[CmdletBinding()]
param(
  [string]$BaseUrl = $(if ($env:BECK_BASE_URL) { $env:BECK_BASE_URL } else { 'https://dreamledger1.onrender.com' }),
  [string]$LmStudioBaseUrl = $(if ($env:LM_STUDIO_BASE_URL) { $env:LM_STUDIO_BASE_URL } else { 'http://127.0.0.1:1234' }),
  [ValidateRange(10, 240)]
  [int]$IntervalSeconds = 60
)

$ErrorActionPreference = 'Stop'
$Token = [string]$env:LOCAL_HEARTBEAT_TOKEN
if ([string]::IsNullOrWhiteSpace($Token)) {
  throw 'LOCAL_HEARTBEAT_TOKEN is missing. Set it in this PowerShell session; never put it in this script or commit it.'
}

$CloudUri = [Uri]$BaseUrl
if ($CloudUri.Scheme -ne 'https') {
  throw 'BECK cloud BaseUrl must use HTTPS so the bearer token is not sent in clear text.'
}
$HeartbeatUri = $BaseUrl.TrimEnd('/') + '/api/toll/v1/local-heartbeat'
$ModelsUri = $LmStudioBaseUrl.TrimEnd('/') + '/v1/models'

Write-Host 'BECK optional local heartbeat started. Ctrl+C stops it. The cloud system does not depend on this process.'
Write-Host ("Cloud endpoint: {0}" -f $HeartbeatUri)
Write-Host ("Heartbeat interval: {0}s; stale after 300s." -f $IntervalSeconds)

while ($true) {
  $LmStudioReady = $false
  $ModelIds = @()

  try {
    $ModelResponse = Invoke-RestMethod -Method Get -Uri $ModelsUri -TimeoutSec 5
    $LmStudioReady = $true
    if ($null -ne $ModelResponse.data) {
      $ModelIds = @($ModelResponse.data | ForEach-Object {
        if ($null -ne $_.id) { [string]$_.id }
      } | Select-Object -First 20)
    }
  }
  catch {
    # Report unavailability rather than fabricating local readiness.
    $LmStudioReady = $false
    $ModelIds = @()
  }

  $Capacity = if ($LmStudioReady) { 'available' } else { 'offline' }
  $Payload = @{
    ts = [DateTime]::UtcNow.ToString('o')
    host = 'windows-local'
    lm_studio = [bool]$LmStudioReady
    # Model listing is not proof that three-role inference works.
    tri_llm = $false
    capacity = $Capacity
    models = @($ModelIds)
  } | ConvertTo-Json -Depth 5 -Compress

  try {
    $Response = Invoke-RestMethod -Method Post -Uri $HeartbeatUri -Headers @{
      Authorization = "Bearer $Token"
    } -ContentType 'application/json' -Body $Payload -TimeoutSec 10

    Write-Host ("[{0}] Heartbeat accepted; LM_Studio={1}; reported_models={2}; tri_llm=UNVERIFIED" -f
      [DateTime]::UtcNow.ToString('HH:mm:ssZ'),
      $LmStudioReady,
      $ModelIds.Count)
  }
  catch {
    # Do not print request headers or the exception object, which may contain sensitive context.
    Write-Warning ("[{0}] Cloud heartbeat failed; retrying in {1}s. Check endpoint/token configuration." -f
      [DateTime]::UtcNow.ToString('HH:mm:ssZ'),
      $IntervalSeconds)
  }

  Start-Sleep -Seconds $IntervalSeconds
}
