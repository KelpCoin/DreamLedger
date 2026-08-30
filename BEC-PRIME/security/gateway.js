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

function safeId(value) { return typeof value === 'string' && value.length > 0 && value.length < 128 && !value.includes('..') && !/[\\/]/.test(value); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function verifyProof(proofId) {
  if (!safeId(proofId)) return { verified:false, reason:'Invalid proof id' };
  const file = path.join(PROOF_DIR, proofId + '.json');
  if (!fs.existsSync(file)) return { verified:false, reason:'Proof not found' };
  const proof = readJson(file);
  if (!proof.data || !proof.hash) return { verified:false, reason:'Proof hash missing' };
  const computed = hash(JSON.stringify(proof.data, Object.keys(proof.data).sort()));
  return { proof_id:proofId, verified:computed === proof.hash, computed_hash:computed };
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
  if (!cart) return { error:'SKU not found' };
  if (silo !== 'CORE' && String(cart.silo || '').toLowerCase() !== String(silo).toLowerCase()) return { error:'Silo access denied' };
  if (Number(cart.price) !== Number(checkout.amount)) return { error:'Price mismatch', expected:Number(cart.price), provided:Number(checkout.amount) };
  const court = courtEvaluate('CHECKOUT', checkout, silo);
  if (court.decision === 'BLOCKED') return { status:'BLOCKED', court };
  const proposal = { checkout_id:'CHECKOUT-' + crypto.randomUUID(), status:'AWAITING_HUMAN_APPROVAL', silo, checkout, cart_hash:hash(JSON.stringify(cart)), court, capital_authority:'ZERO', execution:'BLOCKED', executed:false };
  ledger.appendEvent({ event_type:'MCP_CHECKOUT_PROPOSED', silo, actor:{type:'model-proposal',id:'gemma'}, payload:proposal, result:'ELIGIBLE_FOR_HUMAN_APPROVAL' });
  return proposal;
}

function callTool(name, args) {
  if (!Object.prototype.hasOwnProperty.call(TOOL_PERMISSIONS, name)) throw new Error('Tool not found');
  const silo = args.silo || 'CORE';
  if (!['CORE','MTG','DREAMIEZ'].includes(silo)) return { error:'Silo access denied' };
  if (name === 'dl_propose_offer') return proposeOffer(args);
  if (name === 'dl_propose_checkout') return proposeCheckout(args);
  if (name === 'dl_verify_proof') return verifyProof(args.proof_id);
  if (name === 'dl_read_ledger') return { entries:ledger.readEvents().slice(-Math.min(Number(args.limit || 100),100)).map(e => ({...e, payload:{...e.payload, customer_ref:undefined}})), chain:ledger.verifyChain(), read_only:true };
  if (name === 'dl_read_inventory') return { inventory:'READ_ONLY', note:'Inventory is exposed through the canonical product surface.', read_only:true };
  if (name === 'dl_read_cartridge') { const cart = offerBySku(args.sku); if (!cart) return { error:'Not found' }; if (silo !== 'CORE' && String(cart.silo || '').toLowerCase() !== String(silo).toLowerCase()) return { error:'Silo access denied' }; const out={...cart}; delete out.internal_notes; return { sku:args.sku, cartridge:out, read_only:true }; }
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
    clientIdentity={name:String(ci.name),version:String(ci.version || '')}; initialized=true;
    ledger.appendEvent({event_type:'MCP_INITIALIZED',actor:{type:'mcp-client',id:clientIdentity.name},payload:{client:clientIdentity,manifest_hash:loadManifest().manifest_hash},result:'PASS'});
    return respond(req,{protocolVersion:PROTOCOL_VERSION,capabilities:{tools:{}},serverInfo:{name:'dreamledger-gateway',version:'1.2.0'}});
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
