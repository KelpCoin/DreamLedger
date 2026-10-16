'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');

const root = path.resolve(__dirname, '..', '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });

const schemaPaths = [
  'CONTROL-PLANE/SILO-PACK-TEMPLATE/silo.schema.json',
  'CONTROL-PLANE/SILO-PACK-TEMPLATE/word-bank.schema.json',
  'CONTROL-PLANE/SILO-PACK-TEMPLATE/catalog.schema.json',
  'CONTROL-PLANE/SILO-PACK-TEMPLATE/evidence.schema.json',
];
for (const schemaPath of schemaPaths) {
  ajv.compile(readJson(schemaPath));
}

const siloSchema = readJson(schemaPaths[0]);
const silo = readJson('CONTROL-PLANE/SILO-PACK-TEMPLATE/silo.json');
const validateSilo = ajv.compile(siloSchema);
if (!validateSilo(silo)) {
  throw new Error(`SILO_TEMPLATE_INVALID: ${ajv.errorsText(validateSilo.errors)}`);
}

for (const bankPath of [
  'CONTROL-PLANE/SILO-PACK-TEMPLATE/word-banks/default.json',
  'CONTROL-PLANE/SILO-PACK-TEMPLATE/word-banks/mtg-commander.json',
]) {
  const bank = readJson(bankPath);
  const validateBank = ajv.compile(readJson(schemaPaths[1]));
  if (!validateBank(bank)) {
    throw new Error(`WORD_BANK_INVALID (${bankPath}): ${ajv.errorsText(validateBank.errors)}`);
  }
}

for (const [label, relative] of Object.entries({
  catalog: silo.schemas.catalog,
  offer: silo.schemas.offer,
  evidence: silo.schemas.evidence,
  product: silo.schemas.product,
  checkout: silo.schemas.checkout,
  primaryWordBank: silo.word_banks.primary,
})) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`SILO_REFERENCE_MISSING (${label}): ${relative}`);
  }
}

const mtgBank = readJson('CONTROL-PLANE/SILO-PACK-TEMPLATE/word-banks/mtg-commander.json');
if (mtgBank.silo_id !== 'SILO_MTG_COMMANDER') {
  throw new Error('MTG_WORD_BANK_SILO_MISMATCH');
}
if (silo.language_profile.claim_rules.allow_invented_products !== false) {
  throw new Error('INVENTED_PRODUCTS_MUST_REMAIN_DISABLED');
}
console.log('PASS: silo manifest, schemas, references, and silo-specific word banks are valid.');
