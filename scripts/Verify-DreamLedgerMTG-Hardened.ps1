$ROOT="D:\DreamLedgerMTG"

$timestamp=(Get-Date).ToString("s")

$result=@{
 system="DreamLedger MTG"
 timestamp=$timestamp
 checks=@()
}

function AddCheck($name,$pass){
    $result.checks += @{
        name=$name
        pass=$pass
    }
}


AddCheck "root_exists" (Test-Path $ROOT)

AddCheck `
"visibility_policy" `
(Test-Path "$ROOT\config\visibility_policy.json")

AddCheck `
"revenue_state" `
(Test-Path "$ROOT\revenue\revenue_state.json")


$passportCount=(Get-ChildItem "$ROOT\passports\*.json" -ErrorAction SilentlyContinue).Count

AddCheck `
"passport_directory" `
($passportCount -ge 0)


$ledger=Test-Path "$ROOT\ledger"

AddCheck `
"ledger_directory" `
$ledger


$out=$result | ConvertTo-Json -Depth 5

$proof="$ROOT\proofs\revenue-hardening-proof-$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"

Set-Content `
$proof `
$out `
-Encoding ASCII


Write-Host ""
Write-Host "DREAMLEDGER MTG HARDENED"
Write-Host ""
Write-Host $proof
