#requires -version 5.1
[CmdletBinding()]
param(
  [string]$ProjectRef = "wbwgroygjeyukkspnqiy"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Error "supabase CLI not found"
  exit 1
}

& supabase migration list
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "FIGURE EIGHT VERIFY: migration history readable"
Write-Host "Expected private schema: figure_eight"
Write-Host "Expected economic truth: NZ$0 until independently verified external settlement"
Write-Host "Run the SQL verifier query in the repository contract before declaring governance PASS."
