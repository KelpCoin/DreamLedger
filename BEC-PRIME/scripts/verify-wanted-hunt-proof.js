'use strict';

const fs = require('fs');
const crypto = require('crypto');

function fail(message) { throw new Error('PROOF_VERIFY_FAIL: ' + message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

const file = process.argv[2];
if (!file) fail('proof JSON path is required');
if (!fs.existsSync(file)) fail('proof file does not exist');

const proof = readJson(file);
for (const key of ['schema_version','run_id','wanted_id','hunt_id','timestamp','source','candidates','gates','source_feasibility','commercial_signal']) {
  if (proof[key] === undefined) fail('missing ' + key);
}
if (proof.schema_version !== '1.1') fail('unexpected schema_version');
if (!proof.wanted_id) fail('wanted_id empty');
if (!proof.hunt_id) fail('hunt_id empty');
if (proof.commercial_signal !== 'UNPROVEN') fail('commercial_signal must be UNPROVEN');
if (proof.source.platform !== 'ebay') fail('source platform must be ebay');
if (!proof.source.endpoint || !proof.source.request || !proof.source.response) fail('source request/response evidence missing');
if (proof.source.request.method !== 'GET') fail('request method must be GET');
if (!String(proof.source.request.params.filter || '').includes('deliveryCountry:NZ')) fail('actual request did not contain deliveryCountry:NZ');
if (proof.source.response.http_status !== 200) fail('HTTP status is not 200');
if (!proof.source.response.raw_response_sha256) fail('raw response hash missing');
if (!fs.existsSync(proof.source.response.raw_response_file)) fail('raw response file missing');
if (hashFile(proof.source.response.raw_response_file) !== proof.source.response.raw_response_sha256) fail('raw response hash mismatch');
if (!Array.isArray(proof.candidates)) fail('candidates is not an array');
for (const c of proof.candidates) {
  for (const key of ['item_id','item_url','title','item_price','item_currency','shipping_price','shipping_currency','evidence','scores','total_score','verdict']) {
    if (c[key] === undefined) fail('candidate missing ' + key);
  }
  if (c.fx_rate !== null) fail('FX rate must be null unless backed by an explicit FX provider');
  if (c.price_normalization_status !== 'NOT_NEEDED' && c.price_normalization_status !== 'NOT_PERFORMED' && c.price_normalization_status !== 'VERIFIED') fail('invalid price normalization status');
  if (c.raw_reference && c.raw_reference.sha256 !== proof.source.response.raw_response_sha256) fail('candidate raw reference hash mismatch');
}
const gates = proof.gates;
const required = ['G0_code_exists','G1_credentials_accepted','G2_oauth_token_obtained','G3_live_request_sent','G4_http_200','G5_item_summaries_returned','G14_url_item_id_present','G15_proof_generated','G16_proof_tied_to_wanted'];
for (const gate of required) if (gates[gate] !== 'PASS') fail(gate + ' is ' + gates[gate]);
if (gates.G13_delivery_country_verified !== 'PASS') fail('delivery gate failed');
if (proof.source_feasibility === 'PASS' && (gates.G11_price_currency_verified !== 'PASS' || gates.G12_price_cap_verified !== 'PASS')) fail('source feasibility cannot PASS without verified currency and price cap');
console.log('PROOF_VERIFY=PASS');
console.log('WANTED_ID=' + proof.wanted_id);
console.log('HUNT_ID=' + proof.hunt_id);
console.log('SOURCE_FEASIBILITY=' + proof.source_feasibility);
console.log('COMMERCIAL_SIGNAL=' + proof.commercial_signal);
console.log('CANDIDATES=' + proof.candidates.length);
