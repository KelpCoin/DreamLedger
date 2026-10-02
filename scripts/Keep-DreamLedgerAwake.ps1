# DreamLedger local runtime watchdog. ASCII-only, PowerShell 5.1 compatible.
# Keeps the machine awake on AC and starts the existing runtime if it is not listening.
$ErrorActionPreference='SilentlyContinue'
$Root='C:\BrownEyeCortex'
$LogDir='D:\BrownEyeCortex\logs'
if(-not(Test-Path $LogDir)){New-Item -ItemType Directory -Path $LogDir -Force|Out-Null}
$Log=Join-Path $LogDir 'dreamledger-watchdog.log'
function Log([string]$m){Add-Content -Path $Log -Value ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$m)}
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /change monitor-timeout-ac 30 | Out-Null
$port=3000
$tcp=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if(-not $tcp){
  $start=Join-Path $Root 'BEC-PRIME\start.js'
  if(Test-Path $start){
    Start-Process -FilePath 'node.exe' -ArgumentList ('"{0}"' -f $start) -WorkingDirectory (Split-Path $start) -WindowStyle Hidden
    Log 'Runtime start requested.'
  } else { Log 'Runtime start skipped: start.js not found.' }
} else { Log 'Runtime already listening.' }
