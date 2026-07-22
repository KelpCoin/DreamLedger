# IngestSignals.ps1
$inbox = "C:\BrownEyeCortex\DreamLedger\signals\inbox"
if ((Get-ChildItem $inbox -Filter *.txt).Count -eq 0) {
    $topics = @("automate invoicing", "optimize MTG deck", "improve team communication")
    foreach ($t in $topics) {
        $text = "Need a solution to $t  urgent!"
        $hash = ([System.BitConverter]::ToString((New-Object Security.Cryptography.SHA256Managed).ComputeHash([Text.Encoding]::UTF8.GetBytes($text)))).Replace("-","")
        $text | Out-File "$inbox\$hash.txt" -Encoding utf8
        Write-Host "Generated synthetic signal: $hash"
    }
}
