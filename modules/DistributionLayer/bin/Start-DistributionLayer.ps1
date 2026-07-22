param([switch]$Loop = $true)
. 'C:\BrownEyeCortex\modules\Foundation\bin\Foundation.Common.ps1'

$r = Get-RootMap
$base = Join-Path $r.module_data_root 'DistributionLayer'
$pendingDir = Join-Path $base 'approvals\pending'
$approvedDir = Join-Path $base 'approvals\done'
$deliveryDir = Join-Path $base 'delivery'
$dispatchDir = Join-Path $base 'dispatch'
$proofDir = Join-Path $base 'proof'
$ledger = Join-Path $base 'ledgers\distribution.jsonl'
$normalizedDir = Join-Path $r.module_data_root 'PaymentGateway\queue\normalized'
$offerCatalogPath = 'C:\BrownEyeCortex\modules\DistributionLayer\config\offers.json'

foreach ($d in @($pendingDir,$approvedDir,$deliveryDir,$dispatchDir,$proofDir)) { Ensure-Dir $d }

$offers = Read-JsonFile -Path $offerCatalogPath
if ($null -eq $offers) { $offers = @() }

while ($Loop) {
    try {
        $events = Get-ChildItem -LiteralPath $normalizedDir -File -Filter '*.json' | Sort-Object LastWriteTimeUtc
        foreach ($evtFile in $events) {
            $evt = Read-JsonFile -Path $evtFile.FullName
            if ($null -eq $evt) { continue }
            $sku = $evt.sku
            $offer = $offers | Where-Object { $_.sku -eq $sku } | Select-Object -First 1
            if ($null -eq $offer) { $offer = [ordered]@{ title = 'Unknown'; price_nzd = '??'; delivery = 'manual followup' } }

            $stamp = UtcStamp
            $deliveryPack = [ordered]@{
                event_id = $evt.event_id
                offer = $offer
                payer = $evt.email
                amount = $evt.amount_total
                utc = UtcIso
                status = 'delivered'
            }
            $deliveryPath = Join-Path $deliveryDir ("delivery_$stamp.json")
            Write-JsonFile -Path $deliveryPath -InputObject $deliveryPack

            $dispatchPack = [ordered]@{
                event_id = $evt.event_id
                approved = $false
                message = "Paid: $($offer.title) NZD $($offer.price_nzd) from $($evt.email)"
                surfaces = @('discord')
            }
            $pendingPath = Join-Path $pendingDir ("dispatch_$stamp.json")
            Write-JsonFile -Path $pendingPath -InputObject $dispatchPack

            Append-Jsonl -Path $ledger -InputObject ([ordered]@{ utc = UtcIso; action = 'delivery'; event_id = $evt.event_id; delivery = $deliveryPath; dispatch_pending = $pendingPath })
            Remove-Item -LiteralPath $evtFile.FullName -Force
        }

        # Process approved dispatches
        $approved = Get-ChildItem -LiteralPath $approvedDir -File -Filter 'dispatch_*.json' | Sort-Object LastWriteTimeUtc
        foreach ($appFile in $approved) {
            $dispatch = Read-JsonFile -Path $appFile.FullName
            if ($null -eq $dispatch) { continue }
            $webhook = Get-SecretValue -Name 'BROWNEYE_DISCORD_WEBHOOK_URL'
            if (-not [string]::IsNullOrWhiteSpace($webhook)) {
                try {
                    Send-DiscordWebhook -WebhookUrl $webhook -Content $dispatch.message | Out-Null
                } catch {
                    Write-ModuleLog -Module 'distribution' -Message "Discord send failed: $_"
                }
            }
            Move-Item -LiteralPath $appFile.FullName -Destination (Join-Path $dispatchDir $appFile.Name) -Force
        }
        Start-Sleep -Seconds 5
    }
    catch {
        Write-Heartbeat -Module 'distribution_layer' -Status 'ERROR' -Detail $_.Exception.Message
        Start-Sleep -Seconds 10
    }
}