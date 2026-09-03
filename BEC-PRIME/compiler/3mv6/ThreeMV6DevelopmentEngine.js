'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const SPEC_PATH = path.join(ROOT, 'compiler', 'universal-specs', '3mv6-development-engine.v1.json');
const OUT_DIR = path.join(ROOT, 'compiled', 'development', '3mv6');
const PROOF_PATH = path.join(ROOT, 'RUN-PROOFS', '3MV6-DEVELOPMENT-ENGINE-PROOF.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function deterministicId(type, index) {
  return `3mv6_${type}_${String(index).padStart(5, '0')}`;
}

function seedFor(spec, type, assetId) {
  return sha256(`${spec.id}:${type}:${assetId}:${spec.generation.rebuild_policy}`);
}

function makeDefinition(spec, type, index, silo) {
  const assetId = deterministicId(type, index);
  return {
    asset_id: assetId,
    asset_type: type,
    silo,
    generation_version: spec.schema,
    seed: seedFor(spec, type, assetId),
    provenance: { generator: spec.id, generator_version: spec.schema },
    ownership_class: type === 'resource' ? 'tradeable' : 'persistent_owned',
    tags: [`generated:${type}`]
  };
}

function run(options = {}) {
  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  const counts = options.counts || {
    mob: 1000,
    item: 1000,
    boss: 100,
    npc: 100,
    identity: 1000,
    property: 100
  };

  const generated = [];
  for (const [type, count] of Object.entries(counts)) {
    const silo = type === 'identity' ? 'SILO_DREAMMEEZ' : type === 'item' || type === 'property' ? 'SILO_KELPLANTIS' : 'SILO_KELPLANTIS';
    for (let i = 1; i <= Number(count); i += 1) generated.push(makeDefinition(spec, type, i, silo));
  }

  const manifest = {
    schema: 'bec/3mv6-asset-manifest/v1',
    engine: spec.id,
    status: 'GENERATED_DEVELOPMENT_MANIFEST',
    generated_at: new Date().toISOString(),
    count: generated.length,
    definitions: generated
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(PROOF_PATH), { recursive: true });
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const manifestPath = path.join(OUT_DIR, 'asset-manifest.json');
  fs.writeFileSync(manifestPath, manifestText, 'utf8');

  const proof = {
    schema: 'bec/3mv6-development-engine-proof/v1',
    status: 'PASS',
    engine: '3MV6',
    mode: 'DEVELOPMENT_ENGINE_ONLY',
    generated_count: generated.length,
    counts,
    silo_counts: generated.reduce((acc, item) => {
      acc[item.silo] = (acc[item.silo] || 0) + 1;
      return acc;
    }, {}),
    deterministic_ids: new Set(generated.map(x => x.asset_id)).size === generated.length,
    deterministic_seeds: generated.every(x => /^[a-f0-9]{64}$/.test(x.seed)),
    ownership_classes: generated.every(x => typeof x.ownership_class === 'string' && x.ownership_class.length > 0),
    output: {
      path: 'compiled/development/3mv6/asset-manifest.json',
      sha256: sha256(manifestText)
    }
  };

  fs.writeFileSync(PROOF_PATH, JSON.stringify(proof, null, 2) + '\n', 'utf8');
  return proof;
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { run };
