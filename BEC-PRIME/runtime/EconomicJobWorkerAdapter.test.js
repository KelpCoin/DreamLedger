'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {leaseNextJob}=require('./EconomicJobWorkerAdapter');

function response(status,body){
  return {status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body)};
}

test('rejects a lease envelope without job_id before downstream lookup',async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return response(200,{
    rail_schema:'BECK-BRIDGE-RAIL-1.1',
    envelope:{schema_version:'BECK-BRIDGE-RAIL-1.1',lease_id:'lease-1',worker_id:'worker-1'},
    signature:'sig-1'
  });};
  await assert.rejects(
    leaseNextJob({baseUrl:'http://bridge.test',token:'token',workerId:'worker-1',fetchImpl}),
    /lease job_id is required/
  );
  assert.equal(calls,1);
});

test('accepts a well-formed lease envelope',async()=>{
  const fetchImpl=async()=>response(200,{
    rail_schema:'BECK-BRIDGE-RAIL-1.1',
    envelope:{
      schema_version:'BECK-BRIDGE-RAIL-1.1',
      lease_id:'lease-2',
      job_id:'job-2',
      worker_id:'worker-1',
      objective:'test objective'
    },
    signature:'sig-2',
    job:{id:'job-2',type:'test',payload:{mission:'test objective'}}
  });
  const lease=await leaseNextJob({baseUrl:'http://bridge.test',token:'token',workerId:'worker-1',fetchImpl});
  assert.equal(lease.envelope.job_id,'job-2');
  assert.equal(lease.job.id,'job-2');
});
