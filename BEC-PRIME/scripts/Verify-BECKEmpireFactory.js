'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const checks = [];
function check(name, ok, detail) { checks.push({ name, ok: !!ok, detail: detail || '' }); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

check('EDH service exists', exists('edh/EDHOneLinkService.js'));
check('EDH route exists', exists('edh/EDHOneLinkRoute.js'));
check('EDH media service exists', exists('edh/EDHMediaService.js'));
check('EDH cinema service exists', exists('edh/EDHCinemaService.js'));
check('EDH verifier exists', exists('edh/Verify-EDHOneLinkPipeline.js'));
check('Creator factory exists', exists('creator/CreatorCommerceFactory.js'));
check('Creator route exists', exists('routes/creatorCommerce.js'));
check('Word bank exists', exists('data/creator/word-bank.json'));
check('Stencil library exists', exists('data/creator/stencils.json'));
check('Generation recipes exist', exists('data/creator/generation-recipes.json'));
check('No live Stripe material in creator factory', !/sk_live_|whsec_|STRIPE_SECRET_KEY/i.test(read('creator/CreatorCommerceFactory.js')));
check('No public posting actuator in creator factory', !/discord\.com\/api|reddit\.com\/api|twitter\.com\/api|x\.com\/api/i.test(read('creator/CreatorCommerceFactory.js')));
const bank = JSON.parse(read('data/creator/word-bank.json'));
const stencils = JSON.parse(read('data/creator/stencils.json'));
const recipes = JSON.parse(read('data/creator/generation-recipes.json'));
check('Word bank schema', bank.schema_version === 'word-bank-v1' && bank.words && Object.keys(bank.words).length > 0);
check('Stencil schema', stencils.schema_version === 'stencil-v1' && Array.isArray(stencils.stencils) && stencils.stencils.length > 0);
check('Recipe schema', recipes.schema_version === 'generation-recipe-v1' && Array.isArray(recipes.recipes) && recipes.recipes.length > 0);
const proof = { schema_version: 'beck-empire-factory-proof-v1', generated_at: new Date().toISOString(), checks, pass: checks.every(c => c.ok), architecture_sha256: sha(JSON.stringify({ bank, stencils, recipes })) };
const out = path.join(ROOT, 'data', 'creator', 'BECK-EMPIRE-FACTORY-PROOF.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof, null, 2));
if (!proof.pass) process.exit(1);
