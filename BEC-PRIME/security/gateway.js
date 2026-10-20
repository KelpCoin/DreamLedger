'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const gauntlet = require('../gauntlet/GauntletV6');
const truthOracle = require('../runtime/TruthOracle');
const ledger = require('../runtime/Ledger');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(__dirname, 'mcp-gateway-manifest.json');
const CLIENT_REGISTRY_PATH = path.join(__dirname, 'mcp-client-registry.json');
const PROOF_DIR = path.join(ROOT, 'data', 'proofs');
const PROTOCOL_VERSION = '2025-11-25';
const MAX_MESSAGE_BYTES = 262144;
const MAX_CALLS = 100;
let initialized = false;
let clientIdentity = null;
let callCount = 0;

const TOOL_PERMISSIONS = Object.freeze({
  dl_read_cartridge: 'READ_ONLY',
  dl_read_inventory: 'READ_ONLY',
  dl_read_ledger: 'READ_ONLY',
  dl_propose_offer: 'PROPOSAL_ONLY',
  dl_verify_proof: 'READ_ONLY',
  dl_propose_checkout: 'PROPOSAL_ONLY'
});

function hash(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function canonicalManifest(m) { return JSON.stringify({ schema_version:m.schema_version, gateway:m.gateway, transport:m.transport, protocol_version:m.protocol_version, tools:m.tools }, null, 2) + '\n'; }
function loadManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (m.transport !== 'stdio' || m.protocol_version !== PROTOCOL_VERSION) throw new Error('MCP manifest transport/version violation');
  if (hash(canonicalManifest(m)) !== m.manifest_hash) throw new Error('MCP manifest hash mismatch');
  if (m.tools.length !== Object.keys(TOOL_PERMISSIONS).length) throw new Error('MCP tool count violation');
  for (const tool of m.tools) {
    if (TOOL_PERMISSIONS[tool.name] !== tool.permission) throw new Error('MCP tool permission violation: ' + tool.name);
  }
  return m;
}

function loadClientRegistry() {
  const registry = readJson(CLIENT_REGISTRY_PATH);
  if (registry.schema_version !== 'BECKPRIME-MCP-CLIENT-REGISTRY-1.0' ||
      registry.gateway !== 'dreamledger-gateway' ||
      registry.default_deny !== true ||
      !Array.isArray(registry.clients) || registry.clients.length === 0) {
    throw new Error('MCP client registry schema/default-deny violation');
  }
  const ids = new Set();
  const aliases = new Set();
  for (const client of registry.clients) {
    if (!client.client_id || ids.has(client.client_id) ||
        !client.owner || !Array.isArray(client.client_name_aliases) ||
        !Array.isArray(client.allowed_tools) || !Array.isArray(client.allowed_silos)) {
      throw new Error('MCP client registry record incomplete or duplicated');
    }
    ids.add(client.client_id);
    for (const alias of client.client_name_aliases) {
      if (aliases.has(alias)) throw new Error('MCP client name alias assigned to multiple identities: ' + alias);
      aliases.add(alias);
    }
    for (const tool of client.allowed_tools) {
      if (!Object.prototype.hasOwnProperty.call(TOOL_PERMISSIONS, tool)) {
        throw new Error('MCP client registry references unknown tool: ' + tool);
      }
      if (TOOL_PERMISSIONS[tool] === 'EXECUTE' || /charge|delete|publish_publicly|shell|exec/i.test(tool)) {
        throw new Error('MCP client registry references prohibited tool: ' + tool);
      }
    }
    for (const silo of client.allowed_silos) {
      if (!['CORE', 'MTG', 'DREAMIEZ'].includes(silo)) throw new Error('MCP client registry contains forbidden silo');
    }
    if (client.authority === 'READ_ONLY' &&
        client.allowed_tools.some(tool => TOOL_PERMISSIONS[tool] !== 'READ_ONLY')) {
      throw new Error('Read-only MCP client has a proposal tool');
    }
    if (client.external_actions !== false) throw new Error('MCP client external actions must remain disabled');
  }
  return registry;
}

