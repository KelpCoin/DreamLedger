param(
    [string]$ProjectRef = "",
    [switch]$StartLocal,
    [switch]$GenerateTypes
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing command: $Name"
    }
}

Write-Host "CUBE local bootstrap"
Write-Host "===================="

Require-Command "git"
Require-Command "supabase"

if ($StartLocal) {
    Require-Command "docker"
}

if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "No local Supabase config found. Initializing..."
    supabase init
}

if ($StartLocal) {
    Write-Host "Starting local Supabase stack..."
    supabase start
}

if ($ProjectRef) {
    Write-Host "Linking repository to Supabase project $ProjectRef ..."
    supabase link --project-ref $ProjectRef
}

if ($GenerateTypes) {
    if (-not $StartLocal -and -not $ProjectRef) {
        throw "GenerateTypes requires -StartLocal or -ProjectRef."
    }

    if ($ProjectRef) {
        supabase gen types typescript --linked > database.types.ts
    } else {
        supabase gen types typescript --local > database.types.ts
    }

    Write-Host "Generated database.types.ts"
}

Write-Host ""
Write-Host "Bootstrap checks complete."
Write-Host ""
Write-Host "Recommended local loop:"
Write-Host "  supabase start"
Write-Host "  supabase db reset"
Write-Host "  git status"
Write-Host ""
Write-Host "For remote schema changes, review first:"
Write-Host "  supabase db push --dry-run"
Write-Host "  supabase db push"
Write-Host ""
Write-Host "Do not run db reset --linked against production."
