const express = require("express");
const app = express();

const BOOT = {
  ts: Date.now(),
  pid: process.pid,
  mode: "SINGLE_RUNTIME_LOCKED"
};

app.get("/health",(req,res)=>res.json({ok:true,BOOT}));

app.get("/runtime",(req,res)=>res.json({
  ok:true,
  file: __filename,
  cwd: process.cwd(),
  node: process.version,
  BOOT
}));

app.get("/debug",(req,res)=>res.json({
  ok:true,
  routes:["/health","/runtime","/debug"]
}));

app.listen(process.env.PORT || 3000, ()=>{
  console.log("SINGLE RUNTIME ACTIVE", BOOT);
});
