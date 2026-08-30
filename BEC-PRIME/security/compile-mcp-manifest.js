'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const source = path.join(ROOT, 'security', 'mcp-gateway-manifest.json');
const outDir = path.join(ROOT, 'compiled', 'security');
const mirror = path.join(outDir, 'mcp-gateway-manifest.json');

function hash(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function canonical(manifest) {
  return JSON.stringify({
    schema_version: manifest.schema_version,
    gateway: manifest.gateway,
    transport: manifest.transport,
    protocol_version: manifest.protocol_version,
    tools: manifest.tools
  }, null, 2) + '\n';
}

const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
manifest.manifest_hash = hash(canonical(manifest));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(source, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(mirror, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: 'PASS', manifest_hash: manifest.manifest_hash, source, mirror }, null, 2));
