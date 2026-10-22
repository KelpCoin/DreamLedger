/**
 * Future Cloudflare Pages /api/rfq handler. Not enabled by the G08 static
 * preview: stateful routes still return HTTP 503 until explicitly admitted.
 * Airtable Sales Pipeline is only a private LEAD INBOX, never settlement truth.
 * Use RFQ_INTAKE_ENABLED=true and secrets only after security/privacy review.
 */
const json = (payload, code = 200) => new Response(JSON.stringify(payload), {
  status: code,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
});
const identifier = (raw, prefix) => typeof raw === 'string' &&
  new RegExp('^' + prefix + '[A-Za-z0-9]{14}$').test(raw);

function configured(env) {
  return env?.RFQ_INTAKE_ENABLED === 'true' &&
    typeof env.AIRTABLE_TOKEN === 'string' && env.AIRTABLE_TOKEN.length > 20 &&
    identifier(env.AIRTABLE_LEADS_BASE_ID, 'app') &&
    identifier(env.AIRTABLE_LEADS_TABLE_ID, 'tbl') &&
    typeof env.TURNSTILE_SECRET === 'string' && env.TURNSTILE_SECRET.length > 15 &&
    typeof env.TURNSTILE_SITE_KEY === 'string' && env.TURNSTILE_SITE_KEY.length > 10;
}
function cleanString(raw, limit, required = true) {
  if (raw === null || raw === undefined || raw === '') {
    if (required) throw new Error('MISSING_REQUIRED_FIELD');
    return '';
  }
  if (typeof raw !== 'string') throw new Error('INVALID_FIELD');
  const val = raw.trim();
  if ((required && !val) || val.length > limit || /[<>\u0000-\u0008\u000b\u000e-\u001f]/.test(val))
    throw new Error('FIELD_LIMIT_OR_CONTENT');
  return val;
}
function classify(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_BODY');
  const allowed = new Set(['company','email','category','title','details','budget','region','service','turnstile_token','website']);
  if (Object.keys(input).some(x => !allowed.has(x))) throw new Error('UNRECOGNIZED_FIELD');
  if (input.website) throw new Error('HONEYPOT_REJECTED');
  const service = cleanString(input.service, 64);
  if (!['supplier_interest','verification_review'].includes(service)) throw new Error('UNKNOWN_SERVICE');
  const email = cleanString(input.email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('INVALID_EMAIL');
  const category = cleanString(input.category, 80);
  const allowedCategories = new Set(['Construction & trade','IT & hardware','Freight & logistics','Manufacturing','Professional services','MTG wholesale','Retail overstock','Marketing & events','Other']);
  if (!allowedCategories.has(category)) throw new Error('UNKNOWN_CATEGORY');
  const values = {
    company:cleanString(input.company, 120),
    email, category,
    title:cleanString(input.title, 160),
    details:cleanString(input.details, 1500),
    budget:cleanString(input.budget, 80, false),
    region:cleanString(input.region, 80),
    service,
    token:cleanString(input.turnstile_token, 2048)
  };
  return values;
}
async function limitedJson(request) {
  if (Number(request.headers.get('content-length') || 0) > 6000) throw new Error('PAYLOAD_TOO_LARGE');
  if (!request.body) throw new Error('BODY_REQUIRED');
  let bytes = 0, parts = [];
  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 6000) throw new Error('PAYLOAD_TOO_LARGE');
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(bytes);
  let i = 0;
  for (const part of parts) { out.set(part, i); i += part.length; }
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(out));
}
async function hash(data) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function handleRfqIntake(request, env, apiFetch = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/api/inquiry-config') {
    if (request.method !== 'GET') return json({error:'METHOD_NOT_ALLOWED'},405);
    return json({schema:'dreamledger/private-inquiry-availability/v1',
      enabled:configured(env), turnstile_site_key:configured(env)?env.TURNSTILE_SITE_KEY:null});
  }
  if (url.pathname !== '/api/rfq') return json({error:'NOT_FOUND'},404);
  if (request.method !== 'POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  if (!configured(env)) return json({error:'PRIVATE_INTAKE_NOT_READY'},503);
  // This endpoint is never CORS-enabled; disallow CSRF and cross-origin posts.
  if (request.headers.get('origin') !== url.origin) return json({error:'ORIGIN_REJECTED'},403);
  if (!String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json'))
    return json({error:'JSON_REQUIRED'},415);
  let data;
  try { data = classify(await limitedJson(request)); }
  catch { return json({error:'INVALID_OR_OVERSIZE_INQUIRY'},400); }
  let challenge;
  try {
    const form = new FormData();
    form.set('secret',env.TURNSTILE_SECRET);
    form.set('response',data.token);
    const ip = request.headers.get('cf-connecting-ip');
    if (ip) form.set('remoteip',ip);
    const check = await apiFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',body:form
    });
    if (!check.ok) return json({error:'CHALLENGE_UNAVAILABLE'},503);
    challenge = await check.json();
    // Bind the challenge to the actual requested host; reject replayed
    // challenge tokens acquired for unrelated sites.
    if (challenge?.success !== true || challenge.hostname !== url.hostname)
      return json({error:'CHALLENGE_FAILED'},403);
  } catch { return json({error:'CHALLENGE_UNAVAILABLE'},503); }
  const id = 'DL-RFQ-' + crypto.randomUUID();
  const payload = {
    fields:{
      'Request ID':id,
      'Submitted At':new Date().toISOString(),
      'Source':'dreamledger.org/b2b.html',
      'Service':data.service,
      'Silo':data.category === 'MTG wholesale' ? 'mtg' : 'procurement',
      'Company':data.company,
      'Contact Email':data.email,
      'Category':data.category,
      'Subject':data.title,
      'Non-Sensitive Summary':data.details,
      'Budget Band':data.budget,
      'Region':data.region,
      'Source Fingerprint SHA256':await hash(JSON.stringify({
        email:data.email,title:data.title,service:data.service,details:data.details
      })),
      'Status':'RECEIVED_UNVERIFIED',
      'Gauntlet State':'NOT_RUN',
      'Revenue Claimed NZD':0
    }
  };
  let saved;
  try {
    const dest = 'https://api.airtable.com/v0/' +
      encodeURIComponent(env.AIRTABLE_LEADS_BASE_ID) + '/' +
      encodeURIComponent(env.AIRTABLE_LEADS_TABLE_ID);
    const response = await apiFetch(dest,{
      method:'POST',
      headers:{authorization:'Bearer '+env.AIRTABLE_TOKEN,'content-type':'application/json'},
      body:JSON.stringify(payload)
    });
    if (!response.ok) return json({error:'PERSISTENCE_UNAVAILABLE'},503);
    saved = await response.json();
  } catch { return json({error:'PERSISTENCE_UNAVAILABLE'},503); }
  if (!/^rec[A-Za-z0-9]{14}$/.test(saved?.id || ''))
    return json({error:'PERSISTENCE_NOT_CONFIRMED'},503);
  // Receipt returned only when Airtable has acknowledged a persisted record.
  return json({schema:'dreamledger/private-rfq-receipt/v1',
    status:'RECEIVED_UNVERIFIED',request_id:id,
    paid:false,gauntlet:'NOT_RUN'},202);
}
