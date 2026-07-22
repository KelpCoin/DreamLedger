# GenerateOffers.ps1
$inbox = "C:\BrownEyeCortex\DreamLedger\signals\inbox"
$processed = "C:\BrownEyeCortex\DreamLedger\signals\converted"
$ignored = "C:\BrownEyeCortex\DreamLedger\signals\ignored"
$out = "C:\BrownEyeCortex\DreamLedger\offers\out"
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $inbox -Filter *.txt | ForEach-Object {
    $text = Get-Content $_.FullName -Raw
    if ([string]::IsNullOrWhiteSpace($text)) { Move-Item $_.FullName $ignored -Force; continue }
    $score = 0
    if ($text -match "(?i)(help|urgent|stuck|need)") { $score += 30 }
    if ($text -match "(?i)(automate|tool|software)") { $score += 20 }
    if ($text -match "(?i)(MTG|deck|card)") { $score += 15 }
    if ($score -ge 50) {
        $sku = @{
            title = "Solution for: " + ($text -replace '^.{0,50}','$&')
            description = "Custom solution based on demand signal."
            base_price_cents = 2000
            dsis_score = $score
            status = "draft"
        }
        $sku | ConvertTo-Json | Out-File "$out\$($_.BaseName).json" -Encoding utf8
        Move-Item $_.FullName $processed -Force
    } else {
        Move-Item $_.FullName $ignored -Force
    }
}
