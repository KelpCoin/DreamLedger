'use strict';

// MTG MASTER SILO: read-only import staging, not a second inventory authority.
// Converts a real export into quarantined, unapproved candidates.
// Neither Supabase nor storefront inventory is changed by this tool.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function parseCsv(source) {
  const text = String(source).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted) quoted = false;
      else if (!field) quoted = true;
      else throw new Error('Invalid CSV quote at byte ' + i);
    } else if (c === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quoted field');
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  if (!rows.length) throw new Error('CSV has no header');
  const keys = rows.shift().map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, ''));
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate CSV headers');
  return rows.map((cells, i) => {
    if (cells.length !== keys.length) return { __error: 'COLUMN_COUNT_MISMATCH', __line: i + 2 };
    const obj = { __line: i + 2 };
    keys.forEach((key, col) => { obj[key] = cells[col].trim(); });
    return obj;
  });
}
const take = (r, keys) => keys.map(k => r[k]).find(v => v !== undefined && v !== '') || '';
const str = v => String(v || '').trim();
const money = v => {
  if (v === null || v === undefined || str(v) === '') return null;
  const n = Number(str(v).replace(/^(NZ\$|NZD\s*)/i, '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const sha = v => crypto.createHash('sha256').update(v).digest('hex');

function prepare(source, options = {}) {
  const input = String(source);
  const importSha = sha(input);
  const rows = parseCsv(input);
  const accepted = [], quarantine = [], seen = new Set();
  let duplicates = 0, rejected = 0;
  for (const r of rows) {
    const name = str(take(r, ['name','cardname','card','cardnameen']));
    const setCode = str(take(r, ['setcode','set','editioncode'])).toLowerCase();
    const collector = str(take(r, ['collectornumber','cardnumber','number']));
    const scryfall = str(take(r, ['scryfallid','scryfalluuid'])).toLowerCase();
    const finishInput = str(take(r, ['finish','foil','isfoil'])).toLowerCase();
    const finish = ['true','yes','foil','1'].includes(finishInput) ? 'foil' :
      ['etched','etchedfoil'].includes(finishInput) ? 'etched' :
      ['false','no','nonfoil','0','normal',''].includes(finishInput) ? 'nonfoil' : '';
    const condition = str(take(r, ['condition','cardcondition']));
    const language = str(take(r, ['language','lang'])) || 'en';
    const location = str(take(r, ['location','box','storage','binder']));
    const quantityRaw = str(take(r, ['quantity','qty','count']));
    const quantity = Number(quantityRaw || '1');
    const referencePrice = money(take(r, ['pricenzd','marketpricenzd','referencepricenzd']));
    const errors = [];
    if (r.__error) errors.push(r.__error);
    if (!name) errors.push('NAME_REQUIRED');
    if (!scryfall && (!setCode || !collector)) errors.push('PRINTING_AMBIGUOUS');
    if (scryfall && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(scryfall)) errors.push('INVALID_SCRYFALL_ID');
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100000) errors.push('INVALID_QUANTITY');
    if (!finish) errors.push('FINISH_AMBIGUOUS');
    if (errors.length) {
      quarantine.push({ line: r.__line, reasons: errors, raw: r });
      rejected++; continue;
    }
    const fingerprint = sha(JSON.stringify({
      source_scope: 'MERCHANT_CANDIDATE', scryfall, name: name.toLowerCase(),
      set_code: setCode, collector_number: collector, finish,
      condition: condition.toLowerCase(), language: language.toLowerCase(),
      location: location.toLowerCase()
    }));
    if (seen.has(fingerprint)) { duplicates++; continue; }
    seen.add(fingerprint);
    const item = {
      import_sha256: importSha, source_row: r.__line, candidate_id: fingerprint,
      ownership_domain: 'MERCHANT_CANDIDATE',
      verification_state: 'UNVERIFIED', publication_approved: false,
      scryfall_id_supplied: scryfall || null,
      scryfall_metadata_verified: false,
      name, set_code: setCode || null, collector_number: collector || null,
      quantity_claimed: quantity, condition: condition || null, finish,
      language, location: location || null,
      reference_price_nzd_unverified: referencePrice,
      expected_net_cash_nzd: null
    };
    accepted.push(item);
  }
  const actions = accepted.map(item => ({
    candidate_id: item.candidate_id,
    name: item.name,
    priority_reference_gross_nzd: item.reference_price_nzd_unverified === null
      ? null : Math.round(item.reference_price_nzd_unverified * item.quantity_claimed * 100) / 100,
    action: !item.location ? 'CONFIRM_PRINTING_CONDITION_AND_LOCATION' :
      !item.condition ? 'CONFIRM_PRINTING_AND_CONDITION' : 'CONFIRM_PHYSICAL_STOCK_AND_PRINTING',
    ready_to_publish: false
  })).sort((a,b) => (b.priority_reference_gross_nzd || 0) - (a.priority_reference_gross_nzd || 0));
  return {
    schema:'dreamledger/mtg-master-import-preview/v1',
    source_name: options.source_name || 'uploaded_export',
    import_sha256: importSha, import_id: 'mtg-preview-' + importSha.slice(0,16),
    owner_scope: 'MERCHANT_CANDIDATE_UNVERIFIED',
    source_rows: rows.length, accepted: accepted.length,
    duplicate_rows: duplicates, quarantined: quarantine.length, rejected,
    physical_verified_count: 0, public_listing_count: 0, realized_cash_nzd: 0,
    records: accepted, quarantine, next_actions: actions.slice(0,100),
    warning: 'PREVIEW ONLY. Existing DreamLedger inventory remains authoritative. No stock, prices, publication, payment or seller ownership was verified.'
  };
}

function main(argv) {
  const idx = argv.indexOf('--input');
  if (idx === -1 || !argv[idx+1]) throw Error('Usage: node mtg-inventory-import-preview.js --input <real-export.csv> [--out <private-directory>]');
  const inputFile = path.resolve(argv[idx+1]);
  const outIdx = argv.indexOf('--out');
  const outputDir = path.resolve(outIdx >= 0 && argv[outIdx+1] ? argv[outIdx+1] : path.join(process.cwd(), 'proof', 'mtg-import-private'));
  const bytes = fs.readFileSync(inputFile);
  if (bytes.length > 20 * 1024 * 1024) throw Error('CSV exceeds 20 MiB safety limit');
  const result = prepare(bytes.toString('utf8'), {source_name: path.basename(inputFile)});
  fs.mkdirSync(outputDir, {recursive:true});
  const file = path.join(outputDir, 'import-preview-' + result.import_sha256.slice(0,16) + '.json');
  fs.writeFileSync(file, JSON.stringify(result,null,2)+'\n', {flag:'w',mode:0o600});
  const proof = {
    schema:'dreamledger/mtg-import-proof/v1', observed_at:new Date().toISOString(),
    import_id:result.import_id, source_sha256:result.import_sha256,
    accepted:result.accepted, duplicate_rows:result.duplicate_rows,
    quarantined:result.quarantined, physical_stock_verified:false,
    public_listing_created:false, revenue_verified:false, output:file
  };
  fs.writeFileSync(path.join(outputDir, 'last-proof.json'), JSON.stringify(proof,null,2)+'\n', {mode:0o600});
  console.log(JSON.stringify({ok:true,proof:path.join(outputDir,'last-proof.json'),preview:file,accepted:result.accepted,quarantined:result.quarantined,duplicates:result.duplicate_rows}));
}
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (err) { console.error('MTG_IMPORT_PREVIEW_FAIL:',err.message); process.exitCode = 1; }
}
module.exports = {parseCsv,prepare,main};
