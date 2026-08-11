#requires -Version 5.1
[CmdletBinding()]
param([string]$ProofPath = 'D:\DREAMLEDGER_COMPILER_TRUTH_PROOF.json')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ContractPath = Join-Path $Root 'compiler\COMPILER-TRUTH-CONTRACT.json'
$ManifestPath = Join-Path $Root 'manifests\CUBE-PUBLIC-SURFACE-MANIFEST.json'
$OffersPath = Join-Path $Root 'catalog\offers\offers.json'
$IpPath = Join-Path $Root 'catalog\ip-capabilities.json'
$SurfaceCompilerPath = Join-Path $Root 'compiler\SurfaceCompiler.js'
$SurfaceIndexTemplate = Join-Path $Root 'compiler\templates\public-index.html'
$SurfaceAssetTemplate = Join-Path $Root 'compiler\templates\public-marketplace.js'
$DreamiezTemplate = Join-Path $Root 'compiler\templates\dreamiez.html'
$DreamiezJsTemplate = Join-Path $Root 'compiler\templates\dreamiez-account.js'
$UcpTemplate = Join-Path $Root 'compiler\templates\ucp-profile.json'
$CompiledIndex = Join-Path $Root 'compiled\website\index.html'
$CompiledAsset = Join-Path $Root 'compiled\website\assets\public-marketplace.js'
$CompiledDreamiez = Join-Path $Root 'compiled\website\dreamiez.html'
$CompiledDreamiezJs = Join-Path $Root 'compiled\website\assets\dreamiez-account.js'
$CompiledUcp = Join-Path $Root 'compiled\website\.well-known\ucp'
$AgentContract = Join-Path $Root 'compiled\website\.well-known\agent-commerce.json'
$OfferCompilerPath = Join-Path $Root 'compiler\OfferCompiler.js'
$MetaPath = Join-Path $Root 'scripts\meta-gauntlet.js'
$SentinelPath = Join-Path $Root 'runtime\Sentinel.js'
$Errors = New-Object System.Collections.Generic.List[string]
function Require-File([string]$Path,[string]$Name){if(-not(Test-Path -LiteralPath $Path)){$Errors.Add("MISSING:$Name")}}
foreach($item in @(
 @($ContractPath,'contract'),@($ManifestPath,'cube_manifest'),@($OffersPath,'offers'),@($IpPath,'ip_catalog'),
 @($SurfaceCompilerPath,'surface_compiler'),@($SurfaceIndexTemplate,'surface_index_template'),@($SurfaceAssetTemplate,'surface_asset_template'),
 @($DreamiezTemplate,'dreamiez_template'),@($DreamiezJsTemplate,'dreamiez_client_template'),@($UcpTemplate,'ucp_template'),
 @($CompiledIndex,'compiled_index'),@($CompiledAsset,'compiled_marketplace_asset'),@($CompiledDreamiez,'compiled_dreamiez'),
 @($CompiledDreamiezJs,'compiled_dreamiez_client'),@($CompiledUcp,'compiled_ucp'),@($AgentContract,'agent_contract'),
 @($OfferCompilerPath,'offer_compiler'),@($MetaPath,'meta_gauntlet'),@($SentinelPath,'sentinel')
)){Require-File $item[0] $item[1]}
$contract=if($Errors.Count -eq 0){Get-Content -Raw $ContractPath|ConvertFrom-Json}else{$null}
$manifest=if($Errors.Count -eq 0){Get-Content -Raw $ManifestPath|ConvertFrom-Json}else{$null}
$offers=if($Errors.Count -eq 0){Get-Content -Raw $OffersPath|ConvertFrom-Json}else{$null}
$ip=if($Errors.Count -eq 0){Get-Content -Raw $IpPath|ConvertFrom-Json}else{$null}
$surfaceCompiler=if($Errors.Count -eq 0){Get-Content -Raw $SurfaceCompilerPath}else{''}
$templateIndex=if($Errors.Count -eq 0){Get-Content -Raw $SurfaceIndexTemplate}else{''}
$templateAsset=if($Errors.Count -eq 0){Get-Content -Raw $SurfaceAssetTemplate}else{''}
$templateDreamiez=if($Errors.Count -eq 0){Get-Content -Raw $DreamiezTemplate}else{''}
$templateDreamiezJs=if($Errors.Count -eq 0){Get-Content -Raw $DreamiezJsTemplate}else{''}
$templateUcp=if($Errors.Count -eq 0){Get-Content -Raw $UcpTemplate}else{''}
$compiledIndex=if($Errors.Count -eq 0){Get-Content -Raw $CompiledIndex}else{''}
$compiledAsset=if($Errors.Count -eq 0){Get-Content -Raw $CompiledAsset}else{''}
$compiledDreamiez=if($Errors.Count -eq 0){Get-Content -Raw $CompiledDreamiez}else{''}
$compiledDreamiezJs=if($Errors.Count -eq 0){Get-Content -Raw $CompiledDreamiezJs}else{''}
$compiledUcp=if($Errors.Count -eq 0){Get-Content -Raw $CompiledUcp}else{''}
$agentContract=if($Errors.Count -eq 0){Get-Content -Raw $AgentContract}else{''}
if($contract){if($contract.surface_rules.server_authoritative_price -ne $true){$Errors.Add('POLICY:server_authoritative_price')};if($contract.surface_rules.server_authoritative_inventory -ne $true){$Errors.Add('POLICY:server_authoritative_inventory')};if($contract.surface_rules.approval_required_before_activation -ne $true){$Errors.Add('POLICY:approval_required')};if($contract.surface_rules.digital_proxy_auto_open -ne $false){$Errors.Add('POLICY:digital_proxy_auto_open')};if($contract.surface_rules.demand_radar_charge_authority -ne $false){$Errors.Add('POLICY:demand_radar_charge')};if($contract.surface_rules.sentinel_charge_authority -ne $false){$Errors.Add('POLICY:sentinel_charge')}}
if($manifest){if($manifest.surface_policy.server_authoritative_economics -ne $true){$Errors.Add('MANIFEST:server_authoritative_economics')};if($manifest.surface_policy.approval_required_for_activation -ne $true){$Errors.Add('MANIFEST:approval_required')};if($manifest.surface_policy.private_material_excluded -ne $true){$Errors.Add('MANIFEST:private_material_excluded')};if($manifest.surface_policy.silo_isolation_required -ne $true){$Errors.Add('MANIFEST:silo_isolation')}}
$offerIds=@();if($offers){foreach($offer in @($offers.offers)){$offerIds+=[string]$offer.offer_id;if($offer.approval_required -ne $true){$Errors.Add("OFFER_UNLOCKED:$($offer.offer_id)")};if($offer.checkout_available -ne $false){$Errors.Add("OFFER_CHECKOUT_ENABLED:$($offer.offer_id)")};if($offer.status -ne 'candidate'){$Errors.Add("OFFER_STATUS:$($offer.offer_id)")};if($offer.provenance.private_material -ne 'excluded'){$Errors.Add("OFFER_PRIVATE_MATERIAL:$($offer.offer_id)")}}}
if($surfaceCompiler){if($surfaceCompiler -notmatch 'generated_from_templates'){$Errors.Add('SURFACE_COMPILER_NOT_GENERATIVE')};if($surfaceCompiler -notmatch 'TEMPLATE_INDEX'){$Errors.Add('SURFACE_COMPILER_INDEX_TEMPLATE_MISSING')};if($surfaceCompiler -notmatch 'TEMPLATE_MARKETPLACE'){$Errors.Add('SURFACE_COMPILER_ASSET_TEMPLATE_MISSING')};if($surfaceCompiler -notmatch 'TEMPLATE_DREAMIEZ'){$Errors.Add('SURFACE_COMPILER_DREAMIEZ_TEMPLATE_MISSING')};if($surfaceCompiler -notmatch 'TEMPLATE_UCP'){$Errors.Add('SURFACE_COMPILER_UCP_TEMPLATE_MISSING')};if($surfaceCompiler -match 'compiled_at\s*=\s*new Date\(\)'){$Errors.Add('SURFACE_COMPILER_NONDETERMINISTIC_TIMESTAMP')}}
if($templateIndex -and $compiledIndex){if($templateIndex -ne $compiledIndex){$Errors.Add('SURFACE_OUTPUT_DRIFT:index_differs_from_template')};if($compiledIndex -notmatch 'compiler-generated public surface'){$Errors.Add('SURFACE_OUTPUT_MARKER_MISSING')};if($compiledIndex -match 'Commerce spine|Canonical economics|Signed settlement|Proof before claim'){$Errors.Add('PUBLIC_FRONT_INTERNAL_DOCTRINE_LEAK')};foreach($offerId in $offerIds){if($offerId -and $compiledIndex -match [regex]::Escape($offerId)){$Errors.Add("SURFACE_HARDCODED_OFFER_ID:$offerId")}}}
if($templateAsset -and $compiledAsset){if($templateAsset -ne $compiledAsset){$Errors.Add('SURFACE_OUTPUT_DRIFT:marketplace_asset_differs_from_template')};if($compiledAsset -notmatch '/api/offers'){$Errors.Add('SURFACE_OUTPUT_MISSING_OFFER_API')};if($compiledAsset -notmatch '/api/offer-checkout/create'){$Errors.Add('SURFACE_OUTPUT_MISSING_GOVERNED_CHECKOUT')}}
if($templateDreamiez -and $compiledDreamiez -and $templateDreamiez -ne $compiledDreamiez){$Errors.Add('DREAMIEZ_OUTPUT_DRIFT:page_differs_from_template')}
if($templateDreamiezJs -and $compiledDreamiezJs -and $templateDreamiezJs -ne $compiledDreamiezJs){$Errors.Add('DREAMIEZ_OUTPUT_DRIFT:client_differs_from_template')}
if($compiledDreamiez -and $compiledDreamiez -notmatch '/api/dreamiez/account/create'){$Errors.Add('DREAMIEZ_MISSING_ACCOUNT_CREATE')}
if($compiledDreamiez -and $compiledDreamiez -notmatch 'Choose your Dreamiez'){$Errors.Add('DREAMIEZ_MISSING_AVATAR_CHOOSER')}
if($compiledDreamiezJs -and $compiledDreamiezJs -notmatch '/api/dreamiez/checkin'){$Errors.Add('DREAMIEZ_MISSING_CHECKIN')}
if($templateUcp -and $compiledUcp){if($templateUcp -ne $compiledUcp){$Errors.Add('UCP_OUTPUT_DRIFT:profile_differs_from_template')};$u=$compiledUcp|ConvertFrom-Json;if($u.ucp.version -ne '2026-04-08'){$Errors.Add('UCP_VERSION_UNEXPECTED')};if($null -eq $u.ucp.services){$Errors.Add('UCP_SERVICES_MISSING')};if($null -eq $u.ucp.payment_handlers){$Errors.Add('UCP_PAYMENT_HANDLERS_MISSING')}}
if($agentContract){if($agentContract -match '"capabilities"\s*:\s*"/api/ip"'){$Errors.Add('AGENT_CONTRACT_INTERNAL_IP_LEAK')};foreach($secret in @('internal_capability_catalog','compiler_source','private_prompts','internal_ledger_records','secrets')){if($agentContract -notmatch [regex]::Escape($secret)){$Errors.Add("AGENT_CONTRACT_MISSING_EXCLUSION:$secret")}}}
if($ip){$ids=@($ip.capabilities|ForEach-Object{[string]$_.id});if(($ids|Sort-Object -Unique).Count -ne $ids.Count){$Errors.Add('IP_DUPLICATE_IDS')};$raw=Get-Content -Raw $IpPath;foreach($pattern in @('sk_live_','sk_test_','whsec_','PRIVATE KEY','BEGIN RSA PRIVATE KEY','BEGIN OPENSSH PRIVATE KEY')){if($raw -match [regex]::Escape($pattern)){$Errors.Add("PUBLIC_SECRET_MARKER:$pattern")}}}
$proof=[ordered]@{schema='BEC-PRIME/COMPILER-TRUTH-PROOF/v4';checked_at_utc=(Get-Date).ToUniversalTime().ToString('o');verdict=if($Errors.Count -eq 0){'PASS'}else{'FAIL'};compiler_chain=@('OfferCompiler','SurfaceCompiler','PriceDisplayPatch','Gauntlet','Meta-Gauntlet','Sentinel');surface_generation=[ordered]@{template_owned=($Errors -notcontains 'SURFACE_COMPILER_NOT_GENERATIVE');deterministic=($Errors -notcontains 'SURFACE_COMPILER_NONDETERMINISTIC_TIMESTAMP');output_matches_templates=($Errors -notlike '*OUTPUT_DRIFT:*');catalog_ids_not_embedded=($Errors -notlike 'SURFACE_HARDCODED_OFFER_ID:*');dreamiez_compiled=($Errors -notlike 'DREAMIEZ_*');ucp_discovery_compiled=($Errors -notlike 'UCP_*')};revenue_boundary=[ordered]@{all_offers_locked=($Errors -notlike 'OFFER_UNLOCKED:*' -and $Errors -notlike 'OFFER_CHECKOUT_ENABLED:*');approval_governed=($contract.surface_rules.approval_required_before_activation -eq $true)};public_boundary=[ordered]@{front_is_customer_safe=($Errors -notcontains 'PUBLIC_FRONT_INTERNAL_DOCTRINE_LEAK');agent_contract_excludes_internal_material=($Errors -notlike 'AGENT_CONTRACT_*')};counts=[ordered]@{capabilities=@($ip.capabilities).Count;offers=@($offers.offers).Count;public_surfaces=@($manifest.public_surfaces).Count};errors=@($Errors);doctrine='Canonical catalogs define commercial truth. Public surfaces expose outcomes and machine contracts, not private implementation doctrine. Dreamiez is the human acquisition surface. UCP discovery is conservative until a conformant transactional adapter exists.'}
$parent=Split-Path -Parent $ProofPath;if($parent -and -not(Test-Path -LiteralPath $parent)){New-Item -ItemType Directory -Path $parent -Force|Out-Null};$proof|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $ProofPath -Encoding ASCII
Write-Host "VERDICT: $($proof.verdict)";Write-Host "PROOF: $ProofPath";Write-Host "CAPABILITIES: $($proof.counts.capabilities)";Write-Host "OFFERS: $($proof.counts.offers)";Write-Host "PUBLIC SURFACES: $($proof.counts.public_surfaces)";if($Errors.Count -gt 0){$Errors|ForEach-Object{Write-Host "FAIL: $_"}};exit $(if($proof.verdict -eq 'PASS'){0}else{1})
