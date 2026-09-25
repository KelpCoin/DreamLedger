# Headless-friendly: process one job against LM Studio OpenAI-compatible API.
# Run on Windows GPU host. Does not touch Stripe.
param(
  [string]$JobPath = "", 
  [string]$BaseUrl = "http://localhost:1234/v1",
  [string]$Model = "local-model"
)

if (-not $JobPath -or -not (Test-Path $JobPath)) {
  Write-Error "Pass -JobPath to a job JSON file"
  exit 1
}

$job = Get-Content -Raw -Path $JobPath | ConvertFrom-Json
$prompt = @"
You are a copy worker for DreamLedger. Return JSON only matching output_schema.
Job type: $($job.type)
Input: $($job.input | ConvertTo-Json -Compress)
Schema: $($job.output_schema | ConvertTo-Json -Compress)
"@

$body = @{
  model = $Model
  messages = @(
    @{ role = "system"; content = "Return only valid JSON. No markdown." },
    @{ role = "user"; content = $prompt }
  )
  temperature = 0.4
} | ConvertTo-Json -Depth 6

try {
  $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/chat/completions" -ContentType "application/json" -Body $body
  $text = $resp.choices[0].message.content
  $outDir = Join-Path (Split-Path $JobPath -Parent) "..\outbox"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outFile = Join-Path $outDir ("$($job.job_id).result.json")
  @{
    job_id = $job.job_id
    ok = $true
    model = $Model
    content = $text
    finished_at = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json | Set-Content -Path $outFile -Encoding UTF8
  Write-Output "Wrote $outFile"
} catch {
  Write-Error $_
  exit 2
}
