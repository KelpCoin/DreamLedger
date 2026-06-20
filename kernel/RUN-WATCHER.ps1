#Requires -Version 5.1
$ROOT    = 'C:\BrownEyeCortex'
$WATCH   = "$ROOT\DeckDrops\incoming"
$SCRIPT  = "$ROOT\Update-Store.ps1"

$fsw                     = New-Object System.IO.FileSystemWatcher $WATCH
$fsw.Filter              = '*.*'
$fsw.EnableRaisingEvents = $true
$fsw.IncludeSubdirectories = $false

$action = {
    $name = $Event.SourceEventArgs.Name
    $ext  = [System.IO.Path]::GetExtension($name).ToLower()
    if ($ext -in @('.csv','.txt','.json')) {
        Start-Sleep -Seconds 2
        Write-Host "File detected: $name  triggering pipeline..."
        & powershell.exe -ExecutionPolicy Bypass -File $SCRIPT
    }
}

Register-ObjectEvent $fsw Created -SourceIdentifier 'DeckDropWatcher' -Action $action | Out-Null
Write-Host "Watcher active on $WATCH  drop ManaBox exports to auto-process."

while ($true) { Start-Sleep -Seconds 5 }