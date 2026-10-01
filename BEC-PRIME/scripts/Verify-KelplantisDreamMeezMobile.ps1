param(
    [string]$RepoRoot = (Get-Location).Path
)
$ErrorActionPreference = 'Stop'
$targets = @(
    'public/kelplantis/index.html',
    'BEC-PRIME/compiler/universal-specs/kelplantis-dreammeez-mobile.v1.json'
)
$results = @()
foreach ($rel in $targets) {
    $p = Join-Path $RepoRoot $rel
    $results += [pscustomobject]@{ Path=$rel; Exists=(Test-Path -LiteralPath $p) }
}
$game = Get-Content -Raw (Join-Path $RepoRoot 'public/kelplantis/index.html')
$spec = Get-Content -Raw (Join-Path $RepoRoot 'BEC-PRIME/compiler/universal-specs/kelplantis-dreammeez-mobile.v1.json') | ConvertFrom-Json
$checks = @(
    ('touch_joystick', $game.Contains('id="joy"')),
    ('attack_control', $game.Contains('id="attack"')),
    ('boss_clear', $game.Contains('BOSS_CLEARED')),
    ('local_save', $game.Contains('localStorage.kelpFloor')),
    ('dreammeez_avatar', $spec.avatar_contract.avatar_id -eq 'DRMZ-AVT-001'),
    ('100_floors', [int]$spec.canonical_progression.floors -eq 100),
    ('no_external_runtime_dependencies', [int]$spec.mobile.external_runtime_dependencies -eq 0)
)
$failed = @($results | Where-Object { -not $_.Exists }) + @($checks | Where-Object { -not $_[1] })
Write-Host 'KELPLANTIS DREAMMEEZ MOBILE VERIFICATION'
$results | Format-Table -AutoSize
$checks | ForEach-Object { '{0}: {1}' -f $_[0], $(if ($_[1]) {'PASS'} else {'FAIL'}) }
if ($failed.Count -gt 0) { throw "Verification failed: $($failed.Count) check(s)." }
Write-Host 'RESULT: PASS'
