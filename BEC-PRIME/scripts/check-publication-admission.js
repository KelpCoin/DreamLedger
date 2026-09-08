#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing required environment variable: ${name}`);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function setOutput(name, value) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  fs.appendFileSync(target, `${name}=${String(value).replace(/\r?\n/g, ' ')}\n`, 'utf8');
}

async function main() {
  const baseUrl = required('SUPABASE_URL').replace(/\/$/, '');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const candidateKey = required('PUBLICATION_CANDIDATE_KEY');
  const candidateType = process.env.PUBLICATION_CANDIDATE_TYPE || 'RELEASE';
  const expectedHash = process.env.PUBLICATION_CANDIDATE_SHA256 || sha256(candidateKey);
  const allowHumanRequired = process.env.PUBLICATION_ALLOW_HUMAN_REQUIRED === 'true';

  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
    throw new Error('PUBLICATION_CANDIDATE_SHA256 must be a 64-character SHA-256 hex digest');
  }

  const params = new URLSearchParams({
    candidate_sha256: `eq.${expectedHash}`,
    candidate_key: `eq.${candidateKey}`,
    candidate_type: `eq.${candidateType}`,
    select: 'id,admission_key,candidate_key,candidate_sha256,candidate_type,oracle_verdict,gauntlet_verdict,policy_decision,risk_tier,evidence_complete,ci_verified,human_approval_required,human_approved,admitted,denial_reason,updated_at',
    limit: '1'
  });

  const response = await fetch(`${baseUrl}/rest/v1/control_plane_publication_admissions?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json'
    }
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`publication admission lookup failed: HTTP ${response.status}: ${body.slice(0, 500)}`);

  let rows;
  try { rows = JSON.parse(body); } catch { throw new Error('publication admission lookup returned invalid JSON'); }
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`PUBLICATION_BLOCKED: no unique admission receipt for ${candidateKey} (${expectedHash})`);
  }

  const admission = rows[0];
  if (admission.candidate_sha256 !== expectedHash) throw new Error('PUBLICATION_BLOCKED: candidate SHA-256 mismatch');
  if (admission.candidate_key !== candidateKey) throw new Error('PUBLICATION_BLOCKED: candidate key mismatch');
  if (admission.candidate_type !== candidateType) throw new Error('PUBLICATION_BLOCKED: candidate type mismatch');

  const base = {
    admission_id: admission.id,
    candidate_key: candidateKey,
    candidate_sha256: expectedHash,
    candidate_type: candidateType,
    oracle_verdict: admission.oracle_verdict,
    gauntlet_verdict: admission.gauntlet_verdict,
    policy_decision: admission.policy_decision,
    risk_tier: admission.risk_tier,
    evidence_complete: admission.evidence_complete,
    ci_verified: admission.ci_verified,
    human_approval_required: admission.human_approval_required,
    human_approved: admission.human_approved
  };

  if (admission.policy_decision === 'HUMAN_REQUIRED') {
    if (!allowHumanRequired) throw new Error('PUBLICATION_BLOCKED: HUMAN_REQUIRED');
    setOutput('status', 'pending_human');
    setOutput('environment', 'production');
    setOutput('admission_id', admission.id);
    setOutput('candidate_sha256', expectedHash);
    console.log(JSON.stringify({ status: 'PUBLICATION_PENDING_HUMAN', ...base }));
    return;
  }

  if (!admission.admitted || admission.policy_decision !== 'ALLOW') {
    throw new Error(`PUBLICATION_BLOCKED: admission=${admission.policy_decision || 'UNKNOWN'} oracle=${admission.oracle_verdict || 'UNKNOWN'} gauntlet=${admission.gauntlet_verdict || 'UNKNOWN'} reason=${admission.denial_reason || 'not admitted'}`);
  }

  setOutput('status', 'approved');
  setOutput('environment', 'production-auto');
  setOutput('admission_id', admission.id);
  setOutput('candidate_sha256', expectedHash);
  console.log(JSON.stringify({ status: 'PUBLICATION_ADMITTED', ...base }));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
