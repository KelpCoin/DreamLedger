$ErrorActionPreference = "Stop"
$outputDir = "D:\Cortex\output"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$targetSubs = @("EDH", "magicTCG", "CompetitiveEDH", "Commander", "MTG", "EDHbrews", "BudgetBrews")
$reportFile = Join-Path $outputDir "demand_radar_EDH.md"
$queueFile  = Join-Path $outputDir "comment_queue.jsonl"
$loopMinutes = 0   # single run

function Score-Post($Title, $SelfText) {
    $score = 0
    $fullText = "$Title $SelfText"
    if ($fullText -match "help|rate my|improve|upgrade|advice|feedback|suggestions") { $score += 3 }
    if ($fullText -match "keep losing|stuck|bricked|frustrated|not sure why|what am i doing wrong") { $score += 4 }
    if ($fullText -match "budget|cheap|new player|first deck|beginner") { $score += 2 }
    if ($fullText -match "commander|EDH|decklist|deck list|100 cards") { $score += 2 }
    return $score
}

function Get-DraftReply($title) {
    $templates = @(
        "I can spot a couple of structural issues in your list that are probably costing you games. I do quick $15 EDH fixes  want me to take a look?",
        "Saw your post. I usually find 23 hidden consistency problems in decks like yours. I break them down for $15, fast turnaround. Interested?",
        "If you're still tweaking, I can give you a clean upgrade path for $15. Usually takes me 10 min to find the biggest wins. Want it?"
    )
    return $templates[(Get-Random -Maximum $templates.Count)]
}

function Invoke-DemandRadar {
    Write-Host "Demand Radar scanning $($targetSubs -join ', ')" -ForegroundColor Cyan
    $reportLines = @("# EDH Demand Radar  $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "")
    foreach ($sub in $targetSubs) {
        Write-Host "Scanning r/$sub..."
        try {
            $rss = Invoke-RestMethod -Uri "https://www.reddit.com/r/$sub/.rss" -UseBasicParsing -TimeoutSec 15
        } catch {
            Write-Warning "RSS fetch failed for r/$sub"
            continue
        }
        $posts = $rss | Select-Xml -XPath "//entry" | ForEach-Object { $_.Node }
        foreach ($post in $posts) {
            $title   = $post.title.'#text'
            $link    = $post.link.'href'
            $content = $post.content.'#text' -replace '<[^>]+>', ''
            $score = Score-Post $title $content
            if ($score -ge 6) {
                $draft = Get-DraftReply $title
                $entry = @{
                    timestamp = (Get-Date).ToString("o")
                    subreddit = $sub
                    title     = $title
                    link      = $link
                    score     = $score
                    draft     = $draft
                    status    = "queued"
                } | ConvertTo-Json -Compress
                Add-Content -Path $queueFile -Value $entry
                $reportLines += "### r/$sub  Score: $score"
                $reportLines += "- **Title:** $title"
                $reportLines += "- **Link:** $link"
                $reportLines += "- **Draft:** ``$draft``"
                $reportLines += ""
                Write-Host "  Queued: $title" -ForegroundColor Green
            }
        }
    }
    if ($reportLines.Count -eq 2) { $reportLines += "*No highintent posts found this cycle.*" }
    $reportLines | Out-File $reportFile -Encoding UTF8
    Write-Host "Report saved to $reportFile" -ForegroundColor Yellow
}

Invoke-DemandRadar

