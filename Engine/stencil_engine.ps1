param($StencilPath)
if (!(Test-Path $StencilPath)) { throw "Missing stencil: $StencilPath" }
$stencil = Get-Content $StencilPath | ConvertFrom-Json
return @{ sku=$stencil.name; offer=$stencil.offer_angle; price=$stencil.price_band; landing=$stencil.landing_page_structure; cta=$stencil.cta }
