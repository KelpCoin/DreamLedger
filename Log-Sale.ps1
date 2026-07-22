param([string]$sku_id, [int]$amount_nzd_cents, [string]$source='manual')
Import-Module "$PSScriptRoot\Modules\EventKernel.psm1" -Force
Register-Event -EventType 'sale' -SkuId $sku_id -Channel $source -AmountCents $amount_nzd_cents
& "$PSScriptRoot\STATE-REDUCER.ps1"
& "$PSScriptRoot\FirstSaleLatch.ps1"
