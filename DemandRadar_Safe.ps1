<#
.SYNOPSIS
    Cortex Demand Radar  RateLimitSafe Public Scanner
    Uses public Reddit JSON API with throttling and backoff.
    Scans one subreddit every 2 seconds. No auth required.
#>
param([int]$LoopMinutes = 10)
$ErrorActionPreference = "Stop"
$outputDir = "D:\Cortex\output"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$userAgent = "CortexRadar/1.0 (by /u/HappyHomarid; ratesafe)"

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
        "Saw your post. I usually find 23 hidden consistency problems. I break them down for $15, fast turnaround. Interested?",
        "If you're still tweaking, I can give you a clean upgrade path for $15. Usually 10 min to find the biggest wins. Want it?"
    )
    return $templates[(Get-Random -Maximum $templates.Count)]
}

function Invoke-SafeRequest($sub) {
    $url = "https://www.reddit.com/r/$sub/new.json?limit=10"
    $backoff = 2
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            $resp = Invoke-RestMethod -Uri $url -Headers @{"User-Agent"=$userAgent} -TimeoutSec 15
            return $resp
        } catch {
            if ($attempt -eq 4) { throw $_ }
            Write-Host "  r/$sub attempt $attempt failed  waiting ${backoff}s" -ForegroundColor DarkYellow
            Start-Sleep -Seconds $backoff
            $backoff *= 2
        }
    }
}

function Invoke-DemandRadar {
    Write-Host "`n$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  Scanning Reddit (throttled)..." -ForegroundColor Cyan
    $queueFile = Join-Path $outputDir "comment_queue.jsonl"
    foreach ($sub in $targetSubs) {
        Write-Host "  Scanning r/$sub..." -ForegroundColor DarkGray
        try {
            $resp = Invoke-SafeRequest $sub
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
                    $entry = @{timestamp=(Get-Date).ToString("o"); sub=$sub; title=$post.title; link="https://reddit.com$($post.permalink)"; score=$score; draft=$draft} | ConvertTo-Json -Compress
                    Add-Content $queueFile $entry
                }
            }
        } catch {
            Write-Warning "r/$sub unreachable even after retries. Skipping."
        }
        Start-Sleep -Seconds 2   # <--- Ratelimit throttle between subs
    }
}

Write-Host "Cortex Demand Radar (ratesafe) started. Scanning every $LoopMinutes min." -ForegroundColor Green
while ($true) {
    Invoke-DemandRadar
    Start-Sleep -Seconds ($LoopMinutes * 60)
}
