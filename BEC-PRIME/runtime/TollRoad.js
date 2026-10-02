'use strict';

const crypto = require('crypto');

const KEY_SCHEMA = 'DREAMLEDGER-TOLL-KEY-1.0';
const DEFAULT_TTL_DAYS = 365;
const MAX_CALLS = 100000;

function config(){
  return {
    secret:String(process.env.DREAMLEDGER_TOLL_KEY_SECRET||''),
    gauntletPriceId:String(process.env.DREAMLEDGER_GAUNTLET_PRICE_ID||'NZD_19'),
    truthPriceId:String(process.env.DREAMLEDGER_TRUTH_ORACLE_PRICE_ID||'NZD_9'),
    gauntletPriceNzd:Number(process.env.DREAMLEDGER_GAUNTLET_PRICE_NZD||19),
    truthPriceNzd:Number(process.env.DREAMLEDGER_TRUTH_ORACLE_PRICE_NZD||9)
  };
}

function configured(){
  const c=config();
  return Boolean(c.secret);
}

function b64(value){
  return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
}

function decode(value){
  return JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
}

function sign(body){
  return crypto.createHmac('sha256',config().secret).update(body).digest('base64url');
}

function issueKey({keyId,tier='gauntlet',expiresAt,callsRemaining=1,reference}={}){
  if(!configured())throw new Error('Toll key secret is not configured');
  const now=new Date();
  const exp=expiresAt||new Date(now.getTime()+DEFAULT_TTL_DAYS*86400000).toISOString();
  const payload={
    schema:KEY_SCHEMA,
    key_id:String(keyId||crypto.randomUUID()),
    tier:String(tier),
    issued_at:now.toISOString(),
    expires_at:exp,
    calls_remaining:Math.min(Math.max(Number(callsRemaining)||1,1),MAX_CALLS),
    reference:String(reference||'')
  };
  const body=b64(payload);
  return 'dlk_'+body+'.'+sign(body);
}

function verifyKey(token,requiredTier){
  if(!configured())return {ok:false,error:'toll_wall_not_configured'};
  const raw=String(token||'').trim();
  const parts=raw.split('.');
  if(parts.length!==2||!parts[0].startsWith('dlk_'))return {ok:false,error:'invalid_toll_key'};
  const body=parts[0].slice(4);
  const signature=parts[1];
  const expected=sign(body);
  const a=Buffer.from(signature),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return {ok:false,error:'invalid_toll_key'};
  let payload;
  try{payload=decode(body);}catch{return {ok:false,error:'invalid_toll_key'};}
  if(payload.schema!==KEY_SCHEMA)return {ok:false,error:'unsupported_key_schema'};
  if(payload.expires_at&&Date.parse(payload.expires_at)<=Date.now())return {ok:false,error:'toll_key_expired'};
  if(Number(payload.calls_remaining)<=0)return {ok:false,error:'toll_key_exhausted'};
  if(requiredTier&&payload.tier!==requiredTier&&payload.tier!=='all')return {ok:false,error:'toll_key_scope_denied'};
  return {ok:true,payload};
}

function headerKey(req){
  return String(req.headers['x-dreamledger-toll-key']||'').trim();
}

function publicManifest(){
  const c=config();
  return {
    schema:'dreamledger/automated-services/v2',
    status:configured()?'ARMED':'NOT_CONFIGURED',
    model:'customer pays -> settlement -> entitlement -> scoped credential -> automated result',
    human_gate:'none after payment for automated digital services',
    customer_boundary:'payment does not grant private-system access',
    truth_boundary:'payment and fulfilment status are checked from settlement evidence',
    services:[
      {id:'DECISION-CHECK',name:'Decision Check',route:'/api/toll/v1/gauntlet',scope:'gauntlet',checkout_configured:Boolean(c.gauntletPriceNzd>0),human_minutes:0},
      {id:'EVIDENCE-CHECK',name:'Evidence Check',route:'/api/toll/v1/truth',scope:'truth',checkout_configured:Boolean(c.truthPriceNzd>0),human_minutes:0}
    ]
  };
}

module.exports={config,configured,issueKey,verifyKey,headerKey,publicManifest,KEY_SCHEMA};
