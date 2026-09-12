// write-outreach-queue.js
// Writes OUTREACH_QUEUE.csv with a fixed schema and dedupes against
// previously-sent contacts. Every row is approval-gated.
//
// The cockpit never sends anything. It produces the queue a human
// reviews and sends.

const fs = require('fs');
const path = require('path');

const QUEUE_COLUMNS = [
  'opportunity_id',
  'business',
  'channel',
  'contact_route',
  'offer_sku',
  'price_nzd',
  'evidence_quote',
  'draft_message',
  'approval_required',
  'status',
  'created_at',
];

function escapeCsv(value) {
  const s = value == null ? '' : String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readSentLog(sentPath) {
  if (!fs.existsSync(sentPath)) return new Set();
  const raw = fs.readFileSync(sentPath, 'utf8');
  const sent = new Set();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const business = trimmed.split(',')[0].trim();
    if (business) sent.add(business.toLowerCase());
  }
  return sent;
}

function writeOutreachQueue({ rows, outPath, sentLogPath }) {
  const sent = readSentLog(sentLogPath);
  const written = [];
  const skipped = [];

  for (const row of rows) {
    if (sent.has(row.business.toLowerCase())) {
      skipped.push(row.business);
      continue;
    }
    written.push(row);
  }

  const lines = [QUEUE_COLUMNS.join(',')];
  for (const row of written) {
    lines.push(
      [
        row.opportunity_id,
        row.business,
        row.channel,
        row.contact_route,
        row.offer_sku,
        row.price_nzd,
        row.evidence_quote,
        row.draft_message,
        'true',
        'READY_FOR_APPROVAL',
        new Date().toISOString(),
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  fs.writeFileSync(path.resolve(outPath), lines.join('\n') + '\n', 'utf8');

  return {
    written: written.length,
    skipped_already_sent: skipped.length,
    out_path: path.resolve(outPath),
  };
}

module.exports = { writeOutreachQueue, QUEUE_COLUMNS };
