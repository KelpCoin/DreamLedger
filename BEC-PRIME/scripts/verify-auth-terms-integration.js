'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname,'..','routes','auth.js'),'utf8');
for (const required of [
  "termsAcceptance.currentTerms()",
  "termsAcceptance.verifyAcceptance(input)",
  "if (!acceptedTerms.ok)",
  "terms_acceptance: acceptedTerms.record",
  "'/api/account/terms-version'"
]) assert.ok(route.includes(required), 'Missing registration terms check: '+required);
for (const name of ['register.html']) {
  const html = fs.readFileSync(path.join(__dirname,'..','compiled','website',name),'utf8');
  assert.ok(html.includes('id="termsAccepted"'));
  assert.ok(html.includes('terms_acceptance:'));
  assert.ok(html.includes('href="/terms"'));
}
console.log('PASS: server-side terms gate and current signup checkbox are wired');
