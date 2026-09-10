'use strict';

const { runNext } = require('./EconomicJobWorkerAdapter');
const { verifyAndStage } = require('./BridgeRailVerifier');
let running = false;
const REQUIRED_ENV = ['SUPABASE_URL','DREAMLEDGER_AGENT_BRIDGE_TOKEN','AGENT_BRIDGE_PROXY_URL'];
function missingConfig(){return REQUIRED_ENV.filter(name=>!String(process.env[name]||'').trim());}
function configStatus(){const missing=missingConfig();return {configured:missing.length===0,missing_env:missing,required_env:REQUIRED_ENV.slice()};}
function configured(){return configStatus().configured;}
async function tick({port,workerId='render-worker'}={}){const config=configStatus();if(running)return {status:'BUSY',config};if(!config.configured)return {status:'NOT_CONFIGURED',config};running=true;const baseUrl=`http://127.0.0.1:${Number(port)}`;try{const result=await runNext({baseUrl,workerId,token:process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN});if(result.status==='IDLE')return result;const verification=await verifyAndStage(result,{baseUrl,verifierId:'truth-oracle',token:process.env.DREAMLEDGER_AGENT_BRIDGE_TOKEN});return {status:'COMPLETED',job_id:result.lease.envelope.job_id,lease_id:result.lease.envelope.lease_id,worker_id:result.lease.envelope.worker_id,verifier_id:verification.actor_id||'truth-oracle',stage_a:result.stage_a,stage_b:verification};}finally{running=false;}}
function start({port,intervalMs=60000,workerId='render-worker'}={}){if(!Number.isInteger(Number(port))||Number(port)<=0)return null;const execute=()=>tick({port,workerId}).then(result=>{console.log('[ProductionBridgeWorker]',JSON.stringify({status:result.status,config:result.config||null,job_id:result.job_id||null,lease_id:result.lease_id||null,worker_id:result.worker_id||workerId}));return result;}).catch(error=>{console.error('[ProductionBridgeWorker]',error&&error.stack?error.stack:error);return null;});const initialConfig=configStatus();console.log('[ProductionBridgeWorker] started',JSON.stringify({...initialConfig,port:Number(port),worker_id:workerId,interval_ms:Math.max(15000,Number(intervalMs)||60000)}));if(!initialConfig.configured)console.error('[ProductionBridgeWorker] NOT_CONFIGURED missing environment variables:',initialConfig.missing_env.join(', '));execute();return setInterval(execute,Math.max(15000,Number(intervalMs)||60000));}
module.exports={configured,configStatus,missingConfig,tick,start};
