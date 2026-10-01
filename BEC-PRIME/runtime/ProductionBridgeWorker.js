'use strict';

const { runNext } = require('./EconomicJobWorkerAdapter');
const { verifyAndStage } = require('./BridgeRailVerifier');
let running = false;
let failureStreak = 0;
let timer = null;
const BASE_INTERVAL_MS = 60000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
function isInfrastructureFailure(error){
  const status=Number(error&&error.statusCode||error&&error.proxy_status||0);
  const message=String(error&&error.message||error||'').toLowerCase();
  return [502,503,504,546].includes(status)
    || message.includes('supabase rail proxy failed')
    || message.includes('idle timeout')
    || message.includes('worker_resource_limit')
    || message.includes('not enough compute resources');
}
function nextDelayMs(infrastructureFailure){
  if(!infrastructureFailure){ failureStreak=0; return BASE_INTERVAL_MS; }
  failureStreak=Math.min(failureStreak+1,5);
  return Math.min(BASE_INTERVAL_MS * (2 ** (failureStreak-1)),MAX_BACKOFF_MS);
}
const REQUIRED_ENV = ['SUPABASE_URL','DREAMLEDGER_AGENT_BRIDGE_TOKEN','AGENT_BRIDGE_PROXY_URL'];
function missingConfig(){return REQUIRED_ENV.filter(name=>!String(process.env[name]||'').trim());}
function configStatus(){const missing=missingConfig();return {configured:missing.length===0,missing_env:missing,required_env:REQUIRED_ENV.slice()};}
function configured(){return configStatus().configured;}
async function persistFailure({baseUrl,jobId,workerId,leaseToken,error,token}){const b=String(baseUrl||'').replace(/\/$/,'');const r=await fetch(`${b}/api/agent-bridge/jobs/${encodeURIComponent(jobId)}/fail`,{method:'POST',headers:{'x-dreamledger-agent-token':String(token||''),'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({worker_id:workerId,lease_token:leaseToken,error:String(error||'worker failure').slice(0,4000),retryable:false})});const text=await r.text();let body=null;try{body=JSON.parse(text||'null')}catch{}if(!r.ok)throw new Error(body&&body.error?body.error:`Bridge failure persistence failed (${r.status})`);return body;}
async function tick({port,workerId='render-worker'}={}){const config=configStatus();if(running)return {status:'BUSY',config};if(!config.configured)return {status:'NOT_CONFIGURED',config};running=true;const baseUrl=`http://127.0.0.1:${Number(port)}`;try{const result=await runNext({baseUrl,workerId,token:process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN});if(result.status==='IDLE')return result;const verification=await verifyAndStage(result,{baseUrl,verifierId:'truth-oracle',token:process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN});return {status:'COMPLETED',job_id:result.lease.envelope.job_id,lease_id:result.lease.envelope.lease_id,worker_id:result.lease.envelope.worker_id,verifier_id:verification.actor_id||'truth-oracle',stage_a:result.stage_a,stage_b:verification};}finally{running=false;}}
function start({port,intervalMs=60000,workerId='render-worker'}={}){if(!Number.isInteger(Number(port))||Number(port)<=0)return null;if(timer)return timer;const baseInterval=Math.max(15000,Number(intervalMs)||BASE_INTERVAL_MS);const execute=async()=>{let infrastructureFailure=false;try{const result=await tick({port,workerId});console.log('[ProductionBridgeWorker]',JSON.stringify({status:result.status,config:result.config||null,job_id:result.job_id||null,lease_id:result.lease_id||null,worker_id:result.worker_id||workerId,backoff_ms:nextDelayMs(false)}));}catch(error){infrastructureFailure=isInfrastructureFailure(error);const jobId=error&&error.bridge_job_id;const failureWorkerId=(error&&error.bridge_worker_id)||workerId;const leaseToken=error&&error.bridge_lease_token;if(jobId)console.error('[ProductionBridgeWorker] execution error',JSON.stringify({job_id:jobId,worker_id:failureWorkerId,error:String(error&&error.message||error)}));if(jobId&&leaseToken){try{const failure=await persistFailure({baseUrl:`http://127.0.0.1:${Number(port)}`,jobId,workerId:failureWorkerId,leaseToken,error:error&&error.stack?error.stack:error,token:process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN});console.error('[ProductionBridgeWorker] execution failed; Bridge failure persisted',JSON.stringify({job_id:jobId,worker_id:failureWorkerId,failure}));}catch(failureError){console.error('[ProductionBridgeWorker] execution failed and failure persistence failed',failureError&&failureError.stack?failureError.stack:failureError);}}else{console.error('[ProductionBridgeWorker]',error&&error.stack?error.stack:error);}}
const delay=infrastructureFailure?nextDelayMs(true):baseInterval;console.log('[ProductionBridgeWorker] next_tick',JSON.stringify({delay_ms:delay,infrastructure_failure:infrastructureFailure,failure_streak:failureStreak}));timer=setTimeout(()=>{timer=null;execute();},delay);};const initialConfig=configStatus();console.log('[ProductionBridgeWorker] started',JSON.stringify({...initialConfig,port:Number(port),worker_id:workerId,interval_ms:baseInterval,max_backoff_ms:MAX_BACKOFF_MS}));if(!initialConfig.configured)console.error('[ProductionBridgeWorker] NOT_CONFIGURED missing environment variables:',initialConfig.missing_env.join(','));execute();return timer;}
module.exports={configured,configStatus,missingConfig,persistFailure,tick,start,isInfrastructureFailure,nextDelayMs};