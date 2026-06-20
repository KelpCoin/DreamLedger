#Requires -Version 5.1
$ROOT        = 'C:\BrownEyeCortex'
$TASK_QUEUE  = "$ROOT\mesh\scheduler\queue\tasks.jsonl"
$RESULT_PATH = "$ROOT\mesh\executor\proof"
$LM_STUDIO   = 'http://localhost:1234/v1/chat/completions'
$OLLAMA      = 'http://localhost:11434/api/chat'

if (-not (Test-Path $TASK_QUEUE)) {
    Write-Host 'MODEL-ROUTER: no task queue. Nothing to dispatch.'; exit 0
}

function Invoke-LocalLLM {
    param([string]$SystemPrompt, [string]$UserPrompt, [int]$MaxTokens = 800)
    $body = @{
        model       = 'local-model'
        messages    = @(
            @{ role = 'system'; content = $SystemPrompt }
            @{ role = 'user';   content = $UserPrompt   }
        )
        temperature = 0.7
        max_tokens  = $MaxTokens
        stream      = $false
    } | ConvertTo-Json -Depth 5

    try {
        $r = Invoke-WebRequest -Uri $LM_STUDIO -Method POST -Body $body `
                 -ContentType 'application/json' -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
        return ($r.Content | ConvertFrom-Json).choices[0].message.content
    } catch { }

    try {
        $ollamaBody = @{
            model    = 'llama3'
            messages = @(
                @{ role = 'system'; content = $SystemPrompt }
                @{ role = 'user';   content = $UserPrompt   }
            )
            stream   = $false
        } | ConvertTo-Json -Depth 5
        $r = Invoke-WebRequest -Uri $OLLAMA -Method POST -Body $ollamaBody `
                 -ContentType 'application/json' -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
        return ($r.Content | ConvertFrom-Json).message.content
    } catch { }

    return $null
}

$tasks = @(Get-Content $TASK_QUEUE -Encoding UTF8 | Where-Object { $_ -match '\S' } | ForEach-Object {
    try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { }
} | Where-Object { $null -ne $_ -and $_.status -eq 'pending' })

$processed = 0
foreach ($task in $tasks) {
    $result = $null
    switch ([string]$task.type) {
        'generate_description' {
            $result = Invoke-LocalLLM `
                -SystemPrompt 'You are a product copywriter for Magic: The Gathering decks. Write compelling, accurate descriptions.' `
                -UserPrompt   "Write a 2-sentence product description for a Commander deck: $($task.payload.deck_name)"
        }
        'generate_hook' {
            $result = Invoke-LocalLLM `
                -SystemPrompt 'You are a social media copywriter. Write short, compelling posts that drive clicks.' `
                -UserPrompt   "Write a 1-sentence hook to sell this MTG deck: $($task.payload.deck_name) priced at $($task.payload.price)"
        }
        default {
            Write-Warning "Unknown task type: $($task.type)"
        }
    }

    if ($null -ne $result) {
        $proof = [ordered]@{
            task_id      = [string]$task.id
            type         = [string]$task.type
            result       = $result
            completed_utc = [DateTimeOffset]::UtcNow.ToString('o')
        }
        $proof | ConvertTo-Json -Depth 5 |
            Set-Content "$RESULT_PATH\result_$($task.id).json" -Encoding UTF8
        $processed++
    }
}

Write-Host "MODEL-ROUTER: $processed/$($tasks.Count) tasks processed."