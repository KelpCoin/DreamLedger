'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'autonomy', 'action-packs');

function build(opportunity) {
  const id = `PACK-${crypto.createHash('sha256').update(JSON.stringify(opportunity)).digest('hex').slice(0, 16).toUpperCase()}`;
  return {
    schema_version: 'BEC-BUILDER-BOSS-1.0',
    action_pack_id: id,
    status: opportunity.status === 'CANDIDATE' ? 'READY_FOR_GAUNTLET' : 'KILLED',
    opportunity_id: opportunity.opportunity_id,
    atoms: opportunity.status === 'CANDIDATE' ? [
      { atom: 1, action: 'compile_product_offers', command: 'npm run compile:products' },
      { atom: 2, action: 'run_gauntlet', command: 'npm run gauntlet' },
      { atom: 3, action: 'generate_checkout_surface', command: 'npm run compile' },
      { atom: 4, action: 'record_proof', command: 'npm run autonomy:cycle' }
    ] : [],
    asset_type: 'CommerceOffer',
    public_execution: 'APPROVAL_REQUIRED',
    kill_condition: opportunity.kill_condition,
    created_at_utc: new Date().toISOString()
  };
}

function write(opportunity) {
  const pack = build(opportunity);
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${pack.action_pack_id}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  return { ...pack, file };
}

module.exports = { build, write };
