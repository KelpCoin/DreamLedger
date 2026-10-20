'use strict';
const fs = require('node:fs');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
function validHttpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname); }
  catch { return false; }
}
function render(config) {
  const support = config && config.creator_support;
  if (!support || support.destination_status !== 'VERIFIED' || !validHttpsUrl(support.destination_url)) return '';
  const label = escapeHtml(support.label || 'Support original content');
  const description = escapeHtml(support.description || 'Optional support helps fund original writing and research.');
  const destination = escapeHtml(support.destination_url);
  const siloId = escapeHtml(config.silo_id || 'unknown');
  return [
    '<aside class="silo-support-card" data-silo-support="optional" data-silo-id="' + siloId + '" aria-label="' + label + '">',
    '  <p class="silo-support-card__title">' + label + '</p>',
    '  <p class="silo-support-card__description">' + description + '</p>',
    '  <a href="' + destination + '" rel="noopener noreferrer" target="_blank">Support the writing</a>',
    '</aside>'
  ].join('\n');
}
if (require.main === module) {
  const inputPath = process.argv[2];
  if (!inputPath) { process.stderr.write('Usage: node render-silo-growth-promo.js path/to/silo-growth.json\n'); process.exitCode = 2; }
  else {
    try { process.stdout.write(render(JSON.parse(fs.readFileSync(inputPath, 'utf8')))); }
    catch (error) { process.stderr.write('Unable to render silo support card: ' + error.message + '\n'); process.exitCode = 1; }
  }
}
module.exports = { render, validHttpsUrl };
