const express = require("express");
const app = express();

const BOOT = {
  ts: Date.now(),
  pid: process.pid,
  mode: "CANONICAL_SINGLE_RUNTIME"
};

app.get("/health", (req,res)=>res.json({ok:true,BOOT}));
app.get("/runtime", (req,res)=>res.json({file:__filename,BOOT}));

app.listen(process.env.PORT || 3000, () => {
  console.log("CANONICAL LIVE", BOOT);
});