function resolveClientIdentity(registry, clientId, presentedName) {
  const id = String(clientId || '').trim();
  const name = String(presentedName || '').trim();
  if (!id) return { error:'Host-injected BEC_MCP_CLIENT_ID is required' };
  const record = registry.clients.find(client => client.client_id === id);
  if (!record) return { error:'Unregistered MCP service identity' };
  if (!record.client_name_aliases.includes(name)) return { error:'MCP client name does not match host-bound service identity' };
  return record;
}

function safeId(value) { return typeof value === 'string' && value.length > 0 && value.length < 128 && !value.includes('..') && !/[\\/]/.test(value); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function verifyProof(proofId, requestedSilo) {
  if (!safeId(proofId)) return { verified:false, reason:'Invalid proof id' };
  const file = path.join(PROOF_DIR, proofId + '.json');
  if (!fs.existsSync(file)) return { verified:false, reason:'Proof not found' };
  const proof = readJson(file);
  if (!proof.data || !proof.hash) return { verified:false, reason:'Proof hash missing' };
  const computed = ledger.sha256(proof.data);
  if (requestedSilo !== 'CORE') {
    const observedSilo = String(proof.data.silo_id || proof.data.silo || proof.silo_id || proof.silo || '').toUpperCase();
    if (!observedSilo || observedSilo !== requestedSilo) {
      return { proof_id:proofId, verified:false, reason:'Proof silo scope not established', silo_scope_denied:true };
    }
  }
  return { proof_id:proofId, verified:computed === proof.hash, computed_hash:computed, silo_scope:requestedSilo };
}

function offerBySku(sku) {
  const file = path.join(ROOT, 'catalog', 'products', String(sku) + '.json');
  if (!safeId(String(sku)) || !fs.existsSync(file)) return null;
  return readJson(file);
}

function courtEvaluate(type, payload, silo) {
  const gauntletResult = gauntlet.run({ writeProof: true });
  if (gauntletResult.status !== 'PASS') return { decision:'BLOCKED', approved:false, reason:['Gauntlet did not PASS'], gauntlet:gauntletResult.status, truth:'NOT_EVALUATED', capital_authority:'ZERO' };
  const truth = truthOracle.snapshot();
  if (truth.chain_status !== 'PASS') return { decision:'BLOCKED', approved:false, reason:['Truth Oracle ledger chain is not verified'], gauntlet:'PASS', truth:truth.chain_status, capital_authority:'ZERO' };
  if (type === 'CHECKOUT' && (!payload.sku || Number(payload.amount) <= 0 || !payload.customer_ref)) return { decision:'BLOCKED', approved:false, reason:['Invalid checkout'], gauntlet:'PASS', truth:'PASS', capital_authority:'ZERO' };
  return {
    decision:'ELIGIBLE_FOR_HUMAN_APPROVAL', approved:false, requires_human_approval:true,
    reason:['Gauntlet PASS','Truth Oracle chain PASS','Human approval required before execution'],
    gauntlet:'PASS', truth:'PASS', capital_authority:'ZERO'
  };
}

function proposeOffer(args) {
  const silo = args.silo || 'CORE';
  const offer = args.offer || {};
  if (!offer.sku || Number(offer.price) <= 0) return { error:'Invalid offer' };
  const product = offerBySku(offer.sku);
  if (!product) return { error:'SKU_NOT_IN_CANONICAL_PRODUCT_STORE', status:'REFUSE' };
  if (silo !== 'CORE' && String(product.silo || '').toUpperCase() !== String(silo).toUpperCase()) {
    return { error:'SILO_MISMATCH', status:'REFUSE' };
  }
  if (Number(product.price) !== Number(offer.price)) {
    return { error:'PRICE_MISMATCH', status:'REFUSE', expected:Number(product.price), provided:Number(offer.price) };
  }
  if (product.status === 'held' || product.checkout_available === false ||
      (product.checkout && product.checkout.mode === 'disabled') ||
      (product.commercial_truth && product.commercial_truth.sellable === false)) {
    return { error:'CANONICAL_PRODUCT_HELD', status:'HOLD' };
  }
  const court = courtEvaluate('OFFER', offer, silo);
  if (court.decision === 'BLOCKED') return { status:'BLOCKED', court };
  const proposal = { proposal_id:'OFFER-' + crypto.randomUUID(), status:'AWAITING_HUMAN_APPROVAL', silo, offer, court, capital_authority:'ZERO', executed:false };
  ledger.appendEvent({ event_type:'MCP_OFFER_PROPOSED', silo, actor:{type:'model-proposal',id:'gemma'}, payload:proposal, result:'ELIGIBLE_FOR_HUMAN_APPROVAL' });
  return proposal;
}

function proposeCheckout(args) {
  const silo = args.silo || 'CORE';
  const checkout = args.checkout || {};
  if (!checkout.sku || Number(checkout.amount) <= 0 || !checkout.customer_ref) return { error:'Invalid checkout' };
  const cart = offerBySku(checkout.sku);
  if (!cart) return { error:'SKU not found', status:'REFUSE' };
  if (silo !== 'CORE' && String(cart.silo || '').toUpperCase() !== String(silo).toUpperCase()) return { error:'Silo access denied', status:'REFUSE' };
  if (Number(cart.price) !== Number(checkout.amount)) return { error:'Price mismatch', status:'REFUSE', expected:Number(cart.price), provided:Number(checkout.amount) };
  if (cart.status === 'held' || cart.checkout_available === false ||
      (cart.checkout && cart.checkout.mode === 'disabled') ||
      (cart.commercial_truth && cart.commercial_truth.sellable === false)) {
    return { error:'CANONICAL_PRODUCT_HELD', status:'HOLD' };
  }
  const court = courtEvaluate('CHECKOUT', checkout, silo);
  if (court.decision === 'BLOCKED') return { status:'BLOCKED', court };
  const proposal = { checkout_id:'CHECKOUT-' + crypto.randomUUID(), status:'AWAITING_HUMAN_APPROVAL', silo, checkout, cart_hash:ledger.sha256(cart), court, capital_authority:'ZERO', execution:'BLOCKED', executed:false };
  ledger.appendEvent({ event_type:'MCP_CHECKOUT_PROPOSED', silo, actor:{type:'model-proposal',id:'gemma'}, payload:proposal, result:'ELIGIBLE_FOR_HUMAN_APPROVAL' });
  return proposal;
}

function callTool(name, args) {
  if (!Object.prototype.hasOwnProperty.call(TOOL_PERMISSIONS, name)) throw new Error('Tool not found');
  if (!clientIdentity) return { error:'MCP identity is not initialized', status:'REFUSE' };
  if (!clientIdentity.allowed_tools.includes(name)) return { error:'Client tool scope denied', status:'REFUSE' };
  const silo = String(args.silo || 'CORE').toUpperCase();
  if (!clientIdentity.allowed_silos.includes(silo)) return { error:'Client silo scope denied', status:'REFUSE' };
  if (!['CORE','MTG','DREAMIEZ'].includes(silo)) return { error:'Silo access denied', status:'REFUSE' };
  if (name === 'dl_propose_offer') return proposeOffer({ ...args, silo });
  if (name === 'dl_propose_checkout') return proposeCheckout({ ...args, silo });
  if (name === 'dl_verify_proof') return verifyProof(args.proof_id, silo);
  if (name === 'dl_read_ledger') {
    const entries = ledger.readEvents().filter(event => {
      const eventSilo = String(event.silo || event.payload?.silo || event.payload?.checkout?.silo || event.payload?.offer?.silo || '').toUpperCase();
      if (silo === 'CORE') return !eventSilo || eventSilo === 'CORE';
      return eventSilo === silo;
    }).slice(-Math.min(Number(args.limit || 100), 100));
    return { entries, chain:ledger.verifyChain(), read_only:true, silo_scope:silo };
  }
  if (name === 'dl_read_inventory') return { inventory:'READ_ONLY', silo_scope:silo, note:'Inventory is exposed through the canonical product surface.', read_only:true };
  if (name === 'dl_read_cartridge') {
    const cart = offerBySku(args.sku);
    if (!cart) return { error:'Not found' };
    if (silo !== 'CORE' && String(cart.silo || '').toUpperCase() !== silo) return { error:'Silo access denied', status:'REFUSE' };
    const out={...cart}; delete out.internal_notes;
    return { sku:args.sku, cartridge:out, read_only:true, silo_scope:silo };
  }
  return { error:'Unhandled tool' };
}

function respond(req, result, error) { const out={jsonrpc:'2.0'}; if(error) out.error=error; else out.result=result; if(Object.prototype.hasOwnProperty.call(req,'id')) out.id=req.id; process.stdout.write(JSON.stringify(out)+'\n'); }
function handle(req) {
  const method=req.method || '';
  const params=req.params || {};
  if(method === 'initialize') {
    if(initialized) return respond(req,null,{code:-32000,message:'Already initialized'});
    loadManifest();
    const ci=params.clientInfo || {};
    if(!ci.name) return respond(req,null,{code:-32602,message:'clientInfo.name required'});
    let record;
    try {
      record = resolveClientIdentity(loadClientRegistry(), process.env.BEC_MCP_CLIENT_ID, ci.name);
    } catch (error) {
      return respond(req,null,{code:-32000,message:'MCP client registry invalid: ' + error.message});
    }
    if (record.error) return respond(req,null,{code:-32000,message:record.error});
    clientIdentity={
      client_id:record.client_id,
      name:String(ci.name),
      version:String(ci.version || ''),
      owner:record.owner,
      purpose:record.purpose,
      allowed_tools:record.allowed_tools,
      allowed_silos:record.allowed_silos,
      authority:record.authority,
      external_actions:false
    };
    initialized=true;
    ledger.appendEvent({event_type:'MCP_INITIALIZED',actor:{type:'mcp-client',id:clientIdentity.client_id},payload:{
      client:clientIdentity,
      manifest_hash:loadManifest().manifest_hash,
      client_registry_schema:loadClientRegistry().schema_version
    },result:'PASS'});
    return respond(req,{protocolVersion:PROTOCOL_VERSION,capabilities:{tools:{}},serverInfo:{name:'dreamledger-gateway',version:'1.3.0'}});
  }
  if(!initialized) return respond(req,null,{code:-32002,message:'Initialize first'});
  if(method === 'initialized') return respond(req,{});
  if(++callCount > MAX_CALLS) return respond(req,null,{code:-32000,message:'Session quota exceeded'});
  if(method === 'tools/list') return respond(req,{tools:loadManifest().tools.map(t=>({name:t.name,description:t.description,inputSchema:{type:'object'}}))});
  if(method === 'tools/call') { try { return respond(req,{content:[{type:'text',text:JSON.stringify(callTool(String(params.name || ''),{...(params.arguments || {})}) )}]}); } catch(e) { return respond(req,null,{code:-32000,message:e.message}); } }
  return respond(req,null,{code:-32601,message:'Method not found'});
}

const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{ if(!line.trim())return; if(Buffer.byteLength(line,'utf8')>MAX_MESSAGE_BYTES){return respond({id:null},null,{code:-32600,message:'Message too large'});} try{handle(JSON.parse(line));}catch(e){respond({id:null},null,{code:-32603,message:e.message});} });
