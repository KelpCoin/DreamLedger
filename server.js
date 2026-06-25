const express = require("express");
const app = express();

const BOOT = {
  id: Date.now(),
  pid: process.pid,
  env: process.env.NODE_ENV || "unknown"
};

app.get("/health", (req,res)=>res.json({ok:true, boot:BOOT}));
app.get("/debug", (req,res)=>res.json({
  ok:true,
  routes:["/health","/debug","/mtg","/where","/render-check"],
  boot:BOOT
}));

app.get("/mtg", (req,res)=>res.send(`<h1>MTG OK</h1><p>${BOOT.pid}</p>`));

app.get("/where", (req,res)=>res.json({
  cwd: process.cwd(),
  argv: process.argv,
  boot: BOOT
}));

app.get("/render-check", (req,res)=>res.json({
  message:"If you see this, THIS server.js is live",
  boot:BOOT
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("BOOTED", PORT, BOOT));

// DEPLOY_FINGERPRINT=FORCE_SYNC_20260625_232444
