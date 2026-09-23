'use strict';
// Production convergence marker: 2026-09-21 marketplace-v19.
// CUBE surface registry: many commercial surfaces, one commerce/proof spine.
const crypto=require('crypto');
const http=require('http'),fs=require('fs'),path=require('path'),{URL}=require('url');
const auth=require('../BEC-PRIME/routes/auth');
const dreamiez=require('../BEC-PRIME/routes/dreamiez');
const agentBridge=require('../BEC-PRIME/runtime/AgentBridge');
const bridgeRail=require('../BEC-PRIME/runtime/BridgeRail');
const truthOracleCommerce=require('../BEC-PRIME/routes/truthOracleCommerce');
const consultDecision=require('../BEC-PRIME/routes/consultDecision');
const PORT=Number(process.env.PORT||10000),ENGINE=process.env.ENGINE_INTERNAL_URL||'',ENGINE_KEY=process.env.ENGINE_INTERNAL_API_KEY||'',STRIPE_WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET||'',COMMIT=process.env.RENDER_GIT_COMMIT||process.env.RENDER_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'unknown',ROOT=__dirname;
const CATALOG_PATH=path.join(ROOT,'catalog.json');
const CUBE_PATH=path.join(ROOT,'cube.json');
const ECOSYSTEM_PATH=path.join(ROOT,'ecosystem.json');
const AGENT_PATH=path.join(ROOT,'agent.json');
const SURFACES_PATH=path.join(ROOT,'surfaces.json');
const DISCOVERY_PATH=path.join(ROOT,'.well-known','dreamledger.json');
const RESERVATION_DIR=path.join(ROOT,'data','billboard-reservations');
const ACCOUNT_ROOT=path.join(ROOT,'..','BEC-PRIME','compiled','website');
const DREAMMEEZ_ROOT=path.join(ROOT,'..','BEC-PRIME','silos','SILO_DREAMIEZ','compiled','website');
const BILLBOARD_CHECKOUT='https://buy.stripe.com/00w4gz6HzeWhcizeZedwc2w';
const PUBLIC_FILES={'/c2':'c2.html','/c2/':'c2.html','/consult':'c2.html','/consult/':'c2.html','/':'index.html','/truth-oracle':'truth-oracle.html','/truth-oracle/':'truth-oracle.html','/truth-oracle.html':'truth-oracle.html','/index.html':'index.html','/billboard':'billboard.html','/billboard/':'billboard.html','/mtg':'mtg.html','/mtg/':'mtg.html','/avatar':'avatar.html','/avatar/':'avatar.html','/avatars':'avatar.html','/avatars/':'avatar.html','/dreammeez':'avatar.html','/dreammeez/':'avatar.html','/dreamiez':'dreamiez.html','/dreamiez/':'dreamiez.html','/robots.txt':'robots.txt','/sitemap.xml':'sitemap.xml','/catalog.json':'catalog.json','/cube.json':'cube.json','/ecosystem.json':'ecosystem.json','/agent.json':'agent.json','/agent-commerce.json':'agent-commerce.json','/surfaces.json':'surfaces.json','/phin-haven':'phin-haven-v5.html','/phin-haven/':'phin-haven-v5.html','/phin-haven.html':'phin-haven-v5.html','/phin-haven-v5.html':'phin-haven-v5.html','/play':'phin-haven-v5.html','/play/':'phin-haven-v5.html','/overpaying':'overpaying.html','/overpaying/':'overpaying.html','/overpaying.html':'overpaying.html'};
