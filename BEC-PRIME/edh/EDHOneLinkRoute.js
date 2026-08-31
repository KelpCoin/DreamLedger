'use strict';

const service = require('./EDHOneLinkService');
const media = require('./EDHMediaService');

function send(res, status, body) {
  if (res.writableEnded) return true;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
  return true;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100000) throw Object.assign(new Error('REQUEST_TOO_LARGE'), { statusCode: 413 });
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw Object.assign(new Error('INVALID_JSON'), { statusCode: 400 }); }
}

async function handle(req, res, url) {
  if (req.method === 'POST' && url === '/api/mtg/import') {
    try {
      const input = await body(req);
      if (!input.source_url) return send(res, 422, { error: 'SOURCE_URL_REQUIRED' });
      const comparisonIds = Array.isArray(input.comparison_product_ids) ? input.comparison_product_ids : [];
      if (comparisonIds.length > 5) return send(res, 422, { error: 'MAX_FIVE_COMPARISONS' });
      const proof = await service.createJob(input);
      const withMedia = await media.attachHero(proof);
      return send(res, 202, { job_id: withMedia.job_id, status: withMedia.state, product_id: withMedia.product_id, media_status: withMedia.media_status, proof_manifest: 'BEC-PRIME/data/mtg/edh-jobs/' + withMedia.job_id + '/PROOF.json' });
    } catch (err) {
      return send(res, err.statusCode || 500, { error: err.message || 'EDH_IMPORT_FAILED' });
    }
  }
  const match = url.match(/^\/api\/mtg\/import\/([^/]+)$/);
  if (req.method === 'GET' && match) {
    const proof = service.readJob(decodeURIComponent(match[1]));
    return proof ? send(res, 200, proof) : send(res, 404, { error: 'EDH_JOB_NOT_FOUND' });
  }
  return false;
}

module.exports = { handle };
