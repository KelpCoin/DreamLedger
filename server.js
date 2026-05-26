const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
  <html>
    <head>
      <title>carousel-catalog :: LIVE</title>
      <style>
        body { background:#0a0a0a; color:#fff; font-family:Arial; padding:40px; }
        .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .card { border:1px solid #333; padding:20px; border-radius:10px; }
      </style>
    </head>
    <body>
      <h1>carousel-catalog LIVE</h1>
      <div class="grid">
        <div class="card">MTG Engine Placeholder</div>
        <div class="card">Carousel System Stub</div>
        <div class="card">Revenue Hooks Stub</div>
      </div>
    </body>
  </html>
  `);
});

app.get("/health", (req,res)=>res.json({ok:true, time:Date.now()}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("LIVE ON", port));
