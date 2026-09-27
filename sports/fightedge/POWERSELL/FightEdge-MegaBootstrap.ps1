#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = 'C:\BrownEyeCortex\Silos\FIGHTEDGE'
$Proof = 'D:\BrownEyeCortex\FIGHTEDGE\Proof'
$Log = 'D:\BrownEyeCortex\FIGHTEDGE\Logs'
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

$Dirs = @(
  $Root,$Proof,$Log,
  "$Root\Config","$Root\Registry","$Root\Evidence","$Root\Punditry",
  "$Root\Market","$Root\Thesis","$Root\Outcome","$Root\Oracle",
  "$Root\Gauntlet","$Root\Products","$Root\Public","$Root\Private","$Root\Bets"
)
$Dirs | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }

# Clone the proven MTG silo shape only. Do not copy MTG content or buyers.
$masterPattern = @{
  master_silo='MTG'; inheritance='STRUCTURE_ONLY'
  content_inheritance=$false; domain_mixing=$false; public_surface='FIGHTEDGE'
} | ConvertTo-Json -Depth 5
$masterPattern | Set-Content "$Root\Registry\master-pattern.json" -Encoding ASCII

# Internal configuration. Never publish this file.
$config = @{
  module='fightedge'; version='1.2'; domain='combat_sports'; initial_focus='UFC'
  expansion=@('boxing','kickboxing','grappling','combat_sports')
  auto_wager=$false; public_release_requires_approval=$true
  live_financial_action_requires_approval=$true; evidence_first=$true
  source_truth='Truth Oracle'; challenge_layer='Gauntlet'; contract_kernel='CUBE'
  public_language_mode='CLEAN'
  public_internal_terms_forbidden=@(
    'CUBE','Cortex','Elohim','Gauntlet','Truth Oracle','DreamLedger',
    'FIGHTEDGE_INTERNAL','commerce_cells','economic_silo_loops','service_role'
  )
} | ConvertTo-Json -Depth 8
$config | Set-Content "$Root\Private\module.json" -Encoding ASCII

# Public identity. Deliberately free of internal architecture language.
$public = @{
  brand='Fight Edge - MMA/Boxing'
  public_name='Fight Edge - MMA/Boxing'
  slug='fight-edge-mma-boxing'
  focus='MMA and Boxing'
  description='Evidence-led fight information, analysis, discussion and historical context.'
  sections=@('UFC','Boxing','Fighters','Events','Results','Analysis','Discussion')
  betting_content='Optional research context only. No guarantees.'
  public_release=$true
} | ConvertTo-Json -Depth 8
$public | Set-Content "$Root\Public\identity.json" -Encoding ASCII

# Freeze the actual user-entered wager as an internal test record.
$bet = @{
  bet_id='FE-BET-20260927-LH-SUB-001'
  recorded_utc=$Stamp
  bookmaker='Betcha'
  stake_nzd=20.00
  stake_type='BONUS_CASH'
  selection='Luis Hernandez'
  market='WIN_BY_SUBMISSION'
  expected_return_nzd=32.00
  cash_profit_if_settled_as_expected_nzd=12.00
  status='OPEN'
  note='Real wager entered by user. Do not count as Fight Edge revenue or product performance.'
} | ConvertTo-Json -Depth 8
$bet | Set-Content "$Root\Bets\FE-BET-20260927-LH-SUB-001.json" -Encoding ASCII

# Freeze the reasoning before the result.
$thesis = @{
  thesis_id='FE-THESIS-20260927-LH-SUB-001'
  recorded_utc=$Stamp
  event='UFC Vegas 121: Luis Hernandez vs Sedriques Dumas'
  selection='Luis Hernandez'; method='Submission'
  supporting_points=@(
    'User thesis: 63 percent of Hernandez wins by submission.',
    'Opponent entered on a documented losing or winless skid.',
    'Dumas has documented submission losses.'
  )
  counterpoints=@(
    'Short-notice turnaround for Hernandez.',
    'Dumas has major height and reach advantages.',
    'Dumas has documented knockout power.'
  )
  excluded_evidence=@(
    'Appearance-based judgments',
    'Unverified drug-use speculation',
    'Claims without a source'
  )
  frozen=$true
} | ConvertTo-Json -Depth 8
$thesis | Set-Content "$Root\Thesis\FE-THESIS-20260927-LH-SUB-001.json" -Encoding ASCII

