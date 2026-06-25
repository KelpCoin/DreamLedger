const express = require('express');
const app = express();

const FINGERPRINT = {
  ts: Date.now(),
  stamp: '20260625_235326',
  mode: 'RUNTIME_TRUTH_ANCHOR_V6',
  repo: 'KelpCoin/DreamLedger'
};

app.get('/health',(req,res)=>res.json({
  ok:true,
  fingerprint:FINGERPRINT,
  route:'/health'
}));

app.get('/runtime',(req,res)=>res.json({
  ok:true,
  fingerprint:FINGERPRINT,
  node:process.version,
  file:__filename,
  cwd:process.cwd()
}));

app.get('/debug',(req,res)=>res.json({
  ok:true,
  routes:['/health','/runtime','/debug']
}));

app.get('/',(req,res)=>res.send('DREAMLEDGER LIVE ' + FINGERPRINT.stamp));

app.listen(process.env.PORT || 3000, ()=>{
  console.log('FINGERPRINT_RUNTIME_ACTIVE', FINGERPRINT);
});
