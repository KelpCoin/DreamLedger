const express = require('express');
const app = express();

app.get('/health',(req,res)=>res.json({
  ok:true,
  RENDER_BEACON:true,
  stamp:'20260625_235142'
}));

app.listen(process.env.PORT || 3000);
console.log('BEACON_RUNTIME_ACTIVE');
