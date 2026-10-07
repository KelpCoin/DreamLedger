'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const INBOX = path.join(ROOT, 'AGENT_BUS', 'BRIDGE', 'MTG_INTAKE', 'inbox');
const CANONICAL = path.join(ROOT, 'AGENT_BUS', 'BRIDGE', 'MTG_INTAKE', 'canonical');
const RECEIPTS = path.join(ROOT, 'AGENT_BUS', 'BRIDGE', 'MTG_INTAKE', 'receipts');
const PROCESSED = path.join(ROOT, 'AGENT_BUS', 'BRIDGE', 'MTG_INTAKE', 'processed');

const SUBMISSION_SCHEMA = 'dreamledger/mtg-agent-bridge-submission/v1';
const INTAKE_SCHEMA = 'dreamledger/mtg-agent-bridge-intake/v1';

function mkdirs() {
  for (const dir of [CANONICAL, RECEIPTS, PROCESSED]) fs.mkdirSync(dir, { recursive: true });
}

function jsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clean(v) {
  return v === undefined || v === '' || v === '?' ? null : v;
}

function validate(x, file) {
  const required = ['schema','source_worker','source_device','submitted_by','commander','deck_name','ballpark_price_nzd','notes','decklist_text'];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(x, key)) throw new Error(file + ': missing ' + key);
  }
  if (x.schema !== SUBMISSION_SCHEMA) throw new Error(file + ': wrong schema');
  if (x.ballpark_price_nzd !== null && (typeof x.ballpark_price_nzd !== 'number' || x.ballpark_price_nzd < 0)) {
    throw new Error(file + ': ballpark_price_nzd must be null or a non-negative number');
  }
}

function nextId() {
  const ids = [];
  for (const dir of [CANONICAL, RECEIPTS]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const m = name.match(/^MTG-(\d+)\.json$/);
      if (m) ids.push(Number(m[1]));
    }
  }
  return 'MTG-' + String((ids.length ? Math.max(...ids) : 0) + 1).padStart(4, '0');
}

function ingest(file) {
  const submission = jsonFile(file);
  validate(submission, path.basename(file));
  const intakeId = nextId();
  const now = new Date().toISOString();

  const canonical = {
    schema: INTAKE_SCHEMA,
    intake_id: intakeId,
    source_worker: submission.source_worker,
    source_device: submission.source_device,
    submitted_by: submission.submitted_by,
    submitted_at: now,
    canonical_destination: 'DREAMLEDGER_MTG',
    truth_state: 'UNVERIFIED',
    publication_state: 'NOT_PUBLISHED',
    raw_human_input: [
      'Commander: ' + (submission.commander ?? '?'),
      'Deck name: ' + (submission.deck_name ?? '?'),
      'Rough price: ' + (submission.ballpark_price_nzd == null ? '?' : 'NZ$' + submission.ballpark_price_nzd),
      'Notes: ' + (submission.notes ?? '?')
    ].join('\n'),
    normalized: {
      item_type: 'EDH_DECK',
      commander: clean(submission.commander),
      deck_name: clean(submission.deck_name),
      ballpark_price_nzd: submission.ballpark_price_nzd,
      condition: 'UNKNOWN',
      notes: clean(submission.notes),
      decklist_text: clean(submission.decklist_text)
    },
    evidence: {
      work_receipt: 'AGENT_BUS/BRIDGE/MTG_INTAKE/receipts/' + intakeId + '.json',
      canonical_record: 'AGENT_BUS/BRIDGE/MTG_INTAKE/canonical/' + intakeId + '.json',
      source_message: path.relative(ROOT, file).replaceAll('\\', '/')
    },
    next_stage: 'MTG_PRIMER'
  };

  const receipt = {
    schema: 'dreamledger/agent-bridge-work-receipt/v1',
    receipt_id: 'WR-' + intakeId,
    worker: submission.source_worker,
    device: submission.source_device,
    human_gate: submission.submitted_by,
    task: 'MTG_DECK_INTAKE',
    input: path.relative(ROOT, file).replaceAll('\\', '/'),
    canonical_destination: 'DREAMLEDGER_MTG',
    record: intakeId,
    status: 'ACCEPTED',
    truth_state: 'UNVERIFIED',
    publication_state: 'NOT_PUBLISHED',
    next_task: 'MTG_PRIMER',
    created_at: now
  };

  fs.writeFileSync(path.join(CANONICAL, intakeId + '.json'), JSON.stringify(canonical, null, 2) + '\n');
  fs.writeFileSync(path.join(RECEIPTS, intakeId + '.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.renameSync(file, path.join(PROCESSED, path.basename(file)));
  return intakeId;
}

mkdirs();
const submissions = fs.readdirSync(INBOX)
  .filter(x => x.endsWith('.json'))
  .filter(x => x !== 'submission-template.json')
  .map(x => path.join(INBOX, x));

const results = [];
for (const file of submissions) {
  try {
    results.push({ file: path.relative(ROOT, file), status: 'ACCEPTED', intake_id: ingest(file) });
  } catch (error) {
    results.push({ file: path.relative(ROOT, file), status: 'REJECTED', error: error.message });
  }
}

console.log(JSON.stringify({ schema: 'dreamledger/mtg-bridge-ingest-proof/v1', processed: results }, null, 2));
if (results.some(x => x.status === 'REJECTED')) process.exitCode = 1;
