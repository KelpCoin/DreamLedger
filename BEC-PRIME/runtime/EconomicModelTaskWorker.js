'use strict';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
const LLM_URL = String(process.env.LLM_API_URL || process.env.BEC_CLOUD_LM_URL || '').replace(/\/$/, '');
const LLM_KEY = String(process.env.LLM_API_KEY || process.env.BEC_CLOUD_LM_API_KEY || '');
const LLM_MODEL = String(process.env.LLM_MODEL || process.env.BEC_CLOUD_LM_MODEL || '');
const TASK_MODEL_NAME = String(process.env.BECK_TASK_MODEL_NAME || '').trim();
const TASK_MODEL_ROLE = String(process.env.BECK_TASK_MODEL_ROLE || '').trim();
const LEASE_SECONDS = 300;

function required(value, name) {
  if (!String(value || '').trim()) throw new Error(`${name} is required`);
  return String(value).trim();
}

async function supabase(path, options = {}) {
  const url = required(SUPABASE_URL, 'SUPABASE_URL');
  const key = required(SUPABASE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text || 'null'); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 2000)}`);
  return data;
}

async function rpc(name, body) {
  return supabase(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
}

async function claimTask() {
  const model = required(TASK_MODEL_NAME, 'BECK_TASK_MODEL_NAME');
  const role = required(TASK_MODEL_ROLE, 'BECK_TASK_MODEL_ROLE');
  const rows = await rpc('claim_economic_model_task', { p_model_name: model, p_model_role: role, p_lease_seconds: LEASE_SECONDS });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function promptFor(task) {
  const input = task.input_snapshot || {};
  return `You are the ${task.model_role} worker in BrownEye Cortex. You are untrusted analysis, not a source of truth. Analyze only the supplied economic candidate. Never claim that money, a sale, fulfillment, approval, or external action occurred unless the supplied evidence explicitly proves it. Return ONLY valid JSON with these keys: overall_score (0..1), evidence_tier, freshness_days (integer >=0), buyer_intent (boolean), seller_side (boolean), primary_source_verified (boolean), scope_fit (boolean), payment_path (boolean), confidence (0..1), reasoning (string), source_url (string or null). Contract: ${task.contract_version}. INPUT SNAPSHOT: ${JSON.stringify(input)}`;
}

async function runModel(task) {
  const url = required(LLM_URL, 'LLM_API_URL');
  const key = required(LLM_KEY, 'LLM_API_KEY');
  const model = required(LLM_MODEL, 'LLM_MODEL');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [
      { role: 'system', content: 'You are a bounded BECK economic assessment worker. Never invent evidence.' },
      { role: 'user', content: promptFor(task) }
    ], temperature: 0.1, response_format: { type: 'json_object' } })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LLM ${response.status}: ${text.slice(0, 2000)}`);
  const data = JSON.parse(text);
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content !== 'string') throw new Error('LLM response missing choices[0].message.content');
  return JSON.parse(content);
}

function number01(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`${name} must be between 0 and 1`);
  return n;
}

async function completeTask(task, assessmentId) {
  return supabase(`economic_model_tasks?task_id=eq.${encodeURIComponent(task.task_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), assessment_id: assessmentId, leased_until: null, last_error: null })
  });
}

async function failTask(task, error) {
  return supabase(`economic_model_tasks?task_id=eq.${encodeURIComponent(task.task_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString(), leased_until: null, last_error: String(error.message || error).slice(0, 4000) })
  });
}

async function main() {
  const task = await claimTask();
  if (!task) { console.log(JSON.stringify({ status: 'IDLE' })); return; }
  try {
    const a = await runModel(task);
    const assessmentId = await rpc('record_economic_assessment', {
      p_candidate_id: task.candidate_id, p_model_name: task.model_name, p_model_role: task.model_role,
      p_overall_score: number01(a.overall_score, 'overall_score'), p_evidence_tier: String(a.evidence_tier || 'UNVERIFIED').slice(0, 64),
      p_freshness_days: Math.max(0, Math.floor(Number(a.freshness_days || 0))), p_buyer_intent: Boolean(a.buyer_intent), p_seller_side: Boolean(a.seller_side),
      p_primary_source_verified: Boolean(a.primary_source_verified), p_scope_fit: Boolean(a.scope_fit), p_payment_path: Boolean(a.payment_path),
      p_confidence: number01(a.confidence, 'confidence'), p_reasoning: String(a.reasoning || '').slice(0, 12000),
      p_raw_assessment: a, p_source_url: a.source_url == null ? null : String(a.source_url).slice(0, 2000)
    });
    const id = Array.isArray(assessmentId) ? assessmentId[0] : assessmentId;
    await completeTask(task, id);
    console.log(JSON.stringify({ status: 'SUCCEEDED', task_id: task.task_id, candidate_id: task.candidate_id, assessment_id: id }));
  } catch (error) {
    await failTask(task, error);
    console.error(JSON.stringify({ status: 'FAILED', task_id: task.task_id, error: error.message }));
    throw error;
  }
}

main().catch(() => { process.exitCode = 1; });
