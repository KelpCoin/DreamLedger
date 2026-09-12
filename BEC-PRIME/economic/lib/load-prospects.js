// load-prospects.js
// Fail-closed CSV loader for prospect input.

const fs = require('fs');
const path = require('path');

const REQUIRED_COLUMNS = [
  'business',
  'source',
  'contact_route',
  'evidence_quote',
  'fit_reason',
  'channel',
  'personalization',
  'offer',
  'price_nzd',
  'role',
  'status',
];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadProspects(csvPath) {
  const abs = path.resolve(csvPath);

  if (!fs.existsSync(abs)) {
    throw new Error(`prospects.csv not found at ${abs}`);
  }

  const raw = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').trim();
  if (!raw) {
    throw new Error(`prospects.csv is empty at ${abs}`);
  }

  const lines = raw.split('\n');
  const header = parseCsvLine(lines[0]).map((h) => h.trim());

  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `prospects.csv is missing required columns: ${missing.join(', ')}`
    );
  }

  const columnIndex = Object.fromEntries(header.map((h, i) => [h, i]));
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = parseCsvLine(line);
    if (cells.length !== header.length) {
      throw new Error(
        `prospects.csv row ${i + 1} has ${cells.length} cells, expected ${header.length}`
      );
    }

    const row = {};
    for (const col of REQUIRED_COLUMNS) {
      row[col] = (cells[columnIndex[col]] || '').trim();
    }

    if (!row.business) {
      throw new Error(`prospects.csv row ${i + 1}: 'business' is empty`);
    }
    if (!row.offer) {
      throw new Error(`prospects.csv row ${i + 1}: 'offer' is empty`);
    }
    if (!row.contact_route) {
      throw new Error(`prospects.csv row ${i + 1}: 'contact_route' is empty`);
    }
    if (!row.evidence_quote) {
      throw new Error(`prospects.csv row ${i + 1}: 'evidence_quote' is empty`);
    }

    const priceNum = Number(row.price_nzd);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new Error(
        `prospects.csv row ${i + 1}: price_nzd must be a positive number, got '${row.price_nzd}'`
      );
    }
    row.price_nzd = priceNum;

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error(`prospects.csv contained a header but no data rows`);
  }

  return rows;
}

module.exports = { loadProspects, REQUIRED_COLUMNS };
