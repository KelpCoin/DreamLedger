function Read-Jsonl {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @() }
    @(Get-Content $Path -Encoding UTF8 | Where-Object { $_ -match '\S' } | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { }
    } | Where-Object { $null -ne $_ })
}
function Append-Jsonl {
    param([string]$Path, [object]$Obj)
    $line = $Obj | ConvertTo-Json -Compress -Depth 10
    Add-Content -Path $Path -Value $line -Encoding UTF8
}
Export-ModuleMember -Function Read-Jsonl, Append-Jsonl