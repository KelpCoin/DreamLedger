const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>carousel-catalog</title>
        <style>
          body { font-family: Arial; background:#0b0b0b; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; }
          .box { border:1px solid #333; padding:30px; border-radius:12px; text-align:center; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>carousel-catalog</h1>
          <p>Render deployment is now aligned.</p>
          <p>Next layer: carousel system.</p>
        </div>
      </body>
    </html>
  `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Running on", port));
