param($file)

$hash = Get-FileHash $file -Algorithm SHA256
Write-Output $hash.Hash
