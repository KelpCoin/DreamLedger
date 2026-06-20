# CashGate.v2.psm1  Minimal Stripe Checkout generator
$script:StripeSecret = $env:BROWNEYE_STRIPE_SECRET_KEY

function New-StripeCheckoutSession {
    param(
        [string]$ProductName = "DreamLedger Product",
        [int]$AmountCents = 1000,
        [string]$Currency = "nzd",
        [string]$Variant = "default"
    )
    if (-not $script:StripeSecret) {
        Write-Warning "Stripe secret key missing  returning placeholder."
        return "https://buy.stripe.com/PLACEHOLDER_$Variant"
    }
    $body = @{
        "mode" = "payment"
        "success_url" = "https://dreamledger.org/success"
        "cancel_url" = "https://dreamledger.org/cancel"
        "line_items[0][price_data][currency]" = $Currency
        "line_items[0][price_data][product_data][name]" = $ProductName
        "line_items[0][price_data][unit_amount]" = $AmountCents
        "line_items[0][quantity]" = 1
        "metadata[variant]" = $Variant
    }
    $headers = @{ Authorization = "Bearer $script:StripeSecret" }
    try {
        $response = Invoke-RestMethod -Method Post -Uri "https://api.stripe.com/v1/checkout/sessions" -Body $body -Headers $headers
        return $response.url
    } catch {
        Write-Warning "Stripe error: $_"
        return "https://buy.stripe.com/ERROR_$Variant"
    }
}
Export-ModuleMember -Function New-StripeCheckoutSession
