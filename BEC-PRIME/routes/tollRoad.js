'use strict';

const crypto=require('crypto');
const {run:runGauntlet}=require('../gauntlet/CandidateGauntlet');
const Toll=require('../runtime/TollRoad');

function send(res,status,body){
  if(res.writableEnded)return true;
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
  return true;
}

function readJson(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{
      raw+=chunk;
      if(raw.length>500000){reject(Object.assign(new Error('Request too large'),{statusCode:413}));req.destroy();}
    });
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(Object.assign(new Error('Invalid JSON'),{statusCode:400}));}});
    req.on('error',reject);
  });
}

function authorize(req,tier){
  const checked=Toll.verifyKey(Toll.headerKey(req),tier);
  if(!checked.ok)throw Object.assign(new Error(checked.error),{statusCode:checked.error==='toll_wall_not_configured'?503:401});
  return checked.payload;
}

async function handle(req,res,path){
  if(path==='/api/toll/v1/manifest'&&req.method==='GET')return send(res,200,Toll.publicManifest());

  if(path==='/api/toll/v1/gauntlet'&&req.method==='POST'){
    const key=authorize(req,'gauntlet');
    const candidate=await readJson(req);
    const proof=runGauntlet(candidate);
    return send(res,proof.status==='PASS'?200:422,{
      schema:'dreamledger/toll-gauntlet-result/v1',
      key_id:key.key_id,
      service:'GAUNTLET-RUN',
      human_minutes:0,
      public_execution:'NO_EXTERNAL_ACTION',
      result:proof
    });
  }

  if(path==='/api/toll/v1/truth'&&req.method==='POST'){
    const key=authorize(req,'truth');
    const body=await readJson(req);
    const evidence=Array.isArray(body.evidence)?body.evidence:[];
    const contradictions=Array.isArray(body.contradictions)?body.contradictions:[];
    const unresolved=Array.isArray(body.unresolved)?body.unresolved:[];
    const result={
      schema:'dreamledger/toll-truth-input/v1',
      key_id:key.key_id,
      service:'TRUTH-ORACLE-ACCESS',
      verdict:contradictions.length?'CONTRADICTED':(evidence.length?'OBSERVED':'UNVERIFIED'),
      evidence_count:evidence.length,
      contradiction_count:contradictions.length,
      unresolved_count:unresolved.length,
      economic_truth_unchanged:true,
      note:'This service reports the supplied evidence state. It does not create payment, buyer, settlement, fulfillment, or verified economic truth.'
    };
    return send(res,200,result);
  }

  if(path==='/api/toll/v1/key/check'&&req.method==='GET'){
    const key=authorize(req,null);
    return send(res,200,{schema:'dreamledger/toll-key-check/v1',key_id:key.key_id,tier:key.tier,expires_at:key.expires_at,calls_remaining:key.calls_remaining});
  }

  return false;
}

module.exports={handle};
