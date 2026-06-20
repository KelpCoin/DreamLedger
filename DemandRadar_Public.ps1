<#
.SYNOPSIS
    Cortex Demand Radar  ZeroAuth Reddit EDH Scanner
    Uses public Reddit JSON API (no login required) to find deckhelp
    posts, scores them, and displays live leads in the console.
    Runs continuously; press Ctrl+C to stop.
#>
param([int]$LoopMinutes = 10)

$ErrorActionPreference = "Stop"
$outputDir = "D:\Cortex\output"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$userAgent = "CortexDemandRadar/1.0 (by /u/HappyHomarid)"

# Subreddits to scan (public JSON works for any that aren't private)
$targetSubs = @("EDH", "magicTCG", "CompetitiveEDH", "EDHbrews", "BudgetBrews", "Commander", "MTG")

function Score-Post($Title, $SelfText) {
    $fullText = "$Title $SelfText"
    $score = 0
    if ($fullText -match "help|rate my|improve|upgrade|advice|feedback|suggestions") { $score += 3 }
    if ($fullText -match "keep losing|stuck|bricked|frustrated|not sure why|what am i doing wrong") { $score += 4 }
    if ($fullText -match "budget|cheap|new player|first deck|beginner") { $score += 2 }
    if ($fullText -match "commander|EDH|decklist|deck list|100 cards") { $score += 2 }
    return $score
}

function Get-DraftReply {
    $templates = @(
        "I can spot a couple of structural issues in your list that are probably costing you games. I do quick $15 EDH fixes  want me to take a look?",
        "Saw your post. I usually find 23 hidden consistency problems in decks like yours. I break them down for $15, fast turnaround. Interested?",
        "If you're still tweaking, I can give you a clean upgrade path for $15. Usually takes me 10 min to find the biggest wins. Want it?"
    )
    return $templates[(Get-Random -Maximum $templates.Count)]
}

function Invoke-DemandRadar {
    Write-Host "`n$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  Scanning Reddit..." -ForegroundColor Cyan
    $queueFile = Join-Path $outputDir "comment_queue.jsonl"
    foreach ($sub in $targetSubs) {
        try {
            $url = "https://www.reddit.com/r/$sub/new.json?limit=25"
            $resp = Invoke-RestMethod -Uri $url -Headers @{"User-Agent"=$userAgent} -TimeoutSec 15
            foreach ($post in $resp.data.children.data) {
                $score = Score-Post $post.title $post.selftext
                if ($score -ge 6) {
                    $draft = Get-DraftReply
                    Write-Host "----------------------------------------" -ForegroundColor Green
                    Write-Host "r/$sub  |  Score: $score" -ForegroundColor Yellow
                    Write-Host "Title: $($post.title)" -ForegroundColor White
                    Write-Host "Link : https://reddit.com$($post.permalink)" -ForegroundColor Gray
                    Write-Host "Draft: $draft" -ForegroundColor Cyan
                    Write-Host "----------------------------------------`n"
                    # Save to queue file
                    $entry = @{timestamp=(Get-Date).ToString("o"); sub=$sub; title=$post.title; link="https://reddit.com$($post.permalink)"; score=$score; draft=$draft} | ConvertTo-Json -Compress
                    Add-Content $queueFile $entry
                }
            }
        } catch {
            Write-Warning "r/$sub unreachable  Reddit may be ratelimiting. Skipping."
        }
    }
}

Write-Host "Cortex Demand Radar (Public JSON) started. Scanning every $LoopMinutes min." -ForegroundColor Green
while ($true) {
    Invoke-DemandRadar
    Start-Sleep -Seconds ($LoopMinutes * 60)
}
