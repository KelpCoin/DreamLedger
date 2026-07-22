$ROOT="D:\DreamLedgerMTG"

$bad=0
$count=0

Get-ChildItem "$ROOT\passports\*.json" | ForEach-Object {

    try {

        $json=Get-Content $_.FullName -Raw | ConvertFrom-Json

        if (!$json.asset_id) {
            Write-Host "FAIL missing asset_id $($_.Name)"
            $bad++
        }
        elseif (!$json.silo_id) {
            Write-Host "FAIL missing silo_id $($_.Name)"
            $bad++
        }
        else {
            $count++
        }

    }
    catch {
        Write-Host "FAIL invalid json $($_.Name)"
        $bad++
    }
}

if ($bad -eq 0) {
    Write-Host "PASS passports=$count"
}
else {
    Write-Host "FAIL invalid=$bad"
    exit 1
}