# Public catalog: title-case brand, horizontal carousels, CTA cards.
$catalogJson = @{
  brand='Fight Edge - MMA/Boxing'
  navigation=@('MMA','Boxing','Fighters','Events','Analysis','Results')
  catalog=@(
    @{title='MMA';description='Fight information, form, matchup context and historical results.';cta='Explore MMA'}
    @{title='Boxing';description='Bout context, fighter records, styles, form and historical comparisons.';cta='Explore Boxing'}
    @{title='Fighters';description='Source-backed fighter profiles and documented records.';cta='Browse Fighters'}
    @{title='Events';description='Upcoming and completed cards with matchup details and results.';cta='View Events'}
    @{title='Analysis';description='Evidence-led breakdowns with facts, attributed views and uncertainty kept distinct.';cta='Read Analysis'}
    @{title='Results';description='Method of victory, outcomes and retrospective fight history.';cta='View Results'}
  )
  cta_cards=@(
    @{title='Upcoming fights';description='See the next MMA and boxing cards.'}
    @{title='Fighter files';description='Open a clean fighter profile.'}
    @{title='Fight analysis';description='Read matchup context before the bell.'}
    @{title='Results & history';description='Track what happened after the event.'}
  )
} | ConvertTo-Json -Depth 8
$catalogJson | Set-Content "$Root\Public\catalog.json" -Encoding ASCII

