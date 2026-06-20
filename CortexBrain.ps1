# CortexBrain.ps1 — Autonomous decision engine (PowerShell, no gateways)
$LM_URL = "http://localhost:1234/v1/chat/completions"
$ROOT = "C:\BrownEyeCortex"
$REGISTRY = "$ROOT\data\registry.json"
$LOOP_SLEEP = 600  # 10 minutes

while ($true) {
    # 1. Pull latest Reddit demand signals (already being collected by SGF)
    $demandFile = "D:\Cortex\output\demand_radar_SaaS.md"
    $demandText = if (Test-Path $demandFile) { Get-Content $demandFile -Raw } else { "" }

    # 2. Ask LM Studio to propose a new product based on demand
    $prompt = @"
You are Cortex, an autonomous business brain. Based on the following demand signals, suggest ONE new digital product to create.
Return ONLY valid JSON: { "name": "...", "description": "...", "price_cents": 2900, "niche": "..." }

Demand signals:
$demandText
"@

    $body = @{
        model = "local-model"
        messages = @(@{role="system";content="You are a product creation AI. Reply only with JSON."}, @{role="user";content=$prompt})
        temperature = 0.7
        max_tokens = 300
    } | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-RestMethod -Uri $LM_URL -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
        $raw = $response.choices[0].message.content
        $json = [regex]::Match($raw, '\{[\s\S]*\}').Value
        $idea = $json | ConvertFrom-Json

        # 3. Create Stripe product & payment link
        $STRIPE_KEY = [Environment]::GetEnvironmentVariable('STRIPE_SECRET_KEY','Machine')
        $product = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/products' -Method Post `
            -Headers @{Authorization="Bearer $STRIPE_KEY"} `
            -Body "name=$($idea.name)&metadata[sku_id]=$($idea.name -replace '[^a-z0-9]','-')" `
            -ContentType 'application/x-www-form-urlencoded'
        $price = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/prices' -Method Post `
            -Headers @{Authorization="Bearer $STRIPE_KEY"} `
            -Body "unit_amount=$($idea.price_cents)&currency=nzd&product=$($product.id)" `
            -ContentType 'application/x-www-form-urlencoded'
        $link = Invoke-RestMethod -Uri 'https://api.stripe.com/v1/payment_links' -Method Post `
            -Headers @{Authorization="Bearer $STRIPE_KEY"} `
            -Body "line_items[0][price]=$($price.id)&line_items[0][quantity]=1" `
            -ContentType 'application/x-www-form-urlencoded'

        # 4. Add to registry
        $registry = Get-Content $REGISTRY -Raw | ConvertFrom-Json
        $newSku = [PSCustomObject]@{
            id = ($idea.name -replace '[^a-z0-9]','-').ToLower()
            name = $idea.name
            description = $idea.description
            price_nzd = $idea.price_cents
            stripe_link = $link.url
            listed_utc = [DateTimeOffset]::UtcNow.ToString('o')
        }
        $registry += $newSku
        $registry | ConvertTo-Json -Depth 5 | Set-Content $REGISTRY -Encoding UTF8

        # 5. Rebuild and deploy store (Render)
        & C:\BrownEyeCortex\deploy-to-render.ps1   # you already have this logic

        Write-Host "New product added: $($idea.name) — $($link.url)"
    } catch {
        Write-Host "Brain cycle error: $_"
    }

    Start-Sleep -Seconds $LOOP_SLEEP
}