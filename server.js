const express = require('express');
const app = express();

const BOOT = {
  ts: Date.now(),
  mode: 'RENDER_HARD_RESET_V1',
  commit: process.env.RENDER_GIT_COMMIT || 'unknown',
  port: process.env.PORT || 3000
};

app.get('/health', (req,res)=>res.json({
  ok:true,
  service:'dreamledger',
  version:'RESET_1.0',
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

app.listen(BOOT.port, ()=>console.log('RENDER_RESET_RUNTIME_ACTIVE', BOOT));
