const express = require('express');
const app = express();

const BOOT = {
  ts: Date.now(),
  env: process.env.NODE_ENV || 'unknown',
  port: process.env.PORT || 3000,
  commit: process.env.RENDER_GIT_COMMIT || 'unknown',
  mode: 'CANONICAL_SINGLE_RUNTIME_V3'
};

app.get('/health', (req,res)=>res.json({
  ok:true,
  service:'dreamledger',
  version:'3.0.0-canonical',
  BOOT
}));

app.get('/runtime', (req,res)=>res.json({
  ok:true,
  file: __filename,
  cwd: process.cwd(),
  node: process.version,
  BOOT
}));

app.get('/debug', (req,res)=>res.json({
  ok:true,
  routes:['/health','/runtime','/debug']
}));

app.listen(BOOT.port, ()=>console.log('CANONICAL_RUNTIME_ACTIVE', BOOT));
