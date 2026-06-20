Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$domain = "dreamledger.org"
$wwwDomain = "www.$domain"

$maxRetries = 30
$sleepSec = 20

$root = "D:\BrownEyeCortex"
$logPath = "$root\logs\domain_kernel.log"
$flagPath = "$root\flags\domain_state.flag"
$truthPath = "$root\boot\domain_truth.json"

New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\flags" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\boot" | Out-Null

function Log($msg) {
    $line = "[$(Get-Date -Format o)] $msg"
    Add-Content -Path $logPath -Value $line
    Write-Host $line
}

# IMPORTANT: do NOT use $host (reserved variable)
function Check-DNS($target) {
    try {
        Resolve-DnsName $target -ErrorAction Stop | Out-Null
        return $true
    } catch { return $false }
}

function Check-HTTPS($target) {
    try {
        $req = [System.Net.WebRequest]::Create("https://$target")
        $req.Timeout = 8000
        $req.GetResponse() | Out-Null
        return $true
    } catch { return $false }
}

function State($dnsW,$dnsR,$httpsW) {
    if (-not $dnsW -and -not $dnsR) { return "RED_DNS_NOT_PROPAGATED" }
    if ($dnsW -and -not $httpsW) { return "AMBER_TLS_PENDING" }
    if ($dnsW -and $httpsW) { return "GREEN_DOMAIN_OPERATIONAL" }
    if ($dnsR -and -not $dnsW) { return "AMBER_APEX_ONLY" }
    return "RED_UNKNOWN"
}

Log "DOMAIN KERNEL START"

$state = "UNKNOWN"

for ($i=0; $i -lt $maxRetries; $i++) {

    $dnsW = Check-DNS $wwwDomain
    $dnsR = Check-DNS $domain
    $httpsW = Check-HTTPS $wwwDomain

    $state = State $dnsW $dnsR $httpsW

    Log "Attempt $i | DNS_WWW=$dnsW DNS_ROOT=$dnsR HTTPS_WWW=$httpsW STATE=$state"

    if ($state -eq "GREEN_DOMAIN_OPERATIONAL") { break }

    Start-Sleep -Seconds $sleepSec
}

@{
    timestamp = Get-Date -Format o
    domain = $domain
    www = $wwwDomain
    dns_www = $dnsW
    dns_root = $dnsR
    https_www = $httpsW
    state = $state
} | ConvertTo-Json | Set-Content $truthPath

Set-Content $flagPath $state

Log "DOMAIN KERNEL END"
Log "FINAL STATE: $state"

Write-Host "`nSTATE: $state`n"
