const express = require("express");
const app = express();

const BOOT_ID = Date.now();

app.get("/boot", (req,res)=>{
  res.json({
    bootId: BOOT_ID,
    pid: process.pid,
    cwd: process.cwd(),
    entry: process.argv,
    envStart: process.env.npm_lifecycle_event || null
  });
});

app.get("/health",(req,res)=>res.json({ok:true}));

app.get("/debug",(req,res)=>{
  res.json({
    ok:true,
    routes:["/boot","/health","/debug","/mtg","/mtg-test"]
  });
});

app.get("/mtg-test",(req,res)=>res.send("MTG OK"));

app.get("/mtg",(req,res)=>{
  res.send(`<h1>MTG LIVE</h1><p>PID ${process.pid}</p><p>BOOT ${BOOT_ID}</p>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("RUNNING", PORT, process.pid));