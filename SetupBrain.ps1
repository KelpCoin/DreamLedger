# Install Python dependencies and register Brain as a Windows service
$root = "C:\BrownEyeCortex"
$brainDir = "$root\CortexBrain"

# Install Python if missing
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Install Python 3.10+ from python.org and re-run."
    exit 1
}

# Install required packages
python -m pip install pytumblr praw qrcode pillow requests --quiet

# Create Brain folder and copy script
New-Item -ItemType Directory -Force -Path $brainDir | Out-Null
Copy-Item "$root\CortexBrain.py" "$brainDir\CortexBrain.py" -Force

# Register scheduled task to run Brain at boot, repeat daily
$action = New-ScheduledTaskAction -Execute "python" -Argument "`"$brainDir\CortexBrain.py`""
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "CortexBrain" -Action $action -Trigger $trigger -RunLevel Highest -Force

Write-Host "Cortex Brain is installed and will start on next login. Run it manually with:"
Write-Host "python `"$brainDir\CortexBrain.py`""