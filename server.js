const express = require("express");
const app = express();

const BOOT = { ts: Date.now(), pid: process.pid };

app.get("/health",(req,res)=>res.json({ok:true,boot:BOOT}));

app.get("/runtime",(req,res)=>res.json({
  file: __filename,
  cwd: process.cwd(),
  node: process.version,
  boot: BOOT
}));

app.get("/debug",(req,res)=>res.json({
  ok:true,
  routes:["/health","/runtime","/debug","/mtg"]
}));

app.get("/mtg",(req,res)=>res.send(`<h1>MTG LIVE</h1><p>${BOOT.pid}</p>`));

app.listen(process.env.PORT || 3000, ()=>console.log("RUNNING", BOOT));
// DEPLOY_FINGERPRINT=RUNTIME_SYNC_20260625_232746

// FORCE_REBUILD=HARD_REBUILD_20260625_232819
