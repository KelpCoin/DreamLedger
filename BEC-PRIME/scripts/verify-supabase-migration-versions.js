'use strict';

const fs = require('fs');
const path = require('path');

const migrationDir = path.resolve(__dirname, '..', '..', 'supabase', 'migrations');
const files = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql'));
const versions = new Map();

for (const name of files) {
  const match = name.match(/^(\d+)_.*\.sql$/);
  if (!match) continue;
  const version = match[1];
  const group = versions.get(version) || [];
  group.push(name);
  versions.set(version, group);
}

const duplicates = [...versions.entries()].filter(([, names]) => names.length > 1);
if (duplicates.length) {
  console.error('SUPABASE_MIGRATION_VERSION_UNIQUENESS=FAIL');
  for (const [version, names] of duplicates) {
    console.error(`DUPLICATE_VERSION ${version}: ${names.join(', ')}`);
  }
  console.error('Do not apply migrations until versions are reconciled against the live migration history.');
  process.exit(1);
}

console.log(`SUPABASE_MIGRATION_VERSION_UNIQUENESS=PASS files=${files.length}`);
