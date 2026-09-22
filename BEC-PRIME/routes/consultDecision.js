'use strict';

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://dreamledger.org').replace(/\/$/, '');
const C2_PRICE_CENTS = 500;
const C2_CURRENCY = 'nzd';
const C2_SKU = 'C2-DECISION-001';
const C2_OFFER_ID = 'b2c2c2c2-0000-4000-8000-000000000001';
const MAX_BODY = 30000;

function send(res,status,body){if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>MAX_BODY)throw new Error('Request too large');}try{return JSON.parse(raw||'{}')}catch{throw new Error('Invalid JSON');}}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');}
function requestId(){return 'c2_' + crypto.randomUUID();}
function stripeForm(params){const out=new URLSearchParams();for(const [k,v] of Object.entries(params))out.set(k,String(v));return out;}
async function stripeRequest(method,endpoint,params,idempotencyKey){
  if(!STRIPE_SECRET_KEY)throw new Error('STRIPE_SECRET_KEY is not configured');
  const headers={Authorization:'Bearer '+STRIPE_SECRET_KEY};
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const options={method,headers};
  if(method!=='GET'){headers['Content-Type']='application/x-www-form-urlencoded';options.body=stripeForm(params||{});}
  const response=await fetch('https://api.stripe.com/v1/'+endpoint,options);
  const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch{parsed={raw:text}};
  if(!response.ok)throw new Error(parsed?.error?.message||'Stripe API '+response.status);
  return parsed;
}
async function supabase(path,options={}){
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase service role is not configured');
  const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:options.prefer||'return=representation',...(options.headers||{})};
  const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined});
  const text=await r.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error('Supabase '+r.status+': '+String(text).slice(0,500));
  return data;
}
async function createCheckout(input){
  const id=requestId();
  const request={request_id:id,sku:C2_SKU,offer_id:C2_OFFER_ID,question:String(input.question||'').trim(),context:String(input.context||'').trim(),constraints:Array.isArray(input.constraints)?input.constraints.map(String).slice(0,20):[],output_format:String(input.output_format||'decision_memo').trim().slice(0,80),created_at:new Date().toISOString()};
  if(request.question.length<8||request.question.length>12000)throw new Error('question must be 8-12000 characters');
  const recordPayload={schema:'BEC-C2-REQUEST/v1',...request};
  await supabase('evidence_records',{method:'POST',body:{transition_id:id,record_type:'C2_REQUEST',min_access_tier:'PAID',disclosure_policy_version:'v1',issuer:'DreamLedger',credential_format:'INTERNAL',credential_ref:id,payload:recordPayload,parent_hash:null,record_hash:hash(recordPayload),verification_status:'UNVERIFIED'}});
  const session=await stripeRequest('POST','checkout/sessions',{
    mode:'payment',
    client_reference_id:id,
    'metadata[c2_request_id]':id,
    'metadata[sku]':C2_SKU,
    'metadata[offer_id]':C2_OFFER_ID,
    'metadata[silo]':'reasoning',
    'line_items[0][price_data][currency]':C2_CURRENCY,
    'line_items[0][price_data][unit_amount]':C2_PRICE_CENTS,
    'line_items[0][price_data][product_data][name]':'C2 Decision Analysis',
    'line_items[0][price_data][product_data][description]':'One hosted BrownEye decision analysis.',
    'line_items[0][quantity]':1,
    'success_url':PUBLIC_BASE+'/m2m/v1/consult/decision/result?session_id={CHECKOUT_SESSION_ID}',
    'cancel_url':PUBLIC_BASE+'/m2m/v1/consult/decision/cancelled?request_id='+encodeURIComponent(id)
  },'dreamledger-c2-'+id);
  return {schema:'BEC-C2-CHECKOUT/v1',request_id:id,session_id:session.id,checkout_url:session.url,amount_nzd:5,currency:'NZD',pc_off:true,status:'PAYMENT_REQUIRED'};
}
async function loadRequest(requestIdValue){
  const rows=await supabase('evidence_records?select=payload&transition_id=eq.'+encodeURIComponent(requestIdValue)+'&record_type=eq.C2_REQUEST&limit=1');
  if(!Array.isArray(rows)||!rows[0])throw new Error('C2 request not found');
  return rows[0].payload;
}
async function callModel(url,key,model,messages){
  const headers={'Content-Type':'application/json'};if(key)headers.Authorization='Bearer '+key;
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({model,messages,temperature:0.2})});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={}};
  if(!r.ok)throw new Error('Hosted model '+r.status+': '+text.slice(0,500));
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content.trim())throw new Error('Hosted model returned no content');
  return content;
}
function parseJson(text){
  const cleaned=String(text).replace(/^\s*\`\`\`json\s*/i,'').replace(/\s*\`\`\`\s*$/,'').trim();
  try{return JSON.parse(cleaned)}catch{return null}
}
async function runRefinery(request){
  const url=process.env.BEC_C2_LM_URL||process.env.BEC_CLOUD_LM_URL||'';
  const key=process.env.BEC_C2_LM_API_KEY||process.env.BEC_CLOUD_LM_API_KEY||process.env.BEC_REMOTE_LM_API_KEY||'';
  const models=String(process.env.BEC_C2_MODELS||process.env.BEC_CLOUD_LM_MODEL||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,5);
  if(!url||!models.length)throw new Error('Hosted C2 refinery is not configured. Set BEC_C2_LM_URL and BEC_C2_MODELS.');
  const prompt=JSON.stringify({question:request.question,context:request.context,constraints:request.constraints,output_format:request.output_format});
  const baseSystem='You are a worker in BrownEye Cortex. Analyze the supplied decision problem. Do not invent evidence, payments, customers, credentials, or external actions. Return rigorous analysis and preserve uncertainty.';
  const positions=[];
  for(const model of models){
    const content=await callModel(url,key,model,[{role:'system',content:baseSystem},{role:'user',content:prompt}]);
    positions.push({model,content});
  }
  let synthesis;
  if(positions.length===1){
    synthesis=positions[0].content;
  }else{
    const synthesisPrompt=JSON.stringify({request,positions});
    synthesis=await callModel(url,key,process.env.BEC_C2_SYNTHESIS_MODEL||models[0],[
      {role:'system',content:'You are the synthesis/verifier worker in BrownEye Cortex. Produce JSON only with exactly these fields: decision_analysis, competing_interpretations, strongest_counterargument, unresolved_uncertainty, evidence_used, confidence, disagreement_remained. Preserve genuine disagreement. Never claim model agreement is factual evidence.'},
      {role:'user',content:synthesisPrompt}
    ]);
  }
  const parsed=parseJson(synthesis);
  if(parsed&&parsed.decision_analysis)return {...parsed,models_participated:models,rounds_completed:positions.length>1?2:1};
  return {decision_analysis:synthesis,competing_interpretations:positions.map(x=>x.content),strongest_counterargument:'Not independently resolved.',unresolved_uncertainty:['Structured synthesis was not machine-parseable.'],evidence_used:['Buyer-supplied request and hosted model analysis.'],confidence:'moderate',disagreement_remained:positions.length>1,models_participated:models,rounds_completed:positions.length>1?2:1};
}
async function fulfill(session){
  if(session.payment_status!=='paid')return {status:'PAYMENT_REQUIRED',request_id:session.metadata?.c2_request_id||session.client_reference_id};
  if(session.metadata?.sku!==C2_SKU||session.metadata?.offer_id!==C2_OFFER_ID)throw new Error('C2 attribution mismatch');
  if(Number(session.amount_total)!==C2_PRICE_CENTS||String(session.currency).toLowerCase()!==C2_CURRENCY)throw new Error('C2 payment amount/currency mismatch');
  const requestIdValue=String(session.metadata.c2_request_id||session.client_reference_id||'');
  if(!requestIdValue)throw new Error('C2 request attribution missing');
  const existing=await supabase('economic_outcomes?select=outcome_id,external_reference,truth_status,metadata&external_reference=eq.'+encodeURIComponent(session.id)+'&limit=1');
  if(Array.isArray(existing)&&existing[0]){
    const prior=await supabase('evidence_records?select=payload&transition_id=eq.'+encodeURIComponent(requestIdValue)+'&record_type=eq.C2_RESULT&limit=1');
    return {status:'VERIFIED',request_id:requestIdValue,session_id:session.id,result:prior?.[0]?.payload?.result||null,settlement:existing[0]};
  }
  const request=await loadRequest(requestIdValue);
  const result=await runRefinery(request);
  const completedAt=new Date().toISOString();
  const resultPayload={schema:'BEC-C2-RESULT/v1',request_id:requestIdValue,session_id:session.id,paid:true,fulfilled:true,pc_off:true,result,provenance:{started_at:request.created_at,completed_at:completedAt,provider:'hosted_compatible_model',stripe_session_id:session.id}};
  const resultHash=hash(resultPayload);
  const evidence=await supabase('evidence_records',{method:'POST',body:{transition_id:requestIdValue,record_type:'C2_RESULT',min_access_tier:'PAID',disclosure_policy_version:'v1',issuer:'DreamLedger',credential_format:'INTERNAL',credential_ref:session.id,payload:resultPayload,parent_hash:null,record_hash:resultHash,verification_status:'VERIFIED'}});
  const settlementPayload={stripe_session_id:session.id,request_id:requestIdValue,sku:C2_SKU,offer_id:C2_OFFER_ID,amount_nzd:5,currency:'NZD',livemode:Boolean(session.livemode),payment_status:session.payment_status,result_hash:resultHash};
  const outcome=await supabase('economic_outcomes',{method:'POST',body:{offer_id:C2_OFFER_ID,outcome_type:'FULFILLED',amount_nzd:5,founder_minutes:0,fulfilment_minutes:0,acquisition_cost_nzd:0,payment_fees_nzd:null,external_reference:session.id,observed_at:completedAt,evidence_ids:Array.isArray(evidence)?evidence.map(x=>x.evidence_id).filter(Boolean):[],metadata:settlementPayload,truth_status:session.livemode?'VERIFIED':'TEST',attribution:{request_id:requestIdValue,stripe_session_id:session.id,client_reference_id:session.client_reference_id}}});
  return {status:session.livemode?'VERIFIED':'TEST',request_id:requestIdValue,session_id:session.id,result,result_hash:resultHash,settlement:outcome};
}
async function handle(req,res,url){
  if(req.method==='POST'&&url==='/m2m/v1/consult/decision/checkout'){
    try{return send(res,200,await createCheckout(await body(req)))}catch(err){return send(res,err.message.includes('configured')?503:400,{error:err.message})}
  }
  if(req.method==='GET'&&url==='/m2m/v1/consult/decision/result'){
    try{const u=new URL(req.url,'https://dreamledger.org');const sid=u.searchParams.get('session_id');if(!sid)return send(res,400,{error:'session_id is required'});const session=await stripeRequest('GET','checkout/sessions/'+encodeURIComponent(sid));return send(res,session.payment_status==='paid'?200:402,await fulfill(session))}catch(err){return send(res,err.message.includes('configured')?503:400,{error:err.message})}
  }
  if(req.method==='POST'&&url==='/m2m/v1/consult/decision'){
    try{const b=await body(req);if(!b.session_id)return send(res,402,{error:'Payment required',next:'POST /m2m/v1/consult/decision/checkout'});const session=await stripeRequest('GET','checkout/sessions/'+encodeURIComponent(String(b.session_id)));return send(res,session.payment_status==='paid'?200:402,await fulfill(session))}catch(err){return send(res,err.message.includes('configured')?503:400,{error:err.message})}
  }
  if(req.method==='GET'&&url==='/m2m/v1/consult/decision/cancelled')return send(res,200,{schema:'BEC-C2-CANCELLED/v1',status:'CANCELLED'});
  return false;
}
module.exports={handle};