$catalogHtml = @'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fight Edge - MMA/Boxing</title>
<meta name="description" content="Evidence-led fight information, analysis, discussion and historical context.">
<style>
:root{--bg:#070707;--panel:#101010;--panel2:#151515;--text:#f6f6f1;--muted:#a8a8a0;--line:#2b2b28;--gold:#d4af37}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:16px Arial,Helvetica,sans-serif}
main{min-height:100vh;padding:28px}.hero{max-width:980px;padding:70px 0 55px}.eyebrow{margin:0 0 12px;color:var(--gold);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
h1{margin:0;max-width:900px;font-size:clamp(44px,7vw,92px);line-height:.95;letter-spacing:-.045em}.lede{max-width:700px;margin:24px 0 0;color:var(--muted);font-size:20px;line-height:1.5}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.cta{display:inline-flex;padding:14px 18px;border:1px solid var(--line);font-weight:700}.cta.primary{background:var(--gold);border-color:var(--gold);color:#090909}
.section{padding:45px 0}.heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:18px}h2{margin:0;font-size:clamp(28px,4vw,44px);letter-spacing:-.03em}.hint{margin:0;color:var(--muted);font-size:13px}
.carousel{display:flex;gap:16px;overflow-x:auto;overflow-y:hidden;padding:4px 4px 18px;scroll-snap-type:x mandatory;scrollbar-width:thin}.carousel::-webkit-scrollbar{height:8px}.carousel::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px}
.card{min-width:min(78vw,360px);min-height:290px;padding:24px;border:1px solid var(--line);background:linear-gradient(150deg,var(--panel2),var(--panel));display:flex;flex-direction:column;justify-content:space-between;scroll-snap-align:start}
.card h3{margin:8px 0 12px;font-size:28px}.card p{color:var(--muted);line-height:1.55}.card .tag{color:var(--muted);font-size:12px;letter-spacing:.12em;text-transform:uppercase}.card a{display:flex;justify-content:space-between;gap:10px;padding:13px 16px;border:1px solid var(--line);font-weight:700}
footer{display:flex;justify-content:space-between;gap:16px;padding:34px 0 12px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}@media(max-width:700px){main{padding:18px}.hero{padding-top:52px}.heading{align-items:flex-start;flex-direction:column}footer{flex-direction:column}}
</style>
</head>
<body>
<main>
<section class="hero">
<p class="eyebrow">Fight Edge - MMA/Boxing</p>
<h1>Fight information without the noise.</h1>
<p class="lede">Evidence-led fight information, analysis, discussion and historical context.</p>
<div class="cta-row"><a class="cta primary" href="#catalog">Explore the catalog</a><a class="cta" href="#quick">Latest analysis</a></div>
</section>
<section id="catalog" class="section">
<div class="heading"><div><p class="eyebrow">Catalog</p><h2>Explore Fight Edge</h2></div><p class="hint">Swipe or shift-scroll horizontally</p></div>
<div class="carousel">
<article class="card"><div><span class="tag">Fight Edge</span><h3>MMA</h3><p>Fight information, form, matchup context and historical results.</p></div><a href="#">Explore MMA <span>→</span></a></article>
<article class="card"><div><span class="tag">Fight Edge</span><h3>Boxing</h3><p>Bout context, fighter records, styles, form and historical comparisons.</p></div><a href="#">Explore Boxing <span>→</span></a></article>
<article class="card"><div><span class="tag">Fight Edge</span><h3>Fighters</h3><p>Source-backed fighter profiles and documented records.</p></div><a href="#">Browse Fighters <span>→</span></a></article>
<article class="card"><div><span class="tag">Fight Edge</span><h3>Events</h3><p>Upcoming and completed cards with matchup details and results.</p></div><a href="#">View Events <span>→</span></a></article>
<article class="card"><div><span class="tag">Fight Edge</span><h3>Analysis</h3><p>Evidence-led breakdowns with facts, attributed views and uncertainty kept distinct.</p></div><a href="#">Read Analysis <span>→</span></a></article>
<article class="card"><div><span class="tag">Fight Edge</span><h3>Results</h3><p>Method of victory, outcomes and retrospective fight history.</p></div><a href="#">View Results <span>→</span></a></article>
</div>
</section>
<section id="quick" class="section">
<div class="heading"><div><p class="eyebrow">Quick access</p><h2>Start here</h2></div></div>
<div class="carousel">
<a class="card" href="#"><div><h3>Upcoming fights</h3><p>See the next MMA and boxing cards.</p></div><span>→</span></a>
<a class="card" href="#"><div><h3>Fighter files</h3><p>Open a clean fighter profile.</p></div><span>→</span></a>
<a class="card" href="#"><div><h3>Fight analysis</h3><p>Read matchup context before the bell.</p></div><span>→</span></a>
<a class="card" href="#"><div><h3>Results &amp; history</h3><p>Track what happened after the event.</p></div><span>→</span></a>
</div>
</section>
<footer><span>Fight Edge - MMA/Boxing</span><span>Information first. Context over noise.</span></footer>
</main>
</body>
</html>
'@
$catalogHtml | Set-Content "$Root\Public\index.html" -Encoding UTF8

# Hard public-surface contamination check.
$publicText = Get-Content "$Root\Public\identity.json" -Raw
$forbidden=@(
  'CUBE','Cortex','Elohim','Gauntlet','Truth Oracle','DreamLedger',
  'FIGHTEDGE_INTERNAL','commerce_cells','economic_silo_loops','service_role'
)
$hits=@($forbidden | Where-Object { $publicText -match [regex]::Escape($_) })
if($hits.Count -gt 0){ throw "PUBLIC_SURFACE_CONTAMINATED: $($hits -join ',')" }

# Optional binding to one existing unused commerce cell.
# The service-role key is read only from an environment variable and is never printed or stored.
$remoteStatus='NOT_ATTEMPTED'
$cellId=$null
$supabaseUrl=$env:FIGHTEDGE_SUPABASE_URL
$supabaseKey=$env:FIGHTEDGE_SUPABASE_SERVICE_ROLE_KEY

if($supabaseUrl -and $supabaseKey){
  try {
    $headers=@{
      apikey=$supabaseKey
      Authorization="Bearer $supabaseKey"
      'Content-Type'='application/json'
    }

    $uri="$supabaseUrl/rest/v1/commerce_cells?select=cell_id,silo,name,state&or=(silo.is.null,silo.eq.)&limit=1"
    $rows=@(Invoke-RestMethod -Method Get -Uri $uri -Headers $headers)

    if($rows.Count -gt 0){
      $cellId=$rows[0].cell_id
      $patch=@{
        silo='Fight Edge - MMA/Boxing'; name='Fight Edge - MMA/Boxing'; state='ACTIVE'; acquisition_state='RESEARCH'
        approval_required=$true; verified_checkout=$false
        verified_fulfillment=$false; verified_webhook=$false
        metadata=@{
          public_brand='Fight Edge - MMA/Boxing'; public_slug='fight-edge-mma-boxing'; domain='combat_sports'
          initial_focus='UFC'; public_language_mode='CLEAN'
        }
      } | ConvertTo-Json -Depth 8
      $patchUri="$supabaseUrl/rest/v1/commerce_cells?cell_id=eq.$cellId"
      Invoke-RestMethod -Method Patch -Uri $patchUri -Headers $headers -Body $patch | Out-Null
      $remoteStatus='CELL_BOUND'
    } else {
      $remoteStatus='NO_UNUSED_CELL_FOUND'
    }
  } catch {
    $remoteStatus="REMOTE_BIND_ERROR: $($_.Exception.Message)"
  }
}

$proof=@{
  proof_id="FIGHTEDGE-BOOT-$Stamp"; module='FIGHTEDGE'; created_utc=$Stamp
  root=$Root; proof_dir=$Proof; log_dir=$Log; status='BOOTSTRAP_READY'
  master_pattern='MTG_STRUCTURE_ONLY'; public_surface='CLEAN'; public_name='Fight Edge - MMA/Boxing'
  remote_cell_status=$remoteStatus; remote_cell_id=$cellId
  wager_recorded=$true; auto_wager=$false
  public_release_requires_approval=$true
  note='Local scaffold and pre-event wager record only. This script does not place wagers.'
}

$proofPath="$Proof\$($proof.proof_id).json"
$proofJson=$proof | ConvertTo-Json -Depth 8
$proofJson | Set-Content $proofPath -Encoding ASCII
"[$Stamp] FIGHTEDGE bootstrap complete: $proofPath" | Add-Content "$Log\bootstrap.log" -Encoding ASCII

Write-Host 'FIGHTEDGE READY'
Write-Host "Proof: $proofPath"
Write-Host "Remote cell: $remoteStatus"
Write-Host "Verify: Get-Content '$proofPath' | ConvertFrom-Json | Format-List"
