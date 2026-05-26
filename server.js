const express = require("express");
const path = require("path");

const app = express();

const carouselState = {
  version: "v1",
  items: [
    { id: 1, title: "MTG Engine", status: "stub", ctr: 0.01 },
    { id: 2, title: "Carousel Engine", status: "active", ctr: 0.07 },
    { id: 3, title: "Revenue Hooks", status: "standby", ctr: 0.00 }
  ]
};

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/state", (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    carousel: carouselState
  });
});

app.get("/health", (req,res)=>{
  res.json({ ok:true, service:"carousel-engine", ts:Date.now() });
});

app.get("/ping", (req,res)=>res.send("pong"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("CAROUSEL ENGINE LIVE", port));
