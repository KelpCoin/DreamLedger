const express = require('express');
const app = express();

const BOOT = {
  ts: Date.now(),
  mode: 'RENDER_HARD_SYNC_V5',
  commit: process.env.RENDER_GIT_COMMIT || 'local',
  stamp: '20260625_235232'
};

app.get('/health',(req,res)=>res.json({
  ok:true,
  service:'dreamledger',
  version:'5.0.0-SYNC',
  BOOT
}));

app.get('/runtime',(req,res)=>res.json({
  ok:true,
  node: process.version,
  cwd: process.cwd(),
  file: __filename,
  BOOT
}));

app.get('/debug',(req,res)=>res.json({
  ok:true,
  routes:['/health','/runtime','/debug']
}));

app.listen(process.env.PORT || 3000, ()=>console.log("RENDER_SYNC_ACTIVE"));
