$LOG_FILE = "C:\BrownEyeCortex\logs\cortex.log"
function Write-CortexLog {
    param([string]$Level, [string]$Component, [string]$Message)
    $ts   = [DateTimeOffset]::UtcNow.ToString("o")
    $line = "[$ts] [$Level] [$Component] $Message"
    Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
    switch ($Level) {
        "ERROR" { Write-Host $line -ForegroundColor Red    }
        "WARN"  { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line -ForegroundColor Gray   }
    }
}
Export-ModuleMember -Function Write-CortexLog