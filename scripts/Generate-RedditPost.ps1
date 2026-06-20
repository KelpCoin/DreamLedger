# Generate-RedditPost.ps1
param([string]$ProductsPath = "C:\BrownEyeCortex\dreamledger\products.json")
$products = (Get-Content $ProductsPath -Raw | ConvertFrom-Json).products
$pick = $products | Get-Random
$price = $pick.price
$currency = $pick.currency
$title = "I built a tool for " + $pick.name + " - " + $currency + " $" + $price
$body = @"
$($pick.desc)
Instant download - no waiting.
More info: https://dreamledger.org
"@
$post = @"
TITLE: $title
BODY:
$body
"@
$post | Out-File "C:\BrownEyeCortex\output\reddit_post.txt" -Encoding UTF8
Write-Host "Post generated for $($pick.name)"
