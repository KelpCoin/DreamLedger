Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ROOT = 'C:\BrownEyeCortex'
$LEDGER = "$ROOT\ledger\event.log"
$SCHEMA_VERSION = '1.0'
$VALID_CHANNELS  = @('manual','stripe','discord','reddit','tiktok','facebook','instagram','unknown')
$VALID_EVENT_TYPES = @('click','sale','refund','inventory','system','payout')

function Register-Event {
    param(
        [Parameter(Mandatory)] [string]$EventType,
        [Parameter(Mandatory)] [string]$SkuId,
        [string]$Channel = 'manual',
        [int]$AmountCents = 0,
        [int]$Quantity = 1,
        [hashtable]$Flags = @{}
    )
    $ev = [ordered]@{
        schema_version = $SCHEMA_VERSION
        event_id       = [guid]::NewGuid().ToString()
        event_type     = $EventType.ToLower()
        timestamp_utc  = [DateTimeOffset]::UtcNow.ToString('o')
        sku_id         = $SkuId
        channel        = $Channel.ToLower()
        amount_cents   = $AmountCents
        quantity       = $Quantity
        flags          = $Flags
    }
    if ($VALID_EVENT_TYPES -notcontains $ev.event_type) { throw "Invalid event_type: $($ev.event_type)" }
    if ($VALID_CHANNELS -notcontains $ev.channel) { Write-Warning "Unknown channel: $($ev.channel)  allowed but not recommended" }
    $json = $ev | ConvertTo-Json -Compress -Depth 5
    Add-Content -Path $LEDGER -Value $json -Encoding UTF8
    Write-Host "Event registered: $($ev.event_type) $($ev.sku_id)"
}
Export-ModuleMember -Function Register-Event
