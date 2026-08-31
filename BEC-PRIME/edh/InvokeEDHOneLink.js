'use strict';
const service = require('./EDHOneLinkService');

async function main() {
  const args = process.argv.slice(2);
  const sourceUrl = args.find(value => value.startsWith('--url='))?.slice(6);
  const comparison = (args.find(value => value.startsWith('--compare='))?.slice(10) || '').split(',').map(value => value.trim()).filter(Boolean).slice(0, 5);
  if (!sourceUrl) throw new Error('USAGE: node BEC-PRIME/edh/InvokeEDHOneLink.js --url=https://manabox.app/... [--compare=EDH_0001,EDH_0002]');
  const proof = await service.createJob({ source_url: sourceUrl, comparison_product_ids: comparison });
  process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
}

main().catch(error => { process.stderr.write(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2) + '\n'); process.exit(1); });
