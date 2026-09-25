'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'data', 'factory-factory', 'FACTORY-FACTORY-QUEUE.json');
const OUT = path.join(ROOT, 'data', 'factory-factory', 'UNIVERSAL-MONEY-CELLS.json');

const STRUCTURES = Object.freeze({
  ARBITRAGE: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'verified transfer or bounded delivery after settled transaction',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  SUBSCRIPTION: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'recurring delivery or monitoring with cancellation handling',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  SERVICE: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'bounded deliverable with completion evidence',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  PRODUCT: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'digital delivery or physical shipment with delivery evidence',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  VERIFICATION: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'evidence artifact with source provenance and verification receipt',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  INFORMATION: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'structured information with source timestamp and provenance',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  AUTOMATION: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'configured workflow plus runtime proof',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  MARKETPLACE: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'verified match or transaction handoff',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  EDUCATION: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'bounded lesson, guide, or cohort artifact',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  },
  ACCESS: {
    required: ['demand_signal','buyer_class','offer_shape','price_band','acquisition_surface','fulfillment_contract','truth_boundary','kill_conditions'],
    fulfillment: 'credential, entitlement, invitation, or compute access after settlement',
    truth: ['external_buyer','settled_payment','correct_attribution','fulfillment','independent_proof']
  }
});

function sha(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function classify(x) {
  const explicit = String(x.structure || x.structure_type || '').toUpperCase();
  if (STRUCTURES[explicit]) return explicit;
  const text = JSON.stringify(x).toLowerCase();
  if (/arbitrage|price gap|spread|discrepancy/.test(text)) return 'ARBITRAGE';
  if (/subscription|recurring|monthly|weekly monitor|alert/.test(text)) return 'SUBSCRIPTION';
  if (/automation|workflow|zapier|n8n|agent/.test(text)) return 'AUTOMATION';
  if (/verify|verification|provenance|compliance|trust/.test(text)) return 'VERIFICATION';
  if (/data|feed|dataset|research|information/.test(text)) return 'INFORMATION';
  if (/marketplace|matchmaker|match buyer|seller/.test(text)) return 'MARKETPLACE';
  if (/course|education|training|guide|tutorial/.test(text)) return 'EDUCATION';
  if (/access|credential|membership|compute/.test(text)) return 'ACCESS';
  if (/product|card|deck|physical|download|template/.test(text)) return 'PRODUCT';
  return 'SERVICE';
}

function compileCell(x, index) {
  const structure = classify(x);
  const spec = STRUCTURES[structure];
  const base = {
    demand_signal: x.demand_signal || x.demand?.signal || x.hypothesis || x.problem || null,
    buyer_class: x.buyer_class || x.buyer || x.demand?.buyer || null,
    offer_shape: x.offer_shape || x.offer || x.proposition?.offer || null,
    price_band: x.price_band || x.price_nzd || x.proposition?.price_nzd || null,
    acquisition_surface: x.acquisition_surface || x.channels || x.execution?.acquisition_surface || [],
    fulfillment_contract: x.fulfillment_contract || x.fulfillment || x.execution?.fulfillment || spec.fulfillment,
    truth_boundary: x.truth_boundary || spec.truth,
    kill_conditions: x.kill_conditions || ['no external buyer','no settled payment','fulfillment failure','contradictory evidence']
  };
  const completeness = Object.values(base).filter(v => Array.isArray(v) ? v.length : v !== null && v !== '').length;
  return {
    cell_id: 'UFC-' + sha(JSON.stringify({structure,base,index})).slice(0,20).toUpperCase(),
    structure,
    template_version: '1.0',
    state: completeness >= 7 ? 'COMPILED' : 'INCOMPLETE',
    source: { experiment_id: x.experiment_id || null, opportunity_id: x.opportunity_id || null, source_index: index },
    contract: base,
    authority: {
      publication: 'APPROVAL_REQUIRED',
      outreach: 'APPROVAL_REQUIRED',
      spend: 'APPROVAL_REQUIRED',
      charge: 'APPROVAL_REQUIRED',
      production_mutation: 'APPROVAL_REQUIRED',
      truth_claim: 'TRUTH_ORACLE_ONLY'
    },
    economic_truth: {
      external_buyer: false,
      settled_payment: false,
      correct_attribution: false,
      fulfillment: false,
      independent_proof: false,
      revenue: 'UNVERIFIED'
    },
    replication: {
      enabled: false,
      trigger: 'BUSINESS_TRUTH',
      rule: 'Clone only after an independently verified external economic mechanism exists.',
      initial_clone_limit: 3
    }
  };
}

function run(limit = Number(process.env.UNIVERSAL_FACTORY_BATCH || 200)) {
  if (!fs.existsSync(QUEUE)) throw new Error('Factory queue missing. Run compile:factory-factory first.');
  const q = JSON.parse(fs.readFileSync(QUEUE,'utf8'));
  const items = Array.isArray(q.queue) ? q.queue.slice(0,limit) : [];
  const cells = items.map(compileCell);
  const byStructure = {};
  for (const cell of cells) byStructure[cell.structure] = (byStructure[cell.structure] || 0) + 1;
  const out = {
    schema_version: 'DREAMLEDGER/UNIVERSAL-FACTORY/v1',
    generated_at_utc: new Date().toISOString(),
    objective: 'Compile heterogeneous demand into common bounded economic cells without inventing buyers, payments, evidence, or revenue.',
    structure_count: Object.keys(STRUCTURES).length,
    input_count: items.length,
    compiled_count: cells.filter(x=>x.state==='COMPILED').length,
    incomplete_count: cells.filter(x=>x.state==='INCOMPLETE').length,
    by_structure: byStructure,
    cells,
    next: 'Only authorized acquisition may cross from COMPILED to external effect.',
    truth_rule: 'Internal compilation is never economic proof.'
  };
  out.integrity_sha256 = sha(JSON.stringify(out));
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
  return out;
}

if (require.main === module) {
  const r = run();
  console.log(JSON.stringify({status:'PASS',structure_count:r.structure_count,input_count:r.input_count,compiled_count:r.compiled_count,incomplete_count:r.incomplete_count,by_structure:r.by_structure,output:OUT},null,2));
}
module.exports={STRUCTURES,classify,compileCell,run};
