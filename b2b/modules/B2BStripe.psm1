$script:ApiKey = Get-Content "C:\BrownEyeCortex\keys\stripe_secret.key" -Raw
$script:Headers = @{ Authorization = "Bearer $script:ApiKey"; "Content-Type" = "application/x-www-form-urlencoded" }
function New-StripeCustomer { param($Email,$Name,$ProfileId) $body="email=$Email&name=$Name&metadata[profile_id]=$ProfileId"; Invoke-RestMethod -Uri "https://api.stripe.com/v1/customers" -Method Post -Headers $script:Headers -Body $body }
function New-StripeSubscription { param($CustomerId,$StripePriceId) $body="customer=$CustomerId&items[0][price]=$StripePriceId"; Invoke-RestMethod -Uri "https://api.stripe.com/v1/subscriptions" -Method Post -Headers $script:Headers -Body $body }
