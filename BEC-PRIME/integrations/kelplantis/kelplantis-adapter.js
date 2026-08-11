const crypto = require('crypto');

function stableId(prefix, payload) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  return `${prefix}-${hash}`;
}

function buildEnvelope({ task, artifact, silo = 'commerce' }) {
  const payload = {
    schema_version: '1.0',
    integration: 'kelplantis',
    silo,
    task,
    artifact,
    approval_required: true,
    publish_allowed: false,
    charge_allowed: false
  };
  return {
    envelope_id: stableId('KELP', payload),
    created_at: new Date().toISOString(),
    ...payload
  };
}

async function dispatch(envelope) {
  const baseUrl = process.env.KELPLANTIS_BASE_URL;
  if (!baseUrl) {
    return {
      status: 'external_blocked',
      reason: 'KELPLANTIS_BASE_URL is not configured',
      envelope_id: envelope.envelope_id
    };
  }

  const headers = { 'content-type': 'application/json' };
  if (process.env.KELPLANTIS_API_KEY) {
    headers.authorization = `Bearer ${process.env.KELPLANTIS_API_KEY}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/intake`, {
    method: 'POST',
    headers,
    body: JSON.stringify(envelope)
  });

  const text = await response.text();
  return {
    status: response.ok ? 'accepted' : 'rejected',
    http_status: response.status,
    envelope_id: envelope.envelope_id,
    response: text.slice(0, 4000)
  };
}

module.exports = { buildEnvelope, dispatch };
