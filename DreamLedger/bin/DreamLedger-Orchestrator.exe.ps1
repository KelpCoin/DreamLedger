Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

# =========================
# ROOT
# =========================
$ROOT = "C:\BrownEyeCortex\DreamLedger"

$PATHS = @{
    root   = $ROOT
    sku    = "$ROOT\sku"
    store  = "$ROOT\store"
    ledger = "$ROOT\ledger"
    queue  = "$ROOT\queue"
    logs   = "$ROOT\logs"
}

# =========================
# SELF-HEAL BOOTSTRAP
# =========================
foreach ($p in $PATHS.Values) {
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Force -Path $p | Out-Null
    }
}

$FILES = @{
    registry = "$($PATHS.sku)\registry.json"
    queue    = "$($PATHS.queue)\retry.json"
    log      = "$($PATHS.logs)\daemon.log"
    proof    = "$($PATHS.ledger)\cycle-proof.json"
}

function Log($m) {
    $line = "$(Get-Date -Format o) :: $m"
    Add-Content $FILES.log $line
    Write-Host $line
}

function Ensure-JsonFile($path, $default) {
    if (-not (Test-Path $path)) {
        $default | ConvertTo-Json -Depth 10 | Set-Content $path -Encoding UTF8
    }
}

function Arr($x) {
    if ($null -eq $x) { return @() }
    if ($x -is [array]) { return $x }
    return @($x)
}

# =========================
# BOOTSTRAP STATE (IMMUNE SYSTEM CORE)
# =========================
Ensure-JsonFile $FILES.registry @(
    @{ id=1; name="Atraxa EDH Deck"; price_nzd=15000; type="physical"; license="none" },
    @{ id=2; name="MTG Value Pack"; price_nzd=4999; type="digital"; license="resellable" }
)

Ensure-JsonFile $FILES.queue @()

# =========================
# LOADERS
# =========================
function Get-Registry {
    Arr (Get-Content $FILES.registry -Raw | ConvertFrom-Json)
}

function Get-Queue {
    Arr (Get-Content $FILES.queue -Raw | ConvertFrom-Json)
}

function Save-Queue($q) {
    $q | ConvertTo-Json -Depth 10 | Set-Content $FILES.queue -Encoding UTF8
}

# =========================
# SAFE EXECUTORS (NO FAIL CRASH)
# =========================
function Try-Supabase($item) {
    $u = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
    $k = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")

    if (-not $u -or -not $k) { return $false }

    try {
        Invoke-RestMethod -Method Post `
            -Uri "$u/rest/v1/cards" `
            -Headers @{ apikey=$k; Authorization="Bearer $k"; "Content-Type"="application/json" } `
            -Body ($item | ConvertTo-Json -Depth 5) | Out-Null

        return $true
    } catch {
        return $false
    }
}

function Try-Stripe($item) {
    $k = [Environment]::GetEnvironmentVariable("STRIPE_SECRET_KEY")
    if (-not $k) { return $false }

    try {
        Invoke-RestMethod -Uri "https://api.stripe.com/v1/products" `
            -Method Post `
            -Headers @{ Authorization="Bearer $k" } `
            -Body "name=$($item.name)&metadata[id]=$($item.id)" `
            -ContentType "application/x-www-form-urlencoded" | Out-Null

        return $true
    } catch {
        return $false
    }
}

# =========================
# RENDER ENGINE (SAFE)
# =========================
function Render-Store($registry) {
    $html = "<html><body><h1>DreamLedger</h1>"

    foreach ($i in $registry) {
        $price = [math]::Round($i.price_nzd/100,2)
        $html += "<div><h3>$($i.name)</h3><p>NZD $price</p></div>"
    }

    $html += "</body></html>"

    $file = "$($PATHS.store)\store.html"
    [System.IO.File]::WriteAllText($file, $html, [Text.Encoding]::UTF8)

    return $file
}

# =========================
# IMMUNE QUEUE SYSTEM
# =========================
function Push-Queue($type,$payload) {
    $q = Get-Queue
    $q += @{ type=$type; payload=$payload; ts=(Get-Date -Format o) }
    Save-Queue $q
}

function Drain-Queue {
    $q = Get-Queue
    if ($q.Count -eq 0) { return }

    $remaining = @()

    foreach ($job in $q) {
        $ok = $false

        if ($job.type -eq "supabase") { $ok = Try-Supabase $job.payload }
        if ($job.type -eq "stripe")   { $ok = Try-Stripe $job.payload }

        if (-not $ok) { $remaining += $job }
    }

    Save-Queue $remaining
}

# =========================
# CYCLE ENGINE
# =========================
function Cycle {
    $registry = Get-Registry
    $item = $registry | Select-Object -First 1

    if (-not $item) { return }

    $supa = Try-Supabase $item
    $stripe = Try-Stripe $item

    if (-not $supa) { Push-Queue "supabase" $item }
    if (-not $stripe) { Push-Queue "stripe" $item }

    $storeFile = Render-Store $registry

    $proof = @{
        ts = (Get-Date -Format o)
        item = $item.name
        queue = (Get-Queue).Count
        supa = $supa
        stripe = $stripe
        store = $storeFile
        status = "OK"
    }

    $proof | ConvertTo-Json -Depth 5 | Set-Content $FILES.proof -Encoding UTF8
}

# =========================
# DAEMON LOOP (IMMUNE HEART)
# =========================
Log "ORCHESTRATOR ONLINE"

while ($true) {
    try {
        Drain-Queue
        Cycle
    } catch {
        Log "FATAL SAFE-CATCH: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 30
}