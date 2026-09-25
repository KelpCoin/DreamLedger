'use strict';
const crypto = require('crypto');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function verifyTicketSignature(ticket, publicKeyPem) {
  if (!publicKeyPem) throw new Error('EXECUTION_TICKET_PUBLIC_KEY is not configured');
  const signed = canonical({ticket_id:ticket.ticket_id,operation_id:ticket.operation_id,request_hash:ticket.request_hash,payload_hash:ticket.payload_hash,tool_name:ticket.tool_name,arguments:ticket.arguments,target:ticket.target,amount_nzd:ticket.amount_nzd,agent_identity:ticket.agent_identity,policy_version:ticket.policy_version,audit_commit:ticket.audit_commit,nonce:ticket.nonce,issued_at:ticket.issued_at,expires_at:ticket.expires_at});
  const sig = Buffer.from(String(ticket.signature || ''), 'base64');
  if (!sig.length || !crypto.verify(null, Buffer.from(signed), crypto.createPublicKey(publicKeyPem), sig)) throw new Error('Invalid execution ticket signature');
  return true;
}
function materialIntent(ticket) { return {tool_name:ticket.tool_name,arguments:ticket.arguments,target:ticket.target ?? null,amount_nzd:ticket.amount_nzd ?? null,agent_identity:ticket.agent_identity,policy_version:ticket.policy_version}; }
function assertTicketBinding(ticket, suppliedIntent) {
  const suppliedHash = sha256(suppliedIntent);
  if (suppliedHash !== ticket.payload_hash) throw new Error('PAYLOAD_HASH_MISMATCH');
  if (sha256(materialIntent(ticket)) !== ticket.payload_hash) throw new Error('TICKET_PAYLOAD_BINDING_INVALID');
}
async function dbRpc(name, payload) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('Supabase persistence is not configured');
  const r = await fetch(base + '/rest/v1/rpc/' + name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const text = await r.text(); let data; try { data=text?JSON.parse(text):null; } catch { data={raw:text}; }
  if (!r.ok) throw new Error('Supabase RPC '+name+' failed ('+r.status+')');
  return Array.isArray(data)?data[0]:data;
}
async function admit(ticket, suppliedIntent, materialState) {
  verifyTicketSignature(ticket, process.env.EXECUTION_TICKET_PUBLIC_KEY || '');
  assertTicketBinding(ticket, suppliedIntent);
  const now=Date.now(), expires=Date.parse(ticket.expires_at), issued=Date.parse(ticket.issued_at);
  if (!Number.isFinite(expires)||expires<=now) throw new Error('STALE_AUTHORIZATION');
  if (Number.isFinite(issued)&&issued>now+5000) throw new Error('INVALID_ISSUED_AT');
  if (process.env.EXECUTION_POLICY_VERSION&&ticket.policy_version!==process.env.EXECUTION_POLICY_VERSION) throw new Error('POLICY_VERSION_MISMATCH');
  if (typeof materialState==='function') { const state=await materialState(); if(state&&state.allowed===false) throw new Error(state.reason||'MATERIAL_PRECONDITION_FAILED'); }
  const receipt=await dbRpc('factory_consume_payload_lock',{p_ticket_id:ticket.ticket_id,p_nonce:ticket.nonce,p_request_hash:ticket.request_hash,p_payload_hash:ticket.payload_hash,p_receipt:{admitted_at:new Date().toISOString(),ticket_id:ticket.ticket_id,payload_hash:ticket.payload_hash}});
  if(!receipt?.consumed) throw new Error(String(receipt?.reason||'PAYLOAD_LOCK_REJECTED'));
  return {ticket,admission:receipt};
}
async function issueTerminationCertificate(input) { return dbRpc('factory_issue_termination_certificate',{p_cycle_id:input.cycle_id,p_action_id:input.action_id||null,p_authorization_ticket_id:input.authorization_ticket_id||null,p_payload_hash:input.payload_hash||null,p_verification_result:input.verification_result||{},p_stop_reason:input.stop_reason,p_trace_ids:input.trace_ids||[crypto.randomUUID()]}); }
async function execute(ticket, suppliedIntent, effect, materialState) {
  const trace={started_at:new Date().toISOString(),ticket_id:ticket.ticket_id,payload_hash:ticket.payload_hash};
  try { const admitted=await admit(ticket,suppliedIntent,materialState); trace.admission=admitted.admission; trace.result=await effect(); trace.completed_at=new Date().toISOString(); return {status:'EXECUTED',trace}; }
  catch(error) { trace.completed_at=new Date().toISOString(); trace.error=String(error.message||error); const stop_reason=/STALE|EXPIRED/.test(trace.error)?'STALE_AUTHORIZATION':/CONTRADICT|REVOC/.test(trace.error)?'CONTRADICTED':/APPROV/.test(trace.error)?'AWAITING_APPROVAL':'BLOCKED'; return {status:stop_reason,stop_reason,trace}; }
}
module.exports={canonical,sha256,verifyTicketSignature,materialIntent,assertTicketBinding,admit,issueTerminationCertificate,execute};
