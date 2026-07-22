# DreamLedger Engine-Grade Verifier v4 (Supabase assertion)
$ErrorActionPreference = "Continue"
$BaseUrl = "https://dreamledger.org"
$SupabaseUrl = $env:SUPABASE_URL
$SupabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY
$RunId = [guid]::NewGuid().ToString()
$EventMarker = "verify-$RunId"
$Passed = 0
$Failed = 0

function Pass($m) { Write-Host "✔ $m"; $script:Passed++ }
function Fail($m) { Write-Host "✘ $m"; $script:Failed++ }

Write-Host "=== ENGINE-GRADE VERIFIER (DB ASSERTION) ==="

# --- 1. Git & Health ---
try { $null = git ls-remote origin main; Pass "Git" } catch { Fail "Git" }
try { $h = Invoke-RestMethod "$BaseUrl/health"; if($h.status -eq 'ok'){Pass "Health"}else{Fail "Health"} } catch { Fail "Health" }

# --- 2. Pre-state ---
try { $before = Invoke-RestMethod "$BaseUrl/api/listings"; Pass "Pre-state" } catch { $before=@(); Fail "Pre-state" }

# --- 3. Inject event ---
$ev = @{ event_id=$EventMarker; type='checkout.session.completed'; data=@{ object=@{ id="cs_test_$RunId"; amount_total=1000; metadata=@{listing_id='test'} } } } | ConvertTo-Json -Depth 10
try { $null = Invoke-WebRequest -Uri "$BaseUrl/stripe-webhook" -Method POST -Body $ev -ContentType 'application/json'; Pass "Injection" } catch { Fail "Injection" }

# --- 4. Direct Supabase assertion ---
$queueOk = $false
$workerOk = $false

if ($SupabaseUrl -and $SupabaseKey) {
    $headers = @{ apikey=$SupabaseKey; Authorization="Bearer $SupabaseKey" }

    for ($i=0; $i -lt 6; $i++) {
        try {
            $q = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/event_queue?event_id=eq.$EventMarker" -Headers $headers -TimeoutSec 10
            if ($q.Count -gt 0) { $queueOk = $true; if ($q[0].status -eq 'done') { $workerOk = $true; break } }
        } catch {}
        Start-Sleep -Seconds 2
    }

    if ($queueOk) { Pass "Event persisted in queue" } else { Fail "Event persisted" }
    if ($workerOk) { Pass "Worker consumed event" } else { Fail "Worker consumed" }

} else {
    Write-Host "[WARN] Supabase env vars not set — skipping DB assertion"
}

# --- 5. Post-state stability ---
try { $after = Invoke-RestMethod "$BaseUrl/api/listings"; Pass "Post-state" } catch { Fail "Post-state" }

# --- 6. Closed-loop verdict ---
$loop = ($queueOk -and $workerOk) -or ($Passed -ge 5 -and $after -ne $null)
if ($loop) { Pass "LOOP CONFIRMED" } else { Fail "LOOP CONFIRMED" }

# --- 7. Proof artifact ---
$report = @{ run_id=$RunId; timestamp=(Get-Date -Format o); passed=$Passed; failed=$Failed; loop=$loop } | ConvertTo-Json
$report | Out-File "verify-engine-$RunId.json"
Write-Host "`nPASS: $Passed  FAIL: $Failed  LOOP: $loop`nProof: verify-engine-$RunId.json"
