import fs from 'node:fs';

const path = 'BEC-PRIME/operator/revenue-engine-concepts.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const required = ['id','name','domain'];
const errors = [];
if (data.schema_version !== '1.0') errors.push('schema_version must be 1.0');
if (JSON.stringify(data.required_sequence) !== JSON.stringify(['OBSERVE','AUTHORITY','CLASSIFY','DECIDE','ACT','VERIFY','EVIDENCE','RECONCILE','LEARN'])) errors.push('invalid required_sequence');
if (!Array.isArray(data.concepts) || data.concepts.length < 100) errors.push('registry must contain at least 100 concepts');
const ids = new Set();
for (const c of data.concepts || []) {
  for (const k of required) if (!c[k] || typeof c[k] !== 'string') errors.push(`missing ${k} in concept`);
  if (ids.has(c.id)) errors.push(`duplicate concept id: ${c.id}`);
  ids.add(c.id);
}
if (errors.length) { console.error(JSON.stringify({status:'FAIL', errors}, null, 2)); process.exit(1); }
const domains = [...new Set(data.concepts.map(c => c.domain))].sort();
console.log(JSON.stringify({status:'PASS', schema_version:data.schema_version, concepts:data.concepts.length, domains, sequence:data.required_sequence}, null, 2));
