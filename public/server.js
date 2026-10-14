'use strict';
// Storefront server — public/ is Render rootDir. Whitelist + safe file fallback.
const http=require('http'),fs=require('fs'),path=require('path'),{URL}=require('url');
const commercialCell=require('../BEC-PRIME/routes/commercialCell');
const tollRoad=require('../BEC-PRIME/routes/tollRoad');
const TollRuntime=require('../BEC-PRIME/runtime/TollRoad');
const PORT=Number(process.env.PORT||10000);
const COMMIT=process.env.RENDER_GIT_COMMIT||process.env.RENDER_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'unknown';
const ROOT=__dirname;
const ENGINE_INTERNAL_URL=String(process.env.ENGINE_INTERNAL_URL||'').replace(/\/$/,'');
const ENGINE_INTERNAL_API_KEY=String(process.env.ENGINE_INTERNAL_API_KEY||'');
const PUBLIC_FILES={
  '/':'home.html','/index.html':'home.html','/status':'status.html','/status/':'status.html','/status.html':'status.html',
  '/about':'about.html','/about/':'about.html','/privacy':'privacy.html','/privacy/':'privacy.html','/privacy.html':'privacy.html','/terms':'terms.html','/terms/':'terms.html','/terms.html':'terms.html','/security':'security.html','/security/':'security.html','/security.html':'security.html','/contact':'contact.html','/contact/':'contact.html','/trust':'trust.html','/trust/':'trust.html',
  '/catalogue':'catalogue.html','/catalogue/':'catalogue.html','/catalogue.html':'catalogue.html',
  '/app.js':'app.js',
  '/sell.html':'sell.html','/sell':'sell.html','/sell/':'sell.html',
  '/billboard':'billboard.html','/billboard/':'billboard.html','/billboard.html':'billboard.html',
  '/mtg':'mtg/index.html','/mtg/':'mtg/index.html','/mtg.html':'mtg/index.html',
  '/demand-services':'demand-services.html','/demand-services/':'demand-services.html',
  '/fightedge':'fightedge/index.html','/fightedge/':'fightedge/index.html',
  '/commander-guide':'commander-guide.html','/commander-guide/':'commander-guide.html',
  '/agent-commerce':'agent-commerce.html','/agent-commerce/':'agent-commerce.html','/agentic-commerce':'agentic-commerce.html','/agentic-commerce/':'agentic-commerce.html','/revenue.html':'agentic-commerce.html','/revenue':'agentic-commerce.html',
  '/b2b':'b2b.html','/b2b/':'b2b.html','/b2b.html':'b2b.html',
  '/marketplace':'marketplace.html','/marketplace/':'marketplace.html','/marketplace.html':'marketplace.html',
  '/go':'go/index.html','/go/':'go/index.html',
  '/cost-of-living.html':'cost-of-living.html','/cost-of-living':'cost-of-living.html',
  '/truth-oracle.html':'truth-oracle.html',
  '/truth-oracle-field-guide.html':'truth-oracle-field-guide.html','/shop.html':'shop.html','/truth-oracle':'truth-oracle.html',
  '/agent-bridge-job-contract-v1.json':'agent-bridge-job-contract-v1.json','/agent.json':'agent.json','/agent-commerce.json':'agent-commerce.json',
  '/cube.json':'public-resources.json','/economic-loops.json':'public-resources.json','/ecosystem.json':'public-resources.json',
  '/data/economic-pulse.json':'public-research-feed.json',
  '/pulse':'pulse/index.html','/pulse/':'pulse/index.html',
  '/observatory/commerce-graph':'observatory/commerce-graph/index.html','/observatory/commerce-graph/':'observatory/commerce-graph/index.html','/observatory/commerce-graph/commerce-offer.v1.schema.json':'public-resources.json',
  '/.well-known/carbon-forward-schema.json':'.well-known/carbon-forward-schema.json','/schemas/carbon-forward-intent.v1.json':'schemas/carbon-forward-intent.v1.json',
  '/economic':'pulse/index.html','/economic/':'pulse/index.html',
  '/catalog.json':'catalog.json','/surfaces.json':'surfaces.json',
  '/robots.txt':'robots.txt','/sitemap.xml':'sitemap.xml',
  '/quote-comparison':'quote-comparison/index.html','/quote-comparison/':'quote-comparison/index.html','/quote-comparison.html':'quote-comparison.html',
  '/overpaying':'overpaying.html','/overpaying.html':'overpaying.html',
  '/avatar.html':'avatar.html','/avatar':'avatar.html','/phinhaven.html':'phinhaven.html','/phinhaven/':'phinhaven.html','/phinhaven/hotel':'phinhaven/hotel/index.html','/phinhaven/hotel/':'phinhaven/hotel/index.html','/phinhaven/shallows':'phinhaven/shallows/index.html','/phinhaven/shallows/':'phinhaven/shallows/index.html','/account':'account.html','/account/':'account.html','/register':'register.html','/register/':'register.html','/login':'login.html','/login/':'login.html','/mtg-search':'mtg-search.html','/mtg-search/':'mtg-search.html','/mtg-list':'mtg-list.html','/mtg-list/':'mtg-list.html','/mtg-marketplace':'mtg-marketplace.html','/mtg-marketplace/':'mtg-marketplace.html','/mtg-mod':'mtg-mod.html','/mtg-mod/':'mtg-mod.html','/mtg-welcome':'mtg-welcome.html','/mtg-welcome/':'mtg-welcome.html','/toll-road':'toll-road.html','/toll-road/':'toll-road.html'
};
Object.assign(PUBLIC_FILES,{"/777-distribution.html":"777-distribution.html","/a2a-marketplace.html":"marketplace.html","/agent-bridge.html":"agent-bridge.html","/agent-bridge":"agent-bridge.html","/agent-bridge/":"agent-bridge.html","/cube-marketplace.html":"marketplace.html","/evidence-ledger.html":"trust.html","/evidence.html":"trust.html","/ledger.html":"trust.html","/production-verification.html":"trust.html","/money-500000.html":"shop.html","/silo-template.html":"public-resources.json","/silos/":"shop.html","/silos/index.html":"shop.html","/toll-road.html":"shop.html","/toll-booths.html":"shop.html","/marketplace-forward.html":"marketplace.html","/marketplace-pro.html":"marketplace.html","/free.html":"home.html","/offers.html":"shop.html","/hosted-decision-analysis.html":"c2.html","/growth.html":"demand-services.html","/cortex.html":"home.html","/index-black-gold-v1.html":"home.html","/marketplace/order/":"marketplace.html","/marketplace/order/index.html":"marketplace.html","/marketplace/sell/":"marketplace.html","/marketplace/sell/index.html":"marketplace.html","/economicMechanismLibrary.json":"public-resources.json","/evergreen-silo-factory.json":"public-resources.json","/silo-clone-manifest.json":"public-resources.json","/bridge-tolls.json":"public-resources.json","/commerce-roads.json":"public-resources.json","/compute.json":"public-resources.json","/ledger.json":"public-resources.json","/proof.schema.json":"public-resources.json","/money-playbook.json":"public-resources.json","/dream-ledger-manifest.json":"public-resources.json","/dreamledger-sitemap.xml":"sitemap.xml","/data/economic-events-manifest.json":"public-resources.json","/data/procurement-opportunities.json":"public-research-feed.json","/news.json":"public-research-feed.json","/platform.json":"public-resources.json","/api/agent-commerce/toll-probe.json":"public-resources.json","/b2b/catalog.openapi.json":"public-resources.json","/catalog.openapi.json":"public-resources.json","/marketplace/agent-card.json":"public-resources.json","/marketplace/agent.json":"public-resources.json","/toll-road.json":"public-resources.json"});
Object.assign(PUBLIC_FILES,{"/b2b-marketplace.html":"b2b.html","/auctions.html":"marketplace.html","/auto_parts.html":"marketplace.html","/boardgames.html":"marketplace.html","/cameras.html":"marketplace.html","/collectibles.html":"marketplace.html","/computers.html":"marketplace.html","/furniture.html":"marketplace.html","/home_appliances.html":"marketplace.html","/musical_instruments.html":"marketplace.html","/outdoor.html":"marketplace.html","/phones.html":"marketplace.html","/vinyl.html":"marketplace.html","/nz-secondhand/":"marketplace.html","/nz-secondhand/index.html":"marketplace.html","/digital-products/":"shop.html","/digital-products/index.html":"shop.html","/activity.html":"trust.html","/tools.html":"home.html","/start.html":"shop.html","/free.html":"home.html","/offers.html":"shop.html","/hosted-decision-analysis.html":"c2.html","/growth.html":"demand-services.html","/marketplace/order":"marketplace.html","/marketplace/sell":"marketplace.html","/silos/evergreen.html":"shop.html","/silos/construction-subcontractor-quotes.html":"quote-comparison/construction/index.html","/silos/event-vendor-quotes.html":"quote-comparison/hospitality/index.html","/silos/fleet-repair-quotes.html":"quote-comparison/operations/index.html","/silos/freight-quotes.html":"quote-comparison/import/index.html","/silos/it-hardware-quotes.html":"quote-comparison/operations/index.html","/silos/manufacturing-supplier-quotes.html":"quote-comparison/manufacturing/index.html","/silos/marketing-agency-quotes.html":"quote-comparison/operations/index.html","/silos/professional-services-quotes.html":"quote-comparison/operations/index.html","/silos/saas-vendor-quotes.html":"quote-comparison/operations/index.html","/silos/supplier-price-list-comparison.html":"quote-comparison/wholesale/index.html"});
Object.assign(PUBLIC_FILES,{"/rivet/":"b2b.html","/rivet/index.html":"b2b.html","/dreamledger-billboard.html":"billboard.html","/quote-comparison/ecommerce.html":"quote-comparison/ecommerce/index.html","/tools/":"tools/index.html","/tools/index.html":"tools/index.html","/sandbox-tools.html":"tools/index.html","/pulse/2026-10-09-private-commercial-ai-agents-can-pay-for-your-shopping-who-gets-your-money-back-cryptonews-net-3914c4d85d182093.html":"pulse/index.html","/pulse/2026-10-09-private-commercial-api-tax-slows-ai-agents-saasrise-d3958748bb03e4d3.html":"pulse/index.html","/pulse/2026-10-09-private-commercial-introducing-strands-box-ai-agent-sandboxes-powered-by-dogwood-amazon-web-services-aws-ebd0f33212ab2024.html":"pulse/index.html","/pulse/2026-10-09-private-commercial-openai-launches-decisions-api-with-up-to-10x-faster-responses-propakistani-185784e8881b102a.html":"pulse/index.html","/pulse/2026-10-09-private-commercial-payrails-launches-a-hybrid-merchant-of-record-product-the-paypers-dcb5d940220c205a.html":"pulse/index.html","/pulse/2026-10-09-private-commercial-secure-ai-agent-credentials-13-step-mcp-setup-2026-https-tech-insider-org-e63b27eb35707850.html":"pulse/index.html","/pulse/2026-10-09-private-commercial-top-6-best-dropshipping-automation-platforms-for-scaling-your-ecommerce-business-techbullion-f58bc31213ababb7.html":"pulse/index.html"});
Object.assign(PUBLIC_FILES,{"/discord-starter-kit.html":"products/discord-webhook-starter-kit-001/index.html","/tools/nz-seller-profit/":"tools/seller-profit/index.html","/tools/nz-seller-profit/index.html":"tools/seller-profit/index.html"});
Object.assign(PUBLIC_FILES,{
  "/silos/mtg/silo.json":"silos/mtg/silo.json",
  "/data/mtg-catalog.json":"data/mtg-catalog.json",
  "/data/decklists/quintorius.json":"data/decklists/quintorius.json",
  "/data/_catalog-empty.template.json":"data/_catalog-empty.template.json",
  "/assets/mtg-deck-grid.js":"assets/mtg-deck-grid.js",
  "/assets/mtg-deck-grid.css":"assets/mtg-deck-grid.css",
  "/mtg/quintorius-field-historian.html":"mtg/quintorius-field-historian.html"
});
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
