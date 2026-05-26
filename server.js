const express = require("express");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req,res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    status: "render-aligned"
  });
});

app.get("/ping", (req,res)=>res.send("pong"));

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("RENDER SERVICE LIVE ON", port);
});
