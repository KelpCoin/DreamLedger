const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req,res)=>res.json({ok:true, ts:Date.now()}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("CANON UI LIVE", port));
