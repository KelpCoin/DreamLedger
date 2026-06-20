# ============================================================
# RUN-REVENUE.ps1  Master orchestrator for autonomous cycle
# ============================================================
$ErrorActionPreference = 'Continue'
$ROOT = 'C:\BrownEyeCortex'

# 1. Ingest SGF + bridge (if available)
if (Test-Path "$ROOT\Bridge-SGF2Cortex.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$ROOT\Bridge-SGF2Cortex.ps1" -ForceAll
}

# 2. Word engine
if (Test-Path "$ROOT\WORD-ENGINE.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$ROOT\WORD-ENGINE.ps1" -VerticalHint 'mtg'
}

# 3. Winner amplifier (score & cull)
if (Test-Path "$ROOT\WINNER-AMPLIFIER.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$ROOT\WINNER-AMPLIFIER.ps1"
}

# 4. Update store (regenerate store.html)
if (Test-Path "$ROOT\Update-Store.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$ROOT\Update-Store.ps1"
}

# 5. Traffic blaster
if (Test-Path "$ROOT\TRAFFIC-BLASTER.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$ROOT\TRAFFIC-BLASTER.ps1" -Force
}

# 6. Planetary syndicator
if (Test-Path "$ROOT\PLANETARY-SYNDICATOR.ps1") {
    & powershell -ExecutionPolicy Bypass -File "$ROOT\PLANETARY-SYNDICATOR.ps1"
}

Write-Host "RUN-REVENUE cycle complete."
